import assert from 'node:assert/strict';
import {calcHakedisTotals, priceForQuantity} from '../js/core.js';
import {claimWorkResolution} from '../js/hakedis-finance.js';
import {invoiceDraft, invoiceQueue, uninvoicedWorks, workNet, draftText} from '../js/invoice-core.js';
import {matchInvoice} from '../js/invoice-import.js';
import {workAmount, customerBalances} from '../js/collect-core.js';
import {workMoney} from '../js/vat-contract.js';
import {workFinancials} from '../js/enterprise-core.js';
import {customerReportData} from '../js/customer-report.js';
import {monthlySeries} from '../js/finance-chart.js';
import {buildReport} from '../js/report-core.js';
import {quoteActualRows} from '../js/solo-core.js';

const date='2026-10-25';
function fixture(overrides={}, count=1, legacy=true) {
  const items=Array.from({length:count},(_,i)=>({work_record_id:'W'+i,customer_id:'C',date,quantity:1,unit:'Sefer',work_type:'TEST',unit_price:1200,kdv_rate:20,kdv_included:true,...overrides}));
  const t=calcHakedisTotals(items);
  const h={id:'H',hakedis_no:1,status:'Kesinleşti',customer_id:'C',date_from:date,date_to:date,items:t.lines,subtotal:t.subtotal,kdv_total:t.kdv,grand_total:t.grand};
  const works=t.lines.map(item=>({id:item.work_record_id,customer_id:'C',date,quantity:item.quantity,unit:item.unit,work_type:'TEST',price_snapshot:{...item,amount:legacy?item.amount:priceForQuantity({...item,price:item.unit_price},item.quantity),locked:true}}));
  return {customers:[{id:'C',name:'TEST',tax_no:'1234567890',tax_office:'TEST',address:'TEST'}],work_records:works,hakedis:[h],cari_movements:[{id:'M',customer_id:'C',date,type:'Hakedis',ref_id:'H',amount:t.grand}]};
}

for (const legacy of [true,false]) for (const [fields,raw,net,tax,gross] of [
  [{},1200,1000,200,1200],
  [{unit_price:1000,kdv_included:false},1000,1000,200,1200],
  [{unit_price:0,quantity:2},0,0,0,0],
  [{unit_price:500,quantity:2,kdv_rate:0},1000,1000,0,1000],
  [{unit_price:null,formula:'CRANE_FIRST_HOUR',quantity:2,unit:'Saat',first_hour_price:600,next_hour_price:120},720,600,120,720],
  [{unit_price:null,formula:'CRANE_FIRST_HOUR',quantity:0.5,unit:'Saat',first_hour_price:0,next_hour_price:null},0,0,0,0],
]) {
  const d=fixture(fields,1,legacy),before=structuredClone(d),w=d.work_records[0],r=claimWorkResolution(d,w);
  assert.equal(r.issue,null); assert.equal(r.work.price_snapshot.amount,raw);
  assert.deepEqual([r.claim.net,r.claim.tax,r.claim.gross],[net,tax,gross]);
  assert.equal(workAmount(w,d),raw); assert.equal(customerBalances(d).bal.C||0,gross);
  if(raw>0){
    const F=invoiceDraft(d,'C',{to:date});
    assert.deepEqual([F.net,F.kdv,F.total],[net,tax,gross]);
    assert.equal(workNet(w,d).net,net); assert.equal(workMoney(w,d).gross,fields.kdv_included===false?gross:raw);
    assert.equal(workFinancials(w,d).net_total,net);
    assert.equal(quoteActualRows({type:'UNIT_PRICE',items:[{label:'TEST',unit:w.unit,unit_price:1}]},[w],d)[0].actual_net,net);
    assert.equal(customerReportData(d,'C',{to:date,today:date}).totals.workTotal,raw);
    assert.equal(monthlySeries(d,{today:date,months:1})[0].work,raw);
    assert.ok(JSON.stringify(buildReport(d,{k:'musteri',id:'C',to:date,today:date})).includes(raw.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})));
    const match=matchInvoice(d,{buyer_tax_no:'1234567890',date,net});
    assert.equal(match.sum,net);assert.equal(match.exact,true);
  }
  assert.deepEqual(d,before,'All recovery/calculation paths are read-only, including stored prices, claims and ledger');
}

// Frozen claim line rounding and tariff input basis are intentionally distinct.
for(const included of [true,false]) for(const legacy of [true,false]) {
  const d=fixture({unit_price:0.03,kdv_included:included},2,legacy),before=structuredClone(d),F=invoiceDraft(d,'C',{to:date});
  assert.equal(workAmount(d.work_records[0],d),0.03);
  assert.deepEqual([F.net,F.kdv,F.total],[0.06,0.02,0.08]);
  assert.equal(F.lines.length,1,'Grouping must not erase already-frozen VAT cents');
  assert.deepEqual(d,before);
  const unclaimed={...d,hakedis:[],work_records:d.work_records.map(w=>({...w,price_snapshot:{unit_price:0.03,amount:0.03,kdv_rate:20,kdv_included:included}}))};
  assert.deepEqual([invoiceDraft(unclaimed,'C').net,invoiceDraft(unclaimed,'C').kdv,invoiceDraft(unclaimed,'C').total],[0.06,0.01,0.07],'Unclaimed rounding remains the existing behavior');
}

// Refuse to infer a financial basis from a lock flag or a contradictory source.
for (const quantity of [0.5, 1.5, 2.5]) for(const count of [1,10,100]) for(const unit_price of [0.01,0.05]) {
  const d=fixture({quantity,unit_price,kdv_included:false},count);
  assert.equal(claimWorkResolution(d,d.work_records[0]).issue,null,'Canonical fractional-quantity subcent input is valid, never silently rounded');
  assert.equal(workAmount(d.work_records[0],d),priceForQuantity({price:unit_price},quantity));
  assert.equal(invoiceDraft(d,'C').net,d.hakedis[0].subtotal);
  assert.equal(invoiceDraft(d,'C').kdv,d.hakedis[0].kdv_total);
  assert.equal(invoiceDraft(d,'C').total,d.hakedis[0].grand_total);
  assert.equal(invoiceQueue(d,{today:date})[0].net,d.hakedis[0].subtotal);
  assert.equal(matchInvoice(d,{buyer_tax_no:'1234567890',date,net:d.hakedis[0].subtotal}).sum,d.hakedis[0].subtotal);
}
const mutations=[
  d=>{d.hakedis=[];}, d=>{d.hakedis.push({...structuredClone(d.hakedis[0]),id:'H2'});},
  d=>{d.hakedis[0].deleted_at=date;},d=>{d.hakedis[0].grand_total=999999;},
  d=>{d.work_records[0].quantity=2;},d=>{d.work_records[0].quantity=1.001;},d=>{d.work_records[0].date='2026-10-24';},
  d=>{d.work_records[0].customer_id='D';d.customers.push({id:'D',name:'OTHER'});},
  d=>{d.work_records[0].price_snapshot.kdv_rate=10;},d=>{d.work_records[0].price_snapshot.amount=500;},
  d=>{d.work_records[0].price_snapshot.work_record_id='OTHER';},d=>{d.hakedis[0].items[0].total=1100;},
  d=>{d.hakedis[0].grand_total+=0.004;},d=>{d.hakedis[0].date_from='2026-00-00';},
];
for(const mutate of mutations){
  const d=fixture();mutate(d);const before=structuredClone(d),w=d.work_records[0],r=claimWorkResolution(d,w);
  assert.ok(r.issue);assert.equal(r.work,w);assert.equal(workNet(w,d).net,null);
  const F=invoiceDraft(d,w.customer_id,{to:date});
  assert.equal(F.review.length,1);assert.equal(F.net,null);assert.equal(F.kdv,null);assert.equal(F.total,null);
  assert.throws(()=>draftText(F),/Hakediş kaynağı/);assert.equal(invoiceQueue(d,{today:date})[0].net,null);
  assert.equal(customerReportData(d,w.customer_id,{today:date,to:date}).financialIssues.length,1);
  assert.equal(monthlySeries(d,{today:date,months:1})[0].financialReview,1);
  assert.ok(buildReport(d,{k:'musteri',id:w.customer_id,to:date,today:date}).notes.some(n=>n.includes('hakediş kaynağı doğrulanamadı')));
  assert.deepEqual(d,before);
}

// Positive TL + fuel is invoiced once; zero/fuel-only/missing money is never monetized.
const mixed=fixture();mixed.hakedis=[];
mixed.work_records=[
  {id:'MIX',customer_id:'C',date,quantity:1,unit:'Sefer',customer_fuel_allowance_l:75,price_snapshot:{unit_price:1200,amount:1200,kdv_rate:20,kdv_included:true}},
  {id:'FUEL',customer_id:'C',date,quantity:1,unit:'Sefer',customer_fuel_allowance_l:75,price_snapshot:{unit_price:0,amount:0,price_source:'Mazot karşılığı'}},
  {id:'MISSING',customer_id:'C',date,quantity:1,unit:'Sefer',customer_fuel_allowance_l:75},
  {id:'ZERO',customer_id:'C',date,quantity:1,unit:'Sefer',price_snapshot:{unit_price:0,amount:0}},
];
assert.deepEqual(uninvoicedWorks(mixed).map(w=>w.id),['MIX']);
assert.deepEqual([invoiceDraft(mixed,'C').net,invoiceDraft(mixed,'C').total],[1000,1200]);
const settled={...mixed,work_records:mixed.work_records.map(w=>({...w,invoice_no:'EXISTING-ISSUED'}))};
assert.deepEqual(uninvoicedWorks(settled),[]);assert.deepEqual(invoiceQueue(settled),[]);
const imported={...mixed,work_records:[{...mixed.work_records[0],customer_fuel_allowance_l:0,settlement:'unbilled_unpaid',price_snapshot:{unit_price:1200,amount:1200,kdv_rate:20,kdv_included:true,price_source:'Geçmiş aktarım',locked:false}}]};
assert.equal(invoiceDraft(imported,'C').review.length,0);assert.equal(invoiceDraft(imported,'C').total,1200);
console.log('hakedis finance PASS: exact linked-source recovery, frozen VAT cents, unchanged tariff/debt policy, ambiguity review, mixed TL/litres and no historical writes');

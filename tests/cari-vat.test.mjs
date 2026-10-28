import assert from 'node:assert/strict';
import {customerVatBreakdowns, receivableVatSummary} from '../js/vat-contract.js';
import {customerBalances} from '../js/collect-core.js';
import {toKurus} from '../js/core.js';

const work=(id,customer_id,amount,rate,included)=>({id,customer_id,date:'2026-10-20',quantity:1,unit:'Sefer',price_snapshot:{amount,unit_price:amount,kdv_rate:rate,kdv_included:included}});
const d={customers:[{id:'C',name:'TEST mixed'},{id:'A',name:'TEST advance'},{id:'U',name:'TEST unknown'},{id:'Z',name:'TEST zero VAT'},{id:'I',name:'TEST internal',internal:true}],
  work_records:[work('EX','C',1000,20,false),work('IN','C',1200,20,true),work('TEN','C',110,10,true),work('ZERO','Z',50,0,false),work('TINY','Z',.014,20,false),work('ADVANCE','A',100,20,true),work('MISSING','U',300,null,false),work('INTERNAL','I',999,20,false),{...work('BILLED','C',50000,20,false)}],
  hakedis:[{id:'H',customer_id:'C',status:'Kesinleşti',subtotal:2000,kdv_total:400,grand_total:2400,items:[{work_record_id:'BILLED'}]},
    {id:'DRAFT',customer_id:'C',status:'Taslak',subtotal:900000,kdv_total:180000,grand_total:1080000,items:[]}],
  cari_movements:[{id:'HM',customer_id:'C',type:'Hakedis',ref_id:'H',amount:2400,date:'2026-10-21'},
    {id:'RECEIPT',customer_id:'C',type:'Tahsilat',amount:-600,date:'2026-10-22'},
    {id:'CORRECTION',customer_id:'C',type:'Duzeltme',amount:25,date:'2026-10-22'},
    {id:'ADV',customer_id:'A',type:'Tahsilat',amount:-150,date:'2026-10-22'}],
  cash_records:[{id:'SAME-CASH',customer_id:'C',cash_type:'Müşteriden Para Alındı',amount:600,date:'2026-10-22'}]};
const before=JSON.stringify(d),reports=customerVatBreakdowns(d),c=reports.get('C');
assert.deepEqual([c.net,c.tax,c.gross,c.receipts,c.adjustments,c.balance,c.unpostedTax],[4100,810,4910,600,25,4135,200]);
assert.equal(c.unbilled,2310,'finalized claim source work is not counted twice; draft claim is not a debit');
assert.equal(reports.has('I'),false,'internal customers stay outside receivables');
assert.deepEqual([reports.get('U').net,reports.get('U').tax,reports.get('U').gross],[300,null,null],'missing VAT does not become 0 or 20 percent');
assert.equal(reports.get('U').balance,300,'unknown VAT does not change the recorded amount');
assert.deepEqual([reports.get('Z').net,reports.get('Z').tax,reports.get('Z').gross],[50.01,0,50.01],'%0 and cent rounding are preserved');
const balances=customerBalances(d);
for(const [id,row] of reports){assert.equal(row.balance,balances.bal[id]);assert.equal(row.unbilled,balances.unbilled[id]);}
const total=receivableVatSummary(reports);
assert.equal(total.balance,4485.01,'positive balances only; a different customer advance never nets against them');
assert.equal(total.net,4450.01);assert.equal(total.tax,null);assert.equal(total.gross,null);
assert.equal(total.receipts,600,'cash record and its ledger movement are one collection, not two');
assert.equal(JSON.stringify(d),before,'no price, claim, collection or business record is mutated');

for(const patch of [{kdv_rate:undefined},{kdv_rate:''},{kdv_rate:101},{kdv_rate:-1},{kdv_included:undefined},{kdv_included:'false'},{locked:true}]){
  const data={customers:[{id:'C'}],work_records:[{...work('W','C',120,20,true),price_snapshot:{...work('W','C',120,20,true).price_snapshot,...patch}}]};
  const r=customerVatBreakdowns(data).get('C');
  assert.equal(r.tax,null,JSON.stringify(patch));assert.equal(r.gross,null);assert.equal(r.balance,120);assert.equal(r.issues.length,1);
}
for(const mutate of [
  x=>x.hakedis[0].grand_total=2500,
  x=>x.hakedis[0].kdv_total=null,
  x=>x.hakedis[0].customer_id='OTHER',
  x=>x.hakedis[0].status='İptal',
  x=>x.hakedis[0].deleted_at='2026-10-22',
  x=>x.cari_movements.push({...x.cari_movements[0],id:'DUPLICATE'}),
  x=>x.hakedis.push({...x.hakedis[0]}),
  x=>x.cari_movements[0].ref_id='MISSING',
]){
  const data=structuredClone(d);mutate(data);const r=customerVatBreakdowns(data).get('C');
  assert.equal(r.tax,null);assert.equal(r.gross,null);assert.ok(r.issues.length);
  assert.equal(r.balance,customerBalances(data).bal.C,'orphan, duplicate or inconsistent claim cannot silently alter the ledger');
}
for(const included of [true,false])for(const amount of [.01,.02,.03,.07,.29,1000.01,1999.99]){
  const data={customers:[{id:'C'}],work_records:[work('W','C',amount,20,included)]};
  const r=customerVatBreakdowns(data).get('C');
  assert.equal(toKurus(r.net)+toKurus(r.tax),toKurus(r.gross),'principal + VAT equals total exactly to the cent');
  assert.equal(r.balance,customerBalances(data).bal.C);
}
const deleted=structuredClone(d);deleted.work_records.push({...work('DELETED','C',100000,20,false),deleted_at:'2026-10-22'});
assert.deepEqual(customerVatBreakdowns(deleted).get('C'),c,'deleted works never reappear');
console.log('cari-vat PASS: strict frozen net/VAT basis, partial collections separate, no inferred VAT or balance changes, positive-customer scope, duplicates and exact cent identities');

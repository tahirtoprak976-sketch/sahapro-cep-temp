import assert from 'node:assert/strict';
import {claimVatItem} from '../js/hakedis-vat.js';
import {calcHakedisTotals} from '../js/core.js';
import {hakedisSpec} from '../js/pdf.js';
import {customerReportData,customerReportSpec} from '../js/customer-report.js';
import {hakedisPreparation} from '../js/hakedis-preparation.js';
for(const included of [false,true])for(const rate of [0,10,20]){
 const item={work_record_id:'TEST_W',date:'2026-11-01',quantity:3,unit:'Sefer',unit_price:included?1200:1000,kdv_rate:rate,kdv_included:included,source_price_snapshot:{unit_price:included?1200:1000,kdv_rate:rate,kdv_included:included}},before=structuredClone(item);
 const on=calcHakedisTotals([claimVatItem(item,true)]),off=calcHakedisTotals([claimVatItem(item,false)]);
 assert.equal(on.subtotal,off.subtotal);assert.equal(off.kdv,0);assert.equal(off.grand,off.subtotal);
 assert.deepEqual(item,before,'Original source, including included tariff and rate, stays unchanged');
}
assert.throws(()=>claimVatItem({unit_price:100,quantity:3,kdv_rate:20,kdv_included:true},false),/kuruşa/,'Rounding must require explicit tariff review instead of silently changing price');
assert.throws(()=>claimVatItem({unit_price:100,quantity:1,kdv_rate:null,kdv_included:true},false),/oranı eksik/);
assert.throws(()=>claimVatItem({unit_price:100,quantity:1,kdv_rate:null,kdv_included:false},true),/oran eksik/);
const zero=claimVatItem({unit_price:0,quantity:1,kdv_included:false,kdv_rate:0},false);assert.equal(calcHakedisTotals([zero]).grand,0);
const crane={formula:'CRANE_FIRST_HOUR',quantity:2,first_hour_price:600,next_hour_price:120,kdv_rate:20,kdv_included:true};assert.equal(calcHakedisTotals([claimVatItem(crane,false)]).grand,600);
const item={work_record_id:'TEST_W',date:'2026-11-01',customer_id:'TEST_C',vehicle_id:'TEST_V',quantity:6,unit:'Sefer',work_type:'Nakliye',unit_price:4500,kdv_rate:20,kdv_included:false,vehicle_name:'TEST Araç'};
const t=calcHakedisTotals([item]),h={id:'TEST_H',hakedis_no:1,customer_id:'TEST_C',status:'Kesinleşti',date_from:item.date,date_to:item.date,subtotal:t.subtotal,kdv_total:t.kdv,grand_total:t.grand,items:t.lines},names={customers:{TEST_C:'TEST Müşteri'},sites:{}};
const unpriced=JSON.stringify(hakedisSpec(h,names,{unpriced:true}));for(const amount of ['4500','4.500','27000','27.000','5400','5.400','32400','32.400'])assert.ok(!unpriced.includes(amount),'Unpriced output must contain no money value');
const priced=hakedisSpec(h,names);assert.equal(priced.sections[1].headers.at(-1),'Tutar (KDV hariç)');assert.equal(priced.sections[1].rows[0].at(-1),'27.000,00 TL');
const d={customers:[{id:'TEST_C',name:'TEST Müşteri'}],vehicles:[{id:'TEST_V',name:'TEST Araç'}],dump_sites:[{id:'TEST_Y',own_yard:true}],work_records:[{id:'TEST_W',date:item.date,customer_id:'TEST_C',vehicle_id:'TEST_V',dump_site_id:'TEST_Y',work_type:'Moloz Nakliye',quantity:6,unit:'Sefer',price_snapshot:{unit_price:4500,amount:27000,kdv_rate:20,kdv_included:false}}],hakedis:[],cari_movements:[{id:'TEST_P',customer_id:'TEST_C',type:'Tahsilat',date:item.date,amount:-20000}]};
const before=structuredClone(d),opts={from:'2026-11-01',to:'2026-11-09',today:'2026-11-09'},prep=hakedisPreparation(d,{customer_id:'TEST_C',...opts});assert.equal(prep.ready.length,1,'Own yard requires no nonexistent ticket');assert.equal(prep.ready[0].expectedTickets,null);assert.deepEqual(d,before);
for(const tax of [0,5400]){
 const data=structuredClone(d);if(tax){data.hakedis=[h];data.cari_movements.push({id:'TEST_M',customer_id:'TEST_C',type:'Hakedis',ref_id:h.id,date:item.date,amount:32400});}
 const report=customerReportData(data,'TEST_C',opts),a=report.account;
 assert.deepEqual([a.principal,a.vat,a.collections,report.statement.closing],[27000,tax,20000,7000+tax]);
 assert.equal(report.statement.opening+a.principal+a.vat+a.other-a.collections,report.statement.closing);
 assert.ok(JSON.stringify(customerReportSpec(report)).includes('Kesinleşen hakediş KDV’si'));
}
console.log('hakedis VAT105: optional VAT, exact basis, unknown/cent review, immutable sources, priced/unpriced and ledger PDF reconciliation PASS');

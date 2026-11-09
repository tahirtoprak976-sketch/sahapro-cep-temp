import assert from 'node:assert/strict';
import {customerBalances,customerOpenItems} from '../js/collect-core.js';
const work=(amount,included)=>({id:'TEST_W',customer_id:'TEST_C',date:'2026-11-01',quantity:3,unit:'Sefer',price_snapshot:{unit_price:amount/3,amount,kdv_rate:20,kdv_included:included}});
for(const [amount,included,net]of [[27000,false,27000],[19500,true,16250]]){
 const d={customers:[{id:'TEST_C',name:'TEST Müşteri'}],work_records:[work(amount,included)],hakedis:[],cari_movements:[]},before=structuredClone(d);
 assert.equal(customerBalances(d).bal.TEST_C,net,'Before an explicitly finalized VAT choice, customer balance must exclude VAT');
 assert.equal(customerOpenItems(d,'TEST_C','2026-11-09').debit,net);
 d.cari_movements.push({id:'TEST_P',customer_id:'TEST_C',date:'2026-11-02',type:'Tahsilat',amount:-10000});
 assert.equal(customerBalances(d).bal.TEST_C,net-10000);
 d.hakedis.push({id:'TEST_H',customer_id:'TEST_C',status:'Kesinleşti',items:[{work_record_id:'TEST_W'}],subtotal:net,kdv_total:net*.2,grand_total:net*1.2});
 d.cari_movements.push({id:'TEST_M',customer_id:'TEST_C',date:'2026-11-03',type:'Hakedis',ref_id:'TEST_H',amount:net*1.2});
 assert.equal(customerBalances(d).bal.TEST_C,net*1.2-10000,'A frozen finalized claim keeps its recorded VAT charge');
 assert.deepEqual(d.work_records,before.work_records,'No old work or source tariff is rewritten');
}
console.log('optional VAT policy: preclaim net, finalized stored amount, receipts and immutable source PASS');

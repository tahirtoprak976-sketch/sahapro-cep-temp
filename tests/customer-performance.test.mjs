import assert from 'node:assert/strict';
import {customerDirectory} from '../js/customer-directory.js';
import {customerBalances,missingCustomerWorkPrice} from '../js/collect-core.js';
import {customerFuelLedger,fuelRulesOf} from '../js/assistant-rules.js';
const d={customers:[],work_records:[],cari_movements:[],hakedis:[],fuel_records:[],fuel_tank_movements:[],sites:[]};
for(let i=0;i<80;i++)d.customers.push({id:'c'+i,name:'TEST '+i,...(i%9===0?{fuel_rules:[{per:75,unit:'Sefer'}]}:{}),...(i%17===0?{deleted_at:'x'}:{}),...(i%19===0?{internal:true}:{})});
for(let i=0;i<2400;i++){
  d.work_records.push({id:'w'+i,customer_id:'c'+i%80,date:i%37===0?'':'2026-10-20',quantity:1+i%7,unit:i%2?'Sefer':'Saat',work_type:'TEST',...(i%4===0?{customer_fuel_allowance_l:(i%11+1)*0.13}:{}),...(i%5?{price_snapshot:{amount:i%3?i*0.19:0,locked:i%71===0}}:{}),...(i%41===0?{deleted_at:'x'}:{})});
  d.cari_movements.push({id:'m'+i,customer_id:'c'+(i*7)%80,amount:(i%3?-1:1)*i*0.17,...(i%43===0?{deleted_at:'x'}:{})});
  d.fuel_records.push({id:'f'+i,customer_id:'c'+(i*3)%80,liters:(i%13)*0.17,fuel_source:i%3?'Müşteri Verdi':'Akaryakıt İstasyonu',...(i%47===0?{deleted_at:'x'}:{})});
  d.fuel_tank_movements.push({id:'t'+i,customer_id:'c'+(i*5)%80,liters:(i%17)*0.23,move_type:i%3?'GİRİŞ':'ÇIKIŞ',...(i%53===0?{deleted_at:'x'}:{})});
  if(i%11===0)d.hakedis.push({id:'h'+i,status:i%3?'Kesinleşti':'Taslak',items:[{work_record_id:'w'+i},{work_record_id:'w'+(i+1)}],...(i%77===0?{deleted_at:'x'}:{})});
}
const before=JSON.stringify(d),referenceBalances=customerBalances(d).bal;
const billed=new Set(d.hakedis.filter(h=>!h.deleted_at&&h.status==='Kesinleşti').flatMap(h=>h.items.map(i=>i.work_record_id)));
const reads={};const observed=new Proxy(d,{get(object,key){reads[key]=(reads[key]||0)+1;return object[key]}});
const fast=customerDirectory(observed);
for(const row of fast){
  const id=row.customer.id,works=d.work_records.filter(w=>!w.deleted_at&&w.customer_id===id);
  assert.equal(row.balance,referenceBalances[id],id+' TL balance must match unindexed canonical calculation');
  const ledger=customerFuelLedger(d,id);
  assert.deepEqual(row.fuel,fuelRulesOf(row.customer).length||ledger.works||ledger.receipts?ledger:null,id+' complete fuel ledger, units and rounding');
  assert.equal(row.works,works.length);
  assert.equal(row.unpriced,works.filter(w=>missingCustomerWorkPrice(w,billed.has(w.id))).length);
}
for(const store of ['work_records','cari_movements','hakedis','fuel_records','fuel_tank_movements'])assert.equal(reads[store],1,store+' source pool read once per render');
assert.equal(JSON.stringify(d),before,'no source record or source order may change');
// Indexes belong to this call, not a permanent cache: later data must be visible.
d.cari_movements.push({id:'fresh',customer_id:'c1',amount:-19.25});
d.fuel_records.push({id:'fresh-fuel',customer_id:'c1',liters:25,fuel_source:'Müşteri Verdi'});
const next=customerDirectory(d).find(r=>r.customer.id==='c1'),old=fast.find(r=>r.customer.id==='c1');
assert.equal(Math.round((old.balance-next.balance)*100),1925);
assert.equal(Math.round((next.fuel.received-old.fuel.received)*10),250);
console.log('customer performance: 80 customers / 2400 rows per source, canonical TL/fuel parity, one source scan and fresh next render OK');

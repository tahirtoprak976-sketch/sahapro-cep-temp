import assert from 'node:assert/strict';
import {validatePlan} from '../js/assistant-core.js';
import {loadingDescription} from '../js/assistant-source-context.js';
import {routeCustomerDepotReceipt} from '../js/customer-fuel.js';
const d={customers:[{id:'C',name:'Örnek Yapı'}],personnel:[],vehicles:[{id:'V',name:'TEST Kepçe',type:'JCB'}],sites:[],aliases:[],work_records:[]};
for(const recipient of ['nakliyeciye','kamyoncuya','şoföre','taşıyıcıya']){
 const quote=`Örnek Yapı TEST Kepçe 2 saat kum yüklendi ${recipient}`;
 const row=validatePlan({works:[{customer_id:'C',vehicle_id:'V',date:'2026-11-02',unit:'Saat',quantity:2,work_type:'JCB Çalışması',material:'kum',description:'kum yüklendi',quote}]},{d,message:quote,today:'2026-11-02'}).works[0];
 assert.ok(row.description.includes(recipient),recipient);assert.equal(row.quantity,2);
 assert.equal(row.fieldConfidence.description.level,'KESIN');
}
console.log('source details: real reply replay, source recipients and fuel direction PASS');

for(const [description,quote] of [
 ['kum yüklendi','kum yüklendi nakliyeciye değil şoföre'],
 ['kum yüklendi kamyoncuya','kum yüklendi nakliyeciye'],
 ['moloz yüklendi','kum yüklendi nakliyeciye'],
 ['kum yüklendi','kum yüklenmedi nakliyeciye, yükleme yok'],
 ['x'.repeat(300),'kum yüklendi nakliyeciye'],
]){const detail=loadingDescription(description,quote);assert.equal(detail.conflict,true);assert.equal(detail.description,description);}
assert.equal(loadingDescription('kum yüklendi','kum yüklendi').description,'kum yüklendi');
const incoming='Örnek Yapı sefer karşılığı depoya 100 litre mazot verdi';
const plan={customer_fuel:[{customer_id:'C',date:'2026-11-02',liters:100,unit_price:999,total:99900,machine:'Forklift',quote:incoming}]};
const before=JSON.stringify(plan),options={d,today:'2026-11-02',message:incoming};
const routed=routeCustomerDepotReceipt(plan,options);assert.equal(JSON.stringify(plan),before);assert.equal(routed.customer_fuel.length,0);assert.equal(routed.tank_in[0].liters,100);assert.equal(routed.tank_in[0].total,null);assert.equal(routed.tank_in[0].unit_price,null);assert.equal(routed.tank_in[0].machine,undefined);
for(const message of [incoming.replace('verdi','verecek'),incoming.replace('verdi','vermedi'),incoming+' mi?',incoming.replace('depoya','forkliftine'),incoming+'\nBaşka bir iş',incoming.replace('Örnek Yapı','Biz Örnek Yapı'),incoming+' toplam 5000 TL']){
 const variant={customer_fuel:[{...plan.customer_fuel[0],quote:message}]};assert.strictEqual(routeCustomerDepotReceipt(variant,{...options,message}),variant,message);
}
for(const variant of [{...plan,tank_in:[{}]},{...plan,works:[{}]},{...plan,customer_fuel:[{...plan.customer_fuel[0],date:'2026-10-01'}]},{...plan,customer_fuel:[{...plan.customer_fuel[0],liters:500}]}])assert.strictEqual(routeCustomerDepotReceipt(variant,options),variant);
const ambiguous={...d,customers:[...d.customers,{id:'C2',name:'Örnek Yapı'}]};assert.strictEqual(routeCustomerDepotReceipt(plan,{...options,d:ambiguous}),plan);
console.log('source detail negatives: conflict, negation, length, reverse/promise, multiple operations/customers, money and input purity PASS');

const dangling={...d,customers:[],aliases:[{alias:'Örnek Yapı',target_type:'customer',target_id:'C'}]};assert.strictEqual(routeCustomerDepotReceipt(plan,{...options,d:dangling}),plan);

import {monthlySeries} from '../js/finance-chart.js';
import {matchingRequest} from '../js/enterprise-retry.js';
import assert from 'node:assert/strict';
import {pendingCustomerCash,executiveHome,executiveHomeHTML} from '../js/executive-home.js';
import {trackUpdateEdits,updateRisk,allowUpdate} from '../js/update-safety.js';
const today='2026-11-11',base={id:'TEST_CASH',date:today,cash_type:'Müşteriden Para Alındı',cash_status:'PERSONELDE',amount:10};
for(const amount of [null,undefined,'',' ','bad',Infinity,-10,0]){
 const data={cash_records:[{...base,amount}]},copy=structuredClone(data);
 assert.deepEqual(pendingCustomerCash(data,today),{total:null,personnel:null,reported:0},'Unknown money must never become zero');
 const m=executiveHome(data,{today});assert.match(executiveHomeHTML(m),/Doğrulayın/);assert.deepEqual(data,copy);
}
assert.equal(pendingCustomerCash({cash_records:[{...base,date:'2026-02-31'}]},today).personnel,null);
assert.equal(pendingCustomerCash({cash_records:[{...base,date:'2026-11-12'}]},today).personnel,0);
assert.equal(pendingCustomerCash({cash_records:[base,{...base,id:'TEST_R',cash_status:'TESLIM_BILDIRILDI',amount:5.25}]},today).total,15.25);
// The event target persists while screen controls are replaced.
const listeners={},stable={addEventListener:(n,f)=>listeners[n]=f,removeEventListener:n=>delete listeners[n]};
const clean=trackUpdateEdits(stable),field={type:'text',matches:()=>false};
const root={querySelector:()=>null,querySelectorAll:()=>[field]};
assert.equal(updateRisk(root).unsaved,false);listeners.input({target:{...field,matches:s=>s==='input,textarea,select'}});
const edited={type:'text',matches:s=>s==='input,textarea,select'};listeners.input({target:edited});assert.equal(updateRisk({...root,querySelectorAll:()=>[edited]}).unsaved,true);clean();assert.equal(Object.keys(listeners).length,0);
const modalRoot={ownerDocument:{querySelector:()=>({})}};assert.equal(updateRisk(modalRoot).busy,true);let asked=0;assert.equal((await allowUpdate(modalRoot,async()=>{asked++;return true})).allowed,false);assert.equal(asked,0);
console.log('PASS system108: unknown money, immutable old data, dated scope, stable edit tracking and open-dialog update guard');

const invoice={id:'TEST_B',items:[{id:'TEST_LINE',quantity:1,unit_price:10,net:10,tax:2,gross:12}],note:''},original=structuredClone(invoice);
assert.equal(matchingRequest(invoice,()=>({items:[{id:'TEST_REGENERATED',quantity:1,unit_price:10,net:10,tax:2,gross:12}]})),invoice);
assert.throws(()=>matchingRequest(invoice,()=>({items:[{quantity:2,unit_price:10,net:20,tax:4,gross:24}]})),e=>e.code==='OP_CONFLICT');
assert.throws(()=>matchingRequest(invoice,()=>({amount:Infinity})),e=>e.code==='OP_CONFLICT');
assert.throws(()=>matchingRequest(invoice,()=>{throw Error('bad input')}),e=>e.code==='OP_CONFLICT');
assert.throws(()=>matchingRequest({...invoice,status:'İptal'},()=>({note:''})),e=>e.code==='OP_REVERSED');assert.deepEqual(invoice,original);

const unresolved={customers:[{id:'TEST_C',name:'TEST Company'}],work_records:[{id:'TEST_W',date:today,customer_id:'TEST_C',quantity:1,unit:'Saat',price_snapshot:{unit_price:1000,amount:1000,locked:true}}]},savedUnresolved=structuredClone(unresolved);const month=monthlySeries(unresolved,{today,months:1})[0];assert.equal(month.work,1000);assert.equal(month.financialReview,1);assert.equal(month.profit,null);assert.deepEqual(unresolved,savedUnresolved);

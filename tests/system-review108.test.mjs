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

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePlan,assistantSystem} from '../js/assistant-core.js';
import {measureReal} from './assistant-gold/real-messages/measure.mjs';
import {source,cases,fixture,message} from './assistant-gold/real-messages/fixture.mjs';
import {assistantQuestions} from '../js/assistant-questions.js';
assert.equal(cases.length,20);assert.equal(source.business_rules.length,11);
for(const rule of source.business_rules)assert.ok(assistantSystem('').includes(rule));
for(const batch of [false,true]){
 const report=measureReal({batch});assert.equal(report.totals.silentWrong,0,JSON.stringify(report.totals));
 assert.equal(report.totals.missingCards,0);assert.equal(report.totals.extraCards,0);
 for(const detail of report.details)for(const row of detail.actual)for(const field of ['unit_price','amount','total','cost'])assert.ok(row[field]==null||row[field]==='',field+' invented');
 if(!batch){assert.ok(report.totals.readyCorrect>=24);assert.equal(report.totals.missedQuestions,0);}
}
const r=c=>validatePlan({works:[],fuel:[]},{message:message(c),d:fixture(),today:source.today_for_test});
const missing=r(cases.find(c=>c.id==='r10'));assert.equal(missing.works.length,2);assert.equal(missing.works[1].quantity,null);assert.equal(missing.works[1].ok,false);
const unknown=r(cases.find(c=>c.id==='r19'));assert.equal(unknown.fuel[0].liters,3);assert.equal(unknown.fuel[0].ok,false);assert.equal(unknown.works[1].vehicle_id,null);
const a={kind:'work',index:0,key:'work:0',missing:['customer'],fields:{customer:''},r:{unknownCustomerLabel:'Ortak yer'}},b={...a,index:1,key:'work:1'};
const questions=assistantQuestions([a,b]);assert.equal(questions.length,1);assert.equal(questions[0].targets.length,2);
assert.equal(assistantQuestions([a,{...b,r:{unknownCustomerLabel:'Başka yer'}}]).length,2);
assert.equal(assistantQuestions([{...a,saved:true}]).length,0);
console.log('20 real pseudonymized messages + combined: no silent error, no invented money, no missing/extra cards; field-scoped questions PASS');

// Source-context evidence must never turn invalid/relative dates into a checked today card.
for(const kind of ['work','fuel']){
 const body=kind==='work'?'Lena 2 saat cam verildi':'Manitou depodan 3 litre mazot aldı';
 const rows=(text)=>{const out=validatePlan({works:[],fuel:[]},{d:fixture(),message:text,today:'2026-11-04'});return out[kind==='work'?'works':'fuel'];};
 const invalid=rows('[04/11/2026 18:00] Sinan Abi: 31.02.2026 '+body)[0];assert.equal(invalid.ok,false,'Invalid body date cannot fall back to a checked header date');assert.equal(invalid.fieldConfidence.date.level,'BILINMIYOR');
 const shortInvalid=rows('[04/11/2026 18:00] Sinan Abi: 31/02 '+body)[0];assert.equal(shortInvalid.ok,false);
 const shortOld=rows('[04/11/2026 18:00] Sinan Abi: 07.09.25 '+body)[0];assert.equal(shortOld.date,'2025-09-07');
 const yesterday=rows('[04/11/2026 18:00] Sinan Abi: Dün '+body)[0];assert.equal(yesterday.date,'2026-11-03');
 const d=fixture(),proposal={date:'2026-11-04',vehicle_id:d.vehicles.find(v=>v.name==='Manitou').id,quote:'Dün '+body,...(kind==='work'?{customer_id:d.customers.find(c=>c.name==='Lena').id,quantity:2,unit:'Saat',work_type:'Manitou Çalışması'}:{liters:3,source:'Depo Tankı'})};
 const mismatch=validatePlan({works:[],fuel:[],[kind==='work'?'works':'fuel']:[proposal]},{d,message:'[04/11/2026 18:00] Sinan Abi: Dün '+body,today:'2026-11-04'})[kind==='work'?'works':'fuel'][0];assert.equal(mismatch.date,'2026-11-03');assert.equal(mismatch.ok,false,'Conflicting model date must remain unchecked even when phone evidence supplies the correct date');
 const oldHeader=rows('[07/09/2026 18:00] Sinan Abi: Dün '+body)[0];assert.equal(oldHeader.date,'2026-09-06');
 const invalidHeader=rows('[31/02/2026 18:00] Sinan Abi: '+body)[0];assert.equal(invalidHeader.ok,false);
 const conflict=rows('[04/11/2026 18:00] Sinan Abi: 01.11.2026 ve 02.11.2026 '+body)[0];assert.equal(conflict.ok,false);
}
console.log('registered sender: invalid body/header and contradictory dates stay unchecked; relative day uses header date PASS');

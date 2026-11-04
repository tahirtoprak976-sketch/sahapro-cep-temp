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

import assert from 'node:assert/strict';
import {cases,cards,measure,gate} from './assistant-gold/replay.mjs';
assert.ok(cases.length>=60);
assert.equal(new Set(cases.map(c=>c.id)).size,cases.length);
for(const list of Object.values(cards))for(const record of list)assert.ok(String(record.id).startsWith('TEST_'));
for(const list of Object.values(cards))for(const record of list)if(record.name)assert.ok(!record.name.startsWith('TEST '),'sentetik işaret kimlikte kalır');
for(const c of cases){assert.equal(c.synthetic,true);assert.ok(c.message.trim());assert.equal(typeof c.shouldAsk,'boolean');assert.ok(Array.isArray(c.photoTexts));for(const e of c.expectedCards)assert.equal(typeof e.checked,'boolean');}
for(const mandatory of ['a','b','c','d','e'])assert.ok(cases.some(c=>c.expectedCards.some(e=>e.mandatoryUnchecked===mandatory&&!e.checked)),mandatory);
for(const tag of ['money-role','date','ambiguity','lookup','photo','ticket','fuel-allowance','customer-role','adversarial'])assert.ok(cases.some(c=>c.tags.includes(tag)),tag);
const result=measure();assert.deepEqual(measure(),result,'recorded replay must be deterministic');
console.log(JSON.stringify(result,null,2));
assert.ok(gate(result),'Gate 2: silentWrong, moneyGuesses and mandatoryChecked must all be zero');

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {measureReal} from './assistant-gold/real-messages/measure.mjs';
import {measurePhoneSafety} from './assistant-gold/phone-safety.mjs';
const recorded=JSON.parse(readFileSync(new URL('./assistant-gold/real-messages/recorded-live-5897.json',import.meta.url)));
for(const batch of [false,true]){
 const m=measureReal({batch,responses:batch?recorded.batch:recorded.single});
 assert.equal(m.totals.silentWrong,0,'source loading recipient must survive model summary');
 assert.ok(m.totals.readyCorrect>=25,'recover recipient without reducing ready correct cards');
}
const safety=measurePhoneSafety(recorded.safety);
assert.equal(safety.correctCards,12,'explicit customer-to-depot receipt is tank input');
for(const key of ['silentWrong','moneyGuesses','mandatoryChecked'])assert.equal(safety[key],0);
console.log('second live cohort replay: source loading recipients and incoming tank role PASS');

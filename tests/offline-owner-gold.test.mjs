import assert from 'node:assert/strict';
import {measureReal} from './assistant-gold/real-messages/measure.mjs';
for(const batch of [false,true]){
 const report=measureReal({mode:'offline-review',batch,today:'2026-11-09'}),t=report.totals;
 assert.equal(t.expectedCards,38);assert.equal(t.actualCards,38);assert.equal(t.missingCards,0);assert.equal(t.extraCards,0);
 assert.equal(t.silentWrong,0,'An incorrect offline row must never arrive selected');
 assert.equal(t.missedQuestions,0);assert.ok(t.readyCorrect>=24);assert.ok(t.unnecessaryQuestions<=6);
 for(const part of report.details){
  assert.equal(part.actual.filter(r=>r.kind==='work'&&r.date==='2026-11-09'&&r.ok).length,0,'Historical messages must not become confidently selected today');
  for(const row of part.actual)for(const field of ['unit_price','amount','total','cost'])assert.ok(row[field]==null||row[field]==='',`${field} must not be invented`);
 }
 assert.equal(report.realGemini,false);
}
console.log('offline owner gold:20 messages/38 work-fuel cards,24+ ready,0 silent/guessed money/missed questions PASS');

import assert from 'node:assert/strict';
import {checkV311Acceptance,acceptanceCounts} from '../tools/v311-release-gate.mjs';
const pending=checkV311Acceptance({});assert.equal(pending.ready,false);assert.ok(pending.blockers.some(s=>s.includes('Gemini')));assert.ok(pending.blockers.some(s=>s.includes('telefon')));assert.ok(pending.blockers.some(s=>s.includes('önizleme')));
const pretend=checkV311Acceptance({live:{realGemini:false,runs:[{measurement:{totals:{readyCorrect:38}}}]},phone:{device:'TEST synthetic desktop',physical:false}});assert.equal(pretend.ready,false,'canned data cannot authorize publication');
console.log('missing live/phone/staged UI evidence blocks release; declared totals cannot authorize publication PASS');
const {readFileSync}=await import('node:fs'),recorded=JSON.parse(readFileSync(new URL('./assistant-gold/real-messages/recorded-v3.10.00.json',import.meta.url)));
const fakeLive={mode:'live-owner-pseudonymized',protocol:'v311-primary-json',sourceSha:'TEST_SHA',realGemini:true,usedRealNames:false,savedBusinessRecords:0,safety:{measured:true,silentWrong:0,moneyGuesses:0,mandatoryChecked:0},runs:[1,2,3].flatMap(repeat=>['single','batch'].map(mode=>({repeat,mode,failures:[],responses:mode==='batch'?{r00_tumu:recorded.responses.r00_tumu}:Object.fromEntries(Object.entries(recorded.responses).filter(([id])=>id!=='r00_tumu')),measurement:{totals:{readyCorrect:38,unnecessaryQuestions:0,wrongFields:0}}})))};
const audited=checkV311Acceptance({automation:{sourceSha:'TEST_SHA'},live:fakeLive});assert.equal(audited.ready,false);assert.ok(audited.blockers.some(s=>s.includes('yeniden hesaplanan')));assert.equal(audited.measurements.find(m=>m.mode==='batch').totals.readyCorrect,15,'lying score table is ignored; old raw proposals are independently rescored');
console.log('synthetic forged-success fixture rescored as15/38; never accepted as real success PASS');

assert.ok(acceptanceCounts().node>=201&&acceptanceCounts().browser>=96&&acceptanceCounts().upgrades>=47);
assert.ok(checkV311Acceptance({automation:{sourceSha:'TEST_SHA',runs:[{sha:'TEST_SHA',conclusion:'success'}],node:{expected:1,passed:1,failed:0},browser:{expected:1,passed:1,failed:0},upgrades:{expected:1,passed:1,failed:0}}}).blockers.some(s=>s.includes('CI kanıtı')),'declaring only one test cannot stand in for the full source suite');

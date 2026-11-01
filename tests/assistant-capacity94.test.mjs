import assert from 'node:assert/strict';
import {saveTaskProposal,transitionTask,readTask} from '../js/assistant-task.js';
import {CENTER_KEY,listTaskCenter,activateTaskCenter,closeTaskCenter} from '../js/assistant-task-center.js';
const fresh=()=>({assistant_conversation_v1:{id:'TEST-CHAT',turns:[]}});
let values=fresh();
const db={metaGet:async k=>structuredClone(values[k]),metaTxn:async(keys,fn)=>{const old=structuredClone(values),r=fn(old);Object.assign(values,structuredClone(r.set));return structuredClone(r.result);}};
let previous=null;const original=[];
for(let i=0;i<9;i++){previous=await saveTaskProposal(db,{epoch:'TEST-CHAT',previous,result:{goal:'TEST '+i,plan:{works:[{quantity:i+1}],questions:i%2?['Araç?']:[]}},source:'TEST kaynak '+i});original.push(previous);}
let center=listTaskCenter(values[CENTER_KEY]);assert.equal(center.open.length,5);assert.equal(center.paused.length,4);assert.equal(center.items.length,9);
for(const t of original){const saved=center.items.find(x=>x.id===t.id);assert.equal(saved.source,t.source);assert.deepEqual(saved.plan,t.plan);assert.equal(saved.chat.id,'TEST-CHAT');}
const oldest=center.paused[0];const resumed=await activateTaskCenter(db,oldest.id);
assert.equal(resumed.id,oldest.id);assert.equal(resumed.status,original[0].status);assert.ok(resumed.rev>oldest.rev);assert.deepEqual(resumed.plan,original[0].plan);assert.equal(listTaskCenter(values[CENTER_KEY]).open.length,5);
const before=JSON.stringify(values);await assert.rejects(saveTaskProposal(db,{epoch:'TEST-CHAT',previous:oldest,result:{mode:'continue',task_id:oldest.id,plan:oldest.plan},source:'stale'}),/başka sekmede/);assert.equal(JSON.stringify(values),before);
// Cancel another paused task without replacing active task/chat; stale close is atomic.
const other=listTaskCenter(values[CENTER_KEY]).paused[0],active=await readTask(db),chat=structuredClone(values.assistant_conversation_v1);
await assert.rejects(closeTaskCenter(db,other.id,other.rev-1),/başka sekmede/);assert.equal(JSON.stringify(values),before);
const closed=await closeTaskCenter(db,other.id,other.rev);assert.equal(closed.wasActive,false);assert.equal(closed.task.status,'cancelled');assert.deepEqual(await readTask(db),active);assert.deepEqual(values.assistant_conversation_v1,chat);
await assert.rejects(activateTaskCenter(db,other.id),/açık değil/);
const activeClosed=await closeTaskCenter(db,active.id,active.rev);assert.equal(activeClosed.wasActive,true);assert.equal((await readTask(db)).status,'cancelled');
await assert.rejects(transitionTask(db,await readTask(db),'applying'),/artık/);
// Recovery states are never candidates for automatic pausing, resume or close.
previous=await readTask(db);previous=await saveTaskProposal(db,{epoch:'TEST-CHAT',previous,result:{plan:{works:[{quantity:1}]}},source:'TEST recovery'});const applying=await transitionTask(db,previous,'applying');
for(let i=0;i<8;i++)previous=await saveTaskProposal(db,{epoch:'TEST-CHAT',previous:i===0?applying:previous,result:{plan:{works:[{quantity:2}]}},source:'TEST more '+i});
center=listTaskCenter(values[CENTER_KEY]);assert.equal(center.items.find(t=>t.id===applying.id).status,'applying');
await assert.rejects(closeTaskCenter(db,applying.id,applying.rev),/kapatılamaz/);await assert.rejects(activateTaskCenter(db,applying.id),/açık değil/);
// Failed meta write cannot pause anything or advance active request.
const unchanged=JSON.stringify(values),failing={...db,metaTxn:async(keys,fn)=>{fn(structuredClone(values));throw Error('TEST quota');}};
await assert.rejects(saveTaskProposal(failing,{epoch:'TEST-CHAT',previous,result:{plan:{works:[{}]}},source:'quota'}),/quota/);assert.equal(JSON.stringify(values),unchanged);
console.log('PASS capacity94: 9 proposals without blocking; five active + preserved paused; resume status/source/chat; stale revision; targeted close; recovery non-replay; quota atomicity');

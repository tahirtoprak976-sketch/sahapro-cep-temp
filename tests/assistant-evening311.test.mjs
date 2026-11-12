import assert from 'node:assert/strict';
import {dailyCoverage,createUndoWindow} from '../js/assistant-evening311.js';
const d={vehicles:[{id:'TEST_A',name:'TEST araç'},{id:'TEST_B',name:'TEST boş'},{id:'TEST_C',deleted_at:'x'}],work_records:[{vehicle_id:'TEST_A',date:'2026-11-12'},{vehicle_id:'TEST_A',date:'2026-11-12'},{vehicle_id:'TEST_B',date:'2026-11-11'}]};
const before=JSON.stringify(d),coverage=dailyCoverage(d,'2026-11-12');assert.deepEqual(coverage,{worked:1,missing:[{id:'TEST_B',name:'TEST boş'}]});assert.equal(JSON.stringify(d),before);
let clock=0,value='ilk',version=0;const undo=createUndoWindow(()=>clock);undo.set([{valid:()=>version===0,restore:()=>value='ilk'}]);value='cevap';clock=4999;assert.equal(undo.undo(),1);assert.equal(value,'ilk');assert.equal(undo.undo(),0);
undo.set([{valid:()=>version===0,restore:()=>value='eski'}]);value='elle';version++;assert.equal(undo.undo(),0);assert.equal(value,'elle');
undo.set([{valid:()=>true,restore:()=>value='geç'}]);clock+=5000;assert.equal(undo.undo(),0);assert.equal(value,'elle');
console.log('read-only coverage; undo expires at5s, preserves subsequent manual edits, applies only once PASS');

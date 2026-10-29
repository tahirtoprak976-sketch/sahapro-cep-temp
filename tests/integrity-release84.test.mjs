import assert from 'node:assert/strict';
import {beginUndo,saveUndo,applyUndo,undoConflicts,undoLinks} from '../js/undo.js';

let writes=0;
const db={metaSet:async()=>{writes++;},metaGet:async()=>({at:'old',stores:{},attAdded:[],meta:{}})};
await assert.rejects(()=>saveUndo(db,{stores:{}},'Unowned snapshot'),/işlemin kendi yazma kaydı/);
await assert.rejects(()=>applyUndo(db),/eski sürümde/);
assert.equal(writes,0,'Unproven legacy plans cannot start a write or erase evidence');
const scope=beginUndo(db);scope.track({id:'Unproven external result'});
assert.equal(await saveUndo(db,scope,'Unproven'),null);
assert.equal(writes,1,'Unknown ownership disables the new undo instead of adopting global changes');

const id='imported-"-id';
const plan={stores:{work_records:{added:[{id}],changed:[]}},attAdded:[],meta:{}};
assert.deepEqual(undoConflicts(plan,{stores:{work_records:new Map()},meta:{}}),['work_records']);
assert.deepEqual(undoLinks(plan,{stores:{work_records:new Map([[id,{id}]]),hakedis:new Map([[id,{id,items:[{work_record_id:id}]}]])}},[]),['hakedis'],'The same imported id in another store is still an external reference');
assert.deepEqual(undoLinks(plan,{stores:{hakedis:new Map([['H',{id:'H',items:[{work_record_id:id}]}]])}},[]),['hakedis'],'Quoted imported IDs are compared structurally, never by a JSON substring');
console.log('integrity-release84 PASS: unowned/legacy undo refused, missing revisions and escaped/cross-store references guarded');

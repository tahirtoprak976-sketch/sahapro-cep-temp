import assert from 'node:assert/strict';
import {sourceCandidates} from '../js/assistant-source-context.js';
const d={personnel:[{id:'P',name:'Gönderen'}],vehicles:[{id:'V',name:'JCB U36 Manitou',type:'Telehandler',personnel_id:'P'}],customers:[{id:'C',name:'Müşteri'}],sites:[],aliases:[]};
const message='[04/11/2026 12:00] Gönderen: Müşteri JCB U36 Manitou 3 saat';
function work(type){d.vehicles[0].type=type;return sourceCandidates(message,d,'2026-11-04').works[0];}
assert.equal(work('Telehandler').work_type,'Manitou Çalışması');
assert.equal(work('JCB').work_type,'JCB Çalışması');
assert.equal(work('Mini Ekskavatör').work_type,'Mini Kato Çalışması');
assert.equal(work('Ekskavatör').work_type,'Makine Çalışması');
assert.equal(work('Araç/Makine').work_type,'Makine Çalışması');
console.log('registered vehicle type overrides misleading equipment name PASS');

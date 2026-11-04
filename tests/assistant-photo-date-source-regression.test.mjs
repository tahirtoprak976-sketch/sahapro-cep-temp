import assert from 'node:assert/strict';
import {validatePlan} from '../js/assistant-core.js';
const d={customers:[],vehicles:[{id:'TEST_V',name:'Manitou'}],personnel:[{id:'TEST_P',name:'Sinan Abi',vehicle_id:'TEST_V'}],aliases:[],fuel_tank_movements:[{id:'TEST_STOCK',date:'2026-01-01',move_type:'GİRİŞ',liters:1000}]};
const quote='Manitou depodan 3 litre mazot aldı';
const row=validatePlan({photo_texts:['03.11.2026 3 litre mazot'],works:[],fuel:[{date:'2026-11-04',vehicle_id:'TEST_V',liters:3,source:'Depo Tankı',photo:0,quote}]},{d,message:'[04/11/2026 18:00] Sinan Abi: '+quote,today:'2026-11-04',photoCount:1}).fuel[0];
assert.equal(row.ok,false,'Registered sender evidence must never override a conflicting receipt date');
assert.equal(row.fieldConfidence.date.level,'BILINMIYOR');
assert.equal(row.fieldConfidence.date.conflict,true);
console.log('registered sender + receipt date conflict remains unchecked PASS');

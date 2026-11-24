import assert from 'node:assert/strict';
import {readApprovedPacket} from '../js/remote-approved-core.js';
const p={format:'SAHAPRO_REMOTE_ACTIONS_V1',id:'7a125000-0000-4000-8000-000000000001',approved:{confirmed:true,at:new Date().toISOString(),summary:'TEST explicit additive offset'},offsets:[{source_key:'TEST-capability125',date:'2026-01-01',customer:'TEST customer125',vehicle:'TEST vehicle125',personnel:'TEST person125',liters:2,unit_price:10,amount:20,reason:'TEST customer paid fuel',price_basis:'receipt',price_source:'TEST receipt125'}],documents:[]};
assert.doesNotThrow(()=>readApprovedPacket(p),'REMOTE_ACTIONS_NOT_SUPPORTED');
console.log('remote actions contract125 PASS: explicit action packet accepted, separate from work/fuel history');

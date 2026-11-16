import assert from 'node:assert/strict';
import {assertPersonnelLegalActivation,PERSONNEL_LEGAL_ASSETS,PERSONNEL_LEGAL_STORES} from '../js/personnel-legal/migration.js';
const ready={schemaVersion:8,backupStores:PERSONNEL_LEGAL_STORES,restoreStores:PERSONNEL_LEGAL_STORES,swAssets:PERSONNEL_LEGAL_ASSETS,legacyBridgeReady:true,guardedWriters:['leave','attendance','work_records','personnel_events','assistant','import']};
assert.equal(assertPersonnelLegalActivation(ready),true);
for(const field of ['backupStores','restoreStores','swAssets','guardedWriters'])assert.throws(()=>assertPersonnelLegalActivation({...ready,[field]:[]}));
assert.throws(()=>assertPersonnelLegalActivation({...ready,legacyBridgeReady:false}));
assert.throws(()=>assertPersonnelLegalActivation({...ready,schemaVersion:7}));
console.log('personnel legal activation stays blocked until backup/restore/SW/all-writers/legacy bridge are ready PASS');

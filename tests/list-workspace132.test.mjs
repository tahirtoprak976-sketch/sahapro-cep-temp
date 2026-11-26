import assert from 'node:assert/strict';
import {listRoute,listReturnHash} from '../js/list-workspace.js';
const saved=new Map([['isler','#/isler?customer_id=TEST_A&q=kamyon'],['yakit','#/yakit?vehicle_id=TEST_V&period=month']]);
assert.equal(listReturnHash('#/isler','#/isler/TEST_W',saved),saved.get('isler'));
assert.equal(listReturnHash('#/yakit','#/yakit/TEST_F/edit',saved),saved.get('yakit'));
// Deep links and fresh navigation must never acquire another view's scope.
for(const previous of ['#/','#/daha','#/gider/TEST_E','#/isler-other/TEST_W'])assert.equal(listReturnHash('#/isler',previous,saved),'#/isler');
for(const hash of ['#/isler?customer_id=TEST_B','#/isler?','#/isler/new','#/yakit/new','#/asistan','#/sofor','#/gider/TEST_E'])assert.equal(listReturnHash(hash,'#/isler/TEST_W',saved),hash);
assert.equal(listReturnHash('#/gider','#/gider/TEST_E',saved),'#/gider');
assert.equal(listRoute('#/isler?f=all'),'isler');assert.equal(listRoute('#/isler/TEST_W'),'');assert.equal(listRoute('#/bakim'),'');
console.log('list workspace132 PASS: matching detail only, explicit scope and fresh navigation preserved; forms/driver/assistant excluded');

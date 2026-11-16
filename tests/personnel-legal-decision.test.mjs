import assert from 'node:assert/strict';
import {validateAnnualSplit} from '../js/personnel-legal/core.js';
// Identical on the prepared (inactive) baseline and candidate: approval stays
// strict, while factual past use must not be hidden by refusing its record.
const split={pieces:[7],proposed:7,remainingAfter:0};
assert.throws(()=>validateAnnualSplit({...split,mode:'approval'}),e=>e.code==='TEN_DAYS');
assert.deepEqual(validateAnnualSplit({...split,mode:'actual'}).warnings,['TEN_DAYS']);
assert.deepEqual(validateAnnualSplit({...split,mode:'draft'}).warnings,['TEN_DAYS']);
assert.equal(validateAnnualSplit({pieces:[4],proposed:10,remainingAfter:0}).hasTen,true);
console.log('HR decision: strict plan / recorded truth with permanent TEN_DAYS warning PASS');

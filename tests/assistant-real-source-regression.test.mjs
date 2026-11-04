import assert from 'node:assert/strict';
import {validatePlan} from '../js/assistant-core.js';
import {fixture,source,cases,message} from './assistant-gold/real-messages/fixture.mjs';
// Identical assertion is run against the unchanged v3.10.00 baseline and candidate.
const c=cases.find(c=>c.id==='r10');
const out=validatePlan({works:[],fuel:[]},{d:fixture(),message:message(c),today:source.today_for_test});
assert.equal(out.works.length,2,'Loading without a written duration must remain an unchecked work card, not disappear');
assert.equal(out.works[1].quantity,null);assert.equal(out.works[1].ok,false);
console.log('source missing-duration regression PASS');

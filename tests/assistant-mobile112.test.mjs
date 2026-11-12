import assert from 'node:assert/strict';
import {reviewState,reviewStates} from '../js/assistant-review-core.js';
const base={kind:'work',missing:[],issues:false,selected:false,r:{}};
assert.equal(reviewState(base),'ready');assert.equal(reviewState({...base,missing:['date']}),'review');
for(const row of [{kind:'collection'},{kind:'fuelout'},{kind:'tank',r:{customer_id:'TEST_C'}},{kind:'personnel',r:{event_type:'Kasa Teslimi'}},{kind:'personnel',r:{event_type:'Avans'}}]){
 assert.equal(reviewState({...base,...row}),'review');assert.equal(reviewState({...base,...row,selected:true}),'ready');assert.equal(reviewState({...base,...row,saved:true}),'saved');
}
assert.equal(reviewState({...base,kind:'tank'}),'ready','ordinary station intake not a mandatory confirmation type');
assert.deepEqual(reviewStates([base,{...base,kind:'collection'},{...base,saved:true}]),{all:3,ready:1,review:1,saved:1});
console.log('three independent card states, all five financial types, ordinary intake distinction PASS');

import assert from 'node:assert/strict';
import {ENTITY_STORES,mergePreview,stableStringify} from '../js/core.js';
import {assertRestoreBasis,freshDeviceDrops} from '../js/backup.js';
import {fuelAudit} from '../js/fuel-audit.js';

const empty=()=>Object.fromEntries(ENTITY_STORES.map(s=>[s,[]]));
const fixture=()=>({...empty(),customers:[{id:'C',name:'TEST'}],work_records:[{id:'W',quantity:1,description:'TEST current'}]});
const plan=(before,incoming)=>({stores:Object.fromEntries(ENTITY_STORES.map(s=>[s,mergePreview(before[s],incoming.data[s])]))});
const obj={data:fixture()};obj.data.work_records[0].description='TEST reviewed backup';
const basis=fixture(),preview=plan(basis,obj),drop=freshDeviceDrops(basis,obj),source=stableStringify(basis);
assert.doesNotThrow(()=>assertRestoreBasis(basis,structuredClone(basis),obj,preview,true,drop));
for(const mutate of [d=>d.work_records[0].description='TEST later edit',d=>d.work_records=[],d=>d.work_records[0].quantity=2]){
 const now=structuredClone(basis);mutate(now);
 assert.throws(()=>assertRestoreBasis(basis,now,obj,preview,true,drop),{code:'RESTORE_STALE'});
 // A merge that does not replace this conflict must preserve its current row.
 assert.doesNotThrow(()=>assertRestoreBasis(basis,now,obj,preview,false,drop));
}
{
 const before=fixture(),backup={data:fixture()};backup.data.expense_records=[{id:'E',amount:100}];
 const p=plan(before,backup),now=structuredClone(before);now.expense_records=[{id:'E',amount:200}];
 assert.throws(()=>assertRestoreBasis(before,now,backup,p,false,{}),{code:'RESTORE_STALE'},'new backup ID appeared in another page');
 now.expense_records=[{id:'OTHER',amount:50}];
 assert.doesNotThrow(()=>assertRestoreBasis(before,now,backup,p,false,{}),'unrelated records remain mergeable');
}
{
 const before=empty();before.vehicles=[{id:'LOCAL',name:'TEST machine'}];
 const backup={data:{...empty(),vehicles:[{id:'BACKUP',name:'TEST machine'}]}},p=plan(before,backup),drops=freshDeviceDrops(before,backup);
 assert.deepEqual(drops,{vehicles:['LOCAL']});
 const now=structuredClone(before);now.maintenance_records=[{id:'M',vehicle_id:'LOCAL',cost:50}];
 assert.throws(()=>assertRestoreBasis(before,now,backup,p,false,drops),{code:'RESTORE_STALE'},'new service means phone is no longer empty');
 assert.doesNotThrow(()=>assertRestoreBasis(before,structuredClone(before),backup,p,false,drops));
}
assert.equal(stableStringify(basis),source,'decision layer cannot mutate the snapshot');

// A draft claim protects its sources too; absent document number is not "unlinked".
const d={customers:[{id:'C',name:'TEST',fuel_rules:[{id:'R',per:75,unit:'Sefer',only_pay:true}]}],
 work_records:[{id:'W',customer_id:'C',date:'2026-09-07',quantity:1,unit:'Sefer',work_type:'Hafriyat Nakliye',price_snapshot:{unit_price:1000,amount:1000,kdv_rate:20}}],
 hakedis:[{id:'H',customer_id:'C',status:'Taslak',items:[{work_record_id:'W'}]}]};
const audit=fuelAudit(d,'C');assert.equal(audit.fixable.length,0);assert.equal(audit.lockedTl.length,1);assert.equal(audit.lockedTl[0].hakedis,'H');
const cancelled=structuredClone(d);cancelled.hakedis[0].status='İptal';assert.equal(fuelAudit(cancelled,'C').lockedTl.length,0);
console.log('integrity-review88 PASS: targeted restore revision checks, new-ID and fresh-card races, unrelated merge, immutable snapshots and draft-claim fuel review');

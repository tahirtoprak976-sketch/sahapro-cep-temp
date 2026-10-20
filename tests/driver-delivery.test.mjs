import assert from 'node:assert/strict';
import { mergeEntries, validConfig, validDate, validNumber } from '../js/driver-delivery.js';
import { mergeTicketsIntoWorks } from '../js/assistant-docs.js';
import { driverMessage, extractPayloads, payloadsToPlan } from '../js/driver-core.js';
const a={id:'a',q:1}, b={id:'b',q:2}, c={id:'c',q:3};
assert.deepEqual(mergeEntries([a,b],[a],[a,c]),[a,b,c], 'two tabs retain independent additions');
assert.deepEqual(mergeEntries([a,b],[a],[{...a,sent:'now'}]),[{...a,sent:'now'},b], 'share update preserves concurrent addition');
assert.deepEqual(mergeEntries([a,b],[a],[]),[b], 'delete only the explicitly removed entry');
assert.deepEqual(mergeEntries([b],[a],[a]),[b], 'unchanged stale entry does not resurrect a deleted record');
assert.deepEqual(mergeEntries([b],[a],[{...a,sent:'now'}]),[b], 'deleted entry stays deleted during share completion');
assert.throws(()=>mergeEntries([{...a,ph:2}],[a],[{...a,sent:'now'}]),/başka sekmede/);
assert.ok(validConfig({v:1,p:['p','Şoför'],V:[['v','Araç']]}));
for (const v of [{v:1,p:'x'}, {v:1,p:[]}, {v:1,p:['p','n'],V:'bad'},{v:1,p:['p','n'],C:[null]},{v:1,p:['p','n'],exp:'2026-02-30'}]) assert.equal(validConfig(v),false);
for (const v of ['2026-10-20','2024-02-29']) assert.ok(validDate(v));
for (const v of ['2026-02-29','2026-13-01','2026-1-1','abc']) assert.equal(validDate(v),false);
for (const v of [0,'24,85','1000000000000',null,'']) assert.ok(validNumber(v));
for (const v of [-1,'Infinity','NaN','1000000000001']) assert.equal(validNumber(v),false);
assert.equal(validNumber(0,true),false); assert.ok(validNumber('0,5',true));
const cfg={v:1,p:['p','Şoför'],C:[],V:[]};
const text=await driverMessage([{id:'f',k:'f',date:'2026-10-20',L:10,ph:2,photoId:'private-cache',sent:'now'},{id:'w',date:'2026-10-20',q:1,ph:1}],cfg);
const payload=await extractPayloads(text);
assert.equal(payload[0].e[0].photoId,undefined); assert.equal(payload[0].e[0].sent,undefined);
const plan=payloadsToPlan(payload,{}, {photoCount:3});
assert.deepEqual(plan.fuelMeta[0].photos,[0,1]); assert.equal(plan.plan.fuel[0].photo,0); assert.deepEqual(plan.meta[0].photos,[2], 'fuel images must not shift next work photos');
const incomplete=payloadsToPlan(payload,{}, {photoCount:2});
assert.deepEqual(incomplete.fuelMeta[0].photos,[]); assert.deepEqual(incomplete.meta[0].photos,[], 'incomplete bundle must not guess attachment identity');
console.log('driver-delivery OK: concurrent merges, config, dates, numeric bounds, fuel photo alignment');

const missing={works:[{photos:[]}],tickets:[],driverPhotoNeed:3};mergeTicketsIntoWorks(missing,{photoCount:2});assert.deepEqual(missing.works[0].photos,[], 'single work fallback must not undo incomplete bundle guard');

const {preparedPacketError}=await import('../js/driver-delivery.js');
const current={...cfg,exp:'2026-10-21'},packet={rows:[a],snapshots:[[a.id,JSON.stringify(a)]]};
assert.equal(preparedPacketError(packet,[a,b],current,structuredClone(current),'2026-10-20'),'');
assert.match(preparedPacketError(packet,[b],current,current,'2026-10-20'),/değişti veya silindi/);
assert.match(preparedPacketError(packet,[{...a,ph:1}],current,current,'2026-10-20'),/değişti veya silindi/);
assert.match(preparedPacketError(packet,[a],current,{...current,lid:'new'},'2026-10-20'),/bağlantısı başka sekmede/);
assert.match(preparedPacketError(packet,[a],current,current,'2026-10-22'),/süresi doldu/);
assert.match(preparedPacketError(packet,null,current,current,'2026-10-20'),/okunamadı/);
console.log('prepared packet: stale record/config, expiry, corruption guards OK');

const {driverPhotoPolicy}=await import('../js/driver-core.js');
assert.deepEqual(driverPhotoPolicy(payload,3),{expected:3,attached:3,reason:'',allowed:true});
for(const n of [0,1,2,4,5]){
 const policy=driverPhotoPolicy(payload,n);assert.equal(policy.allowed,false);assert.equal(policy.reason,n<3?'missing':'extra');
 const p=payloadsToPlan(payload,{}, {photoCount:n});assert.deepEqual(p.meta[0].photos,[]);assert.deepEqual(p.fuelMeta[0].photos,[]);
}
assert.equal(driverPhotoPolicy(payload,3,{rejected:true}).reason,'rejected');
const rejectedPlan=payloadsToPlan(payload,{}, {photoCount:3,allowPhotos:false});assert.deepEqual(rejectedPlan.meta[0].photos,[]);
for(const ph of [-1,0.5,'2',21,Infinity])assert.equal(driverPhotoPolicy([{e:[{ph}]}],1).reason,'invalid');
assert.equal(driverPhotoPolicy([{e:[{ph:0,sg:1}]}],1).allowed,true);
assert.equal(driverPhotoPolicy([{e:[{ph:0,sg:2}]}],2).reason,'invalid');
const extra={works:[{photos:[]}],tickets:[],driverPhotoNeed:0,driverPhotoBlocked:true};mergeTicketsIntoWorks(extra,{photoCount:2});assert.deepEqual(extra.works[0].photos,[],'zero expected photos must never assign extras to a lone driver work');
const signed=payloadsToPlan([{p:'p',e:[{id:'s',date:'2026-10-20',ph:1,sg:1,dfs:'S-1',q:1}]}],{}, {photoCount:3});assert.equal(signed.meta[0].digital.sigPhoto,null);assert.deepEqual(signed.meta[0].photos,[]);
console.log('critic photo guards OK: missing, extra, rejected, invalid counts, signature, lone-work fallback');

import assert from 'node:assert/strict';
import {entryLink,entryContext,entryContextHTML,entrySaveHash,entryRepeatHash} from '../js/entry-context.js';
const date='2026-05-11',today='2026-10-21';
const vehicles=[{id:'V',name:'TEST <img src=x onerror="bad()">'},{id:'D',deleted_at:'x'},{id:'I',active:false}];
const state={date,kind:'work',vehicle_id:'V',q:'a&b " geçmiş',amount:9999,slip_no:'never copied'},before=JSON.stringify({state,vehicles});
const query=hash=>Object.fromEntries(new URLSearchParams(hash.slice(hash.indexOf('?')+1)));
for(const [kind,route] of [['work','isler'],['fuel','yakit'],['expense','gider'],['maintenance','bakim']]){
 const link=entryLink(kind,state);assert.ok(link.startsWith('#/'+route+'/new?'));
 const context=entryContext(query(link),vehicles,today);assert.deepEqual(context.values,{date,vehicle_id:'V'});
 assert.equal(context.historical,true);assert.equal(context.returnState.q,state.q);
 assert.equal(query(link).amount,undefined);assert.equal(query(link).slip_no,undefined);
 const next=entrySaveHash(context,kind,{date:'2026-05-12',vehicle_id:'Other'}),q=query(next);
 assert.equal(q.date,'2026-05-12');assert.equal(q.vehicle_id,'Other');assert.equal(q.kind,kind);assert.equal(q.q,undefined);
}
const context=entryContext(query(entryLink('work',state)),vehicles,today);
assert.match(entryContextHTML(context),/Geçmiş tarihli/);assert.ok(!entryContextHTML(context).includes('<img'));
assert.match(entryContextHTML(context),/&lt;img/);assert.match(entryContextHTML(context,true),/taslağınız.*korundu/);
for(const vehicle_id of ['D','I','missing']){
 const c=entryContext({source:'saha',date,vehicle_id},vehicles,today);assert.equal(c.values.vehicle_id,'');assert.equal(c.vehicleMissing,true);
 assert.match(entryContextHTML(c),/artık aktif değil/);
}
assert.equal(entryContext({date,vehicle_id:'V'},vehicles,today),null,'ordinary forms are untouched');
assert.equal(entryContext({source:'other',date},vehicles,today),null);
for(const date of ['2026-02-30','11.05.2026','2026-13-01','']){
 const c=entryContext({source:'saha',date},vehicles,today);assert.ok(c.error);assert.ok(!c.values);
 assert.equal(entrySaveHash(c,'work',{}),null);assert.match(entryContextHTML(c),/role="alert"/);
 assert.equal(entryLink('work',{date}),null);
}
assert.equal(entryLink('__proto__',state),null);assert.equal(entryLink('constructor',state),null);
assert.equal(entrySaveHash(null,'work',{}),null);assert.equal(entryRepeatHash(null),null);
for(const return_to of ['https://evil.test','javascript:alert(1)','#/ayarlar','#/saha-akisi/extra?date=2026-05-11']){
 const c=entryContext({source:'saha',date,vehicle_id:'V',return_to},vehicles,today);assert.equal(c.returnHash,'#/saha-akisi?date=2026-05-11&vehicle_id=V');
}
const c=entryContext({source:'saha',date,return_to:'#/saha-akisi?date=invalid&kind=bad&secret=NO&q=a%26b'},vehicles,today);
assert.equal(c.returnState.date,date);assert.equal(c.returnState.kind,'');assert.ok(!c.returnHash.includes('secret'));
assert.equal(query(entrySaveHash(c,'fuel',{date,vehicle_id:'V'})).vehicle_id,undefined,'all-vehicles scope stays broad');
const repeat=entryRepeatHash(context,{date:'2026-05-13',vehicle_id:'V'},'source/id'),r=query(repeat);
assert.equal(r.repeat,'source/id');assert.equal(r.date,'2026-05-13');assert.equal(r.source,'saha');
assert.equal(entryContext(r,vehicles,today).values.date,'2026-05-13');assert.ok(!repeat.includes('quantity'));
assert.equal(query(entryRepeatHash(context,{date,vehicle_id:'V'})).copylast,'1');
assert.equal(JSON.stringify({state,vehicles}),before);
console.log('entry context: four form routes, historical date, active vehicle, typed allowlist, safe local returns, filtered visibility, repeats and no mutation OK');

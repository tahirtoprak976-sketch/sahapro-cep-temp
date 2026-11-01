import assert from 'node:assert/strict';
import {validatePriceRules,priceCardRule,pastWorksFor,priceRuleReview,sameRule,priceSnapshotFor,siteNamed} from '../js/price-rule-core.js';
import {resolvePrice} from '../js/core.js';
const msg='Ahmet.bey müşterisin Tarabyadan Kamyonetle alinan moloz seferlerine 7000 TL yap';
const d={customers:[{id:'A',name:'Ahmet Bey'},{id:'B',name:'Mehmet Bey'}],sites:[{id:'T',name:'Tarabya',customer_id:'A'},{id:'S',name:'Sarıyer',customer_id:'A'},{id:'BT',name:'Tarabya',customer_id:'B'}],vehicles:[{id:'V',name:'34EC1353',type:'Kamyonet'},{id:'V2',name:'34 TEST 02',type:'Kamyonet'},{id:'K',name:'34GA2261',type:'Kamyon'},{id:'U',name:'Bilinmeyen'}],price_book:[],hakedis:[]};
const w=(id,fields={})=>({id,customer_id:'A',site_id:'T',vehicle_id:'V',work_type:'Moloz Nakliye',unit:'Sefer',quantity:2,date:'2026-10-21',...fields});
d.work_records=[w('yes'),w('other-van',{vehicle_id:'V2'}),w('other-site',{site_id:'S'}),w('other-customer',{customer_id:'B',site_id:'BT'}),w('truck',{vehicle_id:'K'}),w('unknown-type',{vehicle_id:'U'}),w('other-type',{work_type:'Gravak Nakliye'}),w('no-site',{site_id:null,from_place:'Tarabya'}),w('priced',{price_snapshot:{unit_price:3000,amount:6000}}),w('locked',{price_snapshot:{unit_price:3000,amount:6000,locked:true}}),w('claim'),w('fuel',{fuel_rule_id:'F'}),w('unit',{unit:'Saat'})];
d.hakedis=[{id:'H',status:'Taslak',items:[{work_record_id:'claim'}]}];
const plan={price_rules:[{customer_id:'A',unit:'Sefer',price:7000}]};
const [r]=validatePriceRules(plan,{message:msg,d});
assert.equal(r.ok,true,r.issues.join());assert.equal(r.site_id,'T');assert.equal(r.scopes.length,1);assert.equal(r.scopes[0].work_type,'Moloz Nakliye');assert.equal(r.scopes[0].vehicle_group,'VAN');assert.equal(r.scopes[0].vehicle_id,null);
const fields={customer_id:'A',site_id:'T',scope:0,unit:'Sefer',price:7000}, rule=priceCardRule(r,fields,d);
const pw=pastWorksFor(d,rule);assert.deepEqual(pw.unpriced.map(x=>x.id),['yes','other-van']);assert.deepEqual(pw.differ.map(x=>x.id),['priced']);assert.equal(pw.locked,2);
const review=priceRuleReview(d,rule,{unpriced:true,differ:true});assert.deepEqual(review.todo.map(x=>x.id),['other-van','priced','yes']);assert.equal(review.missingSite,1);
const after=structuredClone(d);after.work_records[0].quantity=3;assert.notEqual(priceRuleReview(after,rule,{unpriced:true,differ:true}).signature,review.signature);
const claim=structuredClone(d);claim.hakedis[0].items.push({work_record_id:'yes'});assert.notEqual(priceRuleReview(claim,rule,{unpriced:true,differ:true}).signature,review.signature);
assert.throws(()=>priceCardRule(r,{...fields,site_id:'__all__'},d),/şantiye seçin/i);
assert.throws(()=>priceCardRule(r,{...fields,site_id:'BT'},d),/ait şantiyeyi/i);
assert.throws(()=>priceCardRule(r,{...fields,customer_id:'B'},d),/ait şantiyeyi/i);
for(const bad of [{...rule,price:Infinity},{...rule,unit:'hatalı'},{...rule,vehicle_id:'V'}])assert.throws(()=>priceRuleReview(d,bad));
const snapshot=priceSnapshotFor(rule,d.work_records[0],'R');assert.equal(snapshot.amount,14000);assert.equal(snapshot.price_source,'Şantiyeye Özel Fiyat');assert.equal(snapshot.price_scope,'Yalnız Kamyonet');
const proposed={...rule,id:'R',active:true};assert.equal(resolvePrice([proposed],{...rule,vehicle_type:'Kamyonet',date:'2026-10-21'}).id,'R');assert.equal(resolvePrice([proposed],{...rule,vehicle_type:'Kamyon',date:'2026-10-21'}),null);
assert.equal(sameRule({...d,price_book:[{...proposed,vehicle_group:null}]},rule),null);
assert.equal(sameRule({...d,price_book:[{...proposed,valid_from:'2026-09-01'}]},rule,{exactDates:true}),null);
assert.equal(sameRule({...d,price_book:[proposed]},rule).id,'R');
// Omitted, foreign and model-invented IDs never broaden a site-specific request.
for(const site_id of [undefined,'BT','invented']){
 const [x]=validatePriceRules({price_rules:[{...plan.price_rules[0],site_id}]},{message:msg,d});assert.equal(x.site_id,'T');assert.equal(x.ok,true);
}
const ambiguous={...d,sites:[...d.sites,{id:'T2',customer_id:'A',name:'Tarabya'}]};
const [amb]=validatePriceRules(plan,{message:msg,d:ambiguous});assert.equal(amb.ok,false);assert.equal(amb.site_id,null);
const [unknown]=validatePriceRules(plan,{message:msg.replace('Tarabyadan','İstinyeden'),d});assert.equal(unknown.ok,false);assert.equal(unknown.site_id,null);assert.match(unknown.issues.join(),/Şantiye seçin/);
const [foreign]=validatePriceRules(plan,{message:msg,d:{...d,sites:d.sites.filter(s=>s.customer_id==='B')}});assert.equal(foreign.ok,false);
assert.equal(siteNamed({name:'Kemer Country No 53'},'Kemer Country No 54 seferlerine 7000'),false);
const [generic]=validatePriceRules(plan,{message:'Ahmet Bey moloz seferlerine 7000 TL',d});assert.equal(generic.site_required,false);assert.equal(generic.ok,true);assert.equal(priceCardRule(generic,{...fields,site_id:'__all__'},d).site_id,null);
console.log('PASS price scope: exact report; site inference; conjunctive vehicle group and work type; unrelated/locked/claim/fuel exclusions; ambiguous, foreign and missing sites; future matching; strict preview signatures');

const zero={...d,work_records:[w('free',{price_snapshot:{unit_price:0,amount:0}})]};
assert.equal(pastWorksFor(zero,rule).unpriced.length,0,"explicit free work is not an empty price");
assert.equal(pastWorksFor(zero,rule).differ.length,1);
assert.throws(()=>priceRuleReview({...d,price_book:[{...proposed,valid_from:'2026-09-01'}]},rule),/tarih sınırlı/);
assert.throws(()=>priceRuleReview({...d,price_book:[proposed,{...proposed,id:'R2'}]},rule),/birden fazla/);
assert.throws(()=>priceRuleReview({...d,work_records:[w('formula',{price_snapshot:{formula:'CRANE_FIRST_HOUR'}})]},rule),/Formüllü/);
assert.throws(()=>priceRuleReview(d,{...rule,price:true}));

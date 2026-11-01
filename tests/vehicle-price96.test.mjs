import assert from 'node:assert/strict';
import {transportVehicleInfo,transportVehicleType,priceVehicleContext,resolvePrice} from '../js/core.js';
import {priceApplicationRows,priceRuleReview,pastWorksFor} from '../js/price-rule-core.js';
import {priceSnapshot} from '../js/business.js';
// Actual default types used by db.ensureSeeded and history-core new vehicle cards.
for(const type of ['',null,'Araç/Makine','Araç / Makine','Diğer']) {
 assert.equal(transportVehicleType(type,'Kamyonet'),'VAN');
 assert.equal(transportVehicleType(type,'Mitsubishi kamyonet 34 EC 1353'),'VAN');
 assert.equal(transportVehicleType(type,'34EC1353'),null,'plate alone cannot imply van');
 assert.equal(transportVehicleType(type,'DX225'),null);
}
for(const type of ['Kamyonet','KAMYONET','VAN','pikap','pickup','Pick-up','Panelvan'])assert.equal(transportVehicleType(type,'34 EC 1353'),'VAN');
for(const [type,name] of [['Kamyon','Kamyonet'],['Tır','Mitsubishi Kamyonet'],['','Kamyon ve Kamyonet']]) {
 assert.equal(transportVehicleType(type,name),null);assert.equal(transportVehicleInfo(type,name).conflict,true);
}
assert.equal(transportVehicleType('İş Makinesi','Kamyonet'),null);
assert.equal(transportVehicleType('Kamyon','34GA2261'),'TRUCK');assert.equal(transportVehicleType('Çekici','34GAM627'),'TIR');
const rule={id:'R',customer_id:'C',site_id:'T',work_type:'Moloz Nakliye',vehicle_group:'VAN',unit:'Sefer',price:7000,kdv_rate:20,kdv_included:false};
const v={id:'V',name:'Kamyonet',type:'Araç/Makine'};
const work=(id,extra={})=>({id,customer_id:'C',site_id:'T',vehicle_id:'V',date:'2026-10-30',work_type:'Moloz Nakliye',quantity:1,unit:'Sefer',...extra});
const d={customers:[{id:'C',name:'Ahmet Bey'}],sites:[{id:'T',customer_id:'C',name:'Tarabya'},{id:'K',customer_id:'C',name:'Kemer'}],vehicles:[v,{id:'D',name:'34GA2261',type:'Kamyon'},{id:'X',name:'Kamyonet',type:'Kamyon'},{id:'U',name:'34EC1353',type:'Diğer'}],work_records:[work('empty'),work('priced',{quantity:2,price_snapshot:{unit_price:3000,amount:6000}}),work('origin',{site_id:null,from_place:'Tarabya'}),work('kemer',{site_id:'K'}),work('truck',{vehicle_id:'D'}),work('conflict',{vehicle_id:'X'}),work('unknown',{vehicle_id:'U',description:'kamyonetle moloz alındı'}),work('wrong-work',{work_type:'Çöp Nakliye'}),work('locked',{price_snapshot:{unit_price:1,locked:true}})],price_book:[],hakedis:[]};
const rows=priceApplicationRows(d,rule),row=id=>rows.find(r=>r.work.id===id);
assert.equal(row('empty').status,'unpriced');assert.equal(row('priced').status,'differ');assert.equal(row('origin').status,'bind');assert.match(row('empty').vehicleNote,/araç adından.*Araç\/Makine/);
assert.match(row('kemer').reason,/Başka şantiye/);assert.match(row('truck').reason,/kapsam dışında/);assert.match(row('conflict').reason,/çelişiyor/);assert.match(row('unknown').reason,/doğrulanamadı/);assert.match(row('wrong-work').reason,/İş türü/);assert.match(row('locked').reason,/Hakediş/);
assert.deepEqual(pastWorksFor(d,rule).unpriced.map(w=>w.id),['empty']);
const opts={unpriced:true,differ:true,bind_ids:['origin'],applyExisting:true};
const review=priceRuleReview(d,rule,opts);assert.deepEqual(review.todo.map(w=>w.id),['empty','origin','priced']);
const ruleOnly=priceRuleReview(d,rule,{unpriced:false,differ:false,applyExisting:false});assert.equal(ruleOnly.todo.length,0);
const future=priceVehicleContext(work('new'),v);assert.equal(resolvePrice([rule],future).id,'R');assert.equal(priceSnapshot(future,[rule],{}).unit_price,7000);
for(const vehicle of d.vehicles.slice(1))assert.equal(resolvePrice([rule],priceVehicleContext(work('new'),vehicle)),null);
assert.equal(resolvePrice([rule],priceVehicleContext(work('new',{site_id:'K'}),v)),null);
const changed=structuredClone(d);changed.vehicles[0].type='Kamyon';assert.throws(()=>priceRuleReview(changed,rule,opts),/kapsam dışında/);
assert.deepEqual(v,{id:'V',name:'Kamyonet',type:'Araç/Makine'},'lookup never edits vehicle card');
console.log('PASS legacy vehicle type: generic card name, aliases, conflict and unknown rejection; preview/commit/future price context agree; wrong site/work/truck and locked work preserved');

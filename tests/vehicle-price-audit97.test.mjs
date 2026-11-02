import assert from 'node:assert/strict';
import {priceVehicleContext,resolvePrice} from '../js/core.js';
import {pastWorksFor,priceApplicationRows,priceRuleReview} from '../js/price-rule-core.js';
const vehicle={id:'V',name:'Kamyonet',type:'Araç/Makine',updated_at:'2026-11-01'},work={id:'W',customer_id:'C',vehicle_id:'V',vehicle_type:'Kamyon',site_id:'S',work_type:'Moloz Nakliye',quantity:2,unit:'Sefer',date:'2026-10-30'};
const typeRule={id:'R',customer_id:'C',site_id:'S',vehicle_type:'Kamyonet',work_type:'Moloz Nakliye',unit:'Sefer',price:7000},groupRule={...typeRule,vehicle_type:null,vehicle_group:'VAN'};
const d={vehicles:[vehicle],work_records:[work],customers:[{id:'C',name:'Ahmet Bey'}],sites:[{id:'S',customer_id:'C',name:'Tarabya'}],price_book:[],hakedis:[]};
const ctx=priceVehicleContext(work,vehicle);assert.equal(ctx.vehicle_type,'Araç/Makine');assert.equal(resolvePrice([typeRule],ctx).id,'R');assert.equal(pastWorksFor(d,typeRule).unpriced.length,1);assert.equal(priceApplicationRows(d,typeRule)[0].status,'unpriced');
for(const type of ['Kamyonet (N1)','VAN','Pickup','Pikap','Kamyonet / Pick-up'])assert.equal(resolvePrice([typeRule],priceVehicleContext(work,{...vehicle,type})).id,'R');
const blank={...vehicle,type:''};assert.equal(resolvePrice([groupRule],priceVehicleContext(work,blank)).id,'R','stale work type does not override current card');
for(const v of [undefined,{...vehicle,deleted_at:'2026-11-02'}]){
 for(const rule of [groupRule,typeRule,{...groupRule,vehicle_group:null,vehicle_id:'V'}])assert.equal(resolvePrice([rule],priceVehicleContext(work,v)),null);
 const missing={...d,vehicles:v?[v]:[]};assert.equal(pastWorksFor(missing,groupRule).unpriced.length,0);assert.equal(priceApplicationRows(missing,groupRule)[0].status,'blocked');
}
for(const v of [{...vehicle,type:'Kamyonetim'},{...vehicle,type:'Kamyon'},{...vehicle,type:'Çekici'},{...vehicle,type:'Yarı Römork'}])assert.equal(resolvePrice([groupRule],priceVehicleContext(work,v)),null);
const options={unpriced:true,differ:true,applyExisting:true},old=priceRuleReview(d,groupRule,options);assert.equal(old.todo.length,1);
for(const change of [{updated_at:'2026-11-02'},{name:'Kamyonet 2'},{type:'VAN'},{type_review:{version:1,type:vehicle.type,name:vehicle.name}}])assert.notEqual(priceRuleReview({...d,vehicles:[{...vehicle,...change}]},groupRule,options).signature,old.signature,'vehicle fact must be pinned in review');
const confirmed={...vehicle,type:'Kamyon',type_review:{version:1,type:'Kamyon',name:vehicle.name}};assert.equal(resolvePrice([{...groupRule,vehicle_group:'TRUCK'}],priceVehicleContext(work,confirmed)).id,'R');assert.equal(resolvePrice([groupRule],priceVehicleContext(work,confirmed)),null);
assert.equal(resolvePrice([{...typeRule,vehicle_type:'Tır'}],{...ctx,vehicle_type:'Çekici',vehicle_name:'34 TEST 97'}).id,'R');
assert.equal(resolvePrice([{...typeRule,vehicle_type:'JCB'}],{...ctx,vehicle_type:'Ekskavatör',vehicle_name:'TEST'}),null);
assert.equal(resolvePrice([{...typeRule,vehicle_type:'Özel makine 97'}],{...ctx,vehicle_type:'özel MAKİNE 97',vehicle_name:'TEST'}).id,'R');
assert.equal(resolvePrice([groupRule],{...ctx,site_id:'OTHER'}),null);
assert.equal(priceRuleReview({...d,hakedis:[{id:'H',status:'Taslak',items:[{work_record_id:'W'}]}]},groupRule).pw.locked,1);
console.log('PASS vehicle pricing97: legacy TYPE rules and groups agree, registration/aliases, stale work snapshot cannot override card, missing/deleted cards blocked; inactive history retained, class/revision/name/review changes pinned, narrow site and claim guards');

assert.equal(resolvePrice([{...typeRule,id:'PLACEHOLDER',vehicle_type:'Araç/Makine',price:1},groupRule],ctx).id,'R','generic placeholder type cannot outrank an actual VAN scope');
assert.equal(resolvePrice([{...typeRule,vehicle_type:'Özel / 97'}],{...ctx,vehicle_type:'Özel - 97'}),null,'unknown custom labels are not merged by punctuation');

assert.equal(resolvePrice([{...typeRule,id:'PLACEHOLDER',vehicle_type:'Araç/Makine',price:1},{...groupRule,vehicle_group:'TRUCK_TIR'}],{...ctx,vehicle_name:'Tır'}).id,'R','generic placeholder cannot outrank even a combined transport group');

assert.equal(pastWorksFor({...d,vehicles:[{...vehicle,active:false}]},groupRule).unpriced.length,1,'retired vehicle historical work remains priceable');

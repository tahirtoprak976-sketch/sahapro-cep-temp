import assert from 'node:assert/strict';
import {canonicalVehicleType as canonical,vehicleTypeInfo as info,transportVehicleType as group,vehicleTypeInText,vehicleTypeRequested,documentVehicleType,normalizedVehicleFields,existingVehicle} from '../js/vehicle-type-core.js';
import {vehicleInfo,validateDocuments,vehicleKind,vehicleUpdate} from '../js/assistant-docs.js';
import {validateActions} from '../js/assistant-actions.js';
import {isMachineVehicle} from '../js/assistant-core.js';
import {vehicleDocumentStatus} from '../js/business.js';
import {vehicleFactor} from '../js/yard-core.js';
import {loadTon} from '../js/dump-estimate.js';
import {isHauler} from '../js/haul-core.js';
let assertions=0;
const aliases=[['Kamyonet',['Kamyonet','VAN','Pick-up','PİKAP','panelvan','Kamyonet / Pick-up','Kamyonet (N1)']],['Kamyon',['Kamyon','TRUCK','Damperli Kamyon','Hafriyat Kamyonu','Kamyon (N3)']],['Tır',['Tır','TIR','Tır / Çekici']],['Çekici',['ÇEKİCİ','Tractor unit']],['JCB',['JCB']],['Kazıcı Yükleyici',['Kazıcı Yükleyici','Backhoe loader']],['Ekskavatör',['Ekskavatör','EXCAVATOR']],['Vinç',['Vinç','Mobil Vinç']],['Yarı Römork',['Yarı Römork','Semi trailer','Dorse']],['Minibüs',['Minibüs','MINIBUS']]];
const wrappers=[s=>s,s=>' '+s+' ',s=>s.toUpperCase(),s=>s.toLocaleUpperCase('tr'),s=>s.toLowerCase(),s=>s.replaceAll(' ','\u00a0'),s=>s.replaceAll(' ','  '),s=>'\uFEFF'+s,s=>s+'\u200B',s=>s.normalize('NFD')];
for(const[kind,values]of aliases)for(const value of values)for(const wrap of wrappers){assert.equal(canonical(wrap(value)),kind,wrap(value));assertions++;}
for(const type of ['Kamyonetim','Kamyone','N1','TRUCKER','lastik tırnak','kamyonet mi kamyon mu','kamyon kamyonet','__proto__','34EC1353'])assert.equal(canonical(type),null,type);
for(const type of ['',null,'Diğer','Araç/Makine'])for(const name of ['34EC1353','34 GAM 627','DX225'])assert.equal(group(type,name),null,'no class from plate/model');
assert.equal(group('Araç/Makine','Kamyonet, Mitsubishi'),'VAN');
const conflict={id:'V',name:'Kamyonet',type:'Kamyon'};assert.equal(info(conflict).conflict,true);assert.equal(vehicleFactor(conflict).known,false);assert.equal(loadTon(conflict),0);
const review={version:1,type:'Kamyon',name:'Kamyonet',reviewed_at:'2026-11-02T00:00:00Z'};
assert.equal(info({...conflict,type_review:review}).group,'TRUCK');assert.equal(info({...conflict,type_review:review}).source,'confirmed');
for(const changed of [{name:'Kamyonet 2'},{type:'Tır'},{type_review:{...review,version:'1'}},{type_review:{...review,type:'Tır'}}])assert.notEqual(info({...conflict,type_review:review,...changed}).source,'confirmed');
for(const[v,expected]of [[{name:'JCB',type:'Kazıcı Yükleyici'},true],[{name:'Kamyonet',type:'Araç/Makine'},false],[{name:'Mobil Vinç',type:'Vinç'},true],[{name:'JCB',type:'Kamyon'},false]])assert.equal(isMachineVehicle(v),expected);
assert.equal(vehicleKind('Vinç'),'Vinç');assert.equal(vehicleKind('Minibüs'),'Minibüs');assert.equal(documentVehicleType('Cinsi: YARI RÖMORK'),'Yarı Römork');
assert.equal(vehicleTypeInText('Kamyon','Cinsi: KAMYONET'),false);assert.equal(vehicleTypeInText('Kamyonet','Cinsi: KAMYONET'),true);
assert.equal(vehicleInfo({vehicle_kind:'Kamyon'},'Cinsi: KAMYONET').type,'');
const [doc]=validateDocuments({documents:[{photo:0,category:'Ruhsat',plate:'34 ZZZ 097',vehicle_kind:'Kamyon',date:'2026-01-01'}]},{d:{vehicles:[],personnel:[]},photoTexts:['34 ZZZ 097 Cinsi: KAMYONET 01.01.2026'],photoCount:1,today:'2026-11-02'});assert.equal(doc.new_vehicle.type,'Araç/Makine','unverified model type never reaches new card');
assert.equal(vehicleUpdate({type:'Diğer'},{type:'Kamyonet'})[0].on,true);
const machine={id:'V',name:'34 TEST 97',plate:'34 TEST 97',type:'Forklift'};
assert.deepEqual(vehicleDocumentStatus(machine,[]).required,['Makine Tescil Belgesi','Periyodik Kontrol']);
assert.equal(vehicleDocumentStatus({...machine,type:'Araç/Makine'},[]).status,'TÜR BELİRSİZ');assert.deepEqual(vehicleDocumentStatus({...machine,type:'Araç/Makine'},[]).required,[]);
assert.deepEqual(vehicleDocumentStatus({...machine,type:'Kamyonet (N1)'},[]).required,['Ruhsat','Muayene Belgesi','Zorunlu Trafik Sigortası']);
for(const type of ['Kamyonet (N1)','VAN','Pick-up']){assert.equal(vehicleFactor({type}).f,1);assert.equal(isHauler({type}),true);}
assert.equal(vehicleFactor({type:'Tır / Çekici'}).f,6);assert.equal(loadTon({type:'Çekici'}),27);assert.equal(loadTon({type:'Kamyon (N3)'}),22);
assert.equal(vehicleFactor(conflict,{byVehicle:{V:4}}).f,4,'explicit factor remains authoritative');
const fields=normalizedVehicleFields({name:'Kamyonet',type:'PICKUP'});assert.equal(fields.type,'Kamyonet');
const before={...conflict,type_review:review};assert.equal(normalizedVehicleFields(before,before).type_review,review);assert.equal(normalizedVehicleFields({...before,name:'new'},before).type_review,null);
for(const v of [null,{deleted_at:'2026-01-01'}])assert.equal(existingVehicle(v),false);
const data={vehicles:[{id:'V',name:'34 TEST 97',type:'Kamyonet'}]},plan={actions:[{op:'update',store:'vehicles',id:'V',fields:{type:'Kamyon'}}]};
assert.equal(validateActions(plan,{d:data,message:'34 TEST 97 aracının adını değiştir'})[0].ok,false,'model cannot silently change kind');
assert.equal(validateActions(plan,{d:data,message:'34 TEST 97 aracının türünü Kamyon yap'})[0].ok,true);
console.log('PASS vehicle taxonomy97: '+assertions+' alias/Unicode permutations plus conflicts/review freshness, unsupported classes, source evidence, documents, machine/road, yard/load and model mutation guards');

for(const message of ['Kamyon değil','Kamyon yapma','Kamyon türünü değiştirme','Kamyon olmasın'])assert.equal(vehicleTypeRequested('Kamyon',message),false,message);
assert.equal(vehicleTypeRequested('Kamyonet','Kamyon değil Kamyonet yap'),true);
assert.equal(vehicleTypeRequested('Kamyon','Kamyonet değil Kamyon yap'),true);

assert.equal(vehicleTypeRequested('Kamyonet','Kamyonet / Pick-up yapma'),false);
assert.equal(info(null).kind,null);

assert.equal(validateActions({...plan,actions:[{...plan.actions[0],fields:{type:null}}]},{d:data,message:'Aracın adını değiştir'})[0].ok,false);
assert.equal(validateActions(plan,{d:data,message:'34 TEST 97 türünü Kamyon yapma'})[0].ok,false);

assert.equal(existingVehicle({active:false}),true,'inactive vehicle identity remains valid for its history');

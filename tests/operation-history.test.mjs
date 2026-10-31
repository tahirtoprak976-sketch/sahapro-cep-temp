import assert from 'node:assert/strict';
import {exploreOperations,operationQuery,operationURL,operationCSV} from '../js/operation-history.js';
import {groupByDate,pageGroups} from '../js/date-groups.js';
const today='2026-10-21',names={vehicles:{v:'34GAM627',x:'JCB'},personnel:{p:'Soner'},customers:{c:'Kılıç Hafriyat'}};
const fuel=[
 {id:'a',date:today,vehicle_id:'v',personnel_id:'p',liters:10.25,fuel_source:'Müşteri Verdi',customer_id:'c',total:999},
 {id:'b',date:'2026-10-20',vehicle_id:'v',liters:20.5,fuel_source:'Depo Tankı',description:'Yağmur'},
 {id:'c',date:'2026-10-15',vehicle_id:'x',liters:0.25,fuel_source:'Akaryakıt İstasyonu',pump_no:'P-77'},
 {id:'d',date:'2026-10-14',liters:99,fuel_source:'Diğer'},
 {id:'old',date:'2026-09-01',liters:10,fuel_source:'Şantiye'},
 {id:'bad',date:'2026-02-30',liters:5,fuel_source:'Eski kaynak'},
 {id:'empty',date:'',liters:'',fuel_source:''},
 {id:'negative',date:today,liters:-7},
 {id:'nonfinite',date:today,liters:'Infinity'},
 {id:'removed',date:today,liters:1000,deleted_at:'now'},
];
const snapshot=structuredClone(fuel);
let m=exploreOperations('fuel',fuel,names,{period:'week'},today);
assert.deepEqual(m.rows.map(r=>r.id),['a','negative','nonfinite','b','c']);
assert.equal(m.liters,31);assert.equal(m.invalidLiters,2);
assert.deepEqual(m.sources,[{source:'Müşteri Verdi',liters:10.25},{source:'Depo Tankı',liters:20.5},{source:'Akaryakıt İstasyonu',liters:0.25}]);
assert.equal(m.days,3);assert.equal(m.cost,0,'fuel litre summary must not pretend amounts are cash outflow');
assert.equal(exploreOperations('fuel',fuel,names,{q:'kılıç'},today).rows[0].id,'a');
assert.equal(exploreOperations('fuel',fuel,names,{q:'P-77'},today).rows[0].id,'c');
assert.equal(exploreOperations('fuel',fuel,names,{vehicle_id:'v',personnel_id:'p',source:'Müşteri Verdi'},today).rows.length,1);
assert.equal(exploreOperations('fuel',fuel,names,{source:'Eski kaynak'},today).rows[0].id,'bad','legacy source stays searchable');
m=exploreOperations('fuel',fuel,names,{},today);assert.equal(m.undated,2);assert.deepEqual(m.rows.slice(-2).map(r=>r.id).sort(),['bad','empty']);
for(const query of [{from:'2026-02-30'},{from:'2026-10-22',to:today},{to:'bad'}]){
 m=exploreOperations('fuel',fuel,names,query,today);assert.ok(m.state.error);assert.equal(m.rows.length,0);assert.equal(m.liters,0);
}
assert.equal(operationQuery('fuel',{from:'2026-05-11'},today).to,'2026-05-11');
assert.equal(operationQuery('fuel',{to:'2026-05-11'},today).from,'');
assert.equal(operationQuery('fuel',{period:'month'},today).from,'2026-10-01');
assert.equal(operationQuery('fuel',{period:'today'},today).to,today);
assert.equal(operationQuery('fuel',{period:'today',from:'2026-05-11'},today).from,'2026-05-11','explicit range wins');
const maintenance=[
 {id:'m1',date:today,status:'Açık',cost:123.45,vehicle_id:'v',personnel_id:'p',service_company:'Yağ Servisi',part:'Filtre'},
 {id:'m2',date:today,status:'Serviste',cost:0,vehicle_id:'x'},
 {id:'m3',date:'2026-10-20',status:'Tamamlandı',cost:null},
 {id:'m4',date:'2026-10-20',cost:''},
 {id:'m5',date:'2026-10-20',cost:-5},
 {id:'m6',date:'2026-10-20',cost:'abc'},
 {id:'m7',date:'2026-10-20',cost:0.1},
 {id:'m8',date:'2026-10-20',cost:0.2},
];
m=exploreOperations('maintenance',maintenance,names,{f:'open'},today);
assert.equal(m.rows.length,7);assert.equal(m.cost,123.75);assert.equal(m.priced,4);assert.equal(m.unpriced,3);
assert.equal(exploreOperations('maintenance',maintenance,names,{f:'done'},today).rows[0].id,'m3');
assert.equal(exploreOperations('maintenance',maintenance,names,{f:'all'},today).unpriced,4);
assert.equal(exploreOperations('maintenance',maintenance,names,{q:'filtre'},today).rows[0].id,'m1');
assert.equal(exploreOperations('maintenance',maintenance,names,{q:'servisi'},today).rows[0].id,'m1');
assert.equal(operationQuery('maintenance',{f:'invalid'},today).f,'all');
assert.equal(exploreOperations('maintenance',maintenance,names,{},today).rows.length,8,'default view includes completed history');
assert.equal(operationQuery('maintenance',{source:'Depo Tankı'},today).source,'');
const url=operationURL('fuel',{q:'Kılıç & Soner',vehicle_id:'v',source:'Müşteri Verdi',from:today},{source:null,period:'all',from:null,unknown:'bad'});
const params=new URLSearchParams(url.split('?')[1]);assert.equal(params.get('q'),'Kılıç & Soner');assert.equal(params.get('vehicle_id'),'v');assert.equal(params.has('source'),false);assert.equal(params.has('unknown'),false);
assert.ok(operationURL('maintenance').startsWith('#/bakim'));
const csv=operationCSV('maintenance',[{id:'e',date:today,cost:0,description:'=HYPERLINK("bad")\nsemi;quote"'}],names);
assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"0"'));assert.ok(csv.includes("\"'=HYPERLINK"));assert.ok(csv.includes('semi;quote""'));
const fuelCSV=operationCSV('fuel',[fuel[0]],names);assert.ok(fuelCSV.includes('Kılıç Hafriyat'));assert.ok(!fuelCSV.includes('999'),'no misleading customer-fuel cost column');
const many=Array.from({length:40},(_,i)=>({id:String(i),date:today,liters:1}));many.push({id:'past',date:'2026-10-01',liters:2});
const pages=pageGroups(groupByDate(exploreOperations('fuel',many,names,{},today).rows),30);
assert.equal(pages[0][0].items.length,40);assert.equal(pages[1][0].items.length,1);
assert.deepEqual(fuel,snapshot,'read-only filters must not mutate source rows');
console.log('operation history: intersecting filters, real dates, source litres, missing/zero cost, cents, archived sources, stable order, whole-day pagination and safe CSV PASS');

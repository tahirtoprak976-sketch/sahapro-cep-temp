import assert from 'node:assert/strict';
import {fleetEntryLinks} from '../js/fleet-entry.js';
import {entryContext,entryContextHTML,entrySaveHash,entryRepeatHash} from '../js/entry-context.js';
import {fleetDesk} from '../js/fleet-desk-core.js';
const today='2026-11-26',v={id:'V/a&b',name:'TEST <script>'},vehicles=[v,{id:'OFF',active:false},{id:'DEL',deleted_at:'x'}];
const links=fleetEntryLinks(v,today);
for(const [kind,key]of [['fuel','fuel'],['maintenance','maintenance']]){
 const q=Object.fromEntries(new URLSearchParams(links[key].split('?')[1]));assert.deepEqual(Object.keys(q).sort(),['date','source','vehicle_id']);
 const c=entryContext({...q,liters:999,amount:9999,return_to:'https://evil.test'},vehicles,today);assert.deepEqual(c.values,{date:today,vehicle_id:v.id});assert.ok(!entryContextHTML(c).includes('<script>'));assert.equal(entrySaveHash(c,kind,{vehicle_id:'OTHER'}),'#/filo/OTHER');assert.equal(entryRepeatHash(c),null);
}
assert.equal(new URLSearchParams(links.document.split('?')[1]).get('owner_id'),v.id);assert.equal(new URLSearchParams(links.meter.split('?')[1]).get('vehicle_id'),v.id);
for(const id of ['OFF','DEL','missing']){assert.ok(entryContext({source:'fleet',vehicle_id:id},vehicles,today).error);assert.deepEqual(fleetEntryLinks(vehicles.find(v=>v.id===id),today),{});}
assert.ok(entryContext({source:'fleet',vehicle_id:v.id,date:'2026-02-31'},vehicles,today).error);
const d={vehicles:[v],documents:[],maintenance_records:[],fuel_records:[{id:'LAST',vehicle_id:v.id,date:today,liters:null},{id:'FUTURE',vehicle_id:v.id,date:'2027-01-01',liters:99},{id:'CANCEL',vehicle_id:v.id,date:today,status:'İptal',created_at:'9999',liters:99},{id:'OTHER',vehicle_id:'OTHER',date:today,liters:999}]};
const before=JSON.stringify(d);assert.equal(fleetDesk(d,v.id,{today}).fuelLast.id,'LAST');assert.equal(JSON.stringify(d),before);
console.log('fleet entry135 PASS: exact active vehicle/date only, no numeric carry/unsafe returns, manual selection return, missing/invalid guards and current exact-vehicle fuel evidence');

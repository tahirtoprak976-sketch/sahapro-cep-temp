import assert from 'node:assert/strict';
import {ACTION_FORMAT,ACTION_FORMAT_V2,readActionsPacket,decodeActionFiles,actionsPlan} from '../js/remote-actions-core.js';
import {customerPaidFuelUnknown,assertPaidFuelEdit,validatePaidFuelRestore,PAID_FUEL_UNKNOWN} from '../js/customer-paid-fuel.js';
import {customerFuelLedger} from '../js/assistant-rules.js';
import {operatingResult} from '../js/enterprise-core.js';
import {resultReport} from '../js/solo-core.js';
import {monthlySeries,vehicleSeries} from '../js/finance-chart.js';
import {customerBalances} from '../js/collect-core.js';
const offset={source_key:'TEST-offset126',date:'2026-01-01',customer:'TEST client126',vehicle:'TEST machine126',personnel:'TEST operator126',liters:4,unit_price:12.5,amount:50,reason:'TEST customer paid station fuel',price_basis:'reference',price_source:'https://example.test/TEST-pump126'};
const approval={confirmed:true,at:new Date().toISOString(),summary:'TEST only explicit approved source'};
const original={format:ACTION_FORMAT,id:crypto.randomUUID(),approved:approval,offsets:[offset],documents:[]};
const data={customers:[{id:'c',name:offset.customer}],vehicles:[{id:'v',name:offset.vehicle}],personnel:[{id:'p',name:offset.personnel}],work_records:[],fuel_records:[],pending_fuel_records:[],cari_movements:[],meta:[]};
const old=actionsPlan(original,data,await decodeActionFiles(original));data.cari_movements=old.writes.cari_movements;data.meta=old.writes.meta;
const link={...offset,source_key:'TEST-link126',offset_source_key:offset.source_key};
const packet={format:ACTION_FORMAT_V2,id:crypto.randomUUID(),approved:approval,offsets:[],documents:[],fuel_links:[link]};
assert.deepEqual(readActionsPacket(packet),packet);const files=await decodeActionFiles(packet),before=JSON.stringify(data),plan=actionsPlan(packet,data,files);assert.equal(JSON.stringify(data),before);
assert.equal(plan.writes.fuel_records.length,1);assert.equal(plan.writes.cari_movements.length,0);const fuel=plan.writes.fuel_records[0];assert.equal(fuel.fuel_source,'Akaryakıt İstasyonu');assert.equal(fuel.liters,4);assert.equal(fuel.total,null);assert.equal(fuel.unit_price,null);assert.equal(fuel.cost_source,PAID_FUEL_UNKNOWN);assert.equal(fuel.customer_id,'c');assert(!fuel.tank_movement_id);assert.match(fuel.description,/Ödeyen: TEST client126/);
const saved={...data,fuel_records:plan.writes.fuel_records,meta:[...data.meta,...plan.writes.meta]};assert.equal(customerPaidFuelUnknown(saved).length,1);assert.equal(customerPaidFuelUnknown(saved,{vehicle_id:'other'}).length,0);assert.equal(operatingResult(saved).provisional_result,null);assert.equal(operatingResult(saved).customerPaidFuelUnknown,1);assert.equal(resultReport(saved).provisional_result,null);assert.equal(resultReport(saved).unknown_cost_count,1);assert.equal(monthlySeries(saved,{today:'2026-01-31',months:1})[0].profit,null);assert.equal(vehicleSeries(saved,{today:'2026-01-15',days:20})[0].costIncomplete,true);assert.equal(customerFuelLedger(saved,'c').received,0);assert.equal(customerBalances(saved).bal.c,-50);
assert.equal(actionsPlan(packet,saved,files).repeated,1);
const again=structuredClone(packet);again.id=crypto.randomUUID();again.fuel_links[0].source_key='TEST-link126-second';const second=actionsPlan(again,saved,await decodeActionFiles(again));assert.equal(second.repeated,1);assert.equal(second.writes.fuel_records.length,0);assert.equal(second.writes.cari_movements.length,0);
for(const edit of [p=>p.fuel_links[0].amount=49,p=>p.fuel_links[0].offset_source_key='',p=>p.fuel_links[0].customer='',p=>p.fuel_links[0].extra='remove guards']){const p=structuredClone(packet);edit(p);assert.throws(()=>readActionsPacket(p));}
for(const [k,v] of [['customer','TEST other'],['vehicle','TEST other'],['date','2026-01-02'],['price_basis','receipt'],['offset_source_key','TEST missing']]){const p=structuredClone(packet);p.fuel_links[0][k]=v;const f=await decodeActionFiles(p);assert.throws(()=>actionsPlan(p,data,f));}

assert.throws(()=>actionsPlan(packet,{...data,cari_movements:[{...data.cari_movements[0],amount:-49}]},files),/tutarı/);
assert.throws(()=>actionsPlan(packet,{...data,fuel_records:[{id:'manual',date:offset.date,vehicle_id:'v',liters:4}]},files),/zaten/);
assert.throws(()=>actionsPlan(packet,{...data,pending_fuel_records:[{id:'pending',date:offset.date,vehicle_id:'v',liters:4,reconciliation_status:'pending'}]},files),/mutabakat/);
for(const [k,v]of [['liters',5],['fuel_source','Depo Tankı'],['customer_id','other'],['total',50],['deleted_at','2026-01-02']])assert.throws(()=>assertPaidFuelEdit('fuel_records',fuel,{...fuel,[k]:v},saved.meta),/tek başına/);
assert.throws(()=>assertPaidFuelEdit('cari_movements',data.cari_movements[0],{...data.cari_movements[0],amount:-51},saved.meta),/tek başına/);
assert.doesNotThrow(()=>assertPaidFuelEdit('fuel_records',fuel,{...fuel,description:'TEST extra note'},saved.meta));
assert.doesNotThrow(()=>validatePaidFuelRestore({}, {data:saved,meta:saved.meta},false));
assert.throws(()=>validatePaidFuelRestore({}, {data:{...saved,cari_movements:[]},meta:saved.meta},false),/bağlantısı/);
const combined={...packet,offsets:[offset]};const empty={...data,cari_movements:[],meta:[]};const together=actionsPlan(combined,empty,await decodeActionFiles(combined));assert.equal(together.writes.cari_movements.length,1);assert.equal(together.writes.fuel_records.length,1);
const receipt={...offset,source_key:'TEST-receipt126',price_basis:'receipt'};const combinedReceipt={...packet,offsets:[receipt],fuel_links:[{...receipt,source_key:'TEST-receipt-link126',offset_source_key:receipt.source_key}]};const actual=actionsPlan(combinedReceipt,empty,await decodeActionFiles(combinedReceipt));assert.equal(actual.writes.fuel_records[0].total,50);assert.equal(actual.writes.fuel_records[0].unit_price,12.5);
assert.throws(()=>validatePaidFuelRestore({}, {data:{...saved,fuel_records:[{...fuel,vehicle_id:'other'}]},meta:saved.meta},false),/bağlantısı/);
console.log('customer paid fuel126 PASS: old offset unchanged; physical station liters; no cash/tank/second credit; reference cost null/incomplete; no fuel allowance; source/date/customer/money matching; duplicate and mutator/restore guards; one transaction new offset+fuel supported');

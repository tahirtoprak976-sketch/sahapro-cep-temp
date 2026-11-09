import assert from 'node:assert/strict';
import {parseWhatsApp,buildAliasIndex} from '../js/parser.js';
// One interface test also runs on unchanged v103. Its adapter calls the exact
// old offline route parser when the new review adapter does not exist.
let read;
try {read=(await import('../js/offline-whatsapp.js')).offlinePlan;}
catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND'||!String(e.url).endsWith('/js/offline-whatsapp.js'))throw e;read=(raw,{d,today})=>{const rows=parseWhatsApp(raw,{...d,defaultDate:today,aliasIdx:buildAliasIndex(d.aliases,d.vehicles,d.customers,d.sites,d.personnel)});return {works:rows.map(r=>({...r,ok:r.confidence>=80&&!r.kontrol_gerekli})),fuel:rows.filter(r=>r.fuel_liters&&r.vehicle_id).map(r=>({date:r.date,vehicle_id:r.vehicle_id,liters:r.fuel_liters,ok:r.confidence>=80&&!r.kontrol_gerekli})),collections:[],personnel:[],fuelOut:[],tankIn:[]};};}
const today='2026-11-09';
const d={customers:[{id:'C',name:'Kuzey Yapı'},{id:'D',name:'Güney Yapı'}],vehicles:[{id:'V',name:'JCB 3CX',type:'JCB',assignee_id:'P'}],personnel:[{id:'P',name:'Operatör A',vehicle_id:'V'}],sites:[],aliases:[],price_book:[],fuel_tank_movements:[{id:'TEST_STOCK',date:'2026-01-01',move_type:'GİRİŞ',liters:1000}],work_records:[]};
const before=JSON.stringify(d),parse=raw=>read(raw,{d,today,rules:''});
let v=parse('[02/11/2026 18:00] Operatör A: 30.10 2026 Kuzey Yapı JCB 3CX 3 saat çalıştı');
assert.equal(v.works[0].date,'2026-10-30','An explicit date with a spaced year must override the message header');
assert.equal(v.works[0].quantity,3,'A machine code must not consume a written hour quantity');
v=parse('[31/10/2026 18:00] Operatör A: Kuzey Yapı JCB 3CX 3 saat çalıştı\nGüney Yapı 2 saat çalıştı');
assert.equal(v.works.length,2);for(const r of v.works){assert.equal(r.date,'2026-10-31','Continuation must retain its header date');assert.equal(r.personnel_id,'P');assert.equal(r.vehicle_id,'V');}
v=parse('[02/11 18:00] Operatör A: Kuzey Yapı JCB 3CX 2 saat çalıştı');assert.equal(v.works[0].date,'2026-11-02');
v=parse('[18:00, 02/11/2026] Operatör A: Kuzey Yapı JCB 3CX 2 saat çalıştı');assert.equal(v.works[0].date,'2026-11-02');assert.equal(v.works[0].personnel_id,'P');
v=parse('02.11.2026, 18:00 - Operatör A: Kuzey Yapı JCB 3CX 2 saat çalıştı');assert.equal(v.works[0].date,'2026-11-02');
v=parse('[02/11/2026 18:00] Operatör A: Dün Kuzey Yapı JCB 3CX 2 saat çalıştı');assert.equal(v.works[0].date,'2026-11-01');
v=parse('[31/02/2026 18:00] Operatör A: Kuzey Yapı JCB 3CX 2 saat çalıştı');assert.equal(v.works[0].ok,false);assert.notEqual(v.works[0].date,today,'Invalid dates must not become a confidently selected today');
v=parse('Kuzey Yapı JCB 3CX 2 saat çalıştı');assert.equal(v.works[0].ok,false,'No written date must require confirmation');
v=parse('02.11.2026\nKuzey Yapı JCB 3CX 1.5 saat çalıştı');assert.equal(v.works[0].date,'2026-11-02');assert.equal(v.works[0].quantity,1.5);
v=parse('[02/11/2026 18:00] TEST Unknown: Kuzey Yapı JCB 3CX 2 saat çalıştı');assert.equal(v.works[0].date,'2026-11-02');assert.equal(v.works[0].personnel_id,null,'Unknown sender must not borrow another operator');
for(const raw of ['02.11.2026','31 Ekim Perşembe','Patron gönderdi ödeme onda','20 bin ödeyecek','20 bin teklif verdik']){const r=parse(raw);assert.equal(r.works.length+r.fuel.length,0,'A date/payment/offer note must not create a blank work');}
v=parse('[03/11/2026 18:00] Operatör A: JCB 3CX 140 litre mazot depodan alındı');assert.equal(v.works.length,0,'Fuel-only input must never create a phantom work');assert.equal(v.fuel.length,1);assert.equal(v.fuel[0].liters,140);assert.equal(v.fuel[0].date,'2026-11-03');
v=parse('[03/11/2026 18:00] Operatör A: Kuzey Yapı JCB 3CX 2 saat teklif verildi');assert.equal(v.works.length,0,'An offer is not completed work');
v=parse('[03/11/2026 18:00] Operatör A: Depoya 100 litre mazot geldi');assert.equal(v.fuel.length,0,'Stock intake must not become machine fuel consumption');
v=parse('[03/11/2026 18:00] Operatör A: Kuzey Yapı JCB 3CX 2 saat çalıştı\nSP1:TEST_INVALID_SIGNATURE');for(const r of [...v.works,...v.fuel])assert.equal(r.ok,false,'A driver payload must never gain trust without signature verification');
for(const group of ['collections','personnel','fuelOut','tankIn'])assert.deepEqual(v[group],[],'Offline text is not authority for financial transactions');
assert.equal(JSON.stringify(d),before,'Parsing must never mutate registered records');
console.log('offline WhatsApp: dates, continuations, assignments, fuel-only, non-job notes, authority and read-only parsing PASS');

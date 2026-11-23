import assert from 'node:assert/strict';
import {buildReport,reportSpec,reportCsv,reportOptions} from '../js/report-core.js';
const d={vehicles:[{id:'V',name:'TEST Kamyon',plate:'00 TEST 01'},{id:'OLD',name:'TEST Eski',deleted_at:'2026-10-01'}],personnel:[{id:'P',name:'TEST Alıcı'},{id:'OTHER',name:'TEST Bugünkü Şoför',vehicle_id:'V'}],customers:[{id:'C',name:'TEST Müşteri'}],fuel_tank_movements:[
 {id:'I0',date:'2026-10-01',move_type:'GİRİŞ',liters:1000},
 {id:'I',date:'2026-11-01',move_type:'GİRİŞ',liters:500},
 {id:'O',date:'2026-11-02',move_type:'ÇIKIŞ',liters:40,vehicle_id:'V',personnel_id:'P',signature_name:'TEST Teslim',pump_no:'P001'},
 {id:'LINK',date:'2026-11-03',move_type:'ÇIKIŞ',liters:20,fuel_record_id:'F'},
 {id:'N',date:'2026-11-04',move_type:'ÇIKIŞ',liters:10},
 {id:'C1',date:'2026-11-04',move_type:'ÇIKIŞ',liters:30,delivery_kind:'customer_fuel',recipient_customer_id:'C',recipient_machine:'TEST Jeneratör'},
 {id:'D',date:'2026-11-04',move_type:'ÇIKIŞ',liters:999,deleted_at:'2026-11-05'},
 {id:'BAD',date:'2026-02-31',move_type:'ÇIKIŞ',liters:100},
 {id:'FUTURE',date:'2026-12-01',move_type:'ÇIKIŞ',liters:100}],
 fuel_records:[{id:'F',tank_movement_id:'LINK',date:'2026-11-03',vehicle_id:'V',personnel_id:'P',liters:20,km:12000,description:'TEST Bağlı kayıt'},{id:'STATION',fuel_source:'Akaryakıt İstasyonu',date:'2026-11-03',vehicle_id:'V',liters:999}],
 pending_fuel_records:[{id:'WAIT',reconciliation_status:'pending',date:'2026-11-04',vehicle_id:'V',personnel_id:'P',liters:50},{id:'CANCEL',reconciliation_status:'cancelled',date:'2026-11-04',liters:123}]};
const before=structuredClone(d),opts={k:'depo',from:'2026-11-01',to:'2026-11-30'},r=buildReport(d,opts);
assert.equal(r.kind,'Depo yakıt','Missing detailed depot report');
assert.equal(r.kpis.find(x=>x[0]==='Filtrelenen çıkış')[1],'100 L');
assert.equal(r.kpis.find(x=>x[0].startsWith('Dönem başı'))[1],'1.000 L');assert.equal(r.kpis.find(x=>x[0].startsWith('Dönem sonu'))[1],'1.400 L');
assert.deepEqual(r.tables[0].rows.find(x=>x[0]==='TEST Alıcı'),['TEST Alıcı','2','60']);
assert.equal(r.tables[2].rows.length,5);assert.match(reportCsv(r),/TEST Teslim/);assert.match(reportCsv(r),/P001/);assert.match(JSON.stringify(reportSpec(r)),/TEST Jeneratör/);assert.match(reportCsv(r),/12.000 km/);
assert.ok(r.notes.some(x=>/50 L.*mutabakat/.test(x)));assert.ok(r.notes.some(x=>/geçersiz/.test(x)));assert.doesNotMatch(reportCsv(r),/TEST Bugünkü Şoför|999|123/);
const scoped=buildReport(d,{...opts,id:'V',personnel:'P',movement:'ÇIKIŞ'});assert.equal(scoped.tables[2].rows.length,2);assert.equal(scoped.kpis.find(x=>x[0]==='Filtrelenen çıkış')[1],'60 L');assert.equal(scoped.kpis.find(x=>x[0].startsWith('Dönem sonu'))[1],'1.400 L');
assert.equal(buildReport(d,{...opts,movement:'GİRİŞ'}).tables[2].rows.length,1);assert.throws(()=>buildReport(d,{...opts,from:'2026-12-01'}),/tarih/);assert.throws(()=>buildReport(d,{...opts,to:'2026-02-31'}),/tarih/);
assert.ok(reportOptions(d,'depo').some(x=>x.id==='OLD'));assert.deepEqual(d,before,'Reporting cannot write or repair business data');
console.log('tank detail report PASS: authoritative stock once, dates, person/vehicle filters, no guessed driver, customer delivery, pending separate, immutable source, PDF/CSV parity');

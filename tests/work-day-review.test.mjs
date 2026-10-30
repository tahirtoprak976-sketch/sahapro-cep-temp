import assert from 'node:assert/strict';
import {workDayModel,compareDayMessages,reviewMessages} from '../js/work-day-review.js';
const day='2026-10-30',body='Kendo Evleri Manitou MTX 1840 1 saat tuğla indirildi',header='[30/10 19:00] Soner: ',message=header+body;
const fuelBody='Manitou MTX 1840 20 litre mazot depodan alındı',fuelMessage='[30/10 19:10] Soner: '+fuelBody;
const fixture=()=>({customers:[{id:'C',name:'Kendo Evleri'},{id:'L',name:'Leda'},{id:'I',name:'İç depo',internal:true}],vehicles:[{id:'V',name:'Manitou MTX 1840'},{id:'J',name:'JCB'}],personnel:[{id:'S',name:'Soner'},{id:'O',name:'Olcay'},{id:'OLD',name:'Eski personel',active:false}],
 work_records:[{id:'W',date:day,customer_id:'C',vehicle_id:'V',personnel_id:'S',work_type:'Manitou Çalışması',quantity:1,unit:'Saat',price_snapshot:null,assistant_origin:{version:1,status:'matched',fragment:body,message}},{id:'MANUAL',date:day,customer_id:'C',vehicle_id:'V',personnel_id:'S',work_type:'Manitou Çalışması',quantity:2,unit:'Saat',price_snapshot:null}],
 fuel_records:[{id:'F',date:day,vehicle_id:'V',personnel_id:'S',liters:20,fuel_source:'Depo Tankı',assistant_origin:{version:1,status:'matched',fragment:fuelBody,message:fuelMessage}}],pending_fuel_records:[],hakedis:[]});
let d=fixture(),before=structuredClone(d),m=workDayModel(d,day);
assert.equal(m.counts.work,2);assert.equal(m.counts.price,2);assert.equal(m.groups[0].units.Saat,3);assert.equal(m.groups[0].fuel,20);assert.deepEqual(m.noRecords.map(x=>x.id),['O']);assert.deepEqual(d,before);
const raw=[message,'[30/10 19:02] Olcay: Leda JCB 1,5 saat mermer indirildi','[30/10 19:04] Soner: Kendo Evleri Manitou MTX 1840 2 saat çalıştı',fuelMessage].join('\n');
let c=compareDayMessages(d,day,raw);assert.deepEqual(c.counts,{linked:2,similar:1,not_found:1,review:0,other_date:0});assert.deepEqual(d,before,'comparison writes nothing; unpriced is still recorded');
d.work_records[0].quantity=3;c=compareDayMessages(d,day,message);assert.equal(c.items[0].status,'review');assert.equal(c.items[0].sourceConflict,true);assert.equal(c.items[0].candidates[0].id,'W');
d=fixture();d.work_records[0].assistant_origin.fragment='Başka iş';c=compareDayMessages(d,day,message);assert.equal(c.items[0].status,'similar','same whole batch never proves a specific work');
d=fixture();d.work_records[0].assistant_origin.message=message+'\n[30/10 20:00] Soner: '+body;c=compareDayMessages(d,day,message);assert.equal(c.items[0].status,'similar','ambiguous source block');
d=fixture();d.work_records.push({...d.work_records[0],id:'OTHER-SOURCE',quantity:9});c=compareDayMessages(d,day,message);assert.equal(c.items[0].status,'review');assert.equal(c.items[0].sourceAmbiguous,true,'a source attached to two different saved jobs requires review');
d=fixture();c=compareDayMessages(d,day,message+'\n'+message);assert.equal(c.items.length,1);assert.ok(c.notices.some(n=>/tekrar/.test(n.text)));
c=compareDayMessages(d,day,message+'\n[30/10 20:00] Soner: '+body);assert.deepEqual(c.items.map(x=>x.status),['linked','similar'],'different message times cannot reuse a source link');
d=fixture();d.work_records[0].assistant_origin={version:1,status:'matched',fragment:body,message:header+body+'; '+body};c=compareDayMessages(d,day,header+body+'; '+body);assert.equal(c.counts.linked,0,'one saved row cannot cover two incoming items');
d=fixture();d.fuel_records=[];d.pending_fuel_records=[{id:'PF',date:day,vehicle_id:'V',personnel_id:'S',liters:20,reconciliation_status:'pending'}];c=compareDayMessages(d,day,fuelMessage);assert.equal(c.items[0].status,'similar');assert.equal(c.items[0].pending.length,1);m=workDayModel(d,day);assert.equal(m.counts.fuel,0);assert.equal(m.counts.pending,1);assert.equal(m.groups[0].fuel,0);assert.equal(m.groups[0].pendingFuel,20);
c=compareDayMessages(fixture(),day,'[29/10 20:00] Soner: '+body);assert.equal(c.items[0].status,'other_date');assert.equal(c.items[0].expected.date,'2026-10-29');
c=compareDayMessages(fixture(),day,'[31/02 20:00] Soner: '+body);assert.equal(c.items.length,0);assert.ok(c.notices.length);
c=compareDayMessages(fixture(),day,header+'31/02 Kendo Evleri Manitou MTX 1840 1 saat çalıştı');assert.ok(c.items.every(x=>x.status==='review'));
c=compareDayMessages(fixture(),day,body);assert.equal(c.unheaded,true);assert.equal(c.items[0].status,'similar');
c=compareDayMessages(fixture(),day,'[30/10 20:10] Olcay: tamam\n[30/10 20:12] Olcay: 2 sefer değil 3 sefer\n[30/10 20:13] Olcay: Fotoğraf gönderildi');assert.equal(c.chatter,1);assert.ok(c.notices.length>=2);assert.equal(c.counts.linked,0);
d=fixture();d.work_records.push({id:'ZERO',date:day,customer_id:'C',vehicle_id:'V',quantity:1,unit:'Sefer',price_snapshot:{amount:0}},{id:'FUEL-PAY',date:day,customer_id:'C',vehicle_id:'V',quantity:1,unit:'Sefer',customer_fuel_allowance_l:75},{id:'INTERNAL',date:day,customer_id:'I',vehicle_id:'V',quantity:1,unit:'Sefer'},{id:'BILLED',date:day,customer_id:'C',vehicle_id:'V',quantity:1,unit:'Sefer'});d.hakedis=[{id:'H',status:'Kesinleşti',items:[{work_record_id:'BILLED'}]}];assert.equal(workDayModel(d,day).counts.price,2);
assert.equal(workDayModel(fixture(),day,{q:'tuğla'}).groups.length,0); // origin alone is not a local note
d=fixture();d.work_records[0].personnel_id=null;assert.equal(workDayModel(d,day).groups[0].id,'','sender never silently becomes the operator');
assert.throws(()=>workDayModel(d,'2026-02-30'),/iş günü/);assert.throws(()=>compareDayMessages(d,day,'a'.repeat(20001)),/kesilmedi/);
assert.equal(reviewMessages('30.10.2026, 19:00 - Soner: '+body,day)[0].key,reviewMessages(message,day)[0].key);
console.log('work-day-review PASS: person/date grouping, separate price/pending fuel, source-bound matching, ambiguity, duplicate allocation, changed facts and read-only comparison');

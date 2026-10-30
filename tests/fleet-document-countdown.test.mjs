import assert from 'node:assert/strict';
import {documentCountdown as countdown,documentVehicle,fleetDocumentModel as model,nearestVehicleDocument} from '../js/fleet-document-core.js';
import {expiryState,normalizedDocument,vehicleDocumentStatus} from '../js/business.js';
const today='2026-10-30';
const doc=(id,extra={})=>({id,category:'Muayene Belgesi',doc_no:id,owner_type:'vehicle',owner_id:'V',vehicle_id:'V',date:'2026-01-01',expiry_date:'2026-11-06',...extra});
assert.equal(countdown(doc('A'),today).label,'7 gün kaldı');
assert.deepEqual([countdown(doc('A',{expiry_date:today}),today).state,countdown(doc('A',{expiry_date:today}),today).days],['today',0]);
assert.equal(countdown(doc('A',{expiry_date:'2026-10-24'}),today).label,'6 gün geçti');
assert.equal(countdown(doc('A',{expiry_date:'2026-11-29'}),today).state,'soon');
assert.equal(countdown(doc('A',{expiry_date:'2026-11-30'}),today).state,'valid');
assert.equal(countdown(doc('A',{date:'2026-10-01',valid_from:'2026-11-01',expiry_date:'2027-11-01'}),today).label,'2 gün sonra başlar');
for(const expiry_date of ['2026-02-30','2026-13-01','not-a-date',{},false])assert.equal(countdown(doc('A',{expiry_date}),today).state,'invalid');
for(const valid_from of ['2026-02-30',{},false])assert.equal(countdown(doc('A',{valid_from}),today).state,'invalid');
assert.equal(countdown(doc('A',{date:'2026-11-01',expiry_date:today}),today).state,'invalid');
assert.equal(countdown(doc('A',{expiry_date:null}),today).state,'unknown');
assert.equal(countdown(doc('A',{category:'Ruhsat',expiry_date:null}),today).state,'unlimited');
assert.equal(countdown(doc('A',{category:'Ruhsat',date:'2026-11-01',expiry_date:null}),today).state,'future');
assert.equal(countdown(doc('A',{category:'Diğer',expiry_date:null}),today).state,'unlimited');
assert.throws(()=>countdown(doc('A'),'2026-02-30'));
assert.equal(expiryState(doc('M',{expiry_date:null}),today),'Bitiş Tarihi Eksik');
assert.equal(expiryState(doc('M',{date:'2026-11-01',expiry_date:'2027-11-01'}),today),'Henüz Başlamadı');
assert.equal(expiryState(doc('M',{expiry_date:'2026-02-30'}),today),'Tarih Kontrolü');
for(const key of ['expiry_date','reminder_date','valid_from'])assert.throws(()=>normalizedDocument({...doc('X'),[key]:'2026-02-30'}),/tarihleri/);
for(const [from,to,days] of [['2026-03-28','2026-03-30',2],['2026-10-24','2026-10-26',2],['2024-02-28','2024-03-01',2],['2026-12-31','2027-01-01',1]])assert.equal(countdown(doc('D',{date:from,expiry_date:to}),from).days,days,'calendar days survive DST/leap/year transitions');

const data={vehicles:[{id:'V',name:'34 TEST 89'},{id:'OTHER',name:'TEST JCB'},{id:'PASSIVE',name:'TEST archived',active:false},{id:'DELETED',deleted_at:today}],documents:[
 doc('OLD',{date:'2025-01-01',expiry_date:'2025-12-31'}),doc('CURRENT'),
 doc('COPY',{category:'TÜVTÜRK / Periyodik Muayene'}),
 doc('FUTURE',{date:'2026-10-30',valid_from:'2026-11-07',expiry_date:'2027-11-07'}),
 doc('UNKNOWN',{date:'2026-10-29',expiry_date:null}),
 doc('OTHER',{owner_id:'OTHER',vehicle_id:'OTHER',expiry_date:'2026-10-24'}),
 doc('P',{owner_id:'PASSIVE',vehicle_id:'PASSIVE',expiry_date:'2026-10-20'}),
 doc('DELETED-DOC',{deleted_at:today}),doc('CANCELLED',{status:'İptal'}),
 doc('PERSON',{category:'Ehliyet',owner_type:'personnel',owner_id:'P',vehicle_id:'V'}),
 doc('OWNER-ONLY',{category:'Kasko',owner_id:'V',vehicle_id:null,expiry_date:today}),
]};
const before=JSON.stringify(data),m=model(data,{today});
assert.equal(m.counts.overdue,1,'old renewal and passive vehicles cannot create active expiry alerts');
assert.equal(m.counts.today,1);assert.equal(m.counts.soon,1);assert.equal(m.counts.week,1);assert.equal(m.counts.future,1);assert.equal(m.counts.review,1);
assert.equal(m.rows.find(r=>r.state==='soon').history.length,2,'alias/copy and older renewal stay in history');
assert.equal(model(data,{today,vehicle_id:'V',status:'week'}).selected.length,1);
assert.equal(model(data,{today,vehicle_id:'V',q:'KASKO'}).selected[0].doc.id,'OWNER-ONLY');
assert.equal(model(data,{today,includeInactive:true}).counts.overdue,2);
assert.equal(nearestVehicleDocument(m,'V').state,'today');
assert.equal(documentVehicle({owner_type:'vehicle',owner_id:'V'}),'V');
assert.equal(documentVehicle({vehicle_id:'V'}),'V');
assert.equal(documentVehicle({owner_type:'vehicle',owner_id:'V',vehicle_id:'OTHER'}),null);
const bad=model({...data,documents:[doc('MISMATCH',{owner_id:'V',vehicle_id:'OTHER'}),doc('NOOWNER',{owner_id:null,vehicle_id:null})]},{today});
assert.equal(bad.counts.review,2);assert.equal(bad.rows.length,2,'a mismatched owner is one review item, never two assigned documents');
assert.equal(model({...data,documents:bad.rows.map(r=>r.doc)},{today,vehicle_id:'V'}).selected.length,1);
assert.equal(JSON.stringify(data),before,'every counter/filter is read-only');
const v={id:'V',name:'34 TEST 89',type:'Kamyon',required_document_types:['Muayene Belgesi']};
assert.equal(vehicleDocumentStatus(v,[],today).status,'EKSİK','adding counters preserves missing-document warning');
const expired=doc('EXPIRED',{expiry_date:'2026-10-29'}),renewal=doc('RENEWAL',{valid_from:'2026-10-31',expiry_date:'2027-10-31'});
assert.equal(vehicleDocumentStatus(v,[expired,renewal],today).status,'SÜRESİ GEÇMİŞ','future renewal cannot hide current expiry in fleet compliance badge');
for(const extra of [{status:'İptal'},{owner_type:'personnel'},{owner_id:'OTHER'},{expiry_date:null},{date:'2026-02-30'}])assert.equal(vehicleDocumentStatus(v,[doc('BAD',extra)],today).status,'EKSİK');
console.log('fleet-document-countdown PASS: exact days/boundaries/DST, future renewals, alias history, absent/invalid dates, ownership and inactive scope, immutable records');

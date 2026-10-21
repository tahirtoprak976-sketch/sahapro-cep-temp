import assert from 'node:assert/strict';
import {businessPriorities,isBusinessPriorityCommand,localBusinessPriorityCommand} from '../js/business-priorities.js';
import {routeCommand} from '../js/command-router.js';
import {morningBrief} from '../js/brief.js';
const today='2026-10-20',old='2026-07-01';
const w=(id,c,amount,extra={})=>({id,customer_id:c,date:old,quantity:1,unit:'Saat',price_snapshot:{unit_price:amount,amount},...extra});
const d={customers:[{id:'C',name:'Çatıcı',parent_customer_id:'P'},{id:'P',name:'Ulaş Rondela'},
 {id:'T',name:'Bugün'},{id:'F',name:'Gelecek söz'},{id:'O',name:'Eski açık'},{id:'R',name:'Yeni hatırlatma'},{id:'D',name:'Ödenmiş'},{id:'I',name:'İç',internal:true}],
 work_records:[w('c','C',1500.25),w('t','T',42.5),w('f','F',999),w('o','O',100),w('r','R',200),w('d','D',30),w('i','I',500)],
 cari_movements:[{customer_id:'C',date:today,type:'Tahsilat',amount:-500},{customer_id:'D',date:today,type:'Tahsilat',amount:-30}],
 personnel:[{id:'S',name:'Soner'}],cash_records:[
 {id:'cash',cash_type:'Müşteriden Para Alındı',cash_status:'PERSONELDE',personnel_id:'S',customer_id:'C',date:today,amount:500},
 {id:'reported',cash_type:'Müşteriden Para Alındı',cash_status:'TESLIM_BILDIRILDI',personnel_id:'S',customer_id:'C',date:today,amount:20},
 {id:'delivered',cash_type:'Müşteriden Para Alındı',cash_status:'KASAYA_TESLIM_EDILDI',date:today,amount:100},
 {id:'future',cash_type:'Müşteriden Para Alındı',cash_status:'PERSONELDE',date:'2026-10-21',amount:100},
 {id:'deleted',cash_type:'Müşteriden Para Alındı',cash_status:'PERSONELDE',date:today,amount:100,deleted_at:'x'}],
 vehicles:[{id:'V',name:'TEST Makine',service_rules:[{id:'late',title:'Yağ',every_days:30,last:{date:'2026-09-01'}},{id:'soon',title:'Filtre',every_days:30,last:{date:'2026-09-25'}}]}],
 instruments:[{id:'q',direction:'Verilen',kind:'Çek',document_no:'TEST-47',status:'Portföyde',amount:175.5,due_date:'2026-10-22'},
 {id:'closed',kind:'Çek',status:'Tahsil Edildi',amount:900,due_date:old}]};
const meta=[{key:'collect_notes',value:{C:{promise_date:'2026-10-19',promise_amount:1000.25},T:{promise_date:today},F:{promise_date:'2026-10-25'},R:{reminded_at:today}}},
 {key:'pdf_history_draft:H',value:{rows:[{id:'0',kind:'work'},{id:'1',kind:'summary'}]}}];
const before=JSON.stringify({d,meta}),p=businessPriorities(d,{today,meta});
assert.equal(p.items[0].key,'maintenance:V:late','recorded overdue maintenance is first');
const promised=p.items.find(x=>x.key==='collect:C');assert.equal(promised.urgency,0);
assert.match(promised.title,/Çatıcı \(Ulaş Rondela\)/);assert.match(promised.why,/1\.000,25 ₺/);
assert.equal(promised.hash,'#/tahsilat/C');assert.match(promised.why,/Ödeme yapıldığı varsayılmaz/);
assert.equal(p.items.find(x=>x.key==='collect:T').urgency,1);
assert.match(p.items.find(x=>x.key==='collect:O').why,/sözleşmede vade tanımlandığı anlamına gelmez/);
for(const id of ['F','R','D','I'])assert.ok(!p.items.some(x=>x.key==='collect:'+id),id);
const cash=p.items.find(x=>x.key==='cash:cash');assert.match(cash.title,/Soner/);
assert.match(cash.why,/500,00 ₺/);assert.match(cash.why,/yeniden tahsilat girmeden/);assert.equal(cash.hash,'#/kasa/cash');
assert.equal(p.items.filter(x=>x.key.startsWith('cash:')).length,2);
assert.match(p.items.find(x=>x.key==='cash:reported').why,/kasaya teslim onayı henüz kaydedilmedi/);
assert.match(cash.why,/Çatıcı \(Ulaş Rondela\)/);
assert.equal(p.items.find(x=>x.key==='cheque:q').hash,'#/ceksenet/q');assert.ok(!p.items.some(x=>x.key==='cheque:closed'));
assert.equal(p.items.find(x=>x.key==='maintenance:V:soon').urgency,1);
assert.equal(p.items.filter(x=>x.key==='review:pdf').length,1);
assert.equal(p.items.filter(x=>x.key==='collect:C').length,1);
assert.equal(new Set(p.items.map(x=>x.key)).size,p.total);
const reverse=Object.fromEntries(Object.entries(d).map(([k,v])=>[k,[...v].reverse()]));
assert.deepEqual(businessPriorities(reverse,{today,meta}).items,p.items,'input ordering does not reorder priorities');
assert.equal(JSON.stringify({d,meta}),before,'recommendations never mutate sources');

const paid=structuredClone(d);paid.cari_movements.push({customer_id:'C',date:today,type:'Tahsilat',amount:-1000.25});
assert.ok(!businessPriorities(paid,{today,meta}).items.some(x=>x.key==='collect:C'),'settled balance clears the promise action');
assert.ok(businessPriorities(paid,{today,meta}).items.some(x=>x.key==='cash:cash'),'customer payment and personnel handover are independent');
paid.cash_records[0].cash_status='KASAYA_TESLIM_EDILDI';
assert.ok(!businessPriorities(paid,{today,meta}).items.some(x=>x.key==='cash:cash'));
const first=businessPriorities({}, {today});assert.deepEqual(first.items.map(x=>x.key),['start:work','start:history']);
assert.equal(businessPriorities({}, {today,meta:meta.slice(1)}).items.filter(x=>x.key==='start:history').length,0,'pending PDF uses its resume action');
assert.throws(()=>businessPriorities({}, {today:'2026-02-31'}),/geçerli/);
for(const text of ['Bugün ne yapmalıyım?','bugun ne yapmaliyim','İşletme önerileri','ÖNCELİKLERİM','Nereden başlamalıyım?']){
 assert.ok(isBusinessPriorityCommand(text),text);
 const answer=routeCommand(text,d,today,{priorityMeta:meta});assert.equal(answer.kind,'answer');assert.match(answer.text,/Çatıcı \(Ulaş Rondela\)/);
 assert.equal(answer.items.length,6);assert.equal(answer.items[0].hash,p.items[0].hash);
}
for(const text of ['Bugün ne yapmalıyım? Kaya 2 sefer','işletmeyi değerlendir 500 TL aldım','Kaya 3 saat çalıştı']){
 assert.equal(isBusinessPriorityCommand(text),false);assert.equal(localBusinessPriorityCommand(text,d,today,meta),null);
}
assert.equal(routeCommand('Bugün ne\nyapmalıyım?',d,today,{priorityMeta:meta}),null,'multiline work messages are not consumed as a local command');
const briefData={customers:[{id:'C',name:'TEST'}],work_records:[w('locked','C',null,{date:'2026-10-19',price_snapshot:{locked:true}}),w('billed','C',null,{date:'2026-10-19',price_snapshot:null}),w('included','C',null,{date:'2026-10-19',price_snapshot:{price_source:'Sözleşmeye dahil'}})],hakedis:[{status:'Kesinleşti',items:[{work_record_id:'billed'}]}]};
const brief=morningBrief(briefData,{today});assert.ok(!/fiyatsız/.test(brief.text));assert.equal(brief.lines[0].href,'#/isler?from=2026-10-19&to=2026-10-19');
assert.match(brief.text,/kâr veya kasa bakiyesi değildir/);assert.ok(!brief.text.includes('tahmini kâr'));
console.log('business priorities: balances versus cash delivery, promises, ageing versus due dates, parent identity, maintenance, instruments, PDF, startup, deterministic ordering, local routing and no mutations OK');

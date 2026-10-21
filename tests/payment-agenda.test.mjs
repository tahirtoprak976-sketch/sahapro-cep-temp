import assert from 'node:assert/strict';
import {paymentAgenda,paymentView,paymentPriorityItems,paymentCSV,isPaymentAgendaCommand,localPaymentAgendaCommand} from '../js/payment-agenda.js';
import {routeCommand} from '../js/command-router.js';
const today='2026-10-21';
const bill=(id,amount,due,extra={})=>({id,party_type:'supplier',party_id:'S',date:'2026-10-01',due_date:due,gross_total:amount,document_no:'DOC-'+id,status:'Onaylandı',...extra});
const pay=(id,amount,extra={})=>({id:'P-'+id,payable_id:id,party_type:'supplier',party_id:'S',date:today,amount,...extra});
const d={suppliers:[{id:'S',name:'TEST Lastikçi'},{id:'D',name:'TEST Arşiv',deleted_at:'x'}],contractors:[{id:'K',name:'TEST Taşeron'}],payables:[
 bill('overdue',1000.25,'2026-10-20'),bill('today',100,today),bill('soon',0.1,'2026-10-28'),bill('soon2',0.2,'2026-10-22'),
 bill('later',99.99,'2026-10-29'),bill('missing',50,''),bill('bad-due',20,'2026-02-30'),bill('early-due',20,'2026-09-30'),
 bill('cancel',500,'2026-10-20',{status:'İptal'}),bill('removed',500,'2026-10-20',{deleted_at:'x'}),bill('closed',80,'2026-10-20'),
 bill('overpaid',80,'2026-10-20'),bill('draft',80,'2026-10-20',{status:'Taslak'}),bill('broken',null,'2026-10-20'),
 bill('wrong-payment',100,'2026-10-20'),bill('bad-payment',100,'2026-10-20'),bill('negative-payment',100,'2026-10-20'),
 bill('missing-party',100,'2026-10-20',{party_id:'?' }),bill('unknown-type',100,'2026-10-20',{party_type:'__proto__'}),
 bill('future',100,'2026-11-01',{date:'2026-11-01'}),bill('archive',30,'2026-10-20',{party_id:'D'}),
 bill('contractor',40,'2026-10-20',{party_type:'contractor',party_id:'K'}),bill('no-date',50,today,{date:''}),
 ],supplier_payments:[pay('overdue',250.10),pay('overdue',200,{id:'deletedpay',deleted_at:'x'}),pay('today',100,{date:'2026-10-22'}),pay('closed',80),pay('overpaid',80.01),pay('wrong-payment',10,{party_id:'another'}),pay('bad-payment',10,{date:''}),pay('negative-payment',-10)],
 instruments:[{id:'Q',party_type:'supplier',party_id:'S',direction:'Verilen',kind:'Çek',document_no:'Q-1',status:'Portföyde'},
 {id:'received',party_type:'supplier',party_id:'S',direction:'Alınan',status:'Portföyde'},
 {id:'paid',party_type:'supplier',party_id:'S',direction:'Verilen',status:'Ödendi'},
 {id:'wrong',party_type:'contractor',party_id:'S',direction:'Verilen',status:'Portföyde'}]};
const before=JSON.stringify(d),plan=paymentAgenda(d,{today}),get=id=>plan.rows.find(r=>r.id===id);
assert.equal(get('overdue').remaining,750.15);assert.equal(get('overdue').paid,250.1);assert.equal(get('overdue').bucket,'overdue');
assert.equal(get('today').remaining,100);assert.equal(get('today').paid,0);assert.equal(get('today').futurePayments,1);
assert.equal(get('soon').bucket,'soon');assert.equal(get('later').bucket,'later');
assert.equal(get('missing').remaining,50);assert.equal(get('missing').bucket,'review');assert.match(get('missing').issues.join(),/varsayılmadı/);
for(const id of ['bad-due','early-due','overpaid','draft','broken','wrong-payment','bad-payment','negative-payment','missing-party','unknown-type','no-date'])assert.equal(get(id).bucket,'review',id);
for(const id of ['cancel','removed','closed','future'])assert.ok(!get(id),id);
assert.equal(get('wrong-payment').remaining,null,'ambiguous related payments must not produce a payment recommendation');
assert.equal(get('overpaid').remaining,null);assert.equal(get('archive').archived,true);
assert.equal(get('contractor').name,'TEST Taşeron');assert.equal(get('overdue').cheques.length,1);assert.equal(get('contractor').cheques.length,0);
assert.equal(plan.futureBills,1);assert.equal(plan.closed,1);
const view=paymentView(plan);assert.equal(view.totals.soon.amount,0.3);assert.equal(view.totals.overdue.amount,820.15);
assert.equal(paymentView(plan,{q:'DOC-overdue',bucket:'overdue'}).rows.length,1);
assert.equal(paymentView(plan,{q:'taşeron'}).rows[0].id,'contractor');assert.equal(paymentView(plan,{bucket:'invalid'}).bucket,'all');
const tasks=paymentPriorityItems(plan);assert.equal(tasks.find(r=>r.key==='payable:overdue').urgency,0);
assert.equal(tasks.find(r=>r.key==='payable:today').urgency,1);assert.equal(tasks.find(r=>r.key==='payable:soon').urgency,2);
assert.match(tasks.find(r=>r.key==='payable:overdue').why,/750,15 ₺/);assert.match(tasks.find(r=>r.key==='payable:overdue').why,/çek\/senet/);
for(const id of ['missing','bad-due','draft','closed','later'])assert.ok(!tasks.some(t=>t.key==='payable:'+id),id);
for(const text of ['Kime ödeme yapacağım?','kime odeme yapacagim','ÖDEMELERİM','Bu hafta kime ödeme yapacağım?','Ödeme takibini aç']){
 assert.ok(isPaymentAgendaCommand(text),text);const result=routeCommand(text,d,today);assert.equal(result.kind,'answer');assert.match(result.text,/750,15/);assert.equal(result.items.at(-1).hash,'#/odeme-takibi');
}
for(const text of ['Lastikçiye 500 TL ödeme yaptım','ödemelerim 500 TL','kime ödeme yapacağım sonra Kaya 2 sefer'])assert.equal(localPaymentAgendaCommand(text,d,today),null,text);
assert.equal(routeCommand('Kime ödeme\nyapacağım?',d,today),null);
const report=paymentCSV([{...get('overdue'),name:'=HYPERLINK("bad")',description:'line\nline'}]);assert.ok(report.startsWith('\uFEFF'));assert.ok(report.includes("\"'=HYPERLINK"));assert.ok(report.includes('"750.15"'));
const reversed=Object.fromEntries(Object.entries(d).map(([k,rows])=>[k,[...rows].reverse()]));assert.deepEqual(paymentAgenda(reversed,{today}).rows,plan.rows);
assert.equal(JSON.stringify(d),before,'read-only model does not change bills/payments/instruments');
assert.throws(()=>paymentAgenda(d,{today:'2026-02-30'}),/geçerli/);
assert.equal(paymentAgenda({},{today}).rows.length,0);
console.log('payment agenda: linked partial payments, dates, future entries, source party, uncertain/cancelled/closed data, cheques, cents, local commands, CSV and no writes PASS');

import assert from 'node:assert/strict';
import {financeWorkspaceTasks,financeToolHTML} from '../js/finance-workspace.js';
const today='2026-11-09',from='2026-11-01',to=today;
const d={cash_records:[{id:'TEST_HAND',cash_type:'Müşteriden Para Alındı',cash_status:'TESLIM_BILDIRILDI',amount:20,date:today},{id:'TEST_FUTURE',cash_type:'Müşteriden Para Alındı',cash_status:'TESLIM_BILDIRILDI',amount:999,date:'2026-11-10'}],customers:[],work_records:[],hakedis:[{id:'TEST_H',status:'Taslak'}],suppliers:[{id:'TEST_S',name:'TEST Firma'}],payables:[{id:'TEST_B',party_type:'supplier',party_id:'TEST_S',date:'2026-11-01',due_date:'2026-11-08',gross_total:100,status:'Onaylandı'}],supplier_payments:[]};
const before=structuredClone(d),tasks=financeWorkspaceTasks(d,{today,from,to,summary:{unpriced:2}});
assert.equal(tasks[0].key,'price');assert.equal(tasks[1].key,'handover');assert.match(tasks[1].title,/^1 teslim/);assert.match(tasks[1].why,/onayı değildir/);
assert.ok(tasks.some(t=>t.href==='#/alislar/TEST_B'&&t.why.includes('100,00')));
assert.ok(tasks.some(t=>t.key==='claims'&&t.why.includes('kesinleşmiş müşteri borcu değildir')));
assert.ok(tasks.every(t=>!('amount'in t)),'Triage must not invent a cash balance or initiate payment');
assert.deepEqual(d,before);
const noRecords=financeWorkspaceTasks({},{today,from,to,summary:{unpriced:0}});assert.equal(noRecords.length,0);
const invalid=structuredClone(d);invalid.payables[0].gross_total=null;const review=financeWorkspaceTasks(invalid,{today,from,to,summary:{unpriced:0}});assert.ok(review.some(t=>t.key==='pay-review'));assert.ok(!review.some(t=>t.href==='#/alislar/TEST_B'),'Unknown debt must not become a ready payment');
const html=financeToolHTML('#/bankalar','<img src=x onerror=alert(1)>','"bank"');assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('href="#/bankalar"'));
console.log('finance workspace106: source-based priorities, future exclusion, unposted draft/cash distinction, unknown debt, escaped tools and read-only data PASS');

const ordered={...d,cash_records:[],hakedis:[],payables:[{...d.payables[0],id:"TEST_A_LATER",due_date:"2026-11-08"},{...d.payables[0],id:"TEST_Z_OLDER",due_date:"2026-11-02"}]};
assert.deepEqual(financeWorkspaceTasks(ordered,{today,from,to,summary:{unpriced:0}}).map(t=>t.key),["payable:TEST_Z_OLDER","payable:TEST_A_LATER"],"Older due debts retain priority instead of sorting by random record IDs");

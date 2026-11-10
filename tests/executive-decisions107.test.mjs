import assert from 'node:assert/strict';
import {executiveHome,pendingCustomerCash,executiveHomeHTML} from '../js/executive-home.js';
import {cashForecast,forecastSummary} from '../js/cashflow-core.js';
const today='2026-11-10';
const d={customers:[{id:'TEST_C',name:'TEST Company'}],suppliers:[{id:'TEST_S',name:'TEST Supplier'}],
 work_records:[{id:'TEST_W',date:'2026-09-01',customer_id:'TEST_C',quantity:1,unit:'Saat',price_snapshot:{amount:1000,unit_price:1000,kdv_rate:20,kdv_included:false}}],
 cash_records:[{id:'TEST_BANK',date:today,cash_type:'Müşteriden Para Alındı',cash_status:'BANKADA',amount:20000},{id:'TEST_PERSON',date:today,cash_type:'Müşteriden Para Alındı',cash_status:'PERSONELDE',amount:10.25},{id:'TEST_REPORT',date:today,cash_type:'Müşteriden Para Alındı',cash_status:'TESLIM_BILDIRILDI',amount:20.5},{id:'TEST_FUTURE',date:'2026-11-11',cash_type:'Müşteriden Para Alındı',cash_status:'PERSONELDE',amount:999},{id:'TEST_PAID',date:today,cash_type:'Personele Ödeme',cash_status:'PERSONELDE',amount:999},{id:'TEST_VOID',date:today,cash_type:'Müşteriden Para Alındı',cash_status:'PERSONELDE',amount:999,deleted_at:today}],
 payables:[{id:'TEST_DUE',date:today,due_date:'2026-11-11',party_type:'supplier',party_id:'TEST_S',gross_total:300,status:'Onaylandı'},{id:'TEST_LATER',date:today,due_date:'2026-12-11',party_type:'supplier',party_id:'TEST_S',gross_total:999,status:'Onaylandı'}]};
const original=structuredClone(d),cash={amount:100,date:today},m=executiveHome(d,{today,cash});
assert.deepEqual(pendingCustomerCash(d,today),{total:30.75,personnel:10.25,reported:20.5});
assert.equal(m.nearAmount,300);assert.equal(m.agedAmount,1000,'Owner optional-VAT policy: preclaim principal only');assert.equal(m.cash.current,true);assert.ok(m.tasks.length<=3);
assert.equal(executiveHome(d,{today,cash:{amount:100,date:'2026-11-09'}}).tasks[0].key,'cash-stale');
for(const cash of [null,{amount:'',date:today},{amount:100,date:'2026-11-11'},{amount:100,date:'2026-02-31'}])assert.equal(executiveHome(d,{today,cash}).cash,null);
const notes={TEST_C:{promise_date:'2026-11-11',promise_amount:1000}},f=cashForecast(d,{today,cashOnHand:100,notes});
assert.equal(f.weeks[0].bad,800);assert.equal(f.weeks[0].stress,-200,'Even promised inflows must be absent in the no-collection scenario');assert.equal(f.lowStress.amount,-1199);assert.equal(forecastSummary(f).haftalar[0].bakiye_tahsilat_yok,-200);
assert.equal(cashForecast(d,{today,notes}).start,null);assert.equal(cashForecast(d,{today,notes}).weeks[0].stress,null);assert.equal(cashForecast(d,{today,notes}).lowStress,null);assert.deepEqual(d,original,'Read-only decisions cannot alter records');
assert.ok(executiveHomeHTML(m).includes('Nakit beyanı banka mutabakatı değildir'));
console.log('PASS executive decisions: custody, dated cash, recorded due debts, net aging, no-collection stress and immutable sources');

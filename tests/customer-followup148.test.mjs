import assert from 'node:assert/strict';
import {customerDesk,customerDeskHtml} from '../js/customer-desk.js';
const date='2026-11-10',opts={from:'2026-11-01',to:'2026-11-28',today:'2026-11-28'};
const work=(id,site_id,extra={})=>({id,customer_id:'C',site_id,date,vehicle_id:'V'+id,work_type:'Makine Çalışması',quantity:2,unit:'Saat',price_snapshot:{unit_price:100,amount:200,kdv_rate:20,kdv_included:false},...extra});
const d={customers:[{id:'C'},{id:'SUB',parent_customer_id:'C'}],sites:[{id:'S1',customer_id:'C',name:'TEST <b> Site'},{id:'S2',customer_id:'C',name:'TEST Second'},{id:'SS',customer_id:'SUB'}],vehicles:[{id:'VA'},{id:'VB'},{id:'VX'},{id:'VM'}],work_records:[work('A','S1'),work('B','S2',{price_snapshot:null}),work('X','S1'),work('M','S2'),work('SUB','SS',{customer_id:'SUB'})],hakedis:[{id:'H',customer_id:'C',date,status:'Taslak',items:[{work_record_id:'X'},{work_record_id:'M'}]}]};
const before=JSON.stringify(d),one=customerDesk(d,'C',{...opts,site_id:'S1'}),two=customerDesk(d,'C',{...opts,site_id:'S2'});
assert.equal(one.counts.ready,1);assert.equal(one.counts.missing,0);assert.equal(one.counts.claimed,1);assert.equal(two.counts.ready,0);assert.equal(two.unpriced.length,1);assert.equal(two.drafts.length,1);assert.equal(one.drafts.length,1);assert.equal(one.groups.ready[0].work.id,'A');assert.equal(new URLSearchParams(one.preparation.split('?')[1]).get('site_id'),'S1');assert.throws(()=>customerDesk(d,'C',{...opts,site_id:'SS'}),/Şantiye/);
const account={customer:{id:'C'},balanceNow:1000,statement:{collected:50}},notes={C:{promise_date:'2026-11-29',promise_amount:900,note:'PRIVATE_NOTE'}};
for(const site_id of ['S1','S2']){const h=customerDeskHtml(d,'C',{...opts,site_id,account,notes});assert.match(h,/1.000,00/);assert.match(h,/50,00/);assert.match(h,/900,00/);assert.match(h,/tahsilat değildir/);assert(!h.includes('PRIVATE_NOTE'));assert(!h.includes('data-followup-work="SUB"'));assert.match(h,/başka şantiyeleri de içerebilir/);}
assert(!customerDeskHtml(d,'C',{...opts,account:{...account,customer:{id:'SUB'}}}).includes('data-followup-account'));
const unknown=customerDeskHtml(d,'C',{...opts,account:{...account,balanceNow:null,statement:{collected:null}}});assert.match(unknown,/Doğrulanamadı/);assert.equal(JSON.stringify(d),before);
console.log('customer followup148 PASS: exact site/period and debtor, mixed draft reservation, scoped URLs, no allocation of receipt/promise, unknown not zero, no private note and no writes');

const canonical={...d,hakedis:[{id:'LEGACY_DATE',customer_id:'C',created_date:date,status:'Taslak',items:[]}]};assert.equal(customerDesk(canonical,'C',opts).drafts.length,1);assert.match(customerDeskHtml(canonical,'C',opts),/10.11.2026/);

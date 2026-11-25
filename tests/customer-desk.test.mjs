import assert from 'node:assert/strict';
import {customerDesk,customerDeskHtml} from '../js/customer-desk.js';
const date='2026-11-10', opts={from:'2026-11-01',to:'2026-11-25',today:'2026-11-25'};
const work=(id,extra={})=>({id,customer_id:'C',date,vehicle_id:'V',work_type:'Makine Çalışması',quantity:2,unit:'Saat',price_snapshot:{unit_price:100,amount:200,kdv_rate:20,kdv_included:false},...extra});
const base=()=>({customers:[{id:'C',name:'TEST Customer'},{id:'SUB',parent_customer_id:'C'},{id:'O'}],vehicles:[{id:'V'}],work_records:[],hakedis:[]});
{
 const d=base();d.work_records=[work('W'),work('SUB',{customer_id:'SUB'}),work('O',{customer_id:'O'}),work('OLD',{date:'2026-10-01'})];
 const before=JSON.stringify(d),m=customerDesk(d,'C',opts);
 assert.equal(m.counts.ready,1);assert.equal(m.next,'ready');assert.equal(JSON.stringify(d),before);
 assert.equal(new URLSearchParams(m.reconciliation.split('?')[1]).get('customer_id'),'C');
 assert.equal(new URLSearchParams(m.preparation.split('?')[1]).get('date_from'),opts.from);
 assert.equal(customerDesk(d,'C',{...opts,from:''}).counts.ready,2);
}
{
 const d=base();d.work_records=[work('W')];d.hakedis=[{id:'H',customer_id:'C',date:'2026-11-11',status:'Taslak',items:[{work_record_id:'W'}]}];
 let m=customerDesk(d,'C',opts);assert.equal(m.counts.claimed,1);assert.equal(m.counts.ready,0);assert.equal(m.next,'draft');
 d.cari_movements=[{customer_id:'C',type:'Tahsilat',amount:-9999}];m=customerDesk(d,'C',opts);assert.equal(m.drafts.length,1);assert.ok(!('paid' in m.claims[0]),'general credit must not manufacture claim payment');
 d.hakedis[0].status='İptal';m=customerDesk(d,'C',opts);assert.equal(m.counts.ready,1);assert.equal(m.claims.length,0);
}
{
 const d=base();d.work_records=[work('W',{price_snapshot:null})];assert.equal(customerDesk(d,'C',opts).next,'missing');
 d.work_records[0].date='';assert.equal(customerDesk(d,'C',opts).next,'review');
 d.work_records[0]=work('W',{price_snapshot:{amount:0,unit_price:0,price_source:'Sözleşmeye dahil'}});assert.equal(customerDesk(d,'C',opts).counts.agreement,1);
 assert.equal(customerDesk(d,'C',opts).counts.ready,0);
}
{
 const d=base();d.hakedis=[{id:'<unsafe>',customer_id:'C',date,status:'<script>TEST</script>'},{id:'deleted',customer_id:'C',date,deleted_at:'x'},{id:'OTHER',customer_id:'O',date}];
 const html=customerDeskHtml(d,'C',opts);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('OTHER'));
 assert.match(html,/PDF oluşturmak müşteri onayı değildir/);assert.match(html,/KDV yalnız hakedişte/);
 const before=JSON.stringify(d);customerDeskHtml(d,'C',opts);assert.equal(JSON.stringify(d),before);
}
console.log('customer desk PASS: exact scope, review priority, draft reservation, no inferred approval/payment/VAT, read-only and escaped output');

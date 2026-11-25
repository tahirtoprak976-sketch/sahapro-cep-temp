import assert from 'node:assert/strict';
import {commercialDesk,commercialRows} from '../js/commercial-desk-core.js';
import {commercialRowHTML} from '../js/commercial-desk-ui.js';
const today='2026-11-25',scope={from:'2026-11-01',to:today,today};
const work=(id,customer_id,extra={})=>({id,customer_id,date:'2026-11-10',vehicle_id:'V',work_type:'Makine Çalışması',unit:'Saat',quantity:1,price_snapshot:{unit_price:1000,amount:1000,kdv_rate:20,kdv_included:false},...extra});
const data=()=>({customers:[{id:'P',name:'TEST Parent'},{id:'C',name:'TEST Child',parent_customer_id:'P'},{id:'N',name:'TEST Missing'},{id:'I',name:'TEST Internal',internal:true},{id:'Z',name:'TEST Empty'}],vehicles:[{id:'V'}],work_records:[],hakedis:[],cari_movements:[]});
{
 const d=data();d.work_records=[work('W','C'),work('PW','P',{quantity:2,price_snapshot:{unit_price:250,amount:500,kdv_rate:20,kdv_included:false}}),work('M','N',{price_snapshot:null}),work('IW','I')];
 const before=JSON.stringify(d),m=commercialDesk(d,scope),c=m.rows.find(r=>r.customer.id==='C'),p=m.rows.find(r=>r.customer.id==='P');
 assert.equal(c.balance,1000,'KDV excluded work is not automatically grossed');assert.equal(p.balance,500,'child debt is never added to parent');assert.equal(c.parent.name,'TEST Parent');assert.equal(m.rows.find(r=>r.customer.id==='N').balance,0);assert.equal(m.counts.review,1);assert.equal(m.rows.length,3);assert.equal(JSON.stringify(d),before);
 d.hakedis=[{id:'H',customer_id:'C',date:'2026-10-01',status:'Taslak',items:[{work_record_id:'W'}]}];let r=commercialDesk(d,scope).rows.find(r=>r.customer.id==='C');assert.equal(r.counts.ready,0);assert.equal(r.drafts.length,1);assert.equal(r.balance,1000);assert.equal(r.next.href,'#/hakedis/H');
 d.hakedis[0].status='Kesinleşti';d.cari_movements=[{id:'HM',customer_id:'C',date:today,type:'Hakedis',amount:1200,ref_id:'H'},{id:'PAY',customer_id:'C',date:today,type:'Tahsilat',amount:-200}];r=commercialDesk(d,scope).rows.find(r=>r.customer.id==='C');assert.equal(r.balance,1000);assert.equal(r.drafts.length,0);assert.ok(!('paid' in r));
}
{
 const d=data();d.work_records=[work('W','C')];const notes={C:{promise_date:'2026-11-24',promise_amount:'999999'}};
 let m=commercialDesk(d,{...scope,notes}),r=m.rows[0];assert.equal(r.balance,1000);assert.equal(r.promise.late,true);assert.equal(m.counts.promises,1);
 notes.C.promise_date='2026-11-27';assert.equal(commercialDesk(d,{...scope,notes}).rows[0].promise.soon,true);
 notes.C.promise_date='2026-02-31';notes.C.promise_amount='wrong';r=commercialDesk(d,{...scope,notes}).rows[0];assert.equal(r.promise.review,true);assert.equal(r.promise.amount,null);assert.match(commercialRowHTML(r),/geçersiz/);
 d.cari_movements=[{customer_id:'C',type:'Tahsilat',amount:-1000}];notes.C={promise_date:'2026-11-01'};r=commercialDesk(d,{...scope,notes}).rows[0];assert.equal(r.balance,0);assert.equal(r.promise.late,false,'settled account must not be described as broken promise');assert.match(commercialRowHTML(r),/güncelliğini kontrol/);
}
{
 const d=data();d.work_records=[work('F','C',{customer_fuel_allowance_l:75,price_snapshot:{price_source:'Mazot karşılığı',amount:0,unit_price:0,kdv_rate:0}}),work('OLD','P',{date:'2026-10-01'}),work('ORPHAN',null),work('INVALID','deleted-customer',{date:''})];
 const m=commercialDesk(d,scope);assert.equal(m.rows.find(r=>r.customer.id==='C').counts.agreement,1);assert.equal(m.rows.find(r=>r.customer.id==='C').balance,0);assert.equal(m.rows.find(r=>r.customer.id==='P').counts.ready,0);assert.equal(m.rows.find(r=>r.customer.id==='P').balance,1000);assert.equal(m.unassigned.length,2);
 assert.equal(commercialRows(m,{status:'agreement'}).length,1);assert.equal(commercialRows(m,{q:'Child'}).length,1);assert.equal(commercialRows(m,{status:'receivable'}).length,1);
}
{
 const d=data();d.work_records=[work('A','C',{slip_no:'TEST TICKET'}),work('B','P',{slip_no:'TEST-TICKET',quantity:2,price_snapshot:{unit_price:500,amount:1000,kdv_rate:20,kdv_included:false}})];
 assert.ok(commercialDesk(d,scope).rows.every(r=>r.counts.review===1),'global duplicate-ticket evidence must survive per-customer view');
 d.customers[1].name='<script>TEST</script>';assert.ok(!commercialRowHTML(commercialDesk(d,scope).rows.find(r=>r.customer.id==='C')).includes('<script>'));
 assert.throws(()=>commercialDesk(d,{...scope,to:'2026-11-26'}),/dönem/);
}
console.log('commercial desk130 PASS: exact debtor, VAT policy, draft reservations, promises not money, invalid amounts, liters separate, cross-customer duplicates, orphan visibility, read-only');

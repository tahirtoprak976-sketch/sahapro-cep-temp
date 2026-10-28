import assert from 'node:assert/strict';
import {hakedisPreparation,preparationURL} from '../js/hakedis-preparation.js';
const scope={customer_id:'C',from:'2026-09-01',to:'2026-09-30',today:'2026-10-28'};
const price={unit_price:1000,amount:1000,kdv_rate:20,kdv_included:false};
const work=(id,extra={})=>({id,date:'2026-09-07',customer_id:'C',vehicle_id:'V',work_type:'Makine Çalışması',unit:'Saat',quantity:1,description:id,price_snapshot:{...price},...extra});
const data=()=>({customers:[{id:'C',name:'TEST Taşeron',parent_customer_id:'P'},{id:'P',name:'TEST Ana Firma'},{id:'O',name:'TEST Başka'}],sites:[{id:'S',customer_id:'C',name:'TEST şantiye'}],vehicles:[{id:'V',plate:'34TST627'}],work_records:[],hakedis:[],documents:[],fuel_records:[],fuel_tank_movements:[]});
const review=d=>hakedisPreparation(d,scope);
{
 const d=data();d.work_records=[work('W')];const before=JSON.stringify(d),r=review(d);
 assert.deepEqual(r.counts,{ready:1,missing:0,review:0,agreement:0,claimed:0});assert.deepEqual([r.totals.subtotal,r.totals.kdv,r.totals.grand],[1000,200,1200]);assert.equal(JSON.stringify(d),before);
 d.work_records[0].price_snapshot={...price,unit_price:1200,amount:1200,kdv_included:true};assert.equal(review(d).totals.grand,1200);
 d.work_records[0].price_snapshot={...price,unit_price:0,amount:0,kdv_rate:0};assert.equal(review(d).counts.ready,1);assert.equal(review(d).totals.grand,0);
}
{
 const d=data();d.work_records=[work('NO_PRICE',{price_snapshot:null})];d.price_book=[{price:9000,customer_id:'C'}];assert.equal(review(d).counts.missing,1);assert.equal(review(d).totals,null);assert.equal(d.work_records[0].price_snapshot,null);
 d.work_records[0].price_snapshot={unit_price:1000,amount:1000};assert.equal(review(d).counts.missing,1,'unknown VAT is not 20 by inference');
 d.work_records[0].price_snapshot={...price,amount:2500,formula:'CRANE_FIRST_HOUR',unit_price:null,first_hour_price:2000,next_hour_price:500};d.work_records[0].quantity=2;assert.equal(review(d).totals.grand,3000);
}
{
 const d=data();d.work_records=[work('W',{work_type:'Moloz Nakliye',unit:'Sefer',quantity:2,price_snapshot:{...price,amount:2000}})];assert.equal(review(d).counts.missing,1);
 d.documents=[{id:'D1',category:'Döküm Fişi',owner_type:'work',owner_id:'W',doc_no:'A-1'},{id:'D2',category:'Döküm Fişi',owner_type:'work',owner_id:'W',doc_no:'A-2'}];
 assert.equal(review(d).counts.ready,1);d.work_records[0].slip_no='a 1';assert.equal(review(d).ready[0].ticketCount,2,'work number and attached document are one ticket');
 d.documents[0].date='2026-09-08';assert.equal(review(d).counts.review,1,'different document/work date requires review');delete d.documents[0].date;
 d.documents[0].ticket_vehicle_id='OTHER';assert.equal(review(d).counts.review,1,'wrong document vehicle is not ready');delete d.documents[0].ticket_vehicle_id;
 d.documents[1].deleted_at='x';assert.equal(review(d).counts.missing,1);
 d.documents[1].deleted_at=null;d.documents[1].doc_no='a 1';assert.equal(review(d).counts.review,1,'same normalized ticket twice is review');
 d.documents[1].doc_no='A-2';d.documents[0].work_record_id='OTHER';assert.equal(review(d).counts.review,1,'contradictory ownership is not ready');
}
{
 const d=data();d.work_records=[work('W'),work('DUP')];assert.equal(review(d).counts.review,2,'same day/vehicle/quantity is possible duplicate, not automatic deletion');
 d.work_records[1].deleted_at='x';assert.equal(review(d).counts.ready,1);
 d.work_records.push(work('OTHER',{customer_id:'O',slip_no:'a 133427'}));d.work_records[0].slip_no='A-133427';assert.equal(review(d).counts.review,1,'other work with same ticket is visible but not silently assigned');
}
{
 const d=data();d.work_records=[work('CHILD'),work('PARENT',{customer_id:'P'}),work('OTHER',{customer_id:'O'}),work('OLD',{date:'2026-08-31'}),work('UNDATED',{date:''}),work('BAD',{date:'2026-09-31'})];
 const r=review(d);assert.equal(r.ready.length,1);assert.deepEqual(r.review.map(x=>x.work.id).sort(),['BAD','UNDATED']);assert.ok(r.review.every(x=>x.undated));
 d.work_records[0].site_id='S';assert.equal(hakedisPreparation(d,{...scope,site_id:'S'}).ready.length,1);assert.throws(()=>hakedisPreparation(d,{...scope,site_id:'OTHER'}),/Şantiye/);
}
{
 const d=data();d.work_records=[work('W')];d.hakedis=[{id:'H',customer_id:'C',status:'Taslak',items:[{work_record_id:'W'}]}];assert.equal(review(d).counts.claimed,1);assert.equal(review(d).counts.ready,0);
 d.work_records[0].price_snapshot={unit_price:1200,amount:1000,kdv_rate:20,kdv_included:true,locked:true};d.hakedis[0].status='Kesinleşti';
 assert.equal(review(d).claimed[0].issues.length,0,'already claimed legacy net snapshot is not reinterpreted as an unclaimed input tariff');
 d.work_records[0].price_snapshot=null;assert.equal(review(d).claimed[0].missing.some(x=>/fiyat/i.test(x)),false,'a frozen/manual claim can have an unpriced original work');
 d.work_records[0].price_snapshot={...price};
 d.hakedis.push({id:'BAD',customer_id:'O',status:'Taslak',items:[{work_record_id:'W'}]});assert.equal(review(d).counts.review,1,'conflicting claim ownership belongs in the review list');d.hakedis.pop();
 d.hakedis[0].status='İptal';assert.equal(review(d).counts.ready,1);d.work_records[0].price_snapshot.locked=true;assert.equal(review(d).counts.review,1,'orphan lock is not a free new claim');
}
{
 const d=data();d.work_records=[work('F',{price_snapshot:{unit_price:0,amount:0,kdv_rate:0,price_source:'Mazot karşılığı'},customer_fuel_allowance_l:150}),work('INCLUDED',{quantity:2,price_snapshot:{unit_price:0,amount:0,kdv_rate:0,price_source:'Sözleşmeye dahil'}}),work('CASH',{quantity:3,price_snapshot:{...price,amount:3000}})];
 d.work_records.push(work('OPEN',{date:'2026-08-15',customer_fuel_allowance_l:100}));
 d.fuel_records=[{id:'PRE',date:'2026-08-20',customer_id:'C',fuel_source:'Müşteri Verdi',liters:40},{id:'IN',date:'2026-09-12',customer_id:'C',fuel_source:'Müşteri Verdi',liters:80},{id:'FUTURE',date:'2026-10-05',customer_id:'C',fuel_source:'Müşteri Verdi',liters:999}];
 d.fuel_tank_movements=[{id:'T',date:'2026-09-15',customer_id:'C',move_type:'GİRİŞ',liters:20}];const r=review(d);
 assert.equal(r.counts.agreement,2);assert.equal(r.counts.ready,1);assert.equal(r.totals.grand,3600);assert.deepEqual([r.fuel.opening,r.fuel.earned,r.fuel.received,r.fuel.closing],[60,150,100,110]);
 d.fuel_records.push({id:'BAD',date:'',customer_id:'C',fuel_source:'Müşteri Verdi',liters:20});assert.equal(review(d).fuel.closing,null);assert.equal(review(d).fuel.incomplete,true);
}
{
 const d=data();d.work_records=[work('F',{price_snapshot:{unit_price:0,amount:0,kdv_rate:0,price_source:'Mazot karşılığı'}})];
 assert.equal(review(d).counts.review,1,'missing fuel entitlement is not a completed agreement');
 assert.equal(review(d).fuel.hasRecords,true);assert.equal(review(d).fuel.opening,null);assert.equal(review(d).fuel.earned,null);assert.equal(review(d).fuel.received,null);assert.equal(review(d).fuel.closing,null,'unknown entitlement must not become zero or a false fuel advance');
 d.work_records[0].customer_fuel_allowance_l=75;d.work_records[0].price_snapshot.amount=1000;assert.equal(review(d).counts.review,1,'non-TL label with a positive monetary charge needs review');
}
{
 const d=data();d.work_records=[work('W',{vehicle_id:'DELETED'})];assert.equal(review(d).counts.missing,1);
 d.work_records[0]=work('W',{quantity:2});assert.equal(review(d).counts.review,1,'stored amount mismatch is reviewed, not silently recomputed');
 d.work_records[0]=work('W',{site_id:'WRONG'});assert.equal(review(d).counts.review,1);
 assert.throws(()=>hakedisPreparation(d,{...scope,customer_id:'NONE'}),/müşteri/);assert.throws(()=>hakedisPreparation(d,{...scope,to:'2027-01-01'}),/tarih/);assert.throws(()=>hakedisPreparation(d,{...scope,from:'2026-10-01'}),/tarih/);
 const href=preparationURL('new',scope,{ready_only:'1'});assert.match(href,/ready_only=1/);assert.match(href,/customer_id=C/);
}
{
 const d=data(),p={unit_price:6e13,amount:6e13,kdv_rate:20,kdv_included:false};d.work_records=[work('BIG1',{work_type:'Kazı',price_snapshot:p}),work('BIG2',{work_type:'Yükleme',price_snapshot:p})];
 assert.equal(review(d).counts.ready,0);assert.equal(review(d).counts.review,2);assert.equal(review(d).totals,null,'unsafe aggregate total is never a ready monetary claim');
}
console.log('hakedis-preparation PASS: scoped readiness, unknown vs zero, VAT/crane, real ticket links, duplicates, claims, agreements, period fuel and read-only data');

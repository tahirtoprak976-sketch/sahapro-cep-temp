import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cards,cases,replay} from './assistant-gold/replay.mjs';
import {validatePlan,validateExtras} from '../js/assistant-core.js';
import {mergeTicketsIntoWorks} from '../js/assistant-docs.js';
import {bulkWorkReady} from '../js/assistant-batch.js';
const today='2026-11-02';
for(const category of ['a','b','c','d','e'])test('finans kartı '+category+' doğrulamada daima işaretsiz',()=>{
 for(const c of cases.filter(c=>c.expectedCards.some(e=>e.mandatoryUnchecked===category))){
  const rows=replay(c).actual;
  c.expectedCards.forEach((e,i)=>{if(e.mandatoryUnchecked===category){assert.equal(rows[i].checked,false,c.id);}});
 }
});
const work={customer_id:'TEST_C',vehicle_id:'TEST_V',work_type:'Makine Çalışması',quantity:2,unit:'Saat'};
test('gerçek müşteri belirsizliği fiyatı boşaltır, kartı kapatır ve bir kez sorar',()=>{
 const message='Alfa İnşaat ve Beta Hafriyat için JCB 3CX 2 saat çalıştı, saat fiyatı 2500 TL';
 const v=validatePlan({works:[{...work,unit_price:2500}]},{message,d:cards,today});const r=v.works[0];
 assert.equal(r.unit_price,null);assert.equal(r.ok,false);assert.equal(r.priceUncertain,true);
 assert.deepEqual(v.questions,['2.500 TL bu işin birim fiyatı mı?']);
 assert.equal(bulkWorkReady({kind:'work'},{...r,ok:true,ambiguous:null,_workflowCompleted:true}),false);
 // Fiş birim fiyat sahibini doğrulamaz: fiş birleştirmesi işaretlemeyi geri açamaz.
 r.ambiguous=null;
 const merged=mergeTicketsIntoWorks({...v,tickets:[{ok:true,link:'work:0',photo:0,date:today,vehicle_id:'TEST_V',ticket_no:'TEST-99'}]},{d:cards,photoCount:1});
 assert.equal(merged.works[0].ok,false);
});
test('kayıtlı fiyat belirsiz mesaj fiyatını sessizce geçersiz kılamaz',()=>{
 const d={...cards,price_book:[{id:'TEST_PRICE',unit:'Saat',price:900,active:true}]};
 const v=validatePlan({works:[{...work,unit_price:2500}]},{message:'Alfa İnşaat ve Beta Hafriyat için JCB 3CX 2 saat, saat fiyatı 2500 TL',d,today});
 assert.equal(v.works[0].ok,false);assert.equal(v.works[0].unit_price,null);assert.equal(v.questions.length,1);
});
test('Alt firma (Ana firma) kayıt bağlantısı, yanlış ana firma önerisini engeller',()=>{
 const message='Çatıcı (Ulaş Rondela) JCB 3CX 2 saat çalıştı';
 const r=validatePlan({works:[{...work,customer_id:'TEST_PARENT'}]},{message,d:cards,today}).works[0];
 assert.equal(r.ok,false);assert.equal(r.customer_id,'TEST_SUB');assert.equal(r.suggested_customer_id,'TEST_SUB');assert.equal(r.parentMismatch,true);
 assert.match(r.issues.join(),/Çatıcı/);
 const correct=validatePlan({works:[{...work,customer_id:'TEST_SUB'}]},{message,d:cards,today}).works[0];
 assert.equal(correct.customer_id,'TEST_SUB');assert.equal(correct.ok,true);
 const unlinked=validatePlan({works:[{...work,customer_id:'TEST_PARENT'}]},{message,d:{...cards,customers:cards.customers.map(c=>({...c,parent_customer_id:null}))},today}).works[0];
 assert.notEqual(unlinked.suggested_customer_id,'TEST_SUB','kayıt bağlantısı olmadan otomatik yön değişmez');
});
test('normal petrolcü ve personelin parasal olmayan puantajı kendi kontrollerini korur',()=>{
 const v=validatePlan({tank_in:[{liters:100,total:5000}]},{d:cards,today,message:'Yıldız Petrol depoya 100 litre mazot verdi, toplam 5000 TL'});
 assert.equal(v.tankIn[0].ok,true);
 const r=validateExtras({personnel:[{personnel_id:'TEST_P',event_type:'Çalıştı',hours_days:1}]},{d:cards,today,message:'Soner Kaya 1 gün çalıştı'}).personnel[0];assert.equal(r.ok,true);
});

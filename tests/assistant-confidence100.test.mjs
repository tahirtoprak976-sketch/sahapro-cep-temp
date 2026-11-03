import {bulkWorkReady} from '../js/assistant-batch.js';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validatePlan,validateExtras} from '../js/assistant-core.js';
import {cards,cases,replay,measure,gate,confidenceCases} from './assistant-gold/replay.mjs';
const today='2026-11-02',message='02.11.2026 JCB 3CX 2 saat çalıştı';
const work={date:today,vehicle_id:'TEST_V',work_type:'Makine Çalışması',quantity:2,unit:'Saat'};
const previous={id:'TEST_W',date:today,customer_id:'TEST_C',vehicle_id:'TEST_V',work_type:'Makine Çalışması',quantity:1,unit:'Saat'};
const row=(d,text=message,extra={})=>validatePlan({works:[{...work,...extra}]},{message:text,d,today}).works[0];
test('aynı gün aynı aracın tek işi: müşteri çıkarımla dolu ve işaretli',()=>{
 const d={...cards,work_records:[previous]},before=JSON.stringify(d),r=row(d);
 assert.equal(r.customer_id,'TEST_C');assert.equal(r.ok,true);assert.equal(r.customerGuess,false);
 assert.equal(r.fieldConfidence?.customer_id?.level,'CIKARIM');assert.equal(r.fieldConfidence?.customer_id?.source,'vehicle_day');assert.match(r.fieldConfidence.customer_id.reason,/tek/);assert.equal(JSON.stringify(d),before);
});
test('tek şantiye sahibi: müşteri çıkarımla, şantiye kesin dolu',()=>{
 const r=row(cards,'02.11.2026 Kuzey Şantiyesi JCB 3CX 2 saat çalıştı');
 assert.equal(r.customer_id,'TEST_C');assert.equal(r.site_id,'TEST_SITE');assert.equal(r.ok,true);assert.equal(r.fieldConfidence?.customer_id?.level,'CIKARIM');assert.equal(r.fieldConfidence?.site_id?.level,'KESIN');
});
test('fuzzy ad ve üç günlük geçmiş aynı günün tek işi yerine geçmez',()=>{
 for(const works of [[{...previous,date:'2026-11-01'}],[previous,{...previous,id:'TEST_W2'}],[previous,{...previous,id:'TEST_W2',customer_id:'TEST_B'}]]){
  const r=row({...cards,work_records:works});assert.equal(r.ok,false);assert.equal(r.fieldConfidence?.customer_id?.level,'BILINMIYOR');
 }
});
test('iki gerçek şantiye sahibi veya müşteri arasında sessiz seçim yok',()=>{
 const d={...cards,sites:[...cards.sites,{id:'TEST_S2',name:'Kuzey Şantiyesi',customer_id:'TEST_B'}]};const r=row(d,'02.11.2026 Kuzey Şantiyesi JCB 3CX 2 saat çalıştı');assert.equal(r.ok,false);assert.equal(r.fieldConfidence?.customer_id?.level,'BILINMIYOR');
 const twin=row(cards,'02.11.2026 Ortak Yapı JCB 3CX 2 saat çalıştı',{customer_id:'TEST_TWIN1'});assert.equal(twin.ok,false);assert.equal(twin.fieldConfidence?.customer_id?.value,null);
});
test('bilinmeyen miktar kesinleşmez; modelin güven etiketi yetki değildir',()=>{
 const r=row(cards,'02.11.2026 Alfa İnşaat JCB 3CX çalıştı',{customer_id:'TEST_C',fieldConfidence:{quantity:{level:'KESIN',value:2}}});
 assert.equal(r.ok,false);assert.equal(r.fieldConfidence?.quantity?.level,'BILINMIYOR');assert.equal(r.fieldConfidence?.quantity?.value,null);
});
test('kayıtlı fiyat salt okunur kesin bilgi; manuel fiyat ve KDV yolu değiştirilmez',()=>{
 const d={...cards,price_book:[{id:'TEST_PRICE',customer_id:'TEST_C',unit:'Saat',price:2500,kdv_rate:0,kdv_included:true,active:true}]};
 const r=row(d,'02.11.2026 Alfa İnşaat JCB 3CX 2 saat çalıştı',{customer_id:'TEST_C'});assert.equal(r.unit_price,null);assert.equal(r.fieldConfidence?.effective_unit_price?.value,2500);assert.equal(r.fieldConfidence?.effective_unit_price?.level,'KESIN');assert.equal(r.priceInfo.candidates[0].kdv_rate,0);assert.equal(r.priceInfo.candidates[0].kdv_included,true);
});
test('para belirsizliği, yanlış ana firma ve beş finansal onay sınıfı açılmaz',()=>{
 for(const c of cases.filter(c=>c.expectedCards.some(e=>e.mandatoryUnchecked)||['work-parent-wrong','work-real-price-ambiguity','work-price-owned-by-other'].includes(c.id)))for(const [i,r]of replay(c).actual.entries())if(c.expectedCards[i]?.mandatoryUnchecked||c.expectedCards[i]?.checked===false)assert.equal(r.checked,false,c.id);
});

test('gerçek müşteri adayları tarihçeyle sessizce elenmez',()=>{
 const d={...cards,work_records:[previous],aliases:[{id:'TEST_A1',alias:'Alfacı',target_type:'customer',target_id:'TEST_C'},{id:'TEST_A2',alias:'Alfacı',target_type:'customer',target_id:'TEST_B'}]};
 const r=row(d,'02.11.2026 Alfacı JCB 3CX 2 saat çalıştı',{customer_id:'TEST_C',customer_guess:true});assert.equal(r.ok,false);assert.equal(r.fieldConfidence.customer_id.level,'BILINMIYOR');
 const sites={...cards,work_records:[previous],sites:[...cards.sites,{id:'TEST_S2',name:'Kuzey Şantiyesi',customer_id:'TEST_B'}]};assert.equal(row(sites,'02.11.2026 Kuzey Şantiyesi JCB 3CX 2 saat çalıştı').ok,false);
});
test('modelin yanlış birimi ve birden çok para kuralı işaretlenmez',()=>{
 const r=row(cards,'02.11.2026 Alfa İnşaat JCB 3CX 2 saat çalıştı',{customer_id:'TEST_C',unit:'Sefer'});assert.equal(r.ok,false);assert.equal(r.fieldConfidence.unit.value,null);
 const d={...cards,price_book:[{id:'TEST_P1',unit:'Saat',price:2500,active:true},{id:'TEST_P2',unit:'Saat',price:3000,active:true}]};const p=row(d,'02.11.2026 Alfa İnşaat JCB 3CX 2 saat çalıştı',{customer_id:'TEST_C'});assert.equal(p.ok,false);assert.equal(p.fieldConfidence.effective_unit_price,undefined);
});

test('fiş tutarı kesin olsa da adı olmayan esnaf otomatik borç önerisi değildir',()=>{
 const v=validatePlan({photo_texts:['LASTİK TOPLAM 500 TL'],expenses:[{amount:500,category:'Lastik',photo:0,credit:true,supplier_id:'TEST_SUP'}]},{message:'Lastik fişi',d:cards,today,photoCount:1}).expenses[0];
 assert.equal(v.amount,500);assert.equal(v.okData,true);assert.equal(v.ok,false);assert.equal(v.fieldConfidence.supplier_id.level,'BILINMIYOR');
});

test('onaylı çok kelimeli takma ad yeni müşteri sanılmaz',()=>{
 const d={...cards,aliases:[{id:'TEST_A',alias:'Demir Kardeşler',target_type:'customer',target_id:'TEST_C',active:true,confirmed:true}]};const r=row(d,'02.11.2026 Demir Kardeşler JCB 3CX 2 saat çalıştı',{customer_id:'TEST_C',customer_guess:true});assert.equal(r.ok,true);assert.equal(r.fieldConfidence.customer_id.level,'KESIN');
});
test('tek açık iş şantiyesi çıkarımdır; kapalı ve çoklu işler sessiz seçilmez',()=>{
 const site=(id,status)=>({id,name:id,customer_id:'TEST_C',deal:{status,start_date:'2026-01-01',basis:'Sefer',price:500,kdv_rate:0,kdv_included:true}});
 const text='02.11.2026 Alfa İnşaat JCB 3CX 2 saat çalıştı';
 const one=row({...cards,sites:[site('TEST_OPEN','Açık'),site('TEST_CLOSED','Kapandı')]},text,{customer_id:'TEST_C'});
 assert.equal(one.site_id,'TEST_OPEN');assert.equal(one.fieldConfidence.site_id.level,'CIKARIM');assert.equal(one.fieldConfidence.site_id.source,'open_job');
 const many=row({...cards,sites:[site('TEST_OPEN','Açık'),site('TEST_OPEN2','Açık')]},text,{customer_id:'TEST_C'});assert.equal(many.site_id,null);
 const closed=row({...cards,sites:[site('TEST_CLOSED','Kapandı')]},text,{customer_id:'TEST_C'});assert.equal(closed.site_id,null);
});
test('alıntının dışındaki ortak tarih ve yıl yazılmayan satır bağlamı kaybolmaz',()=>{
 const quote='Alfa İnşaat JCB 3CX 2 saat çalıştı';
 const exact=row(cards,'02.11.2026 '+quote,{customer_id:'TEST_C',quote});assert.equal(exact.fieldConfidence.date.level,'KESIN');assert.equal(exact.fieldConfidence.date.value,today);
 const partial=row(cards,'[22/10 18:00] Şoför: '+quote,{customer_id:'TEST_C',date:'2026-10-22',quote});assert.equal(partial.fieldConfidence.date.level,'CIKARIM');assert.equal(partial.fieldConfidence.date.value,'2026-10-22');
 const named=row(cards,'22 Ekim Perşembe '+quote,{customer_id:'TEST_C',date:'2026-10-22',quote});assert.equal(named.fieldConfidence.date.level,'CIKARIM');
 const conflict=row(cards,'[22/10 18:00] Şoför: '+quote,{customer_id:'TEST_C',date:'2026-10-21',quote});assert.equal(conflict.fieldConfidence.date.level,'BILINMIYOR');assert.equal(conflict.ok,false);
});
test('açık toplu tarih WhatsApp başlığını geçer; çıkarımlı tarih süreli para kuralını kesinleştirmez',()=>{
 const quote='Alfa İnşaat JCB 3CX 2 saat çalıştı';
 const batch=row(cards,'Bütün işler 7 Eylül 2026 tarihine ait. Fiyatlar beklesin.\n[5/9 18:00] Şoför: '+quote,{customer_id:'TEST_C',date:'2026-09-05',quote});assert.equal(batch.date,'2026-09-07');assert.equal(batch.fieldConfidence.date.level,'KESIN');assert.equal(batch.price_pending,true);
 const partial=row({...cards,price_book:[{id:'TEST_TIMED',customer_id:'TEST_C',unit:'Saat',price:2500,active:true,valid_from:'2026-10-01',valid_to:'2026-10-31'}]},'22 Ekim '+quote,{customer_id:'TEST_C',date:'2026-10-22',quote});assert.equal(partial.fieldConfidence.date.level,'CIKARIM');assert.equal(partial.fieldConfidence.effective_unit_price,undefined);assert.equal(partial.unit_price,null);
});
test('satırdaki açık 20 saat makine koduyla karışmaz; kanıtsız sayı kesinleşmez',()=>{
 const text='02.11.2026 Alfa İnşaat JCB 3CX 20 saat çalıştı';const r=row(cards,text,{customer_id:'TEST_C',quantity:20,quote:'Alfa İnşaat JCB 3CX 20 saat çalıştı'});assert.equal(r.fieldConfidence.quantity.value,20);assert.equal(r.fieldConfidence.quantity.level,'KESIN');assert.equal(r.guessed,false);
 const invented=row(cards,'02.11.2026 Alfa İnşaat JCB 3CX çalıştı',{customer_id:'TEST_C',quantity:20});assert.equal(invented.fieldConfidence.quantity.value,null);assert.equal(invented.ok,false);
});

test('on yeni tarih/fotoğraf/rakamlı araç sınavı: alanlar ve işaretler birebir doğru',()=>{
 const measured=measure(confidenceCases);assert.equal(confidenceCases.length,10);assert.ok(gate(measured));assert.deepEqual(measured.failures,[]);
});

test('eski WhatsApp başlığındaki dün gönderenin gününe göre hesaplanır',()=>{
 const r=row(cards,'[07/09/2026 18:00] Şoför: Dün Alfa İnşaat JCB 3CX 2 saat çalıştı',{customer_id:'TEST_C',date:today});assert.equal(r.ok,false);assert.equal(r.fieldConfidence.date.suggestedValue,'2026-09-06');
});

test('başka alan düzeltildiğinde Hazır seç bilinmeyen birimi otomatik onaylamaz',()=>{
 const r=row(cards,'02.11.2026 Alfa İnşaat JCB 3CX 2 saat çalıştı',{customer_id:'TEST_C',unit:'Sefer'}),edited={...r,_workflowCompleted:true};assert.equal(r.ok,false);assert.equal(bulkWorkReady({kind:'work'},edited),false);
 edited.fieldConfidence={...edited.fieldConfidence,unit:{value:'Saat',level:'KESIN',source:'user'}};assert.equal(bulkWorkReady({kind:'work'},edited),true);
});

test('tarihsiz alıntı mesajdaki tek ortak tarihi kaybetmez; çoklu tarih seçilmez',()=>{
 const quote='JCB 3CX depodan 40 litre mazot aldı',fuel={date:'2026-09-07',vehicle_id:'TEST_V',liters:40,source:'Depo Tankı',quote};
 const one=validatePlan({fuel:[fuel]},{d:cards,today,message:'7 Eylül 2026\n'+quote}).fuel[0];assert.equal(one.ok,true);assert.equal(one.fieldConfidence.date.value,'2026-09-07');assert.equal(one.dateUnsure,undefined);
 const two=validatePlan({fuel:[fuel]},{d:cards,today,message:'7 Eylül 2026\n8 Eylül 2026\n'+quote}).fuel[0];assert.equal(two.ok,false);assert.equal(two.fieldConfidence.date.level,'BILINMIYOR');
 const wrongToday=validatePlan({fuel:[{...fuel,date:today}]},{d:cards,today,message:'7 Eylül 2026\n8 Eylül 2026\n'+quote}).fuel[0];assert.equal(wrongToday.ok,false);
});
test('isteğe bağlı dolu ama doğrulanmamış esnaf önerisi de otomatik işaretlenmez',()=>{
 const r=validatePlan({expenses:[{date:today,amount:500,category:'Lastik',supplier_id:'TEST_SUP',credit:false}]},{d:cards,today,message:'02.11.2026 lastik 500 TL aldık'}).expenses[0];assert.equal(r.supplier_id,'TEST_SUP');assert.equal(r.fieldConfidence.supplier_id.level,'BILINMIYOR');assert.equal(r.ok,false);
});

test('çok gönderenli mesajda miktar/birimle tek eşleşen kayıtlı gönderen kesinleşir',()=>{
 const d={...cards,personnel:[{id:'TEST_P',name:'Mehmet Kaya',vehicle_id:'TEST_V'},{id:'TEST_P2',name:'Hasan Demir',vehicle_id:'TEST_TIR'}]};
 const r=row(d,'[02/11/2026 18:00] Mehmet Kaya: Alfa İnşaat 2 saat çalıştı\n[02/11/2026 19:00] Hasan Demir: Alfa İnşaat 1 saat çalıştı',{customer_id:'TEST_C',reporter:'Mehmet Kaya'});assert.equal(r.personnel_id,'TEST_P');assert.equal(r.fieldConfidence.personnel_id.level,'KESIN');assert.equal(r.fieldConfidence.personnel_id.source,'sender_row');assert.equal(r.ok,true);
});

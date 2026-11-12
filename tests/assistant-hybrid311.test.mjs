import assert from 'node:assert/strict';
import {buildHybridEnvelope,suppressResolvedQuestions,attachSourcePriorities,hybridReadRunner,fillReceiptReferences,secondaryReviewTriggers,recoverableSchemaError} from '../js/assistant-hybrid311.js';
const d={customers:[{id:'TEST_C',name:'Akasya Yapı'},{id:'TEST_PRIVATE',name:'İlgisiz Kayıt'}],sites:[{id:'TEST_S',name:'Koru Parsel',customer_id:'TEST_C'}],vehicles:[{id:'TEST_V',name:'Kazıcı 8',type:'JCB',assignee_id:'TEST_P'},{id:'TEST_V2',name:'İlgisiz makine'}],personnel:[{id:'TEST_P',name:'Salih',vehicle_id:'TEST_V'}],aliases:[],work_records:[{id:'TEST_OLD',customer_id:'TEST_PRIVATE',description:'TEST özel not'}],bank_accounts:[{id:'TEST_BANK',name:'TEST gizli hesap'}]};
const e=buildHybridEnvelope(d,'[12/11/2026 19:00] Salih: Koru Parsel 2 saat çalıştı','2026-11-12');assert.equal(e.data.customers.length,1);assert.equal(e.data.customers[0].id,'TEST_C');assert.equal(e.data.vehicles.length,1);assert.equal(e.data.work_records.length,0);assert.equal(e.data.bank_accounts.length,0);assert.ok(!JSON.stringify(e).includes('İlgisiz'));assert.ok(!JSON.stringify(e).includes('özel not'));
const f=(value,level='CIKARIM',source='source_context')=>({value,level,source});
const row={date:'2026-11-12',vehicle_id:'TEST_V',customer_id:'TEST_C',quantity:2,unit:'Saat',fieldConfidence:{date:f('2026-11-12'),vehicle_id:f('TEST_V'),customer_id:f('TEST_C'),quantity:f(2,'KESIN','message'),unit:f('Saat','KESIN','message')}};
const v={works:[row],fuel:[],questions:['Hangi araç?','Müşteri kim?','Tarih nedir?','Birim fiyatı ne kadar?']};assert.deepEqual(suppressResolvedQuestions(v).questions,['Birim fiyatı ne kadar?']);assert.equal(v.questions.length,4,'pure filtering never rewrites the original questions');
const conflict=structuredClone(v);conflict.works[0].dateConflict=true;assert.ok(suppressResolvedQuestions(conflict).questions.includes('Tarih nedir?'));
const unknown=structuredClone(v);unknown.works[0].fieldConfidence.vehicle_id=f(null,'BILINMIYOR','none');assert.ok(suppressResolvedQuestions(unknown).questions.includes('Hangi araç?'));
const financial={...v,collections:[{amount:null}]};assert.deepEqual(suppressResolvedQuestions(financial).questions,v.questions,'mixed financial question scope must stay explicit');
attachSourcePriorities(row);assert.equal(row.kaynak_onceligi.vehicle_id,2);assert.ok(!JSON.stringify(row).includes('kaynak_onceligi'));
row.fieldConfidence.vehicle_id=f('TEST_V','KESIN','user');attachSourcePriorities(row);assert.equal(row.kaynak_onceligi.vehicle_id,4);
console.log('hybrid context privacy, resolved-only questions, hard contradiction holds, ephemeral priority PASS');

const calls=[];const runner=hybridReadRunner(async(name,args)=>{calls.push({name,args});return {records:[{id:'TEST_FOUND'}]};},e,'Koru Parsel 2 saat');
assert.ok((await runner('find_records',{store:'customers',query:''})).error);assert.equal(calls.length,0);
await runner('find_records',{store:'sites',query:'Koru Parsel',limit:100});assert.equal(calls[0].args.limit,3);
assert.ok((await runner('get_records',{store:'customers',ids:['TEST_PRIVATE']})).error);await runner('get_records',{store:'sites',ids:['TEST_FOUND']});assert.equal(calls.length,2);
console.log('model reads limited to source candidates; unrelated enumeration/IDs denied PASS');

const pd={vehicles:[{id:'TEST_PLATE',plate:'34 AA 999'},{id:'TEST_OTHER',plate:'06 BB 888'}]};
const receipt={photo_texts:['Plaka: 34AA999 20 litre'],fuel:[{photo:0,vehicle_id:null,liters:20}]};
assert.equal(fillReceiptReferences(receipt,pd,1).fuel[0].vehicle_id,'TEST_PLATE');assert.equal(receipt.fuel[0].vehicle_id,null);
assert.equal(fillReceiptReferences(receipt,pd,0).fuel[0].vehicle_id,null);pd.vehicles.push({id:'TEST_DUP',plate:'34AA999'});assert.equal(fillReceiptReferences(receipt,pd,1).fuel[0].vehicle_id,null);
console.log('receipt plate resolved on phone only, photo association and duplicate-plate ambiguity protected PASS');

assert.equal(secondaryReviewTriggers({message:'20 bin aldık, 20 bin ödeyecek'}).length,1);
assert.equal(secondaryReviewTriggers({message:'20 bin aldık, kalan 5 bin ödeyecek'}).length,0);
assert.equal(secondaryReviewTriggers({message:'Hangi araç?',plan:{works:[{}]}}).length,0,'unknown fields alone cannot trigger another review');
assert.equal(secondaryReviewTriggers({plan:{documents:[{net:100,kdv:20,total:120}]}}).length,0);
assert.equal(secondaryReviewTriggers({plan:{documents:[{net:100,kdv:20,total:100}]}}).length,1);
assert.equal(recoverableSchemaError(Error('JSON yanıtı geçersiz')),true);assert.equal(recoverableSchemaError(Error('Bir seferde en fazla100satır')),false);
assert.equal(secondaryReviewTriggers({plan:{expenses:[{amount:100,invoice:{net:100,kdv:20,total:100}}]}}).length,1);
assert.equal(recoverableSchemaError(Error('Plan satır sınırı aşıldı: works')),true);
console.log('only schema, contradictory financial direction or receipt arithmetic trigger a second review PASS');

const {oneSecondaryRead}=await import('../js/assistant-resilience.js'),{assistantRequestScope}=await import('../js/ai-gemini.js');
const values={gemini_key:'TEST_KEY',gemini_model:'gemini-test-flash',gemini_model_list:['gemini-test-pro'],gemini_consent:true,gemini_daily_limit:2};let requests=0;
const db={metaGet:async k=>values[k],metaTxn:async(_keys,fn)=>{const r=fn(values);Object.assign(values,r.set);return r.result;},metaUpdate:async(k,fn)=>values[k]=fn(values[k])};
const scope=assistantRequestScope({fetchImpl:async()=>{requests++;return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({questions:['Ödeme gerçekten alındı mı?']})}]},finishReason:'STOP'}]}),{status:200});}});
try{const checked=await oneSecondaryRead(db,{parts:[{text:'TEST'}],system:'TEST',scope});assert.equal(checked.plan.questions.length,1);await assert.rejects(()=>oneSecondaryRead(db,{parts:[],scope}),/kullanıldı/);assert.equal(requests,1);}finally{scope.dispose();}
console.log('one secondary read shares original scope/budget and cannot be used twice PASS');

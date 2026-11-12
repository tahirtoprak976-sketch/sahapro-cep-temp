import assert from 'node:assert/strict';
import {strongModelCandidate,strongReviewOnce,reviewReasons,preserveFirstReviewHolds,localFallbackAllowed} from '../js/assistant-resilience.js';
import {assistantRequestScope,usageTotal} from '../js/ai-gemini.js';
import {validatePlan} from '../js/assistant-core.js';
assert.equal(strongModelCandidate(['gemini-test-flash','gemini-test-pro'],'gemini-test-flash'),'gemini-test-pro');assert.equal(strongModelCandidate(['gemini-test-pro'],'gemini-test-pro'),null);assert.equal(strongModelCandidate(['../gemini-pro','gemini-pro-image'],''),null);
for(const code of ['RATE','LOCAL_LIMIT','NO_FREE','BUSY'])assert.equal(localFallbackAllowed({code},{message:'TEST 2 saat'}),true);
for(const options of [{message:'SP1:TEST'},{message:'TEST',files:1},{message:''}])assert.equal(localFallbackAllowed({code:'RATE'},options),false);
assert.equal(localFallbackAllowed({code:'ASSISTANT_ABORT'},{message:'TEST',online:false}),false);
const d={customers:[{id:'TEST_C',name:'Akasya Yapı'}],vehicles:[{id:'TEST_V',name:'Kazıcı 8',type:'JCB'},{id:'TEST_V2',name:'Başka makine',type:'JCB'}],sites:[],personnel:[],aliases:[],work_records:[],price_book:[]},message='12.11.2026 Akasya Yapı Kazıcı 8 2 saat çalıştı',today='2026-11-12';
const plan={works:[{date:today,customer_id:'TEST_C',vehicle_id:null,work_type:'JCB Çalışması',quantity:2,unit:'Saat',quote:message}],fuel:[]},correct={works:[{...plan.works[0],vehicle_id:'TEST_V'}],fuel:[]};
const validate=p=>validatePlan(p,{d,message,today}),v=validate(plan);assert.ok(reviewReasons(v).length);
async function run(response,{limit=20,abort=false,used=0}={}){
 const values={gemini_key:'TEST_KEY',gemini_model:'gemini-test-flash',gemini_model_list:['gemini-test-pro'],gemini_consent:true,gemini_daily_limit:limit};if(used){const dt=new Date(),day=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');values.gemini_usage={date:day,counts:{'TEST_prior':used},failed:0};}let calls=0;
 const db={metaGet:async k=>values[k],metaTxn:async(keys,fn)=>{const r=fn(values);Object.assign(values,r.set);return r.result;},metaUpdate:async(k,fn)=>values[k]=fn(values[k])};
 const scope=assistantRequestScope({fetchImpl:async()=>{calls++;return new Response(JSON.stringify(response),{status:200});}});if(abort)scope.abort();
 try{return {out:await strongReviewOnce(db,{plan,validation:v,validate,parts:[{text:message}],system:'TEST',scope}),calls,values};}finally{scope.dispose();}
}
const envelope=x=>({candidates:[{content:{parts:[{text:JSON.stringify(x)}]},finishReason:'STOP'}]});
const good=await run(envelope(correct));assert.equal(good.calls,1);assert.equal(validate(good.out.plan).works[0].ok,true);assert.equal(good.out.plan.works[0].vehicle_id,'TEST_V');assert.equal(good.values.gemini_model,'gemini-test-flash');assert.equal(Object.values(good.values.gemini_usage.counts).reduce((a,b)=>a+b,0),1);
const bad=await run({candidates:[{content:{parts:[{text:'bad JSON'}]},finishReason:'STOP'}]});assert.equal(bad.calls,1);assert.equal(bad.out.plan,plan);assert.match(bad.out.note,/ilk sonuç/);
const drop=await run(envelope({works:[],fuel:[]}));assert.equal(drop.out.plan,plan);const extra=await run(envelope({...correct,collections:[{amount:9000}]}));assert.equal(extra.out.plan,plan);
const spent=await run(envelope(correct),{limit:1,used:1});assert.equal(spent.calls,0);assert.equal(spent.out.plan,plan);
const noBudget=await run(envelope(correct),{limit:0});assert.equal(noBudget.calls,0);assert.equal(noBudget.out.plan,plan);await assert.rejects(()=>run(envelope(correct),{abort:true}),/durduruldu/);
const held=validate(correct);preserveFirstReviewHolds(held,['date']);assert.equal(held.works[0].ok,false);assert.equal(held.works[0].dateConflict,true);assert.equal(held.works[0].fieldConfidence.date.level,'BILINMIYOR');
console.log('single stronger review uses original budget/scope, keeps first on malformed/quota, rejects drops/new money; abort and first-date hold PASS');

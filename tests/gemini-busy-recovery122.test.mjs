import assert from 'node:assert/strict';
import {withAssistantModelFallback,withModelFallback,geminiJson,assistantRequestScope,usageTotal} from '../js/ai-gemini.js';
const makeDB=(extra={})=>{const values=new Map(Object.entries({gemini_key:'TEST',gemini_model:'gemini-test-neon',gemini_consent:true,gemini_daily_limit:20,gemini_model_list:['gemini-test-neon'],...extra}));return {values,metaGet:async k=>values.get(k),metaSet:async(k,v)=>values.set(k,v)};};
const result=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const busy=()=>result(503,{error:{message:'TEST service temporarily overloaded'}});
const ok=()=>result(200,{candidates:[{content:{parts:[{text:'{"documents":[]}'}]},finishReason:'STOP'}]});
const pdf={inlineData:{mimeType:'application/pdf',data:'VEVTVF9QREY='}};
const run=o=>geminiJson([{text:'TEST muayene belgesi'},pdf],o);
{
 const db=makeDB(),calls=[],delays=[];let generation=0;
 const fetchFn=async(url,init)=>{calls.push({url,body:init.body});if(url.includes('/models?'))return result(200,{models:[]});return ++generation===1?busy():ok();};
 let out;try{out=await withModelFallback(db,run,{fetchFn,wait:async ms=>delays.push(ms)});}catch(e){assert.fail('BUSY_RETRY_MISSING: '+e.code);}
 assert.deepEqual(out,{documents:[]},'Transient busy response must retry the same inspection request');assert.equal(generation,2);assert.equal(delays.length,1);assert.ok(delays[0]>=1000);assert.equal(calls.length,2);assert.equal(calls[0].body,calls[1].body);assert.equal(db.values.get('gemini_usage').failed,1);assert.equal(Object.values(db.values.get('gemini_usage').counts).reduce((a,b)=>a+b,0),2);
}
{
 const db=makeDB(),urls=[],bodies=[],delays=[];let generations=0;
 const fetchFn=async(url,init)=>{urls.push(url);if(url.includes('/models?'))return result(200,{models:[{name:'models/gemini-test-hydrogen',supportedGenerationMethods:['generateContent']}]});bodies.push(JSON.parse(init.body).contents);generations++;return url.includes('hydrogen')?ok():busy();};
 await withModelFallback(db,run,{fetchFn,wait:async ms=>delays.push(ms)});assert.equal(generations,3);assert.equal(urls.filter(x=>x.includes('/models?')).length,1,'Exhausted stale cache must refresh model list once');assert.equal(db.values.get('gemini_model'),'gemini-test-hydrogen');assert.deepEqual(bodies[0],bodies[2]);assert.ok(delays[1]>delays[0]);
}
for(const [extra,expected] of [[{gemini_daily_limit:1},'LOCAL_LIMIT'],[{gemini_consent:false},'NO_CONSENT']]){
 const db=makeDB(extra);let network=0;await assert.rejects(()=>withModelFallback(db,run,{fetchFn:async()=>{network++;return busy();},wait:async()=>{}}),e=>e.code===expected||expected==='NO_CONSENT'&&/ayarları eksik/.test(e.message));assert.equal(network,expected==='NO_CONSENT'?0:1,'Recovery must not bypass budget or consent');
}
{
 const db=makeDB();let count=0;await assert.rejects(()=>withModelFallback(db,run,{fetchFn:async()=>{count++;return result(403,{error:{message:'TEST denied'}});},wait:async()=>{throw Error('Must not retry permission failure');}}),/anahtar|izin/);assert.equal(count,1);
}
{
 const db=makeDB();let requests=0;const scope=assistantRequestScope({timeoutMs:5000,fetchImpl:async()=>{requests++;return busy();}});const started=Date.now();try{await assert.rejects(()=>withAssistantModelFallback(db,run,{scope,onRetry:()=>scope.abort()}),e=>e.code==='ASSISTANT_ABORT'||e.name==='AbortError');assert.equal(requests,1);assert.ok(Date.now()-started<500,'Cancellation during backoff must be immediate');}finally{scope.dispose();}
}
{
 const db=makeDB();let requests=0;const scope=assistantRequestScope({timeoutMs:30,fetchImpl:async()=>{requests++;return busy();}});try{await assert.rejects(()=>withAssistantModelFallback(db,run,{scope}),e=>e.code==='ASSISTANT_ABORT');assert.equal(requests,1);}finally{scope.dispose();}
}
{
 const db=makeDB();let generations=0,lists=0;await assert.rejects(()=>withModelFallback(db,run,{fetchFn:async url=>{if(url.includes('/models?')){lists++;return result(200,{models:['a','b','c','d','e'].map(x=>({name:'models/gemini-test-'+x,supportedGenerationMethods:['generateContent']}))});}generations++;return busy();},wait:async()=>{}}),e=>e.code==='BUSY'&&e.recovery?.attempts===5);assert.equal(generations,5);assert.equal(lists,1);
}
{
 const db=makeDB();let count=0;
 await assert.rejects(()=>withModelFallback(db,run,{fetchFn:async()=>{count++;return busy();},wait:async()=>db.values.set('gemini_consent',false)}),e=>e.code==='NO_CONSENT');assert.equal(count,1,'Revoking consent while waiting must block the next HTTP request');
}
{
 const db=makeDB();let count=0;
 await assert.rejects(()=>withModelFallback(db,run,{fetchFn:async()=>{count++;return new Response(JSON.stringify({error:{message:'TEST overloaded'}}),{status:503,headers:{'content-type':'application/json','retry-after':'120'}});},wait:async()=>assert.fail('Long provider wait must not be shortened')}),e=>e.code==='BUSY');assert.equal(count,1);
}
console.log('busy recovery PASS: bounded backoff, stale-list refresh, exact PDF, consent/budget/cancel/deadline, no permission retry');

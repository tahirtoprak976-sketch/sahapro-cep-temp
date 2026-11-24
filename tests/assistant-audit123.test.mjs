import assert from 'node:assert/strict';
import * as G from '../js/ai-gemini.js';
import * as C from '../js/assistant-conversation.js';
import * as A from '../js/assistant-agent-core.js';
const answer={candidates:[{content:{parts:[{functionCall:{name:'prepare_plan',args:{goal:'TEST',plan_json:'{"answer":"TEST"}'}}}]},finishReason:'STOP'}]};
const bodies=[];const fake=async(url,init)=>{bodies.push(JSON.parse(init.body));return new Response(JSON.stringify(answer),{status:200});};
await G.geminiAgent([{text:'TEST kısa mesaj'}],{key:'TEST',model:'gemini-9-test',tools:[{name:'prepare_plan'}],runTool:async()=>({terminal:true,plan:{answer:'TEST'}}),maxTokens:8192,fetchFn:fake});
assert.equal(bodies[0].generationConfig.maxOutputTokens,8192,'SHORT_REQUEST_BUDGET_MISSING');assert.equal(Object.hasOwn(bodies[0].generationConfig,'temperature'),false,'Modern models must use their default sampling');
assert.equal(A.assistantOutputBudget('Kısa mesaj'),8192);assert.equal(A.assistantOutputBudget('x'.repeat(5000)),32768);assert.equal(A.assistantOutputBudget('Şu alanı düzelt',{plan:{works:[{description:'x'.repeat(13000)}]}}),32768,'A short reply to a large active task must retain the large budget');
const legacy=[];await G.geminiJson([{text:'TEST'}],{key:'TEST',model:'gemini-2.5-test',fetchFn:async(u,o)=>{legacy.push(JSON.parse(o.body));return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{}'}]},finishReason:'STOP'}]}));}});assert.equal(legacy[0].generationConfig.temperature,0);
for(const text of ['Merhaba','Günaydın','İyi akşamlar','Nasılsın?','Teşekkür ederim','Sağ ol'])assert.ok(C.smallTalkReply(text),text);
for(const text of ['Merhaba TEST müşterisine 2 sefer yaz','Teşekkür İnşaat 500 TL ödedi','Selam TEST aracı 3 saat çalıştı','hepsini kaydet','nasılsın, tahsilat da kaydet'])assert.equal(C.smallTalkReply(text),null,text);
const dbFor=(extra={})=>{const m=new Map(Object.entries({gemini_key:'TEST_SECRET',gemini_model:'gemini-9-test',gemini_consent:true,gemini_daily_limit:4,...extra}));return {m,metaGet:async k=>m.get(k),metaSet:async(k,v)=>m.set(k,v)};};
{
 const db=dbFor(),calls=[];const scope=G.assistantRequestScope({fetchImpl:async(url,init)=>{calls.push(JSON.parse(init.body));return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'OK'}]},finishReason:'STOP'}]}));}});
 try{const r=await G.probeGeminiConnection(db,{scope});assert.equal(r.ok,true);assert.equal(r.status,200);assert.equal(calls.length,1);assert.equal(calls[0].generationConfig.maxOutputTokens,64);assert.equal(calls[0].tools,undefined);assert.equal(calls[0].systemInstruction,undefined);assert.equal(calls[0].contents[0].parts.length,1);assert.equal(db.m.get('gemini_usage').counts['gemini-9-test'],1);}finally{scope.dispose();}
}
for(const [status,expected]of [[503,'BUSY'],[403,'PERMISSION'],[401,'AUTH'],[400,'REQUEST']]){
 const db=dbFor();let calls=0;const scope=G.assistantRequestScope({fetchImpl:async()=>{calls++;return new Response(JSON.stringify({error:{message:'TEST raw provider error TEST_SECRET'}}),{status});}});
 try{await assert.rejects(()=>G.probeGeminiConnection(db,{scope}),e=>{const report=G.geminiFailureSummary(e);assert.equal(report.code,expected);assert.equal(report.status,status);assert.doesNotMatch(JSON.stringify(report),/TEST_SECRET|raw provider error/);return true;});assert.equal(calls,1,'Probe must never run a fallback loop');}finally{scope.dispose();}
}
{
 const db=dbFor({gemini_daily_limit:0});let calls=0;const scope=G.assistantRequestScope({fetchImpl:async()=>{calls++;throw Error('No budget');}});try{await assert.rejects(()=>G.probeGeminiConnection(db,{scope}),e=>e.code==='LOCAL_LIMIT');assert.equal(calls,0);}finally{scope.dispose();}
}
console.log('assistant audit123 PASS: lightweight request budget, modern model parameters, exact local chat, private one-request probe, correct failures and budget');

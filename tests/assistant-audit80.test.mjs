import assert from 'node:assert/strict';
import {assertAssistantPlan,PLAN_LIMITS,rowEvidence} from '../js/assistant-safety.js';
import {validatePlan,validateExtras} from '../js/assistant-core.js';
import {cleanAgentPlan} from '../js/assistant-agent-core.js';
import {validateActions} from '../js/assistant-actions.js';
import {readRowPricePolicy} from '../js/assistant-batch.js';
import {routeCommand} from '../js/command-router.js';
import {geminiJson,geminiAgent,assistantRequestScope} from '../js/ai-gemini.js';
import {createServer} from 'node:http';
assert.equal(readRowPricePolicy('2. işin fiyatı beklesin',1),true);assert.equal(readRowPricePolicy('2. işin fiyatı beklesin',0),null);assert.equal(readRowPricePolicy('> 2. işin fiyatı beklesin',1),null);assert.equal(readRowPricePolicy('[28/10 19:00] TEST: \n2. işin fiyatı beklesin',1),null);
const today='2026-10-28',d={vehicles:[{id:'V',name:'TEST JCB'}],customers:[{id:'C',name:'TEST Kaya'}],personnel:[{id:'P',name:'TEST Soner'}],fuel_tank_movements:[{id:'T',date:'2026-01-01',move_type:'GİRİŞ',liters:500}]};
for(const text of ['TEST Kaya telefonu 05329999999 olarak güncelle','TEST JCB muayenesini 12.03.2027 olarak düzelt','TEST Kaya ana firmasını değiştir'])assert.equal(routeCommand(text,d,today),null,'card edits reach the planner');
assert.equal(routeCommand('TEST JCB dünkü işinin plakasını değiştir',d,today)?.kind,'candidates','explicit work edit retains its local selection');
for(const [group,limit]of Object.entries(PLAN_LIMITS)){
 const value=['questions','photo_texts'].includes(group)?'TEST':{};
 assert.throws(()=>assertAssistantPlan({[group]:Array(limit+1).fill(value)}),/Hiçbir satır/);
 assert.throws(()=>assertAssistantPlan({[group]:{}}),/geçersiz/);
}
for(const bad of [null,[],1,'{}',{works:[null]},{expenses:[1]},{cards:{customers:[null]}}])assert.throws(()=>assertAssistantPlan(bad));
assert.throws(()=>cleanAgentPlan({maintenance:Array(11).fill({})}),/Hiçbir satır/);
assert.throws(()=>validateExtras({maintenance:Array(11).fill({})},{d,today}),/Hiçbir satır/);
const opts={message:'TEST JCB fişler',d,today,photoCount:2};
let v=validatePlan({photo_texts:['LASTİK TOPLAM 500','YAĞ TOPLAM 900'],expenses:[{photo:0,amount:900,category:'Lastik'}]},opts);
assert.equal(v.expenses[0].amount,null);assert.equal(v.expenses[0].ok,false,'another image cannot prove this expense');
v=validatePlan({photo_texts:['LASTİK TOPLAM 500','YAĞ TOPLAM 900'],expenses:[{photo:0,amount:500,category:'Lastik'}]},opts);
assert.equal(v.expenses[0].amount,500);assert.equal(v.expenses[0].ok,true);
v=validatePlan({expenses:[{amount:900,quote:'TEST JCB lastik 500 TL'}]},{...opts,photoCount:0,message:'TEST JCB lastik 500 TL; yağ 900 TL'});
assert.equal(v.expenses[0].amount,null,'other clause cannot prove the quoted expense');
v=validatePlan({expenses:[{amount:500,quote:'uydurulmuş alıntı'}]},{...opts,photoCount:0,message:'TEST JCB 500 TL'});
assert.equal(v.expenses[0].ok,false);assert.match(v.expenses[0].issues.join(),/alıntı/);
assert.equal(rowEvidence({photo:99},{photoCount:2}).photo,null);
assert.ok(rowEvidence({},{photoCount:2}).issues.length);
v=validatePlan({photo_texts:['20 L','80 L'],fuel:[{vehicle_id:'V',photo:0,liters:80,source:'Akaryakıt İstasyonu'}]},opts);
assert.equal(v.fuel[0].liters,null);assert.equal(v.fuel[0].ok,false);
v=validatePlan({photo_texts:['DEPO 20 L','BAŞKA FATURA 80 L'],tank_in:[{photo:0,liters:80}]},opts);assert.equal(v.tankIn[0].liters,null);assert.equal(v.tankIn[0].ok,false);
for(const [group,row]of Object.entries({expenses:{amount:500},fuel:{vehicle_id:'V',liters:20,source:'Depo Tankı'},tank_in:{liters:20},collections:{customer_id:'C',amount:500},maintenance:{vehicle_id:'V',description:'Bakım'},personnel:{personnel_id:'P'}})){
 const plan={[group]:[{...row,date:'2026-02-31'}]},options={d,today,message:'TEST JCB TEST Kaya 500 TL ödedi, 20 litre'};
 const result=['collections','maintenance','personnel'].includes(group)?validateExtras(plan,options):validatePlan(plan,options);
 const r=result[group==='tank_in'?'tankIn':group][0];assert.equal(r.date,'',group);assert.equal(r.ok,false,group);assert.match(r.issues.join(),/Tarih/);
}
v=validatePlan({fuel:[{date:'2026-01-10',vehicle_id:'V',liters:20,source:'Depo Tankı'}]},{message:'TEST JCB 20 litre',d,today});
assert.equal(v.fuel[0].date,'2026-01-10','valid historical dates are preserved beyond 120 days');
const e=validatePlan({expenses:[{amount:500,payment_method:'Personel Ödedi'}]},{message:'500 TL personel ödedi',d,today}).expenses[0];assert.equal(e.ok,false);assert.match(e.issues.join(),/Kim ödedi/);
const m=validateExtras({photo_texts:['Bakım 500','Bakım 900'],maintenance:[{vehicle_id:'V',description:'Tamir',cost:900,photo:1}]},{...opts,photoTexts:['Bakım 500','Bakım 900']}).maintenance[0];
assert.equal(m.photo,1);assert.equal(m.cost,900);
assert.equal(validateExtras({maintenance:[{vehicle_id:'V',description:'Tamir'},{vehicle_id:'V',description:'Başka tamir'}]},{d,today,photoCount:1}).maintenance[0].photo,null,'a single image is not copied into multiple repairs');
const action=validateActions({actions:[{store:'vehicles',op:'update',id:'V',fields:{next_maintenance_date:'2026-02-31'}}]},{d,message:'TEST JCB 31.02.2026'});assert.equal(action[0].ok,false);
const payload=(parts,finishReason='STOP')=>({ok:true,status:200,json:async()=>({candidates:[{content:{parts},finishReason}]})});
let calls=0;
const recovered=await geminiJson([],{key:'TEST',model:'TEST',fetchFn:async()=>{calls++;return payload([{text:JSON.stringify({works:[{quantity:calls}]})}],calls===1?'MAX_TOKENS':'STOP');}});
assert.equal(calls,2);assert.equal(recovered.works[0].quantity,2,'valid-looking truncated JSON is re-read, never accepted as complete');
await assert.rejects(()=>geminiJson([],{key:'TEST',model:'TEST',fetchFn:async()=>payload([{text:'{"works":[]}'}],'MAX_TOKENS')}),/ikiye bölüp/);
let tools=0;await assert.rejects(()=>geminiAgent([],{key:'TEST',model:'TEST',system:'',tools:[{name:'prepare_plan'}],runTool:async()=>{tools++;return {terminal:true,plan:{}}},fetchFn:async()=>payload([{functionCall:{name:'prepare_plan',args:{}}}],'MAX_TOKENS')}),/yarıda/);assert.equal(tools,0);
await assert.rejects(()=>geminiJson([],{key:'TEST',model:'TEST',fetchFn:async()=>payload([{text:'{"works":[]}'}],'SAFETY')}),/güvenlik/);
// One shared deadline covers hung response bodies and retries; abort never triggers an extra request.
const hanging=async(_u,{signal})=>new Promise((_ok,no)=>{signal.addEventListener('abort',()=>no(new DOMException('Aborted','AbortError')),{once:true});});
let scope=assistantRequestScope({timeoutMs:15,fetchImpl:hanging});await assert.rejects(()=>scope.fetchFn('https://example.invalid',{}),/süresinde/);scope.dispose();
scope=assistantRequestScope({fetchImpl:hanging});const pending=scope.fetchFn('https://example.invalid',{});scope.abort();await assert.rejects(()=>pending,/durduruldu/);assert.throws(scope.check,/durduruldu/);scope.dispose();
scope=assistantRequestScope({maxBytes:4,fetchImpl:async()=>new Response('12345')});await assert.rejects(()=>scope.fetchFn('https://example.invalid',{}),/çok büyük/);scope.dispose();
scope=assistantRequestScope({fetchImpl:async()=>new Response('{"ok":true}')});assert.deepEqual(await(await scope.fetchFn('https://example.invalid',{})).json(),{ok:true});scope.dispose();
let bodyStarted=false;const server=createServer((_req,res)=>{bodyStarted=true;res.writeHead(200,{'Content-Type':'application/json'});res.write('{"partial":');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
scope=assistantRequestScope({timeoutMs:250});
try{await assert.rejects(()=>scope.fetchFn('http://127.0.0.1:'+server.address().port,{}),/süresinde/);assert.equal(bodyStarted,true,'real fetch body is aborted after headers too');}
finally{scope.dispose();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
console.log('assistant audit80: every batch bound, malformed plans, source/photo isolation, real/historical dates, payer/attachment ownership, truncated responses, cancellation, deadline and response limit PASS');

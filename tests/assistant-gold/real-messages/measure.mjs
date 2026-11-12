import {offlinePlan} from '../../../js/offline-whatsapp.js';
import {assistantQuestions} from '../../../js/assistant-questions.js';
import {APP_VERSION} from '../../../js/core.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {validatePlan,validateExtras} from '../../../js/assistant-core.js';
import {analyzeMessage} from '../../../js/message-engine.js';
import {confidenceValue} from '../../../js/assistant-confidence.js';
import {draftMissing} from '../../../js/assistant-workflow.js';
import {groupedDraftQuestions} from '../../../js/assistant-review-core.js';
import {jobPreview} from '../../../js/job-core.js';
import {foldTr} from '../../../js/parser.js';
import {source,cases,fixture,message,id,fixtureSettings,records} from './fixture.mjs';
export const photoCases=JSON.parse(readFileSync(new URL('./photo-cases.json',import.meta.url)));
const recordings=JSON.parse(readFileSync(new URL('./recorded-v3.10.00.json',import.meta.url)));
const norm=x=>foldTr(String(x??'')).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const kinds={work:'works',fuel:'fuel',collection:'collections',personnel:'personnel',expense:'expenses',tank:'tankIn',fuelout:'fuelOut',maintenance:'maintenance'};
const category={r01:'Gönderen ve tek iş',r02:'Gönderen ve tek iş',r03:'Gönderen ve tek iş',r20:'Gönderen ve tek iş',r05:'Çok iş / eşleşme',r14:'Çok iş / eşleşme',r18:'Çok iş / eşleşme',r04:'Yakıt / yük ayrımı',r08:'Yakıt / yük ayrımı',r15:'Yakıt / yük ayrımı',r07:'Sefer / döküm / patron',r09:'Sefer / döküm / patron',r13:'Sefer / döküm / patron',r17:'Sefer / döküm / patron',r11:'Sözleşme',r12:'Sözleşme',r10:'Eksik / ortak bilgi',r16:'Eksik / ortak bilgi',r19:'Eksik / ortak bilgi',r06:'Mesai'};
const requiredQuestions={r03:[['vehicle',[0]]],r08:[['date',[0]]],r09:[['customer',[0]]],r10:[['quantity',[1]]],r16:[['customer',[1,2]]],r19:[['vehicle',[1,2]],['customer',[1]]]};
const newStats=()=>({messages:0,expectedCards:0,actualCards:0,readyCorrect:0,unnecessaryQuestions:0,missedQuestions:0,wrongFields:0,missingCards:0,extraCards:0,silentWrong:0});
const mapExpected=(field,value)=>value==null?null:field==='customer'?String(value).startsWith('new:')?value:id('CUSTOMER',value):field==='vehicle'?id('VEHICLE',value):field==='personnel'?id('PERSON',value):field==='quarry'?id('quarries',value):field==='dump'?String(value).startsWith('Depo')?id('DUMP','OWN'):id('dump_sites',value):field==='site'?source.fixture.customers.some(c=>(c.sites||[]).some(s=>s.id===value))?id('SITE',value):value:value;
function actualField(row,field,d){
 const keys={customer:'customer_id',vehicle:'vehicle_id',personnel:'personnel_id',site:'site_id',quarry:'quarry_id',dump:'dump_site_id'};
 if(field==='customer')return confidenceValue(row,'customer_id',row.customer_id)||(row.new_customer&&!row.fieldConfidence?.customer_id?.rejected?'new:'+row.new_customer:null);
 if(field==='site')return ((d.sites||[]).find(s=>s.id===row.site_id&&!s.customer_id)?.name)||row.site_id||(row.new_site?'new:'+row.new_site:row.place||null);
 if(field==='price')return jobPreview(d,row)?.kind==='included'?'Sözleşmeye dahil (0 ₺)':jobPreview(d,row)?.kind==='sefer'?'sözleşmedeki kamyonet sefer fiyatı':null;
 if(field==='vehicle_level'||field==='customer_level'){const k=field==='vehicle_level'?'vehicle_id':'customer_id';return row.fieldConfidence?.[k]?.level??null;}
 const key=keys[field]||field;return confidenceValue(row,key,row[key])??null;
}
function same(field,got,want){
 if(field==='description')return !!got&&norm(got).includes(norm(want));
 if(field==='note')return !!got&&/pazar mesa[yi]s/.test(norm(got));
 if(field.endsWith('_level'))return got===(want.startsWith('ÇIKARIM')?'CIKARIM':'KESIN');
 if(field==='site'&&typeof want==='string')want=want.replace(/\s*\(takma ad:.*\)$/i,'');
 return got===want||typeof got==='string'&&typeof want==='string'&&norm(got)===norm(want);
}
// Maximum-weight one-to-one alignment; oracle is used only for scoring, never proposals.
export function align(expected,actual,d){
 const n=Math.max(expected.length,actual.length);if(!n)return [];
 const cost=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>{
  if(!expected[i]||!actual[j]||expected[i].kind!==actual[j].kind)return 1000;
  let score=100;for(const [f,w]of [['customer',15],['vehicle',12],['date',6],['quantity',5],['site',4],['dump',4],['quarry',3],['material',2]])if(Object.hasOwn(expected[i],f)&&same(f,actualField(actual[j],f,d),mapExpected(f,expected[i][f])))score+=w;
  return 1000-score;
 }));
 const u=Array(n+1).fill(0),v=Array(n+1).fill(0),p=Array(n+1).fill(0),way=Array(n+1).fill(0);
 for(let i=1;i<=n;i++){p[0]=i;let j0=0;const min=Array(n+1).fill(Infinity),used=Array(n+1).fill(false);do{used[j0]=true;const i0=p[j0];let delta=Infinity,j1=0;for(let j=1;j<=n;j++)if(!used[j]){const cur=cost[i0-1][j-1]-u[i0]-v[j];if(cur<min[j]){min[j]=cur;way[j]=j0;}if(min[j]<delta){delta=min[j];j1=j;}}for(let j=0;j<=n;j++)if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else min[j]-=delta;j0=j1;}while(p[j0]);do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0);}
 const result=Array(expected.length).fill(-1);for(let j=1;j<=n;j++)if(p[j]<=expected.length&&j<=actual.length&&cost[p[j]-1][j-1]<1000)result[p[j]-1]=j-1;return result;
}
function questions(rows){
 return assistantQuestions(rows.map((r,index)=>{const fields={date:r.date,customer:confidenceValue(r,'customer_id',r.customer_id)||(r.new_customer&&!r.fieldConfidence?.customer_id?.rejected?'new:'+r.new_customer:''),vehicle:confidenceValue(r,'vehicle_id',r.vehicle_id),work_type:r.work_type,quantity:r.quantity,unit:r.unit,source:r.source,liters:r.liters,fuel_customer:r.customer_id,amount:r.amount,category:r.category,method:r.method,bank:r.bank_account_id,supplier:r.supplier_id,cost:r.cost,description:r.description};return {kind:r.kind,index,r,fields,missing:draftMissing({kind:r.kind,fields})};})).map(q=>({field:q.field,actualRows:q.targets.map(t=>t.index)}));
}
function oldQuestions(rows){
 const drafts=rows.filter(r=>['work','fuel'].includes(r.kind)).map((r,i)=>({kind:r.kind,index:i,saved:false,label:r.kind==='work'?'İş':'Yakıt',fields:{date:r.date,customer:r.customer_id||(r.new_customer?'new:'+r.new_customer:''),vehicle:r.vehicle_id,work_type:r.work_type,quantity:r.quantity,unit:r.unit,source:r.source,liters:r.liters,fuel_customer:r.customer_id,amount:r.amount,category:r.category,method:r.method,bank:r.bank_account_id,supplier:r.supplier_id,cost:r.cost,description:r.description}}));
 const groups=groupedDraftQuestions(drafts.map(r=>({...r,missing:draftMissing(r)})));
 for(const [index,r]of rows.entries())if(r.dateConflict&&!groups.some(q=>q.field==='date'&&q.rows.includes(index+1)))groups.push({field:'date',rows:[index+1]});
 return groups.map(q=>({field:q.field,actualRows:q.rows.map(n=>n-1)}));
}
export function measureReal({mode='assistant-validation',batch=false,photos=false,today=source.today_for_test,responses=null}={}){
 const totals=newStats(),categories={},failureReasons={},details=[];
 const inputs=photos?photoCases:batch?[{...source.cases.find(c=>c.id==='r00_tumu'),expected:cases.flatMap(c=>c.expected),originIds:cases.flatMap(c=>c.expected.map(()=>c.id))}]:cases;
 for(const c of inputs){
  const d=fixture(),text=message(c);let rows;
  if(responses&&!Object.hasOwn(responses,c.id))throw Error('Canlı yanıt eksik: '+c.id+'; dondurulmuş yanıtla tamamlanmaz.');
  const response=responses?responses[c.id]:c.recordedResponse||recordings.responses[c.id];
  if(mode==='local-parser')rows=analyzeMessage({id:c.id,text,date:today},d).rows.map(r=>({...r,ok:!!(r.customer_id&&r.vehicle_id&&r.work_type&&r.quantity&&r.unit&&r.inference_confirmed),liters:r.fuel_liters,source:r.fuel_source,note:(r.notes||[]).join(' · ')}));
  else if(mode==='offline-review'){const out=offlinePlan(text,{d,today,rules:fixtureSettings().assistant_rules});rows=Object.entries(kinds).flatMap(([kind,group])=>(out?.[group]||[]).map(r=>({...r,kind})));}
  else{const out=validatePlan(structuredClone(response),{d,message:text,today,rules:fixtureSettings().assistant_rules,photoCount:(c.photoTexts||[]).length});Object.assign(out,validateExtras(response,{d,message:text,today,rules:fixtureSettings().assistant_rules}));rows=Object.entries(kinds).flatMap(([kind,group])=>(out[group]||[]).map(r=>({...r,kind})));}
  const stat=newStats();stat.messages=1;stat.expectedCards=c.expected.length;stat.actualCards=rows.length;const pairs=align(c.expected,rows,d),used=new Set(pairs.filter(i=>i>=0)),wrong=[],rowsByExpected=[];
  for(const [ei,e]of c.expected.entries()){
   const ai=pairs[ei],a=ai<0?null:rows[ai];if(!a){stat.missingCards++;rowsByExpected.push(null);continue;}const errors=[];
   for(const [field,value]of Object.entries(e)){
    if(['kind','checked'].includes(field))continue;
    // The fixture intentionally supplies no numeric trip tariff; do not invent it.
    if(field==='price'&&!value.includes('0'))continue;
    const want=mapExpected(field,value),got=actualField(a,field,d);if(!same(field,got,want)){errors.push(field);wrong.push({expectedRow:ei,actualRow:ai,field,want,got});failureReasons[field]=(failureReasons[field]||0)+1;stat.wrongFields++;}
   }
   if(a.ok&&errors.length===0&&e.checked!==false)stat.readyCorrect++;
   if(a.ok&&(errors.length>0||e.checked===false))stat.silentWrong++;
   rowsByExpected.push({actualRow:ai,checked:!!a.ok,wrongFields:errors});
  }
  stat.extraCards=rows.length-used.size;stat.silentWrong+=rows.filter((r,i)=>r.ok&&!used.has(i)).length;
  const qs=questions(rows),spec=[];
  if(batch){let offset=0;for(const part of cases){for(const [field,indices]of requiredQuestions[part.id]||[])spec.push({field,expectedRows:indices.map(i=>i+offset)});offset+=part.expected.length;}}
  else for(const [field,indices]of requiredQuestions[c.id]||c.requiredQuestions||[])spec.push({field,expectedRows:indices});
  for(const q of spec)if(!qs.some(aq=>aq.field===q.field&&q.expectedRows.some(i=>pairs[i]>=0&&aq.actualRows.includes(pairs[i]))))stat.missedQuestions++;
  for(const q of qs){const expRows=pairs.flatMap((a,i)=>q.actualRows.includes(a)?[i]:[]),needed=spec.some(eq=>eq.field===q.field&&eq.expectedRows.some(i=>expRows.includes(i))),optional=q.field==='quantity'&&expRows.some(i=>c.expected[i].quantity===null&&c.expected[i].price?.includes('0'));if(!needed&&!optional)stat.unnecessaryQuestions++;}
  const label=batch?'Tek seferde 20 mesaj':c.category||category[c.id];categories[label]??=newStats();for(const k of Object.keys(totals)){totals[k]+=stat[k];categories[label][k]+=stat[k];}
  details.push({id:c.id,category:label,...stat,questions:qs,expectedQuestions:spec,rowsByExpected,wrongFields:wrong,actual:rows});
 }
 return {version:APP_VERSION,mode,sampleSet:photos?'synthetic-photo-date':'owner-pseudonymized',realGemini:false,proposalOrigin:mode==='offline-review'?{origin:'phone offline reader executed deterministically',realGemini:false,oracleUsed:false}:photos?{origin:'synthetic canned proposals',realGemini:false,oracleUsed:false}:recordings.meta,categories,totals,failureReasons,details,limitations:[mode==='offline-review'?'Gemini yok; internetsiz okuyucu mevcut kayıtlarla doğrudan çalıştırıldı.':'Gemini yanıtı yok; planlar v3.10.00 yerel ayrıştırıcısından kaydedildi.','Sözleşmede yalnız açık TEST ücreti vardır; gerçek ücret değildir ve nonzero ücret doğruluğu puanlanmaz.','Soru sayıları mevcut grup/missing alan katmanından türetildi; henüz gerçek ekran testi değildir.']};
}
if(process.argv[1]?.endsWith('/measure.mjs')){const clock=process.argv.indexOf('--today');const report=measureReal({...(clock>=0?{today:process.argv[clock+1]}:{}),mode:process.argv.includes('--offline')?'offline-review':process.argv.includes('--local')?'local-parser':'assistant-validation',batch:process.argv.includes('--batch'),photos:process.argv.includes('--photos')});const at=process.argv.indexOf('--report');if(at>=0)writeFileSync(process.argv[at+1],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({mode:report.mode,totals:report.totals,categories:report.categories,failureReasons:report.failureReasons},null,2));}

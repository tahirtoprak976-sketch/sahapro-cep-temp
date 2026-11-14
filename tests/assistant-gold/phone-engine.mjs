import {phoneFailure,phoneResponseIssue} from './phone-errors.mjs?diag=2';
import {buildHybridEnvelope} from '../../js/assistant-hybrid311.js';
import {assistantContext,assistantSystem,assistantSchema} from '../../js/assistant-core.js';
import {geminiJson,gatedFetch,assistantRequestScope} from '../../js/ai-gemini.js';
import {source,cases,fixture,message,fixtureSettings} from './real-messages/fixture.mjs';
import {measureReal} from './real-messages/measure.mjs';
import {phoneSafetyCases,phoneSafetyFixture,measurePhoneSafety} from './phone-safety.mjs';
export const phoneSampleCount=(repeats,mode)=>(mode==='both'?cases.length+1:mode==='batch'?1:cases.length)*repeats;
export const phoneRequestCount=(repeats,mode,safety=true)=>phoneSampleCount(repeats,mode)+(safety?phoneSafetyCases.length*repeats:0);
export function safePhoneReport(report,key=''){const text=JSON.stringify(report,null,2);if(key&&text.includes(key))throw Error('Gizli anahtar içeren rapor indirilemez.');return text;}
export async function runPhoneEvaluation({key,model,db,sourceSha,repeats=3,mode='both',includeSafety=true,signal,onProgress=()=>{},fetchImpl=globalThis.fetch}){
 if(!key||!/^[a-z0-9._-]+$/i.test(model||'')||!Number.isInteger(repeats)||repeats<1||repeats>3||!['single','batch','both'].includes(mode)||!/^[a-f0-9]{40}$/i.test(sourceSha||''))throw Error('Anahtar, model ve geçerli sınav kaynağı gerekir.');
 const report={protocol:'v311-primary-json',sourceSha,mode:'live-owner-pseudonymized',realGemini:fetchImpl===globalThis.fetch,model,usedRealNames:false,savedBusinessRecords:0,safety:{measured:false,silentWrong:null,moneyGuesses:null,mandatoryChecked:null,cardCountErrors:null,runs:[]},runs:[],completed:false,limitations:['Yalnız takma adlı sınav, sentetik güvenlik mesajları ve ana JSON çıkarımı ölçülür; araçlı sohbet ve fiziksel telefon kabulü ayrıdır.','Güvenlik sayıları mevcut bağımsız altın kümeden hesaplanır; tüm kullanım biçimlerinin hatasızlığı anlamına gelmez.','Anahtar rapora eklenmez; eksik yanıtlar dondurulmuş yanıtla tamamlanmaz.']};
 let completed=0,stop=false;const total=phoneRequestCount(repeats,mode,includeSafety);
 const read=async(d,text,today,rules='')=>{
  let requests=0,originalIssue=null;const http=gatedFetch(db,fetchImpl),once=async(url,init)=>{if(requests++)throw Object.assign(Error('Örnek başına tek istek.'),{code:'SAMPLE_ONCE'});return http(url,init);};
  const scope=assistantRequestScope({fetchImpl:once}),abort=()=>scope.abort();signal?.addEventListener('abort',abort,{once:true});
  const observedFetch=async(...args)=>{const response=await scope.fetchFn(...args);const data=await response.clone().json().catch(()=>null);originalIssue=phoneResponseIssue(response.status,data)||originalIssue;return response;};
  try{if(signal?.aborted)scope.abort();scope.check();const envelope=buildHybridEnvelope(d,text,today,rules),parts=[{text:JSON.stringify({context:assistantContext(envelope.data,today,text),phone_hints:envelope.hints,candidate_bounds:envelope.bounds,note:envelope.note,message:text})}];const response=await geminiJson(parts,{key,model,system:assistantSystem(rules),schema:assistantSchema(),fetchFn:observedFetch});scope.check();completed++;return response;}catch(error){throw originalIssue||phoneFailure(error);}finally{scope.dispose();signal?.removeEventListener('abort',abort);}
 };
 const failure=(run,sample,error)=>{run.failures.push({id:sample.id,...phoneFailure(error),...(Number.isInteger(error.httpStatus)?{httpStatus:error.httpStatus}:{}),...(error.providerStatus?{providerStatus:error.providerStatus}:{})});stop=true;};
 for(let repeat=1;repeat<=repeats&&!stop;repeat++)for(const batch of mode==='both'?[false,true]:[mode==='batch']){
  if(stop||signal?.aborted){stop=true;break;}
  const samples=batch?[source.cases.find(c=>c.id==='r00_tumu')]:cases,run={repeat,mode:batch?'batch':'single',responses:{},failures:[],measurement:null};report.runs.push(run);
  for(const sample of samples){
   if(signal?.aborted){stop=true;break;}
   onProgress({completed,total,repeat,mode:run.mode,pending:sample.id,report});
   try{run.responses[sample.id]=await read(fixture(),message(sample),source.today_for_test,fixtureSettings().assistant_rules);}catch(error){failure(run,sample,error);}
   onProgress({completed,total,repeat,mode:run.mode,report});if(stop)break;
  }
  if(!run.failures.length&&Object.keys(run.responses).length===samples.length){run.measurement=measureReal({batch,responses:run.responses});run.measurement.realGemini=report.realGemini;run.measurement.proposalOrigin={origin:'Live response transport; provider authenticity checked separately',model,repeat};run.measurement.limitations=[...report.limitations];}
  if(signal?.aborted)stop=true;
 }
 if(includeSafety)for(let repeat=1;repeat<=repeats&&!stop;repeat++){
  if(signal?.aborted){stop=true;break;}const run={repeat,responses:{},failures:[],measurement:null};report.safety.runs.push(run);
  for(const sample of phoneSafetyCases){if(signal?.aborted){stop=true;break;}try{run.responses[sample.id]=await read(phoneSafetyFixture(sample),sample.message,'2026-11-02');}catch(error){failure(run,sample,error);}onProgress({completed,total,repeat,mode:'safety',report});if(stop)break;}
  if(!run.failures.length&&Object.keys(run.responses).length===phoneSafetyCases.length)run.measurement=measurePhoneSafety(run.responses);
 }
 if(includeSafety&&!stop&&report.safety.runs.length===repeats&&report.safety.runs.every(r=>r.measurement)){
  report.safety.measured=true;for(const k of ['silentWrong','moneyGuesses','mandatoryChecked','cardCountErrors'])report.safety[k]=report.safety.runs.reduce((n,r)=>n+r.measurement[k],0);
 }
 report.completed=!stop&&completed===total;return report;
}

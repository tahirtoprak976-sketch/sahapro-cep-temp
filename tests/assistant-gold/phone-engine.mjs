import {buildHybridEnvelope} from '../../js/assistant-hybrid311.js';
import {assistantContext,assistantSystem,assistantSchema} from '../../js/assistant-core.js';
import {geminiJson,gatedFetch,assistantRequestScope} from '../../js/ai-gemini.js';
import {source,cases,fixture,message,fixtureSettings} from './real-messages/fixture.mjs';
import {measureReal} from './real-messages/measure.mjs';
export const phoneSampleCount=(repeats,mode)=>(mode==='both'?cases.length+1:mode==='batch'?1:cases.length)*repeats;
export function safePhoneReport(report,key=''){const text=JSON.stringify(report,null,2);if(key&&text.includes(key))throw Error('Gizli anahtar içeren rapor indirilemez.');return text;}
export async function runPhoneEvaluation({key,model,db,sourceSha,repeats=3,mode='both',signal,onProgress=()=>{},fetchImpl=globalThis.fetch}){
 if(!key||!model||!Number.isInteger(repeats)||repeats<1||repeats>3||!['single','batch','both'].includes(mode)||!/^[a-f0-9]{40}$/.test(sourceSha||''))throw Error('Anahtar, model ve geçerli sınav kaynağı gerekir.');
 const report={protocol:'v311-primary-json',sourceSha,mode:'live-owner-pseudonymized',realGemini:fetchImpl===globalThis.fetch,model,usedRealNames:false,savedBusinessRecords:0,safety:{measured:false,silentWrong:null,moneyGuesses:null,mandatoryChecked:null},runs:[],completed:false,limitations:['Yalnız takma adlı sınav ve ana JSON çıkarımı ölçülür; araçlı sohbet ve fiziksel telefon kabulü ayrıdır.','Canlı para güvenliği ayrıca ölçülmeden safety.measured true olmaz.','Anahtar rapora eklenmez; eksik yanıtlar dondurulmuş yanıtla tamamlanmaz.']};
 let completed=0,stop=false;
 for(let repeat=1;repeat<=repeats&&!stop;repeat++)for(const batch of mode==='both'?[false,true]:[mode==='batch']){
  if(stop||signal?.aborted){stop=true;break;}
  const samples=batch?[source.cases.find(c=>c.id==='r00_tumu')]:cases,run={repeat,mode:batch?'batch':'single',responses:{},failures:[],measurement:null};report.runs.push(run);
  for(const sample of samples){
   if(signal?.aborted){stop=true;break;}
   let requests=0;const http=gatedFetch(db,fetchImpl),once=async(url,init)=>{if(requests++)throw Object.assign(Error('Örnek başına tek istek.'),{code:'SAMPLE_ONCE'});return http(url,init);};
   const scope=assistantRequestScope({fetchImpl:once}),abort=()=>scope.abort();signal?.addEventListener('abort',abort,{once:true});
   try{
    const text=message(sample),rules=fixtureSettings().assistant_rules,envelope=buildHybridEnvelope(fixture(),text,source.today_for_test,rules);
    const parts=[{text:JSON.stringify({context:assistantContext(envelope.data,source.today_for_test,text),phone_hints:envelope.hints,candidate_bounds:envelope.bounds,note:envelope.note,message:text})}];
    run.responses[sample.id]=await geminiJson(parts,{key,model,system:assistantSystem(rules),schema:assistantSchema(),fetchFn:scope.fetchFn});scope.check();completed++;
   }catch(error){run.failures.push({id:sample.id,code:['RATE','NO_FREE','LOCAL_LIMIT','NO_CONSENT','ASSISTANT_ABORT','ASSISTANT_TIMEOUT','MODEL_GONE'].includes(error.code)?error.code:'FAILED',message:'Canlı yanıt tamamlanamadı; eski yanıt kullanılmadı.'});stop=true;}
   finally{scope.dispose();signal?.removeEventListener('abort',abort);}
   onProgress({completed,total:phoneSampleCount(repeats,mode),repeat,mode:run.mode,report});if(stop)break;
  }
  if(!run.failures.length&&Object.keys(run.responses).length===samples.length){run.measurement=measureReal({batch,responses:run.responses});run.measurement.realGemini=report.realGemini;run.measurement.proposalOrigin={origin:'Live response transport; provider authenticity checked separately',model,repeat};run.measurement.limitations=[...report.limitations];}
  if(signal?.aborted)stop=true;
 }
 report.completed=!stop&&completed===phoneSampleCount(repeats,mode);return report;
}

// Explicit owner-approved pseudonym corpus only. No phone DB, Save or real names.
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {assistantContext,assistantSystem,assistantSchema} from '../../../js/assistant-core.js';
import {geminiJson,gatedFetch,assistantRequestScope} from '../../../js/ai-gemini.js';
import {source,cases,fixture,message,fixtureSettings} from './fixture.mjs';
import {measureReal} from './measure.mjs';
const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];
if(process.env.CI||!['--live','--consent','--free-tier-confirmed','--owner-pseudonyms'].every(x=>args.includes(x)))throw Error('CI yasak; açık canlı komut, izin, ücretsiz katman ve takma adlı veri seçimi gerekir.');
for(const k of ['--model','--budget','--repeats','--mode','--usage-file','--output'])if(!args.includes(k)||!value(k)||value(k).startsWith('--'))throw Error('Eksik '+k);
const key=process.env.GEMINI_API_KEY;if(!key)throw Error('GEMINI_API_KEY yok. Anahtar yalnız ortamdan okunur; rapora veya sohbete yazılmaz.');
const budget=Number(value('--budget')),repeats=Number(value('--repeats')),mode=value('--mode'),model=value('--model');
if(!Number.isInteger(budget)||budget<1||budget>100||!Number.isInteger(repeats)||repeats<1||repeats>3||!['single','batch','both'].includes(mode)||!/^[a-z0-9._-]+$/i.test(model))throw Error('Bütçe1–100, tekrar1–3, mod single/batch/both ve geçerli model kimliği gerekir.');
const usagePath=resolve(value('--usage-file')),output=resolve(value('--output'));if(!usagePath.startsWith('/tmp/')||!output.startsWith('/tmp/'))throw Error('Sayaç/çıktı yalnız /tmp altında olmalı.');
const lock=usagePath+'.lock';mkdirSync(lock);let scope,interrupted=false,usage;
const interrupt=()=>{interrupted=true;scope?.abort();};process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
const report={mode:'live-owner-pseudonymized',realGemini:true,model,usedRealNames:false,savedBusinessRecords:0,runs:[],limitations:['Takma adlı kayıtlar ve mesajlar; gerçek telefon veya WhatsApp entegrasyonu ölçülmez.','Başarısız veya eksik ağ yanıtı dondurulmuş planla tamamlanmaz.']};
try{
 try{usage=JSON.parse(readFileSync(usagePath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const db={metaTxn:async(_keys,fn)=>{const r=fn({gemini_consent:true,gemini_daily_limit:budget,gemini_usage:usage});usage=r.set.gemini_usage;writeFileSync(usagePath,JSON.stringify(usage),{mode:0o600});return r.result;},metaUpdate:async(_k,fn)=>{usage=fn(usage);writeFileSync(usagePath,JSON.stringify(usage),{mode:0o600});}};
 for(let repeat=1;repeat<=repeats&&!interrupted;repeat++)for(const batch of mode==='both'?[false,true]:[mode==='batch']){
  const samples=batch?[source.cases.find(c=>c.id==='r00_tumu')]:cases,run={repeat,mode:batch?'batch':'single',responses:{},failures:[],measurement:null};report.runs.push(run);
  for(const c of samples){
   if(interrupted)break;let requests=0;
   const http=gatedFetch(db),once=async(url,init)=>{if(requests++)throw Object.assign(Error('Bir örnek için tek ağ isteği sınırı.'),{code:'SAMPLE_ONCE'});return http(url,init);};
   scope=assistantRequestScope({fetchImpl:once});
   try{
    const parts=[{text:JSON.stringify({context:assistantContext(fixture(),source.today_for_test,message(c)),message:message(c)})}];
    run.responses[c.id]=await geminiJson(parts,{key,model,system:assistantSystem(fixtureSettings().assistant_rules),schema:assistantSchema(),fetchFn:scope.fetchFn});scope.check();
   }catch(e){run.failures.push({id:c.id,code:e.code||e.name||'ERROR',message:'Canlı yanıt tamamlanamadı; dondurulmuş yanıt kullanılmadı.'});if(['RATE','NO_FREE','LOCAL_LIMIT','ASSISTANT_ABORT'].includes(e.code))interrupted=true;}
   finally{scope.dispose();scope=null;writeFileSync(output,JSON.stringify(report,null,2)+'\n',{mode:0o600});}
  }
  if(!run.failures.length&&Object.keys(run.responses).length===samples.length){run.measurement=measureReal({batch,responses:run.responses});run.measurement.realGemini=true;run.measurement.proposalOrigin={origin:'Live Gemini API, exact responses in this run',model,repeat};}
  writeFileSync(output,JSON.stringify(report,null,2)+'\n',{mode:0o600});
 }
 console.log('Takma adlı canlı sonuç ayrı rapora yazıldı: '+output);if(interrupted||report.runs.some(r=>r.failures.length||!r.measurement))process.exitCode=1;
}finally{scope?.dispose();process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);rmSync(lock,{recursive:true});}

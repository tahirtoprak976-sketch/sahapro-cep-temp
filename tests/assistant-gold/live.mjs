// Explicit synthetic-only CLI. Never runs in CI or reads a phone / business database.
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {cases,cards,measure} from './replay.mjs';
import {assistantContext,assistantSystem,assistantSchema} from '../../js/assistant-core.js';
import {geminiJson,gatedFetch,assistantRequestScope} from '../../js/ai-gemini.js';
const args=process.argv.slice(2),value=k=>args[args.indexOf(k)+1];
if(process.env.CI||!['--live','--consent','--free-tier-confirmed'].every(x=>args.includes(x)))throw Error('CI yasak. Açık komut, izin ve ücretsiz katman doğrulaması gerekir.');
for(const key of ['--case','--model','--budget','--usage-file','--output'])if(!args.includes(key)||!value(key)||value(key).startsWith('--'))throw Error(`Eksik ${key}`);
const c=cases.find(c=>c.id===value('--case')),limit=Number(value('--budget'));
if(!c||c.photoTexts.length)throw Error('Bu canlı komut yalnız kayıtlı sentetik metin örneklerini destekler; fotoğraf sınanmış sayılmaz.');
if(!Number.isInteger(limit)||limit<1||limit>10)throw Error('Bütçe 1–10 HTTP isteği olmalı.');
const key=process.env.GEMINI_API_KEY;if(!key)throw Error('GEMINI_API_KEY gerekli; anahtar çıktıya veya rapora yazılmaz.');
const usageFile=resolve(value('--usage-file')),output=resolve(value('--output'));
if(!usageFile.startsWith('/tmp/')||!output.startsWith('/tmp/'))throw Error('Sayaç ve çıktı yalnız /tmp altında olabilir.');
const lock=usageFile+'.lock';mkdirSync(dirname(usageFile),{recursive:true});mkdirSync(lock);
let scope;
try{
 let usage=null;try{usage=JSON.parse(readFileSync(usageFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const db={metaTxn:async(_keys,fn)=>{const result=fn({gemini_consent:true,gemini_daily_limit:limit,gemini_usage:usage});usage=result.set.gemini_usage;writeFileSync(usageFile,JSON.stringify(usage),{mode:0o600});return result.result;},metaUpdate:async(_key,fn)=>{usage=fn(usage);writeFileSync(usageFile,JSON.stringify(usage),{mode:0o600});}};
 scope=assistantRequestScope({timeoutMs:90000,fetchImpl:gatedFetch(db)});
 const interrupt=()=>scope.abort();process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
 try{
  const plan=await geminiJson([{text:JSON.stringify({context:assistantContext({...cards,...c.cardsPatch},'2026-11-02',c.message),message:c.message})}],{key,model:value('--model'),system:assistantSystem(),schema:assistantSchema(),fetchFn:scope.fetchFn});
  scope.check();const result={mode:'live-synthetic',case:c.id,model:value('--model'),measurement:measure([c],{[c.id]:plan}),response:plan};
  writeFileSync(output,JSON.stringify(result,null,2)+'\n',{mode:0o600});console.log(`Sentetik canlı ölçüm yazıldı: ${output}`);
 }finally{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);}
}finally{scope?.dispose();rmSync(lock,{recursive:true});}

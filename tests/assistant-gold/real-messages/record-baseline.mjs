// Independent input bridge: uses the unchanged local parser, never the expected answers.
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {analyzeMessage} from '../../../js/message-engine.js';
import {APP_VERSION} from '../../../js/core.js';
import {source,cases,fixture,message} from './fixture.mjs';
if(APP_VERSION!=='SAHAPRO SOLO v3.10.00')throw Error('Baseline can only be recorded on unchanged v3.10.00');
if(execFileSync('git',['diff','origin/gh-pages','--','js','sw.js','index.html'],{encoding:'utf8'}).trim())throw Error('Application source changed before baseline');
const responses={};
for(const c of [...cases,source.cases.find(c=>c.id==='r00_tumu')]){
 const text=message(c),d=fixture(),a=analyzeMessage({id:c.id,text,date:source.today_for_test},d),plan={works:[],fuel:[]};
 for(const row of a.rows){
  const pos=row.evidence?.quantity?.span?.start??Math.max(0,text.indexOf(row.raw_message||row.description)),headers=[...text.slice(0,pos+1).matchAll(/^\[[^\]]+\]\s*([^:\n]+):/gm)],reporter=headers.at(-1)?.[1]||c.header?.replace(/^\[[^\]]+\]\s*/,'')||'';
  const common={date:row.date,vehicle_id:row.vehicle_id,quote:row.raw_message||row.description||''};
  if(row.kind==='work')plan.works.push({...common,customer_id:row.customer_id,site_id:row.site_id,personnel_id:row.personnel_id,reporter,work_type:row.work_type,quantity:row.quantity,unit:row.unit,description:row.description,from_place:row.quarry||null,to_place:row.dump_area||null,note:(row.notes||[]).join(' · ')});
  else if(row.kind==='fuel')plan.fuel.push({...common,liters:row.fuel_liters,source:row.fuel_source,customer_id:row.customer_id});
 }
 responses[c.id]=plan;
}
writeFileSync(new URL('./recorded-v3.10.00.json',import.meta.url),JSON.stringify({meta:{version:APP_VERSION,baseCommit:execFileSync('git',['rev-parse','origin/gh-pages'],{encoding:'utf8'}).trim(),origin:'unchanged local parser -> untrusted plan bridge',realGemini:false,oracleUsed:false},responses},null,2)+'\n');
console.log('Recorded local-parser proposals independently of owner-approved answers');

import {phoneFailure} from './phone-errors.mjs';
import {runPhoneEvaluation,safePhoneReport,phoneRequestCount} from './phone-engine.mjs';
import {listModels,gatedFetch,assistantRequestScope,usageTotal} from '../../js/ai-gemini.js';
import {source} from './real-messages/fixture.mjs';
import {APP_VERSION} from '../../js/core.js';
const el=id=>document.getElementById(id);let report=null,controller=null,busy=false,config=null,db=null;
function renderReport(value){
 const box=el('result');box.replaceChildren();if(!value)return;
 const title=document.createElement('p');title.textContent=value.completed?'İstenen yanıtların tümü alındı.':'Koşu eksik; tamamlanmış kabul edilmez.';box.append(title);
 const table=document.createElement('table');const head=table.createTHead().insertRow();for(const t of ['Tur / mod','Hazır doğru','Gereksiz soru','Kaçırılan','Yanlış alan','Sessiz yanlış']){const th=document.createElement('th');th.textContent=t;head.append(th);}
 const body=table.createTBody();for(const run of value.runs){const row=body.insertRow(),t=run.measurement?.totals;for(const cell of [run.repeat+' / '+run.mode,t?t.readyCorrect+'/'+t.expectedCards:'Eksik',t?.unnecessaryQuestions??'—',t?.missedQuestions??'—',t?.wrongFields??'—',t?.silentWrong??'—'])row.insertCell().textContent=String(cell);}
 box.append(table);for(const run of value.safety.runs){const p=document.createElement('p'),m=run.measurement;p.textContent='Güvenlik turu '+run.repeat+': '+(m?'sessiz yanlış '+m.silentWrong+' · para tahmini '+m.moneyGuesses+' · zorunlu işaret '+m.mandatoryChecked+' · kart sayısı hatası '+m.cardCountErrors:'Eksik');box.append(p);}
 for(const run of [...value.runs,...value.safety.runs])for(const failure of run.failures||[]){const p=document.createElement('p');p.textContent=failure.id+' · '+failure.code+(failure.httpStatus?' · HTTP '+failure.httpStatus:'')+': '+failure.message;box.append(p);}
 for(const run of value.runs)if(run.measurement){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=run.repeat+' / '+run.mode+' kategori sonuçları';details.append(summary);const pre=document.createElement('pre');pre.textContent=JSON.stringify(run.measurement.categories,null,2);details.append(pre);box.append(details);}
}
function lock(value){busy=value;for(const id of ['key','budget','model','repeats','models','run'])el(id).disabled=value;el('cancel').disabled=!value;el('download').disabled=value||!report;}
async function budget(){const n=Number(el('budget').value);if(!el('consent').checked||!el('key').value||!Number.isInteger(n)||n<1||n>100)throw Error('Önce anahtar, izin ve 1–100 günlük sınırı tamamlayın.');await db.metaSet('gemini_consent',true);await db.metaSet('gemini_daily_limit',n);}
async function refreshUsage(){const d=new Date(),day=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');el('usage').textContent='Bu ayrı sınav ortamında bugün kullanılan: '+usageTotal(await db.metaGet('gemini_usage'),day)+' istek. Sayaç yeniden başlatınca sıfırlanmaz.';}
async function action(kind){
 if(busy||!config||!db)return;controller=new AbortController();lock(true);
 try{
  await budget();
  if(kind==='models'){
   const scope=assistantRequestScope({fetchImpl:gatedFetch(db)}),abort=()=>scope.abort();controller.signal.addEventListener('abort',abort,{once:true});
   try{const items=await listModels(el('key').value,scope.fetchFn);scope.check();el('model').replaceChildren(new Option('Model seçin',''),...items.map(m=>new Option(m.label,m.id)));el('progress').textContent='Modeller listelendi. Ücretsiz erişiminiz olan modeli seçin.';}finally{scope.dispose();controller.signal.removeEventListener('abort',abort);}
  }else{
   if(!el('model').value)throw Error('Önce model seçin.');const repeats=Number(el('repeats').value);const currentDay=new Date(),day=currentDay.getFullYear()+'-'+String(currentDay.getMonth()+1).padStart(2,'0')+'-'+String(currentDay.getDate()).padStart(2,'0');if(Number(el('budget').value)-usageTotal(await db.metaGet('gemini_usage'),day)<phoneRequestCount(repeats,'both')){el('progress').textContent='Kalan günlük bütçe bu koşuya yetmiyor. Daha az tekrar seçin veya ertesi gün deneyin.';return;}el('progress').textContent='0 / '+phoneRequestCount(repeats,'both')+' · Canlı ölçüm başlıyor.';
   report=await runPhoneEvaluation({key:el('key').value,model:el('model').value,db:{metaTxn:db.metaTxn,metaUpdate:db.metaUpdate},sourceSha:config.sourceSha,repeats,mode:'both',signal:controller.signal,onProgress:state=>{report=state.report;el('progress').textContent=state.completed+' / '+state.total+' yanıt · '+state.repeat+'. tur / '+state.mode+(state.pending?' · '+state.pending+' yanıtı bekleniyor…':'');}});
   renderReport(report);el('progress').textContent=report.completed?'Canlı yanıtlar alındı. Sonuç ve ham yanıtları indirebilirsiniz.':'Koşu durdu veya eksik kaldı. Eksik rapor indirilebilir; eski yanıt kullanılmadı.';
  }
 }catch(error){const failure=phoneFailure(error);el('progress').textContent=controller.signal.aborted?'Durduruldu; yeni istek gönderilmeyecek.':'İşlem tamamlanamadı · '+failure.code+': '+failure.message;}
 finally{controller=null;lock(false);await refreshUsage().catch(()=>{});}
}
el('cancel').onclick=()=>controller?.abort();el('consent').onchange=()=>{if(!el('consent').checked){controller?.abort();db?.metaSet('gemini_consent',false).catch(()=>{});}};
el('download').onclick=()=>{if(!report)return;try{const text=safePhoneReport(report,el('key').value),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='SAHAPRO_v311_canli_sinav.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch{el('progress').textContent='Rapor gizli anahtar içerdiği için indirilmedi.';}};
window.addEventListener('pagehide',()=>{controller?.abort();el('key').value='';});
async function main(){
 const url=new URL(location.href),name=url.searchParams.get('db');if(!/^TEST_V311_[a-z0-9_-]{1,20}$/i.test(name||'')){url.searchParams.set('db','TEST_V311_PHONE');location.replace(url.href);return;}
 const response=await fetch('./phone-source.json',{cache:'no-store'});if(!response.ok)throw Error('Kaynak paketi yok.');config=await response.json();if(!/^[a-f0-9]{40}$/i.test(config.sourceSha||'')||config.appVersion!==APP_VERSION)throw Error('Kaynak uyuşmuyor.');
 db=await import('../../js/db.js');const connection=await db.openDB();if(connection.name!=='sahapro_cep_db_'+name)throw Error('Ayrı sınav veritabanı doğrulanamadı.');
 el('source').textContent=APP_VERSION+' · '+config.sourceSha;el('test-date').textContent=source.today_for_test;el('models').disabled=false;el('run').disabled=false;el('models').onclick=()=>action('models');el('run').onclick=()=>action('run');await refreshUsage();
}
main().catch(()=>{el('source').textContent='Doğrulanmış sınav paketi açılmadı. Anahtar göndermek kapalı.';});

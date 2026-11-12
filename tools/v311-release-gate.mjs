// Read-only acceptance audit. Re-score raw live proposals; never trust declared score tables.
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {measureReal} from '../tests/assistant-gold/real-messages/measure.mjs';
import {cases,source} from '../tests/assistant-gold/real-messages/fixture.mjs';
export function checkV311Acceptance(evidence={}){
 const blockers=[],measurements=[];const {live,phone,staged,automation}=evidence;
 if(!automation||!Array.isArray(automation.runs)||!automation.runs.length||automation.runs.some(r=>r.conclusion!=='success'||r.sha!==automation.sourceSha)||!['node','browser','upgrades'].every(k=>Number.isInteger(automation[k]?.expected)&&automation[k].expected>0&&automation[k].passed===automation[k].expected&&automation[k].failed===0))blockers.push('Aynı kaynakta tüm Node/tarayıcı/yükseltme CI kanıtı eksik.');
 if(!staged||staged.sameFieldNodes!==true||!(Number.isFinite(staged.localFirstPaintMs)&&staged.localFirstPaintMs<50&&staged.localFirstPaintMs>=0)||staged.cls!==0||staged.fieldMovePx!==0||staged.manualFieldLoss!==0)blockers.push('İki aşamalı yerel önizleme / aynı alan düğümleri / kaymasız render kanıtı eksik.');
 if(!phone||phone.physical!==true||typeof phone.device!=='string'||!phone.device.trim()||!phone.date||phone.realWhatsApp!==true||phone.lowBrightnessSensitiveCards!==true||phone.sensitiveAutoSaved!==0||phone.manualFieldLoss!==0||!(Number.isFinite(phone.closingSeconds)&&phone.closingSeconds>0&&phone.closingSeconds<=480)||!(Number.isFinite(phone.fourReceiptsSeconds)&&phone.fourReceiptsSeconds>0&&phone.fourReceiptsSeconds<=45))blockers.push('Gerçek telefon / WhatsApp / düşük parlaklık / kapanış ve dört fiş süresi kabulü eksik.');
 if(!live||live.realGemini!==true||live.mode!=='live-owner-pseudonymized'||live.usedRealNames!==false||live.savedBusinessRecords!==0||live.protocol!=='v311-primary-json'||!Array.isArray(live.runs))blockers.push('Ayrı gerçek Gemini referansı eksik; dondurulmuş/yerel sonuç bunun yerine geçmez.');
 else{
  if(!automation?.sourceSha||live.sourceSha!==automation.sourceSha)blockers.push('Gemini ölçümü ile CI kaynak kimliği aynı değil.');
  for(let repeat=1;repeat<=3;repeat++)for(const mode of ['single','batch']){
   const found=live.runs.filter(r=>r.repeat===repeat&&r.mode===mode),run=found[0],expected=mode==='single'?cases.map(c=>c.id):[source.cases.find(c=>c.id==='r00_tumu').id];
   if(found.length!==1||run.failures?.length||!run.responses||Object.keys(run.responses).length!==expected.length||expected.some(id=>!Object.hasOwn(run.responses,id))){blockers.push('Gemini '+repeat+'/'+mode+' yanıtları eksik veya yinelenmiş.');continue;}
   try{const result=measureReal({batch:mode==='batch',responses:run.responses});measurements.push({repeat,mode,totals:result.totals,categories:result.categories});const t=result.totals;if(t.silentWrong!==0||t.missedQuestions!==0||t.missingCards!==0||t.extraCards!==0||t.readyCorrect<(mode==='batch'?28:25)||mode==='batch'&&(t.unnecessaryQuestions>4||t.wrongFields>2))blockers.push('Gemini '+repeat+'/'+mode+' yeniden hesaplanan ölçüm kapısını geçmedi.');}catch{blockers.push('Gemini '+repeat+'/'+mode+' yanıtları yeniden puanlanamadı.');}
  }
  // These safety counters require a separate live safety evaluation; absence is never zero.
  if(!live.safety||live.safety.measured!==true||live.safety.silentWrong!==0||live.safety.moneyGuesses!==0||live.safety.mandatoryChecked!==0)blockers.push('Canlı para tahmini / hassas işaret / sessiz yanlış güvenlik ölçümü eksik veya başarısız.');
 }
 return {ready:!blockers.length,blockers,measurements,limitations:['Kaynak raporunun gerçekliğini kriptografik olarak doğrulamaz; GitHub koşusu ve ölçüm kaynağı ayrıca incelenir.','Ana JSON çıkarımı puanlanır; araçlı sohbet, kota tepkisi ve fiziksel UX ayrı kabul kanıtlarıdır.','Bu araç merge, yayın veya işletme kaydı yazmaz.']};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const input=process.argv[2];if(!input)throw Error('Kullanım: node tools/v311-release-gate.mjs kanit.json [rapor.json]');
 const result=checkV311Acceptance(JSON.parse(readFileSync(input,'utf8')));if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exitCode=result.ready?0:1;
}

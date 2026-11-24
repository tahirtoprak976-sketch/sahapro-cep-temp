import {qs,esc,notice,toast} from './ui.js';
import {assistantRequestScope,probeGeminiConnection,geminiFailureSummary} from './ai-gemini.js';
// Ephemeral connection state only. Existing cards, message and pending files are never replaced.
export function mountAssistantConnection({root,db},{isBusy=()=>false,onDispose}={}) {
 const panel=qs('[data-connection-report]',root),open=qs('[data-connection-open]',root);let running=false,scope=null,closed=false;
 const base='<p class="small">Bu test yalnız seçili modele kısa bir bağlantı isteği gönderir. Belgeniz, mesajınız ve işletme kayıtlarınız gönderilmez. Günlük bütçeden 1 istek düşer; okuma başarısını ölçmez.</p>';
 const controls='<div class="row" style="gap:6px;flex-wrap:wrap"><button type="button" class="btn" data-connection-test>Bağlantıyı sına · 1 istek</button><a class="btn" href="#/yapay-zeka">Model ve izin ayarları</a><button type="button" class="btn" data-connection-hide>Kapat</button></div>';
 const paint=content=>{if(closed||!panel.isConnected)return;panel.hidden=false;panel.innerHTML='<h3>Gemini bağlantı kontrolü</h3>'+content+base+controls;};
 const issue=error=>{if(running)return;const r=geminiFailureSummary(error);paint(notice('warn',r.title)+`<p class="small" data-connection-result>${esc(r.message)}</p><p class="tiny muted" style="overflow-wrap:anywhere" data-connection-details>Model: ${esc(r.model)} · Kod: ${esc(r.code)}${r.status?' · HTTP '+r.status:''}${r.attempts?' · Okuma denemesi: '+r.attempts:''}</p>`);};
 open.onclick=()=>{if(running){panel.hidden=false;return;}if(panel.hidden)paint('<p class="small">Seçili modelle işletme verisi göndermeden küçük bir test yapabilirsiniz.</p>');else panel.hidden=true;};
 const listener=async event=>{
  if(event.target.closest('[data-connection-cancel]')){scope?.abort();return;}
  if(event.target.closest('[data-connection-hide]')){if(running)scope?.abort();panel.hidden=true;return;}
  if(!event.target.closest('[data-connection-test]')||running)return;
  if(isBusy())return toast('Önce açık okuma tamamlanmalı veya durdurulmalı.','err');
  running=true;scope=assistantRequestScope({timeoutMs:15000,maxBytes:65536});
  const send=qs('[data-ask]',root),wasDisabled=send.disabled;send.disabled=true;
  panel.innerHTML='<h3>Gemini bağlantısı sınanıyor</h3><p class="small">Tek kısa istek · işletme verisi gönderilmiyor.</p><button type="button" class="btn" data-connection-cancel>Testi durdur</button>';
  try {
   const r=await probeGeminiConnection(db,{scope});
   paint(notice('ok','Google API yanıt verdi')+`<p class="small" style="overflow-wrap:anywhere" data-connection-result>Model: ${esc(r.model)} · HTTP ${r.status}. Bu sonuç yalnız bağlantı içindir; PDF veya iş kaydı okunmadı.</p>`);
  }catch(error){running=false;if(!closed&&panel.isConnected&&!panel.hidden)issue(error);}
  finally{scope?.dispose();scope=null;running=false;if(send.isConnected)send.disabled=wasDisabled;}
 };
 panel.addEventListener('click',listener);
 const dispose=()=>{closed=true;scope?.abort();panel.removeEventListener('click',listener);};onDispose?.(dispose);open.disabled=false;
 return {issue,isBusy:()=>running,dispose};
}

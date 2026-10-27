import {qs,qsa,esc,confirmDialog,toast} from './ui.js';
import {CAPABILITY_CATALOG as ASSISTANT_TASKS} from './assistant-capabilities.js';
export {ASSISTANT_TASKS};
const fold=s=>String(s||'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
export function searchAssistantTasks(query='',group=''){
 const q=fold(query).trim();return ASSISTANT_TASKS.filter(x=>(!group||x.group===group)&&fold(x.title+' '+x.detail+' '+(x.text||'')).includes(q));
}
export function guideHTML(){
 return '<details class="card assistant-guide" data-assistant-guide><summary><b>Neler yapabilirim?</b><span class="muted small">İşlem rehberi ve komut örnekleri</span></summary><p class="small muted">Örnek seçmek mesajı doldurur; kendiliğinden göndermez veya kayıt değiştirmez.</p><label class="field">İşlem ara<input type="search" data-guide-search placeholder="Örn: PDF, mazot, tahsilat…" autocomplete="off"></label><div class="ultimate-periods" role="group" aria-label="İşlem grubu">'+['','Rapor','Kayıt','Aktarım','Kontrol'].map(g=>'<button class="btn sm" data-guide-group="'+g+'" aria-pressed="'+(!g)+'">'+(g||'Tümü')+'</button>').join('')+'</div><div data-guide-list></div><p class="tiny muted">Form işlemleri ve yerel özetler internetsiz çalışır. Gemini ile mesaj/fotoğraf okuma için internet, anahtar ve veri gönderme izni gerekir.</p></details>';
}
export function bindGuide(root,db){
 const guide=qs('[data-assistant-guide]',root);if(!guide)return;
 let group='';const box=qs('[data-guide-list]',guide);
 const draw=()=>{
  const rows=searchAssistantTasks(qs('[data-guide-search]',guide).value,group);
  box.innerHTML=rows.map(x=>'<button class="ultimate-task" data-guide-task="'+x.id+'"><span class="badge">'+x.group+'</span><b>'+esc(x.title)+'</b><small>'+esc(x.detail)+'</small><span>'+(x.text?'Örneği mesaja yaz':'Ekranı aç')+' ›</span></button>').join('')||'<p class="muted">Eşleşen işlem yok. Başka bir kelime deneyin.</p>';
 };
 qs('[data-guide-search]',guide).addEventListener('input',draw);
 for(const b of qsa('[data-guide-group]',guide))b.onclick=()=>{group=b.dataset.guideGroup;for(const other of qsa('[data-guide-group]',guide))other.setAttribute('aria-pressed',String(other===b));draw();};
 let busy=false;
 box.addEventListener('click',async e=>{
  const id=e.target.closest('[data-guide-task]')?.dataset.guideTask;if(!id||busy)return;
  const task=ASSISTANT_TASKS.find(x=>x.id===id),msg=qs('[data-msg]',root);if(!task||!msg)return;
  const hasFiles=!!qs('[data-thumbs] img,[data-thumbs] audio',root)||!!qs('[data-photos]',root)?.files?.length;
  busy=true;
  try{
   if(task.text){
    if(hasFiles){toast('Yerel komut için önce Ekleri temizle düğmesine basın. Dosyalar otomatik kaldırılmaz.','err');return;}
    if(msg.value.trim()&&msg.value.trim()!==task.text&&!(await confirmDialog('Mesaj örnekle değişsin mi?','Yazdığınız mesajın yerine seçilen örnek gelecek. Dosyalar korunur; henüz gönderim yapılmaz.','Örneği yaz')))return;
    if(!root.isConnected)return;msg.value=task.text;const refine=qs('[data-refine]',root);if(refine)refine.checked=false;
    msg.dispatchEvent(new Event('input',{bubbles:true}));msg.focus();msg.scrollIntoView({block:'center',behavior:'smooth'});toast('Örnek hazır. Düzenleyip Asistana Gönder’e basın.','ok');
   }else{
    if((msg.value.trim()||hasFiles)&&!(await confirmDialog('Başka ekrana geçilsin mi?','Yazılı taslak saklanır; seçili fotoğraf ve sesler bu ekrandan ayrılınca yeniden eklenebilir.','Ekranı aç')))return;
    if(!root.isConnected)return;await db.metaSet('assistant_draft',msg.value);if(root.isConnected)location.hash=task.hash;
   }
  }catch(e){toast(e.message||String(e),'err');}finally{busy=false;}
 });
 draw();
}

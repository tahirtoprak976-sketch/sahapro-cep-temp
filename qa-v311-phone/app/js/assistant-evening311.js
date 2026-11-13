// Session-only ergonomics. This module never writes business records or a new storage shape.
import {isActive,todayStr} from './core.js';
export function dailyCoverage(d,today){
 const vehicles=(d.vehicles||[]).filter(isActive),active=new Set(vehicles.map(v=>v.id)),worked=new Set((d.work_records||[]).filter(r=>isActive(r)&&r.date===today&&active.has(r.vehicle_id)).map(r=>r.vehicle_id));
 return {worked:worked.size,missing:vehicles.filter(v=>!worked.has(v.id)).map(v=>({id:v.id,name:v.plate||v.name||'Araç'}))};
}
export function createUndoWindow(now=()=>Date.now()){
 let expires=0,entries=[];
 return {set(next){entries=next;expires=now()+5000;},undo(){const saved=entries;entries=[];if(now()>=expires)return 0;let restored=0;for(const e of saved)if(e.valid()){e.restore();restored++;}return restored;},clear(){entries=[];}};
}
export function mountEveningPage({root}){
 const workspace=root.querySelector('[data-assistant-page]');if(!workspace)return ()=>{};
 document.body.classList.add('assistant-evening');workspace.classList.add('assistant-evening-workspace');
 const composer=root.querySelector('[data-composer]'),message=root.querySelector('[data-msg]'),paste=document.createElement('button');paste.type='button';paste.className='btn sm assistant-clipboard';paste.dataset.clipboardPaste='';paste.textContent='📋 Yapıştır';paste.setAttribute('aria-label','Panodaki metni mesajın sonuna yapıştır');composer.prepend(paste);
 const status=document.createElement('span');status.className='tiny muted';status.hidden=true;status.setAttribute('role','status');paste.after(status);
 const entry=document.createElement('div');entry.className='assistant-message-entry';message.before(entry);entry.append(message,paste);entry.after(status);
 // Clipboard reads only follow a gesture; returning to the app merely offers the action.
 paste.onclick=async()=>{status.hidden=false;try{if(!navigator.clipboard?.readText)throw Error('Bu tarayıcıda kutuya basılı tutup Yapıştır seçin.');const text=await navigator.clipboard.readText();if(!workspace.isConnected)return;if(message.readOnly||root.querySelector('[data-ask]')?.disabled){status.textContent='Okuma bitince yapıştırabilirsiniz.';return;}if(!text.trim()){status.textContent='Panoda metin bulunamadı.';return;}message.value=[message.value,text].filter(Boolean).join('\n');message.dispatchEvent(new Event('input',{bubbles:true}));message.focus();status.textContent=text.split(/\r?\n/).length+' satır eklendi; henüz okunmadı.';}catch(e){status.textContent=e.name==='NotAllowedError'?'Kutuyu basılı tutup Yapıştır seçin.':e.message;}};
 const visibility=()=>{if(document.visibilityState==='visible')paste.title='WhatsApp metnini panodan ekleyebilirsiniz.';};document.addEventListener('visibilitychange',visibility);
 return ()=>{document.removeEventListener('visibilitychange',visibility);document.body.classList.remove('assistant-evening');};
}
export function coverageText(d,rows){
 const c=dailyCoverage(d,todayStr()),pending=rows.filter(r=>!r.saved&&r.card.classList.contains('assistant-sensitive-record')).length;
 return 'Bugün: '+c.worked+' araçta iş kaydı'+(c.missing.length?' · '+c.missing.length+' araçta kayıt görünmüyor ('+c.missing.slice(0,3).map(v=>v.name).join(', ')+(c.missing.length>3?'…':'')+')':'')+' · '+pending+' hassas kart kaydedilmedi. Eksik kayıt otomatik iş anlamına gelmez.';
}

// The picker edits one existing draft control, never creates or saves a record.
export function mountDraftPicker(out,workflow,changed=()=>{}){
 const dialog=document.createElement('dialog');dialog.className='assistant-inline-picker';dialog.dataset.inlinePicker='';dialog.innerHTML='<header><h3>Kayıtlardan seç</h3><button type="button" class="btn" data-picker-close>Kapat</button></header><label>Kayıt ara<input type="search" data-picker-search autocomplete="off"></label><p class="tiny muted">İlk üç seçenek; aramayla diğer kayıtları bulun. Yalnız bu alan güncellenir.</p><div data-picker-options></div><p role="status" data-picker-status></p>';out.append(dialog);
 let current=null;const search=dialog.querySelector('[data-picker-search]'),options=dialog.querySelector('[data-picker-options]'),status=dialog.querySelector('[data-picker-status]');
 const draw=()=>{options.replaceChildren();if(!current)return;const q=search.value.toLocaleLowerCase('tr-TR').trim();for(const option of [...current.control.options].filter(o=>o.value&&o.textContent.toLocaleLowerCase('tr-TR').includes(q)).slice(0,q?30:3)){const b=document.createElement('button');b.type='button';b.className='btn block';b.dataset.pickerValue=option.value;b.textContent=option.textContent;options.append(b);}if(!options.childElementCount)options.textContent='Kayıt bulunamadı; farklı bir ad veya plaka arayın.';};
 const open=badge=>{const control=badge.closest('.field')?.querySelector('select[name]'),card=badge.closest('.card[data-kind]');if(!control||control.disabled||!card||card.dataset.saved==='1')return;current={control,card,key:card.dataset.kind+':'+card.dataset.i,value:control.value};search.value='';status.textContent='';draw();dialog.showModal();search.focus();};
 const activate=e=>{const badge=e.target.closest?.('[data-field-confidence][data-level=BILINMIYOR]');if(!badge||!badge.closest('.field')?.querySelector('select[name]'))return;if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;e.preventDefault();open(badge);};out.addEventListener('click',activate);out.addEventListener('keydown',activate);search.oninput=draw;
 dialog.querySelector('[data-picker-close]').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{const button=e.target.closest('[data-picker-value]');if(!button||!current)return;const {control,card,key,value}=current;if(!control.isConnected||control.disabled||card.dataset.saved==='1'||control.value!==value){status.textContent='Kart değişti. Son düzenleme korundu; kapatıp yeniden seçin.';return;}workflow.apply({key,updates:{[control.name]:button.dataset.pickerValue}},'Kart içinden seçim');dialog.close();changed();});
 for(const badge of out.querySelectorAll('[data-field-confidence][data-level=BILINMIYOR]'))if(badge.closest('.field')?.querySelector('select[name]')){badge.tabIndex=0;badge.setAttribute('role','button');badge.setAttribute('aria-label',badge.dataset.fieldConfidence+' alanını kayıtlardan seç');}
 return ()=>{if(dialog.open)dialog.close();out.removeEventListener('click',activate);out.removeEventListener('keydown',activate);};
}

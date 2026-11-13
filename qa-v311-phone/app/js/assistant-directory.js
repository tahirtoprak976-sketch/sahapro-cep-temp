// Explicit offline vehicle/personnel card proposals; no financial or driver-link fields.
import {VEHICLE_TYPES} from './vehicle-type-core.js';
import {foldTr} from './parser.js';
import {customerNameKey} from './driver-customer.js';
import {isActive} from './core.js';
import {qs,esc,notice} from './ui.js';
export function directoryCreateRequest(text){
 const raw=String(text||'').trim(),f=foldTr(raw),word='(?:arac|makine|personel)',verb='(?:olustur|ekle|ac|olusturmak istiyorum|eklemek istiyorum|acmak istiyorum)';
 const empty=new RegExp('^(?:yeni )?('+word+')(?: kart[iı])?(?: '+verb+')?[.!?]?$','u').exec(f);
 if(empty)return {store:empty[1]==='personel'?'personnel':'vehicles',name:''};
 const named=new RegExp('^(.+?) (?:adinda|isimli|isminde) (?:yeni )?('+word+') '+verb+'[.!?]?$','u').exec(f);
 if(named&&!/[<>\n\r]/u.test(raw))return {store:named[2]==='personel'?'personnel':'vehicles',name:raw.slice(0,named[1].length).trim()};
 return null;
}
export function showDirectoryCreate(ctx,out,request,records,conversation,turn){
 const vehicle=request.store==='vehicles',label=vehicle?'Araç / makine':'Personel',route=vehicle?'filo':'personel';
 out.innerHTML=`<section class="card assistant-entity-card" data-directory-create><div class="assistant-section-label">YENİ KART · ${vehicle?'ARAÇ / MAKİNE':'PERSONEL'}</div><h2>${label} bilgilerini tamamlayın</h2><div class="field"><label for="as-directory-name">${vehicle?'Araç / makine adı':'Ad soyad'}</label><input id="as-directory-name" data-directory-name maxlength="120" value="${esc(request.name||'')}"></div>${vehicle?`<div class="field"><label for="as-directory-type">Araç türü</label><select id="as-directory-type" data-directory-type><option value="">Tür seçin</option>${VEHICLE_TYPES.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></div><div class="field"><label for="as-directory-plate">Plaka (makinede boş kalabilir)</label><input id="as-directory-plate" data-directory-plate maxlength="20" placeholder="Plaka yazın"></div>`:'<div class="field"><label for="as-directory-phone">Telefon (isteğe bağlı)</label><input id="as-directory-phone" data-directory-phone type="tel" maxlength="40"></div>'}<div data-directory-matches aria-live="polite"></div><p data-directory-error role="alert" class="small"></p><button class="btn primary block" data-create-directory disabled>${vehicle?'Aracı':'Personeli'} oluştur</button><button class="btn block" data-cancel-directory>Vazgeç</button><p class="tiny muted">Yalnız kart açılır. ${vehicle?'Fiyat, iş veya yakıt hareketi yazılmaz.':'Ücret, avans veya şoför bağlantısı oluşturulmaz.'}</p></section>`;
 const box=qs('[data-directory-create]',out),name=qs('[data-directory-name]',box),button=qs('[data-create-directory]',box),error=qs('[data-directory-error]',box);let busy=false;
 const capture=()=>({name:name.value,...(vehicle?{type:qs('[data-directory-type]',box).value,plate:qs('[data-directory-plate]',box).value}:{phone:qs('[data-directory-phone]',box).value})});
 const refresh=()=>{
  const fields=capture(),plate=String(fields.plate||'').toLocaleUpperCase('tr-TR').replace(/[\s-]+/g,'');
  const matches=records.filter(r=>isActive(r)&&(vehicle&&plate?String(r.plate||'').toLocaleUpperCase('tr-TR').replace(/[\s-]+/g,'')===plate:customerNameKey(r.name)===customerNameKey(fields.name)));
  qs('[data-directory-matches]',box).innerHTML=matches.length?notice('info','Bu kart zaten var. Mevcut kaydı kullanın.')+matches.map(r=>`<button class="btn block" data-go="#/${route}/${esc(r.id)}">${esc(r.name)}${r.plate?' · '+esc(r.plate):''}</button>`).join(''):'';
  button.disabled=busy||name.value.trim().length<2||!!matches.length||vehicle&&!fields.type;
 };
 for(const el of box.querySelectorAll('input,select')){el.addEventListener('input',refresh);el.addEventListener('change',refresh);}
 qs('[data-cancel-directory]',box).onclick=async()=>{if(busy)return;box.remove();await conversation.finish(turn,{status:'cancelled',reply:label+' taslağından vazgeçildi; kayıt açılmadı.'});};
 button.onclick=async()=>{
  if(busy||button.disabled||!box.isConnected||qs('[data-ask]',ctx.root)?.disabled)return;
  busy=true;const fields=capture(),controls=[...ctx.root.querySelectorAll('button,input,select,textarea')].filter(e=>!e.disabled);for(const el of controls)el.disabled=true;
  try{
   const rec=await ctx.db.ensureAssistantDirectoryCard(request.store,fields,{conversation:turn}),reply=rec._existing?'Kart zaten kayıtlıydı; ikinci kayıt açılmadı.':label+' kartı oluşturuldu.';
   out.innerHTML=notice('ok',reply)+`<button class="btn primary block" data-go="#/${route}/${esc(rec.id)}">${label} kartını aç</button>`;
   try{await conversation.receipt(turn,{status:'saved',reply});}catch{out.insertAdjacentHTML('beforeend',notice('warn','Kart kaydedildi; sohbet notu güncellenemedi.'));}
  }catch(e){error.textContent='Kart oluşturulamadı: '+e.message;}
  finally{busy=false;for(const el of controls)if(el.isConnected)el.disabled=false;if(box.isConnected)refresh();}
 };
 refresh();box.scrollIntoView({block:'start'});
}

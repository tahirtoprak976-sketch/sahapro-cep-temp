// Local site proposals use existing site/customer fields. Only the explicit button writes.
import {foldTr} from './parser.js';
import {customerNameKey,customerLabel} from './driver-customer.js';
import {isActive} from './core.js';
import {qs,esc,notice} from './ui.js';
export function siteCreateRequest(text){
 const raw=String(text||'').trim(),f=foldTr(raw);
 if(/^(?:yeni\s+)?santiye(?:\s+karti)?(?:\s+(?:olustur|ekle|ac|olusturmak istiyorum|eklemek istiyorum|acmak istiyorum))?[.!?]?$/u.test(f))return {name:''};
 const m=/^(?:yeni\s+)?santiye\s*:\s*(.{2,120})$/u.exec(f);
 if(m)return {name:raw.slice(raw.indexOf(':')+1).trim()};
 const named=/^(.+?)\s+(?:adinda|isimli|isminde)\s+(?:yeni\s+)?santiye\s+(?:olustur|ekle|ac)[.!?]?$/u.exec(f);
 if(named){const name=raw.slice(0,named[1].length).trim();if(!/[<>\n\r]/u.test(name))return {name};}
 return null;
}
export function showSiteCreate(ctx,out,request,customers,conversation,turn){
 const live=customers.filter(isActive);
 out.innerHTML=`<section class="card assistant-entity-card" data-site-create><div class="assistant-section-label">YENİ KART · ŞANTİYE</div><h2>Şantiyeyi müşterisine bağlayın</h2><p class="small muted">Adı ve müşteriyi kontrol edin. Adres isteğe bağlıdır.</p><div class="field"><label for="as-site-name">Şantiye adı</label><input id="as-site-name" data-site-name maxlength="120" value="${esc(request.name||'')}" autocomplete="off"></div><div class="field"><label for="as-site-customer">Müşteri</label><select id="as-site-customer" data-site-customer><option value="">Müşteri seçin</option>${live.map(c=>`<option value="${esc(c.id)}">${esc(customerLabel(c,live))}</option>`).join('')}</select></div><button type="button" class="btn ghost" data-site-new-customer>Önce yeni müşteri oluştur</button><div class="field"><label for="as-site-address">Adres (isteğe bağlı)</label><textarea id="as-site-address" data-site-address maxlength="300" rows="2"></textarea></div><div data-site-matches aria-live="polite"></div><label class="history-check small" data-site-separate-wrap hidden><input type="checkbox" data-site-separate> Benzer şantiyelerden ayrı yeni bir kart oluştur</label><p data-site-error role="alert" class="small"></p><button class="btn primary block" data-create-site disabled>Şantiyeyi oluştur</button><button class="btn block" data-cancel-site>Vazgeç</button><p class="tiny muted">Bu işlem yalnız şantiye kartı açar; iş, fiyat, borç veya tahsilat oluşturmaz.</p></section>`;
 const box=qs('[data-site-create]',out),name=qs('[data-site-name]',box),customer=qs('[data-site-customer]',box),address=qs('[data-site-address]',box),button=qs('[data-create-site]',box),error=qs('[data-site-error]',box),separate=qs('[data-site-separate]',box);let busy=false,sites=[],loaded=false;
 const refresh=()=>{
  const key=customerNameKey(name.value),scoped=sites.filter(s=>isActive(s)&&s.customer_id===customer.value),exact=scoped.filter(s=>customerNameKey(s.name)===key),similar=scoped.filter(s=>!exact.includes(s)&&key.length>=2&&(customerNameKey(s.name).includes(key)||key.includes(customerNameKey(s.name))));
  qs('[data-site-matches]',box).innerHTML=exact.length?notice('info','Bu müşteride aynı adlı şantiye zaten var. Mevcut kartı kullanın.')+exact.map(s=>`<button class="btn block" data-go="#/santiyeler/${esc(s.id)}">${esc(s.name)} kartını aç</button>`).join(''):similar.length?notice('warn','Benzer şantiye var: '+similar.map(s=>s.name).join(', ')):'';
  qs('[data-site-separate-wrap]',box).hidden=!similar.length||!!exact.length;
  button.disabled=busy||!loaded||name.value.trim().length<2||!customer.value||!!exact.length||!!similar.length&&!separate.checked;
 };
 const changed=()=>{separate.checked=false;error.textContent='';refresh();};name.oninput=changed;customer.onchange=changed;separate.onchange=refresh;
 ctx.db.listActive('sites').then(rows=>{sites=rows;loaded=true;if(box.isConnected)refresh();}).catch(e=>{error.textContent='Şantiyeler okunamadı: '+e.message;button.disabled=true;});
 qs('[data-cancel-site]',box).onclick=async()=>{if(busy)return;box.remove();await conversation.finish(turn,{status:'cancelled',reply:'Şantiye taslağından vazgeçildi; kayıt açılmadı.'});};
 qs('[data-site-new-customer]',box).onclick=async()=>{if(busy)return;try{await ctx.assistantOpenCustomer?.({siteDraft:{name:name.value,address:address.value},siteTurn:turn});}catch(e){error.textContent=e.message;}};
 button.onclick=async()=>{
  if(busy||button.disabled||!box.isConnected||qs('[data-ask]',ctx.root)?.disabled)return;
  busy=true;const controls=[...ctx.root.querySelectorAll('button,input,select,textarea')].filter(e=>!e.disabled);for(const el of controls)el.disabled=true;
  try{
   const rec=await ctx.db.ensureSiteCard(name.value,customer.value,{address:address.value,conversation:turn});
   const reply=rec._existing?'Şantiye zaten kayıtlıydı; ikinci kart açılmadı.':'Şantiye oluşturuldu.';
   out.innerHTML=notice('ok',reply)+`<button class="btn primary block" data-go="#/santiyeler/${esc(rec.id)}">Şantiye kartını aç</button>`;
   try{await conversation.receipt(turn,{status:'saved',reply});}catch{out.insertAdjacentHTML('beforeend',notice('warn','Şantiye kaydedildi; sohbet notu güncellenemedi.'));}
  }catch(e){error.textContent='Şantiye oluşturulamadı: '+e.message;}
  finally{busy=false;for(const el of controls)if(el.isConnected)el.disabled=false;if(box.isConnected)refresh();}
 };
 refresh();box.scrollIntoView({block:'start'});return {setCustomer:id=>{customer.value=id;refresh();}};
}

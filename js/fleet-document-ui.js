import {fleetDocumentModel,documentCountdown,documentVehicle} from './fleet-document-core.js';
import {validDate} from './driver-delivery.js';
import {watchRecords} from './record-refresh.js';
import {todayStr,isActive} from './core.js';
import {appbar,esc,notice,qs,trDate,fDate,fText,toast,go} from './ui.js';

const enc=value=>esc(encodeURIComponent(value));
const tone=row=>row.state==='overdue'||row.state==='today'?'danger':['soon','unknown','invalid','owner','future'].includes(row.state)?'warn':'ok';
export const fleetDocumentURL=id=>'#/filo-belgeleri'+(id?'?vehicle_id='+encodeURIComponent(id):'');
export const newVehicleDocumentURL=id=>'#/belgeler/new?owner_type=vehicle'+(id?'&owner_id='+encodeURIComponent(id):'');
async function readFleet(db){
  const connection=await db.openDB();return new Promise((resolve,reject)=>{
    const t=connection.transaction(['vehicles','documents','maintenance_records'],'readonly'),data={};
    for(const key of ['vehicles','documents','maintenance_records']){const r=t.objectStore(key).getAll();r.onsuccess=()=>data[key]=r.result;}
    t.oncomplete=()=>resolve(data);t.onabort=t.onerror=()=>reject(t.error||Error('Araç belgeleri okunamadı.'));
  });
}
// Updates only the document region; editable vehicle fields and open forms survive.
export async function watchFleetDocuments(ctx,paint){
  const {root,db}=ctx,database=(await db.openDB()).name;let serial=0,timer,closed=false;
  if(!root.isConnected)return ()=>{};
  const update=async()=>{const own=++serial;try{const data=await readFleet(db);if(!closed&&root.isConnected&&own===serial)paint(data);}
    catch(e){if(!closed&&root.isConnected&&own===serial)paint(null,e);}};
  const visible=()=>{if(document.visibilityState!=='hidden')update();};
  const midnight=()=>{const now=new Date();timer=setTimeout(()=>{visible();midnight();},new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).getTime()-now.getTime()+1000);};
  const unwatch=watchRecords(m=>{if(m.database===database&&m.stores.some(s=>['documents','vehicles'].includes(s)))update();});
  const observer=new MutationObserver(()=>{if(!root.isConnected)stop();});
  const stop=()=>{if(closed)return;closed=true;clearTimeout(timer);unwatch();observer.disconnect();window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
  observer.observe(document.body,{childList:true,subtree:true});window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);midnight();await update();return stop;
}
export function fleetDocumentBadge(row){return row?`<span class="badge ${tone(row)}" data-fleet-doc-countdown>${esc(row.label)}</span>`:'<span class="badge" data-fleet-doc-countdown>Süreli belge kaydı yok</span>';}
export function fleetDocumentRow(row,model){
  const d=row.doc,vehicle=row.vehicle,name=vehicle?.name||'Araç eşleşmesi kontrol edilmeli';
  return `<article class="card fleet-doc-row fleet-doc-${row.state}" data-fleet-doc-row="${enc(d.id)}" data-doc-state="${row.state}"><div class="fleet-doc-heading"><div><a class="fleet-doc-vehicle" href="${vehicle?'#/filo/'+enc(vehicle.id):'#/belgeler/'+enc(d.id)}">${esc(name)}</a><h2>${esc(d.category||'Belge')}</h2>${d.doc_no?`<span class="small muted">Belge no: ${esc(d.doc_no)}</span>`:''}</div><strong class="fleet-doc-counter ${tone(row)}">${esc(row.label)}</strong></div>
    <p class="small">Bitiş: <b>${esc(d.expiry_date?trDate(d.expiry_date):'Girilmemiş')}</b> · Belge tarihi: ${esc(d.date?trDate(d.date):'Girilmemiş')}${d.valid_from?' · Geçerlilik başlangıcı: '+esc(trDate(d.valid_from)):''}</p>
    ${row.progress!=null?`<div class="fleet-doc-progress" role="progressbar" aria-label="Belge süresinin geçen bölümü" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(row.progress)}"><span class="${tone(row)}" style="width:${row.progress}%"></span></div>`:''}
    ${row.state==='future'?'<p class="small muted">Bu belge henüz başlamadı. Önceki belgenin kalan süresi ayrı takip edilir.</p>':''}
    <div class="fleet-doc-actions"><a class="btn sm" href="#/belgeler/${enc(d.id)}">Belgeyi aç</a>${vehicle?`<a class="btn sm" href="#/belge-suresi/${enc(d.id)}">Tarihi kontrol et / düzelt</a>`:''}</div>
    ${row.history.length?`<details class="fleet-doc-history"><summary>Önceki belgeler (${row.history.length})</summary>${row.history.map(old=>`<p class="small"><a href="#/belgeler/${enc(old.id)}">${esc(old.category)} · ${esc(old.doc_no||'Numara yok')} · ${esc(old.expiry_date?trDate(old.expiry_date):'Bitiş yok')}</a> — önceki kayıt</p>`).join('')}</details>`:''}</article>`;
}
export function fleetDocumentHome(model){
  const c=model.counts,urgent=model.rows.filter(r=>['overdue','today','soon','invalid','unknown','owner'].includes(r.state));
  return `<section class="card fleet-doc-home" data-fleet-document-home><div class="row between"><h2>Filo belge süreleri</h2><a class="btn sm" href="${fleetDocumentURL()}">Tümü →</a></div><p class="small">${c.overdue} süresi geçmiş · ${c.today} bugün bitiyor · ${c.soon} belge 30 gün içinde${c.review?' · '+c.review+' tarih / sahip kontrolü':''}</p>${urgent.slice(0,3).map(r=>`<a class="fleet-doc-home-row" href="#/belgeler/${enc(r.doc.id)}"><span>${esc(r.vehicle?.name||'Araç kontrolü')} · ${esc(r.doc.category)}</span>${fleetDocumentBadge(r)}</a>`).join('')}${!model.rows.length?'<p class="small muted">Araç belgelerini ekleyince kalan günleri burada görebilirsiniz.</p>':''}</section>`;
}
export async function mountFleetHome(ctx){
  const holder=qs('[data-fleet-home-mount]',ctx.root);if(!holder)return;
  await watchFleetDocuments(ctx,(data,error)=>{holder.innerHTML=error?notice('warn','Belge süreleri okunamadı. Yeniden açın.'):fleetDocumentHome(fleetDocumentModel(data));});
}
export async function mountVehicleDocuments(ctx,id){
  const holder=qs('[data-vehicle-documents]',ctx.root);if(!holder)return;
  await watchFleetDocuments(ctx,(data,error)=>{
    if(error){holder.innerHTML=notice('warn','Belge süreleri okunamadı. Yeniden açın.');return;}
    const model=fleetDocumentModel(data,{vehicle_id:id,includeInactive:true});
    holder.innerHTML=`<div class="fleet-doc-actions"><a class="btn" href="${fleetDocumentURL(id)}">Belge süreleri</a><a class="btn" href="${newVehicleDocumentURL(id)}">+ Araç belgesi ekle</a></div>`+model.selected.map(r=>fleetDocumentRow(r,model)).join('')+(model.selected.length?'':notice('info','Bu araca ait belge kaydı yok. Muayene, sigorta veya diğer araç belgesini ekleyin.'));
  });
}
export async function fleetDocumentScreen(ctx){
  const {root,query={}}=ctx;let data=null;
  const statuses={all:'Tümü',overdue:'Süresi geçen',today:'Bugün biten',week:'7 gün içinde',soon:'30 gün içinde',review:'Tarih / sahip kontrolü',future:'Henüz başlamadı'};
  let status=Object.hasOwn(statuses,query.status)?query.status:'all';
  root.innerHTML=appbar('Filo Belge Süreleri','Muayene · sigorta · kasko · diğer araç belgeleri',{back:'#/filo'})+`<div class="fleet-doc-actions"><a class="btn" data-fleet-doc-add href="${newVehicleDocumentURL(query.vehicle_id)}">+ Araç belgesi ekle</a><button class="btn" data-fleet-doc-refresh>Yenile</button></div><details class="card" data-fleet-document-controls><summary data-fleet-filter-summary>Filtrele · araç / belge</summary><label class="field">Araç / makine<select data-fleet-doc-vehicle aria-label="Araç / makine"></select></label><label class="field">Belge / plaka ara<input type="search" data-fleet-doc-search value="${esc(query.q||'')}" placeholder="Plaka, belge türü veya numarası"></label><label class="history-check"><input type="checkbox" data-fleet-doc-passive ${query.passive==='1'?'checked':''}> Pasif araçları da göster</label><p class="small muted">Gün sayısı cihazın bugünkü tarihine göre hesaplanır. Yeni belge henüz başlamadıysa eski belgenin sayacı korunur.</p></details><div data-fleet-doc-counts></div><div class="fleet-doc-filters" data-fleet-doc-filters></div><div data-fleet-doc-list aria-live="polite"></div>`;
  const vehicle=qs('[data-fleet-doc-vehicle]',root),search=qs('[data-fleet-doc-search]',root),passive=qs('[data-fleet-doc-passive]',root);let selected=query.vehicle_id||'';
  const draw=()=>{
    if(!data)return;
    const model=fleetDocumentModel(data,{includeInactive:passive.checked,vehicle_id:selected,q:search.value,status});
    vehicle.innerHTML='<option value="">Tüm araçlar</option>'+model.vehicles.map(v=>`<option value="${esc(v.id)}">${esc(v.name)}${v.active===false?' · pasif':''}</option>`).join('');
    if(selected&&!model.vehicles.some(v=>v.id===selected))vehicle.insertAdjacentHTML('beforeend',`<option value="${esc(selected)}">Seçilen araç listede değil</option>`);vehicle.value=selected;
    qs('[data-fleet-filter-summary]',root).textContent='Filtrele · '+(vehicle.selectedOptions[0]?.textContent||'Tüm araçlar')+(search.value?' · '+search.value.slice(0,60):'');
    qs('[data-fleet-doc-counts]',root).innerHTML=`<p class="small muted">Seçili araç ve aramaya göre</p><div class="fleet-doc-stats">${[['overdue','Süresi geçmiş'],['today','Bugün bitiyor'],['soon','30 gün içinde'],['review','Kontrol gerekli']].map(([key,label])=>`<button class="card" data-fleet-doc-filter="${key}"><strong>${model.counts[key]}</strong><span>${label}</span></button>`).join('')}</div>`;
    qs('[data-fleet-doc-filters]',root).innerHTML=Object.entries(statuses).map(([key,label])=>`<button class="btn sm ${key===status?'primary':''}" data-fleet-doc-filter="${key}" aria-pressed="${key===status}">${label} (${model.counts[key]})</button>`).join('');
    qs('[data-fleet-doc-add]',root).href=newVehicleDocumentURL(selected);
    qs('[data-fleet-doc-list]',root).innerHTML=model.selected.map(r=>fleetDocumentRow(r,model)).join('')||notice('info',model.rows.length?'Bu filtrede belge yok.':'Süre takibi için önce araca ait belgeyi ekleyin.');
    const params=new URLSearchParams();if(selected)params.set('vehicle_id',selected);if(search.value)params.set('q',search.value);if(passive.checked)params.set('passive','1');if(status!=='all')params.set('status',status);
    history.replaceState(null,'','#/filo-belgeleri'+(params.size?'?'+params:''));
  };
  root.addEventListener('click',e=>{const button=e.target.closest('[data-fleet-doc-filter]');if(button){status=button.dataset.fleetDocFilter;draw();}});
  vehicle.onchange=()=>{selected=vehicle.value;draw();};search.oninput=draw;passive.onchange=draw;
  const stopWatching=await watchFleetDocuments(ctx,(fresh,error)=>{if(error){qs('[data-fleet-doc-list]',root).innerHTML=notice('warn','Belge süreleri okunamadı; boş veya sıfır sonuç gösterilmedi. Yeniden açın.');return;}data=fresh;draw();});
  qs('[data-fleet-doc-refresh]',root).onclick=()=>{stopWatching();ctx.reload();};
}
export async function documentExpiryScreen(ctx,id){
  const {root,db}=ctx,doc=await db.get('documents',id),vehicleId=doc&&documentVehicle(doc),vehicle=vehicleId&&await db.get('vehicles',vehicleId);
  if(!doc||!isActive(doc)||!vehicle||!isActive(vehicle)){root.innerHTML=appbar('Belge Süresi')+notice('warn','Araç belgesi veya sahibi doğrulanamadı. Belge merkezinden sahip bilgisini kontrol edin.');return;}
  root.innerHTML=appbar('Belge Tarihini Düzelt',vehicle.name,{back:'#/belgeler/'+enc(id)})+`<section class="card">${notice('info','Yalnız bu belgenin üzerinde yazan tarihi düzeltin. Yenilenmiş belge için yeni belge ekleyin; eski fotoğrafın tarihini ileri taşımayın.')}<b>${esc(doc.category)}</b><form data-form>${fText('Belge no','doc_no',doc.doc_no||'')}${fDate('Belge tarihi','date',doc.date)}${fDate('Geçerlilik başlangıcı (varsa)','valid_from',doc.valid_from||'',false)}${fDate('Geçerlilik bitişi','expiry_date',doc.expiry_date||'',false)}${fDate('Hatırlatma tarihi (isteğe bağlı)','reminder_date',doc.reminder_date||'',false)}<button class="btn primary block" type="button" data-fleet-expiry-save>Tarihleri kaydet</button></form><p><a href="${newVehicleDocumentURL(vehicleId)}">Yenilenmiş belgeyi yeni kayıt olarak ekle →</a></p><div data-fleet-expiry-error role="status"></div></section>`;
  let busy=false;qs('[data-fleet-expiry-save]',root).onclick=async()=>{
    if(busy)return;const button=qs('[data-fleet-expiry-save]',root);busy=true;button.disabled=true;
    try{
      const fields=Object.fromEntries(['doc_no','date','valid_from','expiry_date','reminder_date'].map(key=>[key,qs('[name='+key+']',root).value.trim()]));
      if(!validDate(fields.date)||['expiry_date','reminder_date','valid_from'].some(key=>fields[key]&&!validDate(fields[key])))throw Error('Belgedeki geçerli tarihleri girin.');
      await db.saveExisting('documents',doc,{...fields,vehicle_id:vehicleId,valid_from:fields.valid_from||null,expiry_date:fields.expiry_date||null,reminder_date:fields.reminder_date||null},'Araç belgesinin tarihleri kullanıcı tarafından kontrol edilerek düzeltildi',0,{strict:true});
      toast('Belge tarihi güncellendi','ok');go('#/belgeler/'+encodeURIComponent(id));
    }catch(e){qs('[data-fleet-expiry-error]',root).textContent=e.message;toast(e.message,'err');}
    finally{busy=false;button.disabled=false;}
  };
}
export function documentDetailCountdown(doc){
  if(!documentVehicle(doc))return '';
  const row={doc,...documentCountdown(doc),history:[]};
  return `<section class="card fleet-doc-detail" data-document-countdown><strong class="fleet-doc-counter ${tone(row)}">${esc(row.label)}</strong><p class="small">Geçerlilik bitişi: ${esc(doc.expiry_date?trDate(doc.expiry_date):'Girilmemiş')}</p><div class="fleet-doc-actions"><a class="btn sm" href="${fleetDocumentURL(documentVehicle(doc))}">Aracın belge süreleri</a><a class="btn sm" href="#/belge-suresi/${enc(doc.id)}">Tarihi kontrol et / düzelt</a></div></section>`;
}
export async function mountDocumentCountdown(ctx,id){
  const holder=qs('[data-document-countdown-mount]',ctx.root);if(!holder)return;
  await watchFleetDocuments(ctx,(data,error)=>{
    if(error){holder.innerHTML=notice('warn','Belgenin kalan süresi okunamadı.');return;}
    const doc=data.documents.find(d=>d.id===id&&isActive(d));
    holder.innerHTML=doc?documentDetailCountdown(doc):notice('warn','Belge değişmiş veya silinmiş; güncel belge merkezini açın.');
  });
}

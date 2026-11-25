import {commercialDesk,commercialRows} from './commercial-desk-core.js';
import {appbar,esc,fmtTL,trDate,notice,todayStr} from './ui.js';
import {watchRecords} from './record-refresh.js';
const filters={all:'Takipteki tüm müşteriler',review:'Eksikler / kontrol',ready:'Hazır işler',drafts:'Taslak hakediş',receivable:'Açık TL alacak',promises:'Ödeme sözleri',agreement:'Mazot / sözleşme işleri'};
export function commercialRowHTML(r){
 const c=r.counts,p=r.promise;
 const actions=[{...r.next,primary:true},{label:'İş hazırlığı',href:r.links.preparation},{label:'Tahsilat takibi',href:r.links.collection}].filter((a,i,all)=>all.findIndex(b=>b.href===a.href)===i);
 const promise=p?`<p class="small" data-commercial-promise><b>${p.review?'Ödeme sözünü kontrol edin':p.late?'Söz tarihi geçti':p.soon?'Ödeme sözü yaklaşıyor':'Kayıtlı ödeme sözü'}:</b> ${esc(p.date?trDate(p.date):'Tarih yok')} · ${p.amount==null?'Tutar belirtilmemiş / geçersiz':esc(fmtTL(p.amount))+' TL'}${r.balance<=0?' · Pozitif TL bakiye yok; sözün güncelliğini kontrol edin.':''}</p>`:'';
 return `<article class="card" data-commercial-customer="${esc(r.customer.id)}"><h2 style="margin:0 0 4px;font-size:18px"><a style="color:inherit;text-decoration:none" href="${esc(r.links.customer)}">${esc(r.customer.name||'Müşteri')}</a></h2>${r.parent?`<p class="tiny muted">${esc(r.parent.name)} bağlantılı taşeron · hesap ayrı</p>`:''}
 <p class="small">Seçili dönemin işleri: <b>${c.review} kontrol · ${c.missing} eksik · ${c.ready} hazır</b>${c.claimed?' · '+c.claimed+' hakedişe bağlı':''}${c.agreement?' · '+c.agreement+' mazot / sözleşme / iç iş kapsamında':''}</p>
 <p class="small"><b>Kayıtlı TL bakiye: ${esc(fmtTL(Math.abs(r.balance)))} TL</b> · ${r.balance>0?'müşteri borçlu':r.balance<0?'müşteri alacaklı':'bakiye sıfır'} <span class="muted tiny">(tüm tarihler)</span></p>
 ${promise}<p class="small">Taslak hakediş: <b>${r.drafts.length}</b> <span class="muted tiny">(tüm tarihler)</span></p>
 <div class="row" style="gap:6px;flex-wrap:wrap">${actions.map(a=>`<a class="btn ${a.primary?'primary':''}" style="text-decoration:none" ${a.primary?'data-commercial-next':''} href="${esc(a.href)}">${esc(a.label)}</a>`).join('')}</div>
 ${r.drafts.length?`<details style="margin-top:8px"><summary>Taslak hakedişleri göster</summary>${r.drafts.map(h=>`<p class="small"><a href="#/hakedis/${encodeURIComponent(h.id)}">${esc(h.hakedis_no?'#'+h.hakedis_no:'Taslak')} · ${esc(h.date?trDate(h.date):'Tarih eksik')}</a></p>`).join('')}</details>`:''}</article>`;
}
export async function commercialDeskScreen(ctx){
 const {root,db,query={}}=ctx;
 let data=null,notes={},model=null,closed=false,serial=0,timer;
 let status=Object.hasOwn(filters,query.status)?query.status:'all';
 const today=todayStr();
 root.innerHTML=appbar('Hakediş ve Tahsilat Masası','İş hazırlığı → hakediş → tahsilat takibi',{back:'#/finans'})+`<section class="card" data-commercial-desk>
 <p class="small">İşler seçili dönem; taslaklar, TL bakiye ve ödeme sözleri tüm tarihler içindir.</p>
 <form data-commercial-period><div class="formgrid2"><label class="field">İş başlangıcı<input type="date" name="from" value="${esc(query.from||today.slice(0,8)+'01')}" required></label><label class="field">İş bitişi<input type="date" name="to" value="${esc(query.to||today)}" max="${today}" required></label></div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn primary">Dönemi uygula</button><button type="button" class="btn" data-commercial-refresh>Güncelle</button></div></form>
 <div data-commercial-error role="status"></div><p class="tiny muted">Ödeme sözü alınan para değildir. KDV yalnız seçilip kesinleşen hakedişte eklenir.</p><details><summary class="small">Kapsam ve hesap kuralları</summary><p class="tiny muted">Taslak kesinleşmiş hakediş değildir. Ana firma ve taşeron hesapları ayrıdır. Tarihi eksik / geçersiz işler ayrıca kontrol listesine girer. İş fiyatı yoksa tutar üretilmez; mazot (L) ayrı izlenir. KDV yalnız hakedişte ayrıca seçilip kesinleştirilince cariye eklenir.</p></details>
 </section><div class="statgrid" style="grid-template-columns:repeat(2,minmax(0,1fr))" data-commercial-counts></div>
 <section class="card"><label class="field">Müşteri ara<input type="search" data-commercial-search value="${esc(query.q||'')}" placeholder="Müşteri, ana firma veya telefon"></label><label class="field">Takip türü<select data-commercial-status>${Object.entries(filters).map(([k,t])=>`<option value="${k}" ${k===status?'selected':''}>${esc(t)}</option>`).join('')}</select></label><p class="tiny muted">Üst sayılar arama ve takip türü filtresinden etkilenmez; aynı müşteri birden fazla sayıya dahildir.</p><p class="small" data-commercial-result aria-live="polite"></p></section>
 <div data-commercial-orphans></div><div data-commercial-list></div>`;
 const q=s=>root.querySelector(s),from=q('[name=from]'),to=q('[name=to]'),search=q('[data-commercial-search]'),select=q('[data-commercial-status]');
 let scope={from:from.value,to:to.value};
 const draw=()=>{
  if(!model)return;
  const rows=commercialRows(model,{q:search.value,status});
  q('[data-commercial-result]').textContent=`İş dönemi: ${trDate(model.from)} – ${trDate(model.to)} · ${rows.length} / ${model.rows.length} müşteri gösteriliyor.`;
  q('[data-commercial-counts]').innerHTML=[['review','Eksik / kontrol'],['ready','Hazır işi olan'],['drafts','Taslağı bekleyen'],['receivable','Açık TL alacağı'],['promises','Ödeme sözü olan']].map(([k,t])=>`<button class="stat" type="button" data-commercial-filter="${k}"><b style="font-size:22px;font-variant-numeric:tabular-nums">${model.counts[k]}</b><div class="small">${t}</div></button>`).join('');
  for(const button of root.querySelectorAll('[data-commercial-filter]'))button.onclick=()=>{status=button.dataset.commercialFilter;select.value=status;draw();};
  q('[data-commercial-list]').innerHTML=rows.map(commercialRowHTML).join('')||notice('info','Bu kapsamda takip satırı yok. Bu, tüm işlerin girildiği veya hesapların kapandığı anlamına gelmez. Tarihleri ve filtreleri kontrol edin.');
  q('[data-commercial-orphans]').innerHTML=model.unassigned.length?notice('warn',`${model.unassigned.length} işin aktif müşteri bağlantısı yok; müşterilere otomatik dağıtılmadı.`)+`<details class="card"><summary>Müşteri bağlantısını kontrol et</summary>${model.unassigned.map(w=>`<p><a href="#/isler/${encodeURIComponent(w.id)}">${esc(w.date?trDate(w.date):'Tarih eksik')} · ${esc(w.work_type||'İş')}</a></p>`).join('')}</details>`:'';
 };
 const apply=()=>{try{const next=commercialDesk(data,{...scope,notes});model=next;q('[data-commercial-error]').textContent='';draw();}catch(e){q('[data-commercial-error]').textContent=e.message;}};
 const update=async()=>{const own=++serial;try{const snap=await db.readSnapshot({attachments:false,meta:true});if(closed||!root.isConnected||own!==serial)return;to.max=todayStr();data=snap.data;notes=snap.meta.find(r=>r.key==='collect_notes')?.value||{};apply();}catch(e){if(!closed&&root.isConnected&&own===serial)q('[data-commercial-error]').textContent='Kayıtlar okunamadı. Güncelle ile yeniden deneyin.';}};
 q('[data-commercial-period]').onsubmit=e=>{e.preventDefault();if(!data){q('[data-commercial-error]').textContent='Kayıtlar okunuyor; biraz sonra yeniden deneyin.';return;}const candidate={from:from.value,to:to.value};try{const next=commercialDesk(data,{...candidate,notes});scope=candidate;model=next;q('[data-commercial-error]').textContent='';draw();}catch(error){q('[data-commercial-error]').textContent=error.message;}};
 search.oninput=draw;select.onchange=()=>{status=select.value;draw();};q('[data-commercial-refresh]').onclick=update;
 const database=(await db.openDB()).name,unwatch=watchRecords(e=>{if(e.database===database)update();});
 const visible=()=>{if(document.visibilityState!=='hidden')update();};
 const midnight=()=>{const now=new Date();timer=setTimeout(()=>{visible();midnight();},new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).getTime()-now.getTime()+1000);};
 const observer=new MutationObserver(()=>{if(!root.isConnected)stop();});
 const stop=()=>{if(closed)return;closed=true;clearTimeout(timer);unwatch();observer.disconnect();window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
 observer.observe(document.body,{childList:true,subtree:true});window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);midnight();await update();
}

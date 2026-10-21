import {appbar,esc} from './ui.js';
import {todayStr,addDays,trDate,fmtNum,isActive} from './core.js';
import {fieldStream,streamURL,SOURCES} from './field-stream.js';
import {entryLink} from './entry-context.js';
export async function screen({root,db,query={}}){
 const mount=document.createElement('div');root.replaceChildren(mount);mount.innerHTML=appbar('Saha Akışı','Günün işleri ve saha kayıtları')+'<p role="status">Kayıtlar yükleniyor…</p>';
 let data;try{data=await db.dumpAll();}catch{if(mount.isConnected)mount.innerHTML=appbar('Saha Akışı')+'<div class="card" role="alert">Kayıtlar okunamadı. Sayfayı yeniden açın.</div>';return;}if(!mount.isConnected)return;
 const today=todayStr(),m=fieldStream(data,query,today);let limit=30;
 const url=patch=>streamURL(query,patch);
 function draw(){
 mount.innerHTML=appbar('Saha Akışı','Bu cihazdaki kayıtlar · '+trDate(m.date))+`
 <section class="card field"><label>Gün <input type="date" data-stream-date value="${esc(m.date)}" style="width:100%;margin:8px 0"></label>
 <div class="field-actions"><a class="btn" href="${esc(url({date:addDays(m.error?today:m.date,-1)}))}">← Önceki gün</a><a class="btn" href="${esc(url({date:today}))}">Bugün</a><a class="btn" href="${esc(url({date:addDays(m.error?today:m.date,1)}))}">Sonraki gün →</a></div>
 <p class="small muted">Son 7 gün · tüm kayıt türleri ve araçlar</p><div class="field-week">${Array.from({length:7},(_,i)=>addDays(today,i-6)).map(d=>`<a class="btn sm ${m.date===d?'primary':''}" href="${esc(url({date:d}))}" aria-label="${esc(trDate(d))}: ${m.days[d]||0} kayıt">${esc(trDate(d).slice(0,5))}<b>${m.days[d]||0}</b></a>`).join('')}</div></section>
 <section class="card field"><details ${query.kind||query.vehicle_id||query.q?'open':''}><summary>Filtreler${query.kind||query.vehicle_id||query.q?' · etkin':' · tür, araç, arama'}</summary><label>Kayıt türü<select data-stream-kind><option value="">Tümü</option>${Object.entries(SOURCES).map(([k,v])=>`<option value="${k}" ${m.kind===k?'selected':''}>${v[1]}</option>`).join('')}</select></label>
 <label>Araç<select data-stream-vehicle><option value="">Tüm araçlar</option>${(data.vehicles||[]).filter(v=>isActive(v)||v.id===query.vehicle_id).map(v=>`<option value="${esc(v.id)}" ${query.vehicle_id===v.id?'selected':''}>${esc(v.plate||v.name||v.id)}</option>`).join('')}</select></label>
 <form data-stream-search><label>Kayıtlarda ara<input name="q" value="${esc(query.q||'')}" placeholder="Müşteri, plaka, personel, açıklama…"></label><button class="btn block" type="submit">Ara</button></form><a class="btn sm" href="${esc(streamURL({date:m.error?today:m.date}))}">Filtreleri temizle</a></details></section>
 ${m.error?`<p role="alert">${esc(m.error)}</p>`:`<section class="card" data-stream-summary><h2>Seçili gün ve filtrelerin özeti</h2><p><b>${m.rows.length} kayıt</b> · ${m.counts.work} iş · ${m.counts.fuel} yakıt · ${m.counts.expense} gider · ${m.counts.maintenance} bakım</p><p>${Object.entries(m.units).map(([u,n])=>esc(fmtNum(n)+' '+u)).join(' · ')||'İş miktarı yok'} · ${fmtNum(m.liters)} L yakıt</p><p class="small muted">Miktarlar birimlerine göre ayrıdır. Bu özet kâr, cari bakiye veya maliyet toplamı değildir.</p></section>`}
 <div class="field-actions" aria-label="Yeni kayıt">${Object.entries(SOURCES).map(([kind,[,label]])=>{const href=entryLink(kind,{...query,date:m.date});return href?`<a class="btn" data-stream-new="${kind}" href="${esc(href)}">+ ${label}</a>`:`<button class="btn" disabled>+ ${label}</button>`;}).join('')}<a class="btn primary" href="#/akilli-asistan">🤖 Asistan</a></div>
 <p class="small muted">Kayıtların iş tarihine göre gösterilir; gerçek olay saati bilinmediği için saat sırası verilmez. ${m.invalid?esc(m.invalid+' kaydın tarihi eksik veya geçersiz; günlük akışa alınmadı.'):''}</p>
 <div data-stream-rows>${m.rows.slice(0,limit).map(x=>`<a class="card field-record" data-stream-record href="${esc(x.hash)}"><span class="badge">${esc(x.label)}</span><strong>${esc(x.title)}</strong><span>${esc([x.vehicle,x.personnel].filter(Boolean).join(' · ')||'Araç / personel belirtilmedi')}</span>${x.kind==='work'?`<b>${esc(fmtNum(x.record.quantity)+' '+(x.record.unit||''))}</b>`:x.kind==='fuel'?`<b>${esc(fmtNum(x.record.liters))} L</b>`:''}${x.description?`<span class="small">${esc(x.description)}</span>`:''}<span class="small">Kaydı aç →</span></a>`).join('')||'<div class="card">Bu gün ve filtrelerde kayıt yok.</div>'}</div>
 ${m.rows.length>limit?'<button class="btn block" data-stream-more>Daha fazla göster</button>':''}`;
 mount.querySelector('[data-stream-date]').onchange=e=>{if(e.target.value)location.hash=url({date:e.target.value});};
 mount.querySelector('[data-stream-kind]').onchange=e=>location.hash=url({kind:e.target.value});
 mount.querySelector('[data-stream-vehicle]').onchange=e=>location.hash=url({vehicle_id:e.target.value});
 mount.querySelector('form').onsubmit=e=>{e.preventDefault();location.hash=url({q:new FormData(e.target).get('q').trim()});};
 const more=mount.querySelector('[data-stream-more]');if(more)more.onclick=()=>{limit+=30;draw();};
 }
 draw();
}

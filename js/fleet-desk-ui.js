import {fleetDesk} from './fleet-desk-core.js';
import {esc,fmtTL,trDate,notice} from './ui.js';
import {watchRecords} from './record-refresh.js';
const number=n=>Number(n).toLocaleString('tr-TR',{maximumFractionDigits:1});
export function fleetDeskHtml(m){
 const late=m.rules.filter(r=>r.state==='late').length,unknown=m.history.filter(r=>r.history_unknown_status).length;
 return `<h2 style="margin:0 0 6px">Araç takip dosyası</h2><p class="small muted">${esc(trDate(m.today))} itibarıyla · yalnız bu araç / makine</p>
 <div class="statgrid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${[['Belge kontrolü',m.urgent.length,m.links.documents],['Açık bakım / arıza',m.open.length,m.links.history],['Geciken bakım kuralı',late,m.links.calendar],['Bakım geçmişi',m.history.length,m.links.history]].map(([t,n,h])=>`<a class="stat" href="${esc(h)}"><b>${n}</b><div class="small">${esc(t)}</div></a>`).join('')}</div>
 <a class="btn primary" data-fleet-next href="${esc(m.next.href)}">${esc(m.next.label)}</a>
 ${!m.documents.length?notice('warn','Araç belgesi kaydı yok; süre kontrolü yapılamıyor.'):''}
 ${!m.rules.length?'<p class="small muted">Bakım kuralı tanımlanmamış. Takvimden araç için uygun periyodu belirleyin; kendiliğinden kural eklenmez.</p>':''}
 <div style="margin-top:10px" data-fleet-meters>${[['km','Kilometre','km'],['hours','Çalışma saati','saat']].map(([k,label,u])=>{const r=m.meters[k];return `<p class="small"><b>${label}:</b> ${r.last?esc(number(r.last.value)+' '+u+' · '+trDate(r.last.date)+' · '+r.last.src):'Okuma yok'}${r.conflict?' · Sayaç azalmış; kaydı kontrol edin.':''}${r.excluded?' · Gelecek / geçersiz tarihli okumalar kullanılmadı.':''}</p>`;}).join('')}<p class="tiny muted">Son kayıtlı okumalar gösterilir; iş saatleri kesin sayaç okuması yerine eklenmez.</p></div>
 <p class="small" data-fleet-known-cost><b>Bilinen maliyet satırları (brüt): ${esc(fmtTL(m.cost))} TL</b></p>${m.costIncomplete?notice('warn','Maliyet eksik: '+m.costReason+'. Gösterilen ara toplam tüm masraf değildir.'):''}
 <p class="tiny muted">Bu tutar ödeme veya kâr değildir. Bağlı maliyet kaynakları bir kez hesaplanır; yalnız takip kaydı yeni gider oluşturmaz.${unknown?' '+unknown+' gider / alış kaydında bakımın tamamlanma durumu belirtilmemiş; ödeme, işin tamamlanması sayılmaz.':''}</p>
 <div class="row" style="gap:6px;flex-wrap:wrap"><a class="btn" href="${esc(m.links.meter)}">Sayaç oku</a><a class="btn" href="${esc(m.links.cost)}">Maliyet kaynakları</a><a class="btn" data-fleet-maintenance-pdf href="${esc(m.links.report)}">Bakım raporu / PDF</a><button class="btn" data-fleet-desk-refresh>Yenile</button></div>
 <details style="margin-top:10px"><summary>Öncelikli kayıtlar ve bakım kuralları</summary>${m.urgent.slice(0,3).map(r=>`<p class="small"><a href="#/belgeler/${encodeURIComponent(r.doc.id)}">${esc(r.doc.category)} · ${esc(r.label)}</a></p>`).join('')}${m.rules.map(r=>`<p class="small"><a href="${esc(m.links.calendar)}">${esc(r.rule.title)} · ${esc(r.text)}${r.hr?.est?' · iş saatlerinden tahmin':''}</a></p>`).join('')}${m.history.slice(0,3).map(r=>`<p class="small"><a href="${esc(r.history_href)}">${esc(trDate(r.date))} · ${esc(r.maint_type)} · ${esc(r.history_unknown_status?'İş durumu belirtilmemiş':r.status)}</a></p>`).join('')}</details>`;
}
// Paint only this region. An open history tab or a manually edited form must survive refresh.
export async function mountFleetDesk(ctx,id){
 const {db,root}=ctx,holder=root.querySelector('[data-fleet-desk]');if(!holder)return;
 const database=(await db.openDB()).name;let stopped=false,serial=0,timer;
 const update=async()=>{const own=++serial;try{const d=await db.dumpAll();if(!stopped&&holder.isConnected&&own===serial){holder.innerHTML=fleetDeskHtml(fleetDesk(d,id));holder.querySelector('[data-fleet-desk-refresh]').onclick=update;}}catch(e){if(!stopped&&holder.isConnected&&own===serial){holder.innerHTML=notice('warn','Araç takibi okunamadı; araç kartını yeniden açın.');console.error(e);}}};
 const visible=()=>{if(document.visibilityState!=='hidden')update();};
 const midnight=()=>{const n=new Date();timer=setTimeout(()=>{visible();midnight();},new Date(n.getFullYear(),n.getMonth(),n.getDate()+1).getTime()-n.getTime()+1000);};
 const unwatch=watchRecords(e=>{if(e.database===database)update();});
 const observer=new MutationObserver(()=>{if(!holder.isConnected)stop();});
 const stop=()=>{if(stopped)return;stopped=true;clearTimeout(timer);unwatch();observer.disconnect();window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
 observer.observe(document.body,{childList:true,subtree:true});window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);midnight();await update();return stop;
}

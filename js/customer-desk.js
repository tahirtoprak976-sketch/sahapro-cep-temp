// Read-only follow-up, from the customer's existing shared snapshot. No posting or approval inference.
import {hakedisPreparation, preparationURL} from './hakedis-preparation.js';
import {isActive, todayStr, trDate, fmtNum, fmtTL} from './core.js';
import {missingCustomerWorkPrice} from './collect-core.js';
import {validDate} from './driver-delivery.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function customerDesk(d,id,{from='',to=todayStr(),today=todayStr(),site_id=''}={}){
 const start=from||'0001-01-01';
 const p=hakedisPreparation(d,{customer_id:id,from:start,to,today,site_id});
 const claims=(d.hakedis||[]).filter(h=>isActive(h)&&h.customer_id===id&&h.status!=='İptal');
 const linked=new Set(p.claimed.flatMap(r=>r.claims.map(h=>h.id)));
 const sourceWorks=new Map((d.work_records||[]).filter(w=>isActive(w)&&w.customer_id===id).map(w=>[w.id,w]));
 const scoped=claims.filter(h=>(linked.has(h.id)||(validDate(h.date||h.created_date)&&(h.date||h.created_date)>=start&&(h.date||h.created_date)<=to))&&(!site_id||linked.has(h.id)||(h.items||[]).some(i=>sourceWorks.get(i.work_record_id)?.site_id===site_id)));
 const groups={review:p.review,missing:p.missing,ready:p.ready,agreement:p.agreement,claimed:p.claimed};
 const unpriced=[...p.missing,...p.review].filter(r=>missingCustomerWorkPrice(r.work,r.claims.length>0));
 const drafts=scoped.filter(h=>h.status==='Taslak');
 const next=p.review.length?'review':p.missing.length?'missing':drafts.length?'draft':p.ready.length?'ready':'collection';
 return {scope:p.scope,counts:p.counts,drafts,claims:scoped,next,groups,unpriced,
  preparation:preparationURL('hazirlik',p.scope),reconciliation:preparationURL('new',p.scope),collection:'#/tahsilat/'+encodeURIComponent(id)};
}
export function customerDeskHtml(d,id,options){
 const m=customerDesk(d,id,options),c=m.counts;
 const account=options?.account?.customer?.id===id?options.account:null;
 const promise=options?.notes?.[id];
 const money=v=>typeof v==='number'&&Number.isFinite(v)?esc(fmtTL(v))+' ₺':'Doğrulanamadı';
 const workRows=(rows)=>rows.length?rows.map(r=>{const w=r.work,vehicle=(d.vehicles||[]).find(v=>v.id===w.vehicle_id),site=(d.sites||[]).find(s=>s.id===w.site_id&&s.customer_id===id&&!s.deleted_at);return `<a class="customer-followup-row" data-followup-work="${esc(w.id)}" href="#/isler/${encodeURIComponent(w.id)}"><strong>${esc(trDate(w.date))} · ${esc(w.work_type||'İş')}</strong><span>${esc(vehicle?.name||'Araç belirtilmemiş')} · ${esc(w.quantity!=null&&w.quantity!==''&&Number.isFinite(Number(w.quantity))?fmtNum(w.quantity):'Miktar eksik')} ${esc(w.unit||'')}</span><span>${esc(site?.name||'Şantiye atanmamış / kontrol gerekli')}</span>${[...r.issues,...r.missing].length?`<small>${esc([...r.issues,...r.missing].join(' · '))}</small>`:''}</a>`;}).join(''):'<p class="small muted">Bu kapsamda iş yok.</p>';
 const taskGroups=[['unpriced','Fiyat bekleyen işler',m.groups.missing.filter(r=>m.unpriced.includes(r))],['ready','Hakedişe hazır işler',m.groups.ready],['missing','Diğer eksikleri olan işler',m.groups.missing.filter(r=>!m.unpriced.includes(r))],['review','Kaynak kontrolü gereken işler',m.groups.review],['agreement','Sözleşme / mazot / iç iş kapsamı',m.groups.agreement]];
 const steps={review:['Kontrol gerektiren işleri aç',m.preparation],missing:['Eksik bilgileri tamamla',m.preparation],draft:['Taslak hakedişi kontrol et','#/hakedis/'+encodeURIComponent(m.drafts[0]?.id)],ready:['Hazır işleri hakedişe taşı',m.preparation],collection:['Tahsilat takibini aç',m.collection]};
 const [label,href]=steps[m.next];
 return `<div data-customer-desk class="card" style="margin:12px 0;border-left:4px solid var(--accent)">
 <h3 style="margin:0 0 6px">Müşteri takip dosyası</h3>
 <p class="small muted">Seçili dönem ve şantiye · yalnız bu müşterinin işleri. Taşeronlar bu takibe dahil edilmez.</p>
 <div class="statgrid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
 ${[['Kontrol gerekli',c.review],['Bilgisi eksik',c.missing],['Hakedişe hazır',c.ready],['Hakedişe bağlı',c.claimed]].map(([t,n])=>`<a class="stat" href="${esc(m.preparation)}"><b>${n}</b><div class="small">${t}</div></a>`).join('')}
 </div>
 ${c.agreement?`<p class="small">${c.agreement} iş: mazot / sözleşme / iç iş kapsamında; TL hakediş hazırlığından ayrı.</p>`:''}
 <a class="btn primary" data-customer-next href="${esc(href)}">${esc(label)}</a>
 <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px"><a class="btn" data-customer-reconciliation href="${esc(m.reconciliation)}">Miktar mutabakatı / fiyatsız PDF</a><a class="btn" href="${esc(m.collection)}">Tahsilat takibi</a></div>
 <details><summary>Hesap ve onay kuralları</summary><p class="tiny muted">Fiyatsız PDF, açılan ekranda iş seçilerek hazırlanır; PDF oluşturmak müşteri onayı değildir. Hakedişe bağlı işler taslakta da olabilir. Tahsilatlar müşteri hesabında izlenir; buradan bir hakedişe ödeme atanmaz. KDV yalnız hakedişte ayrıca seçilip kesinleştirilince cariye eklenir.</p></details>
 <div data-followup-groups>${taskGroups.filter(([, , rows])=>rows.length).map(([key,label,rows])=>`<details data-followup-group="${key}"><summary>${label} (${rows.length})</summary>${workRows(rows)}</details>`).join('')}</div>
 ${m.scope.site_id&&m.claims.length?'<p class="notice warn" data-followup-claim-scope>Seçili şantiyenin işi bulunan hakedişler başka şantiyeleri de içerebilir. Tutar ve tahsilat şantiyelere bölüştürülmez.</p>':''}
 <details data-followup-drafts><summary>Taslak hakedişler (${m.drafts.length})</summary>${m.drafts.length?m.drafts.map(h=>`<a class="customer-followup-row" href="#/hakedis/${encodeURIComponent(h.id)}">${esc(trDate(h.date||h.created_date))} · Taslak — kesinleşmedi</a>`).join(''):'<p class="small muted">Bu kapsamda taslak hakediş yok.</p>'}</details>
 ${account?`<section data-followup-account><h4>Müşteri hesabı · tüm şantiyeler</h4><p data-followup-balance><strong>${money(account.balanceNow)}</strong> · tüm tarihlerde kayıtlı müşteri bakiyesi</p><p data-followup-collected>Seçili dönemde alınan para: <strong>${money(account.statement?.collected)}</strong></p><p class="tiny muted">Bu tutarlar müşteri genelidir; tahsilat şantiyeye atanmaz. Mazot (L) ayrı izlenir. Fiyatsız işler bakiyeye katılmaz.</p>${validDate(promise?.promise_date)?`<p data-followup-promise>Ödeme sözü: ${esc(trDate(promise.promise_date))}${promise.promise_amount!==''&&promise.promise_amount!=null&&Number.isFinite(Number(promise.promise_amount))&&Number(promise.promise_amount)>0?' · '+esc(fmtTL(Number(promise.promise_amount)))+' ₺':' · tutar belirtilmemiş'} — tahsilat değildir.</p>`:'<p class="small muted">Kayıtlı tarihli ödeme sözü yok.</p>'}</section>`:''}
 <details><summary>Diğer hakedişler (${m.claims.filter(h=>h.status!=='Taslak').length})</summary>${m.claims.some(h=>h.status!=='Taslak')?m.claims.filter(h=>h.status!=='Taslak').map(h=>`<a class="card" style="display:block;margin-top:6px" href="#/hakedis/${encodeURIComponent(h.id)}">${esc(h.date||h.created_date||'Tarih eksik')} · ${esc(h.status||'Durum belirtilmemiş')}</a>`).join(''):'<p class="small muted">Bu dönemde veya bu dönemin işlerine bağlı hakediş yok.</p>'}</details>
 </div>`;
}

// Read-only follow-up, from the customer's existing shared snapshot. No posting or approval inference.
import {hakedisPreparation, preparationURL} from './hakedis-preparation.js';
import {isActive, todayStr} from './core.js';
import {validDate} from './driver-delivery.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function customerDesk(d,id,{from='',to=todayStr(),today=todayStr()}={}){
 const start=from||'0001-01-01';
 const p=hakedisPreparation(d,{customer_id:id,from:start,to,today});
 const claims=(d.hakedis||[]).filter(h=>isActive(h)&&h.customer_id===id&&h.status!=='İptal');
 const linked=new Set(p.claimed.flatMap(r=>r.claims.map(h=>h.id)));
 const scoped=claims.filter(h=>linked.has(h.id)||(validDate(h.date)&&h.date>=start&&h.date<=to));
 const drafts=scoped.filter(h=>h.status==='Taslak');
 const next=p.review.length?'review':p.missing.length?'missing':drafts.length?'draft':p.ready.length?'ready':'collection';
 return {scope:p.scope,counts:p.counts,drafts,claims:scoped,next,
  preparation:preparationURL('hazirlik',p.scope),reconciliation:preparationURL('new',p.scope),collection:'#/tahsilat/'+encodeURIComponent(id)};
}
export function customerDeskHtml(d,id,options){
 const m=customerDesk(d,id,options),c=m.counts;
 const steps={review:['Kontrol gerektiren işleri aç',m.preparation],missing:['Eksik bilgileri tamamla',m.preparation],draft:['Taslak hakedişi kontrol et','#/hakedis/'+encodeURIComponent(m.drafts[0]?.id)],ready:['Hazır işleri hakedişe taşı',m.preparation],collection:['Tahsilat takibini aç',m.collection]};
 const [label,href]=steps[m.next];
 return `<div data-customer-desk class="card" style="margin:12px 0;border-left:4px solid var(--accent)">
 <h3 style="margin:0 0 6px">Müşteri takip dosyası</h3>
 <p class="small muted">Seçili dönem · yalnız bu müşterinin kayıtları. Taşeronlar bu takibe dahil edilmez.</p>
 <div class="statgrid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
 ${[['Kontrol gerekli',c.review],['Bilgisi eksik',c.missing],['Hakedişe hazır',c.ready],['Hakedişe bağlı',c.claimed]].map(([t,n])=>`<a class="stat" href="${esc(m.preparation)}"><b>${n}</b><div class="small">${t}</div></a>`).join('')}
 </div>
 ${c.agreement?`<p class="small">${c.agreement} iş: mazot / sözleşme / iç iş kapsamında; TL hakediş hazırlığından ayrı.</p>`:''}
 <a class="btn primary" data-customer-next href="${esc(href)}">${esc(label)}</a>
 <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px"><a class="btn" data-customer-reconciliation href="${esc(m.reconciliation)}">Miktar mutabakatı / fiyatsız PDF</a><a class="btn" href="${esc(m.collection)}">Tahsilat takibi</a></div>
 <p class="tiny muted">Fiyatsız PDF, açılan ekranda iş seçilerek hazırlanır; PDF oluşturmak müşteri onayı değildir. Hakedişe bağlı işler taslakta da olabilir. Tahsilatlar müşteri hesabında izlenir; buradan bir hakedişe ödeme atanmaz. KDV yalnız hakedişte ayrıca seçilip kesinleştirilince cariye eklenir.</p>
 <details><summary>İlgili hakedişler (${m.claims.length})</summary>${m.claims.length?m.claims.map(h=>`<a class="card" style="display:block;margin-top:6px" href="#/hakedis/${encodeURIComponent(h.id)}">${esc(h.date||'Tarih eksik')} · ${esc(h.status||'Durum belirtilmemiş')}</a>`).join(''):'<p class="small muted">Bu dönemde veya bu dönemin işlerine bağlı hakediş yok.</p>'}</details>
 </div>`;
}

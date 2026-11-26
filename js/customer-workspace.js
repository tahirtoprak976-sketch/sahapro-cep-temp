// Exact-customer navigation only. Never carries a balance as a payment amount.
import {customerDesk} from './customer-desk.js';
import {isActive,fmtTL,trDate} from './core.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function customerWorkspace(d,id,options={}){
 const c=(d.customers||[]).find(c=>c.id===id&&isActive(c));
 if(!c)return null;
 const desk=customerDesk(d,id,options),available=c.active!==false;
 const query=new URLSearchParams({customer_id:id});
 return {id,name:c.name,available,internal:!!c.internal,counts:desk.counts,
  links:available?{work:'#/isler/new?'+query,site:'#/santiyeler/new?'+query,...(!c.internal?{cash:'#/kasa/new?'+query,claim:desk.preparation}:{})}:{},
  account:'#/cari/'+encodeURIComponent(id)};
}
export function customerWorkspaceHTML(d,id,report,options={}){
 const m=customerWorkspace(d,id,options);if(!m)return '';
 const count=m.counts,actions={work:'İş ekle',cash:'Tahsilat gir',claim:'Hakediş hazırla',site:'Şantiye ekle'};
 const balance=report?.balanceNow==null?NaN:Number(report.balanceNow);
 return `<div class="customer-workspace-head"><div><span class="tiny muted">MÜŞTERİ ÇALIŞMA ALANI</span><h2>İşlem ve hesap</h2><p class="small muted">${esc(m.name||'Müşteri')} · ana firma ve taşeron hesapları ayrı</p></div><a class="customer-workspace-balance" data-customer-balance href="${esc(m.account)}"><span>Cari bakiye · tüm tarihler</span><strong>${Number.isFinite(balance)?esc(fmtTL(balance))+' ₺':'Doğrulanamadı'}</strong><small>${Number.isFinite(balance)?balance>0?'Müşteri borçlu':balance<0?'Müşteri alacaklı':'Kayıtlı TL bakiye sıfır':'Kaynak hesabı kontrol edin'}</small></a></div>
 <div class="customer-workspace-actions">${Object.entries(m.links).map(([key,href])=>`<a class="btn ${key==='work'?'primary':''}" data-customer-action="${key}" href="${esc(href)}">${actions[key]}</a>`).join('')}</div>
 ${!m.available?'<p class="notice warn">Müşteri pasif; yeni işlem bağlantıları kapalı. Mevcut kayıtlar hesapta korunur.</p>':''}
 <div class="customer-workspace-counts"><span><b>${count.ready}</b> hazır iş</span><span><b>${count.missing+count.review}</b> eksik / kontrol</span><span><b>${count.claimed}</b> hakedişe bağlı</span></div>
 <details class="customer-workspace-recent"><summary>Son cari hareketler · seçili dönem</summary>${(report?.statement?.rows||[]).slice(-3).reverse().map(r=>`<a href="${esc(m.account)}" class="customer-recent-row" data-customer-recent><span>${esc(trDate(r.date))} · ${esc(r.type)}</span><b>${r.debit?'Borç + '+esc(fmtTL(r.debit)):r.credit?'Azalış − '+esc(fmtTL(r.credit)):esc(fmtTL(0))} ₺</b></a>`).join('')||'<p class="small muted">Seçili dönemde kayıtlı cari hareket yok.</p>'}</details>
 <p class="tiny muted">İş sayıları seçili döneme aittir. Bakiye dönemden bağımsızdır; KDV yalnız seçilip kesinleşen hakedişte eklenir. Mazot (L) ayrı izlenir. İşlem açmak kayıt oluşturmaz; tahsilat tutarı boş gelir.</p>`;
}

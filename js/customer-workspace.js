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

// Customer-owned sites only. A work at a site does not transfer its ownership or debt.
export function customerSites(d,id,{q='',status='active'}={}){
 const customer=(d.customers||[]).find(c=>c.id===id&&isActive(c));
 if(!customer)return {rows:[],total:0,active:0,inactive:0};
 const own=(d.sites||[]).filter(s=>isActive(s)&&s.customer_id===id);
 const key=s=>String(s??'').toLocaleLowerCase('tr-TR').normalize('NFC').trim();
 const needle=key(q);
 const rows=own.filter(s=>(status==='all'||(status==='inactive'?s.active===false:s.active!==false))&&(!needle||key([s.name,s.address,s.contact,s.location].filter(Boolean).join(' ')).includes(needle)))
 .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'tr')).map(s=>{
  const works=(d.work_records||[]).filter(w=>isActive(w)&&w.customer_id===id&&w.site_id===s.id);
  const last=works.map(w=>w.date).filter(Boolean).sort().at(-1)||'';
  const href='#/santiyeler/'+encodeURIComponent(s.id);
  return {...s,works:works.length,last,href,edit:customer.active!==false?href+'/edit':null};
 });
 return {rows,total:own.length,active:own.filter(s=>s.active!==false).length,inactive:own.filter(s=>s.active===false).length};
}
export function customerSitesHTML(d,id,options={}){
 const m=customerSites(d,id,options);
 return `<div class="customer-site-results" data-customer-site-results><p class="small muted" role="status">${m.rows.length} şantiye gösteriliyor · ${m.active} aktif / ${m.inactive} pasif</p>${m.rows.length?m.rows.map(s=>`<article class="customer-site-row" data-customer-site="${esc(s.id)}"><div><a class="strong" href="${esc(s.href)}">${esc(s.name||'Adsız şantiye')}</a><span class="badge ${s.active===false?'warn':'ok'}">${s.active===false?'Pasif':'Aktif'}</span></div>${s.address?`<p class="small">${esc(s.address)}</p>`:''}${s.contact?`<p class="small muted">Yetkili: ${esc(s.contact)}</p>`:''}<p class="tiny muted">${s.works} kayıtlı iş${s.last?' · Son iş '+esc(trDate(s.last)):''}</p><div class="row"><a class="btn" href="${esc(s.href)}">Şantiye kartı</a>${s.edit?`<a class="btn" href="${esc(s.edit)}">Düzenle</a>`:''}</div></article>`).join(''):`<p class="notice">${m.total?'Bu arama ve duruma uygun şantiye yok.':'Bu müşteriye bağlı şantiye yok. Şantiye ekleyerek adres ve saha bilgilerini burada takip edebilirsiniz.'}</p>`}</div>`;
}

// Read-only owner decisions. These are recorded scopes, never a payment authority.
import {isActive,toKurus,fromKurus} from './core.js';
import {realDate} from './work-explorer.js';
import {receivables,workReviewContext,missingCustomerWorkPrice} from './collect-core.js';
import {paymentAgenda} from './payment-agenda.js';
import {financeWorkspaceTasks} from './finance-workspace.js';
import {esc,fmtTL,trDate} from './ui.js';
export function pendingCustomerCash(data,today){
 const rows=(data.cash_records||[]).filter(r=>isActive(r)&&r.cash_type==='Müşteriden Para Alındı'&&(!realDate(r.date)||r.date<=today)&&['PERSONELDE','TESLIM_BILDIRILDI'].includes(r.cash_status));
 const known=r=>realDate(r.date)&&r.amount!==''&&r.amount!=null&&['number','string'].includes(typeof r.amount)&&String(r.amount).trim()!==''&&Number.isFinite(Number(r.amount))&&Number(r.amount)>=.01&&Number.isSafeInteger(toKurus(r.amount));
 const sum=status=>{const selected=rows.filter(r=>!status||r.cash_status===status);if(selected.some(r=>!known(r)))return null;const k=selected.reduce((n,r)=>n+toKurus(r.amount),0);return Number.isSafeInteger(k)?fromKurus(k):null;};
 return {total:sum(),personnel:sum('PERSONELDE'),reported:sum('TESLIM_BILDIRILDI')};
}
export function executiveHome(data,{today,notes={},cash=null}={}){
 const asOf={...data,work_records:(data.work_records||[]).filter(r=>realDate(r.date)&&r.date<=today),cash_records:(data.cash_records||[]).filter(r=>realDate(r.date)&&r.date<=today),cari_movements:(data.cari_movements||[]).filter(r=>realDate(r.date)&&r.date<=today)};
 const ctx=workReviewContext(asOf),unpriced=asOf.work_records.filter(r=>isActive(r)&&!ctx.internal.has(r.customer_id)&&missingCustomerWorkPrice(r,ctx.billed.has(r.id))).length;
 const agenda=paymentAgenda(asOf,{today}),near=agenda.rows.filter(r=>['overdue','today','soon'].includes(r.bucket)),recv=receivables(asOf,{today,notes});
 const validCash=cash&&realDate(cash.date)&&cash.date<=today&&cash.amount!==''&&cash.amount!=null&&['number','string'].includes(typeof cash.amount)&&String(cash.amount).trim()!==''&&Number.isFinite(Number(cash.amount))&&Number.isSafeInteger(toKurus(cash.amount));
 const tasks=financeWorkspaceTasks(asOf,{today,from:'',to:today,summary:{unpriced},notes});
 for(const t of tasks)if(t.key==='price'||t.key==='handover')t.why=t.why.replace('Seçili dönem','Bugüne kadar');
 if(!validCash||cash.date!==today)tasks.unshift({key:'cash-stale',title:validCash?'Nakit beyanını güncelleyin':'Kasa + banka tutarını doğrulayın',why:'Kayıtlı tahsilatlar, kullanılabilir para mevcudu değildir.',href:'#/nakit',action:'Nakit tahminini aç'});
 const pending=pendingCustomerCash(data,today);
 return {today,cash:validCash?{amount:Number(cash.amount),date:cash.date,current:cash.date===today}:null,pending,
  nearAmount:fromKurus(near.reduce((n,r)=>n+toKurus(r.remaining),0)),nearCount:near.length,reviewCount:agenda.rows.filter(r=>r.bucket==='review').length,
  agedAmount:fromKurus(['b30','b60','b90'].reduce((n,k)=>n+toKurus(recv.buckets[k]),0)),tasks:tasks.slice(0,3)};
}
export function executiveHomeHTML(m){
 const tile=(label,value,why,href)=>`<a class="executive-metric" href="${href}"><span>${label}</span><b>${value}</b><small>${esc(why)}</small></a>`;
 return `<section class="card executive-home" data-executive-home aria-label="İşletme karar özeti"><div class="row between"><h2>Bugünün kararları</h2><a href="#/isletme-panosu">Panoyu aç ›</a></div><div class="executive-metrics">
 ${tile('Kasa + banka beyanı',m.cash?fmtTL(m.cash.amount)+' ₺':'Doğrulanmadı',m.cash?trDate(m.cash.date)+(m.cash.current?' · bugün bildirildi':' · güncel değil'):'Nakit tahmininde tutarı girin','#/nakit')}
 ${tile('Yakın vadeli borç',fmtTL(m.nearAmount)+' ₺',m.nearCount+' alış belgesi · geçmiş vade + 7 gün','#/odeme-takibi')}
 ${tile('31+ günlük alacak',fmtTL(m.agedAmount)+' ₺','Kayıt yaşına göre · vade gecikmesi değildir','#/tahsilat')}
 ${tile('Personeldeki tahsilat',m.pending.personnel==null?'Doğrulayın':fmtTL(m.pending.personnel)+' ₺',m.pending.reported==null?'Teslim bildirimi tutarını doğrulayın':'Ayrıca '+fmtTL(m.pending.reported)+' ₺ teslim onayı bekliyor','#/kasa')}
 </div>${m.reviewCount?`<p class="small" role="status">${m.reviewCount} borç belgesi kontrol bekliyor; vade toplamına dahil değil.</p>`:''}<div class="executive-tasks" data-executive-tasks>${m.tasks.map(t=>`<a href="${esc(t.href)}"><b>${esc(t.title)}</b><span>${esc(t.action)} ›</span></a>`).join('')||'<p class="small muted">Bu kontrollerde öncelikli kayıt bulunmadı.</p>'}</div><details><summary class="tiny muted">Kapsam ve gerekçeler</summary><p class="tiny muted">Borç özeti yalnız kayıtlı alış belgeleridir; maaş, vergi, kredi ve kaydı olmayan borçları kapsamaz. Nakit beyanı banka mutabakatı değildir.</p>${m.tasks.map(t=>`<p class="tiny muted">${esc(t.title)}: ${esc(t.why)}</p>`).join('')}</details></section>`;
}

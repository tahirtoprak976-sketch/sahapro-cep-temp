// Read-only source context. Never infer a job from amount, customer name or date.
import {isActive} from './core.js';
import {esc,trDate} from './ui.js';
export function driverCashWork(record,works=[]){
 if(!record.driver_entry_id)return {state:'none',work:null};
 const all=works.filter(w=>w.driver_entry_id===record.driver_entry_id),active=all.filter(isActive);
 if(active.length>1)return {state:'ambiguous',work:null};
 if(!active.length)return {state:all.length?'deleted':'pending',work:null};
 const work=active[0];
 return {state:record.customer_id&&work.customer_id&&record.customer_id!==work.customer_id?'customer-changed':'linked',work};
}
export function driverCashContextHTML(record,works=[]){
 const {state,work}=driverCashWork(record,works);if(state==='none')return '';
 const s=record.driver_work;
 const rows=s?[
  ['İş tarihi',s.date?trDate(s.date):'—'],['Müşteri / ana firma',s.customer||'—'],['Araç / makine',s.vehicle||'—'],
  ['Yapılan iş',[s.work_type,s.quantity,s.unit].filter(x=>x!==null&&x!==undefined&&x!=='').join(' ')],['İş açıklaması',s.note||'—']
 ].map(([label,value])=>`<div class="small" style="overflow-wrap:anywhere"><b>${esc(label)}:</b> ${esc(value)}</div>`).join(''):
 record.source_quote?`<div class="small" style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(record.source_quote)}</div>`:'<div class="small muted">Bu eski bildirimde iş özeti saklanmamış.</div>';
 const status={pending:'Bu bildirime ait iş henüz kayıtlı değil. Tahsilat ve iş ayrı onaylanır.',deleted:'Bu bildirime ait iş silinmiş. Tahsilat kaydı korunuyor.',ambiguous:'Aynı bildirim kimliğinde birden fazla iş var. Kaynak iş tek olarak seçilemedi.','customer-changed':'Tahsilatın müşterisi kayıtlı işin müşterisinden farklı. İki kaydı kontrol edin.'}[state];
 return `<div class="card" data-driver-cash-context><div class="strong">Hangi işten alındı?</div>${rows}${status?`<div class="notice warn small" style="margin-top:8px">${esc(status)}</div>`:''}${work?`<a class="btn block" style="margin-top:8px" data-driver-cash-work href="#/isler/${esc(encodeURIComponent(work.id))}">İlgili işi aç</a>`:''}</div>`;
}

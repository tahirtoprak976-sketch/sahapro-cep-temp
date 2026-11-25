// Read-only cross-customer follow-up. Preparation and ledger remain the authorities.
import {isActive,todayStr,addDays,toKurus,fromKurus,matchSearch} from './core.js';
import {validDate} from './driver-delivery.js';
import {customerDesk} from './customer-desk.js';
import {customerLedgerMovements} from './collect-core.js';
const group=(rows,key)=>{const map=new Map();for(const r of rows){const a=map.get(r[key])||[];a.push(r);map.set(r[key],a);}return map;};
const money=v=>v!=null&&v!==''&&['string','number'].includes(typeof v)&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0&&Number.isSafeInteger(toKurus(v))?Number(v):null;
export function commercialDesk(d,{from,to,today=todayStr(),notes={}}={}){
 from=from||today.slice(0,8)+'01';to=to||today;
 if(!validDate(today)||!validDate(from)||!validDate(to)||from>to||to>today)throw Error('Geçerli dönem seçin; bitiş bugünden ileri olamaz.');
 const customers=(d.customers||[]).filter(isActive),byId=new Map(customers.map(c=>[c.id,c]));
 const works=group((d.work_records||[]).filter(isActive),'customer_id'),movements=group((d.cari_movements||[]).filter(isActive),'customer_id');
 const claims=(d.hakedis||[]).filter(h=>isActive(h)&&h.status!=='İptal'),drafts=group(claims.filter(h=>h.status==='Taslak'),'customer_id');
 const billed=new Set(claims.filter(h=>h.status==='Kesinleşti').flatMap(h=>(h.items||[]).map(i=>i.work_record_id)));
 const rows=[];
 for(const customer of customers){
  if(customer.internal)continue;
  const ownWorks=works.get(customer.id)||[];
  const desk=ownWorks.some(w=>!validDate(w.date)||w.date>=from&&w.date<=to)?customerDesk(d,customer.id,{from,to,today}):null;
  const counts=desk?.counts||{review:0,missing:0,ready:0,claimed:0,agreement:0};
  const ledger=customerLedgerMovements(d,customer.id,{works:ownWorks,movements:movements.get(customer.id)||[],billed});
  const balance=fromKurus(ledger.reduce((n,m)=>n+toKurus(m.amount),0));
  const note=Object.hasOwn(notes,customer.id)?notes[customer.id]||{}:{};
  const hasPromise=!!note.promise_date||note.promise_amount!=null&&note.promise_amount!=='';
  const promise=hasPromise?{date:note.promise_date||'',amount:money(note.promise_amount),review:!validDate(note.promise_date)||(note.promise_amount!=null&&note.promise_amount!==''&&money(note.promise_amount)==null),late:validDate(note.promise_date)&&note.promise_date<today&&balance>0,soon:validDate(note.promise_date)&&note.promise_date>=today&&note.promise_date<=addDays(today,7)&&balance>0}:null;
  const waiting=(drafts.get(customer.id)||[]).slice().sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.id).localeCompare(String(b.id)));
  if(!Object.values(counts).some(Boolean)&&!waiting.length&&!balance&&!promise)continue;
  const scope=new URLSearchParams({customer_id:customer.id,date_from:from,date_to:to});
  const links={preparation:'#/hakedis/hazirlik?'+scope,customer:'#/musteriler/'+encodeURIComponent(customer.id),collection:'#/tahsilat/'+encodeURIComponent(customer.id)};
  const rank=counts.review?0:counts.missing?1:promise?.late?2:promise?.review?3:waiting.length?4:counts.ready?5:promise?.soon?6:balance>0?7:8;
  const next=rank<=1?{label:'İşlerin eksiklerini kontrol et',href:links.preparation}:promise?.late||promise?.review?{label:'Ödeme sözünü kontrol et',href:links.collection}:waiting.length?{label:'Taslak hakedişi aç',href:'#/hakedis/'+encodeURIComponent(waiting[0].id)}:counts.ready?{label:'Hakedişe hazır işleri aç',href:links.preparation}:{label:'Müşteri takibini aç',href:balance>0||promise?links.collection:links.customer};
  rows.push({customer,parent:byId.get(customer.parent_customer_id)||null,counts,drafts:waiting,balance,promise,links,rank,next});
 }
 rows.sort((a,b)=>a.rank-b.rank||String(a.customer.name||'').localeCompare(String(b.customer.name||''),'tr')||String(a.customer.id).localeCompare(String(b.customer.id)));
 const unassigned=(d.work_records||[]).filter(w=>isActive(w)&&!byId.has(w.customer_id)&&(!validDate(w.date)||w.date>=from&&w.date<=to));
 return {from,to,today,rows,unassigned,counts:{review:rows.filter(r=>r.counts.review||r.counts.missing).length,ready:rows.filter(r=>r.counts.ready).length,drafts:rows.filter(r=>r.drafts.length).length,receivable:rows.filter(r=>r.balance>0).length,promises:rows.filter(r=>r.promise).length}};
}
export function commercialRows(model,{q='',status='all'}={}){
 return model.rows.filter(r=>matchSearch([r.customer.name,r.parent?.name,r.customer.phone].filter(Boolean).join(' '),q)&&(
  status==='all'||status==='review'&&(r.counts.review||r.counts.missing)||status==='ready'&&r.counts.ready||status==='drafts'&&r.drafts.length||status==='receivable'&&r.balance>0||status==='promises'&&r.promise||status==='agreement'&&r.counts.agreement));
}

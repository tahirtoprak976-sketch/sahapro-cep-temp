// Recorded purchase debts and their linked payments, as of today. Never initiates payment.
import {isActive,todayStr,addDays,toKurus,fromKurus,trDate,matchSearch} from './core.js';
import {billBalance,PARTY_STORES,PARTY_LABELS} from './enterprise-core.js';
import {realDate,csvCell} from './work-explorer.js';
export const PAYMENT_BUCKETS=[['overdue','Kayıtlı vadesi geçmiş'],['today','Vadesi bugün'],['soon','Önümüzdeki 7 gün'],['later','Daha ileri vade'],['review','Vade / kayıt kontrolü']];
const money=n=>Number(n).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₺';
const validAmount=x=>x!==''&&x!=null&&['number','string'].includes(typeof x)&&String(x).trim()!==''&&Number.isFinite(Number(x))&&Number(x)>=0;
const live=(d,s)=>(d[s]||[]).filter(isActive);
const fold=s=>String(s||'').trim().toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[.!?]+$/,'').replace(/\s+/g,' ');
const commands=new Set(['kime ödeme yapacağım','kime ödeme yapmalıyım','ödemelerim','ödeme takibi','ödeme takibini aç','ödeme takibini göster','ödeme takvimi','ödeme takvimini aç','ödemelerimi göster','ödemelerimi listele','yaklaşan ödemelerim','yaklaşan ödemeleri göster','bu hafta kime ödeme yapacağım'].map(fold));
export const isPaymentAgendaCommand=text=>commands.has(fold(text));
export function paymentAgenda(data,{today=todayStr()}={}){
 if(!realDate(today))throw Error('Ödeme takibi için geçerli bir gün gerekli.');
 const end=addDays(today,7),rows=[],payments=new Map();let futureBills=0,closed=0;
 const names=Object.fromEntries([...new Set(Object.values(PARTY_STORES))].map(s=>[s,new Map((data[s]||[]).map(r=>[r.id,r]))]));
 for(const p of live(data,'supplier_payments')){if(!payments.has(p.payable_id))payments.set(p.payable_id,[]);payments.get(p.payable_id).push(p);}
 const instruments=live(data,'instruments').filter(r=>r.direction==='Verilen'&&['Portföyde','Bankaya Verildi','Karşılıksız'].includes(r.status));
 for(const b of live(data,'payables')){
  if(b.status==='İptal')continue;
  if(realDate(b.date)&&b.date>today){futureBills++;continue;}
  const issues=[],partyStore=Object.hasOwn(PARTY_STORES,b.party_type)?PARTY_STORES[b.party_type]:null;
  const party=partyStore?names[partyStore].get(b.party_id):null;
  if(!party)issues.push('Borç sahibinin kartı bulunamadı.');
  if(!realDate(b.date))issues.push('Belge tarihi eksik veya geçersiz.');
  if(b.status&&b.status!=='Onaylandı')issues.push('Belge durumu kontrol edilmeli: '+b.status+'.');
  const related=payments.get(b.id)||[],posted=[],future=[];
  for(const p of related){
   if(!realDate(p.date)||!validAmount(p.amount)||(p.party_id&&p.party_id!==b.party_id)||(p.party_type&&p.party_type!==b.party_type)){
    issues.push('Bağlı ödeme kaydının tarih, tutar veya taraf bilgisi kontrol edilmeli.');continue;
   }
   if(p.date<b.date){issues.push('Bağlı ödeme belge tarihinden önce.');continue;}
   (p.date>today?future:posted).push(p);
  }
  if(!validAmount(b.gross_total))issues.push('Belge toplamı eksik veya geçersiz.');
  let paid=null,remaining=null;
  if(!issues.length){
   ({paid,remaining}=billBalance(b,posted));
   if(remaining<0){issues.push('Bağlı ödemeler belge toplamını aşıyor.');remaining=null;}
   else if(remaining===0){closed++;continue;}
  }
  if(!realDate(b.due_date))issues.push('Vade eksik veya geçersiz; belge tarihinden vade varsayılmadı.');
  else if(realDate(b.date)&&b.due_date<b.date)issues.push('Vade belge tarihinden önce.');
  const bucket=issues.length?'review':b.due_date<today?'overdue':b.due_date===today?'today':b.due_date<=end?'soon':'later';
  const cheques=instruments.filter(r=>r.party_type===b.party_type&&r.party_id===b.party_id).map(r=>({id:r.id,label:(r.kind||'Çek / senet')+' · '+(r.document_no||'numara yok'),hash:'#/ceksenet/'+encodeURIComponent(r.id)}));
  rows.push({id:b.id,name:party?.name||'Taraf kartı bulunamadı',partyType:PARTY_LABELS[b.party_type]||'Taraf',archived:!!party&&(!isActive(party)||party.active===false),
   date:b.date,due:b.due_date,document:b.document_no||'Belge no belirtilmedi',description:b.description||(Array.isArray(b.items)?b.items.map(i=>i.description).filter(Boolean).join(' · '):'')||'',
   gross:validAmount(b.gross_total)?Number(b.gross_total):null,paid,remaining,bucket,issues:[...new Set(issues)],futurePayments:future.length,cheques,
   hash:'#/alislar/'+encodeURIComponent(b.id)});
 }
 rows.sort((a,b)=>PAYMENT_BUCKETS.findIndex(x=>x[0]===a.bucket)-PAYMENT_BUCKETS.findIndex(x=>x[0]===b.bucket)||String(a.due||'').localeCompare(String(b.due||''))||a.name.localeCompare(b.name,'tr')||String(a.id).localeCompare(String(b.id)));
 return {today,end,rows,futureBills,closed,note:'Alış belgeleri ve bağlı ödeme kayıtlarına göre hazırlanır. Tahsilat, maaş, kira ve kaydı olmayan borçlar bu toplamda yer almaz. Kayıtlı vade, gerçek anlaşmanızla kontrol edilmelidir. Açık çek/senetler borçtan ayrıca düşülmez.'};
}
export function paymentView(plan,{q='',bucket='all'}={}){
 const searched=plan.rows.filter(r=>matchSearch([r.name,r.partyType,r.document,r.description].join(' '),q));
 const totals=Object.fromEntries(PAYMENT_BUCKETS.map(([key])=>{const rows=searched.filter(r=>r.bucket===key);return [key,{count:rows.length,amount:fromKurus(rows.reduce((n,r)=>n+toKurus(r.remaining),0))}];}));
 const selected=PAYMENT_BUCKETS.some(x=>x[0]===bucket)?bucket:'all';
 return {rows:searched.filter(r=>selected==='all'||r.bucket===selected),totals,bucket:selected,q};
}
export function paymentPriorityItems(plan){
 return plan.rows.filter(r=>['overdue','today','soon'].includes(r.bucket)).map(r=>({
  key:'payable:'+r.id,urgency:r.bucket==='overdue'?0:r.bucket==='today'?1:2,order:25,category:'Ödeme takibi',
  title:r.name+' · '+(r.bucket==='overdue'?'kayıtlı vadesi geçmiş borç':r.bucket==='today'?'kayıtlı vade bugün':'7 gün içinde kayıtlı vade'),
  why:trDate(r.due)+' kayıtlı vade · kalan '+money(r.remaining)+' (belge '+money(r.gross)+', bağlı ödemeler '+money(r.paid)+'). Belge ve ödeme kayıtlarını kontrol edin.'+(r.cheques.length?' Aynı tarafa verilmiş açık çek/senet var; aynı borç için olup olmadığını kontrol edin.':'')+(r.futurePayments?' İleri tarihli ödeme bugünkü ödenene dahil edilmedi.':''),
  action:'Borç belgesini incele',hash:r.hash}));
}
export function localPaymentAgendaCommand(text,data,today){
 if(!isPaymentAgendaCommand(text))return null;
 const plan=paymentAgenda(data,{today}),view=paymentView(plan),top=view.rows.filter(r=>['overdue','today','soon'].includes(r.bucket)).slice(0,5),t=view.totals;
 return {kind:'answer',label:'Kayıtlı ödeme takibi',text:trDate(plan.today)+' itibarıyla\n'+PAYMENT_BUCKETS.slice(0,4).map(([key,label])=>label+': '+t[key].count+' belge · '+money(t[key].amount)).join('\n')+'\nVade / kayıt kontrolü: '+t.review.count+' belge (vade toplamlarına dahil değil).\n\n'+
  top.map(r=>r.name+' · '+trDate(r.due)+' · kalan '+money(r.remaining)+(r.cheques.length?' · Aynı tarafta açık çek/senet var, kontrol edin.':'')+(r.futurePayments?' · İleri tarihli ödeme var; bugünkü ödenene dahil değil.':'')).join('\n')+'\n\n'+(top.length?'İlk '+top.length+' yakın vade gösterildi. ':'Yakın vadeli açık belge bulunmadı. ')+plan.note,
  items:[...top.map(r=>({label:r.name+' · '+r.document+' · '+money(r.remaining),hash:r.hash})),{label:'Ödeme takibinin tamamını aç',hash:'#/odeme-takibi'}]};
}
export function paymentCSV(rows){
 const lines=[['Taraf','Taraf türü','Belge no','Belge tarihi','Kayıtlı vade','Belge toplamı','Bağlı ödenen (bugüne kadar)','Kalan','Grup','Kontrol','İleri tarihli ödeme adedi','Açık çek/senet adedi']];
 for(const r of rows)lines.push([r.name,r.partyType,r.document,r.date,r.due,r.gross??'',r.paid??'',r.remaining??'',PAYMENT_BUCKETS.find(x=>x[0]===r.bucket)?.[1],r.issues.join(' '),r.futurePayments,r.cheques.length]);
 return '\uFEFF'+lines.map(row=>row.map(csvCell).join(';')).join('\r\n');
}

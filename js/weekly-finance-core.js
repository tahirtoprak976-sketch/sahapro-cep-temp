// Read-only source calendar. No cash forecast, receipt allocation, rate lookup or posting.
import {paymentAgenda} from './payment-agenda.js';
import {commercialDesk} from './commercial-desk-core.js';
import {planRows} from './enterprise-core.js';
import {isActive,todayStr,addDays,toKurus,fromKurus,matchSearch} from './core.js';
import {realDate,csvCell} from './work-explorer.js';
const live=(d,s)=>(d[s]||[]).filter(isActive);
const valid=n=>n!==''&&n!=null&&['number','string'].includes(typeof n)&&String(n).trim()!==''&&Number.isFinite(Number(n))&&Number(n)>=0&&Number.isSafeInteger(toKurus(n));
export function weeklyFinance(d,{today=todayStr(),notes={}}={}){
 if(!realDate(today))throw Error('Geçerli gün gerekli.');const end=addDays(today,6),rows=[];
 const bucket=(date,issues)=>issues.length?'review':date<today?'overdue':date<=end?'week':'later';
 const outgoing=paymentAgenda(d,{today});
 for(const r of outgoing.rows){const issues=[...r.issues];if(!valid(r.remaining))issues.push('Kalan tutar doğrulanamadı.');rows.push({id:'bill:'+r.id,direction:'out',source:'Alış borcu',name:r.name,date:r.due,amount:valid(r.remaining)?r.remaining:null,bucket:bucket(r.due,issues),issues,href:r.hash,note:r.cheques.length?'Aynı tarafta açık çek/senet var; ikinci ödeme öncesi kontrol edin.':r.futurePayments?'İleri tarihli ödeme bugünkü ödenene dahil değil.':''});}
 const desk=commercialDesk(d,{from:'0001-01-01',to:today,today,notes}),customers=new Map(desk.rows.map(r=>[r.customer.id,r]));
 const plans=live(d,'receivable_plans').filter(p=>p.status!=='İptal'),allocations=live(d,'settlement_allocations'),receipts=new Map(live(d,'cash_records').map(r=>[r.id,r])),claims=new Map(live(d,'hakedis').map(r=>[r.id,r]));
 const planLeft=x=>{try{if(!Array.isArray(x.installments)||x.installments.some(i=>!i||!valid(i.amount))||allocations.some(a=>a.plan_id===x.id&&(!realDate(a.date)||!valid(a.amount))))return Infinity;return planRows(x,allocations,today).reduce((n,i)=>n+(valid(i.remaining)?toKurus(i.remaining):Infinity),0);}catch{return Infinity;}};
 const planned=new Set();
 for(const p of plans){
  const customer=customers.get(p.customer_id),h=claims.get(p.hakedis_id),items=Array.isArray(p.installments)?p.installments:[],issues=[];
  if(!h||h.customer_id!==p.customer_id||h.status!=='Kesinleşti')issues.push('Kesinleşmiş hakediş bağlantısı doğrulanamadı.');
  if(plans.filter(x=>x.hakedis_id===p.hakedis_id).length>1)issues.push('Aynı hakedişe birden fazla vade planı bağlı.');
  if(!items.length||items.some(i=>!i||typeof i!=='object'||!i.id||!realDate(i.due_date)||!valid(i.amount)||Number(i.amount)<=0)||new Set(items.map(i=>i?.id)).size!==items.length)issues.push('Taksit kimliği, vadesi veya tutarı geçersiz.');
  if(!valid(h?.grand_total)||items.some(i=>!valid(i?.amount))||items.reduce((n,i)=>n+(valid(i?.amount)?toKurus(i.amount):0),0)!==toKurus(h?.grand_total||0))issues.push('Plan ve hakediş toplamı uyuşmuyor.');
  const own=allocations.filter(a=>a.plan_id===p.id);
  for(const a of own){const receipt=receipts.get(a.receipt_id);if(!realDate(a.date)||!valid(a.amount)||Number(a.amount)<=0||!items.some(i=>i?.id===a.installment_id)||!receipt||receipt.customer_id!==p.customer_id||receipt.cash_type!=='Müşteriden Para Alındı'||!realDate(receipt.date)||a.date<receipt.date||!valid(receipt.amount)||allocations.filter(x=>x.receipt_id===a.receipt_id&&isActive(x)).reduce((n,x)=>n+(valid(x.amount)?toKurus(x.amount):Infinity),0)>toKurus(receipt.amount))issues.push('Tahsilat eşleştirmesinin tarih, taraf veya tutarı kontrol edilmeli.');}
  const calculated=issues.length?[]:planRows(p,own,today);
  if(calculated.some(i=>!valid(i.remaining)))issues.push('Taksit kalan tutarı geçersiz.');
  if(!issues.length&&calculated.every(i=>i.remaining===0))continue;
  planned.add(p.customer_id);
  if(!customer)issues.push('Pozitif müşteri bakiyesi / müşteri kaynağı kontrol edilmeli.');
  const total=calculated.reduce((n,i)=>n+toKurus(i.remaining),0);
  if(customer&&total>toKurus(Math.max(0,customer.balance)))issues.push('Plan kalanı müşteri bakiyesini aşıyor; eşleştirilmemiş tahsilat olabilir.');
  // Multiple plans may each look valid yet together exceed the same customer balance.
  if(customer&&plans.filter(x=>x.customer_id===p.customer_id).reduce((n,x)=>n+planLeft(x),0)>toKurus(Math.max(0,customer.balance)))issues.push('Müşterinin plan toplamları bakiye ile kontrol edilmeli.');
  if(issues.length){rows.push({id:'plan:'+p.id,direction:'in',source:'Vade planı',name:customer?.customer.name||'Müşteri kontrolü',date:'',amount:null,bucket:'review',issues:[...new Set(issues)],href:'#/vadeler/'+encodeURIComponent(p.id),note:'Bu plan için ödeme sözü ayrıca toplanmadı.'});continue;}
  for(const i of calculated)if(i.remaining>0)rows.push({id:'plan:'+p.id+':'+i.id,direction:'in',source:'Vade planı',name:customer.customer.name,date:i.due_date,amount:i.remaining,bucket:bucket(i.due_date,[]),issues:[],href:'#/vadeler/'+encodeURIComponent(p.id),note:'Bağlı tahsilat eşleştirmelerine göre kalan; alınmış para değildir.'});
 }
 for(const r of desk.rows){if(planned.has(r.customer.id))continue;const note=Object.hasOwn(notes,r.customer.id)?notes[r.customer.id]:null;
  const has=note&&(note.promise_date||note.promise_amount!=null&&note.promise_amount!=='');
  if(!has){if(r.balance>0)rows.push({id:'unplanned:'+r.customer.id,direction:'in',source:'Tarihsiz alacak',name:r.customer.name,date:'',amount:r.balance,bucket:'review',issues:['Kayıtlı tahsilat tarihi yok; iş tarihinden vade varsayılmadı.'],href:r.links.collection,note:'Müşteri bakiyesi; bu haftaya otomatik yazılmadı.'});continue;}
  const issues=[];if(!realDate(note.promise_date))issues.push('Ödeme sözü tarihi eksik veya geçersiz.');if(!valid(note.promise_amount)||Number(note.promise_amount)<=0)issues.push('Ödeme sözü tutarı eksik veya geçersiz.');if(r.balance<=0||valid(note.promise_amount)&&Number(note.promise_amount)>r.balance)issues.push('Ödeme sözü müşteri bakiyesiyle kontrol edilmeli.');
  rows.push({id:'promise:'+r.customer.id,direction:'in',source:'Ödeme sözü',name:r.customer.name,date:note.promise_date||'',amount:valid(note.promise_amount)?Number(note.promise_amount):null,bucket:bucket(note.promise_date,issues),issues,href:r.links.collection,note:'Söz alınan para değildir; vade planı bulunan müşteri ayrıca toplanmaz.'});
 }
 const rank={overdue:0,week:1,review:2,later:3};rows.sort((a,b)=>rank[a.bucket]-rank[b.bucket]||String(a.date).localeCompare(String(b.date))||a.name.localeCompare(b.name,'tr')||a.id.localeCompare(b.id));
 const total=direction=>{const known=rows.filter(r=>r.direction===direction&&r.bucket==='week');const sum=known.reduce((n,r)=>n+toKurus(r.amount),0);return Number.isSafeInteger(sum)?fromKurus(sum):null;};
 return {today,end,rows,expected:total('in'),due:total('out'),futureBills:outgoing.futureBills};
}
export function weeklyRows(model,{q='',direction='all',bucket='all'}={}){return model.rows.filter(r=>(direction==='all'||direction===r.direction)&&(bucket==='all'||bucket===r.bucket)&&matchSearch([r.name,r.source,...r.issues].join(' '),q));}
export function weeklyCSV(rows){return '\uFEFF'+[['Yön','Taraf','Kaynak','Kayıtlı tarih','Tutar','Grup','Kontrol','Not'],...rows.map(r=>[r.direction==='in'?'Beklenen tahsilat':'Ödenecek',r.name,r.source,r.date,r.amount??'',r.bucket,r.issues.join(' '),r.note])].map(row=>row.map(csvCell).join(';')).join('\r\n');}

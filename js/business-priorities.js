// Read-only business decisions: reasons and source screens, never automatic writes.
import {isActive,todayStr,trDate} from './core.js';
import {receivables,chequeRows} from './collect-core.js';
import {maintenanceBoard} from './maint-core.js';
import {attentionItems} from './attention.js';
import {realDate} from './work-explorer.js';

const live=(d,s)=>(d[s]||[]).filter(isActive);
const money=n=>Number(n).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₺';
const fold=s=>String(s||'').trim().toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[.!?]+$/,'').replace(/\s+/g,' ');
const commands=new Set(['ne yapmalıyım','bugün ne yapmalıyım','bugünün öncelikleri','önceliklerim','işletme önerileri','işletmeyi değerlendir','işletme rehberi','nereden başlamalıyım'].map(fold));
export const isBusinessPriorityCommand=text=>commands.has(fold(text));

export function businessPriorities(d,{today=todayStr(),meta=[]}={}){
 if(!realDate(today))throw Error('Öncelikler için geçerli bir tarih gerekli.');
 const values=new Map(meta.map(m=>[m.key,m.value])),notes=values.get('collect_notes')||{};
 const items=[],seen=new Set();
 const add=(key,urgency,order,category,title,why,action,hash)=>{
  if(seen.has(key))return;seen.add(key);items.push({key,urgency,order,category,title,why,action,hash});
 };
 for(const r of maintenanceBoard(d,{today}).filter(r=>r.state==='late'||r.state==='soon')){
  add('maintenance:'+r.v.id+':'+r.rule.id,r.state==='late'?0:1,10,'Bakım',r.v.name+' · '+r.rule.title,
   'Kayıtlı bakım planı: '+r.text+(r.hr?.est?' · Saat sayacı iş kayıtlarından tahmin içerir.':''),
   'Bakım planını incele','#/bakim-takvimi/'+encodeURIComponent(r.v.id));
 }
 const rec=receivables(d,{today,notes});
 for(const r of rec.rows){
  const name=r.name+(r.parent?' ('+r.parent+')':'');
  const href='#/tahsilat/'+encodeURIComponent(r.id),promise=r.promise;
  if(promise&&realDate(promise.date)&&promise.date<=today){
   add('collect:'+r.id,promise.date<today?0:1,20,'Tahsilat',name+' · '+(promise.date<today?'ödeme sözü geçmiş':'ödeme sözü bugün'),
    'Kayıtlı söz: '+trDate(promise.date)+(promise.amount>0?' · '+money(promise.amount):'')+'. Açık bakiye: '+money(r.total)+'. Ödeme yapıldığı varsayılmaz.',
    'Tahsilat kaydını incele',href);
  }else if(!promise&&r.oldest_days>60&&(r.reminded_days==null||r.reminded_days>=7)){
   add('collect:'+r.id,2,40,'Tahsilat',name+' · açık alacağı takip edin',
    money(r.total)+' açık bakiye; en eski kalem '+r.oldest_days+' günlük. Bu yaş, sözleşmede vade tanımlandığı anlamına gelmez.'+(r.reminded_days==null?' Kayıtlı hatırlatma yok.':' Son hatırlatma '+r.reminded_days+' gün önce.'),
    'Açık kalemleri incele',href);
  }
 }
 for(const q of chequeRows(d,today).filter(q=>q.status==='Karşılıksız'||q.days_left<=3)){
  if(!realDate(q.due_date))continue;
  add('cheque:'+q.id,q.status==='Karşılıksız'||q.days_left<0?0:1,21,'Çek / senet',
   (q.direction==='Alınan'?'Alınan ':'Verilen ')+(q.kind||'Çek / senet')+' · '+(q.document_no||'numara yok'),
   money(q.amount)+' · '+(q.status==='Karşılıksız'?'Kayıtlı durum: Karşılıksız.':'Kayıtlı vade '+trDate(q.due_date)+'.'),
   'Çek / senet kaydını incele','#/ceksenet/'+encodeURIComponent(q.id));
 }
 for(const c of live(d,'cash_records').filter(c=>c.cash_type==='Müşteriden Para Alındı'&&['PERSONELDE','TESLIM_BILDIRILDI'].includes(c.cash_status)&&Number(c.amount)>0&&realDate(c.date)&&c.date<=today)){
  const person=live(d,'personnel').find(p=>p.id===c.personnel_id)?.name||'Personel';
  const c0=live(d,'customers').find(x=>x.id===c.customer_id),parent=live(d,'customers').find(x=>x.id===c0?.parent_customer_id);
  const customer=(c0?.name||'Müşteri')+(parent?' ('+parent.name+')':'');
  const reported=c.cash_status==='TESLIM_BILDIRILDI';
  add('cash:'+c.id,1,30,'Nakit teslimi',person+' · '+(reported?'kasaya teslim onayı bekleyen tahsilat':'kasaya teslim bekleyen tahsilat'),
   trDate(c.date)+' · '+customer+' · '+money(c.amount)+'. '+(reported?'Teslim bildirildi; kasaya teslim onayı henüz kaydedilmedi. ':'')+'Bu para müşteriden alınmış; yeniden tahsilat girmeden teslim durumunu kontrol edin.',
   'Kasa kaydını aç','#/kasa/'+encodeURIComponent(c.id));
 }
 const attention=attentionItems(d,{today,meta,restoreSets:meta.filter(m=>m.key.startsWith('restore_set:')).map(m=>m.value)});
 for(const a of attention)add('review:'+a.key,a.key==='yedek'?1:2,50,'Kayıt kontrolü',a.title,a.why,a.next,a.hash);
 if(!live(d,'work_records').length){
  add('start:work',2,90,'Başlangıç','İlk iş kaydınızı oluşturun','Bu cihazda aktif iş kaydı bulunmuyor. Müşteri, araç, tarih ve miktarı kontrol ederek başlayın.','İş formunu aç','#/isler/new');
  if(!attention.some(a=>a.key==='pdf'))add('start:history',2,91,'Başlangıç','Geçmiş işlerinizi PDF’den aktarın','Elinizde geçmiş faaliyet PDF’si varsa satırları kontrol ederek aktarabilirsiniz. Aktarım tahsilat veya kesinleşmiş hakediş oluşturmaz.','PDF aktarımını aç','#/akilli-asistan/pdf-gecmis');
 }
 items.sort((a,b)=>a.urgency-b.urgency||a.order-b.order||a.key.localeCompare(b.key,'tr'));
 return {date:today,items,total:items.length,urgent:items.filter(x=>x.urgency===0).length,
  note:'Bu cihazdaki kayıtlara göre hazırlanır. Yeni veri girdikçe yenileyin; öneriler kendiliğinden kayıt veya ödeme oluşturmaz.'};
}

export function localBusinessPriorityCommand(text,d,today,meta=[]){
 if(!isBusinessPriorityCommand(text))return null;
 const plan=businessPriorities(d,{today,meta}),top=plan.items.slice(0,5);
 return {kind:'answer',label:'Bugünün işletme öncelikleri',text:trDate(plan.date)+' · '+plan.total+' takip maddesi'+(plan.total>5?' · ilk 5 gösteriliyor':'')+'\n'+
  (top.length?top.map((x,i)=>(i+1)+'. '+x.title+'\nNeden: '+x.why+'\nSonraki adım: '+x.action).join('\n\n'):'Mevcut kurallarda takip maddesi bulunmadı. Bu, bütün işletme kayıtlarının eksiksiz olduğunu göstermez.')+'\n\n'+plan.note,
  items:[...top.map(x=>({label:x.action+' · '+x.title,hash:x.hash})),{label:'İşletme panosunu aç',hash:'#/isletme-panosu'}]};
}

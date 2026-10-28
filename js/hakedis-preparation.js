// Read-only customer/period review. No price lookup, posting, stock change or repair.
import {isActive, todayStr, calcHakedisTotals, priceForQuantity, toKurus, TRUCK_TYPES} from './core.js';
import {validDate} from './driver-delivery.js';
import {hakedisItemIssues, hakedisNumber} from './hakedis-validation.js';
import {historyWorkKey} from './history-core.js';
import {ticketKey} from './assistant-docs.js';
import {customerFuelLedger} from './assistant-rules.js';

const live=(d,s)=>(d[s]||[]).filter(isActive);
const nonTL=new Set(['Mazot karşılığı','Sözleşmeye dahil','İç iş (kendi depo)']);
const num=n=>n!==''&&n!=null&&['number','string'].includes(typeof n)&&Number.isFinite(Number(n))?Number(n):null;
const add=(map,key,value)=>{if(!key)return;const set=map.get(key)||new Set();set.add(value);map.set(key,set);};
export function preparationItem(w){
 const p=w.price_snapshot;
 return {work_record_id:w.id,date:w.date,customer_id:w.customer_id,site_id:w.site_id||null,vehicle_id:w.vehicle_id,
  work_type:w.work_type,material:w.material||'',quantity:hakedisNumber(w.quantity),unit:w.unit,
  unit_price:hakedisNumber(p?.unit_price),kdv_rate:hakedisNumber(p?.kdv_rate),kdv_included:p?.kdv_included,
  formula:p?.formula||null,first_hour_price:hakedisNumber(p?.first_hour_price),next_hour_price:hakedisNumber(p?.next_hour_price)};
}
export function preparationURL(path,scope,extra={}){
 return '#/hakedis/'+path+'?'+new URLSearchParams({customer_id:scope.customer_id,date_from:scope.from,date_to:scope.to,...(scope.site_id?{site_id:scope.site_id}:{}),...extra});
}
export function hakedisPreparation(d,{customer_id,from,to,site_id='',today=todayStr()}={}){
 const customer=live(d,'customers').find(c=>c.id===customer_id);
 if(!customer)throw Error('Aktif bir müşteri seçin.');
 if(!validDate(from)||!validDate(to)||from>to||to>today)throw Error('Geçerli başlangıç/bitiş tarihi seçin; dönem bugünden ileri olamaz.');
 const sites=new Map(live(d,'sites').map(s=>[s.id,s])),vehicles=new Map(live(d,'vehicles').map(v=>[v.id,v]));
 if(site_id&&sites.get(site_id)?.customer_id!==customer_id)throw Error('Şantiye seçilen müşteriye ait değil veya silinmiş.');
 const works=live(d,'work_records'),byId=new Map(works.map(w=>[w.id,w])),claims=new Map(),similar=new Map(),ticketOwners=new Map(),docsByWork=new Map(),badLinks=new Set();
 for(const h of live(d,'hakedis').filter(h=>h.status!=='İptal'))for(const item of h.items||[]){const arr=claims.get(item.work_record_id)||[];arr.push(h);claims.set(item.work_record_id,arr);}
 for(const w of works){
  if(validDate(w.date)&&w.vehicle_id&&num(w.quantity)>0)add(similar,historyWorkKey(w),w.id);
  if(w.slip_no)add(ticketOwners,ticketKey(w.slip_no),w.id);
 }
 for(const doc of live(d,'documents').filter(doc=>doc.category==='Döküm Fişi'&&doc.status!=='İptal')){
  const id=doc.owner_type==='work'?doc.owner_id:doc.work_record_id;
  if(doc.owner_type==='work'&&doc.work_record_id&&doc.work_record_id!==doc.owner_id){badLinks.add(doc.owner_id);badLinks.add(doc.work_record_id);continue;}
  add(ticketOwners,ticketKey(doc.doc_no),id||'document:'+doc.id);
  if(!byId.has(id))continue;
  const arr=docsByWork.get(id)||[];arr.push(doc);docsByWork.set(id,arr);
 }
 const groups={ready:[],missing:[],review:[],agreement:[],claimed:[]};
 const scoped=works.filter(w=>w.customer_id===customer_id&&(!site_id||w.site_id===site_id)&&(!validDate(w.date)||(w.date>=from&&w.date<=to)));
 for(const w of scoped){
  const issues=[],missing=[],linked=docsByWork.get(w.id)||[],numbers=new Set(linked.map(x=>ticketKey(x.doc_no)).filter(Boolean));
  if(ticketKey(w.slip_no))numbers.add(ticketKey(w.slip_no));
  const refs=claims.get(w.id)||[],undated=!validDate(w.date),item=preparationItem(w);
  if(undated)issues.push('Tarih geçersiz veya eksik; bu kayıt döneme yerleştirilemedi.');
  if(w.date_source==='yok')issues.push('İş tarihi kaynak mesajda doğrulanmamış; tarihi kontrol edin.');
  if(w.site_id&&(!sites.has(w.site_id)||sites.get(w.site_id).customer_id!==customer_id))issues.push('Şantiye ile borçlu müşteri bağlantısı uyuşmuyor.');
  if(!w.vehicle_id||!vehicles.has(w.vehicle_id))missing.push('Araç / makine kartını kontrol edin.');
  if(!w.work_type||!w.unit)missing.push('İş türü veya birim eksik.');
  if(badLinks.has(w.id))issues.push('Fiş belgesinin iş bağlantıları çelişiyor.');
  if(linked.some(doc=>validDate(doc.date)&&validDate(w.date)&&doc.date!==w.date))issues.push('Belgede kayıtlı fiş tarihi iş tarihinden farklı; kaynağı kontrol edin.');
  if(linked.some(doc=>doc.ticket_vehicle_id&&doc.ticket_vehicle_id!==w.vehicle_id))issues.push('Fişteki araç ile bağlı işin aracı farklı; kaynağı kontrol edin.');
  const peers=[...(similar.get(historyWorkKey(w))||[])].filter(id=>id!==w.id);
  if(peers.length)issues.push('Aynı müşteri, tarih, araç ve miktarla benzer iş var; ayrı işler olup olmadığını kontrol edin.');
  const duplicateKeys=[...numbers].filter(k=>(ticketOwners.get(k)?.size||0)>1);
  if(duplicateKeys.length)issues.push('Aynı fiş numarası başka iş / belgede de var; kaynağı kontrol edin.');
  if(linked.some(doc=>!ticketKey(doc.doc_no)))issues.push('Bağlı döküm belgesinin fiş numarası eksik.');
  if(new Set(linked.map(doc=>ticketKey(doc.doc_no))).size<linked.length)issues.push('Aynı fiş numarası bu işe birden fazla belgeyle bağlanmış.');
  if(w.price_snapshot?.locked&&!refs.length)issues.push('Fiyat kilitli, fakat aktif hakediş bağlantısı bulunamadı.');
  if(refs.length>1||refs.some(h=>h.customer_id!==customer_id))issues.push('Hakediş bağlantısı birden fazla veya başka müşteriye ait.');
  const agreement=nonTL.has(w.price_snapshot?.price_source)||customer.internal;
  if(w.price_snapshot?.price_source==='Mazot karşılığı'&&!(num(w.customer_fuel_allowance_l)>0))issues.push('Mazot karşılığı işin hak edilen litresi eksik veya geçersiz; anlaşmayı kontrol edin.');
  if(!refs.length&&nonTL.has(w.price_snapshot?.price_source)&&(num(w.price_snapshot.amount)>0||num(w.price_snapshot.unit_price)>0))issues.push('Anlaşma kapsamı etiketi ile pozitif TL fiyatı birlikte kayıtlı; ödeme esasını kontrol edin.');
  // Existing claims already freeze their own tariff (including manual/legacy net bases).
  // Only unclaimed work is being proposed as a new TL claim here.
  if(!agreement&&!refs.length){
   if(!w.price_snapshot)missing.push('İş fiyatı kayıtlı değil; fiyat listesi kendiliğinden uygulanmadı.');
   else {
    const priceIssues=hakedisItemIssues(item);missing.push(...priceIssues);
    if(!priceIssues.length){
     const expected=priceForQuantity({...w.price_snapshot,price:w.price_snapshot.unit_price},item.quantity,{first:item.first_hour_price,next:item.next_hour_price});
     if(!Number.isSafeInteger(toKurus(expected)))issues.push('Fiyat / miktar tutarı güvenle hesaplanamıyor; kaydı kontrol edin.');
     if(w.price_snapshot.amount!=null&&(num(w.price_snapshot.amount)==null||Number(w.price_snapshot.amount)<0||Math.abs(Number(w.price_snapshot.amount)-expected)>0.011))issues.push('Kayıtlı iş tutarı, miktar ve birim fiyatla uyuşmuyor; eski tutar otomatik değiştirilmedi.');
    }
   }
  }else if(!(num(w.quantity)>0))missing.push('İş miktarı eksik veya geçersiz.');
  const ticketRequired=TRUCK_TYPES.includes(w.work_type)&&['Sefer','Ton'].includes(w.unit);
  const expected=w.unit==='Sefer'&&num(w.quantity)>0?Number(w.quantity):null;
  if(ticketRequired&&(!numbers.size||(expected!=null&&numbers.size<expected)))missing.push(expected==null?'Döküm / kantar fişi numarası bekleniyor.':`${expected} sefer için ${numbers.size} fiş numarası kayıtlı; eksik fişleri kontrol edin.`);
  if(ticketRequired&&expected!=null&&(numbers.size>expected||!Number.isInteger(expected)))issues.push('Sefer miktarı ile kayıtlı fiş sayısı birlikte kontrol edilmeli.');
  let status=issues.length?'review':refs.length?'claimed':missing.length?'missing':agreement?'agreement':'ready';
  const row={work:w,status,issues,missing,item,documents:linked,claims:refs,peerIds:peers,undated,ticketCount:numbers.size,expectedTickets:ticketRequired?expected:null};
  groups[status].push(row);
 }
 for(const rows of Object.values(groups))rows.sort((a,b)=>String(a.work.date||'').localeCompare(String(b.work.date||''))||String(a.work.id).localeCompare(String(b.work.id)));
 const inPeriod=r=>validDate(r.date)&&r.date>=from&&r.date<=to;
 // Fuel deliveries belong to the customer account; never allocate a delivery to a job/site by guessing.
 const fuelWorks=works.filter(w=>w.customer_id===customer_id&&validDate(w.date)&&w.date<=to);
 const fuelRows=live(d,'fuel_records').filter(f=>f.customer_id===customer_id&&f.fuel_source==='Müşteri Verdi');
 const tankRows=live(d,'fuel_tank_movements').filter(m=>m.customer_id===customer_id&&m.move_type==='GİRİŞ');
 const badFuel=[...fuelRows,...tankRows].filter(r=>!validDate(r.date)||(r.date<=to&&!(num(r.liters)>0))).length+
  works.filter(w=>w.customer_id===customer_id&&(!validDate(w.date)||w.date<=to)&&(
   (w.price_snapshot?.price_source==='Mazot karşılığı'&&!(num(w.customer_fuel_allowance_l)>0))||
   (w.customer_fuel_allowance_l!=null&&(num(w.customer_fuel_allowance_l)==null||Number(w.customer_fuel_allowance_l)<0||(!validDate(w.date)&&Number(w.customer_fuel_allowance_l)>0))))).length;
 const cleanFuel=fuelRows.filter(r=>validDate(r.date)&&r.date<=to&&num(r.liters)>0),cleanTank=tankRows.filter(r=>validDate(r.date)&&r.date<=to&&num(r.liters)>0);
 const fuelScope=predicate=>customerFuelLedger(d,customer_id,{works:fuelWorks.filter(predicate),fuel:cleanFuel.filter(predicate),tank:cleanTank.filter(predicate)});
 const opening=fuelScope(r=>r.date<from),period=fuelScope(inPeriod),closing=fuelScope(()=>true);
 let totals=groups.ready.length?calcHakedisTotals(groups.ready.map(r=>r.item)):null;
 if(totals&&![totals.subtotal,totals.kdv,totals.grand].every(n=>Number.isSafeInteger(toKurus(n)))){
  for(const row of groups.ready){row.status='review';row.issues.push('Toplam tutar güvenli para hassasiyetini aşıyor; kayıtları kontrol edin.');groups.review.push(row);}
  groups.ready=[];totals=null;
 }
 return {scope:{customer_id,from,to,site_id},customer,...groups,counts:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])),
  totals,
  fuel:{opening:badFuel?null:opening.balance,earned:badFuel?null:period.earned,received:badFuel?null:period.received,closing:badFuel?null:closing.balance,incomplete:badFuel>0,invalid:badFuel,hasRecords:!!(fuelWorks.some(w=>Number(w.customer_fuel_allowance_l)>0||w.price_snapshot?.price_source==='Mazot karşılığı')||fuelRows.length||tankRows.length)}};
}

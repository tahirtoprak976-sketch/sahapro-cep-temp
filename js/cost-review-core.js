// Approved sources stage a local review; only the phone's confirmed Save can post money.
import {newRecord,isActive,normKey,toKurus,stableStringify} from './core.js';
import {validHistoryDate} from './history-core.js';
import {invoiceLines,invoiceTotals} from './enterprise-core.js';
import {creditItem} from './esnaf.js';
export const COST_REVIEW_FORMAT='SAHAPRO_COST_REVIEW_V1',COST_REVIEW='remote-cost-review:',COST_SOURCE='remote-cost-source:';
const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const text=(s,n=200)=>typeof s==='string'&&s===s.trim()&&s.length>0&&s.length<=n;
const id=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s);
const money=n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=1e9&&Math.abs(n*100-Math.round(n*100))<1e-6;
export function readCostReview(p,{now=Date.now()}={}){
 if(!exact(p,['format','id','approved','row'])||p.format!==COST_REVIEW_FORMAT||!id(p.id))throw Error('Mali kontrol paketi geçersiz');
 const a=p.approved,r=p.row,at=Date.parse(a?.at);if(!exact(a,['confirmed','at','summary'])||a.confirmed!==true||!Number.isFinite(at)||new Date(at).toISOString()!==a.at||at>now+300000||now-at>7*86400000||!text(a.summary,2000))throw Error('Güncel açık sohbet onayı gerekli');
 const fuel=r?.kind==='fuel_cash',keys=['source_key','kind','date','vehicle','amount','description','raw_message',...(fuel?['personnel','liters','unit_price','price_basis','price_source']:['supplier','category','vat_status','attachment_required'])];
 if(!exact(r,keys)||!['fuel_cash','supplier_credit'].includes(r.kind)||!text(r.source_key,120)||!validHistoryDate(r.date,new Date(now).toISOString().slice(0,10))||!text(r.vehicle)||!money(r.amount)||!text(r.description,2000)||!text(r.raw_message,20000))throw Error('Mali kontrol kaynak alanları eksik');
 if(fuel){if(!text(r.personnel)||!money(r.liters)||!money(r.unit_price)||toKurus(r.amount)!==Math.round(r.liters*r.unit_price*100)||!['receipt','reference'].includes(r.price_basis)||!text(r.price_source,1000))throw Error('Yakıt litre × fiyat ve kaynak bilgisi uyuşmalı');}
 else if(!text(r.supplier)||!['Lastik','Bakım / Onarım','Yedek Parça','Kaynak / Demir','Malzeme','Diğer'].includes(r.category)||r.vat_status!=='unknown'||r.attachment_required!==true)throw Error('Mevcut esnaf, bilinmeyen KDV ve asıl fiş dosyası gerekli');
 return structuredClone(p);
}
const single=(d,s,n)=>{const a=(d[s]||[]).filter(x=>isActive(x)&&x.active!==false&&normKey(x.name)===normKey(n));if(a.length!==1)throw Error('Tek ve etkin kart bulunmalı: '+n);return a[0];};
export function costBindings(p,d){const r=p.row,rows={vehicles:single(d,'vehicles',r.vehicle)};if(r.kind==='fuel_cash')rows.personnel=single(d,'personnel',r.personnel);else rows.suppliers=single(d,'suppliers',r.supplier);return Object.fromEntries(Object.entries(rows).map(([s,x])=>[s,{id:x.id,revision:x.updated_at||null}]));}
export function costReviewPlan(value,d,choice,digest,bindings){
 const p=readCostReview(value),r=p.row;if(!exact(choice,['confirmed','amount'])||choice.confirmed!==true||!money(choice.amount)||toKurus(choice.amount)!==toKurus(r.amount))throw Error('Telefonda tutarı kontrol edip kartı işaretleyin');
 if(stableStringify(costBindings(p,d))!==stableStringify(bindings))throw Error('Kart değişmiş; güncel kaydı kontrol edin');
 const old=d.meta?.find(x=>x.key===COST_SOURCE+r.source_key)?.value;if(old){if(old.digest!==digest)throw Object.assign(Error('OP_CONFLICT: aynı mali kaynak farklı içerik'),{code:'OP_CONFLICT'});assertCostSaved(p,d,old);return {existing:old,writes:{}};}
 const vehicle_id=bindings.vehicles.id,history_source={row_id:r.source_key,original_row:structuredClone(r),imported_at:new Date().toISOString()},writes={meta:[]};let records=[];
 if(r.kind==='fuel_cash'){
  if((d.fuel_records||[]).some(f=>isActive(f)&&f.date===r.date&&f.vehicle_id===vehicle_id&&Number(f.liters)===r.liters))throw Error('Aynı tarih/araç/litre yakıt var; mükerrer kontrolü gerekli');
  if((d.cash_records||[]).some(c=>isActive(c)&&c.date===r.date&&c.cash_type==='Şirket Gideri İçin Para Verildi'&&toKurus(c.amount)===toKurus(r.amount)&&c.personnel_id===bindings.personnel.id))throw Error('Benzer kasa çıkışı var; ikinci ödeme yazılmaz');
  const fuel=newRecord({remote_cost_review_id:p.id,date:r.date,vehicle_id,personnel_id:bindings.personnel.id,liters:r.liters,unit_price:r.unit_price,total:r.amount,fuel_source:'Petrol',receipt:r.price_basis==='receipt'?'Evet':'Hayır',kdv_rate:null,customer_billable:false,payment_method:'Nakit',description:r.description+(r.price_basis==='reference'?' · Tarihli pompa referansıyla hesaplandı; gerçek istasyon fişi değildir.':'')+' · '+r.price_source,history_source});
  const cash=newRecord({remote_cost_review_id:p.id,date:r.date,vehicle_id,personnel_id:bindings.personnel.id,customer_id:null,amount:r.amount,cash_type:'Şirket Gideri İçin Para Verildi',cash_status:'KASAYA_TESLIM_EDILDI',payment_method:'Nakit',description:'Yakıt için şirket kasasından ödeme · '+r.description,source_store:'fuel_records',source_id:fuel.id,request_id:r.source_key+':cash'});fuel.cash_record_id=cash.id;writes.fuel_records=[fuel];writes.cash_records=[cash];records=[{store:'fuel_records',id:fuel.id},{store:'cash_records',id:cash.id}];
 }else{
  if((d.payables||[]).some(b=>isActive(b)&&b.status!=='İptal'&&b.party_type==='supplier'&&b.party_id===bindings.suppliers.id&&b.date===r.date&&toKurus(b.gross_total)===toKurus(r.amount))||(d.expense_records||[]).some(e=>isActive(e)&&e.date===r.date&&e.vehicle_id===vehicle_id&&toKurus(e.amount)===toKurus(r.amount)))throw Error('Aynı gün/tutarda gider veya esnaf borcu var; mükerrer kontrolü gerekli');
  const unknown=creditItem(r.description,r.amount,null),items=invoiceLines(unknown.items),totals=invoiceTotals(items);if(!unknown.kdv_unknown||toKurus(totals.gross_total)!==toKurus(r.amount))throw Error('Esnaf borcu toplamı uyuşmadı');
  const b=newRecord({date:r.date,due_date:r.date,document_no:'SOHBET-'+p.id,party_type:'supplier',party_id:bindings.suppliers.id,items,...totals,status:'Onaylandı',cost_category:r.category,bill_kind:'Alış',kdv_unknown:true,description:r.description+' (KDV bilinmiyor)',vehicle_id,customer_id:null,site_id:null,personnel_id:null,source_store:null,source_id:null,request_id:r.source_key,history_source});writes.payables=[b];records=[{store:'payables',id:b.id}];
 }
 const link={digest,packet_id:p.id,kind:r.kind,amount:r.amount,records};writes.meta.push({key:COST_SOURCE+r.source_key,value:link});return {writes,link};
}
export function assertCostSaved(p,d,link){
 for(const x of link.records){const r=(d[x.store]||[]).find(r=>r.id===x.id&&isActive(r));if(!r)throw Error('Önceki mali kayıt silinmiş veya eksik; yeniden oluşturulmaz');if(r.date!==p.row.date||r.vehicle_id!==single(d,'vehicles',p.row.vehicle).id)throw Error('Önceki mali kayıt bağlamı değişmiş');if(x.store!=='cash_records'&&stableStringify(r.history_source?.original_row)!==stableStringify(p.row))throw Error('Önceki mali kaynak değişmiş');if(x.store==='cash_records'&&(r.source_store!=='fuel_records'||r.source_id!==link.records.find(x=>x.store==='fuel_records')?.id||r.payment_method!=='Nakit'||r.cash_type!=='Şirket Gideri İçin Para Verildi'))throw Error('Kasa/yakıt bağlantısı değişmiş');if(x.store==='payables'&&r.party_id!==single(d,'suppliers',p.row.supplier).id)throw Error('Esnaf kartı değişmiş');const amount=x.store==='fuel_records'?r.total:x.store==='payables'?r.gross_total:r.amount;if(toKurus(amount)!==toKurus(p.row.amount))throw Error('Önceki mali tutar değişmiş; ikinci kayıt açılmaz');if(x.store==='fuel_records'&&(r.liters!==p.row.liters||r.history_source?.row_id!==p.row.source_key))throw Error('Önceki yakıt kaynağı değişmiş');if(x.store==='payables'&&(r.status!=='Onaylandı'||r.history_source?.row_id!==p.row.source_key||!r.kdv_unknown))throw Error('Önceki esnaf borcu kaynağı değişmiş');}
 if(link.kind==='supplier_credit'&&!(d.attachments||[]).some(a=>a.record_type==='payable'&&a.record_id===link.records[0].id&&a.src_sha256&&a.blob?.size))throw Error('Esnaf borcunun fiş dosyası eksik');
}

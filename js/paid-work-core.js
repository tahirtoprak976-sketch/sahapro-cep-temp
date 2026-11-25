// Chat approval stages a review; only a local, unchecked collection card can save money.
import {newRecord,isActive,normKey,WORK_TYPES,WORK_UNITS,toKurus,calcHakedisLine,stableStringify} from './core.js';
import {validHistoryDate,historyWorkKey} from './history-core.js';
import {vehicleTypeInfo} from './vehicle-type-core.js';
import {FIELD_METADATA} from './business.js';
export const PAID_WORK_FORMAT='SAHAPRO_PAID_WORK_REVIEW_V1';
export const PAID_REVIEW='remote-paid-review:';
export const PAID_SOURCE='remote-paid-source:';
const id=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const text=(s,n=200)=>typeof s==='string'&&!!s.trim()&&s.trim()===s&&s.length<=n;
const money=n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=1e12&&Math.abs(n*100-Math.round(n*100))<1e-6;
export function readPaidWorkPacket(p,{now=Date.now()}={}){
 if(!exact(p,['format','id','approved','row'])||p.format!==PAID_WORK_FORMAT||!id.test(p.id))throw Error('Peşin iş kontrol paketi geçersiz');
 const a=p.approved,r=p.row;
 if(!exact(a,['confirmed','at','summary'])||a.confirmed!==true||!text(a.summary,2000)||!Number.isFinite(Date.parse(a.at))||new Date(a.at).toISOString()!==a.at||Date.parse(a.at)>now+300000||now-Date.parse(a.at)>7*86400000)throw Error('Güncel açık sohbet onayı gerekli');
 if(!exact(r,['source_key','date','customer','create_customer','vehicle','personnel','quantity','unit','work_type','description','unit_price','collection_amount','cash_status','dump_site','raw_message'])||!text(r.source_key,120)||!validHistoryDate(r.date,new Date(now).toISOString().slice(0,10))||!text(r.customer)||typeof r.create_customer!=='boolean'||!text(r.vehicle)||!text(r.personnel)||!WORK_TYPES.includes(r.work_type)||!WORK_UNITS.includes(r.unit)||typeof r.quantity!=='number'||!Number.isFinite(r.quantity)||r.quantity<=0||r.quantity>1e6||(r.unit==='Sefer'&&!Number.isInteger(r.quantity))||!text(r.description,2000)||!text(r.raw_message,20000)||!money(r.unit_price)||!money(r.collection_amount)||!Number.isSafeInteger(Math.round(r.quantity*r.unit_price*100))||!['PERSONELDE','KASAYA_TESLIM_EDILDI'].includes(r.cash_status)||typeof r.dump_site!=='string'||r.dump_site.length>200)throw Error('İş, tutar veya para teslim bilgisi eksik/geçersiz');
 if(r.dump_site&&!FIELD_METADATA.dump_area.applies_to.includes(r.work_type))throw Error('Bu iş türünde döküm sahası kullanılmaz');
 return structuredClone(p);
}
export const paidReviewKey=(channel,pid)=>{if(!id.test(channel)||!id.test(pid))throw Error('Bağlantı veya paket kimliği geçersiz');return PAID_REVIEW+channel+':'+pid;};
export async function paidDigest(p){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stableStringify(p))))].map(x=>x.toString(16).padStart(2,'0')).join('');}
const single=(rows,label)=>{const found=(rows||[]).filter(x=>isActive(x)&&normKey(x.name)===normKey(label));if(found.length!==1)throw Error('Kart tek ve etkin olarak eşleşmeli: '+label);return found[0];};
export function paidWorkPlan(packet,data,choice,digest){
 const p=readPaidWorkPacket(packet),r=p.row;
 if(!choice||choice.selected!==true)throw Error('Tahsilat kartını ayrıca işaretleyin');
 if(!exact(choice,['selected','vat_mode','vat_rate'])||!['included','excluded','unknown'].includes(choice.vat_mode)||(choice.vat_mode==='unknown'?choice.vat_rate!==null:typeof choice.vat_rate!=='number'||!Number.isFinite(choice.vat_rate)||choice.vat_rate<0||choice.vat_rate>100))throw Error('KDV oranını ve dahil/hariç durumunu seçin veya fiyatı bekletin');
 const old=data.meta?.find(m=>m.key===PAID_SOURCE+r.source_key)?.value;
 if(old){
  if(old.digest!==digest||stableStringify(old.choice)!==stableStringify(choice))throw Object.assign(Error('OP_CONFLICT: aynı kaynak farklı iş/tahsilat olamaz'),{code:'OP_CONFLICT'});
  const w=data.work_records?.find(x=>x.id===old.work_id&&isActive(x)),c=data.cash_records?.find(x=>x.id===old.cash_id&&isActive(x)),ledger=data.cari_movements?.find(x=>x.id===old.cari_id&&isActive(x));
  if(!w||!c||!ledger||w.customer_id!==c.customer_id||ledger.ref_id!==c.id||ledger.customer_id!==c.customer_id||ledger.type!=='Tahsilat'||toKurus(c.amount)!==toKurus(r.collection_amount)||toKurus(ledger.amount)!==-toKurus(r.collection_amount)||c.work_record_id!==w.id)throw Error('Önceki iş/tahsilat bağlantısı eksik veya değişmiş; yeniden yazılmaz');
  return {existing:old,writes:{}};
 }
 const writes={customers:[],work_records:[],cash_records:[],cari_movements:[],meta:[]};
 const matches=(data.customers||[]).filter(x=>isActive(x)&&normKey(x.name)===normKey(r.customer));
 if(matches.length>1)throw Error('Aynı adlı birden fazla müşteri var');
 let customer=matches[0];if(!customer){if(!r.create_customer)throw Error('Mevcut müşteri bulunamadı: '+r.customer);customer=newRecord({name:r.customer,active:true});writes.customers.push(customer);}
 const vehicle=single(data.vehicles,r.vehicle),person=single(data.personnel,r.personnel),dump=r.dump_site?single(data.dump_sites,r.dump_site):null;
 if(vehicle.active===false||person.active===false||customer.active===false||vehicleTypeInfo(vehicle).conflict)throw Error('Araç, personel veya müşteri kartı pasif/türü çelişkili');
 const work=newRecord({date:r.date,customer_id:customer.id,vehicle_id:vehicle.id,personnel_id:person.id,site_id:null,work_type:r.work_type,quantity:r.quantity,unit:r.unit,description:r.description,raw_message:r.raw_message,material:'',dump_site_id:dump?.id||null,dump_area:dump?.name||'',quarry_id:null,quarry:'',slip_status:'Fiş Yok',price_snapshot:null});
 if((data.work_records||[]).some(w=>isActive(w)&&historyWorkKey(w)===historyWorkKey(work)))throw Error('Aynı iş zaten var; ikinci iş/tahsilat oluşturulmaz');
 if((data.cash_records||[]).some(c=>isActive(c)&&c.date===r.date&&c.customer_id===customer.id&&toKurus(c.amount)===toKurus(r.collection_amount)))throw Error('Aynı gün/müşteri/tutarla tahsilat var; mevcut kaydı inceleyin');
 if(choice.vat_mode!=='unknown'){
  const line=calcHakedisLine({quantity:r.quantity,unit_price:r.unit_price,kdv_rate:choice.vat_rate,kdv_included:choice.vat_mode==='included'});
  work.price_snapshot={unit_price:r.unit_price,kdv_rate:choice.vat_rate,kdv_included:choice.vat_mode==='included',amount:line.amount,kdv:line.kdv,total:line.total,price_source:'Manuel',price_scope:'Peşin iş kontrolü',snapshot_at:new Date().toISOString(),locked:false};
 }
 const cash=newRecord({date:r.date,cash_type:'Müşteriden Para Alındı',customer_id:customer.id,vehicle_id:vehicle.id,personnel_id:person.id,site_id:null,work_record_id:work.id,amount:r.collection_amount,payment_method:'Nakit',cash_status:r.cash_status,description:'Peşin iş tahsilatı · '+r.description,request_id:'paid-work:'+r.source_key});
 const cari=newRecord({date:r.date,customer_id:customer.id,type:'Tahsilat',amount:-r.collection_amount,ref_id:cash.id,note:'Peşin iş tahsilatı'});
 const link={digest,choice:structuredClone(choice),work_id:work.id,cash_id:cash.id,cari_id:cari.id};
 writes.work_records.push(work);writes.cash_records.push(cash);writes.cari_movements.push(cari);writes.meta.push({key:PAID_SOURCE+r.source_key,value:link});
 return {writes,link};
}

// A chat message can stage a review, never write an employee claim by itself.
import {newRecord,isActive,normKey,toKurus,stableStringify,calcHakedisLine} from './core.js';
import {validHistoryDate} from './history-core.js';
export const PERSONAL_EXPENSE_FORMAT='SAHAPRO_PERSONAL_EXPENSE_REVIEW_V1';
export const PERSONAL_REVIEW='remote-personal-expense-review:';
export const PERSONAL_SOURCE='remote-personal-expense-source:';
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s);
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const text=(s,max=200)=>typeof s==='string'&&!!s.trim()&&s===s.trim()&&s.length<=max;
const money=n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=1e9&&Math.abs(n*100-Math.round(n*100))<1e-6;
export function readPersonalExpensePacket(p,{now=Date.now()}={}){
 if(!exact(p,['format','id','approved','row'])||p.format!==PERSONAL_EXPENSE_FORMAT||!uuid(p.id))throw Error('Personel gider kontrol paketi geçersiz');
 const a=p.approved,r=p.row;
 if(!exact(a,['confirmed','at','summary'])||a.confirmed!==true||!text(a.summary,2000)||!Number.isFinite(Date.parse(a.at))||new Date(a.at).toISOString()!==a.at||Date.parse(a.at)>now+300000||now-Date.parse(a.at)>7*86400000)throw Error('Güncel açık sohbet onayı gerekli');
 if(!exact(r,['source_key','date','personnel','vehicle','quarry','work_id','work_source_key','net_amount','kdv_rate','description','raw_message'])||!text(r.source_key,120)||!validHistoryDate(r.date,new Date(now).toISOString().slice(0,10))||!text(r.personnel)||!text(r.vehicle)||!text(r.quarry)||!uuid(r.work_id)||!text(r.work_source_key,120)||!money(r.net_amount)||typeof r.kdv_rate!=='number'||!Number.isFinite(r.kdv_rate)||r.kdv_rate<0||r.kdv_rate>100||!text(r.description,2000)||!text(r.raw_message,20000))throw Error('Gider, personel veya kayıtlı iş kaynağı eksik/geçersiz');
 return structuredClone(p);
}
export function personalExpenseMoney(p){return calcHakedisLine({quantity:1,unit_price:p.row.net_amount,kdv_rate:p.row.kdv_rate,kdv_included:false});}
const single=(rows,name)=>{const xs=(rows||[]).filter(x=>isActive(x)&&x.active!==false&&normKey(x.name)===normKey(name));if(xs.length!==1)throw Error('Kart tek ve etkin olmalı: '+name);return xs[0];};
export function personalExpensePlan(value,data,choice,digest,workRevision){
 const p=readPersonalExpensePacket(value),r=p.row,m=personalExpenseMoney(p);
 if(!exact(choice,['selected','paid_amount'])||choice.selected!==true||!money(choice.paid_amount))throw Error('Gerçek kişisel ödemeyi yazıp gider kartını işaretleyin');
 // A normal expense carries one gross cost and one equal reimbursement claim.
 // Partial payment needs separate payable evidence; never invent a balance or increase a claim.
 if(toKurus(choice.paid_amount)!==toKurus(m.total))throw Error('Gerçek ödeme KDV dahil toplamla farklı. Kayıt bekliyor; eksik tutar için borç veya personel alacağı varsayılmadı.');
 const key=PERSONAL_SOURCE+r.source_key,old=data.meta?.find(x=>x.key===key)?.value;
 if(old){
  if(old.digest!==digest||stableStringify(old.choice)!==stableStringify(choice))throw Object.assign(Error('OP_CONFLICT: aynı gider kaynağı değişmiş'),{code:'OP_CONFLICT'});
  const e=data.expense_records?.find(x=>x.id===old.expense_id&&isActive(x));
  if(!e||e.payment_method!=='Personel Ödedi'||toKurus(e.amount)!==toKurus(m.total)||e.personnel_id!==old.personnel_id||e.source_id!==r.work_id)throw Error('Önceki gider bağlantısı değişmiş; ikinci kayıt açılmaz');
  return {existing:old,writes:{}};
 }
 const person=single(data.personnel,r.personnel),vehicle=single(data.vehicles,r.vehicle),quarry=single(data.quarries,r.quarry);
 const w=(data.work_records||[]).find(x=>x.id===r.work_id&&isActive(x));
 if(!w||w.updated_at!==workRevision||w.history_source?.row_id!==r.work_source_key||w.personnel_id!==person.id||w.vehicle_id!==vehicle.id||w.quarry_id!==quarry.id||w.date!==r.date)throw Error('Kayıtlı iş veya kart eşleşmesi değişmiş; tekrar kontrol edin');
 if((data.expense_records||[]).some(e=>isActive(e)&&(e.history_source?.row_id===r.source_key||(e.source_store==='work_records'&&e.source_id===w.id)||(e.date===r.date&&e.personnel_id===person.id&&toKurus(e.amount)===toKurus(m.total)))))throw Error('Aynı kaynak veya benzer personel gideri var; mükerrer kontrolü gerekli');
 const expense=newRecord({...(w.customer_id?{customer_id:w.customer_id,site_id:w.site_id||null}:{}),date:r.date,category:'Malzeme',amount:m.total,net_amount:m.amount,kdv_amount:m.kdv,kdv_rate:r.kdv_rate,personnel_id:person.id,vehicle_id:vehicle.id,quarry_id:quarry.id,company:quarry.name,payment_method:'Personel Ödedi',receipt:'Hayır',reimbursement_status:'Bekliyor',description:r.description,raw_message:r.raw_message,source_store:'work_records',source_id:w.id,history_source:{row_id:r.source_key,original_row:structuredClone(r),imported_at:new Date().toISOString()}});
 const link={digest,choice:structuredClone(choice),expense_id:expense.id,personnel_id:person.id};
 return {writes:{expense_records:[expense],meta:[{key,value:link}]},link};
}

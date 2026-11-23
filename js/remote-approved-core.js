import {vehicleTypeInfo,vehicleTypeMatches} from './vehicle-type-core.js';
import {fuelRulesOf} from './assistant-rules.js';
// Chat-approved work/fuel packets. Model output alone is never delivery authority.
import {stableStringify,isActive,normKey} from './core.js';
import {readHistoryPackage,prepareHistory,initialHistoryChoices} from './history-core.js';
export const REMOTE_FORMAT='SAHAPRO_CHAT_APPROVED_V1';
export const REMOTE_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const REMOTE_AGE=7*86400000;
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const date=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const name=s=>normKey(String(s||'')).replace(/[^a-z0-9çğıöşü]/g,'');
export function readApprovedPacket(value,{now=Date.now()}={}){
 const p=typeof value==='string'?JSON.parse(value):value;
 if(!exact(p,['format','id','approved','pkg'])||p.format!==REMOTE_FORMAT||!REMOTE_ID.test(p.id))throw Error('Onaylı paket biçimi geçersiz');
 const a=p.approved;
 const approvalKeys=['confirmed','at','summary','unpriced_rows','tank_rows','new_cards'];if(a&&Object.hasOwn(a,'negative_tank_rows'))approvalKeys.push('negative_tank_rows');
 if(!exact(a,approvalKeys)||a.confirmed!==true||!date(a.at)||Date.parse(a.at)>now+300000||now-Date.parse(a.at)>REMOTE_AGE||typeof a.summary!=='string'||!a.summary.trim()||a.summary.length>2000)throw Error('Sohbet onayı eksik veya süresi dolmuş');
 const pkg=readHistoryPackage(p.pkg);
 if(pkg.rows.length>100||stableStringify(pkg)!==stableStringify(p.pkg))throw Error('Paket yalnız izinli iş/yakıt alanlarını içerebilir (en fazla100 satır)');
 const allowed=(list,kind)=>Array.isArray(list)&&list.length<=100&&new Set(list).size===list.length&&list.every(id=>typeof id==='string'&&pkg.rows.some(r=>r.row_id===id&&r.kind===kind));
 if(!allowed(a.unpriced_rows,'work')||!allowed(a.tank_rows,'fuel'))throw Error('Satır onayları pakete uymuyor');
 if(Object.hasOwn(a,'negative_tank_rows')&&(!allowed(a.negative_tank_rows,'fuel')||a.negative_tank_rows.length!==pkg.rows.length||pkg.rows.some(r=>r.kind!=='fuel')))throw Error('Eksi bakiye onayı yalnız ayrı yakıt paketinin bütün satırlarına açıkça verilmelidir');
 if(!Array.isArray(a.new_cards)||a.new_cards.length>100||a.new_cards.some(c=>!exact(c,['store','name','customer'])||!['customers','sites','vehicles'].includes(c.store)||typeof c.name!=='string'||!c.name.trim()||c.name.length>200||typeof c.customer!=='string'||c.customer.length>200||(c.store==='sites'?!c.customer.trim():c.customer!=='')))throw Error('Yeni kart onay listesi geçersiz');
 if(new Set(a.new_cards.map(c=>stableStringify(c))).size!==a.new_cards.length)throw Error('Yeni kart onayı tekrarlı');
 for(const r of pkg.rows){
  for(const k of ['date','vehicle_type','work_type','unit','material','fuel_source','transport_group_key'])if(r[k]!=null&&(typeof r[k]!=='string'||r[k].length>200))throw Error('Satır metin alanı geçersiz: '+k);
  if(r.kdv_included!=null&&typeof r.kdv_included!=='boolean')throw Error('KDV dahil/hariç alanı boolean olmalı');
  for(const k of r.kind==='work'?['quantity','unit_price','kdv_rate']:['liters'])if(r[k]!=null&&r[k]!==''&&(typeof r[k]!=='number'||!Number.isFinite(r[k])))throw Error('Miktar/fiyat alanı sonlu sayı olmalı');
  if((r.kind==='work'&&(!Number.isSafeInteger(Math.round(Number(r.quantity)*1000000))||(r.unit_price!=null&&r.unit_price!==''&&!Number.isSafeInteger(Math.round(r.quantity*r.unit_price*100)))))||(r.kind==='fuel'&&Math.abs(r.liters)>1e9))throw Error('Miktar veya toplam güvenli sınırı aşıyor');
  if(r.kind==='work'&&(r.unit_price==null||r.unit_price==='')&&!a.unpriced_rows.includes(r.row_id))throw Error('Fiyat bekletme onayı eksik');
  if(r.kind==='fuel'&&!a.tank_rows.includes(r.row_id))throw Error('Depo çıkışı onayı eksik');
 }
 return {format:p.format,id:p.id,approved:{...a,new_cards:a.new_cards.map(c=>({...c}))},pkg};
}
export function approvedPlan(value,data,options={}){
 const p=readApprovedPacket(value,options),a=p.approved;
 const choices=initialHistoryChoices(p.pkg).map(c=>({...c,include:true,unpriced_confirmed:a.unpriced_rows.includes(c.row.row_id),tank_confirmed:a.tank_rows.includes(c.row.row_id)}));
 const plan=prepareHistory(p.pkg,choices,data,{allowNew:a.new_cards.length>0,allowNegativeTank:Array.isArray(a.negative_tank_rows)&&a.negative_tank_rows.length===p.pkg.rows.length});
 for(const [i,r]of p.pkg.rows.entries()){const w=(r.kind==='work'?plan.writes.work_records:plan.writes.fuel_records).find(w=>w.history_source?.row_id===r.row_id);if(!w)continue;const vehicle=[...(data.vehicles||[]),...plan.writes.vehicles].find(v=>v.id===w.vehicle_id);if(vehicle?.active===false||vehicleTypeInfo(vehicle).conflict)plan.errors.push('Araç kartı pasif veya türü çelişkili: '+r.vehicle);if(r.vehicle_type&&!vehicleTypeMatches(r.vehicle_type,{vehicle_type:vehicle?.type,vehicle_name:vehicle?.name,vehicle_type_review:vehicle?.type_review}))plan.errors.push('Onaylanan araç türü kartla eşleşmiyor: '+r.vehicle);if(r.kind==='work'){const customer=(data.customers||[]).find(c=>c.id===w.customer_id);if(customer?.active===false)plan.errors.push('Müşteri kartı pasif: '+r.customer);if(fuelRulesOf(customer).length)plan.errors.push('Mazot karşılığı anlaşmalı müşterinin işi bu sürümde yerel kontrol gerektiriyor: '+r.customer);}}
 const actual=plan.newCards.map(c=>{const r=plan.writes[c.store].find(r=>r.id===c.id);const customer=c.store==='sites'?[...(data.customers||[]),...plan.writes.customers].find(x=>x.id===r.customer_id)?.name||'':'';return {store:c.store,name:c.name,customer};});
 for(const c of actual)if(!a.new_cards.some(x=>x.store===c.store&&name(x.name)===name(c.name)&&name(x.customer)===name(c.customer)))plan.errors.push('Bu yeni kart sohbette onaylanmamış: '+c.name);
 // Existing cards may have appeared after approval; never create an unnecessary second card.
 for(const c of a.new_cards){const rows=[...(data[c.store]||[]),...(plan.writes[c.store]||[])].filter(isActive);if(!rows.some(r=>name(r.name)===name(c.name)&&(c.store!=='sites'||[...(data.customers||[]),...plan.writes.customers].some(x=>x.id===r.customer_id&&name(x.name)===name(c.customer)))))plan.errors.push('Onaylanan kart paketin kayıtlarıyla eşleşmiyor: '+c.name);}
 plan.ready=plan.selected===p.pkg.rows.length&&!plan.errors.length;
 return {packet:p,plan};
}

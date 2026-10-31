// Read-only purchase links. Seeing a purchase never creates an expense or warranty.
import {isActive,stableStringify} from './core.js';
import {recognizedBill} from './ledger-policy.js';
import {maintenanceSourceURL} from './maintenance-history-core.js';
const live=(d,s)=>(d[s]||[]).filter(r=>isActive(r)&&r.status!=='İptal');
const fold=s=>String(s||'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,' ').trim();
export const partPurchaseCategory=s=>new Set(['yedek parca','parca','aku','aku alimi','lastik','filtre']).has(fold(s));
const partLine=s=>/\b(aku|lastik|filtre|balata|rulman|amortisor|alternator|mars motoru|yedek parca)\b/.test(fold(s));
const key=(s,id)=>s+':'+id;
const sources=new Set(['expense_records','maintenance_records','payables']);
const ref=(store,r)=>({store,id:r.id,href:maintenanceSourceURL(store,r.id)});
export function partPurchaseGroups(d){
  const expenses=live(d,'expense_records'),maintenance=live(d,'maintenance_records'),bills=live(d,'payables').filter(recognizedBill),groups=new Map();
  // Group only explicit links with matching ownership. Names/dates/amounts aren't identities.
  for(const [store,records] of [['expense_records',expenses],['maintenance_records',maintenance],['payables',bills]])for(const r of records){
    if(store==='expense_records'&&r.dump_deposit)continue;
    const items=Array.isArray(r.items)?r.items:[];
    if(!partPurchaseCategory(store==='payables'?r.cost_category:r.category||r.maint_type)&&!(store==='payables'&&items.some(i=>partLine(i.description))))continue;
    groups.set(key(store,r.id),{store,source:r,refs:[ref(store,r)],items});
  }
  for(const b of bills){
    if(!['expense_records','maintenance_records'].includes(b.source_store))continue;
    const base=(b.source_store==='expense_records'?expenses:maintenance).find(r=>r.id===b.source_id);
    if(!base||base.vehicle_id!==b.vehicle_id)continue;
    const bk=key(b.source_store,base.id),pk=key('payables',b.id),g=groups.get(bk),p=groups.get(pk);
    if(!g&&!p)continue;
    const merged={...(p||g),store:'payables',source:b,items:Array.isArray(b.items)?b.items:[],refs:[ref(b.source_store,base),ref('payables',b)]};
    groups.delete(bk);groups.set(pk,merged);
  }
  return [...groups.values()].map(g=>{
    const r=g.source,linked=live(d,'maintenance_parts').filter(p=>p.kind!=='İşçilik'&&p.vehicle_id===r.vehicle_id&&g.refs.some(s=>p.cost_source_store===s.store&&p.cost_source_id===s.id||s.store==='maintenance_records'&&p.maintenance_id===s.id));
    const conflict=g.store==='payables'&&r.source_id&&sources.has(r.source_store)&&(d[r.source_store]||[]).some(s=>s.id===r.source_id&&isActive(s)&&s.vehicle_id!==r.vehicle_id);
    const description=r.description||g.items.map(i=>i.description).filter(Boolean).join(' · ')||r.category||r.cost_category||'Yedek parça alışı';
    const supplier=g.store==='payables'&&r.party_type==='supplier'?(d.suppliers||[]).find(s=>s.id===r.party_id)?.name:'';
    const rawAmount=g.store==='payables'?r.gross_total:g.store==='expense_records'?r.amount:r.cost;
    const amount=rawAmount!=null&&['string','number'].includes(typeof rawAmount)&&String(rawAmount).trim()!==''&&Number.isFinite(Number(rawAmount))&&Number(rawAmount)>=0&&Number.isSafeInteger(Math.round(Number(rawAmount)*100))?Number(rawAmount):null;
    return {...g,id:key(g.store,r.id),vehicle_id:r.vehicle_id||'',date:r.date,description,amount,seller:supplier||r.company||r.service_company||'',invoice_no:r.document_no||'',linked,conflict,
      href:maintenanceSourceURL(g.store,r.id),signature:stableStringify(g.refs.map(s=>({store:s.store,record:(d[s.store]||[]).find(r=>r.id===s.id)}))),
      // A mixed document stays visible after its first tracked part is added.
      mixed:g.items.length>1};
  }).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||a.id.localeCompare(b.id));
}
export function purchaseForPart(d,p){
  return partPurchaseGroups(d).find(g=>g.vehicle_id===p.vehicle_id&&g.refs.some(s=>s.store===p.cost_source_store&&s.id===p.cost_source_id||s.store==='maintenance_records'&&s.id===p.maintenance_id));
}
export function purchaseDraft(d,store,id){
  const group=partPurchaseGroups(d).find(g=>g.store===store&&g.source.id===id);
  if(!group||group.conflict)throw Error('Alış kaynağı bulunamadı veya araç bağlantısı tutarsız. Kaynağı kontrol edin.');
  if(group.linked.length)throw Error('Bu alış için parça kartı zaten var. Listedeki bağlı kartı açın.');
  if(!live(d,'vehicles').some(v=>v.id===group.vehicle_id))throw Error('Önce alış / gider kaydında aracı belirtin.');
  const item=group.items.length===1?group.items[0]:null;
  const quantity=item&&['adet','ad'].includes(fold(item.unit))&&Number(item.quantity)>0?item.quantity:'';
  return {group,fields:{vehicle_id:group.vehicle_id,date:group.date,description:group.mixed?'':item?.description||group.description,quantity,unit_price:'',seller:group.seller,invoice_no:group.invoice_no,cost_mode:'existing',source:group.id,purchase_source_key:group.id,purchase_source_signature:group.signature}};
}
export const PART_READ_STORES=['maintenance_parts','expense_records','maintenance_records','payables','vehicles','suppliers'];
export async function readPartData(db){
  const connection=await db.openDB();
  return new Promise((resolve,reject)=>{const t=connection.transaction(PART_READ_STORES,'readonly'),d={};for(const s of PART_READ_STORES){const q=t.objectStore(s).getAll();q.onsuccess=()=>d[s]=q.result;}t.oncomplete=()=>resolve(d);t.onerror=t.onabort=()=>reject(t.error||Error('Parça kaynakları okunamadı.'));});
}
export async function partAttachments(db,part,data){
  const refs=[{store:'maintenance_parts',id:part.id},...(purchaseForPart(data,part)?.refs||[])];
  if(part.cost_source_id&&sources.has(part.cost_source_store))refs.push({store:part.cost_source_store,id:part.cost_source_id});
  if(part.maintenance_id)refs.push({store:'maintenance_records',id:part.maintenance_id});
  const rows=await db.getAll('attachments');
  return rows.filter(a=>isActive(a)&&refs.some(s=>a.record_id===s.id&&(a.record_type===s.store||s.store==='payables'&&a.record_type==='payable'||s.store==='maintenance_records'&&a.record_type==='maintenance'||s.store==='expense_records'&&a.record_type==='expense'))).filter((a,i,all)=>all.findIndex(b=>b.id===a.id)===i);
}

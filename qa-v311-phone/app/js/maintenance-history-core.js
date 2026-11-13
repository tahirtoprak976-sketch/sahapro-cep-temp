// Read-only operational history. Financial originals stay in their own stores.
import {isActive} from './core.js';
import {recognizedBill,pricedBill} from './ledger-policy.js';
import {linkedDumpExpenseIds} from './dump-ledger-core.js';

const fold=s=>String(s||'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,' ').trim();
const categories=new Set(['bakim','onarim','bakim onarim','tamir','tamir bakim','tamir bakim onarim','ariza','periyodik bakim','servis','lastik','lastik tamir','lastik degisimi','yag filtre']);
export const maintenanceCategory=value=>categories.has(fold(value));
const live=(d,s)=>(d[s]||[]).filter(r=>isActive(r)&&r.status!=='İptal');
const number=value=>value!=null&&['string','number'].includes(typeof value)&&String(value).trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0&&Number.isSafeInteger(Math.round(Number(value)*100))?Number(value):null;
const key=(store,id)=>store+':'+id;
const label={maintenance_records:'Bakım kaydı',expense_records:'Gider kaydı',payables:'Esnaf / alış belgesi'};
export function maintenanceSourceURL(store,id){
  const route={maintenance_records:'bakim',expense_records:'gider',payables:'alislar'};
  return Object.hasOwn(route,store)?'#/'+route[store]+'/'+encodeURIComponent(id):'';
}
function billAmount(b){
  for(const k of ['gross_total','grand_total','total'])if(b[k]!=null&&b[k]!=='')return number(b[k]);
  if(!Array.isArray(b.items)||!b.items.length)return null;
  const values=b.items.map(i=>number(i.gross??i.total??i.amount));
  return values.some(v=>v==null)?null:values.reduce((n,v)=>n+Math.round(v*100),0)/100;
}
const sameVehicle=(a,b)=>!a.vehicle_id||!b.vehicle_id||a.vehicle_id===b.vehicle_id;
const ref=(store,r)=>({store,id:r.id,label:label[store],href:maintenanceSourceURL(store,r.id)});
const sumBills=bs=>{const vs=bs.map(billAmount);return vs.some(v=>v==null)?null:vs.reduce((n,v)=>n+Math.round(v*100),0)/100;};
export function maintenanceHistory(data){
  const native=live(data,'maintenance_records'),expenses=live(data,'expense_records'),bills=live(data,'payables').filter(recognizedBill);
  const linked=new Map(),used=new Set(),rows=[],dumpLinked=linkedDumpExpenseIds(data);
  for(const b of bills)if(pricedBill(b)&&b.source_id&&['maintenance_records','expense_records'].includes(b.source_store)){
    const k=key(b.source_store,b.source_id);linked.set(k,[...(linked.get(k)||[]),b]);
  }
  const supplierName=b=>{
    const store={supplier:'suppliers',contractor:'contractors',quarry:'quarries',dump_site:'dump_sites'}[b.party_type];
    return store?(data[store]||[]).find(s=>s.id===b.party_id)?.name||'':'';
  };
  for(const [store,records] of [['maintenance_records',native],['expense_records',expenses]])for(const r of records){
    if(store==='expense_records'&&(r.dump_deposit||dumpLinked.has(r.id)))continue;
    const allLinked=linked.get(key(store,r.id))||[];
    if(store==='expense_records'&&!maintenanceCategory(r.category)&&!allLinked.some(b=>maintenanceCategory(b.cost_category)))continue;
    const owners=[...new Set([r.vehicle_id,...allLinked.map(b=>b.vehicle_id)].filter(Boolean))],conflict=owners.length>1;
    const compatible=conflict?allLinked.filter(b=>r.vehicle_id&&sameVehicle(r,b)):allLinked;
    for(const b of compatible)used.add(b.id);
    const warnings=[];
    if(conflict)warnings.push('Bağlı alış başka araca ait. Tutar bu araca taşınmadı; kaynak bağlantısını kontrol edin.');
    const vehicle_id=r.vehicle_id||(!conflict&&owners.length===1?owners[0]:null);
    if(!vehicle_id)warnings.push('Araç belirtilmemiş; araç geçmişine otomatik bağlanmadı.');
    const cost=conflict?null:compatible.length?sumBills(compatible):number(store==='maintenance_records'?r.cost:r.amount);
    const sources=[ref(store,r),...compatible.map(b=>ref('payables',b))];
    const external=store!=='maintenance_records';
    rows.push({...r,id:external?key(store,r.id):r.id,cost,vehicle_id,
      maint_type:external?r.category||'Bakım / Onarım':r.maint_type,
      // A bill/payment status describes money, never completion of repair work.
      status:external?null:r.status||'Açık',history_unknown_status:external,
      history_source_store:store,history_source_id:r.id,history_href:maintenanceSourceURL(store,r.id),
      history_origin:compatible.length?(external?'Gider + esnaf / alış':'Bakım + esnaf / alış'):label[store],
      history_sources:sources,history_warnings:warnings,
      service_company:r.service_company||r.company||compatible.map(supplierName).filter(Boolean).join(' · ')||
        (data.suppliers||[]).find(s=>s.id===r.supplier_id)?.name||'',
    });
  }
  for(const b of bills){
    if(used.has(b.id)||!maintenanceCategory(b.cost_category))continue;
    if(['expense_records','maintenance_records','fuel_records'].includes(b.source_store)&&!pricedBill(b))continue;
    const warnings=[];
    const source=b.source_id&&b.source_store&&Object.hasOwn(data,b.source_store)&&Array.isArray(data[b.source_store])?data[b.source_store].find(r=>r.id===b.source_id&&isActive(r)&&r.status!=='İptal'):null;
    if(b.source_id&&!source)warnings.push('Bağlı kaynak bulunamadı veya iptal edilmiş; alış belgesi ayrı gösteriliyor.');
    if(source&&!sameVehicle(b,source))warnings.push('Alış ile bağlı kaydın aracı farklı; otomatik birleştirilmedi.');
    if(!b.vehicle_id)warnings.push('Araç belirtilmemiş; araç geçmişine otomatik bağlanmadı.');
    rows.push({...b,id:key('payables',b.id),cost:billAmount(b),maint_type:b.cost_category,status:null,history_unknown_status:true,
      description:b.description||(b.items||[]).map(i=>i.description).filter(Boolean).join(' · '),
      service_company:supplierName(b),history_source_store:'payables',history_source_id:b.id,history_href:maintenanceSourceURL('payables',b.id),
      history_origin:label.payables,history_sources:[ref('payables',b)],history_warnings:warnings,
    });
  }
  return rows.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(a.id).localeCompare(String(b.id)));
}

export const MAINTENANCE_READ_STORES=['maintenance_records','expense_records','payables','suppliers','vehicles','personnel','contractors','quarries','dump_sites','dump_entries'];
export async function readMaintenanceData(db){
  const connection=await db.openDB();
  return new Promise((resolve,reject)=>{
    const transaction=connection.transaction(MAINTENANCE_READ_STORES,'readonly'),data={};
    for(const store of MAINTENANCE_READ_STORES){const request=transaction.objectStore(store).getAll();request.onsuccess=()=>data[store]=request.result;}
    transaction.oncomplete=()=>resolve(data);transaction.onerror=transaction.onabort=()=>reject(transaction.error||Error('Bakım kaynakları okunamadı.'));
  });
}

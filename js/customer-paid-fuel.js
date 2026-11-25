// Add a physical station delivery to an already approved offset, never a second credit.
import {isActive,newRecord,normKey,toKurus,fromKurus} from './core.js';
export const PAID_FUEL_UNKNOWN='Müşteri ödedi · fiş maliyeti bekliyor';
export const PAID_FUEL_RECEIPT='Müşteri ödedi · fiş maliyeti';
export const PAID_FUEL_PREFIX='customer-paid-fuel:';
export const paidFuelKey=source=>PAID_FUEL_PREFIX+source;
export const isCustomerPaidFuel=r=>[PAID_FUEL_UNKNOWN,PAID_FUEL_RECEIPT].includes(r?.cost_source);
export function customerPaidFuelUnknown(data,{from='',to='',vehicle_id=null,personnel_id=null,customer_id=null,site_id=null}={}){
 return (data.fuel_records||[]).filter(r=>isActive(r)&&r.cost_source===PAID_FUEL_UNKNOWN&&(!from||r.date>=from)&&(!to||r.date<=to)&&(!vehicle_id||r.vehicle_id===vehicle_id)&&(!personnel_id||r.personnel_id===personnel_id)&&(!customer_id||r.customer_id===customer_id)&&(!site_id||r.site_id===site_id));
}
export function offsetFromFuelLink(r){const {offset_source_key,...offset}=r;return {...offset,source_key:offset_source_key};}
const fail=s=>{throw Error(s);};
const unique=(data,store,name)=>{const found=(data[store]||[]).filter(x=>isActive(x)&&normKey(x.name)===normKey(name));if(found.length!==1)fail('Mevcut kart tek olarak eşleşmeli: '+name);return found[0];};
export function linkedPaidFuel(meta,store,id){return (meta||[]).find(m=>m.key?.startsWith(PAID_FUEL_PREFIX)&&(store==='fuel_records'?m.value.fuel_id===id:store==='cari_movements'&&m.value.offset_id===id));}
export function assertPaidFuelEdit(store,current,next,meta){
 if(!current||!linkedPaidFuel(meta,store,current.id))return;
 const keys=store==='fuel_records'?['date','vehicle_id','personnel_id','customer_id','liters','fuel_source','cost_source','total','unit_price','kdv_rate','receipt','event_id','tank_movement_id','deleted_at']:['date','customer_id','type','amount','reason','deleted_at'];
 if(keys.some(k=>JSON.stringify(current[k]??null)!==JSON.stringify(next[k]??null)))fail('Müşterinin ödediği yakıt ve bağlı cari mahsup tek başına değiştirilemez; bağlantılı işlemi inceleyin.');
}
export function assertPaidFuelPair(data,link){
 const f=(data.fuel_records||[]).find(r=>r.id===link.fuel_id&&isActive(r)),c=(data.cari_movements||[]).find(r=>r.id===link.offset_id&&isActive(r));
 if(!f||!c||!isCustomerPaidFuel(f)||f.fuel_source!=='Akaryakıt İstasyonu'||f.tank_movement_id||c.type!=='Duzeltme'||c.customer_id!==f.customer_id||c.date!==f.date||toKurus(c.amount)!==-toKurus(link.amount)||Number(f.liters)!==link.liters||f.vehicle_id!==link.vehicle_id||f.personnel_id!==link.personnel_id)fail('Yakıt/mahsup bağlantısı eksik, değişmiş veya silinmiş; yeniden kayıt oluşturulmaz');
 if(f.cost_source===PAID_FUEL_RECEIPT&&(toKurus(f.total)!==toKurus(link.amount)||toKurus(Number(f.unit_price)*f.liters)!==toKurus(link.amount)))fail('Fiş bedeli bağlantıyla uyuşmuyor');
 if(f.cost_source===PAID_FUEL_UNKNOWN&&(f.total!=null||f.unit_price!=null))fail('Pompa referansı fiş maliyetine çevrilmiş; bağlantıyı inceleyin');
 return f;
}
export function paidFuelPlanRow(r,data,offsetSignature){
 const source=(data.meta||[]).find(m=>m.key==='remote-action-source:'+r.offset_source_key)?.value;
 if(!source||source.store!=='cari_movements'||source.signature!==offsetSignature)fail('Kaydedilmiş onaylı mahsup kaynağı bu yakıtla eşleşmiyor');
 const old=(data.meta||[]).find(m=>m.key===paidFuelKey(r.offset_source_key));
 if(old){if(old.value.offset_signature!==offsetSignature)fail('OP_CONFLICT: aynı mahsup farklı yakıta bağlanamaz');return {existing:assertPaidFuelPair(data,old.value),meta:null};}
 const customer=unique(data,'customers',r.customer),vehicle=unique(data,'vehicles',r.vehicle),personnel=unique(data,'personnel',r.personnel);
 const c=(data.cari_movements||[]).find(c=>c.id===source.id&&isActive(c));
 if(!c||c.type!=='Duzeltme'||c.date!==r.date||c.customer_id!==customer.id||toKurus(c.amount)!==-toKurus(r.amount))fail('Mevcut mahsup tarihi, müşterisi veya tutarı değişmiş; ikinci cari hareket yazılmaz');
 if([...(data.fuel_records||[]),...(data.pending_fuel_records||[])].some(f=>isActive(f)&&f.reconciliation_status!=='cancelled'&&f.date===r.date&&f.vehicle_id===vehicle.id&&Number(f.liters)===r.liters))fail('Bu tarih/araç/litreyle yakıt zaten var veya mutabakat bekliyor; mevcut kaydı inceleyin');
 const receipt=r.price_basis==='receipt';
 const fuel=newRecord({date:r.date,vehicle_id:vehicle.id,personnel_id:personnel.id,customer_id:customer.id,liters:r.liters,fuel_source:'Akaryakıt İstasyonu',unit_price:receipt?r.unit_price:null,total:receipt?fromKurus(toKurus(r.amount)):null,cost_source:receipt?PAID_FUEL_RECEIPT:PAID_FUEL_UNKNOWN,receipt:receipt?'Evet':'Hayır',event_id:crypto.randomUUID(),description:'Müşterinin ödediği yakıt · Ödeyen: '+customer.name+' · Bağlı cari mahsup: '+r.amount+' TL ('+c.id+') · '+(receipt?'Fiş bedeli':'Tarihli pompa referansı; gerçek fiş maliyeti bilinmiyor')+' · '+r.price_source});
 const link={key:paidFuelKey(r.offset_source_key),value:{fuel_id:fuel.id,offset_id:c.id,offset_signature:offsetSignature,amount:r.amount,liters:r.liters,vehicle_id:vehicle.id,personnel_id:personnel.id}};
 return {fuel,meta:link};
}

export function validatePaidFuelRestore(current,incoming,replace,currentMeta=[]){
 const merge=(before,after,key='id',overwrite=replace)=>{const m=new Map(before.map(r=>[r[key],r]));for(const r of after)if(!m.has(r[key])||overwrite)m.set(r[key],r);return [...m.values()];};
 const data={fuel_records:merge(current.fuel_records||[],incoming.data?.fuel_records||[]),cari_movements:merge(current.cari_movements||[],incoming.data?.cari_movements||[])};
 const links=merge(currentMeta,incoming.meta||[],'key',false).filter(m=>m.key?.startsWith(PAID_FUEL_PREFIX));
 for(const m of links)assertPaidFuelPair(data,m.value);
 for(const f of data.fuel_records.filter(r=>isActive(r)&&isCustomerPaidFuel(r)))if(links.filter(m=>m.value.fuel_id===f.id).length!==1)fail('Müşterinin ödediği yakıtın mahsup bağlantısı yedekte eksik veya belirsiz');
}

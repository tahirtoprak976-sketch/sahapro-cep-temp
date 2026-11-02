import {nowISO} from './core.js';
import {canonicalVehicleType,existingVehicle} from './vehicle-type-core.js';
import {transaction} from './enterprise-db.js';
export const vehicleTypeStamp=v=>JSON.stringify([v.id,v.name,v.type,v.type_review??null,v.updated_at,v.deleted_at??null,v.active]);
// Explicit review changes only one vehicle card, never a work, price or document.
export async function confirmVehicleType(id,type,expected){
 const kind=canonicalVehicleType(type);
 if(!kind||kind==='Araç/Makine')throw Error('Aracın gerçek türünü seçin; genel veya bilinmeyen tür doğrulanamaz.');
 if(!expected)throw Error('Araç önizlemesi eksik; ekranı yeniden açın.');
 return transaction(['vehicles'],(d,t)=>{
  const current=d.vehicles.find(v=>v.id===id&&existingVehicle(v));
  if(!current)throw Error('Araç kartı yok veya silinmiş.');
  if(vehicleTypeStamp(current)!==expected)throw Error('Araç kartı bu sırada değişti; güncel bilgileri yeniden kontrol edin. Hiçbir tür yazılmadı.');
  const now=nowISO(),row={...current,type:kind,type_review:{version:1,type:kind,name:String(current.name||''),reviewed_at:now},updated_at:new Date(Math.max(Date.now(),(Date.parse(current.updated_at)||0)+1)).toISOString()};
  t.put('vehicles',row);return row;
 });
}

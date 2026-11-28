// One operational occurrence, not an asserted hour, truck or trip quantity.
export const INCLUDED_LOADING='Nakliye bedeline dahil';
export function isIncludedLoading(w){const p=w?.price_snapshot;return w?.included_loading===true&&w.work_type==='Yükleme'&&w.quantity===1&&w.unit==='Adet'&&typeof w.included_in_work_id==='string'&&!!w.included_in_work_id&&p?.price_source===INCLUDED_LOADING&&p.amount===0&&p.total===0&&p.unit_price===0&&p.kdv_rate===null&&p.kdv===null&&p.locked===true;}
export function includedLoadingSnapshot(){return {unit_price:0,amount:0,total:0,kdv:null,kdv_rate:null,kdv_included:false,price_source:INCLUDED_LOADING,locked:true,snapshot_at:new Date().toISOString()};}
export function includedLoadingQuantity(w){return isIncludedLoading(w)?'Süre belirtilmedi':null;}

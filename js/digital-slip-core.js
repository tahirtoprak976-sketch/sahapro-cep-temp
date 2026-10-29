import {isActive,WORK_UNITS,WORK_TYPES,stableStringify} from './core.js';
import {validDate} from './driver-delivery.js';

export const slipWorkIds=s=>[...new Set([...(s?.work_record_ids||[]),s?.work_record_id].filter(x=>typeof x==='string'&&x))];
export const slipRoot=s=>s.revision_of||s.id;
export function slipSource(s) {
  const {updated_at,work_record_id,work_record_ids,work_linked_at,work_link_mode,...source}=s;
  return source;
}
export function slipWorkState(data,slip) {
  const root=slipRoot(slip),family=(data.slips||[]).filter(x=>isActive(x)&&(x.id===root||x.revision_of===root));
  const ids=[...new Set(family.flatMap(slipWorkIds))];
  const works=ids.map(id=>(data.work_records||[]).find(x=>x.id===id));
  const found=works.filter(Boolean);
  const mismatch=!!ids.length&&(found.some(w=>w.customer_id!==slip.customer_id||w.date!==slip.date||w.unit!==slip.unit||(w.site_id||null)!==(slip.site_id||null)||(slip.vehicle_id&&w.vehicle_id!==slip.vehicle_id))||found.reduce((n,w)=>n+Number(w.quantity),0)!==Number(slip.quantity));
  return {root,family,ids,works:found,mismatch,state:!ids.length?'unlinked':works.some(x=>!x||!isActive(x))?'missing':'linked'};
}
export function assertSlipService(s) {
  if(!s||!isActive(s)||!['Taslak','İmzalandı'].includes(s.status)||!validDate(s.date)||!s.customer_id||
     typeof s.work_text!=='string'||!s.work_text.trim()||!['number','string'].includes(typeof s.quantity)||
     !Number.isFinite(Number(s.quantity))||!(Number(s.quantity)>0)||Number(s.quantity)>1e12||!WORK_UNITS.includes(s.unit))
    throw Error('Fişin durumu, tarihi, müşterisi veya hizmet miktarı geçersiz; fişi yeniden inceleyin.');
}
export function compatibleSlipWork(s,w) {
  return !!w&&isActive(w)&&w.customer_id===s.customer_id&&w.date===s.date&&(w.site_id||null)===(s.site_id||null)&&
    w.unit===s.unit&&Number(w.quantity)===Number(s.quantity)&&(!s.vehicle_id||w.vehicle_id===s.vehicle_id)&&
    (!s.personnel_id||!w.personnel_id||s.personnel_id===w.personnel_id);
}
export function slipWorkCandidates(data,s) {
  return (data.work_records||[]).filter(w=>compatibleSlipWork(s,w));
}
export function digitalSlipWorkType(text) {
  const norm=value=>String(value||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('tr-TR');
  return WORK_TYPES.find(type=>norm(type)===norm(text))||String(text||'').trim();
}
export function slipToWork(s,{vehicle_id=s.vehicle_id}={}) {
  assertSlipService(s);if(!vehicle_id||s.vehicle_id&&vehicle_id!==s.vehicle_id)throw Error('Fişteki araç / makineyi seçin.');
  if((s.customer_items||[]).length>1)throw Error('Çok kalemli fişi tek yeni işe çevirmeyin; kaynak işleri tek tek inceleyin.');
  return {date:s.date,customer_id:s.customer_id,site_id:s.site_id||null,vehicle_id,personnel_id:s.personnel_id||null,
    work_type:digitalSlipWorkType(s.work_text),quantity:Number(s.quantity),unit:s.unit,description:s.description||'',
    customer_note:s.description||'',internal_note:'',price_snapshot:null,source:'digital_slip'};
}
export function assertSlipExpected(current,expected) {
  if(!expected||stableStringify(slipSource(current))!==stableStringify(slipSource(expected)))throw Error('Fiş önizlemeden sonra değişti; yeniden açın.');
}

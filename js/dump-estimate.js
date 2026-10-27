// A saved estimate is an assumption, never a receipt or a measured historical load.
import { transportVehicleType } from './core.js';
import { dumpTariffFor } from './dump-ledger-core.js';
const round = n => Math.round(n * 100) / 100;
export const DEFAULT_LOAD_TON = { TIR: 27, TRUCK: 22 };
export function loadTon(vehicle) {
  return Number(vehicle?.load_ton) > 0 ? Number(vehicle.load_ton) : DEFAULT_LOAD_TON[transportVehicleType(vehicle?.type)] || 0;
}
const basisKeys = ['dump_site_id','vehicle_id','date','unit','quantity','tonnage','tonnage_scope','dump_cost'];
export function freezeDumpEstimate(work, site, vehicle, previous = null) {
  // Reading/editing an old record must not manufacture its missing historical basis.
  if (previous && !previous.dump_estimate_snapshot) return null;
  const old = previous?.dump_estimate_snapshot;
  if (old && basisKeys.every(k => (previous[k] ?? null) === (work[k] ?? null))) return old;
  if (!site && !(Number(work.dump_cost) > 0)) return null;
  const tariff = old && old.site_id === work.dump_site_id && old.work_date === work.date
    ? old : dumpTariffFor(site, work.date, work.created_at);
  const sameVehicle = old && old.vehicle_id === work.vehicle_id;
  const load = sameVehicle ? old.load_ton : loadTon(vehicle);
  const source = sameVehicle ? old.load_source : Number(vehicle?.load_ton) > 0 ? 'vehicle_estimate' : load > 0 ? 'type_default_estimate' : 'unknown';
  const quantity = Number(work.quantity) || 0;
  const trips = work.unit === 'Sefer' ? quantity : 1;
  const tonnage = Number(work.tonnage) > 0 ? Number(work.tonnage) : null;
  const scope = work.tonnage_scope || 'unknown';
  let ton = null, missing = null;
  if (tonnage && work.unit === 'Sefer' && trips > 1 && !['total','per_trip'].includes(scope)) missing = 'Tonajın tek sefer mi toplam mı olduğu doğrulanmadı';
  else if (tonnage) ton = work.unit === 'Sefer' && scope === 'per_trip' ? tonnage * trips : tonnage;
  else if (work.unit === 'Ton') ton = quantity;
  else if (work.unit === 'Sefer' && load > 0) ton = load * trips;
  else missing = 'Tahmini tonaj bilinmiyor';
  const manual = Number(work.dump_cost) > 0 ? round(Number(work.dump_cost)) : null;
  const fee = Number(tariff?.fee) || 0, unit = tariff?.fee_unit || '';
  const tariffKnown = old && old.site_id === work.dump_site_id && old.work_date === work.date ? old.tariff_known : !!(tariff?.rate_known);
  const futureTariff = !!(tariff?.effective_from && work.date && tariff.effective_from > work.date);
  let amount = manual;
  if (amount == null) {
    if (!tariffKnown || futureTariff || !['Ton','Sefer'].includes(unit)) missing = 'Kayıt tarihinde geçerli döküm tarifesi bilinmiyor';
    else if (fee === 0) { amount=0; missing=null; }
    else if (unit === 'Sefer') { amount = round(fee * trips); missing = null; }
    else if (!missing && ton > 0) amount = round(fee * ton);
  } else missing = null;
  return {
    version: 1, site_id: work.dump_site_id || null, vehicle_id: work.vehicle_id || null,
    work_date: work.date || null, work_unit: work.unit || '', quantity, trips,
    fee, fee_unit: unit, tariff_known:tariffKnown&&!futureTariff, effective_from: tariff?.effective_from || null,
    load_ton: load || null, load_source: source,
    source_tonnage: tonnage, tonnage_scope: scope, total_ton: ton == null ? null : round(ton),
    manual_amount: manual, amount, missing_reason: missing,
    captured_at: new Date().toISOString(), provenance: 'saved_estimate',
  };
}
export function validateDumpEstimate(s, w) {
  if (s == null) return;
  if (typeof s !== 'object' || s.version !== 1 || s.provenance !== 'saved_estimate' ||
      s.site_id !== (w.dump_site_id || null) || s.vehicle_id !== (w.vehicle_id || null) ||
      s.work_date !== w.date || s.work_unit !== w.unit || s.quantity !== Number(w.quantity) ||
      s.trips !== (w.unit === 'Sefer' ? Number(w.quantity) : 1) ||
      s.tonnage_scope !== (w.tonnage_scope || 'unknown') ||
      s.source_tonnage !== (Number(w.tonnage) > 0 ? Number(w.tonnage) : null) ||
      s.manual_amount !== (Number(w.dump_cost) > 0 ? round(Number(w.dump_cost)) : null) ||
      !['Ton','Sefer',''].includes(s.fee_unit) ||
      !['vehicle_estimate','type_default_estimate','unknown'].includes(s.load_source) ||
      typeof s.tariff_known !== 'boolean' ||
      (s.effective_from != null && (!/^\d{4}-\d{2}-\d{2}$/.test(s.effective_from) || new Date(s.effective_from+'T12:00:00Z').toISOString().slice(0,10)!==s.effective_from)) ||
      (s.load_source==='unknown') !== (s.load_ton==null) ||
      !Number.isFinite(Date.parse(s.captured_at))) throw Error('Döküm tahmin kopyası geçersiz');
  for (const key of ['fee','quantity','trips','load_ton','source_tonnage','total_ton','manual_amount','amount']) {
    if (s[key] !== null && (typeof s[key] !== 'number' || !Number.isFinite(s[key]) || s[key] < 0)) throw Error('Döküm tahmin tutarı/tonajı geçersiz');
  }
  // Check redundant arithmetic without consulting a mutable card or current tariff.
  const rebuilt = freezeDumpEstimate(w, {id:s.site_id, fee:s.tariff_known?s.fee:undefined, fee_unit:s.fee_unit, fee_effective_from:s.effective_from}, {load_ton:s.load_ton});
  if (rebuilt?.amount !== s.amount || rebuilt?.total_ton !== s.total_ton || rebuilt?.missing_reason !== s.missing_reason) throw Error('Döküm tahmin hesabı tutarsız');
}

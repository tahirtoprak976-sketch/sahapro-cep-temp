import {dumpReceiptRows,companyDumpReceipt} from "./dump-ledger-core.js";
import { isActive } from "./core.js";
import { resolveWorkTonnage } from "./work-tonnage.js";
import { recognizedBill } from "./ledger-policy.js";
import {freezeDumpEstimate, loadTon, DEFAULT_LOAD_TON} from "./dump-estimate.js";
export {loadTon, DEFAULT_LOAD_TON};
const live = (d, s) => (d[s] || []).filter(isActive);
const fold = (s) => String(s || "").toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
const r2 = (n) => Math.round(n * 100) / 100;
export const OFFICIAL_DUMPS = [
  {key:"bolluca",name:"Bolluca",fee:160}, {key:"cebeci",name:"Cebeci",fee:210}, {key:"istac",name:"İSTAÇ Döküm",fee:235},
];
export const FEE_UNITS = ["Ton", "Sefer"];

// Only saved assumptions may price saved work. Never backfill a historical load from today's card.
export function calculatedDumpFee(d, w) {
  if (!w) return null;
  const site = (d.dump_sites || []).find(s => s.id === w.dump_site_id);
  const manual = Number(w.dump_cost) > 0;
  if (!manual && live(d,"customers").find(c=>c.id===w.customer_id)?.internal) return null;
  if (!manual && (!w.dump_site_id || site?.own_yard)) return null;
  const trips = w.unit === 'Sefer' ? Number(w.quantity) || 0 : 1;
  let snapshot = w.dump_estimate_snapshot;
  let unverified = false;
  if (!snapshot && !w.id) snapshot = freezeDumpEstimate(w, site, live(d,'vehicles').find(v=>v.id===w.vehicle_id)); // unsaved quote/preview
  if (!snapshot) {
    unverified = true;
    // Existing explicit amount or an explicitly scoped ton + frozen tariff is usable as an estimate,
    // but does not prove a receipt. Missing old assumptions stay unknown; no bulk data mutation.
    const tariff = w.dump_tariff_snapshot;
    const knownTonnage = resolveWorkTonnage(w).known;
    if (manual || (tariff?.site_id === w.dump_site_id && (tariff.fee_unit === 'Sefer' || knownTonnage || w.unit === 'Ton'))) {
      snapshot = freezeDumpEstimate(w, tariff ? {id:w.dump_site_id,fee:tariff.fee,fee_unit:tariff.fee_unit,fee_effective_from:tariff.effective_from} : site, null);
      if(snapshot) snapshot={...snapshot,provenance:'legacy_recorded_basis',captured_at:null};
    }
  }
  if (!snapshot) return {site:site?.name||w.dump_area||'Döküm',unit:'Ton',fee:null,amount:null,trips,ton:null,estimated:true,missing:true,unverified:true,missing_reason:'Geçmiş tahminin tarife/tonaj dayanağı doğrulanmadı',estimate_snapshot:null};
  // Explicit zero/free-site records do not add a cost; absence of a historical basis is not zero.

  return {site:site?.name||w.dump_area||'Döküm',unit:manual?'Elle':snapshot.fee_unit,fee:snapshot.fee,amount:snapshot.amount,trips,ton:snapshot.total_ton,estimated:true,manual,missing:snapshot.amount==null,unverified:unverified||snapshot.amount==null,missing_reason:snapshot.missing_reason||(unverified?'Eski kayıttaki dayanak; fişle doğrulanmadı':null),estimate_snapshot:snapshot};
}

// One company-cost projection: actual receipts replace only their covered trips.
// The remainder is an allocation of the saved estimate, never a measured residual tonnage.
export function dumpFee(d,w) {
  if (!w) return null;
  const receipts = dumpReceiptRows(d).filter(e=>w.id && e.work_record_id===w.id);
  const company = receipts.filter(companyDumpReceipt);
  const expected = w.unit==='Sefer' ? Number(w.quantity) : 1;
  const rawCovered = receipts.reduce((n,e)=>n+(typeof e.trips==='number'?e.trips:NaN),0);
  const coverageUnknown = !(expected>0) || receipts.some(e=>!Number.isInteger(e.trips)||e.trips<1) || !Number.isFinite(rawCovered) || rawCovered>expected;
  const covered = coverageUnknown ? null : rawCovered;
  const pending = covered == null ? null : Math.max(0,expected-covered);
  const actual = r2(company.reduce((n,e)=>n+(Number.isFinite(Number(e.amount))?Number(e.amount):0),0));
  const base = calculatedDumpFee(d,w);
  const customerPays = w.dump_payer==='customer';
  let remaining = customerPays || pending===0 ? 0 : coverageUnknown || base?.amount==null ? null : r2(base.amount*pending/expected);
  if (!company.length && (customerPays || (pending===0 && receipts.length))) return null;
  if (!base && !company.length) return null;
  const payableLinks = (d.payables||[]).filter(b=>recognizedBill(b)&&b.party_type==='dump_site'&&(b.items||[]).some(i=>i.work_record_id===w.id)).map(b=>({id:b.id,date:b.date}));
  const payableOverlap = payableLinks.length>0;
  const unreconciledEstimate = payableOverlap ? remaining : null;
  if(payableOverlap && !customerPays) remaining=null;
  const missing = payableOverlap || (!customerPays && pending!==0 && remaining==null);
  return {...(base||{}),site:base?.site||(d.dump_sites||[]).find(s=>s.id===w.dump_site_id)?.name||'Döküm',
    amount:remaining==null ? (company.length?actual:null) : r2(actual+remaining),
    payable_links:payableLinks,payable_overlap:payableOverlap,unreconciled_estimate:unreconciledEstimate,
    confirmed_amount:actual,remaining_estimated_amount:remaining,expected_total:missing?null:r2(actual+(remaining||0)),
    confirmed:company.length>0, estimated:!customerPays&&pending!==0, provisional:!customerPays&&pending!==0,
    missing,unverified:missing||coverageUnknown||!!(pending&&base?.unverified),coverage_unknown:coverageUnknown,
    missing_reason:payableOverlap?'Bağlı döküm alış belgesi ile fişlerin örtüşmesi doğrulanmadı; beklenen toplam kesinleştirilmedi':coverageUnknown?'Fişlerin kapsadığı sefer sayısı doğrulanmadı':missing?base?.missing_reason||'Kalan seferlerin tahmin dayanağı bilinmiyor':base?.missing_reason||null,
    pending_trips:pending,covered_trips:covered,expected_trips:expected,
    actual_ton:r2(company.reduce((n,e)=>n+(Number(e.tonnage)||0),0))||null,
    receipt_ids:company.map(e=>e.id),
  };
}
export function unassignedDumpCosts(d,{from="",to=""}={}) {
 const works = new Set(live(d,'work_records').map(w=>w.id));
 return dumpReceiptRows(d).filter(e=>(!e.work_record_id||!works.has(e.work_record_id))&&companyDumpReceipt(e)&&(!from||e.date>=from)&&(!to||e.date<=to));
}
export function dumpFeeRows(d, {from="",to=""}={}) {
  const out=[];
  for (const w of live(d,'work_records')) {
    if (!w.date || (from&&w.date<from) || (to&&w.date>to)) continue;
    const f=dumpFee(d,w); if(f) out.push({w,...f});
  }
  return out;
}

// İlk açılışta resmi sahaların ücretleri karta yazılır (kart yoksa açılır; ücret elle girilmişse dokunulmaz)
export async function seedOfficialDumps(db) {
  if (await db.metaGet("dump_fees_seed_v1")) return 0;
  const sites = (await db.getAll("dump_sites")).filter(isActive);
  let n = 0;
  for (const o of OFFICIAL_DUMPS) {
    const s = sites.find((x) => fold(x.name).replace(/[^a-z]/g, "").includes(o.key));
    if (s) {
      if (!(Number(s.fee) > 0)) { await db.saveExisting("dump_sites", s, { fee: o.fee, fee_unit: "Ton", official: true }, "Resmi döküm ücreti"); n++; }
    } else { await db.saveNew("dump_sites", { name: o.name, fee: o.fee, fee_unit: "Ton", official: true, note: "Belediye resmi döküm sahası · ton başı KDV dahil" }, "Resmi döküm sahası"); n++; }
  }
  await db.metaSet("dump_fees_seed_v1", true);
  return n;
}

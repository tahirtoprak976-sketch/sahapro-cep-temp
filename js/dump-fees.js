import {dumpReceiptRows,companyDumpReceipt,dumpTariffFor} from "./dump-ledger-core.js";
// Döküm ücreti: döküm sahasının kartındaki ücret (ton başı ya da sefer başı, KDV dahil) × işin tonu / seferi.
// Ton: fişteki ton (iş kaydında "tonaj"); fiş yoksa aracın "ortalama yük"ü (kartta yoksa tır 27, kamyon 22 ton) × sefer — tahmin olarak işaretlenir.
// Belediyenin resmi sahaları: Bolluca 160 ₺/ton, Cebeci 210 ₺/ton, İSTAÇ 235 ₺/ton (KDV dahil, Ekim 2026, işletme sahibinden).
import { isActive, transportVehicleType } from "./core.js";

const live = (d, s) => (d[s] || []).filter(isActive);
const fold = (s) => String(s || "").toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
const r2 = (n) => Math.round(n * 100) / 100;

export const OFFICIAL_DUMPS = [
  { key: "bolluca", name: "Bolluca", fee: 160 },
  { key: "cebeci", name: "Cebeci", fee: 210 },
  { key: "istac", name: "İSTAÇ Döküm", fee: 235 },
];
export const FEE_UNITS = ["Ton", "Sefer"];
// Araç kartında "ortalama yük" yoksa türüne göre (işletme sahibinden, Ekim 2026): tır 27 ton, kamyon 22 ton
export const DEFAULT_LOAD_TON = { TIR: 27, TRUCK: 22 };
export function loadTon(v) {
  if (Number(v?.load_ton) > 0) return Number(v.load_ton);
  return DEFAULT_LOAD_TON[transportVehicleType(v?.type)] || 0;
}

// Bir işin döküm ücreti. null: maliyet yok (döküm yeri/ücret tanımlı değil ya da depodan çıkışta elle yazılmamış)
export function calculatedDumpFee(d, w) {
  if (!w) return null;
  const s0 = live(d, "dump_sites").find((x) => x.id === w.dump_site_id);
  // Elle yazılan döküm maliyeti her zaman geçerli (iş kaydında "Döküm maliyeti ₺")
  if (Number(w.dump_cost) > 0) return { site: s0?.name || w.dump_area || "Döküm", unit: "Elle", fee: null, amount: r2(Number(w.dump_cost)), trips: w.unit === "Sefer" ? Number(w.quantity) || 0 : 1, ton: null, estimated: false, manual: true };
  // Kendi depodan çıkış (iç iş): maliyeti işletme sahibi elle yazar; boşsa maliyet yok (ör. stabilize çıkışı)
  if (live(d, "customers").find((c) => c.id === w.customer_id)?.internal) return null;
  if (!w.dump_site_id) return null;
  const s = s0;
  const tariff=w.dump_tariff_snapshot?.site_id===s?.id?w.dump_tariff_snapshot:dumpTariffFor(s,w.date,w.created_at);
  const fee = Number(tariff?.fee) || 0;
  if (!s || !(fee > 0) || !FEE_UNITS.includes(tariff.fee_unit)) return null;
  const qty = Number(w.quantity) || 0;
  const trips = w.unit === "Sefer" ? qty : 1;
  if (tariff.fee_unit === "Sefer") return { site: s.name, unit: "Sefer", fee, amount: r2(fee * trips), trips, ton: null, estimated: false };
  let ton = Number(w.tonnage) || (w.unit === "Ton" ? qty : 0), estimated = false;
  // Birden çok seferlik kayıtta tek fiş tonu yazılmış olabilir: ton aracın sefer başı yükünün katı değilse kalan seferler o fişin tonuyla tahmin edilir
  if (Number(w.tonnage) > 0 && w.unit === "Sefer" && trips > 1 && w.tonnage_scope !== "total") {
    if(w.tonnage_scope === "per_trip") { ton=r2(Number(w.tonnage)*trips); } else {
    const ref = loadTon(live(d, "vehicles").find((x) => x.id === w.vehicle_id));
    const k = ref > 0 ? Math.min(trips, Math.max(1, Math.round(Number(w.tonnage) / ref))) : trips;
    if (k < trips) { ton = r2((Number(w.tonnage) / k) * trips); estimated = true; }
    }
  }
  if (!(ton > 0)) {
    const v = live(d, "vehicles").find((x) => x.id === w.vehicle_id);
    const load = loadTon(v);
    if (load > 0 && w.unit === "Sefer") { ton = r2(load * trips); estimated = true; }
  }
  if (!(ton > 0)) return { site: s.name, unit: "Ton", fee, amount: null, trips, ton: null, estimated: false, missing: true };
  return { site: s.name, unit: "Ton", fee, amount: r2(fee * ton), trips, ton: r2(ton), estimated };
}

export function dumpFee(d,w) {
  if(!w)return null;
  const receipts=dumpReceiptRows(d).filter(e=>e.work_record_id===w.id);
  if(receipts.length){
    const company=receipts.filter(companyDumpReceipt),site=live(d,"dump_sites").find(s=>s.id===w.dump_site_id);
    if(!company.length)return null;
    const amount=r2(company.reduce((n,e)=>n+e.amount,0)),trips=receipts.reduce((n,e)=>n+e.trips,0),expected=w.unit==="Sefer"?Number(w.quantity):1;
    return {site:site?.name||"Döküm",unit:"Fiş",fee:null,amount,trips:company.reduce((n,e)=>n+e.trips,0),ton:r2(company.reduce((n,e)=>n+(e.tonnage||0),0))||null,estimated:false,confirmed:true,pending_trips:Math.max(0,expected-trips),receipt_ids:company.map(e=>e.id)};
  }
  if(w.dump_payer==="customer")return null;
  const fee=calculatedDumpFee(d,w);return fee?{...fee,provisional:true}:fee;
}
export function unassignedDumpCosts(d,{from="",to=""}={}) {
 return dumpReceiptRows(d).filter(e=>!e.work_record_id&&companyDumpReceipt(e)&&(!from||e.date>=from)&&(!to||e.date<=to));
}

export function dumpFeeRows(d, { from = "", to = "" } = {}) {
  const inR = (x) => x && (!from || x >= from) && (!to || x <= to);
  const out = [];
  for (const w of live(d, "work_records")) {
    if (!inR(w.date)) continue;
    const f = dumpFee(d, w);
    if (f) out.push({ w, ...f });
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

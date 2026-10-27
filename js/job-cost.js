import {pendingFuelSummary} from './historical-fuel.js';
// İş sözleşmesi panosu için maliyet ve kârlılık — SAF hesap, kayıt yazmaz. Tüm giderler TAHMİNDİR ve yöntemiyle döner:
// • Mazot: aracın son 90 gün sefer/saat başı litresi (yoksa aynı tür araçlar) × o günkü mazot litre fiyatı (fuelPerUnit, fuelPriceAt).
// • İşçilik: şoför/operatörün günlük maliyeti (yevmiye ya da aylık maaş ÷ 26 iş günü) × o gün bu işe ayırdığı pay (o günkü kayıtlarının oranı).
// • Döküm: kayıtlardaki döküm ücreti (dumpFee). • Diğer: bu şantiyeye yazılmış giderler (expense_records.site_id).
// Gelir NET (KDV hariç) karşılaştırılır: KDV gelir değildir.
import { isActive, todayStr, addDays } from "./core.js";
import { fuelPerUnit } from "./quote-core.js";
import { fuelPriceAt } from "./price-health.js";
import { dumpFee } from "./dump-fees.js";
import { linkedDumpExpenseIds } from "./dump-ledger-core.js";
import { dealOf, dealMoney } from "./job-core.js";

const live = (d, s) => (d?.[s] || []).filter(isActive);
const r0 = (n) => Math.round(Number(n) || 0);
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const netOf = (w) => {
  const p = w.price_snapshot; if (!p) return 0;
  const a = Number(p.amount ?? Number(p.unit_price) * Number(w.quantity));
  if (!(Number.isFinite(a) && a > 0)) return 0;
  const r = Number(p.kdv_rate ?? 20) || 0;
  return p.kdv_included ? a / (1 + r / 100) : a;
};
export const WORKDAYS = 26;
export function dailyCost(p) {
  if (!p) return null;
  if (Number(p.daily_wage) > 0) return { tl: Number(p.daily_wage), basis: "yevmiye" };
  if (Number(p.salary) > 0) return { tl: Number(p.salary) / WORKDAYS, basis: `aylık maaş ÷ ${WORKDAYS} gün` };
  return null;
}

export function jobCosts(d, site, rep, { today = todayStr(), fuelRef = null } = {}) {
  const D = dealOf(site);
  const works = live(d, "work_records").filter((w) => w.site_id === site.id);
  const pendingFuel=pendingFuelSummary({pending_fuel_records:(d.pending_fuel_records||[]).filter(f=>works.some(w=>w.vehicle_id===f.vehicle_id))},{from:[works.map(w=>w.date).filter(Boolean).sort()[0]||today,addDays(today,-90)].sort()[0],to:today});
  const vehicles = Object.fromEntries(live(d, "vehicles").map((v) => [v.id, v]));
  const people = Object.fromEntries(live(d, "personnel").map((p) => [p.id, p]));
  // ---- Mazot
  const perCache = {};
  const per = (vid, unit) => (perCache[vid + unit] ??= ["Sefer", "Saat"].includes(unit) ? fuelPerUnit(d, { vehicle_id: vid, unit, today }) : null);
  let fuelL = 0, fuelTL = 0, fuelMissing = 0;
  const byVeh = {};
  for (const w of works) {
    const q = Number(w.quantity) || 0, f = per(w.vehicle_id, w.unit);
    const vb = (byVeh[w.vehicle_id || ""] ||= { vehicle: vehicles[w.vehicle_id]?.name || "—", sefer: 0, saat: 0, yev: 0, L: 0, tl: 0 });
    if (w.unit === "Sefer") vb.sefer += q; else if (w.unit === "Saat") vb.saat += q; else if (w.unit === "Yevmiye") vb.yev += q;
    if (!f) { if (["Sefer", "Saat"].includes(w.unit)) fuelMissing += q; continue; }
    const L = f.per * q, price = fuelPriceAt(d, w.date || today, fuelRef) || 0;
    fuelL += L; fuelTL += L * price; vb.L += L; vb.tl += L * price;
    if (!price) fuelMissing += 0; // fiyat yoksa litre var, TL eksik
  }
  // ---- İşçilik (kişi-gün payı)
  const personOf = (w) => w.personnel_id || vehicles[w.vehicle_id]?.assignee_id || null;
  const dayAll = {}; // kişi|gün → tüm kayıt sayısı
  for (const w of live(d, "work_records")) { const p = personOf(w); if (p && w.date) dayAll[p + "|" + w.date] = (dayAll[p + "|" + w.date] || 0) + 1; }
  const dayJob = {};
  for (const w of works) { const p = personOf(w); if (p && w.date) dayJob[p + "|" + w.date] = (dayJob[p + "|" + w.date] || 0) + 1; }
  let laborTL = 0, laborDays = 0, laborMissing = 0;
  for (const [k, n] of Object.entries(dayJob)) {
    const [pid] = k.split("|"), c = dailyCost(people[pid]);
    const share = n / (dayAll[k] || n);
    laborDays += share;
    if (c) laborTL += c.tl * share; else laborMissing += 1;
  }
  const noPerson = works.filter((w) => !personOf(w)).length;
  // ---- Döküm ve diğer giderler
  let dumpTL = 0, dumpEst = false, dumpUnknown = 0;
  for (const w of works) { try { const f = dumpFee(d, w); if(f?.unverified) dumpUnknown++; if (f?.amount) { dumpTL += f.amount; if (f.estimated || f.provisional) dumpEst = true; } } catch { /* yok */ } }
  const dumpLinked = linkedDumpExpenseIds(d);
  const exp = live(d, "expense_records").filter((e) => e.site_id === site.id && !e.dump_deposit && !dumpLinked.has(e.id));
  const otherTL = exp.reduce((n, e) => n + (Number(e.amount ?? e.total) || 0), 0);
  // ---- Gelir (net)
  let revenue = 0, revenueBasis = "", revenueEst = false;
  if (D?.basis === "Götürü") { revenue = dealMoney(D, 1).net; revenueBasis = "sözleşme bedeli"; }
  else if (D?.basis === "m³") {
    if (D.measurement) { revenue = Number(D.measurement.net) || 0; revenueBasis = "ölçülen metraj"; }
    else if (rep.est > 0) { revenue = dealMoney(D, rep.est).net; revenueBasis = "tahmini m³ × fiyat"; revenueEst = true; }
  } else { revenue = works.filter((w) => !w.job_extra).reduce((n, w) => n + netOf(w), 0); revenueBasis = "sefer tutarları"; }
  const extras = works.filter((w) => w.job_extra).reduce((n, w) => n + netOf(w), 0);
  const scrap = Number(rep.scrap) || 0;
  const income = revenue + extras + scrap;
  const cost = fuelTL + laborTL + dumpTL + otherTL;
  const profit = income - cost;
  // ---- Tahsilat ilerlemesi (brüt, müşterinin bu tarihten beri tüm ödemeleri)
  const billedGross = (D?.charge?.gross || D?.measurement?.gross || 0) + works.filter((w) => w.job_extra).reduce((n, w) => { const p = w.price_snapshot; const a = Number(p?.amount ?? 0) || 0; const r = Number(p?.kdv_rate ?? 20) || 0; return n + (p?.kdv_included ? a : a * (1 + r / 100)); }, 0)
    + (D?.basis === "Sefer" ? works.filter((w) => !w.job_extra).reduce((n, w) => { const p = w.price_snapshot; const a = Number(p?.amount ?? 0) || 0; const r = Number(p?.kdv_rate ?? 20) || 0; return n + (p?.kdv_included ? a : a * (1 + r / 100)); }, 0) : 0);
  // ---- Günlük seri (son 30 gün içinde, başlangıçtan bu yana)
  const start = D?.start_date || works.map((w) => w.date).filter(Boolean).sort()[0] || today;
  const first = start > addDays(today, -29) ? start : addDays(today, -29);
  const days = [];
  for (let t = first; t <= today && days.length < 31; t = addDays(t, 1)) days.push({ date: t, sefer: 0, saat: 0 });
  for (const w of works) { const x = days.find((y) => y.date === w.date); if (!x) continue; if (w.unit === "Sefer") x.sefer += Number(w.quantity) || 0; if (w.unit === "Saat") x.saat += Number(w.quantity) || 0; }
  const workDays = new Set(works.map((w) => w.date).filter(Boolean)).size;
  const m3 = rep.measured || rep.est || 0;
  const warnings = [];
  if(pendingFuel.count)warnings.push(pendingFuel.warning);
  if (dumpUnknown) warnings.push(`${dumpUnknown} işte döküm tahmini doğrulanmadı; maliyet ve kâr eksik olabilir`);
  if (fuelMissing) warnings.push(`${r1(fuelMissing)} sefer/saat için aracın mazot ortalaması yok (son 90 günde yeterli yakıt kaydı yok) — mazot gideri eksik`);
  if (laborMissing) warnings.push(`${laborMissing} kişi-günde şoför/operatörün ücreti girilmemiş — işçilik eksik (Personel kartından yevmiye ya da maaş girin)`);
  if (noPerson) warnings.push(`${noPerson} kayıtta şoför/operatör yok ve araçta zimmetli personel yok — işçilik hesaplanmadı`);
  if (rep.extras?.unpriced) warnings.push(`${rep.extras.unpriced} ekstra işin fiyatı yok — gelire girmedi`);
  if (rep.suspect) warnings.push(`${rep.suspect} kayıtta fiş tonu olağan dışı — tahmini m³ yanlış olabilir`);
  if (D?.basis === "m³" && !D.measurement && revenueEst) warnings.push("Gelir tahmini m³'e göre; kesin gelir ölçüm girilince belli olur");
  return {
    income: r0(income), revenue: r0(revenue), revenueBasis, revenueEst, extras: r0(extras), scrap: r0(scrap),
    costs: [
      { key: "mazot", label: "Mazot", tl: r0(fuelTL), note: `${r0(fuelL)} L · aracın son 90 gün ortalaması × litre fiyatı`, est: true },
      { key: "iscilik", label: "İşçilik", tl: r0(laborTL), note: `${r1(laborDays)} kişi-gün · yevmiye ya da maaş ÷ ${WORKDAYS}`, est: true },
      { key: "dokum", label: "Döküm", tl: r0(dumpTL), note: dumpEst ? "kayıtlardaki döküm ücreti (bir kısmı tahmini ton)" : "kayıtlardaki döküm ücreti", est: dumpEst },
      { key: "diger", label: "Diğer giderler", tl: r0(otherTL), note: `${exp.length} gider bu şantiyeye yazılmış`, est: false },
    ],
    pendingFuel,costIncomplete:pendingFuel.count>0,cost: r0(cost), profit: pendingFuel.count?null:r0(profit), margin: !pendingFuel.count && income > 0 ? Math.round((profit / income) * 100) : null,
    costPerM3: !pendingFuel.count && m3 > 0 ? r0(cost / m3) : null, profitPerM3: !pendingFuel.count && m3 > 0 ? r0(profit / m3) : null, m3,
    billedGross: r0(billedGross), paid: rep.paid || 0,
    targetGross: r0(billedGross || (D?.basis === "m³" && rep.est > 0 ? dealMoney(D, rep.est).gross : 0)), targetEst: !billedGross && D?.basis === "m³" && rep.est > 0, workDays, tripsPerDay: workDays ? r1(rep.trips / workDays) : null,
    vehicles: Object.values(byVeh).map((v) => ({ ...v, L: r0(v.L), tl: r0(v.tl) })).sort((a, b) => b.tl - a.tl || b.sefer - a.sefer),
    days, warnings, fuelL: r0(fuelL),
  };
}

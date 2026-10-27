// İş sözleşmesi (şantiye bazlı anlaşma): sefer başı ya da metreküp (yerinde, ortak ölçümcü). Saf hesap — kayıt yazmaz.
// Anlaşma şantiye kartında durur (sites.deal). Kapsam içi işler fiyata dahildir (cariye ayrıca yazılmaz); ekstra işler fiyat
// listesinden ayrı fiyatlanır. m³ işinde iş sürerken görülen m³ TAHMİNDİR; kesin miktar ölçümcünün yerinde metrajıdır.
import { isActive, transportVehicleType } from "./core.js";
import { materials, payload, tripEstimate } from "./haul-core.js";
import { DEFAULT_LOAD_TON, dumpFee } from "./dump-fees.js";
import { resolveWorkTonnage } from "./work-tonnage.js";

const live = (d, s) => (d?.[s] || []).filter(isActive);
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const fold = (s) => String(s || "").toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

export const DEAL_BASIS = ["Götürü", "m³", "Sefer"];
export const SCRAP = { "": "Belirtilmemiş", fiyattan: "Bizde — fiyattan düşülmüş", ayrica: "Bizde — ayrıca satılacak (iş geliri)", musteri: "Müşteriye ait" };
export const EXTRA_UNITS = ["Saat", "Yevmiye", "Sefer", "m³", "Ton", "Adet"];
export const DEAL_EXTRA = "Sözleşme ekstra fiyatı";
export const basisLabel = (b) => (b === "Götürü" ? "götürü" : b === "m³" ? "metreküp" : "sefer");
export const INCLUDED = "Sözleşmeye dahil";
export const DEAL_SEFER = "İş sözleşmesi (sefer)";
export const isIncluded = (w) => w?.price_snapshot?.price_source === INCLUDED;
export const isJobPriced = (w) => [INCLUDED, DEAL_SEFER].includes(w?.price_snapshot?.price_source);
export const isLocked = (D) => !!(D?.measurement || D?.charge); // cariye yazılmış: bedel / birim fiyat değişmez
export const dealOf = (s) => (s && s.deal && typeof s.deal === "object" ? s.deal : null);
export const STATUS = { OPEN: "Açık", MEASURED: "Ölçüldü", CLOSED: "Kapandı" };

// Anlaşma girişini doğrula; hata metni ya da null
export function checkDeal(x) {
  if (!DEAL_BASIS.includes(x.basis)) return "Anlaşma türünü seçin (götürü, m³ ya da sefer)";
  if (!(Number(x.price) > 0)) return x.basis === "Götürü" ? "Sözleşme bedeli pozitif olmalı" : "Birim fiyat pozitif olmalı";
  for (const e of x.extra_rates || []) if (!String(e.label || "").trim() || !EXTRA_UNITS.includes(e.unit) || !(Number(e.price) > 0)) return "Ekstra fiyat satırında ad, birim ve pozitif fiyat gerekli";
  if (x.scrap != null && !(x.scrap in SCRAP)) return "Hurda seçeneği geçersiz";
  const r = Number(x.kdv_rate);
  if (x.kdv_rate === "" || x.kdv_rate == null || !Number.isFinite(r) || r < 0 || r > 100) return "KDV oranını yazın (KDV'siz: 0)";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(x.start_date || ""))) return "Başlangıç tarihi gerekli";
  return null;
}

export function openJobs(d, customerId, date = "") {
  return live(d, "sites").filter((s) => {
    const D = dealOf(s);
    return D && D.status === STATUS.OPEN && s.customer_id === customerId && (!date || !D.start_date || date >= D.start_date);
  });
}
// İşin bağlı olduğu açık anlaşma. Şantiye seçiliyse yalnız o; seçili değilse müşterinin TEK açık işi (auto) — birden çoksa belirsiz.
export function jobFor(d, w) {
  if (!w?.customer_id) return null;
  const jobs = openJobs(d, w.customer_id, w.date || "");
  if (w.site_id) { const s = jobs.find((x) => x.id === w.site_id); return s ? { site: s, auto: false } : null; }
  if (jobs.length === 1) return { site: jobs[0], auto: true };
  if (jobs.length > 1) return { ambiguous: jobs };
  return null;
}
export function jobSnapshot(site, w) {
  const D = dealOf(site), q = Number(w.quantity) || 0, at = new Date().toISOString();
  const base = { kdv_rate: Number(D.kdv_rate), kdv_included: !!D.kdv_included, job_site_id: site.id, snapshot_at: at };
  if (D.basis === "Sefer" && w.unit === "Sefer") return { ...base, unit_price: Number(D.price), amount: r2(Number(D.price) * q), price_source: DEAL_SEFER };
  return { ...base, unit_price: 0, amount: 0, price_source: INCLUDED };
}
// İş kaydına uygulanacak alanlar (applyFuelPay / applyYard gibi). extra: kullanıcı "sözleşme dışı" dedi.
export function applyJob(d, w, { extra = false } = {}) {
  if (Number(w.customer_fuel_allowance_l) > 0) return {};
  const ps = w.price_snapshot?.price_source;
  if (ps === "İç iş (kendi depo)" || ps === "Mazot karşılığı" || w.price_snapshot?.locked) return {};
  const j = jobFor(d, w);
  if (!j || j.ambiguous) return {};
  if (ps === "Manuel") return { site_id: j.site.id, job_extra: true };
  if (extra) { const x = extraSnapshot(j.site, w); return { site_id: j.site.id, job_extra: true, ...(x ? { price_snapshot: x } : {}) }; }
  return { site_id: j.site.id, job_extra: false, price_snapshot: jobSnapshot(j.site, w) };
}
// Ekstra iş: sözleşmede yazan ekstra fiyatı (birim aynı; adı iş türünde geçiyorsa öncelikli). Yoksa null → fiyat listesi.
export function extraRateFor(D, w) {
  const rs = (D?.extra_rates || []).filter((r) => r.unit === w.unit && Number(r.price) > 0);
  if (!rs.length) return null;
  const t = fold([w.work_type, w.material, w.description].filter(Boolean).join(" "));
  const named = rs.filter((r) => fold(r.label).split(/\s+/).some((k) => k.length >= 3 && t.includes(k)));
  if (named.length === 1) return named[0];
  return rs.length === 1 ? rs[0] : null; // birden çok aday → sessiz seçim yok
}
export function extraSnapshot(site, w) {
  const D = dealOf(site), r = extraRateFor(D, w);
  if (!r) return null;
  const q = Number(w.quantity) || 0;
  return { unit_price: Number(r.price), kdv_rate: Number(D.kdv_rate), kdv_included: !!D.kdv_included, amount: r2(Number(r.price) * q), price_source: DEAL_EXTRA, extra_label: r.label, job_site_id: site.id, snapshot_at: new Date().toISOString() };
}
// Kayıttan önce gösterilecek açıklama
export function jobPreview(d, w, { extra = false } = {}) {
  const j = jobFor(d, w);
  if (!j) return null;
  if (j.ambiguous) return { kind: "ambiguous", text: `Müşterinin ${j.ambiguous.length} açık iş sözleşmesi var (${j.ambiguous.map((s) => s.name).join(", ")}); şantiye seçin — seçilmezse fiyat listesi uygulanır.` };
  const D = dealOf(j.site), where = `${j.site.name}${j.auto ? " (şantiye olarak kaydedilir)" : ""}`;
  const scope = D.scope_in ? ` Sözleşmede dahil: ${String(D.scope_in).slice(0, 140)}${String(D.scope_in).length > 140 ? "…" : ""}` : "";
  if (extra) { const r = extraRateFor(D, w); return { kind: "extra", site: j.site, rate: r, text: `İş sözleşmesi: ${where} — sözleşme dışı EKSTRA, ${r ? `sözleşmedeki ekstra fiyatıyla (${r.label}: ${fmt(r.price)} ₺ / ${r.unit.toLocaleLowerCase("tr-TR")})` : "fiyat listesinden ayrı fiyatlanır"}.` }; }
  if (D.basis === "Sefer" && w.unit === "Sefer") return { kind: "sefer", site: j.site, text: `İş sözleşmesi: ${where} — sefer başı ${fmt(D.price)} ₺ (KDV ${D.kdv_included ? "dahil" : "hariç"} %${D.kdv_rate}).` };
  return { kind: "included", site: j.site, text: `İş sözleşmesi: ${where} — bu iş ${basisLabel(D.basis)} fiyatına DAHİL, cariye ayrıca yazılmaz.${scope}` };
}
const fmt = (n) => Number(n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 });

// Fiyat × miktar → net / KDV / brüt (anlaşmanın KDV esasına göre)
export function dealMoney(D, qty) {
  const amt = r2(Number(D.price) * Number(qty)), rate = Number(D.kdv_rate) || 0;
  const net = D.kdv_included ? r2(amt / (1 + rate / 100)) : amt;
  const gross = D.kdv_included ? amt : r2(amt * (1 + rate / 100));
  return { amount: amt, net, kdv: r2(gross - net), gross, rate };
}

// Malzeme: işteki yazıdan (moloz, kil, kum…) — yoksa anlaşmanın ana malzemesi
export function materialKeyOf(w, D) {
  if (w?.haul_material) return w.haul_material;
  const t = " " + fold([w?.material, w?.work_type].filter(Boolean).join(" ")) + " ";
  if (/\s(moloz|yikinti|yikim|beton)/.test(t)) return "moloz";
  if (/\sbitkisel/.test(t)) return "bitkisel";
  if (/\skil(\s|li|i\s)/.test(t)) return "kil";
  if (/\s(kum|cakil|mican)/.test(t)) return "kum_cakil";
  if (/\skaya/.test(t)) return "kaya";
  return D?.material || "toprak";
}

// Bir işin (şantiyenin) raporu: seferler, tahmini yerinde m³ (kaynağıyla), makine saati, ekstralar, para.
export function jobReport(d, site, { matOver = {}, calib = {}, today = "" } = {}) {
  const D = dealOf(site);
  const mats = Object.fromEntries(materials(matOver).map((m) => [m.key, m]));
  const vehicles = Object.fromEntries(live(d, "vehicles").map((v) => [v.id, v]));
  const works = live(d, "work_records").filter((w) => w.site_id === site.id);
  const trucks = works.filter((w) => w.unit === "Sefer" && !w.job_extra); // ekstra seferler kazı metrajına girmez
  // Explicit total/per-trip scope is authoritative. Unknown scope is never guessed from vehicle capacity.
  // Only scoped weights seed the same vehicle + material's per-trip scale average.
  const avgTon = {};
  for (const w of trucks) {
    const weight = resolveWorkTonnage(w);
    if (!weight.known || !(weight.trips > 0)) continue;
    const key = w.vehicle_id + "|" + materialKeyOf(w, D);
    const a = (avgTon[key] ||= { ton: 0, trips: 0 });
    a.ton += weight.totalTon; a.trips += weight.trips;
  }
  const src = { kantar: 0, "kantar-ort": 0, ogrenilmis: 0, kasa: 0, yok: 0 };
  const groups = {};
  let est = 0, trips = 0, ton = 0, suspect = 0, tonnageUnknown = 0;
  const fallback = (w, v, m, key, n) => { // kantarı olmayan n sefer
    const average = avgTon[w.vehicle_id + "|" + key];
    if (average && m.bank) { const t = (average.ton / average.trips) * n; return { m3: t / m.bank, s: "kantar-ort", t }; }
    if (calib[w.vehicle_id + "|" + key]?.m3_per_trip > 0) return { m3: calib[w.vehicle_id + "|" + key].m3_per_trip * n, s: "ogrenilmis", t: 0 };
    if (v) {
      const pl = payload(v, { defaultTon: DEFAULT_LOAD_TON[transportVehicleType(v.type)] || 0 });
      const e = pl ? tripEstimate(v, m, { payloadTon: pl.ton }) : null;
      if (e?.bankRaw != null) return { m3: e.bankRaw * n, s: "kasa", t: e.tonRaw * n };
    }
    return { m3: null, s: "yok", t: 0 };
  };
  for (const w of trucks) {
    const q = Number(w.quantity) || 0, v = vehicles[w.vehicle_id], key = materialKeyOf(w, D), m = mats[key] || mats.toprak;
    trips += q;
    let m3 = null, s = "yok";
    const g = (groups[(w.vehicle_id || "") + "|" + key] ||= { vehicle_id: w.vehicle_id, vehicle: v?.name || "—", material: key, materialName: m.name, trips: 0, m3: 0, unknown: 0, kantar: 0 });
    g.trips += q;
    const weight = resolveWorkTonnage(w);
    if (weight.uncertain) {
      tonnageUnknown += 1; src.yok += q; g.unknown += q;
      continue; // Neither card guesses nor learned values may disguise an ambiguous entered weight.
    }
    if (weight.known) {
      ton += weight.totalTon;
      if (weight.perTripTon < 5 || weight.perTripTon > 45) suspect += 1;
      if (m.bank) {
        const measured = weight.measuredTrips;
        src.kantar += measured; g.kantar += measured;
        src["kantar-ort"] += q - measured;
        est += weight.totalTon / m.bank; g.m3 += weight.totalTon / m.bank;
      } else { src.yok += q; g.unknown += q; }
      continue;
    }
    const f = fallback(w, v, m, key, q); m3 = f.m3; s = f.s; ton += f.t;
    src[s] += q;
    if (m3 != null) { est += m3; g.m3 += m3; } else g.unknown += q;
  }
  const hoursW = works.filter((w) => w.unit === "Saat"), yevW = works.filter((w) => w.unit === "Yevmiye");
  const hours = hoursW.reduce((n, w) => n + (Number(w.quantity) || 0), 0), yev = yevW.reduce((n, w) => n + (Number(w.quantity) || 0), 0);
  const machines = {};
  for (const w of [...hoursW, ...yevW]) { const g = (machines[w.vehicle_id || ""] ||= { vehicle: vehicles[w.vehicle_id]?.name || "—", hours: 0, yev: 0, extraHours: 0 }); if (w.unit === "Saat") { g.hours += Number(w.quantity) || 0; if (w.job_extra) g.extraHours += Number(w.quantity) || 0; } else g.yev += Number(w.quantity) || 0; }
  const amountOf = (w) => { const p = w.price_snapshot; const a = Number(p?.amount ?? Number(p?.unit_price) * Number(w.quantity)); return Number.isFinite(a) && a > 0 ? a : 0; };
  const extrasW = works.filter((w) => w.job_extra);
  const extras = { count: extrasW.length, amount: r2(extrasW.reduce((n, w) => n + amountOf(w), 0)), unpriced: extrasW.filter((w) => !amountOf(w)).length };
  const includedW = works.filter((w) => !w.job_extra);
  const included = { count: includedW.length, amount: r2(includedW.reduce((n, w) => n + amountOf(w), 0)), notJob: includedW.filter((w) => !isJobPriced(w) && amountOf(w) > 0).length };
  const meas = D?.measurement || null;
  const m3For = meas?.m3 > 0 ? Number(meas.m3) : null;
  const estimationIncomplete = src.yok > 0;
  const money = D?.basis === "Götürü" ? { ...dealMoney(D, 1), estimated: false, charged: !!D.charge } : D?.basis === "m³" ? (m3For ? { ...dealMoney(D, m3For), estimated: false } : !estimationIncomplete && est > 0 ? { ...dealMoney(D, r1(est)), estimated: true } : null) : null;
  const lastDate = works.map((w) => w.date).filter(Boolean).sort().at(-1) || null;
  const idleDays = lastDate && today ? Math.round((new Date(today + "T12:00:00") - new Date(lastDate + "T12:00:00")) / 86400000) : null;
  const paid = r2(-live(d, "cari_movements").filter((m) => m.customer_id === site.customer_id && m.type === "Tahsilat" && (!D?.start_date || m.date >= D.start_date)).reduce((n, m) => n + (Number(m.amount) || 0), 0));
  const base = m3For || (!estimationIncomplete && est > 0 ? est : null);
  const dumpCost = r2(works.reduce((n, w) => { try { const f = dumpFee(d, w); return n + (Number(f?.amount) || 0); } catch { return n; } }, 0));
  const scrap = r2((D?.scrap_sales || []).reduce((n, x) => n + (Number(x.amount) || 0), 0));
  const hoursIn = hoursW.filter((w) => !w.job_extra).reduce((n, w) => n + (Number(w.quantity) || 0), 0);
  return {
    works: works.length, trips, ton: r1(ton), est: r1(est), src, suspect, tonnageUnknown, estimationIncomplete, groups: Object.values(groups).map((g) => ({ ...g, m3: r1(g.m3), perTrip: g.trips > g.unknown ? r1(g.m3 / (g.trips - g.unknown)) : null })),
    hours: r1(hours), yev, machines: Object.values(machines), extras, included, money, measured: m3For,
    perTrip: base && trips ? r2(base / trips) : null, perHour: base && hoursIn ? r1(base / hoursIn) : null, hoursIncluded: r1(hoursIn), extraTrips: works.filter((w) => w.unit === "Sefer" && w.job_extra).reduce((n, w) => n + (Number(w.quantity) || 0), 0),
    ratio: m3For && est > 0 ? r2(m3For / est) : null, lastDate, idleDays, paid, dumpCost, scrap,
  };
}

// Ölçümden sonra: araç + malzeme başına öğrenilecek "sefer başı yerinde m³" (onayla kaydedilir)
export function calibrationProposal(rep) {
  if (!rep.measured || !(rep.est > 0) || rep.groups.some((g) => g.unknown)) return [];
  const r = rep.measured / rep.est;
  return rep.groups.filter((g) => g.vehicle_id && g.trips > 0 && g.m3 > 0).map((g) => ({ key: g.vehicle_id + "|" + g.material, vehicle: g.vehicle, material: g.materialName, trips: g.trips, m3_per_trip: r2((g.m3 / g.trips) * r) }));
}
// Önceki öğrenilmiş değerle sefer sayısına göre ağırlıklı ortalama
export function mergeCalib(old = {}, props = [], today = "") {
  const out = { ...old };
  for (const p of props) {
    const o = out[p.key];
    const trips = (o?.trips || 0) + p.trips;
    out[p.key] = { m3_per_trip: r2(((o?.m3_per_trip || 0) * (o?.trips || 0) + p.m3_per_trip * p.trips) / trips), trips, jobs: (o?.jobs || 0) + 1, updated: today };
  }
  return out;
}

// Ana ekran dikkat: ölçüm bekleyen m³ işi (10+ gündür iş yok), fiyatsız ekstra
export function jobAttention(d, today) {
  const out = [];
  for (const s of live(d, "sites")) {
    const D = dealOf(s);
    if (!D || D.status !== STATUS.OPEN) continue;
    const rep = jobReport(d, s, { today });
    if (D.basis === "m³" && rep.works && rep.idleDays != null && rep.idleDays >= 10)
      out.push({ key: "olcum", site: s, text: `${s.name}: ${rep.idleDays} gündür iş yok — iş bittiyse ölçümü girin`, href: "#/is-sozlesmesi/" + s.id });
  }
  return out;
}

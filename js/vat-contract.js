// KDV / cari tutar sözleşmesi — SAF katman, kayıt yazmaz, mevcut hesapları DEĞİŞTİRMEZ.
// Bir iş tutarını açık temeliyle ayrıştırır ve müşteri cari toplamında net / brüt karışımını raporlar.
// Karar notu: docs/KDV_CARI_KARAR_NOTU.md
import { isActive } from "./core.js";
import { workForFinancialRead, claimWorkResolution } from './hakedis-finance.js';
const live = (d, s) => (d[s] || []).filter(isActive);
const r2 = (n) => Math.round(n * 100) / 100;

// İşin tutarı: net (KDV hariç), KDV, brüt (KDV dahil), oran, fiyat temeli, para birimi, belge durumu ve belirsizlik
export function workMoney(w, data = null) {
  const financialReview = data ? claimWorkResolution(data, w).issue : null;
  w = workForFinancialRead(data, w);
  const p = w?.price_snapshot;
  const amount = Number(p?.amount ?? (Number(p?.unit_price) * Number(w?.quantity)));
  if (!p || !Number.isFinite(amount) || !(amount > 0)) return null;
  const rateKnown = p.kdv_rate !== null && p.kdv_rate !== undefined && p.kdv_rate !== "" && Number.isFinite(Number(p.kdv_rate));
  const rate = rateKnown ? Number(p.kdv_rate) : 20;
  const basis = p.kdv_included ? "dahil" : "hariç";
  const net = p.kdv_included ? amount / (1 + rate / 100) : amount;
  const gross = p.kdv_included ? amount : amount * (1 + rate / 100);
  const issues = [];
  if (financialReview) issues.push(financialReview);
  if (!rateKnown) issues.push("KDV oranı kayıtlı değil (%20 varsayıldı)");
  if (p.kdv_included === undefined) issues.push("fiyatın KDV dahil/hariç olduğu kayıtlı değil (hariç varsayıldı)");
  return {
    net: r2(net), kdv: r2(gross - net), gross: r2(gross), rate, basis, currency: "TRY",
    // Bugünkü cari hesabı bu sayıyı topluyor (fiyat neyse o: bazen net, bazen brüt)
    booked: r2(amount),
    invoiced: !!w.invoice_no, // belge durumu KDV hesabından ayrıdır
    ambiguous: issues.length > 0, issues,
  };
}

// Müşteri bazında: faturasız/hakedişe girmemiş fiyatlı işlerin bugünkü (karışık) toplamı, net ve brüt toplamları
export function vatContractReport(d) {
  const billed = new Set(live(d, "hakedis").filter((h) => h.status === "Kesinleşti").flatMap((h) => (h.items || []).map((i) => i.work_record_id)));
  const out = [];
  for (const c of live(d, "customers").filter((c) => !c.internal)) {
    const rows = live(d, "work_records").filter((w) => w.customer_id === c.id && !billed.has(w.id)).map((w) => ({ w, m: workMoney(w) })).filter((x) => x.m);
    if (!rows.length) continue;
    const sum = (f) => r2(rows.reduce((n, x) => n + f(x.m), 0));
    const bases = new Set(rows.map((x) => x.m.basis));
    const rates = new Set(rows.map((x) => x.m.rate));
    out.push({
      customer_id: c.id, customer: c.name, works: rows.length,
      booked: sum((m) => m.booked), net: sum((m) => m.net), gross: sum((m) => m.gross),
      mixedBasis: bases.size > 1, mixedRates: rates.size > 1,
      ambiguous: rows.filter((x) => x.m.ambiguous).length,
      dahil: rows.filter((x) => x.m.basis === "dahil").length, haric: rows.filter((x) => x.m.basis === "hariç").length,
      hasHakedis: live(d, "cari_movements").some((m) => m.customer_id === c.id && m.type === "Hakedis"),
      hasCollection: live(d, "cari_movements").some((m) => m.customer_id === c.id && m.type === "Tahsilat"),
      examples: rows.slice(0, 3).map(({ w, m }) => ({ id: w.id, date: w.date, booked: m.booked, net: m.net, gross: m.gross, basis: m.basis, rate: m.rate })),
    });
  }
  return out;
}

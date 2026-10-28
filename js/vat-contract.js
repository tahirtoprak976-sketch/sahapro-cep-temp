// KDV / cari tutar sözleşmesi — SAF katman, kayıt yazmaz, mevcut hesapları DEĞİŞTİRMEZ.
// Bir iş tutarını açık temeliyle ayrıştırır ve müşteri cari toplamında net / brüt karışımını raporlar.
// Karar notu: docs/KDV_CARI_KARAR_NOTU.md
import { isActive, toKurus, fromKurus, kdvRateOf } from "./core.js";
import { workForFinancialRead, claimWorkResolution } from './hakedis-finance.js';
import { customerLedgerMovements } from './collect-core.js';
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

// Read-only invoice/work breakdown BEFORE collections. A payment has no saved
// principal/VAT allocation, so never invent a "remaining principal/VAT" split.
// The recorded balance remains the existing mixed-basis ledger balance.
export function customerVatBreakdowns(d) {
  const claims = live(d, 'hakedis'), works = live(d, 'work_records');
  const movements = live(d, 'cari_movements');
  const billed = new Set(claims.filter(h => h.status === 'Kesinleşti').flatMap(h => (h.items || []).map(i => i.work_record_id)));
  const byCustomer = rows => {
    const out = new Map();
    for (const row of rows) {
      if (!out.has(row.customer_id)) out.set(row.customer_id, []);
      out.get(row.customer_id).push(row);
    }
    return out;
  };
  const groupedWorks = byCustomer(works), groupedMovements = byCustomer(movements);
  const workById = new Map(works.map(w => [w.id, w]));
  const claimById = new Map(), claimUses = new Map();
  for (const h of claims) {
    if (!claimById.has(h.id)) claimById.set(h.id, []);
    claimById.get(h.id).push(h);
  }
  for (const m of movements.filter(m => m.type === 'Hakedis')) claimUses.set(m.ref_id, (claimUses.get(m.ref_id) || 0) + 1);
  const validMoney = value => value !== '' && value != null &&
    ['number', 'string'].includes(typeof value) && String(value).trim() !== '' &&
    Number.isFinite(Number(value)) && Number(value) >= 0 && Number.isSafeInteger(toKurus(value));
  const result = new Map();
  for (const customer of live(d, 'customers').filter(c => !c.internal)) {
    const rows = customerLedgerMovements(d, customer.id, {billed,
      works:groupedWorks.get(customer.id) || [], movements:groupedMovements.get(customer.id) || []});
    let net = 0, tax = 0, gross = 0, unpostedTax = 0, unknown = 0;
    let netComplete = true, taxComplete = true, receipts = 0, adjustments = 0;
    const issues = [];
    for (const row of rows) {
      if (row.type === 'Tahsilat') { receipts -= toKurus(row.amount); continue; }
      if (!['Is', 'Hakedis'].includes(row.type)) { adjustments += toKurus(row.amount); continue; }
      let money = null;
      if (row.type === 'Is') {
        const w = workById.get(row.ref_id), p = w?.price_snapshot;
        const rate = kdvRateOf(p?.kdv_rate), basisKnown = typeof p?.kdv_included === 'boolean';
        if (w && rate != null && basisKnown && !p.locked) {
          const booked = toKurus(row.amount);
          const principal = p.kdv_included ? Math.round(booked / (1 + rate / 100)) : booked;
          const vat = p.kdv_included ? booked - principal : Math.round(principal * rate / 100);
          money = {net:fromKurus(principal), kdv:fromKurus(vat), gross:fromKurus(principal + vat)};
        }
        // With an explicitly exclusive price, its principal is known even if
        // the VAT rate is missing. It is still not a complete gross amount.
        if (!money && basisKnown && p.kdv_included === false && !p.locked) net += toKurus(row.amount);
        else if (!money) netComplete = false;
        if (money && !p.kdv_included) unpostedTax += toKurus(money.kdv);
      } else {
        const candidates = claimById.get(row.ref_id) || [], h = candidates[0];
        if (candidates.length === 1 && claimUses.get(row.ref_id) === 1 &&
            h.status === 'Kesinleşti' && h.customer_id === customer.id &&
            [h.subtotal, h.kdv_total, h.grand_total].every(validMoney) &&
            toKurus(h.subtotal) + toKurus(h.kdv_total) === toKurus(h.grand_total) &&
            toKurus(row.amount) === toKurus(h.grand_total))
          money = {net:Number(h.subtotal), kdv:Number(h.kdv_total), gross:Number(h.grand_total)};
        if (!money) netComplete = false;
      }
      if (money) { net += toKurus(money.net); tax += toKurus(money.kdv); gross += toKurus(money.gross); }
      else {
        taxComplete = false;
        unknown += toKurus(row.amount);
        issues.push({id:row.ref_id || row.id, type:row.type,
          reason:row.type === 'Is' ? 'İşin KDV oranı veya fiyat temeli kontrol edilmeli.' : 'Hakedişin kayıtlı ana para / KDV toplamları kontrol edilmeli.'});
      }
    }
    result.set(customer.id, {
      customer_id:customer.id,
      net:netComplete ? fromKurus(net) : null,
      tax:taxComplete ? fromKurus(tax) : null,
      gross:netComplete && taxComplete ? fromKurus(gross) : null,
      knownNet:fromKurus(net), knownTax:fromKurus(tax),
      unpostedTax:fromKurus(unpostedTax), unknownAmount:fromKurus(unknown), issues,
      receipts:fromKurus(receipts), adjustments:fromKurus(adjustments),
      balance:fromKurus(rows.reduce((n, row) => n + toKurus(row.amount), 0)),
      unbilled:fromKurus(rows.filter(row => row.type === 'Is').reduce((n, row) => n + toKurus(row.amount), 0)),
    });
  }
  return result;
}

// Same scope as the existing "Toplam alacak": only positive customer balances.
export function receivableVatSummary(reports) {
  const rows = [...reports.values()].filter(row => row.balance > 0);
  const sum = key => fromKurus(rows.reduce((n, row) => n + toKurus(row[key]), 0));
  return {
    net:rows.every(row => row.net != null) ? sum('net') : null,
    tax:rows.every(row => row.tax != null) ? sum('tax') : null,
    gross:rows.every(row => row.gross != null) ? sum('gross') : null,
    knownNet:sum('knownNet'), knownTax:sum('knownTax'), unpostedTax:sum('unpostedTax'),
    unknownAmount:sum('unknownAmount'), issues:rows.flatMap(row => row.issues),
    receipts:sum('receipts'), adjustments:sum('adjustments'), balance:sum('balance'),
  };
}

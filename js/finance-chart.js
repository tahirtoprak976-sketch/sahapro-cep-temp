// Panodaki grafikler için saf hesaplar. Kayıt yazmaz, kullanıcıya gösterilecek özetleri üretir.
// Gelir = fiyatı girilmiş işlerin değeri (KDV durumu kayıttan bilinmediği için "iş değeri" denir),
// tahsilat = "Müşteriden Para Alındı" kasa kayıtları. Fiyatsız işler ayrıca sayılır; gizlenmez.
import { isActive, toKurus, fromKurus, todayStr } from "./core.js";

const monthKey = (d) => String(d || "").slice(0, 7);
export function lastMonths(today = todayStr(), n = 6) {
  const [y, m] = today.split("-").map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(y, m - 1 - i, 1);
    out.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
export const monthLabel = (k) => TR_MONTHS[Number(k.slice(5, 7)) - 1] + " " + k.slice(2, 4);

export function monthlySeries(data, opts = {}) {
  const today = opts.today || todayStr();
  const keys = lastMonths(today, opts.months || 6);
  const rows = new Map(
    keys.map((k) => [k, { key: k, label: monthLabel(k), work: 0, collected: 0, expense: 0, fuel: 0, unpriced: 0, works: 0 }]),
  );
  for (const w of data.work_records || []) {
    if (!isActive(w)) continue;
    const r = rows.get(monthKey(w.date));
    if (!r) continue;
    r.works++;
    const amt = w.price_snapshot?.amount;
    if (amt == null || !Number.isFinite(Number(amt))) r.unpriced++;
    else r.work += toKurus(amt);
  }
  for (const c of data.cash_records || []) {
    if (!isActive(c) || c.cash_type !== "Müşteriden Para Alındı") continue;
    const r = rows.get(monthKey(c.date));
    if (r) r.collected += toKurus(c.amount);
  }
  for (const e of data.expense_records || []) {
    if (!isActive(e)) continue;
    const r = rows.get(monthKey(e.date));
    if (r) r.expense += toKurus(e.amount);
  }
  for (const f of data.fuel_records || []) {
    if (!isActive(f)) continue;
    const r = rows.get(monthKey(f.date));
    if (r) r.fuel += toKurus(f.total);
  }
  return [...rows.values()].map((r) => ({
    ...r,
    work: fromKurus(r.work),
    collected: fromKurus(r.collected),
    expense: fromKurus(r.expense),
    fuel: fromKurus(r.fuel),
    cost: fromKurus(r.expense + r.fuel),
    // tahmini kâr = fiyatlı iş değeri − (gider + yakıt); fiyatsız iş varsa eksik hesap olduğu ayrıca işaretlenir
    profit: fromKurus(r.work - r.expense - r.fuel),
  }));
}

// Son N gün araç başına iş sayısı, yakıt (Lt) ve maliyet (gider + yakıt ₺)
export function vehicleSeries(data, opts = {}) {
  const today = opts.today || todayStr();
  const days = opts.days || 30;
  const from = new Date(today + "T12:00:00");
  from.setDate(from.getDate() - days + 1);
  const fromS = todayStr(from);
  const inRange = (r) => isActive(r) && r.date >= fromS && r.date <= today;
  const rows = new Map();
  const get = (id) => {
    if (!id) return null;
    if (!rows.has(id)) rows.set(id, { id, works: 0, liters: 0, cost: 0 });
    return rows.get(id);
  };
  for (const w of data.work_records || []) if (inRange(w)) { const r = get(w.vehicle_id); if (r) r.works++; }
  for (const f of data.fuel_records || [])
    if (inRange(f)) {
      const r = get(f.vehicle_id);
      if (r) { r.liters += Number(f.liters) || 0; r.cost += toKurus(f.total); }
    }
  for (const e of data.expense_records || []) if (inRange(e)) { const r = get(e.vehicle_id); if (r) r.cost += toKurus(e.amount); }
  const name = (id) => {
    const v = (data.vehicles || []).find((x) => x.id === id);
    return v ? v.plate || v.name : "—";
  };
  return [...rows.values()]
    .map((r) => ({ ...r, name: name(r.id), cost: fromKurus(r.cost) }))
    .sort((a, b) => b.cost - a.cost || b.works - a.works);
}

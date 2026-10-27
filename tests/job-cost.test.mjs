// İş panosu maliyet/kâr hesabı — TEST VERİSİ
import assert from "node:assert/strict";
import { jobCosts, dailyCost } from "../js/job-cost.js";
import { jobReport } from "../js/job-core.js";
let n = 0; const test = (t, f) => { f(); n++; console.log("PASS " + t); };
const T = "2026-10-20";
const mk = (deal, extra = {}) => {
  const site = { id: "s1", name: "Test Şantiye", customer_id: "c1", deal };
  const d = {
    customers: [{ id: "c1", name: "Test" }], sites: [site, { id: "s2", name: "Başka", customer_id: "c1" }],
    vehicles: [{ id: "v1", name: "Test Kamyon", type: "Kamyon", axles: 4, tare_ton: 13, body_m3: 17, assignee_id: "p1" }],
    personnel: [{ id: "p1", name: "Test Şoför", daily_wage: 3000 }, { id: "p2", name: "Aylıkçı", salary: 52000 }],
    fuel_records: [{ id: "f1", date: "2026-10-01", vehicle_id: "v1", liters: 400, total: 18400, unit_price: 46 }],
    work_records: [
      { id: "w0", date: "2026-10-01", vehicle_id: "v1", customer_id: "c1", site_id: "s2", unit: "Sefer", quantity: 10 }, // tüketim ortalaması için
      { id: "w1", date: "2026-10-15", vehicle_id: "v1", customer_id: "c1", site_id: "s1", unit: "Sefer", quantity: 6, tonnage: 19.5, tonnage_scope: "per_trip", price_snapshot: { amount: 0, price_source: "Sözleşmeye dahil" } },
      { id: "w2", date: "2026-10-15", vehicle_id: "v1", customer_id: "c1", site_id: "s2", unit: "Sefer", quantity: 2 },
    ],
    cari_movements: [{ id: "m1", customer_id: "c1", type: "Tahsilat", amount: -50000, date: "2026-10-16" }],
    expense_records: [{ id: "e1", date: "2026-10-16", amount: 1500, site_id: "s1" }],
    ...extra,
  };
  return { d, site };
};
const M3 = { basis: "m³", price: 800, kdv_rate: 20, kdv_included: false, start_date: "2026-10-10", material: "toprak", status: "Açık" };
test("günlük ücret: yevmiye ya da aylık ÷ 26", () => { assert.equal(dailyCost({ daily_wage: 3000 }).tl, 3000); assert.equal(dailyCost({ salary: 52000 }).tl, 2000); assert.equal(dailyCost({}), null); });
test("mazot: aracın ortalaması (400 L ÷ 18 sefer) × fiyat; işçilik o günkü kayıt payı; diğer gider; kâr = gelir − gider", () => {
  const { d, site } = mk(M3);
  const rep = jobReport(d, site, { today: T });
  const c = jobCosts(d, site, rep, { today: T, fuelRef: 46 });
  const L = c.costs.find((x) => x.key === "mazot"), I = c.costs.find((x) => x.key === "iscilik"), O = c.costs.find((x) => x.key === "diger");
  assert.equal(c.fuelL, Math.round((400 / 18) * 6)); // son 90 günde 18 sefer
  assert.equal(I.tl, 1500); // o gün 2 kaydın 1'i bu işte → 3000 × 1/2
  assert.equal(O.tl, 1500);
  assert.equal(c.profit, c.income - c.cost);
  assert.equal(c.revenueEst, true); assert.ok(c.targetEst); assert.equal(c.paid, 50000);
  assert.equal(c.days.length, 11); assert.equal(c.days.find((x) => x.date === "2026-10-15").sefer, 6);
});
test("götürü: gelir = net bedel, tahsilat hedefi brüt bedel", () => {
  const { d, site } = mk({ basis: "Götürü", price: 200000, kdv_rate: 20, kdv_included: false, start_date: "2026-10-10", status: "Açık", charge: { gross: 240000 } });
  const c = jobCosts(d, site, jobReport(d, site, { today: T }), { today: T, fuelRef: 46 });
  assert.equal(c.revenue, 200000); assert.equal(c.targetGross, 240000); assert.equal(c.targetEst, false);
});
test("eksik veri uyarıları: ücretsiz şoför, mazot ortalaması yok", () => {
  const { d, site } = mk(M3, { personnel: [{ id: "p1", name: "Ücretsiz" }], fuel_records: [] });
  const c = jobCosts(d, site, jobReport(d, site, { today: T }), { today: T });
  assert.ok(c.warnings.some((w) => /ücreti girilmemiş/.test(w))); assert.ok(c.warnings.some((w) => /mazot ortalaması yok/.test(w)));
});
console.log(`job-cost: ${n} test geçti`);

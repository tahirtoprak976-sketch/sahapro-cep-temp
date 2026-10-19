// Müşteri panosu sunumu (TEST VERİSİ): litre hesabı ve TL rakamları ayrı ve anlamlarıyla; hesap mantığı değişmez.
import assert from "node:assert/strict";
import { customerReportData, panelModel } from "../js/customer-report.js";
const T = "2026-10-18";
let seq = 0;
const rec = (o) => ({ id: "r" + ++seq, created_at: "2026-10-01T10:00:00Z", ...o });
const d = () => {
  const x = { customers: [{ id: "K", name: "Kılıç Test", fuel_rules: [{ id: "r1", per: 75, unit: "Sefer", match: "", only_pay: true }] }], work_records: [], fuel_records: [], fuel_tank_movements: [],
    cari_movements: [], cash_records: [], hakedis: [], sites: [], vehicles: [{ id: "V", name: "34 KM 101" }], personnel: [], quarries: [], dump_sites: [], cheques: [] };
  // 21 sefer: 2025'te 6, 2026'da 15 (dönem ayrımı)
  for (const [date, q] of [["2025-12-10", 6], ["2026-03-05", 7], ["2026-09-20", 8]])
    x.work_records.push(rec({ date, customer_id: "K", vehicle_id: "V", unit: "Sefer", quantity: q, customer_fuel_allowance_l: q * 75, fuel_rule_id: "r1", price_snapshot: { unit_price: 0, amount: 0, kdv_rate: 0, price_source: "Mazot karşılığı" } }));
  for (const L of [300, 225]) x.fuel_records.push(rec({ date: "2026-06-01", vehicle_id: "V", liters: L, fuel_source: "Müşteri Verdi", customer_id: "K", total: null }));
  return x;
};
let n = 0;
const test = (name, fn) => { fn(); n++; console.log("PASS " + name); };
test("Kılıç: 21 sefer × 75 L = 1575 hak, 525 alındı, 1050 kalan; yalnız mazot; TL bakiye 0", () => {
  const R = customerReportData(d(), "K", { from: "2026-01-01", to: T, today: T });
  const P = panelModel(R, "Bu yıl");
  assert.deepEqual([P.fuel.earned, P.fuel.received, P.fuel.balance], [1575, 525, 1050]);
  assert.equal(P.fuel.basis, "21 sefer × 75 L"); assert.equal(P.fuel.onlyPay, true);
  assert.equal(P.fuel.periodEarned, 1125, "seçili dönem (bu yıl) 15 sefer × 75 — tüm zamanların hesabından ayrı");
  assert.equal(R.balanceNow, 0);
});
test("iş tutarı KDV temeli: hariç / dahil / karışık", () => {
  const x = d(); x.customers[0].fuel_rules = [];
  const W = (inc) => rec({ date: "2026-10-01", customer_id: "K", vehicle_id: "V", unit: "Sefer", quantity: 5, price_snapshot: { unit_price: 3000, amount: 15000, kdv_rate: 20, kdv_included: inc, price_source: "Manuel" } });
  x.work_records = [W(false)];
  let P = panelModel(customerReportData(x, "K", { from: "2026-01-01", to: T, today: T }));
  assert.equal(P.basis, "net"); assert.match(P.basisText, /KDV hariç \(net\)/);
  x.work_records.push(W(true));
  P = panelModel(customerReportData(x, "K", { from: "2026-01-01", to: T, today: T }));
  assert.equal(P.basis, "mixed"); assert.match(P.basisText, /1 iş KDV hariç, 1 iş KDV dahil/);
});
test("mazot kuralı olmayan müşteride mazot bloğu yok", () => {
  const x = d(); x.customers[0].fuel_rules = []; x.work_records = []; x.fuel_records = [];
  assert.equal(panelModel(customerReportData(x, "K", { from: "", to: T, today: T })).fuel, null);
});
console.log(`customer-panel: ${n} test geçti`);

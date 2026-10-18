// Paket 3 — mesaj anlama (TEST VERİSİ): "sa" kısaltması, Türkçe ekli adlar, çok işli mesaj, alan kaynağı.
import assert from "node:assert/strict";
import { analyzeMessage } from "../js/message-engine.js";
import { validatePlan } from "../js/assistant-core.js";
const d = () => ({ customers: [{ id: "K", name: "Kaya İnşaat" }, { id: "L", name: "Leda Yapı" }, { id: "H", name: "Hisar Polat" }], sites: [],
  vehicles: [{ id: "J", name: "JCB", type: "Kazıcı Yükleyici" }, { id: "V", name: "34 KM 101", plate: "34 KM 101", type: "Kamyon" }], personnel: [], aliases: [],
  work_records: [], fuel_records: [], dump_sites: [], quarries: [], suppliers: [], bank_accounts: [], price_book: [{ id: "P", customer_id: "K", unit: "Saat", price: 1500, kdv_rate: 20, active: true }] });
const rows = (t) => analyzeMessage({ id: "M", text: t, date: "2026-10-18" }, d()).rows.map((x) => [x.customer_id, x.vehicle_id, x.quantity, x.unit]);
let n = 0; const test = (t, f) => { f(); n++; console.log("PASS " + t); };
test("'sa' kısaltması saat; ekli müşteri adı", () => {
  assert.deepEqual(rows("JCB Kaya’ya 3 sa kazı"), [["K", "J", 3, "Saat"]]);
  assert.deepEqual(rows("34 KM 101 Leda’dan 5 sefer moloz"), [["L", "V", 5, "Sefer"]]);
  assert.deepEqual(rows("JCB kaya inşaata 2,5 saat kazı"), [["K", "J", 2.5, "Saat"]]);
});
test("çok işli mesaj: süre ve müşteri başka işe taşınmaz", () => {
  assert.deepEqual(rows("JCB 3 sa Kaya, 2 sa Leda"), [["K", "J", 3, "Saat"], ["L", "J", 2, "Saat"]]);
  assert.deepEqual(rows("JCB Kaya İnşaat 3 saat kazı / Leda Yapı 2 saat yükleme"), [["K", "J", 3, "Saat"], ["L", "J", 2, "Saat"]]);
});
test("'sa' tek başına (sayısız) miktar sayılmaz", () => {
  assert.deepEqual(rows("sa Kaya JCB").map((r) => [r[2], r[3]]), [[null, null]]);
});
test("alan kaynağı kartta: müşteri / araç mesajdan, fiyat listesinden; tahmin işaretlenir", () => {
  const m = "JCB Kaya’ya 3 sa kazı";
  const v = validatePlan({ works: [{ date: "2026-10-18", date_source: "mesaj", customer_id: "K", vehicle_id: "J", work_type: "Kazı", quantity: 3, unit: "Saat", quote: m }] }, { message: m, d: d(), today: "2026-10-18" });
  assert.deepEqual(v.works[0].src, { customer: "mesajdan", vehicle: "mesajdan", price: "fiyat listesinden" });
  const m2 = "JCB 3 saat kazı";
  const v2 = validatePlan({ works: [{ date: "2026-10-18", date_source: "mesaj", customer_id: "H", vehicle_id: "J", work_type: "Kazı", quantity: 3, unit: "Saat", quote: m2 }] }, { message: m2, d: d(), today: "2026-10-18" });
  assert.match(v2.works[0].src.customer, /mesajda açık yazmıyor|tahmin/);
});
console.log(`anlama: ${n} test geçti`);

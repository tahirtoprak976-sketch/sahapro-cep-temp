// Paket 4 — dikkat isteyen işler, günlük iş, araç özeti (birimler ayrı), kayıt temelli cevap (TEST VERİSİ).
import assert from "node:assert/strict";
import { attentionItems, dailyWorks, vehicleSummary, fuelSummaries } from "../js/attention.js";
import { routeCommand } from "../js/command-router.js";
const T = "2026-10-18";
const d = () => ({ customers: [{ id: "K", name: "Kılıç Hafriyat", fuel_rules: [{ id: "r", per: 75, unit: "Sefer", match: "", only_pay: true }] }, { id: "Y", name: "Kaya İnşaat" }],
  vehicles: [{ id: "V", name: "Hitachi" }, { id: "T", name: "34 KM 101" }], personnel: [], aliases: [], sites: [], quarries: [], dump_sites: [], hakedis: [], fuel_tank_movements: [], cari_movements: [],
  inbox_messages: [{ id: "m1", status: "Taslak" }, { id: "m2", status: "Aktarıldı" }],
  work_records: [
    { id: "a", date: T, customer_id: "K", vehicle_id: "V", unit: "Sefer", quantity: 21, customer_fuel_allowance_l: 1575, price_snapshot: { amount: 0, price_source: "Mazot karşılığı" } },
    { id: "b", date: T, customer_id: "Y", vehicle_id: "V", unit: "Saat", quantity: 4 },
    { id: "c", date: "2026-10-17", customer_id: null, vehicle_id: "T", unit: "Sefer", quantity: 3, price_snapshot: { amount: 9000 } },
  ],
  fuel_records: [{ id: "f", date: T, fuel_source: "Müşteri Verdi", customer_id: "K", liters: 525 }] });
let n = 0; const test = (t, f) => { f(); n++; console.log("PASS " + t); };
test("dikkat isteyen işler: fiyatsız, müşterisiz, mesaj, yarım yedek; neden ve sonraki adım; veri değişmez", () => {
  const x = d(), before = JSON.stringify(x);
  const it = attentionItems(x, { restoreSets: [{ of: 3, done: [1] }, { of: 2, done: [1, 2] }] });
  const by = Object.fromEntries(it.map((i) => [i.key, i]));
  assert.equal(by.fiyatsiz.count, 1); assert.equal(by.musterisiz.count, 1); assert.equal(by.mesaj.count, 1); assert.equal(by.yedek.count, 1);
  for (const i of it) assert.ok(i.why && i.next && i.hash);
  assert.equal(JSON.stringify(x), before);
});
test("mazot inceleme adayı 'kesin hata değil' diye yazılır", () => {
  const x = d(); x.work_records.push({ id: "e", date: T, customer_id: "K", vehicle_id: "V", unit: "Sefer", quantity: 2, price_snapshot: { unit_price: 3000, amount: 6000 } });
  const m = attentionItems(x).find((i) => i.key === "mazot");
  assert.ok(m); assert.match(m.why, /Kesin hata değildir/);
});
test("günlük iş sayısı ve araç özeti birimleri ayrı tutar", () => {
  const days = dailyWorks(d(), T, 3);
  assert.deepEqual(days.map((x) => [x.date, x.count]), [["2026-10-16", 0], ["2026-10-17", 1], ["2026-10-18", 2]]);
  assert.deepEqual(days[2].units, { Sefer: 21, Saat: 4 });
  const v = vehicleSummary(d(), "2026-10-01", T).find((x) => x.id === "V");
  assert.deepEqual([v.works, v.Saat, v.Sefer, v.Yevmiye], [2, 4, 21, 0]);
});
test("mazot özetleri litre; soruya uygulama hesabıyla cevap", () => {
  assert.deepEqual(fuelSummaries(d()).map((f) => [f.name, f.earned, f.received, f.balance]), [["Kılıç Hafriyat", 1575, 525, 1050]]);
  const r = routeCommand("Kılıç’tan kaç litre mazot alacağım kaldı?", d(), T);
  assert.equal(r.kind, "answer"); assert.match(r.text, /kalan mazot alacağı 1\.050 L/); assert.match(r.text, /TL bakiyeye dahil değildir/);
  const a = routeCommand("Bugün hangi araç ne yaptı?", d(), T);
  assert.match(a.text, /Hitachi: 2 iş \(4 saat, 21 sefer\)/);
});
console.log(`attention: ${n} test geçti`);

import assert from "node:assert/strict";
import { validatePlan, assistantSystem } from "../js/assistant-core.js";
import { vehicleNamed, senderPersonnel, planTotals, DEFAULT_RULES } from "../js/assistant-rules.js";
const today = "2026-10-14";
const d = {
  customers: [{ id: "KL", name: "Kılıç Hafriyat", fuel_per_trip: 75, fuel_rule_match: "gravak maslak" }, { id: "DN", name: "Danış Maden" }],
  sites: [], suppliers: [], dump_sites: [], aliases: [{ id: "a1", alias: "14 tonluk", target_type: "vehicle", target_id: "K14" }],
  personnel: [{ id: "PB", name: "Bayram Tırcı", vehicle_id: "VB" }, { id: "PT", name: "Tahir Toprak", vehicle_id: "VT" }],
  vehicles: [{ id: "VB", name: "34GAM627", plate: "34GAM627" }, { id: "VT", name: "34FY2482", plate: "34FY2482" }, { id: "K14", name: "14 Tonluk Kato" }],
  work_records: [], fuel_tank_movements: [],
};
const msg = `[13.10.2026 18:02] Tahir Toprak: Bugün Maslak Kılıç hafriyattan Göktürk son durağa 3 sefer gravak
[13.10.2026 18:30] Bayram Tırcı: Maslak kılıçtan binkılıça 1 sefer gravak
[13.10.2026 18:31] Bayram Tırcı: Maslak kılıçtan binkılıça 1 sefer gravak`;
const W = (o) => ({ date: "2026-10-13", customer_id: "KL", work_type: "Gravak Nakliye", unit: "Sefer", material: "gravak", date_source: "whatsapp", ...o });
const v = validatePlan({ works: [
  W({ reporter: "Tahir Toprak", vehicle_id: "VT", quantity: 3, from_place: "Maslak", to_place: "Göktürk son durağa" }),
  W({ reporter: "Bayram Tırcı", vehicle_id: "VB", quantity: 1, from_place: "Maslak", to_place: "binkılıça" }),
  W({ reporter: "Bayram Tırcı", vehicle_id: "VB", quantity: 1, from_place: "Maslak", to_place: "binkılıça" }),
] }, { message: msg, d, today });
const [a, b, c] = v.works;
// gönderenin zimmetli aracı: plaka yazmasa da kabul, not düşülür
assert.equal(a.vehicle_id, "VT"); assert.ok(a.vehicleNote); assert.equal(a.personnel_id, "PT"); assert.equal(a.reporter, "Tahir Toprak");
assert.equal(a.ok, true, a.issues.join());
// Kılıç sefer başı 75 L: 3 sefer = 225 L karşılık
assert.equal(a.fuelAllowance.liters, 225);
assert.equal(a.from_place, "Maslak"); assert.equal(a.to_place, "Göktürk son durağa");
// aynı yapıştırmada aynı araç/tarih/miktar iki kez → ikincisi mükerrer şüphesi
assert.equal(b.ok, true); assert.equal(c.ok, false); assert.ok(c.pasteDup);
// başkasının aracı tahmin edilirse işaretsiz
let v2 = validatePlan({ works: [W({ reporter: "Bayram Tırcı", vehicle_id: "VT", quantity: 1 })] }, { message: "[13.10.2026 18:30] Bayram Tırcı: Maslak kılıçtan binkılıça 1 sefer gravak", d, today });
assert.equal(v2.works[0].ok, false); assert.ok(v2.works[0].vehicleGuess);
// araç verilmemiş, gönderen biliniyorsa zimmetli araç atanır
v2 = validatePlan({ works: [W({ reporter: "Bayram Tırcı", quantity: 1 })] }, { message: "[13.10.2026 18:30] Bayram Tırcı: Maslak kılıçtan binkılıça 1 sefer gravak", d, today });
assert.equal(v2.works[0].vehicle_id, "VB");
// takma adla anılan araç kabul
assert.ok(vehicleNamed(d, d.vehicles[2], "14 tonluk mahir bey"));
// Danış Maden taşı: Kılıç kuralı uygulanmaz
v2 = validatePlan({ works: [W({ customer_id: "DN", reporter: "Tahir Toprak", vehicle_id: "VT", quantity: 2, material: "ocak taşı" })] }, { message: "[13.10.2026] Tahir Toprak: Danış madenden binkılıça 2 sefer ocak taşı", d, today });
assert.equal(v2.works[0].fuelAllowance, null);
// Kılıç ama gravak/maslak değil → kural yok
v2 = validatePlan({ works: [W({ reporter: "Tahir Toprak", vehicle_id: "VT", quantity: 2, material: "toprak" })] }, { message: "[13.10.2026] Tahir Toprak: Kılıç hafriyata 2 sefer toprak", d, today });
assert.equal(v2.works[0].fuelAllowance, null);
// tarih yok → işaretsiz
v2 = validatePlan({ works: [W({ reporter: "Tahir Toprak", vehicle_id: "VT", quantity: 3, date_source: "yok" })] }, { message: "Tahir Toprak: Maslak kılıçtan 3 sefer gravak", d, today });
assert.equal(v2.works[0].ok, false);
// müşterinin verdiği mazot: depodan düşmez, müşteri zorunlu
v2 = validatePlan({ fuel: [{ vehicle_id: "VT", liters: 75, source: "Müşteri Verdi", customer_id: "KL" }] }, { message: "Kılıçtan 75 litre mazot aldık 34FY2482", d, today });
assert.equal(v2.fuel[0].ok, true); assert.equal(v2.fuel[0].customer_id, "KL");
v2 = validatePlan({ fuel: [{ vehicle_id: "VT", liters: 75, source: "Müşteri Verdi" }] }, { message: "75 litre mazot aldık 34FY2482", d, today });
assert.equal(v2.fuel[0].ok, false);
// toplamlar: kesin ve teyit bekleyen ayrı
const t = planTotals(v.works, d);
const tv = t.vehicles.find((x) => x.name === "34GAM627");
assert.equal(tv.sure, "1 sefer"); assert.equal(tv.unsure, "1 sefer");
assert.equal(t.customers[0].sure, "4 sefer");
// kurallar talimata eklenir
assert.ok(assistantSystem(DEFAULT_RULES).includes("KILIÇ HAFRİYAT"));
assert.ok(!assistantSystem("").includes("İŞLETME KURALLARI"));
assert.equal(senderPersonnel(d, "Bayram Tırcı", msg).id, "PB");
console.log("assistant-rules PASS");
{
  const dd = { ...d, personnel: [{ id: "S1", name: "Tahir Toprak" }, { id: "PT", name: "Tahir Toprak", vehicle_id: "VT" }, { id: "B0", name: "Bayram", vehicle_id: "VB" }] };
  assert.equal(senderPersonnel(dd, "Tahir Toprak", "Tahir Toprak: x").id, "PT");
  assert.equal(senderPersonnel(dd, "Bayram Tırcı", "Bayram Tırcı: x").id, "B0");
  console.log("sender-pick PASS");
}
// malzeme ocağı ve döküm yeri kartları
{
  const dd = { ...d, quarries: [{ id: "QD", name: "Danış Maden" }], dump_sites: [{ id: "DB", name: "Binkılıç Dolgu" }] };
  const m = "[13.10.2026] Tahir Toprak: Danış madenden binkılıç dolguya 2 sefer ocak taşı, Öztaştan 1 sefer mıcır göktürk son durağa";
  const v3 = validatePlan({ works: [
    W({ customer_id: "DN", reporter: "Tahir Toprak", vehicle_id: "VT", quantity: 2, material: "ocak taşı", from_place: "Danış madenden", to_place: "binkılıç dolguya", to_is_dump: true }),
    W({ customer_id: "DN", reporter: "Tahir Toprak", vehicle_id: "VT", quantity: 1, material: "mıcır", from_place: "Öztaştan", to_place: "göktürk son durağa", to_is_dump: true }),
  ] }, { message: m, d: dd, today });
  assert.equal(v3.works[0].quarry_id, "QD"); assert.equal(v3.works[0].dump_site_id, "DB");
  assert.equal(v3.works[1].quarry_id, null); assert.equal(v3.works[1].new_quarry, "Öztaş"); assert.equal(v3.works[1].new_dump_site, "Göktürk son durağa");
  // uydurma ocak ID'si kabul edilmez
  const v4 = validatePlan({ works: [W({ reporter: "Tahir Toprak", vehicle_id: "VT", quantity: 1, quarry_id: "YOK" })] }, { message: "[13.10.2026] Tahir Toprak: 1 sefer gravak maslak", d: dd, today });
  assert.equal(v4.works[0].quarry_id, null);
  console.log("ocak PASS");
}

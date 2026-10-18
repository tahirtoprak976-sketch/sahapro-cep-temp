// İş sözleşmesi (sefer / m³) — saf hesaplar. TEST VERİSİ.
import assert from "node:assert/strict";
import * as J from "../js/job-core.js";
let n = 0; const test = (t, f) => { f(); n++; console.log("PASS " + t); };
const site = (id, cust, deal) => ({ id, name: "Şantiye " + id, customer_id: cust, deal });
const M3 = { basis: "m³", price: 100, kdv_rate: 20, kdv_included: false, start_date: "2026-10-01", material: "toprak", status: "Açık" };
const SF = { basis: "Sefer", price: 1500, kdv_rate: 20, kdv_included: true, start_date: "2026-10-01", status: "Açık" };
const V4 = { id: "v4", name: "Test K4", type: "Kamyon", axles: 4, tare_ton: 13, body_m3: 17 };
const EX = { id: "ex", name: "Test Ekskavatör", type: "Ekskavatör" };
const base = (o = {}) => ({ customers: [{ id: "c1", name: "Test Müşteri" }, { id: "c2", name: "Diğer" }], vehicles: [V4, EX], sites: [], work_records: [], cari_movements: [], ...o });
test("anlaşma doğrulama", () => {
  assert.equal(J.checkDeal({ ...M3 }), null);
  assert.match(J.checkDeal({ ...M3, price: 0 }), /pozitif/); assert.match(J.checkDeal({ ...M3, kdv_rate: "" }), /KDV/); assert.equal(J.checkDeal({ ...M3, kdv_rate: 0 }), null);
  assert.match(J.checkDeal({ ...M3, basis: "Ton" }), /türünü/); assert.match(J.checkDeal({ ...M3, start_date: "" }), /Başlangıç/);
});
test("işin bağlı olduğu iş: şantiye seçili / tek açık iş (auto) / birden çok (belirsiz) / tarihten önce yok", () => {
  const d = base({ sites: [site("s1", "c1", M3)] });
  assert.equal(J.jobFor(d, { customer_id: "c1", date: "2026-10-05" }).auto, true);
  assert.equal(J.jobFor(d, { customer_id: "c1", site_id: "s1", date: "2026-10-05" }).auto, false);
  assert.equal(J.jobFor(d, { customer_id: "c1", date: "2026-09-30" }), null);
  assert.equal(J.jobFor(d, { customer_id: "c2", date: "2026-10-05" }), null);
  const d2 = base({ sites: [site("s1", "c1", M3), site("s2", "c1", SF)] });
  assert.equal(J.jobFor(d2, { customer_id: "c1", date: "2026-10-05" }).ambiguous.length, 2);
  const d3 = base({ sites: [site("s1", "c1", { ...M3, status: "Kapandı" })] });
  assert.equal(J.jobFor(d3, { customer_id: "c1", date: "2026-10-05" }), null);
});
test("m³ işinde kamyon ve makine fiyata dahil (0 ₺); ekstra işaretlenince fiyat listesine kalır", () => {
  const d = base({ sites: [site("s1", "c1", M3)] });
  const w = { customer_id: "c1", date: "2026-10-05", unit: "Saat", quantity: 8, price_snapshot: { unit_price: 2000, amount: 16000, price_source: "Fiyat listesi" } };
  const a = J.applyJob(d, w);
  assert.equal(a.site_id, "s1"); assert.equal(a.price_snapshot.amount, 0); assert.equal(a.price_snapshot.price_source, J.INCLUDED); assert.equal(a.job_extra, false);
  const e = J.applyJob(d, w, { extra: true }); assert.deepEqual(e, { site_id: "s1", job_extra: true });
  assert.deepEqual(J.applyJob(d, { ...w, price_snapshot: { price_source: "Manuel", amount: 5 } }), { site_id: "s1", job_extra: true });
});
test("sefer işinde sefer sözleşme fiyatıyla, makine saati dahil", () => {
  const d = base({ sites: [site("s2", "c1", SF)] });
  const t = J.applyJob(d, { customer_id: "c1", date: "2026-10-05", unit: "Sefer", quantity: 3 });
  assert.equal(t.price_snapshot.amount, 4500); assert.equal(t.price_snapshot.kdv_included, true); assert.equal(t.price_snapshot.price_source, J.DEAL_SEFER);
  const h = J.applyJob(d, { customer_id: "c1", date: "2026-10-05", unit: "Saat", quantity: 9 });
  assert.equal(h.price_snapshot.amount, 0);
});
test("mazot karşılığı, iç iş, kilitli ve belirsiz işe dokunulmaz", () => {
  const d = base({ sites: [site("s1", "c1", M3)] });
  assert.deepEqual(J.applyJob(d, { customer_id: "c1", date: "2026-10-05", unit: "Sefer", quantity: 1, customer_fuel_allowance_l: 75 }), {});
  assert.deepEqual(J.applyJob(d, { customer_id: "c1", date: "2026-10-05", unit: "Sefer", quantity: 1, price_snapshot: { price_source: "İç iş (kendi depo)" } }), {});
  assert.deepEqual(J.applyJob(d, { customer_id: "c1", date: "2026-10-05", unit: "Sefer", quantity: 1, price_snapshot: { locked: true } }), {});
  const d2 = base({ sites: [site("s1", "c1", M3), site("s2", "c1", SF)] });
  assert.deepEqual(J.applyJob(d2, { customer_id: "c1", date: "2026-10-05", unit: "Sefer", quantity: 1 }), {});
});
test("net / KDV / brüt", () => {
  assert.deepEqual(J.dealMoney(M3, 1000), { amount: 100000, net: 100000, kdv: 20000, gross: 120000, rate: 20 });
  assert.deepEqual(J.dealMoney({ ...M3, kdv_included: true }, 1000), { amount: 100000, net: 83333.33, kdv: 16666.67, gross: 100000, rate: 20 });
});
test("malzeme işin yazısından, yoksa anlaşmanın ana malzemesi", () => {
  assert.equal(J.materialKeyOf({ material: "moloz" }, M3), "moloz"); assert.equal(J.materialKeyOf({ work_type: "Moloz Nakliye" }, M3), "moloz");
  assert.equal(J.materialKeyOf({ material: "killi toprak" }, M3), "kil"); assert.equal(J.materialKeyOf({ material: "kum" }, M3), "kum_cakil");
  assert.equal(J.materialKeyOf({ material: "" }, { material: "kaya" }), "kaya"); assert.equal(J.materialKeyOf({}, null), "toprak");
});
test("tahmin: kantarlı sefer tonla, kantarsız aynı aracın kantar ortalamasıyla, yoksa yük tahminiyle", () => {
  const s = site("s1", "c1", M3);
  const W = (id, o) => ({ id, customer_id: "c1", site_id: "s1", vehicle_id: "v4", date: "2026-10-05", unit: "Sefer", quantity: 1, ...o });
  const d = base({ sites: [s], work_records: [W("a", { tonnage: 21.45 }), W("b", { quantity: 2 }), W("c", { unit: "Saat", vehicle_id: "ex", quantity: 8 })] });
  const r = J.jobReport(d, s, { today: "2026-10-20" });
  assert.equal(r.trips, 3); assert.equal(r.src.kantar, 1); assert.equal(r.src["kantar-ort"], 2);
  assert.equal(r.est, 33); // 3 × 21,45 / 1,95
  assert.equal(r.hours, 8); assert.equal(r.idleDays, 15); assert.equal(r.money.estimated, true);
  const d2 = base({ sites: [s], work_records: [W("b", { quantity: 2 })] });
  const r2 = J.jobReport(d2, s, {});
  assert.equal(r2.src.kasa, 2); assert.equal(r2.est, 19.5); // yasal 19 t / 1,95 × 2
  const r3 = J.jobReport(d2, s, { calib: { "v4|toprak": { m3_per_trip: 11 } } });
  assert.equal(r3.src.ogrenilmis, 2); assert.equal(r3.est, 22);
});
test("ölçümden sonra para ölçümle; katsayı önerisi ve birleştirme", () => {
  const s = site("s1", "c1", { ...M3, status: "Ölçüldü", measurement: { m3: 26, date: "2026-10-20" } });
  const d = base({ sites: [s], work_records: [{ id: "b", customer_id: "c1", site_id: "s1", vehicle_id: "v4", date: "2026-10-05", unit: "Sefer", quantity: 2 }] });
  const r = J.jobReport(d, s, {});
  assert.equal(r.measured, 26); assert.equal(r.money.estimated, false); assert.equal(r.money.gross, 3120); assert.equal(r.perTrip, 13); assert.equal(r.ratio, 1.33);
  const p = J.calibrationProposal(r); assert.equal(p.length, 1); assert.equal(p[0].m3_per_trip, 13); assert.equal(p[0].key, "v4|toprak");
  const m = J.mergeCalib({ "v4|toprak": { m3_per_trip: 11, trips: 2, jobs: 1 } }, p, "2026-10-20");
  assert.deepEqual(m["v4|toprak"], { m3_per_trip: 12, trips: 4, jobs: 2, updated: "2026-10-20" });
});
test("moloz gibi hesaplanamayan sefer varsa katsayı önerilmez", () => {
  const s = site("s1", "c1", { ...M3, measurement: { m3: 10 } });
  const d = base({ sites: [s], work_records: [{ id: "b", customer_id: "c1", site_id: "s1", vehicle_id: "v4", unit: "Sefer", quantity: 2, material: "moloz" }] });
  assert.deepEqual(J.calibrationProposal(J.jobReport(d, s, {})), []);
});
test("ekstra ve sözleşme dışı fiyatlanmış işler ayrı sayılır", () => {
  const s = site("s1", "c1", M3);
  const d = base({ sites: [s], work_records: [
    { id: "x", customer_id: "c1", site_id: "s1", vehicle_id: "ex", unit: "Saat", quantity: 3, job_extra: true, price_snapshot: { amount: 6000 } },
    { id: "y", customer_id: "c1", site_id: "s1", vehicle_id: "ex", unit: "Saat", quantity: 2, job_extra: true },
    { id: "z", customer_id: "c1", site_id: "s1", vehicle_id: "ex", unit: "Saat", quantity: 2, price_snapshot: { amount: 4000, price_source: "Fiyat listesi" } }] });
  const r = J.jobReport(d, s, {});
  assert.deepEqual(r.extras, { count: 2, amount: 6000, unpriced: 1 }); assert.equal(r.included.notJob, 1);
});
test("ölçüm bekleyen m³ işi uyarısı (10+ gün iş yok)", () => {
  const s = site("s1", "c1", M3);
  const d = base({ sites: [s], work_records: [{ id: "b", customer_id: "c1", site_id: "s1", vehicle_id: "v4", date: "2026-10-05", unit: "Sefer", quantity: 1 }] });
  assert.equal(J.jobAttention(d, "2026-10-20").length, 1); assert.equal(J.jobAttention(d, "2026-10-10").length, 0);
});
const LS = { basis: "Götürü", price: 200000, kdv_rate: 20, kdv_included: false, start_date: "2026-10-01", status: "Açık", scope_in: "yıkım, moloz kaldırma", extra_rates: [{ label: "Kırıcı saati", unit: "Saat", price: 3000 }, { label: "Ek kamyon", unit: "Sefer", price: 1800 }] };
test("götürü: doğrulama, bedel, tüm kapsam içi işler dahil", () => {
  assert.equal(J.checkDeal(LS), null);
  assert.match(J.checkDeal({ ...LS, price: 0 }), /Sözleşme bedeli/);
  assert.match(J.checkDeal({ ...LS, extra_rates: [{ label: "x", unit: "Kova", price: 5 }] }), /Ekstra/);
  assert.match(J.checkDeal({ ...LS, scrap: "kimbilir" }), /Hurda/);
  const d = base({ sites: [site("g", "c1", LS)] });
  assert.equal(J.applyJob(d, { customer_id: "c1", date: "2026-10-05", unit: "Sefer", quantity: 4 }).price_snapshot.amount, 0);
  assert.deepEqual(J.dealMoney(LS, 1), { amount: 200000, net: 200000, kdv: 40000, gross: 240000, rate: 20 });
  assert.equal(J.jobReport(d, d.sites[0], {}).money.gross, 240000);
});
test("ekstra iş: sözleşmedeki ekstra fiyatı (birim + ad), birden çok aday varsa sessiz seçim yok", () => {
  const d = base({ sites: [site("g", "c1", LS)] });
  const a = J.applyJob(d, { customer_id: "c1", date: "2026-10-05", unit: "Saat", quantity: 2, work_type: "Kırım" }, { extra: true });
  assert.equal(a.price_snapshot.amount, 6000); assert.equal(a.price_snapshot.price_source, J.DEAL_EXTRA); assert.equal(a.job_extra, true);
  assert.equal(J.extraRateFor(LS, { unit: "Yevmiye" }), null);
  const two = { ...LS, extra_rates: [{ label: "Kırıcı saati", unit: "Saat", price: 3000 }, { label: "Ekskavatör saati", unit: "Saat", price: 2500 }] };
  assert.equal(J.extraRateFor(two, { unit: "Saat", work_type: "Makine Çalışması" }), null);
  assert.equal(J.extraRateFor(two, { unit: "Saat", work_type: "Ekskavatör kazı" }).price, 2500);
  const b = J.applyJob(base({ sites: [site("g", "c1", two)] }), { customer_id: "c1", date: "2026-10-05", unit: "Saat", quantity: 1, work_type: "Makine Çalışması" }, { extra: true });
  assert.deepEqual(b, { site_id: "g", job_extra: true });
});
test("cariye yazılmış anlaşma kilitli sayılır", () => { assert.equal(J.isLocked({ charge: {} }), true); assert.equal(J.isLocked({ measurement: {} }), true); assert.equal(J.isLocked({}), false); });
console.log(`job: ${n} test geçti`);

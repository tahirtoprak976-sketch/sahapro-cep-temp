// Kamyon taşıma kapasitesi / kabarma tahmini. TEST VERİSİ (gerçek araç değil).
import assert from "node:assert/strict";
import { materials, swellPct, checkMaterial, legalGross, legalPayload, payload, tripEstimate, hasScale, isHauler } from "../js/haul-core.js";
let n = 0; const test = (t, f) => { f(); n++; console.log("PASS " + t); };
const M = Object.fromEntries(materials().map((m) => [m.key, m]));
const K4 = { name: "Test Kamyon 4D", axles: 4, tare_ton: 13, body_m3: 17 };
const K5 = { name: "Test Kamyon 5D", axles: 5, tare_ton: 14, body_m3: 19 };
test("yasal toplam ağırlık dingilden; elle girilen öncelikli", () => {
  assert.deepEqual(legalGross(K4), { ton: 32, auto: true }); assert.deepEqual(legalGross(K5), { ton: 42, auto: true });
  assert.deepEqual(legalGross({ ...K4, legal_gross_ton: 30 }), { ton: 30, auto: false }); assert.equal(legalGross({ axles: 3 }), null);
});
test("yasal net yük = toplam − dara; eksik/yanlış bilgide hesap yok", () => {
  assert.equal(legalPayload(K4), 19); assert.equal(legalPayload(K5), 28);
  assert.equal(legalPayload({ axles: 4 }), null); assert.equal(legalPayload({ axles: 4, tare_ton: 40 }), null);
});
test("yük kaynağı: kartta ortalama yük > yasal net yük > varsayılan", () => {
  assert.equal(payload({ ...K4, load_ton: 22 }).source, "kart"); assert.equal(payload(K4).source, "yasal");
  assert.deepEqual(payload({ type: "Kamyon" }, { defaultTon: 22 }), { ton: 22, source: "varsayilan", label: "varsayılan yük" }); assert.equal(payload({}), null);
});
test("toprakta 4 ve 5 dingil ağırlıkla sınırlı; sefer × kasa m³'ten çok az yerinde m³", () => {
  const a = tripEstimate(K4, M.toprak, { payloadTon: 19 }), b = tripEstimate(K5, M.toprak, { payloadTon: 28 });
  assert.equal(a.limit, "ağırlık"); assert.equal(a.bank, 9.7); assert.equal(a.loose, 12.3);
  assert.equal(b.limit, "ağırlık"); assert.equal(b.bank, 14.4);
});
test("bitkisel toprakta kasa dolar (hacim sınırlar)", () => {
  const e = tripEstimate(K5, M.bitkisel, { payloadTon: 28 });
  assert.equal(e.limit, "kasa"); assert.equal(e.loose, 19); assert.equal(e.bank, 13.2);
});
test("kaya düşük, moloz için yerinde m³ verilmez", () => {
  assert.equal(tripEstimate(K4, M.kaya, { payloadTon: 19 }).bank, 7.2);
  const m = tripEstimate(K4, M.moloz, { payloadTon: 19 }); assert.equal(m.bank, null); assert.ok(m.loose > 0);
});
test("kantar tonu gerçek yük sayılır; yasal sınır aşımı ve kasa uyumsuzluğu yalnız işaret", () => {
  const e = tripEstimate(K4, M.toprak, { ton: 24 });
  assert.equal(e.limit, "kantar"); assert.equal(e.bank, 12.3); assert.equal(e.overLegal, true); assert.equal(e.overBody, false);
  assert.equal(tripEstimate(K4, M.bitkisel, { ton: 30 }).overBody, true);
  assert.equal(tripEstimate(K4, M.toprak, { ton: 18 }).overLegal, false);
});
test("yük bilinmiyorsa tahmin yok", () => { assert.equal(tripEstimate(K4, M.toprak, {}), null); });
test("malzeme düzeltmesi varsayılanın üstüne yazılır; kabarma payı", () => {
  const t = materials({ toprak: { loose: 1.6, bank: 2.0 } }).find((m) => m.key === "toprak");
  assert.equal(t.loose, 1.6); assert.equal(t.edited, true); assert.equal(swellPct(t), 25); assert.equal(swellPct(M.kum_cakil), 12); assert.equal(swellPct(M.moloz), null);
});
test("katsayı girişi doğrulanır", () => {
  assert.equal(checkMaterial(1.5, 1.9), null); assert.equal(checkMaterial(1.3, ""), null);
  assert.match(checkMaterial(2.0, 1.8), /küçük olamaz/); assert.match(checkMaterial(0, 1.8), /Gevşek/); assert.match(checkMaterial(1.5, 9), /Yerinde/);
});
test("döküm kantarı: elle var/yok; boşsa ton başı ücret kantarlı sayılır", () => {
  assert.deepEqual(hasScale({ has_scale: "yok", fee_unit: "Ton" }), { scale: false, inferred: false });
  assert.deepEqual(hasScale({ fee_unit: "Ton" }), { scale: true, inferred: true });
  assert.equal(hasScale({ fee_unit: "Sefer" }), null);
});
test("kamyon tanıma", () => { assert.ok(isHauler({ type: "Tır" })); assert.ok(isHauler({ body_m3: 16 })); assert.ok(!isHauler({ type: "Ekskavatör" })); });
console.log(`haul: ${n} test geçti`);

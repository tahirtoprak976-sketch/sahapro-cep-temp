// PR #122 birleşme öncesi kabul (TEST VERİSİ): tahsilat kimliği, tutarın sahibi, fiyat listesi kararı.
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import { validatePlan, validateExtras } from "../js/assistant-core.js";
import { assistedRows } from "../js/message-smart-core.js";
import { assignPaymentSources, collectionKey, collectionDecision, nextNewKey, similarCollections, waLineId } from "../js/collection-key.js";
import { amountOwners } from "../js/money-roles.js";
import { priceDecision, priceSummary } from "../js/price-decision.js";

const today = "2026-10-12";
const d = (pb) => ({
  customers: [{ id: "K", name: "Kaya İnşaat" }, { id: "L", name: "Leda Yapı" }], sites: [],
  vehicles: [{ id: "V", name: "34 KM 101", plate: "34 KM 101", type: "Kamyon" }], personnel: [], aliases: [], work_records: [], fuel_records: [],
  dump_sites: [], quarries: [], suppliers: [], bank_accounts: [{ id: "B", name: "Ziraat" }],
  price_book: pb ?? [{ id: "PB", customer_id: "K", unit: "Sefer", work_type: "Moloz Nakliye", price: 3200, kdv_rate: 20, kdv_included: false, valid_from: "2026-10-01", active: true }],
});
const W = (msg, o = {}) => ({ date: today, date_source: "mesaj", customer_id: "K", vehicle_id: "V", work_type: "Moloz Nakliye", quantity: 5, unit: "Sefer", quote: msg, ...o });
const P = (msg, works, cols, dd = d()) => ({ v: validatePlan({ works }, { message: msg, d: dd, today }), x: validateExtras({ collections: cols }, { message: msg, d: dd, today }) });
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log("PASS " + name); };
const keyOf = async (msg, cols) => Promise.all(assignPaymentSources(msg, cols).map((s) => (s.src ? collectionKey(s.src) : null)));
const rec = (key, f) => ({ id: "c-" + key.slice(-6), request_id: key, cash_type: "Müşteriden Para Alındı", payment_method: "Nakit", date: today, ...f });

// ---- 2. Tekrar mesaj ile ikinci gerçek ödeme ----
await test("aynı kaynak mesaj yeniden kaydedilirse aynı kimlik → elle yapıştırmada sorulur, WhatsApp satırında kesin tekrar", async () => {
  const msg = "Kaya İnşaat 20.000 TL ödedi";
  const [k1] = await keyOf(msg, [{ amount: 20000 }]), [k2] = await keyOf("  Kaya İnşaat   20.000 TL ödedi ", [{ amount: 20000 }]);
  assert.equal(k1, k2, "boşluk farkı kimliği değiştirmez");
  const ex = [rec(k1, { customer_id: "K", amount: 20000 })];
  assert.equal(collectionDecision(ex, k1, { customer_id: "K", amount: 20000, date: today, payment_method: "Nakit" }, "txt:" + msg).kind, "ask");
  const wa = "12.10.2026 14:03 - Ali: Kaya İnşaat 20.000 TL ödedi";
  const [kw] = await keyOf(wa, [{ amount: 20000 }]);
  assert.equal(waLineId(wa, 30), "wa:12.10.2026 14:03 ali");
  assert.equal(collectionDecision([rec(kw, { customer_id: "K", amount: 20000 })], kw, { customer_id: "K", amount: 20000, date: today, payment_method: "Nakit" }, "wa:12.10.2026 14:03 ali").kind, "repeat");
});
await test("aynı müşteri, aynı gün, aynı tutarda iki gerçek ödeme (iki ayrı WhatsApp satırı) → iki ayrı kimlik, ikisi de yazılır", async () => {
  const k1 = (await keyOf("12.10.2026 09:10 - Ali: Kaya İnşaat 10.000 TL ödedi", [{ amount: 10000 }]))[0];
  const k2 = (await keyOf("12.10.2026 17:45 - Ali: Kaya İnşaat 10.000 TL ödedi", [{ amount: 10000 }]))[0];
  assert.notEqual(k1, k2);
  const ex = [rec(k1, { customer_id: "K", amount: 10000 })];
  assert.equal(collectionDecision(ex, k2, { customer_id: "K", amount: 10000, date: today, payment_method: "Nakit" }, "wa:x").kind, "new");
  // Müşteri+tarih+tutar eşitliği yalnız UYARI: kesin tekrar sayılmaz (kullanıcı seçer)
  assert.equal(similarCollections(ex, { customer_id: "K", amount: 10000, date: today }, k2).length, 1);
});
await test("aynı mesajda aynı tutarda iki ayrı ödeme → iki kart iki ayrı kimlik; biri ötekini yutmaz", async () => {
  const msg = "Kaya İnşaat sabah 10.000 TL ödedi, akşam 10.000 TL daha ödedi";
  const { x } = P(msg, [], [{ customer_id: "K", amount: 10000, method: "Nakit" }, { customer_id: "K", amount: 10000, method: "Nakit" }]);
  assert.deepEqual(x.collections.map((c) => [c.okData, c.src?.occ]), [[true, 0], [true, 1]]);
  const [a, b] = await Promise.all(x.collections.map((c) => collectionKey(c.src)));
  assert.notEqual(a, b);
  // Model aynı ödemeyi iki karta yazarsa (mesajda bir kez geçiyor): ikinci kart yazılamaz
  const y = P("Kaya İnşaat 10.000 TL ödedi", [], [{ customer_id: "K", amount: 10000, method: "Nakit" }, { customer_id: "K", amount: 10000, method: "Nakit" }]).x;
  assert.deepEqual(y.collections.map((c) => c.okData), [true, false]);
});
await test("aynı kimlik + farklı tutar / müşteri / tarih → çakışma (yazılmaz)", async () => {
  const [k] = await keyOf("Kaya İnşaat 20.000 TL ödedi", [{ amount: 20000 }]);
  const ex = [rec(k, { customer_id: "K", amount: 20000 })];
  for (const f of [{ customer_id: "K", amount: 25000, date: today }, { customer_id: "L", amount: 20000, date: today }, { customer_id: "K", amount: 20000, date: "2026-10-11" }, { customer_id: "K", amount: 20000, date: today, payment_method: "Havale", bank_account_id: "B" }])
    assert.equal(collectionDecision(ex, k, { payment_method: "Nakit", ...f }, "txt:x").kind, "conflict", JSON.stringify(f));
});
await test("kullanıcı 'yeni ödeme' derse sıradaki kimlik deterministik (iki sekme aynı kimliği üretir → tek kayıt)", async () => {
  const [k] = await keyOf("Kaya İnşaat 20.000 TL ödedi", [{ amount: 20000 }]);
  const ex = [rec(k, { customer_id: "K", amount: 20000 })];
  assert.equal(nextNewKey(ex, k), k + ":yeni:1"); assert.equal(nextNewKey(ex, k), nextNewKey(ex, k));
  assert.equal(nextNewKey([...ex, rec(k + ":yeni:1", { customer_id: "K", amount: 20000 })], k), k + ":yeni:2");
});

// ---- 3. Tutar hangi müşterinin / işin ----
await test("Kaya'ya 5 sefer seferi 3000; Leda'dan 20000 ödeme: Kaya fiyatı 3000, ödeme Leda adayı", async () => {
  const msg = "34 KM 101 Kaya’ya 5 sefer moloz, seferi 3000; Leda’dan 20000 ödeme geldi.";
  const own3 = amountOwners(msg, 3000, { customers: d().customers }), own20 = amountOwners(msg, 20000, { customers: d().customers });
  assert.deepEqual([...own3.owners], ["K"]); assert.deepEqual([...own20.owners], ["L"]);
  let r = P(msg, [W(msg, { unit_price: 3000 })], [{ customer_id: "L", amount: 20000, method: "Nakit" }]);
  assert.equal(r.v.works[0].unit_price, 3000); assert.equal(r.x.collections[0].okData, true); assert.equal(r.x.collections[0].ok, false);
  // Model ödemeyi Kaya'ya yazarsa: tahsilat geçersiz; 20000 Kaya'nın fiyatı da olamaz
  r = P(msg, [W(msg, { unit_price: 20000 })], [{ customer_id: "K", amount: 20000, method: "Nakit" }]);
  assert.equal(r.v.works[0].unit_price, null); assert.equal(r.x.collections[0].okData, false);
  assert.ok(r.x.collections[0].issues.some((i) => /Leda Yapı ödemesi/.test(i)));
  // 3000 Leda'nın işine fiyat olamaz
  r = P(msg, [W(msg, { customer_id: "L", unit_price: 3000 })], []);
  assert.equal(r.v.works[0].unit_price, null); assert.ok(r.v.works[0].issues.some((i) => /Kaya İnşaat için yazılmış/.test(i)));
});
await test("aynı mesajda birden çok iş ve tutar: her fiyat kendi işinde, yerel yol da karıştırmaz", async () => {
  const msg = "34 KM 101 Kaya İnşaat 5 sefer moloz seferi 3000, Leda Yapı 2 sefer moloz seferi 2500, Leda Yapı 20000 ödedi";
  const { v, x } = P(msg, [W("34 KM 101 Kaya İnşaat 5 sefer moloz seferi 3000", { unit_price: 3000 }), W("Leda Yapı 2 sefer moloz seferi 2500", { customer_id: "L", quantity: 2, unit_price: 2500 })], [{ customer_id: "L", amount: 20000, method: "Nakit" }]);
  assert.deepEqual(v.works.map((w) => w.unit_price), [3000, 2500]); assert.equal(x.collections[0].okData, true);
  const swapped = P(msg, [W(msg, { unit_price: 2500 }), W(msg, { customer_id: "L", quantity: 2, unit_price: 3000 })], []).v;
  assert.deepEqual(swapped.works.map((w) => w.unit_price), [null, null], "ters konan fiyatlar reddedilir");
  const rows = assistedRows({ id: "M", text: msg, date: today, status: "Taslak" }, d());
  assert.deepEqual(rows.map((r) => [r.customer_id, r.quantity, r.unit_price]), [["K", 5, 3000], ["L", 2, 2500]]);
});
await test("sahibi belirsiz tutar sessizce atanmaz (sorulur)", async () => {
  const msg = "34 KM 101 Kaya İnşaat ve Leda Yapı 5 sefer moloz seferi 3000";
  const { v } = P(msg, [W(msg, { unit_price: 3000 })], []);
  assert.equal(v.works[0].unit_price, null); assert.ok(v.works[0].issues.some((i) => /hangi müşterinin işine ait olduğu mesajda belirsiz/.test(i)));
  const { x } = P("Kaya İnşaat ve Leda Yapı 20000 ödedi", [], [{ customer_id: "K", amount: 20000, method: "Nakit" }]);
  assert.equal(x.collections[0].okData, false); assert.ok(x.collections[0].issues.some((i) => /hangi müşteriye ait olduğu mesajda belirsiz/.test(i)));
});

// ---- 4. Fiyat listesi ----
const PB2 = [
  { id: "A", customer_id: "K", unit: "Sefer", work_type: "Moloz Nakliye", price: 3200, kdv_rate: 20, kdv_included: false, valid_from: "2026-10-01", active: true },
  { id: "B", customer_id: "K", unit: "Sefer", work_type: "Moloz Nakliye", price: 3000, kdv_rate: 20, kdv_included: false, valid_from: "2026-01-01", valid_to: "2026-09-30", active: true },
];
await test("mesajda fiyat yok ≠ fiyatsız: kural, iş tarihi, birim fiyat, KDV esası/oranı ve tutar kayıttan önce gösterilir", async () => {
  const msg = "34 KM 101 Kaya İnşaat 5 sefer moloz";
  const { v } = P(msg, [W(msg)], [], d(PB2));
  const s = v.works[0].priceInfo.summary;
  for (const re of [/Kural: Müşteriye Özel Fiyat \(2026-10-01 tarihinden\)/, /İş tarihi 2026-10-12/, /Birim 3\.200 ₺ \/ sefer/, /KDV hariç %20/, /Tutar 5 × 3\.200 = 16\.000 ₺/]) assert.match(s, re);
  assert.equal(v.works[0].priceInfo.ambiguous, false);
  const inc = priceSummary({ price: 1200, kdv_rate: 20, kdv_included: true, price_source: "Genel Liste" }, { date: today, quantity: 10, unit: "Saat" });
  assert.match(inc, /KDV dahil %20 \(net 10\.000 \+ KDV 2\.000\)/); assert.match(inc, /Tutar 10 × 1\.200 = 12\.000 ₺/);
});
await test("eşit öncelikli iki kural → sessiz seçim yok", async () => {
  const pb = [...PB2, { id: "C", customer_id: "K", unit: "Sefer", work_type: "Moloz Nakliye", price: 3500, kdv_rate: 20, kdv_included: false, valid_from: "2026-10-01", active: true }];
  const dec = priceDecision(pb, { unit: "Sefer", customer_id: "K", work_type: "Moloz Nakliye", date: today });
  assert.equal(dec.ambiguous, true); assert.equal(dec.rule, null); assert.deepEqual(dec.candidates.map((c) => c.price).sort(), [3200, 3500]);
  const msg = "34 KM 101 Kaya İnşaat 5 sefer moloz";
  assert.ok(P(msg, [W(msg)], [], d(pb)).v.works[0].issues.some((i) => /Fiyat seçimi gerekli/.test(i)));
});
await test("tarih kesin değilse ve fiyat tarihe göre değişiyorsa → sorulur; kesin tarihte tarihli kural uygulanır", async () => {
  const msg = "34 KM 101 Kaya İnşaat 5 sefer moloz";
  const unsure = P(msg, [W(msg, { date_source: "yok" })], [], d(PB2)).v.works[0];
  assert.equal(unsure.priceInfo.ambiguous, true);
  assert.equal(priceDecision(PB2, { unit: "Sefer", customer_id: "K", work_type: "Moloz Nakliye", date: "2026-09-15" }).rule.price, 3000);
  assert.match(priceDecision(PB2, { unit: "Sefer", customer_id: "K", work_type: "Moloz Nakliye", date: "2025-06-01" }).reason, /tarihinde geçerli kural yok/);
});
await test("tahsilat onayı fiyat onayı değildir: ödeme kartı iş fiyatını değiştirmez", async () => {
  const msg = "34 KM 101 Kaya İnşaat 5 sefer moloz, 16.000 TL ödedi";
  const a = P(msg, [W(msg, { unit_price: 16000 })], [{ customer_id: "K", amount: 16000, method: "Nakit" }], d(PB2));
  assert.equal(a.v.works[0].unit_price, null); assert.match(a.v.works[0].priceInfo.summary, /Birim 3\.200/);
  const b = P(msg, [W(msg)], [], d(PB2));
  assert.equal(a.v.works[0].priceInfo.summary, b.v.works[0].priceInfo.summary, "tahsilat olsa da olmasa da aynı fiyat dayanağı");
});
console.log(`kabul-122: ${n} test geçti`);

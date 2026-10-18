// Ödeme / fiyat karışması regresyonu (TEST VERİSİ). İki yol: yerel mesaj kontrolü ve Gemini/asistan doğrulaması.
// Model yanlış döndürse bile (ödeme → unit_price, söz → tahsilat) doğrulama katmanı kabul etmemeli.
import assert from "node:assert/strict";
import { validatePlan, validateExtras } from "../js/assistant-core.js";
import { analyzeMessage } from "../js/message-engine.js";
import { assistedRows } from "../js/message-smart-core.js";
import { moneyMentions } from "../js/money-roles.js";
const today = "2026-10-12";
const d = () => ({
  customers: [{ id: "K", name: "Kaya İnşaat" }, { id: "HP", name: "Hisar Polat" }], sites: [],
  vehicles: [{ id: "V", name: "34 KM 101", plate: "34 KM 101", type: "Kamyon" }, { id: "J", name: "JCB", type: "Kazıcı Yükleyici" }],
  personnel: [], aliases: [], work_records: [], fuel_records: [], dump_sites: [], quarries: [], suppliers: [], bank_accounts: [{ id: "B", name: "Ziraat" }],
  price_book: [{ id: "PB", customer_id: "K", unit: "Sefer", work_type: "Moloz Nakliye", price: 3200, kdv_rate: 20, kdv_included: false, valid_from: "2026-10-01", active: true }],
});
const W = (msg, o = {}) => ({ date: today, date_source: "mesaj", customer_id: "K", vehicle_id: "V", work_type: "Moloz Nakliye", quantity: 5, unit: "Sefer", quote: msg, ...o });
const plan = (msg, works, collections) => {
  const dd = d();
  return { v: validatePlan({ works }, { message: msg, d: dd, today }), x: validateExtras({ collections }, { message: msg, d: dd, today }) };
};
const local = (msg) => { const m = { id: "M", text: msg, date: today, status: "Taslak" }; return { rows: analyzeMessage(m, d()).rows, assisted: assistedRows(m, d()) }; };
let n = 0;
const test = (name, fn) => { fn(); n++; console.log("PASS " + name); };

test("iş + ödeme: iş korunur, ödeme birim fiyata gitmez (yanlış AI çıktısı reddedilir)", () => {
  const msg = "34 KM 101 Kaya İnşaat 5 sefer moloz yaptık, 20.000 TL ödeme geldi";
  const { v, x } = plan(msg, [W(msg, { unit_price: 20000 })], [{ customer_id: "K", amount: 20000, method: "Nakit" }]);
  assert.equal(v.works[0].unit_price, null); assert.equal(v.works[0].ok, true, "iş kaybolmaz");
  assert.ok(v.works[0].issues.some((i) => /birim fiyat olarak yazılmamış/.test(i) && /alınan ödeme/.test(i)));
  assert.ok(v.works[0].issues.some((i) => /Fiyat listesinden: 3\.200/.test(i)), "fiyat listesi dayanağı ayrı");
  assert.equal(x.collections[0].okData, true); assert.equal(x.collections[0].ok, false, "tahsilat finansal onaysız işaretlenmez");
  const L = local(msg);
  assert.equal(L.rows.length, 1, "yerel yol: iş satırı kaybolmaz"); assert.equal(L.rows[0].quantity, 5);
  assert.equal(L.assisted[0].unit_price ?? null, null, "yerel yol: ödeme fiyat olmaz");
});
test("yalnız ödeme: iş yok, tahsilat kartı işaretsiz", () => {
  const msg = "Kaya İnşaat 20.000 TL ödedi";
  const { x } = plan(msg, [], [{ customer_id: "K", amount: 20000, method: "Nakit" }]);
  assert.equal(x.collections[0].okData, true); assert.equal(x.collections[0].ok, false);
  assert.equal(local(msg).rows.length, 0);
});
test("açık birim fiyat + ödeme: 3.000 fiyat, 10.000 ödeme; karışmaz", () => {
  const msg = "34 KM 101 Kaya İnşaat 5 sefer moloz, sefer fiyatı 3.000 TL; 10.000 TL ödeme geldi";
  let r = plan(msg, [W(msg, { unit_price: 3000 })], [{ customer_id: "K", amount: 10000, method: "Nakit" }]);
  assert.equal(r.v.works[0].unit_price, 3000); assert.equal(r.x.collections[0].okData, true);
  r = plan(msg, [W(msg, { unit_price: 10000 })], [{ customer_id: "K", amount: 3000, method: "Nakit" }]); // AI ters koymuş
  assert.equal(r.v.works[0].unit_price, null); assert.equal(r.x.collections[0].okData, false);
  assert.equal(local(msg).assisted[0].unit_price, 3000);
});
test("toplam iş bedeli: miktara bölünmez, fiyat boş", () => {
  const msg = "34 KM 101 Kaya İnşaat 5 sefer moloz toplam 20.000 TL";
  for (const up of [20000, 4000]) { const { v } = plan(msg, [W(msg, { unit_price: up })], []); assert.equal(v.works[0].unit_price, null); }
  const { x } = plan(msg, [], [{ customer_id: "K", amount: 20000, method: "Nakit" }]);
  assert.equal(x.collections[0].okData, false, "toplam bedel tahsilat değildir");
});
test("ödeme sözü / olumsuzluk: tahsilat yazılamaz", () => {
  for (const msg of ["Kaya İnşaat yarın 20.000 TL verecek", "Kaya İnşaat 20.000 TL'yi henüz vermedi", "Kaya İnşaat 20.000 ödemedi"]) {
    const { x } = plan(msg, [], [{ customer_id: "K", amount: 20000, method: "Nakit" }]);
    assert.equal(x.collections[0].okData, false, msg); assert.ok(x.collections[0].issues.some((i) => /ödeme olarak geçmiyor/.test(i)), msg);
  }
});
test("düzeltme: 20.000 değil 10.000 ödedi → yalnız 10.000", () => {
  const msg = "Kaya İnşaat 20.000 değil 10.000 ödedi";
  assert.equal(plan(msg, [], [{ customer_id: "K", amount: 20000, method: "Nakit" }]).x.collections[0].okData, false);
  assert.equal(plan(msg, [], [{ customer_id: "K", amount: 10000, method: "Nakit" }]).x.collections[0].okData, true);
});
test("'fiyat verdi' ödeme değildir; '50 litre mazot verdi' para değildir", () => {
  let { x } = plan("Kaya İnşaat 3.500 TL fiyat verdi", [], [{ customer_id: "K", amount: 3500, method: "Nakit" }]);
  assert.equal(x.collections[0].okData, false);
  assert.deepEqual(moneyMentions("Kaya 50 litre mazot verdi"), []);
  ({ x } = plan("Kaya İnşaat 20.000 TL verdi", [], [{ customer_id: "K", amount: 20000, method: "Nakit" }]));
  assert.equal(x.collections[0].okData, true); assert.ok(x.collections[0].issues.some((i) => /"verdi" ödeme anlamına gelmeyebilir/.test(i)));
});
test("Türkçe tutar biçimleri: 20.000 / 20.000,50 / 20000 / 20 bin", () => {
  for (const [msg, amt] of [["Kaya İnşaat 20.000 TL ödedi", 20000], ["Kaya İnşaat 20.000,50 TL ödedi", 20000.5], ["Kaya İnşaat 20000 TL ödedi", 20000], ["Kaya İnşaat 20 bin havale yaptı", 20000]]) {
    const { x } = plan(msg, [], [{ customer_id: "K", amount: amt, method: "Nakit" }]);
    assert.equal(x.collections[0].okData, true, msg); assert.equal(x.collections[0].amount, amt);
  }
});
test("aynı mesajda farklı müşterilerin işleri ve ödemesi", () => {
  const msg = "34 KM 101 Kaya İnşaat 3 sefer moloz sefer fiyatı 3.500 TL, Hisar Polat 2 sefer moloz; Hisar Polat 15.000 TL ödedi";
  const { v, x } = plan(msg, [W("34 KM 101 Kaya İnşaat 3 sefer moloz sefer fiyatı 3.500 TL", { quantity: 3, unit_price: 3500 }), W("Hisar Polat 2 sefer moloz", { customer_id: "HP", quantity: 2, unit_price: 15000 })], [{ customer_id: "HP", amount: 15000, method: "Nakit" }]);
  assert.equal(v.works[0].unit_price, 3500); assert.equal(v.works[1].unit_price, null, "Hisar'ın ödemesi Hisar'ın işine fiyat olmaz");
  assert.equal(x.collections[0].okData, true);
});
test("iş satırı olmadan devam ödeme mesajı", () => {
  const msg = "dünkü işin parası 12.000 TL geldi, nakit aldık";
  const { x } = plan(msg, [], [{ customer_id: "K", amount: 12000, method: "Nakit" }]);
  assert.equal(x.collections[0].okData, true); assert.equal(x.collections[0].ok, false);
  assert.equal(local(msg).rows.length, 0, "yerel yol yeni iş açmaz");
});
test("tarihli fiyat kuralı + farklı ödeme tutarı: kural fiyatı ayrı dayanakla, ödeme fiyat olmaz", () => {
  const msg = "34 KM 101 Kaya İnşaat 4 sefer moloz, 9.000 TL nakit verdi";
  const { v } = plan(msg, [W(msg, { quantity: 4, unit_price: 9000 })], []);
  assert.equal(v.works[0].unit_price, null);
  assert.ok(v.works[0].issues.some((i) => /Fiyat listesinden: 3\.200 ₺ \/ sefer \(Müşteriye Özel Fiyat, 2026-10-01 tarihinden; KDV hariç %20\)/.test(i)));
});
test("eski davranış korunur: 'sefer 1800' açık birim fiyattır; mesajda olmayan fiyat reddedilir", () => {
  const msg = "Kaya İnşaat 34 KM 101 3 sefer moloz döküme sefer 1800";
  assert.equal(plan(msg, [W(msg, { quantity: 3, unit_price: 1800 })], []).v.works[0].unit_price, 1800);
  assert.equal(plan(msg, [W(msg, { quantity: 3, unit_price: 2500 })], []).v.works[0].unit_price, null);
});
console.log(`odeme-fiyat: ${n} test geçti`);

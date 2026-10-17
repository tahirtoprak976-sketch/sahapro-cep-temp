// Gerçek mesaj regresyonu (TEST VERİSİ — gerçek işletme kaydı değildir):
//   Jcb kepce senol abi palet ve tas tasıma 1.5 saat
//   Agırtas mimarlık kum tasıma 1 saat
//   Mahir bey insaatı kanal kazma kapatma ve mıcır tesviyesi 2.5 saat
// Gemini'nin olası (iyi ve kötü) planları taklit edilir; telefonun doğrulama katmanı (validatePlan) denetlenir.
import assert from "node:assert/strict";
import { validatePlan } from "../js/assistant-core.js";

const d = () => ({
  customers: [{ id: "SEN", name: "Şenol" }, { id: "AGI", name: "Ağırtaş Mimarlık" }, { id: "HP", name: "Hisar Polat" }],
  sites: [{ id: "KEM", name: "Kemerburgaz", customer_id: "HP" }, { id: "CAG", name: "Çağlayan", customer_id: "HP" }],
  vehicles: [{ id: "JCB", name: "JCB", type: "Kazıcı Yükleyici", assignee_id: "OP" }, { id: "K1", name: "34 KM 101", type: "Kamyon" }],
  personnel: [{ id: "OP", name: "Yusuf Demir" }, { id: "SP", name: "Şenol Aksoy" }, { id: "X", name: "Ali Veli" }],
  aliases: [{ id: "A1", alias: "Mahir Bey", target_type: "customer", target_id: "HP", confirmed: true }],
  work_records: [], fuel_records: [], dump_sites: [], quarries: [], price_book: [], suppliers: [],
});
const MSGS = [
  "Jcb kepce senol abi palet ve tas tasıma 1.5 saat\nAgırtas mimarlık kum tasıma 1 saat\nMahir bey insaatı kanal kazma kapatma ve mıcır tesviyesi 2.5 saat",
  "Jcb kepçe Şenol abi palet ve taş taşıma 1,5 saat\nAğırtaş mimarlık kum taşıma 1 saat\nMahir bey inşaatı kanal kazma kapatma ve mıcır tesviyesi 2,5 saat",
  "JCB KEPCE SENOL ABI PALET VE TAS TASIMA 1.5 SAAT, AGIRTAS MIMARLIK KUM TASIMA 1 SAAT, MAHIR BEY INSAATI KANAL KAZMA KAPATMA VE MICIR TESVIYESI 2.5 SAAT",
];
const W = (o) => ({ date: "2026-10-12", date_source: "mesaj", vehicle_id: "JCB", unit: "Saat", ...o });
// Gemini her satırın kaynağını "quote" olarak döndürür (şemada var); alıntı mesajda birebir geçmeli
const lines = (m) => m.split(/\n|, (?=[A-ZÇĞİÖŞÜ]{3})/);
const goodFor = (m) => { const L = lines(m); return [
  W({ customer_id: "SEN", work_type: "JCB Çalışması", quantity: 1.5, quote: L[0] }),
  W({ customer_id: "AGI", work_type: "JCB Çalışması", quantity: 1, quote: L[1] }),
  W({ customer_id: "HP", work_type: "JCB Çalışması", quantity: 2.5, quote: L[2] }),
]; };
let n = 0;
let good;
const test = (name, fn) => { for (const m of MSGS) { good = goodFor(m); fn(m); } n++; console.log("PASS " + name); };

test("doğru plan: üç iş, toplam 5 saat, hepsi işaretli, şantiye boş", (m) => {
  const v = validatePlan({ works: good }, { message: m, d: d(), today: "2026-10-12" });
  assert.equal(v.works.length, 3);
  assert.equal(v.works.reduce((s, w) => s + w.quantity, 0), 5);
  assert.deepEqual(v.works.map((w) => w.ok), [true, true, true], JSON.stringify(v.works.map((w) => w.issues)));
  assert.deepEqual(v.works.map((w) => w.site_id), [null, null, null]);
});
test("şantiye mesajda yokken Gemini Kemerburgaz seçerse: seçilmez, not düşülür", (m) => {
  const v = validatePlan({ works: [good[0], good[1], { ...good[2], site_id: "KEM" }] }, { message: m, d: d(), today: "2026-10-12" });
  assert.equal(v.works[2].site_id, null);
  assert.ok(v.works[2].issues.some((x) => /Kemerburgaz/.test(x) && /mesajda/.test(x)), JSON.stringify(v.works[2].issues));
});
test("şantiye mesajda yazıyorsa seçilir", () => {
  const msg = "Mahir bey Kemerburgaz kanal kazma 2,5 saat jcb";
  const v = validatePlan({ works: [{ ...good[2], site_id: "KEM" }] }, { message: msg, d: d(), today: "2026-10-12" });
  assert.equal(v.works[0].site_id, "KEM");
});
test("JCB + saat + 'kum taşıma' → Kum Nakliye işaretsiz gelir (malzeme kelimesi nakliye yapmaz)", (m) => {
  const v = validatePlan({ works: [good[0], { ...good[1], work_type: "Kum Nakliye" }, good[2]] }, { message: m, d: d(), today: "2026-10-12" });
  assert.equal(v.works[1].ok, false);
  assert.ok(v.works[1].issues.some((x) => /nakliye/i.test(x) && /makine/i.test(x)), JSON.stringify(v.works[1].issues));
});
test("kamyon + sefer + Kum Nakliye etkilenmez", () => {
  const msg = "34 KM 101 Ağırtaş mimarlık kum 3 sefer";
  const v = validatePlan({ works: [{ customer_id: "AGI", vehicle_id: "K1", work_type: "Kum Nakliye", quantity: 3, unit: "Sefer", date: "2026-10-12", date_source: "mesaj" }] }, { message: msg, d: d(), today: "2026-10-12" });
  assert.equal(v.works[0].ok, true, JSON.stringify(v.works[0].issues));
});
test("tek süre (2,5 saat) iki işe bölünürse işaretsiz gelir", (m) => {
  const split = [good[0], good[1], { ...good[2], work_type: "Kazı" }, { ...good[2], work_type: "Tesviye" }];
  const v = validatePlan({ works: split }, { message: m, d: d(), today: "2026-10-12" });
  assert.equal(v.works[2].ok, false);
  assert.equal(v.works[3].ok, false);
  assert.ok(v.works[3].issues.some((x) => /bir kez/.test(x)), JSON.stringify(v.works[3].issues));
  assert.equal(v.works[0].ok, true);
});
test("aynı süre mesajda iki kez yazıyorsa iki iş olabilir", () => {
  const msg = "jcb Ağırtaş mimarlık 1 saat kazı\njcb Şenol abi 1 saat yükleme";
  const [l1, l2] = msg.split("\n");
  const v = validatePlan({ works: [W({ customer_id: "AGI", work_type: "Kazı", quantity: 1, quote: l1 }), W({ customer_id: "SEN", work_type: "Yükleme", quantity: 1, quote: l2 })] }, { message: msg, d: d(), today: "2026-10-12" });
  // (aynı araç+gün+miktar için mevcut "iki kez bildirilmiş olabilir" uyarısı ayrı bir kuraldır; burada yalnız bölünme uyarısı olmamalı)
  assert.ok(!v.works.some((w) => w.issues.some((x) => /bir kez geçiyor/.test(x))), JSON.stringify(v.works.map((w) => w.issues)));
});
test("mesajda geçmeyen personel (Şenol müşteri; 'Ali Veli' uydurma) yazılmaz", (m) => {
  const v = validatePlan({ works: [{ ...good[0], personnel_id: "X" }] }, { message: m, d: d(), today: "2026-10-12" });
  assert.equal(v.works[0].personnel_id, null);
  assert.ok(v.works[0].issues.some((x) => /Ali Veli/.test(x)), JSON.stringify(v.works[0].issues));
});
test("aracın zimmetli operatörü personel olarak kabul edilir", (m) => {
  const v = validatePlan({ works: [{ ...good[0], personnel_id: "OP" }] }, { message: m, d: d(), today: "2026-10-12" });
  assert.equal(v.works[0].personnel_id, "OP");
});
test("Şenol müşteri; Gemini 'Şenol Aksoy' personeli yazarsa: adın yalnız ilk kelimesi geçiyor → yazılmaz", (m) => {
  const v = validatePlan({ works: [{ ...good[0], personnel_id: "SP" }] }, { message: m, d: d(), today: "2026-10-12" });
  assert.equal(v.works[0].personnel_id, null);
});
test("şoför ekranından gelen iş (from_driver): şantiye ve personel korunur", (m) => {
  const v = validatePlan({ works: [{ ...good[2], site_id: "KEM", personnel_id: "X", from_driver: true }] }, { message: m, d: d(), today: "2026-10-12" });
  assert.equal(v.works[0].site_id, "KEM");
  assert.equal(v.works[0].personnel_id, "X");
});
console.log(`jcb-regression: ${n} test geçti`);

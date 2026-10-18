// Sözleşme okuma doğrulaması — Gemini çıktısı ÖNERİ; belgede olmayan uydurulmaz. TEST VERİSİ.
import assert from "node:assert/strict";
import { validateContract, matchCustomer, contractSchema } from "../js/contract-read.js";
let n = 0; const test = (t, f) => { f(); n++; console.log("PASS " + t); };
const d = { customers: [{ id: "a", name: "Örnek İnşaat Ltd" }, { id: "b", name: "Deneme Yapı" }, { id: "c", name: "Deneme Yapı Market" }] };
test("tam okuma: götürü bedel, KDV, kapsam, ekstralar, hurda", () => {
  const r = validateContract({ basis: "Götürü", price: 200000, kdv_rate: 20, kdv_included: false, scope_in: ["Bina yıkımı", "Moloz kaldırma"], scope_out: ["Ruhsat"], extra_rates: [{ label: "Kırıcı", unit: "Saat", price: 3000 }],
    scrap: "fiyattan", customer_name: "Örnek İnşaat Ltd", site_name: "Kadıköy yıkım", contract_date: "2026-10-10", quotes: [{ field: "price", text: "Toplam bedel 200.000 TL + KDV" }] }, d);
  assert.equal(r.basis, "Götürü"); assert.equal(r.price, 200000); assert.equal(r.customer.id, "a"); assert.equal(r.start_date, "2026-10-10");
  assert.deepEqual(r.extra_rates, [{ label: "Kırıcı", unit: "Saat", price: 3000 }]); assert.equal(r.scrap, "fiyattan"); assert.deepEqual(r.issues, []);
});
test("eksik ve geçersiz alanlar uydurulmaz, kontrol listesine yazılır", () => {
  const r = validateContract({ basis: "Ton", price: -5, kdv_rate: 150, scrap: "belki", extra_rates: [{ label: "Kırıcı", unit: "Kova", price: 0 }], start_date: "10.10.2026", customer_name: "Bilinmeyen Firma" }, d);
  assert.equal(r.basis, null); assert.equal(r.price, null); assert.equal(r.kdv_rate, null); assert.equal(r.kdv_included, null); assert.equal(r.scrap, ""); assert.equal(r.start_date, null);
  assert.equal(r.issues.length, 6);
});
test("boş / bozuk çıktı", () => { const r = validateContract(null, d); assert.equal(r.basis, null); assert.deepEqual(r.scope_in, []); assert.ok(r.issues.length >= 3); });
test("müşteri eşleştirme: tek aday; birden çok adayda eşleşme yok", () => {
  assert.equal(matchCustomer(d, "ÖRNEK İNŞAAT LTD").id, "a"); assert.equal(matchCustomer(d, "Deneme Yapı").id, "b"); assert.equal(matchCustomer(d, "Deneme"), null); assert.equal(matchCustomer(d, ""), null);
});
test("şema", () => { assert.ok(contractSchema().properties.extra_rates); });
console.log(`contract-read: ${n} test geçti`);

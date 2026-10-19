// Gemini boş döndüğünde yerel okuma (TEST VERİSİ): olası iş / yakıt satırları eksikleriyle; hiçbir şey uydurulmaz.
import assert from "node:assert/strict";
import { localCandidates } from "../js/assistant-fallback.js";
const d = { customers: [{ id: "MB", name: "Mustafa Bey" }, { id: "K", name: "Kaya İnşaat" }], sites: [{ id: "S", name: "Eski Kato Kemer", customer_id: "MB" }], vehicles: [{ id: "V", name: "34 KM 101", plate: "34 KM 101" }],
  personnel: [{ id: "N", name: "Niyazi" }], aliases: [], work_records: [], fuel_records: [], dump_sites: [], quarries: [], suppliers: [], bank_accounts: [], price_book: [] };
let n = 0; const test = (t, f) => { f(); n++; console.log("PASS " + t); };
test("WhatsApp: yıkım işi (miktarsız) + 160 L mazot (şantiyeden alındı)", () => {
  const text = "[05.09.2026 15:44] Tahir Toprak: (medya dışa aktarılmamış)\n[05.09.2026 17:06] Niyazi Abi: Eski kato kemer mustafa bey yıkım yapıldı. 160lt mazot alındı\nşantiyeden";
  const r = localCandidates(text, d, "2026-10-18");
  assert.equal(r.works.length, 1);
  assert.deepEqual([r.works[0].date, r.works[0].customer_id, r.works[0].site_id, r.works[0].work_type, r.works[0].quantity, r.works[0].vehicle_id], ["2026-09-05", "MB", "S", "Yıkım", null, null]);
  assert.ok(r.works[0].missing.some((x) => /miktar/.test(x)) && r.works[0].missing.includes("araç"));
  assert.equal(r.fuel.length, 1); assert.equal(r.fuel[0].liters, 160); assert.equal(r.fuel[0].date, "2026-09-05");
  assert.match(r.fuel[0].hint, /doğrulayın/); assert.ok(r.fuel[0].missing.includes("hangi araca verildiği"));
});
test("yakıt kaynağı yazmıyorsa müşteri atanmaz", () => {
  const r = localCandidates("34 KM 101 bugün 200 litre mazot", d, "2026-10-18");
  assert.equal(r.fuel[0].liters, 200); assert.equal(r.fuel[0].customer_id, null); assert.ok(r.fuel[0].missing.includes("kaynak"));
});
test("iş / yakıt olmayan mesaj: aday yok", () => {
  const r = localCandidates("merhaba, yarın görüşürüz", d, "2026-10-18");
  assert.deepEqual([r.works.length, r.fuel.length], [0, 0]);
});
console.log(`assistant-fallback: ${n} test geçti`);

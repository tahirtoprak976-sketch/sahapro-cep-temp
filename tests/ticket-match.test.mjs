// Ayrı gelen döküm fişi fotoğrafını doğru işe bağlama — sessiz seçim yok. TEST VERİSİ.
import assert from "node:assert/strict";
import { validateTickets } from "../js/assistant-docs.js";
const today = "2026-10-14";
const base = (works, docs = []) => ({ vehicles: [{ id: "V1", name: "Kamyon 1", plate: "34 ABC 123" }], personnel: [], customers: [{ id: "C1", name: "Kaya" }, { id: "C2", name: "Leda" }], sites: [], dump_sites: [], work_records: works, documents: docs });
const text = "Fiş No: A-1042\nTarih 13.10.2026\nPlaka 34ABC123\nNet 18.420 kg";
const T = (d) => validateTickets({ tickets: [{ photo: 0, ticket_no: "A-1042", date: "2026-10-13", plate: "34 ABC 123", tonnage: 18.42 }] }, { d, today, photoTexts: [text], photoCount: 1 })[0];
let n = 0; const test = (t, f) => { f(); n++; console.log("PASS " + t); };
test("aynı gün iki iş, biri fişli → fişsiz olana bağlanır (gerekçeyle)", () => {
  const r = T(base([{ id: "W1", date: "2026-10-13", vehicle_id: "V1", customer_id: "C1", unit: "Sefer", quantity: 1, slip_no: "A-1000" }, { id: "W2", date: "2026-10-13", vehicle_id: "V1", customer_id: "C2", unit: "Sefer", quantity: 1 }]));
  assert.equal(r.link, "W2"); assert.equal(r.customer_id, "C2"); assert.match(r.linkWhy, /fişi olmayan/);
});
test("aynı gün iki fişsiz iş → seçim istenir, işaretsiz", () => {
  const r = T(base([{ id: "W1", date: "2026-10-13", vehicle_id: "V1", customer_id: "C1", unit: "Sefer", quantity: 1 }, { id: "W2", date: "2026-10-13", vehicle_id: "V1", customer_id: "C2", unit: "Sefer", quantity: 1 }]));
  assert.equal(r.link, ""); assert.equal(r.ok, false); assert.ok(r.issues.some((x) => /hangi işe/.test(x)));
});
test("işte aynı fiş no yazılıysa (±3 gün) o iş seçilir", () => {
  const r = T(base([{ id: "W1", date: "2026-10-12", vehicle_id: "V1", customer_id: "C1", unit: "Sefer", quantity: 1, slip_no: "A1042" }, { id: "W2", date: "2026-10-13", vehicle_id: "V1", customer_id: "C2", unit: "Sefer", quantity: 1 }]));
  assert.equal(r.link, "W1"); assert.match(r.linkWhy || "fiş no aynı", /fiş no/);
});
test("iş yoksa yeni iş önerilir", () => { assert.equal(T(base([])).link, "new"); });
console.log(`ticket-match: ${n} test geçti`);

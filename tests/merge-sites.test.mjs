// Şantiye kartı birleştirme — TEST VERİSİ
import assert from "node:assert/strict";
import { planMergeCards, suggestCardGroups } from "../js/merge-core.js";
const n = "x";
const d = {
  customers: [{ id: "C1", name: "Test Yapı", created_at: n }, { id: "C2", name: "Diğer Test", created_at: n }],
  sites: [{ id: "S1", name: "Kadıköy Yıkım", customer_id: "C1", address: "Moda Cd.", created_at: n }, { id: "S2", name: "Kadıköy", customer_id: "C1", phone: "0532", created_at: n },
    { id: "S3", name: "Kadıköy Peyzaj", customer_id: "C2", created_at: n }, { id: "S4", name: "Sözleşmeli", customer_id: "C1", deal: { basis: "Götürü", price: 1, status: "Açık" }, created_at: n }],
  work_records: [{ id: "W1", customer_id: "C1", site_id: "S2", created_at: n }, { id: "W2", customer_id: "C1", site_id: "S2", price_snapshot: { job_site_id: "S2", amount: 0 }, created_at: n }, { id: "W3", customer_id: "C1", site_id: "S1", created_at: n }],
  price_book: [{ id: "P1", customer_id: "C1", site_id: "S2", created_at: n }],
  documents: [{ id: "D1", owner_type: "customer", owner_id: "C1", customer_id: "C1", site_id: "S2", created_at: n }],
};
const p = planMergeCards(d, "sites", ["S2"], "S1");
assert.deepEqual(Object.keys(p.counts).sort(), ["documents", "price_book", "work_records"]);
assert.equal(p.counts.work_records, 2);
assert.equal(p.updates.find((u) => u.before.id === "W2").after.price_snapshot.job_site_id, "S1");
assert.equal(p.patch.phone, "0532"); assert.equal(p.patch.address, undefined);
assert.equal(p.aliases[0].alias, "Kadıköy"); assert.equal(p.aliases[0].target_type, "site");
assert.throws(() => planMergeCards(d, "sites", ["S3"], "S1"), /Farklı müşterilerin/);
assert.throws(() => planMergeCards(d, "sites", ["S4"], "S1"), /İş sözleşmesi olan/);
const ok = planMergeCards(d, "sites", ["S2"], "S4"); assert.equal(ok.target.id, "S4"); // sözleşmeli şantiye kalacak kart olabilir
const g = suggestCardGroups(d, "sites");
assert.equal(g.length, 1); assert.deepEqual(g[0].customers.map((c) => c.id).sort(), ["S1", "S2"]); // farklı müşterinin "Kadıköy"ü gruba girmez
console.log("merge sites ok");

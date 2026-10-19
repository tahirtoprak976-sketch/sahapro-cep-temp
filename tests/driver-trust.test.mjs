// Şoför ekranından gelen işler (SP1): müşteri listeden kesin seçildi → "kime çalışıldı belli değil" ya da
// "aynı iş iki kez" diye işaretsiz gelmemeli (v3.9.02'de bulunan hata: işler sessizce eksik kaydediliyordu).
import assert from "node:assert/strict";
import { payloadsToPlan } from "../js/driver-core.js";
import { validatePlan } from "../js/assistant-core.js";
const d = {
  customers: [{ id: "c1", name: "Kaya İnşaat" }, { id: "c2", name: "Hisar Polat" }], sites: [],
  vehicles: [{ id: "v1", name: "34 ABC 1" }], personnel: [{ id: "p1", name: "Soner" }], dump_sites: [{ id: "d1", name: "Bolluca" }],
  quarries: [], suppliers: [], aliases: [],
  work_records: [{ id: "old", date: "2026-10-10", customer_id: "c1", vehicle_id: "v1", quantity: 2, unit: "Sefer", work_type: "Hafriyat Nakliye" },
                 { id: "old2", date: "2026-10-11", customer_id: "c2", vehicle_id: "v1", quantity: 2, unit: "Sefer", work_type: "Hafriyat Nakliye" }],
};
const p = { v: 1, p: "p1", n: "Soner", e: [
  { id: "E1", date: "2026-10-16", vid: "v1", cid: "c2", wt: "Hafriyat Nakliye", q: 3, u: "Sefer", ds: "d1", slip: "B1" },
  { id: "E2", date: "2026-10-16", vid: "v1", cid: "c2", wt: "Hafriyat Nakliye", q: 3, u: "Sefer", ds: "d1", slip: "B2" },
] };
const { plan } = payloadsToPlan([p], d, { photoCount: 0 });
const msg = "📋 SAHAPRO şoför kaydı — Soner\n🚚 16.10.2026 · 34 ABC 1 · Hisar Polat · Hafriyat Nakliye 3 sefer\n🚚 16.10.2026 · 34 ABC 1 · Hisar Polat · Hafriyat Nakliye 3 sefer";
const v = validatePlan(plan, { message: msg, d, today: "2026-10-17", photoCount: 0, negatives: [] });
assert.equal(v.works.length, 2);
for (const w of v.works) {
  assert.equal(w.customer_id, "c2", "müşteri şoförün seçtiği kalmalı");
  assert.ok(!w.issues.some((i) => /belli değil|iki kez/.test(i)), w.issues.join(" | "));
  assert.equal(w.ok, true, w.issues.join(" | "));
}
console.log("driver-trust ok");

import assert from "node:assert/strict";
import { pack, unpack, driverConfig, driverMessage, extractPayloads, stripDriverBlocks, payloadsToPlan, seenDriverIds, entryLine } from "../js/driver-core.js";
import { validatePlan } from "../js/assistant-core.js";
const n = "x";
const d = {
  personnel: [{ id: "A", name: "Ali Şoför", vehicle_id: "T", created_at: n }],
  vehicles: [{ id: "T", name: "34GAM627", plate: "34GAM627", type: "Tır", created_at: n }, { id: "K", name: "Kamyon", plate: "34UL9492", type: "Kamyon", created_at: n }],
  customers: [{ id: "C", name: "Kılıç Hafriyat", created_at: n }, { id: "I", name: "Kendi Depo (iç iş)", internal: true, created_at: n }],
  sites: [{ id: "S", name: "Göktürk Şantiye", customer_id: "C", created_at: n }],
  dump_sites: [{ id: "B", name: "Bolluca", created_at: n }], quarries: [], work_records: [], fuel_records: [], aliases: [],
};
// Sıkıştırma gidiş-dönüş
const big = { a: "ç".repeat(500), b: [1, 2, 3] };
assert.deepEqual(await unpack(await pack(big)), big);
const cfg = driverConfig(d, { personnel_id: "A", company: "Muratoğlu" });
assert.equal(cfg.veh, "T"); assert.deepEqual(cfg.C, [["C", "Kılıç Hafriyat"]], "iç müşteri listede yok"); assert.equal(cfg.Y, "I");
assert.deepEqual(cfg.V[1], ["K", "Kamyon (34UL9492)"]);
assert.ok((await pack(cfg)).length < 2000);

const entries = [
  { id: "e1", date: "2026-10-16", vid: "T", cid: "C", sid: "S", wt: "Hafriyat Nakliye", q: 3, u: "Sefer", ds: "B", ton: 27.5, slip: "A123", ph: 1 },
  { id: "e2", date: "2026-10-16", vid: "T", cn: "Yeni Yapı", wt: "Moloz Nakliye", q: 2, u: "Sefer", dn: "Göktürk dolgu" },
  { id: "f1", k: "f", date: "2026-10-16", vid: "T", L: 300, src: "Akaryakıt İstasyonu", tl: 13500, km: 245300 },
];
assert.match(entryLine(entries[0], cfg), /16\.10\.2026 · 34GAM627 · Kılıç Hafriyat \/ Göktürk Şantiye · Hafriyat Nakliye 3 sefer → Bolluca · 27\.5 ton · fiş A123 · 📷1/);
const msg = await driverMessage(entries, cfg);
assert.match(msg, /^📋 SAHAPRO şoför kaydı — Ali Şoför\n/); assert.match(msg, /\nSP1:[A-Za-z0-9_-]+$/);
// WhatsApp toplu biçiminde de bulunur
const wa = `[16.10.2026 18:00] Ali Şoför: ${msg.split("\n").join("\n")}\n[16.10.2026 18:05] Veli: 34UL9492 2 sefer kum`;
const ps = await extractPayloads(wa);
assert.equal(ps.length, 1); assert.equal(ps[0].e.length, 3); assert.equal(ps[0].n, "Ali Şoför");
assert.equal(stripDriverBlocks(wa), "[16.10.2026 18:05] Veli: 34UL9492 2 sefer kum", "geriye yalnız serbest metin");
assert.deepEqual(await extractPayloads("SP1:bozukkod123"), []);
// Plan
const { plan, meta, fuelMeta } = payloadsToPlan(ps, d, { photoCount: 1 });
assert.equal(plan.works.length, 2); assert.equal(plan.fuel.length, 1);
assert.deepEqual(meta.map((m) => [m.driver_entry_id, m.photos, m.tonnage]), [["e1", [0], 27.5], ["e2", [], null]]);
assert.equal(plan.works[1].new_customer, "Yeni Yapı"); assert.equal(plan.works[1].to_place, "Göktürk dolgu");
assert.equal(fuelMeta[0].driver_entry_id, "f1");
// Asistanın doğrulaması okunur metinle geçer
const v = validatePlan(plan, { message: msg, d, today: "2026-10-16", photoCount: 1 });
assert.equal(v.works[0].customer_id, "C"); assert.equal(v.works[0].site_id, "S"); assert.equal(v.works[0].vehicle_id, "T"); assert.equal(v.works[0].quantity, 3);
assert.equal(v.works[0].dump_site_id, "B"); assert.equal(v.works[0].slip_no, "A123"); assert.equal(v.works[0].personnel_id, "A");
assert.ok(!v.works[0].guessed); assert.equal(v.works[1].new_customer, "Yeni Yapı");
assert.equal(v.fuel[0].liters, 300); assert.equal(v.fuel[0].km, 245300); assert.equal(v.fuel[0].source, "Akaryakıt İstasyonu");
// Daha önce alınanlar
assert.deepEqual([...seenDriverIds({ work_records: [{ id: "w", driver_entry_id: "e1", created_at: n }], fuel_records: [] })], ["e1"]);
console.log("driver ok");

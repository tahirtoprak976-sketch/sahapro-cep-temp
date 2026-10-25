import assert from "node:assert/strict";
import {
  HISTORY_FORMAT, HISTORY_STORES, HISTORY_REVIEW_NOTES_MAX,
  readHistoryPackage, initialHistoryChoices, prepareHistory,
} from "../js/history-core.js";
import { recordLocalText } from "../js/record-notes.js";
import { matchFuelRule, workHay } from "../js/assistant-rules.js";
import { customerHints } from "../js/assistant-core.js";
import { customerReportData, customerReportSpec } from "../js/customer-report.js";
import { buildReport, reportSpec, reportCsv } from "../js/report-core.js";
import { exploreWorks, workCSV } from "../js/work-explorer.js";
import { historyReviewNotesHTML } from "../js/history-ui.js";
import { recordSpec } from "../js/pro.js";

const marker = "REVIEWONLYTOKEN";
const notes = `  ${marker}: fiyatı kontrol et; bu metin onay değildir.\n<img src=x onerror=alert(1)> & "not"  `;
const row = {
  row_id: "TEST-review-work", kind: "work", date: "2026-09-01",
  customer: "TEST Müşteri", vehicle: "TEST Araç", work_type: "Moloz Nakliye",
  quantity: 2, unit: "Sefer", unit_price: 1000, kdv_rate: 20, kdv_included: false,
  settlement_status: "unbilled_unpaid", description: "İki sefer moloz taşındı.",
  raw_message: "TEST kaynak: 2 sefer moloz taşındı.",
};
const pkg = (patch = {}) => ({ format: HISTORY_FORMAT, rows: [{ ...row, ...patch }] });
const data = Object.fromEntries(HISTORY_STORES.map((s) => [s, []]));
data.customers = [{ id: "C", name: row.customer, fuel_rules: [
  { id: "R", per: 75, unit: "Sefer", match: marker, only_pay: true },
] }];
data.vehicles = [{ id: "V", name: row.vehicle }];
const options = { today: "2026-10-25" };
const prepare = (p, choices = initialHistoryChoices(p), d = data) => prepareHistory(p, choices, d, options);

// Old V1 packages are not rewritten; the new field is optional and strictly typed.
assert.deepEqual(readHistoryPackage(pkg()).rows[0], row);
assert.equal(Object.hasOwn(readHistoryPackage(pkg()).rows[0], "review_notes"), false);
for (const value of [null, false, 1, [], {}, "x".repeat(HISTORY_REVIEW_NOTES_MAX + 1)])
  assert.throws(() => readHistoryPackage(pkg({ review_notes: value })), /kontrol notu/);
for (const value of ["", " ", "x".repeat(HISTORY_REVIEW_NOTES_MAX), notes])
  assert.equal(readHistoryPackage(JSON.stringify(pkg({ review_notes: value }))).rows[0].review_notes, value);
const p = readHistoryPackage(pkg({ review_notes: notes }));
const choices = initialHistoryChoices(p);
assert.equal(choices[0].row.review_notes, notes, "preview retains exact source notes");
for (const value of [undefined, null, "", " \n "])
  assert.equal(historyReviewNotesHTML(value), "");
const html = historyReviewNotesHTML(notes);
assert.match(html, /data-h-review-notes/);
assert.match(html, /Onay yerine geçmez/);
assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt; &amp; &quot;not&quot;/);
assert.ok(!/<(?:img|script|input|textarea)\b/i.test(html), "review note is escaped, read-only text");
const before = JSON.stringify({ p, choices, data });
const plan = prepare(p, choices);
assert.equal(plan.ready, true);
assert.equal(JSON.stringify({ p, choices, data }), before, "preview does not mutate source or DB data");
const w = plan.writes.work_records[0];
assert.equal(w.description, row.description);
assert.equal(w.raw_message, row.raw_message);
assert.deepEqual(w.history_source.original_row, p.rows[0]);
for (const key of ["review_notes", "internal_note", "note", "customer_note"])
  assert.equal(Object.hasOwn(w, key), false, key + " must not be copied onto the record");
assert.equal(w.price_snapshot.total, 2400);
assert.equal(recordLocalText(w, data), row.description);

// Editing only the work description cannot turn the read-only review note into a note field.
const edited = structuredClone(choices);
edited[0].row.description = "Kullanıcının düzelttiği iş açıklaması.";
edited[0].row.review_notes = "Changed choice metadata must not replace source evidence";
const editedWork = prepare(p, edited).writes.work_records[0];
assert.equal(editedWork.description, edited[0].row.description);
assert.equal(editedWork.history_source.original_row.review_notes, notes);
const blank = prepare(readHistoryPackage(pkg({ description: "", review_notes: notes }))).writes.work_records[0];
assert.equal(blank.description, "", "no fallback from a review note into a blank description");
const legacyDescription = "İş açıklaması; eski elle yazılmış kontrol metni.";
assert.equal(prepare(readHistoryPackage(pkg({ description: legacyDescription }))).writes.work_records[0].description, legacyDescription,
  "existing descriptions are never heuristically cleaned");

// Private source evidence must not affect operational matching or customer-facing exports.
const saved = { ...data, work_records: [w] };
assert.ok(!workHay(saved, w).includes(marker.toLowerCase()));
assert.equal(matchFuelRule(saved, w), null, "review text cannot activate a mazot payment rule");
assert.ok(!JSON.stringify(customerHints(saved)).toLowerCase().includes(marker.toLowerCase()));
assert.equal(exploreWorks([w], {}, { q: marker }, options).rows.length, 0);
const customer = customerReportData(saved, "C", { today: options.today, to: options.today });
assert.equal(customer.works[0].note, row.description);
const report = buildReport(saved, { k: "musteri", id: "C", today: options.today, to: options.today });
for (const out of [
  workCSV([w]), reportCsv(report, "customer"),
  JSON.stringify(customerReportSpec(customer)),
  JSON.stringify(reportSpec(report, { audience: "customer" })),
  JSON.stringify(recordSpec("work_records", w, {}, "customer")),
]) {
  assert.ok(!out.includes(marker), "customer PDF/CSV excludes review notes");
  assert.ok(!out.includes(row.raw_message), "customer PDF/CSV excludes raw source");
}
assert.ok(workCSV([w]).includes(row.description));

// Review notes never satisfy a price, settlement, stock, new-card or replay guard.
assert.throws(() => readHistoryPackage(pkg({ review_notes: notes, settlement_status: "paid" })), /ödenmemiş/);
const unpriced = readHistoryPackage(pkg({ unit_price: null, review_notes: "Fiyat bekliyor onaylandı" }));
assert.equal(prepare(unpriced).ready, false);
const unpricedChoices = initialHistoryChoices(unpriced);
unpricedChoices[0].unpriced_confirmed = true;
assert.equal(prepare(unpriced, unpricedChoices).ready, true);
assert.equal(prepare(unpriced, unpricedChoices).writes.work_records[0].price_snapshot, null);
assert.equal(prepare(p, choices, { ...data, customers: [] }).ready, false);
assert.equal(prepare(p, choices, saved).ready, false);
assert.equal(prepare(readHistoryPackage(pkg({ row_id: "TEST-other-source", review_notes: "Different note" })), undefined, saved).ready, false);
assert.equal(prepare(p, choices, { ...saved, work_records: [{ ...w, deleted_at: "2026-10-25" }] }).ready, false);

const fuelPackage = readHistoryPackage({ format: HISTORY_FORMAT, rows: [{
  row_id: "TEST-review-fuel", kind: "fuel", date: row.date, vehicle: row.vehicle,
  liters: 20, fuel_source: "Depo Tankı", settlement_status: "unbilled_unpaid",
  description: "Makineye 20 L yakıt.", raw_message: "TEST kaynak: 20 L yakıt.", review_notes: notes,
}] });
const fuelChoices = initialHistoryChoices(fuelPackage);
assert.equal(fuelChoices[0].include, false);
fuelChoices[0].include = true;
assert.equal(prepare(fuelPackage, fuelChoices).ready, false, "notes cannot confirm tank consumption");
fuelChoices[0].tank_confirmed = true;
assert.equal(prepare(fuelPackage, fuelChoices).ready, false, "notes cannot create historical stock");
const fuelData = { ...data, fuel_tank_movements: [{ id: "T", date: "2026-08-01", move_type: "GİRİŞ", liters: 100 }] };
const fuelPlan = prepare(fuelPackage, fuelChoices, fuelData);
assert.equal(fuelPlan.ready, true);
for (const record of [...fuelPlan.writes.fuel_records, ...fuelPlan.writes.fuel_tank_movements]) {
  assert.equal(record.description, fuelPackage.rows[0].description);
  assert.equal(record.raw_message, fuelPackage.rows[0].raw_message);
  assert.equal(record.history_source.original_row.review_notes, notes);
  for (const key of ["review_notes", "internal_note", "note", "customer_note"])
    assert.equal(Object.hasOwn(record, key), false);
}
console.log("history-review-notes PASS: optional strict metadata, original source preserved, separate work/fuel text, no export/matching leakage, unchanged approval/stock/replay guards");

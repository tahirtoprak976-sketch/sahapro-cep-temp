import assert from "node:assert/strict";
import { customerOpenItems, customerLedgerMovements, receivables, reminderText } from "../js/collect-core.js";
import { customerReportData, customerReportSpec } from "../js/customer-report.js";
import { customerStatement, statementText, statementCsv } from "../js/statement.js";

const today = "2026-10-25";
const privateNote = "INTERNAL_ADJUSTMENT_NOTE_SENTINEL";
const privateReason = "INTERNAL_ADJUSTMENT_REASON_SENTINEL";
const d = {
  customers: [{ id: "C", name: "Sentetik Müşteri" }],
  work_records: [{ id: "W", customer_id: "C", date: "2026-10-04", work_type: "Sentetik İş", quantity: 1, unit: "Sefer", price_snapshot: { unit_price: 100, amount: 100, kdv_rate: 0, kdv_included: false } }],
  cari_movements: [
    { id: "D", customer_id: "C", date: "2026-10-01", type: "Duzeltme", amount: 200, note: privateNote, reason: privateReason },
    { id: "DR", customer_id: "C", date: "2026-10-02", type: "Duzeltme", amount: 25, reason: privateReason },
    { id: "H", customer_id: "C", date: "2026-10-03", type: "Hakedis", amount: 150, note: "Hakediş #000001" },
    { id: "P", customer_id: "C", date: "2026-10-05", type: "Tahsilat", amount: -50, note: "Tahsilat" },
  ],
};
const before = JSON.stringify(d);
const open = customerOpenItems(d, "C", today);
assert.equal(open.debit, 475);
assert.equal(open.paid, 50);
assert.equal(open.advance, 0);
assert.deepEqual(open.open.map(x => [x.ref, x.amount, x.left]), [["D", 200, 150], ["DR", 25, 25], ["H", 150, 150], ["W", 100, 100]]);
assert.equal(open.open[0].label, privateNote, "Internal collection view keeps its original label");

const R = customerReportData(d, "C", { today, to: today });
assert.equal(R.statement.closing, 425);
assert.equal(R.balanceNow, 425);
assert.equal(R.open.reduce((n, x) => n + x.left, 0), 425);
const internal = customerReportSpec(R, { audience: "internal" });
assert.ok(JSON.stringify(internal).includes(privateNote), "Internal report keeps its adjustment note");
const customer = customerReportSpec(R, { audience: "customer" });
const st = customerStatement(customerLedgerMovements(d, "C"), "C");
const row = receivables(d, { today }).rows[0];
for (const [channel, output] of [
  ["customer report", JSON.stringify(customer)],
  ["default customer report", JSON.stringify(customerReportSpec(R))],
  ["statement text", statementText("Sentetik Müşteri", st, { today })],
  ["statement CSV", statementCsv(st)],
  ...["nazik", "net", "son"].map(tone => ["reminder " + tone, reminderText(row, { tone })]),
]) {
  assert.ok(!output.includes(privateNote), `${channel} must omit internal adjustment note`);
  assert.ok(!output.includes(privateReason), `${channel} must omit internal adjustment reason`);
  assert.ok(output.includes("Düzeltme"), `${channel} still identifies an adjustment`);
  assert.ok(output.includes("Hakediş #000001"), `${channel} preserves ordinary customer-facing labels`);
}
const customerOpen = customer.sections.find(s => s.title?.startsWith("Açık kalemler"));
const internalOpen = internal.sections.find(s => s.title?.startsWith("Açık kalemler"));
assert.deepEqual(customerOpen.rows.map(r => [r[0], ...r.slice(2)]), internalOpen.rows.map(r => [r[0], ...r.slice(2)]), "Only label visibility changes, not amounts, dates, aging or order");
assert.equal(JSON.stringify(d), before, "Read-only calculations do not alter records or private notes/reasons");

// Non-hakediş positive entries also use the legacy "duzeltme" UI kind. Their
// actual source type must retain the statement's existing public-note policy.
const other = { customers: d.customers, cari_movements: [
  { id: "F", customer_id: "C", date: "2026-10-01", type: "MazotTeslimi", amount: 75, note: "Müşteri mazot teslimi" },
] };
const otherR = customerReportData(other, "C", { today, to: today });
assert.equal(otherR.statement.rows[0].text, "Müşteri mazot teslimi");
assert.ok(JSON.stringify(customerReportSpec(otherR)).includes("Müşteri mazot teslimi"));
assert.ok(reminderText(receivables(other, { today }).rows[0]).includes("Müşteri mazot teslimi"), "A fuel movement's ordinary customer note remains visible");
assert.equal(otherR.statement.closing, 75);
console.log("customer open-item privacy PASS");

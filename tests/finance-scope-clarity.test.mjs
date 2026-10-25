import assert from "node:assert/strict";
import { screen as collectScreen } from "../js/collect.js";
import { customerReportData, customerReportSpec } from "../js/customer-report.js";

const today = "2026-10-25";
const emptyData = {
  customers: [{ id: "C", name: "Sentetik Müşteri" }],
  work_records: [
    { id: "M", customer_id: "C", date: "2026-10-01", quantity: 1, unit: "Saat" },
    { id: "F", customer_id: "C", date: "2026-10-01", quantity: 1, unit: "Sefer", customer_fuel_allowance_l: 75, price_snapshot: { amount: 0, price_source: "Mazot karşılığı" } },
  ],
};
const beforeEmpty = JSON.stringify(emptyData);
let writes = 0;
const db = { dumpAll: async () => emptyData, metaGet: async key => key === "collect_notes" ? {} : "", metaSet: async () => writes++ };
for (const parts of [["tahsilat"], ["tahsilat", "C"]]) {
  const root = { innerHTML: "", querySelector: () => ({ addEventListener() {} }) };
  assert.equal(await collectScreen({ root, db, parts }), true);
  assert.match(root.innerHTML, /kayıtlı açık TL alacağı yok/i);
  assert.doesNotMatch(root.innerHTML, /herkes ödemiş|hesap kapalı/i);
  assert.match(root.innerHTML, /1 işin fiyatı/);
  assert.match(root.innerHTML, /mazot \(L\)/i);
}
assert.equal(writes, 0, "Rendering the empty state does not write records");
assert.equal(JSON.stringify(emptyData), beforeEmpty);

const d = {
  customers: [{ id: "P", name: "Sentetik Ana" }, { id: "C", name: "Sentetik Alt", parent_customer_id: "P" }],
  work_records: [{ id: "W", customer_id: "C", date: "2026-10-01", quantity: 1, unit: "Sefer", price_snapshot: { unit_price: 500, amount: 500, kdv_rate: 0, kdv_included: false } }],
  cari_movements: [{ id: "A", customer_id: "P", date: "2026-10-01", type: "Tahsilat", amount: -1000 }],
};
const before = JSON.stringify(d);
const own = customerReportData(d, "P", { today, to: today });
const combined = customerReportData(d, "P", { today, to: today, subs: true });
assert.equal(own.balanceNow, -1000);
assert.equal(own.open.length, 0);
assert.equal(combined.balanceNow, -500);
assert.equal(combined.statement.closing, -500);
assert.equal(combined.open.reduce((n, row) => n + row.left, 0), 500, "Parent advance is not silently allocated to a separate child payer");
assert.equal(combined.works[0].id, "W");
assert.equal(combined.customer.id, "P");
for (const audience of ["customer", "internal"]) {
  const spec = customerReportSpec(combined, { audience });
  const scope = spec.sections.find(s => s.title === "Hesap kapsamı");
  assert.ok(scope, "Combined report states the distinct-payer scope");
  assert.match(scope.text, /avansı.*diğerinin borcundan otomatik düşülmez/);
  assert.match(scope.text, /açık kalemlerin toplamı.*farklı olabilir/);
  assert.ok(!customerReportSpec(own, { audience }).sections.some(s => s.title === "Hesap kapsamı"));
}
assert.equal(JSON.stringify(d), before, "Scope notice changes neither ledger amounts nor IDs");
console.log("finance scope clarity PASS");

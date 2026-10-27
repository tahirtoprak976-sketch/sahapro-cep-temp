import {pdfBytes} from './support/attachment-fixtures.mjs';
import assert from "node:assert/strict";
import {
  sparePartFields,
  validateStoredPart,
  warrantyState,
  partCostState,
} from "../js/parts-core.js";
import {
  costLedger,
  operatingResult,
  invoiceLines,
  invoiceTotals,
  serviceState,
} from "../js/enterprise-core.js";
import { costRows, costTotals } from "../js/costs-core.js";
import { allocatedCosts, resultReport } from "../js/solo-core.js";
import { cashForecast } from "../js/cashflow-core.js";
import { validatePlan, assistantContext } from "../js/assistant-core.js";
const date = "2026-10-20",
  n = "2026-10-20T00:00:00Z";
const d = {
  vehicles: [{ id: "V", name: "TEST Kamyon", created_at: n }],
  maintenance_parts: [],
  expense_records: [
    { id: "E", date, vehicle_id: "V", amount: 6000, created_at: n },
  ],
  maintenance_records: [
    { id: "M", vehicle_id: "V", date, cost: 6000, created_at: n },
  ],
  payables: [],
  work_records: [],
};
const f = {
  description: "Akü",
  date,
  vehicle_id: "V",
  quantity: 2,
  unit_price: 3000,
  warranty_until: "2028-10-20",
  cost_mode: "tracking",
};
const r = sparePartFields(d, f);
assert.equal(r.total, 6000);
assert.equal(r.warranty_start, null);
assert.equal(r.informational, true);
assert.equal(warrantyState(r, "2028-10-21").kind, "danger");
assert.equal(warrantyState(r, "2028-10-20").days, 0);
assert.equal(warrantyState({ ...r, warranty_until: null }).days, undefined);
for (const bad of [
  { quantity: 0 },
  { quantity: -2 },
  { unit_price: -1 },
  { unit_price: "Infinity" },
  { vehicle_id: "missing" },
  { date: "2026-02-30" },
  { warranty_start: "2028-01-01", warranty_until: "2025-01-01" },
  { cost_mode: "x" },
  { cost_mode: "" },
  { cost_mode: undefined },
  { cost_mode: "new_expense", unit_price: "" },
  {
    cost_mode: "existing",
    cost_source_store: "__proto__",
    cost_source_id: "E",
  },
])
  assert.throws(() => sparePartFields(d, { ...f, ...bad }));
assert.equal(sparePartFields(d, { ...f, unit_price: "" }).total, null);
assert.equal(
  sparePartFields(d, {
    ...f,
    cost_mode: "existing",
    cost_source_store: "expense_records",
    cost_source_id: "E",
  }).cost_source_id,
  "E",
);
assert.throws(
  () =>
    sparePartFields(
      {
        ...d,
        expense_records: [{ ...d.expense_records[0], vehicle_id: "OTHER" }],
      },
      {
        ...f,
        cost_mode: "existing",
        cost_source_store: "expense_records",
        cost_source_id: "E",
      },
    ),
  /aynı araca/,
);
assert.throws(() => validateStoredPart(d, { ...r, total: 100 }), /tutarsız/);
const items = invoiceLines([
  { description: "TEST", quantity: 1, unit_price: 10000, kdv_rate: 20 },
]);
const bill = {
  id: "B",
  date,
  party_type: "supplier",
  party_id: "S",
  items,
  ...invoiceTotals(items),
  created_at: n,
};
for (const [key, change, expected] of [
  ["opening", { bill_kind: "Açılış / Devir" }, 0],
  ["contractor", { party_type: "contractor" }, 12000],
  ["tank", { source_store: "fuel_tank_movements", source_id: "T" }, 0],
  ["cancelled", { status: "İptal" }, 0],
]) {
  const a = { payables: [{ ...bill, ...change }] };
  assert.equal(costTotals(costRows(a)).total, expected, key);
  assert.equal(
    costLedger(a).reduce((s, r) => s + r.gross, 0),
    expected,
    key,
  );
}
const linked = {
  ...d,
  maintenance_records: [],
  payables: [
    {
      ...bill,
      source_store: "expense_records",
      source_id: "E",
      vehicle_id: "V",
    },
  ],
};
assert.equal(costTotals(costRows(linked)).total, 12000);
assert.equal(
  costLedger(linked).reduce((s, r) => s + r.gross, 0),
  12000,
);
const alloc = {
  ...d,
  maintenance_records: [],
  cost_allocations: [
    {
      id: "A",
      status: "Aktif",
      source_store: "expense_records",
      source_id: "E",
      targets: [
        { site_id: "SITE", vehicle_id: "V", net: null, tax: null, gross: 6000 },
      ],
      created_at: n,
    },
  ],
};
assert.equal(allocatedCosts(alloc, { site_id: "SITE" })[0].gross, 6000);
assert.equal(operatingResult(alloc, { site_id: "SITE" }).unknown_cost, 6000);
assert.equal(resultReport(alloc, { site_id: "SITE" }).unknown_cost, 6000);
const contract = {
  sites: [
    {
      id: "SITE",
      customer_id: "C",
      deal: { charge: { cari_id: "CM", net: 10000, kdv: 2000, gross: 12000 } },
    },
  ],
  cari_movements: [
    {
      id: "CM",
      date,
      customer_id: "C",
      source: "goturu",
      type: "Hakedis",
      ref_id: "SITE",
      ref_store: "sites",
      amount: 12000,
    },
  ],
};
assert.equal(operatingResult(contract).revenue, 10000);
assert.equal(operatingResult(contract, { vehicle_id: "V" }).revenue, 0);
assert.equal(
  operatingResult({
    ...contract,
    cari_movements: [{ ...contract.cari_movements[0], deleted_at: n }],
  }).revenue,
  0,
);
assert.equal(
  operatingResult({
    ...contract,
    cari_movements: [{ ...contract.cari_movements[0], amount: 100 }],
  }).revenue,
  0,
);
const debt = {
  suppliers: [{ id: "S", name: "TEST Satıcı" }],
  quarries: [{ id: "Q", name: "TEST Ocak" }],
  payables: [
    { ...bill, id: "A", gross_total: 100, due_date: "2026-10-21" },
    { ...bill, id: "B", gross_total: 100, due_date: "2026-11-01" },
    {
      ...bill,
      id: "Q",
      party_type: "quarry",
      party_id: "Q",
      gross_total: 250,
      due_date: "2026-10-23",
    },
  ],
  supplier_payments: [
    {
      id: "P",
      date,
      payable_id: "B",
      party_type: "supplier",
      party_id: "S",
      amount: 100,
    },
  ],
};
const forecast = cashForecast(debt, { today: "2026-10-22" })
  .weeks.flatMap((w) => w.items)
  .filter((i) => i.label.includes("borcu"));
assert.equal(forecast.length, 2);
assert.equal(forecast.find((i) => i.href.endsWith("/A")).late, true);
assert.equal(forecast.find((i) => i.href.endsWith("/Q")).amount, 250);
const maintenance = {
  vehicles: [{ id: "V", machine_hours: 1000, meter_date: "2026-10-01" }],
  work_records: [
    {
      id: "W",
      date: "2026-10-20",
      vehicle_id: "V",
      unit: "Saat",
      quantity: 200,
    },
  ],
};
const state = serviceState(
  { vehicle_id: "V", next_hours: 1100 },
  maintenance.vehicles[0],
  [],
  "2026-10-22",
  maintenance,
);
assert.equal(state.leftHours, -100);
assert.equal(state.estimated, true);
const custom = {
  expense_categories: [{ id: "X", name: "Şantiye Yemek", created_at: n }],
};
assert.ok(
  assistantContext(custom).expense_categories.includes("Şantiye Yemek"),
);
const plan = validatePlan(
  { expenses: [{ date, category: "Şantiye Yemek", amount: 100 }] },
  { d: custom, message: "Şantiye Yemek 100 TL", today: date },
);
assert.equal(plan.expenses[0].category, "Şantiye Yemek");
assert.equal(plan.expenses[0].ok, true);
console.log(
  "parts-ledgers OK: validation, warranty, shared cost policy, allocations, contract revenue, exact bill payment, estimated meters, custom category",
);

const legacyLinked = {
  ...d,
  maintenance_records: [],
  payables: [
    {
      ...bill,
      items: [],
      source_store: "expense_records",
      source_id: "E",
      gross_total: 6000,
    },
  ],
};
assert.equal(costTotals(costRows(legacyLinked)).total, 6000);
assert.equal(
  costLedger(legacyLinked).reduce((n, r) => n + r.gross, 0),
  6000,
  "legacy source-linked summary bill uses original cost once",
);

assert.equal(
  costLedger({
    expense_records: [
      { id: "deposit", date, amount: 1000, dump_deposit: true },
    ],
  }).length,
  0,
  "dump deposit is not consumed cost",
);
assert.equal(
  costLedger({
    fuel_records: [
      { id: "customer", date, total: 1000, fuel_source: "Müşteri Verdi" },
    ],
  }).length,
  0,
  "customer supplied fuel is never cash cost",
);

assert.equal(
  sparePartFields(d, {
    ...f,
    warranty_start: "2020-01-01",
    warranty_until: "2025-01-01",
  }).warranty_start,
  "2020-01-01",
  "used part can retain earlier warranty start; dates are not invented",
);

const { preparePartFiles } = await import("../js/parts-db.js");
const pdf = new File([pdfBytes()], "warranty.pdf", {
  type: "application/octet-stream",
});
const prepared = await preparePartFiles([pdf]);
assert.equal(prepared[0].type, "application/pdf");
assert.equal(
  await prepared[0].blob.text(),
  await pdf.text(),
  "warranty document original bytes retained",
);
await assert.rejects(preparePartFiles(Array(9).fill(pdf)), /en fazla 8/);
await assert.rejects(preparePartFiles([{ size: 16 * 1024 * 1024 }]), /15 MB/);
await assert.rejects(
  preparePartFiles([{ size: 16 * 1024 * 1024 }, { size: 16 * 1024 * 1024 }]),
  /30 MB/,
);
await assert.rejects(
  preparePartFiles([
    new File(["<script>", "alert(1)", "</script>"], "warranty.pdf", {
      type: "text/html",
    }),
  ]),
  /JPEG/,
);

assert.equal(partCostState(d,r).label,'Gider kaydı yok');
assert.equal(partCostState(d,{...r,cost_source_store:'expense_records',cost_source_id:'E'}).kind,'ok');
assert.equal(partCostState(d,{...r,cost_source_store:'expense_records',cost_source_id:'missing'}).kind,'warn');
assert.equal(partCostState(d,{...r,maintenance_id:'M'}).label,'Bakım maliyetine dahil');
assert.match(partCostState(d,{...r,cost_unlinked:{store:'expense_records',id:'E'}}).label,/Önceki maliyet kaydı duruyor/);
console.log('parts cost choice: explicit mode required; tracking, linked and missing source states PASS');

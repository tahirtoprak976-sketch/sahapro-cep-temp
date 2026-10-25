import assert from "node:assert/strict";
import test from "node:test";
import { buildReport, forAudience, reportSpec, reportCsv } from "../js/report-core.js";
import { customerReportData } from "../js/customer-report.js";
import { screen as reportScreen } from "../js/report-ui.js";

const range = { from: "2026-10-01", to: "2026-10-25", today: "2026-10-25" };
const work = (id, fields = {}) => ({ id, created_at: "x", date: "2026-10-02", customer_id: "C", vehicle_id: "V", site_id: "S", work_type: "Moloz Nakliye", quantity: 2, unit: "Sefer", ...fields });
const data = (works = []) => ({
  customers: [{ id: "C", name: "TEST Müşteri" }], vehicles: [{ id: "V", name: "TEST Araç" }], sites: [{ id: "S", name: "TEST Şantiye" }],
  work_records: works, cari_movements: [], hakedis: [],
});
const report = (d, extra = {}) => buildReport(d, { k: "musteri", id: "C", ...range, ...extra });
const cell = (table, row, name) => table.rows[row][table.headers.indexOf(name)];
const kpi = (r, name) => r.kpis.find(([key]) => key === name)?.[1];

test("explicit zero, missing and included prices are distinct without modifying records", () => {
  const d = data([
    work("zero", { price_snapshot: { unit_price: 0, amount: 0 } }),
    work("missing"),
    work("included", { price_snapshot: { price_source: "Sözleşmeye dahil" } }),
  ]);
  const before = structuredClone(d), r = report(d), table = r.tables[0];
  assert.equal(cell(table, 0, "Birim Fiyat"), "0,00 ₺");
  assert.equal(cell(table, 0, "Tutar"), "0,00 ₺");
  assert.equal(cell(table, 1, "Birim Fiyat"), "");
  assert.equal(cell(table, 1, "Tutar"), "Fiyat eksik");
  assert.equal(cell(table, 2, "Tutar"), "Sözleşmeye dahil");
  assert.equal(kpi(r, "Fiyatı eksik iş"), "1");
  assert.equal(kpi(r, "İş tutarı"), "0,00 ₺");
  assert.ok(r.notes.some(n => /bedelsiz/.test(n)));
  assert.deepEqual(d, before);
  for (const out of [JSON.stringify(reportSpec(r, { audience: "customer" })), reportCsv(r, "customer")]) {
    assert.match(out, /Fiyat eksik/);
    assert.match(out, /Sözleşmeye dahil/);
    assert.match(out, /bedelsiz/);
  }
});

test("missing-price counter follows the existing review policy, including billed and locked work", () => {
  const d = data([
    work("string-zero", { price_snapshot: { unit_price: "0" } }),
    work("empty", { price_snapshot: { unit_price: "" } }),
    work("blank", { price_snapshot: { unit_price: "  " } }),
    work("bad", { price_snapshot: { unit_price: true } }),
    work("billed"),
    work("locked", { price_snapshot: { locked: true } }),
    work("internal", { price_snapshot: { price_source: "İç iş (kendi depo)" } }),
    work("fuel-source", { price_snapshot: { price_source: "Mazot karşılığı" } }),
    work("deleted", { deleted_at: "x" }),
    work("old", { date: "2026-09-01" }),
  ]);
  d.hakedis = [{ id: "H", status: "Kesinleşti", items: [{ work_record_id: "billed" }] }];
  const r = report(d), table = r.tables[0];
  assert.equal(table.count, 8);
  assert.equal(kpi(r, "Fiyatı eksik iş"), "3");
  assert.equal(cell(table, 0, "Tutar"), "0,00 ₺");
  for (const i of [1, 2]) {
    assert.equal(cell(table, i, "Birim Fiyat"), "");
    assert.equal(cell(table, i, "Tutar"), "Fiyat eksik");
  }
  assert.equal(cell(table, 3, "Birim Fiyat"), "");
  assert.equal(cell(table, 3, "Tutar"), "2,00 ₺", "legacy workAmount arithmetic is not rewritten by a presentation fix");
  assert.equal(cell(table, 4, "Tutar"), "Hakedişe dahil");
  assert.equal(cell(table, 5, "Tutar"), "Kilitli kayıt");
  assert.equal(cell(table, 6, "Tutar"), "İç iş (kendi depo)");
  assert.equal(cell(table, 7, "Tutar"), "Mazot karşılığı");
});

test("mixed TL and litres remain separate in rows, groups, totals, PDF and CSV", () => {
  const d = data([
    work("mixed", { price_snapshot: { unit_price: 1000, amount: 2000 }, customer_fuel_allowance_l: 150 }),
    work("fuel", { customer_fuel_allowance_l: 75 }),
  ]);
  for (const kind of ["musteri", "santiye", "arac", "istur"]) {
    const r = report(d, { k: kind, id: kind === "musteri" ? "C" : kind === "santiye" ? "S" : kind === "arac" ? "V" : "Moloz Nakliye" });
    const table = r.tables[0], total = table.rows.length - 1;
    assert.equal(cell(table, 0, "Tutar"), "2.000,00 ₺ · 150 L mazot");
    assert.equal(cell(table, 1, "Tutar"), "75 L mazot");
    assert.equal(cell(table, total, "Tutar"), "2.000,00 ₺ · 225 L mazot");
    assert.equal(kpi(r, "İş tutarı"), "2.000,00 ₺");
    assert.equal(kpi(r, "Mazot karşılığı"), "225 L");
    assert.equal(kpi(r, "Fiyatı eksik iş"), undefined);
    for (const group of r.tables.filter(t => t.title.endsWith("göre"))) {
      assert.match(cell(group, 0, "Tutar"), /2\.000,00 ₺.*225 L mazot/);
    }
    for (const audience of ["customer", "internal"]) {
      const visible = forAudience(r, audience);
      for (const t of visible.tables) for (const row of t.rows) assert.equal(row.length, t.headers.length);
      for (const out of [JSON.stringify(reportSpec(r, { audience })), reportCsv(r, audience)]) {
        assert.match(out, /2\.000,00 ₺ · 150 L mazot/);
        assert.match(out, /2\.000,00 ₺ · 225 L mazot/);
        assert.doesNotMatch(out, /2\.225,00 ₺/);
      }
    }
  }
});

test("recorded cari balance keeps its arithmetic but explains its narrower scope everywhere", () => {
  const d = data([work("unbilled", { price_snapshot: { unit_price: 1000, amount: 2000 } })]);
  d.cari_movements = [{ id: "P", date: "2026-10-03", customer_id: "C", type: "Tahsilat", amount: -500 }];
  const before = structuredClone(d), r = report(d), originalReport = structuredClone(r);
  assert.equal(kpi(r, "Kayıtlı cari bakiye"), "-500,00 ₺");
  assert.equal(kpi(r, "Dönem sonu bakiye"), undefined);
  assert.equal(customerReportData(d, "C", range).statement.closing, 1500);
  const table = r.tables.find(t => t.title === "Kayıtlı cari hareketler");
  assert.equal(cell(table, 1, "Kayıtlı bakiye"), "-500,00 ₺");
  const note = r.notes.find(n => /hakedişe girmemiş işler dahil değildir/.test(n));
  assert.ok(note);
  for (const audience of ["customer", "internal"]) {
    assert.ok(forAudience(r, audience).notes.includes(note));
    const pdf = JSON.stringify(reportSpec(r, { audience })), csv = reportCsv(r, audience);
    for (const out of [pdf, csv]) {
      assert.ok(out.includes(note));
      assert.match(out, /Kayıtlı cari hareketler/);
      assert.match(out, /Kayıtlı bakiye/);
    }
  }
  assert.deepEqual(d, before);
  assert.deepEqual(r, originalReport, "rendering and export leave the internal report unchanged");
});

test("customer exports use the statement privacy rule; internal reasons remain in internal reports", async () => {
  const d = data();
  const privateReason = 'PRIVATE_REASON <img src=x onerror="alert(1)">';
  const privateAdjustmentNote = "PRIVATE_ADJUSTMENT_NOTE";
  const publicNote = 'PUBLIC_NOTE <b>& "metin"</b>';
  d.cari_movements = [
    { id: "D", date: "2026-10-03", customer_id: "C", type: "Duzeltme", amount: 100, reason: privateReason, note: privateAdjustmentNote },
    { id: "P", date: "2026-10-04", customer_id: "C", type: "Tahsilat", amount: -25, reason: privateReason, note: publicNote },
  ];
  const before = structuredClone(d), r = report(d), originalReport = structuredClone(r);
  for (const out of [JSON.stringify(forAudience(r, "customer")), JSON.stringify(reportSpec(r, { audience: "customer" })), reportCsv(r, "customer")]) {
    assert.doesNotMatch(out, /PRIVATE_REASON|PRIVATE_ADJUSTMENT_NOTE/);
    assert.match(out, /PUBLIC_NOTE/);
  }
  for (const out of [JSON.stringify(forAudience(r, "internal")), JSON.stringify(reportSpec(r, { audience: "internal" })), reportCsv(r, "internal")])
    assert.match(out, /PRIVATE_REASON/);
  const visible = forAudience(r, "customer").tables.find(t => t.title === "Kayıtlı cari hareketler");
  const customer = forAudience(r, "customer");
  assert.deepEqual(forAudience(customer, "customer"), customer, "audience filtering is idempotent");
  assert.ok(customer.tables.every(t => !Object.hasOwn(t, "customerRows")), "no unused audience row metadata survives filtering");
  assert.doesNotMatch(JSON.stringify(reportSpec(customer, { audience: "customer" })), /PRIVATE_REASON|PRIVATE_ADJUSTMENT_NOTE/);
  assert.doesNotMatch(reportCsv(customer, "customer"), /PRIVATE_REASON|PRIVATE_ADJUSTMENT_NOTE/);
  assert.equal(cell(visible, 1, "Açıklama"), "");
  assert.equal(cell(visible, 2, "Açıklama"), publicNote);
  assert.equal(cell(visible, 2, "Kayıtlı bakiye"), "75,00 ₺");
  for (const audience of ["customer", "internal"]) {
    const root = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
    await reportScreen({ parts: ["detayli-rapor"], root, query: { k: "musteri", id: "C", p: "all", a: audience }, db: { dumpAll: async () => d, metaGet: async () => null } });
    assert.doesNotMatch(root.innerHTML, /<img src=x|<b>& "metin"/);
    if (audience === "customer") {
      assert.doesNotMatch(root.innerHTML, /PRIVATE_REASON|PRIVATE_ADJUSTMENT_NOTE/);
      assert.match(root.innerHTML, /PUBLIC_NOTE &lt;b&gt;&amp; &quot;metin&quot;&lt;\/b&gt;/);
    } else assert.match(root.innerHTML, /PRIVATE_REASON &lt;img/);
  }
  assert.deepEqual(d, before);
  assert.deepEqual(r, originalReport, "privacy filtering never edits the original report or its internal rows");
});

import assert from "node:assert/strict";
import { closingSummary } from "../js/enterprise-core.js";

const { operationModel, plannedWorkDraft, planConflict, closingDifference } = await import("../js/operation-core.js");

const date = "2026-10-27";
const customer = { id: "C", name: "TEST Customer" }, vehicle = { id: "V", name: "TEST Truck", type: "Kamyon" }, person = { id: "P", name: "TEST Driver" };
const plan = { id: "PLAN", date, customer_id: "C", site_id: "S", vehicle_id: "V", personnel_id: "P", task: "TEST planned machine work", start: "08:00", end: "10:00", break_minutes: 0, hours: 2, status: "Planlı" };
const works = Array.from({ length: 35 }, (_, i) => ({ id: "W" + i, date, customer_id: "C", vehicle_id: "V", personnel_id: "P", work_type: "Makine Çalışması", unit: "Saat", quantity: 1, price_snapshot: null }));
const base = () => ({ customers: [customer], sites: [{ id: "S", name: "TEST Site", customer_id: "C" }], vehicles: [vehicle], personnel: [person], work_records: works.map(w => ({ ...w })), shift_assignments: [{ ...plan }], fuel_records: [], pending_fuel_records: [], expense_records: [], maintenance_records: [], cash_records: [], supplier_payments: [], cari_movements: [], hakedis: [], daily_closings: [], dump_entries: [], payables: [], documents: [], personnel_events: [], slips: [], price_book: [], suppliers: [], payroll_entries: [], instruments: [], dump_sites: [], inbox_messages: [], quarries: [], aliases: [], attachments: [], meta: [] });

const d = base();
const model = operationModel(d, { date, vehicle_id: "V", personnel_id: "P", meta: [] });
assert.equal(model.stream.rows.length, 35, "özet ilk30 görünümle sınırlı olmamalı");
assert.equal(model.stream.units.Saat, 35);
assert.equal(model.plans.length, 1);
assert.equal(model.plans[0].work_record_id, undefined);
assert.equal(model.close.current.work_count, 35);
assert.equal(model.close.current.units.Saat, 35);

const draft = plannedWorkDraft(plan);
assert.equal(draft._plan_id, "PLAN");
assert.equal(draft.quantity, 2);
assert.equal(draft.unit, "Saat");
assert.equal(draft.date, date);
assert.equal(draft.price_snapshot, undefined, "plan fiyat/gelir üretmemeli");
assert.equal(draft.time_start, "08:00");
assert.equal(draft.time_end, "10:00");
assert.equal(plan.work_record_id, undefined, "taslak planı değiştirmemeli");

const overlap = { ...plan, id: "OTHER", start: "09:30", end: "11:00" };
const conflict = planConflict([plan, overlap], overlap);
assert.equal(conflict.id, "PLAN");
assert.equal(planConflict([plan, { ...plan, id: "X", start: "10:00", end: "11:00" }], { ...plan, id: "X", start: "10:00", end: "11:00" }), null, "bitiş=başlangıç kesişim değildir");
assert.equal(planConflict([{ ...plan, start: "", end: "" }], { ...plan, start: "", end: "" }), null, "saat yoksa kesin çakışma üretilmez");

const saved = closingSummary(d, date), savedClosing = { id: "CLOSE", date, summary: structuredClone(saved), status: "Kapandı" };
assert.deepEqual(closingDifference(savedClosing, saved), []);
d.work_records[0].quantity = 3;
const current = closingSummary(d, date);
const diff = closingDifference(savedClosing, current);
assert.equal(savedClosing.summary.units.Saat, 35, "kaydedilmiş kapanış değişmez");
assert.equal(current.units.Saat, 37);
assert.ok(diff.some(x => x.key === "source_signature"));
assert.ok(diff.some(x => x.key === "units"));
assert.equal(closingDifference(null, current).length, 0);

const filtered = operationModel(d, { date, vehicle_id: "OTHER", personnel_id: "P", meta: [] });
assert.equal(filtered.stream.rows.length, 0);
assert.equal(filtered.plans.length, 0);

console.log("operation desk PASS: full-scope totals, plan draft/no income, true time overlap, closing diff and filters");

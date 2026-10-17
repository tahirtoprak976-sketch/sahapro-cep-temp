import assert from "node:assert/strict";
import { integrityCheck } from "../js/integrity-core.js";
const T = "2026-10-17";
const base = () => ({
  customers: [{ id: "c1", name: "Kaya" }], sites: [{ id: "s1", name: "Göktürk", customer_id: "c1" }],
  vehicles: [{ id: "v1", name: "34 ABC 1", assignee_id: "p1" }], personnel: [{ id: "p1", name: "Ali" }],
  dump_sites: [{ id: "d1", name: "Bolluca" }], quarries: [], suppliers: [{ id: "sp1", name: "Ayangil" }],
  work_records: [{ id: "w1", date: "2026-10-10", customer_id: "c1", site_id: "s1", vehicle_id: "v1", personnel_id: "p1", quantity: 3, unit: "Sefer", dump_site_id: "d1", slip_no: "A123" }],
  fuel_records: [{ id: "f1", date: "2026-10-10", vehicle_id: "v1", liters: 100, fuel_source: "Depo Tankı", tank_movement_id: "m2" }],
  fuel_tank_movements: [{ id: "m1", date: "2026-10-01", move_type: "GİRİŞ", liters: 5000, unit_price: 90.19, total: 450950, supplier_id: "sp1", invoice_no: "AYG1" },
    { id: "m2", date: "2026-10-10", move_type: "ÇIKIŞ", liters: 100, fuel_record_id: "f1" }],
  expense_records: [{ id: "e1", date: "2026-10-11", amount: 500, vehicle_id: "v1" }], maintenance_records: [], cash_records: [],
  personnel_events: [], documents: [], payables: [{ id: "b1", status: "Onaylandı", source_store: "fuel_tank_movements", source_id: "m1", gross_total: 450950 }], hakedis: [],
});
const atts = [{ id: "a1", record_type: "tank", record_id: "m1", name: "fatura.jpg", size: 1000, blob: { size: 1000 } }];
// Temiz veri: sıfır sorun
const ok = integrityCheck(base(), { today: T, attachments: atts });
assert.deepEqual(ok.issues.map((x) => x.code), [], JSON.stringify(ok.issues));
const codes = (d, a = atts) => integrityCheck(d, { today: T, attachments: a }).issues.map((x) => x.code);
let d;
d = base(); d.customers[0].deleted_at = "x"; assert.ok(codes(d).includes("ref-deleted"));
d = base(); d.work_records[0].customer_id = null; assert.ok(codes(d).includes("ref-empty"));
d = base(); d.sites.push({ id: "s2", name: "X", customer_id: "c2" }); d.customers.push({ id: "c2", name: "B" }); d.work_records[0].site_id = "s2"; assert.ok(codes(d).includes("site-customer"));
d = base(); d.fuel_tank_movements[1].deleted_at = "x"; assert.ok(codes(d).includes("fuel-no-move"));
d = base(); d.fuel_tank_movements[1].liters = 90; assert.ok(codes(d).includes("fuel-move-liters"));
d = base(); d.fuel_records[0].deleted_at = "x"; assert.ok(codes(d).includes("move-orphan"));
d = base(); assert.ok(codes(d, [...atts, { id: "a2", record_type: "expense", record_id: "yok", size: 5, blob: { size: 5 } }]).includes("att-orphan"));
d = base(); assert.ok(codes(d, [{ ...atts[0], size: 0, blob: null }]).includes("att-empty"));
d = base(); d.work_records.push({ ...d.work_records[0], id: "w2", driver_entry_id: "E1" }); d.work_records[0].driver_entry_id = "E1"; assert.ok(codes(d).includes("dup-driver"));
d = base(); d.work_records.push({ ...d.work_records[0], id: "w2", date: "2026-10-12" }); assert.ok(codes(d).includes("dup-slip"));
d = base(); d.fuel_tank_movements.push({ ...d.fuel_tank_movements[0], id: "m3" }); assert.ok(codes(d).includes("dup-tank-invoice"));
d = base(); d.expense_records[0].amount = -5; assert.ok(codes(d).includes("bad-number"));
d = base(); d.expense_records[0].date = "2026-13-40"; assert.ok(codes(d).includes("bad-date"));
d = base(); d.expense_records[0].date = "2027-10-11"; assert.ok(codes(d).includes("future"));
d = base(); d.work_records[0].quantity = 0; assert.ok(codes(d).includes("zero-qty"));
d = base(); d.fuel_tank_movements[0].date = "2026-10-20"; assert.ok(codes(d).includes("tank-negative"));
d = base(); d.fuel_tank_movements[0].unit_price = 75.16; assert.ok(codes(d).includes("tank-price"));
d = base(); d.personnel_events.push({ id: "pe1", personnel_id: "p1", date: "2026-10-10", event_type: "İzin", leave_form_id: "F1" }); d.documents.push({ id: "F1", category: "İzin Formu", status: "Reddedildi", owner_type: "personnel", owner_id: "p1", date: T, doc_no: "İZN-1" });
{ const c = codes(d); assert.ok(c.includes("leave-form")); assert.ok(c.includes("leave-work")); }
d = base(); d.personnel[0].deleted_at = "x"; assert.ok(codes(d).includes("veh-assignee"));
d = base(); d.payables[0].gross_total = 400000; assert.ok(codes(d).includes("tank-payable"));
d = base(); d.fuel_tank_movements[0].deleted_at = "x"; assert.ok(codes(d).includes("payable-source"));
d = base(); d.documents.push({ id: "x1", category: "Fatura", owner_type: "customer", owner_id: "c1", date: T, doc_no: "FT001" }, { id: "x2", category: "Fatura", owner_type: "customer", owner_id: "c1", date: T, doc_no: "FT001" }); assert.ok(codes(d).includes("dup-doc"));
console.log("integrity ok");

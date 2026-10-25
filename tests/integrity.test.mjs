import assert from "node:assert/strict";
import { integrityCheck } from "../js/integrity-core.js";
import { calcHakedisTotals } from "../js/core.js";
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
// ---- Para ----
const money = () => { const x = base(); x.cash_records = [{ id: "k1", date: "2026-10-12", cash_type: "Müşteriden Para Alındı", amount: 5000, customer_id: "c1" }];
  x.cari_movements = [{ id: "cm1", date: "2026-10-12", customer_id: "c1", type: "Tahsilat", amount: -5000, ref_id: "k1" }];
  x.work_records[0].price_snapshot = { unit_price: 3000, amount: 9000, kdv_rate: 20, kdv_included: false }; return x; };
assert.deepEqual(codes(money()), [], JSON.stringify(integrityCheck(money(), { today: T, attachments: atts }).issues));
d = money(); d.cari_movements = []; assert.ok(codes(d).includes("cash-cari"));
d = money(); d.cari_movements.push({ ...d.cari_movements[0], id: "cm2" }); assert.ok(codes(d).includes("cash-cari"));
d = money(); d.cash_records[0].amount = 6000; assert.ok(codes(d).includes("cash-cari-amount"));
d = money(); d.cash_records[0].deleted_at = "x"; assert.ok(codes(d).includes("cari-orphan-cash"));
// Complete the synthetic valid claim/source fixture; all original assertions below remain unchanged.
const hk = (st, gt) => { const x = money(), w = x.work_records[0];
  const t = calcHakedisTotals([{work_record_id:w.id,date:w.date,customer_id:w.customer_id,site_id:w.site_id,vehicle_id:w.vehicle_id,quantity:w.quantity,unit:w.unit,unit_price:3000,kdv_rate:20,kdv_included:false}]);
  x.hakedis = [{id:"h1",hakedis_no:1,status:st,customer_id:"c1",created_date:"2026-10-13",date_from:w.date,date_to:w.date,subtotal:t.subtotal,kdv_total:t.kdv,grand_total:gt,items:t.lines}];
  if (st === "Kesinleşti") { w.price_snapshot = {...t.lines[0],locked:true}; x.cari_movements.push({id:"cm3",date:"2026-10-13",customer_id:"c1",type:"Hakedis",amount:gt,ref_id:"h1"}); } return x; };
assert.deepEqual(codes(hk("Kesinleşti", 10800)), []);
assert.ok(codes(hk("Kesinleşti", 10000)).includes("hakedis-total"));
d = hk("Kesinleşti", 10800); d.cari_movements.pop(); assert.ok(codes(d).includes("hakedis-cari"));
d = hk("Taslak", 10800); d.cari_movements.push({ id: "cm9", customer_id: "c1", type: "Hakedis", amount: 10800, ref_id: "h1", date: "2026-10-13" }); assert.ok(codes(d).includes("hakedis-cari-draft"));
console.log("integrity ok");

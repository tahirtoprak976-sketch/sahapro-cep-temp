import assert from "node:assert/strict";
import { workAmount } from "../js/collect-core.js";

const { workFileModel } = await import("../js/work-file-core.js");
const date = "2026-10-27";
const parent = { id: "PARENT", name: "TEST Parent" }, child = { id: "C", name: "TEST Child", parent_customer_id: "PARENT" };
const work = { id: "W", date, customer_id: "C", site_id: "S", vehicle_id: "V", personnel_id: "P", driver_entry_id: "DRV", work_type: "Hafriyat Nakliye", unit: "Sefer", quantity: 1, dump_site_id: "D", slip_id: "DELETED", price_snapshot: { unit_price: 1000, amount: 1000, kdv_rate: 0, kdv_included: false } };
const d = {
  customers: [parent, child], sites: [{ id: "S", name: "TEST Site", customer_id: "C" }], vehicles: [{ id: "V", name: "TEST Truck", type: "Kamyon" }], personnel: [{ id: "P", name: "TEST Driver" }], dump_sites: [{ id: "D", name: "TEST Dump", fee: 100, fee_unit: "Sefer", fee_effective_from: date }], work_records: [work],
  slips: [], attachments: [{ id: "A", record_type: "work", record_id: "W", name: "safe.pdf", type: "application/pdf" }],
  dump_entries: [{ id: "R", kind: "RECEIPT", date, dump_site_id: "D", work_record_id: "W", customer_id: "C", vehicle_id: "V", trips: 1, amount: 100, payer: "company_account" }],
  expense_records: [{ id: "GENERAL", date, vehicle_id: "V", category: "Genel", amount: 50 }, { id: "DIRECT", date, vehicle_id: "V", work_record_id: "W", category: "Doğrudan", amount: 25 }],
  cost_allocations: [{ id: "ALLOC", status: "Aktif", source_store: "expense_records", source_id: "DIRECT", source_snapshot: { gross: 25 }, targets: [{ customer_id: "C", site_id: "S", vehicle_id: "V", gross: 25 }] }],
  hakedis: [{ id: "H", status: "Kesinleşti", customer_id: "C", items: [{ work_record_id: "W", amount: 1000 }] }],
  cash_records: [{ id: "DIRECT-CASH", date, customer_id: "C", driver_entry_id: "DRV", cash_type: "Müşteriden Para Alındı", amount: 200, cash_status: "PERSONELDE" }, { id: "GENERAL-CASH", date, customer_id: "C", cash_type: "Müşteriden Para Alındı", amount: 300, cash_status: "KASADA" }],
  cari_movements: [], payables: [], fuel_records: [], pending_fuel_records: [], fuel_tank_movements: [], maintenance_records: [], shift_assignments: [], invoices: [],
};
const before = JSON.stringify(d), model = workFileModel(d, "W");
assert.equal(model.customer.id, "C");
assert.equal(model.parent.id, "PARENT");
assert.equal(model.directPayments.length, 1);
assert.equal(model.directPayments[0].id, "DIRECT-CASH");
assert.equal(model.generalCustomerPayments, 300);
assert.equal(model.paymentStatus, "Bu işe bağlı tahsilat kaydı var");
assert.equal(workFileModel({ ...d, cash_records: [d.cash_records[1]] }, "W").paymentStatus, "Müşteri hesabında tahsilat var; bu işe dağıtılmadı");
assert.notEqual(model.paymentStatus, "Ödendi");
assert.equal(model.claims.length, 1);
assert.equal(model.linkedCosts.some(x => x.source_id === "DIRECT"), true);
assert.equal(model.generalContext.some(x => x.source_id === "GENERAL"), true);
assert.equal(model.generalContext.some(x => x.source_id === "DIRECT"), false);
assert.equal(model.linkedCosts.filter(x => x.source_id === "DIRECT").length, 1, "aynı fiş iki kez yazılmamalı");
assert.equal(model.allocations.length, 1);
assert.equal(model.issues.some(x => /slip_id|Fiş/i.test(x)), true, "silinmiş fiş ilişki sorunu görünür");
assert.equal(model.dump.amount, 100);
assert.equal(model.attachments.length, 1);
assert.equal(workAmount(work), 1000);
assert.equal(JSON.stringify(d), before, "iş dosyası açma kayıt yazmamalı");
assert.throws(() => workFileModel(d, "MISSING"), /bulunamadı/);
console.log("work file PASS: exact IDs, parent/debtor separation, direct/general payments and costs, allocations, deleted source and immutability");

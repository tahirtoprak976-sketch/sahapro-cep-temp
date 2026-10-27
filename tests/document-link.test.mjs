import assert from "node:assert/strict";

const { sha256File, documentDuplicateCandidates, validateDocumentLink } = await import("../js/document-link-core.js");
const pdf = new File(["%PDF-1.4\nstartxref\n0\n%%EOF"], "receipt.pdf", { type: "application/pdf" });
const hash = await sha256File(pdf);
const work = { id: "W", date: "2026-10-27", customer_id: "C", vehicle_id: "V", dump_site_id: "D", unit: "Sefer", quantity: 3 };
const d = {
  work_records: [work], dump_sites: [{ id: "D", name: "TEST Dump" }], customers: [{ id: "C", name: "TEST Customer" }], vehicles: [{ id: "V", name: "TEST Truck" }],
  attachments: [{ id: "A", record_type: "dump_entries", record_id: "R", src_sha256: hash }],
  dump_entries: [{ id: "R", kind: "RECEIPT", receipt_no: "F-1", dump_site_id: "D", work_record_id: "W" }],
  expense_records: [], payables: [], documents: [],
};
assert.deepEqual(documentDuplicateCandidates(d, { sha256: hash, receipt_no: "F-1", dump_site_id: "D" }).exact.map(x => x.id), ["R"]);
assert.equal((await validateDocumentLink(d, { kind: "dump_receipt", receipt_no: "F-1", sha256: hash, dump_site_id: "D" }, pdf)).duplicate, "exact");
assert.equal((await validateDocumentLink(d, { kind: "dump_receipt", receipt_no: "F-1", sha256: "OTHER", dump_site_id: "D" }, pdf)).duplicate, "similar");

const fields = (await validateDocumentLink(d, { kind: "dump_receipt", receipt_no: "F-2", sha256: "NEW", work_record_id: "W", trips: 1, amount: 100, date: "2026-10-27", tonnage: 25, tonnage_scope: "total" }, pdf)).fields;
assert.equal(fields.work_record_id, "W");
assert.equal(fields.trips, 1);
assert.equal(fields.tonnage_scope, "total");
assert.equal(fields.amount, 100);
await assert.rejects(validateDocumentLink(d, { kind: "dump_receipt", work_record_id: "W", trips: 4, amount: 100, date: "2026-10-27" }, pdf), /en fazla 3 sefer/);
await assert.rejects(validateDocumentLink(d, { kind: "dump_receipt", work_record_id: "W", trips: 2, amount: -1, date: "2026-10-27" }, pdf), /Tutar/);
await assert.rejects(validateDocumentLink(d, { kind: "dump_receipt", work_record_id: "W", trips: 2, amount: 100, date: "2026-10-27", tonnage: 25, tonnage_scope: "unknown" }, pdf), /kapsam/);
await assert.rejects(validateDocumentLink(d, { kind: "other", amount: 1 }, pdf), /Belge türü/);

const generic = await validateDocumentLink(d, { kind: "generic", category: "Sözleşme", owner_type: "customer", owner_id: "C", date: "2026-10-27", doc_no: "DOC-1" }, pdf);
assert.equal(generic.fields.owner_id, "C");
assert.equal(generic.fields.category, "Sözleşme");
assert.equal(generic.fields.date, "2026-10-27");
assert.equal(generic.duplicate, undefined);
console.log("document link PASS: exact/similar dedupe, work/trip/amount/tonnage guards and generic owner fields");

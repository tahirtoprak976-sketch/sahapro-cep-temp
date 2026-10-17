// KDV / cari sözleşmesi raporu: mevcut veriyi DEĞİŞTİRMEDEN net/brüt ayrıştırır ve karışımı işaretler
import assert from "node:assert/strict";
import { workMoney, vatContractReport } from "../js/vat-contract.js";
import { integrityCheck } from "../js/integrity-core.js";
const W = (id, amount, snap) => ({ id, customer_id: "C", date: "2026-10-1" + id.slice(-1), quantity: 1, unit: "Sefer", work_type: "Hafriyat Nakliye", price_snapshot: { unit_price: amount, amount, ...snap } });
assert.deepEqual(workMoney(W("w1", 1000, { kdv_rate: 20, kdv_included: false })), { net: 1000, kdv: 200, gross: 1200, rate: 20, basis: "hariç", currency: "TRY", booked: 1000, invoiced: false, ambiguous: false, issues: [] });
assert.deepEqual([workMoney(W("w2", 1200, { kdv_rate: 20, kdv_included: true })).net, workMoney(W("w2", 1200, { kdv_rate: 20, kdv_included: true })).gross], [1000, 1200]);
assert.equal(workMoney(W("w3", 500, { kdv_rate: 0, kdv_included: false })).gross, 500, "%0 korunur");
const amb = workMoney(W("w4", 100, { kdv_rate: null }));
assert.ok(amb.ambiguous && amb.issues.length === 2);
const d = { customers: [{ id: "C", name: "Kaya" }], work_records: [W("w1", 1000, { kdv_rate: 20, kdv_included: false }), W("w2", 1200, { kdv_rate: 20, kdv_included: true })], hakedis: [], cari_movements: [] };
const before = JSON.stringify(d);
const r = vatContractReport(d)[0];
assert.equal(r.booked, 2200, "bugünkü hesap: 1000 net + 1200 brüt karışık toplanıyor");
assert.equal(r.net, 2000); assert.equal(r.gross, 2400); assert.ok(r.mixedBasis);
assert.equal(JSON.stringify(d), before, "rapor veriyi değiştirmez");
const ic = integrityCheck(d, { today: "2026-10-17" });
assert.ok(ic.issues.some((x) => x.code === "vat-mixed"));
console.log("vat-contract PASS");

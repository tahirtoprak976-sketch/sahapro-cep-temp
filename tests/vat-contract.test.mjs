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
// Belge durumu oranı belirlemez: faturasız (invoice_no yok) iş %0 sayılmaz; faturalı işin oranı da faturadan türetilmez
const nf = workMoney({ ...W("w5", 3500, { kdv_rate: 20, kdv_included: false }), invoice_no: null });
const f = workMoney({ ...W("w6", 3500, { kdv_rate: 20, kdv_included: false }), invoice_no: "MRH2026000000077" });
assert.deepEqual([nf.rate, nf.gross, nf.invoiced], [20, 4200, false]);
assert.deepEqual([f.rate, f.gross, f.invoiced], [20, 4200, true]);
// Karar notundaki örnek: 5 hariç + 5 dahil (3500) → bugün 35.000, brüt 38.500
const mix = { customers: [{ id: "C", name: "K" }], hakedis: [], cari_movements: [], work_records: [...Array.from({ length: 5 }, (_, i) => W("h" + i, 3500, { kdv_rate: 20, kdv_included: false })), ...Array.from({ length: 5 }, (_, i) => W("d" + i, 3500, { kdv_rate: 20, kdv_included: true }))] };
const rm = vatContractReport(mix)[0];
assert.deepEqual([rm.booked, rm.gross], [35000, 38500]);
console.log("vat-contract PASS");

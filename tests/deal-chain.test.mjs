import assert from "node:assert/strict";

const { dealChainModel } = await import("../js/deal-chain-core.js");
const quote = { id: "Q", quote_no: 4, date: "2026-10-20", customer_id: "C", site_id: "S", status: "Kabul", type: "UNIT_PRICE", input: { quantity: 2, unit: "Sefer", fuel_l: 10, fuel_price: 50, margin: 20 } };
const work = { id: "W", quote_id: "Q", date: "2026-10-21", customer_id: "C", site_id: "S", unit: "Sefer", quantity: 1 };
const d = {
  quotes: [quote], contracts: [{ id: "K", quote_id: "Q", site_id: "S", status: "Taslak" }], sites: [{ id: "S", name: "TEST Site", customer_id: "C", deal: { basis: "Sefer", price: 1000 } }, { id: "X", name: "Unrelated", customer_id: "C" }],
  shift_assignments: [{ id: "P", quote_id: "Q", site_id: "S", status: "Planlı", task: "TEST plan" }], work_records: [work, { id: "OLD", date: "2026-10-19", customer_id: "C", site_id: "S", unit: "Sefer", quantity: 1 }, { id: "XW", date: "2026-10-22", customer_id: "C", site_id: "X", unit: "Sefer", quantity: 1 }],
  hakedis: [{ id: "H", status: "Kesinleşti", customer_id: "C", items: [{ work_record_id: "W" }] }],
  cash_records: [{ id: "PAY", customer_id: "C", cash_type: "Müşteriden Para Alındı", ref_id: "W", amount: 500 }, { id: "GENERAL", customer_id: "C", cash_type: "Müşteriden Para Alındı", amount: 900 }],
  cari_movements: [], customers: [{ id: "C", name: "TEST Customer" }], vehicles: [], personnel: [], attachments: [], dump_entries: [], expense_records: [],
};
const before = JSON.stringify(d), chain = dealChainModel(d, "Q");
assert.equal(chain.quote.id, "Q");
assert.equal(chain.contracts[0].id, "K");
assert.equal(chain.sites[0].id, "S");
assert.equal(chain.plans[0].id, "P");
assert.deepEqual(chain.works.map(x => x.id), ["W"], "yalnız gerçek teklif bağı olan iş");
assert.equal(chain.claims[0].id, "H");
assert.deepEqual(chain.payments.map(x => x.id), ["PAY"]);
assert.equal(chain.generalCustomerPayments, 900);
assert.equal(chain.stages.work.status, "1 gerçekleşen iş");
assert.equal(chain.stages.payment.status, "Bağlı tahsilat var");
assert.equal(chain.scenario.fuel_l, 10);
assert.equal(chain.scenario.fuel_price, 50);
assert.equal(JSON.stringify(d), before);
assert.throws(() => dealChainModel(d, "MISSING"), /bulunamadı/);
console.log("deal chain PASS: exact quote/contract/site/work/claim/payment IDs, no older/general linkage, immutable scenario");

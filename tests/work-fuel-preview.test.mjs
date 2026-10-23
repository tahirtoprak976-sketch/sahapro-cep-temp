import assert from "node:assert/strict";
import { workFuelState, fuelDecisionKey } from "../js/work-fuel-preview.js";
import { applyFuelPay, customerFuelLedger } from "../js/assistant-rules.js";
const d = {
  customers: [
    {
      id: "G",
      name: "TEST Güneş Hafriyat",
      fuel_rules: [
        {
          id: "F",
          per: 75,
          unit: "Sefer",
          match: "gravak maslak",
          only_pay: true,
        },
      ],
    },
  ],
  quarries: [{ id: "Q", name: "Maslak" }],
  sites: [],
  dump_sites: [],
};
const w = {
  customer_id: "G",
  date: "2026-10-23",
  quantity: 2,
  unit: "Sefer",
  work_type: "Gravak Nakliye",
  quarry_id: "Q",
};
const before = JSON.stringify(d),
  s = workFuelState(d, w);
assert.equal(s.status, "matched");
assert.equal(s.liters, 150);
assert.equal(s.only_pay, true);
assert.equal(applyFuelPay(d, w).customer_fuel_allowance_l, s.liters);
assert.equal(workFuelState(d, { ...w, quantity: "" }).status, "incomplete");
assert.equal(workFuelState(d, { ...w, date: "" }).status, "incomplete");
const badUnit = workFuelState(d, { ...w, unit: "Ton" });
assert.equal(badUnit.status, "unmatched");
assert.match(badUnit.reasons[0], /birim/);
const badWord = workFuelState(d, { ...w, quarry_id: null });
assert.equal(badWord.status, "unmatched");
assert.match(badWord.reasons[0], /maslak/);
const dated = structuredClone(d);
dated.customers[0].fuel_rules[0].from = "2026-10-24";
assert.match(workFuelState(dated, w).reasons[0], /önce/);
assert.equal(workFuelState(d, { ...w, customer_id: "other" }).status, "none");
const prior = {
  ...w,
  customer_fuel_allowance_l: 140,
  fuel_rule_id: "OLD",
  price_snapshot: {
    amount: 0,
    price_source: "Mazot karşılığı",
    fuel_liters_per_unit: 70,
  },
};
const old = workFuelState(d, w, prior);
assert.equal(old.status, "preserved");
assert.equal(old.liters, 140);
assert.equal(old.per, 70);
assert.equal(workFuelState(d, { ...w, quantity: 3 }, prior).liters, 210);
assert.equal(workFuelState(d, w, prior, true).only_pay, false);
assert.equal(
  workFuelState(d, { ...w, customer_id: "other" }, prior).status,
  "none",
);
const mixed = structuredClone(d);
mixed.customers[0].fuel_rules[0].only_pay = false;
assert.equal(workFuelState(mixed, w).only_pay, false);
const changed = structuredClone(d);
changed.customers[0].fuel_rules[0].per = 90;
assert.notEqual(fuelDecisionKey(s), fuelDecisionKey(workFuelState(changed, w)));
const renamed = structuredClone(d);
renamed.customers[0].name = "TEST New Name";
assert.equal(fuelDecisionKey(s), fuelDecisionKey(workFuelState(renamed, w)));
assert.equal(JSON.stringify(d), before);
assert.equal(
  customerFuelLedger(d, "G").earned,
  0,
  "önizleme kayıt veya mazot hakkı yazmaz",
);
console.log(
  "work-fuel-preview OK: live match/missing/unit/date/words, current customer, historical entitlement, quantity, mixed payment, rule-change decision and read-only behavior",
);

const {fuelReadView}=await import('../js/record-refresh.js');
for(const parts of [['isler'],['musteriler'],['musteriler','C'],['mazot-hesaplari']])assert.equal(fuelReadView(parts),true);
for(const parts of [['isler','new'],['isler','W','edit'],['musteriler','new'],['musteriler','C','edit'],['akilli-asistan'],['mazot-hesaplari','C']])assert.equal(fuelReadView(parts),false);

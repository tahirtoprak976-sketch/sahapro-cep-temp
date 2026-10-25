import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as core from "../js/core.js";
import { hakedisNumber } from "../js/hakedis-validation.js";
import { unpricedGroups } from "../js/collect-core.js";
import { sameRule, priceSnapshotFor } from "../js/price-rule-core.js";
import { preparePriceCompletion, priceCompletionDefaults } from "../js/price-completion-db.js";

const work = (id, patch = {}) => ({ id, customer_id: "C", vehicle_id: "V", date: "2026-10-01", work_type: "JCB Çalışması", quantity: 2, unit: "Saat", updated_at: "2026-10-01T00:00:00Z", description: "Korunacak iş açıklaması", review_notes: "Korunacak iç not", ...patch });
const data = () => ({ customers: [{ id: "C", name: "Sentetik Müşteri" }], vehicles: [{ id: "V", type: "JCB" }], work_records: [work("W1"), work("W2", { quantity: 1 })], price_book: [], hakedis: [], audit_log: [] });
const rule = patch => ({ id: "P", customer_id: "C", site_id: null, vehicle_id: null, work_type: "JCB Çalışması", unit: "Saat", price: 1000, kdv_rate: 20, kdv_included: true, active: true, ...patch });
function command(d, patch = {}) {
  const group = unpricedGroups(d, "C")[0];
  return { customer_id: "C", group_key: group?.key || "JCB Çalışması|Saat", price: "1200", kdv_rate: "20", kdv_included: true, save_rule: true, expected_works: structuredClone(d.work_records), expected_rule: structuredClone(d.price_book.length === 1 ? d.price_book[0] : null), ...patch };
}
const rejects = (d, c, message) => assert.throws(() => preparePriceCompletion(d, c), message);

// Present bug's counterexample: one confirmation must retain the same included
// basis on existing jobs and on the future rule, rather than forcing jobs to +20%.
for (const rate of [0, 10, 20]) for (const included of [false, true]) {
  const d = data(); d.price_book.push(rule({ kdv_rate: rate, kdv_included: included }));
  const before = JSON.stringify(d), c = command(d, { kdv_rate: rate, kdv_included: included });
  const defaults = priceCompletionDefaults(d, "C", unpricedGroups(d, "C")[0]);
  assert.equal(defaults.kdv_rate, rate); assert.equal(defaults.kdv_included, included);
  const plan = preparePriceCompletion(d, c);
  assert.equal(plan.count, 2); assert.equal(plan.amount, 3600);
  assert.equal(plan.rule.kdv_rate, rate); assert.equal(plan.rule.kdv_included, included);
  for (const snapshot of plan.snapshots) { assert.equal(snapshot.kdv_rate, rate); assert.equal(snapshot.kdv_included, included); }
  assert.equal(JSON.stringify(d), before, "Preflight never mutates input records");
}
for (const value of [undefined, null, "", " ", true, false, [], {}, NaN, Infinity, -1]) rejects(data(), command(data(), { price: value }));
for (const value of [undefined, null, "", " ", true, [], NaN, Infinity, -1, 101]) rejects(data(), command(data(), { kdv_rate: value }));
for (const value of [undefined, null, "", "0", 0, "false"]) rejects(data(), command(data(), { kdv_included: value }));
assert.equal(preparePriceCompletion(data(), command(data(), { price: "0", kdv_rate: "0", kdv_included: false })).amount, 0, "Explicit zero is valid, unlike blank");
for (const quantity of [3, 1.5, 0.25]) {
  const d = data(); d.work_records = [work("W1", { quantity })];
  const plan = preparePriceCompletion(d, command(d, { price: 12.345, kdv_rate: 20, kdv_included: false }));
  assert.equal(plan.snapshots[0].amount, core.priceForQuantity({ price: 12.345 }, quantity), "Bulk snapshots use the existing unit-kuruş-first rounding");
  const claim = core.calcHakedisTotals([{ unit_price: 12.345, quantity, kdv_rate: 20, kdv_included: false }]);
  assert.equal(plan.snapshots[0].amount, claim.lines[0].amount);
  assert.equal(plan.amount, claim.subtotal, "Confirmation total uses the same existing per-line kuruş aggregation");
}
{
  const d = data(); d.work_records = [work("W1", { work_type: "Diğer" })];
  d.price_book.push(rule({ work_type: null }));
  const c = command(d, { expected_rule: null }), plan = preparePriceCompletion(d, c);
  assert.equal(plan.rule.work_type, "Diğer"); assert.equal(plan.existing_rule, null, "An unrelated wildcard future rule is not overwritten");
  const missing = data(); missing.work_records[0].work_type = "";
  rejects(missing, command(missing, { expected_works: [missing.work_records[0]] }), /İş türü eksik/);
}
rejects(data(), command(data(), { expected_works: [] }));
rejects(data(), command(data(), { expected_works: [work("W1"), work("W1")] }));

for (const mutate of [
  d => { d.work_records[0].deleted_at = "x"; },
  d => { d.work_records[0].customer_id = "OTHER"; },
  d => { d.work_records[0].unit = "Sefer"; },
  d => { d.work_records[0].work_type = "Kazı"; },
  d => { d.work_records[0].quantity = 3; },
  d => { d.work_records[0].description = "Başka ekranda değişti"; },
  d => { d.work_records[0].price_snapshot = { amount: 0, unit_price: 0 }; },
  d => { d.work_records[0].price_snapshot = { locked: true }; },
  d => { d.work_records.splice(0, 1); },
  d => { d.customers[0].deleted_at = "x"; },
  d => { d.customers[0].internal = true; },
]) { const d = data(), c = command(d); mutate(d); rejects(d, c); }
for (const status of ["Taslak", "Kesinleşti"]) {
  const d = data(), c = command(d); d.hakedis.push({ id: "H", status, items: [{ work_record_id: "W1" }] });
  rejects(d, c, /hakedişe bağlı/);
}
{
  const d = data(), c = command(d); d.hakedis.push({ id: "H", status: "İptal", items: [{ work_record_id: "W1" }] });
  assert.equal(preparePriceCompletion(d, c).count, 2);
}
for (const bad of [0, -1, null, "", true, Infinity]) {
  const d = data(); d.work_records[1].quantity = bad; rejects(d, command(d));
}
{
  const d = data(), c = command(d); d.price_book.push(rule({})); rejects(d, c, /değişti/);
}
{
  const d = data(); d.price_book.push(rule({})); const c = command(d); d.price_book[0].kdv_rate = 0; rejects(d, c, /değişti/);
}
{
  const d = data(); d.price_book.push(rule({}), rule({ id: "P2", kdv_rate: 0 }));
  assert.equal(priceCompletionDefaults(d, "C", unpricedGroups(d, "C")[0]).ambiguous, true);
  assert.equal(priceCompletionDefaults(d, "C", unpricedGroups(d, "C")[0]).kdv_rate, null);
  rejects(d, command(d), /birden çok/);
  assert.equal(preparePriceCompletion(d, command(d, { save_rule: false })).count, 2, "Explicit jobs-only completion need not choose a future rule");
}
for (const useSnapshot of [false, true]) {
  const d = data();
  if (useSnapshot) d.work_records[0].price_snapshot = { formula: "CRANE_FIRST_HOUR", unit_price: null };
  else d.price_book.push(rule({ formula: "CRANE_FIRST_HOUR", first_hour_price: 3000, next_hour_price: 1000 }));
  rejects(d, command(d, { save_rule: false }), /formüllü/);
}
for (const dates of [{ valid_from: "2027-01-01" }, { valid_to: "2026-01-01" }, { valid_from: "2026-01-01", valid_to: "2026-12-31" }]) {
  const d = data(); d.price_book.push(rule(dates));
  assert.equal(priceCompletionDefaults(d, "C", unpricedGroups(d, "C")[0]).bounded, true);
  rejects(d, command(d), /tarih sınırlı/);
  assert.equal(preparePriceCompletion(d, command(d, { save_rule: false })).count, 2, "Explicit jobs-only action does not broaden a dated rule");
}

// Execute the actual transactional module in a deterministic atomic test harness.
// Real IndexedDB rollback and concurrent-tab behavior are separately covered in CI.
const source = readFileSync(new URL("../js/price-completion-db.js", import.meta.url), "utf8").replace(/^import .*;\n/gm, "").replace(/export /g, "");
function atomicFixture(initial, failAfter = Infinity) {
  let saved = structuredClone(initial), writeCount = 0, storesSeen;
  const transaction = async (stores, fn) => {
    storesSeen = stores; const next = structuredClone(saved);
    const write = (store, record) => {
      writeCount++; if (writeCount === failAfter) throw Error("Synthetic write failure");
      const at = next[store].findIndex(r => r.id === record.id);
      if (at < 0) next[store].push(structuredClone(record)); else next[store][at] = structuredClone(record);
      next.audit_log.push({ entity: store, id: record.id });
    };
    const result = fn(next, { add: write, put: write });
    saved = next; return result;
  };
  const mod = runInNewContext(source + "; ({completeCustomerPrices});", { ...core, hakedisNumber, unpricedGroups, sameRule, priceSnapshotFor, transaction, structuredClone });
  return { run: mod.completeCustomerPrices, get saved() { return saved; }, get writes() { return writeCount; }, get stores() { return storesSeen; } };
}
{
  const d = data(); d.price_book.push(rule({ updated_at: "2099-01-01T00:00:00Z" }));
  const c = command(d, { kdv_rate: 0, kdv_included: false }), f = atomicFixture(d);
  const result = await f.run(c);
  assert.equal(result.count, 2); assert.equal(result.rule_id, "P"); assert.equal(f.saved.audit_log.length, 3);
  assert.ok(f.stores.includes("hakedis") && f.stores.includes("customers") && f.stores.includes("vehicles"));
  assert.equal(f.saved.price_book[0].kdv_rate, 0); assert.equal(f.saved.price_book[0].kdv_included, false);
  assert.equal(f.saved.price_book[0].price_history.length, 1);
  assert.equal(f.saved.price_book[0].price_history[0].price, 1000);
  assert.equal(f.saved.price_book[0].price_history[0].kdv_rate, 20);
  assert.equal(f.saved.price_book[0].price_history[0].kdv_included, true);
  assert.ok(Date.parse(f.saved.price_book[0].updated_at) > Date.parse(d.price_book[0].updated_at), "Monotonic conflict timestamp");
  for (const w of f.saved.work_records) { assert.equal(w.price_snapshot.kdv_rate, 0); assert.equal(w.price_snapshot.kdv_included, false); assert.equal(w.review_notes, "Korunacak iç not"); assert.equal(w.description, "Korunacak iş açıklaması"); }
  const after = JSON.stringify(f.saved); await assert.rejects(f.run(c)); assert.equal(JSON.stringify(f.saved), after, "Repeated request never duplicates price rules/audits");
}
{
  const d = data(), c = command(d), f = atomicFixture(d, 2);
  await assert.rejects(f.run(c), /Synthetic write failure/);
  assert.deepEqual(f.saved, d, "A later write failure rolls back earlier rule/work/audit writes");
}
{
  const d = data(), c = command(d); d.work_records[1].quantity = 3; const f = atomicFixture(d);
  await assert.rejects(f.run(c)); assert.equal(f.writes, 0); assert.deepEqual(f.saved, d);
}
{
  const d = data(), f = atomicFixture(d); const r = await f.run(command(d, { save_rule: false, price: 0, kdv_rate: 0, kdv_included: false }));
  assert.equal(r.count, 2); assert.equal(r.rule_id, null); assert.equal(f.saved.price_book.length, 0); assert.equal(f.saved.audit_log.length, 2);
  assert.ok(f.saved.work_records.every(w => w.price_snapshot.amount === 0));
}
{
  const d = data(), history = Array.from({ length: 50 }, (_, i) => ({ price: i, until: "2026-01-01", reason: "Korunacak geçmiş" }));
  d.price_book.push(rule({ price_history: history })); const f = atomicFixture(d);
  await f.run(command(d)); assert.equal(f.saved.price_book[0].price_history.length, 50);
  assert.deepEqual(f.saved.price_book[0].price_history.slice(0, 49), history.slice(1));
  assert.equal(f.saved.price_book[0].price_history.at(-1).price, 1000);
  const unchanged = atomicFixture(d); await unchanged.run(command(d, { price: 1000 }));
  assert.deepEqual(unchanged.saved.price_book[0].price_history, history, "Same price and VAT do not append a spurious history item");
}
console.log("price completion PASS: VAT consistency, explicit zero, original scope, staleness, draft/final locks, crane safety and atomic plans");

// Actual event-handler control flow, with a minimal DOM fixture (browser/IDB CI
// separately verifies the rendered controls and real transaction behavior).
const financeSource = readFileSync(new URL("../js/m-finance.js", import.meta.url), "utf8");
const handlers = financeSource.slice(financeSource.indexOf("  let priceCompleting = false;"), financeSource.indexOf("  const stPeriod ="));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function uiFixture(patch = {}) {
  const d = data(), original = structuredClone(d), group = unpricedGroups(d, "C")[0], confirm = deferred();
  let click, confirms = 0, saves = 0, reloads = 0;
  const controls = {
    price: { value: "1200", disabled: false }, vat: { value: "20", disabled: false }, basis: { value: "1", disabled: false }, save: { checked: true, disabled: false },
    button: { dataset: { gapply: "0" }, disabled: false, isConnected: true, addEventListener(_event, fn) { click = fn; } },
    error: { hidden: true, textContent: "" },
  };
  if ("price" in patch) controls.price.value = patch.price;
  const root = { isConnected: true, querySelectorAll: selector => selector === "[data-gapply]" ? [controls.button] : [controls.price, controls.vat, controls.basis, controls.save, controls.button] };
  const selectors = { '[data-gp="0"]': controls.price, '[data-gvat="0"]': controls.vat, '[data-ginc="0"]': controls.basis, '[data-gsave]': controls.save, '[data-gerror="0"]': controls.error };
  runInNewContext(handlers, {
    root, groups: [group], completionDefaults: [priceCompletionDefaults(d, "C", group)], cid: "C", dAll: original,
    structuredClone, qs: selector => selectors[selector], preparePriceCompletion,
    fmtTL: n => String(n), confirmDialog: () => { confirms++; return confirm.promise; },
    completeCustomerPrices: async command => { preparePriceCompletion(d, command); saves++; return { count: 2 }; },
    toast() {}, ctx: { reload() { reloads++; } },
  });
  return { d, root, controls, confirm, run: () => click(), get confirms() { return confirms; }, get saves() { return saves; }, get reloads() { return reloads; } };
}
{
  const f = uiFixture({ price: "" }); await f.run();
  assert.equal(f.confirms, 0); assert.equal(f.saves, 0); assert.match(f.controls.error.textContent, /Birim fiyatı/); assert.equal(f.controls.button.disabled, false);
}
{
  const f = uiFixture({ price: "0" }), pending = f.run(); await f.run();
  assert.equal(f.confirms, 1); assert.equal(f.controls.button.disabled, true); assert.equal(f.controls.vat.disabled, true);
  f.confirm.resolve(false); await pending; assert.equal(f.saves, 0); assert.equal(f.reloads, 0); assert.equal(f.controls.button.disabled, false);
}
for (const target of ["root", "button"]) {
  const f = uiFixture(), pending = f.run();
  if (target === "root") f.root.isConnected = false; else f.controls.button.isConnected = false;
  f.confirm.resolve(true); await pending; assert.equal(f.saves, 0); assert.equal(f.reloads, 0);
}
{
  const f = uiFixture(), pending = f.run(); f.d.work_records[0].quantity = 9; f.confirm.resolve(true); await pending;
  assert.equal(f.saves, 0); assert.equal(f.reloads, 0); assert.match(f.controls.error.textContent, /değişti/); assert.equal(f.controls.button.disabled, false);
}
{
  const f = uiFixture(), pending = f.run(); f.confirm.resolve(true); await pending;
  assert.equal(f.saves, 1); assert.equal(f.reloads, 1);
}
console.log("price completion UI-handler PASS: blank/zero, cancel, single-flight, detached confirmation and stale atomic rejection");

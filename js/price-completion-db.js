// Cari'deki eksik fiyatlar: tek onay, tek KDV temeli, atomik iş + isteğe bağlı fiyat kuralı.
import { isActive, newRecord, stableStringify, rankPrices, priceForQuantity, toKurus, fromKurus, WORK_UNITS } from "./core.js";
import { hakedisNumber } from "./hakedis-validation.js";
import { unpricedGroups } from "./collect-core.js";
import { sameRule, priceSnapshotFor } from "./price-rule-core.js";
import { transaction } from "./enterprise-db.js";

const fail = message => { throw Object.assign(new Error(message), { code: "PRICE_COMPLETION_INVALID" }); };
const stale = () => fail("İşler veya fiyat kuralı bu ekran açıldıktan sonra değişti. Hiçbir fiyat yazılmadı; sayfayı yenileyip yeniden kontrol edin.");
const equal = (a, b) => stableStringify(a) === stableStringify(b);
const touched = record => ({ ...record, updated_at: new Date(Math.max(Date.now(), (Date.parse(record.updated_at) || 0) + 1)).toISOString() });
// Preserve the same visible tariff history contract as db.saveExisting(price_book).
function changedRule(existing, rule) {
  const fields = { price: rule.price, kdv_rate: rule.kdv_rate, kdv_included: rule.kdv_included };
  if (Object.keys(fields).some(key => String(fields[key] ?? "") !== String(existing[key] ?? ""))) {
    const keys = ["price", "kdv_rate", "kdv_included", "valid_from", "valid_to", "first_hour_price", "next_hour_price", "formula"];
    const previous = Object.fromEntries(keys.map(key => [key, existing[key] ?? null]));
    fields.price_history = [...(existing.price_history || []), { ...previous, until: new Date().toISOString(), reason: "Cari: eksik fiyat tamamlama" }].slice(-50);
  }
  return touched({ ...existing, ...fields });
}
const scopeRule = (customerId, group) => ({ customer_id: customerId, site_id: null, work_type: group.work_type, vehicle_id: null, unit: group.unit });
const matchingRules = (d, rule) => (d.price_book || []).filter(row => sameRule({ price_book: [row] }, rule));
// Match ordinary work-entry/validateFields rounding: round unit-price kuruş first,
// then multiply quantity. A grouped completion must not invent a new money policy.
const completedSnapshot = (rule, work, ruleId) => ({ ...priceSnapshotFor(rule, work, ruleId), amount: priceForQuantity(rule, work.quantity) });

// Ekranda yalnız tek, belirgin mevcut kural varsayılan olur. %0 aynen korunur.
export function priceCompletionDefaults(d, customerId, group) {
  const rules = matchingRules(d, scopeRule(customerId, group));
  const rule = rules.length === 1 ? rules[0] : null;
  return {
    expected_rule: rule ? structuredClone(rule) : null,
    ambiguous: rules.length > 1,
    bounded: !!(rule?.valid_from || rule?.valid_to),
    kdv_rate: rules.length > 1 ? null : rule ? hakedisNumber(rule.kdv_rate) : 20,
    kdv_included: rules.length > 1 ? null : rule && typeof rule.kdv_included !== "boolean" ? null : rule?.kdv_included ?? false,
  };
}

// Saf ön denetim. Dönen plan henüz hiçbir kayıt yazmaz; transaction içinde tekrar çalışır.
export function preparePriceCompletion(d, command) {
  if (!command || typeof command.customer_id !== "string" || !command.customer_id) fail("Müşteri seçin.");
  const customer = (d.customers || []).find(c => c.id === command.customer_id && isActive(c) && !c.internal);
  if (!customer) fail("Aktif müşteri bulunamadı; hiçbir fiyat yazılmadı.");
  const price = hakedisNumber(command.price), rate = hakedisNumber(command.kdv_rate);
  if (price == null || price < 0) fail("Birim fiyatı yazın (bedelsiz iş için açıkça 0 girin).");
  if (rate == null || rate < 0 || rate > 100) fail("KDV oranını 0–100 arasında yazın; KDV'siz fiyat için 0 girin.");
  if (typeof command.kdv_included !== "boolean") fail("Fiyatın KDV dahil / hariç olduğunu seçin.");
  if (typeof command.save_rule !== "boolean") fail("Fiyat listesine kayıt seçimini kontrol edin.");
  const expected = command.expected_works;
  if (!Array.isArray(expected) || !expected.length || expected.some(w => !w || typeof w.id !== "string" || !w.id) || new Set(expected.map(w => w.id)).size !== expected.length) fail("Fiyatı tamamlanacak işleri yeniden seçin.");
  const ids = new Set(expected.map(w => w.id));
  if ((d.hakedis || []).some(h => isActive(h) && h.status !== "İptal" && (h.items || []).some(item => ids.has(item.work_record_id)))) fail("Seçili iş bir hakedişe bağlı. Hakedişi kontrol edin; hiçbir fiyat yazılmadı.");
  const group = unpricedGroups(d, command.customer_id).find(g => g.key === command.group_key);
  if (!group) stale();
  if (!WORK_UNITS.includes(group.unit)) fail("İşin birimi geçersiz; iş kartından düzeltin.");
  const current = expected.map(old => (d.work_records || []).find(w => w.id === old.id));
  if (current.some((w, i) => !w || !isActive(w) || !equal(w, expected[i]) || !group.works.some(row => row.id === w.id))) stale();
  for (const w of current) {
    if (!w.work_type || w.work_type !== group.work_type) fail("İş türü eksik veya değişmiş; iş kartından düzeltin. Genel fiyat kuralı oluşturulmadı.");
    const quantity = hakedisNumber(w.quantity);
    if (quantity == null || quantity <= 0 || !Number.isSafeInteger(Math.round(price * quantity * 100)) || !Number.isSafeInteger(Math.round(price * quantity * (1 + rate / 100) * 100))) fail("İş miktarı veya hesaplanan tutar geçersiz; hiçbir fiyat yazılmadı.");
    const vehicle = (d.vehicles || []).find(v => v.id === w.vehicle_id);
    const ctx = { ...w, vehicle_type: vehicle?.type || w.vehicle_type };
    if (w.price_snapshot?.formula || rankPrices(d.price_book || [], ctx).some(candidate => candidate.e.formula)) fail("Vinç / formüllü fiyat bu toplu ekranda tek birim fiyata çevrilemez. İş kartından tarifeyi tamamlayın; hiçbir fiyat yazılmadı.");
  }
  const rule = { ...scopeRule(command.customer_id, group), price, kdv_rate: rate, kdv_included: command.kdv_included };
  let existing = null;
  if (command.save_rule) {
    const matches = matchingRules(d, rule);
    if (matches.length > 1) fail("Aynı kapsamda birden çok fiyat kuralı var. Fiyat listesini kontrol edin veya 'Fiyat listesine de kaydet' seçimini kapatın.");
    existing = matches[0] || null;
    if (!equal(existing, command.expected_rule ?? null)) stale();
    if (existing?.valid_from || existing?.valid_to) fail("Mevcut fiyat kuralı tarih sınırlı. Tarih kapsamını fiyat listesinde düzenleyin veya 'Fiyat listesine de kaydet' seçimini kapatıp yalnız bu işleri tamamlayın. Hiçbir fiyat yazılmadı.");
  }
  const snapshots = current.map(w => completedSnapshot(rule, w, existing?.id || null));
  const amount = fromKurus(snapshots.reduce((sum, snapshot) => sum + toKurus(snapshot.amount), 0));
  if (!Number.isSafeInteger(Math.round(amount * 100))) fail("Toplam tutar geçersiz; hiçbir fiyat yazılmadı.");
  return { customer, works: current, rule, existing_rule: existing, snapshots, amount, count: current.length };
}

// enterprise-db.transaction's synchronous callback validates everything before the first write.
// Its IDB transaction includes audit_log; any validation/write failure rolls back the whole action.
export async function completeCustomerPrices(command) {
  const input = structuredClone(command);
  return transaction(["work_records", "price_book", "hakedis", "customers", "vehicles"], (d, t) => {
    const plan = preparePriceCompletion(d, input);
    let ruleId = null;
    if (input.save_rule) {
      const record = plan.existing_rule
        ? changedRule(plan.existing_rule, plan.rule)
        : newRecord({ ...plan.rule, active: true, valid_from: null, note: "Cari ekranından" });
      ruleId = record.id;
      if (plan.existing_rule) t.put("price_book", record); else t.add("price_book", record);
    }
    for (const w of plan.works) t.put("work_records", touched({ ...w, price_snapshot: completedSnapshot(plan.rule, w, ruleId) }));
    return { count: plan.count, amount: plan.amount, rule_id: ruleId };
  });
}

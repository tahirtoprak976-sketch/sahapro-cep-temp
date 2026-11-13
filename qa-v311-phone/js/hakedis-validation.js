import {calcHakedisTotals, priceForQuantity, toKurus, isActive} from './core.js';

// Completeness checks only: calculation/rounding and historical numeric zero stay unchanged.
// A saved legacy zero cannot reveal whether the original input was blank; never guess.
export function hakedisNumber(value) {
  if (value == null || !['number', 'string'].includes(typeof value) ||
      (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function hakedisItemIssues(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return ['İş kalemi geçersiz.'];
  const issues = [], quantity = hakedisNumber(item.quantity);
  if (quantity == null || quantity <= 0) issues.push('Miktar 0’dan büyük olmalı; kaynak iş kaydını düzeltin.');
  if (item.formula === 'CRANE_FIRST_HOUR') {
    const first = hakedisNumber(item.first_hour_price), next = hakedisNumber(item.next_hour_price);
    if (first == null || first < 0) issues.push('Vinç ilk saat tarifesi eksik veya geçersiz; fiyat kuralını / vinç ayarını tamamlayın.');
    if (quantity > 1 && (next == null || next < 0)) issues.push('Bir saati aşan vinç işi için sonraki saat tarifesini tamamlayın.');
  } else {
    const price = hakedisNumber(item.unit_price);
    if (price == null || price < 0) issues.push('Birim fiyatı girin (0 geçerlidir). Fiyat bilinmiyorsa bu işin seçimini kaldırın.');
  }
  const rate = hakedisNumber(item.kdv_rate);
  if (rate == null || rate < 0 || rate > 100) issues.push('KDV oranı 0–100 arasında olmalı; fiyat bilgisini düzeltin.');
  // An absent legacy flag means VAT excluded, as in the existing calculator.
  if (item.kdv_included != null && typeof item.kdv_included !== 'boolean') issues.push('KDV dahil / hariç bilgisi geçersiz.');
  return issues;
}

export function assertHakedisItems(items) {
  if (!Array.isArray(items) || !items.length) throw Object.assign(new Error('İş seçin'), {code: 'HAKEDIS_INCOMPLETE'});
  for (const [index, item] of items.entries()) {
    const issues = hakedisItemIssues(item);
    if (issues.length) throw Object.assign(new Error(`${index + 1}. kalem: ${issues.join(' ')}`), {code: 'HAKEDIS_INCOMPLETE', index});
  }
}


const claimError = (message, code) => Object.assign(new Error(message), {code});
const validClaimDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const sameMoney = (a, b) => {
  const left = hakedisNumber(a), right = hakedisNumber(b);
  return left != null && right != null && left >= 0 && right >= 0 &&
    Number.isSafeInteger(toKurus(left)) && Number.isSafeInteger(toKurus(right)) && left === right;
};

// A frozen claim is not a request to recompute or repair historical charges.
// Validate its existing canonical amounts; any discrepancy requires a new draft.
export function assertHakedisDocument(claim) {
  assertHakedisItems(claim?.items); // Preserve the incomplete-price error, including legacy drafts.
  if (!claim || claim.deleted_at || claim.status !== 'Taslak' || !claim.customer_id ||
      !validClaimDate(claim.date_from) || !validClaimDate(claim.date_to) || !validClaimDate(claim.created_date) ||
      claim.date_from > claim.date_to)
    throw claimError('Hakediş aktif taslak olmalı; müşteri ve tarihleri kontrol edip yeniden oluşturun.', 'HAKEDIS_SOURCE');
  const totals = calcHakedisTotals(claim.items);
  if (!sameMoney(claim.subtotal, totals.subtotal) || !sameMoney(claim.kdv_total, totals.kdv) || !sameMoney(claim.grand_total, totals.grand) ||
      claim.items.some((item, index) => ['amount', 'kdv', 'total'].some(key => !sameMoney(item[key], totals.lines[index][key]))))
    throw claimError('Hakediş kalemleri ile kayıtlı net / KDV / toplam uyuşmuyor. Taslağı iptal edip yeniden oluşturun; tutarlar otomatik değiştirilmedi.', 'HAKEDIS_TOTAL');
  return totals;
}

// Creation can capture missing non-monetary source metadata, but never replace
// an explicitly supplied value or any quantity, price, tax or stored total.
export function captureHakedisSources(items, works) {
  return items.map(item => {
    const work = works.find(row => row.id === item.work_record_id);
    if (!work) return {...item};
    return {date:work.date, customer_id:work.customer_id, site_id:work.site_id || null,
      vehicle_id:work.vehicle_id || null, work_type:work.work_type || '', material:work.material || '',
      source_price_snapshot:structuredClone(work.price_snapshot ?? null), ...item};
  });
}

export function assertHakedisSources(claim, data) {
  const fail = () => {throw claimError('Hakedişin kaynak işi, müşterisi veya şantiyesi değişmiş / silinmiş ya da başka hakedişe bağlı. Taslağı iptal edip güncel işlerden yeniden oluşturun; hiçbir mali kayıt yazılmadı.', 'HAKEDIS_SOURCE');};
  const customer = (data.customers || []).find(row => row.id === claim.customer_id);
  if (!customer || !isActive(customer)) fail();
  const ids = new Set();
  for (const item of claim.items) {
    const work = (data.work_records || []).find(row => row.id === item.work_record_id);
    if (!item.work_record_id || ids.has(item.work_record_id) || !work || !isActive(work) || work.price_snapshot?.locked ||
        work.customer_id !== claim.customer_id || item.customer_id !== work.customer_id ||
        !validClaimDate(item.date) || item.date !== work.date || work.date < claim.date_from || work.date > claim.date_to ||
        !item.unit || item.unit !== work.unit || hakedisNumber(item.quantity) !== hakedisNumber(work.quantity) ||
        (claim.site_id && work.site_id !== claim.site_id) || (item.site_id || null) !== (work.site_id || null) ||
        ['vehicle_id', 'work_type', 'material'].some(key => key in item && (item[key] || null) !== (work[key] || null))) fail();
    // New drafts prove which source price was reviewed, separately from any
    // deliberate manual claim price. Legacy drafts retain explicit frozen-price
    // semantics; the detail UI warns that their source-price history is unproven.
    if (Object.hasOwn(item, 'source_price_snapshot') &&
        JSON.stringify(item.source_price_snapshot ?? null) !== JSON.stringify(work.price_snapshot ?? null)) fail();
    if (work.site_id) {
      const site = (data.sites || []).find(row => row.id === work.site_id);
      if (!site || !isActive(site) || site.customer_id !== claim.customer_id) fail();
    }
    if ((data.hakedis || []).some(other => other.id !== claim.id && isActive(other) && other.status !== 'İptal' &&
        (other.items || []).some(line => line.work_record_id === work.id))) fail();
    ids.add(item.work_record_id);
  }
}

// Claim lines keep net amount; work snapshots keep the original tariff basis.
// In particular, do not use line.total for included prices: canonical claim
// rounding can intentionally differ from the original tariff by one kuruş.
export function hakedisWorkSnapshot(item) {
  const amount = priceForQuantity({...item, price:item.unit_price}, item.quantity,
    {first:item.first_hour_price, next:item.next_hour_price});
  if (!sameMoney(amount, amount)) throw claimError('İş fiyatı hesaplanamadı; hakediş yazılmadı.', 'HAKEDIS_TOTAL');
  return {...item, amount, price_source:item.price_source || 'Snapshot', locked:true};
}

// Review only: a claim's manual tariff may legitimately differ from the work's
// tariff. Report that difference; never call it corruption or refresh prices.
export function hakedisSourcePriceReview(claim, works = []) {
  let legacyCount = 0, sourceChangedCount = 0, priceDifferenceCount = 0;
  for (const item of claim?.items || []) {
    const work = works.find(row => row.id === item.work_record_id);
    const proven = Object.hasOwn(item, 'source_price_snapshot');
    if (!proven) legacyCount++;
    if (proven && JSON.stringify(item.source_price_snapshot ?? null) !== JSON.stringify(work?.price_snapshot ?? null)) sourceChangedCount++;
    const price = work?.price_snapshot;
    const formula = item.formula || null;
    const keys = formula === 'CRANE_FIRST_HOUR' ? ['first_hour_price', ...(Number(item.quantity) > 1 ? ['next_hour_price'] : [])] : ['unit_price'];
    if (!price || (price.formula || null) !== formula ||
        hakedisNumber(price.kdv_rate) !== hakedisNumber(item.kdv_rate) || (price.kdv_included ?? false) !== (item.kdv_included ?? false) ||
        keys.some(key => hakedisNumber(price[key]) !== hakedisNumber(item[key]))) priceDifferenceCount++;
  }
  return {legacyCount, sourceChangedCount, priceDifferenceCount};
}

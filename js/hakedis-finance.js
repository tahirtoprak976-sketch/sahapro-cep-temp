// Read-only bridge between a work tariff (input basis) and a frozen claim charge.
// Never infer a tax basis from `locked` alone and never rewrite historical rows.
import { isActive, priceForQuantity, calcHakedisTotals } from './core.js';
import { hakedisNumber, hakedisItemIssues } from './hakedis-validation.js';

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const money = value => { const n = hakedisNumber(value); return n != null && n >= 0 && Number.isSafeInteger(Math.round(n * 100)) ? n : null; };
const amountEqual = (a, b) => money(a) != null && money(b) != null && Number(a) === Number(b);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10) === value;
export const CLAIM_REVIEW = 'Hakediş kaynağı ile iş kaydı uyuşmuyor. Hakedişi ve kaynak işi kontrol edin; eski kayıtlar otomatik değiştirilmedi.';

export function claimWorkResolution(data, work) {
  const snapshot = work?.price_snapshot;
  const matches = (data?.hakedis || []).filter(h => isActive(h) && h.active !== false && h.status === 'Kesinleşti')
    .flatMap(claim => (claim.items || []).filter(item => item.work_record_id === work?.id).map(item => ({claim, item})));
  const unresolved = () => ({ work, claim: null, issue: CLAIM_REVIEW, recovered: false });
  if (!matches.length) {
    // Ordinary imported settlements and unclaimed legacy prices are not claims.
    return snapshot?.locked ? unresolved() : { work, claim: null, issue: null, recovered: false };
  }
  if (matches.length !== 1 || !isActive(work) || !snapshot?.locked || snapshot.work_record_id !== work.id) return unresolved();
  const {claim, item} = matches[0];
  if (claim.customer_id !== work.customer_id || (item.customer_id && item.customer_id !== work.customer_id) ||
      (claim.site_id && claim.site_id !== work.site_id) ||
      hakedisNumber(item.quantity) == null || hakedisNumber(item.quantity) !== hakedisNumber(work.quantity) || item.unit !== work.unit ||
      (item.date && item.date !== work.date) || !validDate(work.date) || !validDate(claim.date_from) || !validDate(claim.date_to) || work.date < claim.date_from || work.date > claim.date_to ||
      ['site_id', 'work_type', 'material'].some(k => k in item && !same(item[k] || null, work[k] || null))) return unresolved();
  if ((claim.items || []).some(line => hakedisItemIssues(line).length)) return unresolved();
  const computed = calcHakedisTotals(claim.items);
  if (!amountEqual(claim.subtotal, computed.subtotal) || !amountEqual(claim.kdv_total, computed.kdv) || !amountEqual(claim.grand_total, computed.grand) ||
      claim.items.some((line, index) => ['amount', 'kdv', 'total'].some(k => !amountEqual(line[k], computed.lines[index][k])))) return unresolved();
  const copied = ['work_record_id', 'quantity', 'unit', 'unit_price', 'kdv_rate', 'kdv_included', 'formula', 'first_hour_price', 'next_hour_price', 'kdv', 'total'];
  if (copied.some(k => !same(snapshot[k], item[k]))) return unresolved();
  const inputAmount = priceForQuantity({...item, price: item.unit_price}, item.quantity,
    {first: item.first_hour_price, next: item.next_hour_price});
  if (money(inputAmount) == null || (!amountEqual(snapshot.amount, item.amount) && !amountEqual(snapshot.amount, inputAmount))) return unresolved();
  const recovered = !amountEqual(snapshot.amount, inputAmount);
  return {
    work: recovered ? {...work, price_snapshot: {...snapshot, amount: inputAmount}} : work,
    claim: {id: claim.id, number: claim.hakedis_no, net: Number(item.amount), tax: Number(item.kdv), gross: Number(item.total), rate: Number(item.kdv_rate)},
    issue: null, recovered,
  };
}

export function workForFinancialRead(data, work) {
  return data ? claimWorkResolution(data, work).work : work;
}

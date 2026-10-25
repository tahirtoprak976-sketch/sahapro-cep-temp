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

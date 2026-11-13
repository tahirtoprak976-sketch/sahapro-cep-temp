// Read-only meaning of an entered weight. Never infer a slip's scope from a mutable vehicle card.
const positive = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
export const TONNAGE_SCOPE_UNKNOWN = 'Tonajın tek sefer mi toplam mı olduğu doğrulanmadı';
export function resolveWorkTonnage(work = {}) {
  const trips = work.unit === 'Sefer' ? positive(work.quantity) : 1;
  const entered = positive(work.tonnage);
  const scope = work.tonnage_scope || 'unknown';
  if (entered != null) {
    if (work.unit === 'Sefer' && (trips == null || (trips > 1 && !['total', 'per_trip'].includes(scope))))
      return {totalTon:null, perTripTon:null, trips, enteredTon:entered, scope, known:false, uncertain:true, measuredTrips:0, reason:TONNAGE_SCOPE_UNKNOWN};
    const totalTon = scope === 'per_trip' && work.unit === 'Sefer' ? entered * trips : entered;
    return {totalTon, perTripTon:totalTon / trips, trips, enteredTon:entered, scope, known:true, uncertain:false,
      measuredTrips:scope === 'per_trip' ? Math.min(1, trips) : trips, reason:null};
  }
  const totalTon = work.unit === 'Ton' ? positive(work.quantity) : null;
  return {totalTon, perTripTon:totalTon, trips, enteredTon:null, scope, known:totalTon != null, uncertain:false, measuredTrips:totalTon == null ? 0 : 1, reason:null};
}

// Preserve the entered number in record displays, while making its scope explicit.
// This is a label only; totals continue to use resolveWorkTonnage.
export function enteredTonnageText(work = {}) {
  const weight = resolveWorkTonnage(work);
  if (weight.enteredTon == null) return '';
  const entered = weight.enteredTon.toLocaleString('tr-TR', {maximumFractionDigits:2});
  if (weight.uncertain) return entered + ' ton — kapsam bilinmiyor';
  if (work.unit === 'Sefer' && weight.scope === 'per_trip') return entered + ' ton/sefer';
  if (weight.scope === 'total') return entered + ' ton toplam';
  return entered + ' ton';
}

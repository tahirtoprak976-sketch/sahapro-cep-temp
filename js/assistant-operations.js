// Asistan işlemleri: saf önizleme + mevcut DB doğrulama yolu. İlk işlem yalnız iş miktarını değiştirir.
import { priceForQuantity, calcHakedisLine } from './core.js';
const fail = (message, code = 'ACTION_BLOCKED') => { throw Object.assign(new Error(message), { code }); };
export function parseWorkQuantityChange(text) {
  const t = String(text || '').toLocaleLowerCase('tr-TR');
  if (/sil|iptal|ekle|art[ıi]r|azalt|daha|değil|yerine/.test(t) || /\p{Cf}/u.test(t)) return null;
  if (!/(?:yap|düzelt|duzelt|değiştir|degistir|güncelle|guncelle)[.!?]?\s*$/.test(t)) return null;
  const matches = [...t.matchAll(/(?<!\S)(\d+(?:[.,]\d+)?)\s*(saat|sa|sefer|yevmiye|ton|adet|m³)(?![\p{L}\p{N}])/gu)];
  if (matches.length !== 1) return null;
  const m = matches[0];
  // İşaret, kesir, aralık ve birden çok ayırıcıdaki son parçayı miktar sanma.
  if (/(?:\d|[\p{P}\p{S}]\s*)$/u.test(t.slice(0,m.index)) || /(?:^|\s)\d{1,3}\s+$/.test(t.slice(0,m.index)) || /^\d{1,3}\.\d{3}$/.test(m[1])) return null;
  const quantity = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1e12) return null;
  const unit = { saat:'Saat', sa:'Saat', sefer:'Sefer', yevmiye:'Yevmiye', ton:'Ton', adet:'Adet', 'm³':'m³' }[m[2]];
  return { type:'work.quantity', quantity, unit };
}
export function previewWorkQuantity(rec, request, d = {}) {
  if (!rec || rec.deleted_at) fail('İş kaydı bulunamadı.');
  if (request?.type !== 'work.quantity' || !Number.isFinite(request.quantity) || request.quantity <= 0 || request.quantity > 1e12) fail('Yeni miktar pozitif sayı olmalı.');
  if (!Number.isFinite(Number(rec.quantity)) || Number(rec.quantity) <= 0) fail('Mevcut miktar geçersiz; önce iş formundan kontrol edin.');
  if (rec.unit !== request.unit) fail('Bu işlem birimi değiştirmez. Farklı birim için iş formunu açın.');
  if (!rec.updated_at) fail('Kayıt sürümü doğrulanamıyor; iş formundan kontrol edin.');
  const linkedHakedis = (d.hakedis || []).some(h => !h.deleted_at && h.status !== 'İptal' && (h.items || []).some(x => x.work_record_id === rec.id));
  if (rec.price_snapshot?.locked || linkedHakedis) fail('Hakedişe bağlı iş bu komutla değiştirilemez; ilgili hakedişi inceleyin.');
  if (rec.slip_id || rec.work_batch_id || rec.digital_slip_no || rec.slip_signed_at || (d.slips || []).some(s => !s.deleted_at && (s.work_record_id === rec.id || s.work_id === rec.id))) fail('Fişe bağlı iş için revizyon/form yolunu kullanın.');
  if ((d.customers || []).some(c => c.id === rec.customer_id && ((c.fuel_rules || []).some(r => Number(r.per) > 0) || c.fuel_per_trip)) || rec.customer_fuel_allowance_l || rec.fuel_rule_id || rec.price_snapshot?.job_site_id || rec.job_extra != null || (d.sites || []).some(s => !s.deleted_at && s.customer_id === rec.customer_id && s.deal)) fail('Mazot/sözleşme hesabına bağlı işi bu ilk işlem paketi değiştirmez; iş formundan inceleyin.');
  const p = rec.price_snapshot;
  let afterPrice = null, beforeMoney = null, afterMoney = null;
  if (p) {
    if (p.kdv_rate == null || p.kdv_rate === '' || !Number.isFinite(Number(p.kdv_rate)) || Number(p.kdv_rate) < 0 || Number(p.kdv_rate) > 100 || typeof p.kdv_included !== 'boolean' || p.unit_price == null || !Number.isFinite(Number(p.unit_price)) || Number(p.unit_price) < 0) fail('Fiyat/KDV bilgisi eksik; önce iş formundan kontrol edin.');
    if (p.formula && p.formula !== 'CRANE_FIRST_HOUR') fail('Bu fiyat formülü henüz desteklenmiyor.');
    if (p.formula === 'CRANE_FIRST_HOUR' && [p.first_hour_price,p.next_hour_price].some(n => n == null || !Number.isFinite(Number(n)) || Number(n) < 0)) fail('Vinç tarife bilgisi eksik.');
    afterPrice = { ...p, amount:priceForQuantity({ ...p, price:p.unit_price }, request.quantity) };
    if (!Number.isFinite(afterPrice.amount) || Math.abs(afterPrice.amount) > 1e12) fail('Hesaplanan tutar geçersiz.');
    beforeMoney = calcHakedisLine({ ...p, quantity:rec.quantity });
    afterMoney = calcHakedisLine({ ...p, quantity:request.quantity });
  }
  return { type:'work.quantity', id:rec.id, record:structuredClone(rec), request:{ ...request }, before:rec.quantity, after:request.quantity, unit:rec.unit, beforeMoney, afterMoney,
    fields:{ quantity:request.quantity, ...(afterPrice ? { price_snapshot:afterPrice } : {}) }, noChange:Number(rec.quantity) === request.quantity };
}
export async function executeWorkQuantity(db, preview, confirmed = false) {
  if (confirmed !== true) fail('İşlem için açık onay gerekli.', 'CONFIRM_REQUIRED');
  if (!preview?.record || preview.type !== 'work.quantity') fail('Önizleme bulunamadı.');
  const fresh = await db.get('work_records', preview.id);
  if (!fresh || fresh.deleted_at || JSON.stringify(fresh) !== JSON.stringify(preview.record)) fail('Kayıt önizlemeden sonra değişti; yeniden önizleyin.', 'STALE');
  const checked = previewWorkQuantity(fresh, preview.request, await db.dumpAll());
  if (checked.noChange) return { status:'unchanged', record:fresh };
  const saved = await db.saveExisting('work_records', preview.record, checked.fields, 'Asistan: onaylı miktar düzeltmesi', 0, { strict:true });
  const stored = await db.get('work_records', preview.id);
  if (!stored || Number(stored.quantity) !== checked.after) fail('Kaydın sonucu doğrulanamadı; iş kaydını kontrol edin.','VERIFY_FAILED');
  return { status:'updated', record:saved };
}

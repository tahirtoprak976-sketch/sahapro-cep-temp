// İş Dosyası: yalnız gerçek kimlik ilişkileri. Benzer gün/araç ayrı genel bağlamdır.
import { isActive } from "./core.js";
import { dumpFee } from "./dump-fees.js";
import { costLedger } from "./enterprise-core.js";
import { recognizedBill, applyAllocations } from "./ledger-policy.js";
import { hasWorkPrice, missingCustomerWorkPrice } from "./collect-core.js";

const live = (d, s) => (d?.[s] || []).filter(isActive);
const gross = rows => rows.reduce((n, r) => n + (Number(r.gross ?? r.amount) || 0), 0);

export function workFileModel(d, id) {
  const work = live(d, "work_records").find(w => w.id === id);
  if (!work) throw Error("İş kaydı bulunamadı veya silinmiş");
  const customer = live(d, "customers").find(c => c.id === work.customer_id) || null;
  const parent = customer?.parent_customer_id ? live(d, "customers").find(c => c.id === customer.parent_customer_id) || null : null;
  const site = live(d, "sites").find(s => s.id === work.site_id) || null;
  const documents = live(d, 'documents').filter(doc => doc.status !== 'İptal' &&
    (doc.owner_type === 'work' && doc.owner_id === id && (!doc.work_record_id || doc.work_record_id === id) ||
     doc.work_record_id === id && (doc.owner_type !== 'work' || doc.owner_id === id)));
  const documentIds = new Set(documents.map(doc => doc.id));
  const attachments = [...new Map(live(d, 'attachments').filter(a =>
    a.record_type === 'work' && a.record_id === id || a.record_type === 'document' && documentIds.has(a.record_id)).map(a => [a.id,a])).values()];
  const claims = live(d, "hakedis").filter(h => h.status !== "İptal" && (h.items || []).some(i => i.work_record_id === id));
  const invoices = live(d, "payables").filter(b => recognizedBill(b) && (b.items || []).some(i => i.work_record_id === id));
  const directPayments = live(d, "cash_records").filter(c => c.cash_type === "Müşteriden Para Alındı" &&
    (c.work_record_id === id || c.ref_id === id || (work.driver_entry_id && c.driver_entry_id === work.driver_entry_id)));
  const generalPaymentRows = live(d, "cash_records").filter(c => c.cash_type === "Müşteriden Para Alındı" && c.customer_id === work.customer_id && !directPayments.some(x => x.id === c.id));
  const generalCustomerPayments = generalPaymentRows.reduce((n, c) => n + (Number(c.amount) || 0), 0);
  const paymentStatus = directPayments.length ? "Bu işe bağlı tahsilat kaydı var" : generalCustomerPayments > 0 ? "Müşteri hesabında tahsilat var; bu işe dağıtılmadı" : "Bu işe bağlı tahsilat yok";

  const allCosts = costLedger(d);
  const linkedCosts = allCosts.filter(r => r.work_record_id === id);
  const directSourceKeys = new Set(linkedCosts.map(r => r.source_store + "|" + r.source_id));
  const generalContext = allCosts.filter(r => !r.work_record_id && r.date === work.date && r.vehicle_id && r.vehicle_id === work.vehicle_id && !directSourceKeys.has(r.source_store + "|" + r.source_id));
  const allocatedRows = applyAllocations(d, linkedCosts, {});
  const allocations = live(d, "cost_allocations").filter(a => a.status === "Aktif" && directSourceKeys.has(a.source_store + "|" + a.source_id));
  const plan = live(d, "shift_assignments").find(r => r.work_record_id === id || r.id === work.plan_assignment_id) || null;

  let dump = null;
  try { dump = dumpFee(d, work); } catch (e) { dump = { error: e.message || String(e) }; }
  const issues = [];
  if (work.slip_id && !live(d, "slips").some(s => s.id === work.slip_id)) issues.push("Fiş bağlantısı (slip_id) silinmiş veya artık erişilemiyor; tarih/maliyet yeniden üretilmedi.");
  for (const h of (d.hakedis || []).filter(h => h.deleted_at || h.status === "İptal"))
    if ((h.items || []).some(i => i.work_record_id === id)) issues.push("İptal/silinmiş hakediş bağlantısı var; yeni hakediş veya tutar üretilmedi.");
  if (dump?.error) issues.push("Döküm okunamadı: " + dump.error);
  else if (dump?.unverified) issues.push(dump.missing_reason || "Döküm maliyetinin kalanı doğrulanmadı; bilinmeyen tutar sıfır değildir.");
  if (work.customer_id && !customer) issues.push("Gerçek borçlu müşteri kaydı bulunamadı; ana firmaya sessizce aktarım yapılmadı.");
  if (work.site_id && !site) issues.push("Şantiye bağlantısı bulunamadı; müşteri/şantiye ilişkisi yeniden kurulmadı.");

  const billed = claims.length > 0;
  const priceStatus = work.price_snapshot?.price_source === "Mazot karşılığı" ? "Mazot karşılığı (TL gelir değil)" : work.price_snapshot?.price_source === "Sözleşmeye dahil" ? "Sözleşmeye dahil" : missingCustomerWorkPrice(work, billed) ? "Fiyat bekliyor" : hasWorkPrice(work) ? "Fiyat kayıtlı" : "Fiyat durumu incelenmeli";
  const slipStatus = attachments.length || work.slip_no || work.digital_slip_no || work.slip_id ? "Fiş / belge dayanağı var" : "Fiş / belge bekliyor";
  return {
    work, customer, parent, site, plan, attachments, documents, claims, invoices, directPayments, generalPaymentRows, generalCustomerPayments, paymentStatus,
    linkedCosts, allocatedRows, generalContext, allocations, dump, issues, priceStatus, slipStatus,
    claimStatus: claims.length ? `${claims.length} hakediş bağlantısı` : "Hakediş bağlantısı yok",
    directCostTotal: gross(linkedCosts), generalContextTotal: gross(generalContext),
  };
}

// Common document-link preview/validation. Real writes stay in existing services.
import { prepareAttachment } from "./attachment-safety.js";
import { normalizedDocument } from "./business.js";
import { isActive } from "./core.js";

export async function sha256File(file) {
  const bytes = await file.arrayBuffer();
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(x => x.toString(16).padStart(2, "0")).join("");
}
export function documentDuplicateCandidates(d, { sha256 = "", receipt_no = "", dump_site_id = "" } = {}) {
  const exactAttachments = (d.attachments || []).filter(a => sha256 && a.src_sha256 === sha256);
  const exactIds = new Set(exactAttachments.map(a => a.record_id));
  const exact = (d.dump_entries || []).filter(e => exactIds.has(e.id));
  const key = String(receipt_no || "").trim().toLocaleUpperCase("tr-TR");
  const similar = key ? (d.dump_entries || []).filter(e => isActive(e) && e.kind === "RECEIPT" && String(e.receipt_no || "").trim().toLocaleUpperCase("tr-TR") === key && (!dump_site_id || e.dump_site_id === dump_site_id) && !exactIds.has(e.id)) : [];
  return { exact, similar, exactAttachments };
}

export async function validateDocumentLink(d, form, file) {
  const safeFile = await prepareAttachment(file);
  const duplicates = documentDuplicateCandidates(d, form);
  if (duplicates.exact.length) return { duplicate: "exact", existing: duplicates.exact[0], file: safeFile };
  if (duplicates.similar.length && !form.allow_similar) return { duplicate: "similar", candidates: duplicates.similar, file: safeFile };
  const kind = form.kind;
  if (kind === "dump_receipt") {
    const work = (d.work_records || []).find(w => w.id === form.work_record_id && isActive(w));
    if (!work) throw Error("Bağlanacak gerçek işi seçin");
    if (work.dump_site_id !== form.dump_site_id && form.dump_site_id) throw Error("İşin döküm sahası farklı");
    const trips = Number(form.trips);
    if (!Number.isInteger(trips) || trips < 1) throw Error("Fişin kapsadığı sefer sayısı pozitif tam sayı olmalı");
    const maxTrips = work.unit === "Sefer" ? Number(work.quantity) : 1;
    if (trips > maxTrips) throw Error(`Fiş en fazla ${maxTrips} seferi kapsayabilir`);
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount < 0) throw Error("Tutar sıfır veya pozitif olmalı");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(form.date || ""))) throw Error("Geçerli fiş tarihi gerekli");
    if (form.tonnage != null && form.tonnage !== "") {
      if (!(Number(form.tonnage) > 0)) throw Error("Net tonaj pozitif olmalı");
      if (maxTrips > 1 && !["total", "per_trip"].includes(form.tonnage_scope)) throw Error("Çok seferli tonajın kapsamı total veya per_trip olmalı");
    }
    return { kind, file: safeFile, fields: { kind: "RECEIPT", date: form.date, dump_site_id: work.dump_site_id, vehicle_id: work.vehicle_id, work_record_id: work.id, trips, amount, payer: "company_account", receipt_no: String(form.receipt_no || "").trim(), note: String(form.note || "").trim(), tonnage: form.tonnage === "" || form.tonnage == null ? null : Number(form.tonnage), tonnage_scope: form.tonnage_scope || "unknown" } };
  }
  if (kind === "generic") {
    const fields = normalizedDocument({ category: form.category, doc_no: String(form.doc_no || "").trim(), date: form.date || null, expiry_date: form.expiry_date || null, owner_type: form.owner_type, owner_id: form.owner_id, customer_id: form.owner_type === "customer" ? form.owner_id : null, vehicle_id: form.owner_type === "vehicle" ? form.owner_id : null, work_record_id: form.owner_type === "work" ? form.owner_id : null, description: String(form.description || "").slice(0, 1000) });
    return { kind, file: safeFile, fields };
  }
  if (kind === "warranty") return { kind, file: safeFile, fields: { vehicle_id: form.vehicle_id || null } };
  throw Error("Belge türü geçersiz");
}

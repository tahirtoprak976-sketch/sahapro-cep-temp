import { newRecord, uuid, stableStringify, nowISO, isActive } from "./core.js";
import { transaction } from "./enterprise-db.js";
import { sparePartFields } from "./parts-core.js";
const stores = [
  "maintenance_parts",
  "vehicles",
  "expense_records",
  "maintenance_records",
  "payables",
];
export async function preparePartFiles(files = []) {
  if (files.length > 8) throw Error("Bir seferde en fazla 8 belge ekleyin");
  if (files.reduce((s, f) => s + f.size, 0) > 30 * 1024 * 1024)
    throw Error("Belgelerin toplamı en fazla 30 MB olabilir");
  const result = [];
  for (const file of files) {
    if (!file.size || file.size > 15 * 1024 * 1024)
      throw Error("Her belge 0–15 MB arasında olmalı");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf =
      bytes[0] === 37 &&
      bytes[1] === 80 &&
      bytes[2] === 68 &&
      bytes[3] === 70 &&
      bytes[4] === 45;
    if (!pdf) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw Error("JPEG, PNG, WebP veya PDF seçin");
      try {
        const bitmap = await createImageBitmap(file);
        bitmap.close();
      } catch {
        throw Error("Fotoğraf açılamadı; geçerli bir fotoğraf seçin");
      }
    }
    const hash = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    // Garanti/fatura kanıtı özgün çözünürlükte korunur; boyut sınırı girişte uygulanır.
    const blob = file;
    result.push({
      id: uuid(),
      name: file.name || "belge",
      type: pdf ? "application/pdf" : blob.type,
      size: blob.size,
      blob,
      src_sha256: hash,
      kind: "warranty",
      created_at: nowISO(),
    });
  }
  return result;
}
export async function saveSparePart(f, files = [], key = uuid()) {
  const prepared = await preparePartFiles(files);
  const signature = stableStringify({
    fields: f,
    files: prepared.map((a) => a.src_sha256),
  });
  return transaction([...stores, "attachments"], (d, t) => {
    const old = d.maintenance_parts.find((r) => r.request_id === key);
    if (old) {
      if (old.request_signature !== signature)
        throw Error(
          "Bu işlem anahtarı farklı içerikle kullanılmış; ekranı yeniden açın",
        );
      return old;
    }
    const fields = sparePartFields(d, f);
    const r = newRecord({
      ...fields,
      request_id: key,
      request_signature: signature,
    });
    if (fields.cost_mode === "new_expense") {
      const expense = newRecord({
        date: r.date,
        vehicle_id: r.vehicle_id,
        category: "Yedek Parça",
        amount: r.total,
        company: r.seller,
        description: `${r.quantity} × ${r.description}`,
        payment_method: null,
        kdv_rate: null,
        part_id: r.id,
      });
      t.add("expense_records", expense);
      r.cost_mode = "existing";
      r.cost_source_store = "expense_records";
      r.cost_source_id = expense.id;
    }
    t.add("maintenance_parts", r);
    const seen = new Set();
    for (const a of prepared) {
      if (seen.has(a.src_sha256)) continue;
      seen.add(a.src_sha256);
      t.add("attachments", {
        ...a,
        record_type: "maintenance_parts",
        record_id: r.id,
      });
    }
    return r;
  });
}
export async function addPartFiles(id, files) {
  const prepared = await preparePartFiles(files);
  if (!prepared.length) throw Error("Belge seçin");
  return transaction(["maintenance_parts", "attachments"], (d, t) => {
    if (!d.maintenance_parts.some((r) => r.id === id && isActive(r)))
      throw Error("Parça bulunamadı");
    const seen = new Set(
      d.attachments
        .filter(
          (a) => a.record_type === "maintenance_parts" && a.record_id === id,
        )
        .map((a) => a.src_sha256),
    );
    for (const a of prepared) {
      if (seen.has(a.src_sha256)) continue;
      seen.add(a.src_sha256);
      t.add("attachments", {
        ...a,
        record_type: "maintenance_parts",
        record_id: id,
      });
    }
  });
}
export async function updatePartWarranty(id, f, expectedVersion) {
  return transaction(stores, (d, t) => {
    const old = d.maintenance_parts.find(
      (r) => r.id === id && isActive(r) && r.tracking,
    );
    if (!old) throw Error("Parça bulunamadı");
    if (expectedVersion && old.updated_at !== expectedVersion)
      throw Error("Parça başka ekranda değişti; yeniden açın");
    const current = sparePartFields(d, {
      ...old,
      warranty_start: f.warranty_start,
      warranty_until: f.warranty_until,
      brand: f.brand,
      serial_numbers: f.serial_numbers,
      seller: f.seller,
      invoice_no: f.invoice_no,
      note: f.note,
    });
    const r = {
      ...old,
      ...current,
      updated_at: new Date(
        Math.max(Date.now(), (Date.parse(old.updated_at) || 0) + 1),
      ).toISOString(),
    };
    t.put("maintenance_parts", r);
    return r;
  });
}
export async function unlinkPartCost(id, reason) {
  if (!reason?.trim()) throw Error("Bağlantıyı kaldırma nedeni zorunlu");
  return transaction(stores, (d, t) => {
    const old = d.maintenance_parts.find(
      (r) => r.id === id && r.tracking && isActive(r),
    );
    if (!old?.cost_source_id) throw Error("Bağlı maliyet bulunamadı");
    const r = {
      ...old,
      cost_mode: "tracking",
      cost_source_store: null,
      cost_source_id: null,
      cost_unlinked: {
        store: old.cost_source_store,
        id: old.cost_source_id,
        reason: reason.trim(),
        at: nowISO(),
      },
      updated_at: nowISO(),
    };
    t.put("maintenance_parts", r);
    return r;
  });
}

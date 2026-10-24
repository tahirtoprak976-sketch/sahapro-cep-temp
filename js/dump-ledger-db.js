import {
  newRecord,
  uuid,
  nowISO,
  isActive,
  stableStringify,
  toKurus,
  todayStr,
} from "./core.js";
import { transaction } from "./enterprise-db.js";
import {
  dumpEntryFields,
  liveDumpEntries,
  dumpReference,
  dumpMoney,
  dumpDate,
  freezeDumpTariff,
} from "./dump-ledger-core.js";
import { preparePartFiles } from "./parts-db.js";
const stores = [
  "dump_entries",
  "dump_sites",
  "work_records",
  "vehicles",
  "expense_records",
  "payables",
  "cost_allocations",
  "maintenance_parts",
  "personnel",
];
const stamp = (old) =>
  new Date(
    Math.max(Date.now(), (Date.parse(old?.updated_at) || 0) + 1),
  ).toISOString();
function protectedExpense(d, e) {
  if (
    e.bank_movement_id ||
    (d.payables || []).some(
      (b) =>
        isActive(b) &&
        b.status !== "İptal" &&
        b.source_store === "expense_records" &&
        b.source_id === e.id,
    ) ||
    (d.cost_allocations || []).some(
      (a) =>
        isActive(a) &&
        a.status === "Aktif" &&
        a.source_store === "expense_records" &&
        a.source_id === e.id,
    ) ||
    (d.maintenance_parts || []).some(
      (p) =>
        isActive(p) &&
        p.cost_source_store === "expense_records" &&
        p.cost_source_id === e.id,
    )
  )
    throw Error(
      "Gider başka finans/parça kaydına bağlı; önce o bağlantıyı inceleyin",
    );
}
export async function saveDumpEntry(f, files = [], key = uuid()) {
  if (typeof key !== "string" || !key.trim() || key.length > 200)
    throw Error("Döküm işlem anahtarı geçersiz");
  const prepared = await preparePartFiles(files),
    signature = stableStringify({
      f,
      files: prepared.map((a) => a.src_sha256),
    });
  return transaction([...stores, "attachments"], (d, t) => {
    const old = d.dump_entries.find((e) => e.request_id === key);
    if (old) {
      if (old.request_signature !== signature)
        throw Error("Aynı işlem anahtarı farklı içerikle kullanılamaz");
      if (!isActive(old)) throw Error("Bu işlem iptal edilmiş");
      return { ...old, _existing: true };
    }
    const input =
      f.kind === "TOPUP" && f.expense_id
        ? {
            ...f,
            personnel_id: dumpReference(d, "expense_records", f.expense_id)
              .personnel_id,
            payment_method: dumpReference(d, "expense_records", f.expense_id)
              .payment_method,
          }
        : f;
    const fields = dumpEntryFields(d, input),
      entry = newRecord({
        ...fields,
        ...(f.assistant_origin?{assistant_origin:f.assistant_origin}:{}),
        request_id: key,
        request_signature: signature,
      });
    if (entry.kind === "TOPUP") {
      let expense;
      if (f.expense_id) {
        expense = dumpReference(d, "expense_records", f.expense_id);
        protectedExpense(d, expense);
        if (expense.invoice_paid)
          throw Error(
            "Faturadan varsayılan ödeme gerçek yüklemeye çevrilemez; açılış bakiyesi girin",
          );
        if (
          toKurus(expense.amount) !== toKurus(entry.amount) ||
          expense.date !== entry.date ||
          (expense.dump_site_id &&
            expense.dump_site_id !== entry.dump_site_id) ||
          liveDumpEntries(d).some((e) => e.expense_id === expense.id)
        )
          throw Error("Eski gider bu yüklemeye uygun değil veya zaten bağlı");
        expense = {
          ...expense,
          dump_deposit: true,
          dump_site_id: entry.dump_site_id,
          dump_entry_id: entry.id,
          updated_at: stamp(expense),
        };
        t.put("expense_records", expense);
      } else {
        expense = newRecord({
          date: entry.date,
          amount: entry.amount,
          category: "Döküm",
          company: d.dump_sites.find((s) => s.id === entry.dump_site_id).name,
          dump_site_id: entry.dump_site_id,
          dump_deposit: true,
          dump_entry_id: entry.id,
          payment_method: entry.payment_method || null,
          personnel_id: entry.personnel_id || null,
          reimbursement_status:
            entry.payment_method === "Personel Ödedi" ? "Bekliyor" : null,
          receipt: prepared.length ? "Evet" : "Hayır",
          reference: entry.reference,
          ...(f.assistant_origin?{assistant_origin:f.assistant_origin}:{}),
          description:
            "Ortak döküm hesabına yükleme" +
            (entry.note ? " · " + entry.note : ""),
        });
        t.add("expense_records", expense);
      }
      entry.expense_id = expense.id;
    }
    if (entry.kind === "RECEIPT" && entry.expense_id)
      protectedExpense(
        d,
        dumpReference(d, "expense_records", entry.expense_id),
      );
    t.add("dump_entries", entry);
    const seen = new Set();
    for (const file of prepared) {
      if (seen.has(file.src_sha256)) continue;
      seen.add(file.src_sha256);
      t.add("attachments", {
        ...file,
        record_type: "dump_entries",
        record_id: entry.id,
      });
    }
    return entry;
  });
}
export async function cancelDumpEntry(
  id,
  reason,
  { expectedVersion, cancelExpense = false } = {},
) {
  if (!reason?.trim()) throw Error("İptal gerekçesi zorunlu");
  return transaction(stores, (d, t) => {
    const e = dumpReference(d, "dump_entries", id);
    if (expectedVersion && e.updated_at !== expectedVersion)
      throw Error("Döküm işlemi başka ekranda değişti; yeniden açın");
    if (
      (d.cost_allocations || []).some(
        (a) =>
          isActive(a) &&
          a.status === "Aktif" &&
          a.source_store === "dump_entries" &&
          a.source_id === id,
      )
    )
      throw Error("Önce maliyet dağıtımını iptal edin");
    const at = stamp(e);
    if (e.expense_id) {
      if (e.kind === "RECEIPT" && !cancelExpense)
        throw Error(
          "Fiş bağlı giderle birlikte iptal edilmelidir; gider iptalini işaretleyin",
        );
      const expense = dumpReference(d, "expense_records", e.expense_id);
      protectedExpense(d, expense);
      t.put("expense_records", {
        ...expense,
        deleted_at: at,
        updated_at: at,
        reversal_reason: reason.trim(),
      });
    }
    const r = {
      ...e,
      deleted_at: at,
      updated_at: at,
      reversal_reason: reason.trim(),
    };
    t.put("dump_entries", r);
    return r;
  });
}
export async function linkDumpReceipt(id, workId, expectedVersion) {
  return transaction(stores, (d, t) => {
    const e = dumpReference(d, "dump_entries", id);
    if (e.kind !== "RECEIPT" || e.work_record_id)
      throw Error("Yalnız işsiz fiş bağlanabilir");
    if (expectedVersion && e.updated_at !== expectedVersion)
      throw Error("Fiş değişti; yeniden açın");
    if (
      (d.cost_allocations || []).some(
        (a) =>
          isActive(a) &&
          a.status === "Aktif" &&
          a.source_store === "dump_entries" &&
          a.source_id === id,
      )
    )
      throw Error("Önce maliyet dağıtımını iptal edin");
    const fields = dumpEntryFields(
      { ...d, dump_entries: d.dump_entries.filter((x) => x.id !== id) },
      { ...e, work_record_id: workId },
    );
    const r = { ...e, ...fields, updated_at: stamp(e) };
    t.put("dump_entries", r);
    return r;
  });
}
export async function changeDumpTariff(rec, fields, reason) {
  return transaction(
    ["dump_sites", "work_records", "dump_entries", "expense_records"],
    (d, t) => {
      const site = dumpReference(d, "dump_sites", rec.id);
      if (site.updated_at !== rec.updated_at)
        throw Error("Saha başka ekranda değişti; yeniden açın");
      const fee = dumpMoney(fields.fee ?? site.fee, true),
        unit = fields.fee_unit ?? site.fee_unit;
      if (!["Ton", "Sefer", ""].includes(unit) || (!unit && fee > 0))
        throw Error(
          "Tarife birimi Ton veya Sefer olmalı; ücret yoksa tutarı sıfırlayın",
        );
      const date = fields.fee_effective_from || todayStr();
      dumpDate(date);
      if (
        date > todayStr() ||
        (site.fee_effective_from && date < site.fee_effective_from)
      )
        throw Error("Tarife başlangıcı geçersiz; geçmiş tarifeyi ezemezsiniz");
      if (
        fields.own_yard &&
        (liveDumpEntries(d).some((e) => e.dump_site_id === site.id) ||
          [...d.work_records, ...d.expense_records].some(
            (e) => isActive(e) && e.dump_site_id === site.id,
          ))
      )
        throw Error("Hareketi olan saha iç depoya çevrilemez");
      for (const w of d.work_records.filter(
        (w) =>
          isActive(w) && w.dump_site_id === site.id && !w.dump_tariff_snapshot,
      ))
        t.put("work_records", {
          ...w,
          dump_tariff_snapshot: freezeDumpTariff(w, site),
          updated_at: stamp(w),
        });
      const history = [
        ...(site.fee_history || []),
        {
          fee: Number(site.fee) || 0,
          fee_unit: site.fee_unit || "Ton",
          from: site.fee_effective_from || null,
          to: date,
          changed_at: nowISO(),
          reason: reason || "Tarife değişikliği",
        },
      ];
      const out = {
        ...site,
        ...fields,
        fee,
        fee_unit: unit,
        fee_effective_from: date,
        fee_history: history,
        updated_at: stamp(site),
      };
      t.put("dump_sites", out);
      return out;
    },
  );
}
export async function saveDumpReport(siteId, amount, date, note = "") {
  dumpDate(date);
  if (date > todayStr()) throw Error("Mutabakat tarihi gelecekte olamaz");
  if (
    !["number", "string"].includes(typeof amount) ||
    String(amount).trim() === "" ||
    !Number.isFinite(Number(amount)) ||
    !Number.isSafeInteger(toKurus(amount))
  )
    throw Error("Bakiye geçersiz");
  return transaction(["dump_sites"], (d, t) => {
    const s = dumpReference(d, "dump_sites", siteId),
      r = {
        ...s,
        account_reported: {
          amount: Number(amount),
          date,
          note: String(note).slice(0, 1000),
          recorded_at: nowISO(),
        },
        updated_at: stamp(s),
      };
    t.put("dump_sites", r);
    return r;
  });
}
export async function setDumpInvoicePeriod(id, from, to) {
  dumpDate(from);
  dumpDate(to);
  if (from > to || to > todayStr()) throw Error("Fatura dönemi geçersiz");
  return transaction(["documents"], (d, t) => {
    const doc = dumpReference(d, "documents", id);
    if (doc.category !== "Döküm Faturası") throw Error("Döküm faturası değil");
    const r = {
      ...doc,
      period_from: from,
      period_to: to,
      updated_at: stamp(doc),
    };
    t.put("documents", r);
    return r;
  });
}

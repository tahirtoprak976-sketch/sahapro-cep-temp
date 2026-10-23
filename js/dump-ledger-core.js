// Ortak saha bakiyesi: kayıtlı yüklemeler ve doğrulanmış kesintiler. Araç filtresi bakiyeyi değiştirmez.
import { isActive, toKurus, fromKurus, todayStr } from "./core.js";
export const DUMP_KINDS = ["TOPUP", "RECEIPT", "OPENING", "REFUND"];
export const DUMP_PAYERS = ["company_account", "company_direct", "customer"];
export const liveDumpEntries = (d) => (d.dump_entries || []).filter(isActive);
const text = (v, max = 300) =>
  String(v || "")
    .trim()
    .slice(0, max);
export function dumpDate(v, label = "Tarih") {
  const x = new Date(v + "T12:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v || "") ||
    !Number.isFinite(+x) ||
    x.toISOString().slice(0, 10) !== v
  )
    throw Error(label + " geçersiz");
  return v;
}
export function dumpMoney(v, zero = false) {
  if (
    !["string", "number"].includes(typeof v) ||
    String(v).trim() === "" ||
    !Number.isFinite(Number(v)) ||
    (zero ? Number(v) < 0 : Number(v) <= 0) ||
    !Number.isSafeInteger(toKurus(v))
  )
    throw Error("Tutar geçersiz");
  if (!zero && toKurus(v) <= 0) throw Error("Tutar en az 0,01 TL olmalı");
  return fromKurus(toKurus(v));
}
export function dumpReference(d, store, id) {
  const r = (d[store] || []).find((r) => r.id === id && isActive(r));
  if (!r) throw Error("Bağlı kayıt bulunamadı: " + store);
  return r;
}
export function receiptKey(e) {
  return e.receipt_no
    ? `${e.dump_site_id}|${e.date}|${String(e.receipt_no).normalize("NFKC").toLocaleUpperCase("tr-TR").replace(/\s/g, "")}`
    : null;
}
export function dumpEntryFields(d, f) {
  if (!DUMP_KINDS.includes(f.kind)) throw Error("Döküm işlem türü geçersiz");
  const site = dumpReference(d, "dump_sites", f.dump_site_id);
  if (site.own_yard) throw Error("İç depoya ön ödemeli saha hesabı açılamaz");
  dumpDate(f.date);
  if (f.date > todayStr()) throw Error("İşlem tarihi gelecekte olamaz");
  const r = {
    kind: f.kind,
    date: f.date,
    dump_site_id: site.id,
    amount: dumpMoney(f.amount, f.kind === "OPENING"),
    note: text(f.note, 2000),
    reference: text(f.reference, 150),
    barcode: text(f.barcode, 150),
    payment_method: text(f.payment_method, 60) || null,
  };
  if (f.kind === "TOPUP" && f.payment_method === "Personel Ödedi")
    r.personnel_id = dumpReference(d, "personnel", f.personnel_id).id;
  if (
    f.kind === "TOPUP" &&
    r.reference &&
    liveDumpEntries(d).some(
      (e) =>
        e.kind === "TOPUP" &&
        e.dump_site_id === r.dump_site_id &&
        e.date === r.date &&
        toKurus(e.amount) === toKurus(r.amount) &&
        e.reference?.trim().toLocaleUpperCase("tr-TR") ===
          r.reference.toLocaleUpperCase("tr-TR"),
    )
  )
    throw Error("Aynı tarih, tutar ve dekont referansı zaten kayıtlı");
  if (f.kind === "OPENING") {
    if (!r.note) throw Error("Açılış bakiyesinin kaynağını yazın");
    if (
      liveDumpEntries(d).some(
        (e) => e.kind === "OPENING" && e.dump_site_id === site.id,
      )
    )
      throw Error("Bu hesapta açılış bakiyesi var; önce gerekçeyle iptal edin");
  }
  if (f.kind === "REFUND" && !r.note) throw Error("İade açıklaması zorunlu");
  if (f.kind === "RECEIPT") {
    r.payer = f.payer || "company_account";
    if (!DUMP_PAYERS.includes(r.payer))
      throw Error("Dökümü ödeyen taraf geçersiz");
    r.vehicle_id = dumpReference(d, "vehicles", f.vehicle_id).id;
    r.receipt_no = text(f.receipt_no, 100);
    if (!r.receipt_no && !r.note)
      throw Error("Fiş/ekstre numarası veya kesinti açıklaması girin");
    if (f.trips != null && !["string", "number"].includes(typeof f.trips))
      throw Error("Sefer sayısı geçersiz");
    if (
      f.tonnage != null &&
      f.tonnage !== "" &&
      !["string", "number"].includes(typeof f.tonnage)
    )
      throw Error("Net tonaj geçersiz");
    r.trips = Number(f.trips ?? 1);
    if (!Number.isInteger(r.trips) || r.trips < 1 || r.trips > 100000)
      throw Error("Fişin kapsadığı sefer sayısı geçersiz");
    r.tonnage =
      f.tonnage == null || f.tonnage === "" ? null : Number(f.tonnage);
    if (
      r.tonnage != null &&
      (!Number.isFinite(r.tonnage) || r.tonnage <= 0 || r.tonnage > 1000000)
    )
      throw Error("Net tonaj geçersiz");
    r.work_record_id = f.work_record_id || null;
    r.expense_id = f.expense_id || null;
    if (r.work_record_id) {
      const w = dumpReference(d, "work_records", r.work_record_id);
      if (w.dump_site_id !== site.id || w.vehicle_id !== r.vehicle_id)
        throw Error("İşin aracı veya döküm sahası farklı");
      r.customer_id = w.customer_id || null;
      r.site_id = w.site_id || null;
      const used = liveDumpEntries(d)
        .filter((e) => e.kind === "RECEIPT" && e.work_record_id === w.id)
        .reduce((n, e) => n + e.trips, 0);
      if (used + r.trips > (w.unit === "Sefer" ? Number(w.quantity) : 1))
        throw Error("Fiş sefer sayısı işteki kalan seferi aşıyor");
      if (w.date !== r.date && !r.note)
        throw Error("Fiş ve iş tarihi farklı; açıklama girin");
    }
    if (r.expense_id) {
      if (r.payer === "customer")
        throw Error("Müşterinin ödediği fişe şirket gideri bağlanamaz");
      const e = dumpReference(d, "expense_records", r.expense_id);
      if (
        e.dump_deposit ||
        toKurus(e.amount) !== toKurus(r.amount) ||
        (e.vehicle_id && e.vehicle_id !== r.vehicle_id) ||
        (e.dump_site_id && e.dump_site_id !== site.id)
      )
        throw Error("Gider tutarı/araç/saha farklı veya kayıt bir yükleme");
      if (
        (d.payables || []).some(
          (b) =>
            isActive(b) &&
            b.status !== "İptal" &&
            b.source_store === "expense_records" &&
            b.source_id === e.id,
        )
      )
        throw Error("Alış belgesine bağlı gider burada birleştirilemez");
      if (
        (d.cost_allocations || []).some(
          (a) =>
            isActive(a) &&
            a.status === "Aktif" &&
            a.source_store === "expense_records" &&
            a.source_id === e.id,
        )
      )
        throw Error("Önce gider dağıtımını iptal edin");
      if (liveDumpEntries(d).some((x) => x.expense_id === e.id))
        throw Error("Gider başka döküm işlemine bağlı");
    }
    const key = receiptKey(r);
    if (
      key &&
      liveDumpEntries(d).some(
        (e) => e.kind === "RECEIPT" && receiptKey(e) === key,
      )
    )
      throw Error("Bu sahada aynı tarih ve fiş numarası zaten kayıtlı");
  }
  return r;
}
export function companyDumpReceipt(e) {
  return e.kind === "RECEIPT" && e.payer !== "customer";
}
export function dumpReceiptRows(d) {
  return liveDumpEntries(d).filter((e) => e.kind === "RECEIPT");
}
export function linkedDumpExpenseIds(d) {
  return new Set(
    liveDumpEntries(d)
      .filter((e) => e.kind === "RECEIPT" && e.expense_id)
      .map((e) => e.expense_id),
  );
}
export function sharedDumpBalance(d, siteId, { today = todayStr() } = {}) {
  const entries = liveDumpEntries(d).filter(
    (e) => e.dump_site_id === siteId && e.date <= today,
  );
  const opening = entries.find((e) => e.kind === "OPENING"),
    start = opening?.date || "";
  const within = (e) => e.date >= start && e.date <= today;
  const deposits = (d.expense_records || []).filter(
    (e) =>
      isActive(e) && e.dump_deposit && e.dump_site_id === siteId && within(e),
  );
  const actual = deposits.filter((e) => !e.invoice_paid),
    assumed = deposits.filter((e) => e.invoice_paid);
  const sum = (xs) => fromKurus(xs.reduce((n, e) => n + toKurus(e.amount), 0));
  const receipts = entries.filter((e) => e.kind === "RECEIPT" && within(e)),
    account = receipts.filter((e) => e.payer === "company_account");
  const refunds = entries.filter((e) => e.kind === "REFUND" && within(e));
  const credit = sum(actual),
    used = sum(account),
    refund = sum(refunds),
    base = opening?.amount || 0;
  return {
    opening,
    start,
    deposits: actual,
    assumed_deposits: assumed,
    assumed_credit: sum(assumed),
    credit,
    used,
    refund,
    receipts,
    account_receipts: account,
    balance: fromKurus(
      toKurus(base) + toKurus(credit) - toKurus(used) - toKurus(refund),
    ),
    complete_history: !!opening || actual.length > 0,
  };
}
export function dumpTariffFor(site, date, createdAt = "") {
  if (!site) return null;
  const histories = site.fee_history || [];
  const byDate = histories.find(
    (h) => (!h.from || date >= h.from) && date < h.to,
  );
  const rate = byDate || site;
  return {
    site_id: site.id,
    fee: Number(rate.fee) || 0,
    fee_unit: rate.fee_unit || "",
    effective_from: rate.from || rate.fee_effective_from || null,
    legacy_rate: !rate.from && !rate.fee_effective_from,
  };
}
export function freezeDumpTariff(work, site, previous = null) {
  if (!site) return null;
  if (
    previous?.dump_tariff_snapshot?.site_id === site.id &&
    previous.date === work.date
  )
    return previous.dump_tariff_snapshot;
  return {
    ...dumpTariffFor(site, work.date, work.created_at),
    work_date: work.date,
    captured_at: new Date().toISOString(),
  };
}
export function validateDumpData(d) {
  const active = liveDumpEntries(d),
    expenses = new Set(),
    operations = new Set();
  for (const e of d.dump_entries || []) {
    if (e.request_id) {
      if (typeof e.request_id !== "string" || operations.has(e.request_id))
        throw Error("Yedekte mükerrer/geçersiz döküm işlem anahtarı");
      operations.add(e.request_id);
    }
  }
  const receiptKeys = new Set();
  for (const e of active.filter((x) => x.kind === "RECEIPT")) {
    const key = receiptKey(e);
    if (key && receiptKeys.has(key)) throw Error("Yedekte mükerrer döküm fişi");
    if (key) receiptKeys.add(key);
  }
  for (const e of active) {
    // Aynı kayıt dışarıda bırakılır: kalan satırlarla tüm normal giriş kuralları yeniden denetlenir.
    dumpEntryFields(
      { ...d, dump_entries: active.filter((x) => x.id !== e.id) },
      e,
    );
    if (e.expense_id) {
      if (expenses.has(e.expense_id))
        throw Error("Yedekte mükerrer döküm gider bağlantısı");
      expenses.add(e.expense_id);
    }
    if (e.kind === "TOPUP") {
      const x = dumpReference(d, "expense_records", e.expense_id);
      if (
        !x.dump_deposit ||
        x.invoice_paid ||
        x.dump_entry_id !== e.id ||
        x.dump_site_id !== e.dump_site_id ||
        x.date !== e.date ||
        toKurus(x.amount) !== toKurus(e.amount)
      )
        throw Error("Yedekte kopuk döküm yüklemesi");
    }
    if (e.kind === "RECEIPT") {
      if (
        typeof e.trips !== "number" ||
        (e.tonnage != null && typeof e.tonnage !== "number")
      )
        throw Error("Yedekte döküm sefer/tonaj bilgisi geçersiz");
      if (e.work_record_id) {
        const w = dumpReference(d, "work_records", e.work_record_id);
        if (
          (w.customer_id || null) !== (e.customer_id || null) ||
          (w.site_id || null) !== (e.site_id || null)
        )
          throw Error("Yedekte kopuk döküm işi");
      }
    }
  }
  for (const x of (d.expense_records || []).filter(isActive)) {
    if (
      x.dump_entry_id &&
      !active.some(
        (e) =>
          e.kind === "TOPUP" &&
          e.id === x.dump_entry_id &&
          e.expense_id === x.id,
      )
    )
      throw Error("Yedekte sahipsiz döküm yükleme gideri");
  }
  for (const w of (d.work_records || []).filter(isActive)) {
    const s = w.dump_tariff_snapshot;
    if (!s) continue;
    if (
      s.site_id !== w.dump_site_id ||
      !["Ton", "Sefer", ""].includes(s.fee_unit)
    )
      throw Error("Yedekte döküm tarife kopyası geçersiz");
    dumpMoney(s.fee, true);
    dumpDate(s.work_date);
    if (s.work_date !== w.date)
      throw Error("Yedekte döküm tarife tarihi farklı");
  }
}

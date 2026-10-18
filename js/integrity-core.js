// Veri Sağlığı — SAF denetim. Bütün kayıtları, ekleri (fotoğraf/dosya) ve bağlantıları birbirine karşı denetler;
// çelişkiyi bulur, nedenini ve nereye gidileceğini söyler. Hiçbir şeyi değiştirmez (düzeltmeler ekranda, onayla).
// sev: "error" (yanlış sonuç üretir: mükerrer, kopuk bağ, eksi stok…) · "warn" (kontrol edilmeli) · "info"
import { duplicateDocuments, calcHakedisTotals, toKurus } from "./core.js";
import { customerBalances, customerOpenItems, customerLedgerMovements } from "./collect-core.js";
import { customerStatement } from "./statement.js";
import { signedSlipChanges } from "./driver-core.js";
import { vatContractReport } from "./vat-contract.js";
import { leaveDays as leaveDaysOf } from "./leave-core.js";

const live = (d, s) => (d[s] || []).filter((r) => r && !r.deleted_at);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(new Date(String(s) + "T12:00:00Z"));
const addDays = (t, n) => { const x = new Date(t + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const fin = (n) => n === null || n === undefined || n === "" || Number.isFinite(Number(n));
const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// Ek türü → sahibi mağaza (backup.js ile aynı)
export const ATTACH_OWNER = { document: "documents", maintenance: "maintenance_records", expense: "expense_records", slip_signature: "slips", contract_signature: "contracts",
  leave_signature: "documents", tank: "fuel_tank_movements", payable: "payables", work: "work_records", fuel: "fuel_records" };
const OWNER_STORE = { vehicle: "vehicles", personnel: "personnel", customer: "customers", fuel: "fuel_records", expense: "expense_records", hakedis: "hakedis", work: "work_records", contract: "contracts", dump_site: "dump_sites" };
const HREF = { work_records: "#/isler/", fuel_records: "#/yakit/", expense_records: "#/gider/", maintenance_records: "#/bakim/", cash_records: "#/kasa/", documents: "#/belgeler/", hakedis: "#/hakedis/" };
const LABEL = { work_records: "İş", fuel_records: "Yakıt", fuel_tank_movements: "Depo hareketi", expense_records: "Gider", maintenance_records: "Arıza/bakım", cash_records: "Kasa", personnel_events: "Personel hareketi", documents: "Belge", payables: "Esnaf borcu", sites: "Şantiye", hakedis: "Hakediş" };

export function integrityCheck(d, { today, attachments = [], restoreSets = [] } = {}) {
  const out = [];
  const add = (sev, code, text, sub = "", href = "", fix = null) => out.push({ sev, code, text, sub, href, fix });
  const idx = {};
  const byId = (s) => (idx[s] ||= new Map((d[s] || []).map((r) => [r.id, r])));
  const exists = (s, id) => { const r = byId(s).get(id); return r ? (r.deleted_at ? "deleted" : "ok") : "missing"; };
  const name = (s, id) => byId(s).get(id)?.name || "";
  const lbl = (s, r) => `${LABEL[s] || s} ${r.date ? r.date.split("-").reverse().join(".") : ""}`.trim();
  const ref = (s, r, field, target, req = false) => {
    const id = r[field];
    if (!id) { if (req) add("error", "ref-empty", `${lbl(s, r)}: ${field.replace("_id", "")} boş`, "", HREF[s] ? HREF[s] + r.id : ""); return; }
    const st = exists(target, id);
    if (st !== "ok") add("error", "ref-" + st, `${lbl(s, r)}: bağlı ${LABEL[target] || target.replace(/_/g, " ")} ${st === "deleted" ? "silinmiş" : "bulunamıyor"}`, `${field} = ${id}`, HREF[s] ? HREF[s] + r.id : "");
  };

  // ---- 1. Bağlantılar ----
  for (const w of live(d, "work_records")) {
    ref("work_records", w, "customer_id", "customers", true);
    ref("work_records", w, "vehicle_id", "vehicles");
    ref("work_records", w, "site_id", "sites");
    ref("work_records", w, "personnel_id", "personnel");
    ref("work_records", w, "dump_site_id", "dump_sites");
    ref("work_records", w, "quarry_id", "quarries");
    const site = w.site_id && byId("sites").get(w.site_id);
    if (site && !site.deleted_at && site.customer_id && w.customer_id && site.customer_id !== w.customer_id)
      add("error", "site-customer", `${lbl("work_records", w)}: şantiye "${site.name}" başka müşterinin`, `iş: ${name("customers", w.customer_id)} · şantiye: ${name("customers", site.customer_id)}`, "#/isler/" + w.id);
  }
  for (const f of live(d, "fuel_records")) {
    ref("fuel_records", f, "vehicle_id", "vehicles", true);
    if (f.fuel_source === "Depo Tankı") {
      const m = f.tank_movement_id && byId("fuel_tank_movements").get(f.tank_movement_id);
      if (!m || m.deleted_at) add("error", "fuel-no-move", `${lbl("fuel_records", f)}: depodan verilmiş ama depo çıkışı yok`, "Depo stoku bu kadar fazla görünür", "#/yakit/" + f.id);
      else if (Math.abs(Number(m.liters) - Number(f.liters)) > 0.01) add("error", "fuel-move-liters", `${lbl("fuel_records", f)}: yakıt ${f.liters} L, depo çıkışı ${m.liters} L`, "", "#/yakit/" + f.id);
    }
  }
  for (const m of live(d, "fuel_tank_movements")) {
    if (m.move_type === "ÇIKIŞ" && m.fuel_record_id) {
      const st = exists("fuel_records", m.fuel_record_id);
      if (st !== "ok") add("error", "move-orphan", `Depo çıkışı ${m.date ? m.date.split("-").reverse().join(".") : ""} · ${m.liters} L: yakıt kaydı ${st === "deleted" ? "silinmiş" : "yok"}`, "Depo stoku eksik görünür", "#/depo", { kind: "orphan-move", id: m.id });
    }
    if (m.move_type === "GİRİŞ") { ref("fuel_tank_movements", m, "supplier_id", "suppliers"); ref("fuel_tank_movements", m, "customer_id", "customers"); }
  }
  for (const e of live(d, "expense_records")) { ref("expense_records", e, "vehicle_id", "vehicles"); ref("expense_records", e, "personnel_id", "personnel"); ref("expense_records", e, "dump_site_id", "dump_sites"); }
  for (const m of live(d, "maintenance_records")) ref("maintenance_records", m, "vehicle_id", "vehicles");
  for (const c of live(d, "cash_records")) { ref("cash_records", c, "customer_id", "customers"); ref("cash_records", c, "personnel_id", "personnel"); }
  for (const e of live(d, "personnel_events")) ref("personnel_events", e, "personnel_id", "personnel", true);
  for (const s of live(d, "sites")) ref("sites", s, "customer_id", "customers");
  for (const doc of live(d, "documents")) {
    const t = OWNER_STORE[doc.owner_type];
    if (t && doc.owner_id) { const st = exists(t, doc.owner_id); if (st !== "ok") add("warn", "doc-owner", `Belge ${doc.category || ""} ${doc.doc_no || ""}: sahibi ${st === "deleted" ? "silinmiş" : "yok"}`, "", "#/belgeler/" + doc.id); }
  }
  for (const b of live(d, "payables").filter((b) => b.status !== "İptal" && b.source_store && b.source_id)) {
    const st = exists(b.source_store, b.source_id);
    if (st !== "ok") add("error", "payable-source", `Esnaf borcu ${b.document_no || ""}: kaynağı (${LABEL[b.source_store] || b.source_store}) ${st === "deleted" ? "silinmiş" : "yok"}`, `${Number(b.gross_total || 0).toLocaleString("tr-TR")} ₺ borç duruyor`, "#/esnaf");
  }
  for (const h of live(d, "hakedis").filter((h) => h.status !== "İptal"))
    for (const it of h.items || []) if (it.work_record_id && exists("work_records", it.work_record_id) !== "ok") { add("error", "hakedis-work", `Hakediş ${h.no || h.id}: içindeki iş silinmiş`, "", "#/hakedis/" + h.id); break; }

  // ---- 2. Ekler (fotoğraf / dosya) ----
  for (const a of attachments) {
    const s = ATTACH_OWNER[a.record_type] || a.record_type;
    const st = d[s] ? exists(s, a.record_id) : "missing";
    if (st === "missing") add("warn", "att-orphan", `Sahipsiz dosya: ${a.name || "dosya"} (${a.record_type})`, "Bağlı olduğu kayıt yok; yer kaplıyor", "", { kind: "orphan-att", id: a.id });
    if (!a.blob || !(a.size > 0 || a.blob.size > 0)) add("error", "att-empty", `Bozuk / boş dosya: ${a.name || "dosya"}`, `${LABEL[s] || s} kaydına bağlı`, HREF[s] ? HREF[s] + a.record_id : "");
  }

  // ---- 3. Mükerrer ----
  const dupBy = (rows, key, make) => { const m = new Map(); for (const r of rows) { const k = key(r); if (!k) continue; if (m.has(k)) make(m.get(k), r); else m.set(k, r); } };
  for (const s of ["work_records", "fuel_records", "expense_records", "maintenance_records"])
    dupBy(live(d, s), (r) => r.driver_entry_id, (a, b) => add("error", "dup-driver", `${lbl(s, b)}: aynı şoför kaydı iki kez işlenmiş`, `${lbl(s, a)} ile aynı`, HREF[s] ? HREF[s] + b.id : ""));
  // Parçalı yedek geri yüklemesi yarım: eksik parça ve eki gelmemiş kayıtlar (sessizce "tamam" sayılmaz)
  for (const st of restoreSets || []) {
    const missing = Array.from({ length: st.of }, (_, i) => i + 1).filter((n) => !(st.done || []).includes(n));
    const waiting = Object.values(st.pending || {});
    if (missing.length || waiting.length) {
      const recs = [...new Set(waiting.map((x) => x[0] + ":" + x[1]))];
      add("error", "restore-incomplete", `Yedek geri yüklemesi tamamlanmadı: ${(st.done || []).length}/${st.of} parça`, `Eksik parça: ${missing.join(", ") || "—"} · eki bekleyen kayıt: ${recs.length}${st.created_at ? " · yedek tarihi " + String(st.created_at).slice(0, 10) : ""}`);
    }
  }
  // KDV / cari tutar sözleşmesi: aynı müşterinin cari toplamında KDV dahil ve hariç fiyatlı işler karışıyor mu (hesap değiştirilmez, işaretlenir)
  for (const r of vatContractReport(d)) {
    if (r.mixedBasis) add("warn", "vat-mixed", `${r.customer}: cari toplamında KDV dahil (${r.dahil}) ve hariç (${r.haric}) fiyatlı işler karışık`, `Bugünkü toplam ${r.booked} · net ${r.net} · brüt ${r.gross} ₺ (karar notu: KDV/cari)`);
    else if (r.ambiguous) add("warn", "vat-ambiguous", `${r.customer}: ${r.ambiguous} işte KDV oranı / temeli kayıtlı değil`, `Bugünkü toplam ${r.booked} ₺; varsayımla net ${r.net} · brüt ${r.gross} ₺`);
  }
  // İmzalı dijital fiş: kayıt, müşterinin imzaladığı içerikten sonra değişmiş mi
  for (const w of live(d, "work_records")) {
    const ch = signedSlipChanges(w, { customers: Object.fromEntries((d.customers || []).map((x) => [x.id, x.name])), vehicles: Object.fromEntries((d.vehicles || []).map((x) => [x.id, x.name])), sites: Object.fromEntries((d.sites || []).map((x) => [x.id, x.name])) });
    if (ch.length) add("warn", "slip-changed", `${lbl("work_records", w)}: imzalı dijital fişten (${w.digital_slip_no}) sonra değiştirilmiş`, ch.join(" · "), HREF.work_records ? HREF.work_records + w.id : "");
  }
  dupBy(live(d, "work_records").filter((w) => norm(w.slip_no).length >= 3), (w) => norm(w.slip_no) + "|" + (w.dump_site_id || ""), (a, b) => {
    if (Math.abs(new Date(a.date) - new Date(b.date)) <= 60 * 864e5) add("warn", "dup-slip", `Aynı fiş no iki işte: ${b.slip_no}`, `${a.date} ve ${b.date}`, "#/isler/" + b.id);
  });
  dupBy(live(d, "fuel_tank_movements").filter((m) => m.invoice_no), (m) => norm(m.invoice_no), (a, b) => add("error", "dup-tank-invoice", `Aynı mazot faturası iki depo girişinde: ${b.invoice_no}`, "Depo stoku ve borç iki kez", "#/depo"));
  dupBy(live(d, "expense_records").filter((e) => e.invoice_no), (e) => norm(e.invoice_no) + "|" + (e.seller_tax_no || ""), (a, b) => add("warn", "dup-expense-invoice", `Aynı fatura iki giderde: ${b.invoice_no}`, `${a.date} ve ${b.date}`, "#/gider/" + b.id));
  for (const g of duplicateDocuments(live(d, "documents"))) if (g.length > 1) add("warn", "dup-doc", `Mükerrer belge: ${g[0].category} ${g[0].doc_no || ""} (${g.length} adet)`, "", "#/belgeler/" + g[1].id);

  // ---- 4. Sayılar ve tarihler ----
  const NUMS = { work_records: ["quantity", "unit_price", "tonnage", "dump_cost"], fuel_records: ["liters", "total", "km", "machine_hours"], fuel_tank_movements: ["liters", "unit_price", "total"],
    expense_records: ["amount"], maintenance_records: ["cost"], cash_records: ["amount"] };
  for (const [s, fields] of Object.entries(NUMS)) for (const r of live(d, s)) {
    for (const f of fields) if (!fin(r[f]) || Number(r[f]) < 0) add("error", "bad-number", `${lbl(s, r)}: ${f} geçersiz (${r[f]})`, "", HREF[s] ? HREF[s] + r.id : "");
    if (!isDate(r.date)) add("error", "bad-date", `${LABEL[s]}: tarih geçersiz (${r.date ?? "boş"})`, "", HREF[s] ? HREF[s] + r.id : "");
    else if (today && r.date > addDays(today, 1) && s !== "personnel_events") add("warn", "future", `${lbl(s, r)}: ileri tarihli`, "Yanlış yıl / ay girilmiş olabilir", HREF[s] ? HREF[s] + r.id : "");
  }
  for (const w of live(d, "work_records")) if (!(Number(w.quantity) > 0)) add("error", "zero-qty", `${lbl("work_records", w)}: miktar 0`, "", "#/isler/" + w.id);
  // Depo: tarih sırasıyla stok hiç eksiye düşmemeli
  { let bal = 0, low = null;
    const mv = live(d, "fuel_tank_movements").filter((m) => isDate(m.date)).sort((a, b) => a.date.localeCompare(b.date) || (a.move_type === "GİRİŞ" ? -1 : 1));
    for (const m of mv) { bal += (m.move_type === "GİRİŞ" ? 1 : -1) * (Number(m.liters) || 0); if (bal < -0.5 && !low) low = { date: m.date, bal }; }
    if (low) add("warn", "tank-negative", `Depo ${low.date.split("-").reverse().join(".")} tarihinde eksiye düşüyor (${Math.round(low.bal)} L)`, "O tarihten önceki bir depo girişi eksik", "#/depo"); }
  for (const m of live(d, "fuel_tank_movements").filter((m) => m.move_type === "GİRİŞ" && !m.count_id && Number(m.total) > 0 && Number(m.liters) > 0)) {
    const up = Math.round((m.total / m.liters) * 100) / 100;
    if (Math.abs((Number(m.unit_price) || 0) - up) > Math.max(0.05, up * 0.005)) add("warn", "tank-price", `Depo girişi ${m.date}: litre fiyatı ${m.unit_price} ama toplam ÷ litre = ${up}`, "", "#/depo", { kind: "tank-price" });
  }

  // ---- 5. İş kuralları ----
  const forms = new Map(live(d, "documents").filter((x) => x.category === "İzin Formu").map((x) => [x.id, x]));
  const badLeave = live(d, "personnel_events").filter((e) => e.leave_form_id && (!forms.get(e.leave_form_id) || forms.get(e.leave_form_id).status !== "Onaylandı"));
  // Onaylı formun günlerinin bir kısmı puantaja yazılmamış (onay ile gün kayıtları tek işlem değil — yarım kalmış olabilir)
  for (const f of forms.values()) {
    if (f.status !== "Onaylandı" || !f.leave?.from || !f.leave?.to) continue;
    const want = leaveDaysOf(f.leave.from, f.leave.to);
    const have = new Set(live(d, "personnel_events").filter((e) => e.leave_form_id === f.id).map((e) => e.date));
    const miss = want.filter((x) => !have.has(x));
    if (miss.length) add("error", "leave-partial", `İzin formu ${f.doc_no || ""} onaylı ama ${miss.length}/${want.length} günü puantajda yok`, "Onay yarım kalmış olabilir: eksik günler " + miss.slice(0, 5).join(", "), "#/izinler");
  }
  if (badLeave.length) add("error", "leave-form", `${badLeave.length} izin günü onaylı olmayan forma bağlı`, "Form reddedilmiş/iptal ya da silinmiş; günler puantajda izin görünüyor", "#/izinler", { kind: "leave-orphan", ids: badLeave.map((e) => e.id) });
  // İzinli gün iş kaydı
  const leaveDay = new Set(live(d, "personnel_events").filter((e) => e.event_type === "İzin" || e.event_type === "Rapor").map((e) => e.personnel_id + "|" + e.date));
  const clash = live(d, "work_records").filter((w) => w.personnel_id && leaveDay.has(w.personnel_id + "|" + w.date));
  for (const w of clash.slice(0, 20)) add("warn", "leave-work", `${name("personnel", w.personnel_id)} ${w.date.split("-").reverse().join(".")} izinli ama iş kaydı var`, "İzin mi yanlış, iş mi?", "#/isler/" + w.id);
  // Personel / araç kartları
  for (const v of live(d, "vehicles")) if (v.assignee_id && exists("personnel", v.assignee_id) !== "ok") add("warn", "veh-assignee", `${v.name}: zimmetli personel silinmiş`, "", "");
  // Faturalandı işaretli iş, belgesi yok
  for (const w of live(d, "work_records").filter((w) => w.invoice_doc_id)) if (exists("documents", w.invoice_doc_id) !== "ok") add("warn", "invoice-doc", `${lbl("work_records", w)}: fatura belgesi silinmiş (${w.invoice_no || ""})`, "", "#/isler/" + w.id);
  // Tank borcu ↔ giriş tutarı
  for (const b of live(d, "payables").filter((b) => b.status !== "İptal" && b.source_store === "fuel_tank_movements")) {
    const m = byId("fuel_tank_movements").get(b.source_id);
    if (m && !m.deleted_at && Number(m.total) > 0 && Math.abs(Number(b.gross_total) - Number(m.total)) > 1) add("warn", "tank-payable", `Depo girişi ${m.date}: petrolcü borcu ${Number(b.gross_total).toLocaleString("tr-TR")} ₺, giriş tutarı ${Number(m.total).toLocaleString("tr-TR")} ₺`, "", "#/esnaf");
  }

  // ---- 6. Para: tahsilat ↔ cari, hakediş ↔ cari, bakiye ekranları aynı ----
  const cari = live(d, "cari_movements");
  for (const c of live(d, "cash_records").filter((c) => c.cash_type === "Müşteriden Para Alındı")) {
    const mv = cari.filter((m) => m.type === "Tahsilat" && m.ref_id === c.id);
    if (mv.length !== 1) add("error", "cash-cari", `Tahsilat ${c.date} · ${Number(c.amount).toLocaleString("tr-TR")} ₺: cari hareketi ${mv.length ? mv.length + " tane" : "yok"}`, mv.length ? "Müşteri bakiyesinden iki kez düşüyor" : "Müşterinin bakiyesinden düşmemiş", "#/kasa/" + c.id);
    else if (toKurus(mv[0].amount) !== -toKurus(c.amount) || mv[0].customer_id !== c.customer_id) add("error", "cash-cari-amount", `Tahsilat ${c.date}: kasada ${Number(c.amount).toLocaleString("tr-TR")} ₺, caride ${(-Number(mv[0].amount)).toLocaleString("tr-TR")} ₺${mv[0].customer_id !== c.customer_id ? " (başka müşteri)" : ""}`, "Tahsilat sonradan değiştirilmiş", "#/kasa/" + c.id);
  }
  const cashIds = new Set(live(d, "cash_records").map((c) => c.id));
  for (const m of cari.filter((m) => m.type === "Tahsilat" && m.ref_id && !cashIds.has(m.ref_id)))
    add("error", "cari-orphan-cash", `Cari tahsilat ${m.date} · ${(-Number(m.amount)).toLocaleString("tr-TR")} ₺: kasa kaydı silinmiş`, `${name("customers", m.customer_id)} bakiyesi bu kadar az görünüyor`, "");
  for (const h of live(d, "hakedis")) {
    const mv = cari.filter((m) => m.type === "Hakedis" && m.ref_id === h.id);
    if (h.status === "Kesinleşti") {
      if (mv.length !== 1) add("error", "hakedis-cari", `Hakediş #${h.hakedis_no}: cari hareketi ${mv.length ? mv.length + " tane" : "yok"}`, "", "#/hakedis/" + h.id);
      else if (toKurus(mv[0].amount) !== toKurus(h.grand_total)) add("error", "hakedis-cari-amount", `Hakediş #${h.hakedis_no}: toplam ${h.grand_total} ₺, caride ${mv[0].amount} ₺`, "", "#/hakedis/" + h.id);
      const re = calcHakedisTotals(h.items || []).grand;
      if (toKurus(re) !== toKurus(h.grand_total)) add("error", "hakedis-total", `Hakediş #${h.hakedis_no}: kalemlerin toplamı ${re} ₺, kayıtlı toplam ${h.grand_total} ₺`, "", "#/hakedis/" + h.id);
    } else if (mv.length) add("error", "hakedis-cari-draft", `Hakediş #${h.hakedis_no} (${h.status}) kesinleşmemiş ama cariye yazılmış`, "", "#/hakedis/" + h.id);
  }
  { const { bal } = customerBalances(d);
    for (const c of live(d, "customers")) {
      const oi = customerOpenItems(d, c.id, today);
      const viaOpen = toKurus(oi.open.reduce((n, x) => n + x.left, 0)) - toKurus(oi.advance);
      const viaSt = toKurus(customerStatement(customerLedgerMovements(d, c.id), c.id).closing);
      const b = toKurus(bal[c.id] || 0);
      if (b !== viaOpen || b !== viaSt) add("error", "balance-views", `${c.name}: ekranlar farklı bakiye gösteriyor`, `cari ${b / 100} · açık kalemler ${viaOpen / 100} · ekstre ${viaSt / 100}`, "#/cari/" + c.id);
    }
  }

  const rank = { error: 0, warn: 1, info: 2 };
  out.sort((a, b) => rank[a.sev] - rank[b.sev]);
  return { issues: out, errors: out.filter((x) => x.sev === "error").length, warns: out.filter((x) => x.sev === "warn").length };
}

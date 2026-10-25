// Müşteri panosu ve ayrıntılı müşteri raporu (PDF). Hesaplar saf (customerReportData), çizim ve PDF ayrı.
// Rakamlar diğer ekranlarla aynı kaynaklardan: bakiye = collect-core, mazot = assistant-rules, ekstre = statement.
import { isActive, toKurus, fromKurus, todayStr, addDays, trDate } from "./core.js";
import { customerLedgerMovements, customerOpenItems, customerOpenItemLabel, chequeRows, workAmount, hasWorkPrice, missingCustomerWorkPrice } from "./collect-core.js";
import { customerStatement } from "./statement.js";
import { customerFuelLedger, fuelRulesOf } from "./assistant-rules.js";
import { claimWorkResolution } from './hakedis-finance.js';

const live = (d, s) => (d[s] || []).filter(isActive);
const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => Number(n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
const tl = (n) => Number(n || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";
const monthKey = (s) => String(s || "").slice(0, 7);

export const PERIODS = {
  month: ["Bu ay", (t) => t.slice(0, 8) + "01"],
  last: ["Geçen ay", (t) => { const d = new Date(t.slice(0, 8) + "01T12:00:00"); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 8) + "01"; }],
  m3: ["Son 3 ay", (t) => addDays(t, -90)],
  year: ["Bu yıl", (t) => t.slice(0, 4) + "-01-01"],
  all: ["Tümü", () => ""],
};
export function periodRange(key, today = todayStr()) {
  const from = PERIODS[key] ? PERIODS[key][1](today) : "";
  let to = today;
  if (key === "last") { const d = new Date(from + "T12:00:00"); d.setMonth(d.getMonth() + 1); d.setDate(0); to = d.toISOString().slice(0, 10); }
  return { from, to, label: PERIODS[key]?.[0] || "Tümü" };
}

export function customerReportData(d, id, { from = "", to = todayStr(), subs = false, today = todayStr() } = {}) {
  const me = live(d, "customers").find((c) => c.id === id);
  if (!me) throw Error("Müşteri bulunamadı");
  const children = live(d, "customers").filter((c) => c.parent_customer_id === id);
  const parent = me.parent_customer_id ? live(d, "customers").find((c) => c.id === me.parent_customer_id) : null;
  const ids = new Set([id, ...(subs ? children.map((c) => c.id) : [])]);
  const nm = (s, x) => (x ? live(d, s).find((r) => r.id === x)?.name || "" : "");
  const inR = (x) => x && (!from || x >= from) && (!to || x <= to);
  const billed=new Set(live(d,"hakedis").filter(h=>h.status==="Kesinleşti").flatMap(h=>(h.items||[]).map(i=>i.work_record_id)));
  const works = live(d, "work_records").filter((w) => ids.has(w.customer_id) && inR(w.date))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.created_at || "").localeCompare(String(b.created_at || "")))
    .map((w) => ({
      id: w.id, priced:hasWorkPrice(w), unpriced:missingCustomerWorkPrice(w,billed.has(w.id)), date: w.date, customer: w.customer_id !== id ? nm("customers", w.customer_id) : "", vehicle: nm("vehicles", w.vehicle_id), personnel: nm("personnel", w.personnel_id),
      type: w.work_type || "", qty: Number(w.quantity) || 0, unit: w.unit || "", material: w.material || "",
      from: nm("quarries", w.quarry_id) || w.quarry || "", site: nm("sites", w.site_id), to: nm("dump_sites", w.dump_site_id) || w.dump_area || "",
      tonnage: Number(w.tonnage) || 0, slip: w.slip_no || "", unit_price: w.price_snapshot?.unit_price==null || w.price_snapshot.unit_price==='' ? null : Number(w.price_snapshot.unit_price), amount: workAmount(w, d),
      fuelL: Number(w.customer_fuel_allowance_l) || 0, included: w.price_snapshot?.price_source === "Sözleşmeye dahil", locked: !!w.price_snapshot?.locked, note: w.description || "",
      kdv_included: w.price_snapshot ? !!w.price_snapshot.kdv_included : null, kdv_rate: w.price_snapshot?.kdv_rate ?? null,
    }));
  const units = {};
  for (const w of works) units[w.unit] = r2((units[w.unit] || 0) + w.qty);
  const byType = {}, byVehicle = {};
  for (const w of works) {
    const t = byType[w.type || "Diğer"] ||= { count: 0, amount: 0, fuelL: 0, units: {} };
    t.count++; t.amount = r2(t.amount + w.amount); t.fuelL = r2(t.fuelL + w.fuelL); t.units[w.unit] = r2((t.units[w.unit] || 0) + w.qty);
    const v = byVehicle[w.vehicle || "—"] ||= { count: 0, amount: 0, fuelL: 0, units: {} };
    v.count++; v.amount = r2(v.amount + w.amount); v.fuelL = r2(v.fuelL + w.fuelL); v.units[w.unit] = r2((v.units[w.unit] || 0) + w.qty);
  }
  // Tahsilatlar: cari hareketlerden (nakit ve havale ikisi de buraya yazılır)
  const collections = live(d, "cari_movements").filter((m) => ids.has(m.customer_id) && m.type === "Tahsilat" && inR(m.date))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((m) => {
      const cash = live(d, "cash_records").find((c) => c.id === m.ref_id);
      return { date: m.date, amount: -Number(m.amount) || 0, method: cash?.payment_method || (cash ? "Nakit" : "Banka / diğer"), note: cash?.description && !/^Asistan/.test(cash.description) ? cash.description : m.note === "Tahsilat" ? "" : m.note || "" };
    });
  // Cari ekstre (devir + dönem + kalan)
  const movs = [...ids].flatMap((x) => customerLedgerMovements(d, x));
  const statement = customerStatement(movs.map((m) => ({ ...m, customer_id: id })), id, { from, to });
  const balanceNow = r2(movs.reduce((n, m) => n + (Number(m.amount) || 0), 0));
  // Açık kalemler / yaşlandırma (bugün itibarıyla)
  const open = [...ids].flatMap((x) => customerOpenItems(d, x, today).open).sort((a, b) => a.date.localeCompare(b.date));
  const aging = { b0: 0, b30: 0, b60: 0, b90: 0 };
  for (const o of open) aging[o.days <= 30 ? "b0" : o.days <= 60 ? "b30" : o.days <= 90 ? "b60" : "b90"] = r2(aging[o.days <= 30 ? "b0" : o.days <= 60 ? "b30" : o.days <= 90 ? "b60" : "b90"] + o.left);
  // Son 12 ay, bugün itibarıyla. TL ve litre ayrı ölçeklerde tutulur.
  const asOf = (r) => !r.date || r.date <= today;
  const scopeWorks = live(d, "work_records").filter((w) => ids.has(w.customer_id) && asOf(w));
  const fuelSources = {
    works: scopeWorks,
    fuel: live(d, "fuel_records").filter((f) => ids.has(f.customer_id) && f.fuel_source === "Müşteri Verdi" && asOf(f)),
    tank: live(d, "fuel_tank_movements").filter((f) => ids.has(f.customer_id) && f.move_type === "GİRİŞ" && asOf(f)),
  };
  const fuelRules = [...ids].flatMap((x) => fuelRulesOf(live(d, "customers").find((c) => c.id === x)));
  const fuel = fuelRules.length || scopeWorks.some((w) => Number(w.customer_fuel_allowance_l) > 0) || fuelSources.fuel.length || fuelSources.tank.length
    ? [...ids].map((x) => customerFuelLedger(d, x, fuelSources)).reduce((sum, row) => {
      for (const k of ["earned", "received", "balance", "trips", "works", "receipts"]) sum[k] = r2(sum[k] + row[k]);
      for (const [u, q] of Object.entries(row.units)) sum.units[u] = r2((sum.units[u] || 0) + q);
      return sum;
    }, { earned: 0, received: 0, balance: 0, trips: 0, works: 0, receipts: 0, units: {} }) : null;
  const fuelCollections = [
    ...fuelSources.fuel.map((f) => ({ id: f.id, date: f.date, liters: Number(f.liters) || 0, target: nm("vehicles", f.vehicle_id) || "Araç / makine", customer: nm("customers", f.customer_id) })),
    ...fuelSources.tank.map((f) => ({ id: f.id, date: f.date, liters: Number(f.liters) || 0, target: "Depo", customer: nm("customers", f.customer_id) })),
  ].filter((f) => inR(f.date)).sort((a, b) => a.date.localeCompare(b.date));
  const months = [];
  { const d0 = new Date(today.slice(0, 8) + "01T12:00:00"); for (let i = 11; i >= 0; i--) { const x = new Date(d0); x.setMonth(x.getMonth() - i); months.push({ key: x.toISOString().slice(0, 7), work: 0, collected: 0 }); } }
  for (const w of scopeWorks) { const m = months.find((x) => x.key === monthKey(w.date)); if (m) m.work = r2(m.work + workAmount(w, d)); }
  for (const c of live(d, "cari_movements").filter((m) => ids.has(m.customer_id) && m.type === "Tahsilat" && asOf(m))) { const m = months.find((x) => x.key === monthKey(c.date)); if (m) m.collected = r2(m.collected - Number(c.amount)); }
  const fuelMonths = months.map(({ key }) => ({ key, work: 0, collected: 0 }));
  for (const w of scopeWorks.filter((w) => Number(w.customer_fuel_allowance_l) > 0)) { const m = fuelMonths.find((x) => x.key === monthKey(w.date)); if (m) m.work = r2(m.work + Number(w.customer_fuel_allowance_l)); }
  for (const f of [...fuelSources.fuel, ...fuelSources.tank]) { const m = fuelMonths.find((x) => x.key === monthKey(f.date)); if (m) m.collected = r2(m.collected + (Number(f.liters) || 0)); }
  const cheques = chequeRows(d, today).filter((q) => q.party_type === "customer" && ids.has(q.party_id));
  const workTotal = r2(works.reduce((n, w) => n + w.amount, 0));
  const collected = r2(collections.reduce((n, c) => n + c.amount, 0));
  const scopeNote = subs && children.length ? "Ana firma ve taşeronlar bu raporda birlikte gösterilir. Her müşterinin TL hesabı ayrıdır; bir müşterinin avansı diğerinin borcundan otomatik düşülmez. Birleşik TL bakiye ile açık kalemlerin toplamı bu nedenle farklı olabilir." : "";
  const financialIssues = live(d, 'work_records').filter(w => ids.has(w.customer_id) && inR(w.date))
    .map(w => ({id: w.id, issue: claimWorkResolution(d, w).issue})).filter(r => r.issue);
  return {
    customer: me, parent, children, from, to, subs, scopeNote, financialIssues, works, units, byType, byVehicle, collections, statement, balanceNow, open, aging, months, fuel, fuelRules, fuelMonths, fuelCollections, cheques,
    totals: { works: works.length, workTotal, collected, tonnage: r2(works.reduce((n, w) => n + w.tonnage, 0)), fuelL: r2(works.reduce((n, w) => n + w.fuelL, 0)), fuelReceivedL: r2(fuelCollections.reduce((n, f) => n + f.liters, 0)), unpriced: works.filter((w) => w.unpriced).length, included: works.filter((w) => w.included).length, oldestDays: open[0]?.days || 0 },
  };
}

// ---- Pano SUNUMU (hesap değiştirmez; yalnız mevcut rakamları anlamlarıyla ayırır) ----
// Mazot: tüm zamanların güncel litre hesabı (customerFuelLedger) ile seçili dönemde hak edilen litre AYRI.
// TL: seçili dönem toplamları ile bugünkü (tüm zamanlar) TL bakiye AYRI. İş tutarının KDV temeli: fiyat nasıl girildiyse.
export function panelModel(R, label = "") {
  const rules = R.fuelRules || fuelRulesOf(R.customer);
  let fuel = null;
  if (R.fuel) {
    const units = Object.entries(R.fuel.units || {}).filter(([, q]) => q > 0);
    const perTxt = rules.length === 1 && units.length === 1 && (rules[0].unit || "Sefer") === units[0][0] && Math.abs(units[0][1] * Number(rules[0].per) - R.fuel.earned) < 0.05
      ? `${fmt(units[0][1])} ${String(units[0][0]).toLocaleLowerCase("tr-TR")} × ${fmt(rules[0].per)} L` : units.map(([u, q]) => `${fmt(q)} ${String(u).toLocaleLowerCase("tr-TR")}`).join(", ");
    fuel = {
      earned: R.fuel.earned, received: R.fuel.received, balance: R.fuel.balance, basis: perTxt,
      onlyPay: rules.length > 0 && rules.every((r) => r.only_pay !== false), mixedPay: rules.some((r) => r.only_pay === false),
      periodEarned: R.totals.fuelL, periodReceived: R.totals.fuelReceivedL, periodLabel: label,
    };
  }
  const priced = R.works.filter((w) => w.amount > 0);
  const inc = priced.filter((w) => w.kdv_included === true).length, exc = priced.filter((w) => w.kdv_included !== true).length;
  const basis = !priced.length ? null : !inc ? "net" : !exc ? "brut" : "mixed";
  const basisText = basis === "net" ? "KDV hariç (net) — fiyatlar KDV hariç girilmiş"
    : basis === "brut" ? "KDV dahil (brüt) — fiyatlar KDV dahil girilmiş"
    : basis === "mixed" ? `karışık: ${exc} iş KDV hariç, ${inc} iş KDV dahil fiyatla — girildiği gibi toplandı` : "";
  return { fuel, basis, basisText };
}

const unitsText = (u) => Object.entries(u).map(([k, q]) => `${fmt(q)} ${String(k).toLocaleLowerCase("tr-TR")}`).join(", ") || "—";

// PDF tanımı (document-engine bölümleri)
export function customerReportSpec(R, { audience = "customer", chart = null, fuelChart = null, photos = [], company = "" } = {}) {
  const per = R.from ? `${trDate(R.from)} – ${trDate(R.to)}` : `Başlangıç – ${trDate(R.to)}`;
  const internal = audience === "internal";
  const S = [];
  S.push({ title: "Müşteri ve Dönem", pairs: [
    ["Müşteri", R.customer.name], ["Dönem", per], ["Telefon", R.customer.phone || ""], ["Ana firma", R.parent?.name || ""],
    ["Taşeronlar", R.children.length ? R.children.map((c) => c.name).join(", ") + (R.subs ? " (rapora dahil)" : " (dahil değil)") : ""],
  ] });
  if (R.scopeNote) S.push({ title: "Hesap kapsamı", layout: "notice", text: R.scopeNote });
  if (R.financialIssues?.length) S.push({ title: 'Kaynak kontrolü gerekli', layout: 'notice', text: `${R.financialIssues.length} işte hakediş kaynağı doğrulanamadı. Kayıtlı değerler korunarak gösterildi; fatura hazırlamadan önce kaynakları kontrol edin.` });
  S.push({ title: "Özet", layout: "totals", pairs: [
    ["İş sayısı", String(R.totals.works)], ["Miktar", unitsText(R.units)],
    ...(R.totals.tonnage ? [["Toplam ton (fiş)", fmt(R.totals.tonnage) + " ton"]] : []),
    ...(R.fuel ? [["Dönemde hak edilen mazot", fmt(R.totals.fuelL) + " L"], ["Mazot tahsilatı (dönem)", fmt(R.totals.fuelReceivedL) + " L"]] : []),
    ["İş tutarı (dönem, TL)", tl(R.totals.workTotal)], ["Tahsilat (dönem, TL)", tl(R.totals.collected)],
    ["Dönem başı devir", tl(R.statement.opening)], ["Dönem sonu bakiye", tl(R.statement.closing)],
  ] });
  if (fuelChart) S.push({ title: "Son 12 ay: hak edilen ve alınan mazot (L)", image: fuelChart, image_width: 760, max_h: 200 });
  if (chart) S.push({ title: "Son 12 ay: iş tutarı ve tahsilat (TL)", image: chart, image_width: 760, max_h: 200 });
  S.push({ title: "İş Dökümü", headers: ["Tarih", "Araç", "Operatör", "İş", "Miktar", "Nereden → Nereye", "Malzeme", "Ton", "Fiş No", "Birim Fiyat", "Tutar"],
    widths: [7, 9, 8, 11, 7, 17, 8, 5, 7, 8, 9],
    rows: R.works.map((w) => [trDate(w.date), w.vehicle, w.personnel, w.type + (w.customer ? ` [${w.customer}]` : ""), `${fmt(w.qty)} ${w.unit}`,
      [w.from, w.site, w.to].filter(Boolean).join(" → "), w.material, w.tonnage ? fmt(w.tonnage) : "", w.slip,
      w.priced && w.unit_price!=null ? tl(w.unit_price) : "", w.amount || w.fuelL ? breakdownLabel(w) : w.included ? "Sözleşmeye dahil" : w.priced ? tl(0) : "fiyatsız"]) });
  S.push({ title: "İş türüne göre", headers: ["İş türü", "İş sayısı", "Miktar", R.fuel ? "Tutar / mazot" : "Tutar"], widths: [40, 15, 25, 20],
    rows: Object.entries(R.byType).map(([k, v]) => [k, String(v.count), unitsText(v.units), breakdownLabel(v)]) });
  S.push({ title: "Araca göre", headers: ["Araç / makine", "İş sayısı", "Miktar", R.fuel ? "Tutar / mazot" : "Tutar"], widths: [40, 15, 25, 20],
    rows: Object.entries(R.byVehicle).map(([k, v]) => [k, String(v.count), unitsText(v.units), breakdownLabel(v)]) });
  S.push({ title: "Tahsilatlar", headers: ["Tarih", "Şekil", "Açıklama", "Tutar"], widths: [15, 20, 45, 20],
    rows: R.collections.length ? R.collections.map((c) => [trDate(c.date), c.method, c.note, tl(c.amount)]) : [["", "", "Bu dönemde TL tahsilatı yok", ""]] });
  if (R.fuel) S.push({ title: "Mazot tahsilatları (dönem, L)", headers: ["Tarih", "Müşteri", "Teslim yeri", "Alınan mazot"], widths: [15, 30, 35, 20],
    rows: R.fuelCollections.length ? R.fuelCollections.map((f) => [trDate(f.date), f.customer, f.target, fmt(f.liters) + " L"]) : [["", "", "Bu dönemde mazot tahsilatı kaydedilmemiş", ""]] });
  S.push({ title: "Cari Ekstre", headers: ["Tarih", "İşlem", "Açıklama", "Borç", "Tahsilat", "Bakiye"], widths: [11, 12, 41, 12, 12, 12],
    rows: [["", "Devir", "", "", "", tl(R.statement.opening)], ...R.statement.rows.map((r) => [trDate(r.date), r.type, r.text, r.debit ? tl(r.debit) : "", r.credit ? tl(r.credit) : "", tl(r.balance)])] });
  if (R.open.length)
    S.push({ title: `Açık kalemler (bugün itibarıyla · toplam ${tl(R.open.reduce((n, o) => n + o.left, 0))})`, headers: ["Tarih", "Kalem", "Gün", "Tutar", "Kalan"], widths: [13, 47, 10, 15, 15],
      rows: R.open.map((o) => [trDate(o.date), internal ? o.label : customerOpenItemLabel(o), String(o.days), tl(o.amount), tl(o.left)]) });
  if (internal && (R.aging.b30 || R.aging.b60 || R.aging.b90 || R.aging.b0))
    S.push({ title: "Yaşlandırma", pairs: [["0–30 gün", tl(R.aging.b0)], ["31–60 gün", tl(R.aging.b30)], ["61–90 gün", tl(R.aging.b60)], ["90+ gün", tl(R.aging.b90)]] });
  if (R.fuel)
    S.push({ title: "Mazot hesabı (tüm zamanlar, bugün itibarıyla; TL bakiyeye dahil değildir)", pairs: [["Hak edilen", fmt(R.fuel.earned) + " L"], ["Alınan", fmt(R.fuel.received) + " L"], [R.fuel.balance >= 0 ? "Kalan alacak" : "Fazla alınan", fmt(Math.abs(R.fuel.balance)) + " L"]] });
  if (R.cheques.length)
    S.push({ title: "Çek / senet", headers: ["Tür", "No", "Vade", "Durum", "Tutar"], widths: [15, 20, 20, 25, 20], rows: R.cheques.map((q) => [q.kind, q.document_no, trDate(q.due_date), q.status, tl(q.amount)]) });
  for (const p of photos) S.push({ title: p.title, image: p.blob, image_width: 520, max_h: 340 });
  S.push({ layout: "notice", text: `Bu rapor ${company || "işletme"} kayıtlarından hazırlanmıştır. Fiyatı girilmemiş işler tutara katılmamıştır${R.totals.unpriced ? ` (${R.totals.unpriced} iş)` : ""}. Hata görürseniz lütfen bildirin.` });
  return {
    template: "account", title: `${R.customer.name} — Müşteri Raporu`, audience, orientation: "landscape",
    filename: `Musteri_Raporu_${R.customer.name.replace(/[^\wÇĞİÖŞÜçğıöşü]+/g, "_")}_${R.to}.pdf`, sections: S,
  };
}

// Pano ve PDF aynı aylık veri ve seri adlarını kullanır. Litre hiçbir zaman TL'ye çevrilmez.
export const FUEL_CHART = Object.freeze({ unit: "L", workLabel: "Hak edilen mazot", collectedLabel: "Alınan mazot" });
const MONEY_CHART = Object.freeze({ unit: "₺", workLabel: "İş tutarı", collectedLabel: "Tahsilat" });
const html = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const hasMoneyChart = (R) => !R.fuel || R.months.some((m) => m.work || m.collected);
const chartSums = (months) => months.reduce((s, m) => ({ work: r2(s.work + m.work), collected: r2(s.collected + m.collected) }), { work: 0, collected: 0 });
export function monthsSvg(months, options = MONEY_CHART) {
  const { unit, workLabel, collectedLabel } = options;
  const max = Math.max(1, ...months.flatMap((m) => [m.work, m.collected]));
  const W = 360, H = 148, bw = 10;
  const bars = months.map((m, i) => {
    const x = 12 + i * 29, h1 = m.work > 0 ? Math.max(1.5, (m.work / max) * 90) : 0, h2 = m.collected > 0 ? Math.max(1.5, (m.collected / max) * 90) : 0;
    return `<rect data-series="earned" x="${x}" y="${100 - h1}" width="${bw}" height="${h1}" rx="2" fill="#f5a623"><title>${html(m.key)} ${html(workLabel)} ${fmt(m.work)} ${html(unit)}</title></rect>` +
      `<rect data-series="received" x="${x + bw + 1}" y="${100 - h2}" width="${bw}" height="${h2}" rx="2" fill="#2e9e6b"><title>${html(m.key)} ${html(collectedLabel)} ${fmt(m.collected)} ${html(unit)}</title></rect>` +
      `<text x="${x + bw}" y="116" text-anchor="middle" style="font-size:8px;fill:#53687b">${html(m.key.slice(5))}</text>` +
      `<text x="${x + bw}" y="128" text-anchor="middle" style="font-size:7px;fill:#53687b">${html(m.key.slice(0, 4))}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Son 12 ay: ${html(workLabel)} ve ${html(collectedLabel)} (${html(unit)})"><text x="8" y="9" style="font-size:8px;fill:#53687b">${fmt(max)} ${html(unit)}</text>${bars}<line x1="8" y1="100" x2="${W - 4}" y2="100" stroke="#cfd8e0"/></svg><div class="row small" style="gap:12px;flex-wrap:wrap"><span><b style="color:#f5a623">■</b> ${html(workLabel)} (${html(unit)})</span><span><b style="color:#2e9e6b">■</b> ${html(collectedLabel)} (${html(unit)})</span></div>`;
}
export function customerChartsHtml(R) {
  const series = [...(R.fuel ? [["fuel", R.fuelMonths, FUEL_CHART]] : []), ...(hasMoneyChart(R) ? [["money", R.months, MONEY_CHART]] : [])];
  return series.map(([kind, months, opt]) => {
    const total = chartSums(months);
    return `<div data-customer-chart="${kind}" style="margin-top:14px"><div class="small strong">Son 12 ay · ${kind === "fuel" ? "Mazot (L)" : "Para (TL)"}</div>
      ${monthsSvg(months, opt)}
      <div class="small" style="margin-top:6px">${opt.workLabel}: <b>${fmt(total.work)} ${opt.unit}</b> · ${opt.collectedLabel}: <b>${fmt(total.collected)} ${opt.unit}</b></div>
      ${!total.work && !total.collected ? '<div class="muted small">Son 12 ayda kayıt yok.</div>' : kind === "fuel" && !total.collected ? '<div class="muted small">Son 12 ayda müşteriden mazot alımı kaydedilmemiş.</div>' : ""}
      <details style="margin-top:6px"><summary class="small">Aylık ${kind === "fuel" ? "mazot" : "TL"} dökümü</summary><div style="overflow-x:auto"><table class="small" style="width:100%"><thead><tr><th>Ay</th><th>${opt.workLabel} (${opt.unit})</th><th>${opt.collectedLabel} (${opt.unit})</th></tr></thead><tbody>${months.map((m) => `<tr><td>${m.key.slice(5)}.${m.key.slice(0, 4)}</td><td>${fmt(m.work)}</td><td>${fmt(m.collected)}</td></tr>`).join("")}</tbody></table></div></details>
      <div class="muted tiny">${months[0]?.key.slice(5)}.${months[0]?.key.slice(0, 4)} – ${months.at(-1)?.key.slice(5)}.${months.at(-1)?.key.slice(0, 4)} · Bugüne kadar; üstteki dönem seçiminden bağımsız.${kind === "fuel" ? " Alınan mazot: müşterinin araca veya depoya verdiği mazot. TL hesabına eklenmez." : ""}</div></div>`;
  }).join("");
}
export async function monthsChartBlob(months, options = MONEY_CHART) {
  const { unit, workLabel, collectedLabel } = options;
  const c = document.createElement("canvas");
  c.width = 1600; c.height = 420;
  const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
  const max = Math.max(1, ...months.flatMap((m) => [m.work, m.collected]));
  const step = (c.width - 120) / months.length, bw = step * 0.32, base = 340;
  x.font = "22px sans-serif"; x.textAlign = "center";
  months.forEach((m, i) => {
    const x0 = 90 + i * step;
    const h1 = Math.max(0, (m.work / max) * 290), h2 = Math.max(0, (m.collected / max) * 290);
    x.fillStyle = "#f5a623"; x.fillRect(x0, base - h1, bw, h1);
    x.fillStyle = "#2e9e6b"; x.fillRect(x0 + bw + 4, base - h2, bw, h2);
    x.fillStyle = "#53687b"; x.fillText(m.key.slice(5) + "/" + m.key.slice(2, 4), x0 + bw, base + 30);
    x.fillStyle = "#142c42"; x.font = "17px sans-serif";
    if (m.work) x.fillText(fmt(m.work), x0 + bw / 2, base - h1 - 8);
    if (m.collected) x.fillText(fmt(m.collected), x0 + bw * 1.5 + 4, base - h2 - 8);
    x.font = "22px sans-serif";
  });
  x.strokeStyle = "#cfd8e0"; x.beginPath(); x.moveTo(60, base); x.lineTo(c.width - 20, base); x.stroke();
  x.textAlign = "left"; x.font = "22px sans-serif";
  x.fillStyle = "#f5a623"; x.fillRect(60, 385, 22, 22); x.fillStyle = "#142c42"; x.fillText(`${workLabel} (${unit})`, 90, 404);
  x.fillStyle = "#2e9e6b"; x.fillRect(500, 385, 22, 22); x.fillStyle = "#142c42"; x.fillText(`${collectedLabel} (${unit})`, 530, 404);
  return new Promise((res, rej) => c.toBlob((blob) => blob ? res(blob) : rej(Error("Grafik oluşturulamadı")), "image/png"));
}
export function breakdownLabel(v) {
  return [v.amount || !v.fuelL ? tl(v.amount) : "", v.fuelL ? fmt(v.fuelL) + " L mazot" : ""].filter(Boolean).join(" · ");
}
export function barsHtml(obj, label = breakdownLabel, val = null) {
  // Karma TL/litre gruplarını farklı birimleri toplayarak sıralamayız; o durumda çubuk iş sayısıdır.
  const values = Object.values(obj), fuel = values.some((v) => v.fuelL), money = values.some((v) => v.amount);
  val ||= fuel ? money ? (v) => v.count : (v) => v.fuelL : (v) => v.amount || v.count;
  const rows = Object.entries(obj).sort((a, b) => val(b[1]) - val(a[1])).slice(0, 8);
  const max = Math.max(1, ...rows.map(([, v]) => val(v)));
  return rows.map(([k, v]) => `<div class="small" style="margin:4px 0"><div class="row between" style="gap:4px;flex-wrap:wrap"><span style="overflow-wrap:anywhere">${html(k)}</span><span class="muted">${v.count} iş · ${unitsText(v.units)} · ${label(v)}</span></div><div style="height:7px;background:var(--surface2,#edf2f6);border-radius:4px"><div style="height:7px;width:${Math.round((val(v) / max) * 100)}%;background:#f5a623;border-radius:4px"></div></div></div>`).join("") || '<div class="muted small">—</div>';
}

// Asistan — SAF katman. Gemini'ye işletme bilgisini (kartlar, takma adlar, alışkanlıklar) verir,
// dönen planı doğrular. Kayıt yazmaz. Kural: kimlikler listede olmalı, yeni müşteri/şantiye adı
// mesajda geçmeli, sayılar mesajda veya fiş metninde yazmalı; tutmayan satır işaretsiz gelir.
import { isActive, WORK_TYPES, EXPENSE_CATEGORIES, todayStr } from "./core.js";
import { writtenNumbers, numbersInText } from "./ai-assist.js";
import { foldTr } from "./parser.js";

export const ASSIST_UNITS = ["Sefer", "Saat", "Yevmiye", "Ton", "m³", "Adet"];
const live = (d, s) => (d[s] || []).filter(isActive);
const norm = (s) => foldTr(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function assistantContext(d, today = todayStr()) {
  const recent = live(d, "work_records")
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 25)
    .map((w) => [w.date, w.customer_id, w.site_id, w.vehicle_id, w.work_type, w.quantity, w.unit].join("|"));
  return {
    today,
    customers: live(d, "customers").map((c) => [c.id, c.name]),
    sites: live(d, "sites").map((s) => [s.id, s.name, s.customer_id]),
    vehicles: live(d, "vehicles").map((v) => [v.id, v.name, v.plate || "", v.type || ""]),
    personnel: live(d, "personnel").map((p) => [p.id, p.name]),
    suppliers: live(d, "suppliers").map((s) => [s.id, s.name]),
    aliases: live(d, "aliases").filter((a) => a.active !== false).map((a) => [a.alias, a.target_type, a.target_id]),
    recent_works: recent,
  };
}

export function assistantSystem() {
  return [
    "Sen Muratoğlu Hafriyat (hafriyat, kamyon nakliye, iş makinesi) şirketinin kayıt asistanısın.",
    "Sana şirketin kartları (müşteri, şantiye, araç, personel, esnaf/tedarikçi), takma adlar ve son işler verilir.",
    "Kullanıcının mesajını ve varsa fiş fotoğraflarını okuyup kaydedilecek işleri, giderleri ve yakıtları çıkar.",
    "Kurallar: Kartı listeden ID ile seç. Mesajda listede olmayan bir müşteri adı geçiyorsa customer_id=null ve new_customer=mesajda yazdığı haliyle ad.",
    "Araç listede yoksa vehicle_id=null. Sayı uydurma: miktar, tutar, litre mesajda veya fişte yazmıyorsa null ver ve questions'a sor.",
    "'yarım gün', 'öğlene kadar' gibi ifadeler için tahminini quantity'ye yazabilirsin ama guessed=true işaretle.",
    "Sefer/gidiş/tur=Sefer, saat=Saat, yevmiye/gün=Yevmiye. İş türü listesi: " + WORK_TYPES.join(", ") + ".",
    "Gider kategorileri: " + EXPENSE_CATEGORIES.join(", ") + ". Veresiye/açık hesap (esnafa borç) ise credit=true ve supplier_id ver.",
    "Fotoğraf varsa her fotoğrafın tüm yazısını photo_texts dizisine aynen yaz (sayı biçimini koru).",
    "Tarih YYYY-MM-DD. 'dün' gibi ifadeleri bugüne göre çöz; tarih yoksa bugünü kullan.",
    "Yalnız JSON döndür: {\"works\":[{\"date\",\"customer_id\",\"new_customer\",\"site_id\",\"new_site\",\"vehicle_id\",\"personnel_id\",\"work_type\",\"quantity\",\"unit\",\"guessed\",\"note\"}],",
    "\"expenses\":[{\"date\",\"amount\",\"category\",\"company\",\"vehicle_id\",\"supplier_id\",\"credit\",\"photo\":fotoğraf sırası(0..) veya null,\"note\"}],",
    "\"fuel\":[{\"date\",\"vehicle_id\",\"liters\",\"total\",\"photo\"}],\"photo_texts\":[string],\"questions\":[string]}",
  ].join("\n");
}

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// Mevcut kartlarla benzer ad (yeni müşteri açarken mükerrer kartı önler)
export function similarCard(name, cards) {
  const n = norm(name);
  if (!n) return null;
  for (const c of cards) {
    const m = norm(c.name);
    if (!m) continue;
    if (m === n) return c;
    const short = n.length < m.length ? n : m, long = n.length < m.length ? m : n;
    if (short.length >= 4 && (` ${long} `).includes(` ${short} `)) return c;
    if (Math.min(n.length, m.length) >= 5 && editDistance(n, m) <= 2) return c;
  }
  return null;
}
const inMessage = (name, message) => {
  const n = norm(name);
  return n.length >= 2 && (` ${norm(message)} `).includes(` ${n} `);
};
function validDate(s, today) {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const dt = new Date(s + "T12:00:00");
  if (!Number.isFinite(dt.getTime()) || dt.getDate() !== Number(m[3])) return null;
  const diff = (dt - new Date(today + "T12:00:00")) / 86400000;
  return diff > 1 || diff < -120 ? null : s;
}

export function validatePlan(plan, { message = "", d, today = todayStr(), photoCount = 0 } = {}) {
  const out = { works: [], expenses: [], fuel: [], questions: [], newCustomers: [] };
  plan = plan && typeof plan === "object" ? plan : {};
  const customers = live(d, "customers"), sites = live(d, "sites"), vehicles = live(d, "vehicles"),
    personnel = live(d, "personnel"), suppliers = live(d, "suppliers");
  const byId = (arr, id) => (id ? arr.find((x) => x.id === id) || null : null);
  const msgNums = writtenNumbers(message), msgAll = numbersInText(message);
  // Mesajda adı geçen aracın adındaki sayı ("14 tonluk") miktar sayılmaz
  for (const v of vehicles)
    if (inMessage(v.name, message)) for (const m of String(v.name).match(/\d+/g) || []) msgNums.delete(Number(m));
  const photoTexts = Array.isArray(plan.photo_texts) ? plan.photo_texts.map(String) : [];
  const photoNums = photoTexts.map(numbersInText);
  const newNames = new Map(); // aynı yeni müşteri tek kart

  for (const w of (Array.isArray(plan.works) ? plan.works : []).slice(0, 20)) {
    const issues = [];
    const r = { date: validDate(w.date, today) || today, customer_id: null, new_customer: null, site_id: null, new_site: null,
      vehicle_id: null, personnel_id: null, work_type: null, quantity: null, unit: null, note: String(w.note || "").slice(0, 200) };
    if (w.date && !validDate(w.date, today)) issues.push(`Tarih ${w.date} geçersiz; bugün alındı`);
    const c = byId(customers, w.customer_id);
    if (c) r.customer_id = c.id;
    else if (w.new_customer) {
      const twin = similarCard(w.new_customer, customers);
      if (twin) { r.customer_id = twin.id; issues.push(`"${w.new_customer}" mevcut müşteri "${twin.name}" ile eşleştirildi`); }
      else if (!inMessage(w.new_customer, message)) issues.push(`Yeni müşteri adı "${w.new_customer}" mesajda geçmiyor`);
      else {
        const key = norm(w.new_customer);
        if (!newNames.has(key)) newNames.set(key, String(w.new_customer).trim());
        r.new_customer = newNames.get(key);
      }
    } else if (w.customer_id) issues.push("Müşteri listede yok");
    const s = byId(sites, w.site_id);
    if (s && (!r.customer_id || s.customer_id === r.customer_id)) {
      r.site_id = s.id;
      if (!r.customer_id && !r.new_customer) r.customer_id = s.customer_id;
    } else if (s) issues.push("Şantiye bu müşteriye ait değil");
    else if (w.new_site && inMessage(w.new_site, message)) r.new_site = String(w.new_site).trim();
    const v = byId(vehicles, w.vehicle_id);
    if (v) r.vehicle_id = v.id; else issues.push("Araç seçilmeli");
    const p = byId(personnel, w.personnel_id);
    if (p) r.personnel_id = p.id;
    if (WORK_TYPES.includes(w.work_type)) r.work_type = w.work_type; else issues.push("İş türü seçilmeli");
    if (ASSIST_UNITS.includes(w.unit)) r.unit = w.unit; else issues.push("Birim seçilmeli");
    const q = w.quantity == null ? null : Number(w.quantity);
    if (q != null && Number.isFinite(q) && q > 0 && q < 1000) {
      r.quantity = q;
      if (!msgNums.has(q)) {
        r.guessed = true;
        issues.push(`Miktar ${q} mesajda yazmıyor (tahmin) — onaylayın`);
      }
    } else issues.push("Miktar yok");
    if (!r.customer_id && !r.new_customer) issues.push("Müşteri seçilmeli");
    r.issues = issues;
    r.ok = !!((r.customer_id || r.new_customer) && r.vehicle_id && r.work_type && r.unit && r.quantity && !r.guessed);
    out.works.push(r);
  }

  for (const e of (Array.isArray(plan.expenses) ? plan.expenses : []).slice(0, 10)) {
    const issues = [];
    const photo = Number.isInteger(e.photo) && e.photo >= 0 && e.photo < photoCount ? e.photo : null;
    const r = { date: validDate(e.date, today) || today, amount: null, category: EXPENSE_CATEGORIES.includes(e.category) ? e.category : "Diğer",
      company: String(e.company || "").slice(0, 80), vehicle_id: byId(vehicles, e.vehicle_id)?.id || null,
      supplier_id: byId(suppliers, e.supplier_id)?.id || null, credit: !!e.credit, photo, note: String(e.note || "").slice(0, 200) };
    const a = Number(e.amount);
    if (Number.isFinite(a) && a > 0) {
      const k = Math.round(a * 100) / 100;
      const seen = msgAll.has(k) || (photo != null && photoNums[photo]?.has(k)) || photoNums.some((x) => x.has(k));
      if (seen) r.amount = k;
      else issues.push(`Tutar ${a} mesajda/fişte görünmüyor`);
    } else issues.push("Tutar yok");
    if (r.credit && !r.supplier_id) issues.push("Veresiye için esnaf seçilmeli");
    r.issues = issues;
    r.ok = !!(r.amount && (!r.credit || r.supplier_id));
    out.expenses.push(r);
  }

  for (const f of (Array.isArray(plan.fuel) ? plan.fuel : []).slice(0, 10)) {
    const issues = [];
    const photo = Number.isInteger(f.photo) && f.photo >= 0 && f.photo < photoCount ? f.photo : null;
    const pool = [msgAll, ...photoNums];
    const ok = (n) => Number.isFinite(n) && n > 0 && pool.some((x) => x.has(Math.round(n * 100) / 100));
    const r = { date: validDate(f.date, today) || today, vehicle_id: byId(vehicles, f.vehicle_id)?.id || null,
      liters: ok(Number(f.liters)) ? Number(f.liters) : null, total: ok(Number(f.total)) ? Number(f.total) : null, photo };
    if (!r.vehicle_id) issues.push("Araç seçilmeli");
    if (!r.liters) issues.push("Litre mesajda/fişte yok");
    r.issues = issues;
    r.ok = !!(r.vehicle_id && r.liters);
    out.fuel.push(r);
  }
  out.questions = (Array.isArray(plan.questions) ? plan.questions : []).map(String).slice(0, 5);
  out.newCustomers = [...newNames.values()];
  out.photoTexts = photoTexts;
  return out;
}

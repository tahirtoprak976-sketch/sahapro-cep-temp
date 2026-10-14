// Asistan — fotoğraftan döküm/kantar fişi ve araç/personel belgesi (bitiş tarihi) okuma. SAF katman.
// Kural aynı: fiş numarası, tonaj, tarih ve plaka FOTOĞRAFIN YAZISINDA geçmeli; geçmeyen satır işaretsiz gelir.
import { isActive, todayStr, addDays } from "./core.js";
import { numbersInText } from "./ai-assist.js";
import { VEHICLE_DOCS, PERSONNEL_DOCS, documentOwner } from "./business.js";
import { foldTr } from "./parser.js";

const live = (d, s) => (d[s] || []).filter(isActive);
const norm = (s) => foldTr(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const alnum = (s) => foldTr(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
export const NO_EXPIRY = ["Ruhsat", "Kimlik / Kimlik Bilgisi", "SGK / İşe Giriş Evrakı", "Makine Tescil Belgesi"];
const MONTHS = ["ocak", "subat", "mart", "nisan", "mayis", "haziran", "temmuz", "agustos", "eylul", "ekim", "kasim", "aralik"];
const pad = (n) => String(n).padStart(2, "0");

function iso(y, m, d) {
  y = Number(y); m = Number(m); d = Number(d);
  if (y < 100) y += 2000;
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2100)) return null;
  const dt = new Date(`${y}-${pad(m)}-${pad(d)}T12:00:00`);
  return dt.getDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
}
// Metindeki tüm tarihler (15.03.2027, 15/3/27, 2027-03-15, 15 Mart 2027) → ISO kümesi
export function datesInText(text) {
  const out = new Set(), t = String(text || "");
  for (const m of t.matchAll(/(?<!\d)(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})(?!\d)/g)) { const x = iso(m[1], m[2], m[3]); if (x) out.add(x); }
  for (const m of t.matchAll(/(?<!\d)(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4}|\d{2})(?!\d)/g)) { const x = iso(m[3], m[2], m[1]); if (x) out.add(x); }
  const f = foldTr(t);
  for (const m of f.matchAll(/(?<!\d)(\d{1,2})\s+([a-z]+)\s+(\d{4})(?!\d)/g)) {
    const mi = MONTHS.indexOf(m[2]);
    if (mi >= 0) { const x = iso(m[3], mi + 1, m[1]); if (x) out.add(x); }
  }
  return out;
}
const isoOk = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? iso(...String(s).split("-")) : null);
const photoIdx = (p, count) => (Number.isInteger(Number(p)) && Number(p) >= 0 && Number(p) < count ? Number(p) : null);
const vehicleInText = (v, text) => {
  const t = alnum(text);
  const p = alnum(v.plate || "");
  return p.length >= 5 && t.includes(p);
};

// ---- Döküm / kantar fişi ----
// Her fiş bir "Döküm Fişi" belgesi olur; sahibi bir sefer işidir (varsa o gün o aracın sefer işi, yoksa yeni 1 sefer)
export function validateTickets(plan, { d, today = todayStr(), photoTexts = [], photoCount = 0 } = {}) {
  const out = [];
  const vehicles = live(d, "vehicles"), dumps = live(d, "dump_sites");
  const used = new Set();
  for (const t of (Array.isArray(plan?.tickets) ? plan.tickets : []).slice(0, 20)) {
    const issues = [];
    const photo = photoIdx(t.photo, photoCount);
    const text = photo != null ? String(photoTexts[photo] || "") : "";
    if (photo == null) issues.push("Hangi fotoğraf olduğu belli değil");
    else if (!text.trim()) issues.push("Fotoğrafın yazısı okunamadı");
    const r = { photo, date: null, vehicle_id: null, ticket_no: "", tonnage: null, dump_site_id: null, dump_site_name: "", material: String(t.material || "").slice(0, 40), customer_id: null, site_id: null, link: "" };
    // Fiş no: yazıda birebir geçmeli
    const no = String(t.ticket_no || "").trim();
    if (no && alnum(no).length >= 2 && alnum(text).includes(alnum(no))) r.ticket_no = no.slice(0, 40);
    else issues.push(no ? `Fiş no "${no}" fotoğrafta yok` : "Fiş numarası okunamadı");
    // Tarih: fişte yazan tarih
    const dates = datesInText(text);
    const dt = isoOk(t.date);
    if (dt && dates.has(dt) && dt <= addDays(today, 1)) r.date = dt;
    else { r.date = today; issues.push(dt ? `Tarih ${dt} fişte yok, kontrol edin` : "Fiş tarihi okunamadı, bugün yazıldı"); }
    // Tonaj (net)
    if (t.tonnage != null && t.tonnage !== "") {
      const n = Math.round(Number(String(t.tonnage).replace(",", ".")) * 100) / 100;
      const nums = numbersInText(text);
      // Kantar kg yazabilir: 18.420 kg ↔ 18,42 ton
      if (n > 0 && n < 200 && (nums.has(n) || nums.has(Math.round(n * 1000)))) r.tonnage = n;
      else issues.push(`Tonaj ${t.tonnage} fişte yok`);
    }
    // Araç: plaka fişte yazmalı
    const byId = vehicles.find((v) => v.id === t.vehicle_id);
    const byPlate = t.plate ? vehicles.find((v) => alnum(v.plate || "") && alnum(v.plate) === alnum(t.plate)) : null;
    const veh = byId || byPlate || vehicles.find((v) => vehicleInText(v, text)) || null;
    if (veh && (vehicleInText(veh, text) || !veh.plate)) r.vehicle_id = veh.id;
    else if (veh) { r.vehicle_id = veh.id; issues.push(`${veh.plate} plakası fişte görünmüyor`); }
    else issues.push(t.plate ? `Plaka ${t.plate} araç listesinde yok` : "Araç bulunamadı");
    // Döküm yeri
    const ds = dumps.find((x) => x.id === t.dump_site_id) || (t.dump_site_name ? dumps.find((x) => norm(x.name) && (` ${norm(t.dump_site_name)} `).includes(` ${norm(x.name)} `)) : null);
    if (ds) r.dump_site_id = ds.id;
    else if (t.dump_site_name && (` ${norm(text)} `).includes(` ${norm(t.dump_site_name)} `)) r.dump_site_name = String(t.dump_site_name).slice(0, 60);
    if (live(d, "customers").some((c) => c.id === t.customer_id)) r.customer_id = t.customer_id;
    const site = live(d, "sites").find((s) => s.id === t.site_id);
    if (site && site.customer_id === r.customer_id) r.site_id = site.id;
    // Aynı fiş iki kez okunmasın (aynı fotoğraf/aynı numara) ve daha önce kaydedilmiş mi
    const key = alnum(r.ticket_no);
    if (key && used.has(key)) { issues.push("Aynı fiş iki kez"); r.dup = true; }
    used.add(key);
    if (key && live(d, "documents").some((x) => x.category === "Döküm Fişi" && alnum(x.doc_no) === key)) { issues.push("Bu fiş numarası zaten kayıtlı"); r.dup = true; }
    // Bağlanacak iş: aynı gün aynı aracın sefer işi
    const works = r.vehicle_id ? live(d, "work_records").filter((w) => w.date === r.date && w.vehicle_id === r.vehicle_id && w.unit === "Sefer") : [];
    r.works = works.map((w) => w.id);
    r.link = works[0]?.id || "new";
    if (!r.customer_id && works[0]) r.customer_id = works[0].customer_id;
    r.issues = issues;
    r.ok = !!(photo != null && r.ticket_no && r.vehicle_id && !r.dup && !issues.some((x) => /fişte yok|görünmüyor|okunamadı/.test(x)));
    out.push(r);
  }
  return out;
}

// Gün/araç bazında fiş sayısı ↔ kayıtlı sefer (Bugün panosu için)
export function ticketReconcile(data, { today = todayStr(), days = 7 } = {}) {
  const since = addDays(today, -days);
  const works = live(data, "work_records");
  const workById = new Map(works.map((w) => [w.id, w]));
  const tickets = new Map();
  for (const doc of live(data, "documents")) {
    if (doc.category !== "Döküm Fişi" || !doc.date || doc.date < since || doc.date > today) continue;
    const vid = doc.ticket_vehicle_id || workById.get(doc.owner_id)?.vehicle_id;
    if (!vid) continue;
    const k = doc.date + "|" + vid;
    tickets.set(k, (tickets.get(k) || 0) + 1);
  }
  const out = [];
  for (const [k, n] of tickets) {
    const [date, vid] = k.split("|");
    const sefer = works.filter((w) => w.date === date && w.vehicle_id === vid && w.unit === "Sefer").reduce((s, w) => s + (Number(w.quantity) || 0), 0);
    if (n !== sefer) out.push({ date, vehicle_id: vid, tickets: n, sefer });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

// ---- Araç / personel belgesi (muayene, sigorta, ehliyet, SRC…) → bitiş tarihi ----
export const ASSIST_DOC_TYPES = [...VEHICLE_DOCS, ...PERSONNEL_DOCS];
export function validateDocuments(plan, { d, today = todayStr(), photoTexts = [], photoCount = 0 } = {}) {
  const out = [];
  for (const x of (Array.isArray(plan?.documents) ? plan.documents : []).slice(0, 10)) {
    const issues = [];
    const photo = photoIdx(x.photo, photoCount);
    const text = photo != null ? String(photoTexts[photo] || "") : "";
    if (photo == null) issues.push("Hangi fotoğraf olduğu belli değil");
    const category = ASSIST_DOC_TYPES.includes(x.category) ? x.category : null;
    if (!category) issues.push("Belge türü seçilmeli");
    const owner_type = category ? documentOwner(category) : x.owner_type === "personnel" ? "personnel" : "vehicle";
    const store = owner_type === "personnel" ? "personnel" : "vehicles";
    const list = live(d, store);
    let owner = list.find((o) => o.id === x.owner_id) || null;
    if (!owner && owner_type === "vehicle") owner = list.find((v) => vehicleInText(v, text)) || null;
    if (!owner && owner_type === "personnel") owner = list.find((p) => norm(p.name).length >= 5 && (` ${norm(text)} `).includes(` ${norm(p.name)} `)) || null;
    if (!owner) issues.push(owner_type === "personnel" ? "Personel seçilmeli" : "Araç seçilmeli");
    else if (owner_type === "vehicle" && owner.plate && !vehicleInText(owner, text)) issues.push(`${owner.plate} plakası belgede görünmüyor`);
    else if (owner_type === "personnel" && !norm(text).includes(norm(owner.name).split(" ")[0])) issues.push(`${owner.name} adı belgede görünmüyor`);
    const dates = datesInText(text);
    const r = { photo, category, owner_type, owner_id: owner?.id || null, doc_no: "", date: null, expiry_date: null };
    const no = String(x.doc_no || "").trim();
    if (no && alnum(no).length >= 3 && alnum(text).includes(alnum(no))) r.doc_no = no.slice(0, 40);
    else issues.push(no ? `Belge no "${no}" belgede yok` : "Belge numarası okunamadı");
    const ex = isoOk(x.expiry_date);
    if (ex && dates.has(ex)) r.expiry_date = ex;
    else if (!NO_EXPIRY.includes(category)) issues.push(ex ? `Bitiş ${ex} belgede yok` : "Bitiş tarihi okunamadı");
    const st = isoOk(x.date);
    if (st && dates.has(st)) r.date = st;
    else { r.date = r.expiry_date && r.expiry_date < today ? r.expiry_date : today; if (st) issues.push(`Düzenleme tarihi ${st} belgede yok, bugün yazıldı`); }
    if (r.expiry_date && r.date > r.expiry_date) r.date = r.expiry_date;
    if (r.expiry_date && r.expiry_date < today) issues.push("Bu belgenin süresi dolmuş");
    r.issues = issues;
    r.ok = !!(photo != null && category && r.owner_id && r.doc_no && (r.expiry_date || NO_EXPIRY.includes(category)) && !issues.some((i) => /görünmüyor|belgede yok/.test(i)));
    out.push(r);
  }
  return out;
}

// Sesli not: Gemini'nin duyduğu metin mesaj gibi doğrulanır; çok uzun/boşsa alınmaz
export function heardText(plan) {
  const t = typeof plan?.heard_text === "string" ? plan.heard_text.replace(/<\/?mesaj>/gi, "").trim() : "";
  return t.slice(0, 2000);
}

export const DOCS_PROMPT = [
  "Fotoğraf bir DÖKÜM / KANTAR fişiyse \"tickets\" dizisine yaz: {\"photo\":fotoğraf sırası,\"ticket_no\",\"date\":YYYY-MM-DD,\"plate\",\"vehicle_id\",\"tonnage\":net ton,\"dump_site_id\",\"dump_site_name\",\"material\",\"customer_id\",\"site_id\"}. Fiş no, tarih, plaka ve tonajı fişte yazdığı gibi oku; yoksa null.",
  "Fotoğraf bir ARAÇ veya PERSONEL BELGESİYSE (muayene, sigorta, kasko, ehliyet, SRC, psikoteknik…) \"documents\" dizisine yaz: {\"photo\",\"category\" (" + [...VEHICLE_DOCS, ...PERSONNEL_DOCS].join(", ") + "),\"owner_id\" (araç ya da personel ID),\"doc_no\",\"date\":düzenleme YYYY-MM-DD,\"expiry_date\":bitiş/geçerlilik YYYY-MM-DD}. Belge fişi gider değildir; expenses'e yazma.",
  "Ses kaydı varsa söylenenleri \"heard_text\" alanına AYNEN yaz (rakamları rakamla), sonra ses kaydını mesaj gibi işle; quote değerlerini heard_text'ten kopyala.",
].join("\n");

export function docsSchemaProps() {
  const NS = { type: ["string", "null"] }, NN = { type: ["number", "null"] }, NI = { type: ["integer", "null"] };
  return {
    tickets: { type: "array", items: { type: "object", properties: { photo: NI, ticket_no: NS, date: NS, plate: NS, vehicle_id: NS, tonnage: NN, dump_site_id: NS, dump_site_name: NS, material: NS, customer_id: NS, site_id: NS } } },
    documents: { type: "array", items: { type: "object", properties: { photo: NI, category: NS, owner_id: NS, doc_no: NS, date: NS, expiry_date: NS } } },
    heard_text: NS,
  };
}

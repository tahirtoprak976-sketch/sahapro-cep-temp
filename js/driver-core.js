// Şoför ekranı — SAF katman. Telefonlar arası ücretsiz aktarım WhatsApp ile:
// Patron şoföre bir bağlantı gönderir (içinde şoför, araç, müşteri/şantiye/döküm listesi; sıkıştırılmış). Şoför kayıtlarını girer,
// "Patrona gönder" okunur bir metin + "SP1:" kodu (kayıtların kendisi) olarak WhatsApp'tan gider. Patronun asistanı kodu çözer:
// kartlar Gemini'siz, birebir dolar; aynı kayıt (kimlik) ikinci kez gelirse atlanır.
import { isActive, WORK_TYPES } from "./core.js";

const live = (d, s) => (d[s] || []).filter(isActive);
const b64u = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64u = (s) => { const t = atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4)); const out = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) out[i] = t.charCodeAt(i); return out; };
async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
export async function pack(obj) { return b64u(await pipe(new TextEncoder().encode(JSON.stringify(obj)), new CompressionStream("deflate-raw"))); }
export async function unpack(code) { return JSON.parse(new TextDecoder().decode(await pipe(unb64u(code), new DecompressionStream("deflate-raw")))); }

export const DRIVER_TYPES = ["Hafriyat Nakliye", "Moloz Nakliye", "Mıcır Nakliye", "Kum Nakliye", "Çöp Nakliye", "Makine Çalışması", "Kazı", "Yükleme"].filter((t) => WORK_TYPES.includes(t));
export const DRIVER_UNITS = ["Sefer", "Saat", "Ton", "Yevmiye"];
export const FUEL_SOURCES = ["Depo Tankı", "Akaryakıt İstasyonu", "Müşteri Verdi"];

// Patronun telefonunda: şoför bağlantısının içeriği
export function driverConfig(d, { personnel_id, vehicle_id = null, company = "", issued = "" }) {
  const p = live(d, "personnel").find((x) => x.id === personnel_id);
  if (!p) throw new Error("Personel seçin");
  const cust = live(d, "customers").filter((c) => !c.internal).sort((a, b) => a.name.localeCompare(b.name, "tr")).slice(0, 400);
  const cs = new Set(cust.map((c) => c.id));
  return {
    v: 1, co: company, iss: issued, p: [p.id, p.name], veh: vehicle_id || p.vehicle_id || live(d, "vehicles").find((v) => v.assignee_id === p.id)?.id || null,
    V: live(d, "vehicles").map((v) => [v.id, v.plate && v.plate !== v.name ? `${v.name} (${v.plate})` : v.name]),
    C: cust.map((c) => [c.id, c.name]),
    S: live(d, "sites").filter((s) => cs.has(s.customer_id)).map((s) => [s.id, s.name, s.customer_id]),
    D: live(d, "dump_sites").map((s) => [s.id, s.name]),
    Q: live(d, "quarries").map((s) => [s.id, s.name]),
    Y: live(d, "customers").find((c) => c.internal)?.id || null,
  };
}

const nm = (list, id) => (list || []).find((x) => x[0] === id)?.[1] || "";
const fmtDate = (s) => { const [y, m, d] = String(s).split("-"); return `${d}.${m}.${y}`; };
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Okunur satır (patron ve grup okusun) — ad ve sayılar burada geçtiği için asistanın doğrulaması da geçer
export function entryLine(e, cfg) {
  if (e.k === "f") return `⛽ ${fmtDate(e.date)} · ${nm(cfg.V, e.vid)} · ${e.L} litre · ${e.src === "Müşteri Verdi" ? (nm(cfg.C, e.cid) || "müşteri") + " verdi" : e.src === "Depo Tankı" ? "depodan" : "istasyondan"}${e.tl ? ` · ${e.tl} TL` : ""}${e.km ? ` · km ${e.km}` : ""}${e.hr ? ` · saat ${e.hr}` : ""}`;
  const cust = e.cid === cfg.Y ? "kendi depodan çıkış" : nm(cfg.C, e.cid) || e.cn || "müşteri ?";
  const dump = nm(cfg.D, e.ds) || e.dn || "";
  return `🚚 ${fmtDate(e.date)} · ${nm(cfg.V, e.vid)} · ${cust}${e.sid ? " / " + nm(cfg.S, e.sid) : ""} · ${e.wt} ${e.q} ${String(e.u).toLocaleLowerCase("tr-TR")}${e.mat ? " " + e.mat : ""}${dump ? " → " + dump : ""}${e.ton ? ` · ${e.ton} ton` : ""}${e.slip ? ` · fiş ${e.slip}` : ""}${e.ph ? ` · 📷${e.ph}` : ""}${e.note ? ` · ${e.note}` : ""}`;
}
export async function driverMessage(entries, cfg) {
  const code = await pack({ v: 1, p: cfg.p[0], n: cfg.p[1], e: entries.map(({ sent, ...e }) => e) });
  return [`📋 SAHAPRO şoför kaydı — ${cfg.p[1]}`, ...entries.map((e) => entryLine(e, cfg)), `SP1:${code}`].join("\n");
}

// Patronun tarafı: metindeki kodlar
const CODE = /SP1:([A-Za-z0-9_-]{8,})/g;
export async function extractPayloads(text) {
  const out = [];
  for (const m of String(text || "").matchAll(CODE)) { try { const p = await unpack(m[1]); if (p?.v === 1 && Array.isArray(p.e)) out.push(p); } catch (e) { /* bozuk kod: atla */ } }
  return out;
}
// Şoför mesajlarının okunur kısmı ve kod satırı çıkarılınca kalan serbest metin (Gemini'ye yalnız bu gider)
export function stripDriverBlocks(text) {
  return String(text || "").split("\n").filter((l) => !/SAHAPRO şoför kaydı|SP1:[A-Za-z0-9_-]{8,}|^(?:\[[^\]]*\]\s*[^:]{1,60}:\s*)?[🚚⛽] \d{2}\.\d{2}\.\d{4} · /u.test(l)).join("\n").trim();
}

// Kodlardan asistan planı (Gemini'nin döndürdüğü biçimle aynı) + her işin ek bilgisi (kimlik, fotoğraf, ton)
export function payloadsToPlan(payloads, d, { photoCount = 0 } = {}) {
  const works = [], fuel = [], meta = [], fuelMeta = [];
  let photo = 0;
  const has = (s, id) => !!id && live(d, s).some((x) => x.id === id);
  for (const p of payloads) for (const e of p.e) {
    if (e.k === "f") {
      fuel.push({ date: e.date, vehicle_id: has("vehicles", e.vid) ? e.vid : null, liters: Number(e.L) || null, total: Number(e.tl) || null, km: Number(e.km) || null, machine_hours: Number(e.hr) || null, source: FUEL_SOURCES.includes(e.src) ? e.src : "Depo Tankı", customer_id: has("customers", e.cid) ? e.cid : null, photo: null });
      fuelMeta.push({ driver_entry_id: e.id });
      continue;
    }
    const photos = [];
    for (let i = 0; i < (Number(e.ph) || 0) && photo < photoCount; i++) photos.push(photo++);
    works.push({
      date: e.date, customer_id: has("customers", e.cid) ? e.cid : null, new_customer: !has("customers", e.cid) && e.cn ? e.cn : null,
      site_id: has("sites", e.sid) ? e.sid : null, vehicle_id: has("vehicles", e.vid) ? e.vid : null, personnel_id: has("personnel", p.p) ? p.p : null,
      work_type: e.wt, quantity: Number(e.q), unit: e.u, date_source: "mesaj", reporter: p.n || null, guessed: false,
      dump_site_id: has("dump_sites", e.ds) ? e.ds : null, to_place: !has("dump_sites", e.ds) && e.dn ? e.dn : null, to_is_dump: !!e.dn,
      quarry_id: has("quarries", e.qy) ? e.qy : null, slip_no: e.slip || "", material: e.mat || "", description: [e.mat, e.note].filter(Boolean).join(" · "), note: e.note || "",
    });
    meta.push({ driver_entry_id: e.id, photos, tonnage: Number(e.ton) || null, reporter: p.n || null });
  }
  return { plan: { works, fuel }, meta, fuelMeta };
}

// Daha önce alınmış şoför kayıtları
export function seenDriverIds(d) {
  const s = new Set();
  for (const st of ["work_records", "fuel_records"]) for (const r of live(d, st)) if (r.driver_entry_id) s.add(r.driver_entry_id);
  return s;
}

// Gemini mesajdan hiç kayıt çıkarmadığında YEREL okuma — SAF katman, kayıt yazmaz.
// "Kaydedilecek bir şey bulunamadı" demek yerine mesajda görülen olası iş / yakıt satırları, EKSİK bilgileriyle gösterilir.
// Hiçbiri kendiliğinden kaydedilmez ya da işaretlenmez; kullanıcı formda tamamlayıp kaydeder. Eksik bilgi uydurulmaz.
import { analyzeMessage } from "./message-engine.js";

const FUEL = /(\d+(?:[.,]\d+)?)\s*(?:lt|litre|l)\b[^\n.]*?(?:mazot|motorin|yakıt|yakit)|(?:mazot|motorin|yakıt|yakit)[^\n.]*?(\d+(?:[.,]\d+)?)\s*(?:lt|litre|l)\b/giu;
const RECEIVED = /(alındı|alindi|aldık|aldik|aldım|aldim|verdi|getirdi|gönderdi|gonderdi)/i;
const FROM_SITE = /(şantiye|santiye|müşteri|musteri)[a-zçğıöşü]*/i;

export function localCandidates(message, d, today) {
  const text = String(message || "");
  const out = { works: [], fuel: [] };
  let rows = [];
  try { rows = analyzeMessage({ id: "yerel", text, date: today, status: "Taslak" }, d).rows || []; } catch (e) { rows = []; }
  const nm = (s, id) => (d[s] || []).find((x) => x.id === id)?.name || "";
  for (const r of rows) {
    if (r.kind && r.kind !== "work") continue;
    if (!(r.customer_id || r.work_type || r.quantity)) continue;
    const missing = [];
    if (!r.customer_id) missing.push("müşteri");
    if (!r.work_type) missing.push("iş türü");
    if (!(Number(r.quantity) > 0) || !r.unit) missing.push("miktar ve birim (saat / sefer / yevmiye) yazmıyor");
    if (!r.vehicle_id) missing.push("araç");
    out.works.push({ date: r.date || today, customer_id: r.customer_id || null, site_id: r.site_id || null, vehicle_id: r.vehicle_id || null, personnel_id: r.personnel_id || null,
      work_type: r.work_type || null, quantity: Number(r.quantity) > 0 ? Number(r.quantity) : null, unit: r.unit || null, description: String(r.raw_message || r.description || "").replace(/^\[[^\]]*\]\s*[^:]{1,40}:\s*/, "").slice(0, 200),
      label: [nm("customers", r.customer_id), nm("sites", r.site_id), r.work_type].filter(Boolean).join(" · ") || "iş", missing });
  }
  // Yakıt: yalnız litre ve yakıt kelimesi birlikteyse. Kaynak (müşteri mi verdi, depodan mı, istasyon mu) ve araç kendiliğinden seçilmez.
  const lines = text.split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i] + (lines[i + 1] && !/^\s*\[?\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(lines[i + 1]) ? " " + lines[i + 1] : "");
    for (const m of ln.matchAll(FUEL)) {
      const L = Number(String(m[1] || m[2]).replace(",", "."));
      if (!(L > 0) || out.fuel.some((f) => f.liters === L && f.line === i)) continue;
      const fromCustomer = RECEIVED.test(ln) && FROM_SITE.test(ln);
      out.fuel.push({ line: i, liters: L, date: out.works[0]?.date || today, customer_id: fromCustomer ? out.works[0]?.customer_id || null : null,
        hint: fromCustomer ? "müşteriden / şantiyeden alınmış görünüyor (müşteri verdi olabilir) — kaynağı doğrulayın" : "kaynağı yazmıyor (depo, istasyon ya da müşteri)",
        missing: ["hangi araca verildiği", ...(fromCustomer ? [] : ["kaynak"])] });
    }
  }
  return out;
}

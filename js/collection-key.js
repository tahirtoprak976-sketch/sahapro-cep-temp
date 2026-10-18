// Tahsilat KAYNAK KİMLİĞİ ve tekrar / yeni ödeme kararı — SAF katman, kayıt yazmaz.
//
// Kimlik nasıl üretilir:
//   kaynak  = WhatsApp dışa aktarım satırının başlığı ("12.10.2026 14:03 - Ali:") varsa o satır  → "wa:<başlık>"
//             yoksa mesaj metninin kendisi (elle yapıştırma; KESİN kaynak kimliği yok)        → "txt:<metin>"
//   satır   = mesajdaki ödeme ifadesinin tutarı + aynı kaynakta aynı tutarın kaçıncı ödeme ifadesi olduğu
//   anahtar = "col-" + sha256(kaynak | tutar | sıra)[:32]
// Karar (aynı anahtarlı kayıt varsa):
//   aynı içerik (müşteri, tutar, tarih, şekil, banka) → wa: kaynak: kesin TEKRAR (yazılmaz)
//                                                    → txt: kaynak: kullanıcıya "tekrar mı, yeni ödeme mi" sorulur
//   farklı içerik                                     → ÇAKIŞMA: yazılmaz (aynı kaynak satırı iki farklı ödeme olamaz)
// Müşteri + tarih + tutar eşitliği TEK BAŞINA tekrar sayılmaz: yalnız uyarı ve açık seçim (aynı gün aynı tutarda iki gerçek ödeme olabilir).
// Kullanıcı "yeni ödeme" derse: anahtar = ilk anahtar + ":yeni:<n>" (n sıra no; iki sekme aynı n'yi üretir → tek kayıt),
// kayıtta repeat_of (ilk kaydın kimliği) ve new_payment_reason (gerekçe) tutulur.
import { moneyMentions } from "./money-roles.js";

const WA_HEAD = /^\s*\[?(\d{1,2}[./]\d{1,2}[./]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–]?\s*([^:\n]{1,40}):/;
export const normText = (s) => String(s || "").replace(/\s+/g, " ").trim();

// Tutarın geçtiği satırın WhatsApp başlığı (yoksa null)
export function waLineId(message, pos) {
  const text = String(message || "");
  const st = text.lastIndexOf("\n", pos - 1) + 1;
  const line = text.slice(st, text.indexOf("\n", pos) < 0 ? text.length : text.indexOf("\n", pos));
  const m = line.match(WA_HEAD);
  return m ? `wa:${m[1].replace(/\//g, ".")} ${m[2]} ${normText(m[3]).toLocaleLowerCase("tr-TR")}` : null;
}

// Tahsilat kartlarına mesajdaki ödeme ifadelerini dağıtır. cards: [{amount, customer_id}]; owns(mention, customerId) → bool
// Dönüş: her kart için { src: {source, amount, occ, quote} | null, extra: bool }
export function assignPaymentSources(message, cards, owns = () => false) {
  const ms = moneyMentions(message).filter((m) => m.role === "payment" || m.role === "payment_possible");
  const used = new Set(), picks = cards.map(() => null);
  // Önce cümlesindeki müşteriyle eşleşen kartlar, sonra kalanlar (yanlış müşterili kart doğru kartın ödemesini almaz)
  for (const pass of [true, false])
    cards.forEach((c, i) => {
      if (!c.amount || picks[i]) return;
      const pool = ms.filter((m) => m.n === c.amount && !used.has(m) && (!pass || owns(m, c.customer_id)));
      if (pool.length) { picks[i] = pool[0]; used.add(pool[0]); }
    });
  return cards.map((c, i) => {
    const pick = picks[i];
    if (!pick) return { src: null, extra: !!c.amount && ms.some((m) => m.n === c.amount) };
    const source = waLineId(message, pick.start) || "txt:" + normText(message);
    // Aynı kaynakta aynı tutarın kaçıncı ödeme ifadesi
    const occ = ms.filter((m) => m.n === c.amount && m.start < pick.start && (waLineId(message, m.start) || "txt:" + normText(message)) === source).length;
    return { src: { source, amount: c.amount, occ, quote: pick.clause }, extra: false };
  });
}
export async function sha256hex(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export async function collectionKey(src) {
  return "col-" + (await sha256hex(`${src.source}|${src.amount}|${src.occ}`)).slice(0, 32);
}
// Kayıt içeriği: aynı anahtarla farklı içerik ÇAKIŞMADIR
export function collectionContent(f) {
  return { customer_id: f.customer_id || null, amount: Math.round(Number(f.amount) * 100) / 100, date: f.date || null,
    method: f.payment_method || f.method || null, bank_account_id: (f.payment_method || f.method) === "Havale" ? f.bank_account_id || null : null };
}
export function sameContent(a, b) {
  const x = collectionContent(a), y = collectionContent(b);
  return Object.keys(x).every((k) => x[k] === y[k]);
}
// existing: aktif tahsilat kayıtları (cash_records). key: anahtar. fields: yazılacak kayıt.
// "new" | "repeat" (kesin tekrar) | "ask" (elle yapıştırma: kullanıcıya sor) | "conflict"
export function collectionDecision(existing, key, fields, source) {
  const old = existing.find((x) => !x.deleted_at && x.request_id === key);
  if (!old) return { kind: "new" };
  if (!sameContent(old, fields)) return { kind: "conflict", old };
  return { kind: String(source || "").startsWith("wa:") ? "repeat" : "ask", old };
}
// Kullanıcı "yeni ödeme" dediğinde sıradaki anahtar (deterministik: iki sekme aynı anahtarı üretir)
export function nextNewKey(existing, key) {
  const n = existing.filter((x) => !x.deleted_at && String(x.request_id || "").startsWith(key + ":yeni:")).length;
  return key + ":yeni:" + (n + 1);
}
// Aynı müşteri + tarih + tutar (farklı kaynak): KESİN tekrar değildir, yalnız uyarı
export function similarCollections(existing, fields, key) {
  const c = collectionContent(fields);
  return existing.filter((x) => !x.deleted_at && x.cash_type === "Müşteriden Para Alındı" && x.request_id !== key
    && x.customer_id === c.customer_id && x.date === c.date && Math.round(Number(x.amount) * 100) / 100 === c.amount);
}

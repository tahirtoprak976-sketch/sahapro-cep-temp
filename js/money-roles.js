// Mesajdaki para ifadeleri ve ROLLERİ — SAF katman, kayıt yazmaz.
// Aynı mesajda iş ve ödeme birlikte olabilir. Bir sayının "birim fiyat" sayılması için açık birim fiyat ifadesi
// gerekir; ödeme, ödeme sözü, toplam bedel ya da belirsiz tutar birim fiyat alanına TAŞINMAZ ve miktara bölünmez.
// Roller:
//   unit_price        "sefer fiyatı 3.000", "saatlik 1.500", "3.000 TL/sefer", "seferi 3.000'den"
//   total             "toplam 20.000", "hepsi 20.000 eder" (işin toplam bedeli; birim fiyat değildir)
//   payment           "ödeme geldi", "ödedi", "havale yaptı/attı", "tahsil", "hesaba yatırdı", "para verdi", "nakit aldık"
//   payment_possible  yalnız "… TL verdi" (ödeme olabilir, doğrulanmalı)
//   promise           "yarın verecek", "ödeyecek", "haftaya"  (tahsilat değildir)
//   negative          "henüz vermedi", "ödemedi", "gelmedi"   (tahsilat değildir)
//   corrected_away    "20.000 değil 10.000 ödedi" içindeki 20.000 (geçersizleşen tutar)
//   price_quote       "fiyat verdi", "teklif"                  (ödeme değildir)
//   unknown           rolü belirsiz tutar → hiçbir alana kendiliğinden yazılmaz
const fold = (s) => String(s || "").toLocaleLowerCase("tr-TR");
// Türkçe tutar: 20.000 · 20.000,50 · 20000 · 20000,5 · 1.250.000 · 20 bin
const NUM = /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)(?:\s*(bin|milyon)(?![\p{L}]))?/gu;
const CUR = /^\s*(?:tl|₺|lira|try)\b|^\s*₺/i;
const QTY_AFTER = /^\s*(?:sefer|sfr|tur|saat|sa\b|st\b|ton|lt|litre|km|m3|m³|metreküp|adet|gün|yevmiye|kg|kamyon|araç|kişi|%)/i;
export function parseTrNumber(raw) {
  let s = String(raw);
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
// Yan cümle sınırları: ". , ; ! ? \n" + boşluk (sayı içindeki nokta/virgül sınır değildir)
function clauseAround(text, start, end) {
  let st = 0;
  for (const b of text.slice(0, start).matchAll(/[.,;!?](?=\s)|\n/g)) st = b.index + 1;
  let en = text.slice(end).search(/[.,;!?](\s|$)|\n/);
  en = en < 0 ? text.length : end + en;
  return { st, en, text: text.slice(st, en) };
}
const R = {
  negative: /(?:vermedi|ödemedi|odemedi|yatırmadı|yatirmadi|göndermedi|gondermedi|gelmedi|almadık|almadik|ödeme yok|odeme yok|henüz|henuz)/,
  promise: /(?:verecek|ödeyecek|odeyecek|gönderecek|gonderecek|yatıracak|yatiracak|atacak|ödeyeceğ|odeyeceg|vereceğ|vereceg|yarın|yarin|haftaya|ay sonu|söz verdi|soz verdi|vadeli)/,
  price_quote: /(?:fiyat verdi|fiyat istedi|teklif)/,
  payment: /(?:ödedi|odedi|ödediler|odediler|ödeme (?:geldi|yaptı|yapti|aldık|aldik|alındı|alindi|gönderdi|gonderdi)|ödendi|odendi|tahsil|havale|eft\b|hesaba (?:geçti|gecti|yatırdı|yatirdi|attı|atti|geldi)|yatırdı|yatirdi|para (?:verdi|gönderdi|gonderdi|attı|atti|geldi)|nakit (?:verdi|aldık|aldik|aldım|aldim|geldi)|parayı aldık|parayi aldik|aldık|aldik|aldım|aldim|(?:tl|₺|lira)\s+(?:geldi|yattı|yatti|alındı|alindi)|paras[ıi]\s+(?:\S+\s+){0,3}(?:geldi|alındı|alindi|ödendi|odendi|yattı|yatti))/,
  payment_possible: /\bverdi\b/,
  unit_bare: /(?:^|\s)(?:sefer|saat|ton|yevmiye)[ıiuü]?\s*$/,
  total: /(?:toplam|tutar|tamamı|tamami|hepsi|eder\b|bedel)/,
  unit_before: /(?:(?:sefer|saat|ton|yevmiye|gün|gun|günlük|gunluk|adet|m3|metreküp|metrekup)[ıiuü]?\s*(?:başı|basi|başına|basina|fiyatı|fiyati|ücreti|ucreti)|birim fiyat[ıi]?|saatlik|seferlik|günlük|gunluk|tonu|seferi|saati)\s*[:=]?\s*$/,
  unit_after: /^\s*(?:tl|₺|lira)?\s*(?:\/\s*(?:sefer|saat|ton|gün|gun|yevmiye|adet)|'?(?:den|dan|ten|tan)\b|(?:sefer|saat|ton)\s*(?:başı|basi))/,
};
export function moneyMentions(message) {
  const text = String(message || "");
  const out = [];
  for (const m of text.matchAll(NUM)) {
    const start = m.index, end = start + m[0].length;
    const after = text.slice(end, end + 30), before = text.slice(Math.max(0, start - 40), start);
    if (/[\d.,]$/.test(text.slice(0, start)) || /^[\d]/.test(text.slice(end))) continue;
    // tarih / saat / plaka parçası değil
    if (/\d{1,2}[.:/-]$/.test(before) && /^[.:/-]\d/.test(text.slice(end))) continue;
    if (/\b\d{2}\s*[A-Za-zÇĞİÖŞÜçğıöşü]{1,3}\s*$/.test(before)) continue; // plaka (34 KM 101)
    let n = parseTrNumber(m[1]);
    if (n == null) continue;
    if (m[2]) n = Math.round(n * (/milyon/i.test(m[2]) ? 1e6 : 1e3) * 100) / 100;
    const cur = CUR.test(after) || !!m[2];
    if (QTY_AFTER.test(after) && !cur) continue; // "5 sefer", "50 litre" para değil
    if (!cur && n < 100) continue;
    const cl = clauseAround(text, start, end);
    const c = fold(cl.text), b = fold(text.slice(cl.st, start)), a = fold(text.slice(end, cl.en));
    let role = "unknown";
    // "X değil Y": değil'den önceki tutar geçersiz
    if (/^\s*(?:tl|₺|lira)?\s*(?:değil|degil)\b/.test(a)) role = "corrected_away";
    else if (R.negative.test(c)) role = "negative";
    else if (R.promise.test(c)) role = "promise";
    else if (R.price_quote.test(c)) role = "price_quote";
    else if (R.unit_before.test(b) || R.unit_after.test(a)) role = "unit_price";
    else if (R.payment.test(c)) role = "payment";
    // Yalın "sefer 1800" / "saati 1500": birim kelimesinin ÖNÜNDE miktar yoksa birim fiyattır ("5 sefer 20.000" değildir)
    else if (R.unit_bare.test(b) && !/\d[\d.,]*\s*(?:sefer|saat|ton|yevmiye|gün|gun)[ıiuü]?\s*$/.test(b)) role = "unit_price";
    else if (R.total.test(c)) role = "total";
    else if (R.payment_possible.test(c)) role = "payment_possible";
    out.push({ n, raw: m[0], start, end, role, clause: cl.text.trim(), cst: cl.st, cen: cl.en, currency: cur ? "TRY" : null });
  }
  return out;
}
// Bir tutarın mesajdaki rolleri (aynı sayı birden çok yerde geçebilir)
export function rolesOf(mentions, n) {
  const k = Math.round(Number(n) * 100) / 100;
  return [...new Set(mentions.filter((m) => m.n === k).map((m) => m.role))];
}
export const ROLE_TR = { unit_price: "birim fiyat", total: "işin toplam bedeli", payment: "alınan ödeme", payment_possible: "ödeme olabilir (\"verdi\")", promise: "ödeme sözü", negative: "ödenmedi", corrected_away: "düzeltilmiş (geçersiz) tutar", price_quote: "fiyat teklifi", unknown: "anlamı belirsiz tutar" };

// ---- Tutarın SAHİBİ (hangi müşterinin işi / ödemesi) ----
// "Kaya'ya 5 sefer, seferi 3000; Leda'dan 20000 ödeme geldi": 3000 Kaya'nın cümlesinde, 20000 Leda'nın.
// Kural (sırayla):
//   1) Tutarla AYNI yan cümlede adı geçen müşteri(ler)
//   2) Yoksa aynı bölümde (";", ". ", satır sonu) tutardan ÖNCE en son adı geçen müşteri
//   3) Yoksa mesajda tek bir müşteri adı geçiyorsa o
//   4) Mesajda hiç müşteri adı yoksa "none" (bağlam dışarıdan gelir, bu katman karar vermez)
//   5) Aksi hâlde "ambiguous": kullanıcıya sorulur, sessizce seçilmez
const GENERIC = new Set(["inşaat", "insaat", "yapı", "yapi", "ltd", "şti", "sti", "a.ş", "taahhüt", "taahhut", "hafriyat", "nakliyat", "nakliye", "san", "tic", "grup", "group", "beton", "mimarlık", "müh", "mühendislik", "ve", "bey", "abi", "usta", "firma", "şirket", "sirket"]);
const SUFFIX = "(?:['’`]\\p{L}*|y?[ae]|y?[ıiuü]|n?[ıiuü]n|[dt][ae]n?|l[ae]r\\p{L}*)?";
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function nameKeys(name) {
  const f = fold(name).replace(/\s+/g, " ").trim();
  if (!f) return [];
  const keys = [f];
  const first = f.split(" ")[0].replace(/[^\p{L}\d]/gu, "");
  if (first.length >= 3 && !GENERIC.has(first) && first !== f) keys.push(first);
  return keys;
}
// Mesajda geçen müşteri adları (konumlarıyla). customers: [{id,name}], aliases: [{alias,target_type,target_id}]
export function customerSpans(message, customers = [], aliases = []) {
  const text = fold(message);
  const out = [];
  const add = (id, key) => {
    const re = new RegExp("(?<![\\p{L}\\d])" + esc(key) + SUFFIX + "(?![\\p{L}])", "gu");
    for (const m of text.matchAll(re)) out.push({ id, start: m.index, end: m.index + m[0].length, key });
  };
  for (const c of customers) for (const k of nameKeys(c.name)) add(c.id, k);
  for (const a of aliases) if (a && a.target_type === "customer" && a.active !== false && a.alias) add(a.target_id, fold(a.alias).trim());
  // Aynı konumdaki tam ad ile ilk kelime eşleşmesini tekille
  return out.sort((a, b) => a.start - b.start);
}
const SEG = /;|[.!?](?=\s)|\n/g;
export function ownerOfMention(message, mention, spans) {
  const text = String(message || "");
  if (!spans.length) return { ids: [], how: "none" };
  const inClause = [...new Set(spans.filter((s) => s.start >= mention.cst && s.end <= mention.cen).map((s) => s.id))];
  if (inClause.length) return { ids: inClause, how: inClause.length === 1 ? "clause" : "ambiguous" };
  let segSt = 0;
  for (const b of text.slice(0, mention.start).matchAll(SEG)) segSt = b.index + 1;
  const before = spans.filter((s) => s.start >= segSt && s.end <= mention.start);
  if (before.length) {
    const lastStart = Math.max(...before.map((s) => s.start));
    const ids = [...new Set(before.filter((s) => s.start === lastStart).map((s) => s.id))];
    return { ids, how: ids.length === 1 ? "before" : "ambiguous" };
  }
  const all = [...new Set(spans.map((s) => s.id))];
  if (all.length === 1) return { ids: all, how: "single" };
  return { ids: all, how: "ambiguous" };
}
// Tutarın (belirli rollerdeki) bütün geçişleri için sahip kararı.
// Sonuç: { owners: Set, ambiguous: bool, mentions: [...] }
export function amountOwners(message, n, { customers = [], aliases = [], roles = null } = {}) {
  const k = Math.round(Number(n) * 100) / 100;
  const spans = customerSpans(message, customers, aliases);
  const ms = moneyMentions(message).filter((m) => m.n === k && (!roles || roles.includes(m.role)));
  const owners = new Set();
  let ambiguous = false, none = false;
  const per = ms.map((m) => { const o = ownerOfMention(message, m, spans); if (o.how === "ambiguous") ambiguous = true; else if (o.how === "none") none = true; else o.ids.forEach((x) => owners.add(x)); return { ...m, owner: o }; });
  return { owners, ambiguous, none, mentions: per };
}

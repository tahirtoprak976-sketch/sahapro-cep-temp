// Fiyat listesi KARARI ve önizlemesi — SAF katman, kayıt yazmaz.
// "Mesajdan fiyat çıkarılmadı" ≠ "iş fiyatlandırılmadı": mesajda fiyat yoksa fiyat listesi uygulanır; kaydetmeden ÖNCE
// uygulanacak kural, iş tarihi, birim fiyat, KDV esası/oranı ve çıkan tutar gösterilir.
// Birden çok eşit öncelikli kural ya da tarihe göre değişen fiyat + kesin olmayan iş tarihi: SESSİZCE SEÇİLMEZ (ambiguous).
// Tahsilat onayı fiyat onayı değildir: bu karar yalnız iş kartının kendi alanlarından hesaplanır.
import { rankPrices, priceForQuantity } from "./core.js";

const SRC = { 3: "Şantiyeye Özel Fiyat", 2: "Müşteriye Özel Fiyat", 1: "Genel Liste" };
const sameRank = (a, b) => a.tier === b.tier && a.vehicleSpecificity === b.vehicleSpecificity && a.specificity === b.specificity;
const sig = (e) => [Number(e.price), e.kdv_rate ?? 20, !!e.kdv_included, e.formula || "", e.first_hour_price ?? "", e.next_hour_price ?? ""].join("|");
const cand = (x) => ({ id: x.e.id, price: Number(x.e.price), kdv_rate: x.e.kdv_rate ?? 20, kdv_included: !!x.e.kdv_included, valid_from: x.e.valid_from || null, valid_to: x.e.valid_to || null,
  price_source: SRC[x.tier], formula: x.e.formula || null, note: x.e.note || x.e.description || "" });

// ctx: resolvePrice bağlamı (unit, customer_id, site_id, vehicle_id, vehicle_type, work_type, date, material)
export function priceDecision(entries, ctx, { dateSure = true } = {}) {
  const ranked = rankPrices(entries, ctx);
  if (!ranked.length) {
    const any = ctx.date ? rankPrices(entries, ctx, { ignoreDate: true }) : [];
    return { rule: null, ambiguous: false, reason: any.length ? `${ctx.date} tarihinde geçerli kural yok (kuralların tarih aralığı dışında) — fiyat boş kalır` : "Fiyat listesinde bu iş için kural yok — fiyat boş kalır", candidates: any.map(cand) };
  }
  const top = ranked[0];
  const ties = ranked.filter((x) => x !== top && sameRank(x, top) && (x.e.valid_from || "") === (top.e.valid_from || "") && sig(x.e) !== sig(top.e));
  if (ties.length) return { rule: null, ambiguous: true, reason: `Aynı öncelikte ${ties.length + 1} farklı fiyat kuralı var — hangisinin uygulanacağını seçin`, candidates: [top, ...ties].map(cand) };
  if (!dateSure) {
    const all = rankPrices(entries, ctx, { ignoreDate: true }).filter((x) => sameRank(x, top));
    if (new Set(all.map((x) => sig(x.e))).size > 1)
      return { rule: null, ambiguous: true, reason: "İş tarihi kesin değil ve fiyat tarihe göre değişiyor — tarihi doğrulayın ya da kuralı seçin", candidates: all.map(cand) };
  }
  return { rule: { ...top.e, price_source: SRC[top.tier] }, ambiguous: false, candidates: [cand(top)] };
}
const tl = (n) => Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
// Kural + iş → okunur özet (kural, tarih, birim fiyat, KDV esası/oranı, tutar)
export function priceSummary(rule, { date, quantity, unit }, crane) {
  if (!rule) return "";
  const q = Number(quantity) || 0, rate = Number(rule.kdv_rate ?? 20);
  const amount = Number(priceForQuantity(rule, q, crane)) || 0;
  const span = [rule.valid_from ? rule.valid_from + " tarihinden" : "", rule.valid_to ? rule.valid_to + " tarihine kadar" : ""].filter(Boolean).join(" ") || "tarih sınırı yok";
  const kdv = rule.kdv_included
    ? `KDV dahil %${rate} (net ${tl(amount / (1 + rate / 100))} + KDV ${tl(amount - amount / (1 + rate / 100))})`
    : `KDV hariç %${rate} (KDV ${tl((amount * rate) / 100)} → KDV dahil ${tl(amount * (1 + rate / 100))} ₺)`;
  const unitTxt = String(unit || "").toLocaleLowerCase("tr-TR");
  const calc = rule.formula === "CRANE_FIRST_HOUR" ? `vinç formülü (${q} ${unitTxt}) = ${tl(amount)} ₺` : `${tl(q)} × ${tl(rule.price)} = ${tl(amount)} ₺`;
  return `Kural: ${rule.price_source} (${span}) · İş tarihi ${date} · Birim ${tl(rule.price)} ₺ / ${unitTxt} · ${kdv} · Tutar ${calc}`;
}

// Fiyat listesinden kural: eşit öncelikli farklı kurallar (ya da tarihe göre değişen fiyat + kesin olmayan tarih) varsa SESSİZ SEÇİM YOK.
// Kesin kural → resolvePrice ile aynı nesne; belirsiz → null (çağıran kullanıcıya sorar ya da fiyatsız bırakır).
export function resolvePriceSafe(entries, ctx, opts) {
  const dec = priceDecision(entries, ctx, opts);
  return dec.ambiguous ? null : dec.rule;
}
export const candidateLabel = (x) => `${tl(x.price)} ₺ · ${x.price_source}${x.valid_from ? " · " + x.valid_from + "'den" : ""}${x.valid_to ? " " + x.valid_to + "'e kadar" : ""} · KDV ${x.kdv_included ? "dahil" : "hariç"} %${x.kdv_rate}${x.note ? " · " + x.note : ""}`;

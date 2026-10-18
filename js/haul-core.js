// Kamyon taşıma kapasitesi ve kabarma payı — TAHMİN hesapları (kayıt yazmaz, cariye girmez).
// Kaynak: "Kamyon kabarma payı ve metraj" araştırması (Ekim 2026). Yoğunluklar Caterpillar "Common Materials Loose & Bank"
// tablosundan; kaya değerleri doğrulanmamış, moloz için güvenilir veri yok. Kesin miktar ortak ölçümcünün yerinde metrajıdır.
// Yasal toplam ağırlık: 4 dingil 32 t (UAB araçların yüklenmesi yönetmeliği md.5), 5 dingil 42 t (işletme sahibinden).

const r1 = (n) => Math.round(n * 10) / 10;
const num = (x) => (x === "" || x == null ? NaN : Number(x));

// loose: gevşek (kasadaki) yoğunluk t/m³, bank: yerinde (doğal) yoğunluk t/m³
export const MATERIALS = [
  { key: "toprak", name: "Toprak (genel)", loose: 1.55, bank: 1.95, trust: "orta", note: "" },
  { key: "kil", name: "Kil", loose: 1.66, bank: 2.02, trust: "orta", note: "Kilde kabarma kaynaklara göre %22–43 arası değişiyor." },
  { key: "kum_cakil", name: "Kum-çakıl", loose: 1.72, bank: 1.93, trust: "orta-yüksek", note: "" },
  { key: "bitkisel", name: "Bitkisel toprak", loose: 0.95, bank: 1.37, trust: "düşük-orta", note: "Hafif malzeme: kasa hacmi sınırlar." },
  { key: "kaya", name: "Kaya (kırma / patlatılmış)", loose: 1.7, bank: 2.63, trust: "düşük", note: "Doğrulanmamış varsayım; kantar fişiyle kontrol edin." },
  { key: "moloz", name: "Moloz / yıkıntı", loose: 1.3, bank: null, trust: "veri yok", note: "Güvenilir veri yok; yerinde m³ hesaplanmaz, ton olarak izleyin." },
];

// Kullanıcının düzelttiği değerler (meta "haul_materials": {key:{loose,bank}}) varsayılanın üstüne yazılır.
export function materials(over = {}) {
  return MATERIALS.map((m) => {
    const o = over?.[m.key] || {};
    const loose = num(o.loose) > 0 ? num(o.loose) : m.loose;
    const bank = num(o.bank) > 0 ? num(o.bank) : m.bank;
    return { ...m, loose, bank, edited: !!(num(o.loose) > 0 || num(o.bank) > 0) };
  });
}
export const swellPct = (m) => (m.bank && m.loose ? Math.round((m.bank / m.loose - 1) * 100) : null);

// Malzeme katsayısı girişi: makul aralık ve yerinde ≥ gevşek (kabarma eksi olamaz)
export function checkMaterial(loose, bank) {
  const L = num(loose), B = num(bank);
  if (!(L >= 0.5 && L <= 3)) return "Gevşek yoğunluk 0,5–3 t/m³ arasında olmalı";
  if (bank === "" || bank == null) return null;
  if (!(B >= 0.8 && B <= 3.5)) return "Yerinde yoğunluk 0,8–3,5 t/m³ arasında olmalı";
  if (B < L) return "Yerinde yoğunluk gevşekten küçük olamaz (kabarma eksi çıkar)";
  return null;
}

export const LEGAL_GROSS_BY_AXLES = { 4: 32, 5: 42 };
export function legalGross(v) {
  if (num(v?.legal_gross_ton) > 0) return { ton: num(v.legal_gross_ton), auto: false };
  const a = LEGAL_GROSS_BY_AXLES[num(v?.axles)];
  return a ? { ton: a, auto: true } : null;
}
// Yasal net yük = yasal toplam ağırlık − dara
export function legalPayload(v) {
  const g = legalGross(v), t = num(v?.tare_ton);
  if (!g || !(t > 0) || t >= g.ton) return null;
  return r1(g.ton - t);
}
export const isHauler = (v) => num(v?.body_m3) > 0 || num(v?.axles) > 0 || /kamyon|t[ıi]r|damper/i.test(String(v?.type || ""));

// Sefer başı yük (ton) kaynağı, güvenilirlik sırasıyla. (Kantar ortalaması 2. pakette eklenecek.)
export function payload(v, { defaultTon = 0 } = {}) {
  if (num(v?.load_ton) > 0) return { ton: num(v.load_ton), source: "kart", label: "kartta yazan ortalama yük" };
  const lp = legalPayload(v);
  if (lp) return { ton: lp, source: "yasal", label: "yasal net yük (alt tahmin)" };
  if (defaultTon > 0) return { ton: defaultTon, source: "varsayilan", label: "varsayılan yük" };
  return null;
}

// Bir seferin tahmini hacmi. ton: kantar fişindeki net ton (varsa gerçek yük kabul edilir, kasa ile sınırlanmaz).
export function tripEstimate(v, m, { ton = null, payloadTon = null } = {}) {
  const body = num(v?.body_m3) > 0 ? num(v.body_m3) : null;
  const measured = num(ton) > 0;
  const t = measured ? num(ton) : num(payloadTon);
  if (!(t > 0) || !(m?.loose > 0)) return null;
  const byWeight = t / m.loose;
  let loose = byWeight, limit = "ağırlık";
  if (!measured && body && body < byWeight) { loose = body; limit = "kasa"; }
  const carriedTon = loose * m.loose;
  const bank = m.bank ? (carriedTon / m.bank) : null;
  const lp = legalPayload(v);
  return {
    loose: r1(loose), bank: bank == null ? null : r1(bank), ton: r1(carriedTon), limit: measured ? "kantar" : limit,
    overBody: !!(measured && body && byWeight > body * 1.05),
    overLegal: !!(lp && carriedTon > lp + 0.05),
    bodyPlain: body ? r1(body) : null, bankRaw: bank, tonRaw: carriedTon,
  };
}

// Döküm sahası kantarı: "var"/"yok" elle; boşsa ton başı ücret alınan saha kantarlı sayılır (tahmin).
export function hasScale(site) {
  if (!site) return null;
  if (site.has_scale === "var") return { scale: true, inferred: false };
  if (site.has_scale === "yok") return { scale: false, inferred: false };
  if (site.fee_unit === "Ton") return { scale: true, inferred: true };
  return null;
}

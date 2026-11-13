// Sözleşme / teklif PDF'inden iş sözleşmesi taslağı (Gemini). Yalnız ÖNERİ üretir: kullanıcı önizlemede düzeltip onaylamadan
// hiçbir kayıt yazılmaz. Belgede olmayan bilgi uydurulmaz (null + "bulunamadı"); her alan için belgedeki dayanak cümle istenir.
import { isActive } from "./core.js";
import { DEAL_BASIS, EXTRA_UNITS, SCRAP } from "./job-core.js";

const fold = (s) => String(s || "").toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export const CONTRACT_PROMPT = `Sen bir hafriyat / yıkım / peyzaj firmasının sözleşme okuyucususun. Ekteki sözleşme veya teklif belgesini oku ve YALNIZ belgede yazanları çıkar.
Kurallar:
- Belgede açıkça yazmayan alanı null bırak; tahmin etme, hesaplama yapma, varsayılan koyma.
- basis: tek toplam bedel varsa "Götürü"; metreküp birim fiyatı esassa "m³"; sefer başı fiyat esassa "Sefer".
- price: Götürü ise toplam sözleşme bedeli; m³/Sefer ise birim fiyat. Rakamı TL olarak sayı yaz (200.000 → 200000).
- kdv_included: "KDV dahil" yazıyorsa true, "KDV hariç" / "+KDV" yazıyorsa false, yazmıyorsa null. kdv_rate: yazıyorsa oran (20), yoksa null.
- scope_in: işe DAHİL olan kalemler (yıkım, moloz kaldırma, döküm, kazı, mıcır dolgu…) — belgedeki ifadelerle, kısa maddeler.
- scope_out: HARİÇ olanlar ya da müşterinin sorumlulukları.
- extra_rates: sözleşme dışı / ilave işler için yazılmış birim fiyatlar (ör. "ilave kazı saati 2.500 TL") — unit: Saat|Yevmiye|Sefer|m³|Ton|Adet.
- scrap: hurda / demir kimde? "fiyattan" (yükleniciye kalır, bedelden düşülmüş), "ayrica" (yükleniciye kalır, ayrıca satılır), "musteri" (işverene ait), yoksa null.
- payment_plan: ödeme şekli / aşamalar / avans — belgedeki gibi kısa.
- customer_name: işveren / müşteri adı. site_name: iş yeri, adres ya da proje adı. contract_date ve start_date: YYYY-AA-GG.
- quotes: her doldurduğun alan için belgeden birebir kısa alıntı { field, text }.`;

export function contractSchema() {
  const NS = { type: ["string", "null"] }, NN = { type: ["number", "null"] };
  return {
    type: "object",
    properties: {
      customer_name: NS, site_name: NS, contract_date: NS, start_date: NS, basis: NS, price: NN, kdv_rate: NN, kdv_included: { type: ["boolean", "null"] },
      scope_in: { type: "array", items: { type: "string" } }, scope_out: { type: "array", items: { type: "string" } },
      extra_rates: { type: "array", items: { type: "object", properties: { label: NS, unit: NS, price: NN } } },
      scrap: NS, payment_plan: NS, deadline: NS, notes: NS,
      quotes: { type: "array", items: { type: "object", properties: { field: NS, text: NS } } },
    },
  };
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !Number.isNaN(new Date(s + "T12:00:00Z").getTime());
const str = (s, n = 400) => (typeof s === "string" && s.trim() ? s.trim().slice(0, n) : null);
const list = (a) => (Array.isArray(a) ? a.map((x) => str(x, 160)).filter(Boolean).slice(0, 30) : []);

// Gemini çıktısını doğrula ve uygulamanın alanlarına çevir. issues: kullanıcıya gösterilecek eksik / şüpheli noktalar.
export function validateContract(obj, d = {}) {
  const o = obj && typeof obj === "object" ? obj : {};
  const issues = [];
  const basis = DEAL_BASIS.includes(o.basis) ? o.basis : null;
  if (!basis) issues.push("Anlaşma türü (götürü / m³ / sefer) belgede bulunamadı");
  const price = Number(o.price) > 0 && Number(o.price) < 1e10 ? Math.round(Number(o.price) * 100) / 100 : null;
  if (!price) issues.push(basis === "Götürü" ? "Sözleşme bedeli bulunamadı" : "Birim fiyat bulunamadı");
  const kr = Number(o.kdv_rate);
  const kdv_rate = o.kdv_rate != null && Number.isFinite(kr) && kr >= 0 && kr <= 100 ? kr : null;
  if (kdv_rate == null) issues.push("KDV oranı belgede yok — kontrol edin");
  const kdv_included = typeof o.kdv_included === "boolean" ? o.kdv_included : null;
  if (kdv_included == null) issues.push("Bedelin KDV dahil mi hariç mi olduğu belgede yok — kontrol edin");
  const extra_rates = (Array.isArray(o.extra_rates) ? o.extra_rates : []).map((r) => ({ label: str(r?.label, 80), unit: EXTRA_UNITS.includes(r?.unit) ? r.unit : null, price: Number(r?.price) > 0 ? Number(r.price) : null }))
    .filter((r) => r.label || r.price).slice(0, 12);
  if (extra_rates.some((r) => !r.unit || !r.price || !r.label)) issues.push("Bazı ekstra fiyat satırları eksik (ad / birim / fiyat) — düzeltin ya da silin");
  const scrap = o.scrap in SCRAP && o.scrap ? o.scrap : "";
  const quotes = (Array.isArray(o.quotes) ? o.quotes : []).map((q) => ({ field: str(q?.field, 40), text: str(q?.text, 240) })).filter((q) => q.field && q.text).slice(0, 40);
  const customer = matchCustomer(d, o.customer_name);
  if (o.customer_name && !customer) issues.push(`Müşteri "${String(o.customer_name).slice(0, 60)}" kayıtlarda bulunamadı — seçin ya da yeni açın`);
  return {
    basis, price, kdv_rate, kdv_included, extra_rates, scrap, quotes, customer,
    customer_name: str(o.customer_name, 120), site_name: str(o.site_name, 120),
    contract_date: isDate(o.contract_date) ? o.contract_date : null, start_date: isDate(o.start_date) ? o.start_date : isDate(o.contract_date) ? o.contract_date : null,
    scope_in: list(o.scope_in), scope_out: list(o.scope_out), payment_plan: str(o.payment_plan, 400), deadline: str(o.deadline, 160), notes: str(o.notes, 600), issues,
  };
}

// Müşteri eşleştirme: tam ad ya da ilk iki kelime; birden çok aday → eşleşme yok (kullanıcı seçer)
export function matchCustomer(d, name) {
  const n = fold(name);
  if (!n) return null;
  const cs = (d.customers || []).filter((c) => isActive(c) && !c.internal);
  const exact = cs.filter((c) => fold(c.name) === n);
  if (exact.length === 1) return exact[0];
  const head = n.split(" ").slice(0, 2).join(" ");
  const part = cs.filter((c) => { const f = fold(c.name); return f && (n.includes(f) || f.includes(head)); });
  return part.length === 1 ? part[0] : null;
}
export const quoteFor = (r, field) => (r.quotes || []).filter((q) => q.field === field || q.field?.startsWith(field)).map((q) => q.text);

// İşletmeye özel asistan kuralları — SAF katman.
// 1) Kullanıcının yazdığı serbest kurallar (Ayarlar → Yapay Zeka) Gemini talimatına eklenir.
// 2) Yapısal kurallar telefonda denetlenir: gönderenin zimmetli aracı, müşterinin sefer başı mazotu,
//    aynı mesajda iki kez bildirilmiş iş, belirsiz tarih. Kurallar kayıt yazmaz; kart işaretini ve notları belirler.
import { isActive } from "./core.js";
import { foldTr } from "./parser.js";

const live = (d, s) => (d[s] || []).filter(isActive);
const norm = (s) => foldTr(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const plateKey = (s) => foldTr(s).toUpperCase().replace(/[^A-Z0-9]/g, "");

export const DEFAULT_RULES = `WHATSAPP ÇALIŞMA KAYDI KURALLARI (Muratoğlu Hafriyat)
- Mesajın gönderildiği tarih ile iş tarihi farklı olabilir: mesajda yazan iş tarihini esas al. Tarih hiç yoksa date_source="yok" yaz.
- Her iş ayrı satırdır. Aynı gün aynı araç farklı malzeme, müşteri, şantiye veya güzergâh yaptıysa birleştirme.
- "3 sefer" gibi toplam miktar yazılmışsa tek satırda 3 sefer olarak yaz; araç, tarih, malzeme ve güzergâhı kaybetme.
- Birden fazla kişi aynı işi bildirmiş olabilir: aynı araç + aynı tarih + aynı malzeme/güzergâh ise bir kez yaz. Araçlar farklıysa ayrı işlerdir.
- Belirtilmeyen plaka, şoför, müşteri, malzeme, fiyat veya güzergâhı tahmin etme. Fiyat yazılmamışsa fiyat yazma.
- Mesajı gönderen personelin zimmetli aracı vardır (personel listesinde 3. değer): mesajda başka araç yazmıyorsa o aracı kullan, personnel_id = gönderen.
- Malzemenin alındığı yeri from_place, teslim edildiği şantiye/döküm/dolgu yerini to_place alanına yaz.
- Yakıtı iş ücreti veya gelir gibi gösterme.

KILIÇ HAFRİYAT – MASLAK GRAVAK
- Maslak'taki Kılıç Hafriyat sahasından çıkan gravak; teslim yerleri çoğunlukla Göktürk Son Durak dolgu sahası ve Çatalca Binkılıç dolgu sahası.
- Kılıç Hafriyat her sefer için 75 L mazot verir (müşteri kartındaki "sefer başı mazot" kuralı). Bu yalnız Kılıç'ın Maslak gravak seferleri içindir.
- Mesajda mazotun alındığı açıkça yazıyorsa fuel satırı yaz: source="Müşteri Verdi", customer_id=Kılıç Hafriyat. Yalnız sefer bilgisi varsa yakıt satırı YAZMA.
- Danış Maden / Danış Mıcır'dan alınan ocak taşı, mıcır vb. Kılıç'ın gravak işiyle birleştirilmez. "Binkılıç'a taş" gravak değildir.
- İşin kime ait olduğu açık değilse müşteriyi boş bırak ve questions'a sor.`;

// Mesajda araç adı/plakası/takma adı geçiyor mu?
export function vehicleNamed(d, vehicle, text) {
  if (!vehicle) return false;
  const t = ` ${norm(text)} `, tk = plateKey(text);
  const p = plateKey(vehicle.plate || "");
  if (p.length >= 5 && tk.includes(p)) return true;
  const nk = plateKey(vehicle.name || "");
  if (/^\d{2}[A-Z]{1,3}\d{2,4}$/.test(nk) && tk.includes(nk)) return true;
  const n = norm(vehicle.name);
  if (n.length >= 3 && t.includes(` ${n} `)) return true;
  // tek kelimelik kısa ad ("jcb", "manitou") ya da ilk anlamlı kelime ("sany 225" → "sany")
  const first = n.split(" ").find((w) => w.length >= 3 && !/^\d+$/.test(w));
  if (first && first.length >= 4 && t.includes(` ${first}`)) return true;
  return live(d, "aliases").some((a) => a.active !== false && a.target_type === "vehicle" && a.target_id === vehicle.id && t.includes(` ${norm(a.alias)} `));
}

// Mesajı gönderen (WhatsApp satırındaki ad) → personel kartı
export function senderPersonnel(d, reporter, text) {
  const n = norm(reporter);
  if (!n || n.length < 3) return null;
  if (!(` ${norm(text)} `).includes(` ${n.split(" ")[0]}`)) return null; // ad mesajda/başlıkta geçmeli
  const ps = live(d, "personnel");
  // Aynı adlı birden fazla kart olabilir (ilk kurulum kartı + sonradan açılan): zimmetli aracı olan öne
  const pick = (arr) => arr.find((p) => p.vehicle_id) || arr[0] || null;
  const exact = ps.filter((p) => norm(p.name) === n);
  if (exact.length) return pick(exact);
  // "Bayram Tırcı" ↔ "Bayram": kelime başı eşleşmesi
  return pick(ps.filter((p) => { const m = norm(p.name); return m.length >= 3 && (n.startsWith(m + " ") || m.startsWith(n + " ")); }));
}

// Müşterinin sefer başı mazot kuralı: { liters, match } — match boşsa müşterinin tüm seferleri
export function fuelAllowance(d, row, text) {
  const c = live(d, "customers").find((x) => x.id === row.customer_id);
  const L = Number(c?.fuel_per_trip);
  if (!c || !(L > 0) || row.unit !== "Sefer" || !(row.quantity > 0)) return null;
  const words = norm(c.fuel_rule_match || "").split(" ").filter((w) => w.length >= 3);
  const hay = ` ${norm([text, row.material, row.description, row.from_place, row.to_place].filter(Boolean).join(" "))} `;
  if (words.length && !words.every((w) => hay.includes(` ${w}`))) return null;
  return { customer: c.name, per: L, liters: Math.round(L * row.quantity * 10) / 10 };
}

// Aynı yapıştırmada iki kez bildirilmiş iş: aynı tarih + araç + birim + miktar + malzeme/güzergâh
export function markPasteDuplicates(works) {
  const seen = new Map();
  for (const r of works) {
    if (!r.vehicle_id || !r.quantity) continue;
    const key = [r.date, r.vehicle_id, r.unit, r.quantity, norm(r.material), norm(r.from_place), norm(r.to_place)].join("|");
    if (seen.has(key)) {
      r.pasteDup = true;
      r.ok = false;
      r.issues.push("Aynı iş bu mesajda iki kez bildirilmiş olabilir (aynı araç, tarih, miktar) — biri yeterliyse işaretlemeyin");
    } else seen.set(key, r);
  }
}

// Sonuç özeti: araç ve müşteri bazında toplam; kesin (işaretli) ve teyit bekleyen ayrı
export function planTotals(works, d) {
  const name = (s, id) => live(d, s).find((x) => x.id === id)?.name || "";
  const add = (m, k, r) => {
    if (!k) return;
    const x = m.get(k) || { name: k, sure: {}, unsure: {} };
    const b = r.ok ? x.sure : x.unsure;
    b[r.unit] = Math.round(((b[r.unit] || 0) + (Number(r.quantity) || 0)) * 100) / 100;
    m.set(k, x);
  };
  const byV = new Map(), byC = new Map();
  for (const r of works) {
    if (!r.quantity || !r.unit) continue;
    const v = live(d, "vehicles").find((x) => x.id === r.vehicle_id);
    add(byV, v ? v.plate || v.name : "Araç belirsiz", r);
    add(byC, name("customers", r.customer_id) || (r.new_customer ? r.new_customer + " (yeni)" : "Müşteri belirsiz"), r);
  }
  const fmt = (o) => Object.entries(o).map(([u, q]) => `${q} ${u.toLocaleLowerCase("tr-TR")}`).join(", ");
  const rows = (m) => [...m.values()].map((x) => ({ name: x.name, sure: fmt(x.sure), unsure: fmt(x.unsure) }));
  return { vehicles: rows(byV), customers: rows(byC) };
}

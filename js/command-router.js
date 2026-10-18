// Asistan YEREL komut yönlendiricisi — SAF katman, kayıt yazmaz, Gemini'ye gitmez (internetsiz de çalışır).
// Yalnız ekran açma, listeleme ve düzeltilecek kaydı BULMA yapar. Kayıt oluşturma / değiştirme mevcut kart ve form akışında kalır.
// Emin değilse null döner (mesaj Gemini'ye gider). Birden çok aday varsa rastgele seçmez, listeler.
import { isActive, addDays } from "./core.js";
import { customerSpans } from "./money-roles.js";

const live = (d, s) => (d[s] || []).filter(isActive);
const fold = (s) => String(s || "").toLocaleLowerCase("tr-TR").replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
// Türkçe harfler \b ile çalışmaz: harf olmayan sınır (lookaround, u bayrağı)
const OPEN = /(?<![\p{L}])(aç|ac|açar mısın|göster|goster|getir|listele|bul|hazırla|hazirla|görmek istiyorum|nerede)(\p{L}{0,6})?(?![\p{L}])/u;
const EDIT = /(?<![\p{L}])(düzelt|duzelt|değiştir|degistir|güncelle|guncelle)\p{L}*/u;
const RECORDISH = /\d+(?:[.,]\d+)?\s*(?:sefer|saat|sa\b|ton|litre|lt\b|l\b|tl|₺|lira|bin|yevmiye)/;

// Ad eşleştirme: tam ad ya da ilk anlamlı kelime + Türkçe ekler (customerSpans ile aynı kural)
function findCustomer(text, d) {
  const cs = live(d, "customers");
  let sp = customerSpans(text, cs, live(d, "aliases"));
  // Tam ad eşleşmesi varsa yalnız ilk kelimesi tutan diğer kartlar aday sayılmaz ("Kaya İnşaat" ≠ "Kaya Yapı")
  const full = sp.filter((s) => s.key.includes(" ") || s.key === fold(cs.find((c) => c.id === s.id)?.name));
  if (full.length) sp = sp.filter((s) => full.some((f) => f.id === s.id) || !full.some((f) => s.start >= f.start && s.end <= f.end + 6));
  const ids = [...new Set(sp.map((s) => s.id))];
  return ids.length === 1 ? live(d, "customers").find((c) => c.id === ids[0]) : ids.length > 1 ? { ambiguous: ids.map((i) => live(d, "customers").find((c) => c.id === i)).filter(Boolean) } : null;
}
const plateKey = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
function findVehicle(text, d) {
  const t = plateKey(text);
  const vs = live(d, "vehicles").filter((v) => (v.plate && plateKey(v.plate).length >= 5 && t.includes(plateKey(v.plate))) || (v.name && fold(text).includes(fold(v.name))));
  return vs.length === 1 ? vs[0] : null;
}
function findPersonnel(text, d) {
  const f = fold(text);
  const ps = live(d, "personnel").filter((p) => {
    const first = fold(p.name).split(" ")[0];
    return first.length >= 3 && new RegExp("(^|[^\\p{L}])" + first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(['’]?\\p{L}{0,5})?(?![\\p{L}])", "u").test(f);
  });
  return ps.length === 1 ? ps[0] : ps.length > 1 ? { ambiguous: ps } : null;
}
// Tarih ifadesi → [from, to]
export function dateWords(text, today) {
  const f = fold(text);
  if (/\bbugün|bugun\b/.test(f)) return [today, today, "bugün"];
  if (/\bevvelsi gün|evvelki gün|önceki gün\b/.test(f)) return [addDays(today, -2), addDays(today, -2), "evvelsi gün"];
  if (/\bdün|dun\b|dünkü|dunku/.test(f)) return [addDays(today, -1), addDays(today, -1), "dün"];
  if (/geçen hafta|gecen hafta/.test(f)) return [addDays(today, -13), addDays(today, -7), "geçen hafta"];
  if (/bu hafta|son 7 gün|son yedi gün/.test(f)) return [addDays(today, -6), today, "son 7 gün"];
  const m = f.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/);
  if (m) { const y = m[3] ? (m[3].length === 2 ? "20" + m[3] : m[3]) : today.slice(0, 4); const s = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; return [s, s, s.split("-").reverse().join(".")]; }
  return null;
}
const SCREEN_WORDS = [
  [/eksik fiyat|fiyat(ı|i)? eksik|fiyatsız|fiyatsiz/, "#/isler?f=fiyatsiz", "Fiyatı eksik işler"],
  [/fişsiz|fissiz|fişi olmayan/, "#/isler?f=noslip", "Fişsiz işler"],
  [/(bugünkü|bugunku|bugün|bugun).*(iş|is)ler|işler.*bugün/, "#/isler?f=today", "Bugünkü işler"],
  [/(bu hafta|son 7 gün|7 gün).*(iş|is)ler/, "#/isler?f=week", "Son 7 günün işleri"],
  [/yedek/, "#/ayarlar?tab=yedek", "Yedek"],
  [/mazot hesap|mazotla ödeme/, "#/mazot-hesaplari", "Mazotla ödeme hesapları"],
  [/tahsilat (takib|liste)|kimden ne kadar alaca|alacak liste/, "#/tahsilat", "Tahsilat takibi"],
  [/\bkasa\b/, "#/finans/kasa", "Kasa"],
  [/hakediş|hakedis/, "#/hakedis", "Hakedişler"],
  [/gün sonu|gun sonu|günü kapat/, "#/gunsonu", "Gün sonu"],
  [/veri sağlığı|veri sagligi|bütünlük/, "#/veri-sagligi", "Veri sağlığı"],
  [/fiyat liste/, "#/fiyat", "Fiyat listesi"],
  [/\baraçlar\b|araç liste|filo/, "#/filo", "Araçlar"],
  [/müşteriler\b|müşteri liste/, "#/musteriler", "Müşteriler"],
  [/puantaj|maaş/, "#/puantaj", "Puantaj ve maaş"],
  [/bakım|arıza liste/, "#/bakim", "Bakım / arıza"],
  [/\bayarlar\b/, "#/ayarlar", "Ayarlar"],
];

// ctx: { customer_id } — önceki komuttaki müşteri (yalnız komutta başka müşteri / kayıt adı yoksa kullanılır)
export function routeCommand(text, d, today, ctx = {}) {
  const raw = String(text || "").trim();
  if (!raw || raw.length > 140 || raw.includes("\n")) return null;
  const f = fold(raw);
  // "Bu kayda fiş fotoğrafı ekle": son açılan kayıt açılır, fotoğraf orada kullanıcıyla eklenir
  if (/(bu|son|şu) (kayd|işe|ise)|kayda (fiş|foto)/.test(f) && /(fiş|fis|foto|resim)/.test(f) && /ekle/.test(f))
    return ctx.last_record ? { kind: "open", hash: ctx.last_record.hash, label: "Son açtığınız kayıt — fotoğrafı oradaki 📷 alanından ekleyin" } : { kind: "choose", label: "Hangi kayıt? Önce kaydı açın, sonra yeniden söyleyin", items: [{ hash: "#/isler", label: "İş kayıtları" }] };
  const isEdit = EDIT.test(f), isOpen = OPEN.test(f);
  if (!isEdit && !isOpen) return null;
  if (!isEdit && RECORDISH.test(f)) return null; // "3 sefer… göster" gibi kayıt içerikli mesaj Gemini'ye gider
  let cust = findCustomer(raw, d);
  if (cust?.ambiguous) return { kind: "choose", label: "Hangi müşteri?", items: cust.ambiguous.map((c) => ({ hash: "#/musteriler/" + c.id, label: c.name })) };
  const named = !!cust;
  if (!cust && ctx.customer_id && /(^|\s)(bu müşteri|bunun|onun|aynı müşteri)|^(mazot|ekstre|cari|fiyat|kart|tahsilat)/.test(f)) cust = live(d, "customers").find((c) => c.id === ctx.customer_id) || null;
  const via = cust && !named ? " (önceki konuşmadaki müşteri)" : "";
  // Düzeltilecek kaydı BUL (değiştirme formda, kullanıcıyla)
  if (isEdit) {
    const per = findPersonnel(raw, d), veh = findVehicle(raw, d), dw = dateWords(raw, today);
    if (per?.ambiguous) return { kind: "choose", label: "Hangi personel?", items: per.ambiguous.map((p) => ({ hash: "#/personel/" + p.id, label: p.name })) };
    if (!per && !veh && !cust && !dw) return null;
    const ws = live(d, "work_records").filter((w) => (!per || w.personnel_id === per.id) && (!veh || w.vehicle_id === veh.id) && (!cust || w.customer_id === cust.id) && (!dw || (w.date >= dw[0] && w.date <= dw[1])))
      .sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12);
    const nm = (s, id) => live(d, s).find((x) => x.id === id)?.name || "—";
    const who = [per?.name, veh?.name, cust?.name, dw?.[2]].filter(Boolean).join(" · ");
    return { kind: "candidates", label: `Düzeltilecek iş: ${who}${via}`, empty: !ws.length,
      items: ws.map((w) => ({ hash: `#/isler/${w.id}/edit`, label: `${String(w.date || "tarihsiz").split("-").reverse().join(".")} · ${nm("vehicles", w.vehicle_id)} · ${nm("customers", w.customer_id)} · ${w.work_type || "iş"} · ${w.quantity ?? "?"} ${String(w.unit || "").toLocaleLowerCase("tr-TR")}` })) };
  }
  // Ekran / kart açma
  if (cust) {
    if (/ekstre|cari|hesap özeti/.test(f) && !/mazot/.test(f)) return { kind: "open", hash: "#/cari/" + cust.id, label: `${cust.name} — cari ekstre${via}`, customer_id: cust.id };
    if (/mazot/.test(f)) return { kind: "open", hash: "#/musteriler/" + cust.id, label: `${cust.name} — mazot hesabı (müşteri kartında; ekstreyi oradan paylaşırsınız)${via}`, customer_id: cust.id };
    if (/tahsilat/.test(f)) return { kind: "open", hash: "#/tahsilat/" + cust.id, label: `${cust.name} — tahsilat${via}`, customer_id: cust.id };
    if (/fiyat/.test(f)) return { kind: "open", hash: "#/fiyat", label: `Fiyat listesi (${cust.name} kurallarına bakın)${via}`, customer_id: cust.id };
    if (/(\biş|\bis)ler/.test(f)) return { kind: "open", hash: "#/musteriler/" + cust.id, label: `${cust.name} — yapılan işler${via}`, customer_id: cust.id };
    return { kind: "open", hash: "#/musteriler/" + cust.id, label: `${cust.name} — müşteri kartı${via}`, customer_id: cust.id };
  }
  const veh = findVehicle(raw, d);
  if (veh) return { kind: "open", hash: "#/filo/" + veh.id, label: `${veh.name} — araç kartı` };
  {
    const dw = dateWords(raw, today);
    if (dw && /(?<![\p{L}])i[şs]\p{L}*/u.test(f) && !/fiyat|fiş|fis/.test(f)) return { kind: "open", hash: `#/isler?from=${dw[0]}&to=${dw[1]}`, label: `İşler — ${dw[2]}` };
  }
  for (const [re, hash, label] of SCREEN_WORDS) if (re.test(f)) return { kind: "open", hash, label };
  return null;
}

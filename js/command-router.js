// Asistan YEREL komut yönlendiricisi — SAF katman, kayıt yazmaz, Gemini'ye gitmez (internetsiz de çalışır).
// Yalnız ekran açma, listeleme ve düzeltilecek kaydı BULMA yapar. Kayıt oluşturma / değiştirme mevcut kart ve form akışında kalır.
// Emin değilse null döner (mesaj Gemini'ye gider). Birden çok aday varsa rastgele seçmez, listeler.
import { isActive, addDays } from "./core.js";
import { customerSpans } from "./money-roles.js";
import { customerFuelLedger } from "./assistant-rules.js";
import { parseWorkQuantityChange } from "./assistant-operations.js";
import { vehicleSummary } from "./attention.js";

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
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function nameMatches(text, name) {
  const n = fold(name);
  if (!n) return [];
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(n)}(?:'?[\\p{L}]{0,5})?(?![\\p{L}\\p{N}])`, "gu");
  return [...fold(text).matchAll(re)].map((m) => ({ start: m.index, end: m.index + m[0].length, length: n.length }));
}
function findVehicle(text, d) {
  const matches = [];
  for (const v of live(d, "vehicles")) {
    const spans = nameMatches(text, v.name);
    const plate = plateKey(v.plate || "");
    if (plate.length >= 5) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${[...plate].map(escapeRe).join("\\s*")}(?:'?[\\p{L}]{0,5})?(?![\\p{L}\\p{N}])`, "giu");
      spans.push(...[...text.matchAll(re)].map((m) => ({ start: m.index, end: m.index + m[0].length, length: plate.length })));
    }
    matches.push(...spans.map((span) => ({ ...span, v })));
  }
  // JCB 2 içinde geçen JCB adı, daha uzun tam araç adını gölgelememeli.
  const strongest = matches.filter((m) => !matches.some((n) => n.length > m.length && n.start <= m.start && n.end >= m.end));
  const vs = [...new Map(strongest.map((m) => [m.v.id, m.v])).values()];
  return vs.length === 1 ? vs[0] : vs.length > 1 ? { ambiguous: vs } : null;
}
function findPersonnel(text, d) {
  const ps = live(d, "personnel");
  const full = ps.filter((p) => nameMatches(text, p.name).length);
  const candidates = full.length ? full : ps.filter((p) => {
    const first = fold(p.name).split(" ")[0];
    return first.length >= 3 && nameMatches(text, first).length;
  });
  return candidates.length === 1 ? candidates[0] : candidates.length > 1 ? { ambiguous: candidates } : null;
}
function usesCustomerContext(text) {
  // Yalnız yalın devam komutları: yeni, tanınmayan isimler eski müşteriye bağlanmaz.
  const f = fold(text);
  const subject = "(?:mazot hesab(?:ı|i|ını|ini)?|ekstre(?:si|sini|yi)?|cari(?: hesap| hesap özeti| ekstresi)?|hesap özeti|fiyat liste(?:si|sini)?|kart(?:ı|i|ını|ini)?|tahsilat(?:ı|i|ını|ini)?)";
  const action = "(?:aç|ac|göster|goster|getir|hazırla|hazirla|listele)";
  return new RegExp(`^(?:(?:bu müşterinin|bu müşteri|bunun|onun|aynı müşterinin) )?${subject} ${action}[.!?]?$`, "u").test(f);
}
// Tarih ifadesi → [from, to]
export function dateWords(text, today) {
  const f = fold(text);
  const exact = (date) => {
    const dt = new Date(date + "T12:00:00Z");
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(dt.getTime()) && dt.toISOString().slice(0, 10) === date;
  };
  if (!exact(today)) return null;
  const isoMatch = f.match(/(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/);
  const trMatch = f.match(/(?<!\d)(\d{1,2})[./](\d{1,2})(?:[./](\d{4}|\d{2}))?(?![\d./])/);
  if (isoMatch || trMatch) {
    const m = isoMatch || trMatch;
    const y = isoMatch ? m[1] : m[3] ? (m[3].length === 2 ? "20" + m[3] : m[3]) : today.slice(0, 4);
    const date = `${y}-${m[2].padStart(2, "0")}-${(isoMatch ? m[3] : m[1]).padStart(2, "0")}`;
    return exact(date) ? [date, date, date.split("-").reverse().join(".")] : [null, null, "Geçersiz tarih — gün, ay ve yılı kontrol edin"];
  }
  const word = (pattern) => new RegExp(`(?<![\\p{L}])(?:${pattern})(?![\\p{L}])`, "u").test(f);
  if (word("bugün|bugun|bugünkü|bugunku")) return [today, today, "bugün"];
  if (word("evvelsi gün|evvelki gün|önceki gün")) return [addDays(today, -2), addDays(today, -2), "evvelsi gün"];
  if (word("dün|dun|dünkü|dunku")) return [addDays(today, -1), addDays(today, -1), "dün"];
  if (word("son (?:7|yedi) (?:gün|gun)(?:ün|un)?")) return [addDays(today, -6), today, "son 7 gün"];
  const monday = addDays(today, -((new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7));
  if (word("geçen hafta|gecen hafta|geçen haftanın|gecen haftanin")) return [addDays(monday, -7), addDays(monday, -1), "geçen hafta"];
  if (word("bu hafta|bu haftanın|bu haftanin")) return [monday, today, "bu hafta (bugüne kadar)"];
  const monthStart = today.slice(0, 8) + "01";
  if (word("geçen ay|gecen ay|geçen ayın|gecen ayin")) {
    const end = addDays(monthStart, -1);
    return [end.slice(0, 8) + "01", end, "geçen ay"];
  }
  if (word("bu ay|bu ayın|bu ayin")) return [monthStart, today, "bu ay (bugüne kadar)"];
  if (word("bu yıl|bu yil|bu yılın|bu yilin")) return [today.slice(0, 4) + "-01-01", today, "bu yıl (bugüne kadar)"];
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
  const requestedDate = dateWords(raw, today);
  if (requestedDate && !requestedDate[0] && (OPEN.test(f) || EDIT.test(f) || parseWorkQuantityChange(raw)))
    return { kind: "choose", label: requestedDate[2], items: [] };
  // "Bu kayda fiş fotoğrafı ekle": son açılan kayıt açılır, fotoğraf orada kullanıcıyla eklenir
  if (/(bu|son|şu) (kayd|işe|ise)|kayda (fiş|foto)/.test(f) && /(fiş|fis|foto|resim)/.test(f) && /ekle/.test(f))
    return ctx.last_record ? { kind: "open", hash: ctx.last_record.hash, label: "Son açtığınız kayıt — fotoğrafı oradaki 📷 alanından ekleyin" } : { kind: "choose", label: "Hangi kayıt? Önce kaydı açın, sonra yeniden söyleyin", items: [{ hash: "#/isler", label: "İş kayıtları" }] };
  // Kayıtlardan cevap (rakamı uygulama hesaplar; model üretmez): mazot kalanı, bugün araçlar
  const isQ = /\?|(?<![\p{L}])(kaç|kac|ne kadar|hangi)(?![\p{L}])/u.test(f);
  if (isQ && /mazot|motorin|litre/.test(f)) {
    const c0 = findCustomer(raw, d);
    const c = c0 && !c0.ambiguous ? c0 : null;
    if (c) {
      const L = customerFuelLedger(d, c.id);
      const n1 = (x) => Number(x || 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
      return { kind: "answer", customer_id: c.id, label: `${c.name} — mazot hesabı`, text: `Hak edilen ${n1(L.earned)} L · alınan ${n1(L.received)} L · ${L.balance >= 0 ? "kalan mazot alacağı " + n1(L.balance) : "fazla alınan " + n1(-L.balance)} L. Dönem: tüm zamanlar, bugün itibarıyla. Kaynak: işlerdeki litre hakkı ve "müşteri verdi" yakıt / depo girişleri. TL bakiyeye dahil değildir.`, items: [{ hash: "#/musteriler/" + c.id, label: "Müşteri kartı ve mazot ekstresi" }, { hash: "#/mazot-hesaplari/" + c.id, label: "Mazot hesabı incelemesi" }] };
    }
  }
  if (isQ && /araç|arac|makine/.test(f) && /(bugün|bugun|dün|dun)/.test(f) && /(ne yaptı|ne yapti|çalıştı|calisti|iş)/.test(f)) {
    const dw = dateWords(raw, today);
    const vs = vehicleSummary(d, dw[0], dw[1]);
    const n1 = (x) => Number(x || 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
    const unitsTxt = (v) => [["Saat", "saat"], ["Sefer", "sefer"], ["Yevmiye", "yevmiye"], ["Ton", "ton"]].filter(([k]) => v[k]).map(([k, t]) => n1(v[k]) + " " + t).join(", ") || "birimsiz";
    return { kind: "answer", label: `Araçlar — ${dw[2]}`, text: vs.length ? vs.map((v) => `${v.name}: ${v.works} iş (${unitsTxt(v)})`).join(" · ") + ". Birimler ayrı sayıldı." : "Bu tarihte araca bağlı iş kaydı yok.", items: [{ hash: `#/isler?from=${dw[0]}&to=${dw[1]}`, label: "İşleri listele" }, ...vs.slice(0, 6).map((v) => ({ hash: "#/filo/" + v.id, label: v.name + " — araç kartı" }))] };
  }
  if (isQ && /(kimden|alacağ|alacag)/.test(f)) return { kind: "open", hash: "#/tahsilat", label: "Tahsilat takibi — müşterilere göre açık alacak (TL; mazot alacağı ayrıdır)" };
  const quantityChange = parseWorkQuantityChange(raw);
  const isEdit = EDIT.test(f) || !!quantityChange, isOpen = OPEN.test(f);
  if (!isEdit && !isOpen) return null;
  if (!isEdit && RECORDISH.test(f)) return null; // "3 sefer… göster" gibi kayıt içerikli mesaj Gemini'ye gider
  let cust = findCustomer(raw, d);
  if (cust?.ambiguous) return { kind: "choose", label: "Hangi müşteri?", items: cust.ambiguous.map((c) => ({ hash: "#/musteriler/" + c.id, label: c.name })) };
  const namedVehicle = findVehicle(raw, d);
  if (!isEdit && cust && namedVehicle) {
    const vs = namedVehicle.ambiguous || [namedVehicle];
    return { kind: "choose", label: "Müşteri mi, araç mı?", items: [
      { hash: "#/musteriler/" + cust.id, label: "Müşteri: " + cust.name },
      ...vs.map((v) => ({ hash: "#/filo/" + v.id, label: "Araç: " + v.name + (v.plate ? " · " + v.plate : "") }))
    ] };
  }
  const named = !!cust;
  if (!cust && ctx.customer_id && usesCustomerContext(raw)) cust = live(d, "customers").find((c) => c.id === ctx.customer_id) || null;
  const via = cust && !named ? " (önceki konuşmadaki müşteri)" : "";
  // Düzeltilecek kaydı BUL (değiştirme formda, kullanıcıyla)
  if (isEdit) {
    const per = findPersonnel(raw, d), veh = findVehicle(raw, d), dw = dateWords(raw, today);
    if (veh?.ambiguous) return { kind: "choose", label: "Hangi araç?", items: veh.ambiguous.map((v) => ({ hash: "#/filo/" + v.id, label: v.name + (v.plate ? " · " + v.plate : "") })) };
    if (per?.ambiguous) return { kind: "choose", label: "Hangi personel?", items: per.ambiguous.map((p) => ({ hash: "#/personel/" + p.id, label: p.name })) };
    if (!per && !veh && !cust && !dw) return null;
    const ws = live(d, "work_records").filter((w) => (!per || w.personnel_id === per.id) && (!veh || w.vehicle_id === veh.id) && (!cust || w.customer_id === cust.id) && (!dw || (w.date >= dw[0] && w.date <= dw[1])))
      .sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12);
    const nm = (s, id) => live(d, s).find((x) => x.id === id)?.name || "—";
    const who = [per?.name, veh?.name, cust?.name, dw?.[2]].filter(Boolean).join(" · ");
    return { kind: quantityChange ? "work_quantity" : "candidates", change:quantityChange, label: `Düzeltilecek iş: ${who}${via}`, empty: !ws.length,
      items: ws.map((w) => ({ id:w.id, hash: `#/isler/${w.id}/edit`, label: `${String(w.date || "tarihsiz").split("-").reverse().join(".")} · ${nm("vehicles", w.vehicle_id)} · ${nm("customers", w.customer_id)} · ${w.work_type || "iş"} · ${w.quantity ?? "?"} ${String(w.unit || "").toLocaleLowerCase("tr-TR")}` })) };
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
  if (veh?.ambiguous) return { kind: "choose", label: "Hangi araç?", items: veh.ambiguous.map((v) => ({ hash: "#/filo/" + v.id, label: v.name + (v.plate ? " · " + v.plate : "") })) };
  if (veh) return { kind: "open", hash: "#/filo/" + veh.id, label: `${veh.name} — araç kartı` };
  {
    const dw = dateWords(raw, today);
    if (dw && /(?<![\p{L}])i[şs]\p{L}*/u.test(f) && !/fiyat|fiş|fis/.test(f)) return { kind: "open", hash: `#/isler?from=${dw[0]}&to=${dw[1]}`, label: `İşler — ${dw[2]}` };
  }
  for (const [re, hash, label] of SCREEN_WORDS) if (re.test(f)) return { kind: "open", hash, label };
  return null;
}

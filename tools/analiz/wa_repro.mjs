// WhatsApp mesaj işleme — yeniden üretilebilen ilk 5 sorun (TEST VERİSİ, sentetik; gerçek mesaj ölçümü DEĞİLDİR).
// Çalıştırma: node tools/analiz/wa_repro.mjs   → her sorun için "beklenen / gerçek"; çıkış kodu = açık sorun sayısı.
import { analyzeMessage } from "../../js/message-engine.js";
import { validatePlan } from "../../js/assistant-core.js";
const d = {
  customers: [{ id: "SEN", name: "Şenol" }, { id: "AGI", name: "Ağırtaş Mimarlık" }, { id: "HP", name: "Hisar Polat" }, { id: "K", name: "Kaya İnşaat" }],
  sites: [{ id: "KEM", name: "Kemerburgaz", customer_id: "HP" }, { id: "CAG", name: "Çağlayan", customer_id: "HP" }],
  vehicles: [{ id: "JCB", name: "JCB", type: "Kazıcı Yükleyici" }, { id: "K1", name: "34 KM 101", plate: "34 KM 101", type: "Kamyon" }],
  personnel: [], aliases: [{ id: "A1", alias: "Mahir Bey", target_type: "customer", target_id: "HP", confirmed: true }],
  work_records: [], fuel_records: [], dump_sites: [], quarries: [], price_book: [], suppliers: [],
};
const rows = (t) => analyzeMessage({ id: "T", text: t, date: "2026-10-12" }, d).rows;
let open = 0;
const issue = (no, title, ok, expected, actual) => { if (!ok) open++; console.log(`${ok ? "✓ ÇÖZÜLDÜ" : "✗ AÇIK"}  ${no}. ${title}\n     beklenen: ${expected}\n     gerçek  : ${actual}\n`); };

// 1) Asistan: ödeme tutarı birim fiyat olarak kabul ediliyor (finansal)
{
  const msg = "34 KM 101 Kaya İnşaat 5 sefer hafriyat, 20.000 TL verdi";
  const v = validatePlan({ works: [{ date: "2026-10-12", date_source: "mesaj", customer_id: "K", vehicle_id: "K1", work_type: "Hafriyat Nakliye", quantity: 5, unit: "Sefer", unit_price: 20000, quote: msg }] }, { message: msg, d, today: "2026-10-12" });
  const w = v.works[0];
  issue(1, "Ödeme tutarı (\"20.000 TL verdi\") iş birim fiyatı olarak kabul ediliyor", w.unit_price == null || !w.ok,
    "birim fiyat uygulanmaz ya da kart işaretsiz + 'bu tutar ödeme gibi duruyor'; ödeme ayrı tahsilat kartı",
    `unit_price=${w.unit_price}, işaretli=${w.ok}, tutar=${w.unit_price ? w.unit_price * 5 : "-"} TL`);
}
// 2) Yerel ayrıştırıcı: "sa" kısaltması + " / " + parantez/virgül → üç iş tek satır, miktar yok, tür başka işten
{
  const r = rows("jcb kepçe: şenol abi (palet+taş taşıma) 1,5 sa / ağırtaş mimarlık kum taşıma 1 sa / mahir bey inşaatı kanal kazma-kapatma, mıcır tesviyesi 2,5 sa");
  const q = r.map((x) => `${x.quantity ?? "?"} ${x.unit ?? "?"}`);
  issue(2, "Çok işli mesaj: sınır + süre (\"sa\", \" / \", parantez, virgül)", r.length === 3 && r.map((x) => x.quantity).join() === "1.5,1,2.5" && r.every((x) => x.unit === "Saat"),
    "3 satır: 1,5 / 1 / 2,5 Saat; 'mıcır' yalnız 3. işte, nakliye türü atanmaz",
    `${r.length} satır: ${q.join(" | ")} · tür: ${r.map((x) => x.work_type).join(", ")}`);
}
// 3) Bağlam sızıntısı: müşterisiz satır önceki satırın müşterisini "birebir ad" dayanağıyla otomatik alıyor
{
  const r = rows("jcb Şenol abi palet taşıma 1,5 saat\nkum taşıma 1 saat");
  const x = r[1] || {};
  const via = (x.candidates?.customer_id || []).map((c) => c.via).join(",");
  issue(3, "Müşteri bir sonraki satıra sızıyor", x.customer_id == null,
    "2. satırda müşteri boş; 'önceki satır bağlamı' dayanaklı aday (onay gerekir)",
    `2. satır müşteri=${x.customer_id}, dayanak=${via}`);
}
// 4) Hafıza: BÜYÜK HARF "MAHIR BEY" onaylı takma adı kaçırıyor (tr-TR küçük harf: I → ı)
{
  const r = rows("MAHIR BEY INSAATI KANAL KAZMA 2.5 SAAT JCB");
  issue(4, "Büyük harfli yazımda onaylı takma ad (Mahir Bey → Hisar Polat) bulunmuyor", r[0]?.customer_id === "HP",
    "müşteri Hisar Polat (dayanak: onaylı takma ad); şantiye seçilmez",
    `müşteri=${r[0]?.customer_id}, adaylar=${(r[0]?.candidates?.customer_id || []).map((c) => c.id + ":" + c.via).join(",")}`);
}
// 5) Kaynak zinciri: asistan/toplu yolunda iş kaydına yalnız mesajın ilk 300 karakteri yazılıyor (kod incelemesi)
{
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../../js/assistant.js", import.meta.url), "utf8");
  const has = /source_ref|msg_time|import_id|parser_version/.test(src);
  issue(5, "Asistan / WhatsApp toplu yolunda kaynak zinciri eksik", has,
    "kayıtta: içe aktarma kimliği, ham metin (ayrı saklı), gönderen, mesaj zamanı, satır/karakter aralığı, medya, ayrıştırıcı sürümü",
    "assistant.js: internal_note = 'Asistan: ' + message.slice(0, 300); gönderen/zaman/aralık/sürüm alanı yok (Gelen kutusu yolunda ham metin ve satır no var)");
}
console.log(`Açık sorun: ${open}`);
process.exitCode = open;

// Yerel komut yönlendiricisi (TEST VERİSİ): ekran açma, listeleme, düzeltilecek kaydı bulma. Kayıt yazmaz, Gemini'ye gitmez.
import assert from "node:assert/strict";
import { routeCommand, dateWords } from "../js/command-router.js";
const T = "2026-10-18";
const d = { customers: [{ id: "K", name: "Kılıç Hafriyat" }, { id: "Y", name: "Kaya İnşaat" }, { id: "Y2", name: "Kaya Yapı" }], vehicles: [{ id: "V", name: "Hitachi", plate: "34 UL 9492" }],
  personnel: [{ id: "M", name: "Mahir Yılmaz" }], aliases: [],
  work_records: [{ id: "w1", date: "2026-10-17", personnel_id: "M", vehicle_id: "V", customer_id: "Y", work_type: "Kazı", quantity: 3, unit: "Saat" }, { id: "w2", date: "2026-10-17", personnel_id: "M", vehicle_id: "V", customer_id: "K", work_type: "Yükleme", quantity: 2, unit: "Saat" }, { id: "w3", date: "2026-10-12", personnel_id: "M", vehicle_id: "V", customer_id: "K", work_type: "Kazı", quantity: 4, unit: "Saat" }] };
const R = (t, c) => routeCommand(t, d, T, c);
let n = 0; const test = (t, f) => { f(); n++; console.log("PASS " + t); };
test("kart / ekstre / mazot / yedek / araç açma (Türkçe ekli adlarla)", () => {
  assert.equal(R("Kılıç Hafriyat’ın kartını aç").hash, "#/musteriler/K");
  assert.equal(R("Kılıç'ın ekstresini hazırla").hash, "#/cari/K");
  assert.equal(R("Yedekleme ekranını aç").hash, "#/ayarlar?tab=yedek");
  assert.equal(R("34UL9492 kartını aç").hash, "#/filo/V");
  assert.equal(R("Eksik fiyatlı işleri bul").hash, "#/isler?f=fiyatsiz");
  assert.equal(R("dünkü işleri göster").hash, "#/isler?from=2026-10-17&to=2026-10-17");
});
test("bağlam: 'mazot hesabını göster' önceki müşteriye; yeni müşteri adı geçerse eskisi taşınmaz", () => {
  const r = R("mazot hesabını göster", { customer_id: "K" });
  assert.equal(r.hash, "#/musteriler/K"); assert.match(r.label, /önceki konuşmadaki müşteri/);
  assert.equal(R("Kaya İnşaat kartını aç", { customer_id: "K" }).hash, "#/musteriler/Y");
  assert.equal(R("mazot hesabını göster", {}), null, "bağlam yoksa uydurmaz (Gemini'ye bırakır)");
});
test("belirsiz müşteri adı: seçtirir", () => {
  const r = R("Kaya'nın kartını aç");
  assert.equal(r.kind, "choose"); assert.deepEqual(r.items.map((x) => x.hash).sort(), ["#/musteriler/Y", "#/musteriler/Y2"]);
});
test("düzeltme: Mahir'in dünkü işi → iki aday listelenir, rastgele seçilmez; değişiklik yapılmaz", () => {
  const before = JSON.stringify(d);
  const r = R("Mahir Bey’in dünkü işindeki süreyi 2,5 saat olarak düzelt");
  assert.equal(r.kind, "candidates"); assert.deepEqual(r.items.map((x) => x.hash), ["#/isler/w1/edit", "#/isler/w2/edit"]);
  assert.match(r.items[0].label, /17\.10\.2026 · Hitachi · Kaya İnşaat · Kazı · 3 saat/);
  assert.equal(JSON.stringify(d), before);
});
test("kayıt içerikli mesajlar yönlendirilmez (Gemini'ye gider)", () => {
  for (const t of ["Kaya 3 sefer moloz göster", "Kaya’dan 20 bin lira tahsil ettim", "34UL9492’ye bugün 300 litre yakıt girdim", "Geçen haftanın işlerini müşterilere göre raporla", "34 KM 101 Kaya İnşaat 5 sefer moloz\\nikinci satır"])
    assert.equal(R(t), null, t);
});
test("tarih ifadeleri", () => {
  assert.deepEqual(dateWords("dün", T).slice(0, 2), ["2026-10-17", "2026-10-17"]);
  assert.deepEqual(dateWords("12.10 tarihli iş", T).slice(0, 2), ["2026-10-12", "2026-10-12"]);
});
console.log(`command-router: ${n} test geçti`);

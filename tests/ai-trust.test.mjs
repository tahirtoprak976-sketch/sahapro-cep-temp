// Yapay zekâ cevaplarındaki rakamların METRİĞİ (iş değeri ≠ tahsilat) ve KDV oranı girişi (%0 korunur, boş sessizce dolmaz)
import assert from "node:assert/strict";
import { answerMetricIssues, checkAnswer } from "../js/assistant-core.js";
import { kdvRateOf } from "../js/core.js";
const facts = { aylik: [{ ay: "Ekim", is_degeri_TL: 18500, tahsilat_TL: 25000, tahmini_kar_TL: 9000, gider_yakit_TL: 7300 }], musteriler: [{ musteri: "Kaya", cari_bakiye_TL: 41250 }] };
// iş değeri "tahsilat" diye yazılırsa: sayı kayıtlarda var (checkAnswer geçer) ama metrik yanlış → uyarı
assert.deepEqual(checkAnswer("Bu ay 18.500 TL tahsilat yapıldı.", facts), []);
const m = answerMetricIssues("Bu ay 18.500 TL tahsilat yapıldı.", facts);
assert.equal(m.length, 1); assert.equal(m[0].n, 18500); assert.match(m[0].actual, /iş değeri/);
// doğru metrikler: uyarı yok
for (const ok of ["Bu ay 25.000 TL tahsilat yapıldı.", "Ekim iş değeri 18.500 TL, tahsilat 25.000 TL.", "Kaya'nın bakiyesi 41.250 TL.", "Tahmini kâr 9.000 TL.", "Gider 7.300 TL oldu.", "Toplam 18500"])
  assert.deepEqual(answerMetricIssues(ok, facts), [], ok);
// kâr yerine bakiye
assert.equal(answerMetricIssues("Bu ay 41.250 TL kâr ettiniz.", facts).length, 1);
// hesap araçları (Soru Sor): araç adı metriği anlatır
const tools = [{ work_totals: { total: 52000 } }, { collection_totals: { total: 30000 } }];
assert.equal(answerMetricIssues("Bu ay 52.000 TL tahsil edildi.", tools).length, 1);
assert.deepEqual(answerMetricIssues("Bu ay 30.000 TL tahsil edildi, 52.000 TL iş yapıldı.", tools), []);
console.log("ai-metric PASS");
// KDV oranı
assert.equal(kdvRateOf("0"), 0); assert.equal(kdvRateOf(0), 0); assert.equal(kdvRateOf("20"), 20); assert.equal(kdvRateOf("10,5"), 10.5);
for (const bad of ["", " ", null, undefined, "abc", "-1", "101"]) assert.equal(kdvRateOf(bad), null, String(bad));
console.log("kdv-rate PASS");

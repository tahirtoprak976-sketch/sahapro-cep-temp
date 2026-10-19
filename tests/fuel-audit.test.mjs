// Sefer başı litre anlaşması (Model B) denetimi — TEST VERİSİ.
import assert from "node:assert/strict";
import { fuelAudit, whyNoRule, fixPreview, rulesAt } from "../js/fuel-audit.js";
import { applyFuelPay, customerFuelLedger } from "../js/assistant-rules.js";
import { customerBalances } from "../js/collect-core.js";

const T = "2026-10-12";
let seq = 0;
const rec = (o) => ({ id: "r" + ++seq, created_at: "2026-10-10T10:00:00Z", ...o });
const base = (rule = {}) => ({
  customers: [{ id: "X", name: "Kılıç Test", fuel_rules: [{ id: "r1", per: 75, unit: "Sefer", match: "gravak", only_pay: true, ...rule }] }, { id: "Y", name: "Başka Müşteri" }],
  work_records: [], fuel_records: [], fuel_tank_movements: [], cari_movements: [], hakedis: [], sites: [], quarries: [], dump_sites: [], aliases: [], vehicles: [{ id: "V", name: "34 KM 101" }],
});
const priced = (o) => rec({ date: "2026-10-09", customer_id: "X", vehicle_id: "V", work_type: "Moloz Nakliye", unit: "Sefer", quantity: 5, price_snapshot: { unit_price: 3000, amount: 15000, kdv_rate: 20, kdv_included: false, price_source: "Genel Liste" }, ...o });
const gift = (L, o = {}) => rec({ date: T, vehicle_id: "V", liters: L, fuel_source: "Müşteri Verdi", customer_id: "X", total: null, ...o });
let n = 0;
const test = (name, fn) => { fn(); n++; console.log("PASS " + name); };

test("litre hakkı: 5 × 75 = 375, 200 alındı → 175 kalan; TL alacak yok; denetim temiz", () => {
  const d = base();
  d.work_records.push(applyFuelPay(d, rec({ date: "2026-10-09", customer_id: "X", vehicle_id: "V", unit: "Sefer", quantity: 5, material: "gravak" }), ""));
  d.fuel_records.push(gift(200));
  const L = customerFuelLedger(d, "X");
  assert.deepEqual([L.earned, L.received, L.balance], [375, 200, 175]);
  assert.equal(customerBalances(d).bal.X, 0);
  assert.equal(fuelAudit(d, "X").clean, true);
});
test("kural kelimesi yok → TL iş: denetim nedeni yazar, kendiliğinden düzeltmez", () => {
  const d = base();
  d.work_records.push(priced({ material: "moloz" }));
  const a = fuelAudit(d, "X");
  assert.equal(a.tlWorks.length, 1); assert.equal(a.tlTotal, 15000); assert.equal(a.fixable.length, 0);
  assert.match(a.tlWorks[0].why[0], /"gravak" kelimesi yok/);
  assert.equal(customerBalances(d).bal.X, 15000, "denetim veriyi değiştirmez");
});
test("kural sonradan eklenmiş → iş şimdi kurala uyuyor: düzeltilebilir listede, önizleme tutarları doğru", () => {
  const d = base({ created_at: "2026-10-11T00:00:00Z" });
  d.work_records.push(priced({ material: "gravak", created_at: "2026-10-09T09:00:00Z" }));
  d.fuel_records.push(gift(200));
  const a = fuelAudit(d, "X");
  assert.equal(a.fixable.length, 1); assert.equal(a.fixable[0].liters, 375); assert.equal(a.fixable[0].onlyPay, true);
  assert.match(a.fixable[0].why[0], /kural eklenmeden önce/);
  // Uygulanınca (ekrandaki düzeltmenin yazdığı alanlar): TL 0, litre 375/200/175; ikinci denetimde listede yok (tekrar düzeltme olmaz)
  const w = d.work_records[0]; const f = applyFuelPay(d, w, "");
  Object.assign(w, { customer_fuel_allowance_l: f.customer_fuel_allowance_l, fuel_rule_id: f.fuel_rule_id, price_snapshot: f.price_snapshot });
  assert.equal(customerBalances(d).bal.X, 0);
  assert.equal(customerFuelLedger(d, "X").balance, 175);
  assert.equal(fuelAudit(d, "X").fixable.length, 0);
});
test("birim / tarih nedenleri", () => {
  const d = base({ from: "2026-10-05" });
  assert.match(whyNoRule(d, { unit: "Saat", date: T }, d.customers[0])[0], /birim Saat/);
  assert.match(whyNoRule(d, { unit: "Sefer", date: "2026-10-01" }, d.customers[0])[0], /başlangıcından/);
});
test("kesinleşmiş hakedişteki TL iş ayrı listelenir (düzeltilebilir sayılmaz)", () => {
  const d = base();
  const w = priced({ material: "gravak" }); d.work_records.push(w);
  d.hakedis.push(rec({ status: "Kesinleşti", hakedis_no: 7, items: [{ work_record_id: w.id }] }));
  const a = fuelAudit(d, "X");
  assert.equal(a.lockedTl.length, 1); assert.equal(a.fixable.length, 0);
});
test("müşteriye bağlanmamış depo girişi / istasyon alışı: listelenir; başka müşterinin kaydı karışmaz", () => {
  const d = base();
  d.fuel_tank_movements.push(rec({ date: T, move_type: "GİRİŞ", liters: 200, note: "Kılıç'tan mazot" }));
  d.fuel_records.push(rec({ date: T, vehicle_id: "V", liters: 50, fuel_source: "Akaryakıt İstasyonu", description: "kılıç şantiyesi yanı istasyon" }));
  d.fuel_tank_movements.push(rec({ date: T, move_type: "GİRİŞ", liters: 300, customer_id: "Y", note: "Kılıç" }));
  const a = fuelAudit(d, "X");
  assert.deepEqual(a.unlinkedFuel.map((x) => [x.store, x.liters, x.linkable]), [["fuel_records", 50, false], ["fuel_tank_movements", 200, true]], "istasyon alışı bağlanamaz, yalnız bilgi");
  assert.equal(customerFuelLedger(d, "X").received, 0, "bağlanmadan litre düşmez (sessiz atama yok)");
});
test("depo girişi + depodan araca çıkış: tek alım (çift sayılmaz); aynı miktarda iki gerçek teslim ikisi de", () => {
  const d = base();
  d.work_records.push(applyFuelPay(d, rec({ date: "2026-10-09", customer_id: "X", vehicle_id: "V", unit: "Sefer", quantity: 5, material: "gravak" }), ""));
  d.fuel_tank_movements.push(rec({ date: T, move_type: "GİRİŞ", liters: 100, customer_id: "X" }));
  d.fuel_records.push(rec({ date: T, vehicle_id: "V", liters: 100, fuel_source: "Depo Tankı" }));
  d.fuel_records.push(gift(100), gift(100));
  assert.equal(customerFuelLedger(d, "X").received, 300);
});
test("ücret yalnız mazot iken işte TL de varsa 'karışık' uyarısı", () => {
  const d = base();
  d.work_records.push(priced({ material: "gravak", customer_fuel_allowance_l: 375, fuel_rule_id: "r1" }));
  assert.equal(fuelAudit(d, "X").mixed.length, 1);
});
test("300 L 'müşteri verdi' kaydı müşterisi boş: mevcut kayıt bağlanabilir aday; yeni kayıt önerilmez", () => {
  const d = base();
  d.fuel_records.push(rec({ date: T, vehicle_id: "V", liters: 300, fuel_source: "Müşteri Verdi", customer_id: null, total: null }));
  const a = fuelAudit(d, "X");
  assert.deepEqual(a.unlinkedFuel.map((x) => [x.store, x.liters, x.linkable]), [["fuel_records", 300, true]]);
  assert.equal(d.fuel_records.length, 1); assert.equal(d.cash_records, undefined, "denetim kayıt açmaz");
});
test("düzeltme önizlemesi: kayıt, mevcut kurala göre öneri, bugünkü kuraldan fark, TL ve litre eski/yeni, değişecek alanlar", () => {
  const d = base({ from: "2026-10-01" });
  const w = priced({ material: "gravak" }); d.work_records.push(w); d.fuel_records.push(gift(200));
  const before = JSON.stringify(d);
  const P = fixPreview(d, "X", [w.id]);
  assert.equal(JSON.stringify(d), before, "önizleme yazmaz");
  const r = P.rows[0];
  assert.match(r.record, /2026-10-09 · 34 KM 101 · 5 sefer gravak/); assert.match(r.record, /= 15000 ₺/);
  assert.match(r.current[0], /75 L \/ sefer \("gravak" işleri\), ücret yalnız mazot · 2026-10-01 – …/);
  assert.deepEqual(r.money.old, { net: 15000, kdv: 3000, gross: 18000, booked: 15000, rate: 20, basis: "hariç" }, "KDV hariç 3.000 × 5: net 15.000, KDV 3.000, brüt 18.000; cari 15.000 topluyor");
  assert.deepEqual([r.money.new.net, r.money.new.kdv, r.money.new.gross, r.money.new.booked], [0, 0, 0, 0]);
  assert.deepEqual(P.money, { net: -15000, kdv: -3000, gross: -18000, booked: -15000 });
  assert.match(r.diff, /litre hakkı yok, 15000 ₺ TL fiyatlı/); assert.match(r.changes[0], /TL tutar 15000 → 0 ₺, litre hakkı 0 → 375 L/);
  assert.deepEqual([P.tl.delta, P.litre.earnedOld, P.litre.earnedNew, P.litre.received, P.litre.remainingOld, P.litre.remainingNew], [-15000, 0, 375, 200, -200, 175]);
  assert.deepEqual(rulesAt(d.customers[0], "2026-09-01", "Sefer"), [], "kural başlangıcından önceki tarihte geçerli kural yok");
});
test("eski litre hakkı bugünkü kuralla değişmiş görünse de önizleme bunu FARKLI diye gösterir, düzeltilebilir saymaz", () => {
  const d = base({ per: 80 });
  const w = rec({ date: "2026-10-09", customer_id: "X", vehicle_id: "V", unit: "Sefer", quantity: 5, material: "gravak", customer_fuel_allowance_l: 375, fuel_rule_id: "r1", price_snapshot: { unit_price: 0, amount: 0, kdv_rate: 0, price_source: "Mazot karşılığı" } });
  d.work_records.push(w);
  assert.equal(fuelAudit(d, "X").fixable.length, 0);
  const r = fixPreview(d, "X", [w.id]).rows[0];
  assert.match(r.diff, /İşte 375 L kayıtlı; bugünkü kural 400 L verir \(FARKLI — eski hak değiştirilmez\)/); assert.equal(r.ok, false);
});
console.log(`fuel-audit: ${n} test geçti`);

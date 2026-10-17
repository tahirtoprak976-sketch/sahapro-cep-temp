// "Müşteriden mazotla tahsilat alacaktan düşmüyor" — YENİDEN ÜRETİM (TEST VERİSİ, gerçek kayıt yok, hiçbir şey yazmaz).
// Kayıtlar, uygulamanın üç giriş yolunun (asistan, Yakıt formu, şoför paketi) BUGÜN yazdığı alanlarla kurulur:
//   fuel_records { fuel_source: "Müşteri Verdi", customer_id, liters, total: null, unit_price: null }  — cari hareket YOK
// Çalıştır: node tools/analiz/mazot_repro.mjs
import { receivables, customerOpenItems, customerBalances } from "../../js/collect-core.js";
import { customerFuelLedger, applyFuelPay } from "../../js/assistant-rules.js";
import { customerStatement } from "../../js/statement.js";
import { customerLedgerMovements } from "../../js/collect-core.js";

const T = "2026-10-12";
const rec = (o) => ({ id: Math.random().toString(36).slice(2), created_at: T + "T10:00:00Z", ...o });
const base = () => ({ customers: [], work_records: [], fuel_records: [], fuel_tank_movements: [], cari_movements: [], hakedis: [], cash_records: [], sites: [], vehicles: [{ id: "V", name: "34 KM 101" }] });
const priced = (cid, q, p, date = "2026-10-05") => rec({ date, customer_id: cid, vehicle_id: "V", work_type: "Moloz Nakliye", unit: "Sefer", quantity: q, price_snapshot: { unit_price: p, amount: p * q, kdv_rate: 20, kdv_included: false, price_source: "Müşteriye Özel Fiyat" } });
// Bugünkü kayıt şekli (js/assistant.js fuel dalı, js/m-ops.js Yakıt formu): müşteri verdiyse total/unit_price ZORLA null
const customerFuel = (cid, L, date = T) => rec({ date, vehicle_id: "V", liters: L, fuel_source: "Müşteri Verdi", customer_id: cid, total: null, unit_price: null, receipt: "Müşteri", customer_billable: false });
const show = (title, d, cid) => {
  const oi = customerOpenItems(d, cid, T), bal = customerBalances(d).bal[cid], rv = receivables(d, { today: T }).rows?.find?.((r) => r.id === cid);
  const st = customerStatement(customerLedgerMovements(d, cid), cid);
  const fl = customerFuelLedger(d, cid);
  console.log(`\n== ${title}`);
  console.log(`  Toplam alacak (customerBalances): ${bal} ₺ · açık kalemler toplamı: ${oi.open.reduce((n, x) => n + x.left, 0)} ₺ · tahsil edilen: ${oi.paid} ₺${rv ? ` · alacak listesi: ${rv.total ?? rv.amount ?? ""}` : ""}`);
  console.log(`  Ekstre son bakiye: ${st.closing ?? st.balance ?? JSON.stringify(st).slice(0, 80)}`);
  console.log(`  Mazot hesabı (litre): hak edilen ${fl.earned} L · alınan ${fl.received} L · kalan ${fl.balance} L`);
};

// A) TL borcu + mazotla ödeme (fiyat kuralı yok): 10 sefer × 3.000 = 30.000 ₺ borç; müşteri 200 L mazot verdi (mutabakat 45 ₺/L = 9.000 ₺)
{
  const d = base(); d.customers.push({ id: "A", name: "Model A Test Müşterisi" });
  d.work_records.push(priced("A", 10, 3000));
  d.fuel_records.push(customerFuel("A", 200));
  show("Model A: 30.000 ₺ borç, 200 L mazot verdi (beklenen kalan 21.000 ₺)", d, "A");
  console.log("  → SONUÇ: alacak 30.000 ₺ kalıyor; yakıt yalnız litre hesabına '−200 L' (hak edilmemiş alım) olarak düşüyor. TL karşılığı hiçbir yerde tutulmuyor.");
}
// B) Litre hakkı (Kılıç tipi, ücret yalnız mazot): sefer başı 75 L; 5 sefer; 200 L alındı
{
  const d = base(); d.customers.push({ id: "B", name: "Model B Test Müşterisi", fuel_rules: [{ id: "r1", per: 75, unit: "Sefer", only_pay: true }] });
  d.work_records.push(applyFuelPay(d, { ...rec({ date: "2026-10-05", customer_id: "B", vehicle_id: "V", work_type: "Moloz Nakliye", unit: "Sefer", quantity: 5 }) }));
  d.fuel_records.push(customerFuel("B", 200));
  show("Model B: 5 sefer × 75 L = 375 L hak, 200 L alındı (beklenen kalan 175 L, TL alacak yok)", d, "B");
  console.log("  → SONUÇ: model B bugün DOĞRU çalışıyor (TL alacak 0, litre 375/200/175).");
}
// Para + mazot (only_pay:false): 5 sefer × 3.000 ₺ + sefer başı 75 L; 200 L alındı
{
  const d = base(); d.customers.push({ id: "C", name: "Para+Mazot Test Müşterisi", fuel_rules: [{ id: "r1", per: 75, unit: "Sefer", only_pay: false }] });
  d.work_records.push(applyFuelPay(d, priced("C", 5, 3000)));
  d.fuel_records.push(customerFuel("C", 200));
  show("Para + mazot: 15.000 ₺ + 375 L hak, 200 L alındı (TL alacak 15.000 kalmalı, litre 175)", d, "C");
  console.log("  → SONUÇ: iki hak ayrı izleniyor; mazot TL alacaktan düşmüyor (bu sözleşmede doğru).");
}
// Depoya müşteriden giriş (fuel_tank_movements GİRİŞ customer_id) + aynı mazotun araca çıkışı: litre bir kez düşmeli
{
  const d = base(); d.customers.push({ id: "D", name: "Depo Test Müşterisi", fuel_rules: [{ id: "r1", per: 75, unit: "Sefer", only_pay: true }] });
  d.work_records.push(applyFuelPay(d, { ...rec({ date: "2026-10-05", customer_id: "D", vehicle_id: "V", work_type: "Moloz Nakliye", unit: "Sefer", quantity: 5 }) }));
  d.fuel_tank_movements.push(rec({ date: T, move_type: "GİRİŞ", liters: 200, customer_id: "D" }));
  d.fuel_records.push(rec({ date: T, vehicle_id: "V", liters: 200, fuel_source: "Depo Tankı" })); // depodan araca çıkış (müşteri ödemesi DEĞİL)
  show("Depoya müşteriden 200 L, sonra depodan araca 200 L (litre bir kez düşmeli: kalan 175 L)", d, "D");
}

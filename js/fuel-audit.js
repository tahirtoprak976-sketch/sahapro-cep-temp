// Mazot (litre hakkı) hesabı DENETİMİ — SAF katman, kayıt yazmaz.
// Sefer başı litre anlaşması olan müşteride "aldığım mazot alacaktan düşmedi" şikâyetinin olası nedenlerini kayıt kayıt listeler:
//   tlWorks      Kurala uymadığı için TL fiyatla yazılmış iş (TL alacakta görünür; mazot bunu düşürmez). Nedeni: birim / tarih / kelime / kural sonradan
//   lockedTl     Aynı durumdaki iş kesinleşmiş hakedişte (düzeltme hakediş üzerinden yapılmalı)
//   mixed        İşte hem litre hakkı hem TL tutar var ama kural "ücret yalnız mazot"
//   unlinkedFuel Müşteri adı geçen ama müşteriye bağlanmamış yakıt kaydı / depo girişi (litre hesabından düşmez)
//   pricedGift   "Müşteri verdi" kaydında TL tutar var (maliyet sayılabilir)
// Hiçbir kayıt kendiliğinden düzeltilmez.
import { isActive } from "./core.js";
import { fuelRulesOf, workHay, applyFuelPay, customerFuelLedger } from "./assistant-rules.js";
import { workAmount } from "./collect-core.js";

const live = (d, s) => (d[s] || []).filter(isActive);
const fold = (s) => String(s || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
const nameKey = (c) => fold(c?.name).split(" ").find((w) => w.length >= 3) || "";

// Bir işin kurala neden UYMADIĞI (ilk kuralın açıklaması, birden çok kuralda her biri)
export function whyNoRule(d, w, c) {
  const rules = fuelRulesOf(c);
  if (!rules.length) return ["müşteride mazot kuralı yok"];
  const hay = workHay(d, w, "");
  return rules.map((r) => {
    const u = r.unit || "Sefer";
    if (u !== w.unit) return `birim ${w.unit || "—"} (kural: ${u})`;
    if (r.from && w.date < r.from) return `iş tarihi ${w.date} kural başlangıcından (${r.from}) önce`;
    if (r.to && w.date > r.to) return `iş tarihi ${w.date} kural bitişinden (${r.to}) sonra`;
    const words = fold(r.match).split(" ").filter((x) => x.length >= 3);
    const miss = words.filter((x) => !hay.includes(` ${x}`));
    if (miss.length) return `işte "${miss.join(" ")}" kelimesi yok (kural yalnız "${r.match}" işleri için)`;
    if (r.created_at && w.created_at && w.created_at < r.created_at) return "iş, kural eklenmeden önce kaydedilmiş";
    return "iş kural eklenmeden önce kaydedilmiş olabilir (şimdi uyuyor)";
  });
}

export function fuelAudit(d, customerId) {
  const c = live(d, "customers").find((x) => x.id === customerId);
  const rules = fuelRulesOf(c);
  const billed = new Map();
  for (const h of live(d, "hakedis").filter((h) => h.status === "Kesinleşti")) for (const i of h.items || []) billed.set(i.work_record_id, h);
  const works = live(d, "work_records").filter((w) => w.customer_id === customerId);
  const tlWorks = [], lockedTl = [], mixed = [];
  for (const w of works) {
    const amt = workAmount(w), L = Number(w.customer_fuel_allowance_l) || 0;
    const now = applyFuelPay(d, w, "");
    const onlyPay = now.price_snapshot?.price_source === "Mazot karşılığı";
    if (amt > 0 && !L) {
      const row = { id: w.id, date: w.date, quantity: w.quantity, unit: w.unit, label: [w.material, w.work_type].filter(Boolean).join(" · "), amount: amt,
        why: whyNoRule(d, w, c), wouldMatch: !!now.customer_fuel_allowance_l, liters: now.customer_fuel_allowance_l || 0, onlyPay, hakedis: billed.get(w.id)?.hakedis_no || null };
      (row.hakedis ? lockedTl : tlWorks).push(row);
    } else if (amt > 0 && L && rules.some((r) => r.id === w.fuel_rule_id && r.only_pay !== false))
      mixed.push({ id: w.id, date: w.date, quantity: w.quantity, unit: w.unit, amount: amt, liters: L });
  }
  const key = nameKey(c);
  const mentions = (x) => key && fold([x.description, x.note, x.company].filter(Boolean).join(" ")).includes(key);
  const unlinkedFuel = [
    ...live(d, "fuel_records").filter((f) => !f.customer_id && f.fuel_source !== "Müşteri Verdi" && mentions(f)).map((f) => ({ id: f.id, store: "fuel_records", date: f.date, liters: Number(f.liters) || 0, where: `araca (${f.fuel_source || "kaynak yok"})` })),
    ...live(d, "fuel_tank_movements").filter((m) => m.move_type === "GİRİŞ" && !m.customer_id && mentions(m)).map((m) => ({ id: m.id, store: "fuel_tank_movements", date: m.date, liters: Number(m.liters) || 0, where: m.supplier_id ? "depoya (petrolcüden kayıtlı)" : "depoya" })),
  ];
  const pricedGift = live(d, "fuel_records").filter((f) => f.fuel_source === "Müşteri Verdi" && f.customer_id === customerId && Number(f.total) > 0).map((f) => ({ id: f.id, date: f.date, liters: f.liters, total: f.total }));
  const sum = (a, k) => Math.round(a.reduce((n, x) => n + (Number(x[k]) || 0), 0) * 100) / 100;
  return { customer: c?.name || "", rules, ledger: customerFuelLedger(d, customerId), tlWorks, lockedTl, mixed, unlinkedFuel, pricedGift,
    tlTotal: sum([...tlWorks, ...lockedTl], "amount"), fixable: tlWorks.filter((x) => x.wouldMatch),
    clean: !tlWorks.length && !lockedTl.length && !mixed.length && !unlinkedFuel.length && !pricedGift.length };
}

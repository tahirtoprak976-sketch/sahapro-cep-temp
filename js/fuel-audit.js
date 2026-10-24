import {recordLocalText,recordNoteText} from './record-notes.js';
// Mazot (litre hakkı) hesabı DENETİMİ — SAF katman, kayıt yazmaz.
// Sonuçlar KESİN HATA DEĞİL, "inceleme adayı"dır: kayıtların arkasındaki gerçek anlaşma (litre hakkı mı, TL borcuna karşılık mazot mu,
// iş gerçekten mazot karşılığı mıydı) uygulamada doğrulanamaz; kullanıcı doğrular.
// Litre kuralı olan müşteride "aldığım mazot alacaktan düşmedi" görüntüsünün olası nedenlerini kayıt kayıt listeler:
//   tlWorks      Kurala uymadığı için TL fiyatla yazılmış iş (TL alacakta görünür; mazot bunu düşürmez). Nedeni: birim / tarih / kelime / kural sonradan
//   lockedTl     Aynı durumdaki iş kesinleşmiş hakedişte (düzeltme hakediş üzerinden yapılmalı)
//   mixed        İşte hem litre hakkı hem TL tutar var ama kural "ücret yalnız mazot"
//   unlinkedFuel Müşteri adı geçen ya da "müşteri verdi" olup müşterisi boş kalmış yakıt kaydı / depo girişi (litre hesabından düşmez).
//                linkable: yalnız mevcut kaydın müşteri alanı doldurulabilir (petrolcüsüz ve tutarsız depo girişi, müşterisi boş "müşteri verdi");
//                istasyon alışı ve depodan araca çıkış müşteri ödemesi değildir, yalnız listelenir. Yeni yakıt / tahsilat kaydı AÇILMAZ.
//   pricedGift   "Müşteri verdi" kaydında TL tutar var (maliyet sayılabilir)
// Hiçbir kayıt kendiliğinden düzeltilmez.
import { isActive } from "./core.js";
import { fuelRulesOf, workHay, applyFuelPay, customerFuelLedger } from "./assistant-rules.js";
import { workAmount } from "./collect-core.js";
import { workMoney } from "./vat-contract.js";

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
  const mentions = (x) => key && fold([recordLocalText(x,d,'fuel'),x.company].filter(Boolean).join(' ')).includes(key);
  const unlinkedFuel = [
    ...live(d, "fuel_records").filter((f) => !f.customer_id && (f.fuel_source === "Müşteri Verdi" || mentions(f))).map((f) => ({ id: f.id, store: "fuel_records", date: f.date, liters: Number(f.liters) || 0, vehicle_id: f.vehicle_id || null,
      where: f.fuel_source === "Müşteri Verdi" ? "araca (müşteri verdi, müşterisi boş)" : `araca (${f.fuel_source || "kaynak yok"})`, note: recordNoteText(f,'description',d,'fuel'), linkable: f.fuel_source === "Müşteri Verdi" })),
    ...live(d, "fuel_tank_movements").filter((m) => m.move_type === "GİRİŞ" && !m.customer_id && mentions(m)).map((m) => ({ id: m.id, store: "fuel_tank_movements", date: m.date, liters: Number(m.liters) || 0,
      where: m.supplier_id ? "depoya (petrolcüden kayıtlı)" : Number(m.total) > 0 ? "depoya (tutarlı alış)" : "depoya", note: m.note || "", linkable: !m.supplier_id && !(Number(m.total) > 0) })),
  ];
  const pricedGift = live(d, "fuel_records").filter((f) => f.fuel_source === "Müşteri Verdi" && f.customer_id === customerId && Number(f.total) > 0).map((f) => ({ id: f.id, date: f.date, liters: f.liters, total: f.total }));
  const sum = (a, k) => Math.round(a.reduce((n, x) => n + (Number(x[k]) || 0), 0) * 100) / 100;
  return { customer: c?.name || "", rules, ledger: customerFuelLedger(d, customerId), tlWorks, lockedTl, mixed, unlinkedFuel, pricedGift,
    tlTotal: sum([...tlWorks, ...lockedTl], "amount"), fixable: tlWorks.filter((x) => x.wouldMatch),
    clean: !tlWorks.length && !lockedTl.length && !mixed.length && !unlinkedFuel.length && !pricedGift.length };
}

// MEVCUT kural kayıtlarından, tarih aralığı ve birimi bu işi kapsayanlar. Kural değişiklik geçmişi TUTULMAZ: tarih aralığının uyması,
// kuralın o tarihte bu içerikte olduğunun kanıtı değildir. Yalnız "mevcut kurala göre öneri"dir; geçmiş anlaşmayı kullanıcı doğrular.
export function rulesAt(c, date, unit) {
  return fuelRulesOf(c).filter((r) => (r.unit || "Sefer") === unit && (!r.from || date >= r.from) && (!r.to || date <= r.to));
}
const ruleText = (r) => `${r.per} L / ${String(r.unit || "Sefer").toLocaleLowerCase("tr-TR")}${r.match ? ` ("${r.match}" işleri)` : ""}${r.only_pay !== false ? ", ücret yalnız mazot" : ", ücret + mazot"}${r.from || r.to ? ` · ${r.from || "…"} – ${r.to || "…"}` : " · süresiz"}`;
// Seçilen işlere bugünkü kural uygulanırsa ne değişir — kayıt kayıt ve toplamlar (yazmaz)
export function fixPreview(d, customerId, workIds) {
  const c = live(d, "customers").find((x) => x.id === customerId);
  const L0 = customerFuelLedger(d, customerId);
  const ws = live(d, "work_records").filter((w) => workIds.includes(w.id));
  const veh = (id) => live(d, "vehicles").find((v) => v.id === id)?.name || "";
  let dTL = 0, dL = 0;
  const money = { net: 0, kdv: 0, gross: 0, booked: 0 };
  const rows = ws.map((w) => {
    const f = applyFuelPay(d, w, "");
    const oldAmt = workAmount(w), newAmt = Number(f.price_snapshot?.amount ?? oldAmt) || 0, newL = Number(f.customer_fuel_allowance_l) || 0, oldL = Number(w.customer_fuel_allowance_l) || 0;
    dTL += newAmt - oldAmt; dL += newL - oldL;
    const at = rulesAt(c, w.date, w.unit), today = fuelRulesOf(c).find((r) => r.id === f.fuel_rule_id);
    // Tutar ayrımı: net (KDV hariç), KDV, brüt (KDV dahil) ve bugünkü cari hesabının topladığı tutar (fiyat neyse o)
    const mm = (x) => { const m = workMoney(x); return m ? { net: m.net, kdv: m.kdv, gross: m.gross, booked: m.booked, rate: m.rate, basis: m.basis } : { net: 0, kdv: 0, gross: 0, booked: 0, rate: null, basis: null }; };
    const m0 = mm(w), m1 = mm({ ...w, price_snapshot: f.price_snapshot });
    for (const k of ["net", "kdv", "gross", "booked"]) money[k] += m1[k] - m0[k];
    return {
      id: w.id,
      record: `${w.date} · ${veh(w.vehicle_id)} · ${w.quantity} ${String(w.unit || "").toLocaleLowerCase("tr-TR")} ${[w.material, w.work_type].filter(Boolean).join(" · ")} · fiyat ${w.price_snapshot?.unit_price ?? "—"} ₺ (${w.price_snapshot?.price_source || "fiyatsız"}) = ${oldAmt} ₺ · litre hakkı ${oldL || "yok"}`,
      current: at.length ? at.map(ruleText) : ["Mevcut kurallardan hiçbirinin tarih aralığı bu işi kapsamıyor"],
      money: { old: m0, new: m1 },
      diff: today ? (oldL ? `İşte ${oldL} L kayıtlı; bugünkü kural ${newL} L verir${oldL !== newL ? " (FARKLI — eski hak değiştirilmez)" : ""}` : `İşte litre hakkı yok, ${oldAmt} ₺ TL fiyatlı; bugünkü kural (${ruleText(today)}) uygulanırsa ${newL} L hak${f.price_snapshot?.price_source === "Mazot karşılığı" ? ", TL tutar 0" : ", TL tutar aynı kalır"}`) : "Bugünkü kural bu işe uymuyor",
      changes: [`İş ${String(w.id).slice(0, 8)}: TL tutar ${oldAmt} → ${newAmt} ₺, litre hakkı ${oldL || 0} → ${newL} L${f.price_snapshot?.price_source !== w.price_snapshot?.price_source ? `, fiyat kaynağı "${w.price_snapshot?.price_source || "—"}" → "${f.price_snapshot?.price_source}"` : ""}`],
      ok: newL > 0 && !oldL,
    };
  });
  const r1 = (n) => Math.round(n * 100) / 100;
  return { rows, tl: { delta: r1(dTL) }, money: Object.fromEntries(Object.entries(money).map(([k, v]) => [k, r1(v)])), litre: { earnedOld: L0.earned, earnedNew: r1(L0.earned + dL), received: L0.received, remainingOld: L0.balance, remainingNew: r1(L0.balance + dL) } };
}

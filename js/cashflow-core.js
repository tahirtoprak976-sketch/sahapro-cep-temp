import {paymentAgenda} from './payment-agenda.js';
import {realDate} from './work-explorer.js';
import {parseTrNumber} from './money-roles.js';
// Nakit tahmini (önümüzdeki 5 hafta) — SAF katman. "Param yetecek mi?" sorusunun cevabı.
// KAYITLI VADE/SÖZ: ödeme sözleri, çek/senet vadeleri, esnaf borçları, maaş kalanı ve belge yenileme.
// TAHMİNİ: sözü olmayan müşteri alacakları (ödeme alışkanlığına göre), mazot / gider / bakım (son günlerin ortalaması).
// İki senaryo: normal (kesin + tahmini girişler) ve kötü (yalnız kesin girişler; çıkışların hepsi).
import { isActive, todayStr, addDays, toKurus, fromKurus } from "./core.js";
import { receivables } from "./collect-core.js";
import { payrollFor } from "./payroll-core.js";

const live = (d, s) => (d[s] || []).filter(isActive);
const r0 = (n) => fromKurus(toKurus(n));
const days = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
const sumBy = (xs, f) => xs.reduce((n, x) => n + (Number(f(x)) || 0), 0);
const positive = n => n !== '' && n != null && ['string','number'].includes(typeof n) && Number.isFinite(Number(n)) && Number(n) >= .01 && Number.isSafeInteger(toKurus(n));
export function cashAmountInput(raw) {
  const s=String(raw??'').trim().replace(/−/g,'-');
  if(!/^[+-]?(?:\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)$/.test(s))throw Error('Geçerli tutar yazın; en fazla iki ondalık basamak kullanın.');
  const amount=parseTrNumber(s.replace(/^[+-]/,''))*(s.startsWith('-')?-1:1);
  if(!Number.isFinite(amount)||Math.abs(amount)>1e12)throw Error('Nakit tutarı geçersiz veya sınırı aşıyor.');
  return amount;
}

// Müşterinin ödeme alışkanlığı: tahsilat tarihlerinden önceki en eski açık işe kadar geçen günlerin ortalaması yerine
// basit ve sağlam bir ölçü: son 6 ayda tahsilatlar arası ortalama gün (en az 15, en çok 90). Veri yoksa 45.
export function payLag(d, customerId, today) {
  const pays = live(d, "cari_movements").filter((m) => m.customer_id === customerId && m.type === "Tahsilat" && m.date >= addDays(today, -180) && m.date <= today).map((m) => m.date).sort();
  if (pays.length < 2) return 45;
  const gaps = pays.slice(1).map((x, i) => days(pays[i], x)).filter((g) => g > 0);
  if (!gaps.length) return 45;
  return Math.max(15, Math.min(90, Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)));
}

export function cashForecast(d, { today = todayStr(), weeks = 5, notes = {}, cashOnHand = null } = {}) {
  if(!realDate(today)||!Number.isInteger(weeks)||weeks<1||weeks>52)throw Error('Nakit tahmini için geçerli gün ve 1–52 hafta gerekli.');
  const end = addDays(today, weeks * 7 - 1);
  const items = [];
  const reviews = [];
  const add = (date, dir, sure, amount, label, sub = "", href = "") => {
    amount = r0(amount);
    if (!(amount > 0)) return;
    items.push({ date: date < today ? today : date, late: date < today, dir, sure, amount, label, sub, href });
  };
  const nm = (s, id) => live(d, s).find((r) => r.id === id)?.name || "";

  // ---- Girişler ----
  const rec = receivables(d, { today, notes });
  for (const r of rec.rows) {
    const reserved=sumBy(rec.cheques.filter(q=>q.party_type==='customer'&&q.party_id===r.id&&q.direction==='Alınan'&&q.status!=='Karşılıksız'&&realDate(q.due_date)&&positive(q.amount)),q=>q.amount);
    let left = Math.max(0,r0(r.total-reserved));
    if (r.promise) {
      if(!realDate(r.promise.date)||!Number.isFinite(Number(r.promise.amount))||Number(r.promise.amount)<0)reviews.push({label:r.name+' ödeme sözü',reason:'Söz tarihi veya tutarı kontrol edilmeli.',href:'#/tahsilat/'+r.id});
      else {
        const a = Math.min(left, r.promise.amount || left);
        add(r.promise.date, "in", true, a, `${r.name} — ödeme sözü`, r.promise.late ? "söz tarihi geçti" : "", "#/tahsilat/" + r.id);
        left = r0(left-a);
      }
    }
    // Reserve checks before a promise, so the same receivable is never promised twice.
    if (left > 0) {
      const lag = payLag(d, r.id, today);
      const exp = addDays(r.oldest_date, lag);
      add(exp, "in", false, left, `${r.name} — alacak`, `ödeme alışkanlığı ~${lag} gün · en eski ${r.oldest_days} günlük`, "#/tahsilat/" + r.id);
    }
  }
  for (const q of rec.cheques.filter((q) => q.status !== "Karşılıksız")) {
    if(!realDate(q.due_date)||!positive(q.amount)||!['Alınan','Verilen'].includes(q.direction)){
      reviews.push({label:q.document_no||'Çek / senet',reason:'Vade, yön veya tutar kontrol edilmeli.',href:'#/ceksenet/'+q.id});continue;
    }
    if(q.due_date>end)continue;
    const party = q.party_type === "customer" ? nm("customers", q.party_id) : nm("suppliers", q.party_id);
    add(q.due_date, q.direction === "Alınan" ? "in" : "out", true, q.amount, `${q.kind || "Çek"} ${q.direction === "Alınan" ? "tahsili" : "ödemesi"} — ${party}`, `vade ${q.due_date}${q.document_no ? " · no " + q.document_no : ""}`,'#/ceksenet/'+q.id);
  }

  // ---- Çıkışlar ----
  // Esnaf / tedarikçi borçları (vade yoksa belge tarihi + 30 gün)
  const bills = new Map(live(d,'payables').map(b=>[b.id,b]));
  for(const row of paymentAgenda(d,{today}).rows){
    const b=bills.get(row.id);
    if(row.issues.length)reviews.push({label:row.name+' · '+row.document,reason:row.issues.join(' '),href:row.hash});
    if(row.remaining==null||!realDate(b.date))continue;
    const due=realDate(b.due_date)&&b.due_date>=b.date?b.due_date:addDays(b.date,30);
    add(due,'out',realDate(b.due_date)&&b.due_date>=b.date,row.remaining,row.name+' borcu',b.due_date===due?(b.cost_category||b.description||''):'Vade bilinmiyor; belge +30 gün tahmini',row.hash);
    if(row.cheques.length)reviews.push({label:row.name,reason:'Aynı tarafta açık borç ve verilmiş çek/senet var. Aynı borç için olup olmadığını kontrol edin; tutarlar otomatik mahsup edilmedi.',href:row.hash});
  }
  for(const p of live(d,'supplier_payments').filter(p=>!p.payable_id&&(!realDate(p.date)||p.date<=today)))reviews.push({label:'Belgeye bağlanmamış ödeme',reason:'Ödeme herhangi bir borç belgesinden varsayımla düşülmedi; eşleştirmeyi kontrol edin.',href:'#/odeme-takibi'});
  for(const e of live(d,'expense_records').filter(e=>e.date<=today&&e.payment_method==='Personel Ödedi'&&e.reimbursement_status==='Bekliyor'))
    add(today,'out',false,e.amount,'Personel masrafı geri ödeme',nm('personnel',e.personnel_id)+' · ödeme günü tahmini','#/gider/'+e.id);
  // Maaşlar: bu ay kalan (ay sonu + 1) + geçen ay ödenmemiş kalan (hemen)
  const per = today.slice(0, 7);
  const prevD = new Date(today.slice(0, 8) + "01T12:00:00"); prevD.setMonth(prevD.getMonth() - 1);
  const prev = prevD.toISOString().slice(0, 7);
  const nextFirst = (() => { const x = new Date(today.slice(0, 8) + "01T12:00:00"); x.setMonth(x.getMonth() + 1); return x.toISOString().slice(0, 10); })();
  let payNow = 0, payNext = 0, payEst = 0, payCard = 0;
  const usesPayroll = new Set(live(d, "payroll_entries").map((e) => e.personnel_id));
  for (const p of live(d, "personnel").filter((p) => p.active !== false && (Number(p.salary) > 0 || Number(p.daily_wage) > 0))) {
    // Puantaj/maaş defteri kullanılmıyorsa karttaki ücret ay başında ödenecek sayılır (eski ayların "ödenmedi" sanılmaması için)
    if (!usesPayroll.has(p.id)) { payCard += Number(p.salary) > 0 ? Number(p.salary) : (Number(p.daily_wage) || 0) * 26; continue; }
    const pr = payrollFor(d, p, prev, { today });
    if (pr.remaining > 0) payNow += pr.remaining;
    const cur = payrollFor(d, p, per, { today });
    payNext += Math.max(0, cur.remaining);
    // Yevmiyeli: ay sonuna kadar kalan iş günleri (pazar hariç) tahmini
    if (cur.type === "Yevmiye" && !cur.closed) {
      let n = 0; for (let x = addDays(today, 1); x < nextFirst; x = addDays(x, 1)) if (new Date(x + "T12:00:00").getDay() !== 0) n++;
      payEst += n * (Number(p.daily_wage) || 0);
    }
  }
  add(today, "out", true, payNow, "Geçen ayın ödenmemiş maaşları", "puantajdan", "#/puantaj");
  add(nextFirst, "out", true, payNext, "Bu ayın maaşları (şimdiye kadar hak edilen)", "puantajdan · avanslar düşüldü", "#/puantaj");
  add(nextFirst, "out", true, payCard, "Maaşlar (personel kartındaki ücret)", "puantaj kullanılmayanlar · yevmiye × 26 gün", "#/personel");
  add(nextFirst, "out", false, payEst, "Yevmiyeliler — ay sonuna kadar tahmini", "kalan iş günleri × yevmiye", "#/puantaj");
  // Belge yenileme: süresi dolacak belgenin önceki tutarı biliniyorsa
  const docs = live(d, "documents").filter((x) => x.expiry_date && x.expiry_date >= today && x.expiry_date <= end && Number(x.amount) > 0);
  for (const x of docs) add(x.expiry_date, "out", true, x.amount, `${x.category} yenileme`, `${nm("vehicles", x.vehicle_id) || nm("personnel", x.personnel_id) || ""} · geçen seferki tutar`, "#/belgeler/" + x.id);
  // Ortalama giderler (son 30/60/90 gün) → haftalık eşit dağıtım
  const since = (n) => addDays(today, -n);
  const fuelDaily = (sumBy(live(d, "fuel_records").filter((f) => f.date >= since(30) && f.date <= today && !["Müşteri Verdi", "Depo Tankı"].includes(f.fuel_source)), (f) => f.total)
    + sumBy(live(d, "fuel_tank_movements").filter((m) => m.move_type === "GİRİŞ" && !m.customer_id && m.date >= since(30) && m.date <= today), (m) => m.total)) / 30;
  const expDaily = sumBy(live(d, "expense_records").filter((e) => !e.invoice_paid && e.date >= since(60) && e.date <= today && !e.supplier_id && !(e.payment_method === "Personel Ödedi" && e.reimbursement_status === "Bekliyor")), (e) => e.amount) / 60;
  const maintDaily = sumBy(live(d, "maintenance_records").filter((m) => m.date >= since(90) && m.date <= today && !m.supplier_id), (m) => m.cost) / 90;
  for (let w = 0; w < weeks; w++) {
    const ws = addDays(today, w * 7);
    add(ws, "out", false, fuelDaily * 7, "Mazot (son 30 gün ortalaması)", "", "#/yakit");
    add(ws, "out", false, expDaily * 7, "Diğer giderler (son 60 gün ortalaması)", "", "#/gider");
    add(ws, "out", false, maintDaily * 7, "Bakım / onarım (son 90 gün ortalaması)", "", "#/bakim");
  }

  // ---- Haftalara böl ----
  const W = [];
  for (let w = 0; w < weeks; w++) {
    const from = addDays(today, w * 7), to = addDays(from, 6);
    const its = items.filter((i) => i.date >= from && i.date <= to && i.date <= end);
    W.push({ from, to, items: its.sort((a, b) => a.dir.localeCompare(b.dir) || b.amount - a.amount),
      inSure: r0(sumBy(its.filter((i) => i.dir === "in" && i.sure), (i) => i.amount)), inEst: r0(sumBy(its.filter((i) => i.dir === "in" && !i.sure), (i) => i.amount)),
      outSure: r0(sumBy(its.filter((i) => i.dir === "out" && i.sure), (i) => i.amount)), outEst: r0(sumBy(its.filter((i) => i.dir === "out" && !i.sure), (i) => i.amount)) });
  }
  const start = cashOnHand == null ? null : (cashOnHand!==''&&Number.isFinite(Number(cashOnHand))&&Number.isSafeInteger(toKurus(cashOnHand))?r0(cashOnHand):null);
  if(cashOnHand!=null&&start==null)reviews.push({label:'Başlangıç nakdi',reason:'Kayıtlı nakit tutarı geçersiz; sıfır varsayılmadı.',href:'#/nakit'});
  let good = start ?? 0, bad = start ?? 0, lowGood = null, lowBad = null;
  for (const w of W) {
    good += w.inSure + w.inEst - w.outSure - w.outEst; bad += w.inSure - w.outSure - w.outEst;
    w.good = r0(good); w.bad = r0(bad);
    if (!lowGood || w.good < lowGood.amount) lowGood = { amount: w.good, week: w };
    if (!lowBad || w.bad < lowBad.amount) lowBad = { amount: w.bad, week: w };
  }
  const late = r0(sumBy(items.filter((i) => i.late && i.dir === "in"), (i) => i.amount));
  return { today, end, start, weeks: W, lowGood, lowBad, lateIn: late, reviews, complete:!reviews.length, totals: {
    inSure: r0(sumBy(W, (w) => w.inSure)), inEst: r0(sumBy(W, (w) => w.inEst)), outSure: r0(sumBy(W, (w) => w.outSure)), outEst: r0(sumBy(W, (w) => w.outEst)) } };
}

// Gemini'ye giden özet (yalnız hesaplanmış rakamlar)
export function forecastSummary(F) {
  return {
    bugun: F.today, baslangic_nakit_TL: F.start,
    kayitlar_tam:F.complete,kontrol_bekleyen:F.reviews.map(r=>r.label+': '+r.reason),
    varsayim:'Vade ve ödeme sözleri gerçekleşmiş para değildir. Kötü senaryo da kayıtlı vade/söz tahsilatının gerçekleştiğini varsayar. Eksik kayıt varsa bütün nakit ihtiyacı hesaplanmış sayılmaz.',
    haftalar: F.weeks.map((w) => ({ hafta: `${w.from}..${w.to}`, giris_kesin: w.inSure, giris_tahmini: w.inEst, cikis_kesin: w.outSure, cikis_tahmini: w.outEst, bakiye_normal: w.good, bakiye_kotu: w.bad,
      kalemler: w.items.slice(0, 8).map((i) => `${i.dir === "in" ? "+" : "-"}${i.amount} ${i.label}${i.sure ? "" : " (tahmini)"}${i.late ? " (gecikmiş)" : ""}`) })),
    en_dusuk_normal: F.lowGood?.amount, en_dusuk_kotu: F.lowBad?.amount, gecikmis_beklenen_tahsilat: F.lateIn,
  };
}

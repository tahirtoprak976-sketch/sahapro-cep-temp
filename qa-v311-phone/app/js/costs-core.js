import {linkedDumpExpenseIds} from "./dump-ledger-core.js";
import { recognizedBill, pricedBill } from "./ledger-policy.js";
// Tüm masraflar tek listede: gider + araca verilen yakıt + bakım/arıza + esnafa veresiye alış (gidere/bakıma bağlı değilse).
// Ana sayfa grafiği, Finans özeti, Giderler ekranı ve Yönetici paneli aynı tanımı kullanır.
// Müşterinin iş karşılığı verdiği mazot masraf sayılmaz (litre olarak müşterinin mazot hesabında izlenir).
// Depoya alınan mazot (tank girişi) masraf sayılmaz: araca verildikçe "Yakıt" olarak sayılır (çift sayım olmasın).
import { isActive, toKurus, fromKurus } from "./core.js";
import { dumpFeeRows, unassignedDumpCosts } from "./dump-fees.js";

const live = (d, s) => (d[s] || []).filter(isActive);
export const COST_KINDS = { gider: "Gider", yakit: "Yakıt", bakim: "Bakım / Arıza", esnaf: "Alış belgesi", dokum: "Döküm ücreti", personel: "Personel maaşı" };

export function billTotal(b) {
  if (Number(b.gross_total) > 0) return Number(b.gross_total);
  if (Number(b.total) > 0) return Number(b.total);
  if (Number(b.grand_total) > 0) return Number(b.grand_total);
  return (b.items || []).reduce((n, i) => n + (Number(i.total ?? i.gross ?? i.amount) || 0), 0);
}

export function costRows(d, { from = "", to = "", fuelRefPrice = null } = {}) {
  const inR = (x) => x && (!from || x >= from) && (!to || x <= to);
  const rows = [];
  const dumpLinked = linkedDumpExpenseIds(d);
  const linked = new Set(live(d, "payables").filter(pricedBill).filter(b => b.source_store && b.source_id).map(b => b.source_store + ":" + b.source_id));
  const name = (s, id) => (id ? live(d, s).find((x) => x.id === id)?.name || "" : "");
  for (const e of live(d, "expense_records"))
    if (inR(e.date) && Number(e.amount) > 0 && !e.dump_deposit && !dumpLinked.has(e.id) && !linked.has("expense_records:" + e.id)) // döküm hesabına yükleme gider değil (döküm ücreti ayrıca yazılır)
      rows.push({ kind: "gider", id: e.id, date: e.date, amount: Number(e.amount), label: e.category || "Gider", sub: [e.company, e.description].filter(Boolean).join(" · "), vehicle_id: e.vehicle_id || null, href: null });
  for (const f of live(d, "fuel_records")) {
    if (!inR(f.date) || f.fuel_source === "Müşteri Verdi" || linked.has("fuel_records:" + f.id)) continue;
    // Müşterinin verdiği mazot (ör. Kılıç'ın iş karşılığı) masraf değildir: kasadan para çıkmaz
    const a = Number(f.total) || 0;
    if (a > 0) rows.push({ kind: "yakit", id: f.id, date: f.date, amount: Math.round(a * 100) / 100, label: `${name("vehicles", f.vehicle_id) || "Araç"} · ${Number(f.liters) || 0} L`, sub: f.fuel_source || "", vehicle_id: f.vehicle_id || null, href: "#/yakit/" + f.id });
  }
  for (const m of live(d, "maintenance_records"))
    if (inR(m.date) && Number(m.cost) > 0 && !linked.has("maintenance_records:" + m.id))
      rows.push({ kind: "bakim", id: m.id, date: m.date, amount: Number(m.cost), label: `${name("vehicles", m.vehicle_id) || "Araç"} · ${m.maint_type || "Bakım"}`, sub: [m.service_company, m.description].filter(Boolean).join(" · "), vehicle_id: m.vehicle_id || null, href: "#/bakim/" + m.id });
  for (const b of live(d, "payables")) {
    if (!recognizedBill(b) || !inR(b.date)) continue;
    if (["expense_records", "maintenance_records", "fuel_records"].includes(b.source_store) && !pricedBill(b)) continue; // zaten sayıldı / depo alışı
    const a = billTotal(b);
    if (a > 0) rows.push({ kind: "esnaf", id: b.id, date: b.date, amount: Math.round(a * 100) / 100, label: `${name(({supplier:"suppliers", contractor:"contractors", quarry:"quarries", dump_site:"dump_sites"})[b.party_type] || "suppliers", b.party_id) || "İşletme"} · ${b.cost_category || "Alış"}`, sub: b.description || "", vehicle_id: b.vehicle_id || null, href: "#/alislar/" + b.id });
  }
  // Actual + remaining estimate share one row; unknown remainder is visible, not silently zero.
  for (const f of dumpFeeRows(d, { from, to })) {
    if (f.payable_overlap && !f.unverified) continue;
    rows.push({ ...f, w: undefined, kind:"dokum", id:"dokum:"+f.w.id, work_record_id:f.w.id,
      date:f.w.date, amount:f.payable_overlap?0:f.amount ?? 0, confirmed_amount:f.payable_overlap?0:f.confirmed_amount,
      label:`${f.site} · ${f.payable_overlap?"alış belgesinde":f.confirmed_amount} ₺ kesinleşen + ${f.remaining_estimated_amount==null?'doğrulanmamış':f.remaining_estimated_amount+' ₺ kalan tahmin'}`,
      sub:[name("vehicles",f.w.vehicle_id),name("customers",f.w.customer_id),f.unverified?f.missing_reason:null,...(f.payable_links||[]).map(b=>"Alış belgesi: "+b.date)].filter(Boolean).join(" · "),
      vehicle_id:f.w.vehicle_id||null, href:"#/isler/"+f.w.id });
  }
  for (const e of unassignedDumpCosts(d,{from,to})) rows.push({kind:"dokum",id:e.id,date:e.date,amount:e.amount,confirmed:true,confirmed_amount:e.amount,remaining_estimated_amount:0,expected_total:e.amount,pending_trips:0,label:"Fişli döküm · iş bağlantısı bekliyor",sub:e.receipt_no||e.note||"",vehicle_id:e.vehicle_id,href:"#/dokum-hesap/"+e.dump_site_id});
  // Personel maaşı: puantajda ay kapatılınca yazılan "Ücret Tahakkuku" (avans ve ödemeler ayrıca sayılmaz → çift sayım yok)
  for (const p of live(d, "payroll_entries"))
    if (p.kind === "Ücret Tahakkuku" && inR(p.date) && Number(p.amount) > 0)
      rows.push({ kind: "personel", id: p.id, date: p.date, amount: Number(p.amount), label: `${name("personnel", p.personnel_id) || "Personel"} · ${p.period} maaşı`, sub: p.note || "", vehicle_id: null, href: "#/puantaj/" + p.personnel_id + "?ay=" + p.period });
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return rows;
}

export function costTotals(rows) {
  const t = { gider: 0, yakit: 0, bakim: 0, esnaf: 0, dokum: 0, personel: 0 };
  for (const r of rows) t[r.kind] += toKurus(r.amount);
  const total = t.gider + t.yakit + t.bakim + t.esnaf + t.dokum + t.personel;
  return { gider: fromKurus(t.gider), yakit: fromKurus(t.yakit), bakim: fromKurus(t.bakim), esnaf: fromKurus(t.esnaf), dokum: fromKurus(t.dokum), personel: fromKurus(t.personel), total: fromKurus(total) };
}

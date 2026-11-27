// Müşteri cari ekstresi: saf hesaplar. Kayıt yazmaz; ekran ve paylaşım bunları kullanır.
// İşaret kuralı cari_movements ile aynı: Hakediş (+) müşteri borcu, Tahsilat (−), Düzeltme (±).
// Müşteriye giden metinde iç not / düzeltme nedeni yer almaz.
import {validDate} from './driver-delivery.js';
import { isActive, toKurus, fromKurus, toCSV } from "./core.js";

const LABEL = { Hakedis: "Hakediş", Tahsilat: "Tahsilat", Duzeltme: "Düzeltme", Is: "İş", MazotTeslimi: 'Mazot teslimi' };
const tl = (n) =>
  Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const trDate = (d) => (d ? d.split("-").reverse().join(".") : "");

// Ortak müşteri görünürlüğü: iç düzeltme açıklaması ve işlem nedeni dış nüshaya çıkmaz.
export const customerMovementText = (m) => m.type === "Duzeltme" ? "" : m.note || "";

export function validateReportPeriod({from='',to=''}={}){
 if(from&&!validDate(from)||to&&!validDate(to))throw Error('Geçerli başlangıç ve bitiş tarihi seçin.');
 if(from&&to&&from>to)throw Error('Başlangıç tarihi bitiş tarihinden sonra olamaz.');
}
export const STATEMENT_HEADERS=Object.freeze(['Tarih','İşlem','Açıklama','Borç','Tahsilat','Diğer azalış','Bakiye']);
export function movementCreditParts(m){const k=toKurus(m.amount);return {collected:m.type==='Tahsilat'&&k<0?fromKurus(-k):0,otherDecrease:m.type!=='Tahsilat'&&k<0?fromKurus(-k):0};}
export function statementCreditTotals(st){const collected=st.collected??fromKurus(st.rows.reduce((n,r)=>n+toKurus(r.collected??(r.type==='Tahsilat'?r.credit:0)),0));return {collected,otherDecrease:st.otherDecrease??fromKurus(toKurus(st.credit)-toKurus(collected))};}
export function statementCells(r,format=tl){const collected=r.collected??(r.type==='Tahsilat'?r.credit:0),other=r.otherDecrease??fromKurus(toKurus(r.credit)-toKurus(collected));return [trDate(r.date),r.type,r.text,r.debit?format(r.debit):'',collected?format(collected):'',other?format(other):'',format(r.balance)];}

export function customerStatement(movements, customerId, { from = "", to = "" } = {}) {
  validateReportPeriod({from,to});
  const mine = (movements || [])
    .filter((m) => isActive(m) && m.customer_id === customerId)
    .sort((a, b) => (a.date === b.date ? String(a.created_at || "").localeCompare(String(b.created_at || "")) : a.date.localeCompare(b.date)));
  let bal = mine
    .filter((m) => from && m.date < from)
    .reduce((s, m) => s + toKurus(m.amount), 0);
  const opening = bal;
  const rows = [];
  let debit = 0,
    credit = 0, collected=0, otherDecrease=0;
  for (const m of mine) {
    if ((from && m.date < from) || (to && m.date > to)) continue;
    const k = toKurus(m.amount);
    bal += k;
    if (k > 0) debit += k;
    else credit += -k;
    const parts=movementCreditParts(m);collected+=toKurus(parts.collected);otherDecrease+=toKurus(parts.otherDecrease);
    rows.push({
      ...parts,
      date: m.date,
      type: LABEL[m.type] || m.type || "Hareket",
      text: customerMovementText(m),
      debit: k > 0 ? fromKurus(k) : 0,
      credit: k < 0 ? fromKurus(-k) : 0,
      balance: fromKurus(bal),
    });
  }
  return {
    rows,
    opening: fromKurus(opening),
    debit: fromKurus(debit),
    credit: fromKurus(credit),
    closing: fromKurus(bal),
    collected:fromKurus(collected),otherDecrease:fromKurus(otherDecrease),
    advanceVerified:bal<0&&!mine.some(m=>(!to||m.date<=to)&&m.type!=='Tahsilat'&&toKurus(m.amount)<0),
  };
}

export function statementText(name, st, { from = "", to = "", today = "", max = 20 } = {}) {
  validateReportPeriod({from,to});
  const per = from || to ? `${trDate(from) || "başlangıç"} – ${trDate(to) || trDate(today) || "bugün"}` : "tüm hareketler";
  const shown = st.rows.slice(-max),totals=statementCreditTotals(st);
  const lines = [
    `*${name}* — Cari Ekstre`,
    `Dönem: ${per}`,
    st.opening ? `Devir: ${tl(st.opening)} ₺` : "",
    "",
    ...(st.rows.length > shown.length ? [`(son ${shown.length} hareket gösteriliyor)`] : []),
    ...shown.map(
      (r) =>
        `${trDate(r.date)} ${r.type}${r.text ? " (" + r.text + ")" : ""}: ${r.debit ? "+" + tl(r.debit) : "-" + tl(r.credit)} ₺`,
    ),
    "",
    `Toplam borç: ${tl(st.debit)} ₺`,
    `Toplam tahsilat: ${tl(totals.collected)} ₺`,
    totals.otherDecrease?`Diğer borç azalışları: ${tl(totals.otherDecrease)} ₺`:'',
    st.closing > 0
      ? `*Kalan bakiye: ${tl(st.closing)} ₺*`
      : st.closing < 0
        ? (st.advanceVerified?`*Alacağınız (avans): ${tl(-st.closing)} ₺*`:`*Müşteri lehine kayıtlı bakiye: ${tl(-st.closing)} ₺*`)
        : "*Kayıtlı bakiye: 0,00 ₺*\nBu tutar, tüm işlerin fiyatlandığı veya tahsil edildiği anlamına gelmez.",
  ];
  return lines.filter((l, i) => l !== "" || lines[i - 1] !== "").join("\n").trim();
}

export function statementCsv(st) {
 const totals=statementCreditTotals(st);
 const rows=[['','Devir','','','','',tl(st.opening)],...st.rows.map(r=>statementCells(r)),['','TOPLAM','',tl(st.debit),tl(totals.collected),tl(totals.otherDecrease),tl(st.closing)]];
 return '\uFEFF'+toCSV([...STATEMENT_HEADERS],rows);
}

import {sharedDumpBalance,dumpReceiptRows} from "./dump-ledger-core.js";
// Döküm sahası ön ödemeli hesap — SAF katman.
// Döküm sahasına önce para yatırılır (barkod alınır), her dökümde hesaptan düşer.
// Yatırılan para: gider kaydı (kategori "Döküm", dump_deposit: true, dump_site_id) — kâr/zararda GİDER SAYILMAZ (ön ödeme),
// maliyet döküm yapıldıkça (fişteki ton × ücret) yazılır. Nakit tahmininde ise gerçek para çıkışıdır.
import { isActive, todayStr, addDays } from "./core.js";
import { dumpFee, calculatedDumpFee } from "./dump-fees.js";

const live = (d, s) => (d[s] || []).filter(isActive);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fold = (s) => String(s || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
export const isDumpDeposit = (e) => !!e?.dump_deposit;

export const dumpDepositIntent = e => !!e.dump_deposit || /(yat[ıi]r|y[uü]kle|[oö]n [oö]deme|barkod.{0,20}al)/i.test(fold([e.description,e.note].join(" ")));
// Yükleme niyeti ve tek anlamlı saha eşleşmesi gerekir; yalnız saha adı gideri yüklemeye çevirmez.
export function depositSiteOf(d, e) {
  if(!dumpDepositIntent(e))return null;
  if (e.dump_site_id) return live(d, "dump_sites").find((s) => s.id === e.dump_site_id) || null;
  if (!/döküm|dokum/i.test(e.category || "")) return null;
  const t = fold([e.company, e.description, e.note].join(" "));
  const sites=live(d,"dump_sites").filter(s=>!s.own_yard&&fold(s.name).length>=3);
  const exact=sites.filter(s=>t.includes(fold(s.name)));
  if(exact.length===1)return exact[0];
  if(exact.length>1)return null;
  const candidates=sites.filter(s=>{const token=fold(s.name).split(" ")[0];return token.length>=3&&(" "+t.replace(/[^\p{L}\p{N}]+/gu," ")+" ").includes(" "+token+" ")});
  return candidates.length===1?candidates[0]:null;
}

// ---- Döküm faturası (İSTAÇ vb.) ----
// Fatura gider DEĞİLDİR: para hesaba yatırılırken ödendi, maliyet dökümde yazılıyor. Fatura, sahanın gerçek düştüğü tutarı/tonu gösterir → mutabakat.
// Aynı firma (İSTAÇ) birden çok sahayı faturalar; saha, faturadaki yer adından (ör. ARNAVUTKÖY/BOĞAZKÖY → Bolluca) ayrılır.
const PLACE_HINTS = { bolluca: ["bolluca", "boğazköy", "arnavutköy"], cebeci: ["cebeci", "sultangazi"] };
const DUMP_WORDS = /döküm|dokum|hafriyat|toprak|kazı|pasa|istaç|istac|moloz/;
export const DUMP_INVOICE = "Döküm Faturası";
export function tonOfItems(items) {
  let t = 0;
  for (const i of items || []) {
    const q = Number(i.qty) || 0, u = fold(i.unit);
    if (/^(kg|kgm|kilo)/.test(u)) t += q / 1000; else if (/^(ton|tn|t$)/.test(u)) t += q;
  }
  return Math.round(t * 1000) / 1000;
}
export function siteHints(s) {
  const n = fold(s.name);
  const own = [n.split(" ")[0], ...String(s.invoice_place || "").split(/[\/,;]+/).map(fold)];
  const extra = Object.entries(PLACE_HINTS).filter(([k]) => n.includes(k)).flatMap(([, v]) => v);
  return [...new Set([...own, ...extra].filter((h) => h.length >= 4))];
}
export function dumpInvoiceMatch(d, { company = "", seller_tax_no = "", text = "", items = [] }) {
  const sites = live(d, "dump_sites").filter((s) => !s.own_yard);
  const t = fold(company + " " + text);
  const vkn = String(seller_tax_no || "").replace(/\D/g, "");
  const byVkn = vkn ? sites.filter((s) => String(s.invoice_tax_no || "").replace(/\D/g, "") === vkn) : [];
  // Satıcı ünvanında geçen ad (ör. "İSTAÇ") yer sayılmaz; yer adı (Boğazköy, Cebeci…) aranır
  const co = fold(company), body = fold(text);
  const byPlace = sites.filter((s) => siteHints(s).some((h) => !co.includes(h) && (body.includes(h) || co.includes(h))));
  const specific = byPlace.filter((s) => siteHints(s).slice(1).some((h) => !co.includes(h) && body.includes(h)));
  if (byPlace.length > 1 && specific.length === 1) byPlace.splice(0, byPlace.length, specific[0]);
  const ton = tonOfItems(items);
  if (!byVkn.length && !(DUMP_WORDS.test(t) && (ton > 0 || byPlace.length))) return null;
  let site = null;
  const both = byVkn.filter((s) => byPlace.includes(s));
  if (both.length === 1) site = both[0];
  else if (byVkn.length === 1 && !byPlace.length) site = byVkn[0];
  else if (byPlace.length === 1) site = byPlace[0];
  return { site_id: site?.id || null, ton };
}
export function dumpInvoices(d, siteId) {
  return live(d, "documents").filter((x) => x.category === DUMP_INVOICE && x.owner_id === siteId).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function dumpAccounts(d, { today = todayStr(), siteId = null } = {}) {
 const out=[];
 for(const site of live(d,"dump_sites").filter(s=>!s.own_yard&&(!siteId||s.id===siteId))){
  const state=sharedDumpBalance(d,site.id,{today}),invoices=dumpInvoices(d,site.id).filter(doc=>doc.date<=today);
  const works=live(d,"work_records").filter(w=>w.dump_site_id===site.id&&w.date<=today);
  if(!siteId&&!state.deposits.length&&!state.receipts.length&&!state.opening&&!invoices.length&&!works.length&&!state.assumed_deposits.length)continue;
  const allReceipts=dumpReceiptRows(d).filter(e=>e.dump_site_id===site.id&&e.date<=today);
  const pending=[];
  for(const w of works){
   if(state.start&&w.date<state.start)continue;
   if(w.dump_payer==="customer")continue;
   const confirmed=allReceipts.filter(e=>e.work_record_id===w.id).reduce((n,e)=>n+e.trips,0),expected=w.unit==="Sefer"?Number(w.quantity):1,remaining=Math.max(0,expected-confirmed);
   if(!remaining)continue;const base=calculatedDumpFee(d,w);
   pending.push({w,f:base,remaining_trips:remaining,amount:base?.amount>0?r2(base.amount*remaining/expected):null});
  }
  const estimated=r2(pending.reduce((n,x)=>n+(x.amount||0),0));
  const inv=invoices.map(doc=>{
   const complete=!!doc.period_from&&!!doc.period_to,rows=complete?allReceipts.filter(e=>e.date>=doc.period_from&&e.date<=doc.period_to):[];
   const account=rows.filter(e=>e.payer==='company_account');
   return {doc,from:doc.period_from||null,to:doc.period_to||null,period_known:complete,ton:Number(doc.ton)||0,amount:Number(doc.amount)||0,ourTon:complete?r2(account.reduce((n,e)=>n+(e.tonnage||0),0)):null,ourAmount:complete?r2(account.reduce((n,e)=>n+e.amount,0)):null,ourTrips:complete?account.reduce((n,e)=>n+e.trips,0):null,perTon:Number(doc.ton)>0?r2(Number(doc.amount)/Number(doc.ton)):null};
  });
  const recent=state.account_receipts.filter(e=>e.date>addDays(today,-14)),perDay=r2(recent.reduce((n,e)=>n+e.amount,0)/14);
  const reported=site.account_reported,reportedBalance=reported?.date&&reported.date<=today?sharedDumpBalance(d,site.id,{today:reported.date}).balance:null;
  out.push({...state,site,dep:state.credit,usedEst:estimated,pending,pending_count:pending.length,pending_unknown:pending.filter(x=>x.amount==null).length,projected_balance:r2(state.balance-estimated),trips:state.account_receipts.reduce((n,e)=>n+e.trips,0),perDay,daysLeft:perDay>0?Math.floor(Math.max(0,state.balance)/perDay):null,invoices:inv,invTotal:r2(inv.reduce((n,e)=>n+e.amount,0)),balanceCalc:state.balance,balanceInv:null,reported:reported||null,reported_balance:reportedBalance,reported_difference:reportedBalance==null?null:r2(Number(reported.amount)-reportedBalance),missingTon:pending.filter(x=>x.f?.estimated).length});
 }
 return out.sort((a,b)=>a.balance-b.balance);
}

// Ana sayfa / brifing uyarıları
export function dumpAccountAlerts(d, { today = todayStr() } = {}) {
  const items = [];
  for (const a of dumpAccounts(d, { today })) {
    if(a.pending_count)items.push({kind:"warn",text:`${a.site.name}: ${a.pending_count} işte döküm kesintisi kontrolü bekliyor`,sub:`${a.usedEst.toLocaleString("tr-TR")} ₺ yalnız tahmin; kayıtlı ortak bakiyeden düşülmedi`,href:"#/dokum-hesap/"+a.site.id});
    if (a.balance < 0) items.push({ kind: "alert", text: `${a.site.name} döküm hesabı eksiye düştü`, sub: `Hesaplanan bakiye ${a.balance.toLocaleString("tr-TR")} ₺ — para yatırın ya da fişleri kontrol edin`, href: "#/dokum-hesap/" + a.site.id });
    else if (a.daysLeft != null && a.daysLeft <= 3) items.push({ kind: "warn", text: `${a.site.name} döküm hesabında ~${Math.round(a.balance).toLocaleString("tr-TR")} ₺ kaldı`, sub: `Günde ~${Math.round(a.perDay).toLocaleString("tr-TR")} ₺ harcanıyor → yalnız kayıtlı fişlere göre ~${a.daysLeft} gün yeter`, href: "#/dokum-hesap/" + a.site.id });
  }
  return items;
}

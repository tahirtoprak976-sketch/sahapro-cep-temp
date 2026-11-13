// Quote -> contract/site -> plan/work -> claim -> allocated payment chain.
// Exact IDs only; earlier/general customer activity is never presented as a new chain effect.
import { isActive } from "./core.js";
const live = (d, s) => (d?.[s] || []).filter(r => isActive(r) && r.status !== 'İptal');

export function dealChainModel(d, quoteId) {
  const quote = live(d, "quotes").find(q => q.id === quoteId);
  if (!quote) throw Error("Teklif bulunamadı");
  const contracts = live(d, "contracts").filter(c => c.quote_id === quoteId);
  const contractIds = new Set(contracts.map(c => c.id));
  const siteIds = new Set([quote.site_id, ...contracts.map(c => c.site_id)].filter(Boolean));
  for (const s of live(d, "sites")) if (s.deal?.quote_id === quoteId || (s.deal?.contract_id && contractIds.has(s.deal.contract_id))) siteIds.add(s.id);
  const sites = live(d, "sites").filter(s => siteIds.has(s.id));
  const sameCustomer = r => !r.customer_id || r.customer_id === quote.customer_id;
  const matches = r => sameCustomer(r) && (!r.quote_id || r.quote_id === quoteId) &&
    (!r.contract_id || contractIds.has(r.contract_id)) && (r.quote_id === quoteId || contractIds.has(r.contract_id));
  const plans = live(d, 'shift_assignments').filter(matches);
  const planIds = new Set(plans.map(p => p.id));
  const works = live(d, 'work_records').filter(w => matches(w) ||
    !w.quote_id && !w.contract_id && sameCustomer(w) && planIds.has(w.plan_assignment_id));
  const workIds = new Set(works.map(w => w.id));
  const claims = live(d, 'hakedis').filter(h => sameCustomer(h) &&
    (!h.quote_id || h.quote_id === quoteId) && (!h.contract_id || contractIds.has(h.contract_id)) &&
    (matches(h) || (h.items || []).some(i => workIds.has(i.work_record_id))));
  const claimIds = new Set(claims.map(h => h.id));
  const payments = live(d, "cash_records").filter(c => sameCustomer(c) && c.cash_type === "Müşteriden Para Alındı" &&
    (workIds.has(c.work_record_id) || workIds.has(c.ref_id) || claimIds.has(c.ref_id) || claimIds.has(c.hakedis_id) || works.some(w => w.driver_entry_id && w.driver_entry_id === c.driver_entry_id)));
  const paymentIds = new Set(payments.map(c => c.id));
  const generalRows = live(d, "cash_records").filter(c => c.cash_type === "Müşteriden Para Alındı" && c.customer_id === quote.customer_id && !paymentIds.has(c.id));
  const generalCustomerPayments = generalRows.reduce((n, c) => n + (Number(c.amount) || 0), 0);
  const source = quote.input || quote.scenario || quote.calc?.input || {};
  const scenario = Object.fromEntries(["work_type", "unit", "quantity", "vehicle_id", "dump_site_id", "fuel_l", "fuel_price", "extra", "margin", "dump_included"].filter(k => source[k] != null && source[k] !== "").map(k => [k, source[k]]));
  const contextWorks = live(d,'work_records').filter(w => siteIds.has(w.site_id) && !workIds.has(w.id));
  return {
    quote, contracts, sites, plans, works, claims, payments, generalRows, generalCustomerPayments, scenario, contextWorks,
    stages: {
      quote: { status: quote.status || "Taslak" },
      agreement: { status: contracts.length ? `${contracts.length} sözleşme` : sites.length ? "Teklifteki şantiye bağlı" : "Bağlı anlaşma yok" },
      plan: { status: plans.length ? `${plans.length} planlı görev` : "Plan yok" },
      work: { status: works.length ? `${works.length} gerçekleşen iş` : "Gerçekleşen iş yok" },
      claim: { status: claims.length ? `${claims.length} hakediş` : "Hakediş yok" },
      payment: { status: payments.length ? "Bağlı tahsilat var" : generalCustomerPayments > 0 ? "Müşteri hesabında tahsilat var; zincire tahsisli değil" : "Bağlı tahsilat yok" },
    },
  };
}

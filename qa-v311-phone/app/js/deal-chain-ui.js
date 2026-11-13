// Quote chain presentation. Status labels are evidence, not automatic transitions.
import { esc, badge, kv } from "./ui.js";

export function dealChainHtml(chain) {
  const q = chain.quote;
  const defs = [
    ["quote", "Teklif", `#/teklif/${q.id}`],
    ["agreement", "Anlaşma / şantiye", chain.contracts.length ? `#/sozlesmeler/${chain.contracts[0].id}` : chain.sites.length ? `#/santiyeler/${chain.sites[0].id}` : `#/teklif/${q.id}`],
    ["plan", "Plan", chain.plans.length ? `#/vardiya/${chain.plans[0].id}` : "#/vardiya/new"],
    ["work", "Gerçekleşen iş", chain.works.length ? `#/isler/${chain.works[0].id}` : "#/isler/new"],
    ["claim", "Hakediş / fatura", chain.claims.length ? `#/hakedis/${chain.claims[0].id}` : "#/hakedis/new"],
    ["payment", "Tahsilat", chain.payments.length ? `#/kasa/${chain.payments[0].id}` : `#/musteriler/${q.customer_id}`],
  ];
  return `<section class="card" data-deal-chain><div class="section-title" style="margin-top:0">Tekliften tahsilata zincir</div>
    ${defs.map(([key, label, href]) => `<div class="kv" data-chain-stage="${key}"><span class="k">${esc(label)}<span class="v">${badge(chain.stages[key].status, /yok|değil|Taslak/.test(chain.stages[key].status) ? "warn" : "ok")} <a class="btn sm ghost" href="${esc(href)}">Kaynağı aç</a></span></div>`).join("")}
    ${chain.generalCustomerPayments > 0 ? `<p class="small">Müşteri hesabında ayrıca tahsilat var; kayıtlı tahsis yoksa bu zincire ait sayılmaz.</p>` : ""}
    ${chain.contextWorks?.length ? `<details class="small" data-chain-context><summary>Aynı şantiyedeki diğer işler (${chain.contextWorks.length})</summary><p>Bu teklife ait açık bağlantıları yoktur; gerçekleşen iş veya bağlı tahsilat toplamına alınmadı.</p>${chain.contextWorks.map(w => `<p><a href="#/isler/${esc(encodeURIComponent(w.id))}">${esc(w.date || '')} · ${esc(w.work_type || 'İş')}</a></p>`).join('')}</details>` : ''}
    <details class="small" data-quote-scenario><summary>Teklif maliyet senaryosu</summary>
      ${kv("Miktar", chain.scenario.quantity != null ? `${chain.scenario.quantity} ${chain.scenario.unit || ""}` : "Belirtilmemiş")}
      ${kv("Mazot varsayımı", chain.scenario.fuel_l != null || chain.scenario.fuel_price != null ? `${chain.scenario.fuel_l ?? "?"} L × ${chain.scenario.fuel_price ?? "?"} ₺` : "Belirtilmemiş")}
      ${kv("Diğer maliyet / kâr payı", `${chain.scenario.extra ?? 0} ₺ · %${chain.scenario.margin ?? "—"}`)}
      <p class="tiny muted">Bu alanlar teklifin kayıtlı senaryosudur. Gerçekleşen iş, stok, cari, fiyat anlık görüntüsü veya ödeme değiştirilmez.</p>
    </details>
  </section>`;
}

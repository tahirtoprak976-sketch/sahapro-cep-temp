// İş Dosyası görünümü: durumların ve dayanakların ayrı, tıklanabilir gösterimi.
import { esc, badge, notice, kv, fmtTL, fmtNum, trDate } from "./ui.js";

const money = n => fmtTL(Number(n) || 0) + " ₺";
const costHref = r => "#/" + ({ expense_records: "gider", dump_entries: "dokum-hareket", work_records: "isler", fuel_records: "yakit", maintenance_records: "bakim", payables: "alislar" }[r.source_store] || "maliyet") + (r.source_id ? "/" + encodeURIComponent(r.source_id) : "");
const sourceButton = (href, text = "Neye göre?") => `<a class="btn sm ghost" href="${esc(href)}">${esc(text)}</a>`;
const kvh = (key, html) => `<div class="kv"><span class="k">${esc(key)}</span><span class="v">${html}</span></div>`;

export function workFileHtml(model) {
  const { work, customer, parent, site, plan } = model;
  const claimHref = model.claims.length ? "#/hakedis/" + model.claims[0].id : "#/hakedis/new";
  const paymentHref = model.directPayments.length ? "#/kasa/" + model.directPayments[0].id : "#/musteriler/" + (work.customer_id || "");
  return `<section data-work-file>
    <div class="card" data-work-file-status><div class="section-title" style="margin-top:0">İş Dosyası · durumlar ayrı</div>
      ${kvh("Kayıt", badge("Kayıtlı", "ok"))}
      ${kvh("Fiyat", badge(model.priceStatus, /bekliyor|incelenmeli/.test(model.priceStatus) ? "warn" : "ok") + ' ' + sourceButton("#/isler/" + work.id + "/edit"))}
      ${kvh("Fiş / belge", badge(model.slipStatus, model.attachments.length ? "ok" : "warn") + ' ' + sourceButton("#/isler/" + work.id))}
      ${kvh("Hakediş", badge(model.claimStatus, model.claims.length ? "ok" : "warn") + ' ' + sourceButton(claimHref))}
      ${kvh("Ödeme", badge(model.paymentStatus, model.directPayments.length ? "ok" : "warn") + ' ' + sourceButton(paymentHref))}
      <p class="tiny muted">Tek yeşil “tamam” rozeti yoktur; fiyat, fiş, hakediş ve tahsilat bağımsız süreçlerdir.</p>
    </div>
    <div class="card" data-work-file-parties><div class="section-title" style="margin-top:0">Kim, hangi kaynak?</div>
      ${kv("Gerçek borçlu", customer?.name || "Müşteri kaydı yok")}
      ${parent ? kv("Ana firma (yalnız bağlam)", parent.name + " — borç buraya aktarılmaz") : ""}
      ${site ? kv("Şantiye", site.name) : ""}
      ${plan ? kv("Plan kaynağı", plan.task || plan.id) + sourceButton("#/vardiya/" + plan.id, "Planı aç") : ""}
      ${work.driver_entry_id ? kv("Şoför bildirim kimliği", work.driver_entry_id) : ""}
    </div>
    <div class="card" data-work-file-dump><div class="section-title" style="margin-top:0">Döküm · kesin ve tahmini ayrı</div>
      ${model.dump ? `${kv("Bilinen toplam", model.dump.amount == null ? "Hesaplanamadı" : money(model.dump.amount))}${model.dump.confirmed_amount != null ? kv("Fişle kesinleşen", money(model.dump.confirmed_amount)) : ""}${model.dump.remaining_estimated_amount != null ? kv("Kalan tahmin", money(model.dump.remaining_estimated_amount)) : ""}${model.dump.expected_total == null ? `<p class="small muted">Beklenen toplam doğrulanamadı; bilinmeyen kısım sıfır değildir.</p>` : ""}${sourceButton(work.dump_site_id ? "#/dokum-hesap/" + work.dump_site_id : "#/dokum-hesap", "Döküm kaynağı")}` : '<p class="small">Bu iş için şirket döküm maliyeti yok veya müşteri ödüyor.</p>'}
    </div>
    <div class="card" data-work-file-costs><div class="section-title" style="margin-top:0">Bu işe kimlikle bağlı maliyetler</div>
      ${model.linkedCosts.map(r => `<div class="kv"><span class="k">${esc(r.category || r.description || r.source_store)}${r.unverified ? ` ${badge("doğrulanmadı", "warn")}` : ""}<span class="v">${money(r.gross)} ${sourceButton(costHref(r), "Kaynak")}</span></div>`).join("") || '<p class="small">Kimlikle bağlı maliyet yok.</p>'}
      ${model.allocations.map(a => `<details class="small" data-cost-allocation="${esc(a.id)}"><summary>Maliyet dağıtımı · ${esc(a.source_store)}/${esc(a.source_id)}</summary>${(a.targets || []).map(t => `<p>${esc([t.customer_id, t.site_id, t.vehicle_id, t.personnel_id].filter(Boolean).join(" · ") || "kapsam")}: <b>${money(t.gross)}</b></p>`).join("")}<p class="tiny muted">Dağıtım, kaynak fişi ikinci kez oluşturmaz; toplamlar kaynakla aynıdır.</p></details>`).join("")}
      <details class="small" data-work-general-costs><summary>Aynı araç/gün genel giderleri (${model.generalContext.length}) · kesin iş bağı değil</summary>
        ${model.generalContext.map(r => `<div class="kv"><span class="k">${esc(r.category || r.description || r.source_store)}<span class="v">${money(r.gross)} ${sourceButton(costHref(r), "Genel kayıt")}</span></div>`).join("") || '<p class="small">Genel gider yok.</p>'}
        <p class="tiny muted">Aynı tarih ve araç benzerliği, bu işe ait olduklarının kanıtı değildir; iş maliyetine eklenmez.</p>
      </details>
    </div>
    ${model.documents?.length ? `<div class="card" data-work-file-documents><div class="section-title" style="margin-top:0">İşe bağlı belgeler</div>${model.documents.map(doc => `<p>${esc(doc.doc_no || doc.title || doc.category || 'Belge')} ${sourceButton('#/belgeler/' + encodeURIComponent(doc.id),'Belgeyi aç')}</p>`).join('')}</div>` : ''}
    <div class="card" data-work-file-claims><div class="section-title" style="margin-top:0">Hakediş / fatura</div>
      ${model.claims.map(h => `<div class="kv"><span class="k">${esc(h.hakedis_no ? "Hakediş #" + h.hakedis_no : "Hakediş")} · ${esc(h.status || "")}<span class="v">${sourceButton("#/hakedis/" + h.id, "Hakedişi aç")}</span></div>`).join("")}
      ${model.invoices.map(b => `<div class="kv"><span class="k">${esc(b.document_no || "Alış / fatura")}<span class="v">${sourceButton("#/alislar/" + b.id, "Belgeyi aç")}</span></div>`).join("") || (model.claims.length ? "" : '<p class="small">Bu işe bağlı hakediş/fatura yok.</p>')}
    </div>
    <div class="card" data-work-file-payments><div class="section-title" style="margin-top:0">Tahsilat</div>
      ${model.directPayments.map(c => `<div class="kv"><span class="k">${esc(trDate(c.date))} · ${esc(c.cash_status || "durum")}<span class="v">${money(c.amount)} ${sourceButton("#/kasa/" + c.id, "Tahsilatı aç")}</span></div>`).join("") || '<p class="small">Bu işe kimlikle bağlı tahsilat yok.</p>'}
      ${model.generalCustomerPayments > 0 ? `<p class="small" data-general-customer-payment>Müşteri hesabında ayrıca <b>${money(model.generalCustomerPayments)}</b> tahsilat var; kayıtlı tahsis yoksa <b>bu işe dağıtılmadı</b>. Bu, işin ödendiği anlamına gelmez.</p>` : ""}
    </div>
    ${model.issues.length ? `<div class="card" data-work-file-issues>${model.issues.map(x => notice("warn", x)).join("")}</div>` : ""}
  </section>`;
}

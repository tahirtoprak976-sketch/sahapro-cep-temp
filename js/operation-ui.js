// Operasyon Masası ekranı: küçük, kaynak bağlantılı üç görünüm; açılışta yazma yok.
import { esc, badge, fmtNum, fmtTL, trDate, todayStr } from "./ui.js";
import { isActive } from "./core.js";
import { operationModel } from "./operation-core.js";
import { streamURL } from "./field-stream.js";

function operationURL(query, patch = {}) {
  const p = new URLSearchParams();
  for (const key of ["op_date", "op_vehicle", "op_personnel", "op_tab"]) {
    const value = Object.hasOwn(patch, key) ? patch[key] : query[key];
    if (value) p.set(key, value);
  }
  return "#/" + (p.size ? "?" + p : "");
}
const valueText = value => value && typeof value === "object"
  ? Object.entries(value).map(([k, v]) => `${k}: ${fmtNum(v)}`).join(" · ")
  : typeof value === "number" ? fmtNum(value) : String(value ?? "—");

export async function mountOperationDesk(ctx, holder, data) {
  const query = ctx.query || {}, date = query.op_date || todayStr();
  holder.innerHTML = '<section class="card" data-operation-desk><p role="status">Operasyon kayıtları okunuyor…</p></section>';
  let model;
  try { model = operationModel(data, { date, vehicle_id: query.op_vehicle || "", personnel_id: query.op_personnel || "", meta: data.meta || [] }); }
  catch (e) {
    holder.innerHTML = `<section class="card" data-operation-desk><div role="alert">Operasyon kayıtları okunamadı; boş veya sıfır kabul edilmedi. ${esc(e.message || e)}</div><button class="btn" data-op-retry>Yeniden dene</button></section>`;
    holder.querySelector("[data-op-retry]").onclick = () => ctx.reload();
    return;
  }
  const tab = ["today", "pending", "close"].includes(query.op_tab) ? query.op_tab : "today";
  const state = { date: model.date, vehicle_id: model.vehicle_id, personnel_id: model.personnel_id };
  const source = kind => streamURL(state, { kind });
  const tabButton = (key, label) => `<a class="chip ${tab === key ? "on" : ""}" role="tab" aria-selected="${tab === key}" href="${operationURL(query, { op_tab: key })}">${label}</a>`;
  const planHtml = plan => {
    const linked = plan.work_record_id;
    return `<article class="card" data-plan-id="${esc(plan.id)}"><div class="row between"><b>${esc(plan.task || "Planlı görev")}</b>${badge(linked ? "İşe bağlandı" : plan.status || "Planlı", linked ? "ok" : "warn")}</div>
      <p class="small">${esc([plan.start, plan.end].filter(Boolean).join("–") || "Saat belirsiz")} · ${fmtNum(plan.hours)} saat${plan.conflict ? ` · <span class="badge warn">${esc(plan.conflict.task || plan.conflict.id)} ile saat çakışıyor</span>` : ""}</p>
      <p class="tiny muted">Planlı görevdir; gerçekleşen iş, gelir veya hakediş değildir.</p>
      ${linked ? `<a class="btn sm" href="#/isler/${esc(encodeURIComponent(linked))}">Bağlı işi aç</a>` : plan.status === "Planlı" ? `<a class="btn primary sm" data-plan-convert="${esc(plan.id)}" href="#/isler/new?plan_id=${esc(encodeURIComponent(plan.id))}">Planı iş taslağına dönüştür</a>` : `<a class="btn sm" href="#/vardiya/${esc(plan.id)}">Plan kaydını aç</a>`}</article>`;
  };
  const workRows = model.stream.rows;
  let body = "";
  if (tab === "today") body = `
    <div class="statgrid" data-operation-summary>
      <a class="stat" href="${source("work")}"><span class="v">${model.stream.counts.work}</span><span class="l">Gerçekleşen iş</span></a>
      <a class="stat" href="${source("fuel")}"><span class="v">${fmtNum(model.stream.liters)}</span><span class="l">Yakıt litresi</span></a>
      <a class="stat" href="${source("expense")}"><span class="v">${model.stream.counts.expense}</span><span class="l">Gider kaydı</span></a>
      <a class="stat" href="${source("maintenance")}"><span class="v">${model.stream.counts.maintenance}</span><span class="l">Bakım kaydı</span></a>
    </div>
    <p class="small">Birimler ayrı: ${Object.entries(model.stream.units).map(([u, n]) => `${fmtNum(n)} ${esc(u)}`).join(" · ") || "iş miktarı yok"}. Toplamlar ilk 30 satırla sınırlı değildir.</p>
    <div class="section-title">Planlanan görevler (${model.plans.length})</div>${model.plans.map(planHtml).join("") || '<div class="card">Seçili kapsamda plan yok.</div>'}
    ${model.vehicleStops.length ? `<div class="section-title">Açık duruş kaydı olan araçlar</div>${model.vehicleStops.map(r => `<a class="card" href="#/durus/${esc(r.id)}">${esc(r.reason || "Açık duruş kaydı")} · ${esc(String(r.started_at).slice(0, 16))}</a>`).join("")}` : ""}
    <div class="section-title">Gerçekleşen kayıtlar (${workRows.length})</div>
    ${workRows.slice(0, 30).map(x => `<a class="li" href="${esc(x.hash)}"><div class="grow"><div class="t1">${esc(x.title)}</div><div class="t2">${esc([x.vehicle, x.personnel].filter(Boolean).join(" · ") || x.label)}</div></div><div class="end">${x.kind === "work" ? `${fmtNum(x.record.quantity)} ${esc(x.record.unit || "")}` : x.kind === "fuel" ? `${fmtNum(x.record.liters)} L` : "›"}</div></a>`).join("") || '<div class="card">Seçili gün ve filtrelerde gerçekleşen kayıt yok.</div>'}
    ${workRows.length > 30 ? `<a class="btn block" href="${source("")}">İlk 30 gösteriliyor · tüm ${workRows.length} kaydı Saha Akışında aç</a>` : ""}`;
  else if (tab === "pending") body = `
    <p class="small muted">Şoför aktarımı, fiyat/fiş, belge/döküm, yakıt, personeldeki nakit ve bakım öncelikleri mevcut denetimlerden gelir. Her madde gerçek kaynağa gider.</p>
    ${model.pending.map(x => `<a class="card" href="${esc(x.href)}"><div class="row between"><b>${esc(x.title)}</b>${x.kind === "alert" ? badge("Acil", "danger") : badge("Bekliyor", "warn")}</div><p class="small">${esc(x.why)}</p><span class="tiny">${esc(x.action)} →</span></a>`).join("") || '<div class="card">Seçili kapsamda bekleyen madde yok. Bu, tüm kayıtların eksiksiz olduğu anlamına gelmez.</div>'}`;
  else {
    const c = model.close.current, saved = model.close.saved, scoped = model.close.scoped;
    body = `
      ${model.close.filtered ? `<div class="card" data-scoped-close><h3>Seçili araç / personel özeti</h3><p>${scoped.work_count} iş · ${fmtNum(scoped.fuel_liters)} L</p><p>${Object.entries(scoped.units).map(([u,n])=>`${fmtNum(n)} ${esc(u)}`).join(' · ') || 'Birim yok'}</p><p class="tiny muted">Yalnız seçili araç/personel kimliği kayıtlı hareketlerdir. Şirketin günlük kapanışı aşağıda tüm kayıtları kapsar.</p><a class="btn sm" href="${source('')}">Seçili kaynakları aç</a></div>` : ''}
      <div class="card" data-company-close><h3>Şirketin gün sonu kapanışı</h3><p class="small">${esc(trDate(model.date))} · Tüm araçlar ve personel</p>
        <p>${c.work_count} iş · ${fmtNum(c.fuel_liters)} L · ${c.missing_price} fiyat eksik · ${c.missing_slip} fiş eksik</p>
        <p>${Object.entries(c.units).map(([u, n]) => `${fmtNum(n)} ${esc(u)}`).join(" · ") || "Birim yok"}</p>
        <p>Müşteri tahsilatı ${fmtTL(c.customer_receipts)} · Tedarikçi ödemesi ${fmtTL(c.supplier_payments)}</p>
        <p class="tiny muted">Bekleyen yakıt gerçek stok/maliyet değildir. Planlı görevler bu toplamlara dahil değildir.</p>
        <a class="btn primary" href="#/gun-kapanis/new?date=${esc(model.date)}">Şirket kapanışını aç / sakla</a>
      </div>
      ${saved ? `<div class="card" data-saved-close="${esc(saved.id)}"><div class="row between"><h3>Kaydedilmiş kapanış</h3>${badge(model.close.difference.length ? "Kaynak sonradan değişti" : "Kaynakla aynı", model.close.difference.length ? "warn" : "ok")}</div>
        <p class="small">${saved.summary.work_count} iş · ${fmtNum(saved.summary.fuel_liters)} L · ${Object.entries(saved.summary.units || {}).map(([u, n]) => `${fmtNum(n)} ${esc(u)}`).join(" · ")}</p>
        <a class="btn sm" href="#/gun-kapanis/${esc(saved.id)}">Saklanan kapanışı aç</a></div>
        ${model.close.difference.length ? `<div class="card" data-close-diff><h3>Güncel kaynakla fark</h3>${model.close.difference.map(x => `<p class="small"><b>${esc(x.label)}</b><br>Saklanan: ${esc(valueText(x.before))}<br>Güncel: ${esc(valueText(x.after))}</p>`).join("")}<p class="tiny muted">Saklanan kapanış değiştirilmedi; fark yalnız kaynak okumayla açıklanır.</p></div>` : ""}` : '<div class="card">Bu gün için kaydedilmiş kapanış yok.</div>'}`;
  }
  holder.innerHTML = `<section class="card" data-operation-desk>
    <div class="row between"><div><h2 style="margin:0">Operasyon Masası</h2><p class="tiny muted" style="margin:2px 0 0">Plan, gerçekleşen ve bekleyen aynı kaynak kapsamında</p></div><a class="btn sm" href="#/akilli-asistan">Asistan</a></div>
    <div class="formgrid2" style="margin-top:10px"><label class="field">Gün<input type="date" data-op-date value="${esc(model.date)}"></label><label class="field">Araç<select data-op-vehicle><option value="">Tüm araçlar</option>${(data.vehicles || []).filter(v => isActive(v) || v.id === model.vehicle_id).map(v => `<option value="${esc(v.id)}" ${model.vehicle_id === v.id ? "selected" : ""}>${esc(v.plate || v.name || v.id)}</option>`).join("")}</select></label></div>
    <label class="field">Personel<select data-op-personnel><option value="">Tüm personel</option>${(data.personnel || []).filter(p => isActive(p) || p.id === model.personnel_id).map(p => `<option value="${esc(p.id)}" ${model.personnel_id === p.id ? "selected" : ""}>${esc(p.name || p.id)}</option>`).join("")}</select></label>
    <div class="tabs" role="tablist" style="margin:8px 0">${tabButton("today", "BUGÜN")}${tabButton("pending", `BEKLEYENLER (${model.pending.length})`)}${tabButton("close", "KAPANIŞ")}</div>
    <div data-op-pane="${tab}">${body}</div>
    <p class="tiny muted">${esc(trDate(model.date))} · ${model.vehicle_id ? "araç filtresi" : "tüm araçlar"} · ${model.personnel_id ? "personel filtresi" : "tüm personel"}. Filtreler bağlantıda ve yenilemede korunur. Şirket kapanışı tüm araçları ve personeli kapsar.</p>
  </section>`;
  holder.querySelector("[data-op-date]").onchange = e => { if (e.target.value) location.hash = operationURL(query, { op_date: e.target.value }); };
  holder.querySelector("[data-op-vehicle]").onchange = e => { location.hash = operationURL(query, { op_vehicle: e.target.value }); };
  holder.querySelector("[data-op-personnel]").onchange = e => { location.hash = operationURL(query, { op_personnel: e.target.value }); };
}

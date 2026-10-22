// İş sözleşmeleri (#/is-sozlesmeleri, …/oku, #/is-sozlesmesi/<şantiye>, …/bagla): götürü, sefer ya da m³ anlaşması; sözleşme PDF'inden kurulum, kapsam içi / ekstra işler,
// tahmini yerinde m³, ölçüm → cariye metraj hakedişi, kapanış raporu ve katsayı öğrenme. Para yazan her adım önizleme + onayla.
import { qs, qsa, esc, appbar, toast, notice, badge, li, kv, emptyState, confirmDialog, choiceDialog, fSelect, fNum, fDate, fText, fArea, collectForm, go } from "./ui.js";
import { todayStr, trDate, fmtTL, isActive, kdvRateOf } from "./core.js";
import * as J from "./job-core.js";
import { MATERIALS } from "./haul-core.js";
import { jobCosts } from "./job-cost.js";
import { dashboardHtml, bindDashboard } from "./job-dash.js";

const n = (x) => Number(x || 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
const SRC = { kantar: "kantar fişli", "kantar-ort": "aynı işin kantar ortalamasıyla", ogrenilmis: "önceki işlerden öğrenilen katsayıyla", kasa: "yük / kasa tahminiyle", yok: "hesaplanamadı" };
const kvh = (k, html) => `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${html}</span></div>`;
const statusBadge = (s) => badge(s, s === J.STATUS.OPEN ? "ok" : s === J.STATUS.MEASURED ? "warn" : "");

export async function screen(ctx) {
  const [route, id, sub] = ctx.parts;
  if (route === "is-sozlesmeleri") return id === "oku" ? readContract(ctx) : list(ctx);
  if (route !== "is-sozlesmesi" || !id) return false;
  if (sub === "bagla") return link(ctx, id);
  return detail(ctx, id);
}

async function list(ctx) {
  const { root, db, query } = ctx;
  const d = await db.dumpAll(), today = todayStr();
  const cust = (id) => (d.customers || []).find((c) => c.id === id)?.name || "—";
  const cid = query.customer_id || "";
  const fuelRef = await db.metaGet("fuel_ref_price");
  const jobs = (d.sites || []).filter((s) => isActive(s) && J.dealOf(s) && (!cid || s.customer_id === cid));
  const row = (s) => {
    const D = J.dealOf(s), rep = J.jobReport(d, s, { today });
    const info = D.basis === "m³" ? (rep.measured ? `ölçülen ${n(rep.measured)} m³` : rep.est ? `tahmini ≈ ${n(rep.est)} m³` : "henüz sefer yok") : `${n(rep.trips)} sefer`;
    const price = D.basis === "Götürü" ? `götürü ${fmtTL(D.price)} ₺` : `${D.basis === "m³" ? "m³" : "sefer"} başı ${fmtTL(D.price)} ₺`;
    let pr = ""; try { const c = jobCosts(d, s, rep, { today, fuelRef }); if (c.income > 0) pr = ` · kâr ≈ ${c.profit < 0 ? "−" : ""}${fmtTL(Math.abs(c.profit))} ₺`; } catch { /* yok */ }
    return li({ ic: "📐", href: "#/is-sozlesmesi/" + s.id, t1: esc(s.name), t2: esc(`${cust(s.customer_id)} · ${price} · ${info}${pr}`), badgeHtml: statusBadge(D.status) });
  };
  const customers = (d.customers || []).filter((c) => isActive(c) && !c.internal);
  root.innerHTML = appbar("İş Sözleşmeleri", "Götürü, metreküp ya da sefer anlaşmaları") + `
    <div class="card"><p>Bu bölüm şantiyenin iş anlaşmasını, fiyatlandırmasını ve onaylanmış götürü / metraj gelirini yönetir. İmzalı sözleşme metinleri ayrıca Sözleşme Belgelerinde saklanır; iki kayıt kendiliğinden birbirini değiştirmez.</p><button class="btn" data-go="#/sozlesmeler">Sözleşme Belgeleri / İmzalar</button></div>
    <div class="card tap" data-go="#/is-sozlesmeleri/oku" data-readlink><div class="row between"><span><b>📄 Sözleşmeden oluştur</b><br><span class="tiny muted">PDF ya da fotoğrafı okuyup işi kurar — siz onaylamadan kaydetmez</span></span><span class="muted">›</span></div></div>
    <div class="card" data-newjob>
      <div class="section-title" style="margin:0 0 6px">Yeni iş sözleşmesi</div>
      ${fSelect("Müşteri", "customer_id", customers.map((c) => ({ v: c.id, t: c.name })), cid)}
      <div data-sitepick></div>
      <button class="btn primary block" data-next>Devam</button>
    </div>
    ${[J.STATUS.OPEN, J.STATUS.MEASURED, J.STATUS.CLOSED].map((st) => { const xs = jobs.filter((s) => J.dealOf(s).status === st); return xs.length ? `<div class="section-title">${st} (${xs.length})</div>${xs.map(row).join("")}` : ""; }).join("")}
    ${jobs.length ? "" : emptyState("📐", "Henüz iş sözleşmesi yok")}
    <div class="muted small" style="margin:8px 4px 80px">Sözleşme şantiyeye bağlıdır. Açık sözleşmesi olan müşteriye yazılan işler kendiliğinden bu işe sayılır; ekstra iş kayıt sırasında ayrıca işaretlenir.</div>`;
  const box = qs("[data-newjob]", root);
  const drawSites = () => {
    const c = qs("[name=customer_id]", box).value;
    const free = (d.sites || []).filter((s) => isActive(s) && s.customer_id === c && !J.dealOf(s));
    qs("[data-sitepick]", box).innerHTML = c ? fSelect("Şantiye", "site_id", [...free.map((s) => ({ v: s.id, t: s.name })), { v: "__new__", t: "➕ Yeni şantiye" }], free.length ? "" : "__new__") + `<div data-newname ${free.length ? "hidden" : ""}>${fText("Yeni şantiye adı", "site_name", "")}</div>` : "";
    qs("[name=site_id]", box)?.addEventListener("change", (e) => { qs("[data-newname]", box).hidden = e.target.value !== "__new__"; });
  };
  qs("[name=customer_id]", box).addEventListener("change", drawSites);
  drawSites();
  qs("[data-next]", box).addEventListener("click", async () => {
    const c = qs("[name=customer_id]", box).value, sv = qs("[name=site_id]", box)?.value || "";
    if (!c) return toast("Müşteri seçin", "err");
    let sid = sv;
    if (!sv) return toast("Şantiye seçin", "err");
    if (sv === "__new__") {
      const name = (qs("[name=site_name]", box)?.value || "").trim();
      if (!name) return toast("Şantiye adını yazın", "err");
      sid = (await db.saveNew("sites", { name, customer_id: c }, "İş sözleşmesi için şantiye")).id;
    }
    go("#/is-sozlesmesi/" + sid);
  });
  return true;
}

async function detail(ctx, id) {
  const { root, db, query } = ctx;
  const d = await db.dumpAll(), today = todayStr();
  const site = (d.sites || []).find((s) => s.id === id && isActive(s));
  if (!site) { root.innerHTML = appbar("İş sözleşmesi") + emptyState("📐", "Şantiye bulunamadı"); return true; }
  const D = J.dealOf(site), custName = (d.customers || []).find((c) => c.id === site.customer_id)?.name || "—";
  if (!D || (query.duzenle === "1" && D.status === J.STATUS.OPEN)) return dealForm(ctx, site, D, custName);
  const matOver = (await db.metaGet("haul_materials")) || {}, calib = (await db.metaGet("haul_calib")) || {};
  const rep = J.jobReport(d, site, { matOver, calib, today });
  const M = D.measurement, isM3 = D.basis === "m³", isLump = D.basis === "Götürü", C = D.charge;
  const srcLine = Object.entries(rep.src).filter(([, v]) => v).map(([k, v]) => `${n(v)} sefer ${SRC[k]}`).join(" · ");
  const money = rep.money;
  const costs = jobCosts(d, site, rep, { today, fuelRef: await db.metaGet("fuel_ref_price") });
  root.innerHTML = appbar(site.name, `${custName} · iş sözleşmesi`, { right: statusBadge(D.status) }) + `
    <div class="tabs" data-jobtabs style="margin:10px 0"><button class="chip on" data-jt="ozet">ÖZET</button><button class="chip" data-jt="kayit">SEFER VE m³</button><button class="chip" data-jt="soz">SÖZLEŞME</button></div>
    <div data-pane="ozet">${dashboardHtml(costs, rep, D)}</div>
    <div class="card" data-deal>
      ${kv("Anlaşma", isLump ? "Götürü (toplam bedel)" : isM3 ? "Metreküp (yerinde, ortak ölçümcü)" : "Sefer başı")}
      ${kv(isLump ? "Sözleşme bedeli" : "Birim fiyat", `${fmtTL(D.price)} ₺${isLump ? "" : " / " + (isM3 ? "m³" : "sefer")} · KDV ${D.kdv_included ? "dahil" : "hariç"} %${D.kdv_rate}`)}
      ${kv("Başlangıç", trDate(D.start_date))}
      ${D.deadline ? kv("Süre / teslim", D.deadline) : ""}
      ${!isLump ? kv("Ana malzeme", MATERIALS.find((m) => m.key === D.material)?.name || "Toprak (genel)") : ""}
      ${D.scope_in ? kvh("Dahil", esc(D.scope_in).replace(/\n/g, "<br>")) : ""}
      ${D.scope_out ? kvh("Hariç", esc(D.scope_out).replace(/\n/g, "<br>")) : ""}
      ${(D.extra_rates || []).length ? kvh("Ekstra fiyatları", D.extra_rates.map((r) => `${esc(r.label)}: ${fmtTL(r.price)} ₺ / ${esc(String(r.unit).toLocaleLowerCase("tr-TR"))}`).join("<br>")) : ""}
      ${D.scrap ? kv("Hurda", J.SCRAP[D.scrap] || D.scrap) : ""}
      ${D.payment_plan ? kv("Ödeme", D.payment_plan) : ""}
      ${D.note ? kvh("Not", esc(D.note)) : ""}
      ${D.doc_id ? `<button class="btn sm" style="margin-top:6px" data-go="#/belgeler/${esc(D.doc_id)}">📄 Sözleşme belgesi</button>` : ""}
      <div class="muted small" style="margin-top:6px">${isLump ? "Sözleşmedeki işler bedele dahildir; bu işteki kamyon seferleri, makine saatleri ve işçilik cariye ayrıca yazılmaz, yalnız maliyet için tutulur." : isM3 ? "Kazı, yükleme, nakliye ve döküm fiyata dahildir; bu işteki kamyon seferleri ve makine saatleri cariye ayrıca yazılmaz." : "Ekskavatör / yükleme sefer fiyatına dahildir; makine saatleri cariye ayrıca yazılmaz."} Ekstra işler ayrıca fiyatlanır.</div>
    </div>
    ${isLump ? `<div class="card" data-charge>
      <div class="section-title" style="margin:0 0 6px">Sözleşme bedeli ve cari</div>
      ${C ? `${kv("Cariye yazıldı", trDate(C.date))}${kv("Net", fmtTL(C.net) + " ₺")}${kv("KDV %" + C.kdv_rate, fmtTL(C.kdv) + " ₺")}${kvh("Brüt (müşteri borcu)", "<b>" + fmtTL(C.gross) + " ₺</b>")}`
        : `${notice("warn", "Sözleşme bedeli henüz cariye yazılmadı. Yazınca müşteri hesabında borç olarak görünür; ara ödemeler bundan düşer.")}<button class="btn primary block" data-charge-go>Sözleşme bedelini cariye yaz</button>`}
      ${kvh("Müşterinin " + trDate(D.start_date) + "'den beri ödemeleri", fmtTL(rep.paid) + " ₺ <span class='muted small'>(müşterinin tüm işleri)</span>")}
      ${C ? kvh("Bu işten kalan (yaklaşık)", "<b>" + fmtTL(Math.max(0, C.gross + rep.extras.amount - rep.paid)) + " ₺</b> <span class='muted small'>(bedel + ekstralar − bu tarihten beri ödemeler)</span>") : ""}
    </div>` : ""}
    <div class="card" data-jobsum>
      <div class="section-title" style="margin:0 0 6px">Bu işteki kayıtlar</div>
      ${kv("İş kaydı", `${rep.works} (${rep.included.count} kapsam içi, ${rep.extras.count} ekstra)`)}
      ${kv("Kamyon seferi", n(rep.trips) + (rep.extraTrips ? ` (+ ${n(rep.extraTrips)} ekstra sefer, metraja girmez)` : ""))}
      ${rep.hours || rep.yev ? kvh("Makine", rep.machines.map((m) => `${esc(m.vehicle)}: ${m.hours ? n(m.hours) + " saat" : ""}${m.yev ? " " + n(m.yev) + " yevmiye" : ""}${m.extraHours ? ` (${n(m.extraHours)} saat ekstra)` : ""}`).join(" · ")) : ""}
      ${rep.extras.count ? kvh("Ekstra işler", `${fmtTL(rep.extras.amount)} ₺ cariye yazıldı${rep.extras.unpriced ? ` · <b>${rep.extras.unpriced} ekstra işin fiyatı yok</b>` : ""}`) : ""}
      ${D.basis === "Sefer" ? kv("Sefer tutarı", `${fmtTL(rep.included.amount)} ₺ — her sefer cariye iş olarak yazıldı`) : ""}
      ${rep.included.notJob ? notice("warn", `${rep.included.notJob} iş bu şantiyede ama fiyat listesinden fiyatlanmış (sözleşmeye bağlanmamış). “İşleri gözden geçir”den bakın.`) : ""}
    </div>
    ${rep.trips ? `<div class="card" data-est>
      <div class="section-title" style="margin:0 0 6px">${M ? "Tahmin ve ölçüm" : "Tahmini yerinde m³"}</div>
      <div style="overflow-x:auto"><table class="small" style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Araç</th><th style="text-align:right">Sefer</th><th style="text-align:right">Fişli</th><th style="text-align:right">Sefer başı</th><th style="text-align:right">≈ m³</th></tr></thead><tbody>
        ${rep.groups.map((g) => `<tr style="border-top:1px solid var(--line,#e3e7ee)"><td style="padding:4px 6px 4px 0">${esc(g.vehicle)}<div class="tiny muted">${esc(g.materialName)}</div></td><td style="text-align:right">${n(g.trips)}</td><td style="text-align:right">${n(g.kantar || 0)}</td><td style="text-align:right">${g.perTrip == null ? "—" : n(g.perTrip)}</td><td style="text-align:right">${g.unknown === g.trips ? "—" : n(g.m3)}</td></tr>`).join("")}
      </tbody></table></div>
      <div style="margin-top:6px"><b>Toplam ≈ ${n(rep.est)} m³ yerinde</b> <span class="muted small">(tahmini)</span></div>
      <div class="muted small">${esc(srcLine)}</div>
      ${rep.suspect ? notice("warn", `${rep.suspect} kayıtta fiş tonu bir sefer için olağan dışı (5 tonun altı ya da 45 tonun üstü). İşi açıp tonu kontrol edin; yanlış ton tahmini bozar.`) : ""}
      <details class="small" style="margin-top:6px"><summary>Nasıl hesaplandı?</summary><div class="muted" style="margin-top:4px;line-height:1.5">
        • <b>Fişli sefer:</b> fişteki net ton ÷ malzemenin yerinde yoğunluğu (toprak ≈ 1,95 t/m³). Örnek: 21 ton ÷ 1,95 ≈ 10,8 m³.<br>
        • Bir kayıtta birden çok sefer ve tek fiş tonu varsa, o ton aracın sefer başı yüküne göre kaç sefere denk geliyorsa o kadar sefer fişli sayılır (genelde 1). Kalan seferler aynı aracın fişli seferlerinin ortalama tonuyla hesaplanır.<br>
        • <b>Fişi hiç olmayan araç:</b> önce önceki işlerden öğrenilen katsayı, o da yoksa araç kartındaki yük (ortalama yük ya da yasal net yük) ve kasa hacmi kullanılır.<br>
        • Malzeme yoğunlukları Daha Fazla → Malzeme Katsayıları'ndan düzeltilebilir. Ölçüm girilince sistem farkı öğrenir.</div></details>
      ${rep.src.yok ? `<div class="muted small">Hesaplanamayan seferler: araç kartında yük / kasa bilgisi yok ya da malzemenin (moloz) yerinde yoğunluğu bilinmiyor.</div>` : ""}
      ${rep.perTrip ? `<div class="small" style="margin-top:4px">Sefer başı ≈ ${n(rep.perTrip)} m³${rep.perHour ? ` · makine saatinde ≈ ${n(rep.perHour)} m³` : ""}${M ? " (ölçüme göre)" : ""}</div>` : ""}
      ${M && rep.ratio ? `<div class="small">Ölçüm / tahmin: <b>${n(rep.ratio * 100)}%</b></div>` : ""}
      <div class="muted small" style="margin-top:4px">"Sefer × kasa m³" kabarma payı yüzünden gerçeği yaklaşık iki kat fazla gösterir; bu hesap kantar tonu, yük ve malzeme yoğunluğundan gelir. Kesin miktar ölçümcünün metrajıdır.</div>
    </div>` : ""}
    ${isM3 ? `<div class="card" data-money>
      <div class="section-title" style="margin:0 0 6px">Hakediş</div>
      ${M ? `${kv("Ölçüm", `${trDate(M.date)} · ${n(M.m3)} m³${M.surveyor ? " · " + M.surveyor : ""}`)}${kv("Net", fmtTL(M.net) + " ₺")}${kv("KDV %" + M.kdv_rate, fmtTL(M.kdv) + " ₺")}${kvh("Brüt (cariye yazılan)", "<b>" + fmtTL(M.gross) + " ₺</b>")}`
        : money ? `${kv("Tahmini hakediş", `≈ ${fmtTL(money.gross)} ₺ brüt (≈ ${n(rep.est)} m³ × ${fmtTL(D.price)} ₺)`)}<div class="notice warn small"><span>ℹ</span><span>Tahmindir, cariye yazılmaz. Hakediş ölçüm girilince cariye yazılır.</span></div>` : `<div class="muted small">Henüz sefer yok.</div>`}
      ${kvh("Müşterinin " + trDate(D.start_date) + "'den beri ödemeleri", fmtTL(rep.paid) + " ₺ <span class='muted small'>(müşterinin tüm işleri; ara ödemeler carideki tahsilattır)</span>")}
    </div>` : isLump ? "" : `<div class="card">${kvh("Müşterinin " + trDate(D.start_date) + "'den beri ödemeleri", fmtTL(rep.paid) + " ₺ <span class='muted small'>(müşterinin tüm işleri)</span>")}</div>`}
    ${D.scrap === "ayrica" ? `<div class="card" data-scrap>
      <div class="section-title" style="margin:0 0 6px">Hurda satışı (iş geliri)</div>
      ${(D.scrap_sales || []).map((x) => `<div class="small">• ${trDate(x.date)} · ${esc(x.buyer || "—")} · <b>${fmtTL(x.amount)} ₺</b>${x.note ? " · " + esc(x.note) : ""}</div>`).join("") || '<div class="muted small">Henüz satış yok.</div>'}
      ${D.status !== J.STATUS.CLOSED ? `<div class="formgrid2" style="margin-top:6px">${fDate("Tarih", "sc_date", today)}${fNum("Tutar (₺)", "sc_amount", "", { step: "any" })}</div>${fText("Alıcı", "sc_buyer", "")}<button class="btn sm" data-scrap-add>Hurda satışı ekle</button>` : ""}
      <div class="muted small">Yalnız bu işin kârlılığında görünür; kasaya ya da cariye yazılmaz.</div>
    </div>` : ""}
    <div class="card" data-summary>
      <div class="section-title" style="margin:0 0 6px">İş özeti</div>
      ${kv("Sözleşme geliri (net)", isLump ? fmtTL(J.dealMoney(D, 1).net) + " ₺" : isM3 ? (M ? fmtTL(M.net) + " ₺" : money ? "≈ " + fmtTL(money.net) + " ₺ (tahmini)" : "—") : fmtTL(rep.included.amount) + " ₺ (sefer tutarları)")}
      ${rep.extras.count ? kv("Ekstralar", fmtTL(rep.extras.amount) + " ₺") : ""}
      ${rep.scrap ? kv("Hurda satışı", fmtTL(rep.scrap) + " ₺") : ""}
      ${rep.dumpCost ? kv("Döküm ücretleri (gider)", "− " + fmtTL(rep.dumpCost) + " ₺") : ""}
      ${kv("Harcanan", `${n(rep.trips + rep.extraTrips)} sefer · ${n(rep.hours)} makine saati${rep.yev ? " · " + n(rep.yev) + " yevmiye" : ""}`)}
      <div class="muted small">Mazot, işçilik ve araç giderleri işe bağlı tutulmadığı için bu özete girmez.</div>
    </div>
    ${isM3 && D.status === J.STATUS.OPEN ? `<div class="card" data-measure>
      <div class="section-title" style="margin:0 0 6px">Ölçümü gir (iş bitince)</div>
      <div class="formgrid2">${fDate("Ölçüm tarihi", "m_date", today)}${fNum("Ölçülen yerinde m³", "m_m3", "", { step: "any" })}</div>
      ${fText("Ölçümcü", "m_surveyor", "")}
      ${fArea("Not (ilk / son ölçüm, rapor no…)", "m_note", "")}
      <div data-mprev class="small"></div>
      <button class="btn primary block" data-msave>Ölçümü kaydet → cariye hakediş yaz</button>
    </div>` : ""}
    ${D.calib_offer && M ? "" : ""}
    <div data-calib></div>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin:8px 0 80px">
      ${D.status === J.STATUS.OPEN ? `<button class="btn" data-go="#/is-sozlesmesi/${esc(id)}/bagla">İşleri gözden geçir / bağla</button>` : ""}
      ${D.status === J.STATUS.OPEN ? `<button class="btn" data-go="#/is-sozlesmesi/${esc(id)}?duzenle=1">${J.isLocked(D) ? "Kapsamı / notu düzenle" : "Anlaşmayı düzenle"}</button>` : ""}
      ${(isM3 ? D.status === J.STATUS.MEASURED : D.status === J.STATUS.OPEN) ? `<button class="btn" data-close>İşi kapat</button>` : ""}
      <button class="btn" data-go="#/santiyeler/${esc(id)}">Şantiye kartı</button>
    </div>`;
  // Sekmeler: Özet (pano) · Sefer ve m³ · Sözleşme. Mevcut bölümler sekmelere taşınır; seçim oturumda hatırlanır.
  {
    const panes = { kayit: ["[data-jobsum]", "[data-est]", "[data-summary]", "[data-scrap]"], soz: ["[data-deal]", "[data-charge]", "[data-money]", "[data-measure]", "[data-calib]"] };
    for (const [k, sels] of Object.entries(panes)) {
      const pane = document.createElement("div"); pane.dataset.pane = k;
      const firstEl = qs(sels.map((x) => x).join(","), root);
      (firstEl?.parentNode || root).insertBefore(pane, firstEl || null);
      for (const sel of sels) for (const el of qsa(sel, root)) if (!el.closest("[data-pane]") || el.closest("[data-pane]") === pane) pane.appendChild(el);
    }
    // ödemeler kartı (adsız) sözleşme sekmesine
    for (const el of [...root.children]) if (el.classList?.contains("card") && !el.closest("[data-pane]") && !el.matches("[data-pane]")) qs("[data-pane=soz]", root).appendChild(el);
    let tab = "ozet"; try { tab = sessionStorage.getItem("sp_jobtab") || "ozet"; } catch { /* yok */ }
    const show = (t) => { for (const p of qsa("[data-pane]", root)) p.hidden = p.dataset.pane !== t; for (const b of qsa("[data-jt]", root)) b.classList.toggle("on", b.dataset.jt === t); try { sessionStorage.setItem("sp_jobtab", t); } catch { /* yok */ } };
    for (const b of qsa("[data-jt]", root)) b.addEventListener("click", () => show(b.dataset.jt));
    show(qs(`[data-pane="${tab}"]`, root) ? tab : "ozet");
    bindDashboard(root, costs);
  }
  // Kapanmış / ölçülmüş işte katsayı önerisi
  if (M) {
    const props = J.calibrationProposal(rep);
    if (props.length && !D.calib_saved)
      qs("[data-calib]", root).innerHTML = `<div class="card"><div class="section-title" style="margin:0 0 6px">Katsayı öğren</div>
        <div class="small">Ölçüm tahminin %${n(rep.ratio * 100)}'i çıktı. Sonraki işlerde kantarsız seferler bu değerlerle tahmin edilsin mi?</div>
        ${props.map((p) => `<div class="small">• ${esc(p.vehicle)} · ${esc(p.material)}: sefer başı <b>${n(p.m3_per_trip)} m³</b> (${n(p.trips)} sefer)</div>`).join("")}
        <button class="btn sm" style="margin-top:6px" data-calsave>Katsayıları kaydet</button><div class="muted small">Yalnız tahmin hesabını etkiler; kayıtlar değişmez.</div></div>`;
    qs("[data-calsave]", root)?.addEventListener("click", async () => {
      const cur = (await db.metaGet("haul_calib")) || {};
      await db.metaSet("haul_calib", J.mergeCalib(cur, props, today));
      await db.saveExisting("sites", site, { deal: { ...D, calib_saved: today } }, "Metraj katsayısı öğrenildi");
      toast("Katsayılar kaydedildi", "ok"); ctx.reload();
    });
  }
  // Ölçüm önizleme ve kayıt
  const mbox = qs("[data-measure]", root);
  if (mbox) {
    const prev = () => {
      const m3 = Number(String(qs("[name=m_m3]", mbox).value).replace(",", "."));
      if (!(m3 > 0)) { qs("[data-mprev]", mbox).innerHTML = ""; return null; }
      const mo = J.dealMoney(D, m3);
      qs("[data-mprev]", mbox).innerHTML = `${n(m3)} m³ × ${fmtTL(D.price)} ₺ = net <b>${fmtTL(mo.net)} ₺</b> + KDV %${mo.rate} ${fmtTL(mo.kdv)} ₺ = <b>${fmtTL(mo.gross)} ₺</b> brüt cariye yazılır.${rep.est ? ` Tahminle fark: ${n((m3 / rep.est - 1) * 100)}%.` : ""}`;
      return { m3, mo };
    };
    qs("[name=m_m3]", mbox).addEventListener("input", prev);
    let busy = false;
    qs("[data-msave]", mbox).addEventListener("click", async () => {
      if (busy) return;
      const p = prev(), date = qs("[name=m_date]", mbox).value;
      if (!p) return toast("Ölçülen m³'ü yazın", "err");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast("Ölçüm tarihini girin", "err");
      if (!(await confirmDialog("Ölçüm cariye yazılsın mı?", `${site.name}: ${n(p.m3)} m³ → ${custName} carisine ${fmtTL(p.mo.gross)} ₺ (brüt) metraj hakedişi yazılır. Sonra değiştirilemez; yanlışsa caride düzeltme kaydı açılır.`, "Cariye yaz"))) return;
      busy = true;
      try {
        const surveyor = qs("[name=m_surveyor]", mbox).value.trim(), note = qs("[name=m_note]", mbox).value.trim();
        await db.saveJobMeasurement(site.id,
          { date, m3: p.m3, surveyor, note, unit_price: Number(D.price), kdv_rate: p.mo.rate, kdv_included: !!D.kdv_included, net: p.mo.net, kdv: p.mo.kdv, gross: p.mo.gross, est_at_measure: rep.est, trips_at_measure: rep.trips, saved_at: new Date().toISOString() },
          { date, customer_id: site.customer_id, type: "Hakedis", amount: p.mo.gross, source: "metraj", ref_id: site.id, ref_store: "sites",
            note: `Metraj hakedişi — ${site.name}: ${n(p.m3)} m³ × ${fmtTL(D.price)} ₺ (KDV ${D.kdv_included ? "dahil" : "hariç"} %${p.mo.rate})` },
          "İş sözleşmesi ölçümü");
        toast("Ölçüm kaydedildi, hakediş cariye yazıldı", "ok");
        ctx.reload();
      } catch (e) { toast(e.message || String(e), "err"); busy = false; }
    });
  }
  let charging = false;
  qs("[data-charge-go]", root)?.addEventListener("click", async () => {
    if (charging) return;
    if (!(await chargeLump(db, site, D, custName))) return;
    ctx.reload();
  });
  qs("[data-scrap-add]", root)?.addEventListener("click", async () => {
    const box = qs("[data-scrap]", root), amount = Number(String(qs("[name=sc_amount]", box).value).replace(",", ".")), date = qs("[name=sc_date]", box).value;
    if (!(amount > 0)) return toast("Tutarı yazın", "err");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast("Tarihi girin", "err");
    const fresh = await db.get("sites", site.id);
    await db.saveExisting("sites", fresh, { deal: { ...fresh.deal, scrap_sales: [...(fresh.deal.scrap_sales || []), { date, amount, buyer: qs("[name=sc_buyer]", box).value.trim(), at: new Date().toISOString() }] } }, "Hurda satışı");
    toast("Hurda satışı eklendi", "ok"); ctx.reload();
  });
  qs("[data-close]", root)?.addEventListener("click", async () => {
    if (rep.hoursIncluded && !rep.extras.count) {
      const a = await choiceDialog("Ekstra iş var mıydı?", `Bu işte ${n(rep.hoursIncluded)} saat makine çalışması var ve hepsi sözleşmeye dahil sayıldı.`, [["yok", "Hayır, hepsi dahil — işi kapat"], ["var", "Evet — işleri gözden geçir"]]);
      if (a == null) return;
      if (a === "var") return go("#/is-sozlesmesi/" + id + "/bagla");
    } else if (!(await confirmDialog("İş kapatılsın mı?", "Kapanınca bu müşteriye yazılan yeni işler bu sözleşmeye sayılmaz. Kayıtlar ve cari değişmez.", "Kapat"))) return;
    await db.saveExisting("sites", site, { deal: { ...D, status: J.STATUS.CLOSED, closed_at: today } }, "İş sözleşmesi kapandı");
    toast("İş kapandı", "ok"); ctx.reload();
  });
  return true;
}

// Götürü bedelini cariye yaz: net / KDV / brüt önizleme + onay → tek işlem
async function chargeLump(db, site, D, custName) {
  const mo = J.dealMoney(D, 1), date = D.start_date || todayStr();
  if (!(await confirmDialog("Sözleşme bedeli cariye yazılsın mı?", `${site.name}: net ${fmtTL(mo.net)} ₺ + KDV %${mo.rate} ${fmtTL(mo.kdv)} ₺ = ${fmtTL(mo.gross)} ₺ ${custName} carisine borç yazılır (${trDate(date)}). Ara ödemeler bundan düşer. Sonra değiştirilemez; yanlışsa caride düzeltme kaydı açılır.`, "Cariye yaz"))) return false;
  try {
    await db.saveJobCharge(site.id, { date, net: mo.net, kdv: mo.kdv, gross: mo.gross, kdv_rate: mo.rate, kdv_included: !!D.kdv_included, price: Number(D.price), saved_at: new Date().toISOString() },
      { date, customer_id: site.customer_id, type: "Hakedis", amount: mo.gross, source: "goturu", ref_id: site.id, ref_store: "sites", note: `Götürü sözleşme bedeli — ${site.name} (KDV ${D.kdv_included ? "dahil" : "hariç"} %${mo.rate})` },
      "Götürü sözleşme bedeli");
    toast("Sözleşme bedeli cariye yazıldı", "ok");
    return true;
  } catch (e) { toast(e.message || String(e), "err"); return false; }
}

const RATE_ROWS = 4;
async function dealForm(ctx, site, D, custName) {
  const { root, db } = ctx;
  const kd = kdvRateOf(await db.metaGet("kdv_default"));
  let pre = null;
  try { const x = JSON.parse(sessionStorage.getItem("sp_deal_prefill") || "null"); if (x && x.site_id === site.id) pre = x.deal; } catch { /* yok */ }
  const v = D || pre || { basis: "Götürü", kdv_rate: kd ?? 20, kdv_included: false, start_date: todayStr(), material: "toprak" };
  const locked = J.isLocked(D);
  const rates = [...(v.extra_rates || [])];
  while (rates.length < RATE_ROWS) rates.push({ label: "", unit: "Saat", price: "" });
  const q = (f) => (pre && v.quotes ? v.quotes.filter((x) => x.field === f || String(x.field || "").startsWith(f)).map((x) => `<div class="tiny muted" data-quote>📄 “${esc(x.text)}”</div>`).join("") : "");
  root.innerHTML = appbar(D ? "Anlaşmayı Düzenle" : "Yeni İş Sözleşmesi", `${custName} · ${site.name}`) + `
    ${pre ? `<div class="notice info small" data-fromdoc><span>📄</span><span>Sözleşmeden okundu (Gemini). Alanları belgeyle karşılaştırın; <b>Kaydet</b>'e basmadan hiçbir şey yazılmaz.${(v.issues || []).length ? "<br><b>Kontrol edin:</b> " + v.issues.map(esc).join(" · ") : ""}</span></div>` : ""}
    ${locked ? notice("info", "Bedel / ölçüm cariye yazıldığı için anlaşma türü, fiyat ve KDV değiştirilemez; kapsam, ekstra fiyatları ve notlar düzenlenebilir.") : ""}
    <form data-form class="card" style="margin-top:10px">
      ${fSelect("Anlaşma türü", "basis", [{ v: "Götürü", t: "Götürü (toplam bedel)" }, { v: "m³", t: "Metreküp (yerinde, ortak ölçümcü ölçer)" }, { v: "Sefer", t: "Sefer başı" }], v.basis, { empty: false })}${q("basis")}
      <div class="formgrid2">${fNum("Bedel / birim fiyat (₺)", "price", v.price ?? "", { step: "any" })}${fNum("KDV %", "kdv_rate", v.kdv_rate ?? "", { step: "any" })}</div>${q("price")}${q("kdv")}
      ${fSelect("Fiyat KDV", "kdv_included", [{ v: "0", t: "KDV hariç" }, { v: "1", t: "KDV dahil" }], v.kdv_included ? "1" : "0", { empty: false })}
      ${fDate("Başlangıç tarihi", "start_date", v.start_date)}${q("start_date")}${q("contract_date")}
      ${fText("Süre / teslim", "deadline", v.deadline || "")}
      <div data-matrow>${fSelect("Ana malzeme (m³ tahmini için)", "material", MATERIALS.map((m) => ({ v: m.key, t: m.name })), v.material || "toprak", { empty: false })}</div>
      ${fArea("İşe dahil olanlar (sözleşmedeki gibi)", "scope_in", Array.isArray(v.scope_in) ? v.scope_in.join("\n") : v.scope_in || "")}${q("scope_in")}
      ${fArea("Hariç olanlar / müşterinin sorumlulukları", "scope_out", Array.isArray(v.scope_out) ? v.scope_out.join("\n") : v.scope_out || "")}${q("scope_out")}
      <div class="section-title">Ekstra iş fiyatları (sözleşmede yazıyorsa)</div>
      ${rates.map((r, i) => `<div class="formgrid2" data-rate="${i}">${fText("Ekstra iş", "r_label_" + i, r.label || "")}${fSelect("Birim", "r_unit_" + i, J.EXTRA_UNITS, r.unit || "Saat", { empty: false })}${fNum("Fiyat (₺)", "r_price_" + i, r.price ?? "", { step: "any" })}</div>`).join("")}${q("extra_rates")}
      <div class="muted small">Ekstra işaretlenen iş önce buradaki fiyatla (birim aynıysa), yoksa fiyat listesiyle fiyatlanır.</div>
      ${fSelect("Hurda", "scrap", Object.entries(J.SCRAP).map(([k, t]) => ({ v: k, t })), v.scrap || "", { empty: false })}${q("scrap")}
      ${fArea("Ödeme şekli", "payment_plan", v.payment_plan || "")}${q("payment_plan")}
      ${fArea("Not", "note", v.note || "")}
      <div class="muted small">Kapsam içi işler (kamyon seferleri, ekskavatör saati, işçilik) fiyata dahil sayılır; anlaşma dışı işler kayıt sırasında “ekstra” işaretlenir. ${D ? "Değişiklik kayıtlı işlerin fiyatını değiştirmez." : ""}</div>
    </form>
    <div class="actionbar"><button class="btn primary" data-save>Kaydet</button></div>`;
  const form = qs("[data-form]", root);
  if (locked) for (const n of ["basis", "price", "kdv_rate", "kdv_included"]) qs(`[name=${n}]`, form).disabled = true;
  const syncBasis = () => { const b = qs("[name=basis]", form).value; qs("[data-matrow]", form).hidden = b === "Götürü"; qs("[name=price]", form).closest(".field").querySelector("label").textContent = b === "Götürü" ? "Sözleşme bedeli (₺)" : "Birim fiyat (₺)"; };
  qs("[name=basis]", form).addEventListener("change", syncBasis);
  syncBasis();
  let busy = false;
  qs("[data-save]", root).addEventListener("click", async () => {
    if (busy) return;
    const f = collectForm(form);
    const num = (x) => (x === "" || x == null ? "" : Number(String(x).replace(",", ".")));
    const extra_rates = [];
    for (let i = 0; i < RATE_ROWS; i++) { const l = (f["r_label_" + i] || "").trim(), p = num(f["r_price_" + i]); if (l || p !== "") extra_rates.push({ label: l, unit: f["r_unit_" + i], price: p }); }
    const x = locked ? { basis: D.basis, price: D.price, kdv_rate: D.kdv_rate, kdv_included: D.kdv_included } : { basis: f.basis, price: num(f.price), kdv_rate: num(f.kdv_rate), kdv_included: f.kdv_included === "1" };
    Object.assign(x, { start_date: f.start_date, material: f.material, note: (f.note || "").trim(), scope_in: (f.scope_in || "").trim(), scope_out: (f.scope_out || "").trim(), extra_rates, scrap: f.scrap || "", payment_plan: (f.payment_plan || "").trim(), deadline: (f.deadline || "").trim() });
    const err = J.checkDeal(x);
    if (err) return toast(err, "err");
    busy = true;
    const deal = { ...(D || {}), ...x, status: D?.status || J.STATUS.OPEN, created_at: D?.created_at || new Date().toISOString(), measurement: D?.measurement || null,
      ...(pre && !D ? { source: "belge", doc_id: pre.doc_id || null, read_quotes: (pre.quotes || []).slice(0, 40), read_at: pre.read_at || null } : {}) };
    try {
      await db.saveExisting("sites", await db.get("sites", site.id), { deal }, D ? "İş sözleşmesi düzenlendi" : pre ? "İş sözleşmesi belgeden açıldı" : "İş sözleşmesi açıldı");
      try { sessionStorage.removeItem("sp_deal_prefill"); } catch { /* yok */ }
      toast("Kaydedildi", "ok");
      if (!D && deal.basis === "Götürü") await chargeLump(db, await db.get("sites", site.id), deal, custName);
    } catch (e) { busy = false; return toast(e.message || String(e), "err"); }
    if (location.hash === "#/is-sozlesmesi/" + site.id) ctx.reload(); else go("#/is-sozlesmesi/" + site.id);
  });
  return true;
}

// Sözleşme / teklif belgesinden iş kurma: Gemini okur → önizleme → onayla müşteri / şantiye / belge → anlaşma formu (Kaydet ile yazılır)
async function readContract(ctx) {
  const { root, db } = ctx;
  const d = await db.dumpAll();
  const customers = (d.customers || []).filter((c) => isActive(c) && !c.internal);
  root.innerHTML = appbar("Sözleşmeden Oluştur", "PDF ya da fotoğraf") + `
    <div class="card" style="margin-top:10px">
      <div class="field"><label>Sözleşme / teklif (PDF ya da fotoğraf)</label><input type="file" accept="application/pdf,image/*" data-cfile></div>
      <button class="btn primary block" data-cread>🤖 Gemini ile oku</button>
      <div class="muted small" style="margin-top:6px">Belge okunmak için Google Gemini'ye gönderilir (anahtar telefonunuzda). Okunan bilgiler yalnız öneridir; siz onaylamadan kayıt yazılmaz.</div>
    </div>
    <div data-cout></div>`;
  let file = null, res = null;
  qs("[data-cfile]", root).addEventListener("change", (e) => { file = e.target.files[0] || null; });
  qs("[data-cread]", root).addEventListener("click", async (ev) => {
    const b = ev.currentTarget, out = qs("[data-cout]", root);
    if (!file) return toast("Önce belgeyi seçin", "err");
    if (!/^(application\/pdf|image\/)/.test(file.type || "")) return toast("Yalnız PDF ya da fotoğraf", "err");
    if (file.size > 15 * 1024 * 1024) return toast("Belge 15 MB'tan büyük; daha küçük bir PDF seçin", "err");
    const G = await import("./ai-gemini.js");
    if (!(await G.geminiSettings(db)).ready) return toast("Ayarlar → Yapay Zeka'da Gemini anahtarını ve onayını kaydedin", "err");
    if (!navigator.onLine) return toast("İnternet yok", "err");
    b.disabled = true; out.innerHTML = '<div class="muted small" style="padding:8px">Gemini sözleşmeyi okuyor…</div>';
    try {
      const CR = await import("./contract-read.js");
      const blob = file.type.startsWith("image/") ? await G.shrink(file) : file;
      const parts = [{ inlineData: { mimeType: blob.type || file.type, data: await G.blobToBase64(blob) } }, { text: "Belge: " + (file.name || "sözleşme") }];
      const obj = await G.withModelFallback(db, (o) => G.geminiJson(parts, { ...o, system: CR.CONTRACT_PROMPT, schema: CR.contractSchema() }));
      res = CR.validateContract(obj, d);
      drawResult(out, res);
    } catch (e) { out.innerHTML = notice("warn", "Okunamadı: " + esc(e.message || String(e))); }
    finally { b.disabled = false; }
  });
  const drawResult = (out, r) => {
    const opts = [...customers.map((c) => ({ v: c.id, t: c.name })), ...(r.customer_name ? [{ v: "__new__", t: "➕ Yeni müşteri: " + r.customer_name }] : [])];
    out.innerHTML = `<div class="card" data-cres>
      <div class="section-title" style="margin:0 0 6px">Okunan bilgiler</div>
      ${kv("Anlaşma", r.basis || "bulunamadı")}${kv(r.basis === "Götürü" ? "Bedel" : "Fiyat", r.price ? fmtTL(r.price) + " ₺" : "bulunamadı")}
      ${kv("KDV", r.kdv_rate == null ? "belgede yok" : "%" + r.kdv_rate + (r.kdv_included == null ? "" : r.kdv_included ? " dahil" : " hariç"))}
      ${r.scope_in.length ? kvh("Dahil", r.scope_in.map(esc).join("<br>")) : ""}${r.scope_out.length ? kvh("Hariç", r.scope_out.map(esc).join("<br>")) : ""}
      ${r.extra_rates.length ? kvh("Ekstra fiyatları", r.extra_rates.map((x) => `${esc(x.label || "?")}: ${x.price ? fmtTL(x.price) + " ₺" : "?"} / ${esc(x.unit || "?")}`).join("<br>")) : ""}
      ${r.scrap ? kv("Hurda", J.SCRAP[r.scrap]) : ""}${r.payment_plan ? kv("Ödeme", r.payment_plan) : ""}
      ${r.issues.length ? notice("warn", "Kontrol edin: " + r.issues.map(esc).join(" · ")) : ""}
      ${fSelect("Müşteri", "c_customer", opts, r.customer?.id || (r.customer_name ? "__new__" : ""))}
      ${fText("Şantiye / iş adı", "c_site", r.site_name || "")}
      <button class="btn primary block" data-cok>Onayla — müşteri / şantiyeyi aç, belgeyi ekle, anlaşmaya geç</button>
      <div class="muted small">Sonraki ekranda tüm alanları düzeltebilirsiniz; anlaşma <b>Kaydet</b>'e basınca yazılır.</div>
    </div>`;
    qs("[data-cok]", out).addEventListener("click", async (e) => {
      const btn = e.currentTarget, box = qs("[data-cres]", out);
      let cid = qs("[name=c_customer]", box).value; const sname = qs("[name=c_site]", box).value.trim();
      if (!cid) return toast("Müşteriyi seçin", "err");
      if (!sname) return toast("Şantiye / iş adını yazın", "err");
      btn.disabled = true;
      try {
        if (cid === "__new__") cid = (await db.saveNew("customers", { name: r.customer_name }, "Sözleşmeden müşteri")).id;
        const site = await db.saveNew("sites", { name: sname, customer_id: cid }, "Sözleşmeden şantiye");
        let doc_id = null;
        try { doc_id = (await db.saveDocument({ category: "Sözleşme", owner_type: "customer", owner_id: cid, customer_id: cid, site_id: site.id, date: r.contract_date || todayStr(), title: "Sözleşme — " + sname }, file)).id; }
        catch (err) { toast("Belge eklenemedi: " + (err.message || err), "err"); }
        sessionStorage.setItem("sp_deal_prefill", JSON.stringify({ site_id: site.id, deal: { basis: r.basis || "Götürü", price: r.price ?? "", kdv_rate: r.kdv_rate ?? "", kdv_included: !!r.kdv_included, start_date: r.start_date || todayStr(),
          scope_in: r.scope_in, scope_out: r.scope_out, extra_rates: r.extra_rates.map((x) => ({ label: x.label || "", unit: x.unit || "Saat", price: x.price ?? "" })), scrap: r.scrap || "", payment_plan: r.payment_plan || "", deadline: r.deadline || "",
          note: r.notes || "", quotes: r.quotes, issues: r.issues, doc_id, read_at: new Date().toISOString() } }));
        go("#/is-sozlesmesi/" + site.id);
      } catch (err) { btn.disabled = false; toast(err.message || String(err), "err"); }
    });
  };
  return true;
}

// Mevcut işleri sözleşmeye bağlama / kapsam içi işi ekstraya çevirme — seçilenler, önizleme ve onayla; kilitli / hakedişli iş hariç
async function link(ctx, id) {
  const { root, db } = ctx;
  const d = await db.dumpAll();
  const site = (d.sites || []).find((s) => s.id === id && isActive(s));
  const D = J.dealOf(site);
  if (!site || !D || D.status !== J.STATUS.OPEN) { root.innerHTML = appbar("İşleri bağla") + emptyState("📐", "Açık iş sözleşmesi yok"); return true; }
  const billed = new Set((d.hakedis || []).filter((h) => isActive(h) && h.status !== "İptal").flatMap((h) => (h.items || []).map((i) => i.work_record_id)));
  const ok = (w) => isActive(w) && w.customer_id === site.customer_id && !billed.has(w.id) && !w.price_snapshot?.locked && !(Number(w.customer_fuel_allowance_l) > 0)
    && !["Mazot karşılığı", "İç iş (kendi depo)"].includes(w.price_snapshot?.price_source);
  const amt = (w) => { const a = Number(w.price_snapshot?.amount ?? Number(w.price_snapshot?.unit_price) * Number(w.quantity)); return Number.isFinite(a) && a > 0 ? a : 0; };
  const unlinked = (d.work_records || []).filter((w) => ok(w) && (!w.date || w.date >= D.start_date) && ((!w.site_id && !w.job_extra) || (w.site_id === site.id && !J.isJobPriced(w) && !w.job_extra))).sort((a, b) => (a.date < b.date ? 1 : -1));
  const included = (d.work_records || []).filter((w) => ok(w) && w.site_id === site.id && J.isJobPriced(w)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const vn = (vid) => (d.vehicles || []).find((v) => v.id === vid)?.name || "—";
  const row = (w) => `<label class="li" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-w="${esc(w.id)}"><span style="flex:1"><b>${trDate(w.date)}</b> · ${esc(vn(w.vehicle_id))} · ${esc(w.work_type || "")} ${n(w.quantity)} ${esc(String(w.unit || "").toLocaleLowerCase("tr-TR"))}<br><span class="muted small">${amt(w) ? fmtTL(amt(w)) + " ₺ · " + esc(w.price_snapshot?.price_source || "") : "fiyatsız"}</span></span></label>`;
  root.innerHTML = appbar("İşleri Gözden Geçir", site.name) + `
    ${notice("info", "Seçmediğiniz hiçbir iş değişmez. Her değişiklik önce tutar farkıyla gösterilir ve geçmişe kaydedilir. Hakedişe girmiş ya da kilitli işler listede yok.")}
    <div class="section-title">Sözleşmeye bağlı olmayan işler (${unlinked.length})</div>
    <div data-un>${unlinked.map(row).join("") || emptyState("✓", "Yok")}</div>
    ${unlinked.length ? `<div class="row" style="gap:6px;flex-wrap:wrap;margin:6px 0"><button class="btn sm" data-act="dahil">Seçilenleri DAHİL olarak bağla</button><button class="btn sm" data-act="ekstra">Seçilenleri EKSTRA olarak bağla</button></div>` : ""}
    <div class="section-title">Sözleşmeye dahil işler (${included.length})</div>
    <div data-in>${included.map(row).join("") || emptyState("✓", "Yok")}</div>
    ${included.length ? `<div class="row" style="gap:6px;margin:6px 0 80px"><button class="btn sm" data-act="cikar">Seçilenleri EKSTRA yap (fiyat listesinden)</button></div>` : ""}`;
  for (const b of qsa("[data-act]", root))
    b.addEventListener("click", async () => {
      const act = b.dataset.act, scope = act === "cikar" ? "[data-in]" : "[data-un]";
      const ids = qsa(`${scope} input[data-w]:checked`, root).map((x) => x.dataset.w);
      if (!ids.length) return toast("İş seçin", "err");
      const { priceSnapshot } = await import("./business.js");
      const prices = (d.price_book || []).filter(isActive), crane = { first: await db.metaGet("crane_first_hour"), next: await db.metaGet("crane_next_hour") };
      const plan = ids.map((wid) => {
        const w = d.work_records.find((x) => x.id === wid);
        let fields;
        if (act === "dahil") fields = { site_id: site.id, job_extra: false, price_snapshot: J.jobSnapshot(site, w) };
        else if (act === "ekstra") { const x = J.extraSnapshot(site, w); fields = { site_id: site.id, job_extra: true, ...(x ? { price_snapshot: x } : {}) }; }
        else fields = { job_extra: true, price_snapshot: J.extraSnapshot(site, w) || priceSnapshot({ ...w, site_id: site.id }, prices, crane) };
        const after = fields.price_snapshot !== undefined ? (() => { const p = fields.price_snapshot; const a = Number(p?.amount ?? Number(p?.unit_price) * Number(w.quantity)); return Number.isFinite(a) && a > 0 ? a : 0; })() : amt(w);
        return { w, fields, before: amt(w), after };
      });
      const delta = plan.reduce((s, p) => s + p.after - p.before, 0), unpriced = plan.filter((p) => !p.after && act !== "dahil").length;
      const txt = `${plan.length} iş ${act === "dahil" ? "sözleşmeye DAHİL edilecek" : "EKSTRA olarak işaretlenecek"}. Müşteri carisi ${delta === 0 ? "değişmez" : (delta > 0 ? "+" : "−") + fmtTL(Math.abs(delta)) + " ₺ değişir"}.${unpriced ? ` ${unpriced} işin fiyatı yok (fiyat listesinde kural yok) — fiyatsız olarak işaretlenir.` : ""}`;
      if (!(await confirmDialog("Değişiklik onayı", txt, "Uygula"))) return;
      let done = 0, skipped = 0;
      for (const p of plan) {
        const r = await db.updateIf("work_records", p.w.id, (cur) => cur.updated_at === p.w.updated_at && !cur.price_snapshot?.locked, p.fields, act === "dahil" ? "İş sözleşmesine dahil edildi" : "İş sözleşmesinde ekstra işaretlendi");
        if (r?.skipped) skipped++; else done++;
      }
      toast(`${done} iş güncellendi${skipped ? `, ${skipped} iş başka yerde değiştiği için atlandı` : ""}`, skipped ? "err" : "ok");
      ctx.reload();
    });
  return true;
}

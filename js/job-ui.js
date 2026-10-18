// İş sözleşmeleri (#/is-sozlesmeleri, #/is-sozlesmesi/<şantiye>, …/bagla): sefer ya da m³ anlaşması, kapsam içi / ekstra işler,
// tahmini yerinde m³, ölçüm → cariye metraj hakedişi, kapanış raporu ve katsayı öğrenme. Para yazan her adım önizleme + onayla.
import { qs, qsa, esc, appbar, toast, notice, badge, li, kv, emptyState, confirmDialog, choiceDialog, fSelect, fNum, fDate, fText, fArea, collectForm, go } from "./ui.js";
import { todayStr, trDate, fmtTL, isActive, kdvRateOf } from "./core.js";
import * as J from "./job-core.js";
import { MATERIALS } from "./haul-core.js";

const n = (x) => Number(x || 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
const SRC = { kantar: "kantar fişli", "kantar-ort": "aynı işin kantar ortalamasıyla", ogrenilmis: "önceki işlerden öğrenilen katsayıyla", kasa: "yük / kasa tahminiyle", yok: "hesaplanamadı" };
const kvh = (k, html) => `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${html}</span></div>`;
const statusBadge = (s) => badge(s, s === J.STATUS.OPEN ? "ok" : s === J.STATUS.MEASURED ? "warn" : "");

export async function screen(ctx) {
  const [route, id, sub] = ctx.parts;
  if (route === "is-sozlesmeleri") return list(ctx);
  if (route !== "is-sozlesmesi" || !id) return false;
  if (sub === "bagla") return link(ctx, id);
  return detail(ctx, id);
}

async function list(ctx) {
  const { root, db, query } = ctx;
  const d = await db.dumpAll(), today = todayStr();
  const cust = (id) => (d.customers || []).find((c) => c.id === id)?.name || "—";
  const cid = query.customer_id || "";
  const jobs = (d.sites || []).filter((s) => isActive(s) && J.dealOf(s) && (!cid || s.customer_id === cid));
  const row = (s) => {
    const D = J.dealOf(s), rep = J.jobReport(d, s, { today });
    const info = D.basis === "m³" ? (rep.measured ? `ölçülen ${n(rep.measured)} m³` : rep.est ? `tahmini ≈ ${n(rep.est)} m³` : "henüz sefer yok") : `${n(rep.trips)} sefer`;
    return li({ ic: "📐", href: "#/is-sozlesmesi/" + s.id, t1: esc(s.name), t2: esc(`${cust(s.customer_id)} · ${D.basis === "m³" ? "m³" : "sefer"} başı ${fmtTL(D.price)} ₺ · ${info}`), badgeHtml: statusBadge(D.status) });
  };
  const customers = (d.customers || []).filter((c) => isActive(c) && !c.internal);
  root.innerHTML = appbar("İş Sözleşmeleri", "Sefer ya da metreküp anlaşmaları") + `
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
  if (!D || (query.duzenle === "1" && D.status === J.STATUS.OPEN && !D.measurement)) return dealForm(ctx, site, D, custName);
  const matOver = (await db.metaGet("haul_materials")) || {}, calib = (await db.metaGet("haul_calib")) || {};
  const rep = J.jobReport(d, site, { matOver, calib, today });
  const M = D.measurement, isM3 = D.basis === "m³";
  const srcLine = Object.entries(rep.src).filter(([, v]) => v).map(([k, v]) => `${n(v)} sefer ${SRC[k]}`).join(" · ");
  const money = rep.money;
  root.innerHTML = appbar(site.name, `${custName} · iş sözleşmesi`, { right: statusBadge(D.status) }) + `
    <div class="card" data-deal>
      ${kv("Anlaşma", isM3 ? "Metreküp (yerinde, ortak ölçümcü)" : "Sefer başı")}
      ${kv("Birim fiyat", `${fmtTL(D.price)} ₺ / ${isM3 ? "m³" : "sefer"} · KDV ${D.kdv_included ? "dahil" : "hariç"} %${D.kdv_rate}`)}
      ${kv("Başlangıç", trDate(D.start_date))}
      ${kv("Ana malzeme", MATERIALS.find((m) => m.key === D.material)?.name || "Toprak (genel)")}
      ${D.note ? kvh("Not", esc(D.note)) : ""}
      <div class="muted small" style="margin-top:6px">${isM3 ? "Kazı, yükleme, nakliye ve döküm fiyata dahildir; bu işteki kamyon seferleri ve makine saatleri cariye ayrıca yazılmaz." : "Ekskavatör / yükleme sefer fiyatına dahildir; makine saatleri cariye ayrıca yazılmaz."} Ekstra işler ayrıca fiyatlanır.</div>
    </div>
    <div class="card" data-jobsum>
      <div class="section-title" style="margin:0 0 6px">Bu işteki kayıtlar</div>
      ${kv("İş kaydı", `${rep.works} (${rep.included.count} kapsam içi, ${rep.extras.count} ekstra)`)}
      ${kv("Kamyon seferi", n(rep.trips) + (rep.extraTrips ? ` (+ ${n(rep.extraTrips)} ekstra sefer, metraja girmez)` : ""))}
      ${rep.hours || rep.yev ? kvh("Makine", rep.machines.map((m) => `${esc(m.vehicle)}: ${m.hours ? n(m.hours) + " saat" : ""}${m.yev ? " " + n(m.yev) + " yevmiye" : ""}${m.extraHours ? ` (${n(m.extraHours)} saat ekstra)` : ""}`).join(" · ")) : ""}
      ${rep.extras.count ? kvh("Ekstra işler", `${fmtTL(rep.extras.amount)} ₺ cariye yazıldı${rep.extras.unpriced ? ` · <b>${rep.extras.unpriced} ekstra işin fiyatı yok</b>` : ""}`) : ""}
      ${!isM3 ? kv("Sefer tutarı", `${fmtTL(rep.included.amount)} ₺ — her sefer cariye iş olarak yazıldı`) : ""}
      ${rep.included.notJob ? notice("warn", `${rep.included.notJob} iş bu şantiyede ama fiyat listesinden fiyatlanmış (sözleşmeye bağlanmamış). “İşleri gözden geçir”den bakın.`) : ""}
    </div>
    ${rep.trips ? `<div class="card" data-est>
      <div class="section-title" style="margin:0 0 6px">${M ? "Tahmin ve ölçüm" : "Tahmini yerinde m³"}</div>
      <div style="overflow-x:auto"><table class="small" style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Araç</th><th style="text-align:left">Malzeme</th><th style="text-align:right">Sefer</th><th style="text-align:right">≈ m³</th></tr></thead><tbody>
        ${rep.groups.map((g) => `<tr style="border-top:1px solid var(--line,#e3e7ee)"><td style="padding:4px 6px 4px 0">${esc(g.vehicle)}</td><td>${esc(g.materialName)}</td><td style="text-align:right">${n(g.trips)}</td><td style="text-align:right">${g.unknown === g.trips ? "—" : n(g.m3)}</td></tr>`).join("")}
      </tbody></table></div>
      <div style="margin-top:6px"><b>Toplam ≈ ${n(rep.est)} m³ yerinde</b> <span class="muted small">(tahmini)</span></div>
      <div class="muted small">${esc(srcLine)}</div>
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
    </div>` : `<div class="card">${kvh("Müşterinin " + trDate(D.start_date) + "'den beri ödemeleri", fmtTL(rep.paid) + " ₺ <span class='muted small'>(müşterinin tüm işleri)</span>")}</div>`}
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
      ${D.status === J.STATUS.OPEN && !M ? `<button class="btn" data-go="#/is-sozlesmesi/${esc(id)}?duzenle=1">Anlaşmayı düzenle</button>` : ""}
      ${(isM3 ? D.status === J.STATUS.MEASURED : D.status === J.STATUS.OPEN) ? `<button class="btn" data-close>İşi kapat</button>` : ""}
      <button class="btn" data-go="#/santiyeler/${esc(id)}">Şantiye kartı</button>
    </div>`;
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

async function dealForm(ctx, site, D, custName) {
  const { root, db } = ctx;
  const kd = kdvRateOf(await db.metaGet("kdv_default"));
  const v = D || { basis: "m³", kdv_rate: kd ?? 20, kdv_included: false, start_date: todayStr(), material: "toprak" };
  root.innerHTML = appbar(D ? "Anlaşmayı Düzenle" : "Yeni İş Sözleşmesi", `${custName} · ${site.name}`) + `
    <form data-form class="card" style="margin-top:10px">
      ${fSelect("Anlaşma türü", "basis", [{ v: "m³", t: "Metreküp (yerinde, ortak ölçümcü ölçer)" }, { v: "Sefer", t: "Sefer başı" }], v.basis, { empty: false })}
      <div class="formgrid2">${fNum("Birim fiyat (₺)", "price", v.price ?? "", { step: "any" })}${fNum("KDV %", "kdv_rate", v.kdv_rate ?? "", { step: "any" })}</div>
      ${fSelect("Fiyat KDV", "kdv_included", [{ v: "0", t: "KDV hariç" }, { v: "1", t: "KDV dahil" }], v.kdv_included ? "1" : "0", { empty: false })}
      ${fDate("Başlangıç tarihi", "start_date", v.start_date)}
      ${fSelect("Ana malzeme (tahmin için)", "material", MATERIALS.map((m) => ({ v: m.key, t: m.name })), v.material || "toprak", { empty: false })}
      ${fArea("Not (ne dahil, ne hariç…)", "note", v.note || "")}
      <div class="muted small">Kapsam içi işler (kamyon seferleri, ekskavatör saati) ${"fiyata dahil sayılır"}; anlaşma dışı işler kayıt sırasında “ekstra” işaretlenir ve fiyat listesinden ayrı fiyatlanır. ${D ? "Fiyat değişikliği kayıtlı işlerin fiyatını değiştirmez." : ""}</div>
    </form>
    <div class="actionbar"><button class="btn primary" data-save>Kaydet</button></div>`;
  qs("[data-save]", root).addEventListener("click", async () => {
    const f = collectForm(qs("[data-form]", root));
    const x = { basis: f.basis, price: Number(String(f.price).replace(",", ".")), kdv_rate: f.kdv_rate === "" ? "" : Number(String(f.kdv_rate).replace(",", ".")), kdv_included: f.kdv_included === "1", start_date: f.start_date, material: f.material, note: (f.note || "").trim() };
    const err = J.checkDeal(x);
    if (err) return toast(err, "err");
    const deal = { ...(D || {}), ...x, status: D?.status || J.STATUS.OPEN, created_at: D?.created_at || new Date().toISOString(), measurement: D?.measurement || null };
    await db.saveExisting("sites", site, { deal }, D ? "İş sözleşmesi düzenlendi" : "İş sözleşmesi açıldı");
    toast("Kaydedildi", "ok");
    if (location.hash === "#/is-sozlesmesi/" + site.id) ctx.reload(); else go("#/is-sozlesmesi/" + site.id);
  });
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
        else if (act === "ekstra") fields = { site_id: site.id, job_extra: true };
        else fields = { job_extra: true, price_snapshot: priceSnapshot({ ...w, site_id: site.id }, prices, crane) };
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

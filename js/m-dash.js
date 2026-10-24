// SAHAPRO SOLO — Dashboard · Gün Sonu · Yönetici · Raporlar · Daha Fazla
import { todayBoard } from "./today.js";
import { monthlySeries, vehicleSeries } from "./finance-chart.js";
import {
  qs,
  qsa,
  esc,
  appbar,
  stat,
  li,
  emptyState,
  notice,
  kv,
  badge,
  statusBadge,
  segBar,
  searchBar,
  sheet,
  toast,
  downloadBlob,
  shareText,
  printHTML,
  fmtTL,
  fmtNum,
  trDate,
  todayStr,
  confirmDialog,
} from "./ui.js";
import {
  daySummary,
  smartAlerts,
  buildWhatsAppText,
  calcTankBalance,
  profitability,
  isActive,
  matchSearch,
  addDays,
  toCSV,
  WORK_TYPES,
} from "./core.js";

export async function screen(ctx) {
  const sub = ctx.parts[0] || "";
  if (ctx.parts.length === 0) return dashboard(ctx);
  if (sub === "gunsonu" || ctx.parts[0] === "gunsonu") return dayClose(ctx);
  if (sub === "raporlar") return reports(ctx);
  if (sub === "yonetici") return manager(ctx);
  if (sub === "daha") return more(ctx);
  return dashboard(ctx);
}

async function loadAll(db) {
  const stores = [
    "work_records",
    "fuel_records",
    "fuel_tank_movements",
    "expense_records",
    "maintenance_records",
    "cash_records",
    "personnel_events",
    "slips",
    "hakedis",
    "cari_movements",
    "documents",
    "vehicles",
    "customers",
    "sites",
    "personnel",
    "price_book",
    "suppliers",
    "payables",
    "payroll_entries",
    "supplier_payments",
    "instruments",
    "dump_sites",
    "inbox_messages",
    "quarries",
    "aliases",
  ];
  const data = {};
  for (const s of stores) data[s] = (await db.getAll(s)) || [];
  return data;
}

// ================= DASHBOARD =================
async function dashboard(ctx) {
  const { root, db, names } = ctx;
  const today = todayStr();
  const data = await loadAll(db);
  const sum = daySummary(today, data);
  const lastBackup = await db.metaGet("last_backup_at");
  const alerts = smartAlerts(data, { today, lastBackupAt: lastBackup });
  // Akşam (17:00 sonrası) gün kapatılmadıysa: eksik sayısı ana sayfada
  let dayCloseOpen = null;
  if (new Date().getHours() >= 17 && (await db.metaGet("day_closed"))?.date !== today) {
    const attCount = {};
    for (const a of await db.getAll("attachments")) attCount[a.record_type + ":" + a.record_id] = (attCount[a.record_type + ":" + a.record_id] || 0) + 1;
    dayCloseOpen = (await import("./day-close-core.js")).dayCloseChecks(data, { date: today, attCount }).warns;
  }
  const board = todayBoard(data, { today, lastBackupAt: lastBackup, dayCloseOpen, yardSettings: (await db.metaGet("yard_settings")) || {}, collectNotes: (await db.metaGet("collect_notes")) || {} });
  const months = monthlySeries(data, { today, months: 6, fuelRefPrice: await db.metaGet("fuel_ref_price") });
  const vsr = vehicleSeries(data, { today, days: 30 }).slice(0, 5);
  const mMax = Math.max(1, ...months.flatMap((m) => [m.work, m.collected, m.cost]));
  const mChart = `<svg class="chart" viewBox="0 0 320 110" role="img" aria-label="Aylık iş değeri, tahsilat ve maliyet">
    ${months.map((m, i) => {
      const x = 10 + i * 51;
      const bar = (v, dx, cls, fill) => { const h = Math.max(v ? 2 : 0, (v / mMax) * 70); return `<rect x="${x + dx}" y="${84 - h}" width="13" height="${h}" rx="2" fill="${fill}"><title>${cls}: ${fmtTL(v)} ₺</title></rect>`; };
      return bar(m.work, 0, "İş değeri (parayla)", "#f5a623") + bar(m.collected, 15, "Tahsilat", "#2e9e6b") + bar(m.cost, 30, "Maliyet", "#d9534f") + `<text x="${x + 21}" y="100" text-anchor="middle" style="font-size:9px;fill:#93a4b5">${m.label}</text>`;
    }).join("")}
  </svg>`;
  const { receivables, workAmount } = await import("./collect-core.js");
  // Kendi depo kısayolu: stok + bu ayın kâr–zararı
  let yardCard = "";
  {
    const yc = await import("./yard-core.js");
    if (yc.yardSite(data) && yc.yardCustomer(data)) {
      const ys = (await db.metaGet("yard_settings")) || {};
      const st = yc.yardStock(data, { settings: ys, today });
      const { dumpFee } = await import("./dump-fees.js");
      const p = yc.yardPL(data, st, { settings: ys, pred: (x) => x.startsWith(today.slice(0, 7)), dumpFee, workAmount });
      yardCard = `<div class="row between tap" data-go="#/kendi-depo"><span class="muted small">🏗 Kendi depo · stok ~${fmtNum(st.total)} kamyonet yükü</span><span class="strong" style="color:${p.result < 0 ? "#d9534f" : "#2e9e6b"}">${p.ins || p.outs ? (p.result < 0 ? "" : "+") + fmtTL(p.result) + " ₺ bu ay" : "aç ›"}</span></div><div class="divider"></div>`;
    } else yardCard = `<div class="row between tap" data-go="#/kendi-depo"><span class="muted small">🏗 Kendi depo / stok sahası</span><span class="muted small">kur ›</span></div><div class="divider"></div>`;
  }
  const recv = receivables(data, { today, notes: (await db.metaGet("collect_notes")) || {} });
  const cur = months[months.length - 1];
  const tank = calcTankBalance(data.fuel_tank_movements);
  const monthFuel = { depo: 0, other: 0 };
  for (const f of (data.fuel_records || []).filter(isActive))
    if (String(f.date).startsWith(today.slice(0, 7))) monthFuel[f.fuel_source === "Depo Tankı" ? "depo" : "other"] += Number(f.liters) || 0;

  // Son 7 gün yakıt grafiği
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const fuelByDay = days.map((d) =>
    data.fuel_records
      .filter((f) => isActive(f) && f.date === d)
      .reduce((s, f) => s + (Number(f.liters) || 0), 0),
  );
  const maxV = Math.max(1, ...fuelByDay);
  const chart = `<svg class="chart" viewBox="0 0 300 74" preserveAspectRatio="none">
    ${fuelByDay
      .map((v, i) => {
        const h = Math.max(3, (v / maxV) * 52);
        const x = 8 + i * 42;
        return `<rect class="bar" x="${x}" y="${58 - h}" width="26" height="${h}" rx="3"/><text x="${x + 13}" y="70" text-anchor="middle">${days[i].slice(8)}.${days[i].slice(5, 7)}</text>${v ? `<text x="${x + 13}" y="${54 - h}" text-anchor="middle" style="fill:#93a4b5">${fmtNum(v)}</text>` : ""}`;
      })
      .join("")}
  </svg>`;

  const works = data.work_records
    .filter((w) => isActive(w) && w.date === today)
    .slice(-3)
    .reverse();
  const openMaint = data.maintenance_records
    .filter((m) => isActive(m) && m.status !== "Tamamlandı")
    .slice(0, 3);
  const pendingCash = data.cash_records.filter(
    (c) =>
      isActive(c) &&
      c.cash_status !== "KASAYA_TESLIM_EDILDI" &&
      (c.cash_type === "Müşteriden Para Alındı" ||
        c.cash_status === "PERSONELDE"),
  );
  const pendingSum = pendingCash.reduce(
    (s, c) => s + (Number(c.amount) || 0),
    0,
  );
  const upcomingMaint = data.vehicles.filter(
    (v) =>
      isActive(v) &&
      v.next_maintenance_date &&
      v.next_maintenance_date <= addDays(today, 14),
  );

  const maintDue = (await import("./maint-core.js")).maintenanceBoard(data, { today }).filter((r) => r.state === "late" || r.state === "soon").slice(0, 5);
  root.innerHTML = `
    <div class="appbar" style="align-items:flex-start">
      <div class="title">
        <h1 style="font-size:20px;letter-spacing:.5px">SAHAPRO</h1>
        <div class="sub">Muratoğlu Hafriyat · <span class="offline-dot${navigator.onLine ? "" : " off"}"></span>${navigator.onLine ? "çevrimiçi" : "çevrimdışı"} · ${trDate(today)}</div>
      </div>
      <button class="iconbtn" data-go="#/ara" aria-label="Ara">⌕</button>
      <button class="iconbtn" data-go="#/ayarlar" aria-label="Ayarlar">⚙</button>
    </div>

    <section class="card assist-hero" aria-label="Akıllı asistan" data-assist-hero>
      <h2 style="margin:0 0 2px;font-size:20px">Ne yapmak istiyorsunuz?</h2>
      <a class="ultimate-home-link" href="#/saha-akisi"><b>Saha Akışı →</b><small>Günün işleri · yakıt · gider · bakım</small></a>
      <button class="ultimate-home-link" data-overview-home data-go="#/isletme-panosu"><b>İşletme Panosu →</b><small>Dönem seç · grafiğe dokun · kaynak kaydı aç</small></button>
      <div class="small muted" style="margin-bottom:8px">Yazın veya söyleyin — asistan kontrol kartı hazırlar, siz onaylamadan kayıt yazılmaz.</div>
      <textarea data-hero-msg rows="2" placeholder="Örn: 34 KM 101 Kaya İnşaat 4 sefer moloz · Kaya'dan 20 bin tahsil ettim" style="width:100%;font-size:16px"></textarea>
      <button class="btn primary block" data-hero-go style="margin-top:8px">🤖 Asistana gönder</button>
      <div class="assist-chips" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px">
        <button class="btn sm" data-go="#/akilli-asistan?yapistir=1">📋 Mesaj yapıştır</button>
        <button class="btn sm" data-go="#/akilli-asistan?mic=1">🎤 Sesle anlat</button>
        <button class="btn sm" data-go="#/akilli-asistan?foto=1">📷 Fiş / fotoğraf</button>
        <button class="btn sm" data-go="#/isler/new">⚒ İş ekle</button>
        <button class="btn sm" data-go="#/finans/kasa/new">💰 Tahsilat gir</button>
        <button class="btn sm" data-go="#/akilli-asistan/soru">📊 Rapor sor</button>
      </div>
      <div class="tiny muted" style="margin-top:6px">${navigator.onLine ? "Asistan, gönderdiğinizde Gemini'ye bağlanır (günlük sınır geçerli). Formlar ve kayıtlar internetsiz de çalışır." : "Çevrimdışı: yazdığınız metin asistanda bekler; Gemini için internet gerekir. Formlar ve kayıtlar internetsiz çalışır."}</div>
    </section>

    <div data-brief style="margin-top:12px"></div>
    <div data-yonetim></div>
    ${board.items.length ? `<div class="section-title" style="margin-top:12px">Bugün Dikkat <span class="muted small">${board.alerts ? board.alerts + " acil" : ""}</span></div>` + board.items.slice(0, 6).map((i) => li({ ic: i.ic, href: i.href, t1: esc(i.text), t2: esc(i.sub || ""), end: i.amount ? `<div class="amt">${fmtTL(i.amount)} ₺</div>` : "", badgeHtml: i.kind === "alert" ? '<span class="badge danger">Acil</span>' : "" })).join("") + (board.items.length > 6 ? `<div class="card tap" data-board-all><div class="row between"><span class="small">+${board.items.length - 6} madde daha</span><span class="muted small">tümü ›</span></div></div>` : "") : ""}
    ${alerts.length ? `<div class="card tap" data-alerts><div class="row between"><div class="row"><span style="font-size:18px">⚠</span><span class="strong">${alerts.length} uyarı</span></div><span class="muted small">göster ›</span></div></div>` : ""}

    <div class="section-title" style="margin-top:12px">Bugün <span class="muted small">${trDate(today)}</span></div>
    <div class="statgrid">
      ${stat(fmtNum(sum.work_count), "İş")}
      ${stat(fmtNum(sum.slip_count), "Fiş")}
      ${stat(fmtNum(sum.total_sefer), "Sefer")}
      ${stat(fmtNum(sum.total_saat), "Saat")}
      ${stat(fmtNum(sum.fuel_liters), "Yakıt L (bugün)", sum.fuel_liters ? "accent" : "")}
      ${stat(fmtTL(sum.expense_total), "Gider ₺", sum.expense_total ? "warn" : "")}
      ${stat(fmtTL(sum.tahsilat_total), "Tahsilat ₺", sum.tahsilat_total ? "ok" : "")}
      ${stat(fmtNum(sum.open_breakdowns), "Açık Arıza", sum.open_breakdowns ? "danger" : "")}
    </div>

    <div class="quickgrid">
      <button data-go="#/isler/new"><span class="ic">⚒</span>İş</button>
      <button data-go="#/fisler/new"><span class="ic">🧾</span>Fiş</button>
      <button data-go="#/yakit/new"><span class="ic">⛽</span>Yakıt</button>
      <button data-go="#/gider/new"><span class="ic">💸</span>Gider</button>
      <button data-go="#/finans/kasa/new"><span class="ic">💰</span>Tahsilat</button>
      <button data-go="#/bakim/new"><span class="ic">🔧</span>Arıza</button>
    </div>
    <button class="btn primary block" style="margin-top:10px" data-go="#/akilli-asistan">🤖 Akıllı Asistan — mesaj veya fiş fotoğrafından kayıt</button>
    <button class="btn block" style="margin-top:8px" data-go="#/whatsapp-toplu">💬 WhatsApp grubu — günün mesajlarını toplu işle</button>

    <div class="row between" style="margin-top:14px"><div class="section-title" style="margin:0">Bugünkü Son İşler</div><button class="btn sm ghost" data-go="#/isler">tümü ›</button></div>
    ${
      works.length
        ? works
            .map((w) =>
              li({
                ic: "⚒",
                href: "#/isler/" + w.id,
                t1: `${esc(names.customers[w.customer_id] || "—")} · ${esc(w.work_type || "İş")}`,
                t2: `${esc(names.vehicles[w.vehicle_id] || "—")} — ${esc(names.personnel[w.personnel_id] || "—")}`,
                end: `<div class="amt">${fmtNum(w.quantity)} ${esc(w.unit || "")}</div>`,
              }),
            )
            .join("")
        : emptyState(
            "⚒",
            "Bugün henüz iş kaydı yok",
            '<button class="btn primary" data-go="#/isler/new">+ İş Kaydı</button>',
          )
    }

    ${
      openMaint.length
        ? `<div class="section-title">Açık Arızalar</div>` +
          openMaint
            .map((m) =>
              li({
                ic: "🔧",
                href: "#/bakim/" + m.id,
                t1: esc(names.vehicles[m.vehicle_id] || "—"),
                t2: esc(m.description || m.maint_type || ""),
                badgeHtml: statusBadge(m.status || "Açık"),
              }),
            )
            .join("")
        : ""
    }

    <div class="card" style="margin-top:12px">
      <div class="row between tap" data-go="#/tahsilat"><span class="muted small">💰 Müşteriden alacak${recv.buckets.b90 ? ` <span class="badge danger">90+ gün ${fmtTL(recv.buckets.b90)} ₺</span>` : recv.buckets.b60 ? ` <span class="badge warn">60+ gün ${fmtTL(recv.buckets.b60)} ₺</span>` : ""}</span><span class="strong">${fmtTL(recv.total)} ₺ ›</span></div>
      <div class="divider"></div>
      <div class="row between"><span class="muted small">Kasada/Personelde Bekleyen</span><span class="amt ${pendingSum ? "badge warn" : ""}">${fmtTL(pendingSum)} ₺</span></div>
      <div class="divider"></div>
      ${yardCard}
      <div class="row between tap" data-go="#/yakit"><span class="muted small">Bu ay verilen yakıt</span><span class="strong">${fmtNum(monthFuel.depo + monthFuel.other)} Lt${monthFuel.depo && monthFuel.other ? ` <span class="muted small">(depodan ${fmtNum(monthFuel.depo)})</span>` : ""}</span></div>
      <div class="divider"></div>
      <div class="row between tap" data-go="#/depo"><span class="muted small">Depo Yakıt (tahmini)</span><span class="strong">${fmtNum(tank.remaining)} Lt</span></div>
    </div>

    ${upcomingMaint.length || maintDue.length ? `<div class="section-title">Bakım Uyarıları</div>` + maintDue.map((r) => li({ ic: r.state === "late" ? "🔴" : "🟠", href: "#/bakim-takvimi/" + r.v.id, t1: esc(r.v.name + " · " + r.rule.title), t2: esc(r.text) })).join("") + upcomingMaint.map((v) => li({ ic: "🛠", href: "#/filo/" + v.id, t1: esc(v.name), t2: `Sonraki bakım: ${trDate(v.next_maintenance_date)}` })).join("") : ""}

    <div class="section-title">Aylık Özet — son 6 ay</div>
    <div class="card">${mChart}
      <div class="row small" style="gap:12px;margin-top:4px"><span><b style="color:#f5a623">■</b> İş değeri</span><span><b style="color:#2e9e6b">■</b> Tahsilat</span><span><b style="color:#d9534f">■</b> Maliyet</span></div>
      <div style="margin-top:8px">${kv("Bu ay iş değeri", fmtTL(cur.work) + " ₺")}${cur.fuelPayL || cur.fuelGotL ? kv("Mazot karşılığı işler (TL sayılmaz)", fmtNum(cur.fuelPayL) + " L hak edildi · " + fmtNum(cur.fuelGotL) + " L alındı") : ""}${kv("Bu ay tahsilat", fmtTL(cur.collected) + " ₺")}${kv("Bu ay kayıtlı maliyet", fmtTL(cur.cost) + " ₺")}${kv("Tahmini kâr (iş değeri − maliyet)", fmtTL(cur.profit) + " ₺")}</div>
      ${cur.unpriced ? `<div class="muted tiny" style="margin-top:6px">⚠ Bu ay ${cur.unpriced} işin fiyatı yok; iş değeri eksik hesaplanır.</div>` : ""}
    </div>
    ${vsr.length ? `<div class="section-title">Araç Başına — son 30 gün</div>` + vsr.map((v) => li({ ic: "🚚", t1: esc(v.name), t2: `${v.works} iş · ${fmtNum(v.liters)} Lt yakıt`, end: `<div class="amt">${fmtTL(v.cost)} ₺</div>` })).join("") : ""}
    <div class="section-title">Son 7 Gün — Yakıt (Lt)</div>
    <div class="card">${chart}</div>

    <div class="row" style="gap:8px;margin-top:14px">
      <button class="btn primary grow" data-go="#/gunsonu">🌙 Günü Kapat</button>
      <button class="btn grow" data-go="#/yonetici">📊 Yönetici</button>
    </div>`;

  // Ana ekrandaki asistan alanı: metin asistana taşınır ve oradan gönderilir (ekran açılışında yapay zekâ çağrısı yok)
  qs("[data-hero-go]", root)?.addEventListener("click", () => {
    const t = qs("[data-hero-msg]", root).value.trim();
    if (!t) { qs("[data-hero-msg]", root).focus(); return toast("Ne yapmak istediğinizi yazın ya da 🎤 Sesle anlat'a dokunun", "err"); }
    try { sessionStorage.setItem("sp_hero_msg", t); } catch (e) {}
    location.hash = "#/akilli-asistan?hazir=1";
  });
  // Yönetim özeti: dikkat isteyen işler (mevcut denetimlerden), son 14 gün, araçlar (birimler ayrı), mazot anlaşmaları (litre)
  try {
    const A = await import("./attention.js");
    const { RESTORE_SET } = await import("./backup.js");
    const reviewMeta=await db.getAll("meta");
    const yb = qs("[data-yonetim]", root);
    const items = A.attentionItems(data, { meta:reviewMeta, restoreSets:reviewMeta.filter(m=>m.key.startsWith(RESTORE_SET)).map(m=>m.value) });
    const days = A.dailyWorks(data, today, 14), max = Math.max(1, ...days.map((x) => x.count));
    const mStart = today.slice(0, 8) + "01", veh = A.vehicleSummary(data, mStart, today).slice(0, 8), fuel = A.fuelSummaries(data);
    const n1 = (x) => Number(x || 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
    const tr2 = (s) => s.slice(8, 10) + "." + s.slice(5, 7);
    yb.innerHTML =
      (items.length ? `<div class="section-title" style="margin-top:12px">Dikkat isteyen işler</div>` + items.map((i) => `<div class="card tap" data-go="${esc(i.hash)}" data-attn="${esc(i.key)}" style="padding:10px 12px"><div class="strong small">${esc(i.title)} ›</div><div class="tiny muted">Neden: ${esc(i.why)}</div><div class="tiny">Sonraki adım: ${esc(i.next)}</div></div>`).join("") : "") +
      `<div class="section-title" style="margin-top:12px">Son 14 gün — günlük iş sayısı <span class="muted small">(dokunun: o günün işleri)</span></div>
      <div class="card" style="padding:10px"><div data-daychart style="display:grid;grid-template-columns:repeat(14,minmax(0,1fr));gap:3px;align-items:end;height:110px">${days.map((x) => `<button data-go="#/isler?from=${x.date}&to=${x.date}" aria-label="${tr2(x.date)}: ${x.count} iş${Object.keys(x.units).length ? " (" + Object.entries(x.units).map(([u, q]) => n1(q) + " " + u.toLocaleLowerCase("tr-TR")).join(", ") + ")" : ""}" title="${tr2(x.date)}: ${x.count} iş" style="border:0;padding:0;background:transparent;height:100%;display:flex;flex-direction:column;justify-content:flex-end;cursor:pointer"><span class="tiny" style="text-align:center">${x.count || ""}</span><span style="display:block;background:var(--brand-orange,#f5a623);border-radius:3px 3px 0 0;height:${Math.round((x.count / max) * 80)}px;min-height:${x.count ? 3 : 0}px"></span></button>`).join("")}</div>
      <div style="display:grid;grid-template-columns:repeat(14,minmax(0,1fr));gap:3px" class="tiny muted">${days.map((x, i) => `<span style="text-align:center">${i % 2 ? "" : tr2(x.date).slice(0, 2)}</span>`).join("")}</div>
      <div class="tiny muted">Çubuk: iş SAYISI. Saat, sefer ve ton ayrı birimlerdir; toplanmaz (çubuğa dokununca o günün işleri açılır).</div></div>` +
      (veh.length ? `<div class="section-title" style="margin-top:12px">Araçlar — bu ay <span class="muted small">(birimler ayrı)</span></div><div class="card" style="padding:6px 10px;overflow-x:auto"><table class="tiny" style="width:100%;border-collapse:collapse"><tr class="muted"><th style="text-align:left">Araç</th><th>İş</th><th>Saat</th><th>Sefer</th><th>Yevmiye</th><th>Ton</th></tr>${veh.map((v) => `<tr data-go="#/filo/${esc(v.id)}" style="cursor:pointer;border-top:1px solid var(--border)"><td style="text-align:left;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.name)}</td><td style="text-align:center">${v.works}</td><td style="text-align:center">${v.Saat ? n1(v.Saat) : "—"}</td><td style="text-align:center">${v.Sefer ? n1(v.Sefer) : "—"}</td><td style="text-align:center">${v.Yevmiye ? n1(v.Yevmiye) : "—"}</td><td style="text-align:center">${v.Ton ? n1(v.Ton) : "—"}</td></tr>`).join("")}</table></div>` : "") +
      (fuel.length ? `<div class="section-title" style="margin-top:12px">Mazot anlaşmaları <span class="muted small">(litre; TL bakiyeye dahil değil)</span></div>` + fuel.map((f) => `<div class="li" data-go="#/musteriler/${esc(f.id)}"><div class="grow"><div class="t1 ellipsis">${esc(f.name)}</div><div class="t2">Hak edilen ${n1(f.earned)} L · Alınan ${n1(f.received)} L</div></div><div class="end"><span class="amt">${f.balance >= 0 ? "Kalan " + n1(f.balance) : "Fazla " + n1(-f.balance)} L</span></div></div>`).join("") : "");
  } catch (e) { console.warn(e);const target=qs("[data-yonetim]",root);if(target)target.innerHTML=notice("warn","Kontrol listesi yüklenemedi. Sayfayı yeniden açın."); }
  {
    const bh = qs("[data-brief]", root);
    if (bh) (await import("./brief.js")).briefCard({ ...ctx, toast }, bh, data).catch((e) => console.warn(e));
  }
  const al = qs("[data-alerts]", root);
  if (al) al.addEventListener("click", () => showAlerts(ctx, alerts));
  qs("[data-board-all]", root)?.addEventListener("click", () =>
    showAlerts(ctx, board.items.map((i) => ({ kind: i.kind, text: i.text + (i.sub ? " — " + i.sub : ""), href: i.href })), "Bugün Dikkat"));
}

// Uyarının ilgili kaydı / bölümü
export function alertHref(a) {
  if (a?.href) return a.href;
  const r = a?.ref || {};
  const id = r.id ? "/" + encodeURIComponent(r.id) : "";
  const map = { work: "#/isler", expense: "#/gider", fuel: "#/yakit", maintenance: "#/bakim", cash: "#/kasa", vehicle: "#/filo", document: "#/belgeler", customer: "#/musteriler", supplier: "#/esnaf" };
  if (r.type === "settings") return "#/ayarlar?tab=yedek";
  if (r.type === "tank") return "#/depo";
  return map[r.type] ? map[r.type] + id : null;
}
function showAlerts(ctx, alerts, title = "Akıllı Uyarılar") {
  const sh = sheet(
    `<h3>${esc(title)} (${alerts.length})</h3><div class="muted tiny" style="margin-bottom:6px">Uyarıya dokunun → ilgili kayda gider.</div>` +
      alerts
        .map((a, i) => {
          const href = alertHref(a);
          return `<div class="notice ${a.kind === "alert" ? "danger" : a.kind === "warn" ? "warn" : "info"} ${href ? "tap" : ""}" style="margin-bottom:7px;${href ? "cursor:pointer" : ""}" ${href ? `data-alert-go="${esc(href)}" role="button" tabindex="0"` : ""}><span>${a.kind === "alert" ? "⛔" : a.kind === "warn" ? "⚠" : "ℹ"}</span><span style="flex:1">${esc(a.text)}</span>${href ? '<span class="muted">›</span>' : ""}</div>`;
        })
        .join(""),
  );
  const open = async (href) => {
    const { sheetClose } = await import("./ui.js");
    sheetClose(true);
    location.hash = href;
  };
  for (const el of document.querySelectorAll("[data-alert-go]")) {
    el.addEventListener("click", () => open(el.dataset.alertGo));
    el.addEventListener("keydown", (e) => { if (e.key === "Enter") open(el.dataset.alertGo); });
  }
  return sh;
}

// ================= GÜN SONU =================
async function dayClose(ctx) {
  const { root, db, names } = ctx;
  const today = todayStr();
  const data = await loadAll(db);
  const sum = daySummary(today, data);
  const alerts = smartAlerts(data, {
    today,
    lastBackupAt: await db.metaGet("last_backup_at"),
  });
  // Eksik avcısı: bugün eksik kalanlar + biriken açıklar (her madde ilgili kayda gider)
  const attCount = {};
  for (const a of await db.getAll("attachments")) attCount[a.record_type + ":" + a.record_id] = (attCount[a.record_type + ":" + a.record_id] || 0) + 1;
  const { dayCloseChecks } = await import("./day-close-core.js");
  const chk = dayCloseChecks(data, { date: today, attCount });
  const closed = await db.metaGet("day_closed");
  const KIND = { alert: "#d9534f", warn: "#e0a030", info: "#9aa4b2" };
  const itemHtml = (i) => `<div class="card${i.href ? " tap" : ""}" ${i.href ? `data-go="${esc(i.href)}"` : ""} style="border-left:4px solid ${KIND[i.kind]};padding:10px 12px"><div class="row between"><b class="small">${esc(i.text)}</b>${i.href ? '<span class="muted">›</span>' : ""}</div>${i.sub ? `<div class="tiny muted" style="margin-top:2px">${esc(i.sub)}</div>` : ""}</div>`;
  const groups = ["Bugün", "Biriken"].map((g) => [g, chk.items.filter((i) => i.group === g)]).filter(([, xs]) => xs.length);

  root.innerHTML =
    appbar("Günü Kapat", trDate(today)) +
    `
    <div class="statgrid" style="margin-top:8px">
      ${stat(fmtNum(sum.work_count), "İş")}${stat(fmtNum(sum.total_sefer), "Sefer")}${stat(fmtNum(sum.total_saat), "Saat")}${stat(fmtNum(sum.total_yevmiye), "Yevmiye")}
      ${stat(fmtNum(sum.fuel_liters), "Yakıt L")}${stat(fmtTL(sum.expense_total), "Gider ₺")}${stat(fmtTL(sum.tahsilat_total), "Tahsilat ₺")}${stat(fmtNum(sum.personnel_active), "Personel")}
    </div>
    ${sum.slip_count ? `<div class="row" style="margin-bottom:8px">${badge(sum.slip_count + " dijital fiş", "ok")}</div>` : ""}
    ${closed?.date === today ? notice("ok", `Gün kapatıldı (${new Date(closed.at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}${closed.open ? ` · ${closed.open} madde açık bırakıldı` : ""})`) : ""}
    ${groups.length ? groups.map(([g, xs]) => `<div class="section-title">${g === "Bugün" ? "Bugün eksik kalanlar" : "Biriken açıklar"} (${xs.length})</div>` + xs.map(itemHtml).join("")).join("") : notice("ok", "Eksik bulunamadı — gün temiz.")}
    <button class="btn primary block" data-close style="margin:10px 0">🌙 ${chk.warns ? `Günü kapat (${chk.warns} madde açık kalacak)` : "Günü kapat"}</button>
    <div style="height:60px"></div>
    <div class="actionbar">
      <button class="btn" data-wa>📱 WhatsApp</button>
      <button class="btn" data-pdf>🖨 PDF</button>
      <button class="btn primary" data-backup>💾 Yedekle</button>
    </div>`;

  qs("[data-close]", root).addEventListener("click", async () => {
    await db.metaSet("day_closed", { date: today, at: new Date().toISOString(), open: chk.warns });
    toast("Gün kapatıldı", "ok"); ctx.reload();
  });
  qs("[data-wa]", root).addEventListener("click", async () => {
    const txt = buildWhatsAppText(today, data, names);
    await shareText(txt);
  });
  qs("[data-pdf]", root).addEventListener("click", async () => {
    const pdf = await import("./pdf.js");
    await pdf.dailyReportPdf(today, data, names);
  });
  qs("[data-backup]", root).addEventListener("click", async () => {
    const crm = await import("./m-crm.js");
    await crm.doBackup(ctx);
  });
}

// ================= YÖNETİCİ =================
async function manager(ctx) {
  const { root, db, names } = ctx;
  const today = todayStr();
  const data = await loadAll(db);
  const sum = daySummary(today, data);
  const pendingCash = data.cash_records
    .filter((c) => isActive(c) && c.cash_status === "PERSONELDE")
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const { customerBalances } = await import("./collect-core.js");
  const cariByCust = customerBalances(data).bal;
  const alacaklar = Object.entries(cariByCust)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const machinesToday = [
    ...new Set(
      data.work_records
        .filter((w) => isActive(w) && w.date === today)
        .map((w) => w.vehicle_id),
    ),
  ];

  // Kârlılık (bu ay)
  const from = today.slice(0, 8) + "01";
  const curM = monthlySeries(data, { today, months: 1, fuelRefPrice: await db.metaGet("fuel_ref_price") })[0];

  root.innerHTML =
    appbar("Yönetici Paneli", trDate(today)) +
    `
    <div class="section-title">Bugün ne yaptık?</div>
    <div class="card">
      ${kv("İş kaydı", fmtNum(sum.work_count) + " adet")}
      ${kv(
        "Çalışan makine/araç",
        fmtNum(machinesToday.length) +
          " — " +
          (machinesToday
            .map((id) => names.vehicles[id])
            .filter(Boolean)
            .slice(0, 4)
            .join(", ") || "—"),
      )}
      ${kv("Sefer / Saat / Yevmiye", `${fmtNum(sum.total_sefer)} / ${fmtNum(sum.total_saat)} / ${fmtNum(sum.total_yevmiye)}`)}
      ${kv("Yakıt", fmtNum(sum.fuel_liters) + " Lt")}
      ${kv("Gider", fmtTL(sum.expense_total) + " ₺")}
      ${kv("Tahsilat", fmtTL(sum.tahsilat_total) + " ₺")}
      ${kv("Personelde para", fmtTL(pendingCash) + " ₺")}
      ${kv("Açık arıza", fmtNum(sum.open_breakdowns) + " adet")}
    </div>
    <div class="section-title">Müşteriden Alacak (cari)</div>
    ${alacaklar.length ? alacaklar.map(([cid, v]) => li({ ic: "🏢", href: "#/cari/" + cid, t1: esc(names.customers[cid] || "—"), end: `<span class="amt">${fmtTL(v)} ₺</span>` })).join("") : emptyState("🏢", "Açık alacak yok")}
    <div class="section-title">Tahmini Operasyon Sonucu — Bu Ay</div>
    <div class="card">
      <div class="tiny muted" style="margin-bottom:6px">Muhasebe net kârı değildir; saha verilerinden tahmindir.</div>
      ${kv("İş değeri (parayla ödenen fiyatlı işler)", fmtTL(curM.work) + " ₺")}
      ${curM.fuelPayL || curM.fuelGotL ? kv("Mazot karşılığı işler (TL sayılmaz)", fmtNum(curM.fuelPayL) + " L hak edildi · " + fmtNum(curM.fuelGotL) + " L alındı") : ""}
      ${kv("Yakıt", fmtTL(curM.fuel) + " ₺")}
      ${kv("Gider", fmtTL(curM.expense) + " ₺")}
      ${kv("Bakım/Arıza", fmtTL(curM.maint) + " ₺")}
      ${kv("Esnaf alışı", fmtTL(curM.esnaf) + " ₺")}
      ${curM.dump ? kv("Döküm ücreti", fmtTL(curM.dump) + " ₺") : ""}
      ${curM.pay ? kv("Personel maaşı (kapatılan aylar)", fmtTL(curM.pay) + " ₺") : ""}
      <div class="divider"></div>
      ${kv("TAHMİNİ SONUÇ", fmtTL(curM.profit) + " ₺")}
      ${curM.unpriced ? `<div class="muted tiny">⚠ ${curM.unpriced} işin fiyatı yok; sonuç eksik olabilir.</div>` : ""}
    </div>`;
}

// ================= RAPORLAR =================
const REPORTS = [
  { v: "gunluk", t: "Günlük İş" },
  { v: "musteri", t: "Müşteri" },
  { v: "santiye", t: "Şantiye" },
  { v: "arac", t: "Araç/Makine" },
  { v: "personel", t: "Personel" },
  { v: "yakit", t: "Yakıt" },
  { v: "gider", t: "Gider" },
  { v: "bakim", t: "Bakım" },
  { v: "kasa", t: "Kasa" },
  { v: "cari", t: "Cari" },
  { v: "hakedis", t: "Hakediş" },
  { v: "taseron", t: "Taşeron" },
];
async function reports(ctx) {
  const { root, db, names, query } = ctx;
  const type = query.type || "gunluk";
  const data = await loadAll(db);
  const today = todayStr();
  const f = {
    from: query.from || (type === "gunluk" ? today : today.slice(0, 8) + "01"),
    to: query.to || today,
    customer_id: query.customer_id || "",
    site_id: query.site_id || "",
    vehicle_id: query.vehicle_id || "",
    personnel_id: query.personnel_id || "",
  };
  const inR = (d) => d >= f.from && d <= f.to;
  const match = (r) =>
    inR(r.date || "") &&
    (!f.customer_id || r.customer_id === f.customer_id) &&
    (!f.site_id || r.site_id === f.site_id) &&
    (!f.vehicle_id || r.vehicle_id === f.vehicle_id) &&
    (!f.personnel_id || r.personnel_id === f.personnel_id);

  const nm = (s, id) => names[s][id] || "—";
  let rows = [],
    total = null,
    headers = [],
    title = REPORTS.find((r) => r.v === type).t;

  if (
    type === "gunluk" ||
    type === "musteri" ||
    type === "santiye" ||
    type === "arac"
  ) {
    const ws = data.work_records
      .filter(isActive)
      .filter(match)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    headers = ["Tarih", "Müşteri", "Şantiye", "Araç", "İş", "Miktar", "Birim"];
    rows = ws.map((w) => [
      trDate(w.date),
      nm("customers", w.customer_id),
      nm("sites", w.site_id),
      nm("vehicles", w.vehicle_id),
      w.work_type || "İş",
      fmtNum(w.quantity),
      w.unit || "",
    ]);
    const sefer = ws
      .filter((w) => w.unit === "Sefer")
      .reduce((s, w) => s + (Number(w.quantity) || 0), 0);
    const saat = ws
      .filter((w) => w.unit === "Saat")
      .reduce((s, w) => s + (Number(w.quantity) || 0), 0);
    const yev = ws
      .filter((w) => w.unit === "Yevmiye")
      .reduce((s, w) => s + (Number(w.quantity) || 0), 0);
    total = `${ws.length} iş · ${fmtNum(sefer)} sefer · ${fmtNum(saat)} saat · ${fmtNum(yev)} yevmiye`;
  } else if (type === "yakit") {
    const xs = data.fuel_records.filter(isActive).filter(match);
    headers = ["Tarih", "Araç", "Personel", "Litre", "Tutar", "Kaynak"];
    rows = xs.map((x) => [
      trDate(x.date),
      nm("vehicles", x.vehicle_id),
      nm("personnel", x.personnel_id),
      fmtNum(x.liters),
      x.total ? fmtTL(x.total) + " ₺" : "—",
      x.fuel_source || "",
    ]);
    total = `${xs.reduce((s, x) => s + (Number(x.liters) || 0), 0)} Lt · ${fmtTL(xs.reduce((s, x) => s + (Number(x.total) || 0), 0))} ₺`;
  } else if (type === "gider") {
    const xs = data.expense_records.filter(isActive).filter(match);
    headers = ["Tarih", "Kategori", "Personel", "Tutar", "Ödeme", "Açıklama"];
    rows = xs.map((x) => [
      trDate(x.date),
      x.category || "",
      nm("personnel", x.personnel_id),
      fmtTL(x.amount) + " ₺",
      x.payment_method || "",
      x.description || "",
    ]);
    total = fmtTL(xs.reduce((s, x) => s + (Number(x.amount) || 0), 0)) + " ₺";
  } else if (type === "bakim") {
    const xs = data.maintenance_records.filter(isActive).filter(match);
    headers = ["Tarih", "Araç", "Tür", "Durum", "Maliyet", "Açıklama"];
    rows = xs.map((x) => [
      trDate(x.date),
      nm("vehicles", x.vehicle_id),
      x.maint_type || "",
      x.status || "",
      x.cost ? fmtTL(x.cost) + " ₺" : "—",
      x.description || "",
    ]);
    total = fmtTL(xs.reduce((s, x) => s + (Number(x.cost) || 0), 0)) + " ₺";
  } else if (type === "kasa") {
    const xs = data.cash_records.filter(isActive).filter(match);
    headers = ["Tarih", "Tür", "Tutar", "Personel", "Müşteri", "Durum"];
    rows = xs.map((x) => [
      trDate(x.date),
      x.cash_type || "",
      fmtTL(x.amount) + " ₺",
      nm("personnel", x.personnel_id),
      nm("customers", x.customer_id),
      x.cash_status || "",
    ]);
  } else if (type === "cari") {
    const xs = data.cari_movements
      .filter(isActive)
      .filter(
        (m) =>
          inR(m.date || "") &&
          (!f.customer_id || m.customer_id === f.customer_id),
      );
    headers = ["Tarih", "Müşteri", "Tür", "Tutar", "Açıklama"];
    rows = xs.map((x) => [
      trDate(x.date),
      nm("customers", x.customer_id),
      x.type,
      (x.amount > 0 ? "+" : "") + fmtTL(x.amount) + " ₺",
      x.reason || x.note || "",
    ]);
    total =
      "Bakiye: " +
      fmtTL(xs.reduce((s, x) => s + (Number(x.amount) || 0), 0)) +
      " ₺";
  } else if (type === "hakedis") {
    const xs = data.hakedis
      .filter(isActive)
      .filter((h) => !f.customer_id || h.customer_id === f.customer_id);
    headers = ["No", "Müşteri", "Dönem", "Durum", "Toplam"];
    rows = xs.map((x) => [
      "#" + String(x.hakedis_no || 0).padStart(6, "0"),
      nm("customers", x.customer_id),
      `${trDate(x.date_from)}–${trDate(x.date_to)}`,
      x.status,
      fmtTL(x.grand_total) + " ₺",
    ]);
    total =
      fmtTL(
        xs
          .filter((x) => x.status === "Kesinleşti")
          .reduce((s, x) => s + (Number(x.grand_total) || 0), 0),
      ) + " ₺ (kesinleşen)";
  } else if (type === "personel") {
    const ws = data.work_records.filter(isActive).filter(match);
    const ev = data.personnel_events.filter(isActive).filter(match);
    const byP = {};
    for (const w of ws) {
      const k = w.personnel_id || "-";
      byP[k] = byP[k] || { is: 0, saat: 0, sefer: 0, yev: 0 };
      byP[k].is++;
      byP[k][
        w.unit === "Saat" ? "saat" : w.unit === "Sefer" ? "sefer" : "yev"
      ] += Number(w.quantity) || 0;
    }
    headers = ["Personel", "İş", "Sefer", "Saat", "Yevmiye", "Hareket"];
    rows = Object.entries(byP).map(([pid, v]) => [
      nm("personnel", pid),
      v.is,
      fmtNum(v.sefer),
      fmtNum(v.saat),
      fmtNum(v.yev),
      ev.filter((e) => e.personnel_id === pid).length,
    ]);
  } else if (type === "taseron") {
    const vehs = data.vehicles.filter(
      (v) => isActive(v) && v.ownership === "Taşeron",
    );
    const ids = new Set(vehs.map((v) => v.id));
    const ws = data.work_records
      .filter(isActive)
      .filter((w) => ids.has(w.vehicle_id) && match(w));
    headers = ["Tarih", "Araç", "İş", "Miktar", "Birim"];
    rows = ws.map((w) => [
      trDate(w.date),
      nm("vehicles", w.vehicle_id),
      w.work_type || "",
      fmtNum(w.quantity),
      w.unit || "",
    ]);
  }

  const q = (query.q || "").toLocaleLowerCase("tr-TR");
  const frows = q
    ? rows.filter((r) => r.join(" ").toLocaleLowerCase("tr-TR").includes(q))
    : rows;
  const csvName = `sahapro_${type}_${f.from}_${f.to}.csv`;

  root.innerHTML =
    appbar("Rapor Merkezi", "Filtrele · PDF · CSV · Paylaş") +
    `
    <div style="height:10px"></div>
    <div class="card tap" data-go="#/detayli-rapor" style="border-left:4px solid var(--accent)"><div class="row between"><span><b>📑 Detaylı Raporlar</b><br><span class="small muted">Döküm sahası, ocak, müşteri, şantiye, araç, personel, esnaf, yakıt, gider, bakım… seçin; her kaydı ayrıntısıyla görün, kurumsal PDF alın</span></span><span class="muted">›</span></div></div>
    ${segBar(REPORTS, type, (v) => `#/raporlar?type=${v}`)}
    <div class="card">
      <div class="formgrid2">
        <div class="field"><label>Başlangıç</label><input type="date" data-f="from" value="${f.from}"></div>
        <div class="field"><label>Bitiş</label><input type="date" data-f="to" value="${f.to}"></div>
      </div>
      <div class="formgrid2">
        <div class="field"><label>Müşteri</label><select data-f="customer_id"><option value="">Tümü</option>${data.customers
          .filter(isActive)
          .map(
            (c) =>
              `<option value="${c.id}" ${c.id === f.customer_id ? "selected" : ""}>${esc(c.name)}</option>`,
          )
          .join("")}</select></div>
        <div class="field"><label>Araç</label><select data-f="vehicle_id"><option value="">Tümü</option>${data.vehicles
          .filter(isActive)
          .map(
            (c) =>
              `<option value="${c.id}" ${c.id === f.vehicle_id ? "selected" : ""}>${esc(c.name)}</option>`,
          )
          .join("")}</select></div>
      </div>
      ${searchBar("Rapor içinde ara…", query.q || "")}
    </div>
    ${total ? `<div class="row between" style="margin:4px 2px 8px"><span class="section-title" style="margin:0">${esc(title)} (${frows.length})</span><span class="badge accent">${esc(total)}</span></div>` : `<div class="section-title">${esc(title)} (${frows.length})</div>`}
    ${
      frows.length
        ? `<div class="card" style="overflow-x:auto;padding:8px"><table style="width:100%;border-collapse:collapse;font-size:12px">${"<tr>" + headers.map((h) => `<th style="text-align:left;padding:7px 6px;border-bottom:2px solid var(--border2);color:var(--muted);white-space:nowrap">${esc(h)}</th>`).join("") + "</tr>"}${frows
            .slice(0, 200)
            .map(
              (r) =>
                "<tr>" +
                r
                  .map(
                    (c) =>
                      `<td style="padding:6px;border-bottom:1px solid var(--border);white-space:nowrap">${esc(c)}</td>`,
                  )
                  .join("") +
                "</tr>",
            )
            .join("")}</table></div>`
        : emptyState("📊", "Bu filtreye uygun kayıt yok")
    }
    <div class="actionbar">
      <button class="btn" data-csv>CSV</button>
      <button class="btn" data-pdf>🖨 PDF</button>
      <button class="btn" data-share>Paylaş</button>
    </div>`;

  const applyFilters = () => {
    const nf = {};
    for (const e of qsa("[data-f]", root)) nf[e.dataset.f] = e.value;
    const qv = qs("[data-search]", root).value;
    ctx.go(
      `#/raporlar?type=${type}&from=${nf.from}&to=${nf.to}&customer_id=${nf.customer_id || ""}&vehicle_id=${nf.vehicle_id || ""}${qv ? "&q=" + encodeURIComponent(qv) : ""}`,
    );
  };
  for (const e of qsa("[data-f]", root))
    e.addEventListener("change", applyFilters);
  let st;
  qs("[data-search]", root).addEventListener("input", () => {
    clearTimeout(st);
    st = setTimeout(applyFilters, 450);
  });

  qs("[data-csv]", root).addEventListener("click", () => {
    const bom = "﻿";
    downloadBlob(
      new Blob([bom + toCSV(headers, frows)], {
        type: "text/csv;charset=utf-8",
      }),
      csvName,
    );
    toast("CSV indirildi", "ok");
  });
  qs("[data-pdf]", root).addEventListener("click", async () => {
    const pdf = await import("./pdf.js");
    await pdf.tableReportPdf(
      `${title} Raporu — ${trDate(f.from)} / ${trDate(f.to)}`,
      headers,
      frows,
      total,
      `SAHAPRO_${type}_${f.from}_${f.to}.pdf`,
    );
  });
  qs("[data-share]", root).addEventListener("click", async () => {
    const txt =
      `${title} (${trDate(f.from)}–${trDate(f.to)})\n` +
      frows
        .slice(0, 40)
        .map((r) => r.join(" | "))
        .join("\n") +
      (total ? `\n${total}` : "");
    await shareText(txt);
  });
}

// ================= DAHA FAZLA =================
async function more(ctx) {
  const { root } = ctx;
  const items = [
    ["#/sozlesmeler", "▤", "Sözleşme Belgeleri"],
    ["#/dokum", "▱", "Döküm Sahaları"],
    ["#/ocak", "▱", "Malzeme Ocakları"],
    ["#/yakit", "⛽", "Yakıt"],
    ["#/depo", "🛢", "Depo Tankı"],
    ["#/filo", "🚜", "Filo"],
    ["#/bakim", "🔧", "Bakım"],
    ["#/yedek-parca", "🔋", "Yedek Parça / Garanti"],
    ["#/bakim-takvimi", "🗓", "Bakım Takvimi"],
    ["#/personel", "👷", "Personel"],
    ["#/puantaj", "📅", "Puantaj / Maaş"],
    ["#/izinler", "🏖", "İzinler"],
    ["#/sofor-kur", "📲", "Şoför Bağlantısı"],
    ["#/taseron", "🤝", "Taşeron"],
    ["#/musteriler", "🏢", "Müşteriler"],
    ["#/santiyeler", "📍", "Şantiyeler"],
    ["#/is-sozlesmeleri", "📐", "İş Sözleşmeleri"],
    ["#/malzeme-katsayilari", "⚖", "Malzeme Katsayıları"],
    ["#/raporlar", "📊", "Raporlar"],
    ["#/detayli-rapor", "📑", "Detaylı Raporlar"],
    ["#/nakit", "📈", "Nakit Tahmini"],
    ["#/dokum-hesap", "💳", "Ortak Döküm Hesapları"],
    ["#/fiyat-saglik", "🩺", "Fiyat Sağlığı"],
    ["#/fatura", "🧾", "Faturalanacaklar"],
    ["#/yonetici", "📈", "Yönetici"],
    ["#/belgeler", "🗂", "Belgeler"],
    ["#/tara", "📷", "Belge Tara"],
    ["#/guvenlik", "🛡", "Güvenlik"],
    ["#/veri-sagligi", "🩺", "Veri Sağlığı"],
    ["#/ayarlar?tab=yedek", "💾", "Yedekleme"],
    ["#/fiyat", "🏷", "Fiyat Listesi"],
    ["#/cop", "🗑", "Çöp Kutusu"],
    ["#/ayarlar", "⚙", "Ayarlar"],
  ];
  root.innerHTML =
    appbar("Daha Fazla", "Tüm modüller") +
    '<a class="ultimate-home-link" href="#/saha-akisi"><b>Saha Akışı →</b><small>Günlük saha kayıtları ve hızlı giriş</small></a>' +
    '<button class="ultimate-home-link" data-go="#/isletme-panosu"><b>İşletme Panosu →</b><small>Grafikler, kayıt kaynakları ve kontrol listesi</small></button>' +
    `
    <div style="height:10px"></div>
    <div class="quickgrid" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      ${items.map(([h, ic, t]) => `<button data-go="${h}" style="aspect-ratio:1.05"><span class="ic">${ic}</span>${t}</button>`).join("")}
    </div>
    <div class="card" style="margin-top:14px">
      ${kv("Sürüm", "SAHAPRO SOLO v3.9.69")}
      ${kv("Veri", "Yalnızca bu cihazda (IndexedDB)")}
      ${kv("Bulut", "Bağlı değil — hiçbir veri gönderilmez")}
    </div>`;
}

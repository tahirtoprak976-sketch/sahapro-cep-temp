// İş sözleşmesi panosu (Özet sekmesi): kâr, tahsilat, göstergeler, gelir–gider grafiği, günlük çalışma, araçlar, uyarılar.
// Yalnız gösterir; kayıt yazmaz. Giderler tahmindir ve yöntemleri yazılır.
import { esc, notice } from "./ui.js";
import { fmtTL, trDate } from "./core.js";

const n0 = (x) => Number(x || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 });
const n1 = (x) => Number(x || 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
const tl = (x) => n0(x) + " ₺";
// Kategorik renkler sabit sırayla (doğrulandı: validate_palette — CVD/normal ayrım geçti; düşük kontrast → yanında etiket + tablo)
export const C = { gelir: "#2a78d6", mazot: "#eb6834", iscilik: "#1baf7a", dokum: "#eda100", diger: "#e87ba4" };

function hero(c, D) {
  const pos = c.profit >= 0;
  const status = c.income <= 0 ? ["⏳", "Gelir henüz belli değil", "var(--muted)"] : pos ? ["▲", "Kârda", "var(--ok)"] : ["▼", "Zararda", "var(--danger)"];
  const T = c.targetGross;
  const paidPct = T > 0 ? Math.max(0, Math.min(100, Math.round((c.paid / T) * 100))) : null;
  return `<div class="card" data-hero style="padding:16px">
    <div class="tiny muted" style="letter-spacing:.06em;text-transform:uppercase">Tahmini kâr (KDV hariç)</div>
    <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:2px">
      <div style="font-size:32px;font-weight:800;line-height:1.1;color:var(--text)">${c.profit < 0 ? "−" : ""}${tl(Math.abs(c.profit))}</div>
      <div class="small" style="color:${status[2]};font-weight:700">${status[0]} ${status[1]}${c.margin != null ? ` · %${c.margin}` : ""}</div>
    </div>
    <div class="small muted" style="margin-top:4px">Gelir ${tl(c.income)} − gider ${tl(c.cost)}${c.revenueEst ? " · gelir tahmini" : ""}</div>
    ${paidPct != null ? `<div style="margin-top:12px">
      <div class="row between small"><span>Tahsilat</span><span><b>${tl(c.paid)}</b> / ${c.targetEst ? "≈ " : ""}${tl(T)} <span class="muted">(%${paidPct})</span></span></div>
      <div style="height:8px;border-radius:4px;background:var(--border);margin-top:4px;overflow:hidden" role="img" aria-label="Tahsilat yüzde ${paidPct}"><div style="height:100%;width:${paidPct}%;background:${C.gelir};border-radius:4px"></div></div>
      <div class="tiny muted" style="margin-top:3px">Ödemeler: müşterinin ${trDate(D.start_date)}'den beri tüm ödemeleri · Kalan ≈ ${tl(Math.max(0, T - c.paid))}${c.targetEst ? " (tahmini hakedişe göre)" : ""}</div>
    </div>` : `<div class="tiny muted" style="margin-top:8px">Tahsilat ilerlemesi, bedel / ölçüm cariye yazılınca görünür.</div>`}
  </div>`;
}

function kpis(c, rep, D) {
  const t = (v, l, sub = "") => `<div class="card" style="margin:0;padding:10px"><div style="font-size:20px;font-weight:800">${v}</div><div class="tiny muted">${l}${sub ? `<br>${sub}` : ""}</div></div>`;
  return `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0" data-kpis>
    ${t(n0(rep.trips), "Sefer")}
    ${t(c.m3 ? n0(c.m3) : "—", rep.measured ? "m³ ölçülen" : "m³ tahmini")}
    ${t(n1(rep.hours), "Makine saati")}
    ${t(n0(c.workDays), "Çalışılan gün")}
    ${t(c.tripsPerDay != null ? n1(c.tripsPerDay) : "—", "Sefer / gün")}
    ${t(c.costPerM3 != null ? tl(c.costPerM3) : "—", "Gider / m³", c.m3 && D.basis === "m³" ? `fiyat ${tl(D.price)}` : "")}
  </div>`;
}

// Gelir ve gider: aynı ölçekte iki yatay çubuk; gider dört kalemde yığılı (2px boşluk, uçlar 4px yuvarlak). Yanında değer tablosu.
function moneyChart(c) {
  const max = Math.max(c.income, c.cost, 1);
  const seg = c.costs.filter((x) => x.tl > 0);
  const bar = (inner, label, value) => `<div style="margin:6px 0"><div class="row between small"><span>${label}</span><b>${value}</b></div>
    <div style="height:18px;border-radius:4px;overflow:hidden;background:var(--border);margin-top:3px;display:flex;gap:2px">${inner}</div></div>`;
  const segDivs = seg.map((s) => `<div title="${esc(s.label)}: ${tl(s.tl)}" style="height:100%;width:${(s.tl / max) * 100}%;background:${C[s.key]}"></div>`).join("");
  return `<div class="card" data-moneychart>
    <div class="section-title" style="margin:0 0 6px">Gelir ve gider</div>
    ${bar(`<div title="Gelir: ${tl(c.income)}" style="height:100%;width:${(c.income / max) * 100}%;background:${C.gelir}"></div>`, "Gelir (net)", tl(c.income))}
    ${bar(segDivs, "Gider (tahmini)", tl(c.cost))}
    <table class="small" style="width:100%;border-collapse:collapse;margin-top:8px">
      <tbody>
        <tr><td style="padding:3px 0"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${C.gelir};margin-right:6px"></span>${esc(c.revenueBasis || "Gelir")}</td><td style="text-align:right">${tl(c.revenue)}</td></tr>
        ${c.extras ? `<tr><td style="padding:3px 0;padding-left:16px">+ ekstralar</td><td style="text-align:right">${tl(c.extras)}</td></tr>` : ""}
        ${c.scrap ? `<tr><td style="padding:3px 0;padding-left:16px">+ hurda satışı</td><td style="text-align:right">${tl(c.scrap)}</td></tr>` : ""}
        ${c.costs.map((s) => `<tr style="border-top:1px solid var(--border)"><td style="padding:4px 0"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${C[s.key]};margin-right:6px"></span>${esc(s.label)}${s.est ? ' <span class="tiny muted">tahmini</span>' : ""}<div class="tiny muted" style="padding-left:16px">${esc(s.note)}</div></td><td style="text-align:right;vertical-align:top;padding-top:4px">− ${tl(s.tl)}</td></tr>`).join("")}
        <tr style="border-top:2px solid var(--border)"><td style="padding:5px 0"><b>Tahmini kâr</b></td><td style="text-align:right"><b>${c.profit < 0 ? "−" : ""}${tl(Math.abs(c.profit))}</b></td></tr>
        ${c.profitPerM3 != null ? `<tr><td class="tiny muted">m³ başı kâr</td><td class="tiny muted" style="text-align:right">${tl(c.profitPerM3)}</td></tr>` : ""}
      </tbody>
    </table>
  </div>`;
}

// Günlük sefer: tek seri çubuk (renk tek, efsane yok — başlık adlandırır). Dokununca değer yazar.
function dailyChart(c) {
  const days = c.days;
  if (!days.length || !days.some((x) => x.sefer || x.saat)) return "";
  const max = Math.max(...days.map((x) => x.sefer), 1);
  const H = 90;
  const bars = days.map((x, i) => `<button type="button" data-day="${i}" aria-label="${trDate(x.date)}: ${x.sefer} sefer, ${x.saat} saat" style="flex:1;min-width:0;height:${H}px;display:flex;align-items:flex-end;background:none;border:0;padding:0 1px;cursor:pointer">
      <span style="display:block;width:100%;height:${x.sefer ? Math.max(3, (x.sefer / max) * H) : 0}px;background:${C.gelir};border-radius:4px 4px 0 0"></span></button>`).join("");
  return `<div class="card" data-daily>
    <div class="row between"><div class="section-title" style="margin:0">Günlük sefer</div><span class="tiny muted">en çok ${n0(max)}</span></div>
    <div style="display:flex;align-items:flex-end;gap:0;margin-top:8px;border-bottom:1px solid var(--border)">${bars}</div>
    <div class="row between tiny muted" style="margin-top:3px"><span>${trDate(days[0].date)}</span><span>${trDate(days.at(-1).date)}</span></div>
    <div class="small" data-dayinfo style="min-height:20px;margin-top:4px">Bir güne dokunun.</div>
  </div>`;
}

function vehicleTable(c) {
  if (!c.vehicles.length) return "";
  return `<div class="card" data-vehtable>
    <div class="section-title" style="margin:0 0 6px">Araçlar</div>
    <table class="small" style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left">Araç</th><th style="text-align:right">İş</th><th style="text-align:right">Mazot</th></tr></thead><tbody>
    ${c.vehicles.map((v) => `<tr style="border-top:1px solid var(--border)"><td style="padding:4px 4px 4px 0">${esc(v.vehicle)}</td><td style="text-align:right">${[v.sefer ? n0(v.sefer) + " sefer" : "", v.saat ? n1(v.saat) + " saat" : "", v.yev ? n1(v.yev) + " yev." : ""].filter(Boolean).join(" · ") || "—"}</td><td style="text-align:right">${v.L ? `${n0(v.L)} L<div class="tiny muted">${tl(v.tl)}</div>` : "—"}</td></tr>`).join("")}
    </tbody></table>
  </div>`;
}

export function dashboardHtml(c, rep, D) {
  return hero(c, D) + kpis(c, rep, D) + moneyChart(c) + dailyChart(c) + vehicleTable(c) +
    (c.warnings.length ? `<div class="card" data-jobwarn><div class="section-title" style="margin:0 0 6px">Dikkat</div>${c.warnings.map((w) => `<div class="small" style="margin:4px 0">⚠ ${esc(w)}</div>`).join("")}</div>` : "") +
    `<div class="tiny muted" style="margin:4px 4px 10px">Giderler tahmindir: mazot aracın son 90 gün tüketiminden, işçilik ücret kartından hesaplanır; araç bakımı, sigorta ve amortisman dahil değildir. Gelir KDV hariçtir.</div>`;
}

export function bindDashboard(root, c) {
  const info = root.querySelector("[data-dayinfo]");
  for (const b of root.querySelectorAll("[data-day]"))
    b.addEventListener("click", () => {
      const x = c.days[Number(b.dataset.day)];
      for (const o of root.querySelectorAll("[data-day] span")) o.style.opacity = "";
      for (const o of root.querySelectorAll("[data-day]")) if (o !== b) o.querySelector("span").style.opacity = ".45";
      if (info) info.innerHTML = `<b>${trDate(x.date)}</b>: ${n0(x.sefer)} sefer${x.saat ? ` · ${n1(x.saat)} makine saati` : ""}`;
    });
}

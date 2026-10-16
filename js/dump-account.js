// Döküm sahası ön ödemeli hesap — SAF katman.
// Döküm sahasına önce para yatırılır (barkod alınır), her dökümde hesaptan düşer.
// Yatırılan para: gider kaydı (kategori "Döküm", dump_deposit: true, dump_site_id) — kâr/zararda GİDER SAYILMAZ (ön ödeme),
// maliyet döküm yapıldıkça (fişteki ton × ücret) yazılır. Nakit tahmininde ise gerçek para çıkışıdır.
import { isActive, todayStr, addDays } from "./core.js";
import { dumpFee } from "./dump-fees.js";

const live = (d, s) => (d[s] || []).filter(isActive);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fold = (s) => String(s || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
export const isDumpDeposit = (e) => !!e?.dump_deposit;

// Gider kaydı döküm hesabına yükleme mi? (kategori Döküm + firma/açıklamada döküm sahası adı)
export function depositSiteOf(d, e) {
  if (e.dump_site_id) return live(d, "dump_sites").find((s) => s.id === e.dump_site_id) || null;
  if (!/döküm|dokum/i.test(e.category || "")) return null;
  const t = fold([e.company, e.description, e.note].join(" "));
  return live(d, "dump_sites").filter((s) => !s.own_yard && fold(s.name).length >= 3).find((s) => t.includes(fold(s.name).split(" ")[0])) || null;
}

export function dumpAccounts(d, { today = todayStr(), siteId = null } = {}) {
  const sites = live(d, "dump_sites").filter((s) => !s.own_yard && (!siteId || s.id === siteId));
  const deps = live(d, "expense_records").filter(isDumpDeposit);
  const works = live(d, "work_records");
  const out = [];
  for (const s of sites) {
    const deposits = deps.filter((e) => e.dump_site_id === s.id).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (!deposits.length && siteId == null) continue;
    const first = deposits[0]?.date || "";
    // Hesaptan düşen: ilk yüklemeden sonraki bu sahaya yapılan dökümler (elle yazılan döküm maliyeti dahil)
    const uses = works.filter((w) => w.date >= first && (w.dump_site_id === s.id || (!w.dump_site_id && w.dump_area && fold(w.dump_area) === fold(s.name))))
      .map((w) => ({ w, f: dumpFee(d, w) })).filter((x) => x.f && x.f.amount > 0)
      .sort((a, b) => String(a.w.date).localeCompare(String(b.w.date)));
    const dep = r2(deposits.reduce((n, e) => n + (Number(e.amount) || 0), 0));
    const used = r2(uses.reduce((n, x) => n + x.f.amount, 0));
    const usedEst = r2(uses.filter((x) => x.f.estimated).reduce((n, x) => n + x.f.amount, 0));
    const recent = uses.filter((x) => x.w.date > addDays(today, -14));
    const perDay = r2(recent.reduce((n, x) => n + x.f.amount, 0) / 14);
    const balance = r2(dep - used);
    out.push({ site: s, deposits, uses, dep, used, usedEst, balance, perDay, daysLeft: perDay > 0 ? Math.floor(Math.max(0, balance) / perDay) : null,
      trips: uses.length, missingTon: uses.filter((x) => x.f.estimated).length, reported: s.account_reported || null });
  }
  return out.sort((a, b) => a.balance - b.balance);
}

// Ana sayfa / brifing uyarıları
export function dumpAccountAlerts(d, { today = todayStr() } = {}) {
  const items = [];
  for (const a of dumpAccounts(d, { today })) {
    if (a.balance < 0) items.push({ kind: "alert", text: `${a.site.name} döküm hesabı eksiye düştü`, sub: `Hesaplanan bakiye ${a.balance.toLocaleString("tr-TR")} ₺ — para yatırın ya da fişleri kontrol edin`, href: "#/dokum-hesap/" + a.site.id });
    else if (a.daysLeft != null && a.daysLeft <= 3) items.push({ kind: "warn", text: `${a.site.name} döküm hesabında ~${Math.round(a.balance).toLocaleString("tr-TR")} ₺ kaldı`, sub: `Günde ~${Math.round(a.perDay).toLocaleString("tr-TR")} ₺ harcanıyor → ~${a.daysLeft} gün yeter`, href: "#/dokum-hesap/" + a.site.id });
  }
  return items;
}

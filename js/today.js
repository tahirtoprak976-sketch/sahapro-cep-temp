// "Bugün" panosu: bugün dikkat edilmesi gerekenleri tek listede toplayan saf fonksiyon.
// Ekrana dokunmaz; m-dash.js sonucu çizer. Testlenebilir olması için veri parametre olarak gelir.
import {
  isActive,
  addDays,
  fromKurus,
  latestDocuments,
  backupAgeDays,
  todayStr,
} from "./core.js";
import { ledgerOf } from "./esnaf.js";

const DAY = 86400000;
const daysBetween = (a, b) =>
  Math.round(
    (new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) /
      DAY,
  );

export function todayBoard(data, opts = {}) {
  const today = opts.today || todayStr();
  const act = (a) => (a || []).filter(isActive);
  const items = [];

  // 1) Belgeler: aynı sahip+kategoride yalnızca en güncel belge
  const nameOf = (d) =>
    act(data.vehicles).find((v) => v.id === (d.vehicle_id || d.owner_id))
      ?.plate ||
    act(data.vehicles).find((v) => v.id === (d.vehicle_id || d.owner_id))
      ?.name ||
    act(data.personnel).find((p) => p.id === (d.personnel_id || d.owner_id))
      ?.name ||
    "Belge";
  const docs = latestDocuments(act(data.documents))
    .filter((d) => d.expiry_date && d.expiry_date <= addDays(today, 30))
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
  for (const d of docs) {
    const left = daysBetween(today, d.expiry_date);
    items.push({
      kind: left < 0 ? "alert" : left <= 7 ? "alert" : "warn",
      group: "Belge",
      ic: "📄",
      text: `${nameOf(d)} · ${d.category || "Belge"}`,
      sub:
        left < 0
          ? `${-left} gün önce süresi doldu`
          : left === 0
            ? "Bugün sona eriyor"
            : `${left} gün kaldı`,
      href: "#/belgeler",
      sort: left,
    });
  }

  // 2) Bakım tarihi gelen araçlar
  for (const v of act(data.vehicles)) {
    if (!v.next_maintenance_date || v.next_maintenance_date > addDays(today, 14))
      continue;
    const left = daysBetween(today, v.next_maintenance_date);
    items.push({
      kind: left <= 0 ? "alert" : "warn",
      group: "Bakım",
      ic: "🔧",
      text: `${v.plate || v.name} bakım`,
      sub: left < 0 ? `${-left} gün gecikti` : left === 0 ? "Bugün" : `${left} gün kaldı`,
      href: "#/bakim",
      sort: left,
    });
  }
  const openMaint = act(data.maintenance_records).filter(
    (m) => m.status !== "Tamamlandı",
  ).length;
  if (openMaint)
    items.push({
      kind: "warn",
      group: "Bakım",
      ic: "🛠",
      text: `${openMaint} açık arıza / bakım kaydı`,
      sub: "",
      href: "#/bakim",
      sort: 99,
    });

  // 3) Esnaf (açık hesap) borçları — alış belgesinin vadesi tarihle aynı olduğundan vade gecikmesi sayılmaz
  const debts = act(data.suppliers)
    .map((s) => ({ s, l: ledgerOf(data, s.id) }))
    .filter((r) => r.l.remaining > 0)
    .sort((a, b) => b.l.remaining - a.l.remaining);
  const debtTotal = debts.reduce((n, r) => n + r.l.remaining, 0);
  if (debts.length)
    items.push({
      kind: "info",
      group: "Esnaf",
      ic: "🔧",
      text: `Esnafa borç: ${debts.length} kişi`,
      sub:
        debts
          .slice(0, 3)
          .map((r) => r.s.name)
          .join(", ") + (debts.length > 3 ? " …" : ""),
      amount: fromKurus(debtTotal),
      href: "#/esnaf",
      sort: 50,
    });

  // 4) Yedek
  const age = backupAgeDays(opts.lastBackupAt, today);
  if (age === null || age >= 3)
    items.push({
      kind: age === null || age >= 7 ? "alert" : "warn",
      group: "Yedek",
      ic: "💾",
      text: age === null ? "Hiç yedek alınmadı" : `Son yedek ${age} gün önce`,
      sub: "Telefon kaybolursa veriler gider — şimdi yedekleyin",
      href: "#/ayarlar?tab=yedek",
      sort: -1000,
    });

  const rank = { alert: 0, warn: 1, info: 2 };
  items.sort((a, b) => rank[a.kind] - rank[b.kind] || a.sort - b.sort);
  return {
    items,
    alerts: items.filter((i) => i.kind === "alert").length,
    warns: items.filter((i) => i.kind === "warn").length,
  };
}

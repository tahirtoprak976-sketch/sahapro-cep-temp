// "Dikkat isteyen işler" ve ana ekran özetleri — SAF katman, kayıt yazmaz; mevcut denetimlerin sonuçlarını toplar.
// İnceleme adayları kesin hata olarak sunulmaz; her maddede neden ve sonraki adım yazılır.
import { isActive, addDays, todayStr } from "./core.js";
import { isIncluded, jobAttention } from "./job-core.js";
import { workAmount } from "./collect-core.js";
import { fuelRulesOf, customerFuelLedger } from "./assistant-rules.js";
import { fuelAudit } from "./fuel-audit.js";

const live = (d, s) => (d[s] || []).filter(isActive);
export function attentionItems(d, { restoreSets = [], today = todayStr() } = {}) {
  const out = [];
  const internal = new Set(live(d, "customers").filter((c) => c.internal).map((c) => c.id));
  const works = live(d, "work_records");
  const unpriced = works.filter((w) => w.customer_id && !internal.has(w.customer_id) && !workAmount(w) && !(Number(w.customer_fuel_allowance_l) > 0) && !isIncluded(w));
  if (unpriced.length) out.push({ key: "fiyatsiz", count: unpriced.length, title: `${unpriced.length} işin fiyatı yok`, why: "Fiyat listesinde uyan kural yok ya da fiyat girilmemiş; bu işler alacağa sayılmıyor.", next: "Listeyi açıp fiyat girin ya da fiyat kuralı ekleyin.", hash: "#/isler?f=fiyatsiz" });
  const nocust = works.filter((w) => !w.customer_id);
  if (nocust.length) out.push({ key: "musterisiz", count: nocust.length, title: `${nocust.length} işte müşteri yok`, why: "Müşterisi seçilmemiş iş hiçbir cariye yazılmaz.", next: "İşi açıp müşteriyi seçin.", hash: "#/isler?f=musterisiz" });
  const msgs = live(d, "inbox_messages").filter((m) => ["Taslak", "Kısmen Aktarıldı"].includes(m.status) && !m.merge_parent_id);
  if (msgs.length) out.push({ key: "mesaj", count: msgs.length, title: `${msgs.length} mesaj kontrol bekliyor`, why: "Mesaj taslakları onaylanmadan iş / yakıt kaydına dönüşmez.", next: "Mesaj kontrolünü açıp satırları onaylayın ya da reddedin.", hash: "#/mesajlar" });
  const half = (restoreSets || []).filter((s) => s && Number(s.of) > 0 && (s.done || []).length < Number(s.of));
  if (half.length) out.push({ key: "yedek", count: half.length, title: `${half.length} yedek geri yüklemesi yarım`, why: "Parçalı yedeğin bütün parçaları yüklenmedi; bazı ekler eksik olabilir.", next: "Veri sağlığı ekranında eksik parçaları görün ve yükleyin.", hash: "#/veri-sagligi" });
  const fuelCust = live(d, "customers").filter((c) => fuelRulesOf(c).length);
  const cand = fuelCust.filter((c) => !fuelAudit(d, c.id).clean);
  if (cand.length) out.push({ key: "mazot", count: cand.length, title: `${cand.length} müşterinin mazot hesabında inceleme adayı var`, why: "Kesin hata değildir: kurala uymayan TL iş ya da müşteriye bağlı olmayan yakıt kaydı olabilir.", next: "Mazot hesabı incelemesini açın; düzeltme yalnız onayınızla yapılır.", hash: "#/mazot-hesaplari" });
  const jobs = jobAttention(d, today);
  if (jobs.length) out.push({ key: "olcum", count: jobs.length, title: `${jobs.length} metreküp işi ölçüm bekliyor olabilir`, why: jobs.map((j) => j.text).join(" · "), next: "İş bittiyse ölçümcünün m³'ünü girin; hakediş ancak ölçümle cariye yazılır.", hash: jobs.length === 1 ? jobs[0].href : "#/is-sozlesmeleri" });
  return out;
}
// Son N günün günlük iş sayısı ve birim toplamları (birimler AYRI)
export function dailyWorks(d, today, days = 14) {
  const list = [];
  for (let i = days - 1; i >= 0; i--) list.push({ date: addDays(today, -i), count: 0, units: {} });
  for (const w of live(d, "work_records")) {
    const x = list.find((l) => l.date === w.date);
    if (!x) continue;
    x.count++;
    if (w.unit) x.units[w.unit] = Math.round(((x.units[w.unit] || 0) + (Number(w.quantity) || 0)) * 100) / 100;
  }
  return list;
}
// Araçlara göre dönem özeti: saat / sefer / yevmiye / ton AYRI sütunlarda (tek toplamda birleştirilmez)
export function vehicleSummary(d, from, to) {
  const m = new Map();
  for (const w of live(d, "work_records").filter((w) => w.vehicle_id && w.date >= from && w.date <= to)) {
    const v = m.get(w.vehicle_id) || { id: w.vehicle_id, name: live(d, "vehicles").find((x) => x.id === w.vehicle_id)?.name || "—", works: 0, Saat: 0, Sefer: 0, Yevmiye: 0, Ton: 0, other: 0 };
    v.works++;
    const q = Number(w.quantity) || 0;
    if (["Saat", "Sefer", "Yevmiye", "Ton"].includes(w.unit)) v[w.unit] = Math.round((v[w.unit] + q) * 100) / 100; else v.other++;
    m.set(w.vehicle_id, v);
  }
  return [...m.values()].sort((a, b) => b.works - a.works);
}
// Mazot anlaşmaları: hak / alınan / kalan litre (TL değildir)
export function fuelSummaries(d) {
  return live(d, "customers").filter((c) => fuelRulesOf(c).length || live(d, "work_records").some((w) => w.customer_id === c.id && Number(w.customer_fuel_allowance_l) > 0))
    .map((c) => ({ id: c.id, name: c.name, ...customerFuelLedger(d, c.id) })).filter((x) => x.earned || x.received);
}

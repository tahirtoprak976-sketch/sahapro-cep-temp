// Kayıtları gerçek tarihlerine göre gruplama (en yeni üstte) — SAF katman.
// Tarihsiz kayıtlar en altta "Tarih belirtilmemiş" grubunda. Sayfalama GRUP bütün olarak yapılır:
// bir tarih iki sayfaya bölünmez, başlıktaki iş sayısı her zaman o tarihin (filtrelenmiş) toplamıdır.
const AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const GUN = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !Number.isNaN(Date.parse(s + "T12:00:00"));
export function longDateTr(s) {
  if (!validDate(s)) return "Tarih belirtilmemiş";
  const d = new Date(s + "T12:00:00");
  return `${d.getDate()} ${AY[d.getMonth()]} ${d.getFullYear()} · ${GUN[d.getDay()]}`;
}
// rows → [{ key, label, items }] ; aynı tarih içinde kayıt zamanı yeniden eskiye
export function groupByDate(rows, dateOf = (r) => r.date) {
  const map = new Map();
  for (const r of rows) {
    const k = validDate(dateOf(r)) ? dateOf(r) : "";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  const keys = [...map.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : b.localeCompare(a)));
  return keys.map((k) => ({ key: k, label: longDateTr(k), items: map.get(k).sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))) }));
}
// Grupları sayfalara böl: her sayfa en az `size` kayıt (son grup bütün kalır)
export function pageGroups(groups, size = 30) {
  const pages = [];
  let cur = [], n = 0;
  for (const g of groups) {
    cur.push(g); n += g.items.length;
    if (n >= size) { pages.push(cur); cur = []; n = 0; }
  }
  if (cur.length) pages.push(cur);
  return pages;
}

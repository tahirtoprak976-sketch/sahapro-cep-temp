import assert from "node:assert/strict";
import { groupByDate, pageGroups, longDateTr } from "../js/date-groups.js";
let n = 0; const test = (t, f) => { f(); n++; console.log("PASS " + t); };
test("tarih başlığı Türkçe ve gün adıyla", () => { assert.equal(longDateTr("2026-10-16"), "16 Ekim 2026 · Cuma"); assert.equal(longDateTr(""), "Tarih belirtilmemiş"); assert.equal(longDateTr("16.10.2026"), "Tarih belirtilmemiş"); });
test("en yeni tarih üstte, tarihsiz en altta, aynı gün içinde yeni kayıt üstte", () => {
  const g = groupByDate([{ id: 1, date: "2026-10-15", created_at: "a" }, { id: 2, date: "" }, { id: 3, date: "2026-10-16", created_at: "a" }, { id: 4, date: "2026-10-16", created_at: "b" }, { id: 5, date: null }]);
  assert.deepEqual(g.map((x) => [x.key, x.items.map((i) => i.id)]), [["2026-10-16", [4, 3]], ["2026-10-15", [1]], ["", [2, 5]]]);
});
test("sayfalama grubu bölmez; başlık sayısı grubun tamamı", () => {
  const rows = []; for (let i = 0; i < 25; i++) rows.push({ id: "a" + i, date: "2026-10-16" }); for (let i = 0; i < 10; i++) rows.push({ id: "b" + i, date: "2026-10-15" }); rows.push({ id: "c", date: "2026-10-14" });
  const p = pageGroups(groupByDate(rows), 30);
  assert.deepEqual(p.map((pg) => pg.map((g) => [g.key, g.items.length])), [[["2026-10-16", 25], ["2026-10-15", 10]], [["2026-10-14", 1]]]);
});
console.log(`date-groups: ${n} test geçti`);

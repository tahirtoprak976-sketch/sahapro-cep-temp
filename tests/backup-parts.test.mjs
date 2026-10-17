// Parçalı yedek sözleşmesi: manifest (set, sıra/toplam, sayılar, ek dizini), her parça bütçe altında ve tek başına okunur
import assert from "node:assert/strict";
import { backupParts, setStatusText } from "../js/backup.js";
import { encodeBackup, decodeBackup } from "../js/backup-crypt.js";
const rnd = (n, seed) => { const u = new Uint8Array(n); let x = seed; for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) >>> 0; u[i] = x >>> 24; } return u; };
const atts = Array.from({ length: 10 }, (_, i) => ({ id: "A" + i, record_type: "work", record_id: "W" + (i % 3), name: `f${i}.jpg`, type: "image/jpeg", size: 300000, blob: new Blob([rnd(300000, i + 1)]) }));
const data = { work_records: [{ id: "W0" }, { id: "W1" }, { id: "W2" }], customers: [{ id: "C", name: "Kaya" }] };
const meta = [{ key: "kdv_default", value: 20 }, { key: "driver_links", value: [{ secret: "S" }] }, { key: "gemini_key", value: "K" }, { key: "restore_set:x", value: {} }];
const db = { dumpAll: async () => data, getAll: async (s) => (s === "attachments" ? atts : s === "meta" ? meta : []), metaGet: async () => "dev" };
const parts = await backupParts(db, { encrypted: false, budget: 1024 * 1024 });
assert.ok(parts.count >= 3, "küçük bütçede birden çok parça: " + parts.count);
const got = [];
let i = 0, idx = null;
for await (const p of parts) {
  i++;
  assert.ok(JSON.stringify(p).length <= 1024 * 1024, "parça bütçeyi (açılmış JSON) aşmaz");
  assert.equal(p.part.set, parts.set, "ortak set kimliği");
  assert.deepEqual([p.part.no, p.part.of], [i, parts.count]);
  assert.deepEqual(p.part.totals, { records: 4, attachments: 10, attachment_bytes: 3000000 });
  assert.equal(p.part.part_attachments, p.attachments.length);
  if (i === 1) { idx = p.part.index; assert.equal(idx.length, 10); assert.deepEqual(p.data, data);
    assert.ok(!p.meta.some((m) => ["driver_links", "gemini_key"].includes(m.key) || m.key.startsWith("restore_set:")), "şifresiz parçada gizli bilgi / geri yükleme durumu yok"); }
  else { assert.equal(p.part.index, undefined); assert.deepEqual(p.data, {}); }
  for (const a of p.attachments) assert.equal(idx.find((x) => x[0] === a.id)[3], i, "dizin eki doğru parçaya gösteriyor");
  const back = await decodeBackup(await encodeBackup(p, "pw-123"), async () => "pw-123");
  got.push(...back.attachments);
}
assert.equal(got.length, 10);
for (const a of atts) {
  const b = got.find((x) => x.id === a.id);
  assert.deepEqual(Uint8Array.from(atob(b.base64), (c) => c.charCodeAt(0)), new Uint8Array(await a.blob.arrayBuffer()), "ek birebir: " + a.id);
}
const one = await backupParts(db, { encrypted: true });
assert.equal(one.count, 1);
for await (const p of one) { assert.deepEqual([p.part.no, p.part.of], [1, 1]); assert.equal(p.attachments.length, 10); assert.ok(p.meta.some((m) => m.key === "driver_links")); }
assert.match(setStatusText({ of: 3, done: [1, 3], pending: { A1: ["work", "W1", 2], A4: ["work", "W1", 2] } }), /TAMAMLANMADI: 2\/3.*eksik parça: 2\. 1 kaydın eki/);
assert.match(setStatusText({ of: 3, done: [1, 2, 3], pending: {} }), /tamamlandı/);
console.log("backup-parts PASS");

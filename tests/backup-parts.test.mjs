// Parçalı yedek: her parça bütçenin altında, tek başına okunabilir; ekler eksiksiz ve birebir; ilk parça kayıtları taşır
import assert from "node:assert/strict";
import { backupParts } from "../js/backup.js";
import { encodeBackup, decodeBackup } from "../js/backup-crypt.js";
const rnd = (n, seed) => { const u = new Uint8Array(n); let x = seed; for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) >>> 0; u[i] = x >>> 24; } return u; };
const atts = Array.from({ length: 10 }, (_, i) => ({ id: "A" + i, record_type: "work", record_id: "W" + (i % 3), name: `f${i}.jpg`, type: "image/jpeg", size: 300000, blob: new Blob([rnd(300000, i + 1)]) }));
const data = { work_records: [{ id: "W0" }, { id: "W1" }, { id: "W2" }], customers: [{ id: "C", name: "Kaya" }] };
const meta = [{ key: "kdv_default", value: 20 }, { key: "driver_links", value: [{ secret: "S" }] }, { key: "gemini_key", value: "K" }];
const db = { dumpAll: async () => data, getAll: async (s) => (s === "attachments" ? atts : s === "meta" ? meta : []), metaGet: async () => "dev" };
const parts = await backupParts(db, { encrypted: false, budget: 1024 * 1024 });
assert.ok(parts.count >= 3, "küçük bütçede birden çok parça: " + parts.count);
const got = [];
let i = 0;
for await (const p of parts) {
  i++;
  assert.ok(JSON.stringify(p).length <= 1024 * 1024, "parça bütçeyi aşmaz");
  assert.deepEqual(p.part && [p.part.no, p.part.of], [i, parts.count]);
  if (i === 1) { assert.deepEqual(p.data, data); assert.ok(!p.meta.some((m) => ["driver_links", "gemini_key"].includes(m.key)), "şifresiz parçada gizli bilgi yok"); }
  else { assert.deepEqual(p.data, {}); assert.deepEqual(p.meta, []); }
  const back = await decodeBackup(await encodeBackup(p, "pw-123"), async () => "pw-123"); // üretilen her parça geri okunur
  got.push(...back.attachments);
}
assert.equal(got.length, 10);
for (const a of atts) {
  const b = got.find((x) => x.id === a.id);
  const bytes = Uint8Array.from(atob(b.base64), (c) => c.charCodeAt(0));
  assert.deepEqual(bytes, new Uint8Array(await a.blob.arrayBuffer()), "ek birebir: " + a.id);
}
// tek parça yeterliyse "part" alanı yok (eski biçimle aynı)
const one = await backupParts(db, { encrypted: true });
assert.equal(one.count, 1);
for await (const p of one) { assert.equal(p.part, undefined); assert.equal(p.attachments.length, 10); assert.ok(p.meta.some((m) => m.key === "driver_links")); }
console.log("backup-parts PASS");

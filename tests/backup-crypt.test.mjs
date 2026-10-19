import assert from "node:assert/strict";
import { encodeBackup, decodeBackup, backupKind } from "../js/backup-crypt.js";
const obj = { app: "x", data: { personnel: [{ id: "P", name: "Soner Kaya", identity_number: "10000000146" }] }, big: "hafriyat ".repeat(5000) };
const plain = new TextEncoder().encode(JSON.stringify(obj));
const z = await encodeBackup(obj);
assert.equal(backupKind(z), "compressed"); assert.ok(z.length < plain.length / 10, "sıkıştırma");
assert.deepEqual(await decodeBackup(z), obj);
const e = await encodeBackup(obj, "Muratoglu2026");
assert.equal(backupKind(e), "encrypted");
assert.ok(!new TextDecoder().decode(e).includes("Soner"), "şifreli dosyada ad görünmez");
assert.deepEqual(await decodeBackup(e, async () => "Muratoglu2026"), obj);
await assert.rejects(() => decodeBackup(e, async () => "yanlis"), /şifresi yanlış/);
await assert.rejects(() => decodeBackup(e, async () => null), /şifre girilmedi/);
assert.deepEqual(await decodeBackup(plain), obj, "eski .json yedek");
console.log("backup-crypt ok");
// v3.9.04: eski "gzip" biçimi okunur; boyut sınırları (sıkıştırma bombası telefonu kilitlemesin)
{
  const { MAX_BACKUP_FILE } = await import("../js/backup-crypt.js");
  const gz = new Uint8Array(await new Response(new Blob([plain]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  assert.equal(backupKind(gz), "gzip"); assert.deepEqual(await decodeBackup(gz), obj, "eski .json.gz yedek");
  assert.ok(MAX_BACKUP_FILE >= 100 * 1024 * 1024, "gerçek yedeklere yetecek sınır");
  // 900 MB sıfır → birkaç MB gzip: açılırken sınırda durmalı (belleği doldurmadan)
  const zeros = new Uint8Array(1024 * 1024);
  const bomb = new Blob(Array.from({ length: 900 }, () => zeros)).stream().pipeThrough(new CompressionStream("gzip"));
  const bz = new Uint8Array(await new Response(bomb).arrayBuffer());
  const magic = new TextEncoder().encode("SPBK0"); const f = new Uint8Array(magic.length + bz.length); f.set(magic); f.set(bz, magic.length);
  await assert.rejects(() => decodeBackup(f), /çok büyük/);
  console.log("backup-limits ok");
}

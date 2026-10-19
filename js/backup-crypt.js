// Yedek dosyası: sıkıştırılmış (gzip) ve isteğe bağlı ŞİFRELİ (AES-GCM, şifreden PBKDF2 ile anahtar).
// Biçim: "SPBK0" + gzip(JSON)  |  "SPBK1" + tuz(16) + iv(12) + AES-GCM(gzip(JSON)).  Eski düz .json yedekler de okunur.
// Yedek WhatsApp/Drive'a gider; içinde TC no, telefon, cari bilgiler var — şifre bu yüzden.
const MAGIC0 = "SPBK0", MAGIC1 = "SPBK1", ITER = 200000;
const enc = new TextEncoder(), dec = new TextDecoder();

async function streamBytes(bytes, stream) {
  const s = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(s).arrayBuffer());
}
const gzip = (b) => streamBytes(b, new CompressionStream("gzip"));
// Sınırlar: bozuk / kötü niyetli dosya telefonu kilitlemesin (sıkıştırma bombası). Gerçek yedekler bunun çok altındadır.
// Okuma sınırları: eski (parçasız) yedekler de okunabilsin diye üretimdeki parça bütçesinden (120 MB) geniştir;
// JS metin üst sınırının (~512 M karakter) altında kalır. Üretici bu sınırı aşan dosya üretmez (encodeBackup denetler).
export const MAX_BACKUP_FILE = 300 * 1024 * 1024, MAX_BACKUP_JSON = 400 * 1024 * 1024;
async function gunzip(b, limit = MAX_BACKUP_JSON) {
  const reader = new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const parts = []; let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > limit) { await reader.cancel().catch(() => {}); throw Error("Yedek açıldığında çok büyük (sınır " + Math.round(limit / 1048576) + " MB) — dosya bozuk olabilir"); }
    parts.push(value);
  }
  return cat(...parts);
}
async function keyFrom(password, salt) {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
const cat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

export async function encodeBackup(obj, password = "") {
  const json = enc.encode(JSON.stringify(obj));
  if (json.length > MAX_BACKUP_JSON) throw Error(`Yedek parçası okunabilir sınırı aşıyor (${Math.round(json.length / 1048576)} MB) — parçalı yedek kullanılmalı`);
  const z = await gzip(json);
  if (z.length + 64 > MAX_BACKUP_FILE) throw Error("Yedek dosyası okunabilir sınırı aşıyor — parçalı yedek kullanılmalı");
  if (!password) return cat(enc.encode(MAGIC0), z);
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFrom(password, salt), z));
  return cat(enc.encode(MAGIC1), salt, iv, ct);
}
export function backupKind(bytes) {
  const head = dec.decode(bytes.subarray(0, 5));
  if (head === MAGIC1) return "encrypted";
  if (head === MAGIC0) return "compressed";
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return "gzip";
  return "json";
}
// getPassword: şifreli dosyada çağrılır (iptal → null)
export async function decodeBackup(bytes, getPassword) {
  bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (bytes.length > MAX_BACKUP_FILE) throw Error("Yedek dosyası çok büyük (sınır " + Math.round(MAX_BACKUP_FILE / 1048576) + " MB)");
  const kind = backupKind(bytes);
  if (kind === "json") return JSON.parse(dec.decode(bytes));
  if (kind === "gzip") return JSON.parse(dec.decode(await gunzip(bytes)));
  if (kind === "compressed") return JSON.parse(dec.decode(await gunzip(bytes.subarray(5))));
  const password = await getPassword?.();
  if (!password) throw Error("Bu yedek şifreli — şifre girilmedi");
  const salt = bytes.subarray(5, 21), iv = bytes.subarray(21, 33), ct = bytes.subarray(33);
  let z;
  try { z = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await keyFrom(password, salt), ct)); }
  catch (e) { throw Error("Yedek şifresi yanlış"); }
  return JSON.parse(dec.decode(await gunzip(z)));
}

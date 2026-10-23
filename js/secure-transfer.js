// Device-bound delivery. Public files contain ciphertext; the private key stays on the recipient.
import { readHistoryPackage } from "./history-core.js";

export const TRANSFER_FORMAT = "SAHAPRO_TRANSFER_V1";
export const MAX_TRANSFER_PLAIN = 2 * 1024 * 1024;
export const MAX_TRANSFER_FILE = 3 * 1024 * 1024;
export const MAX_TRANSFER_AGE = 7 * 86400000;
const SUITE = "ECDH-P256-HKDF-SHA256-AES256GCM";
const enc = new TextEncoder(), dec = new TextDecoder("utf-8", { fatal: true });
const hex = (b) => Array.from(b, (v) => v.toString(16).padStart(2, "0")).join("");
const hash = async (b) => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", b)));
export const transferDigest = (bytes) => hash(bytes);
const fail = (message) => { throw Error(message); };
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DIGEST = /^[0-9a-f]{64}$/;
function b64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64(s, min, max) {
  if (typeof s !== "string" || s.length > Math.ceil(max * 4 / 3) || !/^[A-Za-z0-9_-]+$/.test(s))
    fail("Aktarım alanı bozuk veya çok büyük.");
  let b;
  try { b = Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)); }
  catch { fail("Aktarım kodlaması geçersiz."); }
  if (b.length < min || b.length > max || b64(b) !== s) fail("Aktarım alanı geçersiz.");
  return b;
}
const publicBytes = (key) => crypto.subtle.exportKey("spki", key).then((b) => new Uint8Array(b));
const importPublic = (bytes) => crypto.subtle.importKey("spki", bytes, { name: "ECDH", namedCurve: "P-256" }, false, []);
export async function createRecipient() {
  const keys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const spki = await publicBytes(keys.publicKey);
  return { id: await hash(spki), public_key: b64(spki), private_key: keys.privateKey };
}
export function recipientCode(recipient) {
  return "SPAK1." + b64(enc.encode(JSON.stringify({ recipient: recipient.id, public_key: recipient.public_key })));
}
export async function readRecipientCode(code) {
  if (typeof code !== "string" || !code.trim().startsWith("SPAK1.") || code.length > 1500)
    fail("Telefondaki eşleştirme kodu gerekli (SPAK1…).");
  const r = JSON.parse(dec.decode(unb64(code.trim().slice(6), 1, 1000)));
  if (!DIGEST.test(r.recipient) || typeof r.public_key !== "string") fail("Eşleştirme kodu geçersiz.");
  const bytes = unb64(r.public_key, 91, 91);
  if (await hash(bytes) !== r.recipient) fail("Eşleştirme kodunun kimliği uyuşmuyor.");
  await importPublic(bytes);
  return { id: r.recipient, public_key: r.public_key };
}
function header(p) {
  return { format: p.format, id: p.id, recipient: p.recipient, suite: p.suite,
    created_at: p.created_at, expires_at: p.expires_at, public_key: p.public_key, salt: p.salt, iv: p.iv };
}
async function sharedKey(privateKey, peer, salt, aad) {
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: peer }, privateKey, 256);
  const base = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: aad }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
function validateHeader(p, now) {
  if (!p || p.format !== TRANSFER_FORMAT || p.suite !== SUITE || !ID.test(p.id) || !DIGEST.test(p.recipient))
    fail("Güvenli aktarım dosyası geçersiz.");
  const allowed = ["format", "id", "recipient", "suite", "created_at", "expires_at", "public_key", "salt", "iv", "ciphertext"];
  if (Object.keys(p).length !== allowed.length || Object.keys(p).some(k => !allowed.includes(k) || typeof p[k] !== "string"))
    fail("Aktarım dosyasında beklenmeyen alan var.");
  const created = Date.parse(p.created_at), expires = Date.parse(p.expires_at);
  if (!Number.isFinite(created) || !Number.isFinite(expires) || new Date(created).toISOString() !== p.created_at ||
      new Date(expires).toISOString() !== p.expires_at || expires <= created || expires - created > MAX_TRANSFER_AGE)
    fail("Aktarımın tarih veya süre bilgisi geçersiz.");
  if (created > now + 300000) fail("Aktarım tarihi ileride; telefonun saatini kontrol edin.");
  if (expires <= now) fail("Bu aktarımın süresi dolmuş. Yeni bağlantı isteyin.");
}
export async function sealTransfer(value, code, { now = Date.now(), days = 7 } = {}) {
  if (!Number.isInteger(days) || days < 1 || days > 7) fail("Aktarım süresi 1–7 gün olmalı.");
  const pkg = readHistoryPackage(value), recipient = await readRecipientCode(code);
  const plain = enc.encode(JSON.stringify(pkg));
  if (plain.length > MAX_TRANSFER_PLAIN) fail("Aktarım içeriği en fazla 2 MB olabilir.");
  const keys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const h = { format: TRANSFER_FORMAT, id: crypto.randomUUID(), recipient: recipient.id, suite: SUITE,
    created_at: new Date(now).toISOString(), expires_at: new Date(now + days * 86400000).toISOString(),
    public_key: b64(await publicBytes(keys.publicKey)), salt: b64(crypto.getRandomValues(new Uint8Array(16))),
    iv: b64(crypto.getRandomValues(new Uint8Array(12))) };
  const aad = enc.encode(JSON.stringify(h));
  const key = await sharedKey(keys.privateKey, await importPublic(unb64(recipient.public_key, 91, 91)), unb64(h.salt, 16, 16), aad);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: unb64(h.iv, 12, 12), additionalData: aad }, key, plain);
  const bytes = enc.encode(JSON.stringify({ ...h, ciphertext: b64(new Uint8Array(encrypted)) }) + "\n");
  if (bytes.length > MAX_TRANSFER_FILE) fail("Aktarım dosyası çok büyük.");
  return { bytes, id: h.id, digest: await hash(bytes), recipient: h.recipient, expires_at: h.expires_at };
}
export async function openTransfer(bytes, recipient, { now = Date.now(), digest = "", id = "" } = {}) {
  bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (bytes.length > MAX_TRANSFER_FILE) fail("Aktarım dosyası en fazla 3 MB olabilir.");
  if (digest && (!DIGEST.test(digest) || await hash(bytes) !== digest)) fail("Bağlantının dosya doğrulaması uyuşmuyor.");
  let p;
  try { p = JSON.parse(dec.decode(bytes)); } catch { fail("Aktarım dosyası okunamadı."); }
  validateHeader(p, now);
  if (id && p.id !== id) fail("Bağlantı ve aktarım numarası uyuşmuyor.");
  if (!recipient?.private_key || p.recipient !== recipient.id)
    fail("Bu aktarım başka bir telefon/tarayıcı için hazırlanmış. Eşleştirdiğiniz uygulamada açın.");
  const aad = enc.encode(JSON.stringify(header(p)));
  const salt = unb64(p.salt, 16, 16), iv = unb64(p.iv, 12, 12), ct = unb64(p.ciphertext, 17, MAX_TRANSFER_PLAIN + 16);
  const peer = await importPublic(unb64(p.public_key, 91, 91));
  let plain;
  try {
    const key = await sharedKey(recipient.private_key, peer, salt, aad);
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: aad }, key, ct);
  } catch { fail("Aktarım açılamadı; dosya değiştirilmiş veya eşleştirme farklı."); }
  if (plain.byteLength > MAX_TRANSFER_PLAIN) fail("Aktarım içeriği çok büyük.");
  return { pkg: readHistoryPackage(dec.decode(plain)), id: p.id, expires_at: p.expires_at, recipient: p.recipient };
}
export function transferURL(base, id, digest) {
  if (!ID.test(id) || !DIGEST.test(digest)) fail("Aktarım bağlantısı geçersiz.");
  const u = new URL(base);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname)))
    fail("Aktarım için HTTPS adresi gerekli.");
  u.search = "";
  u.hash = "/gecmis?aktarim=" + id + "&ozet=" + digest;
  return u.href;
}
export function deliveryReference(value, base) {
  const u = new URL(value), expected = new URL(base);
  const allowedPaths = [expected.pathname, new URL("index.html", expected).pathname];
  if (u.origin !== expected.origin || !allowedPaths.includes(u.pathname) || u.search || u.username || u.password ||
      !u.hash.startsWith("#/gecmis?")) fail("Bu uygulamaya ait güvenli aktarım bağlantısını yapıştırın.");
  const q = new URLSearchParams(u.hash.slice(9));
  if (q.size !== 2 || !ID.test(q.get("aktarim")) || !DIGEST.test(q.get("ozet")))
    fail("Aktarım bağlantısı eksik veya geçersiz.");
  return { id: q.get("aktarim"), digest: q.get("ozet") };
}
// Fixed same-origin directory, bounded body, no redirects or credentials. Never fetch a pasted arbitrary URL.
export async function fetchTransfer(base, ref, { fetcher = fetch } = {}) {
  if (!ID.test(ref?.id) || !DIGEST.test(ref?.digest)) fail("Aktarım bağlantısı geçersiz.");
  const url = new URL("data/transfers/" + ref.id + ".json", base);
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
  let reader;
  try {
    const response = await fetcher(url.href, { signal: controller.signal, cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" });
    if (!response.ok) fail(response.status === 404 ? "Aktarım henüz yayımlanmamış veya kaldırılmış. Bağlantıyı tekrar kontrol edin." : "Aktarım indirilemedi; bağlantınızı kontrol edip tekrar deneyin.");
    if (Number(response.headers.get("content-length")) > MAX_TRANSFER_FILE) fail("Aktarım dosyası çok büyük.");
    if (!response.body) fail("Aktarım yanıtı okunamadı.");
    reader = response.body.getReader();
    const parts = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_TRANSFER_FILE) fail("Aktarım dosyası çok büyük.");
      parts.push(value);
    }
    const bytes = new Uint8Array(size); let pos = 0;
    for (const p of parts) { bytes.set(p, pos); pos += p.length; }
    if (await hash(bytes) !== ref.digest) fail("Bağlantının dosya doğrulaması uyuşmuyor.");
    return bytes;
  } finally {
    clearTimeout(timer);
    await reader?.cancel().catch(() => {});
  }
}

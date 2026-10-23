// Privacy guard: accidentally committed source packages/keys must never be served as transfer files.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { TRANSFER_FORMAT, MAX_TRANSFER_FILE } from "../js/secure-transfer.js";
const dir = new URL("../data/transfers/", import.meta.url);
let files = 0;
for (const name of readdirSync(dir)) {
  if (name === "README.md") continue;
  assert.match(name, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/, "Yalnız şifreli UUID aktarım dosyaları yayımlanabilir: " + name);
  const raw = readFileSync(new URL(name, dir));
  assert.ok(raw.length <= MAX_TRANSFER_FILE);
  const p = JSON.parse(raw);
  assert.equal(p.format, TRANSFER_FORMAT);
  assert.equal(p.id + ".json", name);
  assert.deepEqual(Object.keys(p).sort(), ["format", "id", "recipient", "suite", "created_at", "expires_at", "public_key", "salt", "iv", "ciphertext"].sort());
  for (const value of Object.values(p)) assert.equal(typeof value, "string");
  for (const field of ["public_key", "salt", "iv", "ciphertext"]) assert.match(p[field], /^[A-Za-z0-9_-]+$/);
  assert.match(p.recipient, /^[0-9a-f]{64}$/);
  assert.equal(p.suite, "ECDH-P256-HKDF-SHA256-AES256GCM");
  files++;
}
console.log(`secure-transfer-publication OK (${files} şifreli teslim dosyası; düz kaynak/anahtar dosyası yok)`);

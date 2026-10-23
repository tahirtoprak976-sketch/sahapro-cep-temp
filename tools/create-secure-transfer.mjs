#!/usr/bin/env node
// Never publish the source JSON or any private key. Only the encrypted output belongs on Pages.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { sealTransfer, transferURL, MAX_TRANSFER_PLAIN } from "../js/secure-transfer.js";
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  if (!["--pair-file", "--input", "--out-dir", "--base-url", "--days"].includes(process.argv[i]) || !process.argv[i + 1] || args.has(process.argv[i])) {
    console.error("Kullanım: node tools/create-secure-transfer.mjs --pair-file /özel/eslestirme.txt --input /özel/isler.json [--out-dir data/transfers] [--base-url https://…/] [--days 7]");
    process.exit(1);
  }
  args.set(process.argv[i], process.argv[i + 1]);
}
try {
  if (!args.has("--pair-file") || !args.has("--input")) throw Error("--pair-file ve --input gerekli.");
  const pair = await readFile(args.get("--pair-file"), "utf8");
  const raw = await readFile(args.get("--input"));
  if (raw.length > MAX_TRANSFER_PLAIN) throw Error("Kaynak dosya en fazla 2 MB olabilir.");
  const result = await sealTransfer(raw.toString("utf8"), pair, { days: Number(args.get("--days") || 7) });
  const link = transferURL(args.get("--base-url") || "https://tahirtoprak976-sketch.github.io/sahapro-cep-temp/", result.id, result.digest);
  const dir = resolve(args.get("--out-dir") || "data/transfers");
  await mkdir(dir, { recursive: true });
  const path = resolve(dir, result.id + ".json");
  await writeFile(path, result.bytes, { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ encrypted_file: path, recipient: result.recipient.slice(0, 12), expires_at: result.expires_at, url_after_publish: link }, null, 2));
} catch (e) { console.error("Aktarım hazırlanamadı: " + e.message); process.exitCode = 1; }

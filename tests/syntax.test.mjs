// Tüm uygulama dosyalarının GERÇEK sözdizimi denetimi (ES modülü olarak). Not: düz `node --check dosya.js`
// bu projede bozuk modülü de geçerli sayıyor; bu yüzden modül kipinde stdin'den denetlenir.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const root = new URL("..", import.meta.url).pathname;
const files = [...readdirSync(root + "js").filter((f) => f.endsWith(".js")).map((f) => "js/" + f), "sw.js"];
const bad = [];
for (const f of files) {
  const r = spawnSync(process.execPath, ["--input-type=module", "--check"], { input: readFileSync(root + f) });
  if (r.status !== 0) bad.push(f + ": " + String(r.stderr).split("\n").slice(0, 4).join(" "));
}
assert.deepEqual(bad, []);
// Denetleyicinin kendisi gerçekten çalışıyor mu (bozuk kod yakalanmalı)
assert.notEqual(spawnSync(process.execPath, ["--input-type=module", "--check"], { input: "import x from './y.js';\nconst a = f(g(1);\n" }).status, 0);
console.log(`syntax ok (${files.length} dosya)`);

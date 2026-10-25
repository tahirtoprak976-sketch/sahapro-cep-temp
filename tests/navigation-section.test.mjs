import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const read = (name) => readFileSync(new URL("../js/" + name, import.meta.url), "utf8");
const source = read("app.js");
const extract = (pattern, label, from = source) => {
  const matches = [...from.matchAll(pattern)];
  assert.equal(matches.length, 1, "Exactly one production " + label + " must be found");
  return matches[0][0];
};

// Execute the production constants, hash parser and renderer, not a copied
// classification algorithm. Boot/IndexedDB/browser side effects are not run.
const section = extract(/^const SECTION = \{[\s\S]*?^\};/gm, "SECTION");
const nav = extract(/^const NAV = \[[\s\S]*?^\];/gm, "NAV");
const parse = extract(/^function parseHash\(\) \{[\s\S]*?^\}/gm, "parseHash");
const render = extract(/^function renderNav\(first\) \{[\s\S]*?^\}/gm, "renderNav");
const element = { hidden: true, innerHTML: "" };
const location = { hash: "#/" };
const sandbox = {
  URLSearchParams,
  location,
  qs(selector) {
    if (selector === "#bottomnav") return element;
    if (selector === "#ai-fab") return null;
    throw Error("Unexpected renderer dependency: " + selector);
  },
};
runInNewContext(section + "\n" + nav + "\n" + parse + "\n" + render, sandbox);

const navTargets = ["#/", "#/isler", "#/akilli-asistan", "#/fisler", "#/finans", "#/daha"];
let checks = 0;
function expectSection(hash, target) {
  location.hash = hash;
  sandbox.renderNav(sandbox.parseHash().parts[0] || "");
  assert.equal(element.hidden, false, hash + ": navigation remains visible");
  const buttons = [...element.innerHTML.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(buttons.map((b) => /data-go="([^"]+)"/.exec(b)?.[1]), navTargets,
    hash + ": six existing navigation targets are unchanged");
  const active = buttons.filter((b) => /aria-current="page"/.test(b));
  assert.equal(active.length, 1, hash + ": exactly one active section");
  assert.match(active[0], new RegExp('data-go="' + target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '"'),
    hash + ": expected active section " + target);
  checks++;
}

// The actual home collection destination must land in Finance, including a
// customer detail and queries. Keep the test coupled to the displayed link.
assert.match(read("m-dash.js"), /data-go="#\/tahsilat"/);
for (const hash of ["#/tahsilat", "#/tahsilat/customer-1", "#/tahsilat/customer-1?from=2026-10-01"])
  expectSection(hash, "#/finans");

// Every destination in the production Finance hub's own tile list stays in
// Finance. The list is extracted, so adding another tile cannot escape coverage.
const hubItems = extract(/^  const items = \[[\s\S]*?^  \];/gm, "Finance hub items", read("m-finance.js"));
const hubRoutes = [...hubItems.matchAll(/\["(#\/[^\"]+)"/g)].map((m) => m[1]);
assert.ok(hubRoutes.length >= 10, "Finance hub route inventory was read");
for (const hash of hubRoutes) {
  expectSection(hash, "#/finans");
  expectSection(hash + "/record-1/edit?from=2026-10-01", "#/finans");
}

// Enterprise links are appended to Finance as well as More. Money ledgers
// belong to Finance; generic maintenance/tasks/day-close modules remain More.
const enterprise = read("enterprise.js");
const modulesSource = extract(/^export const MODULES = \{[\s\S]*?^\};/gm, "enterprise MODULES", enterprise);
const moduleRoutes = runInNewContext(modulesSource.replace(/^export /, "") + "\nObject.keys(MODULES)");
const genericRoutes = new Set(["bakimplani", "takipler", "gun-kapanis"]);
for (const route of moduleRoutes) {
  const expected = genericRoutes.has(route) ? "#/daha" : "#/finans";
  for (const tail of ["", "/new", "/record-1", "/record-1/edit?customer_id=C"])
    expectSection("#/" + route + tail, expected);
}
for (const route of ["maliyet", "saticicari", "yaslandirma", "banka-tahsilat", "banka-transfer", "banka-aktarim", "teklif-karsilastir", "teklif-sonuc"])
  for (const tail of ["", "/record-1?customer_id=C"])
    expectSection("#/" + route + tail, "#/finans");

// Legacy /finans/... aliases are parsed by the real parser; nested detail and
// edit paths must not change highlighting. Generic More modules stay untouched.
for (const route of ["kasa", "gider", "teklif", "fiyat", "hakedis", "cari", "sozlesmeler"])
  expectSection("#/finans/" + route + "/record-1/edit?customer_id=C", "#/finans");
for (const route of ["daha", "filo", "bakim", "personel", "musteriler", "santiyeler", "sayac", "vardiya", "zimmet", "dokum-hesap", "is-sozlesmeleri", "ayarlar", "unknown-route"])
  expectSection("#/" + route + "/record-1?tab=yedek", "#/daha");
for (const [hash, expected] of [["#/", "#/"], ["#/saha-akisi?date=2026-10-01", "#/"], ["#/isler/record-1", "#/isler"], ["#/gecmis", "#/isler"], ["#/akilli-asistan/soru", "#/akilli-asistan"], ["#/fisler/record-1", "#/fisler"], ["#/belgeler", "#/fisler"]])
  expectSection(hash, expected);

console.log(`navigation sections: ${checks} production parser/renderer cases passed; six tabs preserved; Finance descendants and generic More verified`);

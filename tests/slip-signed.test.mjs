// İmzalı dijital fiş: imza yalnız imzalanan içerikle basılır; eski kayıtta (içerik saklanmamış) imza güncel içerikle ASLA birleşmez
import assert from "node:assert/strict";
import { workSlipSpec, slipState, signedContent } from "../js/driver-core.js";
const names = { customers: { C: "Kaya İnşaat" }, sites: {}, vehicles: { V: "34 KM 101" }, personnel: { P: "Soner" }, dump_sites: {} };
const sig = { fake: "imza-blob" };
const flat = (spec) => JSON.stringify(spec.sections);
const hasSigImage = (spec) => spec.sections.some((x) => x.title === "Teslim Alan İmzası");
const base = { id: "W", date: "2026-10-16", customer_id: "C", vehicle_id: "V", personnel_id: "P", work_type: "Hafriyat Nakliye", unit: "Sefer", digital_slip_no: "DF-1", slip_receiver: "Mehmet", slip_signed_at: "2026-10-16T09:00:00Z" };
// 1) Yeni kayıt: imzalanan içerik saklı; miktar sonradan 6 olmuş → imzalı fiş 4'ü basar
const signed = signedContent({ dfs: "DF-1", sgt: "2026-10-16T09:00:00Z", date: "2026-10-16", cid: "C", vid: "V", wt: "Hafriyat Nakliye", q: 4, u: "Sefer" });
const wNew = { ...base, quantity: 6, slip_signed_content: signed };
let sp = workSlipSpec(wNew, names, { sigBlob: sig });
assert.ok(hasSigImage(sp) && /"4 sefer"/.test(flat(sp)) && !/"6 sefer"/.test(flat(sp)));
assert.deepEqual(slipState(wNew, [{ kind: "signature" }], names).changes, ["miktar 4 Sefer → 6 Sefer"]);
// revizyon: güncel içerik, imzasız, açıkça "imzalı fiş değildir"
sp = workSlipSpec(wNew, names, { sigBlob: sig, revision: true });
assert.ok(!hasSigImage(sp) && /"6 sefer"/.test(flat(sp)) && /REVİZYON/.test(sp.title) && /imzalı fiş DEĞİLDİR/.test(flat(sp)));
// 2) ESKİ kayıt (v3.9.04 öncesi): imzalanan içerik yok, iş sonradan 6'ya çevrilmiş → imza + güncel içerik birleştirilemez
const wOld = { ...base, quantity: 6 };
assert.equal(slipState(wOld, [{ kind: "signature" }]).kind, "legacy");
sp = workSlipSpec(wOld, names, { sigBlob: sig }); // doğrudan çağrılsa bile
assert.ok(!hasSigImage(sp), "eski imza güncel içerikle basılmamalı");
assert.ok(/doğrulanamıyor/.test(flat(sp)) && /REVİZYON/.test(sp.title));
// 3) orijinal PDF eklenmişse bulunur
assert.equal(slipState(wOld, [{ kind: "signature" }, { type: "application/pdf", name: "Is_Fisi_DF-1.pdf" }]).original.name, "Is_Fisi_DF-1.pdf");
// 4) imzasız taslak fiş: eskisi gibi taslak
const wDraft = { ...base, slip_signed_at: null, quantity: 3 };
assert.equal(slipState(wDraft, []).kind, "unsigned");
assert.ok(/TASLAK/.test(flat(workSlipSpec(wDraft, names, {}))));
console.log("slip-signed PASS");

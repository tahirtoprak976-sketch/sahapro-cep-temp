import assert from "node:assert/strict";
import { createRecipient, recipientCode, readRecipientCode, sealTransfer, openTransfer,
  transferURL, deliveryReference, transferDigest, fetchTransfer, MAX_TRANSFER_FILE, MAX_TRANSFER_PLAIN } from "../js/secure-transfer.js";
import { readHistoryPackage, initialHistoryChoices, prepareHistory, HISTORY_STORES } from "../js/history-core.js";
let checks = 0;
async function test(name, fn) { await fn(); checks++; console.log("PASS " + name); }
const now = Date.parse("2026-10-23T12:00:00Z"), base = "https://example.test/solo/";
const recipient = await createRecipient(), code = recipientCode(recipient), other = await createRecipient();
const pkg = { format: "SAHAPRO_HISTORY_V1", title: "TEST Geçmiş İşler", rows: [{ row_id: "TEST-transfer-1", kind: "work", date: "2026-09-01", customer: "TEST Müşteri", vehicle: "TEST Araç", work_type: "Moloz Nakliye", quantity: 2, unit: "Sefer", unit_price: 1000, kdv_rate: 20, kdv_included: false, settlement_status: "unbilled_unpaid", raw_message: "TEST 2 sefer", description: "TEST iş" }] };
const sealed = await sealTransfer(pkg, code, { now });
const mutate = async (fn) => { const p = JSON.parse(new TextDecoder().decode(sealed.bytes)); fn(p); return new TextEncoder().encode(JSON.stringify(p)); };
await test("eşleştirmede yalnız açık anahtar; özel anahtar dışarı çıkarılamaz", async () => {
  const p = await readRecipientCode(code); assert.equal(p.id, recipient.id); assert.equal(Object.keys(p).length, 2);
  assert.equal(recipient.private_key.extractable, false);
  await assert.rejects(() => crypto.subtle.exportKey("jwk", recipient.private_key));
  await assert.rejects(() => readRecipientCode("SPAK1.AA"));
});
await test("şifreli dosyada iş/müşteri adı yok; hedef telefon içeriği aynen açar", async () => {
  assert.ok(!new TextDecoder().decode(sealed.bytes).includes("TEST"));
  const r = await openTransfer(sealed.bytes, recipient, { now, id: sealed.id, digest: sealed.digest });
  assert.deepEqual(r.pkg, readHistoryPackage(pkg)); assert.equal(r.id, sealed.id);
});
await test("yanlış veya eksik telefon anahtarı reddedilir", async () => {
  await assert.rejects(() => openTransfer(sealed.bytes, other, { now }), /başka bir telefon/);
  await assert.rejects(() => openTransfer(sealed.bytes, null, { now }), /başka bir telefon/);
});
await test("doğru kimlik etiketi taklit edilse de farklı özel anahtar açamaz", async () => {
  await assert.rejects(() => openTransfer(sealed.bytes, { ...other, id: recipient.id }, { now }), /değiştirilmiş/);
});
await test("şifreli içerik ve doğrulanmış başlık değişikliği reddedilir", async () => {
  for (const f of [p => p.ciphertext = (p.ciphertext[0] === "A" ? "B" : "A") + p.ciphertext.slice(1),
    p => p.created_at = "2026-10-23T11:59:00.000Z", p => p.id = crypto.randomUUID(),
    p => p.salt = (p.salt[0] === "A" ? "B" : "A") + p.salt.slice(1)]) {
    await assert.rejects(() => mutate(f).then(b => openTransfer(b, recipient, { now })));
  }
});
await test("özet ve paket numarası uyuşmazlığı reddedilir", async () => {
  await assert.rejects(() => openTransfer(sealed.bytes, recipient, { now, digest: "a".repeat(64) }), /doğrulaması/);
  await assert.rejects(() => openTransfer(sealed.bytes, recipient, { now, id: crypto.randomUUID() }), /numarası/);
});
await test("süre sınırı, gelecekteki tarih ve bozuk şema reddedilir", async () => {
  await assert.rejects(() => openTransfer(sealed.bytes, recipient, { now: now + 7 * 86400000 }), /süresi dolmuş/);
  await assert.rejects(() => openTransfer(sealed.bytes, recipient, { now: now - 600001 }), /tarihi ileride/);
  await assert.rejects(() => sealTransfer(pkg, code, { now, days: 8 }), /1–7/);
  await assert.rejects(() => mutate(p => p.expires_at = "2027-01-01T00:00:00.000Z").then(b => openTransfer(b, recipient, { now })), /süre bilgisi/);
  await assert.rejects(() => mutate(p => p.suite = "none").then(b => openTransfer(b, recipient, { now })), /geçersiz/);
  await assert.rejects(() => mutate(p => p.customer = "plaintext").then(b => openTransfer(b, recipient, { now })), /beklenmeyen alan/);
  await assert.rejects(() => openTransfer(new TextEncoder().encode("<html>404</html>"), recipient, { now }), /okunamadı/);
});
await test("yalnız bu uygulamanın bağlantısı; başka origin/yol/query reddedilir", async () => {
  const link = transferURL(base, sealed.id, sealed.digest);
  assert.deepEqual(deliveryReference(link, base), { id: sealed.id, digest: sealed.digest });
  assert.deepEqual(deliveryReference(link.replace("/solo/#", "/solo/index.html#"), base), { id: sealed.id, digest: sealed.digest });
  for (const bad of [link.replace("example.test", "evil.test"), link.replace("/solo/", "/other/"), link + "&extra=1", link.replace("#/", "?x=1#/"), link.replace(sealed.id, "../evil")]) assert.throws(() => deliveryReference(bad, base));
  assert.throws(() => transferURL("http://example.test/", sealed.id, sealed.digest), /HTTPS/);
});
await test("indirme sabit origin/dizin kullanır, kimlik ve yönlendirme göndermez", async () => {
  const bytes = await fetchTransfer(base, sealed, { fetcher: async (url, opts) => {
    assert.equal(url, base + "data/transfers/" + sealed.id + ".json");
    assert.equal(opts.credentials, "omit"); assert.equal(opts.redirect, "error");
    assert.equal(opts.cache, "no-store"); assert.equal(opts.referrerPolicy, "no-referrer");
    return new Response(sealed.bytes);
  } }); assert.equal(await transferDigest(bytes), sealed.digest);
  await assert.rejects(() => fetchTransfer(base, sealed, { fetcher: async () => new Response("", { status: 404 }) }), /yayımlanmamış/);
  await assert.rejects(() => fetchTransfer(base, sealed, { fetcher: async () => new Response("wrong") }), /doğrulaması/);
});
await test("indirme boyut sınırı başlıkla ve akış sırasında uygulanır", async () => {
  await assert.rejects(() => fetchTransfer(base, sealed, { fetcher: async () => new Response("x", { headers: { "content-length": String(MAX_TRANSFER_FILE + 1) } }) }), /çok büyük/);
  await assert.rejects(() => fetchTransfer(base, sealed, { fetcher: async () => new Response(new Uint8Array(MAX_TRANSFER_FILE + 1)) }), /çok büyük/);
  await assert.rejects(() => openTransfer(new Uint8Array(MAX_TRANSFER_FILE + 1), recipient, { now }), /3 MB/);
});
await test("ödenmiş işler reddedilir; paket keyfi DB alanlarını taşıyamaz", async () => {
  await assert.rejects(() => sealTransfer({ ...pkg, rows: [{ ...pkg.rows[0], settlement_status: "paid" }] }, code, { now }), /ödenmemiş/);
  const unsafe = { ...pkg, rows: [{ ...pkg.rows[0], id: "forged", customer_id: "forged", customer_fuel_allowance_l: 999 }] };
  const safe = await openTransfer((await sealTransfer(unsafe, code, { now })).bytes, recipient, { now });
  assert.equal(safe.pkg.rows[0].customer_id, undefined); assert.equal(safe.pkg.rows[0].id, undefined);
  assert.equal(safe.pkg.rows[0].customer_fuel_allowance_l, undefined);
});
await test("2 MB içerik ve 1000 satır sınırı korunur", async () => {
  const large = { ...pkg, rows: Array.from({ length: 110 }, (_, i) => ({ ...pkg.rows[0], row_id: "large" + i, raw_message: "x".repeat(20000) })) };
  assert.ok(JSON.stringify(large).length > MAX_TRANSFER_PLAIN);
  await assert.rejects(() => sealTransfer(large, code, { now }), /2 MB/);
  await assert.rejects(() => sealTransfer({ ...pkg, rows: Array.from({ length: 1001 }, (_, i) => ({ ...pkg.rows[0], row_id: "r" + i })) }, code, { now }), /1000/);
});
await test("geçmiş fiyat/tarih korunur; yeni kart için onay gerekir", async () => {
  const p = (await openTransfer(sealed.bytes, recipient, { now })).pkg;
  const data = Object.fromEntries(HISTORY_STORES.map(s => [s, []])), choices = initialHistoryChoices(p);
  assert.equal(prepareHistory(p, choices, data, { today: "2026-10-23" }).ready, false);
  const plan = prepareHistory(p, choices, data, { today: "2026-10-23", allowNew: true });
  assert.equal(plan.ready, true); const w = plan.writes.work_records[0];
  assert.equal(w.date, "2026-09-01"); assert.equal(w.price_snapshot.unit_price, 1000);
  assert.equal(w.price_snapshot.total, 2400);
  data.work_records = [w];
  assert.equal(prepareHistory(p, choices, data, { today: "2026-10-23", allowNew: true }).ready, false);
  data.work_records = [{ ...w, deleted_at: new Date(now).toISOString() }];
  assert.equal(prepareHistory(p, choices, data, { today: "2026-10-23", allowNew: true }).ready, false);
});
console.log(`secure-transfer ${checks}/${checks} PASS`);

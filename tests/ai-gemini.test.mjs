import assert from 'node:assert/strict';
import { listModels, geminiChat, geminiReadReceipt } from '../js/ai-gemini.js';
const calls = [];
const mk = (payload, status = 200) => async (url, init) => { calls.push({ url, init }); return { ok: status < 400, status, json: async () => payload }; };
// model listesi: flash önce, gömme/tts modelleri hariç
const models = await listModels('K', mk({ models: [
  { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
  { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
  { name: 'models/gemini-2.5-flash-preview-tts', supportedGenerationMethods: ['generateContent'] },
] }));
assert.deepEqual(models.map((m) => m.id), ['gemini-2.5-flash', 'gemini-2.5-pro']);
assert.equal(calls[0].init.headers['x-goog-api-key'], 'K');
assert.ok(!calls[0].url.includes('key='), 'anahtar adrese yazılmamalı');
// sohbet: system → systemInstruction, assistant → model
await geminiChat([{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }, { role: 'assistant', content: 'A' }], { key: 'K', model: 'gemini-2.5-flash', fetchFn: mk({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }) });
const body = JSON.parse(calls.at(-1).init.body);
assert.equal(body.systemInstruction.parts[0].text, 'S'); assert.deepEqual(body.contents.map((c) => c.role), ['user', 'model']);
assert.equal(body.generationConfig.temperature, 0);
// fiş: doğrulama uygulanır (metinde olmayan toplam atılır)
const r = await geminiReadReceipt(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }), { key: 'K', model: 'gemini-2.5-flash', fetchFn: mk({ candidates: [{ content: { parts: [{ text: '```json\n{"text":"TOPLAM 4.500,00\\n14.10.2026","total":4500,"date":"2026-10-14","kdv":750}\n```' }] } }] }) });
assert.equal(r.fields.total, 4500); assert.equal(r.fields.date, '2026-10-14'); assert.equal(r.fields.kdv, undefined);
const b2 = JSON.parse(calls.at(-1).init.body);
assert.equal(b2.contents[0].parts[0].inlineData.data, 'AQID');
// hata mesajları anlaşılır
await assert.rejects(() => listModels('K', mk({ error: { message: 'API key not valid' } }, 400)), /anahtarı/);
await assert.rejects(() => listModels('K', mk({ error: { message: 'quota' } }, 429)), /kotası/);
console.log('ai-gemini PASS');
// kota 0 = model ücretsiz katmanda kapalı; çalışan modeli bul
const { findWorkingModel } = await import('../js/ai-gemini.js');
const seq = async (url) => /omni/.test(url)
  ? { ok: false, status: 429, json: async () => ({ error: { message: 'Quota exceeded for metric: x, limit: 0, model: gemini-omni-flash' } }) }
  : { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }) };
const fw = await findWorkingModel('K', [{ id: 'gemini-omni-flash' }, { id: 'gemini-2.5-flash' }], seq);
assert.equal(fw.id, 'gemini-2.5-flash'); assert.equal(fw.tried[0].reason, 'ücretsiz kota yok');
await assert.rejects(() => geminiChat([{ role: 'user', content: 'x' }], { key: 'K', model: 'gemini-omni-flash', fetchFn: seq }), /ücretsiz kullanımda kapalı/);
// sıralama: önizleme/omni sona
const m2 = await listModels('K', async () => ({ ok: true, status: 200, json: async () => ({ models: ['gemini-omni-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3-flash-preview'].map((n) => ({ name: 'models/' + n, supportedGenerationMethods: ['generateContent'] })) }) }));
assert.deepEqual(m2.map((m) => m.id), ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-omni-flash', 'gemini-3-flash-preview']);
console.log('ai-gemini-fallback PASS');
// otomatik model değiştirme + sayaç
{
  const { withModelFallback, usageToday } = await import('../js/ai-gemini.js');
  const meta = new Map([['gemini_key', 'K'], ['gemini_model', 'gemini-omni-flash'], ['gemini_consent', true], ['gemini_model_list', ['gemini-omni-flash', 'gemini-old-flash', 'gemini-3.8-flash']]]);
  const db = { metaGet: async (k) => meta.get(k), metaSet: async (k, v) => meta.set(k, v) };
  const fake = async (url) => /omni/.test(url)
    ? { ok: false, status: 429, json: async () => ({ error: { message: 'limit: 0' } }) }
    : /old/.test(url) ? { ok: false, status: 404, json: async () => ({ error: { message: 'models/gemini-old-flash is not found' } }) }
    : { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":1}' }] } }] }) };
  const { geminiJson } = await import('../js/ai-gemini.js');
  let switched = null;
  const out = await withModelFallback(db, (o) => geminiJson([{ text: 'x' }], o), { fetchFn: fake, onSwitch: (a, b) => (switched = [a, b]) });
  assert.deepEqual(out, { ok: 1 }); assert.equal(meta.get('gemini_model'), 'gemini-3.8-flash'); assert.deepEqual(switched, ['gemini-omni-flash', 'gemini-3.8-flash']);
  // v3.9.04: başarısız denemeler de sayılır (Google'ın ücretsiz sınırı da her isteği sayar)
  assert.deepEqual(await usageToday(db), { 'gemini-omni-flash': 1, 'gemini-old-flash': 1, 'gemini-3.8-flash': 1 });
  assert.equal(meta.get('gemini_usage').failed, 2);
  // anahtar hatası model değiştirmez
  meta.set('gemini_model', 'gemini-3.8-flash');
  const badKey = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'API key not valid' } }) });
  await assert.rejects(() => withModelFallback(db, (o) => geminiJson([{ text: 'x' }], { ...o, fetchFn: badKey })), /anahtar/);
  assert.equal(meta.get('gemini_model'), 'gemini-3.8-flash');
}
console.log('ai-gemini-autoswitch PASS');
// şablon reddedilirse şablonsuz tekrar
{
  const { geminiJson } = await import('../js/ai-gemini.js');
  const seen = [];
  const f = async (url, init) => { const b = JSON.parse(init.body); seen.push(!!b.generationConfig.responseJsonSchema);
    return b.generationConfig.responseJsonSchema ? { ok: false, status: 400, json: async () => ({ error: { message: 'Invalid JSON payload: unknown field responseJsonSchema' } }) }
      : { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] }) }; };
  assert.deepEqual(await geminiJson([{ text: 'x' }], { key: 'K', model: 'm', fetchFn: f, schema: { type: 'object' } }), { a: 1 });
  assert.deepEqual(seen, [true, false]);
}
console.log('ai-gemini-schema PASS');
// v3.9.04: kullanım sayacı her isteği sayar (başarısızlar dahil), gün değişince sıfırlanır
{
  const { usageAdd } = await import("../js/ai-gemini.js");
  let u = null;
  u = usageAdd(u, "2026-10-17", "gemini-2.5-flash", true);
  u = usageAdd(u, "2026-10-17", "gemini-2.5-flash", false);
  u = usageAdd(u, "2026-10-17", "gemini-2.0-flash", true);
  assert.deepEqual(u, { date: "2026-10-17", counts: { "gemini-2.5-flash": 2, "gemini-2.0-flash": 1 }, failed: 1 });
  assert.deepEqual(usageAdd(u, "2026-10-18", "gemini-2.5-flash", true), { date: "2026-10-18", counts: { "gemini-2.5-flash": 1 }, failed: 0 });
  console.log("usage-counter ok");
}
// v3.9.04 kapı 4: yerel sert günlük sınır — istekten ÖNCE ayrılır; dolu / izin yok / sayaç yazılamıyor → ağa çıkılmaz
{
  const { gatedFetch, withModelFallback, geminiJson, listModels, findWorkingModel } = await import("../js/ai-gemini.js");
  const mk = (extra = {}) => { const meta = new Map([["gemini_key", "K"], ["gemini_model", "gemini-3.8-flash"], ["gemini_consent", true], ["gemini_daily_limit", 3], ...Object.entries(extra)]);
    return { meta, metaGet: async (k) => meta.get(k) ?? null, metaSet: async (k, v) => meta.set(k, v) }; };
  let net = 0;
  const ok = async () => { net++; return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }], models: [{ name: "models/gemini-3.8-flash", supportedGenerationMethods: ["generateContent"] }] }) }; };
  const db = mk();
  for (let i = 0; i < 3; i++) await withModelFallback(db, (o) => geminiJson([{ text: "x" }], o), { fetchFn: ok });
  assert.equal(net, 3);
  await assert.rejects(() => withModelFallback(db, (o) => geminiJson([{ text: "x" }], o), { fetchFn: ok }), (e) => e.code === "LOCAL_LIMIT");
  assert.equal(net, 3, "sınır doluyken ağa istek çıkmadı");
  // model listesi ve çalışan model araması da bütçeden
  const db2 = mk({ gemini_daily_limit: 2 }); net = 0;
  const gf = gatedFetch(db2, ok);
  await listModels("K", gf); await findWorkingModel("K", [{ id: "gemini-3.8-flash" }], gf);
  await assert.rejects(() => listModels("K", gf), (e) => e.code === "LOCAL_LIMIT");
  assert.equal(net, 2);
  // izin kaldırıldı → yeni çağrı yok
  const db3 = mk({ gemini_daily_limit: 100 }); net = 0;
  const gf3 = gatedFetch(db3, ok);
  await listModels("K", gf3); db3.meta.set("gemini_consent", false);
  await assert.rejects(() => listModels("K", gf3), (e) => e.code === "NO_CONSENT");
  assert.equal(net, 1);
  // sayaç yazılamıyor → istek gönderilmez (kapalı hata)
  const db4 = mk({ gemini_daily_limit: 100 }); db4.metaSet = async () => { throw new Error("disk dolu"); }; net = 0;
  await assert.rejects(() => listModels("K", gatedFetch(db4, ok)), /disk dolu/);
  assert.equal(net, 0);
  // başarısız istek de bütçeden düşer
  const db5 = mk({ gemini_daily_limit: 100 }); const bad = async () => ({ ok: false, status: 503, json: async () => ({ error: { message: "busy" } }) });
  await assert.rejects(() => listModels("K", gatedFetch(db5, bad)));
  assert.equal(Object.values(db5.meta.get("gemini_usage").counts).reduce((a, b) => a + b, 0), 1); assert.equal(db5.meta.get("gemini_usage").failed, 1);
  console.log("local-limit ok");
}
// Üretim kodu Gemini'ye bütçesiz (ham fetch) istek göndermez: fetchFn yalnız ai-gemini.js içinde dolaşır
{
  const { readdirSync, readFileSync } = await import("node:fs");
  const dir = new URL("../js/", import.meta.url).pathname;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".js") && x !== "ai-gemini.js")) {
    const src = readFileSync(dir + f, "utf8");
    assert.ok(!/fetchFn\s*:/.test(src) && !/generativelanguage/.test(src), f + " Gemini'ye bütçe dışı yol açıyor");
  }
  console.log("no-ungated-path ok");
}

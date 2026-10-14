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

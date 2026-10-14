import assert from 'node:assert/strict';
import { writtenNumbers, parseAiJson, validateAi, aiSuggest, aiTargets } from '../js/ai-assist.js';
import { fixture } from './gold/fixture.mjs';
// plaka / tarih / saat rakamları miktar adayı değildir
const n = writtenNumbers('34 ABC 123 12/10 07:30 Ahmet Bey 6 gidiş, iki buçuk saat');
assert.ok(n.has(6) && n.has(2.5)); assert.ok(!n.has(34) && !n.has(123) && !n.has(12) && !n.has(7));
// JSON ayıklama: kod bloğu, tek nesne, bozuk çıktı
assert.equal(parseAiJson('```json\n{"rows":[{"quantity":6}]}\n```').rows[0].quantity, 6);
assert.equal(parseAiJson('{"quantity":3,"unit":"Sefer"}').rows[0].quantity, 3);
assert.equal(parseAiJson('bilmiyorum'), null);
// uydurma miktar reddedilir; plaka rakamı reddedilir; liste dışı birim/iş türü atılır
let v = validateAi('34 ABC 123 Ahmet Bey 6 gidiş moloz', { rows: [{ quantity: 7, unit: 'Sefer', work_type: 'Moloz Nakliye' }] });
assert.equal(v[0].quantity, null); assert.ok(v[0].rejected.some((x) => /yazmıyor/.test(x))); assert.equal(v[0].work_type, 'Moloz Nakliye');
v = validateAi('34 ABC 123 Ahmet Bey gidiş moloz', { rows: [{ quantity: 123, unit: 'Sefer' }] });
assert.equal(v[0].quantity, null);
v = validateAi('Ahmet Bey 6 gidiş', { rows: [{ quantity: 6, unit: 'kamyon', work_type: 'Uzay Taşımacılığı' }] });
assert.equal(v[0].quantity, 6); assert.equal(v[0].unit, null); assert.equal(v[0].work_type, null); assert.equal(v[0].rejected.length, 2);
v = validateAi('Ahmet Bey 6 gidiş', { rows: [{ quantity: 6, unit: 'sefer' }] });
assert.equal(v[0].unit, 'Sefer');
// uçtan uca: motor anlayamaz → sahte model önerir → doğrulanır; kayıt yazılmaz
const d = fixture();
const before = JSON.stringify(d);
const { analysis, suggestions } = await aiSuggest({ id: 'x', text: 'Ahmet Bey 34 ABC 123 6 gidiş yaptı', date: '2026-10-14' }, d,
  async () => '{"rows":[{"quantity":6,"unit":"Sefer","work_type":null}]}');
assert.ok(aiTargets(analysis).length >= 1);
assert.equal(suggestions[0].rows[0].quantity, 6); assert.equal(suggestions[0].rows[0].unit, 'Sefer');
assert.equal(JSON.stringify(d), before, 'veri değişmemeli');
// motor anladıysa model hiç çağrılmaz
let called = 0;
const r2 = await aiSuggest({ id: 'y', text: '34 ABC 123 Ahmet Bey 3 sefer moloz', date: '2026-10-14' }, d, async () => { called++; return '{}'; });
assert.equal(called, 0); assert.equal(r2.suggestions.length, 0);
// model hatası yakalanır
const r3 = await aiSuggest({ id: 'z', text: 'Ahmet Bey 34 ABC 123 6 gidiş yaptı', date: '2026-10-14' }, d, async () => { throw new Error('GPU kayboldu'); });
assert.equal(r3.suggestions[0].error, 'GPU kayboldu'); assert.equal(r3.suggestions[0].rows.length, 0);
assert.ok(writtenNumbers('on iki sefer').has(12)); assert.ok(writtenNumbers('yirmi beş ton').has(25));
console.log('ai-assist PASS');

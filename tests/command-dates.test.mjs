import assert from 'node:assert/strict';
import { dateWords, routeCommand } from '../js/command-router.js';
const range = (text, today) => dateWords(text, today)?.slice(0,2);
assert.deepEqual(range('bu hafta','2026-10-19'),['2026-10-19','2026-10-19']);
assert.deepEqual(range('geçen hafta','2026-10-19'),['2026-10-12','2026-10-18']);
assert.deepEqual(range('bu hafta','2026-10-18'),['2026-10-12','2026-10-18']);
assert.deepEqual(range('son 7 gün','2026-10-19'),['2026-10-13','2026-10-19']);
assert.deepEqual(range('son 7 günün işleri','2026-10-19'),['2026-10-13','2026-10-19']);
assert.deepEqual(range('geçen haftanın işleri','2026-01-01'),['2025-12-22','2025-12-28']);
assert.deepEqual(range('bu ay','2026-10-19'),['2026-10-01','2026-10-19']);
assert.deepEqual(range('geçen ay','2026-01-19'),['2025-12-01','2025-12-31']);
assert.deepEqual(range('geçen ay','2024-03-01'),['2024-02-01','2024-02-29']);
assert.deepEqual(range('bu yıl','2026-10-19'),['2026-01-01','2026-10-19']);
for (const text of ['2026-09-07 tarihli işler','7.9.2026 işleri','07/09/26 işleri','7.9 işleri'])
 assert.deepEqual(range(text,'2026-10-19'),['2026-09-07','2026-09-07'],text);
for (const text of ['31.02.2026','2026-02-29','32.01.2026','01.13.2026'])
 assert.deepEqual(range(text,'2026-10-19'),[null,null],text);
assert.deepEqual(range('29.02.2024','2026-10-19'),['2024-02-29','2024-02-29']);
assert.equal(dateWords('bugünkü işler','2026-10-19')[0],'2026-10-19');
assert.equal(dateWords('bugünlük açıklama','2026-10-19'),null);
const d={work_records:[],customers:[],vehicles:[],personnel:[],aliases:[]};
for (const [text,from,to] of [
 ['bu haftanın işlerini göster','2026-10-19','2026-10-19'],
 ['geçen haftanın işlerini göster','2026-10-12','2026-10-18'],
 ['bu ayın işlerini göster','2026-10-01','2026-10-19'],
 ['2026-09-07 tarihli işleri göster','2026-09-07','2026-09-07']])
 assert.equal(routeCommand(text,d,'2026-10-19').hash,`#/isler?from=${from}&to=${to}`);
const invalid=routeCommand('31.02.2026 tarihli işleri göster',d,'2026-10-19');
assert.equal(invalid.kind,'choose');assert.match(invalid.label,/Geçersiz tarih/);assert.equal(invalid.hash,undefined);
const before=JSON.stringify(d);
routeCommand('geçen ayın işini düzelt',d,'2026-10-19');
assert.equal(JSON.stringify(d),before);
console.log('calendar command dates: PASS');

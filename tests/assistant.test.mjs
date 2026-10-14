import assert from 'node:assert/strict';
import { validatePlan, similarCard, assistantContext } from '../js/assistant-core.js';
import { fixture } from './gold/fixture.mjs';
const d = { ...fixture(), suppliers: [{ id: 'S', name: 'Mesut Lastik' }] };
const today = '2026-10-14';
// tam ve doğru satır işaretli gelir
let v = validatePlan({ works: [{ date: '2026-10-14', customer_id: 'CMH', vehicle_id: 'T14', work_type: 'Makine Çalışması', quantity: 1, unit: 'Yevmiye' }] }, { message: 'Mahir bey 14 tonluk 1 yevmiye', d, today });
assert.equal(v.works[0].ok, true);
// araç adındaki 14 miktar sayılmaz
v = validatePlan({ works: [{ customer_id: 'CMH', vehicle_id: 'T14', work_type: 'Makine Çalışması', quantity: 14, unit: 'Saat' }] }, { message: 'Mahir bey 14 tonluk çalıştı', d, today });
assert.equal(v.works[0].ok, false); assert.ok(v.works[0].guessed);
// tahmin (öğlene kadar = 0.5) işaretsiz gelir, değer korunur
v = validatePlan({ works: [{ customer_id: 'CMH', vehicle_id: 'T14', work_type: 'Makine Çalışması', quantity: 0.5, unit: 'Yevmiye', guessed: true }] }, { message: 'Mahir bey 14 tonluk öğlene kadar çalıştı', d, today });
assert.equal(v.works[0].quantity, 0.5); assert.equal(v.works[0].ok, false);
// yeni müşteri: mesajda geçmeli; benzer kart varsa yeni açılmaz
v = validatePlan({ works: [{ new_customer: 'Kaya İnşaat', vehicle_id: 'V1', work_type: 'Moloz Nakliye', quantity: 3, unit: 'Sefer' }] }, { message: 'Kaya İnşaat 34 ABC 123 3 sefer moloz', d, today });
assert.equal(v.works[0].new_customer, 'Kaya İnşaat'); assert.deepEqual(v.newCustomers, ['Kaya İnşaat']); assert.equal(v.works[0].ok, true);
v = validatePlan({ works: [{ new_customer: 'Uydurma AŞ', vehicle_id: 'V1', work_type: 'Moloz Nakliye', quantity: 3, unit: 'Sefer' }] }, { message: 'Kaya İnşaat 34 ABC 123 3 sefer moloz', d, today });
assert.equal(v.works[0].new_customer, null); assert.equal(v.works[0].ok, false);
v = validatePlan({ works: [{ new_customer: 'Gumus Yapi', vehicle_id: 'V1', work_type: 'Moloz Nakliye', quantity: 3, unit: 'Sefer' }] }, { message: 'Gumus Yapi 34 ABC 123 3 sefer', d, today });
assert.equal(v.works[0].customer_id, 'CG'); assert.equal(v.newCustomers.length, 0);
assert.equal(similarCard('Öztürk Grup', d.customers).id, 'CO');
// listede olmayan kimlik atılır
v = validatePlan({ works: [{ customer_id: 'YOK', vehicle_id: 'YOK', work_type: 'Uçuş', quantity: 3, unit: 'km' }] }, { message: '3 sefer', d, today });
assert.equal(v.works[0].customer_id, null); assert.equal(v.works[0].vehicle_id, null); assert.equal(v.works[0].work_type, null); assert.equal(v.works[0].unit, null);
// gider: tutar fiş metninde olmalı; veresiye esnaf ister
v = validatePlan({ photo_texts: ['SİPARİŞ FİŞİ\nTOPLAM 500,00'], expenses: [{ amount: 500, category: 'Lastik', photo: 0, credit: true, supplier_id: 'S' }, { amount: 900, category: 'Lastik', photo: 0 }] }, { message: 'lastikçi fişi', d, today, photoCount: 1 });
assert.equal(v.expenses[0].ok, true); assert.equal(v.expenses[0].amount, 500); assert.equal(v.expenses[0].photo, 0);
assert.equal(v.expenses[1].ok, false);
v = validatePlan({ expenses: [{ amount: 500, credit: true }] }, { message: 'Mesut 500 veresiye', d, today });
assert.equal(v.expenses[0].ok, false);
// tarih: gelecek/uzak tarih bugüne çekilir ve söylenir
v = validatePlan({ works: [{ date: '2030-01-01', customer_id: 'CA', vehicle_id: 'V1', work_type: 'Moloz Nakliye', quantity: 3, unit: 'Sefer' }] }, { message: 'Ahmet Bey 34 ABC 123 3 sefer', d, today });
assert.equal(v.works[0].date, today); assert.ok(v.works[0].issues.some((x) => /Tarih/.test(x)));
// yakıt
v = validatePlan({ fuel: [{ vehicle_id: 'V1', liters: 70 }] }, { message: '34 ABC 123 70 lt mazot', d, today });
assert.equal(v.fuel[0].ok, true);
// bağlam: kartlar gönderilir
const ctx = assistantContext(d, today);
assert.ok(ctx.customers.some((c) => c[1] === 'Mahir Yapı')); assert.ok(ctx.aliases.some((a) => a[0] === 'Mahir Bey'));
console.log('assistant PASS');

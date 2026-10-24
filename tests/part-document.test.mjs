import assert from 'node:assert/strict';
import {normalizePartDocument,partDocumentFill,partDocumentIntent,assistantPartDocuments,separatePartDocumentPlan,partDocumentProperties} from '../js/part-document-core.js';
import {sparePartFields} from '../js/parts-core.js';
const text='Akü Garanti Belgesi\nMarka: TEST Model: X200\nSatıcı: TEST Petrol\nBelge no: G-100\nSeri no: TEST-A1 TEST-A2\nMiktar 2 adet akü\nBirim fiyat KDV dahil 3000 TL\nToplam 6000 TL\nFatura tarihi 07.09.2026\nGaranti başlangıç 07.09.2026\nGaranti bitiş 07.09.2028\nPlaka 34 GA 2261';
const raw={kind:'warranty',text,part_name:'Akü',brand:'TEST',model:'X200',seller:'TEST Petrol',invoice_no:'G-100',serial_numbers:['TEST-A1','TEST-A2'],quantity:2,unit_price:3000,total:6000,price_basis:'gross',purchase_date:'2026-09-07',warranty_start:'2026-09-07',warranty_until:'2028-09-07',plate:'34GA2261',evidence:{part_name:'Akü Garanti Belgesi',brand:'Marka: TEST',model:'Model: X200',seller:'Satıcı: TEST Petrol',invoice_no:'Belge no: G-100',serial_numbers:'Seri no: TEST-A1 TEST-A2',quantity:'Miktar 2 adet akü',unit_price:'Birim fiyat KDV dahil 3000 TL',purchase_date:'Fatura tarihi 07.09.2026',warranty_start:'Garanti başlangıç 07.09.2026',warranty_until:'Garanti bitiş 07.09.2028',plate:'Plaka 34 GA 2261'}};
const options={today:'2026-10-24',data:{vehicles:[{id:'V',plate:'34GA2261'}]}};
const before=JSON.stringify(raw),result=normalizePartDocument(raw,options);
assert.ok(result.candidates.length>=10);assert.ok(result.candidates.every(c=>c.verified),JSON.stringify(result));
assert.equal(JSON.stringify(raw),before,'normalization cannot mutate model output');
let fill=partDocumentFill(result,{seller:'Elle Satıcı',quantity:5},['seller','quantity']);
assert.equal(fill.updates.quantity,undefined);assert.equal(fill.updates.seller,undefined);assert.equal(fill.updates.serial_numbers,'TEST-A1\nTEST-A2');assert.deepEqual(fill.conflicts.sort(),['quantity','seller']);
assert.equal(fill.updates.vehicle_id,'V');assert.equal(fill.updates.warranty_until,'2028-09-07');
console.log('PASS battery warranty / invoice fields, two distinct serials, exact plate, evidence dates/amounts, purity and protecting manually entered values');

const missing=normalizePartDocument({...raw,text:'',evidence:{}},options);
assert.equal(missing.candidates.find(c=>c.field==='serial_numbers').value,'TEST-A1\nTEST-A2');
assert.equal(missing.candidates.find(c=>c.field==='date').value,'2026-09-07');
assert.equal(Object.keys(partDocumentFill(missing,{},[]).updates).length,0);assert.ok(missing.warnings.some(w=>/Ham belge/.test(w)));
const fake=normalizePartDocument({...raw,purchase_date:'2026-02-31',warranty_until:'2020-01-01'},options);assert.ok(!fake.candidates.some(c=>c.field==='date'));assert.ok(fake.candidates.filter(c=>c.field.startsWith('warranty_')).every(c=>!c.verified));
const manufactured=normalizePartDocument({kind:'warranty',text:'Üretim tarihi 07.09.2026\nGaranti süresi 24 ay',purchase_date:'2026-09-07',warranty_months:24,evidence:{purchase_date:'Üretim tarihi 07.09.2026'}},options);
assert.equal(manufactured.candidates.find(c=>c.field==='date').verified,false);assert.equal(manufactured.months,24);assert.ok(!manufactured.candidates.some(c=>c.field==='warranty_until'));
assert.equal(normalizePartDocument({text:'Akü garanti belgesi',warranty_months:24},options).months,null);
const wrongSerial=normalizePartDocument({...raw,serial_numbers:['G-100']},options);assert.equal(wrongSerial.candidates.find(c=>c.field==='serial_numbers').verified,false,'invoice number is not a serial number merely because it occurs on the same page');
assert.ok(!normalizePartDocument({kind:'warranty',text:'Garanti 24 ay',quantity:true,unit_price:true},options).candidates.some(c=>['quantity','unit_price'].includes(c.field)));
console.log('PASS missing raw OCR retains values unchecked, invalid/reversed dates, manufacturing date and duration cannot become purchase/start/end dates');

const total=normalizePartDocument({...raw,unit_price:6000,evidence:{...raw.evidence,unit_price:'Toplam 6000 TL KDV dahil'},text:text+'\nToplam 6000 TL KDV dahil'},options);
assert.equal(total.candidates.find(c=>c.field==='unit_price').verified,false);
assert.ok(!normalizePartDocument({...raw,price_basis:'net'},options).candidates.some(c=>c.field==='unit_price'));
assert.ok(!normalizePartDocument({...raw,unit_price:null},options).candidates.some(c=>c.field==='unit_price'),'total is never divided to invent a unit price');
const years=normalizePartDocument({...raw,quantity:24,evidence:{...raw.evidence,quantity:'Garanti 24 ay'},text:text+'\nGaranti 24 ay'},options);assert.equal(years.candidates.find(c=>c.field==='quantity').verified,false);
console.log('PASS gross/net/total/unit-price roles and warranty-month count are kept separate');

assert.ok(partDocumentIntent('2 tane akü aldım, garanti belgesini oku'));
assert.ok(partDocumentIntent('Yedek parça faturasını yükle'));
assert.ok(!partDocumentIntent('Garanti bankasından 20000 TL tahsilat'));
assert.ok(!partDocumentIntent('Kaya 2 sefer moloz yaptı'));
const plan={part_documents:[{...raw,photo:0}],expenses:[{photo:0,amount:6000},{photo:1,amount:25}],documents:[{photo:0,category:'Ruhsat'}],tickets:[{photo:1}],photo_texts:['akü garanti','başka']};
const split=separatePartDocumentPlan(plan,2);assert.equal(split.rows.length,1);assert.equal(split.plan.expenses.length,1);assert.equal(split.plan.expenses[0].photo,1);assert.equal(split.plan.documents.length,0);assert.equal(split.plan.tickets.length,1);assert.equal(plan.expenses.length,2);
const legacy=separatePartDocumentPlan({photo_texts:[text],documents:[{photo:0,category:'Garanti'}],expenses:[{photo:0,amount:6000}]},1);assert.equal(legacy.rows.length,1);assert.equal(legacy.plan.expenses.length,0);assert.equal(legacy.plan.documents.length,0);assert.equal(legacy.plan.part_documents.length,1);assert.equal(normalizePartDocument(legacy.rows[0]).candidates.length,0,'legacy fallback proposes a re-read; never invents extracted fields');
const isolated=assistantPartDocuments({part_documents:[{photo:0,kind:'warranty',serial_numbers:['OTHER-SERIAL']}],photo_texts:['Akü garanti belge A','OTHER-SERIAL']},2);
assert.equal(normalizePartDocument(isolated.rows[0]).candidates.find(c=>c.field==='serial_numbers').verified,false,'other photo text cannot verify this serial');
assert.equal(assistantPartDocuments({part_documents:[{photo:9,kind:'warranty'}]},2).unmatched,1);
assert.throws(()=>assistantPartDocuments({part_documents:Array(9).fill(raw)},10),/8 parça/);
assert.throws(()=>assistantPartDocuments({part_documents:{}},1),/geçersiz/);
assert.ok(partDocumentProperties().evidence.properties.warranty_start);
for(const value of [true,[2],{}]){assert.throws(()=>sparePartFields({vehicles:[{id:'V'}]},{vehicle_id:'V',date:'2026-09-07',description:'Akü',quantity:value,unit_price:1000}),/sayısal/);assert.throws(()=>sparePartFields({vehicles:[{id:'V'}]},{vehicle_id:'V',date:'2026-09-07',description:'Akü',quantity:2,unit_price:value}),/sayısal/);}
console.log('part-document PASS: explicit parts intent, isolated evidence, safe classification, no double expense/document and bounded schema');

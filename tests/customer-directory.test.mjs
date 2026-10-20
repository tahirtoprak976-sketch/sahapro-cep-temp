import assert from 'node:assert/strict';
import {customerDirectory,filterCustomerDirectory,customerDirectoryTotals} from '../js/customer-directory.js';
const d={customers:[{id:'p',name:'Ulaş Rondela'},{id:'c',name:'Çatıcı',parent_customer_id:'p'},{id:'other',name:'Diğer Firma'},{id:'c2',name:'Çatıcı',parent_customer_id:'other'},{id:'fuel',name:'Mazot Müşteri',fuel_rules:[{per:75,unit:'Sefer'}]},{id:'advance',name:'Alacaklı Müşteri'},{id:'inactive',name:'Pasif',active:false},{id:'deleted',name:'Silinen',deleted_at:'x'},{id:'internal',name:'Kendi Depo',internal:true}],work_records:[
  {id:'parent-work',customer_id:'p',date:'2026-10-01',quantity:1,price_snapshot:{amount:100.25}},
  {id:'child-work',customer_id:'c',date:'2026-10-19',quantity:1,price_snapshot:{amount:2500.50}},
  {id:'missing',customer_id:'c',date:'2026-10-20',quantity:1},
  {id:'zero',customer_id:'c',date:'2026-10-20',quantity:1,price_snapshot:{amount:0}},
  {id:'included',customer_id:'c',date:'2026-10-20',price_snapshot:{price_source:'Sözleşmeye dahil'}},
  {id:'billed',customer_id:'c',date:'2026-10-20'},
  {id:'other-child',customer_id:'c2',date:'2026-09-01',quantity:1,price_snapshot:{amount:700}},
  {id:'fuel-work',customer_id:'fuel',date:'2026-10-20',quantity:5,unit:'Sefer',customer_fuel_allowance_l:375},
  {id:'deleted-work',customer_id:'p',date:'2026-10-20',quantity:1,price_snapshot:{amount:9999},deleted_at:'x'}
],cari_movements:[{id:'payment',customer_id:'c',date:'2026-10-20',type:'Tahsilat',amount:-500.25},{id:'bill',customer_id:'c',date:'2026-10-20',type:'Hakedis',amount:120},{id:'advance-pay',customer_id:'advance',date:'2026-10-20',type:'Tahsilat',amount:-300}],hakedis:[{id:'hak',status:'Kesinleşti',items:[{work_record_id:'billed'}]}],fuel_records:[{id:'fr',customer_id:'fuel',fuel_source:'Müşteri Verdi',liters:300},{id:'extra',customer_id:'advance',fuel_source:'Müşteri Verdi',liters:50}]};
const before=JSON.stringify(d),rows=customerDirectory(d),get=id=>rows.find(r=>r.customer.id===id);
assert.equal(rows.length,7);
assert.equal(get('p').balance,100.25,'parent never includes child balance');
assert.equal(get('c').balance,2120.25,'cents, collection and finalized invoice remain intact');
assert.equal(get('c2').balance,700,'same-named subcontractor is a separate account');
assert.equal(get('c').unpriced,1,'explicit zero, included, finalized and fuel work are not missing prices');
assert.equal(get('c').lastWork.date,'2026-10-20');
assert.equal(get('c').parent.name,'Ulaş Rondela');
assert.equal(get('fuel').balance,0);
assert.equal(get('fuel').fuel.balance,75);
assert.equal(get('advance').fuel.balance,-50,'received-only fuel balance is visible');
assert.deepEqual(filterCustomerDirectory(rows,{q:'Ulaş'}).map(r=>r.customer.id).sort(),['c','p']);
assert.deepEqual(filterCustomerDirectory(rows,{q:'Diğer Firma',view:'subcontractor'}).map(r=>r.customer.id),['c2']);
assert.deepEqual(filterCustomerDirectory(rows,{view:'unpriced'}).map(r=>r.customer.id),['c']);
assert.deepEqual(filterCustomerDirectory(rows,{view:'fuel'}).map(r=>r.customer.id),['fuel']);
assert.deepEqual(filterCustomerDirectory(rows,{view:'inactive'}).map(r=>r.customer.id),['inactive']);
assert.equal(filterCustomerDirectory(rows,{sort:'balance'})[0].customer.id,'c');
assert.equal(filterCustomerDirectory(rows,{sort:'recent'}).at(-1).lastWork,null);
assert.deepEqual(customerDirectoryTotals(rows),{receivable:2920.5,credit:300,fuel:75,fuelExcess:50});
assert.deepEqual(customerDirectoryTotals([]),{receivable:0,credit:0,fuel:0,fuelExcess:0});
assert.equal(JSON.stringify(d),before,'directory and all filters are read-only');
console.log('customer directory: separate child accounts, TL/litre separation, precise cents, missing prices, filters, sorting and no mutation OK');

import assert from 'node:assert/strict';
import {priceApplicationRows,priceRuleReview,priceApplicationIntent} from '../js/price-rule-core.js';
import {financePeriod} from '../js/finance-period.js';
import {financePeriodSummary,monthlySeries} from '../js/finance-chart.js';
const rule={customer_id:'A',site_id:'T',vehicle_group:'VAN',work_type:'Moloz Nakliye',unit:'Sefer',price:7000};
const w=(id,p={})=>({id,customer_id:'A',site_id:'T',vehicle_id:'V',work_type:'Moloz Nakliye',unit:'Sefer',quantity:1,date:'2026-10-27',...p});
const d={customers:[{id:'A',name:'Ahmet Bey'}],sites:[{id:'T',name:'Tarabya',customer_id:'A'},{id:'K',name:'Kemer',customer_id:'A'}],vehicles:[{id:'V',type:'Kamyonet',name:'34EC1353'},{id:'D',type:'Kamyon',name:'34GA2261'}],work_records:[w('empty'),w('old',{quantity:2,price_snapshot:{unit_price:3000,amount:6000}}),w('origin',{site_id:null,from_place:'Tarabya'}),w('text',{site_id:null,description:'Tarabya moloz alındı'}),w('wrong',{site_id:'K'}),w('truck',{vehicle_id:'D'}),w('claim'),w('slip',{site_id:null,from_place:'Tarabya',slip_id:'S'})],hakedis:[{id:'H',status:'Taslak',items:[{work_record_id:'claim'}]}],slips:[{id:'S',status:'İmzalandı',work_record_id:'slip'}],price_book:[]};
const rows=priceApplicationRows(d,rule),by=id=>rows.find(x=>x.work.id===id);
assert.equal(by('origin').suggested,true);assert.equal(by('text').status,'bind');assert.equal(by('text').suggested,false);assert.match(by('claim').reason,/Hakediş/);assert.match(by('slip').reason,/dijital fiş/);
const opts={unpriced:true,differ:true,bind_ids:['origin','text'],applyExisting:true},r=priceRuleReview(d,rule,opts);
assert.deepEqual(r.todo.map(w=>w.id),['empty','old','origin','text']);assert.deepEqual(r.bindings,['origin','text']);
for(const id of ['wrong','truck','claim','slip','missing'])assert.throws(()=>priceRuleReview(d,rule,{...opts,bind_ids:[id]}),/kapsam dışında/);
assert.throws(()=>priceRuleReview(d,rule,{...opts,bind_ids:['origin','origin']}));
const changed=structuredClone(d);changed.work_records.find(w=>w.id==='origin').site_id='K';assert.throws(()=>priceRuleReview(changed,rule,opts));
const none={...d,work_records:[w('wrong',{site_id:'K'})]};assert.throws(()=>priceRuleReview(none,rule,{unpriced:true,differ:true,applyExisting:true}),/fiyatı değişecek iş yok/);
assert.equal(priceRuleReview(none,rule,{unpriced:false,differ:false,applyExisting:false}).todo.length,0);
assert.equal(priceApplicationIntent('birim fiyat sefer başına 7000 TL yapalım'),true);assert.equal(priceApplicationIntent('yalnız fiyat listesine 7000 TL uygula'),false);
const finance={work_records:[w('oct',{price_snapshot:{unit_price:7000,amount:7000}}),w('sep',{date:'2026-09-15',price_snapshot:{unit_price:3000,amount:3000}}),w('future',{date:'2026-11-03',price_snapshot:{unit_price:999,amount:999}})],cash_records:[{id:'C',date:'2026-10-28',cash_type:'Müşteriden Para Alındı',amount:1000}],expense_records:[{id:'E',date:'2026-10-28',amount:500}]};
const period=financePeriod(finance,{},'2026-11-01');assert.equal(period.month,'2026-10');assert.equal(period.automatic,true);assert.equal(period.summary.work,7000);assert.equal(period.summary.cost,500);assert.equal(period.summary.collected,1000);
const current=financePeriod(finance,{period:'month'},'2026-11-01');assert.equal(current.summary.work,0);assert.equal(current.automatic,false);
assert.equal(financePeriod(finance,{period:'all'},'2026-11-01').summary.work,10000);
assert.equal(financePeriod(finance,{month:'2026-09'},'2026-11-01').summary.work,3000);
assert.equal(financePeriod(finance,{month:'2027-01'},'2026-11-01').invalid,true);
assert.equal(financePeriodSummary(finance,{from:'2026-10-01',to:'2026-10-31'}).profit,monthlySeries(finance,{today:'2026-10-31',months:1})[0].profit);
console.log('PASS actual price application: priced + unpriced + explicit site binding; no-op refused; signed/claim/wrong scopes; finance empty-month fallback and explicit periods exclude future rows');

assert.equal(priceApplicationIntent('Delta Yapı için fiyat listesi 7000 TL'),false);

for(const snapshot of [{unit_price:7000,amount:0},{unit_price:7000,amount:NaN},{unit_price:7000,amount:7000,kdv_included:true}]){
 const stale={...d,work_records:[w('stale',{price_snapshot:snapshot})]};
 assert.equal(priceRuleReview(stale,rule,{unpriced:true,differ:true,applyExisting:true}).todo[0].id,'stale','same unit price with stale amount/basis must be repaired, not labelled already correct');
}

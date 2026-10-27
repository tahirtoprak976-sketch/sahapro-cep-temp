import assert from 'node:assert/strict';
import {priceHealth} from '../js/price-health.js';
import {vehicleKpis,customerKpis,businessReview} from '../js/expert-core.js';
import {businessFacts} from '../js/assistant-core.js';
import {morningBrief} from '../js/brief.js';
import {freezeDumpEstimate} from '../js/dump-estimate.js';
const date='2026-10-20',today='2026-10-26';
const d={customers:[{id:'C',name:'TEST customer'}],vehicles:[{id:'V',name:'TEST vehicle',load_ton:20}],dump_sites:[{id:'D',name:'TEST dump',fee:100,fee_unit:'Ton'}],work_records:Array.from({length:5},(_,i)=>({id:'W'+i,date,customer_id:'C',vehicle_id:'V',dump_site_id:'D',unit:'Sefer',quantity:1,work_type:'TEST haul',price_snapshot:{unit_price:6000,amount:6000}})),fuel_records:[{id:'F',date,vehicle_id:'V',liters:50,total:2500}]};
const opts={from:'2026-10-01',to:today,today};
const before=JSON.stringify(d);
const p=priceHealth(d,{today})[0];assert.equal(p.state,'?');assert.equal(p.margin,null);assert.equal(p.contrib,null);assert.equal(p.suggest,null);assert.equal(p.dumpUnknown,5);assert.equal(p.costIncomplete,true);assert.match(p.why,/doğrulanmadı/);
const v=vehicleKpis(d,opts)[0],c=customerKpis(d,opts)[0],r=businessReview(d,opts);
assert.equal(v.kar_TL,null);assert.equal(v.gunluk_getiri_TL,null);assert.equal(v.maliyet_dogrulanmadi,true);assert.equal(v.dokum_bilinmeyen_is,5);assert.equal(c.dokum_sonrasi_TL,null);assert.equal(c.sefer_basi_net_TL,null);assert.equal(c.maliyet_dogrulanmadi,true);assert.equal(r.ozet.kar_TL,null);assert.equal(r.ozet.maliyet_dogrulanmadi,true);assert.ok(r.bulgular.some(x=>x.kind==='maliyet'));assert.equal(JSON.stringify(d),before,'advice is read-only');
const facts=await businessFacts(d,today);assert.equal(facts.aylik.at(-1).tahmini_kar_TL,null);assert.equal(facts.aylik.at(-1).maliyet_dogrulanmadi,true);
const brief=morningBrief(d,{today});assert.equal(brief.facts.month_profit,null);assert.equal(brief.facts.cost_incomplete,true);assert.match(brief.text,/döküm maliyeti eksik/);
// Known new estimates still support explicitly provisional cost analysis; unknowns cannot improve it.
for(const w of d.work_records)w.dump_estimate_snapshot=freezeDumpEstimate(w,d.dump_sites[0],d.vehicles[0]);
assert.equal(priceHealth(d,{today})[0].costIncomplete,false);assert.equal(priceHealth(d,{today})[0].dump,2000);assert.equal(vehicleKpis(d,opts)[0].kar_TL,17500);assert.equal(customerKpis(d,opts)[0].dokum_sonrasi_TL,20000);
console.log('dump-cost-advice PASS: unknown legacy costs cannot become a healthy margin, price suggestion or confident profit');

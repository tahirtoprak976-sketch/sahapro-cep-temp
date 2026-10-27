// RT-03: synthetic legacy data only. Set BASELINE_PROOF=1 only on unchanged v3.9.74.
import assert from 'node:assert/strict';
import {todayStr} from '../js/core.js';
import {jobCosts} from '../js/job-cost.js';
import {jobReport} from '../js/job-core.js';
import {dashboardHtml} from '../js/job-dash.js';
import {screen as jobScreen} from '../js/job-ui.js';
import {dumpFee} from '../js/dump-fees.js';
import {freezeDumpEstimate} from '../js/dump-estimate.js';
import {buildReport,reportSpec,reportCsv,forAudience} from '../js/report-core.js';
import {vehicleKpis} from '../js/expert-core.js';
import {businessFacts} from '../js/assistant-core.js';

const date=todayStr(),site={id:'S',name:'TEST cost contract',customer_id:'C',deal:{basis:'Sefer',price:5000,kdv_rate:0,kdv_included:false,start_date:date,status:'Açık'}};
const data=()=>({sites:[structuredClone(site)],customers:[{id:'C',name:'TEST customer'}],vehicles:[{id:'V',name:'TEST truck',type:'Kamyon',load_ton:20,assignee_id:'P'},{id:'V2',name:'TEST other truck',type:'Kamyon'}],personnel:[{id:'P',name:'TEST person',daily_wage:100}],dump_sites:[{id:'D',name:'TEST dump',fee:100,fee_unit:'Ton',fee_effective_from:date}],
 work_records:[{id:'W',date,vehicle_id:'V',personnel_id:'P',customer_id:'C',site_id:'S',dump_site_id:'D',unit:'Sefer',quantity:3,description:'TEST original description',price_snapshot:{amount:15000,unit_price:5000,kdv_rate:0,kdv_included:false}}],
 fuel_records:[{id:'F',date,vehicle_id:'V',liters:60,total:3000,unit_price:50}],dump_entries:[],expense_records:[],pending_fuel_records:[]});
const opts={today:date,from:date,to:date};
const cost=d=>jobCosts(d,site,jobReport(d,site,{today:date}),{today:date,fuelRef:50});
const vehicleReport=d=>buildReport(d,{k:'arac',...opts});
const remain=r=>r.kpis.find(x=>x[0]==='Kalan (gelir − giderler)')[1];
const root=()=>{const nodes=new Map();return {value:'',innerHTML:'',addEventListener(){},querySelector(key){if(!nodes.has(key))nodes.set(key,root());return nodes.get(key);}};};
async function listHtml(d){const r=root();await jobScreen({root:r,parts:['is-sozlesmeleri'],query:{},db:{dumpAll:async()=>d,metaGet:async()=>50}});return r.innerHTML;}
const d=data(),before=JSON.stringify(d),unknown=cost(d),r=vehicleReport(d);
assert.equal(dumpFee(d,d.work_records[0]).remaining_estimated_amount,null);
if(process.env.BASELINE_PROOF==='1'){
 assert.equal(unknown.cost,3100);assert.equal(unknown.profit,11900);assert.equal(unknown.costIncomplete,false);
 assert.match(dashboardHtml(unknown,jobReport(d,site,{today:date}),site.deal),/Kârda/);
 assert.match(await listHtml(d),/kâr ≈ 11\.900/);assert.match(remain(r),/12\.000/);
 console.log('BASELINE ONLY RT-03 reproduced: unknown dump still claims 11900 job profit, green Kârda and numeric PDF remainder');
 process.exit(0);
}
function incomplete(c){assert.equal(c.costIncomplete,true);for(const key of ['profit','margin','profitPerM3','costPerM3'])assert.equal(c[key],null,key);}
incomplete(unknown);assert.equal(unknown.cost,3100);assert.equal(unknown.knownCostSubtotal,3100);assert.equal(unknown.dumpUnknown,1);
assert.equal(unknown.costIncompleteReason,'döküm maliyeti eksik');assert.deepEqual(unknown.costIncompleteReasons.map(x=>x.code),['dump_unknown']);
const html=dashboardHtml(unknown,jobReport(d,site,{today:date}),site.deal);
assert.match(html,/Hesaplanamadı/);assert.match(html,/döküm maliyeti eksik/);assert.match(html,/Bilinen gider ara toplamı/);assert.doesNotMatch(html,/Kârda|Zararda|11\.900|Yakıt mutabakat/);
const listing=await listHtml(d);assert.match(listing,/Hesaplanamadı — döküm maliyeti eksik/);assert.doesNotMatch(listing,/kâr ≈|yakıt mutabakat/);
assert.equal(r.costIncomplete,true);assert.equal(r.knownCostSubtotal,3000);assert.match(remain(r),/Hesaplanamadı — döküm maliyeti eksik/);
assert.match(r.tables.find(x=>x.title==='Araç bazında özet').rows[0].at(-1),/Hesaplanamadı — döküm maliyeti eksik/);
assert.match(JSON.stringify(reportSpec(r)),/Hesaplanamadı — döküm maliyeti eksik/);assert.match(reportCsv(r),/Hesaplanamadı — döküm maliyeti eksik/);
assert.doesNotMatch(JSON.stringify(forAudience(r,'customer')),/yakıt mutabakat/);
assert.equal(buildReport(d,{k:'arac',id:'V2',...opts}).costIncomplete,false,'other vehicle scope stays complete');
const vk=vehicleKpis(d,opts)[0];assert.equal(vk.kar_TL,null);assert.equal(vk.maliyet_dogrulanmadi,true);
const facts=await businessFacts(d,date);assert.equal(facts.aylik.at(-1).tahmini_kar_TL,null);assert.equal(facts.aylik.at(-1).maliyet_dogrulanmadi,true);
assert.equal(JSON.stringify(d),before,'all readers preserve original jobs, descriptions and costs');
// A confirmed partial receipt cannot turn the unknown remainder into zero.
const partial=data();partial.dump_entries=[{id:'R',kind:'RECEIPT',date,work_record_id:'W',dump_site_id:'D',vehicle_id:'V',amount:2000,trips:1,tonnage:20,payer:'company_account'}];
incomplete(cost(partial));assert.equal(cost(partial).knownCostSubtotal,5100);assert.equal(cost(partial).costs.find(x=>x.key==='dokum').tl,2000);
// Once every trip has a confirmed receipt, ordinary estimated profit returns.
partial.dump_entries[0].trips=3;partial.dump_entries[0].amount=6000;
assert.equal(cost(partial).costIncomplete,false);assert.equal(cost(partial).profit,5900);assert.equal(cost(partial).margin,39);
assert.match(dashboardHtml(cost(partial),jobReport(partial,site,{today:date}),site.deal),/Kârda/);
// Known saved assumptions remain provisional but complete; zero/free and customer-paid are not unknown.
const known=data();known.work_records[0].dump_estimate_snapshot=freezeDumpEstimate(known.work_records[0],known.dump_sites[0],known.vehicles[0]);
assert.equal(cost(known).costIncomplete,false);assert.equal(cost(known).profit,5900);
known.dump_entries=[{...partial.dump_entries[0],trips:4}];incomplete(cost(known));
const free=data();free.dump_sites[0].fee=0;free.work_records[0].dump_estimate_snapshot=freezeDumpEstimate(free.work_records[0],free.dump_sites[0],free.vehicles[0]);assert.equal(cost(free).costIncomplete,false);assert.equal(cost(free).profit,11900);
const paid=data();paid.work_records[0].dump_payer='customer';assert.equal(cost(paid).costIncomplete,false);
const both=data();both.pending_fuel_records=[{id:'PF',date,vehicle_id:'V',liters:10,reconciliation_status:'pending'}];incomplete(cost(both));assert.deepEqual(cost(both).costIncompleteReasons.map(x=>x.code),['fuel_pending','dump_unknown']);assert.match(cost(both).costIncompleteReason,/yakıt mutabakat.*döküm maliyeti/);
const fuelOnly=data();fuelOnly.work_records[0].dump_site_id=null;fuelOnly.pending_fuel_records=both.pending_fuel_records;assert.equal(cost(fuelOnly).costIncompleteReason,'yakıt mutabakat bekliyor');
// Customer-facing work/account reports remain byte-for-byte the same when only internal cost certainty changes.
const completeDump=data();completeDump.work_records[0].dump_estimate_snapshot=freezeDumpEstimate(completeDump.work_records[0],completeDump.dump_sites[0],completeDump.vehicles[0]);
for(const k of ['musteri','arac']) {
 const id=k==='musteri'?'C':'V';
 assert.deepEqual(reportSpec(buildReport(d,{k,id,...opts}),{audience:'customer'}),reportSpec(buildReport(completeDump,{k,id,...opts}),{audience:'customer'}));
 assert.equal(reportCsv(buildReport(d,{k,id,...opts}),'customer'),reportCsv(buildReport(completeDump,{k,id,...opts}),'customer'));
}
// Mixed payer coverage: only company receipt adds cost; customer-paid trips finish coverage.
const mixed=data();mixed.dump_entries=[{...partial.dump_entries[0],id:'RC',trips:1,amount:2000},{...partial.dump_entries[0],id:'RX',trips:2,amount:4000,payer:'customer'}];
assert.equal(cost(mixed).costIncomplete,false);assert.equal(cost(mixed).knownCostSubtotal,5100);assert.equal(cost(mixed).profit,9900);
// Explicit unknown metraj must not turn a known subtotal into a whole-job income or profit estimate.
const volume=data();volume.sites[0].deal={...site.deal,basis:'m³',price:100,material:'toprak'};
volume.work_records=[{...volume.work_records[0],id:'WT',quantity:2,tonnage:25,tonnage_scope:'total',dump_site_id:null},{...volume.work_records[0],id:'WU',quantity:2,tonnage:25,tonnage_scope:'unknown',dump_site_id:null}];
const vol=jobReport(volume,volume.sites[0],{today:date}),vc=jobCosts(volume,volume.sites[0],vol,{today:date,fuelRef:50});
assert.equal(vol.est,12.8);assert.equal(vc.costIncomplete,false);assert.equal(vc.revenueIncomplete,true);assert.equal(vc.profitIncomplete,true);
for(const key of ['revenue','income','profit','margin','profitPerM3','costPerM3'])assert.equal(vc[key],null,key);
assert.equal(vc.targetEst,false);assert.equal(vc.targetGross,0);assert.match(vc.profitIncompleteReason,/tonaj kapsamı/);
assert.doesNotMatch(dashboardHtml(vc,vol,volume.sites[0].deal),/Kârda|Zararda/);assert.match(await listHtml(volume),/Hesaplanamadı — tonaj kapsamı/);
volume.sites[0].deal.measurement={m3:30,net:3000,gross:3000};
const measured=jobCosts(volume,volume.sites[0],jobReport(volume,volume.sites[0],{today:date}),{today:date,fuelRef:50});
assert.equal(measured.revenueIncomplete,false);assert.equal(measured.income,3000);assert.notEqual(measured.profit,null);
const volumeReport=buildReport(volume,{k:'santiye',id:'S',...opts});assert.deepEqual(volumeReport.kpis.find(x=>x[0]==='Bilinen ton ara toplamı'),['Bilinen ton ara toplamı','25 ton']);assert.match(JSON.stringify(reportSpec(volumeReport)),/kapsam belirsiz/);
volume.work_records[1].tonnage_scope='per_trip';assert.deepEqual(buildReport(volume,{k:'santiye',id:'S',...opts}).kpis.find(x=>x[0]==='Toplam ton (kapsama göre)'),['Toplam ton (kapsama göre)','75 ton']);
// Projection failures are not silently treated as free work.
const broken=data();Object.defineProperty(broken.work_records[0],'dump_cost',{get(){throw Error('TEST projection failure');}});
const brokenCost=jobCosts(broken,site,jobReport(data(),site,{today:date}),{today:date,fuelRef:50});incomplete(brokenCost);assert.equal(brokenCost.dumpUnknown,1);assert.equal(brokenCost.knownCostSubtotal,3100);
console.log('RT-03 PASS: unknown remaining dump costs suppress contract/list/PDF/assistant profit, retain known subtotal and reasons; complete/zero/customer-paid costs and original records preserved');

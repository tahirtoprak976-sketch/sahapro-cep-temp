import assert from 'node:assert/strict';
import {businessOverview,overviewRange,localOverviewCommand,pdfPending,workPriceState} from '../js/business-overview.js';
import {searchAssistantTasks,ASSISTANT_TASKS} from '../js/assistant-guide.js';
import {routeCommand} from '../js/command-router.js';
const today='2026-10-19';
assert.deepEqual([overviewRange('week',today).from,overviewRange('week',today).to],['2026-10-13',today]);
assert.deepEqual([overviewRange('lastmonth','2026-01-01').from,overviewRange('lastmonth','2026-01-01').to],['2025-12-01','2025-12-31']);
assert.equal(overviewRange('custom',today,{from:'2024-02-29',to:'2024-03-01'}).days,2);
for(const r of [{from:'2026-02-31',to:today},{from:today,to:'2026-10-20'},{from:today,to:'2026-10-01'},{from:'2024-01-01',to:today}])assert.throws(()=>overviewRange('custom',today,r));
const w=(id,date,quantity,unit,extra={})=>({id,date,quantity,unit,customer_id:'C',vehicle_id:'V',work_type:'Kazı',...extra});
const d={customers:[{id:'C',name:'Örnek'},{id:'F',name:'Mazot',fuel_rules:[{per:75,unit:'Sefer',match:'',only_pay:true}]},{id:'I',name:'İç',internal:true}],vehicles:[{id:'V',name:'TEST'}],personnel:[{id:'P',name:'TEST'}],
 work_records:[
 w('a',today,2,'Saat',{price_snapshot:{unit_price:100,amount:200,kdv_rate:20,kdv_included:false}}),
 w('b','2026-10-13',3,'Sefer'),
 w('c',today,5,'Sefer',{customer_id:'F',customer_fuel_allowance_l:375,price_snapshot:{amount:0,price_source:'Mazot karşılığı'}}),
 w('zero',today,1,'Saat',{price_snapshot:{amount:0,unit_price:0}}),
 w('inc',today,1,'Saat',{price_snapshot:{amount:0,price_source:'Sözleşmeye dahil'}}),
 w('int',today,1,'Saat',{customer_id:'I'}),
 w('old','2026-09-01',5,'Ton'),w('prev','2026-10-06',2,'Saat'),
 w('future','2026-10-20',90,'Sefer'),w('deleted',today,100,'Saat',{deleted_at:'x'})],
 cash_records:[{id:'cash',date:today,amount:120,cash_type:'Müşteriden Para Alındı',customer_id:'C'},{id:'other',date:today,amount:300,cash_type:'Başka'},{id:'oldcash',date:'2026-09-01',amount:50,cash_type:'Müşteriden Para Alındı'}],
 expense_records:[{id:'e',date:today,amount:50,category:'Lastik'},{id:'deposit',date:today,amount:900,dump_deposit:true}],
 fuel_records:[{id:'received',date:today,fuel_source:'Müşteri Verdi',customer_id:'F',liters:300,total:null},{id:'bought',date:today,fuel_source:'Akaryakıt İstasyonu',liters:10,total:450}],
 maintenance_records:[{id:'m',date:today,cost:100,status:'Tamamlandı'}],
 payroll_entries:[{id:'pay',date:today,kind:'Ücret Tahakkuku',amount:1000,personnel_id:'P'}],
 payables:[{id:'bill',date:today,party_type:'supplier',gross_total:80},{id:'linked',date:today,party_type:'supplier',gross_total:50,source_store:'expense_records'}]};
const before=JSON.stringify(d),p=businessOverview(d,{today,period:'week'});
assert.equal(JSON.stringify(d),before);
assert.deepEqual(p.totals,{works:6,value:200,cash:120,cost:1680,liters:310});
assert.deepEqual(p.units,{Sefer:8,Saat:5});
assert.deepEqual(p.missing.map(x=>x.id),['b']);
assert.equal(p.comparison.count,1);assert.equal(p.comparison.change,5);
assert.equal(p.timeline.length,7);
assert.equal(p.timeline.at(-1).works,5);assert.equal(p.timeline.at(-1).cash,120);assert.equal(p.timeline.at(-1).cost,1680);
assert.equal(p.fuelAccounts[0].earned,375);assert.equal(p.fuelAccounts[0].received,300);assert.equal(p.fuelAccounts[0].balance,75);
assert.equal(p.customers.find(x=>x.id==='C').count,4);assert.equal(p.vehicles[0].count,6);
const m=businessOverview(d,{today,period:'custom',from:'2026-08-15',to:today});
assert.deepEqual(m.timeline.map(x=>[x.from,x.to]),[['2026-08-15','2026-08-31'],['2026-09-01','2026-09-30'],['2026-10-01',today]]);
const meta=[{key:'pdf_history_draft:H',value:{rows:[{id:'1',kind:'work'},{id:'2',kind:'fuel'},{id:'3',kind:'note'}]}},{key:'op:pdf-history:H:1',value:{store:'work_records',record_id:'a'}}];
assert.equal(pdfPending(meta,d).rows,1);
assert.equal(businessOverview(d,{today,meta}).pending.rows,1);
assert.equal(businessOverview(d,{today,meta}).attention[0].key,'pdf');
assert.equal(workPriceState(d.work_records.find(x=>x.id==='zero'),d),'priced');
for(const amount of [null,' ',true,Infinity])assert.equal(workPriceState({customer_id:'C',price_snapshot:{amount}},d),'missing');
const onlyZero={...d,work_records:[d.work_records.find(x=>x.id==='zero')]};
assert.equal(businessOverview(onlyZero,{today}).attention.some(x=>x.key==='fiyatsiz'),false);
assert.equal(localOverviewCommand('Bu ayın özeti',d,today).kind,'answer');
for(const text of ['Bugün ne yaptık?','Bana bu ayın özetini göster','Son 7 günü özetle'])assert.equal(routeCommand(text,d,today).kind,'answer');
assert.match(localOverviewCommand('Bugünkü durum?',d,today).text,/kâr veya cari bakiye değildir/);
assert.equal(routeCommand('İşletme panosunu aç',d,today).hash,'#/isletme-panosu');
assert.equal(routeCommand('Bu ayın özeti',d,today).kind,'answer');
assert.equal(localOverviewCommand('Bu ayın özetini sil',d,today),null);
assert.ok(searchAssistantTasks('PDF').some(x=>x.id==='pdf'));
assert.ok(searchAssistantTasks('tahsilat','Kayıt').some(x=>x.id==='cash'));
assert.equal(new Set(ASSISTANT_TASKS.map(x=>x.id)).size,ASSISTANT_TASKS.length);
assert.ok(ASSISTANT_TASKS.every(x=>!!x.hash!==!!x.text));
console.log('business overview: PASS (ranges, period totals, units, zero price, costs, fuel ledger, sources, pending PDF, local commands, task search)');

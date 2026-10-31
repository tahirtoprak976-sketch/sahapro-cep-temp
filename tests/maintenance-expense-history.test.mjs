import assert from 'node:assert/strict';
import {maintenanceHistory,maintenanceCategory} from '../js/maintenance-history-core.js';
import {exploreOperations,operationCSV} from '../js/operation-history.js';
import {lastDone,ruleStatus} from '../js/maint-core.js';
import {costRows,costTotals} from '../js/costs-core.js';
import {costLedger} from '../js/enterprise-core.js';
import {buildReport} from '../js/report-core.js';
const date='2026-10-12',today='2026-10-31';
const bill=(id,extra={})=>({id,date,party_type:'supplier',party_id:'S',bill_kind:'Alış',cost_category:'Bakım / Onarım',vehicle_id:'V',status:'Açık',gross_total:10000,items:[{description:'TEST fren bakımı ve yağlama belgesi',gross:10000}],...extra});
const work=(id,extra={})=>({id,date,vehicle_id:'V',status:'Tamamlandı',description:'TEST fren bakımı',maint_type:'Bakım',cost:10000,...extra});
const data={vehicles:[{id:'V',name:'TEST Kamyon90'}],suppliers:[{id:'S',name:'TEST Usta'}],payables:[bill('B')],expense_records:[],maintenance_records:[]};
const original=JSON.stringify(data),finance=JSON.stringify(costLedger(data)),costs=JSON.stringify(costRows(data));
let rows=maintenanceHistory(data);
assert.equal(rows.length,1);assert.equal(rows[0].cost,10000);assert.equal(rows[0].service_company,'TEST Usta');assert.equal(rows[0].history_href,'#/alislar/B');assert.equal(rows[0].history_unknown_status,true);
assert.equal(exploreOperations('maintenance',rows,{}, {},today).rows.length,1,'screenshot bill now appears with no maintenance row written');
assert.equal(exploreOperations('maintenance',rows,{}, {f:'open'},today).rows.length,0,'supplier debt status is not open repair work');
assert.equal(exploreOperations('maintenance',rows,{}, {f:'done'},today).rows.length,0,'paying a bill never completes a repair');
for(const status of ['Ödendi','Açık','Kısmi Ödendi'])assert.equal(maintenanceHistory({...data,payables:[bill('B',{status})]})[0].status,null);
const report=buildReport(data,{k:'bakim',id:'V',from:'2026-10-01',to:today,today});
assert.match(report.kpis.find(([name])=>name==='Toplam maliyet')[1],/10\.000/);assert.equal(report.tables[0].link[0],'#/alislar/B');assert.ok(report.tables[0].rows[0].includes('İş durumu belirtilmemiş'));
assert.ok(operationCSV('maintenance',rows).includes('Esnaf / alış belgesi'));assert.ok(operationCSV('maintenance',rows).includes('İş durumu belirtilmemiş'));
assert.equal(JSON.stringify(data),original);assert.equal(JSON.stringify(costLedger(data)),finance);assert.equal(JSON.stringify(costRows(data)),costs);

const linked={...data,maintenance_records:[work('M')],payables:[bill('B',{source_store:'maintenance_records',source_id:'M',cost_category:'Diğer'})]};
rows=maintenanceHistory(linked);assert.equal(rows.length,1);assert.equal(rows[0].id,'M');assert.equal(rows[0].cost,10000);assert.equal(rows[0].history_sources.length,2);assert.equal(costTotals(costRows(linked)).total,10000);
const e={id:'E',date,vehicle_id:'V',category:'Tamir',amount:10000,description:'TEST tamir',payment_method:'Şirket Ödedi'};
const linkedExpense={...data,expense_records:[e],payables:[bill('B',{source_store:'expense_records',source_id:'E'})]};
rows=maintenanceHistory(linkedExpense);assert.equal(rows.length,1);assert.equal(rows[0].id,'expense_records:E');assert.equal(rows[0].cost,10000);assert.equal(rows[0].history_sources.length,2);assert.equal(costTotals(costRows(linkedExpense)).total,10000);
assert.equal(maintenanceHistory({...linkedExpense,payables:[bill('B',{source_store:'expense_records',source_id:'E',items:[]})]}).length,1,'unpriced legacy source wrapper cannot duplicate financial cost');
assert.equal(maintenanceHistory({...data,maintenance_records:[work('M')]}).length,2,'equal date, amount and description are not proof of a link');
assert.equal(maintenanceHistory({...data,maintenance_records:[work('B')],expense_records:[{...e,id:'B'}]}).length,3,'IDs from different stores remain distinct');

for(const extra of [{status:'İptal'},{deleted_at:'2026-10-20'},{bill_kind:'Açılış / Devir'},{source_store:'fuel_tank_movements',source_id:'F'}])assert.equal(maintenanceHistory({...data,payables:[bill('X',extra)]}).length,0);
for(const category of ['Bakım / Onarım','Bakım-Onarım','BAKIM / ONARIM','Tamir','Servis','Periyodik Bakım','Yağ / Filtre','Lastik'])assert.equal(maintenanceCategory(category),true,category);
for(const category of ['Yemek','Yakıt','Malzeme','Yedek Parça','Kaynak / Demir','motor tamiri için verilen avans'])assert.equal(maintenanceCategory(category),false,'only explicit maintenance categories; no description guesses');
assert.equal(maintenanceHistory({...data,payables:[bill('X',{cost_category:'Yemek',description:'motor tamiri'})]}).length,0);
assert.equal(maintenanceHistory({...data,payables:[],expense_records:[{...e,dump_deposit:true}]}).length,0);
const mismatch={...linked,payables:[bill('B',{source_store:'maintenance_records',source_id:'M',vehicle_id:'OTHER'})]};
rows=maintenanceHistory(mismatch);assert.equal(rows.length,2);assert.equal(rows.find(r=>r.id==='M').cost,null);assert.equal(rows.find(r=>r.id==='payables:B').vehicle_id,'OTHER');assert.ok(rows.every(r=>r.history_warnings.length));assert.equal(mismatch.maintenance_records[0].cost,10000);
rows=maintenanceHistory({...data,payables:[bill('B',{source_store:'maintenance_records',source_id:'MISSING',vehicle_id:null})]});assert.equal(rows[0].vehicle_id,null);assert.ok(rows[0].history_warnings.length>=2);
rows=maintenanceHistory({...linked,maintenance_records:[work('M',{vehicle_id:null})]});assert.equal(rows[0].vehicle_id,'V','explicit matching source association can supply its single recorded vehicle');
for(const cost of [null,'',-1,'not money',true,{}])assert.equal(maintenanceHistory({...data,payables:[],maintenance_records:[work('M',{cost})]})[0].cost,null);
assert.equal(maintenanceHistory({...data,payables:[],maintenance_records:[work('M',{cost:0})]})[0].cost,0);
assert.equal(exploreOperations('maintenance',maintenanceHistory({...data,payables:[],maintenance_records:[work('M',{cost:0})]}),{}, {},today).priced,1);

// A servicing/cancelled/future record must not reset a performed-maintenance interval.
const v={id:'V'},rule={id:'R',title:'Fren',keywords:'fren',every_days:90};
const old=work('DONE',{date:'2026-09-01',service_rule_id:'R'});
for(const extra of [{status:'Serviste'},{status:'Açık'},{status:'Parça Bekliyor'},{status:'İptal'},{status:null},{date:'2027-01-01'},{date:'2026-02-30'},{deleted_at:today}]){
 const d={maintenance_records:[old,work('BAD',{date:'2026-10-30',service_rule_id:'R',...extra})],payables:[bill('B',{status:'Ödendi'})]};
 assert.equal(lastDone(d,v,rule,{today}).id,'DONE');assert.equal(ruleStatus(d,v,rule,{today}).leftDays,30);
}
assert.equal(lastDone(data,v,rule,{today}),null,'financial history never becomes performed service');
assert.equal(JSON.stringify(data),original);
console.log('maintenance expense history PASS: 10000 TL supplier-only TEST repair case, explicit-source dedup, debt/payment separation, categories, legacy and conflicting links, missing/zero cost, reports/CSV, immutable finance, performed-service clock');

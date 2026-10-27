import assert from 'node:assert/strict';
import {monthlySeries} from '../js/finance-chart.js';
import {operatingResult} from '../js/enterprise-core.js';
import {resultReport} from '../js/solo-core.js';
import {freezeDumpEstimate} from '../js/dump-estimate.js';
import {financialResultText,financialResultWarning} from '../js/cost-completeness.js';

// Kimi's additional financial-read guards, adapted on top of Dot v3.9.75.
// Synthetic source records only. No receipt, stock, cash or history is written.
const date='2026-10-20',today='2026-10-27';
const make=()=>({customers:[{id:'C',name:'TEST Customer'}],vehicles:[{id:'V',name:'TEST Truck',type:'Kamyon',load_ton:20}],
 dump_sites:[{id:'D',name:'TEST Dump',fee:100,fee_unit:'Ton',fee_effective_from:'2026-10-01'}],
 work_records:[{id:'W',date,customer_id:'C',vehicle_id:'V',dump_site_id:'D',unit:'Sefer',quantity:3,price_snapshot:{unit_price:5000,amount:15000,kdv_rate:0,kdv_included:false}}],
 fuel_records:[{id:'F',date,vehicle_id:'V',liters:60,total:3000,unit_price:50}],pending_fuel_records:[],
 fuel_tank_movements:[],expense_records:[],maintenance_records:[],dump_entries:[],payables:[],cash_records:[],cari_movements:[],hakedis:[],cost_allocations:[]});
const outputs=d=>({month:monthlySeries(d,{today,months:1})[0],operation:operatingResult(d),allocated:resultReport(d)});
const unknown=make(),before=JSON.stringify(unknown),u=outputs(unknown);
assert.equal(u.month.costIncomplete,true);assert.equal(u.month.cost,3000);
assert.equal(u.operation.unknown_cost_count,1);assert.equal(u.operation.complete,false);
assert.equal(u.month.profit,null,'monthly data must not publish numeric profit over unknown dump costs');
assert.equal(u.operation.provisional_result,null,'operation result must preserve unknown costs');
assert.equal(u.allocated.provisional_result,null,'allocation wrapper must not recompute a numeric result');
assert.equal(u.operation.costIncomplete,true);assert.equal(u.allocated.costIncomplete,true);
assert.equal(u.allocated.costIncompleteReason,'döküm maliyeti eksik');
assert.equal(financialResultText(u.operation,()=>{throw Error('Unknown result must not be formatted as0');}),'Hesaplanamadı — döküm maliyeti eksik');
assert.match(financialResultWarning(u.allocated),/maliyet.*doğrulanmadı/);
assert.equal(JSON.stringify(unknown),before,'all financial readers are immutable');

// Knowing one receipt does not prove the remaining two trips are cost-free.
const partial=make();partial.dump_entries=[{id:'R',kind:'RECEIPT',date,dump_site_id:'D',work_record_id:'W',customer_id:'C',vehicle_id:'V',trips:1,amount:2000,payer:'company_account'}];
const p=outputs(partial);assert.equal(p.month.cost,5000);
assert.equal(p.month.profit,null);assert.equal(p.operation.provisional_result,null);assert.equal(p.allocated.provisional_result,null);

// Once coverage is complete, retain the existing distinct revenue policies.
partial.dump_entries[0].trips=3;partial.dump_entries[0].amount=6000;
const complete=outputs(partial);
assert.equal(complete.month.profit,6000); // priced work15000 - known costs9000
assert.equal(complete.operation.provisional_result,-9000); // no finalized claim revenue
assert.equal(complete.allocated.provisional_result,-9000);
assert.equal(complete.operation.unknown_cost_count,0);
assert.equal(complete.operation.costIncomplete,false);
assert.equal(financialResultText(complete.operation,value=>value.toFixed(2)),'-9000.00');
assert.equal(financialResultWarning(complete.operation),'');

// A known provisional estimate and customer-paid/free dump are not unknown costs.
const known=make();known.work_records[0].dump_estimate_snapshot=freezeDumpEstimate(known.work_records[0],known.dump_sites[0],known.vehicles[0]);
assert.equal(outputs(known).month.profit,6000);assert.equal(outputs(known).operation.provisional_result,-9000);
const free=make();free.dump_sites[0].fee=0;free.work_records[0].dump_estimate_snapshot=freezeDumpEstimate(free.work_records[0],free.dump_sites[0],free.vehicles[0]);
assert.equal(outputs(free).month.profit,12000);assert.equal(outputs(free).operation.provisional_result,-3000);
const customerPays=make();customerPays.work_records[0].dump_payer='customer';
assert.equal(outputs(customerPays).month.profit,12000);assert.equal(outputs(customerPays).allocated.provisional_result,-3000);

// Unknown VAT with a known gross amount is not an unverified monetary cost.
const taxOnly=make();taxOnly.work_records[0].dump_site_id=null;
assert.equal(outputs(taxOnly).operation.provisional_result,-3000);
assert.equal(outputs(taxOnly).operation.complete,false);

// Filters must not pull an unrelated vehicle's unknown dump into this result.
assert.equal(operatingResult(unknown,{vehicle_id:'OTHER'}).provisional_result,0);
assert.equal(resultReport(unknown,{vehicle_id:'OTHER'}).provisional_result,0);
const old=make();old.work_records[0].date='2026-09-20';old.fuel_records=[];
assert.equal(monthlySeries(old,{today,months:1})[0].profit,0);
const pending=make();pending.work_records[0].dump_site_id=null;pending.pending_fuel_records=[{id:'PF',date,vehicle_id:'V',liters:10,reconciliation_status:'pending'}];
assert.equal(outputs(pending).month.profit,null);assert.equal(outputs(pending).operation.provisional_result,null);assert.equal(outputs(pending).allocated.provisional_result,null);
console.log('financial-result-completeness PASS: monthly/operation/allocation unknown costs, partial/complete receipts, free/customer-paid/known estimates, VAT distinction, scope and immutable reads');

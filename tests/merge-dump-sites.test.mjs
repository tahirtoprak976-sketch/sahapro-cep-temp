import assert from 'node:assert/strict';
import {planMergeCards,suggestCardGroups} from '../js/merge-core.js';
import {freezeDumpEstimate} from '../js/dump-estimate.js';
import {sharedDumpBalance,validateDumpData} from '../js/dump-ledger-core.js';
const date='2026-09-07';
function fixture(){
  const d={dump_sites:[{id:'A',name:'TEST Bolluca',fee:100,fee_unit:'Ton',fee_effective_from:'2026-01-01',account_reported:{amount:11000,date,note:'original A'}},{id:'B',name:'TEST BOLLuca',fee:250,fee_unit:'Ton',fee_effective_from:'2026-01-01',phone:'0532',account_reported:{amount:1000,date,note:'original B'}}],
    vehicles:[{id:'V',name:'TEST truck',type:'Kamyon',load_ton:20}],customers:[{id:'C',name:'TEST customer'}],
    work_records:[{id:'W',dump_site_id:'B',customer_id:'C',vehicle_id:'V',date,quantity:2,unit:'Sefer',dump_tariff_snapshot:{site_id:'B',fee:250,fee_unit:'Ton',work_date:date}}],
    dump_entries:[{id:'R',kind:'RECEIPT',dump_site_id:'B',vehicle_id:'V',work_record_id:'W',customer_id:'C',site_id:null,date,trips:1,amount:500,payer:'company_account',receipt_no:'TEST-R'}],
    expense_records:[{id:'E1',date,amount:10000,dump_deposit:true,dump_site_id:'A'},{id:'E2',date,amount:3000,dump_deposit:true,dump_site_id:'B'}],
    documents:[{id:'DOC',owner_type:'dump_site',owner_id:'B',amount:2500}],payables:[{id:'BILL',party_type:'dump_site',party_id:'B',document_no:'TEST-BILL',amount:2500}],supplier_payments:[{id:'PAY',party_type:'dump_site',party_id:'B',amount:100}],aliases:[{id:'ALIAS',target_type:'dump_site',target_id:'B',alias:'old name'}],inbox_messages:[{id:'DRAFT',review_rows:[{dump_site_id:'B'}]}]};
  d.work_records[0].dump_estimate_snapshot=freezeDumpEstimate(d.work_records[0],d.dump_sites[1],d.vehicles[0]);return d;
}
const apply=(d,p)=>{d=structuredClone(d);for(const u of p.updates)d[u.store]=d[u.store].map(r=>r.id===u.before.id?u.after:r);return d;};
const d=fixture(),original=structuredClone(d),p=planMergeCards(d,'dump_sites',['B'],'A'),after=apply(d,p);
assert.deepEqual(d,original,'pure preview');
assert.equal(p.dumpBalance,12500);assert.equal(sharedDumpBalance(after,'A').balance,12500);
assert.equal(after.dump_entries[0].dump_site_id,'A');assert.equal(after.expense_records[1].dump_site_id,'A');
assert.equal(after.documents[0].owner_id,'A');assert.equal(after.payables[0].party_id,'A');assert.equal(after.supplier_payments[0].party_id,'A');assert.equal(after.aliases[0].target_id,'A');assert.equal(after.inbox_messages[0].review_rows[0].dump_site_id,'A');
for(const key of ['dump_tariff_snapshot','dump_estimate_snapshot'])assert.deepEqual(after.work_records[0][key],{...d.work_records[0][key],site_id:'A'},'only snapshot identity changes');
assert.equal(after.dump_sites[0].fee,100);assert.equal(after.dump_sites[0].phone,'0532');assert.equal(after.dump_sites[0].account_reported,null);assert.equal(after.dump_sites[0].merge_reports.length,2);assert.deepEqual(after.dump_sites[0].merge_reports[1].report,d.dump_sites[1].account_reported);
validateDumpData(after);assert.equal(p.aliases.length,0);const named=fixture();named.dump_sites[1].name+=' Döküm';assert.equal(planMergeCards(named,'dump_sites',['B'],'A').aliases[0].target_type,'dump_site');assert.equal(suggestCardGroups(d,'dump_sites').length,1);
const blocked=(mutate,pattern)=>{const x=fixture();mutate(x);assert.throws(()=>planMergeCards(x,'dump_sites',['B'],'A'),pattern);};
blocked(x=>x.dump_sites[1].own_yard=true,/İç depo/);
blocked(x=>x.dump_entries.push(...['A','B'].map((id,i)=>({id:'O'+i,kind:'OPENING',dump_site_id:id,date:'2026-09-01',amount:100,note:'TEST opening'}))),/birden fazla açılış/);
blocked(x=>x.dump_entries.push({id:'O',kind:'OPENING',dump_site_id:'A',date:'2026-09-08',amount:100,note:'TEST opening'}),/açılış tarihinden önce/);
blocked(x=>x.dump_entries.push({...x.dump_entries[0],id:'R2',dump_site_id:'A',work_record_id:null}),/mükerrer döküm fişi/);
blocked(x=>x.payables.push({...x.payables[0],id:'BILL2',party_id:'A'}),/aynı numaralı borç/);
blocked(x=>{x.expense_records[1].amount=10000;for(const [i,site]of ['A','B'].entries()){const id='T'+i,e=x.expense_records[i];e.dump_entry_id=id;x.dump_entries.push({id,kind:'TOPUP',date,dump_site_id:site,amount:10000,reference:'TEST SAME BANK REF',expense_id:e.id});}},/dekont referansı/);
const missing=fixture();missing.work_records[0].dump_estimate_snapshot=null;const old=apply(missing,planMergeCards(missing,'dump_sites',['B'],'A'));assert.equal(old.work_records[0].dump_estimate_snapshot,null,'missing historical estimate remains missing');
console.log('merge-dump-sites PASS: linked balances, snapshots, documents, reports and aliases preserved; conflicting yard/opening/receipt/bill rejected');

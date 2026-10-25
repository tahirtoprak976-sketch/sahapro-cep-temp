import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as core from '../js/core.js';
import * as validation from '../js/hakedis-validation.js';
import {ENTERPRISE_STORES,workHours} from '../js/enterprise-core.js';
import {customerBalances} from '../js/collect-core.js';
import {validateExtras} from '../js/assistant-core.js';

// Actual production functions, with asynchronous transactional storage doubles.
// This verifies guards and rollback control flow, not browser IndexedDB semantics.
// The separate real-browser suite exercises the same cases on real IndexedDB.
const source=readFileSync(new URL('../js/db.js',import.meta.url),'utf8');
const between=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b)).replaceAll('export async function','async function');
const saveStart=source.indexOf('export async function saveExisting(');
const save=source.slice(source.indexOf('const DEPENDENT ='),source.indexOf('  return upd;\n}',saveStart)+'  return upd;\n}'.length).replaceAll('export async function','async function');
const fieldValidation=between('function assertNumericFields(','// Dış alıcıya teslim:').replaceAll('await import("./core.js")','core');
function fixture(seed,hooks={}) {
  let data=structuredClone(seed),writes=0;
  const read=(store,id)=>structuredClone((data[store]||[]).find(row=>row.id===id));
  const db={name:'SYNTHETIC_ONLY',transaction(stores){
    let aborted=false,pending=0,timer;const draft=structuredClone(data),pendingWrites=[];
    const transaction={abort(){if(aborted)return;aborted=true;queueMicrotask(()=>transaction.onabort?.({target:{error:Error('abort')}}));},objectStore(store){
      assert.ok(stores.includes(store),'store locked: '+store);
      return {
        get(id){return request(()=>structuredClone((draft[store]||[]).find(row=>row.id===id)));},
        getAll(){return request(()=>structuredClone(draft[store]||[]));},
        put(row){draft[store]??=[];const index=draft[store].findIndex(old=>old.id===row.id);if(index<0)draft[store].push(structuredClone(row));else draft[store][index]=structuredClone(row);pendingWrites.push(store);schedule();return {};},
      };
    }};
    function schedule(){clearImmediate(timer);timer=setImmediate(()=>{if(aborted||pending)return;data=draft;writes+=pendingWrites.length;transaction.oncomplete?.();});}
    function request(fn){pending++;const result={};queueMicrotask(()=>{if(!aborted){result.result=fn();result.onsuccess?.();}pending--;schedule();});return result;}
    schedule();return transaction;
  }};
  const context={...core,...validation,core,structuredClone,ENTERPRISE_STORES,workHours,
    openDB:async()=>{if(hooks.beforeOpen)await hooks.beforeOpen();return db;},
    get:async(store,id)=>read(store,id),getAll:async store=>structuredClone(data[store]||[]),
    listActive:async store=>(data[store]||[]).filter(core.isActive),recordsCommitted(){},transactionError:()=>Error('abort'),
    freezeDumpTariff(){throw Error('unused fixture path');},
  };
  const functions=runInNewContext(between('const HISTORY_STORES =','export async function put(')+'\n'+
    between('export async function createHakedis(','export async function byRelation(')+'\n'+save+'\n'+fieldValidation+'\n'+
    between('export async function softDelete(','// Mükerrer depo GİRİŞİ')+
    ';({createHakedis,finalizeHakedis,saveExisting,softDelete});',context);
  return {...functions,read,data:()=>structuredClone(data),writes:()=>writes};
}
const date='2026-10-25',stamp=date+'T00:00:00.000Z';
const work=(extra={})=>({id:'W',date,customer_id:'C',vehicle_id:'V',quantity:1,unit:'Sefer',work_type:'Hafriyat Nakliye',updated_at:stamp,
  price_snapshot:{unit_price:1200,amount:1200,kdv_rate:20,kdv_included:true},...extra});
const claim=(w,extra={})=>{
  const item={...w.price_snapshot,work_record_id:w.id,date:w.date,customer_id:w.customer_id,site_id:w.site_id||null,
    vehicle_id:w.vehicle_id,quantity:w.quantity,unit:w.unit,work_type:w.work_type,material:w.material||''};
  const totals=core.calcHakedisTotals([item]);
  return {id:'H',hakedis_no:1,customer_id:w.customer_id,date_from:date,date_to:date,created_date:date,status:'Taslak',
    items:totals.lines,subtotal:totals.subtotal,kdv_total:totals.kdv,grand_total:totals.grand,updated_at:stamp,...extra};
};
const seed=(w=work())=>({customers:[{id:'C',name:'SYNTHETIC'},{id:'OTHER',name:'OTHER SYNTHETIC'}],vehicles:[{id:'V'}],
  sites:w.site_id?[{id:w.site_id,customer_id:w.customer_id,name:'SYNTHETIC SITE',updated_at:stamp}]:[],work_records:[w],hakedis:[claim(w)],cari_movements:[]});
async function rejectsUnchanged(f,operation,code){const before=JSON.stringify(f.data()),writes=f.writes();await assert.rejects(operation,code?{code}:undefined);assert.equal(JSON.stringify(f.data()),before);assert.equal(f.writes(),writes);}

// Future snapshot input basis; claim arithmetic and posted grand never change.
const matrix=[
  {name:'included',price:{unit_price:1200,kdv_rate:20,kdv_included:true},quantity:1,raw:1200,net:1000,tax:200,gross:1200},
  {name:'excluded',price:{unit_price:1000,kdv_rate:20,kdv_included:false},quantity:1,raw:1000,net:1000,tax:200,gross:1200},
  {name:'zero',price:{unit_price:0,kdv_rate:20,kdv_included:true},quantity:2,raw:0,net:0,tax:0,gross:0},
  {name:'zero VAT',price:{unit_price:500,kdv_rate:0,kdv_included:true},quantity:2,raw:1000,net:1000,tax:0,gross:1000},
  {name:'crane',price:{formula:'CRANE_FIRST_HOUR',unit_price:null,first_hour_price:600,next_hour_price:120,kdv_rate:20,kdv_included:true},quantity:2,raw:720,net:600,tax:120,gross:720},
  {name:'crane first zero',price:{formula:'CRANE_FIRST_HOUR',unit_price:null,first_hour_price:0,next_hour_price:null,kdv_rate:20,kdv_included:true},quantity:0.5,raw:0,net:0,tax:0,gross:0},
  {name:'cent included',price:{unit_price:0.03,kdv_rate:20,kdv_included:true},quantity:1,raw:0.03,net:0.03,tax:0.01,gross:0.04},
  {name:'fractional canonical line',price:{unit_price:0.01,kdv_rate:20,kdv_included:false},quantity:0.5,raw:0.005,net:0.01,tax:0,gross:0.01},
];
for(const test of matrix){
  const w=work({quantity:test.quantity,price_snapshot:{...test.price,amount:test.raw},customer_fuel_allowance_l:75});
  const f=fixture(seed(w)),old=structuredClone(f.read('hakedis','H'));await f.finalizeHakedis('H');
  const h=f.read('hakedis','H'),after=f.read('work_records','W'),move=f.data().cari_movements;
  assert.equal(after.price_snapshot.amount,test.raw,test.name);assert.equal(after.customer_fuel_allowance_l,75);
  assert.deepEqual(h.items,old.items);assert.equal(h.subtotal,test.net);assert.equal(h.kdv_total,test.tax);assert.equal(h.grand_total,test.gross);
  assert.equal(move.length,1);assert.equal(move[0].amount,test.gross);assert.ok(h.updated_at>old.updated_at);assert.equal(after.price_snapshot.locked,true);
  await rejectsUnchanged(f,()=>f.finalizeHakedis('H'));assert.equal(f.data().cari_movements.length,1);
}

{
 const d=seed(work({quantity:0.5,price_snapshot:{unit_price:0.01,amount:0.005,kdv_rate:20,kdv_included:false}}));
 assert.equal(d.hakedis[0].items[0].amount,0.005);d.hakedis[0].items[0].amount=0.006;
 const f=fixture(d);await rejectsUnchanged(f,()=>f.finalizeHakedis('H'),'HAKEDIS_TOTAL');
}

// Legacy malformed drafts fail before any write. Explicit zero remains valid.
for(const alter of [
  h=>({...h,deleted_at:stamp}), h=>({...h,status:'İptal'}),h=>({...h,grand_total:999999}),
  h=>({...h,subtotal:null}),h=>({...h,grand_total:h.grand_total+0.004}),h=>({...h,subtotal:h.subtotal+0.004}),
  h=>({...h,kdv_total:h.kdv_total+0.004}),h=>({...h,items:[{...h.items[0],amount:h.items[0].amount+0.004}]}),
  h=>({...h,items:[{...h.items[0],total:999}]}),
  h=>({...h,items:[{...h.items[0],unit_price:null}]}),h=>({...h,items:[{...h.items[0],kdv_rate:null}]}),
]){const d=seed();d.hakedis[0]=alter(d.hakedis[0]);const f=fixture(d);await rejectsUnchanged(f,()=>f.finalizeHakedis('H'));}
for(const change of [
  d=>{d.work_records=[];},d=>{d.work_records[0].deleted_at=stamp;},d=>{d.work_records[0].quantity=2;},
  d=>{d.work_records[0].unit='Saat';},d=>{d.work_records[0].date='2026-10-24';},d=>{d.work_records[0].customer_id='OTHER';},
  d=>{d.work_records[0].price_snapshot.locked=true;},d=>{d.customers[0].deleted_at=stamp;},
  d=>{d.hakedis.push({...d.hakedis[0],id:'SECOND'});},
  d=>{d.cari_movements=[{id:'ORPHAN',type:'Hakedis',ref_id:'H',customer_id:'C',amount:1200}];},
]){const d=seed();change(d);const f=fixture(d);await rejectsUnchanged(f,()=>f.finalizeHakedis('H'));}
{
 const d=seed(),base=d.hakedis[0];d.hakedis=[];const f=fixture(d);const created=await f.createHakedis({...base,id:undefined});
 assert.equal(created.items[0].date,date);assert.equal(f.read('work_records','W').price_snapshot.locked,undefined);
 await rejectsUnchanged(f,()=>f.createHakedis({...base,id:'SECOND'}),'HAKEDIS_SOURCE');
}
for(const extra of [{quantity:2},{unit:'Saat'},{date:'2026-10-24'},{customer_id:'OTHER'}]){
 const d=seed(),base=d.hakedis[0];d.hakedis=[];Object.assign(d.work_records[0],extra);const f=fixture(d);
 await rejectsUnchanged(f,()=>f.createHakedis(base),'HAKEDIS_SOURCE');
}
{
 const d=seed(),base=d.hakedis[0];d.hakedis=[];const line={...base.items[0]};for(const key of ['date','customer_id','site_id','vehicle_id','work_type','material'])delete line[key];
 const f=fixture(d),created=await f.createHakedis({...base,items:[line]});
 assert.equal(created.items[0].customer_id,'C');assert.equal(created.items[0].date,date);assert.equal(created.items[0].amount,line.amount);
 await f.finalizeHakedis(created.id);assert.equal(f.data().cari_movements[0].amount,1200);
}

// Price provenance is separate from the chosen claim tariff: manual override
// remains valid, new drift is rejected, and legacy frozen semantics are explicit.
{
 const d=seed(),h=d.hakedis[0];d.hakedis=[];
 const totals=core.calcHakedisTotals([{...h.items[0],unit_price:600}]);
 const f=fixture(d),created=await f.createHakedis({...h,items:totals.lines,subtotal:totals.subtotal,kdv_total:totals.kdv,grand_total:totals.grand});
 assert.equal(created.items[0].source_price_snapshot.unit_price,1200);assert.equal(created.items[0].unit_price,600);
 await f.finalizeHakedis(created.id);assert.equal(f.data().cari_movements[0].amount,600);assert.equal(f.read('work_records','W').price_snapshot.amount,600);
}
{
 const d=seed(),h=d.hakedis[0];h.items[0].source_price_snapshot=structuredClone(d.work_records[0].price_snapshot);
 d.work_records[0].price_snapshot={...d.work_records[0].price_snapshot,unit_price:2400,amount:2400};
 const f=fixture(d);await rejectsUnchanged(f,()=>f.finalizeHakedis('H'),'HAKEDIS_SOURCE');
 const creation=fixture({...d,hakedis:[]});await rejectsUnchanged(creation,()=>creation.createHakedis(h),'HAKEDIS_SOURCE');
}
{
 const d=seed();d.work_records[0].price_snapshot={...d.work_records[0].price_snapshot,unit_price:2400,amount:2400};
 const f=fixture(d);await f.finalizeHakedis('H');assert.equal(f.data().cari_movements[0].amount,1200,'legacy explicitly uses frozen draft, not a guessed latest price');
}

{
 const w=work(),h=claim(w);
 assert.deepEqual(validation.hakedisSourcePriceReview(h,[w]),{legacyCount:1,sourceChangedCount:0,priceDifferenceCount:0});
 const manual={...h,items:[{...h.items[0],unit_price:600}]};
 assert.deepEqual(validation.hakedisSourcePriceReview(manual,[w]),{legacyCount:1,sourceChangedCount:0,priceDifferenceCount:1});
 const proven={...manual,items:validation.captureHakedisSources(manual.items,[w])};
 assert.deepEqual(validation.hakedisSourcePriceReview(proven,[w]),{legacyCount:0,sourceChangedCount:0,priceDifferenceCount:1});
 const changed={...w,price_snapshot:{...w.price_snapshot,unit_price:2400,amount:2400}};
 assert.deepEqual(validation.hakedisSourcePriceReview(proven,[changed]),{legacyCount:0,sourceChangedCount:1,priceDifferenceCount:1});
}

// Draft lock is enforced at the DB boundary, including a late linked draft.
for(const fields of [{quantity:2},{customer_id:'OTHER'},{date:'2026-10-24'},{unit:'Saat'},{price_snapshot:{unit_price:1,kdv_rate:20}}]){
 const f=fixture(seed());await rejectsUnchanged(f,()=>f.saveExisting('work_records',f.read('work_records','W'),fields,'SYNTHETIC'),'HAKEDIS_LOCKED');
}
{
 const f=fixture(seed());await f.saveExisting('work_records',f.read('work_records','W'),{description:'Safe note'},'SYNTHETIC');
 await f.finalizeHakedis('H');assert.equal(f.read('work_records','W').description,'Safe note');
}
{
 const hooks={},f=fixture(seed(),hooks),old=f.read('hakedis','H');
 hooks.beforeOpen=async()=>{delete hooks.beforeOpen;await f.finalizeHakedis('H');};
 await assert.rejects(f.saveExisting('hakedis',old,{status:'İptal'},'SYNTHETIC race'),{code:'HAKEDIS_LOCKED'});
 assert.equal(f.read('hakedis','H').status,'Kesinleşti');assert.equal(f.data().cari_movements.length,1);assert.equal(customerBalances(f.data()).bal.C,1200);
}
{
 const f=fixture(seed());await f.saveExisting('hakedis',f.read('hakedis','H'),{status:'İptal'},'SYNTHETIC cancel');
 await f.saveExisting('work_records',f.read('work_records','W'),{quantity:2},'SYNTHETIC after cancel');assert.equal(f.read('work_records','W').quantity,2);
}

const cash={id:'CASH',customer_id:'C',date,amount:100,cash_type:'Müşteriden Para Alındı',payment_method:'Nakit',cash_status:'KASAYA_TESLIM_EDILDI',updated_at:stamp};
const cashData={customers:seed().customers,cash_records:[cash],cari_movements:[{id:'M',date,customer_id:'C',amount:-100,type:'Tahsilat',ref_id:'CASH',updated_at:stamp}]};
{
 const f=fixture(cashData),approved=validateExtras({edits:[{store:'cash_records',id:'CASH',changes:{amount:200}}]},{message:'Tahsilatı 200 TL olarak düzelt',d:f.data(),today:date});
 assert.equal(approved.edits[0].issues.length,0);await rejectsUnchanged(f,()=>f.saveExisting('cash_records',cash,approved.edits[0].changes,'SYNTHETIC approved assistant edit'),'FINANCE_LINKED');
}
for(const delta of [{date:'2026-10-24'},{customer_id:'OTHER'},{cash_type:'Personelde Para'},{payment_method:'Çek'},{request_id:'CHANGED'}]){
 const f=fixture(cashData);await rejectsUnchanged(f,()=>f.saveExisting('cash_records',cash,delta,'SYNTHETIC'),'FINANCE_LINKED');
}
{
 const f=fixture(cashData);await f.saveExisting('cash_records',cash,{cash_status:'TESLIM_BILDIRILDI',description:'Safe note'},'SYNTHETIC');
 assert.equal(f.read('cash_records','CASH').cash_status,'TESLIM_BILDIRILDI');assert.equal(f.read('cari_movements','M').amount,-100);
 await rejectsUnchanged(f,()=>f.saveExisting('cari_movements',f.read('cari_movements','M'),{amount:-200},'SYNTHETIC'),'FINANCE_LINKED');
}

// Customer identity: keep history and balances; inactivity is not deletion.
for(const linked of [
 {work_records:[work()]},{cari_movements:[{id:'M',customer_id:'C',amount:100}]},{cash_records:[cash]},
 {hakedis:[claim(work())]},{sites:[{id:'S',customer_id:'C'}]},
 {documents:[{id:'DOC',owner_type:'customer',owner_id:'C'}]},
 {customers:[...seed().customers,{id:'CHILD',parent_customer_id:'C'}]},
]){
 const f=fixture({customers:seed().customers,...linked});await rejectsUnchanged(f,()=>f.softDelete('customers','C','SYNTHETIC'),'CARD_HISTORY');
}
{
 const f=fixture(seed());await f.saveExisting('customers',f.read('customers','C'),{active:false},'SYNTHETIC inactive');assert.equal(customerBalances(f.data()).bal.C,1200);
 const unused=fixture({customers:seed().customers});await unused.softDelete('customers','C','SYNTHETIC unused');assert.ok(unused.read('customers','C').deleted_at);
}
{
 const d=seed(work({site_id:'S'})),f=fixture(d);await rejectsUnchanged(f,()=>f.saveExisting('sites',f.read('sites','S'),{customer_id:'OTHER'},'SYNTHETIC'),'CARD_HISTORY');
 await f.saveExisting('sites',f.read('sites','S'),{name:'Renamed site',address:'Safe address'},'SYNTHETIC');assert.equal(f.read('sites','S').name,'Renamed site');
 const unused=fixture({customers:d.customers,sites:d.sites});await unused.saveExisting('sites',unused.read('sites','S'),{customer_id:'OTHER'},'SYNTHETIC');assert.equal(unused.read('sites','S').customer_id,'OTHER');
}
console.log('finance-write-guards PASS: actual functions with transaction doubles; price basis/cents/crane/zero, totals/source rollback, draft/cancel/finalize, paired cash/cari, customer/site history');

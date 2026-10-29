import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as core from '../js/core.js';
import * as dump from '../js/dump-ledger-core.js';
import {freezeDumpEstimate} from '../js/dump-estimate.js';
import {ENTERPRISE_STORES,workHours} from '../js/enterprise-core.js';

// Production persistence functions with an asynchronous transaction double. Real
// IndexedDB behavior is also covered in the isolated dump browser regression.
const source=readFileSync(new URL('../js/db.js',import.meta.url),'utf8');
const between=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end)).replaceAll('export async function','async function');
const saveStart=source.indexOf('export async function saveExisting(');
const save=source.slice(source.indexOf('const DEPENDENT ='),source.indexOf('  return upd;\n}',saveStart)+'  return upd;\n}'.length).replaceAll('export async function','async function');
const validation=between('function assertNumericFields(','// Dış alıcıya teslim:').replaceAll('await import("./core.js")','core');
const ledgerSource=readFileSync(new URL('../js/dump-ledger-db.js',import.meta.url),'utf8');
const tariff=ledgerSource.slice(ledgerSource.indexOf('export async function changeDumpTariff('),ledgerSource.indexOf('export async function saveDumpReport(')).replaceAll('export async function','async function');
function fixture(seed){
 let data=structuredClone(seed),writes=0;
 const read=(store,id)=>structuredClone((data[store]||[]).find(r=>r.id===id));
 const db={name:'DUMP_SYNTHETIC_ONLY',transaction(stores){
  let aborted=false,pending=0,timer;const draft=structuredClone(data),pendingWrites=[];
  const t={abort(){if(aborted)return;aborted=true;queueMicrotask(()=>t.onabort?.({target:{error:Error('abort')}}));},objectStore(store){
   assert.ok(stores.includes(store),'store locked: '+store);
   return {get(id){return request(()=>structuredClone((draft[store]||[]).find(r=>r.id===id)));},getAll(){return request(()=>structuredClone(draft[store]||[]));},put(row){draft[store]??=[];const index=draft[store].findIndex(r=>r.id===row.id);if(index<0)draft[store].push(structuredClone(row));else draft[store][index]=structuredClone(row);pendingWrites.push(store);schedule();return {};}};
  }};
  function schedule(){clearImmediate(timer);timer=setImmediate(()=>{if(aborted||pending)return;data=draft;writes+=pendingWrites.length;t.oncomplete?.();});}
  function request(fn){pending++;const r={};queueMicrotask(()=>{if(!aborted){r.result=fn();r.onsuccess?.();}pending--;schedule();});return r;}
  schedule();return t;
 }};
 const context={journalTransaction:t=>t,rememberWrites:r=>r,...core,...dump,core,structuredClone,ENTERPRISE_STORES,workHours,freezeDumpEstimate,
  openDB:async()=>db,get:async(store,id)=>read(store,id),getAll:async store=>structuredClone(data[store]||[]),
  listActive:async store=>(data[store]||[]).filter(core.isActive),recordsCommitted(){},transactionError:()=>Error('abort'),
  stamp:core.nowISO,
  transaction:async(stores,fn)=>{const draft=structuredClone(data);for(const store of stores)draft[store]??=[];
   const tx={put(store,row){assert.ok(stores.includes(store));const index=draft[store].findIndex(r=>r.id===row.id);if(index<0)draft[store].push(structuredClone(row));else draft[store][index]=structuredClone(row);writes++;}};
   const result=fn(draft,tx);data=draft;return result;
  },
 };
 const functions=runInNewContext(between('const HISTORY_STORES =','export async function put(')+'\n'+save+'\n'+validation+'\n'+
  between('export async function saveNew(','// Doğrulanmış şoför kayıtları:')+'\n'+
  between('export async function updateIf(','// İş sözleşmesi (m³)')+'\n'+tariff+
  ';({saveNew,saveExisting,updateIf,changeDumpTariff});',context);
 return {...functions,read,data:()=>structuredClone(data),writes:()=>writes};
}
const date='2026-10-20',stamp=date+'T00:00:00.000Z';
const work={id:'W',date,customer_id:'C',vehicle_id:'V',dump_site_id:'D',unit:'Sefer',quantity:3,work_type:'Hafriyat Nakliye',updated_at:stamp};
const seed={customers:[{id:'C'}],vehicles:[{id:'V',type:'Kamyon',load_ton:20}],dump_sites:[{id:'D',fee:100,fee_unit:'Ton',updated_at:stamp}],work_records:[],dump_entries:[]};
const equal=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
async function rejectsUnchanged(f,op){const before=f.data(),count=f.writes();await assert.rejects(op);equal(f.data(),before);assert.equal(f.writes(),count);}

// New record snapshots survive mutable master cards and harmless edits.
{
 const f=fixture(seed),created=await f.saveNew('work_records',work,'SYNTHETIC');
 assert.equal(created.dump_estimate_snapshot.amount,6000);assert.equal(created.dump_estimate_snapshot.load_ton,20);
 const snapshot=structuredClone(created.dump_estimate_snapshot),tariff=structuredClone(created.dump_tariff_snapshot);
 await f.saveExisting('vehicles',f.read('vehicles','V'),{load_ton:15},'SYNTHETIC');
 await f.changeDumpTariff(f.read('dump_sites','D'),{fee:200,fee_unit:'Ton',fee_effective_from:'2026-10-21'},'SYNTHETIC');
 equal(f.read('work_records',created.id).dump_estimate_snapshot,snapshot);
 const edited=await f.saveExisting('work_records',created,{description:'Safe note'},'SYNTHETIC');
 equal(edited.dump_estimate_snapshot,snapshot);equal(edited.dump_tariff_snapshot,tariff);
 const quantity=await f.saveExisting('work_records',edited,{quantity:4},'SYNTHETIC');
 assert.equal(quantity.dump_estimate_snapshot.amount,8000);assert.equal(quantity.dump_estimate_snapshot.fee,100);assert.equal(quantity.dump_estimate_snapshot.load_ton,20);
 dump.validateDumpData(f.data());
 const second=await f.saveNew('work_records',{...work,id:undefined,date:'2026-10-22'},'SYNTHETIC');
 assert.equal(second.dump_estimate_snapshot.load_ton,15);assert.equal(second.dump_estimate_snapshot.fee,200);assert.equal(second.dump_estimate_snapshot.amount,9000);
 const manual=await f.saveNew('work_records',{...work,id:undefined,dump_site_id:null,dump_cost:500},'SYNTHETIC');
 assert.equal(manual.dump_estimate_snapshot.manual_amount,500);
}
// Legacy edits and tariff changes cannot manufacture historical basis snapshots.
{
 const f=fixture({...seed,work_records:[work]});
 const edited=await f.saveExisting('work_records',work,{description:'Legacy note'},'SYNTHETIC');
 assert.equal(edited.dump_estimate_snapshot,undefined);assert.equal(edited.dump_tariff_snapshot,undefined);
 const before=f.read('work_records','W');
 await f.changeDumpTariff(f.read('dump_sites','D'),{fee:200,fee_unit:'Ton',fee_effective_from:'2026-10-21'},'SYNTHETIC');
 equal(f.read('work_records','W'),before);
 assert.equal(f.read('dump_sites','D').fee_history[0].fee,100);
}
// Both write APIs reject forged snapshots; no partial record or audit writes.
{
 const f=fixture(seed),created=await f.saveNew('work_records',work,'SYNTHETIC');
 for(const key of ['dump_estimate_snapshot','dump_tariff_snapshot']){
  const fields={[key]:{...created[key],fee:1}};
  await rejectsUnchanged(f,()=>f.saveExisting('work_records',created,fields,'SYNTHETIC'));
  await rejectsUnchanged(f,()=>f.updateIf('work_records',created.id,()=>true,fields,'SYNTHETIC'));
 }
 for(const fields of [{quantity:4},{tonnage_scope:'per_trip'},{dump_payer:'customer'}])
  await rejectsUnchanged(f,()=>f.updateIf('work_records',created.id,()=>true,fields,'SYNTHETIC'));
 const same=await f.updateIf('work_records',created.id,()=>true,{quantity:3,description:'Unchanged basis'},'SYNTHETIC');
 equal(same.dump_estimate_snapshot,created.dump_estimate_snapshot);
}
// Missing scope/payer protections previously allowed receipt-linked legacy edits.
{
 const f=fixture({...seed,work_records:[work],dump_entries:[{id:'R',kind:'RECEIPT',work_record_id:'W'}]});
 for(const fields of [{tonnage_scope:'per_trip'},{dump_payer:'customer'}]){
  await rejectsUnchanged(f,()=>f.saveExisting('work_records',work,fields,'SYNTHETIC'));
  await rejectsUnchanged(f,()=>f.updateIf('work_records','W',()=>true,fields,'SYNTHETIC'));
 }
 await f.saveExisting('work_records',work,{description:'Receipt note'},'SYNTHETIC');
}
// Malformed estimate input cannot become a persisted numerical assumption.
{
 const f=fixture(seed);
 for(const key of ['tonnage','dump_cost']) for(const value of [true,false,{},[],Infinity,NaN,-1,'not a number',' '])
  await rejectsUnchanged(f,()=>f.saveNew('work_records',{...work,[key]:value},'SYNTHETIC'));
 for(const value of [true,false,{},[],Infinity,NaN,-1,'not a number',' '])
  await rejectsUnchanged(f,()=>f.saveExisting('vehicles',f.read('vehicles','V'),{load_ton:value},'SYNTHETIC'));
 for(const value of [true,'single',''])
  await rejectsUnchanged(f,()=>f.saveNew('work_records',{...work,tonnage_scope:value},'SYNTHETIC'));
 const legacy={...work,tonnage:-1,tonnage_scope:'old_unknown_label'};
 const old=fixture({...seed,work_records:[legacy]});
 const note=await old.saveExisting('work_records',legacy,{description:'Preserved legacy note'},'SYNTHETIC');
 assert.equal(note.tonnage,-1);assert.equal(note.tonnage_scope,'old_unknown_label');assert.equal(note.dump_estimate_snapshot,undefined);
 await rejectsUnchanged(old,()=>old.saveExisting('work_records',note,{tonnage:-2},'SYNTHETIC'));
}
console.log('dump-estimate-db PASS: capture, immutable load/rate, safe legacy edits, no tariff backfill, manual estimates, write/receipt guards, atomic rejection');

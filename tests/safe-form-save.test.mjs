import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSaveAttempt} from '../js/safe-form-save.js';
const clone=structuredClone;
function fake(){
 const data=new Map(),ops=new Map(),stats={writes:0,updates:0,attachments:0},fault={before:false,after:false,lookup:false,photo:false};
 const db={stats,fault,data,opHash:async x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),
  async get(store,id){return clone(data.get(store+':'+id));},
  async getAll(store){if(fault.lookup)throw Error('lookup unavailable');return [...data.entries()].filter(([k])=>k.startsWith(store+':')).map(([,r])=>clone(r));},
  async opLookup(id){if(fault.lookup)throw Error('lookup unavailable');const op=ops.get(id);return op?{...op,record:await db.get(op.store,op.record_id)}:null;},
  async saveNew(store,fields,reason,{op}){
   if(fault.before){fault.before=false;throw Error('before commit');}
   if(ops.has(op.id)){const old=ops.get(op.id);if(old.hash!==op.hash)throw Error('OP_CONFLICT');return {...await db.get(store,old.record_id),_existing:true};}
   const r={id:'r'+(++stats.writes),...clone(fields)};data.set(store+':'+r.id,clone(r));ops.set(op.id,{hash:op.hash,store,record_id:r.id});
   if(fault.after){fault.after=false;throw Error('lost response');}return clone(r);
  },
  async saveExisting(store,rec,fields){stats.updates++;const r={...rec,...clone(fields)};data.set(store+':'+rec.id,clone(r));if(fault.after){fault.after=false;throw Error('lost edit response');}return clone(r);},
  async addAttachment(){if(fault.photo){fault.photo=false;throw Error('photo unavailable');}stats.attachments++;},
 };
 return db;
}
{
 const db=fake(),s=createSaveAttempt(db,'one');db.fault.before=true;
 await assert.rejects(s.saveNew('expense_records',{amount:10},'TEST'),/before commit/);assert.equal(s.record,null);assert.equal(s.uncertain,false);
 const rec=await s.saveNew('expense_records',{amount:20},'TEST');assert.equal(rec.amount,20);assert.equal(db.stats.writes,1);
 await assert.rejects(s.saveNew('expense_records',{amount:30},'TEST'),/zaten oluşturuldu/);assert.equal(db.stats.writes,1);
}
{
 const db=fake(),s=createSaveAttempt(db,'lost');db.fault.after=true;
 await assert.rejects(s.saveNew('fuel_records',{liters:10},'TEST'),/lost response/);assert.equal(s.record.record.liters,10);
 const rec=await s.saveNew('fuel_records',{liters:10},'TEST');assert.equal(db.stats.writes,1);
 db.fault.photo=true;await assert.rejects(s.attach('fuel',{}),/photo unavailable/);
 await s.attach('fuel',{});assert.equal(db.stats.writes,1);assert.equal(db.stats.attachments,1);
 db.data.set('fuel_records:'+rec.id,{...rec,liters:99});
 await assert.rejects(s.attach('fuel',{}),/başka yerde değişti/);assert.equal(db.stats.attachments,1);
 db.data.set('fuel_records:'+rec.id,{...rec,deleted_at:'x'});
 await assert.rejects(s.saveNew('fuel_records',{liters:10},'TEST'),/artık kullanılamıyor/);
}
{
 const db=fake(),s=createSaveAttempt(db,'unknown');db.fault.after=true;db.fault.lookup=true;
 await assert.rejects(s.saveNew('expense_records',{amount:100},'TEST'),/lost response/);assert.equal(s.uncertain,true);assert.equal(s.record,null);
 db.fault.lookup=false;const r=await s.saveNew('expense_records',{amount:100},'TEST');assert.equal(r.amount,100);assert.equal(s.uncertain,false);assert.equal(db.stats.writes,1);
 assert.equal(s.record.record._existing,undefined,'retry-only marker does not become record content');
}
{
 const db=fake(),s=createSaveAttempt(db,'credit');let calls=0;
 const write=async key=>{calls++;const r={id:'B',request_id:key,amount:50};db.data.set('payables:B',clone(r));throw Error('lost payable response');};
 await assert.rejects(s.external('payables',{amount:50},write),/lost payable response/);
 const r=await s.external('payables',{amount:50},write);assert.equal(r.id,'B');assert.equal(calls,1);
 await s.attach('payable',{});assert.equal(db.stats.attachments,1);
 await assert.rejects(s.external('payables',{amount:55},write),/zaten oluşturuldu/);
}
{
 const db=fake(),s=createSaveAttempt(db,'edit'),rec={id:'M',cost:100};db.data.set('maintenance_records:M',clone(rec));db.fault.after=true;
 await assert.rejects(s.update('maintenance_records',rec,{cost:125.25},'TEST'),/lost edit response/);
 await s.update('maintenance_records',rec,{cost:125.25},'TEST');await s.attach('maintenance',{});
 assert.equal(db.stats.updates,1);assert.equal(db.stats.attachments,1);
}
{
 const db=fake(),s=createSaveAttempt(db,'cancelled');assert.equal(await s.external('payables',{},async()=>null),null);assert.equal(s.record,null);
 assert.equal(s.uncertain,false);assert.equal(db.stats.writes,0);
}
console.log('safe form save: precommit correction, uncertain/lost response recovery, immutable saved content, photo-only retry, stale/deleted targets, credit cancellation and edit retry OK');

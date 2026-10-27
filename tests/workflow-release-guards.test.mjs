import assert from 'node:assert/strict';
import {upsertTaskCenter,listTaskCenter} from '../js/assistant-task-center.js';
import {dealChainModel} from '../js/deal-chain-core.js';
import {workFileModel} from '../js/work-file-core.js';
import {operationModel} from '../js/operation-core.js';

const task=(id,status)=>({version:1,id,chat_id:'CHAT',rev:1,status,native:true,goal:id,source:'TEST',plan:{works:[{quantity:1}]},updated_at:'2026-10-27T12:00:00Z'});
let center;
for (const status of ['draft','clarify','review','applying']) center=upsertTaskCenter(center,task(status,status),{id:'CHAT',turns:[]});
for (let i=0;i<60;i++) center=upsertTaskCenter(center,task('closed'+i,i%2?'complete':'cancelled'),{id:'CHAT',turns:[]});
for (const id of ['draft','clarify','review','applying']) assert.ok(listTaskCenter(center).items.some(t=>t.id===id),id+' must survive history retention');
assert.equal(center.items.filter(t=>['complete','cancelled'].includes(t.status)).length,20);
assert.equal(listTaskCenter(center).open.length,2);
assert.equal(listTaskCenter(center).recovery.length,2);

const date='2026-10-20';
const d={quotes:[{id:'Q1',customer_id:'C',site_id:'S',date},{id:'Q2',customer_id:'C',site_id:'S',date}],sites:[{id:'S',customer_id:'C',name:'TEST'}],
 work_records:[{id:'W1',quote_id:'Q1',customer_id:'C',site_id:'S',vehicle_id:'V1',personnel_id:'P1',date,unit:'Saat',quantity:1},
 {id:'W2',quote_id:'Q2',customer_id:'C',site_id:'S',vehicle_id:'V2',personnel_id:'P2',date,unit:'Saat',quantity:9},
 {id:'CTX',customer_id:'C',site_id:'S',date,unit:'Saat',quantity:2}],
 cash_records:[{id:'P2',cash_type:'Müşteriden Para Alındı',customer_id:'C',work_record_id:'W2',amount:4000,date}],customers:[{id:'C',name:'TEST'}],
 hakedis:[{id:'CANCELLED',status:'İptal',quote_id:'Q1',customer_id:'C',items:[{work_record_id:'W1'}]}],vehicles:[],personnel:[]};
const before=JSON.stringify(d),chain=dealChainModel(d,'Q1');
assert.deepEqual(chain.works.map(w=>w.id),['W1']);assert.equal(chain.payments.length,0);assert.equal(chain.claims.length,0);
assert.deepEqual(chain.contextWorks.map(w=>w.id),['W2','CTX']);assert.equal(chain.generalCustomerPayments,4000);
assert.equal(chain.stages.payment.status,'Müşteri hesabında tahsilat var; zincire tahsisli değil');
assert.equal(JSON.stringify(d),before);

const docs={...d,documents:[{id:'DOC',owner_type:'work',owner_id:'W1',work_record_id:'W1',doc_no:'TEST-DOC'},
 {id:'OLD',owner_type:'work',owner_id:'W1',deleted_at:'2026-10-21'},
 {id:'OTHER',owner_type:'work',owner_id:'W2'},
 {id:'CONFLICT',owner_type:'work',owner_id:'W2',work_record_id:'W1'}],attachments:[
 {id:'A',record_type:'document',record_id:'DOC'},{id:'A',record_type:'document',record_id:'DOC'},
 {id:'B',record_type:'work',record_id:'W1'}, {id:'X',record_type:'document',record_id:'OTHER'},
 {id:'Y',record_type:'document',record_id:'OLD'},{id:'Z',record_type:'document',record_id:'CONFLICT'}]};
const file=workFileModel(docs,'W1');
assert.deepEqual(file.documents.map(x=>x.id),['DOC']);assert.deepEqual(file.attachments.map(x=>x.id),['A','B']);
assert.equal(file.slipStatus,'Fiş / belge dayanağı var');

const model=operationModel(d,{date,vehicle_id:'V1',personnel_id:'P1'});
assert.equal(model.close.filtered,true);assert.equal(model.stream.counts.work,1);
assert.equal(model.close.scoped.work_count,1);assert.equal(model.close.scoped.units.Saat,1);
assert.equal(model.close.current.work_count,3);assert.equal(model.close.current.units.Saat,12);
assert.equal(operationModel(d,{date}).close.filtered,false);
console.log('workflow release guards PASS: unfinished task retention, exact quote attribution, work-owned document joins and explicit company/filtered closing scopes');

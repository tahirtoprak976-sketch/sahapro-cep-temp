import assert from 'node:assert/strict';
import {workReviewContext,unpricedGroups} from '../js/collect-core.js';
import {attentionItems} from '../js/attention.js';
import {exploreWorks} from '../js/work-explorer.js';
import {businessOverview,workPriceState} from '../js/business-overview.js';
import {monthlySeries} from '../js/finance-chart.js';
import {pdfPending,pdfRowRecorded} from '../js/pending-records.js';
const today='2026-10-20',w=(id,extra={})=>({id,date:today,customer_id:'C',quantity:2,unit:'Saat',work_type:'TEST',...extra});
const data={customers:[{id:'C',name:'TEST'},{id:'I',name:'İç',internal:true}],work_records:[
  w('missing'),w('zero',{price_snapshot:{amount:0,unit_price:0}}),
  w('locked',{price_snapshot:{locked:true}}),w('billed'),w('draft'),
  w('fuel',{customer_fuel_allowance_l:75}),w('fuel-source',{price_snapshot:{price_source:'Mazot karşılığı'}}),
  w('included',{price_snapshot:{price_source:'Sözleşmeye dahil'}}),
  w('internal',{customer_id:'I'}),w('unit-price',{price_snapshot:{unit_price:125.25}}),
  w('internal-source',{price_snapshot:{price_source:'İç iş (kendi depo)'}}),
  w('deleted',{deleted_at:'x'}),
],hakedis:[{status:'Kesinleşti',items:[{work_record_id:'billed'}]},{status:'Taslak',items:[{work_record_id:'draft'}]}]};
const before=JSON.stringify(data),context=workReviewContext(data);
const attention=attentionItems(data,{today}).find(item=>item.key==='fiyatsiz');assert.equal(attention.count,2);
const workList=exploreWorks(data.work_records,{}, {f:'fiyatsiz'},{today,...context});
assert.deepEqual(workList.rows.map(row=>row.id).sort(),['draft','missing']);
assert.deepEqual(unpricedGroups(data,'C').flatMap(group=>group.works.map(row=>row.id)).sort(),['draft','missing']);
assert.deepEqual(unpricedGroups(data,'I'),[]);
const overview=businessOverview(data,{today});assert.deepEqual(overview.missing.map(row=>row.id).sort(),['draft','missing']);
assert.equal(workPriceState(data.work_records.find(row=>row.id==='billed'),data),'billed');
assert.equal(workPriceState(data.work_records.find(row=>row.id==='locked'),data),'locked');
assert.equal(workPriceState(data.work_records.find(row=>row.id==='fuel'),data),'fuel');
const month=monthlySeries(data,{today,months:1})[0];assert.equal(month.unpriced,2);
assert.equal(month.work,250.5,'legacy unit price × quantity is the same work value as the overview');
assert.equal(month.work,overview.totals.value);
assert.equal(JSON.stringify(data),before);

const meta=[{key:'pdf_history_draft:H',value:{_file_name:'TEST.pdf',rows:[{id:'1',kind:'work'},{id:'2',kind:'fuel'},{id:'3',kind:'expense'},{id:'4',kind:'summary'}]}},
 {key:'op:pdf-history:H:1',value:{store:'work_records',record_id:'zero'}},
 // A wrong-kind reference must not silently hide an unfinished PDF row.
 {key:'op:pdf-history:H:2',value:{store:'work_records',record_id:'zero'}},
 {key:'op:pdf-history:H:3',value:{store:'expense_records',record_id:'removed'}}];
const d={...data,expense_records:[{id:'removed',deleted_at:'x'}]};
assert.equal(pdfPending(meta,d).rows,2);
assert.equal(pdfRowRecorded(new Map(meta.map(item=>[item.key,item.value])),d,'H',{id:'2',kind:'fuel'}),false);
const home=attentionItems(d,{today,meta}),board=businessOverview(d,{today,meta});
assert.equal(home[0].key,'pdf');assert.equal(home[0].count,2);
assert.equal(board.attention.filter(item=>item.key==='pdf').length,1);
assert.equal(board.attention.find(item=>item.key==='pdf').count,2);
const completed=[...meta,{key:'op:pdf-history:H:2',value:{store:'fuel_records',record_id:'fuel-active'}},{key:'op:pdf-history:H:3',value:{store:'expense_records',record_id:'expense-active'}}];
const done={...d,fuel_records:[{id:'fuel-active'}],expense_records:[{id:'expense-active'}]};
assert.equal(pdfPending(completed,done).rows,0);
assert.ok(!attentionItems(done,{today,meta:completed}).some(item=>item.key==='pdf'));
console.log('review consistency: protected prices, finalized/draft invoices, home/list/cari/chart/overview parity, legacy work value and typed PDF completion OK');

import assert from 'node:assert/strict';
import {parseWorkQuantityChange as parse,previewWorkQuantity as preview} from '../js/assistant-operations.js';
import {routeCommand} from '../js/command-router.js';
import {normalizePdfHistory as norm,pdfRowFields} from '../js/pdf-history-core.js';
import {backupParts,restoreBackup} from '../js/backup.js';
for(const value of ['-3','−3','- 3','1/2','1/ 2','2–3','1,234,5','1.234.5','1.000','1 500','1e+3','1000000000001']){
 const text=`İşi ${value} saat yap`;assert.equal(parse(text),null,text);
 assert.notEqual(routeCommand(text,{},'2026-10-19')?.kind,'work_quantity',text);
}
for(const value of ['1,5','1.5','1000'])assert.ok(parse(`İşi ${value} saat yap`));
assert.equal(parse('Mahir 19.10.2026 3 saat yap').quantity,3);
assert.equal(routeCommand('İşi -3 saat yap',{},'2026-10-19').kind,'choose');
const row={kind:'work',page:1,quote:'Örnek satır',date:'2026-05-11',customer_name:'Test',vehicle_name:'34TEST123',work_type:'Kazı',unit:'Saat',quantity:2};
for(const value of [true,false,[],{},1e13,Infinity])assert.equal(norm({rows:[{...row,quantity:value}]}).rows[0].quantity,null);
for(const value of [null,[],5,'work'])assert.throws(()=>norm({rows:[value]}),/satır biçimi/);
assert.equal(norm({rows:[row],totals:[null,3,{}, {kind:'fuel',unit:'L',value:10}]}).totals.length,1);
const data={customers:[{id:'C',name:'Test'}],vehicles:[{id:'V',name:'34TEST123'}]};
const r=norm({rows:[row]},data).rows[0];
assert.throws(()=>pdfRowFields({...r,unit_price:1e10,quantity:1e10,kdv_rate:20,kdv_included:false},data,{}),/tutarı/);
assert.throws(()=>pdfRowFields({...r,unit_price:100,kdv_rate:20,kdv_included:'false'},data,{}),/KDV/);
assert.throws(()=>preview({id:'W',unit:'Saat',quantity:1,updated_at:'now',price_snapshot:{unit_price:1e10,kdv_rate:20,kdv_included:false}},{type:'work.quantity',quantity:1e10,unit:'Saat'}));
const db={dumpAll:async()=>({customers:[{id:'C',name:'x'.repeat(6500)}]}),getAll:async s=>s==='attachments'?[{id:'A',record_type:'customer',record_id:'C',blob:new Blob(['a'.repeat(2600)])}]:[],metaGet:async()=>null};
const set=await backupParts(db,{budget:10000});assert.equal(set.count,2);
let index;for await(const p of set){assert.ok(JSON.stringify(p).length<=10000);if(p.part.no===1){assert.equal(p.attachments.length,0);index=p.part.index;}else assert.equal(index[0][3],2);}
for(const budget of [NaN,Infinity,-1,0,1000,1.5])await assert.rejects(backupParts(db,{budget}));
for(const part of [{set:'T',no:1.5,of:2},{set:'T',no:1,of:Infinity},{set:{},no:1,of:1},{set:'T',no:1,of:10001}])await assert.rejects(restoreBackup({metaGet:async()=>null}, {part}),/bilgileri/);
console.log('redteam inputs: PASS');
// Counter changes alone cannot conceal a missing or foreign attachment.
const metaOnly={metaGet:async()=>null};
const manifest={set:'T',no:1,of:1,part_attachments:0,index:[['A','work','W',1]],totals:{attachments:1}};
await assert.rejects(restoreBackup(metaOnly,{part:manifest,attachments:[]}),/dizinle/);
for(const index of [[['A','work','W',1],['A','work','W',1]],[['__proto__','work','W',1]],[['A','work','W',1.5]],[['A','work','W',2]]])await assert.rejects(restoreBackup(metaOnly,{part:{...manifest,index},attachments:[]}),/dizini/);
const pendingDb={metaGet:async()=>({of:2,done:[1],pending:{A:['work','W',2]}})};
await assert.rejects(restoreBackup(pendingDb,{part:{set:'T',no:2,of:2,part_attachments:0},attachments:[]}),/dizinle/);
// Deterministic varied payload packing: compare actual serialized output, including manifest/index.
for(let i=1;i<=25;i++){
 const attachments=Array.from({length:i%7},(_,j)=>({id:'A'+j,record_type:'work',record_id:'W',name:'ş\\"'.repeat(i),blob:new Blob(['x'.repeat(1000+(i*j*71)%4000)])}));
 const data={work_records:[{id:'W',description:'ü'.repeat(i*300)}]};
 const d={dumpAll:async()=>data,metaGet:async()=>null,getAll:async s=>s==='attachments'?attachments:[]};
 const packed=await backupParts(d,{budget:15000});let files=0;
 for await(const part of packed){assert.ok(JSON.stringify(part).length<=15000);files+=part.attachments.length;}
 assert.equal(files,attachments.length);
}
console.log('redteam backup manifests + 25 packing variants: PASS');

const {pack,unpack,extractPayloads,DRIVER_JSON_LIMIT,DRIVER_CODE_LIMIT}=await import('../js/driver-core.js');
const good=await pack({v:1,p:'P',e:[{id:'E'}]});assert.equal((await extractPayloads('SP1:'+good)).length,1);
const bomb=await pack({v:1,e:[],note:'x'.repeat(DRIVER_JSON_LIMIT+1)});
await assert.rejects(unpack(bomb),{code:'DRIVER_LIMIT'});
await assert.rejects(extractPayloads('SP1:'+bomb),{code:'DRIVER_LIMIT'});
await assert.rejects(unpack('A'.repeat(DRIVER_CODE_LIMIT+1)),{code:'DRIVER_LIMIT'});
await assert.rejects(extractPayloads(Array(201).fill('SP1:'+good).join('\n')),{code:'DRIVER_LIMIT'});
assert.equal((await extractPayloads('SP1:'+await pack({v:1,e:[null]}))).length,0);
console.log('redteam driver compressed bomb / packet limits: PASS');

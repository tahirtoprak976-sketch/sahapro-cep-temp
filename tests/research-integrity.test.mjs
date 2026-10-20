import assert from 'node:assert/strict';
import {fullBackup,backupParts,restoreBackup} from '../js/backup.js';
import {startActivity,allowUpdate,updateRisk} from '../js/update-safety.js';
import {deviceStorageStatus} from '../js/storage-status.js';
const snapshot={data:{customers:[{id:'C',name:'old'}],work_records:[{id:'W',customer_id:'C'}]},attachments:[{id:'A',record_type:'work',record_id:'W',blob:new Blob(['old']),size:3}],meta:[{key:'device_install_id',value:'DEV'},{key:'gemini_key',value:'SECRET'},{key:'driver_links',value:[{secret:'SIGN'}]}],drafts:[{form:'pdf_history_file:H',blob:new Blob(['pdf'])}],captured_at:'2026-10-20T00:00:00.000Z'};
let reads=0;const db={readSnapshot:async opts=>{assert.equal(opts.meta,true);reads++;return structuredClone(snapshot);},getAll:()=>{throw Error('separate table read forbidden')},dumpAll:()=>{throw Error('separate entity read forbidden')}};
const b=await fullBackup(db,{encrypted:false});assert.equal(reads,1);assert.equal(b.exported_at,snapshot.captured_at);assert.equal(b.device_install_id,'DEV');assert.equal(b.attachments[0].base64,btoa('old'));assert.equal(b.coverage.consistent_snapshot,true);assert.equal(b.coverage.pdf_draft_files_not_included,1);assert.equal(b.coverage.driver_phone_queue_included,false);assert.deepEqual(b.meta.map(x=>x.key),['device_install_id']);
const p=await backupParts(db,{encrypted:true,budget:4096});assert.equal(reads,2);snapshot.data.customers[0].name='new';snapshot.attachments.push({id:'B',blob:new Blob(['new'])});
for await(const part of p){assert.equal(part.coverage.consistent_snapshot,true);assert.equal(part.data.customers[0].name,'old');assert.equal(part.attachments.length,1);assert.equal(part.part.totals.attachments,1);assert.ok(!part.meta.some(m=>m.key==='gemini_key'));assert.ok(part.meta.some(m=>m.key==='driver_links'));}
const release=startActivity('test');let asked=0;assert.equal((await allowUpdate(null,async()=>{asked++;return true})).allowed,false);assert.equal(asked,0);release();assert.deepEqual(updateRisk(null),{busy:false,unsaved:false});assert.equal((await allowUpdate(null,async()=>false)).allowed,true);
const storageDb={getAll:async()=>snapshot.drafts,metaGet:async k=>k==='last_backup_at'?'2026-10-20':{method:'shared'}};
const status=await deviceStorageStatus(storageDb,{estimate:async()=>({usage:3,quota:100}),persisted:async()=>false});assert.equal(status.pdfDraftFiles,1);assert.equal(status.usage,3);assert.equal(status.persisted,false);
const unknown=await deviceStorageStatus(storageDb,{estimate:async()=>{throw Error('unavailable')},persisted:async()=>{throw Error('unavailable')}});assert.equal(unknown.usage,null);assert.equal(unknown.persisted,null);
console.log('research-integrity OK: one snapshot, fixed part contents, secret filtering, truthful coverage/storage, update activity lock');

await assert.rejects(restoreBackup({metaGet:async()=>null},{app:'bad'}),/yedek|şema/);assert.equal(updateRisk(null).busy,false,'restore failure releases update lock');
const {backupArchive}=await import('../js/backup-archive.js');
const snap={data:{work_records:[{id:'W'}]},meta:[],captured_at:'2026-10-20T00:00:00Z',attachments:[{id:'a/b',record_type:'work',record_id:'W',name:'same.jpg',blob:new Blob(['first'])},{id:'a_b',record_type:'work',record_id:'W',name:'same.jpg',blob:new Blob(['second'])}]};
const archive=await backupArchive(snap,{budget:10000});assert.equal(archive.count,2);assert.equal(new Set(archive.index.map(x=>x.path)).size,2);assert.equal(archive.blob.type,'application/zip');
await assert.rejects(backupArchive({...snap,attachments:[{id:'lost',blob:null}]},{budget:10000}),/okunamadı/);
await assert.rejects(backupArchive({...snap,attachments:[{id:'big',blob:new Blob(['x'.repeat(20000)])}]},{budget:10000}),/Eksik ZIP oluşturulmadı/);
class Unreadable extends Blob {async arrayBuffer(){throw Error('disk unavailable')}}
await assert.rejects(backupArchive({...snap,attachments:[{id:'bad',blob:new Unreadable(['x'])}]},{budget:10000}),/okunamadı/);
console.log('research archive OK: unique paths, bounded size, missing/unreadable file fails without partial ZIP');

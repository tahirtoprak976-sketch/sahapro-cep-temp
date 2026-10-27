import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PNG,PNG_BLUE,JPEG,WEBP,pdfBytes} from './support/attachment-fixtures.mjs';
import {prepareAttachment,attachmentView,attachmentType,safeAttachmentName,prepareAudioPreview,prepareInvoiceOriginal} from '../js/attachment-safety.js';
import * as db from '../js/db.js';
import {preparePartFiles} from '../js/parts-db.js';
import {buildZip} from '../js/core.js';
import {makeDriverBundle,openDriverBundle} from '../js/driver-bundle.js';
const unsafe='<svg xmlns="http://www.w3.org/2000/svg"><script>/* synthetic only */</script></svg>';
for(const type of ['image/svg+xml','image/png','image/jpeg','application/pdf','text/html','']) {
 const file=new File([unsafe],'spoof.jpg',{type});
 await assert.rejects(()=>prepareAttachment(file),/JPEG.*PNG.*WebP.*PDF/);
 // Invalid sources are rejected before touching IndexedDB/business data.
 for(const invoke of [()=>db.addAttachment('work','TEST',file),()=>db.saveDocument({},file),()=>db.signSlip('TEST',file),()=>db.signContract('TEST',[file,file]),()=>db.storePdfHistoryFile('a'.repeat(64),file),()=>preparePartFiles([file])]) await assert.rejects(invoke,/JPEG.*PNG.*WebP.*PDF/);
 const before=await file.text(), view=await attachmentView({blob:file,name:'../../unsafe.svg',type:'image/png'});
 assert.equal(view.safe,false);assert.equal(view.image,false);assert.equal(view.blob.type,'application/octet-stream');assert.ok(view.downloadName.endsWith('.quarantined.bin'));assert.ok(!view.downloadName.includes('/'));assert.equal(await view.blob.text(),before);assert.equal(await file.text(),before,'legacy original must never be changed');
}
for(const [bytes,type] of [[PNG,'image/png'],[JPEG,'image/jpeg'],[WEBP,'image/webp'],[pdfBytes(),'application/pdf']]) {
 const file=new File([bytes],'wrong.svg',{type:'text/html'}), result=await prepareAttachment(file);
 assert.equal(result.type,type);assert.deepEqual(new Uint8Array(await result.arrayBuffer()),bytes,'type repair must preserve exact source bytes');
 const view=await attachmentView({blob:file,type:'image/svg+xml',name:'wrong.svg'});assert.equal(view.safe,true);assert.equal(view.type,type);assert.notEqual(view.downloadName,'wrong.svg');
}
for(const bytes of [new Uint8Array([255,216,255]),PNG.slice(0,30),WEBP.slice(0,16),new TextEncoder().encode('%PDF-1.7\n<script>TEST</script>')]) await assert.rejects(()=>prepareAttachment(new File([bytes],'prefix.png',{type:'image/png'})));
await assert.rejects(()=>prepareAttachment(new File([pdfBytes()],'x.pdf'),{imageOnly:true}));
await assert.rejects(()=>prepareAttachment(new File([PNG],'x.png'),{pdfOnly:true}));
await assert.rejects(()=>prepareAttachment(new File([PNG],'x.png'),{maxBytes:1}));
// Real browsers additionally decode raster pixels; a decoding failure is fatal.
let closes=0;globalThis.createImageBitmap=async()=>({width:1,height:1,close(){closes++}});
await prepareAttachment(new File([PNG],'ok.png'));assert.equal(closes,1);
globalThis.createImageBitmap=async()=>{throw Error('invalid decoder input')};
await assert.rejects(()=>prepareAttachment(new File([PNG],'bad.png')),/bozuk/);
assert.equal((await attachmentView({blob:new Blob([PNG])})).safe,false);
delete globalThis.createImageBitmap;
// Backup/restore remains byte-preserving; safety is evaluated again on opening.
const source=readFileSync(new URL('../js/backup.js',import.meta.url),'utf8');assert.match(source,/blob: new Blob\(\[bytes\], \{ type: a.type \}\)/);
const views=['m-work','pro','m-ops','parts-ui','m-crm','m-finance','esnaf','dump-account-ui','leave-form'];
for(const name of views){const text=readFileSync(new URL('../js/'+name+'.js',import.meta.url),'utf8');assert.match(text,/attachmentHTML/);assert.ok(!/createObjectURL\((?:a\.blob|sig\.)/.test(text),name+' cannot expose raw stored images to context-open');}
const packet={text:'TEST\nSP1:abcdefghijk.signature123',rows:[{id:'TEST'}],files:[new File([PNG],'same.png',{type:'image/png'}),new File([PNG_BLUE],'same.png',{type:'image/png'})]};
const bundle=await makeDriverBundle(packet),opened=await openDriverBundle(bundle.files[0]);assert.deepEqual(await Promise.all(opened.files.map(async f=>new Uint8Array(await f.arrayBuffer()))),[PNG,PNG_BLUE]);
await assert.rejects(()=>makeDriverBundle({...packet,files:[new File([unsafe],'spoof.png',{type:'image/png'})]}));
assert.equal(attachmentType(new TextEncoder().encode(unsafe)),null);assert.equal(safeAttachmentName('test.svg','image/png'),'test.png');
const xml=new File(['<Invoice><ID>TEST-INVOICE</ID><IssueDate>2026-10-01</IssueDate></Invoice>'],'TEST.xml',{type:'application/xml'});
const archiveZip=new File([buildZip([{name:'invoice.xml',data:new Uint8Array(await xml.arrayBuffer())}])],'TEST.zip',{type:'application/zip'});
for(const file of [xml,archiveZip]) {const original=await prepareInvoiceOriginal(file);assert.equal(original,file);const view=await attachmentView({blob:original,name:file.name});assert.equal(view.safe,false);assert.equal(view.blob.type,'application/octet-stream');assert.deepEqual(new Uint8Array(await view.blob.arrayBuffer()),new Uint8Array(await file.arrayBuffer()));}
await assert.rejects(()=>prepareInvoiceOriginal(new File([unsafe],'spoof.xml')),/e-fatura/);
await assert.rejects(()=>db.saveInvoiceSourceDocument({category:'Ruhsat'},xml),/e-fatura/);
await assert.rejects(()=>prepareAudioPreview(new File([unsafe],'fake.mp3',{type:'audio/mpeg'})));
const voice=await prepareAudioPreview(new File(['ID3TEST-only'],'note.mp3',{type:'image/svg+xml'}));assert.equal(voice.type,'audio/mpeg');
console.log('attachment-safety PASS: byte allowlist/canonical MIME, framed files, decoder failure, source preservation, all ingress guards, quarantine and legacy view source guards');

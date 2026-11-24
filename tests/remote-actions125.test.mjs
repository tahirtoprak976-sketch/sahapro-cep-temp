import assert from 'node:assert/strict';
import {ACTION_FORMAT,readActionsPacket,decodeActionFiles,actionsPlan,actionSourceKey} from '../js/remote-actions-core.js';
import {readApprovedPacket} from '../js/remote-approved-core.js';
import {createRemoteAuthority,sealRemoteBox,openRemoteBox} from '../js/remote-approved-crypto.js';
const now=Date.now(),at=new Date(now).toISOString();
const offset={source_key:'TEST-offset125',date:'2026-01-01',customer:'TEST client125',vehicle:'TEST vehicle125',personnel:'TEST operator125',liters:4,unit_price:12.5,amount:50,reason:'TEST customer paid fuel; no company cash',price_basis:'reference',price_source:'https://example.test/TEST-dated-pump'};
const packet={format:ACTION_FORMAT,id:crypto.randomUUID(),approved:{confirmed:true,at,summary:'TEST explicit offset and document'},offsets:[offset],documents:[]};
const base64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6AAAAAElFTkSuQmCC';
// Framed PNG fixture; browser suite uses a Pillow-generated complete image.
const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
const doc={source_key:'TEST-document125',date:'2026-01-01',category:'İrsaliye',doc_no:'TEST-125',owner_source_key:'TEST-work125',name:'TEST-original.png',mime:'image/png',base64,sha256};
packet.documents=[doc];
const data={customers:[{id:'c',name:offset.customer}],vehicles:[{id:'v',name:offset.vehicle}],personnel:[{id:'p',name:offset.personnel}],work_records:[{id:'w',history_source:{row_id:doc.owner_source_key}}],meta:[],documents:[],attachments:[],cari_movements:[]};
assert.deepEqual(readApprovedPacket(packet),packet);const files=await decodeActionFiles(readActionsPacket(packet));const plan=actionsPlan(packet,data,files);
assert.equal(plan.writes.cari_movements[0].amount,-50);assert.equal(plan.writes.cari_movements[0].type,'Duzeltme');assert.equal(plan.writes.documents[0].owner_id,'w');assert.equal(plan.writes.attachments[0].blob.size,bytes.length);assert.equal(plan.writes.attachments[0].src_sha256,sha256);assert.equal(plan.writes.meta.length,2);assert.match(plan.writes.meta[0].value.signature,/^[a-f0-9]{64}$/);assert(!JSON.stringify(plan.writes.meta).includes(base64));assert.deepEqual(Object.keys(plan.writes).sort(),['attachments','cari_movements','documents','meta']);
for(const modify of [p=>p.approved.confirmed=false,p=>p.offsets[0].amount=49,p=>p.offsets[0].unit_price=NaN,p=>p.offsets[0].date='2026-02-31',p=>p.offsets[0].amount='50',p=>p.offsets[0].extra='save all',p=>p.documents[0].mime='text/html',p=>p.documents[0].base64='!',p=>p.documents[0].owner_source_key='',p=>p.documents.push(structuredClone(doc)),p=>p.approved.at='2020-01-01T00:00:00.000Z']){const p=structuredClone(packet);modify(p);assert.throws(()=>readActionsPacket(p));}
let bad=structuredClone(packet);bad.documents[0].sha256='0'.repeat(64);await assert.rejects(decodeActionFiles(bad),/özeti/);bad=structuredClone(packet);bad.documents[0].mime='application/pdf';await assert.rejects(decodeActionFiles(bad),/türü/);
assert.throws(()=>actionsPlan(packet,{...data,customers:[...data.customers,{id:'other',name:offset.customer}]},files),/tek/);assert.throws(()=>actionsPlan(packet,{...data,work_records:[]},files),/iş/);
const saved={...data,meta:plan.writes.meta,cari_movements:plan.writes.cari_movements,documents:plan.writes.documents,attachments:plan.writes.attachments};assert.equal(actionsPlan(packet,saved,files).repeated,2);
const changed=structuredClone(packet);changed.offsets[0].reason='TEST different';assert.throws(()=>actionsPlan(changed,saved,{...files,signatures:new Map([[offset.source_key,'different']])}),/OP_CONFLICT/);
assert.throws(()=>actionsPlan(packet,{...saved,cari_movements:[{...plan.writes.cari_movements[0],deleted_at:at}]},files),/silinmiş/);
const dup=structuredClone(packet);dup.documents[0].source_key='TEST-other-source';dup.offsets=[];const dupFiles=await decodeActionFiles(dup);assert.throws(()=>actionsPlan(dup,{...saved,meta:[]},dupFiles),/zaten/);
const a=(await createRemoteAuthority()).authority;assert.deepEqual((await openRemoteBox(await sealRemoteBox([packet],a),a))[0].packet,packet);
console.log('remote actions125 PASS: explicit bounded contract; exact arithmetic; negative cari only; no cash/stock; actual file hash/type/owner; source replay/conflict; duplicates; encrypted roundtrip');

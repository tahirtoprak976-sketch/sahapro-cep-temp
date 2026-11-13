import assert from 'node:assert/strict';
import {previewPackets,encodePreview,decodePreview,samePreviewShape,quickPreview} from '../js/assistant-preview-stream.js';
import {offlinePlan} from '../js/offline-whatsapp.js';
import {source,cases,fixture,message,fixtureSettings} from './assistant-gold/real-messages/fixture.mjs';
const d=fixture(),text=message(source.cases.find(c=>c.id==='r00_tumu')),opts={d,today:source.today_for_test,rules:fixtureSettings().assistant_rules};
const full=offlinePlan(text,opts),packets=[...previewPackets(text,opts)],works=packets.flatMap(p=>p.value.works),fuel=packets.flatMap(p=>p.value.fuel);
assert.deepEqual(JSON.parse(JSON.stringify({works,fuel})),JSON.parse(JSON.stringify({works:full.works,fuel:full.fuel})), 'streaming does not change parsed data');
const cloned=decodePreview(structuredClone(encodePreview(packets[0].value)));assert.equal(JSON.stringify(cloned),JSON.stringify(packets[0].value));
assert.ok(samePreviewShape({works:[{quote:'[12/11/2026 19:00] Ali: Akasya işinde 2 saat çalıştı'}],fuel:[]},{works:[{quote:'Akasya işinde 2 saat çalıştı'}],fuel:[]}));
assert.equal(samePreviewShape({works:[{quote:'Akasya işinde 2 saat çalıştı'},{quote:'Akasya işinde 2 saat çalıştı'}]},{works:[{quote:'Akasya işinde 2 saat çalıştı'},{quote:'Akasya işinde 2 saat çalıştı'}]}),false,'repeated sources are not silently paired');
assert.equal(samePreviewShape({works:[{quote:'Akasya işinde 2 saat çalıştı'}]},{works:[{quote:'Akasya işinde 2 saat çalıştı'}],collections:[{amount:20}]}),false,'new financial rows require complete normal rendering');
let count=0;const aborted=[...previewPackets(text,{...opts,cancelled:()=>count++>0})];assert.equal(aborted.length,1);assert.throws(()=>[...previewPackets('x'.repeat(500001),opts)],/uzun/);
console.log('streamed source data equals full phone reader; provenance survives cloning; duplicate/financial shape guards; cancellation and size cap PASS');

const fastData={customers:[{id:'TEST_C',name:'Akasya Yapı'}],vehicles:[{id:'TEST_V',name:'Kazıcı 8',type:'JCB',assignee_id:'TEST_P'}],personnel:[{id:'TEST_P',name:'Salih',vehicle_id:'TEST_V'}]};
const quick=quickPreview('[12/11/2026 19:00] Salih: Akasya Yapı 2 saat çalıştı',{d:fastData,today:'2026-11-12'});assert.equal(quick.works[0].quantity,2);assert.equal(quick.works[0].customer_id,'TEST_C');assert.equal(quick.works[0].unit_price,null);assert.equal(quick.works[0].ok,false);assert.equal(quick._stagePending,true);
for(const body of ['2 saat çalışacak','2 saat teklif 2500 TL','2 saat mesai','20 bin nakit aldık','20 litre mazot aldı'])assert.equal(quickPreview('[12/11/2026 19:00] Salih: '+body,{d:fastData,today:'2026-11-12'}),null);
const wrongPlate=quickPreview('[12/11/2026 19:00] Salih: 34 ZZ 999 2 saat çalıştı',{d:fastData,today:'2026-11-12'});assert.equal(wrongPlate,null,'unknown explicit vehicle never falls back to assigned vehicle');
assert.equal(quickPreview('[12/11/2026 19:00] Salih: 07.09.2026 Akasya Yapı 2 saat çalıştı',{d:fastData,today:'2026-11-12'}).works[0].date,'','explicit body date cannot be replaced with header date');
console.log('fast provisional fields are non-financial, locked, do not assume an unknown plate or override body date PASS');

const {startPreview}=await import('../js/assistant-preview-ui.js');
class WorkerStub{
 static last;constructor(){WorkerStub.last=this;this.terminated=false;}postMessage(data){this.request=data;}terminate(){this.terminated=true;}
 send(data){this.onmessage({data});}
}
let shown=[];const controller=startPreview({out:{isConnected:true},text:'[12/11/2026 19:00] Salih: Akasya Yapı 2 saat çalıştı',d:fastData,today:'2026-11-12',rules:'',draw:v=>shown.push(v),WorkerClass:WorkerStub});
const worker=WorkerStub.last;assert.equal(worker.request.kind,'prepare');assert.equal(shown.length,1);assert.equal(shown[0].works[0].ok,false);
worker.send({kind:'packet',id:99,...encodePreview(packets[0].value)});assert.equal(shown.length,1,'unrelated generation cannot replace preview');
const result=controller.finish();assert.equal(result,shown[0]);assert.equal(worker.terminated,true);worker.send({kind:'packet',id:1,...encodePreview(packets[0].value)});assert.equal(shown.length,1,'late worker cannot draw after final model or cancellation');
console.log('request worker is isolated, terminated at final result, and rejects stale packets PASS');

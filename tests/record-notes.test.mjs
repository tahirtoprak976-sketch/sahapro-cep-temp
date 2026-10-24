import assert from 'node:assert/strict';
import {sourceMessageBlocks,scopeRecordSource,withRecordSource,recordNoteView,recordNoteText,recordLocalText,noteEditPatch} from '../js/record-notes.js';
import {customerHints} from '../js/assistant-core.js';
const d={vehicles:[{id:'U55',name:'U55'},{id:'U36',name:'U36'},{id:'V',name:'Manitou MTX 1840',plate:'34 GAM 627'}],customers:[{id:'A',name:'TEST Alfa İnşaat'},{id:'B',name:'TEST Beta Yapı'}],personnel:[{id:'P',name:'TEST Cihan'},{id:'S',name:'TEST Soner'}]};
const msg=`[23/10 17:54] TEST Tırcı A: TEST Ocak A 4 sefer ocak taşı TEST Dolgu
[23/10 19:03] TEST Cihan: TEST Üniversite TEST Metalciye U(55)mini kato (1)yevmiye Şantiyeden (43) lt yakıt aldım
[23/10 19:10] TEST Tırcı B: TEST Ocak B TEST Dolguya 4 sefer taş TEST Sahadan bir sefer TEST Dolguya beton parçaları ve 150 litre mazot alındı
[23/10 19:23] TEST Olcay: U36 mini kato TEST Usta 1 saat çevre düzenlemesi
[23/10 20:05] TEST Soner: 22 Ekim Perşembe TEST Alfa inşaat 3.5 saat parke verildi
[23/10 21:26] TEST Soner: 23 Ekim Cuma TEST Beta yapı TEST Ömer beye çalışıldı. TEST Şantiyeye 1 saat fayans indirildi`;
const fuel={vehicle_id:'U55',date:'2026-10-23',liters:43};
assert.equal(sourceMessageBlocks(msg).length,6);
const expected='TEST Üniversite TEST Metalciye U(55)mini kato (1)yevmiye Şantiyeden (43) lt yakıt aldım';
assert.equal(scopeRecordSource(msg,fuel,'fuel',d).text,expected);
assert.equal(recordNoteText({...fuel,description:'Asistan: '+msg},'description',d),expected);
assert.equal(sourceMessageBlocks(msg.replace(/\n/g,' ')).length,6,'old flattened notes keep message boundaries');
assert.equal(recordNoteText({...fuel,description:'Asistan: '+msg.replace(/\n/g,' ')},'description',d),expected);
assert.equal(scopeRecordSource(msg,{...fuel,source_quote:'150 litre mazot alındı'},'fuel',d).text,expected,'wrong quantity quote cannot displace actual record source');
assert.equal(scopeRecordSource(msg,{...fuel,source_quote:msg},'fuel',d).text,expected,'whole batch quote is rejected');
const work={date:'2026-10-22',customer_id:'A',vehicle_id:'V',personnel_id:'S',work_type:'Makine Çalışması',quantity:3.5,unit:'Saat'};
assert.match(scopeRecordSource(msg,work,'work',d).text,/TEST Alfa inşaat/);
assert.ok(!scopeRecordSource(msg,work,'work',d).text.includes('TEST Beta'));
const ambiguous='[23/10 19:00] A: U55 43 lt mazot aldım\n[23/10 20:00] B: U55 43 lt mazot aldım';
assert.equal(scopeRecordSource(ambiguous,fuel,'fuel',d).status,'unresolved');
assert.equal(scopeRecordSource(msg,{...fuel,liters:999},'fuel',d).text,'','cannot select another amount or invent missing text');
const manual='Lastik ve mazot kontrol edildi.\nSonraki bakımda tekrar kontrol edilecek.';
assert.equal(recordNoteText({...fuel,description:manual},'description',d),manual,'manual notes preserved');
const saved=withRecordSource({...fuel,description:''},msg,{...fuel,source_quote:'(43) lt yakıt aldım'},'fuel',d);
assert.equal(saved.description,'(43) lt yakıt aldım');assert.equal(saved.assistant_origin.message,msg);
assert.equal(recordNoteView(saved,'description',d).source,msg);
assert.equal(recordNoteText({...saved,description:'Elle düzeltilmiş not'},'description',d),'Elle düzeltilmiş not','metadata cannot overwrite user changes');
assert.ok(!recordLocalText({...work,internal_note:'Bildiren: TEST Soner · Asistan: '+msg},d).includes('Hurdacı Metin'));
assert.equal(recordNoteText({...fuel,description:'Asistan: '+ambiguous},'description',d),'');
const android='23.10.2026 19:03 - TEST Cihan: U55 43 lt mazot alındı\n23.10.2026 20:03 - Olcay: U36 150 lt mazot alındı';
assert.equal(scopeRecordSource(android,fuel,'fuel',d).text,'U55 43 lt mazot alındı');
assert.equal(scopeRecordSource(android.replaceAll('\n',' '),fuel,'fuel',d).text,'U55 43 lt mazot alındı');
assert.equal(scopeRecordSource(android.replaceAll('.2026',''),fuel,'fuel',d).text,'U55 43 lt mazot alındı');
const two='[23/10 19:03] TEST Cihan: U55 43 lt mazot alındı\nU36 50 lt mazot alındı';
assert.equal(scopeRecordSource(two,fuel,'fuel',d).text,'U55 43 lt mazot alındı');
assert.equal(scopeRecordSource('34 GAM 627 50 litre mazot alındı',{vehicle_id:'V',liters:50},'fuel',d).status,'matched');
assert.equal(scopeRecordSource('TEST Soner 3 gün izin',{personnel_id:'S'},'personnel',d).status,'matched');
assert.ok(!scopeRecordSource('SP1:abc.def\nU55 43 lt mazot alındı',fuel,'fuel',d).text.includes('SP1:'));
assert.equal(recordNoteText({description:'Faturadan bakım; maliyet gider kaydında.'},'description',d),'Faturadan bakım; maliyet gider kaydında.');
assert.equal(scopeRecordSource('[23/10 21:26] TEST Soner: TEST Beta Yapı 3.5 saat parke verildi',work,'work',d).text,'','truncated source cannot lend another customer its message');
const patch=noteEditPatch({...work,internal_note:'Asistan: '+msg},{internal_note:'Yalnız bu iş için elle not'},d,'work');
assert.equal(patch.assistant_origin.original_fields.internal_note,'Asistan: '+msg);
assert.equal(recordNoteText({...work,...patch},'internal_note',d),'Yalnız bu iş için elle not');
const polluted={...d,work_records:[1,2].map(id=>({...work,id,created_at:'2026-10-23',internal_note:'Asistan: '+msg}))};
assert.ok(!JSON.stringify(customerHints(polluted)).includes('omer'),'other customer names from shared old notes cannot teach history hints');
const corrected=withRecordSource({vehicle_id:'U55',liters:50},'U55 43 lt yakıt alındı\nU55 50 lt yakıt alındı',{vehicle_id:'U55',liters:43,source_quote:'U55 43 lt yakıt alındı'},'fuel',d);
assert.equal(corrected.description,'U55 43 lt yakıt alındı','explicit amount correction cannot steal the next record source');
console.log('record-notes PASS: actual U55/43L batch, timestamps and collapsed sources, per-row quotes, ambiguity, source preservation, manual edits, sender/customer/vehicle isolation and driver token hiding');

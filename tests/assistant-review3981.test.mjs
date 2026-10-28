// Bağımsız inceleme (v3.9.80 üzeri aday): taslak litre düzeltmesi ve fiş numarası anahtarı. TEST verisi.
import assert from 'node:assert/strict';
import {resolveDraftReply} from '../js/assistant-workflow.js';
import {ticketKey,validateTickets} from '../js/assistant-docs.js';

const today='2026-10-28';
const fuel={key:'fuel:0',kind:'fuel',index:0,label:'Yakıt 1',fields:{date:'2026-10-20',vehicle:'V',source:'Depo Tankı',liters:'',unit_price:'',total:''},options:{vehicle:[{value:'V',label:'TEST 34TST01',aliases:[]}]}};
const work={key:'work:0',kind:'work',index:0,label:'İş 1',fields:{date:'2026-10-20',customer:'C',vehicle:'V',work_type:'Hafriyat Nakliye',quantity:'2',unit:'Sefer',unit_price:''},options:{}};

// 1) "20 litre" / "20 lt" yakıt taslağının litresini değiştirir (v3.9.80'de "Tutar… pozitif" diye reddediliyordu).
for(const m of ['20 litre','20 lt','yakıt 20 litre','20,5 litre','litre 20'])
  assert.deepEqual(resolveDraftReply(m,[fuel],today),{type:'apply',key:'fuel:0',label:'Yakıt 1',updates:{liters:m==='20,5 litre'?20.5:20}},m);
// İş + yakıt taslağında litre yalnız yakıta gider; işin miktarı değişmez.
assert.deepEqual(resolveDraftReply('20 litre',[work,fuel],today),{type:'apply',key:'fuel:0',label:'Yakıt 1',updates:{liters:20}});
// Yalnız iş taslağı varken litre işe uygulanmaz (yanlış alan doldurulmaz).
assert.equal(resolveDraftReply('20 litre',[work],today),null);
// Sıfır ve para yazımı litre sayılmaz.
assert.equal(resolveDraftReply('0 litre',[fuel],today).type,'clarify');
assert.equal(resolveDraftReply('litre 20 TL',[fuel],today).type,'clarify');
// Mevcut davranış korunur: tutar ve sefer.
assert.deepEqual(resolveDraftReply('toplam 1.200 TL',[fuel],today).updates,{total:1200});
assert.deepEqual(resolveDraftReply('3 sefer',[work],today).updates,{quantity:3,unit:'Sefer'});
assert.equal(resolveDraftReply('20.000 TL',[work],today).type,'clarify');

// 2) Fiş anahtarı: önizleme ve kayıt aynı kuralı paylaşır.
assert.equal(ticketKey('A-133427'),ticketKey('a 133427'));
assert.equal(ticketKey(' A.133.427 '),'A133427');
assert.notEqual(ticketKey('A-133427'),ticketKey('A-133428'));
const d={vehicles:[{id:'V',name:'TEST kamyon',plate:'34TST627'}],customers:[],sites:[],dump_sites:[],work_records:[],
  documents:[{id:'D',category:'Döküm Fişi',doc_no:'A-133427',owner_type:'work',owner_id:'W'}]};
const [t]=validateTickets({tickets:[{photo:0,ticket_no:'A 133427',date:'2026-09-07',plate:'34TST627',tonnage:24.85,text:'A 133427 07.09.2026 34TST627 24850 kg'}]},{d,today,photoCount:1});
assert.equal(t.dup,true);assert.equal(t.ok,false);assert.ok(t.issues.includes('Bu fiş numarası zaten kayıtlı'));
console.log('assistant-review3981: litre taslağı ve fiş anahtarı PASS');

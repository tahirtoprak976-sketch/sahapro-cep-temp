import assert from 'node:assert/strict';
import {customerCreateRequest as parse,customerNameAnswer,customerCreateMatches} from '../js/assistant-customer.js';
const names=['gürçelik sürücü kursu','Kemer country no 53'];
for(const name of names){
  for(const cmd of [`${name} adında müşteri oluştur`,`${name} için yeni müşteri aç`,`${name} isimli müşteri ekle`,`${name} müşteri olarak oluştur`,`Müşteri oluştur: ${name}`,`Yeni müşteri: ${name}`,`${name} bunu yeni oluştur`,`${name} müşterisini oluştur`])
    assert.deepEqual(parse(cmd),{kind:'draft',name},cmd);
  for(const cmd of ['bunu yeni oluştur','Bunu yeni müşteri olarak oluştur','onu müşteri olarak ekle'])assert.deepEqual(parse(cmd,{user:name,status:'answer'}),{kind:'draft',name});
  assert.deepEqual(parse(name,{user:'Yeni müşteri oluştur',status:'clarify',intent:'customer.create'}),{kind:'draft',name});
  assert.equal(parse(name),null,'a bare name without a question is not a write command');
}
for(const cmd of ['Yeni müşteri oluştur','Lütfen yeni müşteri oluşturur musun?','Müşteri aç','Bir müşteri ekleyebilir misin?','bunu yeni oluştur'])assert.deepEqual(parse(cmd),{kind:'ask',name:''},cmd);
assert.deepEqual(parse('“Gürçelik Sürücü Kursu” adında müşteri aç'),{kind:'draft',name:'Gürçelik Sürücü Kursu'});
assert.deepEqual(parse("Kemer Country No 53'ü yeni müşteri olarak aç"),{kind:'draft',name:'Kemer Country No 53'});
for(const value of ['','a','bunu','onayla','vazgeç','müşteri adı','Ali 20 litre mazot verildi','Kaya 3 sefer yaptı','20 TL','<script>','SP1:ABC','https://example.com','Ali\nVeli','Ali borç','Ali telefon 05321112233']){
  assert.equal(customerNameAnswer(value),null,value);
  assert.deepEqual(parse('bunu yeni oluştur',{user:value,status:'answer'}),{kind:'ask',name:''},value);
  assert.equal(parse(value,{status:'clarify',intent:'customer.create'}),null,value);
}
for(const cmd of ['Ali müşteri oluşturma','Ali müşteri ekleme','Yeni müşteri açma','Kemer country no 53 işlerini göster','Kemer country no 53 2 sefer yaptı','Gürçelik telefon 05321112233 adında müşteri aç','Ali ve Veli müşteri oluştur'])assert.equal(parse(cmd),null,cmd);
assert.equal(parse(names[0],{status:'saved',intent:'customer.create'}),null);
const rows=[{id:'1',name:'Kemer Country No 53'},{id:'2',name:'Kemer Country No 54'},{id:'3',name:'Kemer Country No 53',parent_customer_id:'P'},{id:'4',name:'Kemer Country No 53',deleted_at:'x'},{id:'P',name:'Ana Firma'}];
assert.deepEqual(customerCreateMatches('kemer country no 53',null,rows).exact.map(c=>c.id),['1']);
assert.deepEqual(customerCreateMatches('kemer country no 53','P',rows).exact.map(c=>c.id),['3']);
assert.deepEqual(customerCreateMatches('Kemer Country No 53',null,rows).similar.map(c=>c.id),['2','3']);
assert.equal(customerCreateMatches('Gürçelik Sürücü Kursu',null,rows).similar.length,0);
console.log('customer creation: Turkish/numbered names, explicit intent, question continuation, original spelling, rejected commands and parent-scoped identity PASS');

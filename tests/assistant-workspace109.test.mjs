import assert from 'node:assert/strict';
import {customerCreateRequest} from '../js/assistant-customer.js';
import {directoryCreateRequest} from '../js/assistant-directory.js';
import {siteCreateRequest} from '../js/assistant-site.js';
import {assistantPageHTML} from '../js/assistant-page-ui.js';
for(const s of ['Yeni müşteri','Müşteri oluşturmak istiyorum','Yeni müşteri eklemek istiyorum','Yeni müşteri açmak istiyorum'])assert.deepEqual(customerCreateRequest(s),{kind:'ask',name:''},s);
for(const s of ['Yeni şantiye','Şantiye oluştur','Yeni şantiye eklemek istiyorum','santiye ac'])assert.deepEqual(siteCreateRequest(s),{name:''},s);
assert.deepEqual(siteCreateRequest('Yeni şantiye: TEST Doğu 17'),{name:'TEST Doğu 17'});
assert.deepEqual(siteCreateRequest('TEST Güney 18 adında şantiye oluştur'),{name:'TEST Güney 18'});
for(const s of ['Şantiye oluşturma','Müşteriden 200 TL aldım','Şantiye 3 saat çalıştı','Şantiye sil','Mevcut şantiyeyi değiştir'])assert.equal(siteCreateRequest(s),null,s);
const html=assistantPageHTML({ready:false},{},'');assert.match(html,/data-start-customer/);assert.match(html,/data-start-site/);assert.match(html,/anahtarsız/);
console.log('assistant workspace109: direct customer/site intents, refusal of transactions, visible local entry points PASS');

for(const [s,store]of [['Yeni araç','vehicles'],['Makine oluştur','vehicles'],['Yeni personel eklemek istiyorum','personnel']])assert.deepEqual(directoryCreateRequest(s),{store,name:''});
assert.deepEqual(directoryCreateRequest('Kule TEST adında araç oluştur'),{store:'vehicles',name:'Kule TEST'});
for(const s of ['Personel ödeme','Yeni personel oluşturma','Ali 200 TL avans aldı','Araç 3 saat çalıştı'])assert.equal(directoryCreateRequest(s),null,s);
assert.match(html,/data-start-vehicle/);assert.match(html,/data-start-personnel/);

import assert from 'node:assert/strict';
import {customerFuelDraft as draft, customerFuelRows as rows, customerFuelFields as fields, validateCustomerFuelLinks as links} from '../js/customer-fuel.js';
import {validatePlan} from '../js/assistant-core.js';
import {customerStatement} from '../js/statement.js';
import {customerFuelLedger} from '../js/assistant-rules.js';
const today='2026-10-21', d={customers:[{id:'C',name:'Kaya İnşaat'},{id:'D',name:'Demir'}],aliases:[],fuel_tank_movements:[{id:'in',move_type:'GİRİŞ',liters:100,date:today,total:3000}]};
const text="Kaya İnşaat'ın forkliftine 20 lt mazot verildi";
const row=(t, data=d)=>rows({}, {message:t,d:data,today})[0];
assert.equal(draft(text,d,today).customer_id,'C');
assert.equal(row(text).liters,20);assert.equal(row(text).unit_price,null);assert.equal(row(text).ok,false);
const typo=row("Kaya İnşaat'ın forkliftine 20 ltnmazot verilmişti");
assert.equal(typo.liters,20);assert.equal(typo.date,'','past delivery without date must be confirmed');
const priced=row(text+', litresi 45 TL');assert.equal(priced.total,900);assert.equal(priced.ok,true);
assert.equal(row('Bizim depodan '+text+' litresi 45 TL').ok,true);
assert.equal(row(text+' toplam 900 TL').unit_price,45);
assert.equal(row(text+' litresi 45,50 TL').total,910);
assert.equal(row(text+' litresi 45.50 TL').date,today,'decimal price is not a calendar date');
assert.equal(row(text.replace('20 lt','20.5 litre')+' litresi 45 TL').total,922.5);
assert.equal(row(text+' litresi 45 TL toplam 1000 TL').ok,false,'inconsistent explicit amounts need review');
assert.equal(row('Dün '+text+' litresi 45 TL').date,'2026-10-20');
assert.equal(row('07.09.2026 '+text+' litresi 45 TL').date,'2026-09-07');
assert.equal(row('31.02.2026 '+text+' litresi 45 TL').date,'');
assert.equal(row('22.10.2026 '+text+' litresi 45 TL').date,'');
assert.equal(row(text+' istasyondan litresi 45 TL').blocked,true);
assert.equal(row(text,{...d,customers:[...d.customers,{id:'C2',name:'Kaya Hafriyat'}]}).customer_id,'C','full name beats contained short prefix');
assert.equal(row('Kaya forkliftine 20 lt mazot verildi',{...d,customers:[...d.customers,{id:'C2',name:'Kaya Hafriyat'}]}).customer_id,null);
assert.equal(row('Bilinmeyen forkliftine 20 lt mazot verildi').customer_id,null);
for(const t of [
 'Kaya bizim forkliftimize 20 lt mazot verdi','Kaya forkliftine 20 lt mazot verilmedi',text+' mi?',text+' örnek',text+' nakit alındı',text+' ücretsiz',text+' değil',
 text.replace('20 lt','-20 lt'),text.replace('20 lt','10-20 lt'),text.replace('20 lt','1/20 lt'),text.replace('20 lt','+20 lt'),
 text+'; Demir forkliftine 30 lt mazot verildi',text+'\nDemir forkliftine 30 lt mazot verildi',text+' 2 sefer çalıştı',
 'Kaya bize 20 lt mazot verdi','Kaya forkliftine 20 lt mazot verilecek',
]) assert.equal(draft(t,d,today),null,t);
// Unsupported/forged model rows cannot invent a price, direction, recipient or quantity.
let v=rows({customer_fuel:[{quote:text,customer_id:'D',liters:200,unit_price:99}]},{message:'Güvenilmeyen başka metin',d,today});assert.equal(v[0].blocked,true);assert.equal(v[0].liters,null);
v=rows({customer_fuel:[{quote:text,customer_id:'D',liters:200,unit_price:99}]},{message:'Bir mesaj:\n'+text,d,today});assert.equal(v[0].liters,20);assert.equal(v[0].customer_id,'C');assert.equal(v[0].unit_price,null);
const plan=validatePlan({fuel:[{customer_id:'C',vehicle_id:'OUR',liters:20,source:'Müşteri Verdi'}]}, {message:text+' litresi 45 TL',d,today});
assert.equal(plan.fuelOut.length,1);assert.equal(plan.fuel.length,0,'same outgoing delivery must not become incoming customer payment');
const short=validatePlan({}, {message:text+' litresi 45 TL',d:{...d,fuel_tank_movements:[]},today});assert.equal(short.fuelOut[0].ok,false);
const input={date:today,customer_id:'C',machine:'Forklift',liters:20,unit_price:45};assert.equal(fields(input,today).total,900);
for (const [k,val] of [['liters',-20],['liters',Infinity],['liters',true],['unit_price',0],['unit_price','wat'],['customer_id',''],['machine',''],['date','2026-02-31'],['date','2026-10-22']]) assert.throws(()=>fields({...input,[k]:val},today));
const m={id:'M',date:today,move_type:'ÇIKIŞ',delivery_kind:'customer_fuel',recipient_customer_id:'C',liters:20,charge_unit_price:45,charge_total:900,cari_movement_id:'A',event_id:'E'};
const c={id:'A',date:today,type:'MazotTeslimi',customer_id:'C',ref_id:'M',amount:900,event_id:'E',note:'Forklift · 20 L mazot'};
assert.doesNotThrow(()=>links({fuel_tank_movements:[m],cari_movements:[c]}));
for(const change of [{cari_movement_id:'other'},{charge_total:899},{recipient_customer_id:'D'},{liters:21},{move_type:'GİRİŞ'},{deleted_at:'now'}])assert.throws(()=>links({fuel_tank_movements:[{...m,...change}],cari_movements:[c]}));
assert.throws(()=>links({fuel_tank_movements:[],cari_movements:[c]}));
const st=customerStatement([c],'C');assert.equal(st.closing,900);assert.equal(st.rows[0].type,'Mazot teslimi');
assert.equal(customerFuelLedger({...d,fuel_tank_movements:[...d.fuel_tank_movements,m]},'C').received,0,'outgoing delivery does not settle customer fuel allowance');
console.log('customer fuel: source/amount/direction/date ambiguity, model evidence, typed fields and ledger links PASS');

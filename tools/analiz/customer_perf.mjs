// Reproducible local benchmark against the published v3.9.44 directory.
// Requires this git checkout. Synthetic data only; no DB/network access or time threshold.
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {customerDirectory} from '../../js/customer-directory.js';
const root=new URL('../../',import.meta.url);
const source=execFileSync('git',['show','2782ee2ebe55f7b87c2b0aeaa2124b4360f40805:js/customer-directory.js'],{cwd:root,encoding:'utf8'})
  .replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_,quote,path)=>'from '+JSON.stringify(new URL(path,new URL('../../js/',import.meta.url)).href));
const previous=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).customerDirectory;
const d={customers:[],work_records:[],cari_movements:[],hakedis:[],fuel_records:[],fuel_tank_movements:[],sites:[]};
for(let i=0;i<300;i++)d.customers.push({id:'c'+i,name:'TEST '+i,fuel_rules:i%7===0?[{per:75,unit:'Sefer'}]:[]});
for(let i=0;i<10000;i++)d.work_records.push({id:'w'+i,customer_id:'c'+i%300,date:'2026-10-20',quantity:1+i%5,unit:'Sefer',work_type:'TEST',...(i%4?{price_snapshot:{amount:i*0.13}}:{customer_fuel_allowance_l:75}),...(i%127===0?{deleted_at:'x'}:{})});
for(let i=0;i<5000;i++){
 d.cari_movements.push({id:'m'+i,customer_id:'c'+i%300,amount:-i*0.07});
 d.fuel_records.push({id:'f'+i,customer_id:'c'+(i*7)%300,fuel_source:i%3?'Müşteri Verdi':'Depo Tankı',liters:i%13+0.1});
}
for(let i=0;i<1000;i++)d.fuel_tank_movements.push({id:'t'+i,customer_id:'c'+i%300,move_type:i%3?'GİRİŞ':'ÇIKIŞ',liters:i%17+0.3});
for(let i=0;i<200;i++)d.hakedis.push({status:i%4?'Kesinleşti':'Taslak',items:[{work_record_id:'w'+i},{work_record_id:'w'+(i+1)}]});
const expected=previous(d);assert.deepEqual(customerDirectory(d),expected);
const timings={before:[],after:[]};
for(let round=0;round<3;round++)for(const [key,fn] of [['before',previous],['after',customerDirectory]]){
 const start=performance.now();fn(d);timings[key].push(performance.now()-start);
}
const median=values=>[...values].sort((a,b)=>a-b)[1];
console.log(JSON.stringify({fixture:{customers:d.customers.length,works:d.work_records.length,movements:d.cari_movements.length,fuel:d.fuel_records.length,tank:d.fuel_tank_movements.length,invoices:d.hakedis.length},exact_result_parity:true,median_ms:{before:Math.round(median(timings.before)*100)/100,after:Math.round(median(timings.after)*100)/100},note:'Local Node benchmark; not a phone rendering or WhatsApp speed measurement.'},null,2));

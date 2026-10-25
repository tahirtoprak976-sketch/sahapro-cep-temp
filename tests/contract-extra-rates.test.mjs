import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as J from '../js/job-core.js';
import { validateContract } from '../js/contract-read.js';

// Execute the actual form and Save handler, not a duplicated collector. Optional
// source path lets CI prove the same regression fails against unchanged v3.9.71.
const source = readFileSync(process.argv[2] || new URL('../js/job-ui.js', import.meta.url), 'utf8');
const start = source.indexOf('const RATE_ROWS =');
const end = source.indexOf('// Sözleşme / teklif belgesinden iş kurma:', start);
assert.ok(start >= 0 && end > start);
const formSource = source.slice(start, end);
const plain = value => JSON.parse(JSON.stringify(value));
const rates = n => Array.from({length:n}, (_,i)=>({label:'TEST Ekstra '+(i+1),unit:J.EXTRA_UNITS[i%J.EXTRA_UNITS.length],price:(i+1)*125.5}));
const base = {basis:'Götürü',price:120000,kdv_rate:20,kdv_included:false,start_date:'2026-10-25',status:'Açık',payment_plan:'TEST plan, tahsilat yapılmadı'};

async function harness({extra_rates=[], existing=false, locked=false}={}) {
  const controls=new Map(), clicks={}, messages=[], writes=[], charges=[];
  const site={id:'TEST-SITE',customer_id:'TEST-CUSTOMER',name:'TEST Site'};
  const deal={...base,extra_rates:structuredClone(extra_rates),doc_id:'TEST-PDF',read_quotes:[{field:'price',text:'TEST 120000'}],
    ...(locked?{charge:{gross:144000,cari_id:'TEST-EXISTING-CHARGE'}}:{})};
  if(existing)site.deal=structuredClone(deal);
  const field=(_label,name,value)=>{
    controls.set(name,{value:String(value??''),disabled:false,addEventListener(){},closest(){return{querySelector(){return{textContent:''}}}}});return '';
  };
  const root={innerHTML:''}, matrow={hidden:false};
  const context={
    J,qs:selector=>selector==='[data-form]'?{}:selector==='[data-matrow]'?matrow:selector==='[data-save]'?{addEventListener:(kind,fn)=>clicks[kind]=fn}:controls.get(/^\[name=(.+)\]$/.exec(selector)?.[1]),
    kdvRateOf:x=>x,todayStr:()=>base.start_date,MATERIALS:[],appbar:()=>'',esc:String,notice:()=>'',
    fText:field,fNum:field,fDate:field,fArea:field,fSelect:(label,name,_options,value)=>field(label,name,value),
    collectForm:()=>Object.fromEntries([...controls].filter(([,c])=>!c.disabled).map(([k,c])=>[k,c.value])),
    sessionStorage:{getItem:()=>existing?null:JSON.stringify({site_id:site.id,deal}),removeItem(){}},
    toast:(text,kind)=>messages.push({text,kind}),location:{hash:'#/is-sozlesmesi/'+site.id},go(){},
    chargeLump:async(...args)=>{charges.push(args);return false;},
  };
  const db={metaGet:async()=>20,get:async()=>site,saveExisting:async(store,old,fields)=>{
    assert.equal(store,'sites');assert.equal(old.id,site.id);writes.push(plain(fields));site.deal=plain(fields.deal);return site;
  }};
  const render=vm.runInNewContext(formSource+';dealForm',context);
  await render({root,db,reload(){}},site,existing?site.deal:null,'TEST Customer');
  return {controls,messages,writes,charges,site,click:()=>clicks.click(),rowCount:()=>[...controls.keys()].filter(k=>k.startsWith('r_label_')).length};
}

const sampleCounts=process.argv[3]?[Number(process.argv[3])]:[6,12];
assert.ok(sampleCounts.every(n=>[6,12].includes(n)));
for(const n of sampleCounts){
  const wanted=rates(n), h=await harness({extra_rates:wanted});
  assert.equal(h.rowCount(),n);
  await h.click();
  assert.deepEqual(h.writes[0]?.deal.extra_rates,wanted,`${n} displayed imported rates must all survive actual Save`);
  assert.equal(h.writes[0].deal.doc_id,'TEST-PDF');
  assert.equal(h.writes[0].deal.payment_plan,base.payment_plan);
  assert.equal(h.charges.length,1,'Separate charge flow remains invoked, not replaced by an implicit ledger write');
  const edit=await harness({extra_rates:h.site.deal.extra_rates,existing:true});
  edit.controls.get('r_price_'+(n-1)).value='789,25';
  await edit.click();wanted[n-1].price=789.25;
  assert.deepEqual(edit.writes[0].deal.extra_rates,wanted,`${n} rates must persist after reopening/editing last row`);
  assert.equal(edit.charges.length,0,'Editing the agreement must not repeat the charge prompt');
}

const empty=await harness();assert.equal(empty.rowCount(),4,'Four blank entry rows remain the default');
await empty.click();assert.deepEqual(empty.writes[0].deal.extra_rates,[]);
const blanks=await harness({extra_rates:[...rates(6),{label:'',unit:'Saat',price:''},{label:'  ',unit:'Ton',price:''}]});
await blanks.click();assert.deepEqual(blanks.writes[0].deal.extra_rates,rates(6),'Only completely blank rows may be omitted');

for(const change of [
  {label:'',price:'10'}, {label:'TEST',price:''}, {label:'TEST',price:'0'},
  {label:'TEST',price:'-1'}, {label:'TEST',price:'not-a-number'},
  {label:'TEST',price:'Infinity'}, {label:'TEST',price:'100',unit:''},
]){
  const h=await harness({extra_rates:rates(12)});
  h.controls.get('r_label_11').value=change.label;
  h.controls.get('r_price_11').value=change.price;
  if('unit' in change)h.controls.get('r_unit_11').value=change.unit;
  await h.click();
  assert.equal(h.writes.length,0,`Invalid last row must block whole Save: ${JSON.stringify(change)}`);
  assert.equal(h.charges.length,0);
  assert.ok(h.messages.some(m=>m.kind==='err'&&/Ekstra fiyat/.test(m.text)),JSON.stringify(h.messages));
  // Validation failure must remain correctable, not leave Save stuck busy.
  h.controls.get('r_label_11').value='TEST corrected';h.controls.get('r_price_11').value='100';h.controls.get('r_unit_11').value='Saat';
  await h.click();assert.equal(h.writes.length,1);assert.equal(h.writes[0].deal.extra_rates.length,12);
}
const charged=await harness({extra_rates:rates(12),existing:true,locked:true});
charged.controls.get('r_price_11').value='999';await charged.click();
assert.equal(charged.writes[0].deal.extra_rates.length,12);
assert.equal(charged.writes[0].deal.extra_rates[11].price,999);
assert.deepEqual(charged.writes[0].deal.charge,{gross:144000,cari_id:'TEST-EXISTING-CHARGE'});
assert.equal(charged.charges.length,0);

// Zero is not a free-work policy: retain the existing reader and pricing rules.
const zero=validateContract({...base,extra_rates:[{label:'TEST zero',unit:'Saat',price:0}]});
assert.equal(zero.extra_rates[0].price,null);assert.ok(zero.issues.some(x=>x.includes('ekstra')));
assert.equal(J.extraRateFor({extra_rates:[{label:'TEST zero',unit:'Saat',price:0}]},{unit:'Saat'}),null);
console.log('contract-extra-rates PASS: actual form/Save handler, 6/12 import/edit rows, default4 blanks, invalid/zero guard and correction, source/charge preserved');

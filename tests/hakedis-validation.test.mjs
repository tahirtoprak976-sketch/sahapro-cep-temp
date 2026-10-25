import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {hakedisNumber, hakedisItemIssues, assertHakedisItems} from '../js/hakedis-validation.js';
import {calcHakedisTotals} from '../js/core.js';

const line = extra => ({work_record_id:'TEST',quantity:3,unit:'Saat',unit_price:500,kdv_rate:20,kdv_included:false,...extra});
const accepts = item => assert.doesNotThrow(() => assertHakedisItems([item]));
const rejects = item => assert.throws(() => assertHakedisItems([item]), {code:'HAKEDIS_INCOMPLETE'});
for (const value of [null,undefined,'',' ',true,false,[],[0],{},NaN,Infinity,-Infinity,'Infinity']) {
  assert.equal(hakedisNumber(value),null);
  rejects(line({unit_price:value}));
  rejects(line({quantity:value}));
  rejects(line({kdv_rate:value}));
}
for (const value of [0,'0','0.00',' 0 ',500,12.34,'12.34']) {
  assert.equal(hakedisNumber(value),Number(value));
  accepts(line({unit_price:value}));
}
for (const value of [0,-1,'0','-1']) rejects(line({quantity:value}));
for (const value of [-1,'-1']) rejects(line({unit_price:value}));
for (const value of [-1,101]) rejects(line({kdv_rate:value}));
for (const value of [0,1,10,20,100,'0','20']) accepts(line({kdv_rate:value}));
for (const value of [0.5,1,3.25,'2.5']) accepts(line({quantity:value}));
for (const value of ['false','true',0,1,[]]) rejects(line({kdv_included:value}));
accepts(line({kdv_included:true}));
accepts(line({kdv_included:undefined})); // Existing absent flag = VAT excluded.
assert.throws(() => assertHakedisItems([]), {code:'HAKEDIS_INCOMPLETE'});
assert.throws(() => assertHakedisItems(null), {code:'HAKEDIS_INCOMPLETE'});
for (const item of [null,undefined,[],false]) rejects(item);

const crane = extra => line({formula:'CRANE_FIRST_HOUR',unit_price:null,first_hour_price:3000,next_hour_price:1000,...extra});
accepts(crane({}));
assert.equal(calcHakedisTotals([crane({})]).grand,6000);
for (const quantity of [0.5,1]) {
  accepts(crane({quantity,next_hour_price:null}));
  accepts(crane({quantity,first_hour_price:0,next_hour_price:null}));
}
for (const value of [null,'',true,NaN,-1]) {
  rejects(crane({first_hour_price:value}));
  rejects(crane({next_hour_price:value}));
}
accepts(crane({first_hour_price:0,next_hour_price:0}));
assert.equal(calcHakedisTotals([crane({first_hour_price:0,next_hour_price:0})]).grand,0);

// Zero is not missing: no provenance guesses or reinterpretation of legacy values.
for (const price_source of ['Manuel','Snapshot','Mazot karşılığı','Sözleşmeye dahil','İç iş (kendi depo)']) {
  accepts(line({unit_price:0,price_source}));
  rejects(line({unit_price:null,price_source})); // A label alone never invents numeric zero.
}
accepts(line({unit_price:500,customer_fuel_allowance_l:75})); // TL + fuel remains priced.
rejects(line({unit_price:null,customer_fuel_allowance_l:75}));
const mixed = [line({unit_price:0}),line({unit_price:123.45,quantity:2,kdv_rate:10}),crane({})];
const unchanged = structuredClone(mixed), totalsBefore = calcHakedisTotals(mixed);
assertHakedisItems(mixed);
assert.deepEqual(mixed,unchanged);
assert.deepEqual(calcHakedisTotals(mixed),totalsBefore);
assert.equal(totalsBefore.grand,6271.59);
assert.throws(() => assertHakedisItems([...mixed,line({unit_price:null})]), e => e.code==='HAKEDIS_INCOMPLETE'&&e.index===3);
assert.ok(hakedisItemIssues(line({unit_price:null}))[0].includes('0 geçerlidir'));

// Regression: the unchanged historical calculator collapses missing to 0;
// our preflight must reject before that calculation or any financial write.
assert.equal(calcHakedisTotals([line({unit_price:null})]).grand,0);
rejects(line({unit_price:null}));
assert.equal(calcHakedisTotals([line({unit_price:0})]).grand,0);
accepts(line({unit_price:0}));
console.log('hakedis-validation PASS: blank/null/types, explicit zero, positive quantity, VAT, crane tariffs, legacy non-TL zeros, mixed selection and unchanged arithmetic');

// Execute the actual detail handler with mocked UI/DB to prove navigation/cancel
// control flow. This is not a substitute for the real IndexedDB CI probe.
const source = readFileSync(new URL('../js/m-finance.js',import.meta.url),'utf8');
const detail = source.slice(source.indexOf('async function hakedisDetail('),source.indexOf('// ============ CARİ ============'));
const deferred = () => {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
async function detailFixture(read) {
  const confirm=deferred(),root={isConnected:true,innerHTML:''},box={hidden:true,textContent:''};
  const counts={confirm:0,finalize:0,reload:0};let handler;
  const button={disabled:false,get isConnected(){return root.isConnected;},addEventListener(_event,fn){handler=fn;}};
  const h={id:'H',status:'Taslak',customer_id:'C',hakedis_no:1,items:[line({work_record_id:'W'})]};
  const db={get:async()=>h,getAll:()=>read?read(h):Promise.resolve([h]),finalizeHakedis:async()=>{counts.finalize++;}};
  const noop=()=>'';
  const fn=runInNewContext(detail+'; hakedisDetail;',{
    appbar:noop,statusBadge:noop,trDate:noop,kv:noop,li:noop,esc:noop,fmtNum:noop,fmtTL:noop,customerWorkLines:()=>[],toast:noop,
    isActive:()=>true,confirmDialog:()=>{counts.confirm++;return confirm.promise;},
    qs:selector=>selector==='[data-final]'?button:selector==='[data-pdf]'?{addEventListener(){}}:selector==='[data-hakedis-final-error]'?box:null,
  });
  await fn({root,db,names:{customers:{C:'TEST'},sites:{}},reload:()=>{counts.reload++;}},'H');
  return {root,box,button,counts,confirm,run:()=>handler()};
}
{
  const f=await detailFixture(),pending=f.run();f.root.isConnected=false;f.confirm.resolve(true);await pending;
  assert.equal(f.counts.finalize,0);assert.equal(f.counts.reload,0);
}
{
  const started=deferred(),read=deferred(),f=await detailFixture(h=>{started.resolve(h);return read.promise;});
  const pending=f.run();f.confirm.resolve(true);const h=await started.promise;f.root.isConnected=false;read.resolve([h]);await pending;
  assert.equal(f.counts.finalize,0);assert.equal(f.counts.reload,0);
}
{
  const f=await detailFixture(),first=f.run();await f.run();assert.equal(f.counts.confirm,1);assert.equal(f.button.disabled,true);
  f.confirm.resolve(true);await first;assert.equal(f.counts.finalize,1);assert.equal(f.counts.reload,1);assert.equal(f.button.disabled,false);
}
{
  const f=await detailFixture(async()=>{throw Error('read failed');}),pending=f.run();f.confirm.resolve(true);await pending;
  assert.equal(f.counts.finalize,0);assert.equal(f.box.hidden,false);assert.match(f.box.textContent,/read failed/);assert.equal(f.button.disabled,false);
}
{
  const f=await detailFixture(),pending=f.run();f.confirm.resolve(false);await pending;
  assert.equal(f.counts.finalize,0);assert.equal(f.counts.reload,0);assert.equal(f.button.disabled,false);
}
console.log('hakedis detail control-flow PASS: detached confirmation/read, single flight, read failure and cancel (actual handler, mocked UI/DB)');

// Actual new-screen source: global crane tariffs are captured per rendered form,
// resolved onto the selected item before validation, and frozen in its snapshot.
const newScreen = source.slice(source.indexOf('async function hakedisNew('),source.indexOf('async function hakedisDetail('));
async function newFixture({tariffs={crane_first_hour:500,crane_next_hour:100},snapshot={},sequence,save}={}) {
  const confirm=deferred(),root={innerHTML:'',isConnected:true},rows={innerHTML:''},total={innerHTML:''},error={hidden:true},rowError={hidden:true,textContent:''};
  const checkbox={checked:true,dataset:{chk:'W'}},buttons={},calls={saved:0,navigated:0,totals:null,fields:null};
  for(const key of ['[data-fetch]','[data-create]','[name=customer_id]','[name=site_id]','[name=date_from]','[name=date_to]'])
    buttons[key]={disabled:false,addEventListener(event,fn){this[event]=fn;}};
  const db={
    listActive:async store=>({customers:[{id:'C',name:'TEST'}],sites:[],vehicles:[{id:'V'}],price_book:[]}[store]),
    getAll:async store=>store==='work_records'?[{id:'W',date:'2026-10-25',customer_id:'C',vehicle_id:'V',work_type:'Vinç Çalışması',quantity:2,unit:'Saat',
      price_snapshot:{formula:'CRANE_FIRST_HOUR',first_hour_price:null,next_hour_price:null,kdv_rate:20,kdv_included:false,...snapshot}}]:[],
    metaGet:async key=>tariffs[key],nextSeq:sequence||(async()=>1),
    saveNew:async(_store,fields)=>{calls.saved++;calls.fields=fields;return save?save():{id:'H'};},
  };
  const noop=()=>'';
  const fn=runInNewContext(newScreen+'; hakedisNew;',{
    hakedisNumber,hakedisItemIssues,assertHakedisItems,calcHakedisTotals:(items,crane)=>{calls.totals=calcHakedisTotals(items,crane);return calls.totals;},
    todayStr:()=> '2026-10-25',isActive:()=>true,appbar:noop,fSelect:noop,fDate:noop,emptyState:noop,trDate:noop,esc:x=>x,fmtNum:x=>x,fmtTL:x=>x,kv:noop,notice:(_kind,msg)=>msg,toast:noop,
    go:()=>{calls.navigated++;},confirmDialog:()=>confirm.promise,
    collectForm:()=>({customer_id:'C',site_id:'',date_from:'2026-10-01',date_to:'2026-10-25'}),
    qs:selector=>selector==='[data-rows]'?rows:selector==='[data-total]'?total:selector==='[data-hakedis-error]'?error:selector.startsWith('[data-hakedis-row-error=')?rowError:selector.startsWith('[data-price=')?null:buttons[selector],
    qsa:selector=>selector==='[data-chk]'?[checkbox]:[],
  });
  await fn({root,db,names:{sites:{},vehicles:{},customers:{}}});
  return {root,calls,confirm,button:buttons['[data-create]'],rowError,
    select(){buttons['[data-fetch]'].click();rows.onchange();},create:()=>buttons['[data-create]'].click()};
}
{
  const tariffs={crane_first_hour:500,crane_next_hour:null},old=await newFixture({tariffs});old.select();
  assert.equal(old.button.disabled,true);assert.match(old.rowError.textContent,/sonraki saat/);
  tariffs.crane_next_hour=100;old.select();assert.equal(old.button.disabled,true,'same form retains captured settings');
  const fresh=await newFixture({tariffs});fresh.select();assert.equal(fresh.button.disabled,false);assert.equal(fresh.rowError.hidden,true);
  assert.equal(fresh.calls.totals.grand,720);assert.equal(fresh.calls.totals.lines[0].first_hour_price,500);assert.equal(fresh.calls.totals.lines[0].next_hour_price,100);
  const save=fresh.create();fresh.confirm.resolve(true);await save;
  assert.equal(fresh.calls.saved,1);assert.equal(fresh.calls.fields.items[0].first_hour_price,500);assert.equal(fresh.calls.fields.items[0].next_hour_price,100);assert.equal(fresh.calls.fields.grand_total,720);
}
for(const [snapshot,grand] of [[{first_hour_price:0,next_hour_price:0},0],[{first_hour_price:200,next_hour_price:50},300]]) {
  const f=await newFixture({snapshot});f.select();assert.equal(f.button.disabled,false);assert.equal(f.calls.totals.grand,grand,'explicit snapshot overrides globals, including zero');
}
{
  const started=deferred(),seq=deferred(),f=await newFixture({sequence:()=>{started.resolve();return seq.promise;}});f.select();
  const pending=f.create();f.confirm.resolve(true);await started.promise;f.root.isConnected=false;seq.resolve(1);await pending;
  assert.equal(f.calls.saved,0,'navigation during sequence read must prevent financial write');assert.equal(f.calls.navigated,0);
}
{
  const started=deferred(),saved=deferred(),f=await newFixture({save:()=>{started.resolve();return saved.promise;}});f.select();
  const pending=f.create();f.confirm.resolve(true);await started.promise;f.root.isConnected=false;saved.resolve({id:'H'});await pending;
  assert.equal(f.calls.saved,1);assert.equal(f.calls.navigated,0,'completed save must not navigate a departed view');
}
console.log('hakedis new-screen source PASS: effective crane fallback, captured/fresh settings, explicit-zero override, frozen snapshot and stale sequence/save guards (mocked UI/DB)');

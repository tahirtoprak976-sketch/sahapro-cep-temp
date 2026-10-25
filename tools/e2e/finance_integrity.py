"""Independent finance regressions: real Chromium/IndexedDB, synthetic TEST data only.

Run ONLY in the approved normal browser runtime (GitHub Actions):
  python3 tools/e2e/finance_integrity.py http://localhost:8841/
  python3 tools/e2e/finance_integrity.py http://localhost:8842/ --baseline-proof

The latter mode proves selected defects on an unchanged baseline, not a release
pass. No credentials, AI/provider requests, production URL, historical rewrite,
or existing test assertion changes. Local compilation is NOT browser execution.
"""
import argparse
import json
import os
import re
import uuid
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("url", nargs="?", default="http://localhost:8841/")
parser.add_argument("--baseline-proof", action="store_true")
parser.add_argument("--artifacts", default="/tmp/solo-finance-integrity")
args = parser.parse_args()
URL = args.url.rstrip("/") + "/"
origin = urlparse(URL)
assert origin.scheme == "http" and origin.hostname in ("localhost", "127.0.0.1", "::1"), "Local synthetic server only"
assert not origin.username and not origin.password and not origin.query and not origin.fragment
ARTIFACT = Path(args.artifacts)
ARTIFACT.mkdir(parents=True, exist_ok=True)

BOOTSTRAP = r"""async () => {
  const db=await import('./js/db.js'), C=await import('./js/core.js'), I=await import('./js/invoice-core.js'), K=await import('./js/collect-core.js');
  const date=C.todayStr(), customer=await db.saveNew('customers',{name:'TEST Finance Customer'},'TEST'),
    other=await db.saveNew('customers',{name:'TEST Finance Other'},'TEST'),
    vehicle=await db.saveNew('vehicles',{name:'TEST Finance Vehicle'},'TEST');
  const site=await db.saveNew('sites',{name:'TEST Finance Site',customer_id:customer.id},'TEST');
  const check=(ok,why)=>{if(!ok)throw Error(why);};
  const same=(a,b,why)=>check(JSON.stringify(a)===JSON.stringify(b),why+'; actual='+JSON.stringify(a)+' expected='+JSON.stringify(b));
  const snapshot=async()=>{const d=await db.readSnapshot({attachments:true,meta:false,drafts:true});delete d.captured_at;return JSON.stringify(d);};
  const work=extra=>db.saveNew('work_records',{date,customer_id:customer.id,site_id:site.id,vehicle_id:vehicle.id,work_type:'TEST Makine Çalışması',quantity:1,unit:'Saat',
    price_snapshot:{unit_price:1200,amount:1200,kdv_rate:20,kdv_included:true},...extra},'TEST');
  const line=(w,extra={})=>({work_record_id:w.id,date:w.date,customer_id:w.customer_id,site_id:w.site_id,vehicle_id:w.vehicle_id,
    work_type:w.work_type,quantity:w.quantity,unit:w.unit,...w.price_snapshot,...extra});
  const fields=(rows,extra={})=>{const t=C.calcHakedisTotals(rows);return {hakedis_no:123,customer_id:customer.id,site_id:site.id,date_from:date,date_to:date,
    created_date:date,status:'Taslak',items:t.lines,subtotal:t.subtotal,kdv_total:t.kdv,grand_total:t.grand,...extra};};
  const claim=async(extra={},item={})=>{const w=await work(extra),h=await db.createHakedis(fields([line(w,item)]));return {w,h};};
  const rejected=async(fn,why)=>{const before=await snapshot();let error;try{await fn();}catch(e){error={code:e.code||null,message:e.message};}
    check(error,why+' must reject');same(await snapshot(),before,why+' must not change records/audit/drafts');return error;};
  window.FT={db,C,I,K,date,customer,other,vehicle,site,check,same,snapshot,work,line,fields,claim,rejected};
  return {customer:customer.id,other:other.id,site:site.id,vehicle:vehicle.id,date};
}"""

VAT_MATRIX = r"""async () => {
  const {db,C,I,K,check,same,work,line,fields,rejected,customer}=FT;
  const cases=[
    {name:'included-1200',qty:1,item:{unit_price:1200,kdv_rate:20,kdv_included:true},basis:1200,money:[1000,200,1200]},
    {name:'excluded-1000',qty:1,item:{unit_price:1000,kdv_rate:20,kdv_included:false},basis:1000,money:[1000,200,1200]},
    {name:'explicit-zero',qty:2,item:{unit_price:0,kdv_rate:20,kdv_included:true},basis:0,money:[0,0,0]},
    {name:'VAT-zero',qty:2,item:{unit_price:500,kdv_rate:0,kdv_included:true},basis:1000,money:[1000,0,1000]},
    {name:'crane',qty:2,item:{formula:'CRANE_FIRST_HOUR',unit_price:null,first_hour_price:600,next_hour_price:120,kdv_rate:20,kdv_included:true},basis:720,money:[600,120,720]},
    {name:'crane-zero',qty:0.5,item:{formula:'CRANE_FIRST_HOUR',unit_price:null,first_hour_price:0,next_hour_price:null,kdv_rate:20,kdv_included:true},basis:0,money:[0,0,0]},
    {name:'included-cent',qty:1,item:{unit_price:0.03,kdv_rate:20,kdv_included:true},basis:0.03,money:[0.03,0.01,0.04]},
    {name:'excluded-cent',qty:1,item:{unit_price:0.03,kdv_rate:20,kdv_included:false},basis:0.03,money:[0.03,0.01,0.04]},
    {name:'contract-included-zero',qty:1,item:{unit_price:0,kdv_rate:0,kdv_included:false,price_source:'Sözleşmeye dahil'},basis:0,money:[0,0,0]},
  ];
  const results=[];
  for(const test of cases){
    const w=await work({quantity:test.qty,price_snapshot:{...test.item,amount:test.basis}}),f=fields([line(w,test.item)]),h=await db.createHakedis(f);
    same(w.price_snapshot.amount,test.basis,test.name+' original source input basis');
    same((await db.get('work_records',w.id)).price_snapshot,w.price_snapshot,'draft does not change/lock source price');
    const done=await db.finalizeHakedis(h.id),after=await db.get('work_records',w.id),d=await db.dumpAll();
    same([done.subtotal,done.kdv_total,done.grand_total],test.money,test.name+' frozen claim');
    same(after.price_snapshot.amount,test.basis,test.name+' work input basis');check(after.price_snapshot.locked,test.name+' lock');
    const moves=d.cari_movements.filter(m=>C.isActive(m)&&m.ref_id===h.id);
    same(moves.map(m=>m.amount),[test.money[2]],test.name+' exactly one gross ledger entry');
    const invoice=I.invoiceDraft(d,customer.id,{workIds:[w.id]});
    same([invoice.net,invoice.kdv,invoice.total],test.money,test.name+' authoritative invoice');
    await rejected(()=>db.finalizeHakedis(h.id),test.name+' repeat finalization');
    for(const changes of [{quantity:test.qty+1},{price_snapshot:{...after.price_snapshot,amount:999}},{customer_id:FT.other.id}])
      await rejected(()=>db.saveExisting('work_records',after,changes,'TEST locked change'),test.name+' finalized monetary lock');
    results.push({name:test.name,basis:after.price_snapshot.amount,invoice:[invoice.net,invoice.kdv,invoice.total]});
  }
  // These two lines individually freeze 0.01 tax. Never recalculate 0.06*20%=0.01.
  for(const included of [true,false]){
    const rows=[];
    for(let i=0;i<2;i++)rows.push(await work({price_snapshot:{unit_price:0.03,amount:0.03,kdv_rate:20,kdv_included:included}}));
    const h=await db.createHakedis(fields(rows.map(w=>line(w))));await db.finalizeHakedis(h.id);
    const invoice=I.invoiceDraft(await db.dumpAll(),customer.id,{workIds:rows.map(w=>w.id)});
    same([invoice.net,invoice.kdv,invoice.total],[0.06,0.02,0.08],'two frozen cent lines '+included);
  }
  const unclaimed=await work({quantity:3,price_snapshot:{unit_price:0.01,amount:0.03,kdv_rate:20,kdv_included:true}});
  const old=I.invoiceDraft(await db.dumpAll(),customer.id,{workIds:[unclaimed.id]});
  same([old.net,old.kdv,old.total],[0.03,0.01,0.04],'unclaimed formula unchanged');
  const mix=[];for(let i=0;i<4;i++)mix.push(await work({price_snapshot:{unit_price:0.03,amount:0.03,kdv_rate:20,kdv_included:false}}));
  const mixedClaim=await db.createHakedis(fields(mix.slice(0,2).map(w=>line(w))));await db.finalizeHakedis(mixedClaim.id);
  const combined=I.invoiceDraft(await db.dumpAll(),customer.id,{workIds:mix.map(w=>w.id)});
  same([combined.net,combined.kdv,combined.total],[0.12,0.03,0.15],'mixed frozen + unclaimed grouping preserves each scope rounding');
  await db.saveExisting('customers',await db.get('customers',customer.id),{kdv_withholding:'5/10'},'TEST withholding');
  const withheld=I.invoiceDraft(await db.dumpAll(),customer.id,{workIds:mix.map(w=>w.id)});
  same([withheld.net,withheld.kdv,withheld.total,withheld.withheld,withheld.payable],[0.12,0.03,0.15,0.02,0.13],'withholding applied exactly once after frozen tax');
  return results;
}"""

FRACTIONAL_CLAIMS = r"""async () => {
  const {db,C,I,check,same,snapshot,work,line,fields,date}=FT;
  const M=await import('./js/invoice-import.js'),results=[];
  for(const count of [10,100])for(const price of [0.01,0.05]){
    const name='TEST Fractional '+count+' lines '+price;
    const customer=await db.saveNew('customers',{name,tax_title:name},'TEST'),rows=[];
    for(let i=0;i<count;i++)rows.push(await work({customer_id:customer.id,site_id:null,quantity:0.5,
      price_snapshot:{unit_price:price,amount:price*0.5,kdv_rate:20,kdv_included:false}}));
    const f=fields(rows.map(w=>line(w)),{customer_id:customer.id,site_id:null}),h=await db.createHakedis(f);
    const frozen=await db.finalizeHakedis(h.id),expected=price===0.01
      ? [C.fromKurus(count),0,C.fromKurus(count)]
      : [C.fromKurus(count*3),C.fromKurus(count),C.fromKurus(count*4)];
    same([frozen.subtotal,frozen.kdv_total,frozen.grand_total],expected,'canonical fractional headers '+name);
    check(frozen.items.every(item=>item.amount===price*0.5),'fractional raw net remains frozen, not silently rewritten');
    const before=await snapshot(),d=await db.dumpAll(),invoice=I.invoiceDraft(d,customer.id),queue=I.invoiceQueue(d).find(q=>q.customer.id===customer.id);
    same([invoice.net,invoice.kdv,invoice.total],expected,'fractional invoice equals frozen headers '+name);
    same([invoice.works.length,invoice.claimed,invoice.review.length],[count,count,0],'every fractional claim work resolved');
    same([queue.n,queue.net,queue.review.length],[count,expected[0],0],'fractional queue equals canonical net '+name);
    const imported=M.matchInvoice(d,{invoice_no:'TEST-FRACTION-'+count+'-'+price,buyer_name:name,date,net:expected[0],kdv:expected[1],total:expected[2],payable:expected[2]});
    same([imported.sum,imported.net,imported.diff,imported.works.length],[expected[0],expected[0],0,count],'fractional import matcher uses authoritative net '+name);
    check(imported.exact&&!imported.review.length,'fractional import exact and review-free');
    const copied=I.draftText(invoice);
    check(copied.includes('kayıtlı hakediş net/KDV tutarları esastır')&&copied.includes('birim fiyat yuvarlanabilir'),'copied invoice explains frozen source and displayed-price rounding');
    same(await snapshot(),before,'fractional invoice/queue/import/copy readers do not change raw work, claims, ledger or audit');
    results.push({count,quantity:0.5,price,rawLineNet:price*0.5,net:invoice.net,tax:invoice.kdv,total:invoice.total,queue:queue.net,import:imported.sum});
  }
  return results;
}"""

LEGACY_AND_FUEL = r"""async () => {
  const {db,C,I,check,same,snapshot,work,line,fields,customer}=FT;
  const w=await work(),f=fields([line(w)]),h=C.newRecord({...f,status:'Kesinleşti',finalized_at:C.nowISO()});
  await db.put('hakedis',h);await db.put('work_records',{...w,price_snapshot:{...h.items[0],locked:true}});
  await db.put('cari_movements',C.newRecord({date:FT.date,customer_id:customer.id,type:'Hakedis',amount:1200,ref_id:h.id,note:'TEST legacy claim'}));
  const before=await snapshot(),d=await db.dumpAll(),F=I.invoiceDraft(d,customer.id,{workIds:[w.id]});
  same([F.net,F.kdv,F.total],[1000,200,1200],'legacy net snapshot resolves authoritative charge');
  const H=await import('./js/hakedis-finance.js'),resolved=H.claimWorkResolution(d,d.work_records.find(x=>x.id===w.id));
  check(resolved.recovered&&!resolved.issue,'legacy must have exact linked recovery');same(resolved.work.price_snapshot.amount,1200,'effective legacy basis');
  same(await snapshot(),before,'legacy read must not rewrite raw records');
  const mixed=await work({customer_fuel_allowance_l:75}),fuel=await work({customer_fuel_allowance_l:75,price_snapshot:{unit_price:0,amount:0,kdv_rate:0,kdv_included:false,price_source:'Mazot karşılığı'}});
  const ids=I.uninvoicedWorks(await db.dumpAll()).map(x=>x.id);check(ids.includes(mixed.id),'positive TL + fuel remains invoiceable');check(!ids.includes(fuel.id),'fuel-only is not TL invoiceable');
  const mixedDraft=I.invoiceDraft(await db.dumpAll(),customer.id,{workIds:[mixed.id,fuel.id]});
  same([mixedDraft.net,mixedDraft.kdv,mixedDraft.total],[1000,200,1200],'fuel litres never added as TL');
  // Imported opaque locked work cannot be guessed as net or gross or rewritten.
  const opaque=await work({price_snapshot:null});await db.put('work_records',{...opaque,price_snapshot:{unit_price:1200,amount:777,kdv_rate:20,kdv_included:true,locked:true}});
  const badData=await db.dumpAll(),badWork=badData.work_records.find(x=>x.id===opaque.id),badBefore=await snapshot();
  check(H.claimWorkResolution(badData,badWork).issue,'missing claim source needs visible review');
  const bad=I.invoiceDraft(badData,customer.id,{workIds:[opaque.id]});
  check(bad.review?.some(r=>r.id===opaque.id)&&bad.net===null&&bad.kdv===null&&bad.total===null,'opaque invoice has no computable totals');
  let copyBlocked=false;try{I.draftText(bad);}catch{copyBlocked=true;}check(copyBlocked,'opaque invoice copy blocked');same(await snapshot(),badBefore,'opaque read-only');
  return {legacy:w.id,opaque:opaque.id,mixed:mixed.id,fuel:fuel.id,customer:customer.id};
}"""

LIFECYCLE = r"""async () => {
  const {db,C,check,same,snapshot,work,line,fields,claim,rejected,date,other}=FT;
  const {w,h}=await claim();
  for(const patch of [{quantity:2},{unit:'Sefer'},{customer_id:other.id,site_id:null},{date:C.addDays(date,-1)},{price_snapshot:{unit_price:20,amount:20,kdv_rate:20,kdv_included:false}}])
    await rejected(()=>db.saveExisting('work_records',w,patch,'TEST draft-linked edit'),'draft-linked '+Object.keys(patch).join(','));
  const note=await db.saveExisting('work_records',w,{description:'TEST benign note retained'},'TEST note');
  same(note.quantity,w.quantity,'note keeps source quantity');same((await db.get('hakedis',h.id)).items,h.items,'note keeps claim');
  await db.finalizeHakedis(h.id);
  const finalized=await db.get('hakedis',h.id);
  check(finalized.updated_at>h.updated_at,'finalization advances concurrency stamp');
  await rejected(()=>db.saveExisting('hakedis',h,{status:'İptal'},'TEST stale cancel'),'already finalized stale cancel');
  // Malformed pending imports are intentional TEST fixtures, never history repairs.
  const mutations=[
    ['deleted-claim',async(w,h)=>db.put('hakedis',{...h,deleted_at:C.nowISO()})],
    ['deleted-source',async(w,h)=>db.put('work_records',{...w,deleted_at:C.nowISO()})],
    ['source-missing',async(w,h)=>db.put('hakedis',{...h,items:h.items.map(i=>({...i,work_record_id:'TEST MISSING SOURCE'}))})],
    ['quantity-stale',async(w,h)=>db.put('work_records',{...w,quantity:w.quantity+1})],
    ['price-proof-stale',async(w,h)=>db.put('work_records',{...w,price_snapshot:{...w.price_snapshot,unit_price:2400,amount:2400}})],
    ['unit-stale',async(w,h)=>db.put('work_records',{...w,unit:'Sefer'})],
    ['customer-stale',async(w,h)=>db.put('work_records',{...w,customer_id:other.id})],
    ['date-stale',async(w,h)=>db.put('work_records',{...w,date:C.addDays(date,-1)})],
    ['gross-incoherent',async(w,h)=>db.put('hakedis',{...h,grand_total:999999})],
    ['net-incoherent',async(w,h)=>db.put('hakedis',{...h,subtotal:999999})],
    ['tax-incoherent',async(w,h)=>db.put('hakedis',{...h,kdv_total:999999})],
    ['line-incoherent',async(w,h)=>db.put('hakedis',{...h,items:h.items.map(i=>({...i,amount:999999}))})],
    ['duplicate-source',async(w,h)=>db.put('hakedis',{...h,items:[...h.items,...h.items]})],
    ['overlapping-claim',async(w,h)=>db.put('hakedis',C.newRecord({...h,id:undefined,items:h.items}))],
  ];
  const outcomes=[];
  for(const [name,mutate] of mutations){const {w,h}=await claim();await mutate(w,h);outcomes.push({name,error:await rejected(()=>db.finalizeHakedis(h.id),'legacy '+name)});}
  for(const patch of [{quantity:2},{unit:'Sefer'},{date:C.addDays(date,-1)}]){
    const w=await work(),f=fields([line(w,patch)]);await rejected(()=>db.createHakedis(f),'stale create '+Object.keys(patch).join(','));
  }
  const stalePrice=await work(),staleFields=fields([line(stalePrice,{source_price_snapshot:structuredClone(stalePrice.price_snapshot)})]);
  await db.put('work_records',{...stalePrice,price_snapshot:{...stalePrice.price_snapshot,unit_price:2400,amount:2400}});
  await rejected(()=>db.createHakedis(staleFields),'source price changed after rendered preview');
  const manual=await claim({}, {unit_price:600}),manualDone=await db.finalizeHakedis(manual.h.id);
  same([manualDone.subtotal,manualDone.kdv_total,manualDone.grand_total],[500,100,600],'manual claim tariff is not source-tariff drift');
  same((await db.get('work_records',manual.w.id)).price_snapshot.amount,600,'manual agreed claim tariff freezes intentionally');
  const legacyWork=await work(),legacy=C.newRecord(fields([line(legacyWork)]));
  await db.put('hakedis',legacy);await db.put('work_records',{...legacyWork,price_snapshot:{...legacyWork.price_snapshot,unit_price:2400,amount:2400}});
  const legacyDone=await db.finalizeHakedis(legacy.id);
  same([legacyDone.subtotal,legacyDone.kdv_total,legacyDone.grand_total],[1000,200,1200],'legacy draft without proof retains explicitly stored tariff, never current recalculation');
  return {checked:outcomes.length,outcomes,staleCreatePriceBlocked:true,manualOverride:600,legacyFrozenTariff:1200};
}"""

CASH_AND_IDENTITY = r"""async () => {
  const {db,C,K,check,same,rejected,date,customer,other,site,work}=FT;
  const cash=await db.saveNew('cash_records',{date,customer_id:customer.id,cash_type:'Müşteriden Para Alındı',amount:100,payment_method:'Nakit',cash_status:'KASAYA_TESLIM_EDILDI'},'TEST');
  const linked=(await db.getAll('cari_movements')).filter(x=>C.isActive(x)&&x.ref_id===cash.id);
  same(linked.map(x=>x.amount),[-100],'fixture really has linked collection');
  const edits=[{amount:200},{date:C.addDays(date,-1)},{customer_id:other.id},{cash_type:'Diğer'},{payment_method:'Havale/EFT'}];
  for(const patch of edits)await rejected(()=>db.saveExisting('cash_records',cash,patch,'TEST unsafe cash edit'),'cash '+Object.keys(patch).join(','));
  const handed=await db.saveExisting('cash_records',cash,{description:'TEST benign cash note'},'TEST note');
  same(handed.amount,100,'cash note retains money');same((await db.getAll('cari_movements')).filter(x=>x.ref_id===cash.id),linked,'cash note retains ledger');
  const person=await db.saveNew('personnel',{name:'TEST Cash Handoff Person'},'TEST');
  const statusCash=await db.saveNew('cash_records',{date,customer_id:customer.id,personnel_id:person.id,cash_type:'Müşteriden Para Alındı',amount:12,payment_method:'Nakit',cash_status:'PERSONELDE'},'TEST');
  const statusLedger=(await db.getAll('cari_movements')).filter(x=>x.ref_id===statusCash.id);
  const status=await db.saveExisting('cash_records',statusCash,{cash_status:'KASAYA_TESLIM_EDILDI'},'TEST status handoff');
  same(status.cash_status,'KASAYA_TESLIM_EDILDI','ordinary cash handoff remains allowed');same((await db.getAll('cari_movements')).filter(x=>x.ref_id===statusCash.id),statusLedger,'handoff cannot duplicate credit');
  await work();await rejected(()=>db.softDelete('customers',customer.id,'TEST used delete'),'customer with history deletion');
  const before=K.customerBalances(await db.dumpAll()).bal[customer.id];
  const inactive=await db.saveExisting('customers',await db.get('customers',customer.id),{active:false},'TEST deactivate');
  check(inactive.active===false&&!inactive.deleted_at,'deactivate not delete');same(K.customerBalances(await db.dumpAll()).bal[customer.id],before,'inactive keeps balance');
  await rejected(()=>db.saveExisting('sites',site,{customer_id:other.id},'TEST site reassignment'),'used site owner');
  const renamed=await db.saveExisting('sites',site,{name:'TEST Site Renamed'},'TEST label change');same(renamed.customer_id,customer.id,'used site label can change, owner stays');
  const unused=await db.saveNew('sites',{name:'TEST Unused Site',customer_id:customer.id},'TEST');
  same((await db.saveExisting('sites',unused,{customer_id:other.id},'TEST unused reassign')).customer_id,other.id,'unused site reassign allowed');
  const unusedCustomer=await db.saveNew('customers',{name:'TEST Unused Delete'},'TEST');await db.softDelete('customers',unusedCustomer.id,'TEST unused');check((await db.get('customers',unusedCustomer.id)).deleted_at,'unused customer delete allowed');
  const isolatedHistory=[];
  for(const kind of ['work-only','deleted-work','cari-only','claim-only']){
    const card=await db.saveNew('customers',{name:'TEST Isolated History '+kind},'TEST');
    if(kind==='work-only'||kind==='deleted-work'){
      const w=await work({customer_id:card.id,site_id:null});if(kind==='deleted-work')await db.put('work_records',{...w,deleted_at:C.nowISO()});
    }else if(kind==='cari-only')await db.saveNew('cari_movements',{date,customer_id:card.id,type:'Duzeltme',amount:25,reason:'TEST isolated history'},'TEST');
    else await db.put('hakedis',C.newRecord({customer_id:card.id,status:'İptal',items:[],hakedis_no:888,created_date:date}));
    await rejected(()=>db.softDelete('customers',card.id,'TEST isolated history delete'),kind+' customer deletion');isolatedHistory.push(kind);
  }
  return {cashEdits:edits.length,balance:before,isolatedHistory};
}"""

ROLLBACK = r"""async () => {
  const {db,check,same,snapshot,work,line,fields}=FT;
  const a=await work(),b=await work(),h=await db.createHakedis(fields([line(a),line(b)])),before=await snapshot();
  const original=IDBObjectStore.prototype.put;let hit=false,error;
  IDBObjectStore.prototype.put=function(value,...rest){
    if(this.name==='work_records'&&value.id===b.id&&value.price_snapshot?.locked){hit=true;return this.add(value);}
    return original.call(this,value,...rest);
  };
  try{await db.finalizeHakedis(h.id);}catch(e){error=e.message;}finally{IDBObjectStore.prototype.put=original;}
  check(hit&&error,'real duplicate-key IDB request must fail during source locking');
  same(await snapshot(),before,'real ConstraintError rolls back claim, every work, ledger and audit');
  return {realRequestFailure:hit,error};
}"""

RACE_SETUP = r"""async () => {
  const {w,h}=await FT.claim();return {work:w.id,claim:h};
}"""

RACE_PAUSE = r"""draft => {
  const original=IDBObjectStore.prototype.get, descriptor=Object.getOwnPropertyDescriptor(IDBRequest.prototype,'onsuccess');
  window.__cancelPaused=false;window.__releaseCancel=null;
  IDBObjectStore.prototype.get=function(key){
    const request=original.call(this,key);
    if(this.name==='hakedis'&&key===draft.id&&this.transaction.mode==='readonly'){
      IDBObjectStore.prototype.get=original;
      Object.defineProperty(request,'onsuccess',{configurable:true,set(callback){
        descriptor.set.call(this,function(event){window.__cancelPaused=true;window.__releaseCancel=()=>callback.call(request,event);});
      },get(){return descriptor.get.call(this);}});
    }
    return request;
  };
  window.__cancelAttempt=FT.db.saveExisting('hakedis',draft,{status:'İptal'},'TEST controlled concurrent cancel')
    .then(()=>({accepted:true}),e=>({accepted:false,error:e.message,code:e.code||null}));
}"""

BASELINE = r"""async () => {
  const {db,C,I,K,work,line,fields,claim,customer,other,site,date}=FT,out={};
  const {w,h}=await claim();await db.finalizeHakedis(h.id);
  const F=I.invoiceDraft(await db.dumpAll(),customer.id,{workIds:[w.id]});out.vat={snapshot:(await db.get('work_records',w.id)).price_snapshot.amount,invoice:[F.net,F.kdv,F.total]};
  const mixed=await work({customer_fuel_allowance_l:75});out.mixedExcluded=!I.uninvoicedWorks(await db.dumpAll()).some(w=>w.id===mixed.id);
  const cash=await db.saveNew('cash_records',{date,customer_id:customer.id,cash_type:'Müşteriden Para Alındı',amount:100,payment_method:'Nakit'},'TEST');
  await db.saveExisting('cash_records',cash,{amount:200},'TEST baseline');out.cash=[(await db.get('cash_records',cash.id)).amount,(await db.getAll('cari_movements')).find(x=>x.ref_id===cash.id).amount];
  const stale=await claim();await db.saveExisting('work_records',stale.w,{quantity:2},'TEST baseline stale');await db.finalizeHakedis(stale.h.id);
  const sw=await db.get('work_records',stale.w.id);out.stale=[sw.quantity,sw.price_snapshot.quantity];
  const bad=await claim();await db.put('hakedis',{...bad.h,grand_total:999999});await db.finalizeHakedis(bad.h.id);out.incoherent=(await db.getAll('cari_movements')).find(x=>x.ref_id===bad.h.id).amount;
  const gone=await claim();await db.softDelete('hakedis',gone.h.id,'TEST baseline');await db.finalizeHakedis(gone.h.id);out.deletedFinalized=!!(await db.get('hakedis',gone.h.id)).deleted_at&&(await db.getAll('cari_movements')).some(x=>x.ref_id===gone.h.id);
  const orphan=C.newRecord(fields([line(await work(),{work_record_id:'TEST ABSENT'})]));await db.put('hakedis',orphan);await db.finalizeHakedis(orphan.id);out.orphanPosted=(await db.getAll('cari_movements')).some(x=>x.ref_id===orphan.id);
  await db.saveExisting('sites',site,{customer_id:other.id},'TEST baseline');out.ownerMoved=(await db.get('sites',site.id)).customer_id===other.id;
  await db.softDelete('customers',customer.id,'TEST baseline');out.customerHidden=K.customerBalances(await db.dumpAll()).bal[customer.id]===undefined;
  return out;
}"""


BULK_PRICING = r"""async () => {
  const {db,C,K,check,same,snapshot,rejected,work,customer,line,fields}=FT;
  const P=await import('./js/price-completion-db.js');let seq=0;
  const make=async(patch={})=>{
    const type='TEST Atomic Price '+(++seq),works=[];
    for(const quantity of [2,3])works.push(await work({quantity,work_type:type,price_snapshot:null}));
    const data=await db.dumpAll(),group=K.unpricedGroups(data,customer.id).find(g=>g.works.some(w=>w.id===works[0].id));
    return {works,command:{customer_id:customer.id,group_key:group.key,price:1200,kdv_rate:20,kdv_included:true,save_rule:true,
      expected_works:structuredClone(works),expected_rule:P.priceCompletionDefaults(data,customer.id,group).expected_rule,...patch}};
  };
  for(const patch of [{price:''},{price:null},{price:true},{price:-1},{kdv_rate:''},{kdv_rate:null},{kdv_rate:101},{kdv_included:null}]){
    const f=await make(patch);await rejected(()=>P.completeCustomerPrices(f.command),'invalid bulk '+JSON.stringify(patch));
  }
  for(const kind of ['stale-note','stale-quantity','deleted','locked','draft-claim','changed-rule','formula']){
    const f=await make(),w=f.works[1];
    if(kind==='draft-claim')await db.createHakedis(fields([line(w,{unit_price:100,kdv_rate:20,kdv_included:false})]));
    else if(kind==='changed-rule'||kind==='formula')await db.saveNew('price_book',{customer_id:customer.id,site_id:null,work_type:w.work_type,vehicle_id:null,unit:w.unit,
      price:100,kdv_rate:20,kdv_included:false,...(kind==='formula'?{formula:'CRANE_FIRST_HOUR',first_hour_price:600,next_hour_price:100}:{})},'TEST');
    else await db.put('work_records',{...w,...({'stale-note':{description:'TEST changed after preview'},'stale-quantity':{quantity:9},'deleted':{deleted_at:C.nowISO()},
      'locked':{price_snapshot:{locked:true,unit_price:100,amount:300,kdv_rate:20,kdv_included:false}}}[kind])});
    await rejected(()=>P.completeCustomerPrices(f.command),'bulk second source '+kind);
  }
  const valid=[];
  for(const patch of [{price:0,kdv_rate:0,kdv_included:false},{price:1200,kdv_rate:20,kdv_included:true},{price:100,kdv_rate:0,kdv_included:false,save_rule:false}]){
    const f=await make(patch),result=await P.completeCustomerPrices(f.command),rows=await Promise.all(f.works.map(w=>db.get('work_records',w.id)));
    same(result.count,2,'both bulk jobs saved');same(result.amount,5*patch.price,'bulk amount uses entered basis');
    for(const w of rows){same([w.price_snapshot.unit_price,w.price_snapshot.amount,w.price_snapshot.kdv_rate,w.price_snapshot.kdv_included],
      [patch.price,w.quantity*patch.price,patch.kdv_rate,patch.kdv_included],'same explicit money and VAT for every work');}
    if(f.command.save_rule){const rule=await db.get('price_book',result.rule_id);same([rule.price,rule.kdv_rate,rule.kdv_included],[patch.price,patch.kdv_rate,patch.kdv_included],'future rule matches frozen work');}
    else same(result.rule_id,null,'jobs-only writes no rule');
    await rejected(()=>P.completeCustomerPrices(f.command),'same bulk command cannot repeat');valid.push({count:result.count,amount:result.amount});
  }
  const historyCase=await make(),oldRule=await db.saveNew('price_book',{customer_id:customer.id,site_id:null,work_type:historyCase.works[0].work_type,vehicle_id:null,unit:'Saat',
    price:1200,kdv_rate:0,kdv_included:false,price_history:[{price:999,reason:'TEST preserved prior price history'}]},'TEST');
  historyCase.command.expected_rule=structuredClone(oldRule);
  await P.completeCustomerPrices(historyCase.command);
  const changedRule=await db.get('price_book',oldRule.id);
  same(changedRule.price_history[0],oldRule.price_history[0],'existing price history preserved');
  check(changedRule.price_history.length===2&&changedRule.price_history[1].price===1200&&changedRule.price_history[1].kdv_rate===0,'VAT-only change retains prior rule basis');
  const bounded=await make(),dated=await db.saveNew('price_book',{customer_id:customer.id,site_id:null,work_type:bounded.works[0].work_type,vehicle_id:null,unit:'Saat',price:100,kdv_rate:0,kdv_included:false,valid_from:FT.date},'TEST');
  bounded.command.expected_rule=structuredClone(dated);
  await rejected(()=>P.completeCustomerPrices(bounded.command),'date-bounded rule not broadened');
  await P.completeCustomerPrices({...bounded.command,save_rule:false});same(await db.get('price_book',dated.id),dated,'jobs-only preserves dated future rule');
  const f=await make(),before=await snapshot(),original=IDBObjectStore.prototype.put;let hit=false,error;
  IDBObjectStore.prototype.put=function(value,...rest){if(this.name==='work_records'&&value.id===f.works[1].id&&value.price_snapshot){hit=true;return this.add(value);}return original.call(this,value,...rest);};
  try{await P.completeCustomerPrices(f.command);}catch(e){error=e.message;}finally{IDBObjectStore.prototype.put=original;}
  check(hit&&error,'real second work ConstraintError must fire');same(await snapshot(),before,'bulk real request rollback includes future rule, works and audit');
  const race=await make(),out=await Promise.allSettled([P.completeCustomerPrices(race.command),P.completeCustomerPrices(race.command)]);
  same(out.filter(x=>x.status==='fulfilled').length,1,'real same-command transactions have one winner');
  same((await db.getAll('price_book')).filter(r=>r.work_type===race.works[0].work_type).length,1,'concurrent command creates one rule');
  return {invalid:8,staleOrLinked:7,valid,priceHistoryPreserved:true,datedRulePreserved:true,realRequestRollback:hit,concurrentWinners:1};
}"""


def pdf_text(path):
    payload = path.read_bytes()
    assert payload.startswith(b"%PDF-") and len(payload) > 1000
    operators = re.findall(rb"1 0 0 1 ([\d.-]+) ([\d.-]+) Tm <([0-9a-fA-F]+)> Tj", payload)
    assert operators, "Real downloaded PDF must have rendered Unicode text"
    return " ".join(" ".join(bytes.fromhex(x.decode()).decode("utf-16-be") for _, _, x in operators).split())


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])
    errors, external_calls, results, failures = [], [], {}, []

    def profile():
        context = browser.new_context(viewport={"width": 390, "height": 850}, accept_downloads=True, service_workers="block")
        context.add_init_script("localStorage.setItem('sp_role','boss')")
        def route(request):
            parsed = urlparse(request.request.url)
            if (parsed.scheme, parsed.hostname, parsed.port) == (origin.scheme, origin.hostname, origin.port):
                request.continue_()
            else:
                external_calls.append(request.request.url)
                request.abort()
        context.route("**/*", route)
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        database = "fi_" + uuid.uuid4().hex[:24]
        page.goto(URL + "index.html?db=" + database + "#/daha")
        page.wait_for_selector('#screen[data-view-ready="1"]')
        page.goto(URL + "README.md?db=" + database)
        ids = page.evaluate(BOOTSTRAP)
        return context, page, database, ids

    def visit(page, database, route):
        # A fresh document prevents stale closure state after fixture/meta changes.
        page.goto(URL + "README.md?db=" + database)
        page.goto(URL + "index.html?db=" + database + route)
        page.wait_for_selector('#screen[data-view-ready="1"]')
        assert "Ekran yüklenirken hata" not in page.locator("#screen").inner_text()

    def record(name, operation):
        try:
            result = operation()
            results[name] = result
            print("PASS " + name + ": " + json.dumps(result, ensure_ascii=False), flush=True)
        except Exception as error:
            failures.append({"name": name, "error": str(error)})
            print("FAIL " + name + ": " + str(error), flush=True)

    def direct(script):
        context, page, _, _ = profile()
        try:
            return page.evaluate(script)
        finally:
            context.close()

    if args.baseline_proof:
        baseline = direct(BASELINE)
        assert baseline["vat"] == {"snapshot": 1000, "invoice": [833.33, 166.67, 1000]}, baseline
        assert baseline["cash"] == [200, -100] and baseline["stale"] == [2, 1], baseline
        assert baseline["incoherent"] == 999999, baseline
        assert all(baseline[k] for k in ["mixedExcluded", "deletedFinalized", "orphanPosted", "ownerMoved", "customerHidden"]), baseline
        results["BASELINE_ONLY_defects_reproduced"] = baseline
        print("BASELINE ONLY: reproduced existing financial defects; NOT a candidate PASS", flush=True)
    else:
        record("frozen_VAT_and_rounding", lambda: direct(VAT_MATRIX))
        record("fractional_claims_real_IDB_frozen_header_parity", lambda: direct(FRACTIONAL_CLAIMS))
        record("legacy_readonly_recovery_and_TL_fuel", lambda: direct(LEGACY_AND_FUEL))
        record("claim_lifecycle_atomic_guards", lambda: direct(LIFECYCLE))
        record("cash_pairing_and_customer_site_identity", lambda: direct(CASH_AND_IDENTITY))
        record("real_IndexedDB_request_rollback", lambda: direct(ROLLBACK))
        record("atomic_bulk_price_completion_real_IDB", lambda: direct(BULK_PRICING))

        def cancellation_race():
            context, first, database, _ = profile()
            try:
                fixture = first.evaluate(RACE_SETUP)
                second = context.new_page()
                second.goto(URL + "README.md?db=" + database)
                first.evaluate(RACE_PAUSE, fixture["claim"])
                first.wait_for_function("()=>window.__cancelPaused===true")
                finalized = second.evaluate("async id=>(await import('./js/db.js')).finalizeHakedis(id)", fixture["claim"]["id"])
                assert finalized["status"] == "Kesinleşti"
                first.evaluate("()=>window.__releaseCancel()")
                outcome = first.evaluate("async()=>await window.__cancelAttempt")
                state = first.evaluate("""async fixture=>{
                  const {db,C}=FT;return {claim:await db.get('hakedis',fixture.claim.id),work:await db.get('work_records',fixture.work),
                    moves:(await db.getAll('cari_movements')).filter(x=>C.isActive(x)&&x.ref_id===fixture.claim.id)};
                }""", fixture)
                assert not outcome["accepted"], outcome
                assert state["claim"]["status"] == "Kesinleşti" and state["work"]["price_snapshot"]["locked"], state
                assert len(state["moves"]) == 1 and state["moves"][0]["amount"] == 1200, state
                return {"realTabs": 2, "pausedRealIDBRead": True, "cancel": outcome, "ledgerCount": len(state["moves"])}
            finally:
                context.close()
        record("cancel_finalize_controlled_real_IDB_interleaving", cancellation_race)

        def legacy_warning_browser():
            context, page, database, _ = profile()
            try:
                fixture = page.evaluate("""async()=>{
                  const {db,C,work,line,fields,snapshot}=FT,w=await work();
                  const h=C.newRecord(fields([line(w)]));
                  await db.put('hakedis',h);
                  await db.put('work_records',{...w,price_snapshot:{...w.price_snapshot,unit_price:2400,amount:2400}});
                  return {claim:h.id,work:w.id,before:await snapshot()};
                }""")
                visit(page, database, "#/hakedis/" + fixture["claim"])
                page.wait_for_selector("[data-final]")
                text = page.locator("#screen").inner_text()
                assert "eski taslağında kaynak fiyat geçmişi doğrulanamıyor" in text, text
                assert "1.200,00" in text and "güncel fiyatlar otomatik uygulanmaz" in text, text
                page.click("[data-final]")
                page.wait_for_selector('.sheet [data-x="1"]')
                confirmation = page.locator(".sheet").inner_text()
                assert all(value in confirmation for value in ["1.200,00", "kaynak fiyat geçmişi doğrulanamıyor", "kaydedilmiş tutarı onaylıyorsunuz"]), confirmation
                assert "2.400,00" not in confirmation, "Confirmation must use saved charge, not newer source price"
                page.click('.sheet [data-x="0"]')
                unchanged = page.evaluate("""async()=>{const db=await import('./js/db.js');const d=await db.readSnapshot({attachments:true,meta:false,drafts:true});delete d.captured_at;return JSON.stringify(d)}""")
                assert unchanged == fixture["before"], "Viewing warning and canceling confirmation must not modify legacy source/claim/audit"
                page.click("[data-final]")
                page.click('.sheet [data-x="1"]')
                page.wait_for_function("""async id=>(await (await import('./js/db.js')).get('hakedis',id)).status==='Kesinleşti'""", arg=fixture["claim"])
                outcome = page.evaluate("""async fixture=>{
                  const db=await import('./js/db.js'),C=await import('./js/core.js'),h=await db.get('hakedis',fixture.claim),w=await db.get('work_records',fixture.work);
                  return {money:[h.subtotal,h.kdv_total,h.grand_total],basis:w.price_snapshot.amount,locked:w.price_snapshot.locked,
                    moves:(await db.getAll('cari_movements')).filter(m=>C.isActive(m)&&m.ref_id===fixture.claim).map(m=>m.amount)};
                }""", fixture)
                assert outcome == {"money": [1000, 200, 1200], "basis": 1200, "locked": True, "moves": [1200]}, outcome
                return {"visibleLegacyWarning": True, "savedTotalConfirmed": 1200, "cancelPreservedAllRecords": True, "finalized": outcome}
            finally:
                context.close()
        record("legacy_draft_real_UI_warning_and_saved_total_confirmation", legacy_warning_browser)

        def invoice_browser():
            context, page, database, ids = profile()
            try:
                fixture = page.evaluate(LEGACY_AND_FUEL)
                before = page.evaluate("()=>FT.snapshot()")
                visit(page, database, "#/fatura/" + ids["customer"] + "?w=" + fixture["opaque"])
                page.wait_for_selector("[data-invoice-review]")
                assert page.is_disabled("[data-done]") and page.is_disabled("[data-copy]")
                assert "Kayıtlar değiştirilmedi" in page.locator("[data-invoice-review]").inner_text()
                assert "Seçili işler kaynak kontrolü bekliyor; fatura kalemleri henüz hesaplanmadı." in page.locator("#screen").inner_text()
                assert "Seçili iş yok." not in page.locator("#screen").inner_text(), "Selected unresolved work must not be described as no selection"
                page.screenshot(path=str(ARTIFACT / "invoice-review.png"), full_page=True)
                visit(page, database, "#/fatura/" + ids["customer"] + "?w=-")
                assert "Seçili iş yok." in page.locator("#screen").inner_text(), "Ordinary empty selection wording stays unchanged"
                assert page.locator("[data-invoice-review]").count() == 0
                visit(page, database, "#/fatura/" + ids["customer"] + "?w=" + fixture["legacy"])
                assert page.locator("[data-invoice-review]").count() == 0
                assert not page.is_disabled("[data-done]") and not page.is_disabled("[data-copy]")
                text = page.locator("#screen").inner_text()
                assert all(value in text for value in ["1.000,00", "200,00", "1.200,00"]), text
                visit(page, database, "#/fatura/" + ids["customer"] + "?w=" + fixture["mixed"])
                assert not page.is_disabled("[data-done]")
                assert page.locator('[data-w="' + fixture["mixed"] + '"]').count() == 1
                assert page.locator('[data-w="' + fixture["fuel"] + '"]').count() == 0
                after = page.evaluate("""async()=>{const db=await import('./js/db.js');const d=await db.readSnapshot({attachments:true,meta:false,drafts:true});delete d.captured_at;return JSON.stringify(d)}""")
                assert after == before, "Invoice preview/review must never repair stored records"
                return {"unresolvedBlocked": True, "legacyExact": [1000, 200, 1200], "mixedTLInvoiceable": True, "rawDataUnchanged": True}
            finally:
                context.close()
        record("invoice_real_UI_review_and_frozen_totals", invoice_browser)

        def bulk_browser():
            context, page, database, ids = profile()
            try:
                works = page.evaluate("""async()=>{const a=await FT.work({quantity:2,price_snapshot:null}),b=await FT.work({quantity:3,price_snapshot:null});return [a.id,b.id]}""")
                visit(page, database, "#/cari/" + ids["customer"])
                page.wait_for_selector('[data-gp="0"]')
                page.click('[data-gapply="0"]')
                page.wait_for_selector('[data-gerror="0"]:not([hidden])')
                assert "0" in page.locator('[data-gerror="0"]').inner_text()
                assert page.locator('.sheet [data-x="1"]').count() == 0
                page.fill('[data-gp="0"]', "0")
                page.fill('[data-gvat="0"]', "0")
                page.select_option('[data-ginc="0"]', "0")
                # Dispatch a second click while disabled to exercise the handler's busy guard.
                page.locator('[data-gapply="0"]').dispatch_event("click")
                page.locator('[data-gapply="0"]').dispatch_event("click")
                page.wait_for_selector('.sheet [data-x="1"]')
                assert page.locator('.sheet [data-x="1"]').count() == 1
                confirmation = page.locator(".sheet").inner_text()
                assert all(value in confirmation for value in ["2 iş", "KDV %0 hariç", "bedelsiz"]), confirmation
                page.click('.sheet [data-x="1"]')
                page.wait_for_function("""async ids=>{const db=await import('./js/db.js');return (await Promise.all(ids.map(id=>db.get('work_records',id)))).every(w=>w.price_snapshot?.unit_price===0&&w.price_snapshot?.kdv_rate===0)}""", arg=works)
                page.wait_for_selector('#screen[data-view-ready="1"]')
                assert page.locator('[data-gp="0"]').count() == 0
                # A fresh missing-price group verifies explicit included-VAT confirmation.
                fresh = page.evaluate("""async ids=>{const db=await import('./js/db.js');const w=await db.get('work_records',ids[0]);const {id,created_at,updated_at,...rest}=w;return (await db.saveNew('work_records',{...rest,quantity:2,work_type:'TEST Included Bulk',price_snapshot:null},'TEST')).id}""", works)
                visit(page, database, "#/cari/" + ids["customer"])
                page.fill('[data-gp="0"]', "1200")
                page.fill('[data-gvat="0"]', "20")
                page.select_option('[data-ginc="0"]', "1")
                page.click('[data-gapply="0"]')
                page.wait_for_selector('.sheet [data-x="1"]')
                confirmation = page.locator(".sheet").inner_text()
                assert "1 iş" in confirmation and "KDV %20 dahil" in confirmation and "2.400,00" in confirmation, confirmation
                page.click('.sheet [data-x="0"]')
                assert page.evaluate("async id=>(await (await import('./js/db.js')).get('work_records',id)).price_snapshot", fresh) is None
                page.click('[data-gapply="0"]')
                page.wait_for_selector('.sheet [data-x="1"]')
                old = page.query_selector("#screen")
                page.evaluate("()=>location.hash='#/daha'")
                page.wait_for_function("old=>!old.isConnected", arg=old)
                page.wait_for_selector('#screen[data-view-ready="1"]')
                if page.locator('.sheet [data-x="1"]').count():
                    page.click('.sheet [data-x="1"]')
                # The continuation settles before the next read; no arbitrary sleep.
                assert page.evaluate("async id=>(await (await import('./js/db.js')).get('work_records',id)).price_snapshot", fresh) is None
                visit(page, database, "#/cari/" + ids["customer"])
                page.fill('[data-gp="0"]', "1200")
                page.fill('[data-gvat="0"]', "20")
                page.select_option('[data-ginc="0"]', "1")
                page.click('[data-gapply="0"]')
                page.click('.sheet [data-x="1"]')
                page.wait_for_function("""async id=>{const w=await(await import('./js/db.js')).get('work_records',id);return w.price_snapshot?.amount===2400&&w.price_snapshot?.kdv_included===true&&w.price_snapshot?.kdv_rate===20}""", arg=fresh)
                return {"blankRejected": True, "explicitZeroAndVATZero": 2, "busySingleConfirmation": True, "cancelAndDetachedNoWrites": True, "includedVATBasis": 2400}
            finally:
                context.close()
        record("bulk_pricing_real_UI_confirmation_and_navigation", bulk_browser)

        def privacy_browser():
            context, page, database, ids = profile()
            try:
                sentinels = {"note": "TEST_PRIVATE_ADJUSTMENT_NOTE", "reason": "TEST_PRIVATE_ADJUSTMENT_REASON"}
                page.evaluate("""async sentinels=>{
                  const {db,date,customer,work}=FT;
                  await work({price_snapshot:{unit_price:100,amount:100,kdv_rate:0,kdv_included:false}});
                  await db.saveNew('cari_movements',{date,customer_id:customer.id,type:'Duzeltme',amount:200,note:sentinels.note,reason:sentinels.reason},'TEST');
                  await db.saveNew('cari_movements',{date,customer_id:customer.id,type:'Hakedis',amount:150,note:'TEST Public Hakediş #123'},'TEST');
                }""", sentinels)
                before = page.evaluate("()=>FT.snapshot()")
                visit(page, database, "#/tahsilat/" + ids["customer"])
                page.wait_for_selector("[data-msg]")
                assert sentinels["note"] in page.locator("#screen").inner_text(), "Internal open-item label must remain"
                for tone in ["nazik", "net", "son"]:
                    page.select_option("[data-tone]", tone)
                    message = page.input_value("[data-msg]")
                    assert all(value not in message for value in sentinels.values()), message
                    assert "Düzeltme" in message and "TEST Public Hakediş #123" in message, message
                visit(page, database, "#/musteriler/" + ids["customer"])
                page.wait_for_selector('[data-dper="all"]')
                page.click('[data-dper="all"]')
                page.wait_for_selector('[data-dpdf="customer"]')
                extracted = {}
                for audience in ["customer", "internal"]:
                    with page.expect_download(timeout=60000) as pending:
                        page.click('[data-dpdf="' + audience + '"]')
                    path = ARTIFACT / ("privacy-" + audience + ".pdf")
                    pending.value.save_as(path)
                    extracted[audience] = pdf_text(path)
                assert all(value not in extracted["customer"] for value in sentinels.values()), extracted["customer"]
                assert sentinels["note"] in extracted["internal"], extracted["internal"]
                assert "Düzeltme" in extracted["customer"] and "TEST Public Hakediş #123" in extracted["customer"]
                for width in [320, 390, 768]:
                    page.set_viewport_size({"width": width, "height": 850})
                    assert page.evaluate("()=>document.documentElement.scrollWidth<=innerWidth+1"), width
                after = page.evaluate("""async()=>{const db=await import('./js/db.js');const d=await db.readSnapshot({attachments:true,meta:false,drafts:true});delete d.captured_at;return JSON.stringify(d)}""")
                assert after == before, "View, tone switches and actual PDF exports must preserve raw records, audit and private notes"
                return {"reminderTones": 3, "actualPDFs": ["customer", "internal"], "rawDataUnchanged": True}
            finally:
                context.close()
        record("privacy_real_reminders_and_downloaded_PDFs", privacy_browser)

    results["failures"] = failures
    results["browser_errors"] = errors
    results["external_attempts_blocked"] = external_calls
    (ARTIFACT / ("baseline.json" if args.baseline_proof else "results.json")).write_text(json.dumps(results, ensure_ascii=False, indent=2))
    browser.close()
    assert not errors, errors
    assert not external_calls, external_calls
    assert not failures, failures
    print("BASELINE EVIDENCE COMPLETE" if args.baseline_proof else "finance_integrity browser PASS: synthetic real IDB lifecycle, money, identity and privacy", flush=True)

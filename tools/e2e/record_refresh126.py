"""Deterministic commit/navigation interleaving using the real refresh controller and DOM."""
import sys,json
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8903/').rstrip('/')+'/'
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(service_workers='block');p=c.new_page();p.goto(base+'README.md')
 result=p.evaluate("""async()=>{
 const {installRecordRefresh,recordsCommitted}=await import('./js/record-refresh.js');
 const realSet=window.setTimeout,realClear=window.clearTimeout,tasks=new Map();let next=1000000,reloads=0;
 window.setTimeout=(fn,ms,...args)=>ms===80?(tasks.set(++next,()=>fn(...args)),next):realSet(fn,ms,...args);
 window.clearTimeout=id=>{if(!tasks.delete(id))realClear(id)};
 const root=()=>{const el=document.createElement('main');el.dataset.viewReady='1';document.body.append(el);return el;};
 let current=root();const first=current;
 const dispose=await installRecordRefresh({db:{openDB:async()=>({name:'TEST_refresh126'})},context:()=>({root:current,parts:[]}),reload:async()=>{reloads++}});
 const flush=async()=>{const [id,fn]=tasks.entries().next().value||[];if(!fn)throw Error('Missing scheduled refresh');tasks.delete(id);await fn();};
 try{
  recordsCommitted('TEST_refresh126',['cash_records']);current=root();first.remove();await flush();
  if(reloads!==0)throw Error('OLD_VIEW_REFRESHED_NEW_SCREEN: '+reloads);
  recordsCommitted('TEST_refresh126',['cash_records']);await flush();if(reloads!==1)throw Error('Same screen must still refresh');
  const form=document.createElement('form');current.append(form);recordsCommitted('TEST_refresh126',['work_records']);await flush();if(reloads!==1)throw Error('Open form must not be replaced');
  form.remove();document.dispatchEvent(new Event('focusout'));await flush();if(reloads!==2)throw Error('Deferred same-screen refresh must resume');
  return {oldViewRefreshesNewScreen:0,sameViewRefresh:true,openFormPreserved:true,deferredRefreshResumes:true,businessWrites:0};
 }finally{dispose();window.setTimeout=realSet;window.clearTimeout=realClear;current.remove();}
 }""");print(json.dumps(result));b.close()

"""Delay the real saved-draft read: text typed during assistant startup must survive."""
import argparse,json,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('url',nargs='?',default='http://localhost:8841/');p.add_argument('--baseline-proof',action='store_true');p.add_argument('--artifacts',default='/tmp/solo-assistant-startup');a=p.parse_args()
U=a.url.rstrip('/')+'/';o=urlparse(U);assert o.scheme=='http' and o.hostname in ('localhost','127.0.0.1','::1') and not o.query and not o.fragment
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];calls=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 def block(r):calls.append(r.request.url);r.abort()
 c.route('https://generativelanguage.googleapis.com/**',block)
 app=U+'index.html?db=startup83_'+uuid.uuid4().hex[:10];pg.goto(app+'#/hakedis');pg.wait_for_selector('[data-list]')
 before=pg.evaluate("""async()=>{const db=await import('./js/db.js');await db.metaSet('assistant_draft','TEST saved older draft');const data=await db.dumpAll();return JSON.stringify(data)}""")
 pg.evaluate("""()=>{const get=IDBObjectStore.prototype.get;IDBObjectStore.prototype.get=function(key){const req=get.call(this,key);if(this.name==='meta'&&key==='assistant_draft'){IDBObjectStore.prototype.get=get;req.addEventListener('success',e=>{e.stopImmediatePropagation();window.__releaseStartupDraft=()=>req.onsuccess.call(req,e);});}return req;};}""")
 pg.goto(app+'#/akilli-asistan');pg.wait_for_function("()=>typeof window.__releaseStartupDraft==='function'")
 assert pg.is_disabled('[data-ask]')
 typed='Yeni yakıt kaydı oluştur';pg.fill('[data-msg]',typed);pg.evaluate('()=>window.__releaseStartupDraft()');pg.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
 actual=pg.input_value('[data-msg]')
 if a.baseline_proof:assert actual=='TEST saved older draft',actual
 else:
  assert actual==typed,(actual,typed)
  pg.click('[data-ask]');pg.wait_for_selector('[data-kind=fuel]');pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
  assert not pg.is_checked('[data-kind=fuel] [data-pick]')
 assert before==pg.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())") and not calls and not errors
 result={'baseline_proof':a.baseline_proof,'typed_preserved':actual==typed,'preview_only':True,'provider_calls':calls,'page_errors':errors};(out/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));c.close();b.close()

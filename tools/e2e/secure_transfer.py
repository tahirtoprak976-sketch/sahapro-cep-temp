"""Device-bound history delivery in real Chromium/IndexedDB; synthetic records only.

The delivery endpoint is fulfilled with a packet made by the actual CLI. No real
phone data or business packet is published. Supports a deployed URL as argv[1].
"""
import base64
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8841/').rstrip('/') + '/'
INIT = "localStorage.setItem('sp_role','boss');"
PACKAGE = {'format':'SAHAPRO_HISTORY_V1','title':'TEST güvenli geçmiş aktarımı','rows':[
    {'row_id':'TEST-secure-work-1','kind':'work','date':'2026-09-01','customer':'TEST Aktarım Müşterisi','vehicle':'TEST Aktarım Aracı','work_type':'Moloz Nakliye','quantity':2,'unit':'Sefer','unit_price':1000,'kdv_rate':20,'kdv_included':False,'settlement_status':'unbilled_unpaid','raw_message':'TEST 2 sefer 1000 TL KDV hariç'},
    {'row_id':'TEST-secure-work-2','kind':'work','date':'2026-09-02','customer':'TEST Aktarım Müşterisi','vehicle':'TEST Aktarım Aracı','work_type':'Moloz Nakliye','quantity':3,'unit':'Sefer','unit_price':None,'kdv_rate':None,'kdv_included':None,'settlement_status':'unbilled_unpaid'},
    {'row_id':'TEST-secure-fuel-1','kind':'fuel','date':'2026-09-02','vehicle':'TEST Aktarım Aracı','liters':20,'fuel_source':'Depo Tankı','settlement_status':'unbilled_unpaid'}]}

def ready(page):
    page.wait_for_selector('#screen[data-view-ready="1"] [data-transfer-pair] ', state='attached')

def snapshot(page):
    return page.evaluate("async()=>{const db=await import('./js/db.js'); return await db.readSnapshot({attachments:true,meta:true,drafts:true})}")

def business(page):
    snap = snapshot(page)
    snap.pop('captured_at', None)
    return snap

with tempfile.TemporaryDirectory(prefix='solo-secure-e2e-') as temp, sync_playwright() as p:
    temp = Path(temp)
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    ctx = browser.new_context(viewport={'width':390,'height':844})
    ctx.add_init_script(INIT)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE+'index.html#/gecmis'); ready(page)
    before = business(page)
    page.click('[data-transfer-pair]')
    page.wait_for_selector('[data-transfer-pair-tools]:not([hidden])')
    code = page.input_value('[data-transfer-code]')
    assert code.startswith('SPAK1.')
    assert business(page) == before, 'Pairing must not export or modify business records'
    assert page.evaluate("async()=>{const {getRecipient}=await import('./js/secure-transfer-db.js');const r=await getRecipient();return r.private_key.extractable}") is False
    page.reload(); ready(page)
    assert page.input_value('[data-transfer-code]') == code
    # Multiple initial pairing requests in another isolated DB converge on one key.
    concurrent = page.evaluate("""async()=>{
      const db=await import('./js/secure-transfer-db.js');await db.forgetRecipient();
      const rows=await Promise.all([db.ensureRecipient(),db.ensureRecipient(),db.ensureRecipient()]);
      return rows.map(r=>r.id);
    }""")
    assert len(set(concurrent)) == 1
    page.reload(); ready(page); code = page.input_value('[data-transfer-code]')
    (temp/'pair.txt').write_text(code)
    (temp/'source.json').write_text(json.dumps(PACKAGE,ensure_ascii=False))
    command = ['node','tools/create-secure-transfer.mjs','--pair-file',str(temp/'pair.txt'),'--input',str(temp/'source.json'),'--out-dir',str(temp/'out'),'--base-url',BASE]
    made = json.loads(subprocess.check_output(command,cwd=ROOT,text=True))
    encrypted = Path(made['encrypted_file']).read_bytes()
    assert b'TEST' not in encrypted and 'Aktarım'.encode() not in encrypted
    assert 'private_key' not in encrypted.decode()
    print('PASS non-extractable device key survives reload, concurrent pairing converges, CLI publishes ciphertext only; business DB unchanged',flush=True)
    endpoint = BASE+'data/transfers/'+Path(made['encrypted_file']).name
    seen = []
    def delivery(route):
        seen.append(route.request.url)
        route.fulfill(status=200,content_type='application/json',body=encrypted)
    ctx.route(endpoint,delivery)
    link = made['url_after_publish']
    page.goto(link); ready(page)
    assert 'Henüz kayıt yapılmadı' in page.inner_text('[data-transfer-status]')
    assert business(page) == before
    assert page.locator('[data-h-row]').count() == 3
    assert page.locator('[data-h-row="0"] [data-h-field=date]').input_value() == '2026-09-01'
    assert page.locator('[data-h-row="2"] [data-h-include]').is_checked() is False
    assert page.locator('[data-history-commit]').is_disabled()
    assert page.evaluate("async()=>{const u=await import('./js/update-safety.js');return u.updateRisk(document.querySelector('#screen')).unsaved}")
    assert page.evaluate("async()=>{const u=await import('./js/update-safety.js');return (await u.allowUpdate(document.querySelector('#screen'),async()=>false)).allowed}") is False
    assert seen == [endpoint]
    page.screenshot(path='/tmp/solo-v3963-secure-preview.png', full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'), '390px layout overflows'
    # An unconfirmed second work cannot inherit any of today's prices.
    page.check('[data-history-new]')
    assert page.locator('[data-history-commit]').is_disabled()
    page.check('[data-h-row="1"] [data-h-unpriced]')
    page.check('[data-history-confirm]')
    page.click('[data-history-commit]')
    page.click('.sheet [data-x="0"]')
    assert business(page) == before, 'Cancel must not write'
    # Genuine write failure after backup must roll back all records and audit.
    aborted = page.evaluate("""async pkg=>{
      const H=await import('./js/history-core.js'),D=await import('./js/history-db.js'),db=await import('./js/db.js');
      const choices=H.initialHistoryChoices(H.readHistoryPackage(pkg));choices[1].unpriced_confirmed=true;
      const before=await db.readSnapshot({attachments:true,meta:true,drafts:true});
      const old=IDBObjectStore.prototype.add;let hit=false;
      IDBObjectStore.prototype.add=function(row,...args){const r=old.call(this,row,...args);if(this.name==='work_records'&&!hit){hit=true;old.call(this,row,...args);}return r;};
      let message='';try{await D.commitHistory(pkg,choices,{allowNew:true});}catch(e){message=e?.message||String(e);}finally{IDBObjectStore.prototype.add=old;}
      const after=await db.readSnapshot({attachments:true,meta:true,drafts:true});delete before.captured_at;delete after.captured_at;
      return {hit,message,unchanged:JSON.stringify(before)===JSON.stringify(after)};
    }""",PACKAGE)
    assert aborted['hit'] and aborted['message'] and aborted['unchanged'], aborted
    print('PASS link only previews; dates/prices remain historical, fuel starts unselected; cancel and real IndexedDB write failure leave all records/audit unchanged',flush=True)
    # Backup failure prevents even the first work write.
    backup_fail = page.evaluate("""async pkg=>{
      const H=await import('./js/history-core.js'),D=await import('./js/history-db.js'),db=await import('./js/db.js');
      const choices=H.initialHistoryChoices(H.readHistoryPackage(pkg));choices[1].unpriced_confirmed=true;
      const before=await db.dumpAll(),old=indexedDB.open.bind(indexedDB);let hit=false;
      indexedDB.open=function(name,...args){if(String(name).endsWith('_recovery')){hit=true;throw Error('TEST recovery denied');}return old(name,...args);};
      let message='';try{await D.commitHistory(pkg,choices,{allowNew:true});}catch(e){message=e.message;}finally{indexedDB.open=old;}
      return {hit,message,unchanged:JSON.stringify(before)===JSON.stringify(await db.dumpAll())};
    }""",PACKAGE)
    assert backup_fail['hit'] and backup_fail['unchanged'] and 'recovery denied' in backup_fail['message'],backup_fail
    # Concurrent imports serialize: exactly one batch is committed.
    result = page.evaluate("""async pkg=>{
      const H=await import('./js/history-core.js'),D=await import('./js/history-db.js'),db=await import('./js/db.js');
      const choices=H.initialHistoryChoices(H.readHistoryPackage(pkg));choices[1].unpriced_confirmed=true;
      const settled=await Promise.allSettled([D.commitHistory(pkg,choices,{allowNew:true}),D.commitHistory(pkg,choices,{allowNew:true})]);
      return {states:settled.map(r=>r.status),data:await db.dumpAll()};
    }""",PACKAGE)
    assert sorted(result['states']) == ['fulfilled','rejected'],result['states']
    works = [r for r in result['data']['work_records'] if r.get('history_source',{}).get('row_id','').startswith('TEST-secure')]
    assert len(works) == 2
    assert next(w for w in works if w['date']=='2026-09-01')['price_snapshot']['total'] == 2400
    assert next(w for w in works if w['date']=='2026-09-02')['price_snapshot'] is None
    assert not result['data']['fuel_records']
    assert not result['data']['cash_records'] and not result['data']['cari_movements'] and not result['data']['hakedis']
    recovery = page.evaluate("""async()=>{const db=await import('./js/db.js');const name=(await db.openDB()).name+'_recovery';return new Promise((res,rej)=>{const r=indexedDB.open(name);r.onsuccess=()=>{const c=r.result,t=c.transaction('snapshots'),q=t.objectStore('snapshots').getAll();q.onsuccess=()=>res(q.result.map(x=>({id:x.id,works:x.full.data.work_records.length})));t.oncomplete=()=>c.close();};r.onerror=()=>rej(r.error);});}""")
    assert any(r['id'].startswith('before-history-import-') and r['works']==0 for r in recovery),recovery
    # Replay and tombstone protections.
    after = business(page)
    page.reload(); ready(page)
    assert page.locator('[data-history-commit]').is_disabled()
    assert 'daha önce aktarıldı' in page.inner_text('[data-history-rows]')
    assert business(page) == after
    page.evaluate("""async id=>{const db=await import('./js/db.js'),w=await db.get('work_records',id);await db.put('work_records',{...w,deleted_at:new Date().toISOString()});}""",works[0]['id'])
    page.reload(); ready(page)
    assert 'daha önce aktarıldı' in page.inner_text('[data-history-rows]')
    assert len(page.evaluate("async()=>{const db=await import('./js/db.js');return await db.getAll('work_records')}"))==2
    print('PASS mandatory recovery backup; concurrent retry creates exactly two works once; historical VAT preserved, unpriced job unpriced, no money/fuel writes; replay/tombstone blocked',flush=True)
    # Other browser cannot decrypt the packet, including after making its own pair.
    stranger = browser.new_context(); stranger.add_init_script(INIT); stranger.route(endpoint,delivery)
    other = stranger.new_page(); other.goto(link); ready(other)
    assert 'Önce bu telefonu eşleştirin' in other.inner_text('[data-transfer-status]')
    other.click('[data-transfer-pair]');other.wait_for_selector('[data-transfer-pair-tools]:not([hidden])')
    other.click('[data-transfer-open]')
    other.wait_for_function("()=>document.querySelector('[data-transfer-status]').textContent.includes('başka bir telefon')")
    assert other.locator('[data-history-preview]').is_hidden()
    # Modification and expiry fail with no preview and no record writes.
    ctx.unroute(endpoint)
    tampered = bytearray(encrypted);pos=tampered.index(b'ciphertext')+14;tampered[pos]=ord('A') if tampered[pos]!=ord('A') else ord('B')
    ctx.route(endpoint,lambda r:r.fulfill(status=200,content_type='application/json',body=bytes(tampered)))
    page.reload();ready(page)
    assert 'doğrulaması uyuşmuyor' in page.inner_text('[data-transfer-status]')
    assert page.locator('[data-history-preview]').is_hidden()
    # A pending transfer blocks commit/update but does not write any business data.
    ctx.unroute(endpoint)
    pending = []
    ctx.route(endpoint,lambda r:pending.append(r))
    page.goto(BASE+'index.html#/daha')
    page.wait_for_selector('#screen[data-view-ready="1"]')
    page.goto(link,wait_until='domcontentloaded')
    page.wait_for_function("()=>document.querySelector('[data-transfer-status]')?.textContent.includes('alınıyor')")
    page.wait_for_timeout(50)
    assert pending
    assert page.evaluate("async()=>{const u=await import('./js/update-safety.js');return u.updateRisk(document.querySelector('#screen')).busy}")
    assert page.locator('[data-history-file]').is_disabled()
    assert page.locator('[data-history-commit]').is_disabled()
    pending[0].fulfill(status=200,content_type='application/json',body=encrypted)
    ready(page)
    assert page.locator('[data-history-file]').is_enabled()
    assert page.evaluate("async()=>{const u=await import('./js/update-safety.js');return u.updateRisk(document.querySelector('#screen')).busy}") is False
    # The sealed file alternative decrypts in the same phone without an endpoint.
    page.goto(BASE+'index.html#/gecmis');ready(page)
    ctx.set_offline(True)
    page.set_input_files('[data-transfer-file]', {'name':'TEST.sahapro-transfer.json','mimeType':'application/json','buffer':encrypted})
    page.wait_for_function("()=>document.querySelector('[data-transfer-status]').textContent.includes('Henüz kayıt yapılmadı')")
    ctx.set_offline(False)
    page.click('[data-transfer-forget]');page.click('.sheet [data-x="1"]')
    page.wait_for_function("()=>document.querySelector('[data-transfer-status]').textContent.includes('Eşleştirme kaldırıldı')")
    assert page.locator('[data-history-preview]').is_hidden()
    page.reload();ready(page)
    assert page.locator('[data-transfer-pair-tools]').is_hidden()
    assert len(page.evaluate("async()=>{const db=await import('./js/db.js');return await db.getAll('work_records')}"))==2
    print('PASS another browser rejected; changed bytes rejected; pending fetch blocks writes/update; encrypted file opens offline; forgetting pairing clears preview and survives reload without deleting work',flush=True)
    assert not errors, errors
    browser.close()
print('secure_transfer browser PASS',flush=True)

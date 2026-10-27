"""Real installed schema7 v3.9.74 -> candidate SW upgrade; synthetic data only.

Run from a checkout containing the baseline commit:
  python tools/e2e/upgrade_schema7.py --source-root . \
    --baseline-ref 57da7b2a0a5372f74cbb486ffc88eb2a2ea76fcc

The old tree comes from git archive; the current tree is copied without changing
either. A temporary loopback server swaps the same origin from old to new bytes.
No worker/cache/controller APIs are mocked and no tests or browser flags change.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tarfile
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen

from playwright.sync_api import sync_playwright


SNAPSHOT = """async()=>{
  const db=await import('./js/db.js');
  const snap=await db.readSnapshot({attachments:true,meta:true,drafts:true});
  delete snap.captured_at;
  for(const row of snap.attachments){
    if(row.blob){
      row.blob_bytes=Array.from(new Uint8Array(await row.blob.arrayBuffer()));
      row.blob_metadata={type:row.blob.type,size:row.blob.size,name:row.blob.name??null,lastModified:row.blob.lastModified??null};
      delete row.blob;
    }
  }
  return snap;
}"""


def assert_preserved(before, after, upgraded=False):
    # This is an installed schema7 profile, not an additive schema6 migration.
    # No entity, store, marker, audit, metadata, draft or original byte may change.
    assert set(after['data']) == set(before['data']), 'Schema7 store set must remain identical'
    for snapshot in (before, after):
        assert [r for r in snapshot['meta'] if r['key'] == 'schema_version_current'] == [
            {'key': 'schema_version_current', 'value': 7}], 'Schema7 marker remains exactly7'
    if after != before:
        def differences(left, right, path='snapshot'):
            if isinstance(left, dict) and isinstance(right, dict):
                return [d for key in sorted(set(left) | set(right))
                        for d in differences(left.get(key), right.get(key), path+'.'+key)]
            if left != right:
                return [{'path':path, 'before':left, 'after':right}]
            return []
        print('Upgrade preservation differences: '+json.dumps(differences(before, after)), flush=True)
    assert after == before, 'Every schema7 entity, metadata, draft and attachment byte must survive exactly'


SCHEMA_STATE = """async()=>{
  const db=await import('./js/db.js'),connection=await db.openDB();
  const denied=await new Promise(resolve=>{const q=indexedDB.open(connection.name,6);
    q.onerror=()=>resolve(q.error.name);q.onsuccess=()=>{q.result.close();resolve('opened');};});
  // Inspect only existing recovery stores. Do not manufacture one by opening a missing DB.
  const databases=await indexedDB.databases();
  const recoveryName=connection.name+'_recovery';
  let recovery=null;
  if(databases.some(x=>x.name===recoveryName)) recovery=await new Promise((resolve,reject)=>{
    const q=indexedDB.open(recoveryName);q.onerror=()=>reject(q.error);q.onsuccess=()=>{
      const c=q.result;
      if(!c.objectStoreNames.contains('snapshots')){c.close();reject(Error('Unexpected recovery shape'));return;}
      const r=c.transaction('snapshots').objectStore('snapshots').getAll();
      r.onerror=()=>reject(r.error);r.onsuccess=()=>{resolve(r.result);c.close();};};});
  for(const snapshot of recovery||[])for(const row of snapshot.stores?.attachments||[])if(row.blob){
    row.blob_bytes=Array.from(new Uint8Array(await row.blob.arrayBuffer()));delete row.blob;}
  return {version:connection.version,denied,recovery,pending:await db.getAll('pending_fuel_records')};
}"""


def blank_pdf():
    # Real one-page inert PDF; no script/action/external resources.
    objects = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
               b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>"]
    result, offsets = b"%PDF-1.4\n", [0]
    for number, body in enumerate(objects, 1):
        offsets.append(len(result))
        result += str(number).encode() + b" 0 obj\n" + body + b"\nendobj\n"
    xref = len(result)
    result += b"xref\n0 4\n0000000000 65535 f \n"
    result += b"".join(("%010d 00000 n \n" % offset).encode() for offset in offsets[1:])
    return result + b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n" + str(xref).encode() + b"\n%%EOF\n"



def constant(root, file, name):
    match = re.search(r'\bconst\s+' + re.escape(name) + r'\s*=\s*"([^"]+)"',
                      (root / file).read_text())
    if not match:
        raise AssertionError(f'Missing {name} in {file}')
    return match.group(1)


def archive_baseline(root, ref, destination):
    result = subprocess.run(
        ['git', '-c', f'safe.directory={root}', 'archive', '--format=tar', ref],
        cwd=root, check=True, capture_output=True,
    )
    # Materialize only regular files/directories; do not follow archive links.
    with tarfile.open(fileobj=io.BytesIO(result.stdout)) as archive:
        for member in archive.getmembers():
            relative = PurePosixPath(member.name)
            if relative.is_absolute() or '..' in relative.parts:
                raise AssertionError('Unsafe baseline archive path')
            target = destination.joinpath(*relative.parts)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            elif member.isfile():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.extractfile(member).read())
            else:
                raise AssertionError(f'Unsupported baseline archive member: {member.name}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root', type=Path,
                        default=Path(__file__).resolve().parents[2])
    parser.add_argument('--baseline-ref',
                        default='57da7b2a0a5372f74cbb486ffc88eb2a2ea76fcc')
    args = parser.parse_args()
    root = args.source_root.resolve()
    with tempfile.TemporaryDirectory(prefix='solo-upgrade-schema7-e2e-') as temporary:
        temporary = Path(temporary)
        old = temporary / 'old'
        new = temporary / 'new'
        old.mkdir()
        archive_baseline(root, args.baseline_ref, old)
        shutil.copytree(root, new, ignore=shutil.ignore_patterns(
            '.git', '.github', 'tests', 'tools', 'docs', '__pycache__'))
        old_version = constant(old, 'js/core.js', 'APP_VERSION')
        new_version = constant(new, 'js/core.js', 'APP_VERSION')
        old_cache = constant(old, 'sw.js', 'CACHE')
        new_cache = constant(new, 'sw.js', 'CACHE')
        assert old_version != new_version, 'Release APP_VERSION must change'
        assert old_cache != new_cache, 'Atomic service-worker CACHE must change'
        assert constant(old, 'js/core.js', 'APP_ID') == constant(new, 'js/core.js', 'APP_ID')
        state = {'root': old}
        server_requests = []

        class Handler(SimpleHTTPRequestHandler):
            def __init__(self, *handler_args, **handler_kwargs):
                super().__init__(*handler_args, directory=str(state['root']), **handler_kwargs)

            def end_headers(self):
                self.send_header('Cache-Control', 'no-store')
                super().end_headers()

            def do_GET(self):
                # Chromium may preconnect before deployment and send its GET
                # later. Choose the deployed tree per request, not TCP accept.
                self.directory = str(state['root'])
                # The deployment swaps happen within one second; do not allow a
                # filesystem mtime comparison to disguise changed release bytes.
                if 'If-Modified-Since' in self.headers:
                    del self.headers['If-Modified-Since']
                super().do_GET()

            def log_request(self, code='-', size='-'):
                if self.path.split('?')[0] == '/sw.js' or str(code) != '200':
                    entry = {'path':self.path,'root':Path(self.directory).name,'status':code,
                             'diagnostic':self.headers.get('User-Agent')=='SOLO-upgrade-diagnostic'}
                    if self.path.split('?')[0] == '/sw.js':
                        entry['sha256'] = hashlib.sha256((Path(self.directory)/'sw.js').read_bytes()).hexdigest()
                    server_requests.append(entry)

            def log_message(self, *_args):
                pass

        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}/'
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(
                    executable_path='/usr/bin/chromium', args=['--no-sandbox'])
                context = browser.new_context(viewport={'width':390, 'height':844}, accept_downloads=True)
                context.add_init_script("localStorage.setItem('sp_role','boss')")
                page = context.new_page()
                errors = []
                console_warnings = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                context.on('console', lambda message: console_warnings.append(message.text)
                        if message.type in ('warning', 'error') else None)

                def update_state():
                    return page.evaluate("""async()=>{
                      const r=await navigator.serviceWorker.getRegistration();
                      const worker=w=>w?{state:w.state,url:w.scriptURL}:null;
                      return {url:location.href,updateCheck:typeof window.__swCheck,
                        controller:worker(navigator.serviceWorker.controller),
                        active:worker(r?.active),waiting:worker(r?.waiting),
                        installing:worker(r?.installing),
                        bar:document.querySelector('#update-bar')?.outerHTML||null,
                        ready:document.querySelector('#screen')?.dataset.viewReady,
                        quantity:document.querySelector('[name=quantity]')?.value,
                        caches:await caches.keys(),events:window.__upgradeEvents||[]};
                    }""")

                page.goto(base + 'index.html#/daha')
                page.wait_for_selector('#screen[data-view-ready="1"]')
                page.evaluate('async()=>{await navigator.serviceWorker.ready}')
                page.wait_for_function('()=>!!navigator.serviceWorker.controller')
                page.reload()
                page.wait_for_selector('#screen[data-view-ready="1"]')
                assert page.evaluate("async()=>(await import('./js/core.js')).APP_VERSION") == old_version
                assert old_cache in page.evaluate('()=>caches.keys()')

                ids = page.evaluate("""async pdfBytes=>{
                  const db=await import('./js/db.js');
                  const c=await db.saveNew('customers',{name:'TEST Upgrade Customer'},'TEST');
                  const v=await db.saveNew('vehicles',{name:'TEST Upgrade Vehicle'},'TEST');
                  const original={row_id:'TEST-upgrade-legacy',kind:'work',date:'2026-09-01',
                    customer:c.name,vehicle:v.name,work_type:'Moloz Nakliye',quantity:3,
                    unit:'Sefer',description:'TEST original historical description',
                    raw_message:'TEST original source; do not rewrite',
                    settlement_status:'unbilled_unpaid'};
                  const w=await db.saveNew('work_records',{
                    customer_id:c.id,vehicle_id:v.id,date:original.date,
                    work_type:original.work_type,quantity:3,unit:'Sefer',
                    description:original.description,raw_message:original.raw_message,
                    internal_note:'TEST private historical note',price_snapshot:null,
                    history_source:{row_id:original.row_id,original_row:original,
                      imported_at:'2026-10-01T00:00:00Z',settlement_status:'unbilled_unpaid'}
                  },'TEST upgrade legacy fixture');
                  await db.addAttachment('work',w.id,
                    new File(['TEST original attachment bytes \\u0131\\n'],'TEST-source.txt',{type:'text/plain'}));
                  // Keep an active-format legacy original, but never open it on the vulnerable baseline.
                  await db.addAttachment('work',w.id,new File([
                    `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" onload="localStorage.setItem('TEST-upgrade-svg-executed','yes')"><rect width="8" height="8" fill="orange"/></svg>`
                  ],'TEST-legacy.svg',{type:'image/svg+xml'}));
                  const canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;
                  const paint=canvas.getContext('2d');paint.fillStyle='orange';paint.fillRect(0,0,8,8);
                  for(const [mime,extension] of [['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']]) {
                    const blob=await new Promise(resolve=>canvas.toBlob(resolve,mime));
                    if(!blob||blob.type!==mime)throw Error('Browser fixture encoder unavailable: '+mime);
                    await db.addAttachment('work',w.id,new File([blob],'TEST-original.'+extension,{type:mime}));
                  }
                  await db.addAttachment('work',w.id,new File([new Uint8Array(pdfBytes)],'TEST-original.pdf',{type:'application/pdf'}));
                  // An already-pending schema7 row is seeded through the normal bulk API.
                  // This is isolated synthetic setup, not a real history import or reconciliation.
                  const C=await import('./js/core.js'), B=await import('./js/bulk-entry-core.js'), BD=await import('./js/bulk-entry-db.js');
                  const day=C.addDays(C.todayStr(),-30),chat='TEST-schema7-upgrade-chat';
                  await db.metaSet('assistant_conversation_v1',{id:chat,turns:[],rev:1});
                  const draft=await BD.saveBulkDraft({version:1,id:'TEST-schema7-upgrade-batch',chat_id:chat,rev:0,status:'open',created_at:C.nowISO(),
                    rows:[{key:'fuel:0',kind:'fuel',source_key:'TEST-upgrade-pending-fuel',quote:'TEST historical fuel evidence',raw_message:'TEST unchanged historical source',labels:{vehicle_id:v.name},review:[],
                      fields:{date:day,vehicle_id:v.id,liters:11,fuel_source:'Depo Tankı',description:'TEST pending schema7 fuel preserved'}}],
                    answers:{},excluded:[],deselected:[],tank_confirmed:true,
                    historical_fuel:{enabled:true,from:day,to:day,keys:['fuel:0'],approved_at:C.nowISO()}},{create:true});
                  const plan=B.finalizeBulk(draft,await BD.loadBulkData(draft));
                  await BD.commitBulk(draft,B.bulkSelectionToken(plan));
                  await db.draftSave('TEST-upgrade-draft',{description:'TEST saved draft',quantity:2});
                  localStorage.setItem('TEST-upgrade-preserved','same-value');
                  return {c:c.id,v:v.id,w:w.id};
                }""", list(blank_pdf()))
                before = page.evaluate(SNAPSHOT)
                assert len(before['attachments']) == 6
                assert all(row.get('blob_bytes') for row in before['attachments']), 'Every original has actual bytes in the snapshot'
                assert len(before['data']['pending_fuel_records']) == 1
                assert before['data']['pending_fuel_records'][0]['reconciliation_status'] == 'pending'
                schema_before = page.evaluate(SCHEMA_STATE)
                assert schema_before['version'] == 7 and schema_before['denied'] == 'VersionError'
                customer_report = page.evaluate("""async id=>{const db=await import('./js/db.js'),R=await import('./js/customer-report.js');return R.customerReportSpec(R.customerReportData(await db.dumpAll(),id),{audience:'customer'});}""", ids['c'])
                assert before['attachments'][0]['blob_bytes'], 'Attachment bytes must be compared, not a Blob placeholder'
                page.goto(base + 'index.html#/isler/' + ids['w'] + '/edit')
                page.wait_for_selector('#screen[data-view-ready="1"] [name=quantity]')
                page.fill('[name=quantity]', '7')
                page.fill('[name=description]', 'TEST unsaved edit must survive canceled update')
                page.evaluate("window.__upgradeMarker='keep'")
                assert_preserved(before, page.evaluate(SNAPSHOT))

                # boot() does not await registerSW(). A ready view alone does
                # not prove the real app has installed its update listeners.
                try:
                    print('Before upgrade readiness: '+json.dumps(update_state()), flush=True)
                    page.wait_for_function("()=>typeof window.__swCheck==='function'")
                    registration = page.evaluate_handle('async()=>await navigator.serviceWorker.getRegistration()')
                    page.evaluate("""r=>{
                      window.__upgradeEvents=[];
                      r.addEventListener('updatefound',()=>{
                        const w=r.installing;
                        window.__upgradeEvents.push({event:'updatefound',state:w?.state});
                        w?.addEventListener('statechange',()=>window.__upgradeEvents.push({event:'statechange',state:w.state}));
                      });
                    }""", registration)
                    def served_sw_hash():
                        with urlopen(Request(base+'sw.js',headers={'User-Agent':'SOLO-upgrade-diagnostic'})) as response:
                            return {'status':response.status,'sha256':hashlib.sha256(response.read()).hexdigest()}
                    old_served = served_sw_hash()
                    state['root'] = new
                    new_served = served_sw_hash()
                    print('Server deployment hashes: '+json.dumps({'old':old_served,'new':new_served}), flush=True)
                    check_result = page.evaluate('async()=>await window.__swCheck()')
                    print('Real update check result: '+json.dumps(check_result), flush=True)
                    # An async wait_for_function predicate returns a truthy
                    # Promise before its false result can be polled. Use the
                    # real registration handle with a synchronous predicate.
                    page.wait_for_function('r=>!!r.waiting', arg=registration)
                    page.wait_for_selector('#update-bar [data-upd]')
                except Exception:
                    # Observe real state only; preserve the original failure.
                    try:
                        print('Upgrade readiness diagnostic: '+json.dumps({
                            'state':update_state(),'page_errors':errors,
                            'console_warnings':console_warnings,'server_requests':server_requests,
                            'expected_old_sw':hashlib.sha256((old/'sw.js').read_bytes()).hexdigest(),
                            'expected_new_sw':hashlib.sha256((new/'sw.js').read_bytes()).hexdigest()}), flush=True)
                    except Exception as diagnostic_error:
                        print('Diagnostic unavailable: '+str(diagnostic_error), flush=True)
                    raise
                assert page.evaluate("async()=>(await import('./js/core.js')).APP_VERSION") == old_version
                assert page.evaluate("window.__upgradeMarker==='keep'")
                assert page.input_value('[name=quantity]') == '7'
                assert page.input_value('[name=description]') == 'TEST unsaved edit must survive canceled update'
                assert_preserved(before, page.evaluate(SNAPSHOT))
                page.click('#update-bar [data-upd]')
                page.wait_for_selector('.sheet')
                page.click('.sheet [data-x="0"]')
                page.wait_for_selector('.sheet', state='hidden')
                assert page.evaluate("window.__upgradeMarker==='keep'")
                assert page.input_value('[name=quantity]') == '7'
                assert page.input_value('[name=description]') == 'TEST unsaved edit must survive canceled update'
                assert page.evaluate('async()=>!!(await navigator.serviceWorker.getRegistration()).waiting')
                assert_preserved(before, page.evaluate(SNAPSHOT))
                print('PASS real old worker stays active while new release waits; unsaved quantity/description survive update cancel; all records/audit/attachment bytes/drafts unchanged', flush=True)

                # Only an explicit second confirmation may discard the form and
                # activate the new worker. Nothing is saved to the legacy record.
                page.click('#update-bar [data-upd]')
                page.wait_for_selector('.sheet')
                with page.expect_navigation(wait_until='domcontentloaded'):
                    page.click('.sheet [data-x="1"]')
                page.wait_for_selector('#screen[data-view-ready="1"] [name=quantity]')
                assert page.evaluate("window.__upgradeMarker===undefined")
                assert page.evaluate("async()=>(await import('./js/core.js')).APP_VERSION") == new_version
                assert page.input_value('[name=quantity]') == '3'
                assert_preserved(before, page.evaluate(SNAPSHOT), upgraded=True)
                schema = page.evaluate(SCHEMA_STATE)
                assert schema['version'] == 7, 'Installed schema7 stays7; no new migration is allowed'
                assert schema['denied'] == 'VersionError', 'A schema6 writer must still be rejected'
                assert schema['pending'] == schema_before['pending'], 'Pre-existing pending fuel must remain pending and untouched'
                assert schema['recovery'] == schema_before['recovery'], 'No migration/recovery snapshot may be invented or rewritten for a same-schema release'
                print('PASS installed schema7 remains7; original pending fuel unchanged; old schema6 writer still rejected; recovery state identical', flush=True)

                assert page.evaluate("localStorage.getItem('TEST-upgrade-preserved')") == 'same-value'
                caches = page.evaluate('()=>caches.keys()')
                assert new_cache in caches and old_cache not in caches, caches
                for asset in ['js/core.js', 'js/history-core.js', 'js/history-ui.js', 'js/work-entry.js', 'js/hakedis-validation.js', 'js/db.js', 'js/m-finance.js', 'js/m-work.js', 'js/report-core.js', 'js/statement.js', 'js/app.js', 'js/pro.js', 'js/attachment-safety.js', 'js/attachment-ui.js', 'js/work-tonnage.js', 'js/cost-completeness.js']:
                    actual = page.evaluate("""async input=>{
                      const cache=await caches.open(input.cache);
                      const response=await cache.match(new URL(input.asset,location.href).href);
                      if(!response)throw Error('Missing release cache asset: '+input.asset);
                      return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await response.arrayBuffer())))
                        .map(b=>b.toString(16).padStart(2,'0')).join('');
                    }""", {'cache':new_cache,'asset':asset})
                    assert actual == hashlib.sha256((new / asset).read_bytes()).hexdigest(), asset
                print(f'PASS explicit update activates {new_version}; exact release assets cached atomically; legacy descriptions/source/audit/attachment bytes/drafts remain identical', flush=True)

                # The actual customer UI and report projection keep the historical explanation and money.
                page.goto(base + 'index.html#/musteriler/' + ids['c'])
                page.wait_for_selector('#screen[data-view-ready="1"] [data-custdash]')
                report_after = page.evaluate("""async id=>{const db=await import('./js/db.js'),R=await import('./js/customer-report.js');return R.customerReportSpec(R.customerReportData(await db.dumpAll(),id),{audience:'customer'});}""", ids['c'])
                assert report_after == customer_report, 'Customer PDF specification must remain identical for existing normal records'
                assert_preserved(before, page.evaluate(SNAPSHOT), upgraded=True)

                page.goto(base + 'index.html#/isler/' + ids['w'])
                page.wait_for_selector('#screen[data-view-ready="1"] [data-attachment-safety]')
                assert 'TEST original historical description' in page.locator('#screen').inner_text()
                assert page.locator('[data-attachment-safety="safe"]').count() == 4
                assert page.locator('[data-attachment-safety="quarantined"]').count() == 2
                for original in before['attachments']:
                    anchor = page.locator('[data-attachment-id="'+original['id']+'"]')
                    if original['type'] not in ('image/svg+xml','text/plain'):
                        assert anchor.get_attribute('data-attachment-safety') == 'safe'
                        continue
                    assert anchor.get_attribute('target') is None, 'Legacy active/unknown originals must not navigate'
                    assert anchor.get_attribute('download').endswith('.quarantined.bin')
                    assert anchor.locator('img').count() == 0
                    assert anchor.evaluate("async el=>(await fetch(el.href)).headers.get('Content-Type')") == 'application/octet-stream'
                    pages_before = len(context.pages)
                    with page.expect_download() as info:
                        anchor.click()
                    download = info.value
                    assert download.failure() is None
                    assert download.suggested_filename.endswith('.quarantined.bin')
                    assert Path(download.path()).read_bytes() == bytes(original['blob_bytes'])
                    assert len(context.pages) == pages_before, 'Quarantine download must not create an active blob tab'
                assert page.evaluate("localStorage.getItem('TEST-upgrade-svg-executed')") is None
                assert_preserved(before, page.evaluate(SNAPSHOT), upgraded=True)
                print('PASS customer report/source description preserved;4 real raster/PDF originals stay viewable;2 legacy unsafe originals download inert with identical bytes and no active tab', flush=True)

                context.set_offline(True)
                page.goto(base + 'index.html#/gecmis')
                page.wait_for_selector('#screen[data-view-ready="1"] [data-history-file]')
                package = {'format':'SAHAPRO_HISTORY_V1','rows':[{
                    'row_id':'TEST-upgrade-preview','kind':'work','date':'2026-09-02',
                    'customer':'TEST Upgrade Customer','vehicle':'TEST Upgrade Vehicle',
                    'work_type':'Moloz Nakliye','quantity':2,'unit':'Sefer',
                    'unit_price':1000,'kdv_rate':20,'kdv_included':False,
                    'settlement_status':'unbilled_unpaid',
                    'description':'TEST preview work description',
                    'review_notes':'TEST separate review note after actual offline upgrade',
                }]}
                page.set_input_files('[data-history-file]', {
                    'name':'TEST-upgrade.json','mimeType':'application/json',
                    'buffer':json.dumps(package).encode(),
                })
                page.wait_for_selector('[data-h-review-notes]')
                assert page.locator('[data-h-review-notes] .history-source').text_content() == package['rows'][0]['review_notes']
                assert page.input_value('[data-h-row="0"] [data-h-field=description]') == package['rows'][0]['description']
                assert_preserved(before, page.evaluate(SNAPSHOT), upgraded=True)
                assert not errors, errors
                print('PASS same upgraded profile reopens offline with new separate review-note UI; preview writes nothing; no page errors', flush=True)
                browser.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)
    print('upgrade_schema7 browser PASS', flush=True)


if __name__ == '__main__':
    main()

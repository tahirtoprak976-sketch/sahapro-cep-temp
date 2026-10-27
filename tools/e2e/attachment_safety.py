"""RT-01 attachment boundary: real Chromium/IDB, isolated synthetic data only.

The baseline proof executes a harmless, locally fulfilled canary in an uploaded
SVG. It reads only the randomly named TEST database created by this script and
writes a TEST localStorage marker. No network script, app data, or secret is read.
All non-local network requests except that exact synthetic script response are aborted.
Only exact browser-internal PDF viewer resources are additionally allowed.
Run only against a localhost checkout; --baseline-proof is NOT a candidate pass.
"""
import argparse
import hashlib
import json
import os
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("url", nargs="?", default="http://localhost:8841/")
parser.add_argument("--baseline-proof", action="store_true")
parser.add_argument("--artifacts", default="/tmp/solo-attachment-safety")
args = parser.parse_args()
URL = args.url.rstrip("/") + "/"
origin = urlparse(URL)
assert origin.scheme == "http" and origin.hostname in ("localhost", "127.0.0.1", "::1"), "Local synthetic server only"
assert not origin.username and not origin.password and not origin.query and not origin.fragment
ARTIFACT = Path(args.artifacts)
ARTIFACT.mkdir(parents=True, exist_ok=True)
CANARY_DB = "TEST_RT01_" + uuid.uuid4().hex
CANARY_KEY = "TEST_RT01_EXEC_" + uuid.uuid4().hex
CANARY_VALUE = "SYNTHETIC_DATABASE_READ_CONFIRMED"
CANARY_URL = "https://cdn.jsdelivr.net/npm/sahapro-test-canary/rt01-local-only.js"
SVG = ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="24" height="24">'
       '<rect width="24" height="24" fill="orange"/>'
       '<script xlink:href="' + CANARY_URL + '"></script></svg>').encode()
HTML = ('<!doctype html><html><body>TEST ONLY<script src="' + CANARY_URL + '"></script></body></html>').encode()
CANARY_SCRIPT = """(() => {
  localStorage.setItem(%s, 'SCRIPT_EXECUTED');
  const request=indexedDB.open(%s);
  request.onsuccess=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains('marker'))return;
    const read=db.transaction('marker','readonly').objectStore('marker').get('TEST');
    read.onsuccess=()=>{localStorage.setItem(%s,String(read.result));db.close();};
  };
})();""" % (json.dumps(CANARY_KEY), json.dumps(CANARY_DB), json.dumps(CANARY_KEY))


def blank_pdf():
    """Small real one-page PDF, no JavaScript/actions or external dependencies."""
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


PDF = blank_pdf()
XML = b'''<?xml version="1.0" encoding="UTF-8"?><Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:ID>TST2026000000001</cbc:ID><cbc:IssueDate>2026-10-27</cbc:IssueDate><cac:AccountingCustomerParty><cac:Party><cac:PartyName><cbc:Name>TEST Attachment Customer</cbc:Name></cac:PartyName></cac:Party></cac:AccountingCustomerParty><cac:LegalMonetaryTotal><cbc:TaxExclusiveAmount>100.00</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount>100.00</cbc:TaxInclusiveAmount><cbc:PayableAmount>100.00</cbc:PayableAmount></cac:LegalMonetaryTotal></Invoice>'''

SEED = r"""async ({canaryDb,canaryValue}) => {
  const d=await import('./js/db.js'),C=await import('./js/core.js');
  await new Promise((resolve,reject)=>{const q=indexedDB.open(canaryDb,1);
    q.onupgradeneeded=()=>q.result.createObjectStore('marker');q.onerror=()=>reject(q.error);
    q.onsuccess=()=>{const t=q.result.transaction('marker','readwrite');t.objectStore('marker').put(canaryValue,'TEST');
      t.oncomplete=()=>{q.result.close();resolve();};t.onerror=()=>reject(t.error);};});
  const customer=await d.saveNew('customers',{name:'TEST Attachment Customer'},'TEST'),
    vehicle=await d.saveNew('vehicles',{name:'TEST Attachment Truck',type:'Kamyon'},'TEST'),
    work=await d.saveNew('work_records',{date:C.todayStr(),customer_id:customer.id,vehicle_id:vehicle.id,
      work_type:'TEST Hafriyat',quantity:1,unit:'Sefer',description:'TEST unchanged work explanation',
      internal_note:'TEST private source retained',digital_slip_no:'TEST-RT01',
      price_snapshot:{unit_price:100,amount:100,kdv_rate:0,kdv_included:false}},'TEST');
  return {customer:customer.id,vehicle:vehicle.id,work:work.id,date:C.todayStr()};
}"""

FINGERPRINT = r"""async () => {
  const d=await import('./js/db.js');
  const hash=async blob=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const records=async store=>{const out=[];for(const r of await d.getAll(store))out.push(r.blob?{...r,blob:{type:r.blob.type,size:r.blob.size,sha256:await hash(r.blob)}}:r);return out;};
  return JSON.stringify({data:await d.dumpAll(),audit:await d.getAll('audit_log'),attachments:await records('attachments'),drafts:await records('drafts')});
}"""


with sync_playwright() as playwright:
    # The repository's normal launch; do not weaken process security or retry
    # with alternate transports when an executor forbids Chromium's sockets.
    browser = playwright.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])
    errors, canary_requests, blocked_external, results = [], [], [], {}

    def profile():
        context = browser.new_context(viewport={"width": 390, "height": 850}, service_workers="block", accept_downloads=True)
        context.add_init_script("localStorage.setItem('sp_role','boss')")

        def route(request):
            parsed = urlparse(request.request.url)
            if (parsed.scheme, parsed.hostname, parsed.port) == (origin.scheme, origin.hostname, origin.port):
                request.continue_()
            elif (parsed.scheme, parsed.hostname) in {
                # Chromium's built-in PDF viewer and its bundled resources only;
                # never external HTTP(S), arbitrary extensions, or app data.
                ("chrome", "resources"),
                ("chrome-extension", "mhjfbmdgcfjbbpaeojofohoefgiehjai"),
            }:
                request.continue_()
            elif request.request.url == CANARY_URL:
                canary_requests.append(request.request.url)
                request.fulfill(status=200, content_type="application/javascript", body=CANARY_SCRIPT)
            else:
                blocked_external.append(request.request.url)
                request.abort()

        context.route("**/*", route)
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        database = "rt01_" + uuid.uuid4().hex[:24]
        page.goto(URL + "index.html?db=" + database + "#/daha")
        page.wait_for_selector('#screen[data-view-ready="1"]')
        return context, page, database

    def visit(page, database, route):
        # Leave any refreshable view while arranging fixtures to avoid a record
        # update debounce replacing the button being clicked under the test.
        page.goto(URL + "README.md?db=" + database)
        page.goto(URL + "index.html?db=" + database + route)
        page.wait_for_selector('#screen[data-view-ready="1"]')
        assert "Ekran yüklenirken hata" not in page.locator("#screen").inner_text()

    def no_canary(page):
        assert page.evaluate("key=>localStorage.getItem(key)", CANARY_KEY) is None, "Unsafe content executed"
        assert not canary_requests, "Quarantined originals must not request their script"

    def safe_image_sources(page):
        # An <img> rendering context is not an origin boundary: the browser's
        # Open image in new tab action navigates its original URL. Check bytes
        # and canonical MIME, not only whether scripts ran while embedded.
        sources = page.locator('img[src^="blob:"]').evaluate_all(r"""async imgs=>{
          const out=[];for(const img of imgs){const b=await (await fetch(img.src)).blob(),u=new Uint8Array(await b.arrayBuffer());
            const t=u[0]===255&&u[1]===216&&u[2]===255?'image/jpeg':
              [137,80,78,71,13,10,26,10].every((x,i)=>u[i]===x)?'image/png':
              String.fromCharCode(...u.slice(0,4))==='RIFF'&&String.fromCharCode(...u.slice(8,12))==='WEBP'?'image/webp':null;
            out.push({type:b.type,detected:t,alt:img.alt});}return out;
        }""")
        assert all(x["type"] == x["detected"] and x["type"] in ("image/jpeg", "image/png", "image/webp") for x in sources), sources
        no_canary(page)
        return len(sources)

    def quarantine(page, expected, label, allowed=(SVG, HTML)):
        links = page.locator('[data-quarantined-attachment]')
        assert links.count() == expected, {"route": label, "expected": expected, "actual": links.count()}
        details = links.evaluate_all("""els=>els.map(a=>({href:a.href,download:a.getAttribute('download'),target:a.getAttribute('target')}))""")
        assert all(x["download"] and x["download"].endswith(".bin") and x["target"] != "_blank" for x in details), details
        for link in links.all():
            info = link.evaluate("""async a=>{const r=await fetch(a.href),b=await r.blob();return {type:b.type,bytes:Array.from(new Uint8Array(await b.arrayBuffer()))}}""")
            assert info["type"] == "application/octet-stream", info
            assert bytes(info["bytes"]) in allowed, "Quarantine changed original bytes"
        with page.expect_download() as download:
            links.first.click()
        saved = ARTIFACT / (label + "-quarantine.bin")
        download.value.save_as(str(saved))
        assert saved.read_bytes() in allowed, "Downloaded original changed"
        assert download.value.suggested_filename.endswith(".bin")
        safe_image_sources(page)
        results[label] = {"quarantined": expected, "downloaded_original_unchanged": True}
        if label.startswith("legacy-"):
            current = page.evaluate(FINGERPRINT)
            if current != unchanged:
                # Entirely synthetic snapshots: retain exact failure evidence,
                # including drafts/audit, without excluding any compared field.
                (ARTIFACT / (label + "-before.json")).write_text(unchanged)
                (ARTIFACT / (label + "-after.json")).write_text(current)
                before_value, after_value = json.loads(unchanged), json.loads(current)
                changed = [key for key in before_value if before_value[key] != after_value.get(key)]
                print("PRESERVATION MISMATCH", label, "sections:", changed, flush=True)
                for key in changed:
                    if isinstance(before_value[key], dict):
                        print("CHANGED", key, [name for name in before_value[key] if before_value[key][name] != after_value[key].get(name)], flush=True)
            assert current == unchanged, "Exact stored snapshot changed after " + label

    def wait_async_predicate(page, predicate, arg, timeout=30):
        # Playwright 1.62 wait_for_function treats a returned Promise as truthy;
        # page.evaluate awaits it, so explicitly repoll the resolved boolean.
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if page.evaluate(predicate, arg):
                return
            page.wait_for_timeout(50)
        raise AssertionError("Async predicate did not become true before timeout")

    def selection_race(page, database, route, picker, thumbs, buttons, colors):
        visit(page, database, route)
        state = page.evaluate(FINGERPRINT)
        def business(snapshot):
            value = json.loads(snapshot)
            value.pop("drafts", None)  # Ordinary text-form autosave is allowed.
            return value
        page.evaluate("""()=>{window.__rtBitmapReal=createImageBitmap;window.__rtBitmapCalls=0;window.__rtSlowFinished=false;window.__rtBitmapGate=new Promise(r=>window.__rtReleaseBitmap=r);window.createImageBitmap=async(...args)=>{const n=++window.__rtBitmapCalls;if(n===1)await window.__rtBitmapGate;try{return await window.__rtBitmapReal(...args);}finally{if(n===1)window.__rtSlowFinished=true;}};}""")
        try:
            page.locator(picker).set_input_files({"name": "TEST-slow.png", "mimeType": "image/png", "buffer": bytes(colors[0])})
            page.wait_for_function("()=>window.__rtBitmapCalls===1")
            for button in buttons:
                page.locator(button).click()
                page.wait_for_function("()=>/Dosyalar doğrulanıyor/.test(document.querySelector('#toast-root')?.textContent||'')")
            assert business(page.evaluate(FINGERPRINT)) == business(state), "Pending decoder permitted a business write"
            page.locator(picker).set_input_files({"name": "TEST-newer.png", "mimeType": "image/png", "buffer": bytes(colors[1])})
            expected = hashlib.sha256(bytes(colors[1])).hexdigest()
            is_expected = """async ({selector,expected})=>{const img=document.querySelector(selector);if(!img)return false;const b=await(await fetch(img.src)).arrayBuffer();const h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');return h===expected;}"""
            wait_async_predicate(page, is_expected, {"selector": thumbs, "expected": expected})
            page.evaluate("()=>window.__rtReleaseBitmap()")
            page.wait_for_function("()=>window.__rtSlowFinished")
            assert page.evaluate(is_expected, {"selector": thumbs, "expected": expected}), "Older decode overwrote newer file selection"
            page.locator(picker).set_input_files({"name": "TEST-invalid-newer.png", "mimeType": "image/png", "buffer": SVG})
            page.wait_for_function("()=>/JPEG|SVG|HTML/.test(document.querySelector('#toast-root')?.textContent||'')")
            assert page.evaluate(is_expected, {"selector": thumbs, "expected": expected}), "Invalid replacement discarded earlier safe attachment"
            assert safe_image_sources(page) == 1
            results["selection-race-" + picker] = {"pending_actions_blocked": buttons, "newest_wins": True, "invalid_preserves_safe": True}
        finally:
            page.evaluate("()=>{window.__rtReleaseBitmap();window.createImageBitmap=window.__rtBitmapReal;}")

    context, page, database = profile()
    try:
        ids = page.evaluate(SEED, {"canaryDb": CANARY_DB, "canaryValue": CANARY_VALUE})
        visit(page, database, "#/isler/" + ids["work"])
        before = page.evaluate(FINGERPRINT)
        page.locator('[data-watt]').set_input_files({"name": "TEST-canary.svg", "mimeType": "image/svg+xml", "buffer": SVG})
        if args.baseline_proof:
            wait_async_predicate(page, """async id=>(await (await import('./js/db.js')).attachmentsFor('work',id)).length===1""", ids["work"])
            page.wait_for_selector('#screen a[href^="blob:"] img')
            with context.expect_page() as opened:
                page.locator('#screen a[href^="blob:"]').first.click()
            popup = opened.value
            popup.wait_for_load_state()
            page.wait_for_function("([key,value])=>localStorage.getItem(key)===value", arg=[CANARY_KEY, CANARY_VALUE])
            assert canary_requests == [CANARY_URL], canary_requests
            results["baseline_reproduction"] = {"ordinary_upload_accepted": True, "same_origin_canary_script_executed": True,
                "synthetic_idb_marker_read": True, "external_script_downloaded": False}
            popup.close()
            print("BASELINE PROOF ONLY: normal upload and user click reproduced same-origin synthetic IDB access", flush=True)
        else:
            page.wait_for_function("()=>/JPEG|PNG|WebP|PDF|SVG|HTML/.test(document.querySelector('#toast-root')?.textContent||'')")
            assert page.evaluate(FINGERPRINT) == before, "Rejected upload must not change record, audit or attachment data"
            no_canary(page)
            results["normal_upload_rejected"] = True
            print("PASS normal work UI rejects synthetic SVG visibly before any stored change", flush=True)

            visit(page, database, "#/akilli-asistan")
            preview_before = page.evaluate(FINGERPRINT)
            page.locator('[data-photos]').set_input_files({"name": "TEST-preview.png", "mimeType": "image/png", "buffer": SVG})
            page.wait_for_function("()=>/JPEG|PNG|WebP|PDF|SVG|HTML/.test(document.querySelector('#toast-root')?.textContent||'')")
            assert safe_image_sources(page) == 0
            assert page.evaluate(FINGERPRINT) == preview_before
            results["assistant_presave_preview_rejected"] = True

            driver_context, driver_page, driver_db = profile()
            driver_page.evaluate("""()=>{localStorage.setItem('sp_driver','1');localStorage.setItem('sp_role','driver');localStorage.setItem('sp_driver_cfg',JSON.stringify({v:1,p:['TEST-driver','TEST Driver'],veh:'TEST-truck',V:[['TEST-truck','TEST Truck']],C:[['TEST-customer','TEST Customer']],S:[],D:[],E:[],Q:[]}));}""")
            visit(driver_page, driver_db, "#/sofor")
            driver_page.wait_for_selector('[data-photo]')
            driver_before = driver_page.evaluate("()=>localStorage.getItem('sp_driver_entries')")
            driver_page.locator('[data-photo]').set_input_files({"name": "TEST-driver-preview.svg", "mimeType": "image/svg+xml", "buffer": SVG})
            driver_page.wait_for_function("()=>/JPEG|PNG|WebP|PDF|SVG|HTML/.test(document.querySelector('#toast-root')?.textContent||'')")
            assert safe_image_sources(driver_page) == 0
            assert driver_page.evaluate("()=>localStorage.getItem('sp_driver_entries')") == driver_before
            assert driver_page.evaluate("()=>Number(JSON.parse(localStorage.getItem('sp_driver_draft')||'{}').ph||0)") == 0
            assert driver_page.evaluate("async()=>(await(await caches.open('sahapro-driver')).keys()).length") == 0
            driver_page.evaluate("""async svg=>{const c=await caches.open('sahapro-driver');await c.put('./__drv/TEST-legacy-draft-0',new Response(new Uint8Array(svg),{headers:{'content-type':'image/svg+xml','x-name':'TEST-legacy-draft.svg'}}));localStorage.setItem('sp_driver_draft',JSON.stringify({at:Date.now(),tab:'is',photoId:'TEST-legacy-draft',ph:1,st:{vid:'TEST-truck',cid:'TEST-customer',wt:'Hafriyat Nakliye',q:1,u:'Sefer',note:'TEST preserved legacy text',f:{}}}));}""", list(SVG))
            visit(driver_page, driver_db, "#/sofor")
            driver_page.wait_for_selector('[data-download-quarantined]')
            assert safe_image_sources(driver_page) == 0
            assert driver_page.locator('[data-forgetmissing]').count() == 0
            with driver_page.expect_download() as legacy_download:
                driver_page.locator('[data-download-quarantined]').click()
            legacy_download.value.save_as(str(ARTIFACT / 'driver-legacy-draft.bin'))
            assert (ARTIFACT / 'driver-legacy-draft.bin').read_bytes() == SVG
            assert legacy_download.value.suggested_filename.endswith('.bin')
            driver_page.fill('[data-k=note]', 'TEST amended text; original photo preserved')
            driver_page.wait_for_function("()=>JSON.parse(localStorage.getItem('sp_driver_draft')||'{}').st?.note==='TEST amended text; original photo preserved'")
            retained = driver_page.evaluate("""async()=>{const c=await caches.open('sahapro-driver'),r=await c.match('./__drv/TEST-legacy-draft-0');return {draft:JSON.parse(localStorage.getItem('sp_driver_draft')),bytes:r?Array.from(new Uint8Array(await r.arrayBuffer())):null,entries:localStorage.getItem('sp_driver_entries')};}""")
            assert retained['draft']['photoId'] == 'TEST-legacy-draft' and retained['draft']['ph'] == 1
            assert bytes(retained['bytes']) == SVG and retained['entries'] == driver_before
            no_canary(driver_page)
            assert retained['draft'].get('missing', 0) == 0, "Quarantined present bytes are not missing files"
            visit(driver_page, driver_db, "#/sofor")
            driver_page.wait_for_selector('[data-download-quarantined]')
            driver_page.locator('[data-k=note]').fill('TEST repeated edit; no missing-count inflation')
            driver_page.wait_for_function("()=>JSON.parse(localStorage.getItem('sp_driver_draft')||'{}').st?.note==='TEST repeated edit; no missing-count inflation'")
            assert driver_page.evaluate("()=>Number(JSON.parse(localStorage.getItem('sp_driver_draft')||'{}').missing||0)") == 0
            driver_context.close()
            results['legacy_driver_draft'] = {"no_raw_preview": True, "original_downloaded": True, "text_edit_retains_photo_identity_and_bytes": True}
            results["driver_presave_preview_rejected"] = True
            print("PASS assistant and driver pre-save photo selection rejects SVG/MIME spoof; no raw image URL, saved row or cached unsafe photo", flush=True)

            colors = page.evaluate("""async()=>{const out=[];for(const color of ['#aa1122','#1155bb']){const c=document.createElement('canvas');c.width=24;c.height=24;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,24,24);const b=await new Promise(r=>c.toBlob(r,'image/png'));out.push(Array.from(new Uint8Array(await b.arrayBuffer())));}return out;}""")
            selection_race(page, database, "#/akilli-asistan", '[data-photos]', '[data-thumbs] img', ['[data-ask]', '[data-part-document]'], colors)
            page.locator('[data-photos]').set_input_files({"name": "TEST-pretend-audio.mp3", "mimeType": "audio/mpeg", "buffer": SVG})
            page.wait_for_function("()=>/Ses dosyasının içeriği doğrulanamadı/.test(document.querySelector('#toast-root')?.textContent||'')")
            assert page.locator('[data-thumbs] audio').count() == 0
            assert safe_image_sources(page) == 1
            selection_race(page, database, "#/isler/new", '[data-wfiles]', '[data-wthumbs] img', ['[data-save]', '[data-wai]'], colors)
            # Incoming share-target cache remains recoverable on validation
            # failure, rather than deleted or rendered before verification.
            page.evaluate("""async svg=>{const c=await caches.open('sahapro-share');await c.put('./__share/file-0',new Response(new Uint8Array(svg),{headers:{'content-type':'image/svg+xml','x-name':'TEST-shared.svg'}}));}""", list(SVG))
            visit(page, database, "#/akilli-asistan?shared=1")
            assert safe_image_sources(page) == 0
            assert page.locator('[data-thumbs] audio').count() == 0
            shared = page.evaluate("""async()=>{const c=await caches.open('sahapro-share'),r=await c.match('./__share/file-0');return r?Array.from(new Uint8Array(await r.arrayBuffer())):null;}""")
            assert bytes(shared) == SVG, "Rejected share-target original was deleted or rewritten"
            page.evaluate("()=>caches.delete('sahapro-share')")
            results["spoofed_audio_and_shared_cache"] = {"audio_rejected": True, "original_share_preserved": True, "no_unvalidated_preview": True}
            print("PASS slow/newer/invalid selection races; pending Save/Read blocked; spoofed audio rejected; invalid shared original retained", flush=True)

            # Exercise every public ingestion API with the same spoofed bytes.
            # Snapshot assertions ensure an error did not occur only AFTER writing.
            api = page.evaluate(r"""async ({ids,svg})=>{
              const d=await import('./js/db.js'),P=await import('./js/parts-db.js'),B=await import('./js/driver-bundle.js'),C=await import('./js/core.js');
              const bad=new File([new Uint8Array(svg)],'TEST-spoof.png',{type:'image/png'}),out={};
              const snap=async()=>JSON.stringify({d:await d.dumpAll(),a:await d.getAll('attachments'),audit:await d.getAll('audit_log'),drafts:await d.getAll('drafts')});
              const check=async(name,fn)=>{const before=await snap();let rejected=false,error='';try{await fn();}catch(e){rejected=true;error=e.message;}out[name]={rejected,error,unchanged:before===await snap()};};
              await check('addAttachment',()=>d.addAttachment('work',ids.work,bad));
              for(const [name,type,bytes] of [['TEST-html.png','image/png',new TextEncoder().encode('<!doctype html><script>TEST</script>')],['TEST-prefix.pdf','application/pdf',new TextEncoder().encode('%PDF-1.7\n<script>TEST</script>')],['TEST-prefix.jpg','image/jpeg',new Uint8Array([255,216,255,60,115,118,103,62])]])
                await check('spoof-'+name,()=>d.addAttachment('work',ids.work,new File([bytes],name,{type})));
              await check('saveDocument',()=>d.saveDocument({category:'Sözleşme',owner_type:'customer',owner_id:ids.customer,customer_id:ids.customer,date:ids.date,title:'TEST unsafe document'},bad));
              await check('preparePartFiles',()=>P.preparePartFiles([bad]));
              const framed=new Uint8Array(45);framed.set([137,80,78,71,13,10,26,10]);framed.set(new TextEncoder().encode('IHDR'),12);framed.set(new TextEncoder().encode('IEND'),37);
              const realDecoder=createImageBitmap;let decodeCalls=0;globalThis.createImageBitmap=(...args)=>{decodeCalls++;return realDecoder(...args);};
              try{await check('framed-invalid-PNG-decoder',()=>d.addAttachment('work',ids.work,new File([framed],'TEST-framed-invalid.png',{type:'image/png'})));}finally{globalThis.createImageBitmap=realDecoder;}
              out['framed-invalid-PNG-decoder'].decoderCalled=decodeCalls>0;
              const h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await bad.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
              await check('storePdfHistoryFile',()=>d.storePdfHistoryFile(h,new File([bad],'TEST-spoof.pdf',{type:'application/pdf'})));
              const packet={text:'TEST only\nSP1:AAAAAAAAAAAA.BBBBBBBBBBBB',rows:[{id:'TEST-packet'}],files:[bad]};
              await check('makeDriverBundle',()=>B.makeDriverBundle(packet));
              const raw=[{name:'index.json',data:new TextEncoder().encode(JSON.stringify({kind:'SAHAPRO_DRIVER_BUNDLE',version:1,photos:[{path:'photos/00-TEST.png',name:'TEST.png',type:'image/png',size:bad.size}]}))},
                {name:'transfer.sahapro.txt',data:new TextEncoder().encode('SAHAPRO_DRIVER_TRANSFER_V1\nTEST only\nSP1:AAAAAAAAAAAA.BBBBBBBBBBBB')},
                {name:'photos/00-TEST.png',data:new Uint8Array(await bad.arrayBuffer())}];
              await check('openDriverBundle',()=>B.openDriverBundle(new File([C.buildZip(raw)],'TEST.sahapro.zip',{type:'application/zip'})));
              // These synthetic objects are never included in backup fixtures.
              await d.put('contracts',{id:'TEST-unsafe-contract',status:'Taslak'});
              await check('signContract',()=>d.signContract('TEST-unsafe-contract',[bad,bad]));
              await d.put('slips',{id:'TEST-unsafe-slip',status:'Taslak'});
              await check('signSlip',()=>d.signSlip('TEST-unsafe-slip',bad));
              const connection=await d.openDB();await new Promise((resolve,reject)=>{const t=connection.transaction(['contracts','slips'],'readwrite');t.objectStore('contracts').delete('TEST-unsafe-contract');t.objectStore('slips').delete('TEST-unsafe-slip');t.oncomplete=resolve;t.onerror=()=>reject(t.error);});
              return out;
            }""", {"ids": ids, "svg": list(SVG)})
            assert all(row["rejected"] and row["unchanged"] for row in api.values()), api
            assert api["framed-invalid-PNG-decoder"]["decoderCalled"], api
            results["ingestion_apis"] = api
            no_canary(page)
            print("PASS byte-spoof rejection at attachment/document/part/driver/PDF-draft/signature APIs, before writes", flush=True)

            # Small actual canvas images avoid resizing and make original-byte
            # preservation exact. A falsely declared SVG MIME is normalized from
            # the valid PNG bytes; the inverse spoof above is rejected.
            good = page.evaluate(r"""async ({ids,pdf})=>{
              const d=await import('./js/db.js'),B=await import('./js/driver-bundle.js'),out=[];
              const hash=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await b.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
              const canvas=document.createElement('canvas');canvas.width=24;canvas.height=24;const g=canvas.getContext('2d');g.fillStyle='#176182';g.fillRect(0,0,24,24);
              const files=[];for(const type of ['image/jpeg','image/png','image/webp']){const blob=await new Promise(r=>canvas.toBlob(r,type));if(blob.type!==type)throw Error('Browser does not encode '+type);files.push(new File([blob],'TEST-'+type.split('/')[1],{type}));}
              files.push(new File([new Uint8Array(pdf)],'TEST-original.pdf',{type:'application/pdf'}));
              files.push(new File([files[1]],'TEST-mislabeled.svg',{type:'image/svg+xml'}));
              for(const file of files){const a=await d.addAttachment('work',ids.work,file,{kind:file.name});out.push({id:a.id,name:file.name,input:await hash(file),stored:await hash(a.blob),type:a.type});}
              const packet={text:'TEST only\nSP1:AAAAAAAAAAAA.BBBBBBBBBBBB',rows:[{id:'TEST-good-packet'}],files:files.slice(0,3)};
              const bundle=await B.makeDriverBundle(packet),opened=await B.openDriverBundle(bundle.files[0]);
              return {files:out,driver:await Promise.all(opened.files.map(async(f,i)=>({type:f.type,input:await hash(files[i]),output:await hash(f)})))};
            }""", {"ids": ids, "pdf": list(PDF)})
            assert len(good["files"]) == 5 and all(x["input"] == x["stored"] for x in good["files"]), good
            assert [x["type"] for x in good["files"]] == ["image/jpeg", "image/png", "image/webp", "application/pdf", "image/png"], good
            assert len(good["driver"]) == 3 and all(x["input"] == x["output"] for x in good["driver"]), good
            visit(page, database, "#/isler/" + ids["work"])
            safe = page.locator('[data-safe-attachment]')
            assert safe.count() == 5, safe.count()
            for link in safe.all():
                mime = link.evaluate("async a=>(await (await fetch(a.href)).blob()).type")
                assert mime in ("image/jpeg", "image/png", "image/webp", "application/pdf"), mime
            assert safe_image_sources(page) == 4
            # A real ordinary image user-click still opens a decodable image.
            with context.expect_page() as opened:
                page.locator('[data-safe-attachment]').filter(has=page.locator('img')).first.click()
            opened.value.wait_for_load_state()
            assert opened.value.locator('img').evaluate('(img)=>img.complete&&img.naturalWidth===24')
            opened.value.close()
            pdf_link = page.locator('[data-safe-attachment]').filter(has_text='TEST-original.pdf')
            with context.expect_page() as opened_pdf:
                pdf_link.click()
            opened_pdf.value.wait_for_load_state('domcontentloaded')
            assert opened_pdf.value.url.startswith('blob:'), opened_pdf.value.url
            # Chromium's native PDF extension is outside the app DOM. The
            # actual user-click popup URL and source MIME/bytes are inspected.
            pdf_source = pdf_link.evaluate("async a=>Array.from(new Uint8Array(await(await fetch(a.href)).arrayBuffer()))")
            assert bytes(pdf_source) == PDF
            opened_pdf.value.close()
            no_canary(page)
            results["real_pdf_click"] = True
            results["valid_files"] = good
            print("PASS real JPEG/PNG/WebP/PDF bytes and normal image open; valid mislabeled PNG normalized; driver raster round-trip", flush=True)

            invoices = page.evaluate(r"""async ({ids,xml,svg})=>{
              const d=await import('./js/db.js'),C=await import('./js/core.js');
              const xmlFile=new File([new Uint8Array(xml)],'TEST-invoice.xml',{type:'application/xml'}),zipFile=new File([C.buildZip([{name:'TEST-invoice.xml',data:new Uint8Array(xml)}])],'TEST-invoice.zip',{type:'application/zip'});
              const fields=i=>({category:'Fatura',owner_type:'customer',owner_id:ids.customer,customer_id:ids.customer,date:ids.date,title:'TEST Invoice Original '+i,doc_no:'TEST-RT01-'+i});
              const snap=async()=>JSON.stringify({d:await d.dumpAll(),a:await d.getAll('attachments'),audit:await d.getAll('audit_log')});
              const out={aborts:[],saved:[],rejected:[]};
              for(const [i,file]of [xmlFile,zipFile].entries()){
                const before=await snap(),put=IDBObjectStore.prototype.put;let hit=false,error='';
                IDBObjectStore.prototype.put=function(row,...rest){const req=put.call(this,row,...rest);if(this.name==='attachments'&&!hit){hit=true;this.add(row);}return req;};
                try{await d.saveInvoiceSourceDocument(fields('abort-'+i),file);}catch(e){error=e.message;}finally{IDBObjectStore.prototype.put=put;}
                out.aborts.push({hit,error,unchanged:before===await snap()});
                const rec=await d.saveInvoiceSourceDocument(fields('good-'+i),file),atts=await d.attachmentsFor('document',rec.id);
                out.saved.push({id:rec.id,name:file.name,bytes:Array.from(new Uint8Array(await file.arrayBuffer())),stored:Array.from(new Uint8Array(await atts[0].blob.arrayBuffer()))});
              }
              for(const [f,file]of [[{...fields('wrong-category'),category:'Sözleşme'},xmlFile],[fields('svg'),new File([new Uint8Array(svg)],'TEST-fake.xml',{type:'application/xml'})]]){const before=await snap();let error='';try{await d.saveInvoiceSourceDocument(f,file);}catch(e){error=e.message;}out.rejected.push({error,unchanged:before===await snap()});}
              return out;
            }""", {"ids": ids, "xml": list(XML), "svg": list(SVG)})
            assert all(x['hit'] and x['error'] and x['unchanged'] for x in invoices['aborts']), invoices
            assert all(x['error'] and x['unchanged'] for x in invoices['rejected']), invoices
            assert all(x['bytes'] == x['stored'] for x in invoices['saved']), invoices
            for invoice in invoices['saved']:
                visit(page, database, '#/belgeler/' + invoice['id'])
                quarantine(page, 1, 'invoice-' + invoice['name'].rsplit('.', 1)[-1], allowed=(bytes(invoice['bytes']),))
            results['invoice_originals'] = {"atomic_failures": invoices['aborts'], "safe_archives": 2, "bytes_preserved": True}
            print('PASS parsed XML/ZIP invoice originals archive atomically, retain exact bytes, and only download inertly', flush=True)

            legacy = page.evaluate(r"""async ({ids,svg,html})=>{
              const d=await import('./js/db.js'),C=await import('./js/core.js'),P=await import('./js/parts-db.js'),E=await import('./js/enterprise-db.js'),D=await import('./js/dump-ledger-db.js');
              const doc=await d.saveNew('documents',{category:'Sözleşme',owner_type:'customer',owner_id:ids.customer,customer_id:ids.customer,date:ids.date,title:'TEST legacy original'},'TEST'),
                tank=await d.saveNew('fuel_tank_movements',{date:ids.date,move_type:'GİRİŞ',liters:10,total:500},'TEST'),
                part=await P.saveSparePart({vehicle_id:ids.vehicle,date:ids.date,description:'TEST legacy warranty',quantity:1,unit_price:null,cost_mode:'tracking'},[],'TEST legacy part');
              const expense=await d.saveNew('expense_records',{date:ids.date,vehicle_id:ids.vehicle,category:'Diğer',amount:100,description:'TEST legacy expense'},'TEST');
              const supplier=await E.saveSupplier({name:'TEST Legacy Supplier',type:'Servis'},'TEST legacy supplier');
              const payable=await E.savePayable({date:ids.date,due_date:ids.date,party_type:'supplier',party_id:supplier.id,document_no:'TEST-LEGACY-RT01',bill_kind:'Alış',cost_category:'Diğer',description:'TEST legacy payable',items:[{description:'TEST original',quantity:1,unit_price:100,kdv_rate:0,kdv_included:false}]},'TEST legacy payable');
              const site=await d.saveNew('dump_sites',{name:'TEST Legacy Dump Site',fee:100,fee_unit:'Ton'},'TEST');
              const dump=await D.saveDumpEntry({kind:'TOPUP',date:ids.date,dump_site_id:site.id,amount:100,payment_method:'Havale',reference:'TEST RT01 legacy'},[],'TEST RT01 legacy');
              const add=async(record_type,record_id,name,type,bytes,kind='legacy_original')=>{const blob=new Blob([new Uint8Array(bytes)],{type});const a={id:C.uuid(),record_type,record_id,name,type,size:blob.size,blob,kind,created_at:new Date().toISOString()};await d.put('attachments',a);return a.id;};
              const names=[['TEST-legacy.svg','image/svg+xml',svg],['TEST-spoof.jpg','image/jpeg',svg],['TEST-original.html','text/html',html],['Is_Fisi_TEST-RT01.pdf','application/pdf',svg]];
              for(const [name,type,bytes]of names)await add('work',ids.work,name,type,bytes);
              await add('document',doc.id,'TEST-legacy-document.svg','image/svg+xml',svg);
              await add('tank',tank.id,'TEST-legacy-invoice.pdf','application/pdf',svg);
              await add('maintenance_parts',part.id,'TEST-legacy-warranty.svg','image/svg+xml',svg);
              await add('expense',expense.id,'TEST-legacy-expense.svg','image/svg+xml',svg);
              await add('payable',payable.id,'TEST-legacy-payable.svg','image/svg+xml',svg);
              await add('dump_entries',dump.id,'TEST-legacy-dump.svg','image/svg+xml',svg);
              const slip=await d.saveWorkSlip({date:ids.date,customer_id:ids.customer,vehicle_id:ids.vehicle,work_text:'TEST Hafriyat',unit:'Sefer',quantity:1,slip_no:700001,status:'Taslak'},[ids.work]);
              await add('slip_signature',slip.id,'TEST-legacy-signature.png','image/png',svg,'signature');
              const person=await d.saveNew('personnel',{name:'TEST Legacy Signature Person'},'TEST');
              const leave=await d.saveNew('documents',{category:'İzin Formu',owner_type:'personnel',owner_id:person.id,personnel_id:person.id,date:ids.date,doc_no:'TEST-LEAVE-RT01',status:'Onay bekliyor',leave:{kind:'Ücretsiz izin',from:ids.date,to:ids.date,days:1}},'TEST');
              await add('leave_signature',leave.id,'TEST-employee.svg','image/svg+xml',svg,'employee');await add('leave_signature',leave.id,'TEST-approver.svg','image/svg+xml',svg,'approver');
              return {doc:doc.id,tank:tank.id,part:part.id,expense:expense.id,supplier:supplier.id,payable:payable.id,dump:dump.id,slip:slip.id,leave:leave.id};
            }""", {"ids": ids, "svg": list(SVG), "html": list(HTML)})
            unchanged = page.evaluate(FINGERPRINT)
            visit(page, database, "#/isler/" + ids["work"])
            quarantine(page, 5, "legacy-work-driver-original")  # Four originals; driver PDF also has its dedicated link.
            visit(page, database, "#/belgeler/" + legacy["doc"])
            quarantine(page, 1, "legacy-document")
            # The older CRM reader remains callable even though pro.screen
            # normally handles this route first; it must not keep a bypass.
            page.evaluate("""async id=>{const db=await import('./js/db.js'),m=await import('./js/m-crm.js'),d=await db.dumpAll();const names=Object.fromEntries(['customers','vehicles','personnel','sites'].map(k=>[k,Object.fromEntries((d[k]||[]).map(r=>[r.id,r.name]))]));await m.screen({root:document.querySelector('#screen'),db,names,parts:['belgeler',id],query:{},reload:()=>{}});}""", legacy["doc"])
            quarantine(page, 1, "legacy-crm-reader")
            visit(page, database, "#/depo")
            page.locator('[data-tk="' + legacy["tank"] + '"]').click()
            page.wait_for_selector('[data-quarantined-attachment]')
            quarantine(page, 1, "legacy-tank")
            visit(page, database, "#/yedek-parca/" + legacy["part"])
            quarantine(page, 1, "legacy-part")
            visit(page, database, "#/gider?p=all")
            page.locator('[data-rid="' + legacy["expense"] + '"]').click()
            page.wait_for_selector('[data-quarantined-attachment]')
            quarantine(page, 1, "legacy-expense")
            visit(page, database, "#/esnaf/" + legacy["supplier"])
            page.locator('[data-rid="' + legacy["payable"] + '"]').click()
            page.wait_for_selector('[data-quarantined-attachment]')
            quarantine(page, 1, "legacy-payable")
            visit(page, database, "#/dokum-hareket/" + legacy["dump"])
            quarantine(page, 1, "legacy-dump-proof")
            visit(page, database, "#/fisler/" + legacy["slip"])
            quarantine(page, 1, "legacy-slip-signature")
            visit(page, database, "#/izinler/form/" + legacy["leave"])
            quarantine(page, 2, "legacy-leave-signatures")
            assert page.evaluate(FINGERPRINT) == unchanged, "Opening/downloading legacy originals must not rewrite any record or attachment"
            print("PASS legacy work/driver-original/document/CRM/tank/part/expense/payable/dump originals quarantined, downloaded exactly, never executed or rewritten", flush=True)

            backup = page.evaluate("async()=>{const d=await import('./js/db.js');return (await import('./js/backup.js')).fullBackup(d,{encrypted:false,attachments:'base64'});}")
            assert len(backup["attachments"]) == 20, len(backup["attachments"])
            originals = {x["id"]: (x["name"], x["type"], x["size"], x["base64"]) for x in backup["attachments"]}
            clean, restored_page, restored_db = profile()
            restored = restored_page.evaluate("""async backup=>{const d=await import('./js/db.js'),B=await import('./js/backup.js');await B.restoreBackup(d,backup);return B.fullBackup(d,{encrypted:false,attachments:'base64'});}""", backup)
            assert {x["id"]: (x["name"], x["type"], x["size"], x["base64"]) for x in restored["attachments"]} == originals, "Backup/restore changed original files or metadata"
            assert restored["data"]["work_records"] == backup["data"]["work_records"], "Work explanations/history changed"
            assert restored["schema_version"] == 7
            visit(restored_page, restored_db, "#/isler/" + ids["work"])
            quarantine(restored_page, 5, "restored-work-driver-original")
            assert restored_page.locator('[data-safe-attachment]').count() == 5
            no_canary(restored_page)
            for invoice in invoices['saved']:
                visit(restored_page, restored_db, '#/belgeler/' + invoice['id'])
                quarantine(restored_page, 1, 'restored-invoice-' + invoice['name'].rsplit('.', 1)[-1], allowed=(bytes(invoice['bytes']),))
            results["backup_restore"] = {"files": 20, "original_bytes_and_metadata_preserved": True, "work_history_preserved": True, "schema": 7}
            clean.close()
            print("PASS fresh-profile schema-7 backup restore retains all 20 safe/unsafe original bytes, metadata and work explanations", flush=True)
            assert not errors, errors
        assert not blocked_external, blocked_external
        (ARTIFACT / ("baseline-proof.json" if args.baseline_proof else "candidate.json")).write_text(json.dumps(results, ensure_ascii=False, indent=2))
    except Exception:
        try:
            (ARTIFACT / "failure.json").write_text(json.dumps({"url": page.url, "screen": page.locator('body').inner_text(),
                "page_errors": errors, "canary_requests": canary_requests, "blocked_external": blocked_external}, ensure_ascii=False, indent=2))
            page.screenshot(path=str(ARTIFACT / "failure.png"), full_page=True)
        except Exception:
            pass
        raise
    finally:
        browser.close()

print("attachment_safety " + ("BASELINE PROOF (not candidate pass)" if args.baseline_proof else "browser PASS"), flush=True)

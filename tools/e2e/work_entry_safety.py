"""Work-entry draft and site safety with real Chromium and isolated IndexedDB.

Only synthetic cards, drafts and legacy records are used. No external AI calls,
real business data or browser API substitutes. The first collision assertion also
serves as the failing-before regression against the unchanged v3.9.70 tree.
"""
import argparse
import sys
from pathlib import Path
from urllib.parse import urlencode

from playwright.sync_api import sync_playwright


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('url', nargs='?', default='http://localhost:8841/')
parser.add_argument('--baseline-proof', action='store_true',
                    help='Prove the exact unchanged v3.9.70 draft-overwrite defect; never a candidate pass')
args = parser.parse_args()
URL = args.url.rstrip('/') + '/'
FORM = '#screen[data-view-ready="1"] [data-form]'
ARTIFACT = Path('/tmp/solo-work-entry')
ARTIFACT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 390, 'height': 850})
    context.add_init_script("localStorage.setItem('sp_role','boss')")
    page = context.new_page()
    errors, external_calls = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    context.route('https://generativelanguage.googleapis.com/**',
                  lambda route: (external_calls.append(route.request.url), route.abort()))
    page.goto(URL + 'index.html#/daha')
    page.wait_for_selector('#screen[data-view-ready="1"]')
    page.evaluate('async()=>await navigator.serviceWorker.ready')

    def visit(route, ready=True):
        """Wait for the new screen, never accept the old ready marker."""
        target = '#/' + route
        if page.evaluate('location.hash') == target:
            page.reload()
        else:
            previous = page.query_selector('#screen')
            page.evaluate('hash=>{location.hash=hash}', target)
            page.wait_for_function('old=>!old.isConnected', arg=previous)
        if ready:
            page.wait_for_selector('#screen[data-view-ready="1"]')

    def form_ready():
        page.wait_for_selector(FORM)
        assert 'Ekran yüklenirken hata' not in page.locator('#screen').inner_text()

    def business_snapshot():
        return page.evaluate("""async()=>{
          const db=await import('./js/db.js');
          const snapshot=await db.readSnapshot({attachments:true,meta:false,drafts:false});
          delete snapshot.captured_at;
          for(const attachment of snapshot.attachments){
            if(attachment.blob){
              attachment.bytes=Array.from(new Uint8Array(await attachment.blob.arrayBuffer()));
              delete attachment.blob;
            }
          }
          return snapshot;
        }""")

    def draft():
        return page.evaluate("async()=>(await import('./js/db.js')).draftGet('work')")

    def set_draft(values):
        page.evaluate("async value=>(await import('./js/db.js')).draftSave('work',value)", values)

    def clear_draft():
        page.evaluate("async()=>(await import('./js/db.js')).draftClear('work')")

    def wait_draft(values):
        # Playwright async wait predicates resolve once rather than reliably poll.
        # Expose each real DB read to a synchronous predicate instead.
        page.evaluate("""expected=>{
          window.__draftMatched=false;
          const until=Date.now()+10000;
          (async function poll(){
            const value=await (await import('./js/db.js')).draftGet('work');
            window.__draftMatched=!!value&&Object.entries(expected).every(([key,v])=>value[key]===v);
            if(!window.__draftMatched&&Date.now()<until)setTimeout(poll,25);
          })();
        }""", values)
        page.wait_for_function('()=>window.__draftMatched===true')

    def option_values():
        return page.locator('[name=site_id] option').evaluate_all(
            'options=>options.filter(o=>!o.disabled).map(o=>o.value)')

    def choose_dialog(accept):
        page.wait_for_selector('.sheet')
        page.click('.sheet [data-x="' + ('1' if accept else '0') + '"]')
        page.wait_for_selector('.sheet', state='hidden')

    ids = page.evaluate("""async()=>{
      const db=await import('./js/db.js');
      const a=await db.saveNew('customers',{name:'TEST Entry Customer A'},'TEST');
      const b=await db.saveNew('customers',{name:'TEST Entry Customer B'},'TEST');
      const sa=await db.saveNew('sites',{name:'TEST Entry Site A',customer_id:a.id,active:true,deal:{status:'Açık',basis:'Götürü',price:1000,kdv_rate:20}},'TEST');
      const sb=await db.saveNew('sites',{name:'TEST Entry Site B',customer_id:b.id,active:true},'TEST');
      const orphan=await db.saveNew('sites',{name:'TEST Entry Orphan Site',active:true},'TEST');
      const v=await db.saveNew('vehicles',{name:'TEST Entry Vehicle',active:true},'TEST');
      const other=await db.saveNew('vehicles',{name:'TEST Entry Other Vehicle',active:true},'TEST');
      const legacy=await db.saveNew('work_records',{
        date:'2026-10-20',customer_id:a.id,site_id:sa.id,vehicle_id:v.id,
        work_type:'Moloz Nakliye',unit:'Sefer',quantity:3,
        description:'TEST legacy work description stays verbatim',
        internal_note:'TEST legacy private note stays verbatim',
        customer_note:'TEST legacy customer report note',
        price_snapshot:{amount:300,unit_price:100,kdv_rate:20,kdv_included:false,price_source:'Manuel'}
      },'TEST');
      await db.addAttachment('work',legacy.id,
        new File(['TEST preserved attachment bytes'],'TEST-entry.txt',{type:'text/plain'}));
      // Reproduce a pre-existing inconsistent relation, not a permitted new save.
      await db.put('work_records',{...legacy,site_id:sb.id});
      return {a:a.id,b:b.id,sa:sa.id,sb:sb.id,orphan:orphan.id,
              vehicle:v.id,otherVehicle:other.id,legacy:legacy.id};
    }""")
    # Fixture notifications finish on a route that cannot refresh the form.
    page.wait_for_timeout(200)
    original_business = business_snapshot()
    original_draft = {
        'date': '2026-10-21', 'customer_id': ids['a'], 'site_id': ids['sa'],
        'vehicle_id': ids['vehicle'], 'work_type': 'Moloz Nakliye', 'unit': 'Sefer',
        'quantity': '9', 'description': 'TEST valuable unfinished work',
        'internal_note': 'TEST unfinished private note', 'manual_price': '125',
        'manual_kdv': '20', 'job_scope': 'ekstra',
    }
    set_draft(original_draft)

    if args.baseline_proof:
        # This is a positive reproduction on the exact deployed old version,
        # not a caught timeout or an allowed failure in candidate verification.
        assert page.evaluate("async()=>(await import('./js/core.js')).APP_VERSION") == 'SAHAPRO SOLO v3.9.70'
        visit('isler/new?customer_id=' + ids['b'])
        form_ready()
        assert page.locator('[data-work-entry-conflict],.sheet').count() == 0
        assert page.input_value('[name=customer_id]') == ids['b']
        assert page.input_value('[name=quantity]') == ''
        assert page.input_value('[name=description]') == ''
        assert 'Yarım kalan iş taslağı yüklendi.' in page.locator('#screen').inner_text()
        # Existing pro.augment already filters the final DOM; the old defect
        # proved here is draft replacement, not visible incompatible site choices.
        assert ids['sb'] in option_values()
        assert not {ids['sa'], ids['orphan']}.intersection(option_values())
        assert draft() == original_draft
        page.fill('[name=description]', 'TEST baseline B silently replaces A')
        wait_draft({'customer_id': ids['b'], 'description': 'TEST baseline B silently replaces A'})
        overwritten = draft()
        assert overwritten != original_draft
        assert overwritten.get('quantity') != original_draft['quantity']
        assert overwritten.get('internal_note') != original_draft['internal_note']
        assert business_snapshot() == original_business
        assert not errors, errors
        assert not external_calls, external_calls
        print('EXPECTED BASELINE VULNERABILITY REPRODUCED: unchanged v3.9.70 offers B without a conflict, falsely says draft resumed, then autosave replaces valuable A draft despite existing final-DOM site filtering; zero business/audit writes', flush=True)
        browser.close()
        sys.exit(0)

    visit('isler/new?customer_id=' + ids['b'], ready=False)
    page.wait_for_selector('[data-work-entry-conflict]')
    assert 'taslak' in page.locator('[data-work-entry-conflict]').inner_text().lower()
    for width in [320, 360, 390]:
        page.set_viewport_size({'width': width, 'height': 850})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), width
        page.screenshot(path=str(ARTIFACT / ('draft-choice-' + str(width) + '.png')), full_page=True)
    assert draft() == original_draft, 'Opening customer B must not replace customer A draft'
    assert business_snapshot() == original_business
    page.click('[data-work-entry-choice=keep]')
    form_ready()
    assert page.input_value('[name=customer_id]') == ids['a']
    assert page.input_value('[name=site_id]') == ids['sa']
    assert page.input_value('[name=quantity]') == '9'
    assert page.input_value('[name=description]') == original_draft['description']
    assert draft() == original_draft
    assert 'Yarım kalan iş taslağı yüklendi' in page.locator('[data-work-start=draft]').inner_text()
    assert business_snapshot() == original_business
    print('PASS customer-prefilled entry asks before replacing a valuable draft; cancel restores exact draft and writes no business/audit data', flush=True)
    assert page.input_value('[name=job_scope]') == 'ekstra'
    page.reload()
    form_ready()
    assert page.input_value('[name=job_scope]') == 'ekstra'
    assert draft() == original_draft
    page.select_option('[name=job_scope]', 'dahil')
    wait_draft({'job_scope': 'dahil'})
    page.select_option('[name=job_scope]', 'ekstra')
    wait_draft({'job_scope': 'ekstra'})
    page.reload()
    form_ready()
    assert page.input_value('[name=job_scope]') == 'ekstra'
    assert business_snapshot() == original_business
    visit('daha')
    set_draft(original_draft)
    print('PASS open lump-sum contract keeps saved extra-work choice after conflict cancel, reload and selection-only autosave; no business writes', flush=True)


    visit('isler/new?customer_id=' + ids['b'], ready=False)
    page.wait_for_selector('[data-work-entry-conflict]')
    abandoned_replace = page.query_selector('[data-work-entry-choice=replace]')
    visit('daha')
    abandoned_replace.evaluate('button=>button.click()')
    page.wait_for_timeout(100)
    assert page.evaluate('location.hash') == '#/daha'
    assert draft() == original_draft and business_snapshot() == original_business
    assert page.locator('[data-work-entry-conflict],.sheet').count() == 0
    visit('isler/new')
    form_ready()
    print('PASS leaving an unresolved draft conflict removes it; a late replacement reply cannot write or reopen the old route', flush=True)

    # Old-form debounce cannot restore A over the explicitly accepted B context.
    page.fill('[name=quantity]', '111')
    visit('isler/new?customer_id=' + ids['b'], ready=False)
    page.wait_for_selector('[data-work-entry-conflict]')
    page.click('[data-work-entry-choice=replace]')
    form_ready()
    assert page.input_value('[name=customer_id]') == ids['b']
    assert page.input_value('[name=quantity]') == ''
    assert page.input_value('[name=description]') == ''
    assert page.locator('[data-work-start=customer]').count() == 1
    assert page.locator('[data-work-start=draft]').count() == 0
    assert ids['sb'] in option_values()
    assert not {ids['sa'], ids['orphan']}.intersection(option_values())
    page.wait_for_timeout(800)
    assert draft()['customer_id'] == ids['b']
    assert str(draft().get('quantity', '')) not in ['9', '111']
    page.fill('[name=description]', 'TEST explicit replacement survives reload')
    wait_draft({'customer_id': ids['b'], 'description': 'TEST explicit replacement survives reload'})
    page.reload()
    form_ready()
    assert page.locator('.sheet').count() == 0
    assert page.input_value('[name=customer_id]') == ids['b']
    assert page.input_value('[name=description]') == 'TEST explicit replacement survives reload'
    assert business_snapshot() == original_business
    print('PASS explicit replacement starts a clean B context; stale A autosave cannot overwrite it; reload resumes edited B without another collision', flush=True)

    # Saha Akışı is navigation context, not consent to replace a stored draft.
    visit('daha')
    set_draft(original_draft)
    saha = 'isler/new?' + urlencode({
        'source': 'saha', 'date': '2026-10-22', 'vehicle_id': ids['otherVehicle'],
        'return_to': '#/saha-akisi?date=2026-10-22',
    })
    visit(saha)
    form_ready()
    assert page.input_value('[name=date]') == original_draft['date']
    assert page.input_value('[name=vehicle_id]') == ids['vehicle']
    assert page.input_value('[name=description]') == original_draft['description']
    assert 'korundu' in page.locator('[data-entry-context]').inner_text()
    assert draft() == original_draft and business_snapshot() == original_business
    print('PASS Saha Akışı preserves unfinished date, vehicle and text instead of silently applying incoming context', flush=True)

    visit('daha')
    visit('isler/new?customer_id=' + ids['a'])
    form_ready()
    assert page.locator('[data-work-entry-conflict]').count() == 0
    assert page.locator('[data-work-start=draft]').count() == 1
    assert page.input_value('[name=description]') == original_draft['description']
    assert draft() == original_draft
    print('PASS re-entering the same customer resumes the whole existing draft without a needless replacement choice', flush=True)

    incoming = {
        'date': '2026-10-23', 'customer_id': ids['b'], 'site_id': ids['sb'],
        'vehicle_id': ids['vehicle'], 'work_type': 'Moloz Nakliye', 'unit': 'Sefer',
        'quantity': '4', 'description': 'TEST explicit message prefill',
    }
    visit('daha')
    page.evaluate('value=>{window.__prefill=value}', incoming)
    visit('isler/new', ready=False)
    page.wait_for_selector('[data-work-entry-conflict]')
    page.click('[data-work-entry-choice=keep]')
    form_ready()
    assert page.input_value('[name=description]') == original_draft['description']
    assert draft() == original_draft
    assert page.evaluate('window.__prefill == null')
    visit('daha')
    page.evaluate('value=>{window.__prefill=value}', incoming)
    visit('isler/new', ready=False)
    page.wait_for_selector('[data-work-entry-conflict]')
    page.click('[data-work-entry-choice=replace]')
    form_ready()
    assert page.locator('[data-work-start=message]').count() == 1
    assert page.input_value('[name=description]') == incoming['description']
    assert page.input_value('[name=customer_id]') == ids['b']
    assert page.input_value('[name=site_id]') == ids['sb']
    assert page.input_value('[name=quantity]') == '4'
    assert page.evaluate('window.__prefill == null')
    assert business_snapshot() == original_business
    print('PASS transient message entry also protects the draft; cancel works on the same route and explicit replacement uses only incoming values', flush=True)

    # Initial and changed site choices obey the same ownership rule.
    visit('daha')
    clear_draft()
    visit('isler/new?customer_id=' + ids['a'])
    form_ready()
    assert ids['sa'] in option_values()
    assert not {ids['sb'], ids['orphan']}.intersection(option_values())
    assert page.locator('[data-work-start=draft]').count() == 0
    page.select_option('[name=site_id]', ids['sa'])
    assert page.input_value('[name=job_scope]') == 'dahil', 'Fresh context retains existing included default'
    page.select_option('[name=customer_id]', '__new__')
    page.wait_for_selector('.sheet [data-p]')
    choose_dialog(False)
    assert page.input_value('[name=customer_id]') == ids['a']
    assert page.input_value('[name=site_id]') == ids['sa']
    page.select_option('[name=site_id]', '__new__')
    page.wait_for_selector('.sheet [data-p]')
    choose_dialog(False)
    assert page.input_value('[name=site_id]') == ids['sa']
    assert business_snapshot() == original_business
    print('PASS initial site filtering excludes another customer and orphan sites; canceling inline customer/site creation preserves the previous selection', flush=True)

    page.select_option('[name=customer_id]', ids['b'])
    assert page.input_value('[name=site_id]') == ''
    assert ids['sb'] in option_values()
    assert not {ids['sa'], ids['orphan']}.intersection(option_values())
    page.select_option('[name=site_id]', ids['sb'])
    wait_draft({'customer_id': ids['b'], 'site_id': ids['sb']})
    page.reload()
    form_ready()
    assert page.input_value('[name=customer_id]') == ids['b']
    assert page.input_value('[name=site_id]') == ids['sb']
    page.select_option('[name=customer_id]', '')
    assert page.input_value('[name=site_id]') == ''
    assert not {ids['sa'], ids['sb'], ids['orphan']}.intersection(option_values())
    page.select_option('[name=customer_id]', ids['a'])
    page.select_option('[name=site_id]', ids['sa'])
    assert business_snapshot() == original_business
    print('PASS changing or clearing customer removes incompatible site; selection-only autosave and reload retain the valid pair', flush=True)

    # Confirmed new customer/site creation is explicit; subsequent change autosaves.
    page.select_option('[name=customer_id]', '__new__')
    page.wait_for_selector('.sheet [data-p]')
    page.fill('.sheet [data-p]', 'TEST Entry Inline Customer')
    choose_dialog(True)
    page.wait_for_function("()=>{const s=document.querySelector('[name=customer_id]');return s&&s.selectedOptions[0]?.textContent==='TEST Entry Inline Customer'}")
    inline_customer = page.input_value('[name=customer_id]')
    assert inline_customer not in ['', '__new__', ids['a'], ids['b']]
    assert page.input_value('[name=site_id]') == ''
    assert not {ids['sa'], ids['sb'], ids['orphan']}.intersection(option_values())
    page.select_option('[name=site_id]', '__new__')
    page.wait_for_selector('.sheet [data-p]')
    page.fill('.sheet [data-p]', 'TEST Entry Inline Site')
    choose_dialog(True)
    page.wait_for_function("()=>{const s=document.querySelector('[name=site_id]');return s&&s.selectedOptions[0]?.textContent==='TEST Entry Inline Site'}")
    inline_site = page.input_value('[name=site_id]')
    site_record = page.evaluate("async id=>(await import('./js/db.js')).get('sites',id)", inline_site)
    assert site_record['customer_id'] == inline_customer
    wait_draft({'customer_id': inline_customer, 'site_id': inline_site})
    page.reload()
    form_ready()
    assert page.input_value('[name=customer_id]') == inline_customer
    assert page.input_value('[name=site_id]') == inline_site
    after_cards = business_snapshot()
    assert after_cards['data']['work_records'] == original_business['data']['work_records']
    assert after_cards['attachments'] == original_business['attachments']
    for store, rows in original_business['data'].items():
        if store not in ['customers', 'sites', 'audit_log']:
            assert after_cards['data'][store] == rows, store
    assert len(after_cards['data']['customers']) == len(original_business['data']['customers']) + 1
    assert len(after_cards['data']['sites']) == len(original_business['data']['sites']) + 1
    assert len(after_cards['data']['audit_log']) == len(original_business['data']['audit_log']) + 2
    print('PASS explicitly created customer clears prior site; explicitly created site belongs to that customer and both selections survive reload without work writes', flush=True)

    # A late prompt response cannot mutate a detached form or navigate back.
    page.select_option('[name=site_id]', '__new__')
    page.wait_for_selector('.sheet [data-p]')
    page.fill('.sheet [data-p]', 'TEST late site must not be created')
    late_confirm = page.query_selector('.sheet [data-x="1"]')
    visit('daha')
    page.wait_for_selector('.sheet', state='hidden')
    late_confirm.evaluate('button=>button.click()')
    page.wait_for_timeout(800)
    assert page.evaluate('location.hash') == '#/daha'
    assert business_snapshot() == after_cards
    print('PASS navigating away while inline creation waits prevents the late reply from writing a card or hijacking the new screen', flush=True)

    # Legacy mismatched references remain visible, never repaired during reads.
    before_legacy_draft = draft()
    visit('isler/' + ids['legacy'] + '/edit')
    form_ready()
    assert page.input_value('[name=customer_id]') == ids['a']
    assert page.input_value('[name=site_id]') == ids['sb']
    assert page.locator('[data-site-context]').count() == 1
    assert 'eski seçim' in page.locator('[name=site_id] option:checked').inner_text()
    assert page.input_value('[name=description]') == 'TEST legacy work description stays verbatim'
    assert page.input_value('[name=internal_note]') == 'TEST legacy private note stays verbatim'
    assert page.input_value('[name=customer_note]') == 'TEST legacy customer report note'
    for width in [320, 390, 768]:
        page.set_viewport_size({'width': width, 'height': 850})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), width
        page.screenshot(path=str(ARTIFACT / ('legacy-edit-' + str(width) + '.png')), full_page=True)
    assert draft() == before_legacy_draft
    assert business_snapshot() == after_cards
    assert not errors, errors
    assert not external_calls, external_calls
    print('PASS legacy edit retains historical site, descriptions, customer/private notes, attachment bytes and draft without rewriting; 320/390/768 px; no page errors or AI requests', flush=True)
    browser.close()

print('work_entry_safety browser PASS', flush=True)

"""Actual depot report filters and downloaded PDF/CSV; synthetic DB, no accounting writes."""
import sys,re,uuid,json
from pathlib import Path
from urllib.parse import urlencode
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/').rstrip('/')+'/'
out=Path('/tmp/solo-tank-report118');out.mkdir(exist_ok=True)
def pdf_text(p):
 data=p.read_bytes();assert data.startswith(b'%PDF-')
 ops=re.findall(rb'1 0 0 1 ([\d.-]+) ([\d.-]+) Tm <([0-9a-fA-F]+)> Tj',data);assert ops
 for x,y,_ in ops:assert 0<=float(x)<842 and 0<=float(y)<596,(x,y)
 return ' '.join(' '.join(bytes.fromhex(t.decode()).decode('utf-16-be') for _,_,t in ops).split())
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':800},accept_downloads=True);c.add_init_script("localStorage.setItem('sp_role','boss')")
 page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));dbid='TEST_tank118_'+uuid.uuid4().hex[:8]
 page.goto(base+'index.html?db='+dbid+'#/depo');page.wait_for_selector('#screen[data-view-ready="1"]')
 assert page.locator('[data-tank-report]').count()==1,'Missing detailed depot report entry'
 ids=page.evaluate("""async()=>{const d=await import('./js/db.js');const v=await d.saveNew('vehicles',{name:'TEST Rapor Kamyonu',plate:'00 TEST 01'},'TEST'),p=await d.saveNew('personnel',{name:'TEST Yakıt Alan'},'TEST');await d.saveNew('fuel_tank_movements',{date:'2026-11-01',move_type:'GİRİŞ',liters:1000},'TEST');for(let i=0;i<65;i++)await d.saveNew('fuel_tank_movements',{date:'2026-11-02',move_type:'ÇIKIŞ',liters:2,vehicle_id:v.id,personnel_id:p.id,pump_no:'TEST-P'+i,signature_name:'TEST Teslim Alan'},'TEST');const other=await d.saveNew('vehicles',{name:'TEST Diğer Araç'},'TEST');await d.saveNew('fuel_tank_movements',{date:'2026-11-03',move_type:'ÇIKIŞ',liters:7,vehicle_id:other.id},'TEST');return {v:v.id,p:p.id}}""")
 snap=lambda:page.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())")
 before=snap();page.click('[data-tank-report]');page.wait_for_selector('[data-tank-personnel]')
 page.select_option('[data-tank-personnel]',ids['p']);page.wait_for_selector('[data-tank-movement]');page.select_option('[data-tank-movement]','ÇIKIŞ');page.wait_for_selector('[data-id]');page.select_option('[data-id]',ids['v']);page.wait_for_selector('[data-pdf]')
 query={'k':'depo','p':'custom','from':'2026-11-01','to':'2026-11-30','id':ids['v'],'personnel':ids['p'],'movement':'ÇIKIŞ'}
 page.goto(base+'index.html?db='+dbid+'#/detayli-rapor?'+urlencode(query));page.wait_for_selector('[data-pdf]');assert page.locator('[data-tank-personnel]').input_value()==ids['p'];assert '130 L' in page.locator('#screen').inner_text()
 assert page.locator('[data-more]').count()==1
 for selector,filename in [('[data-pdf]','tank.pdf'),('[data-csv]','tank.csv')]:
  with page.expect_download(timeout=60000) as result:page.click(selector)
  result.value.save_as(out/filename)
 text=pdf_text(out/'tank.pdf');csv=(out/'tank.csv').read_text('utf-8-sig')
 for value in ['TEST Yakıt Alan','TEST Rapor Kamyonu','TEST-P64','TEST Teslim Alan','130']:
  assert value in text,(value,text[-600:]);assert value in csv,value
 assert '137' not in text and 'TEST-P64' in text,'PDF must use all filtered rows, including beyond screen limit'
 assert snap()==before,'Report export cannot change business records'
 for width in [320,360,768]:page.set_viewport_size({'width':width,'height':800});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 page.set_viewport_size({'width':360,'height':800});page.screenshot(path=str(out/'mobile.png'),full_page=True)
 c.set_offline(True);page.reload();page.wait_for_selector('[data-pdf]');assert '130 L' in page.locator('#screen').inner_text();assert snap()==before
 assert not errors,errors
 print(json.dumps({'filters':True,'fullPdf65Rows':True,'csvParity':True,'unchangedRecords':True,'offline':True,'widths':[320,360,768],'errors':errors}));b.close()

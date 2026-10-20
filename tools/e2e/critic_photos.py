"""Adversarial driver-photo import. Isolated data, signed packets, no external AI/messages."""
import io,base64
from PIL import Image
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
def photos(n):
 out=[]
 for i in range(n):
  f=io.BytesIO();Image.new('RGB',(120,160),(i*11%255,80,120)).save(f,'JPEG');out.append({'name':f'p-{i}.jpg','mimeType':'image/jpeg','buffer':f.getvalue()})
 return out
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':800});c.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
 pg=c.new_page();errors=[];calls=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.route('https://generativelanguage.googleapis.com/**',lambda r:(calls.append(r.request.url),r.abort()))
 pg.goto(U);pg.evaluate('async()=>await navigator.serviceWorker.ready');pg.wait_for_timeout(800)
 packets=pg.evaluate(r'''async()=>{const db=await import('./js/db.js'),D=await import('./js/driver-core.js'),C=await import('./js/core.js'),S=await import('./js/security.js');const d=await db.dumpAll(),v=d.vehicles[0].id,p=d.personnel[0].id;const customer=await db.saveNew('customers',{name:'Critic TEST'},'TEST'),l=await S.newDriverLink({pid:p,name:d.personnel[0].name}),cfg={...D.driverConfig(await db.dumpAll(),{personnel_id:p,vehicle_id:v}),...l.forDriver},date=C.todayStr();const w=(id,ph)=>({id,date,vid:v,cid:customer.id,wt:'Hafriyat Nakliye',q:1,u:'Sefer',ph});const badLink=await S.newDriverLink({pid:p,name:d.personnel[0].name});await S.revokeLink(badLink.link.lid);return {extra:await D.driverMessage([w('extra',1)],cfg),zero:await D.driverMessage([w('zero',0)],cfg),missing:await D.driverMessage([w('missing',2)],cfg),twenty:await D.driverMessage([w('ten-a',10),w('ten-b',10)],cfg),mixed:await D.driverMessage([w('mixed',1)],cfg)+'\n'+await D.driverMessage([w('rejected',1)],{...cfg,...badLink.forDriver})}}''')
 def open_packet(text,n):
  pg.goto(U+'index.html#/akilli-asistan');pg.reload();pg.wait_for_selector('[data-msg]');pg.fill('[data-msg]',text)
  if n:pg.set_input_files('[data-photos]',photos(n))
  pg.click('[data-ask]');pg.wait_for_selector('[data-kind=work]')
 def row_count(id):return pg.evaluate("async(id)=>(await(await import('./js/db.js')).listActive('work_records')).filter(x=>x.driver_entry_id===id).length",id)
 open_packet(packets['extra'],2)
 assert 'Fazla veya başka pakete ait' in pg.inner_text('[data-out]');assert pg.locator('[data-kind=work] img').count()==0
 pg.evaluate("()=>{const b=document.querySelector('[data-save]');b.click();b.click()}");pg.wait_for_selector('.sheet');assert pg.locator('.sheet').count()==1;assert 'Dosyalar eklenmeden' in pg.inner_text('.sheet')
 pg.click('.sheet [data-x="0"]');assert row_count('extra')==0
 pg.click('[data-save]');pg.wait_for_selector('.sheet');pg.click('.sheet [data-x="1"]');pg.wait_for_timeout(1000)
 assert row_count('extra')==1
 assert pg.evaluate("async()=>{const d=await import('./js/db.js');const r=(await d.listActive('work_records')).find(x=>x.driver_entry_id==='extra');return (await d.attachmentsFor('work',r.id)).length}")==0
 print('PASS extra photos never assigned; cancel writes nothing; explicit fileless confirmation saves without attachments',flush=True)
 open_packet(packets['zero'],1);assert pg.locator('[data-kind=work] img').count()==0;pg.click('[data-drvclear]');pg.wait_for_function("() => document.querySelector('[data-out]').textContent.includes('0 dosya bekleniyor, 0 dosya eklendi')");assert pg.locator('[data-drvclear]').count()==0
 print('PASS zero-photo packet never absorbs unrelated image; explicit removal rebuilds original message',flush=True)
 open_packet(packets['missing'],1);assert 'Dosyalar eksik' in pg.inner_text('[data-out]');assert pg.locator('[data-kind=work] img').count()==0
 pg.set_input_files('[data-drvph]',photos(2));pg.wait_for_function("() => document.querySelectorAll('[data-kind=work] img').length===2");assert pg.locator('[data-drvph]').count()==0
 print('PASS missing bundle repaired by selecting exact two files, then both link to correct work',flush=True)
 open_packet(packets['mixed'],1);assert 'reddedilmiş şoför paketi de var' in pg.inner_text('[data-out]');assert pg.locator('[data-kind=work]').count()==1;assert pg.locator('[data-kind=work] img').count()==0;assert pg.locator('[data-drvph]').count()==0
 print('PASS mixed valid/revoked message does not attach rejected-origin image despite matching accepted count',flush=True)
 open_packet(packets['twenty'],20);assert pg.locator('[data-kind=work] img').count()==20;assert pg.locator('[data-drvph]').count()==0
 pg.click('[data-save]');pg.wait_for_timeout(1200);assert row_count('ten-a')==1 and row_count('ten-b')==1
 assert pg.evaluate("async()=>{const d=await import('./js/db.js');const rows=(await d.listActive('work_records')).filter(x=>['ten-a','ten-b'].includes(x.driver_entry_id));return Promise.all(rows.map(async r=>(await d.attachmentsFor('work',r.id)).length))}")==[10,10]
 names=pg.evaluate("async()=>{const d=await import('./js/db.js');const result={};for(const r of (await d.listActive('work_records')).filter(x=>['ten-a','ten-b'].includes(x.driver_entry_id)))result[r.driver_entry_id]=(await d.attachmentsFor('work',r.id)).map(a=>a.name).sort();return result}")
 assert names=={'ten-a':sorted(f'p-{i}.jpg' for i in range(10)),'ten-b':sorted(f'p-{i}.jpg' for i in range(10,20))},names
 print('PASS 20-file driver packet imports all files, ten per correct work with exact file names',flush=True)
 pg.goto(U+'index.html#/akilli-asistan');pg.reload();pg.wait_for_selector('[data-msg]');pg.fill('[data-msg]',packets['twenty']);pg.set_input_files('[data-photos]',photos(21));assert not pg.locator('[data-attachment-error]').is_hidden();pg.click('[data-ask]');pg.wait_for_timeout(300);assert pg.locator('[data-kind]').count()==0
 # Real service-worker share-target path, not a mock cache loader.
 image=base64.b64encode(photos(1)[0]['buffer']).decode()
 def receive(n):
  pg.evaluate("""async({n,text,image})=>{const bytes=Uint8Array.from(atob(image),c=>c.charCodeAt(0)),fd=new FormData();fd.append('text',text);for(let i=0;i<n;i++)fd.append('photos',new File([bytes],'share-'+i+'.jpg',{type:'image/jpeg'}));await fetch('./share-target',{method:'POST',body:fd});}""",{'n':n,'text':packets['twenty'],'image':image})
  pg.goto('about:blank');pg.goto(U+'index.html#/akilli-asistan?shared=1');pg.wait_for_function("() => document.querySelectorAll('[data-thumbs] img').length===20")
 receive(20);assert pg.locator('[data-thumbs] img').count()==20;assert pg.locator('[data-attachment-error]').is_hidden()
 pg.click('[data-ask]');pg.wait_for_selector('[data-kind=work]');assert pg.locator('[data-kind=work] img').count()==20
 receive(21);assert not pg.locator('[data-attachment-error]').is_hidden();assert '21 dosya var' in pg.inner_text('[data-attachment-error]');pg.click('[data-ask]');pg.wait_for_timeout(250);assert pg.locator('[data-kind]').count()==0
 print('PASS actual service-worker share-target retains 20 files and visibly blocks 21-file partial input',flush=True)
 assert not calls,calls;assert not errors,errors
 print('PASS >20 picker selection visibly blocks processing; no Gemini calls or uncaught errors',flush=True)
 b.close()

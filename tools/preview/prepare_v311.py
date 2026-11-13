#!/usr/bin/env python3
"""Static QA only. Production app files are never replaced. All input comes from a committed source."""
import argparse,hashlib,io,json,pathlib,re,shutil,subprocess,sys,tarfile,tempfile,zipfile,datetime
p=argparse.ArgumentParser();p.add_argument('--source',required=True);args=p.parse_args();root=pathlib.Path(__file__).resolve().parents[2];target=root/'qa-v311-phone'
if not re.fullmatch('[a-f0-9]{40}',args.source):raise SystemExit('Tam kaynak SHA gerekir.')
if target.exists():raise SystemExit('QA çıktı yolu zaten var; otomatik silinmez.')
with tempfile.TemporaryDirectory(prefix='sahapro-qa-source-')as tmp:
 src=pathlib.Path(tmp)/'source';src.mkdir();archive=subprocess.check_output(['git','archive',args.source],cwd=root)
 with tarfile.open(fileobj=io.BytesIO(archive))as tar:
  for m in tar.getmembers():
   if any(part in ('.git','tests','docs','reports','research_notes','.github')for part in pathlib.PurePosixPath(m.name).parts):continue
   if m.name.startswith('tools/')and m.name!='tools/preview/build.py':continue
   tar.extract(m,src,filter='data')
 # Restore approved test inputs and phone builder into an otherwise tracked-only temp tree.
 names=subprocess.check_output(['git','ls-tree','-r','--name-only',args.source],cwd=root,text=True).splitlines()
 for name in names:
  if name.startswith('tests/assistant-gold/')or name=='tools/preview/build_phone.py':
   path=src/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(subprocess.check_output(['git','show',args.source+':'+name],cwd=root))
 # Phone archive generator reads git HEAD; run the committed script in a temporary git checkout.
 subprocess.check_call(['git','init','-q',str(src)]);subprocess.check_call(['git','-C',str(src),'fetch','-q',str(root),args.source]);subprocess.check_call(['git','-C',str(src),'checkout','-q','-f','--detach','FETCH_HEAD'])
 phone=pathlib.Path(tmp)/'phone.zip';subprocess.check_call([sys.executable,str(src/'tools/preview/build_phone.py'),'--output',str(phone)])
 target.mkdir()
 with zipfile.ZipFile(phone)as z:z.extractall(target)
 # Transfer payloads and test archives never enter the app preview.
 for omitted in ['tests','docs','reports','research_notes','data/transfers']:
  if(src/omitted).exists():shutil.rmtree(src/omitted)
 app=target/'app';subprocess.check_call([sys.executable,str(src/'tools/preview/build.py'),str(app)])
 for path in app.rglob('*'):
  if path.is_file()and path.suffix in ('.js','.html','.webmanifest')and'vendor'not in path.parts:
   text=path.read_text();text=text.replace('sahapro_onizleme_db','sahapro_onizleme_v31105_db').replace('sahapro-onizleme-','sahapro-onizleme-v31105-').replace('spx_','spx_v31105_').replace('solox_','solox_v31105_');path.write_text(text)
 if(app/'.github').exists():shutil.rmtree(app/'.github')
 for name in ['fixture.mjs','records.json','source.json']:
  dst=app/'tests/assistant-gold/real-messages'/name;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(subprocess.check_output(['git','show',args.source+':tests/assistant-gold/real-messages/'+name],cwd=root))
 dst=app/'tests/assistant-gold/test-json.mjs';dst.write_bytes(subprocess.check_output(['git','show',args.source+':tests/assistant-gold/test-json.mjs'],cwd=root))
 bootstrap="""import * as db from './js/db.js';
const connection=await db.openDB();if(connection.name!=='sahapro_onizleme_v31105_db')throw Error('Örnek veri alanı doğrulanamadı.');
const key='preview_seed_v31105';if(!await db.metaGet(key)){
 const {fixture,fixtureSettings}=await import('./tests/assistant-gold/real-messages/fixture.mjs'),data=fixture();
 if(Object.values(data).some(rows=>rows.some(r=>!String(r.id).startsWith('TEST_'))))throw Error('Yalnız TEST kayıtları yüklenebilir.');
 await new Promise((resolve,reject)=>{let error;const stores=[...connection.objectStoreNames].filter(s=>!['meta','drafts','attachments'].includes(s)),tx=connection.transaction([...stores,'meta'],'readwrite'),meta=tx.objectStore('meta'),ready=meta.get(key);
 ready.onsuccess=()=>{if(ready.result?.value)return;let left=stores.length;for(const store of stores){const count=tx.objectStore(store).count();count.onsuccess=()=>{if(count.result){error=Error('Örnek alan boş değil; mevcut kayıtlara dokunulmadı.');tx.abort();return;}if(!--left){for(const[table,rows]of Object.entries(data))for(const row of rows)tx.objectStore(table).put(row);meta.put({key:'assistant_rules',value:fixtureSettings().assistant_rules});meta.put({key:'schema_version_current',value:7});meta.put({key,value:true});}};}};
 tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(error||tx.error||Error('Örnek veri yüklenemedi.'));});
}
if(!localStorage.getItem('spx_v31105_role'))localStorage.setItem('spx_v31105_role','boss');
await import('./js/app.js');
"""
 (app/'preview-start.mjs').write_text(bootstrap)
 idx=app/'index.html';text=idx.read_text();assert 'src="js/app.js"'in text;text=text.replace('src="js/app.js"','src="preview-start.mjs"');idx.write_text(text)
 sw=app/'sw.js';text=sw.read_text();assert'const ASSETS = ['in text;text=text.replace('const ASSETS = [','const ASSETS = [\n  "./preview-start.mjs",');sw.write_text(text)
 manifest=app/'manifest.webmanifest';m=json.loads(manifest.read_text());m['id']='sahapro-onizleme-v31105';manifest.write_text(json.dumps(m,ensure_ascii=False,indent=2))
 # Portal contains no business name literals; examples are generated from approved JSON.
 (target/'index.html').write_text('''<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SAHAPRO • Telefon kabul alanı</title><link rel="stylesheet" href="tests/assistant-gold/phone.css"></head><body><main><header><span class="pill">ÖRNEK VERİLİ TEST ALANI</span><h1>Android kabul masası</h1><p>Canlı uygulamanız v3.10.13 olarak kalır. Burada yalnız takma adlı örnekler ve ayrı test kayıtları kullanılır.</p></header><section><h2>1. Gerçek Gemini ölçümü</h2><p>Anahtar telefonda kalır. Üç tur: 20 mesaj + toplu döküm + 12 güvenlik örneği. İzin ve günlük bütçeyle, en fazla 100 istek.</p><a class="btn" href="tests/assistant-gold/phone.html?db=TEST_V311_PHONE">Canlı sınavı aç</a></section><section><h2>2. Örnek verili uygulama</h2><p>Ayrı örnek müşteri, personel, araç ve şantiye kayıtları hazırdır. İş/kasa kaydı ancak bu test uygulamasındaki Kaydet ile oluşur. Gerçek yedek veya şoför bağlantısı kullanmayın.</p><a class="btn" href="app/#/akilli-asistan">Örnek asistanı aç</a><p>Gerçek telefon, düşük parlaklık, seri fiş, soru cevabı ve geri alma burada kontrol edilir. Bu adımın sonucu otomatik başarı sayılmaz.</p></section><section><h2>3. Gün sonu örnekleri</h2><button id="copy-work">10 örnek işi kopyala</button><button id="copy-money">2 hassas hareketi kopyala</button><p id="copy-status" role="status"></p><textarea id="samples" rows="6" readonly aria-label="Takma adlı örnek mesajlar"></textarea><p>Metinleri yalnız örnek uygulamada kullanın. WhatsApp pano denemesinde örnek metni kendinize gönderip içeriğini kopyalayabilirsiniz.</p><div id="receipts"></div></section><section><h2>Kaynak ve sınırlar</h2><p id="source"></p><p>Aynı site içinde ad ayrımı güvenlik izolasyonu değildir. Test kodu yalnız kendi veri adlarını kullanır; canlı veritabanını veya önbelleğini temizlemez. Yayın kararı gerçek ölçüm ve telefon kabulünden sonra verilir.</p></section></main><script type="module" src="portal.mjs"></script></body></html>''')
 (target/'portal.mjs').write_text('''const f=await(await fetch('./tests/assistant-gold/real-messages/source.json')).json(),r=await(await fetch('./tests/assistant-gold/real-messages/records.json')).json(),cfg=await(await fetch('./tests/assistant-gold/phone-source.json')).json();
document.querySelector('#source').textContent=cfg.appVersion+' · '+cfg.sourceSha;
const d=new Date(),date=String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear(),customers=f.fixture.customers,vehicles=f.fixture.vehicles,people=f.fixture.personnel;
const name=p=>r.personnel_aliases.find(x=>x.personnel_id===p.id)?.name||p.name,person=v=>people.find(p=>p.id===v.assignee)||people[0];
const jobs=Array.from({length:10},(_,i)=>{const v=vehicles[i%vehicles.length],c=customers[i%Math.min(3,customers.length)],truck=/kamyon|cekici|çekici|tır/i.test(v.type),qty=i%3+1;return '['+date+' 19:'+String(i).padStart(2,'0')+'] '+name(person(v))+': '+c.name+' '+v.name+' '+qty+' '+(truck?'sefer yaptı, kendi depomuza döktü.':'saat çalıştı.');}).join('\\n');
const p=people[0],c=customers[0],money='['+date+' 20:00] '+name(p)+': '+c.name+' 2000 TL nakit ödedi, parayı '+name(p)+' aldı; kasaya teslim edilmedi.\\n['+date+' 20:05] '+name(p)+': '+c.name+' müşterisinin forkliftine kendi depomuzdan20litre mazot verdik, litresi50TL.';
async function copy(text){const area=document.querySelector('#samples');area.value=text;try{await navigator.clipboard.writeText(text);document.querySelector('#copy-status').textContent='Örnek metin kopyalandı.';}catch{area.select();document.querySelector('#copy-status').textContent='Metni seçip Kopyala ile alın.';}}
document.querySelector('#copy-work').onclick=()=>copy(jobs);document.querySelector('#copy-money').onclick=()=>copy(money);
const box=document.querySelector('#receipts');for(let i=1;i<=4;i++){const a=document.createElement('a');a.href='./receipts/TEST_FIS_'+i+'.png';a.download='TEST_FIS_'+i+'.png';a.textContent=i+'. örnek fişi indir';a.className='btn';a.style.display='block';a.style.marginTop='12px';box.append(a);}
''')
 from PIL import Image,ImageDraw,ImageFont
 rec=target/'receipts';rec.mkdir();font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',30);stamp=datetime.date.today().strftime('%d.%m.%Y')
 for i,litres in enumerate([10,20,30,40],1):
  im=Image.new('RGB',(720,900),'white');draw=ImageDraw.Draw(im);lines=['ÖRNEK PETROL','TEST FİŞİ — GERÇEK İŞLEM DEĞİL','Fiş no: TEST-FIS-'+str(i).zfill(3),'Tarih: '+stamp,'Şirket deposuna alım','Ürün: Motorin','Miktar: '+str(litres)+' litre','Birim fiyat: 50 TL','TOPLAM: '+str(litres*50)+' TL','Ödeme: Nakit','KDV: 0 TL','Yalnız telefon kabul denemesi']
  for n,line in enumerate(lines):draw.text((35,40+n*63),line,font=font,fill='black')
  im.save(rec/('TEST_FIS_'+str(i)+'.png'))
 meta={'canonicalSourceSha':args.source,'rootAppVersion':'v3.10.13','previewAppVersion':'v3.11.05','scope':'Static test hosting only; same-origin namespace separation is not a security boundary.','files':{str(x.relative_to(target)):hashlib.sha256(x.read_bytes()).hexdigest()for x in sorted(target.rglob('*'))if x.is_file()}}
 (target/'QA-MANIFEST.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'qa':str(target),'canonicalSourceSha':args.source,'files':len(meta['files'])}))

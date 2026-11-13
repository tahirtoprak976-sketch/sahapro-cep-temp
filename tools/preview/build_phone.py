#!/usr/bin/env python3
"""Package only committed public code and approved pseudonyms. No app startup, SW or business writes."""
import argparse,hashlib,json,pathlib,re,subprocess,zipfile
root=pathlib.Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--output',required=True,type=pathlib.Path);args=p.parse_args()
if args.output.suffix!='.zip':raise SystemExit('Çıktı .zip olmalı.')
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
tracked=subprocess.check_output(['git','ls-tree','-r','--name-only',sha],cwd=root,text=True).splitlines()
selected=[f for f in tracked if f.startswith('js/')and f.endswith('.js')]
selected += ['tests/assistant-gold/'+f for f in ['phone.html','phone.css','phone-page.mjs','phone-engine.mjs','phone-safety.mjs','replay.mjs','cases.json','confidence-cases.json','cards.json','test-json.mjs']]
selected += ['tests/assistant-gold/real-messages/'+f for f in ['fixture.mjs','measure.mjs','source.json','records.json','photo-cases.json','recorded-v3.10.00.json']]
if any(f not in tracked for f in selected):raise SystemExit('Önce sınav dosyalarını commit edin; paket yalnız kayıtlı kaynaktan oluşur.')
files={f:subprocess.check_output(['git','show',sha+':'+f],cwd=root)for f in selected}
version=re.search(rb'export const APP_VERSION = "([^"]+)"',files['js/core.js'])[1].decode()
config={'sourceSha':sha,'appVersion':version,'files':{f:hashlib.sha256(v).hexdigest()for f,v in files.items()},'scope':'Pseudonym corpus in memory; TEST metadata budget only; no service worker or business Save.'}
files['tests/assistant-gold/phone-source.json']=(json.dumps(config,ensure_ascii=False,indent=2)+'\n').encode()
files['index.html']=b'<!doctype html><html lang="tr"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=tests/assistant-gold/phone.html?db=TEST_V311_PHONE"><title>SAHAPRO telefon sinavi</title><a href="tests/assistant-gold/phone.html?db=TEST_V311_PHONE">Telefon sinavini ac</a></html>'
files['.nojekyll']=b''
files['TEST_ALANI.txt']='Bu paket yalnız takma adlı sınav içindir. HTTPS statik önizleme adresinde açın. İş/kasa/cari kaydı yazmaz, servis çalışanı kurmaz. Anahtar yalnız telefonda bellekte kalır. Gerçek uygulamanın yedeğini buraya yüklemeyin. Fiziksel kullanım kabulü ayrı yapılır.\n'.encode()
args.output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(args.output,'w',compression=zipfile.ZIP_DEFLATED)as z:
 for name,data in sorted(files.items()):
  info=zipfile.ZipInfo(name,date_time=(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,data)
print(json.dumps({'output':str(args.output),'sourceSha':sha,'files':len(files),'sha256':hashlib.sha256(args.output.read_bytes()).hexdigest()}))

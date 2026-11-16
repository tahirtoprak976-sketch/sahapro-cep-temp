"""Synthetic v8 runtime, every write route and wet-original/backup protections."""
import sys,json,uuid
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8857/').rstrip('/')+'/'
assert urlparse(base).hostname in ('localhost','127.0.0.1')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':800});pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(base+'robots.txt?db=TEST_legal_'+uuid.uuid4().hex[:10])
 result=pg.evaluate('''async()=>{
 const E=await import('./js/enterprise-db.js'),D=await import('./js/db.js'),A=await import('./js/personnel-legal/api.js'),C=await import('./js/core.js');
 const p=await D.saveNew('personnel',{name:'TEST Çalışan',start_date:'2025-01-01',birth_date:'1990-01-01'},'TEST');
 const sub=await D.saveNew('personnel',{name:'TEST İkame',start_date:'2025-01-01',birth_date:'1990-01-01'},'TEST');
 const v=await D.saveNew('vehicles',{name:'TEST Makine',type:'Makine',assignee_id:p.id},'TEST');
 const customer=await D.saveNew('customers',{name:'TEST Müşteri'},'TEST');
 await A.saveProfile(p,{iseGirisTarihi:'2025-01-01',dogumTarihi:'1990-01-01',izinHesapAcilisi:{asOf:'2026-08-31',confirmedOn:'2026-11-16',years:[{yearKey:'2026-01-01',days:14,pieces:[]}]}});
 const expect=async(code,fn)=>{try{await fn()}catch(e){if(e.code===code||e.message.includes(code))return true;throw Error('Expected '+code+', got '+e.code+': '+e.message)}throw Error('Expected rejection '+code)};
 const fields={personelId:p.id,izinTuru:'yillik',izinHakYili:'2026-01-01',baslangicTarihi:'2026-09-01',bitisTarihi:'2026-09-08',isbasiTarihi:'2026-09-09'};
 const draft=await A.saveLeave(fields);if(draft.planDurumu!=='taslak'||!draft.warnings.includes('TEN_DAYS'))throw Error('draft warning');
 await expect('TEN_DAYS',()=>A.saveLeave(fields,{mode:'approval',current:draft}));
 let actual=await A.saveLeave(fields,{mode:'actual',current:draft});if(actual.dusulenIsGunu!==7||!actual.warnings.includes('TEN_DAYS'))throw Error('past actual must retain violation');
 await expect('STALE',()=>A.saveLeave(fields,{mode:'actual',current:draft}));
 actual=await A.saveLeave({...fields,santiyeAdi:'TEST Düzeltilen Şantiye'},{mode:'actual',current:actual});if(actual.balanceSnapshot.remaining!==7)throw Error('edit deducted leave twice');
 const shift={personelId:p.id,tarih:'2026-09-02',baslangicSaati:'08:00',bitisSaati:'17:00',araDinlenmeDakika:60,molaDogrulandi:true,gunTipi:'normal',makinePlakaId:v.id};
 await expect('ON_LEAVE',()=>A.saveAttendance(shift));
 const work={date:'2026-09-02',customer_id:customer.id,vehicle_id:v.id,work_type:'Makine Çalışması',quantity:1,unit:'Saat'};
 await expect('ON_LEAVE',()=>D.saveNew('work_records',work,'TEST'));
 await expect('ON_LEAVE',()=>D.saveWorkBatch([work,work].map(w=>({...w,work_type:'Hafriyat Nakliye',unit:'Sefer',dump_area:'TEST Döküm'}))));
 const raw=await D.openDB();
 const rawWrite=async(store,row)=>new Promise((yes,no)=>{const t=raw.transaction(store,'readwrite');t.objectStore(store).put(row);t.oncomplete=yes;t.onabort=()=>no(t.personnelFailure??t.error)});
 await expect('ON_LEAVE',()=>rawWrite('work_records',C.newRecord(work)));
 await expect('ON_LEAVE',()=>D.saveNew('personnel_events',{personnel_id:p.id,date:shift.tarih,event_type:'Çalıştı'},'TEST'));
 const replacement=await D.saveNew('work_records',{...work,personnel_id:sub.id},'TEST');if(replacement.personnel_id!==sub.id)throw Error('substitute ownership');
 await expect('LEGAL_ROUTE',()=>D.put('izin_kayitlari',{...actual,id:'TEST_forged',belgeDurumu:'imzali_arsiv'}));
 const original=new File(['%PDF-1.4\\nTEST wet-original placeholder\\nstartxref\\n0\\n%%EOF\\n'],'TEST signed.pdf',{type:'application/pdf'});
 actual=await A.archiveLeave(actual,original,{signaturesVerified:true,documentPurpose:'talep'});
 const originalLeave=JSON.stringify(actual),ack=await A.archiveUsageAcknowledgement(actual,original,{signaturesVerified:true});
 if(JSON.stringify(await D.get('izin_kayitlari',actual.id))!==originalLeave)throw Error('signed request rewritten by use acknowledgment');
 await expect('SIGNED_LOCK',()=>D.put('documents',{...ack,date:'2099-01-01'}));
 const att=await D.get('attachments',actual.imzaliBelgeData.attachmentId);if(await att.blob.text()!==await original.text())throw Error('original altered');
 await expect('SIGNED_LOCK',()=>D.put('izin_kayitlari',{...actual,dusulenIsGunu:0}));
 await expect('SIGNED_LOCK',()=>D.softDelete('izin_kayitlari',actual.id,'TEST'));
 await expect('SIGNED_LOCK',()=>rawWrite('attachments',{...att,name:'TEST changed'}));
 const hours=await A.saveAttendance({...shift,tarih:'2026-10-01',bitisSaati:'20:30'});if(hours.fiiliCalismaSaati!==11.5||!hours.warnings.includes('DAILY_11_HOURS'))throw Error('actual overtime truncated');
 await expect('STALE',()=>A.closeAttendance(hours,original,{signaturesVerified:true,expectedRows:[]}));
 await A.closeAttendance(hours,original,{signaturesVerified:true});
 await expect('SIGNED_LOCK',()=>A.saveAttendance({...shift,tarih:'2026-10-02'}));
 await expect('SIGNED_LOCK',()=>D.saveNew('work_records',{...work,personnel_id:p.id,date:'2026-10-02'},'TEST'));
 await expect('DEDUCTION',()=>E.savePayroll({personnel_id:p.id,date:'2026-11-01',period:'2026-11',kind:'Kesinti',amount:500,note:'TEST hasar'},'TEST_DEDUCTION'));
 // Simulate a real pre-v8 wage record, preserving its bytes through backup.
 const legacyCut=C.newRecord({id:'TEST_LEGACY_CUT',schema_version:7,personnel_id:p.id,date:'2026-08-01',period:'2026-08',kind:'Kesinti',amount:500,note:'TEST historical record; not a new approved deduction',legacy_custom:{keep:true}});
 await new Promise((yes,no)=>{const t=IDBDatabase.prototype.transaction.call(raw,'payroll_entries','readwrite');t.objectStore('payroll_entries').add(legacyCut);t.oncomplete=yes;t.onabort=()=>no(t.error)});
 const all=await D.dumpAll();if(all.work_records.length!==1||all.izin_kayitlari.length!==1||all.puantaj_kayitlari.length!==1)throw Error('rollback/batch count');
 const backup=await (await import('./js/backup.js')).fullBackup(D,{encrypted:false});
 return {backup,pid:p.id,version:raw.version,actualWithWarning:true,strictPlan:true,allWriterGuards:true,substituteOwnWork:true,originalBytes:true,signedLocks:true,overtimeActualPreserved:true,counts:{leaves:all.izin_kayitlari.length,attendance:all.puantaj_kayitlari.length}};
}''')
 backup=result.pop('backup');print(json.dumps(result),flush=True)
 restore=c.new_page();restore.goto(base+'robots.txt?db=TEST_restore_'+uuid.uuid4().hex[:10])
 outcome=restore.evaluate("""async backup=>{
 const D=await import('./js/db.js'),B=await import('./js/backup.js');
 await B.restoreBackup(D,structuredClone(backup));
 const data=await D.dumpAll(),files=await D.getAll('attachments');
 if(data.payroll_entries.length!==1||JSON.stringify(data.payroll_entries[0])!==JSON.stringify(backup.data.payroll_entries[0]))throw Error('historical wage record changed or lost');
 if(data.izin_kayitlari.length!==1||data.puantaj_kayitlari.length!==1||files.length!==3)throw Error('backup round trip lost records');
 const copy=structuredClone(backup);copy.attachments[0].base64=btoa('%PDF-1.4 altered bytes');copy.attachments[0].size=atob(copy.attachments[0].base64).length;
 let rejected=false;try{await B.restoreBackup(D,copy)}catch(e){rejected=e.code==='RESTORE_SIGNATURE'}if(!rejected)throw Error('tampered original accepted');
 const added=structuredClone(backup);added.data.puantaj_kayitlari.push({...added.data.puantaj_kayitlari[0],id:'TEST_CLOSED_INSERT',tarih:'2026-10-02'});
 rejected=false;try{await B.restoreBackup(D,added)}catch(e){rejected=e.code==='SIGNED_LOCK'}if(!rejected)throw Error('backup inserted into existing signed month');
 const modified=structuredClone(backup);modified.data.izin_kayitlari[0].rev++;modified.data.izin_kayitlari[0].updated_at='2099-01-01T00:00:00Z';
 rejected=false;try{await B.restoreBackup(D,modified,true)}catch(e){rejected=true}if(!rejected)throw Error('signed row replaced by backup');
 return {roundTrip:true,originalBytes:await files[0].blob.text(),tamperedOriginalRejected:true,signedBackupConflictRejected:true};
 }""",backup)
 print(json.dumps(outcome),flush=True)
 assert not errors,errors
 b.close()

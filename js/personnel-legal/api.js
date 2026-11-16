import {newRecord,nowISO,uuid,todayStr} from '../core.js';
import {legalCalendar} from './calendar.js';
import {prepareAttachment} from '../attachment-safety.js';
import {newLeaveDraft,newAttendanceDraft,validateAttendance,validateSignedArchive,assertUnlocked,legalDate} from './core.js';
import {active,effectiveLeave,prepareLeave,leaveLedger,error} from './workflow.js';
import {permitPersonnelWrite,personnelTransactionError} from './guard.js';
const readNames=['personnel','vehicles','work_records','personnel_events','izin_kayitlari','puantaj_kayitlari'];
async function write(store,id,expectedRev,action,callback){
 const db=await import('../db.js'),connection=await db.openDB();
 return new Promise((resolve,reject)=>{
  const tx=connection.transaction([...readNames,'attachments','audit_log'],'readwrite');
  permitPersonnelWrite(tx,{store,id,expectedRev,action,mode:action});
  const data={};let remaining=readNames.length,out,failed;
  for(const s of readNames){const q=tx.objectStore(s).getAll();q.onsuccess=()=>{data[s]=q.result;if(!--remaining)try{
   const current=data[store].find(r=>r.id===id);assertUnlocked(current);
   if(current&&current.rev!==expectedRev)error('STALE','Bu kayıt başka sekmede değişti; yenileyin');
   out=callback(data,current,tx);tx.objectStore(store).put(out);
   tx.objectStore('audit_log').add(newRecord({entity:store,entity_id:id,action:'personnel_'+action,old_value:current??null,new_value:out,reason:'Kullanıcının açık izin/puantaj işlemi'}));
  }catch(e){failed=e;tx.abort()}};}
  tx.oncomplete=()=>resolve(out);tx.onabort=tx.onerror=()=>reject(failed??personnelTransactionError(tx)??tx.error??Error('İşlem kaydedilemedi'));
 });
}
export function saveLeave(fields,{mode='draft',current=null}={}){
 const id=current?.id??uuid();return write('izin_kayitlari',id,current?.rev,mode,(data,fresh)=>{
  const row=newLeaveDraft(fields,{id,now:fresh?.olusturmaTarihi??nowISO()});
  const prepared=prepareLeave(data,row,{mode,current:fresh,today:todayStr()});
  return newRecord({...prepared,id,rev:(fresh?.rev??0)+1,created_at:fresh?.created_at??nowISO()});
 });
}
export function saveAttendance(fields,{current=null}={}){
 const id=current?.id??uuid();return write('puantaj_kayitlari',id,current?.rev,'attendance',(data,fresh)=>{
  const row={...newAttendanceDraft(fields,{id}),geceYarisiAsiyor:fields.geceYarisiAsiyor===true,molaDogrulandi:fields.molaDogrulandi===true};
  const valid=validateAttendance(row,{leaves:data.izin_kayitlari.filter(effectiveLeave),legacyEvents:data.personnel_events,existing:data.puantaj_kayitlari,personnel:data.personnel,current:fresh,calendar:legalCalendar,today:todayStr(),overnight:row.geceYarisiAsiyor,breakConfirmed:row.molaDogrulandi});
  if(!valid.confirmed)error('BREAK_CONFIRM','Fiilen kullanılan ara dinlenmesini doğrulayın');
  return newRecord({...valid,id,rev:(fresh?.rev??0)+1,created_at:fresh?.created_at??nowISO()});
 });
}
async function original(file,recordType,recordId){
 file=await prepareAttachment(file);
 if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))error('SIGNATURE','İmzalı belge PDF veya fotoğraf olmalı');
 const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');
 return {id:uuid(),record_type:recordType,record_id:recordId,name:file.name??'imzali-belge',type:file.type,size:file.size,blob:file,kind:'signed_original',src_sha256:sha256,created_at:nowISO()};
}
export async function archiveLeave(row,file,{signaturesVerified=false,documentPurpose='talep'}={}){
 const attachment=await original(file,'izin_kaydi',row.id);
 return write('izin_kayitlari',row.id,row.rev,'archive',(data,current,tx)=>{
  if(!current||current.planDurumu==='taslak')error('APPROVAL','Taslak imzalı arşive alınamaz; önce planı onaylayın veya fiilî kullanımı kaydedin');
  const archived=validateSignedArchive(current,{attachment:{id:attachment.id,owner_id:current.id,owner_type:'izin_kaydi',sha256:attachment.src_sha256,mime:attachment.type},signaturesVerified,documentPurpose,acknowledgedOn:todayStr()});
  tx.objectStore('attachments').add(attachment);return {...archived,rev:current.rev+1,updated_at:nowISO()};
 });
}
export async function closeAttendance(row,file,{signaturesVerified=false,expectedRows=[row]}={}){
 if(!signaturesVerified)error('SIGNATURE','İşçi ve işveren ıslak imzalarını kontrol edin');
 const attachment=await original(file,'puantaj_donemi',row.personelId+':'+row.tarih.slice(0,7));
 // Lock all existing rows and the entire person/month against later inserts.
 const db=await import('../db.js'),connection=await db.openDB();
 return new Promise((resolve,reject)=>{
  const tx=connection.transaction(['puantaj_kayitlari','attachments','audit_log'],'readwrite');let failed,count=0;
  const q=tx.objectStore('puantaj_kayitlari').getAll();q.onsuccess=()=>{try{
   const records=q.result.filter(r=>active(r)&&r.personelId===row.personelId&&r.tarih.slice(0,7)===row.tarih.slice(0,7));
   const scope=rows=>JSON.stringify(rows.map(r=>[r.id,r.rev]).sort((a,b)=>a[0].localeCompare(b[0])));
   if(scope(records)!==scope(expectedRows))error('STALE','Dönemin kayıtları kontrolünüzden sonra değişti; yenileyip tekrar inceleyin');
   if(!records.length||records.some(r=>r.donemKilitDurumu==='imzali_kapali'))error('SIGNED_LOCK','Dönem boş veya zaten kapalı');
   // Per-row permit is captured by the transaction guard at validation time.
   permitPersonnelWrite(tx,{store:'puantaj_kayitlari',action:'close',period:row.tarih.slice(0,7),personelId:row.personelId});
   tx.objectStore('attachments').add(attachment);
   for(const r of records){tx.objectStore('puantaj_kayitlari').put({...r,rev:r.rev+1,donemKilitDurumu:'imzali_kapali',imzaliBelgeData:{attachmentId:attachment.id,sha256:attachment.src_sha256},updated_at:nowISO()});count++;}
   tx.objectStore('audit_log').add(newRecord({entity:'puantaj_kayitlari',entity_id:row.personelId,action:'signed_period_close',reason:row.tarih.slice(0,7),new_value:{count,attachmentId:attachment.id}}));
  }catch(e){failed=e;tx.abort()}};
  tx.oncomplete=()=>resolve(count);tx.onabort=tx.onerror=()=>reject(failed??personnelTransactionError(tx)??tx.error??Error('Dönem kapanmadı'));
 });
}
export async function saveProfile(person,fields){
 legalDate(fields.iseGirisTarihi);legalDate(fields.dogumTarihi);
 if(fields.dogumTarihi>fields.iseGirisTarihi)error('BIRTH','Doğum tarihi işe girişten sonra olamaz');
 if(fields.izinHesapAcilisi){leaveLedger({izin_kayitlari:[],personnel_events:[]},{...person,...fields},fields.izinHesapAcilisi.asOf);}
 const db=await import('../db.js');return db.saveExisting('personnel',person,fields,'İzin/puantaj başlangıç bilgileri sahibi tarafından doğrulandı');
}
// A signed request stays immutable. Actual-use evidence is appended as a NEW
// document after the leave, rather than unlocking or rewriting the request.
export async function archiveUsageAcknowledgement(row,file,{signaturesVerified=false}={}){
 if(!signaturesVerified)error('SIGNATURE','İşçi ve işverenin iki ıslak imzasını doğrulayın');
 const id='legal-ack-'+row.id,attachment=await original(file,'legal_leave_ack',id),db=await import('../db.js'),connection=await db.openDB();
 return new Promise((resolve,reject)=>{
  const tx=connection.transaction(['izin_kayitlari','documents','attachments','audit_log'],'readwrite');
  permitPersonnelWrite(tx,{store:'documents',id,action:'acknowledge',sourceLeaveId:row.id});let failed,out;
  const q=tx.objectStore('izin_kayitlari').get(row.id);q.onsuccess=()=>{try{
   const current=q.result;
   if(!current||current.rev!==row.rev)error('STALE','İzin kaydı değişti; yenileyin');
   if(current.belgeDurumu!=='imzali_arsiv'||current.imzaliBelgeData?.documentPurpose!=='talep'||todayStr()<current.bitisTarihi)error('FUTURE_ACK','Yalnız bitmiş, imzalı talebin kullanım mutabakatı ayrıca arşivlenebilir');
   out=newRecord({id,category:'İzin Kullanım Mutabakatı',doc_no:'IZ-MUT-'+row.id.slice(0,8),date:todayStr(),owner_type:'personnel',owner_id:current.personelId,personnel_id:current.personelId,legal_leave_ack:true,legal_leave_id:current.id,legal_source_revision:current.rev,imzaliBelgeData:{attachmentId:attachment.id,sha256:attachment.src_sha256,documentPurpose:'kullanim_mutabakati'}});
   tx.objectStore('documents').add(out);tx.objectStore('attachments').add(attachment);
   tx.objectStore('audit_log').add(newRecord({entity:'documents',entity_id:id,action:'leave_usage_acknowledged',new_value:out,reason:'İmzalı talep değiştirilmeden kullanım ve bakiye mutabakatı eklendi'}));
  }catch(e){failed=e;tx.abort()}};
  tx.oncomplete=()=>resolve(out);tx.onabort=tx.onerror=()=>reject(failed??personnelTransactionError(tx)??tx.error??Error('Mutabakat kaydedilemedi'));
 });
}

import {todayStr} from '../core.js';
import {legalCalendar} from './calendar.js';
// One per-connection transaction boundary: also covers batch, driver, assistant,
// imports and enterprise writers. No global prototype patch or second database.
import {assertUnlocked,validateAttendance,legalDate} from './core.js';
import {active,effectiveLeave,personWork,prepareLeave,error} from './workflow.js';
const permits=new WeakMap(),errors=new WeakMap();
export const permitPersonnelWrite=(tx,permit)=>permits.set(tx,permit);
export const personnelTransactionError=tx=>errors.get(tx)??tx?.personnelFailure;
const legalStores=['izin_kayitlari','puantaj_kayitlari'];
const protectedStores=[...legalStores,'work_records','personnel_events','payroll_entries','personnel','attachments','documents'];
const unchanged=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const labourFields=['personnel_id','vehicle_id','date','deleted_at','event_type','leave_kind','hours_days','personelId','tarih'];
const relatedChange=(a,b)=>!a||labourFields.some(k=>!unchanged(a?.[k],b?.[k]));
export function installPersonnelGuard(db){
 if(db.__personnelGuard)return db;
 Object.defineProperty(db,'__personnelGuard',{value:true});
 // Delegate at call time, preserving native instrumentation/read-error paths.
 const native=(...args)=>Reflect.apply(IDBDatabase.prototype.transaction,db,args);
 db.transaction=function(stores,mode='readonly',options){
  const names=typeof stores==='string'?[stores]:Array.from(stores);
  if(mode!=='readwrite'||!names.some(s=>protectedStores.includes(s)))return native(stores,mode,options);
  const readNames=new Set(['izin_kayitlari','puantaj_kayitlari','personnel_events','personnel','vehicles']);
  if(names.some(s=>legalStores.includes(s)||s==='personnel_events'))readNames.add('work_records');
  if(names.some(s=>s==='documents'||s==='attachments'))readNames.add('documents');
  const tx=native([...new Set([...names,...readNames])],mode,options),objectStore=tx.objectStore.bind(tx),state={},pending=[],initialClosedPeriods=new Set();let left=readNames.size;
  const abort=e=>{errors.set(tx,e);tx.personnelFailure=e;try{tx.abort()}catch{}};
  // Reads precede every writer request in this transaction. In-memory state is
  // advanced after each successful request so a batch cannot bypass conflicts.
  for(const name of readNames){const q=objectStore(name).getAll();q.addEventListener('success',()=>{state[name]=q.result;if(name==='puantaj_kayitlari')for(const r of q.result)if(active(r)&&r.donemKilitDurumu==='imzali_kapali')initialClosedPeriods.add(r.personelId+':'+r.tarih.slice(0,7));if(!--left)for(const f of pending.splice(0))f()});}
  const validate=(name,before,row,operation)=>{
   const permission=permits.get(tx),now=todayStr();
   if(legalStores.includes(name)){
    const changed=!before||!unchanged(before,row);
    if(row&&changed&&name==='puantaj_kayitlari'&&initialClosedPeriods.has(row.personelId+':'+row.tarih.slice(0,7)))error('SIGNED_LOCK','İmzalı döneme yedekle de puantaj eklenemez/değiştirilemez');
    if(row&&changed&&name==='izin_kayitlari'&&effectiveLeave(row))for(const key of initialClosedPeriods){const [pid,month]=key.split(':');if(pid===row.personelId&&row.baslangicTarihi.slice(0,7)<=month&&row.bitisTarihi.slice(0,7)>=month)error('SIGNED_LOCK','İmzalı puantaj döneminin izin/rapor bilgisi değiştirilemez');}

    if(before&&!unchanged(before,row))assertUnlocked(before);
    if(permission?.restore){
     if(before&&!unchanged(before,row))error('RESTORE_LOCK','İzin/puantaj geçmişi yedekle değiştirilemez; mevcut kayıt korunur');
     if(row&&(!row.id||!row.personelId||!(state.personnel||[]).some(p=>!p.deleted_at&&p.id===row.personelId)))error('RESTORE_LEGAL','İzin/puantaj yedeğinde kimlik/personel eksik');
     return;
    }
    const closing=permission?.action==='close'&&name==='puantaj_kayitlari'&&permission.personelId===row?.personelId&&permission.period===row?.tarih?.slice(0,7);
    if(permission?.store!==name||!closing&&permission?.id!==(row?.id??before?.id))error('LEGAL_ROUTE','İzin/puantaj kaydı kendi doğrulanmış ekranından yapılmalı');
    if(before&&!closing&&before.rev!==permission.expectedRev)error('STALE','Kayıt başka sekmede değişti; yenileyin');
    if(operation==='delete'||!active(row))error('LEGAL_DELETE','İzin/puantaj kaydı silinmez; ayrı gerekçeli düzeltme gerekir');
    if(name==='izin_kayitlari'&&permission.action!=='archive'){
     const expected=prepareLeave(state,row,{mode:permission.mode,today:now,current:before});
     for(const key of ['dusulenIsGunu','warnings','planDurumu','kayitSekli','balanceSnapshot','hesapTakvimi'])if(!unchanged(expected[key],row[key]))error('LEGAL_RECALC','İzin hesabı doğrulanamadı');
     if(row.belgeDurumu!=='imza_bekliyor'||row.imzaliBelgeData)error('SIGNATURE','İmzalı arşiv yalnız belge yükleme akışından açılabilir');
    }
    if(name==='puantaj_kayitlari'&&permission.action!=='close'){
     const expected=validateAttendance(row,{leaves:(state.izin_kayitlari||[]).filter(effectiveLeave),legacyEvents:state.personnel_events,existing:state.puantaj_kayitlari,personnel:state.personnel,current:before,calendar:legalCalendar,today:now,overnight:row.geceYarisiAsiyor,breakConfirmed:row.molaDogrulandi});
     if(!expected.confirmed||!unchanged(expected.fiiliCalismaSaati,row.fiiliCalismaSaati)||row.fazlaMesaiSaati!==null||row.donemKilitDurumu!=='acik')error('HOURS','Puantaj saatleri doğrulanamadı');
    }
    return;
   }
   if(name==='documents'){
    if(before?.legal_leave_ack&&!unchanged(before,row))error('SIGNED_LOCK','İmzalı kullanım mutabakatı değiştirilemez/silinemez');
    if(row?.legal_leave_ack&&!permission?.restore){
     const leave=(state.izin_kayitlari||[]).find(l=>l.id===row.legal_leave_id);
     if(permission?.action!=='acknowledge'||permission.id!==row.id||permission.sourceLeaveId!==leave?.id||leave?.belgeDurumu!=='imzali_arsiv'||leave.imzaliBelgeData?.documentPurpose!=='talep'||leave.bitisTarihi>now||row.legal_source_revision!==leave.rev||row.owner_id!==leave.personelId)error('ACK_ROUTE','Kullanım mutabakatı kendi doğrulanmış belge akışından arşivlenmeli');
    }
   }
   if(name==='personnel'&&before&&(!row||row.deleted_at)&&(state.izin_kayitlari||[]).concat(state.puantaj_kayitlari||[]).some(r=>r.personelId===before.id))error('PERSONNEL_HISTORY','İzin/puantaj geçmişi olan personel silinemez; kayıtları korunmalı');
   if(name==='personnel'&&before&&row&&['izinHesapAcilisi','iseGirisTarihi','dogumTarihi'].some(k=>!unchanged(before[k],row[k]))&&(state.izin_kayitlari||[]).some(r=>active(r)&&r.personelId===row.id))error('OPENING_LOCK','İzin kaydı bulunan personelin açılışı değiştirilmez; gerekçeli mutabakat gerekir');
   if(name==='attachments'&&before){
    if((state.izin_kayitlari||[]).some(r=>r.imzaliBelgeData?.attachmentId===before.id)||(state.puantaj_kayitlari||[]).some(r=>r.imzaliBelgeData?.attachmentId===before.id)||(state.documents||[]).some(r=>r.legal_leave_ack&&r.imzaliBelgeData?.attachmentId===before.id))error('SIGNED_LOCK','İmzalı arşivin orijinal dosyası değiştirilemez/silinemez');
   }
   if(name==='payroll_entries'&&active(row)&&row.kind==='Kesinti'&&!permission?.restore&&!unchanged(before,row))error('DEDUCTION','Tek taraflı ceza/hasar kesintisi kapalıdır. Belgeli avansı Avans ekranında izleyin; uyuşmazlık mahsupları somut hukuki inceleme gerektirir');
   if(!['work_records','personnel_events'].includes(name)||!relatedChange(before,row))return;
   if(name==='personnel_events'&&active(row)&&row.event_type==='İzin'&&row.leave_kind==='Yıllık izin'&&row.date>=now&&!permission?.restore)error('LEAVE_ROUTE','Yeni yıllık izin planını İzin ve Puantaj → Yeni izin ekranından onaylayın');
   const affected=[before,row].filter(Boolean);
   for(const r of affected){
    if(name==='personnel_events'&&!['Çalıştı','Yarım Gün','Mesai','İzin','Rapor','Devamsızlık'].includes(r.event_type))continue;
    const workers=r.personnel_id?[r.personnel_id]:personWork({...state,work_records:[r]}).map(w=>w.personnel_id);
    for(const pid of workers){
     if((state.puantaj_kayitlari||[]).some(t=>active(t)&&t.personelId===pid&&t.donemKilitDurumu==='imzali_kapali'&&t.tarih.slice(0,7)===r.date?.slice(0,7)))error('SIGNED_LOCK','Personelin imzalı puantaj dönemi değiştirilemez');
     if(!active(row)||permission?.restore)continue; // Restore historical facts; never approve/rewrite them. Signed-month check above still applies.
     const date=legalDate(row.date);
     const isLeave=name==='personnel_events'&&['İzin','Rapor'].includes(row.event_type);
     if(!isLeave&&(state.izin_kayitlari||[]).some(l=>effectiveLeave(l)&&l.personelId===pid&&l.baslangicTarihi<=date&&l.bitisTarihi>=date))error('ON_LEAVE','Personel bu tarihte izinli/raporlu, puantaj girilemez');
     if(!isLeave&&(state.personnel_events||[]).some(l=>active(l)&&l.id!==row.id&&l.personnel_id===pid&&['İzin','Rapor'].includes(l.event_type)&&l.date===date))error('ON_LEAVE','Personel bu tarihte izinli/raporlu, puantaj girilemez');
     if(isLeave&&(personWork(state).some(w=>w.personnel_id===pid&&w.date===date)||(state.puantaj_kayitlari||[]).some(t=>active(t)&&t.personelId===pid&&t.tarih===date)))error('LEAVE_WORK','Bu tarihte çalışma var; kayıt otomatik silinmez');
    }
   }
  };
  const wrapped=new Map();
  tx.objectStore=function(name){
   if(wrapped.has(name))return wrapped.get(name);
   const store=objectStore(name);wrapped.set(name,store);
   if(!protectedStores.includes(name))return store;
   for(const method of ['add','put','delete','clear']){
    const write=store[method].bind(store);
    store[method]=function(value,...rest){
     // Capture caller's object now: later form mutations must not alter validation.
     const captured=method==='add'||method==='put'?structuredClone(value):null;
     const key=captured?.id??value;
     let before;
     const read=method==='clear'?store.getAll():store.get(key);
     read.addEventListener('success',()=>{before=read.result});
     const request=method==='clear'?write():write(value,...rest);
     request.addEventListener('success',()=>{
      const check=()=>{try{
       if(method==='clear'){for(const old of before||[])validate(name,old,null,'delete');state[name]=[];}
       else {validate(name,before,captured,method);if(state[name]){state[name]=state[name].filter(r=>r.id!==key);if(captured)state[name].push(captured);}}
      }catch(e){abort(e)}};
      if(left)pending.push(check);else check();
     });return request;
    };
   }
   return store;
  };
  return tx;
 };
 return db;
}

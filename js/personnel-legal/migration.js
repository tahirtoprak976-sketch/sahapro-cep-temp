// Prepared v7 -> v8 upgrade. Not activated by openDB until all writers, backup,
// restore and UI adapters support the new stores. Never rewrite legacy rows.
export const PERSONNEL_LEGAL_SCHEMA_VERSION=8;
export const PERSONNEL_LEGAL_STORES=['izin_kayitlari','puantaj_kayitlari'];
export const PERSONNEL_LEGAL_FIELDS=['iseGirisTarihi','dogumTarihi','devredenIzinBakiye','hakEdilenYillikIzin','kullanilanYillikIzin','kalanYillikIzin','fazlaMesaiMuvafakatTarihi','yillikFazlaMesaiSaat'];
export function upgradePersonnelLegal(db,transaction,oldVersion){
 if(!Number.isInteger(oldVersion)||oldVersion<0||oldVersion>=8)throw Error('Beklenmeyen geçiş sürümü');
 if(transaction.mode!=='versionchange')throw Error('Şema yalnız sürüm geçişi içinde eklenebilir');
 if(!db.objectStoreNames.contains('personnel'))throw Error('Mevcut personel deposu bulunamadı; temel geçiş önce çalışmalı');
 for(const name of PERSONNEL_LEGAL_STORES){
  const store=db.objectStoreNames.contains(name)?transaction.objectStore(name):db.createObjectStore(name,{keyPath:'id'});
  if(store.keyPath!=='id')throw Error('Depo anahtarı uyumsuz; geçiş iptal edilmeli');
  const indexes=name==='izin_kayitlari'?['personelId','baslangicTarihi','bitisTarihi','belgeDurumu','izinHakYili']:['personelId','tarih','donemKilitDurumu'];
  for(const key of indexes)if(!store.indexNames.contains(key))store.createIndex(key,key,{unique:false});
 }
 // No cursor/update/put: old personnel/events/work/attachments stay byte-identical.
}

export const PERSONNEL_LEGAL_ASSETS=['./js/personnel-legal/core.js','./js/personnel-legal/migration.js'];
export function assertPersonnelLegalActivation({schemaVersion,backupStores=[],restoreStores=[],swAssets=[],guardedWriters=[],legacyBridgeReady=false}){
 if(schemaVersion!==8||!legacyBridgeReady||PERSONNEL_LEGAL_STORES.some(s=>!backupStores.includes(s)||!restoreStores.includes(s))||PERSONNEL_LEGAL_ASSETS.some(s=>!swAssets.includes(s))||['leave','attendance','work_records','personnel_events','assistant','import'].some(s=>!guardedWriters.includes(s)))throw Error('İzin/puantaj geçişi: yedek, geri yükleme, çevrimdışı dosyalar ve bütün yazma kapıları tamamlanmadan etkinleştirilemez');
 return true;
}

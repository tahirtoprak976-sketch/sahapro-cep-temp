import {buildBackup,buildZip} from './core.js';
export const ARCHIVE_LIMIT=60*1024*1024;
// Manual, unencrypted archive. Every attachment is required; no partial success.
export async function backupArchive(snapshot,{budget=ARCHIVE_LIMIT}={}){
 if(!Number.isSafeInteger(budget)||budget<1024||budget>ARCHIVE_LIMIT)throw Error('Arşiv boyut sınırı geçersiz');
 const enc=new TextEncoder(),atts=snapshot.attachments;
 if(atts.some(a=>!(a.blob instanceof Blob)))throw Error('Arşivde bir dosya okunamadı. Eksik ZIP oluşturulmadı; Tam Yedek yolunu kontrol edin.');
 const safe=s=>String(s||'ek').replace(/[^\w.-]+/g,'_').slice(0,120);
 const index=atts.map((a,i)=>({id:a.id,record_type:a.record_type,record_id:a.record_id,name:a.name,type:a.type,size:a.blob.size,path:`ekler/${i+1}_${safe(a.id)}_${safe(a.name)}`}));
 const payload=buildBackup(snapshot.data,snapshot.meta.find(m=>m.key==='device_install_id')?.value||'',snapshot.captured_at);
 const files=[{name:'kayitlar.json',data:enc.encode(JSON.stringify(payload))},{name:'arsiv_dizini.json',data:enc.encode(JSON.stringify({format:'SAHAPRO-manual-archive',version:1,encrypted:false,captured_at:snapshot.captured_at,restore_hint:'Otomatik geri yükleme için Tam Yedek (.sahapro) kullanın. Bu ZIP manuel arşivdir.',draft_files_included:false,driver_phone_queue_included:false,attachments:index}))}];
 const estimate=files.reduce((n,f)=>n+f.data.byteLength,0)+index.reduce((n,a)=>n+a.size,0)+[...files.map(f=>f.name),...index.map(a=>a.path)].reduce((n,name)=>n+76+2*enc.encode(name).byteLength,22);
 if(estimate>budget)throw Error('Arşiv ZIP 60 MB sınırına sığmıyor. Eksik ZIP oluşturulmadı; parçalı Tam Yedek (.sahapro) kullanın.');
 for(let i=0;i<atts.length;i++){
  try { const bytes=new Uint8Array(await atts[i].blob.arrayBuffer());if(bytes.byteLength!==index[i].size)throw Error('boyut uyuşmuyor');files.push({name:index[i].path,data:bytes}); }
  catch(e){throw Error('Arşiv dosyası okunamadı: '+(atts[i].name||atts[i].id)+'. Eksik ZIP oluşturulmadı.');}
 }
 const zip=buildZip(files);
 if(zip.byteLength>budget)throw Error('Arşiv ZIP sınırı aşıldı; parçalı Tam Yedek kullanın.');
 return {blob:new Blob([zip],{type:'application/zip'}),count:atts.length,index};
}

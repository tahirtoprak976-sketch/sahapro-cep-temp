import {legalDate,LEAVE_TYPES,attendanceHours} from './core.js';
import {active,error} from './workflow.js';
// Read-only validation; never repairs or assigns a year to a historical record.
export async function validatePersonnelRestore(data,attachments,{pendingParts=false}={}){
 const people=new Set((data.personnel||[]).filter(active).map(p=>p.id));
 const originals=new Map(attachments.map(a=>[a.id,a]));
 for(const name of ['izin_kayitlari','puantaj_kayitlari'])for(const row of data[name]||[]){
  if(!row.id||!people.has(row.personelId))error('RESTORE_LEGAL','İzin/puantaj kaydının personeli eksik');
  if(name==='izin_kayitlari'){
   legalDate(row.baslangicTarihi);legalDate(row.bitisTarihi);legalDate(row.isbasiTarihi);
   if(!LEAVE_TYPES.includes(row.izinTuru)||row.bitisTarihi<row.baslangicTarihi||row.isbasiTarihi<=row.bitisTarihi||!['taslak','onayli','fiili'].includes(row.planDurumu)||!['imza_bekliyor','imzali_arsiv'].includes(row.belgeDurumu)||typeof row.dusulenIsGunu!=='number'||!Number.isFinite(row.dusulenIsGunu)||row.dusulenIsGunu<0)error('RESTORE_LEGAL','İzin yedeğinin tarih/tür/durum/gün hesabı geçersiz');
   if(row.izinTuru==='yillik'&&(!Array.isArray(row.hesapTakvimi)||row.hesapTakvimi.reduce((n,x)=>n+x.charged,0)!==row.dusulenIsGunu))error('RESTORE_LEGAL','İzin yedeğinde gün dökümü yok veya tutarsız');
  }else{
   legalDate(row.tarih);const h=attendanceHours(row,{overnight:row.geceYarisiAsiyor,breakConfirmed:row.molaDogrulandi});
   if(!h.confirmed||h.fiiliCalismaSaati!==row.fiiliCalismaSaati||!['acik','imzali_kapali'].includes(row.donemKilitDurumu))error('RESTORE_LEGAL','Puantaj yedeğinde fiilî saat/durum tutarsız');
  }
  if(row.belgeDurumu==='imzali_arsiv'||row.donemKilitDurumu==='imzali_kapali'){
   const ref=row.imzaliBelgeData,a=originals.get(ref?.attachmentId);
   if(!ref||!/^([a-f0-9]{64})$/i.test(ref.sha256??''))error('RESTORE_SIGNATURE','İmzalı kayıt belge özeti eksik');
   if(!a){if(pendingParts)continue;error('RESTORE_SIGNATURE','İmzalı orijinal belge yedekte yok; ekleri içeren yedek kullanın');}
   const expectedType=name==='izin_kayitlari'?'izin_kaydi':'puantaj_donemi',expectedId=name==='izin_kayitlari'?row.id:row.personelId+':'+row.tarih.slice(0,7);
   if(a.record_type!==expectedType||a.record_id!==expectedId||!a.blob)error('RESTORE_SIGNATURE','İmzalı belge başka kayda bağlı');
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await a.blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');
   if(hash!==ref.sha256)error('RESTORE_SIGNATURE','İmzalı orijinal belge özeti uyuşmuyor');
  }
 }
 return true;
}

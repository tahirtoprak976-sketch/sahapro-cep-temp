import {kindName} from './workflow.js';
export function leaveDocument(row,person,{purpose='talep',today,companyName='İşveren'}={}){
 if(purpose==='kullanim_mutabakati'&&(!today||today<row.bitisTarihi))throw Error('Gelecekteki izin için kullanım beyanı üretilemez');
 const b=row.balanceSnapshot;
 const title=row.izinTuru==='yillik'?(purpose==='talep'?'Yıllık Ücretli İzin Talep Formu':'Yıllık Ücretli İzin Kullanım ve Bakiye Mutabakat Formu'):'Personel İzin / Rapor Formu';
 return {title,audience:'internal',template:'personnel_activity',filename:'izin-'+row.id+'.pdf',subtitle:companyName,sections:[
 {title:'Personel ve izin',pairs:[['Ad Soyad',person.name],['T.C. Kimlik No',person.identity_number??'________________'],['İzin türü',kindName[row.izinTuru]],['Başlangıç / Bitiş',row.baslangicTarihi+' / '+row.bitisTarihi],['İşbaşı',row.isbasiTarihi],['Yıllık izinden düşen iş günü',String(row.dusulenIsGunu)],['İkame / Makine',row.ikameOperatorId?'İkame personel: '+(row.ikameAdi??'________________'):'________________'],['Kayıt',row.id+' · r'+row.rev]]},
 ...(b?[{title:'İzin bakiye mutabakatı (gün)',headers:['Önceki devir','Yeni hak ediş','Önceki kullanım / plan','Bu izin','Kalan'],rows:[[b.carry,b.earned,b.priorUsed,b.thisLeave,b.remaining].map(String)]}]:[]),
 {title:'Beyan',text:purpose==='talep'?'Yukarıdaki tarihler için izin talep ediyorum. Bu form iznin fiilen kullanıldığına ilişkin beyan içermez.':'Yukarıdaki tarihlerde yıllık iznimi kullandığımı ve bu formdaki kalan izin bakiyesini kontrol ettiğimi beyan ederim. Bu belge kanuni haklardan feragat veya ibraname değildir.'},
 {title:'Islak imzalar',headers:['İşçi Ad Soyad / T.C. / İmza','İşveren İmza / Kaşe'],rows:[[person.name+'\nT.C.: '+(person.identity_number??'________________')+'\n\nİmza: __________________',companyName+'\n\n\nİmza / Kaşe: __________________']]},
 ...(row.warnings?.length?[{title:'Kontrol notu',text:'10 günlük bölünmez parça şartına aykırılık kaydı vardır. Fiilî kullanımın kaydı bu aykırılığı hukuka uygun hale getirmez.'}]:[])
 ]};
}
export function attendanceDocument(rows,person,period,{companyName='İşveren'}={}){
 return {title:'Personel Puantaj Mutabakatı',audience:'internal',template:'personnel_activity',filename:'puantaj-'+period+'.pdf',subtitle:companyName+' · '+person.name+' · '+period,sections:[
 {headers:['Tarih','Başlangıç','Bitiş','Ara (dk)','Fiilî (sa)','Gün'],rows:rows.filter(r=>r.personelId===person.id&&r.tarih.startsWith(period)&&!r.deleted_at).sort((a,b)=>a.tarih.localeCompare(b.tarih)).map(r=>[r.tarih,r.baslangicSaati,r.bitisSaati,String(r.araDinlenmeDakika),String(r.fiiliCalismaSaati),r.gunTipi])},
 {text:'Yalnız kayıtlı saatler listelenmiştir. Kayıtsız günler çalışılmadı kabul edilmez. Bu belge ücret ibrası veya haklardan feragat değildir. UBGT, hafta tatili ve fazla çalışma ücretleri ayrıca değerlendirilir.'},
 {headers:['İşçi Ad Soyad / T.C. / İmza','İşveren İmza / Kaşe'],rows:[[person.name+'\nT.C.: '+(person.identity_number??'________________')+'\n\nİmza: __________________',companyName+'\n\n\nİmza / Kaşe: __________________']]}
 ]};
}

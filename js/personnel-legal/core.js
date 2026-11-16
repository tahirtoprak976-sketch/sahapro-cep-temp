// Pure draft validation. Does not create records, deduct salary or claim that an
// upload proves a wet signature. Call within the eventual shared write transaction.
const active=r=>r&&!r.deleted_at&&r.active!==false&&r.iptal!==true;
export const LEAVE_TYPES=['yillik','mazeret','rapor','ucretsiz','yol'];
const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
export function legalDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail('DATE','Geçerli tarih girin');
 const d=new Date(value+'T12:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==value)fail('DATE','Geçersiz takvim tarihi');return value;
}
const add=(s,n)=>{const d=new Date(legalDate(s)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const fullYears=(a,b)=>{legalDate(a);legalDate(b);return Number(b.slice(0,4))-Number(a.slice(0,4))-(b.slice(5)<a.slice(5)?1:0);};
const nonnegative=(x,name)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<0)fail('NUMBER',name+' doğrulanmış, sıfır veya pozitif sayı olmalı');return x;};
export function annualEntitlement(person,on){
 legalDate(on);const start=legalDate(person.iseGirisTarihi??person.start_date);
 if(start>on)return {years:0,days:0,eligible:false};
 const years=fullYears(start,on);if(years<1)return {years,days:0,eligible:false};
 const birth=legalDate(person.dogumTarihi??person.birth_date);if(birth>start)fail('BIRTH','Doğum tarihi işe girişten sonra olamaz');
 const age=fullYears(birth,on);let days=years<=5?14:years<15?20:26;
 if(age<=18||age>=50)days=Math.max(days,20);
 return {years,age,days,eligible:true,specialRegime:age<18};
}
export function annualBalance({carryForward,earned,used,reserved=0}){
 for(const [k,v]of Object.entries({carryForward,earned,used,reserved}))nonnegative(v,k);
 return {devredenIzinBakiye:carryForward,hakEdilenYillikIzin:earned,kullanilanYillikIzin:used,kalanYillikIzin:carryForward+earned-used-reserved};
}
// calendar must explicitly cover every year, including religious/half-day holidays.
// A missing calendar is not evidence that a day is an ordinary working day.
export function chargeableLeaveDays(from,to,{calendar,weeklyRestDays=[0],halfDayPolicy}={}){
 legalDate(from);legalDate(to);if(to<from)fail('RANGE','Bitiş başlangıçtan önce olamaz');
 if(!weeklyRestDays.length||weeklyRestDays.some(d=>!Number.isInteger(d)||d<0||d>6))fail('REST','Hafta tatili günü doğrulanmalı');
 const rows=[];for(let day=from,n=0;day<=to;day=add(day,1),n++){
  if(n>1100)fail('RANGE','İzin aralığı çok uzun');
  if(!calendar?.coveredYears?.includes(Number(day.slice(0,4))))fail('CALENDAR','Bu yılın doğrulanmış resmî/dinî tatil takvimi eksik');
  const supplied=calendar.holidays?.[day]??0;if(![0,.5,1].includes(supplied))fail('CALENDAR','Tatil günü oranı geçersiz');
  const md=day.slice(5),fixed=['01-01','04-23','05-01','05-19','07-15','08-30','10-29'].includes(md)?1:md==='10-28'?.5:0;
  const holiday=Math.max(fixed,supplied);
  if(holiday===.5&&!['fraction','exclude_whole_day'].includes(halfDayPolicy))fail('HALF_DAY','Yarım gün tatili için izin hesabı politikası doğrulanmalı');
  const rest=weeklyRestDays.includes(new Date(day+'T12:00:00Z').getUTCDay());
  rows.push({date:day,charged:rest||holiday===1||holiday===.5&&halfDayPolicy==='exclude_whole_day'?0:1-holiday});
 }
 return {days:rows.reduce((n,r)=>n+r.charged,0),rows};
}
export function validateAnnualSplit({pieces,proposed,remainingAfter,closeYear=false}){
 const all=[...pieces,proposed];all.forEach(n=>nonnegative(n,'İzin parçası'));nonnegative(remainingAfter,'Kalan izin');
 const hasTen=all.some(n=>n>=10);
 if(!hasTen&&(remainingAfter<10||closeYear))fail('TEN_DAYS','İzin yılındaki parçalardan en az biri 10 gün olmalı; kalan bakiyede bu parça için yer bırakın');
 return {hasTen,pendingTenDayPart:!hasTen};
}
export function validateLeave(row,{person,calendar,weeklyRestDays,halfDayPolicy,availableDays,yearAllocation,otherLeaves=[],workRows=[],personnel=[],closeYear=false,current=null}){
 assertUnlocked(current);
 if(!row.id||!row.personelId||!active(person)||row.personelId!==person.id||!LEAVE_TYPES.includes(row.izinTuru))fail('LEAVE','Personel/izin türü doğrulanmalı');
 const from=legalDate(row.baslangicTarihi),to=legalDate(row.bitisTarihi);if(to<from)fail('RANGE','İzin tarihleri ters');
 if(legalDate(row.isbasiTarihi)<=to)fail('RETURN','İşbaşı tarihi izin bitişinden sonra olmalı');
 if(otherLeaves.filter(active).some(r=>r.id!==row.id&&r.personelId===person.id&&r.baslangicTarihi<=to&&r.bitisTarihi>=from))fail('OVERLAP','İzin kayıtları çakışıyor');
 if(workRows.filter(active).some(r=>(r.personelId??r.personnel_id)===person.id&&(r.tarih??r.date)>=from&&(r.tarih??r.date)<=to))fail('LEAVE_WORK','Bu tarihlerde çalışma kaydı var; geçmiş çalışma otomatik silinmez');
 let days=0;
 if(row.izinTuru==='yillik'){
  if(!annualEntitlement(person,from).eligible)fail('TENURE','Bir yıl dolmadan yıllık ücretli izin girilemez');
  days=chargeableLeaveDays(from,to,{calendar,weeklyRestDays,halfDayPolicy}).days;
  if(!days)fail('ZERO_LEAVE','Düşülecek yıllık izin günü yok');nonnegative(availableDays,'Mevcut izin bakiyesi');
  if(days>availableDays)fail('BALANCE','Yıllık izin bakiyesi yetersiz');
  if(!row.izinHakYili||yearAllocation?.yearKey!==row.izinHakYili||yearAllocation.personelId!==person.id)fail('LEAVE_YEAR','İznin mahsup edileceği hak yılı ayrıca seçilmeli');
  legalDate(row.izinHakYili);const hire=legalDate(person.iseGirisTarihi??person.start_date);
  if(row.izinHakYili>from||fullYears(hire,row.izinHakYili)<1||row.izinHakYili.slice(5)!==hire.slice(5))fail('LEAVE_YEAR','Hak yılı kazanılmış hizmet yıldönümüne bağlanmalı');
  nonnegative(yearAllocation.availableDays,'Seçili hak yılı bakiyesi');
  if(days>yearAllocation.availableDays)fail('BALANCE','Seçili hak yılının bakiyesi yetersiz');
  if(!Array.isArray(yearAllocation.pieces)||yearAllocation.pieces.some(r=>r.yearKey!==row.izinHakYili||r.personelId!==person.id))fail('LEAVE_YEAR','Farklı yılların/personellerin izin parçaları birleştirilemez');
  validateAnnualSplit({pieces:yearAllocation.pieces.map(r=>r.days),proposed:days,remainingAfter:yearAllocation.availableDays-days,closeYear});
 }
 if(row.ikameOperatorId){
  if(row.ikameOperatorId===person.id||!personnel.some(p=>active(p)&&p.id===row.ikameOperatorId))fail('SUBSTITUTE','Geçerli ikame operatör seçin');
  if(otherLeaves.filter(active).some(r=>r.personelId===row.ikameOperatorId&&r.baslangicTarihi<=to&&r.bitisTarihi>=from))fail('SUBSTITUTE','İkame operatör de izinli/raporlu');
  if(workRows.filter(active).some(r=>(r.personelId??r.personnel_id)===row.ikameOperatorId&&(r.tarih??r.date)>=from&&(r.tarih??r.date)<=to))fail('SUBSTITUTE','İkame operatörün aynı tarihte başka çalışması var; saat/makine çakışmasını çözün');
 }
 return {...row,dusulenIsGunu:days,belgeDurumu:'imza_bekliyor',imzaliBelgeData:null}; // Never trust the caller's cached deduction.
}
const time=s=>{if(typeof s!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))fail('TIME','Saat HH:MM biçiminde olmalı');return Number(s.slice(0,2))*60+Number(s.slice(3));};
export function minimumBreak(netMinutes){return netMinutes<=240?15:netMinutes<=450?30:60;}
export function attendanceHours(row,{overnight=false,breakConfirmed=false}={}){
 legalDate(row.tarih);let span=time(row.bitisSaati)-time(row.baslangicSaati);
 if(span>0&&overnight)fail('SHIFT','Gece vardiyası seçimi 24 saati aşan bir aralık oluşturuyor');
 if(span<=0){if(!overnight)fail('OVERNIGHT','Gece yarısını aşan vardiya açıkça belirtilmeli');span+=1440;}
 if(span<=0||span>=1440)fail('SHIFT','Vardiya 0–24 saat arasında olmalı');
 const recommended=[15,30,60].find(b=>span>b&&b>=minimumBreak(span-b))??null;
 if(!breakConfirmed)return {confirmed:false,recommendedBreak:recommended,fiiliCalismaSaati:null};
 const rest=row.araDinlenmeDakika;nonnegative(rest,'Fiilen kullanılan ara dinlenmesi');
 if(rest>=span)fail('BREAK','Ara dinlenmesi vardiyadan uzun olamaz');const net=span-rest;
 return {confirmed:true,fiiliCalismaSaati:net/60,netMinutes:net,minimumBreak:minimumBreak(net),warnings:[...(rest<minimumBreak(net)?['BREAK_SHORT']:[]),...(net>660?['DAILY_11_HOURS']:[])]};
}
export function validateAttendance(row,{leaves=[],legacyEvents=[],existing=[],overnight=false,breakConfirmed=false,personnel=[],current=null}={}){
 assertUnlocked(current);
 if(!row.id||!personnel.some(p=>active(p)&&p.id===row.personelId))fail('PERSONNEL','Kayıtlı personel seçin');
 if(existing.some(r=>active(r)&&r.personelId===row.personelId&&r.donemKilitDurumu==='imzali_kapali'&&r.tarih?.slice(0,7)===row.tarih?.slice(0,7)))fail('SIGNED_LOCK','Bu personelin dönemi imzalı kapalı');
 const hours=attendanceHours(row,{overnight,breakConfirmed});
 const last=overnight?add(row.tarih,1):row.tarih;
 if(leaves.filter(active).some(r=>r.personelId===row.personelId&&r.baslangicTarihi<=last&&r.bitisTarihi>=row.tarih)||legacyEvents.filter(active).some(e=>e.personnel_id===row.personelId&&['İzin','Rapor'].includes(e.event_type)&&e.date>=row.tarih&&e.date<=last))fail('ON_LEAVE','Personel bu tarihte izinli/raporlu, puantaj girilemez');
 if(existing.filter(active).some(r=>r.id!==row.id&&r.personelId===row.personelId&&r.tarih===row.tarih))fail('DUPLICATE_DAY','Aynı günün vardiyalarını birlikte doğrulayın; ikinci kayıtta saatler toplanmadan kaydedilemez');
 const start=new Date(row.tarih+'T00:00:00Z').getTime()/60000+time(row.baslangicSaati),end=start+(overnight?1440:0)+time(row.bitisSaati)-time(row.baslangicSaati);
 if(existing.filter(active).some(r=>{if(r.id===row.id)return false;const a=new Date(legalDate(r.tarih)+'T00:00:00Z').getTime()/60000+time(r.baslangicSaati),b=a+time(r.bitisSaati)-time(r.baslangicSaati)+(time(r.bitisSaati)<=time(r.baslangicSaati)?1440:0);return (r.personelId===row.personelId||r.makinePlakaId&&r.makinePlakaId===row.makinePlakaId)&&a<end&&b>start;}))fail('SHIFT_OVERLAP','Personel veya makine vardiyası çakışıyor');
 if(!['normal','hafta_tatili','ubgt'].includes(row.gunTipi))fail('DAY_TYPE','Gün türü doğrulanmalı');
 return {...row,...hours,personelId:row.personelId,fiiliCalismaSaati:hours.fiiliCalismaSaati,fazlaMesaiSaati:null,donemKilitDurumu:'acik',annualLeaveDeduction:0};
}
// Call with a complete, approved workweek; a machine's hours are not a worker's hours.
export function weeklyOvertime(netMinutes,{contractWeeklyHours=45,complete=false}={}){
 if(!complete)fail('WEEK_INCOMPLETE','Eksik haftadan kesin fazla mesai hesaplanamaz');
 if(!Number.isFinite(contractWeeklyHours)||contractWeeklyHours<=0||contractWeeklyHours>45)fail('CONTRACT_HOURS','Haftalık sözleşme süresi geçersiz');
 netMinutes.forEach(n=>nonnegative(n,'Çalışma dakikası'));const total=netMinutes.reduce((n,x)=>n+x,0);
 const weekly=Math.max(0,total-2700),daily=netMinutes.reduce((n,x)=>n+Math.max(0,x-660),0),overtime=Math.max(weekly,daily);
 return {totalHours:total/60,fazlaMesaiSaati:overtime/60,weeklyThresholdExcessHours:weekly/60,fazlaSurelerleCalismaSaati:Math.max(0,Math.min(total-overtime,2700)-contractWeeklyHours*60)/60,dailyLimitExcessHours:daily/60,requiresLegalReview:daily>0};
}
export function overtimeLimit(hours){nonnegative(hours,'Yıllık fazla mesai');return hours>270?'red':hours>240?'yellow':'normal';}
export function assertUnlocked(current){if(current?.donemKilitDurumu==='imzali_kapali'||current?.belgeDurumu==='imzali_arsiv')fail('SIGNED_LOCK','İmzalı kayıt değiştirilemez/silinemez; ayrı düzeltme işlemi gerekir');}
export function validateWageDeduction({type,amount,personelId,evidence,consentAmount},{maxDeductible,advanceRecords=[],consentRecords=[],attachments=[]}={}){
 nonnegative(amount,'Kesinti tutarı');if(!amount||!personelId||!Number.isFinite(maxDeductible)||amount>maxDeductible)fail('DEDUCTION','Personel, tutar ve dönemin hukuken mahsup edilebilir sınırı doğrulanmalı');
 if(type==='avans'){
  const advance=advanceRecords.find(r=>active(r)&&r.id===evidence?.advanceRecordId&&r.personelId===personelId);
  if(advance?.paid===true&&advance.documented===true&&advance.remainingAmount>=amount)return true;
 }
 if(type==='muvafakatli_mahsup'){
  const consent=consentRecords.find(r=>active(r)&&r.id===evidence?.consentId&&r.personelId===personelId&&r.amount===amount);
  const document=attachments.find(a=>a.id===consent?.attachmentId&&a.owner_id===consent?.id&&a.owner_type==='ucret_mahsup_muvafakati'&&/^[a-f0-9]{64}$/i.test(a.sha256||''));
  if(consent&&document&&consentAmount===amount&&consent.specificClaim===true&&consent.legalReviewApproved===true&&consent.signaturesVerified===true)return true;
 }
 fail('DEDUCTION','Tek taraflı ceza/hasar veya genel muvafakatla ücret kesilemez; doğrulanmış kayıt ve somut hukuki dayanak gerekir');
}

// New assignment belongs to the substitute; this never changes an old work row.
export function substituteDraft(leave,{date,vehicleId,siteName}){
 legalDate(date);if(!leave.ikameOperatorId||leave.ikameOperatorId===leave.personelId||date<leave.baslangicTarihi||date>leave.bitisTarihi)fail('SUBSTITUTE','İkame tarih/personel doğrulanmalı');
 return {personelId:leave.ikameOperatorId,tarih:date,makinePlakaId:vehicleId??leave.makinePlakaId,santiyeAdi:siteName??leave.santiyeAdi,ikameCalismaMi:true};
}
export function validateSignedArchive(row,{attachment,signaturesVerified=false,documentPurpose,acknowledgedOn}){
 assertUnlocked(row);
 if(!['talep','kullanim_mutabakati'].includes(documentPurpose))fail('DOCUMENT','Belgenin talep mi kullanım mutabakatı mı olduğu belirtilmeli');
 if(documentPurpose==='kullanim_mutabakati'&&legalDate(acknowledgedOn)<legalDate(row.bitisTarihi))fail('FUTURE_ACK','Gelecekteki izin kullanılmış gibi onaylanamaz');
 if(!signaturesVerified||!attachment?.id||attachment.owner_id!==row.id||attachment.owner_type!=='izin_kaydi'||!/^([a-f0-9]{64})$/i.test(attachment.sha256||'')||!['application/pdf','image/jpeg','image/png','image/webp'].includes(attachment.mime))fail('SIGNATURE','İmzalı belge dosyası ve iki imza insan tarafından doğrulanmalı');
 return {...row,belgeDurumu:'imzali_arsiv',imzaliBelgeData:{attachmentId:attachment.id,sha256:attachment.sha256,documentPurpose}};
}
export function excuseLeaveDays(reason){const days={evlilik:3,evlat_edinme:3,olum:3,babalik:5}[reason];if(!days)fail('EXCUSE','Mazeret türü ve belge doğrulanmalı');return {calendarDays:days,annualLeaveDeduction:0};}

// Recorded overtime must have been calculated from validated complete weeks by
// the future transactional writer, never accepted from a model/personnel cache.
export function annualOvertime(rows,{personelId,year,coverageComplete=false}){
 if(!personelId||!Number.isInteger(year))fail('YEAR','Personel ve yıl seçin');let hours=0;
 for(const r of rows.filter(active).filter(r=>r.personelId===personelId)){
  legalDate(r.tarih);if(Number(r.tarih.slice(0,4))===year)hours+=nonnegative(r.fazlaMesaiSaati,'Kayıtlı fazla mesai');
 }
 return {hours,coverageComplete,limit:overtimeLimit(hours),incompleteWarning:!coverageComplete};
}

export function newLeaveDraft(fields,{id,now}){
 if(!id||typeof now!=='string'||!Number.isFinite(Date.parse(now)))fail('IDENTITY','Kayıt kimliği ve oluşturma zamanı gerekli');
 const keys=['personelId','izinTuru','baslangicTarihi','bitisTarihi','isbasiTarihi','ikameOperatorId','makinePlakaId','santiyeAdi','izinHakYili'];
 return {...Object.fromEntries(keys.map(k=>[k,fields[k]??null])),id,dusulenIsGunu:null,belgeDurumu:'imza_bekliyor',imzaliBelgeData:null,olusturmaTarihi:now};
}
export function newAttendanceDraft(fields,{id}){
 if(!id)fail('IDENTITY','Puantaj kimliği gerekli');
 const keys=['personelId','tarih','makinePlakaId','baslangicSaati','bitisSaati','araDinlenmeDakika','gunTipi'];
 return {...Object.fromEntries(keys.map(k=>[k,fields[k]??null])),id,fiiliCalismaSaati:null,fazlaMesaiSaati:null,ikameCalismaMi:fields.ikameCalismaMi===true,donemKilitDurumu:'acik'};
}

import {legalCalendar} from './calendar.js';
import {qs,qsa,esc,appbar,toast,todayStr,confirmDialog,downloadBlob} from '../ui.js';
import {COMPANY_NAME} from '../core.js';
import {annualEntitlement,attendanceHours,weeklyOvertime,overtimeLimit,dayTypeEvidence,substituteDraft} from './core.js';
import {active,effectiveLeave,kindName,leaveLedger,prepareLeave,addDay} from './workflow.js';
import * as api from './api.js';
import {leaveDocument,attendanceDocument} from './document.js';
const field=(label,html)=>`<div class="field"><label>${label}${html}</label></div>`;
const input=(name,type='text',value='',extra='')=>`<input data-${name} type="${type}" value="${esc(value??'')}" ${extra}>`;
const warning={TEN_DAYS:'En az bir 10 günlük parça şartı sağlanmıyor.',DAILY_11_HOURS:'Günlük 11 saat sınırı aşıldı — İSG ve fazla mesai riski.',BREAK_SHORT:'Fiilî ara dinlenmesi yasal asgarinin altında.',CALENDAR_UNKNOWN:'Bu yılın dinî tatil takvimi doğrulanmadı; gün türü ayrıca kontrol edilmeli.',HALF_HOLIDAY_REVIEW:'Yarım gün tatil: fiilî tatil çalışma saatleri ayrıca incelenmeli.',REST_HOLIDAY_REVIEW:'Hafta tatili ve UBGT aynı güne denk geliyor; ücret türleri ayrıca incelenmeli.',YOUNG_WORKER_REVIEW:'18 yaş altı çalışma: yaş, işkolu, gece ve özel süre yasakları ayrıca incelenmeli.',NIGHT_WORK_REVIEW:'Gece çalışması: 7,5 saat sınırı ve işkolu istisnaları ayrıca incelenmeli.',AGE_UNKNOWN:'Yaş bilinmiyor; özel çalışma rejimi doğrulanmadı.'};
const note=t=>`<div class="card small" style="border-left:4px solid #e0a030">${esc(t)}</div>`;
// In-memory, per-person form state only; no business record or persistent schema.
const leaveFormDrafts=new Map();
const feedbackMessage=e=>e?.code==='OPENING'&&e.message==='Hak yıllarına göre doğrulanmış izin açılışı gerekli'?'Bu personelin kalan izinlerini henüz doğrulamadınız.':e?.message??'İşlem tamamlanamadı';
const number=(v,label)=>{if(v.trim()===''||!Number.isFinite(Number(v))||Number(v)<0)throw Error(label+' için doğrulanmış sayı girin');return Number(v)};
export async function screen(ctx){
 if(ctx.parts[0]!=='izin-puantaj')return false;
 const {root,db}=ctx,data=await db.dumpAll(),today=todayStr(),people=(data.personnel||[]).filter(active);
 const pid=ctx.query?.pid??people[0]?.id??'',person=people.find(p=>p.id===pid);
 const mode=ctx.query?.tab??'izin';
 root.innerHTML=appbar('İzin ve Puantaj','Kayıt, onay ve imzalı arşiv')+`<div class="card"><a class="btn ghost" data-personnel-guide href="./kilavuz/izin-puantaj.html" target="_blank" rel="noopener" style="margin-bottom:12px">Kullanım kılavuzu</a>${field('Personel',`<select data-person>${people.map(p=>`<option value="${esc(p.id)}" ${p.id===pid?'selected':''}>${esc(p.name)}</option>`).join('')}</select>`)}<div class="row" style="gap:8px;flex-wrap:wrap">${[['izin','İzinler'],['puantaj','Saatli puantaj'],['ayar','Başlangıç bilgileri']].map(([tab,label])=>`<button class="btn ${mode===tab?'primary':'ghost'}" data-tab="${tab}">${label}</button>`).join('')}</div></div><div data-body></div>`;
 const route=(tab,p=pid,extra='')=>{location.hash='#/izin-puantaj?pid='+encodeURIComponent(p)+'&tab='+tab+extra};
 qs('[data-person]',root).onchange=e=>route(mode,e.target.value);
 qsa('[data-tab]',root).forEach(b=>b.onclick=()=>route(b.dataset.tab));
 const body=qs('[data-body]',root);if(!person){body.innerHTML=note('Önce Personel ekranından çalışan ekleyin.');return true;}
 const value=n=>qs('[data-'+n+']',body)?.value??'';
 const checked=n=>qs('[data-'+n+']',body)?.checked===true;
 const run=(selector,fn)=>{const b=qs(selector,body);if(b)b.onclick=async()=>{b.disabled=true;try{await fn()}catch(e){
  const card=b.closest('.card'),region=qs('[data-error]',card??body)??qs('[data-error]',body);
  if(region){region.replaceChildren(document.createTextNode(feedbackMessage(e)));region.dataset.code=e.code??'';const preview=qs('[data-preview]',card??body);if(preview)preview.hidden=true;region.scrollIntoView({block:'center'});}
  else toast(feedbackMessage(e),'err');
 }finally{if(b.isConnected)b.disabled=false}}};
 const done=t=>{toast(t,'ok');ctx.reload()};
 const downloadOriginal=async id=>{const a=await db.get('attachments',id);if(!a)throw Error('Orijinal dosya bu cihazda yok; yedeğin tüm parçalarını yükleyin');const {attachmentView}=await import('../attachment-safety.js'),v=await attachmentView(a);downloadBlob(v.blob,v.downloadName)};
 const failure='<p data-error role="alert" style="color:#dc5e59"></p>';
 if(mode==='ayar'){
  const opening=person.izinHesapAcilisi;
  body.innerHTML=`<div class="card"><h3>Doğrulanmış başlangıç</h3><p class="small muted">Eski kayıtlar değiştirilmez. Açılış tarihinde kalan izinleri hak yılına göre girin. Önceki kullanımlar bu kalan bakiyeye zaten dahil olmalı; sonraki kullanım ikinci kez düşülmez.</p>${field('İşe giriş tarihi',input('hire','date',person.iseGirisTarihi??person.start_date))}${field('Doğum tarihi',input('birth','date',person.dogumTarihi??person.birth_date))}${field('Fazla mesai yazılı muvafakat tarihi (isteğe bağlı)',input('consent','date',person.fazlaMesaiMuvafakatTarihi))}<p class="tiny muted">Tarih tek başına muvafakat belgesi değildir. İşçi 30 gün önceden yazılı bildirimle muvafakatini geri alabilir.</p>${field('Hafta tatili',`<select data-rest>${['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'].map((n,i)=>`<option value="${i}" ${(person.haftaTatiliGunleri??[0]).includes(i)?'selected':''}>${n}</option>`).join('')}</select>`)}${field('İzin açılış tarihi',input('asof','date',opening?.asOf??today))}<div data-years></div><button class="btn ghost" data-addyear>+ Hak yılı ekle</button><p class="tiny muted">Hak yılı: iznin kazanıldığı hizmet yıldönümü. Önceki parça günlerini virgülle yazın (ör. 4,10); hiç kullanım yoksa boş bırakın. Eski izinlere otomatik yıl atanmaz.</p><label class="row"><input type="checkbox" data-confirm> Kalan bakiyeleri ve önceki parçaları evraktan kontrol ettim.</label>${failure}<button class="btn primary" data-profile>Bilgileri kaydet</button></div>`;
  const years=qs('[data-years]',body);
  const add=(y={})=>{const row=document.createElement('div');row.className='card';row.dataset.year='';row.innerHTML=field('Hak yılı (kazanılan yıldönümü)',input('yearkey','date',y.yearKey))+field('Açılışta kalan gün',input('days','number',y.days,'min="0" step="0.5"'))+field('Bu hak yılında daha önce kullanılan parçalar',input('pieces','text',(y.pieces??[]).join(',')))+'<button class="btn ghost" data-remove>Satırı kaldır</button>';qs('[data-remove]',row).onclick=()=>row.remove();years.append(row)};
  (opening?.years??[{}]).forEach(add);qs('[data-addyear]',body).onclick=()=>add();
  run('[data-profile]',async()=>{
   if(!checked('confirm'))throw Error('Başlangıç bilgilerini evraktan doğrulayın');
   const years=qsa('[data-year]',body).map(r=>({yearKey:qs('[data-yearkey]',r).value,days:number(qs('[data-days]',r).value,'Kalan gün'),pieces:qs('[data-pieces]',r).value.trim()?qs('[data-pieces]',r).value.split(',').map(v=>number(v.trim(),'Parça')):[]}));
   await api.saveProfile(person,{iseGirisTarihi:value('hire'),dogumTarihi:value('birth'),fazlaMesaiMuvafakatTarihi:value('consent')||null,haftaTatiliGunleri:[Number(value('rest'))],izinHesapAcilisi:{asOf:value('asof'),years,confirmedOn:today}});if(ctx.query?.resume==='izin'){toast('Bilgiler kaydedildi; izin kaydınıza devam edebilirsiniz.','ok');route('izin');}else done('Başlangıç bilgileri kaydedildi');
  });return true;
 }
 if(mode==='izin'){
  let summary='',ledger=[],ledgerError=null;try{ledger=leaveLedger(data,person,today);const e=annualEntitlement(person,today);summary=`Bu hizmet yılı hakkı ${e.days} gün · Kullanılabilir ${ledger.reduce((n,y)=>n+y.availableDays,0)} gün`;}catch(e){ledgerError=e;}
  const leaves=(data.izin_kayitlari||[]).filter(r=>active(r)&&r.personelId===pid).sort((a,b)=>b.baslangicTarihi.localeCompare(a.baslangicTarihi));
  const openingMissing=ledgerError?.code==='OPENING'&&ledgerError.message==='Hak yıllarına göre doğrulanmış izin açılışı gerekli';
  const setupPanel=openingMissing?`<div class="card" data-setup-panel role="status" style="border-left:4px solid #e0a030"><h3>İlk yıllık izin kaydından önce</h3><p>Bu personelin kalan izinlerini henüz doğrulamadınız.</p><button class="btn primary" data-setup-start style="white-space:normal;max-width:100%">Başlangıç bilgilerini tamamla</button><p class="small muted">Kaydedince bu personelin izin formuna geri dönersiniz. Yazdığınız alanlar korunur.</p><ul class="small"><li>İşe giriş tarihi: ${person.iseGirisTarihi||person.start_date?'kayıtlı':'eksik'}</li><li>Doğum tarihi: ${person.dogumTarihi||person.birth_date?'kayıtlı':'eksik'}</li><li>Hak yıllarına göre kalan izin: doğrulama bekliyor</li></ul></div>`:'';
  body.innerHTML=(summary?note(summary):openingMissing?'':note(feedbackMessage(ledgerError)))+setupPanel+`<div class="card"><h3>Yeni izin / rapor</h3>${field('İzin türü',`<select data-kind>${Object.entries(kindName).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select>`)}${field('Kayıt amacı',`<select data-purpose><option value="draft">Taslak — onay değildir</option><option value="approval">İzin planını onayla</option><option value="actual">Geçmiş fiilî kullanımı kaydet</option></select>`)}<div class="formgrid2">${field('Başlangıç',input('from','date',today))}${field('Bitiş (dahil)',input('to','date',today))}</div>${field('İşbaşı tarihi',input('return','date',addDay(today)))}${field('Mahsup edilecek hak yılı',`<select data-year><option value="">Seçin</option>${ledger.map(y=>`<option value="${y.yearKey}">${y.yearKey} · ${y.availableDays} gün kalan</option>`).join('')}</select>`)}${field('İkame operatör (isteğe bağlı)',`<select data-sub><option value="">İkame yok</option>${people.filter(p=>p.id!==pid).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>`)}${field('Makine / araç (isteğe bağlı)',`<select data-vehicle><option value="">Seçim yok</option>${(data.vehicles||[]).filter(active).map(v=>`<option value="${esc(v.id)}">${esc(v.plate??v.name)}</option>`).join('')}</select>`)}${field('Şantiye (isteğe bağlı)',input('site'))}<div data-preview class="small" role="status"></div>${failure}<button class="btn primary" data-saveleave style="white-space:normal;max-width:100%">Kaydet</button><p class="tiny muted">Plan onayında en az bir 10 günlük parçaya yer ayrılır. Geçmiş fiilî kullanımda aykırılık gizlenmez; uyarıyla kaydedilir. Rapor, mazeret, ücretsiz ve yol izni yıllık bakiyeden düşmez. 1 Mayıs 2026 sonrası babalık izni 10 gündür; evlilik / evlat edinme / kanundaki yakın ölümü 3 gündür.</p></div><h3 data-documents-title>Kayıtlar (${leaves.length})</h3><div data-leaves></div><a class="btn ghost" href="#/izinler?eski=1">Eski izin kayıtlarını görüntüle</a>`;
  const savedDraft=leaveFormDrafts.get(pid);
  let editingLeave=savedDraft?.editingId?leaves.find(r=>r.id===savedDraft.editingId&&r.rev===savedDraft.editingRev&&r.belgeDurumu!=='imzali_arsiv')??null:null;
  if(savedDraft&&(!savedDraft.editingId||editingLeave))for(const [key,val]of Object.entries(savedDraft.values)){const el=qs('[data-'+key+']',body);if(el)el.value=val;}
  else if(savedDraft?.editingId){leaveFormDrafts.delete(pid);qs('[data-error]',body).textContent='Düzenlenen kayıt değişmiş veya kilitlenmiş; sayfayı yenileyip karttan yeniden inceleyin.';qs('[data-error]',body).dataset.code='STALE';}
  if(editingLeave)qs('[data-saveleave]',body).textContent='Değişiklikleri kaydet';
  const remember=()=>leaveFormDrafts.set(pid,{values:Object.fromEntries(['kind','purpose','from','to','return','year','sub','vehicle','site'].map(k=>[k,value(k)])),editingId:editingLeave?.id??null,editingRev:editingLeave?.rev??null});
  const fields=()=>({personelId:pid,izinTuru:value('kind'),baslangicTarihi:value('from'),bitisTarihi:value('to'),isbasiTarihi:value('return'),izinHakYili:value('kind')==='yillik'?(value('year')||null):null,ikameOperatorId:value('sub')||null,makinePlakaId:value('vehicle')||null,santiyeAdi:value('site')||null});
  const preview=()=>{
   const annual=value('kind')==='yillik',needsSetup=annual&&openingMissing,area=qs('[data-preview]',body),error=qs('[data-error]',body),save=qs('[data-saveleave]',body),year=qs('[data-year]',body);
   const panel=qs('[data-setup-panel]',body);if(panel)panel.hidden=!annual;
   year.closest('.field').hidden=!annual;year.disabled=needsSetup;
   year.options[0].textContent=needsSetup?'Önce bilgileri tamamlayın':'Seçin';
   save.textContent=needsSetup?'Başlangıç bilgilerine geç':editingLeave?'Değişiklikleri kaydet':'Kaydet';
   save.setAttribute('aria-label',save.textContent);area.hidden=needsSetup;
   if(needsSetup){area.textContent='';if(!['STALE','SIGNED_LOCK','OP_CONFLICT'].includes(error.dataset.code))error.textContent='';remember();return;}
   try{const r=prepareLeave(data,{...fields(),id:editingLeave?.id??'preview'},{mode:value('purpose'),today,current:editingLeave});area.textContent=`Yıllık izinden ${r.dusulenIsGunu} gün düşer. ${(r.warnings??[]).map(w=>warning[w]??w).join(' ')}`;}
   catch(e){area.textContent=feedbackMessage(e);}
   if(error.textContent===area.textContent||['STALE','SIGNED_LOCK','OP_CONFLICT','OPENING','LEGACY_ALLOCATION'].includes(error.dataset.code))area.hidden=true;else{error.textContent='';error.dataset.code='';}
   remember();
  };
  qsa('input,select',body).forEach(e=>{e.addEventListener('change',preview);e.addEventListener('input',remember)});preview();
  const startSetup=()=>{remember();route('ayar',pid,'&resume=izin')};
  qs('[data-setup-start]',body)?.addEventListener('click',startSetup);
  run('[data-saveleave]',async()=>{
   if(value('kind')==='yillik'&&openingMissing){startSetup();return;}
   const purpose=value('purpose');if(purpose!=='draft'&&!await confirmDialog(purpose==='actual'?'Fiilî kullanım kaydı':'Plan onayı',purpose==='actual'?'Geçmişte gerçekten kullanılan izni kaydediyorum. Uyarılar kayıtta kalır.':'Bu izin planı çalışanla mutabakatla onaylanacak. Islak imzalı belge ayrıca yüklenir.','Kaydet'))return;
   await api.saveLeave(fields(),{mode:purpose,current:editingLeave});leaveFormDrafts.delete(pid);done('İzin kaydedildi');
  });
  const list=qs('[data-leaves]',body);
  if(leaves.length){const draftCount=leaves.filter(r=>r.planDurumu==='taslak').length,signedCount=leaves.filter(r=>r.belgeDurumu==='imzali_arsiv').length;
   const nav=document.createElement('div');nav.className='card';nav.dataset.documentSummary='';nav.innerHTML=`<b>İzin belgeleri</b><p class="small">Taslak: ${draftCount} · İmza bekleyen: ${leaves.filter(r=>r.planDurumu!=='taslak'&&r.belgeDurumu!=='imzali_arsiv').length} · İmzalı arşiv: ${signedCount}</p><button class="btn" data-leave-documents>Belge alanına git</button>`;body.prepend(nav);
   qs('[data-leave-documents]',nav).onclick=()=>{qs('[data-documents-title]',body).scrollIntoView({block:'center'});qs('[data-pdf]',list)?.focus({preventScroll:true})};
  }else list.innerHTML='<div class="card small muted">Henüz izin kaydı yok. İzin kaydını kaydettikten sonra Talep PDF düğmesi burada görünür.</div>';

  for(const r of leaves){
   const card=document.createElement('div');card.className='card';card.dataset.legalLeave=r.id;
   const locked=r.belgeDurumu==='imzali_arsiv';
   card.innerHTML=`<div class="row between"><b>${esc(kindName[r.izinTuru])}</b><span class="badge ${locked?'ok':''}">${locked?'İmzalı arşiv':r.planDurumu==='taslak'?'Taslak':'İmza bekliyor'}</span></div><p>${esc(r.baslangicTarihi)} — ${esc(r.bitisTarihi)}<br>${r.dusulenIsGunu} gün · ${esc(r.planDurumu)}</p>${(r.warnings??[]).map(w=>note(warning[w]??w)).join('')}<div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn" data-pdf>Talep PDF</button>${today>=r.bitisTarihi?'<button class="btn" data-usepdf>Kullanım mutabakat PDF</button>':''}${r.planDurumu==='taslak'?'<button class="btn primary" data-approve>Planı onayla</button>':''}</div>${!locked&&r.planDurumu!=='taslak'?`${field('Islak imzalı orijinal belge',`<input data-file type="file" accept="application/pdf,image/jpeg,image/png,image/webp">`)}${field('Belgenin amacı',`<select data-docpurpose><option value="talep">İzin talebi</option>${today>=r.bitisTarihi?'<option value="kullanim_mutabakati">Kullanım ve bakiye mutabakatı</option>':''}</select>`)}<label class="row"><input type="checkbox" data-signed> İşçi ve işveren ıslak imzalarını kontrol ettim</label><button class="btn" data-archive>İmzalı arşive al ve kilitle</button>`:''}`;
   if(!locked)card.insertAdjacentHTML('beforeend','<button class="btn ghost" data-editleave>Alanları düzenle</button>');
   const acknowledgement=(data.documents||[]).find(d=>d.legal_leave_ack&&d.legal_leave_id===r.id);
   if(locked){
    card.insertAdjacentHTML('beforeend','<button class="btn ghost" data-original>İmzalı orijinali indir</button>');
    if(acknowledgement)card.insertAdjacentHTML('beforeend','<button class="btn ghost" data-ackoriginal>Kullanım mutabakatını indir</button>');
    else if(r.imzaliBelgeData?.documentPurpose==='talep'&&today>=r.bitisTarihi)card.insertAdjacentHTML('beforeend',`${field('Dönüşteki kullanım mutabakatı (ayrı imzalı belge)',`<input data-ackfile type="file" accept="application/pdf,image/jpeg,image/png,image/webp">`)}<label class="row"><input type="checkbox" data-acksigned> İki ıslak imzayı ve kullanım tarihlerini kontrol ettim</label><button class="btn" data-ack>Kullanım mutabakatını ayrıca arşivle</button>`);
   }
   if(r.ikameOperatorId&&effectiveLeave(r)&&r.baslangicTarihi<=today)card.insertAdjacentHTML('beforeend','<button class="btn" data-subshift>İkame adına puantaj hazırla</button>');
   const task=(sel,fn)=>{const b=qs(sel,card);if(b)b.onclick=async()=>{b.disabled=true;try{await fn()}catch(e){toast(e.message,'err')}finally{if(b.isConnected)b.disabled=false}}};
   const pdf=async purpose=>{const {exportDocument}=await import('../document-engine.js');await exportDocument(leaveDocument({...r,ikameAdi:people.find(p=>p.id===r.ikameOperatorId)?.name},person,{purpose,today,companyName:COMPANY_NAME}),'download')};
   task('[data-editleave]',()=>{
    editingLeave=r;qs('[data-error]',body).textContent='';qs('[data-error]',body).dataset.code='';const values={kind:r.izinTuru,purpose:r.kayitSekli==='fiili'?'actual':r.planDurumu==='taslak'?'draft':'approval',from:r.baslangicTarihi,to:r.bitisTarihi,return:r.isbasiTarihi,year:r.izinHakYili??'',sub:r.ikameOperatorId??'',vehicle:r.makinePlakaId??'',site:r.santiyeAdi??''};
    for(const [key,val]of Object.entries(values))qs('[data-'+key+']',body).value=val;qs('[data-saveleave]',body).textContent='Değişiklikleri kaydet';preview();qs('[data-kind]',body).scrollIntoView({block:'center'});
   });
   task('[data-subshift]',()=>{const s=substituteDraft(r,{date:r.baslangicTarihi});location.hash='#/izin-puantaj?tab=puantaj&pid='+encodeURIComponent(s.personelId)+'&date='+s.tarih+'&vehicle='+encodeURIComponent(s.makinePlakaId??'')+'&ikame=1'});
   task('[data-original]',()=>downloadOriginal(r.imzaliBelgeData.attachmentId));
   task('[data-ackoriginal]',()=>downloadOriginal(acknowledgement.imzaliBelgeData.attachmentId));
   task('[data-ack]',async()=>{const file=qs('[data-ackfile]',card).files[0];if(!file)throw Error('Kullanım mutabakatı dosyasını seçin');await api.archiveUsageAcknowledgement(r,file,{signaturesVerified:qs('[data-acksigned]',card).checked});done('Kullanım mutabakatı ayrı belge olarak arşivlendi')});
   task('[data-pdf]',()=>pdf('talep'));task('[data-usepdf]',()=>pdf('kullanim_mutabakati'));
   task('[data-approve]',async()=>{await api.saveLeave(r,{mode:'approval',current:r});done('Plan onaylandı')});
   task('[data-archive]',async()=>{const file=qs('[data-file]',card).files[0];if(!file)throw Error('İmzalı belgeyi seçin');await api.archiveLeave(r,file,{signaturesVerified:qs('[data-signed]',card).checked,documentPurpose:qs('[data-docpurpose]',card).value});done('Orijinal belge arşivlendi; kayıt kilitlendi')});list.append(card);
  }
  return true;
 }
 const rows=(data.puantaj_kayitlari||[]).filter(r=>active(r)&&r.personelId===pid).sort((a,b)=>b.tarih.localeCompare(a.tarih)),period=today.slice(0,7);
 body.innerHTML=`<div class="card"><h3>Fiilî çalışma kaydı</h3>${field('Tarih',input('date','date',ctx.query?.date??today,`max="${today}"`))}${field('Makine / araç (isteğe bağlı)',`<select data-machine><option value="">Seçim yok</option>${(data.vehicles||[]).filter(active).map(v=>`<option value="${esc(v.id)}">${esc(v.plate??v.name)}</option>`).join('')}</select>`)}<div class="formgrid2">${field('Başlangıç',input('start','time','08:00'))}${field('Bitiş',input('end','time','17:00'))}</div><label class="row"><input type="checkbox" data-night> Gece yarısını aşan vardiya</label>${field('Fiilen kullanılan ara dinlenmesi (dakika)',input('break','number','','min="0" step="1"'))}<div data-breakhint class="small muted"></div><label class="row"><input type="checkbox" data-breakconfirmed> Bu mola fiilen kullanıldı; kontrol ettim</label>${field('Gün türü',`<select data-daytype><option value="normal">Normal gün</option><option value="hafta_tatili">Hafta tatili (her zaman Pazar olmayabilir)</option><option value="ubgt">Ulusal bayram / genel tatil</option></select>`)}<label class="row"><input type="checkbox" data-substitute> İkame çalışma — kayıt bu personelin adına</label><div data-hourspreview role="status"></div>${failure}<button class="btn primary" data-saveattendance>Puantajı kaydet</button></div><div class="card"><h3>Saat ve risk özeti</h3><div data-overtime></div><p class="tiny muted">Fiilî saatler ücret tutarı değildir. Eksik haftadan kesin fazla mesai çıkarılmaz; makine saati personel saati sayılmaz. Gece / genç işçi / özel işkolu / denkleştirme ayrıca değerlendirilir. UBGT ve hafta tatili çalışması normal gün ücretine sessizce eklenmez.</p></div><div class="card"><h3>İmzalı dönem</h3>${field('Dönem',input('period','month',period))}<button class="btn" data-periodpdf>Puantaj PDF indir</button>${field('İmzalı dönem belgesi',`<input type="file" data-periodfile accept="application/pdf,image/jpeg,image/png,image/webp">`)}<label class="row"><input type="checkbox" data-periodsigned> Bu dönemin kayıtlarını ve iki ıslak imzayı kontrol ettim</label>${failure}<button class="btn" data-closeperiod>Dönemi imzalı kapat</button></div><h3>Saat kayıtları (${rows.length})</h3>${rows.map(r=>`<div class="card"><b>${esc(r.tarih)} · ${r.fiiliCalismaSaati} saat</b><p class="small">${esc(r.baslangicSaati)}–${esc(r.bitisSaati)} · ara ${r.araDinlenmeDakika} dk · ${esc(r.gunTipi)} · ${r.donemKilitDurumu==='imzali_kapali'?'İmzalı kapalı':'Açık'}</p>${(r.warnings??[]).map(w=>note(warning[w]??w)).join('')}${r.donemKilitDurumu==='acik'?`<button class="btn ghost" data-editattendance="${esc(r.id)}">Saatleri düzenle</button>`:''}${r.imzaliBelgeData?`<button class="btn ghost" data-attendance-original="${esc(r.imzaliBelgeData.attachmentId)}">İmzalı dönem belgesi</button>`:''}</div>`).join('')}<a class="btn ghost" href="#/puantaj/${encodeURIComponent(pid)}">Maaş ve eski puantaj</a>`;
 qsa('[data-attendance-original]',body).forEach(b=>b.onclick=()=>downloadOriginal(b.dataset.attendanceOriginal).catch(e=>toast(e.message,'err')));
 if(ctx.query?.vehicle)qs('[data-machine]',body).value=ctx.query.vehicle;qs('[data-substitute]',body).checked=ctx.query?.ikame==='1';
 let editingAttendance=null;
 const attendance=()=>({personelId:pid,tarih:value('date'),makinePlakaId:value('machine')||null,baslangicSaati:value('start'),bitisSaati:value('end'),araDinlenmeDakika:value('break')===''?null:Number(value('break')),gunTipi:value('daytype'),geceYarisiAsiyor:checked('night'),molaDogrulandi:checked('breakconfirmed'),ikameCalismaMi:checked('substitute')});
 const hourpreview=()=>{try{const f=attendance(),suggested=attendanceHours(f,{overnight:f.geceYarisiAsiyor});qs('[data-breakhint]',body).textContent='Asgari mola önerisi: '+suggested.recommendedBreak+' dk. Kullanılmayan mola kendiliğinden düşülmez.';const h=attendanceHours(f,{overnight:f.geceYarisiAsiyor,breakConfirmed:f.molaDogrulandi});qs('[data-hourspreview]',body).textContent=h.confirmed?`Fiilî çalışma ${h.fiiliCalismaSaati} saat. ${h.warnings.map(w=>warning[w]??w).join(' ')}`:'Fiilen kullanılan molayı girip doğrulayın.';}catch(e){qs('[data-hourspreview]',body).textContent=e.message}};
 qsa('input,select',body).forEach(e=>e.addEventListener('change',hourpreview));const setDay=()=>{qs('[data-daytype]',body).value=dayTypeEvidence(value('date'),person,{calendar:legalCalendar}).type;hourpreview()};qs('[data-date]',body).addEventListener('change',setDay);setDay();
 run('[data-saveattendance]',async()=>{await api.saveAttendance(attendance(),{current:editingAttendance});done('Fiilî çalışma kaydedildi')});
 qsa('[data-editattendance]',body).forEach(b=>b.onclick=()=>{
  const r=rows.find(r=>r.id===b.dataset.editattendance);editingAttendance=r;const values={date:r.tarih,machine:r.makinePlakaId??'',start:r.baslangicSaati,end:r.bitisSaati,break:r.araDinlenmeDakika,daytype:r.gunTipi};for(const [key,val]of Object.entries(values))qs('[data-'+key+']',body).value=val;qs('[data-night]',body).checked=!!r.geceYarisiAsiyor;qs('[data-substitute]',body).checked=!!r.ikameCalismaMi;qs('[data-breakconfirmed]',body).checked=false;qs('[data-saveattendance]',body).textContent='Değişiklikleri kaydet';hourpreview();qs('[data-date]',body).scrollIntoView({block:'center'});
 });
 const weeks=new Map();for(const r of rows){const day=new Date(r.tarih+'T12:00:00Z').getUTCDay(),monday=addDay(r.tarih,-((day+6)%7));if(!weeks.has(monday))weeks.set(monday,[]);weeks.get(monday).push(r);}
 let lowerBound=0;const weekText=[];
 for(const [week,entries]of weeks){const h=weeklyOvertime(entries.map(r=>r.fiiliCalismaSaati*60),{complete:true});if(week.slice(0,4)===today.slice(0,4))lowerBound+=h.fazlaMesaiSaati;weekText.push(`${week}: kayıtlı ${h.totalHours} saat, saptanan en az ${h.fazlaMesaiSaati} saat fazla çalışma (hafta kapsamı doğrulanmadı).`);}
 qs('[data-overtime]',body).textContent=`${today.slice(0,4)} için kayıtlardan saptanan en az ${lowerBound} saat. ${overtimeLimit(lowerBound)==='red'?'270 saat sınırı aşıldı.':overtimeLimit(lowerBound)==='yellow'?'240 saat erken uyarı eşiği aşıldı.':'Eksik yıl uygunluk kanıtı değildir.'} `+weekText.slice(0,6).join(' ');
 run('[data-periodpdf]',async()=>{const {exportDocument}=await import('../document-engine.js');await exportDocument(attendanceDocument(rows,person,value('period'),{companyName:COMPANY_NAME}),'download')});
 run('[data-closeperiod]',async()=>{const selected=rows.find(r=>r.tarih.startsWith(value('period'))),file=qs('[data-periodfile]',body).files[0];if(!selected||!file)throw Error('Dönemde kayıt ve imzalı belge gerekli');if(!await confirmDialog('İmzalı dönem kapatılacak','Bu dönemin kayıtları değiştirilemez; yeni puantaj da eklenemez. Kayıtsız günler çalışılmadı sayılmaz.','Kilitle'))return;await api.closeAttendance(selected,file,{signaturesVerified:checked('periodsigned'),expectedRows:rows.filter(r=>r.tarih.startsWith(value('period')))});done('Dönem imzalı kapatıldı')});
 return true;
}

import { prepareAttachment } from "./attachment-safety.js";
import {pdfRowRecorded} from './pending-records.js';
import { qs,qsa,esc,appbar,notice,toast,confirmDialog,todayStr } from './ui.js';
import { WORK_TYPES,WORK_UNITS,EXPENSE_CATEGORIES,FUEL_SOURCES,isActive } from './core.js';
import * as P from './pdf-history-core.js';
const label={work:'İş',fuel:'Yakıt',expense:'Gider',note:'Açıklama',summary:'Özet — kayıt oluşturmaz'};
const options=(list,value,empty='— seçin —')=>`<option value="">${empty}</option>`+list.map(([id,name])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(name)}</option>`).join('');
const sel=(name,title,list,value)=>`<label class="field">${title}<select name="${name}">${options(list,value)}</select></label>`;
const input=(name,title,value,type='text')=>`<label class="field">${title}<input name="${name}" type="${type}" ${type==='number'?'step="any"':''} value="${esc(String(value??''))}"></label>`;
export async function screen(ctx) {
 const {root,db}=ctx;let file=null,hash='',plan=null,blobUrl='',busy=false;const completed=new Set(),blocked=new Set();
 const unavailable=()=>new Set([...completed,...blocked]);
 root.innerHTML=appbar('Geçmiş işleri PDF’den aktar','Önce kontrol, sonra seçilen satırları kaydet')+`<div class="card"><p>İş, yakıt ve gider ayrıntıları okunur. Hakediş, tahsilat veya açılış bakiyesi oluşturulmaz. Fiyatsız işe bugünkü fiyat uygulanmaz.</p><label class="field">PDF (en fazla 15 MB)<input type="file" accept="application/pdf,.pdf" data-pdf-file></label><label class="history-check"><input type="checkbox" data-pdf-consent> Bu PDF’nin okunmak üzere Gemini’ye gönderilmesini kabul ediyorum.</label><button class="btn primary block" data-pdf-read>PDF’yi oku / kayıtlı taslağı aç</button></div><div class="card" data-pdf-queue></div><div data-pdf-result></div>`;
 const out=qs('[data-pdf-result]',root),read=qs('[data-pdf-read]',root);
 const active=()=>read.isConnected&&root.contains(read);
 const names=(d,s)=>(d[s]||[]).filter(isActive).map(x=>[x.id,x.name||x.plate||x.id]);
 const choices=a=>a.map(x=>[x,x]);
 const remember=async()=>{if(hash&&plan){plan._file_name=file?.name||plan._file_name||'PDF';plan._updated_at=new Date().toISOString();await db.metaSet('pdf_history_draft:'+hash,structuredClone(plan));}};
 const keepFile=()=>db.storePdfHistoryFile(hash,file);
 const renderQueue=async()=>{
  const box=qs('[data-pdf-queue]',root);if(!box||!active())return;
  const meta=await db.getAll('meta'),data=await db.dumpAll(),ops=new Map(meta.map(x=>[x.key,x.value]));
  const drafts=meta.filter(x=>x.key.startsWith('pdf_history_draft:')&&Array.isArray(x.value?.rows)).sort((a,b)=>String(b.value._updated_at||'').localeCompare(String(a.value._updated_at||'')));
  if(!active())return;
  box.innerHTML='<h3>PDF aktarım listesi</h3><p class="tiny muted">Taslak dosyaları bu cihazda tutulur; orijinal PDF’leri de saklayın.</p>'+(drafts.length?'':'<p class="small">Okuduğunuz PDF’ler burada görünür; kaldığınız yerden devam edebilirsiniz.</p>')+drafts.map(x=>{
   const h=x.key.slice('pdf_history_draft:'.length);let saved=0,linked=0,pending=0,missing=0;
   for(const r of x.value.rows.filter(r=>['work','fuel','expense'].includes(r.kind))){const op=ops.get('op:pdf-history:'+h+':'+r.id),active=pdfRowRecorded(ops,data,h,r);if(active){op.action==='link'?linked++:saved++;}else{pending++;if(P.pdfQuestions(r,data).length)missing++;}}
   return `<div style="border-top:1px solid var(--border);padding:10px 0"><b>${esc(x.value._file_name||'PDF '+h.slice(0,8))}</b><p class="small">${pending} bekleyen · ${saved} kaydedilen · ${linked} mevcut işe bağlanan${missing?' · '+missing+' satırda eksik bilgi':''}</p><button class="btn block" data-pdf-resume="${h}">Aç / devam et</button></div>`;
  }).join('');
  for(const b of qsa('[data-pdf-resume]',box))b.onclick=async()=>{
   if(busy)return;busy=true;read.disabled=true;
   try{await remember();hash=b.dataset.pdfResume;plan=await db.metaGet('pdf_history_draft:'+hash);file=null;
    const cached=await db.get('drafts','pdf_history_file:'+hash);
    const attachment=cached?.blob?null:(await db.attachmentsFor('document','pdf-history-'+hash)).find(x=>x.src_sha256===hash);
    const blob=cached?.blob||attachment?.blob;
    if(blob){const candidate=new File([blob],cached?.name||attachment?.name||plan._file_name||'kaynak.pdf',{type:'application/pdf'});if(await P.pdfDigest(candidate)===hash)file=await prepareAttachment(candidate,{pdfOnly:true});}
    if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=file?URL.createObjectURL(file):'';qs('[data-pdf-file]',root).value='';
    await draw();out.scrollIntoView({behavior:'smooth'});
   }catch(e){toast(e.message,'err');}finally{busy=false;read.disabled=false;}
  };
 };
 const draw=async()=>{
  if(!active())return;
  completed.clear();blocked.clear();
  const d=await db.dumpAll(),totals=P.pdfTotals(plan.rows),mismatch=P.pdfTotalIssues(plan);
  if(!active())return;
  out.innerHTML=`<div class="card"><h3>Kontrol taslağı — seçmeden yeni kayıt yazılmaz</h3><p><b>${esc(plan._file_name||file?.name||'PDF')}</b></p>${file?`<a href="${blobUrl}" target="_blank" rel="noopener" class="btn">Orijinal PDF’yi aç</a>`:notice('warn','Satır taslağı yüklendi. Kaydetmeden veya bağlamadan önce aynı orijinal PDF’yi yeniden seçip taslağı açın.')}${plan._file_warning?notice('warn',plan._file_warning):''}<p>${plan.rows.length} satır · ${Object.entries(totals).map(([k,v])=>esc(k.replace('work:','İş ').replace('fuel:L','Yakıt L').replace('expense:TL','Gider TL'))+': '+esc(String(v))).join(' · ')}</p><p class="tiny muted">Bu rakamlar modelin çıkardığı ayrıntılardan hesaplandı; PDF’nin tamamının eksiksiz okunduğunun kanıtı değildir.</p>${mismatch.length?notice('warn','Belge toplamı ile ayrıntı uyuşmuyor: '+mismatch.join(' · ')):''}${plan.notes.map(n=>notice('warn',n)).join('')}</div>`;
  for(const row of plan.rows){
   if(!['work','fuel','expense'].includes(row.kind)){out.insertAdjacentHTML('beforeend',`<details class="card"><summary>${label[row.kind]} · sayfa ${row.page||'?'}</summary><p>${esc(row.quote||row.description)}</p></details>`);continue;}
   const opId=`pdf-history:${hash}:${row.id}`,candidate=await db.opLookup(opId);
   const old=candidate&&pdfRowRecorded(new Map([['op:'+opId,candidate]]),d,hash,row);
   if(old)completed.add(row.id);else if(candidate)blocked.add(row.id);
   let similar=[];try{similar=P.similarPdfRecords(d,P.pdfRowFields(row,d,{hash,document_id:'pdf-history-'+hash}));}catch{}
   const price=`${input('unit_price','PDF’deki birim fiyat (yoksa boş)',row.unit_price,'number')}${input('kdv_rate','KDV % (yoksa boş)',row.kdv_rate,'number')}${sel('kdv_included','KDV fiyatın içinde mi?',[['yes','Dahil'],['no','Hariç']],row.kdv_included==null?'':row.kdv_included?'yes':'no')}`;
   out.insertAdjacentHTML('beforeend',`<section class="card" data-pdf-row="${row.id}"><label class="history-check"><input type="checkbox" data-pdf-pick ${old?'disabled':''}><b>${label[row.kind]} · sayfa ${row.page||'?'}</b></label>${old?notice('info','Bu PDF satırı daha önce kaydedildi veya mevcut işe bağlandı.'):''}<p class="small">${esc(row.quote)}</p>${row.price_issue?notice('warn',row.price_issue):''}<p class="tiny muted">Belgedeki adlar: ${esc([row.customer_name,row.vehicle_name,row.personnel_name].filter(Boolean).join(' · '))}</p><div class="formgrid2">${input('date','Gerçek tarih',row.date,'date')}${sel('vehicle_id','Araç / makine',names(d,'vehicles'),row.vehicle_id)}${sel('personnel_id','Personel (biliniyorsa)',names(d,'personnel'),row.personnel_id)}${row.kind==='work'||row.kind==='fuel'?sel('customer_id',row.kind==='fuel'?'Yalnız müşteriden alınmışsa müşteri':'Müşteri',names(d,'customers'),row.customer_id):''}${row.kind==='work'?`${sel('work_type','İş türü',choices(WORK_TYPES),row.work_type)}${input('quantity','Miktar',row.quantity,'number')}${sel('unit','Birim',choices(WORK_UNITS),row.unit)}${input('material','Malzeme',row.material)}${input('from_place','Yükleme / nereden',row.from_place)}${input('to_place','Teslim / nereye',row.to_place)}${price}`:row.kind==='fuel'?`${input('liters','Litre',row.liters,'number')}${sel('fuel_source','Kesin kaynak — belirsizse seçmeyin',choices(FUEL_SOURCES),row.fuel_source)}`:`${input('amount','Gider tutarı',row.amount,'number')}${sel('category','Gider kategorisi',choices(EXPENSE_CATEGORIES),row.category)}`}</div>${input('description','Açıklama',row.description)}<details><summary>Kaynak sayfa / satır metnini düzelt</summary>${input('page','PDF sayfası',row.page,'number')}<label class="field">PDF’den kontrol edilmiş satır metni<textarea name="quote" maxlength="1600">${esc(row.quote)}</textarea></label></details>${row.kind==='expense'?'<p class="tiny muted">Ödenip ödenmediği varsayılmaz; kasa/tahsilat kaydı oluşturulmaz.</p>':''}${row.kind==='fuel'?'<p class="tiny muted">Depo Tankı seçilirse gerçek depo çıkışı oluşur ve stok kontrol edilir. Geçmiş depo girişlerinin de kayıtlı olması gerekebilir.</p>':''}${similar.length?notice('warn',`${similar.length} benzer mevcut kayıt var. Aynı işse bu satırı seçmeyin; mevcut kaydı inceleyin.`)+similar.slice(0,5).map(x=>`<button class="btn sm" data-go="${row.kind==='work'?'#/isler/':row.kind==='fuel'?'#/yakit/':'#/gider/'}${esc(x.id)}">Mevcut kaydı incele</button>`).join(''):''}<label class="history-check small"><input type="checkbox" data-pdf-separate> Benzer kayıt varsa kontrol ettim; bu ayrı bir gerçek işlem.</label>${row.kind==='work'?`<details style="margin:10px 0"><summary>Yeni iş açmadan mevcut işe bağla</summary><p class="tiny muted">Tarih, müşteri, araç, miktar, birim ve iş türü uyuşmalı. Mevcut miktar, fiyat ve hakediş değişmez.</p><button class="btn block" data-pdf-find-existing ${old?'disabled':''}>Uygun mevcut işleri bul</button><select data-pdf-existing><option value="">— önce mevcut işleri bulun —</option></select><button class="btn block" data-pdf-link ${old?'disabled':''}>Kaynak PDF’yi seçilen işe bağla</button></details>`:''}<div data-pdf-map></div><button class="btn block" style="margin-top:8px" data-pdf-guide-open ${old?'disabled':''}>Eksikleri kısa sorularla tamamla</button><div data-pdf-guide></div><div data-pdf-status></div></section>`);
  }
  out.insertAdjacentHTML('beforeend',`<div class="card"><label class="history-check"><input type="checkbox" data-pdf-reviewed> Seçtiğim satırları orijinal PDF ile karşılaştırdım; tarihleri, adları ve varsa toplam farklarını kontrol ettim.</label><button class="btn primary block" data-pdf-save>Seçilenleri kaydet</button><p class="tiny muted">Eksik müşteri/araç için önce ilgili kartı oluşturup bu PDF’yi tekrar seçebilirsiniz. Okuma taslağı telefonda korunur; bütün satırları yeniden Gemini’ye göndermek gerekmez.</p></div>`);
  for(const card of qsa('[data-pdf-row]',out)){
   if(completed.has(card.dataset.pdfRow)){card.dataset.pdfDone='1';for(const el of qsa('input,select,textarea,button',card))if(!el.hasAttribute('data-go'))el.disabled=true;}
   if(blocked.has(card.dataset.pdfRow)){card.dataset.pdfBlocked='1';for(const el of qsa('input,select,textarea,button',card))if(!el.hasAttribute('data-go'))el.disabled=true;qs('[data-pdf-status]',card).innerHTML=notice('warn','Bu satırın önceki kayıt bağlantısı işlem türüyle uyuşmuyor. Kayıtlı veriler korundu; devam etmeden önce bağlantı incelenmeli.');}
   card.addEventListener('change',async e=>{collect(card);try{await remember();if(['customer_id','vehicle_id','personnel_id'].includes(e.target.name))await offerMapping(card,e.target.name);await renderQueue();}catch(e){qs('[data-pdf-status]',card).innerHTML=notice('warn','Taslak saklanamadı: '+e.message);}});
   qs('[data-pdf-guide-open]',card).onclick=()=>guide(card);
   const find=qs('[data-pdf-find-existing]',card);if(find)find.onclick=()=>findExisting(card);
   const link=qs('[data-pdf-link]',card);if(link)link.onclick=()=>linkExisting(card);
  }
  qs('[data-pdf-save]',out).onclick=save;await renderQueue();
 };
 const collect=card=>{
  const row=plan.rows.find(r=>r.id===card.dataset.pdfRow);
  for(const el of qsa('[name]',card)){let val=el.value;if(['page','quantity','liters','amount','unit_price','kdv_rate'].includes(el.name))val=val===''?null:Number(val);if(el.name==='kdv_included')val=val===''?null:val==='yes';row[el.name]=val;}
  return row;
 };
 async function offerMapping(card,field){
  const row=collect(card),target=row[field],source={customer_id:'customer_name',vehicle_id:'vehicle_name',personnel_id:'personnel_name'}[field];
  const box=qs('[data-pdf-map]',card);box.innerHTML='';if(!target||!source||!row[source]||unavailable().has(row.id))return;
  const d=await db.dumpAll(),ids=P.pdfMappingTargets(plan,field,row[source],target,d,unavailable());if(!ids.length)return;
  box.innerHTML=`<button class="btn block" data-pdf-map-apply>“${esc(row[source])}” için aynı PDF’deki ${ids.length} boş eşleşmeye uygula</button>`;
  qs('[data-pdf-map-apply]',box).onclick=async()=>{
   if(busy)return;busy=true;
   try{
    if(!(await confirmDialog('Bu belgedeki eşleşmeler uygulansın mı?',`“${row[source]}” yazan ${ids.length} boş satırda aynı kart seçilecek. Kayıtlı işler ve dolu seçimler değişmez; kayıt yazılmaz.`,'Eşleştir')))return;
    const changed=P.applyPdfMapping(plan,field,row[source],target,await db.dumpAll(),unavailable());
    for(const id of changed){const c=qsa('[data-pdf-row]',out).find(x=>x.dataset.pdfRow===id),el=c&&qs(`[name="${field}"]`,c);if(el)el.value=target;}
    await remember();await renderQueue();box.innerHTML=notice('info',`${changed.length} taslak satır eşleştirildi; henüz kayıt yazılmadı.`);
   }catch(e){box.innerHTML=notice('warn',e.message);}finally{busy=false;}
  };
 }
 async function guide(card){
  if(busy||unavailable().has(card.dataset.pdfRow))return;
  const row=collect(card),d=await db.dumpAll(),questions=P.pdfQuestions(row,d),box=qs('[data-pdf-guide]',card);
  if(!questions.length){box.innerHTML=notice('info','Zorunlu alanlar tamam. Orijinal PDF ile kontrol edip isterseniz satırı seçerek kaydedin.');return;}
  const q=questions[0],lists={vehicle:names(d,'vehicles'),customer:names(d,'customers'),work_type:choices(WORK_TYPES),unit:choices(WORK_UNITS),fuel_source:choices(FUEL_SOURCES),category:choices(EXPENSE_CATEGORIES),boolean:[['yes','Dahil'],['no','Hariç']]};
  const control=lists[q.type]?`<select data-pdf-answer>${options(lists[q.type],'')}</select>`:`<input data-pdf-answer type="${q.type==='date'?'date':q.type==='number'?'number':'text'}" step="any" maxlength="1600">`;
  box.innerHTML=`<div class="notice"><div><b>${esc(q.title)}</b><p class="tiny">${questions.length} eksik alan kaldı. Yanıt yalnız bu kontrol taslağını doldurur.</p>${control}<button class="btn block" data-pdf-answer-next>Yanıtı uygula / sonraki soru</button><div data-pdf-answer-error></div></div></div>`;
  qs('[data-pdf-answer-next]',box).onclick=async()=>{
   if(busy)return;busy=true;
   try{
    let answer=qs('[data-pdf-answer]',box).value;
    if(q.type==='number')answer=answer===''?null:Number(answer);
    if(q.type==='boolean')answer=answer===''?null:answer==='yes';
    P.answerPdfQuestion(row,q.key,answer,await db.dumpAll());
    const el=qs(`[name="${q.key}"]`,card);if(el)el.value=q.type==='boolean'?(answer?'yes':'no'):String(answer??'');
    await remember();await renderQueue();
   }catch(e){qs('[data-pdf-answer-error]',box).innerHTML=notice('warn',e.message);busy=false;return;}
   busy=false;await guide(card);
  };
 }
 async function findExisting(card){
  if(busy||unavailable().has(card.dataset.pdfRow))return;
  try{
   const row=collect(card),d=await db.dumpAll(),prepared=P.pdfLinkFields(row,d,{hash,document_id:'pdf-history-'+hash});
   const candidates=P.similarPdfRecords(d,prepared).filter(r=>r.work_type===row.work_type);
   const select=qs('[data-pdf-existing]',card);select.innerHTML=options(candidates.map(r=>[r.id,`${r.date} · ${r.work_type} · ${r.quantity} ${r.unit} · ${(r.description||r.material||'Açıklama yok').slice(0,70)}`]),'');
   qs('[data-pdf-status]',card).innerHTML=notice('info',candidates.length?`${candidates.length} uygun iş bulundu. Mevcut fiyat ve miktar korunacak.`:'Uyumlu iş bulunamadı; satır alanlarını kontrol edin.');
  }catch(e){qs('[data-pdf-status]',card).innerHTML=notice('warn',e.message);}
 }
 async function linkExisting(card){
  if(busy||unavailable().has(card.dataset.pdfRow))return;
  if(!file)return toast('Kaynak PDF’yi yeniden seçin.','err');
  const recordId=qs('[data-pdf-existing]',card).value;if(!recordId)return toast('Önce uygun mevcut işi seçin.','err');
  busy=true;const row=structuredClone(collect(card));
  const controls=qsa('input,select,textarea,button',card).filter(x=>!x.disabled);for(const el of controls)el.disabled=true;
  try{
   const expected=await db.get('work_records',recordId);if(!expected||expected.deleted_at)throw Error('Seçilen iş artık bulunamıyor.');
   if(!(await confirmDialog('Yeni iş açmadan PDF bağlansın mı?',`${row.date} · ${row.work_type} · ${row.quantity} ${row.unit}. Seçilen iş: ${expected.description||expected.material||'açıklama yok'}. İşin fiyatı, miktarı ve hakedişi değişmeyecek. Yalnız PDF / sayfa / kaynak satır bağlantısı eklenecek.`,'Kaynağı bağla')))return;
   const document_id=await archive();await P.linkPdfWork(db,row,hash,document_id,recordId,{confirmed:true,expected});
   completed.add(row.id);card.dataset.pdfDone='1';qs('[data-pdf-pick]',card).checked=false;
   qs('[data-pdf-status]',card).innerHTML=notice('info','PDF mevcut işe bağlandı; yeni iş ve tutar oluşturulmadı.')+`<button class="btn block" data-go="#/isler/${esc(recordId)}">Bağlanan işi aç</button>`;
   await remember();await renderQueue();
  }catch(e){qs('[data-pdf-status]',card).innerHTML=notice('warn',e.message);}finally{if(!completed.has(row.id))for(const el of controls)el.disabled=false;busy=false;}
 }
 async function archive(){
  const id='pdf-history-'+hash;
  const existing=await db.get('documents',id);if(existing&&existing.source_pdf_hash!==hash)throw Error('Kaynak belge kimliği uyuşmuyor.');if(existing?.deleted_at)throw Error('Bu PDF’nin arşiv kaydı silinmiş; önce Belge ekranından inceleyin.');
  if(!existing){try{await db.saveNew('documents',{id,category:'Şirket Evrakı',owner_type:'company',title:file.name,doc_no:'PDF-'+hash,date:todayStr(),source_pdf_hash:hash,note:'Geçmiş faaliyet aktarımı kaynak PDF; kesinleşmiş hakediş değildir. Belge tarihi arşive alınma günüdür; iş tarihleri satırlardan ayrı korunur.'},'PDF kaynak arşivi');}catch(e){if(!(await db.get('documents',id)))throw e;}}
  await db.addAttachment('document',id,file,{kind:'source_pdf'});return id;
 }
 async function save(){
  if(busy)return;
  const cards=qsa('[data-pdf-row]',out).filter(c=>qs('[data-pdf-pick]',c).checked&&!qs('[data-pdf-pick]',c).disabled);
  if(!file)return toast('Devam etmek için orijinal PDF’yi yeniden seçin.','err');
  if(!cards.length)return toast('Kaydedilecek satırları tek tek seçin.','err');
  if(!qs('[data-pdf-reviewed]',out).checked)return toast('Önce orijinal belgeyi kontrol ettiğinizi onaylayın.','err');
  const chosen=cards.map(card=>({card,row:structuredClone(collect(card)),separate:qs('[data-pdf-separate]',card).checked}));
  const locked=qsa('input,select,textarea',out).filter(el=>!el.disabled);for(const el of locked)el.disabled=true;
  busy=true;qs('[data-pdf-save]',out).disabled=true;read.disabled=true;qs('[data-pdf-file]',root).disabled=true;
  try{
   const fresh=await db.dumpAll();
   for(const {card:c,row} of chosen){try{P.pdfRowFields(row,fresh,{hash,document_id:'pdf-history-'+hash});}catch(e){qs('[data-pdf-status]',c).innerHTML=notice('warn',e.message);c.scrollIntoView();throw e;}}
   if(!(await confirmDialog('Geçmiş kayıtlar eklensin mi?',`${cards.length} seçili ayrıntı kaydedilecek. Hakediş/tahsilat oluşturulmayacak; PDF arşivlenecek. İşlem satır satır ilerler; hata olursa başarılı satırlar tekrar yazılmaz.`,'Onayla ve kaydet')))return;
   const document_id=await archive();let done=0,failed=0;
   for(const {card:c,row,separate} of chosen){try{
    const r=await P.savePdfRow(db,row,hash,document_id,{confirmed:true,separate});
    const store={work:'work_records',fuel:'fuel_records',expense:'expense_records'}[row.kind];
    if(!(await db.get(store,r.id)))throw Error('Kayıt sonucu doğrulanamadı.');
    qs('[data-pdf-status]',c).innerHTML=notice('info',r._existing?'Bu satır zaten kayıtlı; tekrar yazılmadı.':'Kaydedildi; kaynak PDF arşivine bağlı.')+`<button class="btn sm" data-go="#/belgeler/${esc(document_id)}">Kaynak PDF arşivi</button>`;qs('[data-pdf-pick]',c).checked=false;qs('[data-pdf-pick]',c).disabled=true;c.dataset.pdfDone='1';completed.add(row.id);for(const el of qsa('input,select,textarea,button',c))if(!el.hasAttribute('data-go'))el.disabled=true;done++;
   }catch(e){qs('[data-pdf-status]',c).innerHTML=notice('warn',e.message);qs('[data-pdf-pick]',c).checked=false;failed++;}}
   await remember();await renderQueue();toast(`${done} satır tamamlandı${failed?`; ${failed} satır kontrol bekliyor`:''}`,failed?'err':'ok');
  }catch(e){toast(e.message,'err');}
  finally{for(const el of locked)if(!el.closest('[data-pdf-done]'))el.disabled=false;busy=false;read.disabled=false;qs('[data-pdf-file]',root).disabled=false;const b=qs('[data-pdf-save]',out);if(b)b.disabled=false;}
 }
 qs('[data-pdf-file]',root).onchange=e=>{if(busy)return;file=e.target.files[0]||null;hash='';plan=null;out.innerHTML='';qs('[data-pdf-consent]',root).checked=false;};
 read.onclick=async()=>{
  if(busy)return;if(!file)return toast('PDF seçin.','err');busy=true;read.disabled=true;qs('[data-pdf-file]',root).disabled=true;
  try{
   file=await prepareAttachment(file,{pdfOnly:true});hash=await P.pdfDigest(file);if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=URL.createObjectURL(file);
   const cached=await db.metaGet('pdf_history_draft:'+hash);
   if(cached?.version===1&&Array.isArray(cached.rows)){plan=cached;try{await keepFile();delete plan._file_warning;}catch(e){plan._file_warning=e.message;}await remember();await draw();return;}
   if(!qs('[data-pdf-consent]',root).checked)throw Error('PDF’nin Gemini’ye gönderilmesi için onay gerekli.');
   const G=await import('./ai-gemini.js');if(!(await G.geminiSettings(db)).ready)throw Error('Gemini anahtarını ve veri gönderme iznini Ayarlar’dan kontrol edin.');
   if(!navigator.onLine)throw Error('İlk PDF okuması için internet gerekir.');
   out.innerHTML=notice('info','PDF okunuyor; henüz iş/yakıt/gider kaydı yazılmadı…');
   const encoded=await G.blobToBase64(file);
   const result=await G.withModelFallback(db,o=>G.geminiJson([{text:'Kaynak PDF (dosya adı tarih kanıtı değildir): '+file.name},{inlineData:{mimeType:'application/pdf',data:encoded}}],{...o,system:P.PDF_PROMPT,schema:P.pdfSchema()}));
   plan=P.normalizePdfHistory(result,await db.dumpAll());try{await keepFile();}catch(e){plan._file_warning=e.message;}await remember();await draw();
  }catch(e){out.innerHTML=notice('warn',e.message);}
  finally{busy=false;read.disabled=false;qs('[data-pdf-file]',root).disabled=false;}
 };
 await renderQueue();
 return true;
}

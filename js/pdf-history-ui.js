import { qs,qsa,esc,appbar,notice,toast,confirmDialog,todayStr } from './ui.js';
import { WORK_TYPES,WORK_UNITS,EXPENSE_CATEGORIES,FUEL_SOURCES,isActive } from './core.js';
import * as P from './pdf-history-core.js';
const label={work:'İş',fuel:'Yakıt',expense:'Gider',note:'Açıklama',summary:'Özet — kayıt oluşturmaz'};
const options=(list,value,empty='— seçin —')=>`<option value="">${empty}</option>`+list.map(([id,name])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(name)}</option>`).join('');
const sel=(name,title,list,value)=>`<label class="field">${title}<select name="${name}">${options(list,value)}</select></label>`;
const input=(name,title,value,type='text')=>`<label class="field">${title}<input name="${name}" type="${type}" ${type==='number'?'step="any"':''} value="${esc(String(value??''))}"></label>`;
export async function screen(ctx) {
 const {root,db}=ctx;let file=null,hash='',plan=null,blobUrl='',busy=false;
 root.innerHTML=appbar('Geçmiş işleri PDF’den aktar','Önce kontrol, sonra seçilen satırları kaydet')+`<div class="card"><p>İş, yakıt ve gider ayrıntıları okunur. Hakediş, tahsilat veya açılış bakiyesi oluşturulmaz. Fiyatsız işe bugünkü fiyat uygulanmaz.</p><label class="field">PDF (en fazla 15 MB)<input type="file" accept="application/pdf,.pdf" data-pdf-file></label><label class="history-check"><input type="checkbox" data-pdf-consent> Bu PDF’nin okunmak üzere Gemini’ye gönderilmesini kabul ediyorum.</label><button class="btn primary block" data-pdf-read>PDF’yi oku / kayıtlı taslağı aç</button></div><div data-pdf-result></div>`;
 const out=qs('[data-pdf-result]',root),read=qs('[data-pdf-read]',root);
 const names=(d,s)=>(d[s]||[]).filter(isActive).map(x=>[x.id,x.name||x.plate||x.id]);
 const choices=a=>a.map(x=>[x,x]);
 const remember=async()=>{if(hash&&plan)await db.metaSet('pdf_history_draft:'+hash,plan);};
 const draw=async()=>{
  const d=await db.dumpAll(),totals=P.pdfTotals(plan.rows),mismatch=P.pdfTotalIssues(plan);
  out.innerHTML=`<div class="card"><h3>Kontrol taslağı — seçmeden yeni kayıt yazılmaz</h3><a href="${blobUrl}" target="_blank" rel="noopener" class="btn">Orijinal PDF’yi aç</a><p>${plan.rows.length} satır · ${Object.entries(totals).map(([k,v])=>esc(k.replace('work:','İş ').replace('fuel:L','Yakıt L').replace('expense:TL','Gider TL'))+': '+esc(String(v))).join(' · ')}</p><p class="tiny muted">Bu rakamlar modelin çıkardığı ayrıntılardan hesaplandı; PDF’nin tamamının eksiksiz okunduğunun kanıtı değildir.</p>${mismatch.length?notice('warn','Belge toplamı ile ayrıntı uyuşmuyor: '+mismatch.join(' · ')):''}${plan.notes.map(n=>notice('warn',n)).join('')}</div>`;
  for(const row of plan.rows){
   if(!['work','fuel','expense'].includes(row.kind)){out.insertAdjacentHTML('beforeend',`<details class="card"><summary>${label[row.kind]} · sayfa ${row.page||'?'}</summary><p>${esc(row.quote||row.description)}</p></details>`);continue;}
   const opId=`pdf-history:${hash}:${row.id}`,old=await db.opLookup(opId);
   let similar=[];try{similar=P.similarPdfRecords(d,P.pdfRowFields(row,d,{hash,document_id:'pdf-history-'+hash}));}catch{}
   const price=`${input('unit_price','PDF’deki birim fiyat (yoksa boş)',row.unit_price,'number')}${input('kdv_rate','KDV % (yoksa boş)',row.kdv_rate,'number')}${sel('kdv_included','KDV fiyatın içinde mi?',[['yes','Dahil'],['no','Hariç']],row.kdv_included==null?'':row.kdv_included?'yes':'no')}`;
   out.insertAdjacentHTML('beforeend',`<section class="card" data-pdf-row="${row.id}"><label class="history-check"><input type="checkbox" data-pdf-pick ${old?'disabled':''}><b>${label[row.kind]} · sayfa ${row.page||'?'}</b></label>${old?notice('info','Bu PDF satırı daha önce kaydedildi.'):''}<p class="small">${esc(row.quote)}</p>${row.price_issue?notice('warn',row.price_issue):''}<p class="tiny muted">Belgedeki adlar: ${esc([row.customer_name,row.vehicle_name,row.personnel_name].filter(Boolean).join(' · '))}</p><div class="formgrid2">${input('date','Gerçek tarih',row.date,'date')}${sel('vehicle_id','Araç / makine',names(d,'vehicles'),row.vehicle_id)}${sel('personnel_id','Personel (biliniyorsa)',names(d,'personnel'),row.personnel_id)}${row.kind==='work'||row.kind==='fuel'?sel('customer_id',row.kind==='fuel'?'Yalnız müşteriden alınmışsa müşteri':'Müşteri',names(d,'customers'),row.customer_id):''}${row.kind==='work'?`${sel('work_type','İş türü',choices(WORK_TYPES),row.work_type)}${input('quantity','Miktar',row.quantity,'number')}${sel('unit','Birim',choices(WORK_UNITS),row.unit)}${input('material','Malzeme',row.material)}${input('from_place','Yükleme / nereden',row.from_place)}${input('to_place','Teslim / nereye',row.to_place)}${price}`:row.kind==='fuel'?`${input('liters','Litre',row.liters,'number')}${sel('fuel_source','Kesin kaynak — belirsizse seçmeyin',choices(FUEL_SOURCES),row.fuel_source)}`:`${input('amount','Gider tutarı',row.amount,'number')}${sel('category','Gider kategorisi',choices(EXPENSE_CATEGORIES),row.category)}`}</div>${input('description','Açıklama',row.description)}${row.kind==='expense'?'<p class="tiny muted">Ödenip ödenmediği varsayılmaz; kasa/tahsilat kaydı oluşturulmaz.</p>':''}${row.kind==='fuel'?'<p class="tiny muted">Depo Tankı seçilirse gerçek depo çıkışı oluşur ve stok kontrol edilir. Geçmiş depo girişlerinin de kayıtlı olması gerekebilir.</p>':''}${similar.length?notice('warn',`${similar.length} benzer mevcut kayıt var. Aynı işse bu satırı seçmeyin; mevcut kaydı inceleyin.`)+similar.slice(0,5).map(x=>`<button class="btn sm" data-go="${row.kind==='work'?'#/isler/':row.kind==='fuel'?'#/yakit/':'#/gider/'}${esc(x.id)}">Mevcut kaydı incele</button>`).join(''):''}<label class="history-check small"><input type="checkbox" data-pdf-separate> Benzer kayıt varsa kontrol ettim; bu ayrı bir gerçek işlem.</label><div data-pdf-status></div></section>`);
  }
  out.insertAdjacentHTML('beforeend',`<div class="card"><label class="history-check"><input type="checkbox" data-pdf-reviewed> Seçtiğim satırları orijinal PDF ile karşılaştırdım; tarihleri, adları ve varsa toplam farklarını kontrol ettim.</label><button class="btn primary block" data-pdf-save>Seçilenleri kaydet</button><p class="tiny muted">Eksik müşteri/araç için önce ilgili kartı oluşturup bu PDF’yi tekrar seçebilirsiniz. Okuma taslağı telefonda korunur; bütün satırları yeniden Gemini’ye göndermek gerekmez.</p></div>`);
  for(const card of qsa('[data-pdf-row]',out))card.addEventListener('change',async()=>{collect(card);try{await remember();}catch(e){qs('[data-pdf-status]',card).innerHTML=notice('warn','Taslak saklanamadı: '+e.message);}});
  qs('[data-pdf-save]',out).onclick=save;
 };
 const collect=card=>{
  const row=plan.rows.find(r=>r.id===card.dataset.pdfRow);
  for(const el of qsa('[name]',card)){let val=el.value;if(['quantity','liters','amount','unit_price','kdv_rate'].includes(el.name))val=val===''?null:Number(val);if(el.name==='kdv_included')val=val===''?null:val==='yes';row[el.name]=val;}
  return row;
 };
 async function archive(){
  const id='pdf-history-'+hash;
  const existing=await db.get('documents',id);if(existing&&existing.source_pdf_hash!==hash)throw Error('Kaynak belge kimliği uyuşmuyor.');if(existing?.deleted_at)throw Error('Bu PDF’nin arşiv kaydı silinmiş; önce Belge ekranından inceleyin.');
  if(!existing){try{await db.saveNew('documents',{id,category:'Şirket Evrakı',owner_type:'company',title:file.name,doc_no:'PDF-'+hash,date:todayStr(),source_pdf_hash:hash,note:'Geçmiş faaliyet aktarımı kaynak PDF; kesinleşmiş hakediş değildir. Belge tarihi arşive alınma günüdür; iş tarihleri satırlardan ayrı korunur.'},'PDF kaynak arşivi');}catch(e){if(!(await db.get('documents',id)))throw e;}}
  await db.addAttachment('document',id,file,{kind:'source_pdf'});return id;
 }
 async function save(){
  if(busy)return;
  const cards=qsa('[data-pdf-row]',out).filter(c=>qs('[data-pdf-pick]',c).checked&&!qs('[data-pdf-pick]',c).disabled);
  if(!cards.length)return toast('Kaydedilecek satırları tek tek seçin.','err');
  if(!qs('[data-pdf-reviewed]',out).checked)return toast('Önce orijinal belgeyi kontrol ettiğinizi onaylayın.','err');
  const chosen=cards.map(card=>({card,row:structuredClone(collect(card)),separate:qs('[data-pdf-separate]',card).checked}));
  const locked=qsa('input,select',out).filter(el=>!el.disabled);for(const el of locked)el.disabled=true;
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
    qs('[data-pdf-status]',c).innerHTML=notice('info',r._existing?'Bu satır zaten kayıtlı; tekrar yazılmadı.':'Kaydedildi; kaynak PDF arşivine bağlı.')+`<button class="btn sm" data-go="#/belgeler/${esc(document_id)}">Kaynak PDF arşivi</button>`;qs('[data-pdf-pick]',c).checked=false;qs('[data-pdf-pick]',c).disabled=true;c.dataset.pdfDone='1';done++;
   }catch(e){qs('[data-pdf-status]',c).innerHTML=notice('warn',e.message);qs('[data-pdf-pick]',c).checked=false;failed++;}}
   await remember();toast(`${done} satır tamamlandı${failed?`; ${failed} satır kontrol bekliyor`:''}`,failed?'err':'ok');
  }catch(e){toast(e.message,'err');}
  finally{for(const el of locked)if(!el.closest('[data-pdf-done]'))el.disabled=false;busy=false;read.disabled=false;qs('[data-pdf-file]',root).disabled=false;const b=qs('[data-pdf-save]',out);if(b)b.disabled=false;}
 }
 qs('[data-pdf-file]',root).onchange=e=>{if(busy)return;file=e.target.files[0]||null;hash='';plan=null;out.innerHTML='';qs('[data-pdf-consent]',root).checked=false;};
 read.onclick=async()=>{
  if(busy)return;if(!file)return toast('PDF seçin.','err');busy=true;read.disabled=true;qs('[data-pdf-file]',root).disabled=true;
  try{
   hash=await P.pdfDigest(file);if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=URL.createObjectURL(file);
   const cached=await db.metaGet('pdf_history_draft:'+hash);
   if(cached?.version===1&&Array.isArray(cached.rows)){plan=cached;await draw();return;}
   if(!qs('[data-pdf-consent]',root).checked)throw Error('PDF’nin Gemini’ye gönderilmesi için onay gerekli.');
   const G=await import('./ai-gemini.js');if(!(await G.geminiSettings(db)).ready)throw Error('Gemini anahtarını ve veri gönderme iznini Ayarlar’dan kontrol edin.');
   if(!navigator.onLine)throw Error('İlk PDF okuması için internet gerekir.');
   out.innerHTML=notice('info','PDF okunuyor; henüz iş/yakıt/gider kaydı yazılmadı…');
   const encoded=await G.blobToBase64(file);
   const result=await G.withModelFallback(db,o=>G.geminiJson([{text:'Kaynak PDF (dosya adı tarih kanıtı değildir): '+file.name},{inlineData:{mimeType:'application/pdf',data:encoded}}],{...o,system:P.PDF_PROMPT,schema:P.pdfSchema()}));
   plan=P.normalizePdfHistory(result,await db.dumpAll());await remember();await draw();
  }catch(e){out.innerHTML=notice('warn',e.message);}
  finally{busy=false;read.disabled=false;qs('[data-pdf-file]',root).disabled=false;}
 };
 return true;
}

// Shared draft completion. Model output is a proposal; every edit remains unposted until Save.
import {esc,qs,fmtNum,todayStr} from './ui.js';
import {foldTr} from './parser.js';
import {parseTrNumber} from './money-roles.js';
import {validDate} from './driver-delivery.js';
import {dateWords} from './command-router.js';
import {bulkWorkReady} from './assistant-batch.js';

export const DRAFT_KINDS={
 work:{group:'works',label:'İş',required:['date','customer','vehicle','work_type','quantity','unit']},
 collection:{group:'collections',label:'Tahsilat',required:['date','customer','amount','method']},
 expense:{group:'expenses',label:'Gider',required:['date','amount','category']},
 fuel:{group:'fuel',label:'Yakıt',required:['date','vehicle','source','liters']},
 maintenance:{group:'maintenance',label:'Bakım',required:['date','vehicle','description']},
};
export const DRAFT_FIELDS={date:'Tarih',customer:'Müşteri',vehicle:'Araç',work_type:'İş türü',quantity:'Miktar',unit:'Birim',personnel:'Personel',site:'Şantiye',unit_price:'Birim fiyat',amount:'Tutar',method:'Ödeme şekli',bank:'Banka hesabı',category:'Kategori',pay:'Ödeme',supplier:'Tedarikçi',source:'Yakıt kaynağı',fuel_customer:'Mazotu veren müşteri',liters:'Litre',total:'Toplam tutar',description:'Açıklama',maint_type:'Bakım türü',status:'Durum',cost:'Bakım tutarı',material:'Malzeme'};
const rawField={customer:'customer_id',vehicle:'vehicle_id',site:'site_id',personnel:'personnel_id',bank:'bank_account_id',supplier:'supplier_id',fuel_customer:'customer_id',pay:'payment_method'};
const refs={customer:'customers',vehicle:'vehicles',site:'sites',personnel:'personnel',bank:'bank_accounts',supplier:'suppliers',fuel_customer:'customers'};
const positive=new Set(['quantity','unit_price','amount','liters','total','cost']);
const key=s=>foldTr(String(s||'')).replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const text=s=>foldTr(String(s||'')).trim().replace(/\s+/g,' ');
const amount=s=>{const m=/^(\d+(?:[.,]\d+)*)(?:\s*(bin|milyon))?\s*(?:tl|lira|₺)?$/u.exec(text(s));if(!m)return null;const n=parseTrNumber(m[1])*(m[2]==='bin'?1000:m[2]==='milyon'?1e6:1);return Number.isFinite(n)&&n>0&&n<=1e12?n:null;};
export function startDraftPlan(message){
 const t=text(message).replace(/[.!?]$/,'');
 for(const [kind,forms] of Object.entries({work:'is(?: kaydi)?',collection:'tahsilat(?: kaydi)?',expense:'gider(?: kaydi)?',fuel:'yakit(?: kaydi)?',maintenance:'(?:bakim|ariza)(?: kaydi| bildirimi)?'})){
  if(new RegExp(`^(?:lutfen )?(?:yeni )?${forms} (?:olustur|ekle|ac|gir|hazirla)$`).test(t))return {[DRAFT_KINDS[kind].group]:[{date:null,...(kind==='work'?{date_source:'yok'}:{})}]};
 }
 return null;
}
export function draftMissing(row){
 const required=[...(DRAFT_KINDS[row.kind]?.required||[])];
 if(row.kind==='collection'&&row.fields.method==='Havale')required.push('bank');
 if(row.kind==='fuel'&&row.fields.source==='Müşteri Verdi')required.push('fuel_customer');
 if(row.kind==='maintenance'&&row.fields.supplier)required.push('cost');
 return required.filter(f=>f==='date'?!validDate(row.fields[f]):positive.has(f)?!(Number(row.fields[f])>0&&Number.isFinite(Number(row.fields[f]))):!String(row.fields[f]||'').trim());
}
export function draftPreflight(rows,d){
 for(const row of rows){
  const missing=draftMissing(row);if(missing.length)return {key:row.key,field:missing[0],message:`${row.label}: ${missing.map(f=>DRAFT_FIELDS[f]).join(', ')} alanını tamamlayın.`};
  for(const [f,value] of Object.entries(row.fields)){
   if(positive.has(f)&&value!==''&&value!=null&&(!(Number(value)>0)||!Number.isFinite(Number(value))))return {key:row.key,field:f,message:`${row.label}: ${DRAFT_FIELDS[f]} pozitif bir sayı olmalı.`};
   const store=refs[f];if(!store||!value)continue;
   if(f==='customer'&&String(value).startsWith('new:')&&String(value).slice(4).trim())continue;
   if(f==='site'&&String(value).startsWith('new:')&&String(value).slice(4).trim())continue;
   if(!(d[store]||[]).some(x=>!x.deleted_at&&x.id===value))return {key:row.key,field:f,message:`${row.label}: seçilen ${DRAFT_FIELDS[f]} artık kullanılamıyor; tekrar seçin.`};
  }
 }
 return null;
}
function targetText(input){
 let t=String(input||'').trim(),kind=null,index=null;
 const m=/^(?:(ilk|birinci|ikinci|ucuncu|dorduncu|besinci|son|\d+\.)\s+)?(is|tahsilat|gider|yakit|bakim)(?:in|i|nin|nın|a|e|ta|te)?\s*[:,-]?\s+(.+)$/u.exec(text(t));
 if(m&&!(m[2]==='is'&&m[3].startsWith('turu '))){kind={is:'work',tahsilat:'collection',gider:'expense',yakit:'fuel',bakim:'maintenance'}[m[2]];index=m[1]?({ilk:0,birinci:0,ikinci:1,ucuncu:2,dorduncu:3,besinci:4,son:-1}[m[1]]??Number.parseInt(m[1])-1):null;t=t.slice(m[0].length-m[3].length);}
 return {body:t,kind,index};
}
function dateValue(value,today){
 const f=text(value);if(!/^(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?|bugun|dun|evvelsi gun)$/u.test(f))return null;
 const r=dateWords(value,today);return r&&r[0]===r[1]&&validDate(r[0])?r[0]:null;
}
const aliases=[['customer','musteri'],['vehicle','arac|plaka|makine'],['personnel','personel|sofor|operator'],['site','santiye'],['work_type','is turu'],['date','tarih'],['unit_price','birim fiyat(?:i)?|litre fiyati|litresi'],['quantity','miktar'],['amount','tutar(?:i)?|bedel(?:i)?'],['total','toplam'],['method','odeme sekli|tahsilat sekli|sekli'],['bank','banka(?: hesabi)?'],['category','kategori'],['source','yakit kaynagi|kaynak'],['fuel_customer','mazotu veren musteri'],['liters','litre'],['description','aciklama'],['maint_type','bakim turu|turu'],['status','durum'],['cost','bakim tutari'],['material','malzeme']];
export function resolveDraftReply(message,rows,today=todayStr()){
 if(!rows.length)return null;
 const scoped=targetText(message),f=text(scoped.body).replace(/\s+(?:olacak|olsun|yap)[.!]?$/u,'').replace(/[.!?]$/,'');
 if(!f||f.length>300||/SP1:|\n/i.test(message))return null;
 // A fresh business statement, question, promise or negation is not a field correction.
 if(!/^(?:aciklama|malzeme)\s*[:=]?\s+/u.test(f)&&/\b(?:yapildi|yaptik|tasindi|odedi|odeme geldi|aldik|alindi|verildi|verecek|odeyecek|degil|olmasin|sil|goster|listele|olustur|ekle)\b/u.test(f))return null;
 let field=null,value=null,explicit=false,updates=null;
 for(const [name,pattern] of aliases){const m=new RegExp(`^(?:${pattern})\\s*[:=]?\\s+(.+)$`).exec(f);if(m){field=name;value=m[1];explicit=true;break;}}
 let possible=rows.filter(r=>!scoped.kind||r.kind===scoped.kind).map(r=>({...r}));
 if(scoped.index!=null){const i=scoped.index===-1?Math.max(...possible.map(r=>r.index)):scoped.index;possible=possible.filter(r=>r.index===i);}
 if(possible.some(r=>Object.entries(r.options).some(([name,opts])=>draftMissing(r).includes(name)&&opts.some(o=>[o.value,o.label,...(o.aliases||[])].some(x=>key(x)===key(scoped.body)))))){field=null;value=null;explicit=false;}
 const qty=/^(\d+(?:[.,]\d+)?)\s*(sefer|saat|sa|ton|yevmiye|adet|litre|lt)[.!]?$/u.exec(field==='quantity'?value:f);
 if(!qty&&!['description','material'].includes(field)&&/\d[\d.,]*\s*(?:sefer|saat|ton|yevmiye|litre|lt)\b/u.test(f))return null;
 if(['quantity','liters'].includes(field)&&/(?:\btl\b|\blira\b|₺)/u.test(value||''))return {type:'clarify',message:'Miktar/litre alanına para tutarı yazılmaz. Örneğin 3 sefer veya 20 litre yazın; fiyatı ayrı belirtin.'};
 if(qty&&!(parseTrNumber(qty[1])>0))return {type:'clarify',message:'Miktar sıfırdan büyük olmalı.'};
 if(qty){field=/^(litre|lt)$/.test(qty[2])?'liters':'quantity';updates=field==='liters'?{liters:parseTrNumber(qty[1])}:{quantity:parseTrNumber(qty[1]),unit:{sefer:'Sefer',saat:'Saat',sa:'Saat',ton:'Ton',yevmiye:'Yevmiye',adet:'Adet'}[qty[2]]};}
 else if(!field&&dateValue(scoped.body,today)){field='date';value=dateValue(scoped.body,today);}
 else if(!field&&/^(?:\d[\d.,]*(?:\s*(?:bin|milyon))?)\s*(?:tl|₺|lira)$/u.test(f)){field='money';value=f;}
 if(field){
  if(field==='date'){value=dateValue(value,today);if(!value)return {type:'clarify',message:'Geçerli bir tarih yazın; örneğin 18.10.2026 veya dün.'};updates={date:value};}
  else if(field==='quantity'&&!updates){value=amount(value);if(!value)return {type:'clarify',message:'Miktarı pozitif sayı ve birimiyle yazın; örneğin 3 sefer veya 2 saat.'};updates={quantity:value};}
  else if(['money','amount','total','unit_price','cost','liters'].includes(field)){
   const n=amount(value);if(!n)return {type:'clarify',message:'Tutar veya miktar pozitif bir sayı olmalı. Örneğin tutar 20.000 TL.'};
   const moneyField=r=>field==='money'||field==='amount'?r.kind==='collection'||r.kind==='expense'?'amount':r.kind==='maintenance'?'cost':null:field==='total'?r.kind==='fuel'?'total':null:field;
   possible=possible.map(r=>({...r,_field:moneyField(r)})).filter(r=>r._field&&Object.hasOwn(r.fields,r._field)&&(!(field==='money')||scoped.kind||!r.fields[r._field]));
   if(!possible.length&&['money','amount','total'].includes(field)&&rows.some(r=>r.kind==='work'))return {type:'clarify',message:'Bu tutar işin birim fiyatı mı, toplam bedeli mi, yoksa tahsilat mı? Birim fiyat için “birim fiyat 1500 TL” yazın. Alınan para için ayrı tahsilat kartı hazırlayın.'};
   for(const r of possible)r._updates={[r._field]:n};
  } else if(!updates){
   possible=possible.filter(r=>Object.hasOwn(r.fields,field));
   for(const r of possible){
    if(r.options[field]){const found=r.options[field].filter(o=>[o.value,o.label,...(o.aliases||[])].some(x=>key(x)===key(value)));r._updates=found.length===1?{[field]:found[0].value}:null;}
    else if(['description','material'].includes(field)&&value.length<=300)r._updates={[field]:String(scoped.body).trim().replace(/\s+/g,' ').slice(0,f.length).slice(-value.length)};
   }
   possible=possible.filter(r=>r._updates);
  }
  if(updates)possible=possible.filter(r=>Object.keys(updates).every(k=>Object.hasOwn(r.fields,k))).map(r=>({...r,_updates:updates}));
 } else {
  // A bare card name/type/method is accepted only for an actually missing select field and a unique exact option.
  if(possible.some(r=>Object.entries(r.options).some(([name,opts])=>draftMissing(r).includes(name)&&opts.filter(o=>[o.value,o.label,...(o.aliases||[])].some(x=>key(x)===key(scoped.body))).length>1)))return {type:'clarify',message:'Bu ad veya plakayla birden fazla kart var. Doğru kartı aşağıdaki listeden seçin; rastgele eşleştirmeyeceğim.'};
  possible=possible.flatMap(r=>Object.entries(r.options).filter(([name])=>draftMissing(r).includes(name)).flatMap(([name,opts])=>{const found=opts.filter(o=>[o.value,o.label,...(o.aliases||[])].some(x=>key(x)===key(scoped.body)));return found.length===1?[{...r,_updates:{[name]:found[0].value}}]:[]}));
  if(!possible.length)return null;
 }
 possible=possible.filter(r=>r._updates&&Object.values(r._updates).every(x=>x!==null));
 if(!possible.length)return explicit||scoped.kind?{type:'clarify',message:'Bu alan için tek bir uygun kayıt/seçenek bulamadım. Karttaki listeden seçin veya kart türünü ve tam adı belirtin.'}:null;
 const choices=possible.map(r=>({key:r.key,label:r.label,updates:r._updates}));
 if(choices.length!==1)return {type:'choose',message:'Hangi taslağa uygulayayım? Diğer kartlar değişmeyecek.',choices};
 return {type:'apply',...choices[0]};
}
export function readDraftRows(out,v,d){
 return [...out.querySelectorAll('.card[data-kind]')].flatMap(card=>{
  const kind=card.dataset.kind,def=DRAFT_KINDS[kind],index=Number(card.dataset.i),data=v[def?.group]?.[index];
  if(!def||!data||data.driver_entry_id||data.driverDup||card.dataset.saved||v._done)return [];
  const fields={},options={};
  for(const el of card.querySelectorAll('[name]')){
   if(!DRAFT_FIELDS[el.name]||el.dataset.draftEditable==='0')continue;
   fields[el.name]=el.value;
   if(el.tagName==='SELECT')options[el.name]=[...el.options].filter(o=>o.value).map(o=>({value:o.value,label:o.textContent,aliases:el.name==='vehicle'?[(d.vehicles||[]).find(x=>x.id===o.value)?.plate||'']:[]}));
  }
  return [{key:kind+':'+index,kind,index,label:def.label+' '+(index+1),fields,options,selected:!!qs('[data-pick]',card)?.checked,saved:card.dataset.saved==='1',disabled:!!qs('[data-pick]',card)?.disabled}];
 });
}
export function applyDraftPlan(plan,row,updates){
 const group=DRAFT_KINDS[row.kind].group,next={...plan,[group]:[...(plan[group]||[])]},data={...(next[group][row.index]||{})};
 for(const [field,value] of Object.entries(updates)){
  if(field==='customer'){data.customer_id=String(value).startsWith('new:')?null:value;data.new_customer=String(value).startsWith('new:')?value.slice(4):null;if(data.customer_id)data.new_customer_parent_id=null;}
  else data[rawField[field]||field]=positive.has(field)?Number(value):value;
  if(field==='date')data.date_source='mesaj';
 }
 next[group][row.index]=data;return next;
}
export function bindDraftWorkflow(out,v,d){
 for(const el of out.querySelectorAll('.card[data-kind] [name]'))if(DRAFT_FIELDS[el.name])el.dataset.draftEditable=el.disabled?'0':'1';
 if(!readDraftRows(out,v,d).length)return null;
 const panel=document.createElement('section');panel.className='card';panel.dataset.draftWorkflow='';out.prepend(panel);
 const controls=document.createElement('div'),body=document.createElement('div');
 controls.className='row';controls.style.cssText='gap:6px;flex-wrap:wrap;margin:8px 0';
 controls.innerHTML='<button class="btn small" data-batch-ready>Hazır iş kartlarını seç</button><button class="btn small" data-batch-prices>İşlerin fiyatını sonra belirle</button>';
 panel.innerHTML='<b>İşlem taslakları</b>';panel.append(controls,body);
 const read=()=>readDraftRows(out,v,d);
 const refresh=()=>{
  const rows=read(),missing=rows.filter(r=>draftMissing(r).length),quantities={};
  for(const r of rows.filter(r=>r.kind==='work'&&Number(r.fields.quantity)>0&&r.fields.unit))quantities[r.fields.unit]=(quantities[r.fields.unit]||0)+Number(r.fields.quantity);
  body.innerHTML=`<div class="small" data-draft-status>${rows.length} taslak · ${missing.length} eksik · ${rows.filter(r=>r.selected).length} seçili</div>${Object.entries(quantities).length?`<p class="small">İş miktarı: ${Object.entries(quantities).map(([u,n])=>esc(fmtNum(n)+' '+u)).join(' · ')}</p>`:''}${rows.map(r=>`<button class="btn block small" style="display:block;margin-top:6px;text-align:left;white-space:normal" data-draft-focus="${esc(r.key)}"><b>${esc(r.label)}</b>${r.fields.customer?` · ${esc(r.options.customer?.find(o=>o.value===r.fields.customer)?.label||'')}`:''}<br>${draftMissing(r).length?'Eksik: '+esc(draftMissing(r).map(f=>DRAFT_FIELDS[f]).join(', ')):'Alanlar tamam; kontrol edip kartı işaretleyin.'}</button>`).join('')}<p class="tiny muted">Sohbetle tamamlayabilirsiniz: “ikinci iş 3 sefer”, “araç 34ABC123”, “tahsilat tutarı 20.000 TL”. Kartlar Kaydet düğmesine basana kadar taslaktır.</p><div data-draft-reply role="status"></div>`;
  const workRows=rows.filter(r=>r.kind==='work'&&!r.saved);
  controls.hidden=!workRows.length;
  if(workRows.length){
   qs('[data-batch-prices]',controls).onclick=()=>{applyBatch({hasPriceDirective:true,deferPrices:true});qs('[data-draft-reply]',panel).textContent='İş fiyatları bekliyor olarak ayarlandı. Kontrol edip hazır iş kartlarını seçebilirsiniz.';};
   qs('[data-batch-ready]',controls).onclick=()=>{
    let count=0;
    for(const row of read()){
     const data=v[DRAFT_KINDS[row.kind].group]?.[row.index];
     if(!draftMissing(row).length&&!draftPreflight([row],d)&&bulkWorkReady(row,data)){
      const card=out.querySelector(`[data-kind="work"][data-i="${row.index}"]`);qs('[data-pick]',card).checked=true;count++;
     }
    }
    refresh();qs('[data-draft-reply]',panel).textContent=`${count} hazır iş kartı seçildi. Eksik, tahminli, mükerrer ve şoför kartlarını ayrı kontrol edin. Kaydet düğmesiyle uygulanacak.`;
   };
  }
  for(const btn of panel.querySelectorAll('[data-draft-focus]'))btn.onclick=()=>{const row=read().find(r=>r.key===btn.dataset.draftFocus),card=out.querySelector(`[data-kind="${row.kind}"][data-i="${row.index}"]`);card.scrollIntoView({block:'center',behavior:'smooth'});const field=qs(`[name="${draftMissing(row)[0]||'date'}"]`,card);field?.focus({preventScroll:true});};
 };
 out.addEventListener('input',refresh);out.addEventListener('change',refresh);refresh();
 const apply=(change,reply)=>{
  const row=read().find(r=>r.key===change.key);if(!row)throw Error('Taslak artık açık değil.');
  const card=out.querySelector(`[data-kind="${row.kind}"][data-i="${row.index}"]`),data=v[DRAFT_KINDS[row.kind].group][row.index];
  data._workflowWasReady ||= data.ok===true;
  for(const [f,value] of Object.entries(change.updates)){
   const el=qs(`[name="${f}"]`,card);if(!el||el.dataset.draftEditable==='0')throw Error('Alan artık değiştirilemiyor.');
   if(el.tagName==='SELECT'&&![...el.options].some(o=>o.value===String(value)))throw Error('Seçenek değişmiş; karttan tekrar seçin.');
   el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
   const raw=rawField[f]||f;data[raw]=value;
   if(f==='customer'){data.customer_id=String(value).startsWith('new:')?null:value;data.new_customer=String(value).startsWith('new:')?value.slice(4):null;if(data.customer_id)data.new_customer_parent_id=null;data.customerGuess=false;}
   if(f==='quantity')data.guessed=false;
   if(f==='vehicle')data.vehicleGuess=false;
   if(f==='date')data.dateUnsure=false;
  }
  const settled={date:/İş tarihi mesajda yazmıyor|^Toplu iş tarihini|^Tarih .*doğrulanamadı|^Tarih (?:yok|seçilmeli)/,customer:/^Müşteri (?:seçilmeli|belirtilmemiş|mesajda yazmıyor)/,vehicle:/^Araç (?:seçilmeli|")/,work_type:/^İş türü seçilmeli/,quantity:/^Miktar (?:yok|[\d.,]+ mesajda)/,unit:/^Birim seçilmeli/,amount:/^Tutar (?:yok|[\d.,]+ mesajda)/};
  data.issues=(data.issues||[]).filter(issue=>!Object.keys(change.updates).some(field=>settled[field]?.test(issue)));
  const warnings=card.querySelector('[data-row-issues]');if(warnings)warnings.textContent=data.issues.length?'⚠ '+data.issues.join(' · '):'';
  data._workflowCompleted=true;
  qs('[data-pick]',card).checked=false;data.ok=false;
  v._workflowReplies=[...(v._workflowReplies||[]),reply].slice(-20);
  refresh();return {row,missing:draftMissing(read().find(r=>r.key===row.key))};
 };
 const applyBatch=policy=>{
  const changed=[];
  for(const row of read().filter(r=>r.kind==='work'&&!r.saved)){
   const data=v.works[row.index];
   if(data.fromDriver||data.driver_entry_id||data.unverified||data.driverDup)continue;
   if(policy.date)apply({key:row.key,updates:{date:policy.date}},'Toplu iş tarihi: '+policy.date);
   if(policy.hasPriceDirective){
    const card=out.querySelector(`[data-kind="work"][data-i="${row.index}"]`),box=qs('[name=price_pending]',card);
    if(box){box.checked=policy.deferPrices;box.dispatchEvent(new Event('change',{bubbles:true}));qs('[data-pick]',card).checked=false;data.price_pending=policy.deferPrices;}
   }
   changed.push(row);
  }
  if(changed.length&&policy.hasPriceDirective)v._workflowReplies=[...(v._workflowReplies||[]),policy.deferPrices?'İşlerin fiyatları kullanıcı isteğiyle bekliyor.':'Kullanıcı fiyat önizlemesini yeniden açtı.'].slice(-20);
  refresh();return changed;
 };
 return {read,refresh,resolve:message=>resolveDraftReply(message,read()),apply,applyBatch,panel};
}

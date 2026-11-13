import {createUndoWindow,coverageText,mountDraftPicker} from './assistant-evening311.js';
import {assistantQuestions} from './assistant-questions.js';
import {inferenceReason,repaintConfidenceBadges} from './assistant-confidence-ui.js';
import {esc,qs,fmtTL,trDate,fmtNum} from './ui.js';
import {readDraftRows,draftMissing,DRAFT_FIELDS} from './assistant-workflow.js';
import {detailedAssistant,DETAIL_PREFERENCE} from './assistant-page-ui.js';
import {reviewTotals,reviewStates,reviewState,sensitiveAssistantRow,groupedDraftQuestions} from './assistant-review-core.js';
const groups={work:'works',expense:'expenses',fuel:'fuel',fuelout:'fuelOut',collection:'collections',maintenance:'maintenance',ticket:'tickets',doc:'docs',tank:'tankIn',personnel:'personnel',edit:'edits',card:'cards',memory:'memory',price:'prices',action:'actions',setting:'settings'};
const labels={work:'İş',expense:'Gider',fuel:'Yakıt',fuelout:'Müşteriye mazot',collection:'Tahsilat',maintenance:'Bakım',ticket:'Fiş',doc:'Belge',tank:'Depo girişi',personnel:'Personel',edit:'Kayıt düzeltme',card:'Kart',memory:'Hatırlanacak bilgi',price:'Fiyat kuralı',action:'İşlem',setting:'Ayar'};
export function openReviewCard(card){const detail=card?.querySelector('[data-record-details]');if(detail)detail.open=true;}
export function bindAssistantReview(ctx,out,v,d){
 const cards=[...out.querySelectorAll('.card[data-kind]')];if(!cards.length)return;
 out.querySelector('[data-model-questions]')?.setAttribute('hidden','');
 let expanded=detailedAssistant(),filter='all';
 const panel=document.createElement('section');panel.className='card assistant-review-overview';panel.dataset.reviewOverview='';panel.innerHTML='<h2>Kayıtları kontrol edelim</h2><div class="assistant-review-states" data-review-states aria-label="Bu isteğin kartları"></div><p class="small" data-review-filter-notice hidden></p><div data-review-counts role="status"></div><div class="assistant-review-tools"><button type="button" class="btn sm" data-review-expand></button><button type="button" class="btn sm" data-review-compose>Konuşarak düzelt</button></div>';out.prepend(panel);
 const questionBox=document.createElement('section');questionBox.className='card';questionBox.dataset.reviewQuestions='';out.append(questionBox);
 if((v.works||[]).length>20){const count=document.createElement('p');count.className='notice info';count.dataset.largeReviewCount='';count.textContent=v.works.length+' iş satırının tamamı kontrol listesinde. Henüz kaydedilmedi; seçili satırları kontrol edip onaylayın.';panel.append(count);}
 const batchControls=qs('[data-batch-ready]',out)?.parentElement;if(batchControls)qs('.assistant-review-tools',panel).append(batchControls);
 const bulk=qs('[data-bulk-start]',out);if(bulk){const more=document.createElement('details');more.className='assistant-review-more';more.open=expanded||(v.works?.length||0)+(v.fuel?.length||0)>1;more.innerHTML='<summary>Geçmiş / toplu aktarım seçenekleri</summary>';more.append(bulk);panel.append(more);}
 const workflow=qs('[data-draft-workflow]',out),workflowBody=workflow?qs('[data-draft-body]',workflow):null;if(workflowBody){const wrapper=document.createElement('details');wrapper.className='assistant-workflow-details';wrapper.open=expanded;wrapper.innerHTML='<summary>Alan kontrolleri ve satır listesi</summary>';workflowBody.before(wrapper);wrapper.append(workflowBody);}
 for(const card of cards){
  const pick=qs('[data-pick]',card),header=pick?.closest('label');if(!header)continue;
  const details=document.createElement('details');details.className='assistant-record-details';details.dataset.recordDetails='';details.open=expanded||['edit','action','setting','price','memory','card'].includes(card.dataset.kind);
  const summary=document.createElement('summary');summary.dataset.recordSummary='';details.append(summary);
  for(const node of [...card.childNodes])if(node!==header)details.append(node);
  card.append(details);card.classList.add('assistant-record');
 }
 const read=()=>{
  const workflows=readDraftRows(out,v,d);
  return cards.filter(c=>c.isConnected).map(card=>{const kind=card.dataset.kind,index=Number(card.dataset.i),r=v[groups[kind]]?.[index]||{},draft=workflows.find(w=>w.kind===kind&&w.index===index),pick=qs('[data-pick]',card);
   const issueText=[...card.querySelectorAll('[data-row-issues],[data-fuelout-issues]')].map(el=>el.textContent.trim()).filter(Boolean).join(' · ');
   return {card,kind,index,label:labels[kind]||'Kayıt',selected:!!pick?.checked,disabled:!!pick?.disabled,saved:card.dataset.saved==='1',missing:[...(draft?draftMissing(draft):[]),...(kind==='work'&&r.priceInfo?.ambiguous&&!r.priceQuestion?['unit_price']:[])],issues:!!issueText,issueText,duplicate:!!r.driverDup||/mükerrer|zaten kayıtlı|daha önce kaydedil/i.test(issueText),r,fields:draft?.fields||{},options:draft?.options||{},key:draft?.key};});
 };
 const value=(card,name)=>{const e=qs('[name="'+name+'"]',card);if(!e)return '';return e.tagName==='SELECT'?(e.value?e.selectedOptions[0]?.textContent||'':''):e.type==='checkbox'?e.checked:e.value;};
 const renderRow=row=>{
  const {card,kind,r}=row,parts=[],fields=names=>names.map(n=>value(card,n)).filter(x=>x!==''&&x!=null);
  if(['ticket','doc'].includes(kind))parts.push(...fields(['ticket_no','doc_no']));
  const date=value(card,'date');if(date)parts.push(trDate(date));
  parts.push(...fields(['customer','vehicle','personnel','category']));
  const quantity=value(card,kind==='fuel'||kind==='fuelout'||kind==='tank'?'liters':'quantity');
  if(quantity!==''&&Number.isFinite(Number(quantity)))parts.push(fmtNum(Number(quantity))+' '+(value(card,'unit')||(['fuel','fuelout','tank'].includes(kind)?'L':'')));
  if(['collection','expense'].includes(kind)){const amount=value(card,'amount');parts.push(amount!==''?fmtTL(Number(amount))+' ₺':'Tutar eksik');}
  if(kind==='work')parts.push(value(card,'price_pending')?'Fiyat bekliyor':value(card,'unit_price')!==''?'Birim fiyat '+fmtTL(Number(value(card,'unit_price')))+' ₺':r.fieldConfidence?.effective_unit_price?'Kayıtlı fiyat '+fmtTL(Number(r.fieldConfidence.effective_unit_price.value))+' ₺':'Fiyat kayıt sırasında kontrol edilir');
  if(!parts.length)parts.push(...fields(['name','title','description','ticket_no','doc_no']));
  const summary=qs('[data-record-summary]',card);if(summary)summary.innerHTML=`<b>${esc(parts.join(' · ')||r.description||row.label)}</b><span class="assistant-record-state">${row.saved?'Kaydedildi':row.missing.length?'Eksik: '+esc(row.missing.map(k=>DRAFT_FIELDS[k]).join(', ')):row.duplicate?'Olası mükerrer':row.issues?'Kontrol gerekiyor':'Ayrıntıları kontrol et'} <span aria-hidden="true">⌄</span></span>`;
  let approval=qs('[data-sensitive-approval]',card);
  if(sensitiveAssistantRow(row)){if(!approval){approval=document.createElement('div');approval.dataset.sensitiveApproval='';approval.className='assistant-sensitive-approval';card.insertBefore(approval,qs('[data-record-details]',card));}approval.hidden=row.saved;approval.textContent=row.selected?'Seçtiniz. Para hareketi henüz kaydedilmedi; Kaydet ile onaylanır.':'Bu para hareketi ayrıca onayınızı bekliyor. Üstteki kutuyu kendiniz işaretleyin; sonra Kaydet’e basın.';card.classList.add('assistant-sensitive-record');}
  let warning=qs('[data-review-warning]',card);
  if(!warning){warning=document.createElement('div');warning.className='small assistant-record-warning';warning.dataset.reviewWarning='';card.insertBefore(warning,qs('[data-record-details]',card));}
  warning.textContent=row.issueText;warning.hidden=!row.issueText;
  let reason=qs('[data-confidence-reason]',card);if(!reason){reason=document.createElement('div');reason.dataset.confidenceReason='';reason.className='small muted';card.insertBefore(reason,qs('[data-record-details]',card));}const why=inferenceReason(r);reason.textContent=why?'Çıkarım: '+why:'';reason.hidden=!why;
 };
 const coverage=document.createElement('p');coverage.dataset.dailyCoverage='';panel.append(coverage);
 const undo=createUndoWindow(),versions=new WeakMap();let undoTimer,highlightTimer;
 const undoBar=document.createElement('div');undoBar.dataset.draftUndo='';undoBar.hidden=true;undoBar.innerHTML='<span>Soru cevabı uygulandı · 5 sn</span><button type="button" class="btn sm" data-undo-answer>Geri al</button>';questionBox.after(undoBar);
 const markEdit=ev=>{const card=ev.target.closest?.('.card[data-kind]');if(card)versions.set(card,(versions.get(card)||0)+1);};out.addEventListener('input',markEdit,true);out.addEventListener('change',markEdit,true);
 const snapshotRow=(row,updates)=>{
  const values=Object.fromEntries(Object.keys(updates).map(f=>[f,qs('[name="'+f+'"]',row.card)?.value??'']));
  const keys=['date','customer_id','new_customer','new_customer_parent_id','vehicle_id','quantity','unit','dateUnsure','calendarConflict','dateConflict','customerGuess','vehicleGuess','guessed','sourceNeedsMaterial','sourceUncertain','fieldConfidence','issues','_bulkReviewed','_workflowCompleted'];
  const state=Object.fromEntries(keys.map(k=>[k,{present:Object.hasOwn(row.r,k),value:structuredClone(row.r[k])}]));
  return ()=>{v._workflow.apply({key:row.key,updates:values},'Son soru cevabı geri alındı');for(const[k,saved]of Object.entries(state)){if(saved.present)row.r[k]=saved.value;else delete row.r[k];}row.r.ok=false;const warning=qs('[data-row-issues]',row.card);if(warning)warning.textContent=row.r.issues?.length?'⚠ '+row.r.issues.join(' · '):'';repaintConfidenceBadges(row.card,row.r);v._workflow.refresh();};
 };
 qs('[data-undo-answer]',undoBar).onclick=()=>{const n=undo.undo();undoBar.hidden=true;clearTimeout(undoTimer);update();let ack=out.querySelector('[data-question-applied]');if(ack)ack.textContent=n?n+' kartın soru cevabı geri alındı; kayıt yazılmadı.':'Sonradan düzenlenen veya kaydedilen kartlar korundu; geri alınacak cevap kalmadı.';};
 const questionDrafts=new Map(),unitDrafts=new Map();
 let questionSignature=null,latestQuestions=[],latestRows=[];
 // Tek dinleyici: kutu yeniden çizilse de her zaman en güncel soru ve satırlar kullanılır.
 questionBox.addEventListener('input',ev=>{const input=ev.target.closest?.('[data-question-value]');if(input)questionDrafts.set(input.dataset.questionValue,input.value);const unit=ev.target.closest?.('[data-question-unit]');if(unit)unitDrafts.set(unit.dataset.questionUnit,unit.value);});
 questionBox.addEventListener('click',ev=>{
  if(ev.target.closest?.('[data-question-reply]')){qs('[data-msg]',ctx.root)?.focus();return;}
  const button=ev.target.closest?.('[data-answer]');if(!button)return;
  const questions=latestQuestions,rows=latestRows;
  const q=questions.find(q=>q.key===button.dataset.answer),oi=button.dataset.option;if(!q)return;const target=rows.find(r=>r.key===q.targets[0].key);
  const value=oi==='value'?(questionDrafts.get(q.key)??q.suggested??''):target?.options[q.field]?.[Number(oi)]?.value;
  if(value===''||value==null)return;
  const changed=[],undoEntries=[];
  for(const t of q.targets){const row=rows.find(r=>r.key===t.key);if(!row)continue;
   // A shared answer is offered only for the same explicitly unresolved subject.
   if(row.options[q.field]&&!row.options[q.field].some(o=>o.value===value))continue;
   const updates={[q.field]:value};
   if(q.fields?.includes('unit')){const unit=questionBox.querySelector('[data-question-unit="'+CSS.escape(q.key)+'"]')?.value;if(!unit)return;updates.unit=unit;}
   const restore=snapshotRow(row,updates);v._workflow?.apply({key:t.key,updates},q.label+': '+value);
   const version=versions.get(row.card)||0;undoEntries.push({valid:()=>row.card.isConnected&&row.card.dataset.saved!=='1'&&(versions.get(row.card)||0)===version,restore});
   changed.push(row);row.card.dataset.questionUpdated='1';
  }
  undo.set(undoEntries);clearTimeout(undoTimer);undoBar.hidden=!undoEntries.length;undoTimer=setTimeout(()=>{undoBar.hidden=true;undo.clear();},5000);clearTimeout(highlightTimer);highlightTimer=setTimeout(()=>{for(const card of cards)delete card.dataset.questionUpdated;},1500);
  questionDrafts.delete(q.key);unitDrafts.delete(q.key);questionSignature=null;update();
  let ack=out.querySelector('[data-question-applied]');if(!ack){ack=document.createElement('p');ack.dataset.questionApplied='';ack.className='notice info';ack.setAttribute('role','status');questionBox.after(ack);}
  ack.textContent=changed.length+' kartta yalnız '+(DRAFT_FIELDS[q.field]||q.field)+' alanı güncellendi: '+changed.map(r=>r.label+' '+(r.index+1)).join(', ')+'. Henüz kaydedilmedi.';
 });
 let updating=false;
 const update=()=>{if(updating||!panel.isConnected)return;updating=true;try{const rows=read(),totals=reviewTotals(rows);qs('[data-review-counts]',panel).textContent=`${totals.total} kayıt · ${totals.selected} seçili · ${totals.review} kontrol bekliyor${totals.duplicates?' · '+totals.duplicates+' olası mükerrer':''}`;
  const states=reviewStates(rows),stateLabels={all:'Tümü',saved:'Kaydedilen',ready:'Hazır',review:'Kontrol / onay'};
  const chips=qs('[data-review-states]',panel);for(const [key,label]of Object.entries(stateLabels)){let button=chips.querySelector('[data-review-filter="'+key+'"]');if(!button){button=document.createElement('button');button.type='button';button.dataset.reviewFilter=key;chips.append(button);}button.textContent=label+' '+states[key];button.setAttribute('aria-pressed',String(filter===key));}
  for(const row of rows)row.card.hidden=filter!=='all'&&reviewState(row)!==filter;
  const hiddenSelected=rows.filter(r=>r.selected&&!r.saved&&r.card.hidden).length,filterNote=qs('[data-review-filter-notice]',panel);filterNote.hidden=!hiddenSelected;filterNote.textContent=hiddenSelected?hiddenSelected+' seçili kart filtre dışında. Kaydet tüm seçili kartları kapsar; Tümü düğmesiyle yeniden görün.':'';
  qs('[data-review-expand]',panel).textContent=expanded?'Ayrıntıları kapat':'Tüm ayrıntıları aç';
  const questions=[...assistantQuestions(rows),...[...new Set(v.questions||[])].map((text,i)=>({key:'message:'+i,field:'message',label:text,targets:[]}))];questionBox.hidden=!questions.length;
  // Soru kutusu yalnız soru kümesi değişince yeniden çizilir: başka bir alandaki "change" olayı Uygula tıklamasının ortasında düğmeyi değiştirmesin.
  latestQuestions=questions;latestRows=rows;
  const signature=JSON.stringify([questions.length,questions.slice(0,3).map(q=>[q.key,q.label,q.targets.map(t=>t.key),(rows.find(r=>r.key===q.targets[0]?.key)?.options[q.field]||[]).map(o=>[o.value,o.label]),q.suggested??null,q.fields,q.optional,(rows.find(r=>r.key===q.targets[0]?.key)?.options.unit||[]).map(o=>[o.value,o.label])])]);
  if(signature!==questionSignature){questionSignature=signature;
  questionBox.innerHTML=questions.length?'<h3>Eksikleri birlikte tamamlayalım</h3><p class="small muted">Aynı kaynağa ait sorular birleştirilir. Cevap yalnız listelenen kartların ilgili alanını değiştirir.</p>'+questions.slice(0,3).map((q,i)=>{
   if(q.field==='message')return `<p>${esc(q.label)} <button type="button" class="btn sm" data-question-reply>Mesajla cevapla</button></p>`;
   const target=rows.find(r=>r.key===q.targets[0].key),opts=target?.options[q.field]||[],suggested=q.suggested;
   return `<div data-question="${esc(q.key)}"><p>${esc(q.label)} <b class="badge">${q.targets.length} kart</b> <span class="muted">(${q.targets.map(t=>(labels[t.kind]||t.kind)+' '+(t.index+1)).join(', ')})</span></p>${opts.map((o,j)=>`<button type="button" class="btn sm" data-answer="${esc(q.key)}" data-option="${j}">${esc(o.label)}</button>`).join('')}${!opts.length?`<input data-question-value="${esc(q.key)}" type="${q.field==='date'?'date':['quantity','liters','unit_price','amount'].includes(q.field)?'number':'text'}" value="${esc(questionDrafts.get(q.key)??suggested??'')}" aria-label="${esc(q.label)}">${q.fields?.includes('unit')?`<select data-question-unit="${esc(q.key)}" aria-label="Birim">${(target?.options.unit||[]).map(o=>`<option value="${esc(o.value)}" ${o.value===(unitDrafts.get(q.key)||target.fields.unit||target.r.unit)?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`:''}<button type="button" class="btn sm" data-answer="${esc(q.key)}" data-option="value">Uygula</button>`:''}</div>`;
  }).join('')+(questions.length>3?`<p class="small">${questions.length-3} soru daha var; bu cevaplardan sonra sırayla gösterilecek.</p>`:''):'';
  }


  for(const row of rows)renderRow(row);coverage.textContent=coverageText(d,rows);
  const save=qs('[data-save]',out);if(save&&!save.disabled)save.textContent=totals.selected?'Onayla ve '+totals.selected+' kaydı kaydet':'Kaydetmek için kayıt seç';
 }finally{updating=false;}};
 qs('[data-review-states]',panel).addEventListener('click',e=>{const button=e.target.closest('[data-review-filter]');if(!button)return;filter=button.dataset.reviewFilter;update();});
 qs('[data-review-expand]',panel).onclick=()=>{expanded=!expanded;for(const c of cards)qs('[data-record-details]',c)?.toggleAttribute('open',expanded);try{localStorage.setItem(DETAIL_PREFERENCE,expanded?'expanded':'compact');}catch{}update();};
 qs('[data-review-compose]',panel).onclick=()=>{const msg=qs('[data-msg]',ctx.root);msg.focus();};
 out.addEventListener('input',ev=>{if(!questionBox.contains(ev.target))update();});out.addEventListener('change',ev=>{if(!questionBox.contains(ev.target))update();});out.addEventListener('click',ev=>{if(!questionBox.contains(ev.target))queueMicrotask(update);});update();
 // Existing live validation can change warnings without dispatching an input event.
 const watched=cards.flatMap(c=>[...c.querySelectorAll('[data-row-issues],[data-fuelout-issues]')]);
 const obs=new MutationObserver(()=>{if(!out.isConnected)obs.disconnect();else update();});for(const el of watched)obs.observe(el,{childList:true,subtree:true,characterData:true});for(const card of cards)obs.observe(card,{attributes:true,attributeFilter:['data-saved']});
 const releasePicker=v._workflow?mountDraftPicker(out,v._workflow,update):()=>{};
 const detach=new MutationObserver(()=>{if(!panel.isConnected){obs.disconnect();detach.disconnect();releasePicker();clearTimeout(undoTimer);clearTimeout(highlightTimer);undo.clear();out.removeEventListener('input',markEdit,true);out.removeEventListener('change',markEdit,true);}});detach.observe(document.body,{childList:true,subtree:true});
 return {update,read};
}

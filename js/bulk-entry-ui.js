import {esc,qs,qsa,toast,fmtNum,todayStr,confirmDialog} from './ui.js';
import {assertHistoricalScope} from './historical-fuel.js';
import {uuid,nowISO,WORK_TYPES,WORK_UNITS,isActive} from './core.js';
import {customerLabel} from './driver-customer.js';
import {normalizeBulkRows,answerBulkQuestions,finalizeBulk,bulkSelectionToken} from './bulk-entry-core.js';
import {readBulkDraft,saveBulkDraft,closeBulkDraft,loadBulkData,commitBulk} from './bulk-entry-db.js';

const names={ready:'Hazır',waiting:'Bilgi bekliyor',recorded:'Önceden işlendi',duplicate:'Paket içi tekrar',excluded:'Dışlandı',conflict:'Kontrol gerekli'};
const option=(value,label)=>`<option value="${esc(value)}">${esc(label)}</option>`;
const refFields={customer_id:'customers',vehicle_id:'vehicles',site_id:'sites',personnel_id:'personnel',quarry_id:'quarries',dump_site_id:'dump_sites'};
export async function openBulkReview(ctx,out,initial){
 let draft=initial,data,plan,busy=false;
 const original=document.createElement('div');original.dataset.bulkOriginal='';
 while(out.firstChild)original.append(out.firstChild);original.hidden=true;out.append(original);
 const panel=document.createElement('section');panel.className='card';panel.dataset.bulkReview='';panel.style.overflowWrap='anywhere';out.append(panel);
 const persist=async next=>{draft=await saveBulkDraft(next);await refresh();};
 const guarded=fn=>async()=>{
  if(busy)return;busy=true;const controls=qsa('button,input,select',panel);controls.forEach(x=>x.disabled=true);
  try{await fn();}catch(e){toast(e.message||String(e),'err');if(e.code==='BULK_STALE'){const latest=await readBulkDraft();if(latest?.id===draft.id)draft=latest;}await refresh();}
  finally{busy=false;controls.forEach(x=>{if(x.isConnected)x.disabled=false;});}
 };
 async function refresh(receipt=''){
  data=await loadBulkData(draft);plan=finalizeBulk(draft,data);
  const selected=new Set(plan.writes.map(r=>r.key));
  const customers=[...(data.customers||[]),...plan.newCards.filter(x=>x.store==='customers')];
  const customerName=id=>{const card=customers.find(x=>x.id===id);return card?customerLabel(card,customers):'';};
  const totals=Object.entries(plan.totals).map(([key,n])=>{const [id,unit]=JSON.parse(key);return `${esc((data.customers||[]).find(x=>x.id===id)?.name||plan.newCards.find(x=>x.id===id)?.name||'Müşteri')} · ${esc(fmtNum(n))} ${esc(unit)}`;});
  panel.innerHTML=`<div class="row between"><b>Geçmiş işleri toplu kontrol</b><button class="btn small" data-bulk-close>Taslağı kapat</button></div><button class="btn small" data-bulk-refresh>Önizlemeyi yenile</button>
   <p class="small">Yalnız ödenmemiş ve hakedişe alınmamış işler. Seçilen hazır kayıtlar tek onayla yazılır; eksikler burada bekler.</p>
   ${receipt?`<p class="notice ok" role="status" data-bulk-receipt>${esc(receipt)}</p><button class="btn small" data-bulk-undo>Son toplu kaydı geri al</button>`:''}
   <p data-bulk-counts><b>${plan.counts.ready} hazır · ${plan.counts.waiting} bilgi bekliyor · ${plan.counts.recorded} önceden işlendi · ${plan.counts.duplicate} paket içi tekrar · ${plan.counts.excluded} dışlandı</b></p>
   <p class="small">Bu onayın iş toplamları:<br>${totals.join('<br>')||'Henüz hazır iş seçilmedi.'}</p><p class="notice info">${esc(plan.priceNote)}</p>
   ${draft.rows.some(r=>r.kind==='fuel')?`<label class="history-check small"><input type="checkbox" data-bulk-tank ${draft.tank_confirmed?'checked':''}> Bu paketteki yakıtlar başka bir gerçek depo çıkışı olarak daha önce kaydedilmedi; mükerrer çıkış olmadığını kontrol ettim.</label>`:''}
   ${draft.rows.some(r=>r.kind==='fuel')?`<details data-historical-options ${draft.historical_fuel?.enabled?'open':''}><summary>Depo geçmişi eksik: kontrollü mutabakat bekleme modu</summary><p class="notice warn">Yalnız aşağıda tek tek seçilen geçmiş yakıtlar ayrı bekleyen kayıt olur; gerçek stok, kasa veya kesinleşmiş maliyet oluşmaz. İşler aynı atomik onayla saklanır. Bugünkü işlemler bu moda alınamaz.</p><label>Başlangıç<input type="date" data-history-from value="${esc(draft.historical_fuel?.from||'')}" max="${todayStr()}"></label><label>Bitiş (bugünden önce)<input type="date" data-history-to value="${esc(draft.historical_fuel?.to||'')}" max="${todayStr()}"></label><button class="btn small" data-history-enable>Tarih aralığını seç ve incelemeyi aç</button>${draft.historical_fuel?.enabled?'<button class="btn small" data-history-disable>Bekleme modunu kapat</button>':''}</details>`:''}
   ${plan.atomicBlocked?'<p class="notice warn" data-history-blocked>Seçili satırlarda eksik veya stok engeli var. Hiçbiri yazılmayacak; tamamlayın ya da ilgili satırı açıkça dışlayın.</p>':''}
   ${plan.projection.pendingLiters?`<p class="notice warn" data-history-projection>Bekleyen geçmiş çıkışlar dahil kayıt projeksiyonu: ${fmtNum(plan.projection.remaining)} L.${plan.projection.firstDeficit?` İlk kayıt açığı: ${esc(plan.projection.firstDeficit.date)} · ${fmtNum(plan.projection.firstDeficit.balance)} L.`:''} Bu fiziksel eksi stok değildir; gerçek depo defteri değişmez.</p>`:''}
   ${plan.questions.length?'<h3>Ortak sorular</h3>':''}
   ${plan.questions.map((q,i)=>`<div class="card" style="padding:10px" data-bulk-question="${i}"><label><b>${esc(q.label)}</b>${q.scope&&q.store&&(q.scopeLabel||customerName(q.scope))?` · ${q.store==='customers'?'Ana firma':'Müşteri'}: ${esc(q.scopeLabel||customerName(q.scope))}`:''} · ${q.rows.length} satır</label>
    ${q.options.length||q.canNew?`<select data-value style="width:100%">${option('','— seçin —')}${q.options.map(o=>option(o.value,o.label)).join('')}${q.canNew?option('__create','Yeni kart oluştur: '+q.label):''}</select>`:`<input data-value type="${q.field==='date'?'date':['quantity','liters'].includes(q.field)?'number':'text'}" ${q.field==='date'?`max="${todayStr()}"`:''} step="any" style="width:100%">`}
    <button class="btn small" data-bulk-answer="${i}" style="margin-top:6px">${q.rows.length} satıra uygula</button>
    <button class="btn small" data-bulk-exclude-group="${i}" style="margin-top:6px">Bu satırları dışla</button></div>`).join('')}
   <h3>Kayıt dökümü</h3>${plan.rows.map((r,i)=>`<details class="card" style="padding:10px" ${['waiting','conflict'].includes(r.status)?'open':''} data-bulk-row="${i}"><summary><b>${esc(names[r.status])} · ${i+1}. ${r.kind==='work'?'İş':'Yakıt'}</b> · ${esc(r.fields.date||'Tarih eksik')} · ${esc(customerName(r.fields.customer_id)||r.labels.customer_id||r.labels.vehicle_id||'')}</summary>
    ${r.kind==='fuel'&&draft.historical_fuel?.enabled&&!['recorded','duplicate','excluded'].includes(r.status)?`<label class="history-check"><input type="checkbox" data-history-pending="${i}" ${draft.historical_fuel.keys?.includes(r.key)?'checked':''}> Bu yakıtı mutabakat bekleyen ayrı kayıt olarak sakla (stok / maliyet değil)</label>`:''}
    ${r.status==='ready'?`<label class="history-check"><input type="checkbox" data-bulk-select="${i}" ${selected.has(r.key)?'checked':''}> Bu onayda kaydet</label>`:''}
    <p class="small">${esc(r.quote||r.raw_message)}</p>${r.issues.length?`<p class="notice warn">${r.issues.map(esc).join('<br>')}</p>`:''}
    <details><summary>Kaynak mesaj</summary><p class="small" style="white-space:pre-wrap">${esc(r.raw_message)}</p></details>
    ${r.record_id?`<button class="btn small" data-go="${r.record_store==='pending_fuel_records'?'#/depo?pending=':r.record_store==='work_records'?'#/isler/':'#/yakit/'}${esc(r.record_id)}">Kaydedilen kaydı aç</button>`:''}
    ${['ready','waiting'].includes(r.status)&&!r.blocked?`<details><summary>Satırı düzelt</summary><div data-bulk-editor="${i}">
     <label>Tarih<input name="date" type="date" value="${esc(r.fields.date||'')}" max="${todayStr()}"></label>
     ${Object.entries(refFields).filter(([f])=>r.kind==='work'||['vehicle_id','personnel_id'].includes(f)).map(([f,store])=>`<label>${esc({customer_id:'Müşteri',vehicle_id:'Araç',site_id:'Şantiye',personnel_id:'Personel',quarry_id:'Ocak',dump_site_id:'Döküm yeri'}[f])}<select name="${f}" style="width:100%">${option('','— seçin —')}${[...(data[store]||[]).filter(isActive),...plan.newCards.filter(c=>c.store===store)].map(x=>`<option value="${esc(x.id)}" ${r.fields[f]===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`).join('')}
     ${r.kind==='work'?`<label>Miktar<input name="quantity" type="number" step="any" value="${r.fields.quantity||''}"></label><label>Birim<select name="unit">${WORK_UNITS.map(x=>`<option ${r.fields.unit===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>İş türü<select name="work_type">${WORK_TYPES.map(x=>`<option ${r.fields.work_type===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label>`:`<label>Litre<input name="liters" type="number" step="any" value="${r.fields.liters||''}"></label>`}
     <button class="btn small" data-bulk-edit="${i}">Düzeltmeyi uygula</button></div></details>`:''}
    ${!['recorded','duplicate'].includes(r.status)?`<button class="btn small" data-bulk-exclude="${i}">${r.status==='excluded'?'Tekrar incelemeye al':'Bu satırı dışla'}</button>`:''}</details>`).join('')}
   <button class="btn primary block" data-bulk-save ${!selected.size||draft.status!=='open'?'disabled':''}>Onayla ve ${selected.size} kaydı yaz</button>
   <p class="tiny muted">Yalnız hazır ve seçili satırlar kaydedilir. Bekleyenler kaybolmaz. Fiyat ve bugünkü mazot kuralı geçmişe uygulanmaz.</p>`;
  qs('[data-bulk-close]',panel).onclick=guarded(async()=>{draft=await closeBulkDraft(draft);panel.innerHTML='<p>Toplu taslak kapandı. Kayıtlar korunuyor.</p>';});
  qs('[data-bulk-refresh]',panel).onclick=guarded(async()=>{const latest=await readBulkDraft();if(latest?.id===draft.id)draft=latest;await refresh();});
  qs('[data-bulk-tank]',panel)?.addEventListener('change',guarded(async()=>persist({...draft,tank_confirmed:qs('[data-bulk-tank]',panel).checked})));
  for(const el of qsa('[data-bulk-answer]',panel))el.onclick=guarded(async()=>{
   const q=plan.questions[Number(el.dataset.bulkAnswer)],value=qs('[data-value]',el.closest('[data-bulk-question]')).value;
   if(!value)return toast('Önce bir cevap seçin veya girin.','err');
   await persist(answerBulkQuestions(draft,q.id,value==='__create'?{create:true}:{value}));
  });
  for(const el of qsa('[data-bulk-exclude-group]',panel))el.onclick=guarded(async()=>persist({...draft,excluded:[...new Set([...(draft.excluded||[]),...plan.questions[Number(el.dataset.bulkExcludeGroup)].rows])]}));
  for(const el of qsa('[data-bulk-exclude]',panel))el.onclick=guarded(async()=>{const key=plan.rows[Number(el.dataset.bulkExclude)].key;await persist({...draft,excluded:draft.excluded?.includes(key)?draft.excluded.filter(x=>x!==key):[...(draft.excluded||[]),key]});});
  for(const el of qsa('[data-bulk-select]',panel))el.onchange=guarded(async()=>{const key=plan.rows[Number(el.dataset.bulkSelect)].key;await persist({...draft,deselected:el.checked?(draft.deselected||[]).filter(x=>x!==key):[...new Set([...(draft.deselected||[]),key])]});});
  for(const el of qsa('[data-bulk-edit]',panel))el.onclick=guarded(async()=>{
   const index=Number(el.dataset.bulkEdit),row=plan.rows[index],rows=structuredClone(draft.rows),r=rows.find(x=>x.key===row.key);
   const editor=qs(`[data-bulk-editor="${index}"]`,panel);
   // Explicit per-row edits do not change its source identity or another row's grouped answer.
   for(const input of qsa('[name]',editor)){
    const field=input.name,value=input.value;if(String(row.fields[field]||'')===value)continue;
    r.fields[field]=['quantity','liters'].includes(field)?Number(value):value;
    if(refFields[field]){r.labels[field]=(data[refFields[field]]||[]).find(x=>x.id===value)?.name||plan.newCards.find(x=>x.id===value)?.name||'';if(field==='customer_id')r.parent_id=(data.customers||[]).find(x=>x.id===value)?.parent_customer_id||null;}
    r.review=(r.review||[]).filter(x=>x!==field);
   }
   await persist({...draft,rows});
  });
  qs('[data-history-enable]',panel)?.addEventListener('click',guarded(async()=>{
   const scope={enabled:true,from:qs('[data-history-from]',panel).value,to:qs('[data-history-to]',panel).value,keys:[],approved_at:nowISO()};assertHistoricalScope(scope,scope.from);await persist({...draft,historical_fuel:scope});
  }));
  qs('[data-history-disable]',panel)?.addEventListener('click',guarded(async()=>persist({...draft,historical_fuel:null})));
  for(const el of qsa('[data-history-pending]',panel))el.onchange=guarded(async()=>{const key=plan.rows[Number(el.dataset.historyPending)].key,scope=draft.historical_fuel;await persist({...draft,historical_fuel:{...scope,keys:el.checked?[...new Set([...(scope.keys||[]),key])]:(scope.keys||[]).filter(k=>k!==key)}});});
  qs('[data-bulk-save]',panel).onclick=guarded(async()=>{
   const saveHash=location.hash;
   if(draft.historical_fuel?.enabled){const pending=plan.writes.filter(r=>r.pending_fuel);if(!await confirmDialog('Geçmiş kayıtları birlikte sakla',`${plan.writes.filter(r=>r.kind==='work').length} iş, ${pending.length} mutabakat bekleyen yakıt ve ${plan.writes.filter(r=>r.kind==='fuel'&&!r.pending_fuel).length} gerçek depo çıkışı. Bekleyen yakıt stok / maliyete girmez; kâr ve raporlar eksik olarak işaretlenir. Seçili hazır kayıtlar tek işlemde yazılacak.`, 'Onayla ve birlikte kaydet'))return;}
   if(!panel.isConnected||!out.isConnected||location.hash!==saveHash)return;
   const result=await commitBulk(draft,bulkSelectionToken(plan));draft=result.draft;
   const receipt=`${result.saved.length} kayıt kaydedildi. ${result.pending} satır taslakta bekliyor.`;
   await refresh(receipt);
   await ctx.assistantConversation?.receipt({epoch:draft.chat_id,id:draft.turn_id},{status:result.pending?'partial':'saved',reply:receipt}).catch(()=>{});
   ctx.assistantTaskChanged?.(await ctx.db.metaGet('assistant_task_v1'));
  });
  qs('[data-bulk-undo]',panel)?.addEventListener('click',guarded(async()=>{await (await import('./undo.js')).applyUndo(ctx.db);panel.innerHTML='<p>Son toplu kayıt geri alındı. Aynı kaynak otomatik yeniden yazılmaz.</p>';toast('Toplu kayıt geri alındı','ok');}));
 }
 await refresh();return {refresh};
}
export function bindBulkEntry(ctx,out,v,data,{message,files}){
 if(files.length||[...(v.works||[]),...(v.fuel||[])].length<1||!v._chatTurn)return;
 const btn=document.createElement('button');btn.className='btn block';btn.dataset.bulkStart='';btn.textContent='Geçmiş işleri / yakıt mutabakatını kontrollü kaydet';
 (v._workflow?.panel||out).prepend(btn);
 btn.onclick=async()=>{
  if(btn.disabled)return;btn.disabled=true;
  try{
   const existing=await readBulkDraft();
   if(existing){await openBulkReview(ctx,out,existing);return;}
   if(['collections','expenses','maintenance','fuelOut','tickets','docs','tankIn','actions','settings','prices','cards','edits'].some(k=>v[k]?.length))throw Error('İş/yakıt dışındaki kartları kendi akışında kontrol edin. Bu karma paket toplu geçmiş moduna alınmadı; mevcut kartlar korunuyor.');
   const fresh=await ctx.db.dumpAll(),copy={...v,works:(v.works||[]).map(r=>({...r})),fuel:(v.fuel||[]).map(r=>({...r}))},raw=structuredClone(v._bulkRaw||{});
   for(const [kind,group]of [['work','works'],['fuel','fuel']])for(const [i,r]of copy[group].entries()){
    const card=qs(`[data-kind="${kind}"][data-i="${i}"]`,out);if(!card)continue;
    for(const input of qsa('[name]',card)){
     const field={customer:'customer_id',vehicle:'vehicle_id',site:'site_id',personnel:'personnel_id',quarry:'quarry_id',dump_site:'dump_site_id',source:'source'}[input.name]||input.name;
     if(!['date','quantity','liters','unit','work_type','material','description','customer_id','vehicle_id','site_id','personnel_id','quarry_id','dump_site_id','source','total','unit_price'].includes(field))continue;
     const newField={customer_id:'new_customer',site_id:'new_site',quarry_id:'new_quarry',dump_site_id:'new_dump_site'}[field];
     const old=r[field]||(newField&&r[newField]?'new:'+r[newField]:'');
     if(String(old)===input.value)continue;
     if(!raw[group])raw[group]=[];if(!raw[group][i])raw[group][i]={};
     if(input.value.startsWith('new:')&&newField){r[newField]=raw[group][i][newField]=input.value.slice(4);r[field]=null;}
     else{r[field]=['quantity','liters','total','unit_price'].includes(field)?(input.value===''?null:Number(input.value)):input.value;raw[group][i][field]=r[field];if(newField){r[newField]=null;raw[group][i][newField]=null;}}
     (r._bulkReviewed||=[]).push(field);if(field==='date')r.dateUnsure=false;
    }
   }
   const rows=normalizeBulkRows(copy,message,fresh,raw);
   if(rows.every(r=>r.blocked))throw Error('Bu kayıtlar kendi doğrulanmış akışından incelenmeli.');
   const draft=await saveBulkDraft({version:1,id:uuid(),rev:0,chat_id:v._chatTurn.epoch,turn_id:v._chatTurn.id,task_id:v._agentTask?.id||null,status:'open',rows,answers:{},excluded:[],deselected:[],tank_confirmed:false},{create:true});
   await openBulkReview(ctx,out,draft);
  }catch(e){toast(e.message||String(e),'err');}finally{if(btn.isConnected)btn.disabled=false;}
 };
}
export async function mountBulkResume(ctx){
 const draft=await readBulkDraft();if(!draft)return;
 const box=document.createElement('div');box.className='card';box.innerHTML='<b>Bekleyen toplu geçmiş giriş</b><p class="small">Kaydedilmiş satırlar yeniden yazılmaz; eksiklere kaldığınız yerden devam edin.</p><button class="btn block" data-bulk-resume>Toplu taslağa devam et</button>';
 qs('[data-agent-task]',ctx.root).after(box);
 qs('[data-bulk-resume]',box).onclick=async()=>{try{const current=await readBulkDraft();if(!current)throw Error('Taslak kapanmış veya sohbet değişmiş.');await openBulkReview(ctx,qs('[data-out]',ctx.root),current);box.remove();}catch(e){toast(e.message,'err');}};
}

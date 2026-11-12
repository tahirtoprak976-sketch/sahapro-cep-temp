import {HUB_GROUPS,HUB_TASKS,HUB_RECORDS,hubTasks,hubRecordRows,hubAnswer} from './assistant-hub-core.js';
import {qs,esc,fmtNum,fmtTL} from './ui.js';
import {isActive,todayStr} from './core.js';
const modes={entity:'Burada oluştur',draft:'Burada hazırla',query:'Burada hesapla',search:'Burada bul',screen:'Ayrıntılı ekran',tasks:'İsteğe dön'};
export function assistantHubHTML(){
 return `<section class="assistant-hub" data-assistant-hub aria-label="Asistan iş merkezi"><header class="assistant-hub-hero"><button type="button" class="assistant-hub-toggle" data-hub-toggle aria-expanded="true" aria-controls="assistant-hub-content">İşlemleri daralt</button><span class="assistant-section-label">İŞ MERKEZİNİZ</span><h2>İşinizi buradan yönetin.</h2><p>İş seçin; kayıtları bulup kontrol kartlarını birlikte tamamlayalım.</p><div class="assistant-hub-status"><span>Yerel işlemler anahtarsız</span><span>Kayıtlar açık onayınızla</span></div></header><div class="assistant-hub-body" id="assistant-hub-content"><nav class="assistant-hub-nav" aria-label="İş alanları">${HUB_GROUPS.map(([id,label])=>`<button type="button" data-hub-group="${id}" aria-pressed="${id==='all'}" disabled>${label}</button>`).join('')}</nav><div class="assistant-hub-catalog"><label for="as-hub-search">Asistana ne yaptırmak istiyorsunuz?</label><div class="assistant-hub-search"><input id="as-hub-search" type="search" data-hub-search placeholder="İş, tahsilat, müşteri, belge, rapor…" autocomplete="off" disabled><button class="btn sm ghost" type="button" data-hub-clear disabled>Temizle</button></div><p class="tiny muted" data-hub-count></p><div class="assistant-hub-tasks" data-hub-tasks></div><button class="btn block ghost" type="button" data-hub-more hidden>Tüm işlemleri göster</button></div></div><section class="assistant-hub-panel" data-hub-panel aria-label="Asistan çalışma paneli" hidden><header><h3 data-hub-title></h3><button type="button" class="btn sm ghost" data-hub-close>Kapat</button></header><div data-hub-output aria-live="polite"></div></section></section>`;
}
const safeHash=v=>typeof v==='string'&&v.startsWith('#/')&&!/[<>\r\n]/u.test(v)?v:null;
const fields=[['date','Tarih'],['plate','Plaka'],['type','Tür'],['phone','Telefon'],['address','Adres'],['work_type','İş türü'],['description','Açıklama'],['note','Not'],['cash_type','Para rolü']];
export function updateHubConversation(root,hasTurns){
 const hub=qs('[data-assistant-hub]',root);if(!hub)return;
 const open=hub.dataset.surface?hub.dataset.surface==='open':!hasTurns;
 hub.classList.toggle('hub-collapsed',!open);const button=qs('[data-hub-toggle]',hub);button.setAttribute('aria-expanded',String(open));button.textContent=open?'İşlemleri daralt':'İşlemleri göster';
}
export function mountAssistantHub(ctx,controls){
 const {root,db}=ctx,hub=qs('[data-assistant-hub]',root);if(!hub)return;
 const panel=qs('[data-hub-panel]',hub),output=qs('[data-hub-output]',hub),title=qs('[data-hub-title]',hub),search=qs('[data-hub-search]',hub),list=qs('[data-hub-tasks]',hub);let group='all',expanded=false,token=0,records=[],current=null,busy=false;
 const alive=id=>root.isConnected&&id===token;
 const draw=()=>{
  const rows=hubTasks(search.value,group),shown=!expanded&&group==='all'&&!search.value.trim()?rows.filter(r=>['priorities','today','work','payments','search','tasks'].includes(r.id)):rows;
  list.innerHTML=shown.map(t=>`<button type="button" data-hub-task="${t.id}"><small>${modes[t.mode]}</small><b>${esc(t.title)}</b><span>${esc(t.detail)}</span></button>`).join('')||'<p class="muted">Eşleşen işlem yok. Mesaj kutusunda yapmak istediğiniz işi anlatabilirsiniz.</p>';
  qs('[data-hub-count]',hub).textContent=shown.length+' / '+rows.length+' işlem';qs('[data-hub-more]',hub).hidden=shown.length===rows.length;
  for(const b of hub.querySelectorAll('[data-hub-group]'))b.setAttribute('aria-pressed',String(b.dataset.hubGroup===group));
 };
 const open=(label,kind)=>{token++;current={kind};panel.hidden=false;title.textContent=label;output.innerHTML='<p class="muted">Kayıtlar okunuyor…</p>';panel.scrollIntoView({block:'start'});return token;};
 const details=async row=>{
  const id=open(row.title,'record'),snapshot=await db.readSnapshot({attachments:false}),r=(snapshot.data[row.store]||[]).find(x=>x.id===row.id&&isActive(x));if(!alive(id))return;
  if(!r){output.innerHTML='<p class="notice warn">Kayıt artık kullanılamıyor. Aramayı yenileyin.</p>';return;}
  const currentRow=hubRecordRows(snapshot.data,'',row.store).find(x=>x.id===r.id);
  current={kind:'record',row:currentRow};
  let body=fields.filter(([key])=>r[key]!==undefined&&r[key]!==null&&String(r[key]).trim()).map(([key,label])=>`<div class="assistant-hub-fact"><b>${label}</b><span data-record-source>${esc(r[key])}</span></div>`).join('');
  if(r.quantity!=null)body+=`<div class="assistant-hub-fact"><b>Miktar</b><span>${typeof r.quantity==='number'&&Number.isFinite(r.quantity)?esc(fmtNum(r.quantity)):'Doğrulayın'} ${esc(r.unit||'')}</span></div>`;
  if(r.amount!=null)body+=`<div class="assistant-hub-fact"><b>Kaydedilen tutar</b><span>${typeof r.amount==='number'&&Number.isFinite(r.amount)?fmtTL(r.amount)+' ₺':'Doğrulayın'}</span></div>`;
  output.innerHTML=`<span class="badge">${row.kind} · kayıtlı bilgi</span><p class="small" data-record-source>${esc(currentRow.context)}</p>${body}<div class="assistant-hub-result-actions">${currentRow.customer_id?'<button type="button" class="btn primary" data-hub-customer-work>Bu müşteriyle iş hazırla</button>':''}<button type="button" class="btn" data-hub-native-open>Ayrıntılı kaydı aç</button></div><p class="tiny muted">Bu inceleme kayıt değiştirmez. İş hazırlamak yeni bir taslaktır; Kaydet ile onaylanır.</p>`;
 };
 const recordSearch=async()=>{
  const store=qs('[data-hub-store]',output)?.value||'all',q=qs('[data-hub-record-query]',output)?.value||'',id=++token,box=qs('[data-hub-record-list]',output);if(!box)return;
  box.innerHTML='<p class="muted">Aranıyor…</p>';box.setAttribute('aria-busy','true');
  try{
   const snapshot=await db.readSnapshot({attachments:false,meta:false});if(!alive(id)||!box.isConnected)return;
   records=hubRecordRows(snapshot.data,q,store);const visible=records.slice(0,60);
   box.innerHTML=`<p class="small muted">${records.length} kayıt${records.length>60?' · ilk 60; aramayı daraltın':''}</p>`+visible.map((r,i)=>`<button type="button" class="assistant-hub-record" data-hub-record="${i}"><small>${r.kind}</small><b>${esc(r.title)}</b><span>${esc(r.context)}</span></button>`).join('')+(records.length?'':'<p class="muted">Kayıt bulunamadı. Farklı bir ad, tarih veya plaka deneyin.</p>');
  }catch(e){if(alive(id)&&box.isConnected)box.innerHTML=`<p class="notice warn">${esc(e.message)}</p>`;}finally{if(box.isConnected)box.removeAttribute('aria-busy');}
 };
 const searchRecords=async store=>{
  open('Kayıtlarınızda ara','search');output.innerHTML=`<div class="assistant-hub-search-fields"><div class="field"><label for="as-hub-record-query">Ad, tarih, plaka veya açıklama</label><input id="as-hub-record-query" type="search" data-hub-record-query autocomplete="off" placeholder="Kayıtlarda ara"></div><div class="field"><label for="as-hub-store">Kayıt türü</label><select id="as-hub-store" data-hub-store data-wfilter><option value="all">Tüm kayıtlar</option>${Object.entries(HUB_RECORDS).map(([key,[label]])=>`<option value="${key}" ${key===store?'selected':''}>${label}</option>`).join('')}</select></div></div><div data-hub-record-list></div>`;
  qs('[data-hub-record-query]',output).addEventListener('input',recordSearch);qs('[data-hub-store]',output).addEventListener('change',recordSearch);await recordSearch();
 };
 const query=async task=>{
  const id=open(task.title,'query'),snapshot=await db.readSnapshot({attachments:false});if(!alive(id))return;
  const result=hubAnswer(task.id,snapshot.data,snapshot.meta,todayStr());current={kind:'query',task,items:result.items||[]};
  output.innerHTML=`<div class="assistant-hub-evidence"><span class="badge">Bu cihazın kayıtlarından</span><span class="tiny muted">${esc(snapshot.captured_at.slice(0,19).replace('T',' '))}</span></div><div class="assistant-hub-answer" data-record-source>${esc(result.text)}</div><div class="assistant-hub-result-actions"><button class="btn" type="button" data-hub-refresh>Güncel kayıtlarla yenile</button>${(result.items||[]).map((r,i)=>`<button class="btn" type="button" data-hub-source="${i}">${esc(r.label)}</button>`).join('')}</div><p class="tiny muted">Bu sonuç kayıtlı bilgilerin özetidir. Ödeme veya kesinleştirme yapmaz; açık kartlarınız korunur.</p>`;
 };
 hub.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button||!hub.contains(button))return;
  if(button.hasAttribute('data-hub-toggle')){hub.dataset.surface=hub.classList.contains('hub-collapsed')?'open':'closed';updateHubConversation(root,!!qs('[data-chat-turn]',root));return;}
  if(button.hasAttribute('data-hub-close')){token++;panel.hidden=true;current=null;return;}
  if(button.hasAttribute('data-hub-group')){group=button.dataset.hubGroup;draw();return;}
  if(button.hasAttribute('data-hub-clear')){search.value='';draw();search.focus();return;}
  if(button.hasAttribute('data-hub-more')){expanded=true;draw();return;}
  if(busy)return;
  const task=HUB_TASKS.find(t=>t.id===button.dataset.hubTask);busy=true;hub.setAttribute('aria-busy','true');
  try{
   if(task){
    if(task.mode==='query')await query(task);
    if(task.mode==='search')await searchRecords(task.target);
    if(task.mode==='entity')await controls.entity(task.target);
    if(task.mode==='draft')await controls.draft(task.target);
    if(task.mode==='screen')await controls.screen(task.target);
    if(task.mode==='tasks'){const history=qs('[data-history-panel]',root);history.open=true;history.scrollIntoView({block:'start'});}
   }else if(button.hasAttribute('data-hub-record')){
    const row=records[Number(button.dataset.hubRecord)];if(row)await details(row);
   }else if(button.hasAttribute('data-hub-refresh')&&current?.kind==='query')await query(current.task);
   else if(button.hasAttribute('data-hub-customer-work')&&current?.row)await controls.draft('Yeni iş kaydı oluştur',{customer_id:current.row.customer_id,site_id:current.row.site_id});
   else if(button.hasAttribute('data-hub-native-open')&&current?.row)await controls.screen(current.row.hash);
   else if(button.hasAttribute('data-hub-source')&&current?.items){
    const hash=safeHash(current.items[Number(button.dataset.hubSource)]?.hash);if(hash){
     const parts=hash.slice(2).split('?')[0].split('/'),store=Object.keys(HUB_RECORDS).find(key=>HUB_RECORDS[key][1]===parts[0]);
     if(store&&parts[1]&&!['new','edit'].includes(parts[1])){const snapshot=await db.readSnapshot({attachments:false,meta:false}),row=hubRecordRows(snapshot.data,'',store).find(r=>r.id===decodeURIComponent(parts[1]));if(row)await details(row);else await controls.screen(hash);}
     else await controls.screen(hash);
    }
   }
  }catch(error){if(root.isConnected){panel.hidden=false;output.innerHTML=`<p class="notice warn">${esc(error.message||error)} Mevcut kontrol kartları korunuyor.</p>`;}}
  finally{busy=false;hub.removeAttribute('aria-busy');}
 });
 search.addEventListener('input',draw);for(const el of hub.querySelectorAll('[disabled]'))el.disabled=false;updateHubConversation(root,!!qs('[data-chat-turn]',root));draw();
 return ()=>{token++;};
}

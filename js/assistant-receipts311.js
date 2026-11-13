// Phone-only preview and explicit save scope. No VAT policy, schema or record migration.
import {isActive,priceVehicleContext,toKurus,fromKurus,kdvRateOf} from './core.js';
import {customerBalances} from './collect-core.js';
import {pendingPrincipal} from './hakedis-vat.js';
import {sensitiveAssistantRow} from './assistant-review-core.js';
import {priceDecision} from './price-decision.js';
import {priceSnapshot} from './business.js';
import {jobPreview,applyJob} from './job-core.js';
const positive=v=>v!==''&&v!=null&&Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
export function normalGroupEligible(row){
 const required={work:['date','customer_id','vehicle_id','work_type','quantity','unit'],expense:['date','amount'],fuel:['date','vehicle_id','liters','source']};
 const unresolved=(required[row.kind]||[]).some(k=>row.r?.fieldConfidence?.[k]?.level==='BILINMIYOR');
 return ['work','expense','fuel'].includes(row.kind)&&!row.saved&&!row.disabled&&!row.missing?.length&&!row.issues&&!row.duplicate&&!unresolved&&!sensitiveAssistantRow(row)
  &&row.r?.source!=='Müşteri Verdi'&&row.fields?.source!=='Müşteri Verdi'&&!['customer','vehicle','site','quarry','dump_site'].some(k=>String(row.fields?.[k]||'').startsWith('new:'))
  &&!row.r?.driver_entry_id&&!row.r?.unverified&&!['dateUnsure','dateConflict','calendarConflict','ambiguous','parentMismatch','customerGuess','vehicleGuess','priceUncertain','guessed'].some(k=>row.r?.[k]);
}

export function draftCariEffect(row,d){
 const f=row.fields||{},customer=f.customer||f.fuel_customer||row.r?.customer_id,known=(d.customers||[]).some(c=>isActive(c)&&c.id===customer);if(!known||(d.customers||[]).find(c=>c.id===customer)?.internal)return null;
 const before=customerBalances(d).bal[customer]??0;let delta=null;
 if(row.kind==='collection'){const amount=positive(f.amount);if(amount!=null)delta=-amount;}
 else if(row.kind==='fuelout'){const liters=positive(f.liters),price=positive(f.unit_price);if(liters!=null&&price!=null)delta=fromKurus(toKurus(liters*price));}
 else if(row.kind==='work'&&!f.price_pending){
  const quantity=positive(f.quantity),manual=positive(f.unit_price),vehicle=(d.vehicles||[]).find(v=>isActive(v)&&v.id===f.vehicle),work={date:f.date,customer_id:customer,site_id:f.site||null,vehicle_id:vehicle?.id,work_type:f.work_type,quantity,unit:f.unit,material:f.material||null};
  if(quantity!=null&&vehicle&&f.date&&f.unit){
   if(manual!=null)delta=fromKurus(toKurus(manual*quantity));
   else if(row.r?.fuelAllowance?.only_pay)delta=0;
   else{
    const job=jobPreview(d,work,{extra:!!f.job_extra});
    if(job&&job.kind!=='ambiguous'&&(job.kind!=='extra'||job.rate)){const priced={...work,...applyJob(d,work,{extra:!!f.job_extra})},snapshot=priced.price_snapshot;if(snapshot&&snapshot.amount!=null)delta=pendingPrincipal(priced,Number(snapshot.amount));}
    else if(!job){const decision=priceDecision((d.price_book||[]).filter(isActive),priceVehicleContext(work,vehicle),{dateSure:!row.r?.dateUnsure});if(decision.rule&&!decision.ambiguous&&!decision.rule.formula&&typeof decision.rule.kdv_included==='boolean'&&(!decision.rule.kdv_included||kdvRateOf(decision.rule.kdv_rate)!=null)){const snapshot=priceSnapshot(priceVehicleContext(work,vehicle),[decision.rule],null);if(snapshot&&snapshot.amount!=null)delta=pendingPrincipal({price_snapshot:snapshot},Number(snapshot.amount));}}
   }
  }
 }
 const needed={work:['date','customer_id','vehicle_id','quantity','unit'],collection:['date','customer_id'],fuelout:['date','customer_id','liters']}[row.kind]||[];if(needed.some(k=>row.r?.fieldConfidence?.[k]?.level==='BILINMIYOR'))delta=null;
 const moneyField=row.kind==='collection'?'amount':['work','fuelout'].includes(row.kind)?'unit_price':null;const info=row.r?.fieldConfidence?.[moneyField];if(info?.level==='BILINMIYOR'&&positive(f[moneyField])!=null)delta=null;
 if(delta!=null&&!Number.isFinite(delta))delta=null;
 return {customer,before,delta,after:delta==null?null:fromKurus(toKurus(before)+toKurus(delta))};
}
export function bindReceiptDesk(ctx,out,v,d,{read,saveScoped,refresh}){
 const panel=out.querySelector('[data-review-overview]');if(!panel)return ()=>{};
 const groups=document.createElement('div');groups.dataset.customerSaveGroups='';panel.append(groups);let snapshot=d,token=0,closed=false,signature=null;
 const effect=row=>{let box=row.card.querySelector('[data-cari-preview]');if(row.saved){if(box)box.textContent='Kaydedildi; bu kartın cari etkisi artık mevcut kayıtların içinde. Yeniden eklenmez.';return;}const p=draftCariEffect(row,snapshot);if(!p){box?.remove();return;}if(!box){box=document.createElement('p');box.className='small assistant-cari-preview';box.dataset.cariPreview='';row.card.append(box);}box.textContent=p.delta==null?'Cari önizleme: muhatap, miktar ve tutar / kayıtlı fiyat doğrulanınca hesaplanır.':'Mevcut cari '+p.before.toLocaleString('tr-TR',{maximumFractionDigits:2})+' ₺ → Taslağın etkisi sonrası '+p.after.toLocaleString('tr-TR',{maximumFractionDigits:2})+' ₺ ('+(p.delta>=0?'+':'')+p.delta.toLocaleString('tr-TR',{maximumFractionDigits:2})+' ₺). Yeni KDV eklenmez; mevcut kesinleşmiş KDV korunur.';};
 const draw=()=>{if(closed||!out.isConnected)return;const rows=read();for(const row of rows){effect(row);if(sensitiveAssistantRow(row)&&!row.saved&&!row.card.querySelector('[data-single-sensitive-save]')){const b=document.createElement('button');b.type='button';b.className='btn block';b.dataset.singleSensitiveSave='';b.textContent='Bu kartı tek başına kaydet';b.onclick=()=>{if(!row.card.querySelector('[data-pick]')?.checked)return ctx.receiptNotice?.('Önce bu kartın onay kutusunu kendiniz işaretleyin.');saveScoped([row.card]);};row.card.append(b);}}
  const byCustomer=new Map();for(const row of rows.filter(normalGroupEligible)){const id=row.fields.customer||'';if(!byCustomer.has(id))byCustomer.set(id,[]);byCustomer.get(id).push(row);}
  const nextSignature=JSON.stringify([...byCustomer].map(([id,items])=>[id,items.map(r=>r.key)]));if(signature===nextSignature)return;signature=nextSignature;
  groups.replaceChildren();for(const[id,items]of byCustomer){const b=document.createElement('button');b.type='button';b.className='btn block';b.dataset.saveCustomerReady=id;b.textContent=((snapshot.customers||[]).find(c=>c.id===id)?.name||'Standart gider / yakıt')+' · '+items.length+' hazır kartı kaydet';b.onclick=()=>{const current=read().filter(r=>normalGroupEligible(r)&&(r.fields.customer||'')===id);if(current.length)saveScoped(current.map(r=>r.card));};groups.append(b);}const note=document.createElement('p');note.className='tiny muted';note.textContent='Grup kaydı beş hassas kartı ve müşteri mazotunu kapsamaz. Cari önizleme yalnız bu kartın etkisidir; diğer taslaklar dahil değildir.';groups.append(note);};
 const load=async()=>{const id=++token;try{const fresh=await ctx.db.dumpAll();if(id===token&&!closed&&out.isConnected){snapshot=fresh;draw();}}catch{if(!closed){groups.textContent='Güncel kayıtlar okunamadı; grup kaydı için yeniden açın.';}}};
 let scheduled=false;const onEdit=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;draw();});};out.addEventListener('input',onEdit);out.addEventListener('change',onEdit);draw();load();
 Object.defineProperty(v,'_receiptDesk',{enumerable:false,configurable:true,value:{refresh:load}});
 return ()=>{closed=true;token++;out.removeEventListener('input',onEdit);out.removeEventListener('change',onEdit);};
}

export function mountSerialReceiptQueue(ctx,{getFiles,accept,isBusy}){
 const {root}=ctx,dialog=document.createElement('dialog');dialog.className='assistant-inline-picker assistant-receipt-queue';dialog.dataset.receiptQueue='';dialog.innerHTML='<header><h3>Seri fiş / irsaliye</h3><button type="button" class="btn" data-queue-close>Kapat</button></header><p>Fişleri arka arkaya ekleyin. Bu adım okuma veya kayıt yapmaz.</p><div role="status" data-receipt-queue-status></div><input type="file" accept="image/jpeg,image/png,image/webp" data-receipt-capture hidden><div class="row"><button type="button" class="btn" data-next-receipt>📷 Sonraki fişi çek</button><button type="button" class="btn" data-gallery-receipts>Galeriden seç</button></div><button type="button" class="btn block" data-receipts-read>Mesaja dön ve kontrol et</button><button type="button" class="btn block" data-receipts-task>Bağlantı gelince okumak için görevde sakla</button>';root.querySelector('[data-assistant-page]').append(dialog);
 const picker=dialog.querySelector('[data-receipt-capture]'),status=dialog.querySelector('[data-receipt-queue-status]');let processing=false,closed=false;
 const count=()=>getFiles().filter(f=>/^image\//.test(f.type)).length;
 ctx.assistantOpenReceiptQueue=()=>{if(processing||isBusy())return;status.textContent=count()+' fotoğraf cihazda bekliyor; henüz okunmadı. Açık kartlarınız korunur.';dialog.showModal();};
 dialog.querySelector('[data-queue-close]').onclick=()=>{if(!processing)dialog.close();};dialog.addEventListener('cancel',e=>{if(processing)e.preventDefault();});
 dialog.querySelector('[data-next-receipt]').onclick=()=>{picker.multiple=false;picker.setAttribute('capture','environment');picker.click();};dialog.querySelector('[data-gallery-receipts]').onclick=()=>{picker.multiple=true;picker.removeAttribute('capture');picker.click();};
 picker.onchange=async()=>{if(processing||isBusy())return;const chosen=[...picker.files];picker.value='';if(!chosen.length)return;if(chosen.length+getFiles().length>20){status.textContent='En fazla20ek. Önceki ekler korundu; yeni seçim alınmadı.';return;}processing=true;const buttons=[...dialog.querySelectorAll('button')];for(const b of buttons)b.disabled=true;status.textContent='Fotoğraflar doğrulanıyor ve cihazda saklanıyor…';
  try{const {prepareAttachment}=await import('./attachment-safety.js'),{shrink}=await import('./ai-gemini.js');const ready=[];for(const original of chosen){const safe=await prepareAttachment(original,{imageOnly:true}),small=await shrink(safe);ready.push(new File([small],original.name.replace(/\.[^.]+$/,'')+(small.type==='image/jpeg'?'.jpg':small.type==='image/webp'?'.webp':'.png'),{type:small.type,lastModified:original.lastModified}));}if(closed||!root.isConnected)return;await accept(ready);status.textContent=count()+' fotoğraf cihazda saklandı; henüz okunmadı veya iş olarak kaydedilmedi. Sonraki fişi ekleyebilirsiniz.';}
  catch(e){status.textContent='Fotoğraf kuyruğu tamamlanamadı: '+(e.message||e)+'. Önceki ekleri kontrol edin.';}finally{processing=false;for(const b of buttons)b.disabled=false;}
 };
 dialog.querySelector('[data-receipts-read]').onclick=()=>{dialog.close();root.querySelector('[data-msg]')?.focus();};dialog.querySelector('[data-receipts-task]').onclick=()=>{dialog.close();root.querySelector('[data-queue-assistant]')?.click();};
 return ()=>{closed=true;if(dialog.open)dialog.close();delete ctx.assistantOpenReceiptQueue;};
}

import {esc,toast,qs} from './ui.js';
import {isSessionUnlocked,reauth} from './security.js';
import {startActivity} from './update-safety.js';
import {pendingPaidWork,savePaidWorkReview} from './paid-work-db.js';
export async function mountPaidWorkReview(ctx,host){
 const panel=document.createElement('section');panel.dataset.paidWorkReviews='';host.append(panel);let busy=false,dirty=false;
 const canWrite=()=>localStorage.getItem('sp_driver')!=='1'&&document.visibilityState==='visible'&&isSessionUnlocked()&&!document.querySelector('#lock-root')&&panel.isConnected;
 async function render(){
  if(busy||dirty||!panel.isConnected)return;const pending=await pendingPaidWork();if(busy||dirty||!panel.isConnected)return;
  panel.innerHTML=pending.length?`<h2>Peşin işler · telefonda kontrol</h2><p>İş ve tahsilat birlikte kaydedilir. Tahsilat kartını ayrıca işaretleyin. KDV belirsizse fiyat bekler; tahsilat gerçek tutarıyla kaydedilir. Hakediş KDV politikası değişmez.</p>${pending.map(({packet:p})=>{const r=p.row;return `<form class="card" data-paid-form="${esc(p.id)}"><h3>${esc(r.customer)}</h3><p>${esc(r.date)} · ${esc(r.vehicle)} · ${esc(r.personnel)}</p><p>${esc(r.description)} · ${esc(r.quantity)} ${esc(r.unit)}</p><p>Birim fiyat: ${esc(r.unit_price)} TL · Tahsilat: <b>${esc(r.collection_amount)} TL</b></p><p>${r.cash_status==='PERSONELDE'?`Para ${esc(r.personnel)} üzerinde; kasaya teslim edilmedi.`:'Para şirket kasasında.'}</p>${r.create_customer?'<p>Bu müşteri yoksa onaylanan adıyla oluşturulacak.</p>':''}<label class="field">İş fiyatının KDV durumu<select name="vat_mode" required><option value="">Seçin</option><option value="excluded">KDV hariç</option><option value="included">KDV dahil</option><option value="unknown">KDV belirsiz · iş fiyatı beklesin</option></select></label><label class="field">KDV oranı (%)<input name="vat_rate" type="number" min="0" max="100" step="any" placeholder="Kayıtlı veya doğruladığınız oran"></label><label class="check"><input type="checkbox" name="selected"> ${esc(r.collection_amount)} TL tahsilatı ve paranın yukarıdaki yerini kontrol ettim.</label><details><summary>Kaynak mesaj</summary><p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(r.raw_message)}</p></details><button class="btn primary block" type="submit" disabled>İşi ve Tahsilatı Kaydet</button><p role="status" data-paid-status></p></form>`;}).join('')}`:'';
  for(const form of panel.querySelectorAll('[data-paid-form]')){
   const update=()=>{dirty=true;const mode=form.elements.vat_mode.value,rate=form.elements.vat_rate;rate.disabled=mode==='unknown';rate.required=!!mode&&mode!=='unknown';qs('button[type="submit"]',form).disabled=!form.elements.selected.checked;};
   form.addEventListener('input',update);form.addEventListener('change',update);
   form.addEventListener('submit',async e=>{e.preventDefault();if(busy||!form.reportValidity()||!form.elements.selected.checked)return;if(!await reauth('Peşin iş ve tahsilatı kaydet'))return;busy=true;const release=startActivity('paid-work-review');const button=qs('button[type="submit"]',form);button.disabled=true;
    const controls=[...form.querySelectorAll('input,select')],states=controls.map(el=>el.disabled);const mode=form.elements.vat_mode.value,choice={selected:true,vat_mode:mode,vat_rate:mode==='unknown'?null:Number(form.elements.vat_rate.value)};controls.forEach(el=>el.disabled=true);
    try{await savePaidWorkReview(form.dataset.paidForm,choice,{localApproval:true,canWrite});form.remove();dirty=!!panel.querySelector('form');toast('İş ve tahsilat birlikte kaydedildi','ok');window.dispatchEvent(new Event('sp-remote-status'));}
    catch(error){qs('[data-paid-status]',form).textContent=error.message;}
    finally{release();busy=false;controls.forEach((el,i)=>el.disabled=states[i]);button.disabled=!form.elements.selected.checked;if(!dirty)await render();}
   });
  }
 }
 const refresh=()=>render().catch(()=>{});window.addEventListener('sp-remote-status',refresh);const observer=new MutationObserver(()=>{if(!panel.isConnected){window.removeEventListener('sp-remote-status',refresh);observer.disconnect();}});observer.observe(document.body,{childList:true,subtree:true});await render();
}

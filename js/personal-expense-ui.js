import {esc,toast,qs} from './ui.js';
import {isSessionUnlocked,reauth} from './security.js';
import {startActivity} from './update-safety.js';
import {pendingPersonalExpenses,savePersonalExpenseReview} from './personal-expense-db.js';
import {personalExpenseMoney} from './personal-expense-core.js';
export async function mountPersonalExpenseReview(ctx,host){
 const panel=document.createElement('section');panel.dataset.personalExpenseReviews='';host.append(panel);let busy=false,dirty=false;
 const canWrite=()=>localStorage.getItem('sp_driver')!=='1'&&document.visibilityState==='visible'&&isSessionUnlocked()&&!document.querySelector('#lock-root')&&panel.isConnected;
 async function render(){
  if(busy||dirty||!panel.isConnected)return;const pending=await pendingPersonalExpenses();if(busy||dirty||!panel.isConnected)return;
  panel.innerHTML=pending.length?`<h2>Personelin ödediği gider · telefonda kontrol</h2><p>Kaydetmeden gider veya personel alacağı oluşmaz. Şirket kasasından çıkış yapılmaz. Gerçekte ödenen toplamı ayrıca doğrulayın.</p>${pending.map(({packet:p})=>{const r=p.row,m=personalExpenseMoney(p);return `<form class="card" data-personal-form="${esc(p.id)}"><h3>${esc(r.quarry)}</h3><p>${esc(r.date)} · ${esc(r.vehicle)} · ${esc(r.personnel)}</p><p>${esc(r.description)}</p><p>KDV hariç: ${esc(m.amount)} TL · KDV %${esc(r.kdv_rate)}: ${esc(m.kdv)} TL · Toplam: <b>${esc(m.total)} TL</b></p><p>Bu kart yalnız bedelin tamamı personel tarafından ödendiyse kaydedilir. Gerçek ödeme farklıysa kaydetmeyin; kalan tutar ayrıca doğrulanmalıdır.</p><label class="field">Personelin cebinden gerçekten ödediği toplam (TL)<input name="paid_amount" type="number" min="0.01" max="1000000000" step="0.01" required placeholder="Gerçek ödemeyi yazın"></label><label class="check"><input type="checkbox" name="selected"> Gerçek ödemeyi kontrol ettim; bu tutar personele geri ödenecek.</label><details><summary>Kaynak mesaj</summary><p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(r.raw_message)}</p></details><button class="btn primary block" type="submit" disabled>Gideri Kaydet · Geri Ödeme Beklesin</button><p role="status" data-personal-status></p></form>`;}).join('')}`:'';
  for(const form of panel.querySelectorAll('[data-personal-form]')){
   const update=()=>{dirty=true;qs('button[type="submit"]',form).disabled=!form.elements.selected.checked||!form.elements.paid_amount.validity.valid;};
   form.addEventListener('input',update);form.addEventListener('change',update);
   form.addEventListener('submit',async e=>{e.preventDefault();if(busy||!form.reportValidity()||!form.elements.selected.checked)return;if(!await reauth('Personel giderini ve geri ödeme alacağını kaydet'))return;busy=true;const release=startActivity('personal-expense-review');const button=qs('button[type="submit"]',form);button.disabled=true;
    const controls=[...form.querySelectorAll('input,select')],states=controls.map(el=>el.disabled);const choice={selected:true,paid_amount:Number(form.elements.paid_amount.value)};controls.forEach(el=>el.disabled=true);
    try{await savePersonalExpenseReview(form.dataset.personalForm,choice,{localApproval:true,canWrite});form.remove();dirty=!!panel.querySelector('form');toast('Personel gideri kaydedildi; geri ödeme bekliyor','ok');window.dispatchEvent(new Event('sp-remote-status'));}
    catch(error){qs('[data-personal-status]',form).textContent=error.message;}
    finally{release();busy=false;controls.forEach((el,i)=>el.disabled=states[i]);button.disabled=!form.elements.selected.checked;if(!dirty)await render();}
   });
  }
 }
 const refresh=()=>render().catch(()=>{});window.addEventListener('sp-remote-status',refresh);const observer=new MutationObserver(()=>{if(!panel.isConnected){window.removeEventListener('sp-remote-status',refresh);observer.disconnect();}});observer.observe(document.body,{childList:true,subtree:true});await render();
}

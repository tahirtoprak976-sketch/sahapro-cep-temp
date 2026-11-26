import {esc,qs} from './ui.js';
import {reauth} from './security.js';
import {remoteAuthority} from './remote-approved-db.js';
import {getLiveAccess,putLiveAccess} from './secure-transfer-db.js';
import {readLiveCode} from './live-access-core.js';
import {liveTransport,stopLiveAccess,checkLiveAccess} from './live-access-runner.js';
export async function mountLiveAccess(host){
 const panel=document.createElement('section');panel.className='slip-panel';panel.dataset.liveAccess='';host.append(panel);
 let busy=false;
 async function render(){
  const config=await getLiveAccess();if(!panel.isConnected)return;
  panel.innerHTML=`<h2>Canlı Sohbet Bağlantısı</h2><p>İzin verdiğinizde bu sohbetten müşteri, şantiye, filo, personel, ocak, döküm ve fiyat kartları ile iş sözleşmeleri okunabilir. Yanıtlar şifreli gönderilir. Telefon açık, çevrimiçi ve kilidi çözülmüş olmalıdır. Kayıtlar telefonda kalır.</p><p><strong>${config?.enabled?'Canlı bağlantı açık':'Canlı bağlantı kapalı'}</strong></p>${config?.enabled?`<p>Onaylı kayıt aktarımı: ${config.allow_writes?'Açık; mevcut kayıt denetimleri geçerli':'Kapalı'}</p><button class="btn" data-live-check>Şimdi Kontrol Et</button><button class="btn danger" data-live-stop>Canlı Bağlantıyı Kapat</button>`:`<form data-live-form><label class="field">Bu telefon için hazırlanan gizli bağlantı kodu<input name="live_code" type="password" autocomplete="off" required maxlength="90"></label><label><input name="read_consent" type="checkbox" required> Kart ve sözleşme bilgilerimi bu sohbetle paylaşmayı onaylıyorum.</label><label><input name="allow_writes" type="checkbox"> Sohbette onayladığım paketler mevcut doğrulamalarla kaydedilebilsin. Peşin işlerin telefondaki onayı korunur.</label><button class="btn primary" type="submit">Canlı Bağlantıyı Aç</button></form>`}<p role="status" data-live-status></p>`;
  qs('[data-live-form]',panel)?.addEventListener('submit',async e=>{
   e.preventDefault();if(busy)return;busy=true;const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;
   try{
    if(!form.elements.read_consent.checked)throw Error('Paylaşım onayı gerekli');
    if(!await reauth('Canlı kart ve sözleşme paylaşımı'))return;
    const authority=await remoteAuthority();if(!authority)throw Error('Önce sohbetten onaylı kayıt bağlantısını açın');
    if(!navigator.locks)throw Error('Tarayıcı canlı bağlantı kilidini desteklemiyor');
    const code=readLiveCode(form.elements.live_code.value,authority.channel);
    await liveTransport(code,'poll');
    if((await remoteAuthority())?.channel!==code.channel)throw Error('Sohbet bağlantısı değişti');
    await putLiveAccess({...code,enabled:true,allow_writes:form.elements.allow_writes.checked,retries:[]});form.reset();await render();
   }catch(e){qs('[data-live-status]',panel).textContent=e.message;}finally{busy=false;if(button.isConnected)button.disabled=false;}
  });
  qs('[data-live-stop]',panel)?.addEventListener('click',async()=>{if(busy)return;busy=true;try{if(!await reauth('Canlı paylaşımı kapat'))return;await stopLiveAccess();await render();}finally{busy=false;}});
  qs('[data-live-check]',panel)?.addEventListener('click',async()=>{if(busy)return;busy=true;try{await checkLiveAccess();qs('[data-live-status]',panel).textContent='Kontrol tamamlandı; açık form veya kilit varsa talepler bekler.';}catch(e){qs('[data-live-status]',panel).textContent=esc(e.message);}finally{busy=false;}});
 }
 await render();
}

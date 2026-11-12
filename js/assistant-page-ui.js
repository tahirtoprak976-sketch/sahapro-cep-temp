import {assistantHubHTML} from './assistant-hub-ui.js';
import {appbar,esc,notice,qs,confirmDialog,toast} from './ui.js';

export const hasAssistantDraft=root=>!!qs('[data-out] .card[data-kind]:not([data-saved="1"]),[data-work-confirm]:not(:disabled),[data-customer-create],[data-site-create],[data-directory-create]',root);
export const DETAIL_PREFERENCE='sp_assistant_details_v1';
export function detailedAssistant(){try{return localStorage.getItem(DETAIL_PREFERENCE)==='expanded';}catch{return false;}}
export function assistantPageHTML(g,query,guide){
 return appbar('Akıllı Asistan','İşini anlat · birlikte kontrol edip kaydedelim')+`<div class="assistant-workspace" data-assistant-page>
 <div class="assistant-toolbar"><span class="badge">${g.ready?'Gemini ayarlı':'Yerel işlemler hazır'}</span><button class="btn sm" type="button" data-history-open>Geçmiş</button><button class="btn sm" type="button" data-tools-open>Araçlar</button><button class="btn sm" type="button" data-new-chat aria-label="Yeni sohbet" disabled>＋ Yeni</button></div>
 ${query?.wa?notice('info','WhatsApp mesajları ve ekleri hazır. Gönder düğmesiyle kontrol kartlarını hazırlayın.'):''}
 ${assistantHubHTML()}
 <section class="assistant-welcome" data-assistant-welcome><div class="assistant-section-label">KARTLAR VE HIZLI BAŞLANGIÇ</div><h2>Hızlı kayıtlar</h2><p>İşlerini anlat, WhatsApp mesajlarını yapıştır veya belge ekle.</p><ol class="assistant-steps" aria-label="Kayıt adımları"><li><b>1</b> Anlat</li><li><b>2</b> Kontrol et</li><li><b>3</b> Onayla</li></ol><div class="assistant-entity-actions"><button type="button" data-start-customer disabled><span class="assistant-action-mark">＋</span><span><b>Yeni müşteri</b><small>Müşteri veya taşeron kartı aç</small></span></button><button type="button" data-start-site disabled><span class="assistant-action-mark">＋</span><span><b>Yeni şantiye</b><small>Müşterisine bağlı şantiye aç</small></span></button><button type="button" data-start-vehicle disabled><span class="assistant-action-mark">＋</span><span><b>Yeni araç / makine</b><small>Tür ve plaka bilgilerini ekle</small></span></button><button type="button" data-start-personnel disabled><span class="assistant-action-mark">＋</span><span><b>Yeni personel</b><small>Ad ve iletişim kartı aç</small></span></button></div><div class="assistant-starts"><button type="button" data-start-work disabled><b>İş / gider kaydet</b><span>Konuşarak kayıt hazırla</span></button><button type="button" data-start-compare disabled><b>Mesajlarla karşılaştır</b><span>Günlük iş kontrolünü aç</span></button><button type="button" data-start-claim disabled><b>Hakediş hazırla</b><span>Hazır ve eksik işleri incele</span></button></div></section>
 <details class="assistant-history" data-history-panel><summary>Önceki mesajlar ve yarım kalan istekler</summary><div data-task-center></div><div class="tiny muted">Son 20 konuşma turu bu telefonda tutulur. Eski sohbet güncel hesap yerine geçmez.</div></details>
 <section class="assistant-conversation" aria-label="Sohbet"><div data-chat-log class="assistant-chat-log" aria-label="Mesajlar" aria-live="polite" aria-relevant="additions text"></div></section>
 <details class="assistant-resume" data-resume-panel hidden><summary>Yarım kalan isteğe devam et</summary><div data-agent-task></div></details>
 <div data-lastundo></div><div data-out class="assistant-results" aria-label="Kontrol kartları"></div>
 <details class="card assistant-options" data-assistant-tools><summary>Araçlar ve sohbet seçenekleri</summary>
 ${g.ready?'':notice('info','Müşteri, şantiye, araç ve personel kartları ile yerel iş / gider taslakları anahtarsız çalışır. Genel mesaj ve belge okuma için Gemini bağlantısını ayarlayın.')+'<button class="btn block" data-go="#/yapay-zeka">Yapay Zeka Ayarları</button>'}
 <label class="history-check small"><input type="checkbox" data-chat-context checked> Önceki sohbeti ve açık isteği kullan</label><p class="tiny muted">Gemini ile okuma sırasında bu bağlam da paylaşılır. Kapatırsanız yeni istek olarak okunur.</p>
 <label class="history-check small" data-refine-wrap hidden><input type="checkbox" data-refine><span><b>Önceki sonucu düzelt</b><span class="muted tiny" data-refine-prev></span></span></label>
 <button class="btn block" data-part-document>Yedek parça / garanti belgesi oku</button>
 <button class="btn block" data-go="#/akilli-asistan/pdf-gecmis">Geçmiş işleri PDF’den aktar</button>
 <button class="btn block" data-go="#/whatsapp-toplu">WhatsApp toplu işleme</button>
 <button class="btn block" data-go="#/akilli-asistan/ozet">Gün sonu özeti</button><button class="btn block" data-go="#/akilli-asistan/soru">Soru sor</button>
 <button class="btn block" data-go="#/akilli-asistan/danisman">Yönetim danışmanı</button><button class="btn block" data-go="#/teklif-hesap">Teklif asistanı</button>${guide}
 </details>
 <div class="assistant-composer-space" data-composer-space></div>
 <section class="assistant-composer" data-composer aria-label="Asistana mesaj gönder">
 <div data-read-status hidden role="status">İstek okunuyor; henüz kayıt yazılmıyor.<button class="btn block" data-stop-reading>Okumayı durdur</button></div>
 <div class="assistant-file-strip" data-thumbs></div><div class="assistant-file-actions"><button class="btn sm" type="button" data-clearfiles hidden>Ekleri temizle</button><div data-attachment-error role="alert" class="small" hidden></div></div>
 <label class="assistant-message-label" for="assistant-message">Mesaj</label><textarea id="assistant-message" data-msg readonly rows="2" placeholder="Mesajını yaz veya WhatsApp’tan yapıştır…"></textarea>
 <input type="file" accept="image/jpeg,image/png,image/webp,audio/*,.txt,.zip,.pdf,text/plain,application/zip,application/pdf" multiple data-photos class="assistant-native-file" tabindex="-1" aria-label="Fotoğraf, PDF veya aktarım dosyası seç">
 <input type="file" accept="image/jpeg,image/png,image/webp,audio/*,.txt,.zip,.pdf,text/plain,application/zip,application/pdf" multiple data-addphotos class="assistant-native-file" tabindex="-1" aria-label="Yeni ekleri seç">
 <div class="assistant-composer-actions"><button class="btn" type="button" data-attach aria-label="Fotoğraf veya dosya ekle">＋ Ekle</button><button class="btn" type="button" data-rec ${g.ready?'':'disabled'}>🎤 Sesli not</button><button class="btn primary" type="button" data-ask disabled>Gönder ↑</button></div>
 <div data-turn-intent class="tiny muted" role="status">Yeni istek veya belge gönderebilirsiniz.</div>
 </section></div>`;
}

export function mountAssistantPage(ctx){
 const {root,db}=ctx,workspace=qs('[data-assistant-page]',root),composer=qs('[data-composer]',root),space=qs('[data-composer-space]',root),msg=qs('[data-msg]',root);
 const cleanups=[];let closed=false,frame;
 const layout=()=>{if(closed||!workspace.isConnected)return;if(qs('[data-customer-create],[data-site-create],[data-directory-create],[data-hub-panel]:not([hidden])',root)){composer.classList.remove('fixed');for(const key of ['left','width','bottom'])composer.style[key]='';space.style.height='0px';return;}const r=workspace.getBoundingClientRect(),vv=window.visualViewport,visibleBottom=(vv?.height||innerHeight)+(vv?.offsetTop||0),nav=document.getElementById('bottomnav'),nr=nav?.getBoundingClientRect();let bottom=Math.max(8,innerHeight-visibleBottom+8);if(nr&&getComputedStyle(nav).display!=='none'&&!nav.hidden&&nr.top<visibleBottom&&nr.bottom<=visibleBottom+2)bottom=Math.max(bottom,innerHeight-nr.top+8);composer.style.left=r.left+'px';composer.style.width=r.width+'px';composer.style.bottom=bottom+'px';composer.classList.add('fixed');space.style.height=(composer.getBoundingClientRect().height+24)+'px';};
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(layout);};
 const resize=new ResizeObserver(schedule);resize.observe(workspace);resize.observe(composer);window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
 const dispose=()=>{if(closed)return;closed=true;cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);for(const fn of cleanups)fn();};
 const observer=new MutationObserver(()=>{if(!workspace.isConnected)dispose();else{const active=!!qs('[data-agent-task]',root)?.textContent.trim();qs('[data-resume-panel]',root).hidden=!active;schedule();}});observer.observe(document.body,{childList:true,subtree:true});
 qs('[data-attach]',root).onclick=()=>qs('[data-addphotos]',root).click();
 qs('[data-history-open]',root).onclick=()=>{const panel=qs('[data-history-panel]',root);panel.open=!panel.open;qs('[data-resume-panel]',root).open=panel.open;qs('[data-earlier-turns]',root)?.toggleAttribute('open',panel.open);panel.scrollIntoView({block:'start',behavior:'smooth'});};
 qs('[data-tools-open]',root).onclick=()=>{const panel=qs('[data-assistant-tools]',root);panel.open=!panel.open;panel.scrollIntoView({block:'start',behavior:'smooth'});};
 let starting=false;
 const start=async(text,href,entity=null)=>{
  if(starting||qs('[data-ask]',root).disabled)return;starting=true;
  try{
   const pending=(entity||href)&&hasAssistantDraft(root);
   if((msg.value.trim()||pending)&&!(await confirmDialog(href?'Ekrana geçilsin mi?':pending?'Açık taslak kapansın mı?':'Mesaj değişsin mi?',href?(pending?'Kaydedilmemiş kontrol kartı bu ekrandan ayrılınca kapanacak. Önce kartı tamamlayabilir veya açıkça bu ekrana geçebilirsiniz. Mesaj ve ekler saklanır.':'Yazdığınız mesaj bu telefonda saklanacak.'):pending?'Kaydedilmemiş kartın yerini yeni kart taslağı alacak.':'Yazdığınız metnin yerine başlangıç örneği gelecek; ekler korunacak.',href?'Ekranı aç':pending?'Yeni kartı aç':'Örneği yaz')))return;
   if(!root.isConnected)return;
   if(href){await ctx.assistantPrepareNavigation?.();await db.metaSet('assistant_draft',msg.value);ctx.go(href);}
   else if(entity){if(entity==='customer')await ctx.assistantOpenCustomer?.();else if(entity==='site')await ctx.assistantOpenSite?.();else await ctx.assistantOpenDirectory?.(entity);msg.value='';await db.metaSet('assistant_draft','');msg.dispatchEvent(new Event('input',{bubbles:true}));}
   else{msg.value=text;msg.dispatchEvent(new Event('input',{bubbles:true}));msg.focus();}
  }catch(e){toast(e.message,'err');}finally{starting=false;}
 };
 qs('[data-start-customer]',root).onclick=()=>start(null,null,'customer');
 qs('[data-start-site]',root).onclick=()=>start(null,null,'site');
 qs('[data-start-vehicle]',root).onclick=()=>start(null,null,'vehicles');
 qs('[data-start-personnel]',root).onclick=()=>start(null,null,'personnel');
 qs('[data-start-work]',root).onclick=()=>start('Yeni iş kaydı oluştur');
 qs('[data-start-compare]',root).onclick=()=>start(null,'#/isler/kontrol');
 qs('[data-start-claim]',root).onclick=()=>start(null,'#/hakedis/hazirlik');
 msg.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.isComposing&&e.keyCode!==229){e.preventDefault();qs('[data-ask]',root).click();}});
 const grow=()=>{msg.style.height='auto';msg.style.height=Math.min(120,Math.max(52,msg.scrollHeight))+'px';schedule();};msg.addEventListener('input',grow);
 if(detailedAssistant()){qs('[data-assistant-tools]',root).open=true;qs('[data-history-panel]',root).open=true;qs('[data-resume-panel]',root).open=true;}
 grow();layout();return {dispose,onDispose:fn=>cleanups.push(fn),refresh:grow,runAction:start};
}

export function conversationHTML(state){
 const labels={pending:'Yanıt bekleniyor',answer:'Yanıt',draft:'Onay bekliyor',clarify:'Bilgi gerekiyor',saved:'Kaydedildi',partial:'Kontrol gerekiyor',error:'Tamamlanamadı',cancelled:'Vazgeçildi'};
 const turn=t=>`<article class="assistant-chat-turn" data-chat-turn="${esc(t.id)}"><div class="assistant-chat-user"><b>Siz</b><div>${esc(t.user)}</div></div><div class="assistant-chat-reply"><b>Asistan</b><span class="badge" data-chat-state="${esc(t.status)}">${esc(labels[t.status]||'Kontrol gerekiyor')}</span><div>${esc(t.reply)}</div></div></article>`;
 const recent=state.turns.slice(-2),earlier=state.turns.slice(0,-2);
 return (earlier.length?`<details data-earlier-turns ${detailedAssistant()?'open':''}><summary>Önceki ${earlier.length} mesajı göster</summary>${earlier.map(turn).join('')}</details>`:'')+recent.map(turn).join('');
}

// One recoverable request warning; restoring the original nodes retains live form values/listeners.
export function showAssistantRequestError(out,message,restore=null){
 if(!out)return;
 if(restore)out.replaceChildren(...restore);
 for(const old of out.querySelectorAll(':scope > [data-assistant-request-error]'))old.remove();
 const wrapper=document.createElement('div');wrapper.innerHTML=notice('warn',message);
 const node=wrapper.firstElementChild;node.dataset.assistantRequestError='';node.setAttribute('role','alert');out.prepend(node);
}

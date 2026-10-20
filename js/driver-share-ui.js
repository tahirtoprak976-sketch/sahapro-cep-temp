// Prepare first, then invoke Web Share directly in a fresh user click.
import {esc} from './ui.js';
import {todayStr} from './core.js';
import {preparedPacketError} from './driver-delivery.js';
export function reviewDriverPacket({packet,cfg,entryLine,readEntries,readConfig,root}){
 return new Promise(resolve=>{
  const box=document.createElement('div');box.className='driver-share-overlay';box.dataset.driverShare='1';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','driver-share-title');
  const urls=[],previousFocus=document.activeElement,wasInert=root.inert;
  const size=packet.bytes<1048576?Math.ceil(packet.bytes/1024)+' KB':(packet.bytes/1048576).toLocaleString('tr-TR',{maximumFractionDigits:1})+' MB';
  let active=false,closed=false;
  const labels={work:'İş',fuel:'Yakıt',expense:'Gider',maintenance:'Bakım'};
  const counts={work:0,fuel:0,expense:0,maintenance:0};for(const e of packet.rows)counts[e.k==='f'?'fuel':e.k==='g'?'expense':e.k==='m'?'maintenance':'work']++;
  box.innerHTML=`<section class="driver-share-panel"><h2 id="driver-share-title" tabindex="-1">Patrona ilet · paket hazır</h2><p><b>${packet.rows.length} kayıt · ${packet.files.length} dosya</b> · ${size}</p><p class="small">${Object.entries(counts).filter(([,n])=>n).map(([k,n])=>n+' '+labels[k]).join(' · ')}</p>${packet.remaining?`<p class="notice info">Bu paketten sonra ${packet.remaining} kayıt kalacak. Dönüşte kalanları ayrıca paylaşın.</p>`:''}<p class="small muted">${esc(cfg.p[1])} · Paketi WhatsApp'ta doğru kişiye gönderin. Patron mesajı ve tüm dosyaları Asistan'a ekleyip kontrol ederek kaydeder.</p><details><summary>Gönderilecek kayıtlar (${packet.rows.length})</summary>${packet.rows.map(e=>`<p class="small driver-packet-line">${esc(entryLine(e,cfg))}</p>`).join('')}</details><details ${packet.files.length?'open':''}><summary>Dosyaları kontrol et (${packet.files.length})</summary><div class="driver-packet-files">${packet.files.map((f,i)=>{const url=URL.createObjectURL(f);urls.push(url);return `<figure><img src="${url}" alt="Dosya ${i+1}" loading="lazy"><figcaption>${i+1} · ${esc(f.name)}</figcaption></figure>`;}).join('')}</div></details><p class="small muted">Dosyaları aynı paketle ve aynı sırayla iletin. WhatsApp dosya sırasını değiştirirse patron eşleşmeleri fotoğraflardan kontrol etmelidir.</p><p class="notice warn" data-driver-share-status role="status">Henüz paylaşılmadı. Paylaşım ekranını açmak, patronun aldığı anlamına gelmez.${navigator.onLine?'':' Çevrimdışısınız; WhatsApp gönderimi bağlantı gelene kadar bekleyebilir.'}</p><button class="btn primary block" data-driver-share-go>WhatsApp’ta paylaş</button><button class="btn block" data-driver-share-cancel style="margin-top:8px">Vazgeç · kayıtlar telefonda kalsın</button></section>`;
  const go=box.querySelector('[data-driver-share-go]'),cancel=box.querySelector('[data-driver-share-cancel]'),status=box.querySelector('[data-driver-share-status]');
  function close(value){if(closed)return;closed=true;urls.forEach(URL.revokeObjectURL);box.remove();root.inert=wasInert;document.removeEventListener('keydown',keys,true);previousFocus?.focus();resolve(value);}
  function keys(e){if(e.key==='Escape'){e.preventDefault();if(!active)close(null);}if(e.key==='Tab'){const els=[...box.querySelectorAll('button:not(:disabled),summary')];const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
  cancel.onclick=()=>{if(!active)close(null);};
  go.onclick=()=>{
   if(active)return;
   try{
    const error=preparedPacketError(packet,readEntries(),cfg,readConfig(),todayStr());if(error)throw Error(error);
    const payload=packet.files.length?{text:packet.text,files:packet.files}:{text:packet.text};
    if(packet.files.length&&(!navigator.share||!navigator.canShare?.(payload)))throw Error('Bu tarayıcı dosyalı paylaşımı desteklemiyor. Chrome / Safari ile açın; dosyalar ve kayıtlar telefonda korunuyor.');
    active=true;go.disabled=cancel.disabled=true;status.textContent='Paylaşım ekranı açık. WhatsApp’ta alıcıyı, mesajı ve dosyaları kontrol edin.';
    // No await, cache access, compression or promise before this native call.
    let action;
    if(navigator.share)action=navigator.share(payload);
    else{const w=window.open('about:blank','_blank');if(!w)throw Error('WhatsApp penceresi engellendi; açılır pencereye izin verip tekrar deneyin');w.opener=null;w.location.href='https://wa.me/?text='+encodeURIComponent(packet.text);action=Promise.resolve();status.textContent='WhatsApp bağlantısı açıldı. Gönderildiğini WhatsApp’tan kontrol edin.';}
    Promise.resolve(action).then(()=>close(packet.rows),fail);
   }catch(e){fail(e);}
  };
  function fail(e){if(closed)return;active=false;go.disabled=cancel.disabled=false;status.textContent=e?.name==='AbortError'?'Paylaşım iptal edildi. Kayıtlar bekliyor; yeniden deneyebilir veya geri dönebilirsiniz.':'Paylaşılamadı: '+(e.message||e)+'. Kayıtlar telefonda korunuyor.';status.setAttribute('role','alert');go.textContent='Tekrar paylaş';go.focus();}
  root.inert=true;document.body.append(box);document.addEventListener('keydown',keys,true);box.querySelector('h2').focus({preventScroll:true});
 });
}

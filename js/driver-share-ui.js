import {makeDriverPDF} from "./driver-pdf-transfer.js";
import {makeDriverBundle} from "./driver-bundle.js";
import {cleanDriverShare} from "./driver-transfer.js";
// Prepare first, then invoke Web Share directly in a fresh user click.
import {esc,downloadBlob} from './ui.js';
import {todayStr} from './core.js';
import {preparedPacketError} from './driver-delivery.js';
export async function reviewDriverPacket({packet,cfg,entryLine,readEntries,readConfig,root}){
 // The default signed message needs no derived file or PDF rendering.
 let bundlePayload=null,pdfPayload=null,cleanPayload=null,downloadPayload=null;
 let bundleError='Önce dosya seçeneklerini hazırlayın.',pdfError=bundleError,cleanError=bundleError;
 return new Promise(resolve=>{
  const box=document.createElement('div');box.className='driver-share-overlay';box.dataset.driverShare='1';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','driver-share-title');
  const urls=[],previousFocus=document.activeElement,wasInert=root.inert;
  const size=packet.bytes<1048576?Math.ceil(packet.bytes/1024)+' KB':(packet.bytes/1048576).toLocaleString('tr-TR',{maximumFractionDigits:1})+' MB';
  let active=false,closed=false,lastMode=false;
  const cashReports=packet.rows.filter(e=>!e.k&&Number(e.cash)>0).length;
  const labels={work:'İş',fuel:'Yakıt',expense:'Gider',maintenance:'Bakım'};
  const counts={work:0,fuel:0,expense:0,maintenance:0};for(const e of packet.rows)counts[e.k==='f'?'fuel':e.k==='g'?'expense':e.k==='m'?'maintenance':'work']++;
  box.innerHTML=`<section class="driver-share-panel"><h2 id="driver-share-title" tabindex="-1">Patrona ilet · paket hazır</h2><p><b>${packet.rows.length} kayıt · ${packet.files.length} fotoğraf · 1 paket</b> · ${size}</p><p class="small">${Object.entries(counts).filter(([,n])=>n).map(([k,n])=>n+' '+labels[k]).join(' · ')}</p>${packet.remaining?`<p class="notice info">Bu paketten sonra ${packet.remaining} kayıt kalacak. Dönüşte kalanları ayrıca paylaşın.</p>`:''}${cashReports?`<p class="notice info">${cashReports} işte alınan nakit bildirimi var. Tahsilat, patron kontrol edip onayladığında kaydedilir; kasaya teslim ayrı işlemdir.</p>`:''}<p class="small muted">${esc(cfg.p[1])} · Paylaşım ekranında WhatsApp’ı ve patronu seçin. Patron kodlu mesajı ve fotoğrafları Asistan’a ekleyip kontrol ederek kaydeder.</p><details><summary>Gönderilecek kayıtlar (${packet.rows.length})</summary>${packet.rows.map(e=>`<p class="small driver-packet-line">${esc(entryLine(e,cfg))}</p>`).join('')}</details><details><summary>Dosyaları kontrol et (${packet.files.length})</summary><div class="driver-packet-files">${packet.files.map((f,i)=>{const url=URL.createObjectURL(f);urls.push(url);return `<figure><img src="${url}" alt="Dosya ${i+1}" loading="lazy"><figcaption>${i+1} · ${esc(f.name)}</figcaption></figure>`;}).join('')}</div></details><p class="small muted">Kodlu mesaj ve fotoğraflar birlikte hazırlanır. WhatsApp’ta mesajın ve bütün eklerin seçili olduğunu kontrol edin.</p><p class="notice warn" data-driver-share-status role="status">Henüz paylaşılmadı. Paylaşım ekranını açmak, patronun aldığı anlamına gelmez.${navigator.onLine?'':' Çevrimdışısınız; WhatsApp gönderimi bağlantı gelene kadar bekleyebilir.'}</p><div class="notice info small">Patrona aktarım: doğrulama kodu, kayıt kimlikleri ve fotoğraflar korunur. Gruba yalnız iş özeti göndermek için önce bu ekranı kapatıp “WhatsApp grubunda paylaş” düğmesini kullanın.</div><button class="btn primary block" data-driver-share-go>Patrona gönder · kodlu mesaj + fotoğraflar</button><details style="margin-top:10px"><summary>Dosyayla aktarım seçenekleri</summary><p class="small muted">Normal kodlu gönderim için dosya hazırlamanız gerekmez.</p><button class="btn block" data-driver-files-prepare>Dosya seçeneklerini hazırla</button><p class="small" data-driver-files-status role="status">Henüz hazırlanmadı.</p><button class="btn block" data-driver-share-pdf ${pdfError?'disabled':''}>PDF iş özetiyle aktar</button><p class="small muted" data-driver-pdf-error>${esc(pdfError)}</p><button class="btn block" style="margin-top:8px" data-driver-share-download ${downloadPayload?'':'disabled'}>Paketi indir · WhatsApp’tan belge gönder</button><div class="notice info small" style="display:block;overflow-wrap:anywhere" data-driver-share-manual hidden><div class="strong">İndirilen paketi gönderme</div><ol><li>Telefonda Dosyalar → İndirilenler’i açın.</li><li>WhatsApp’ta alıcıyı açın → ataç → Belge → <b data-driver-file-name>${esc(downloadPayload?.files[0]?.name||'SAHAPRO iş özeti')}</b> dosyasını seçip gönderin.</li><li>Patron bu tek dosyayı Asistan’a ekleyip kontrol eder.</li></ol><div>İndirmek, göndermek değildir. Bu kayıtlar telefonda beklemede kalır. İndirme başlamazsa uygulamayı doğrudan Chrome / Safari’de açıp tekrar deneyin.</div></div><p class="small strong">Diğer dosya biçimleri</p><button class="btn block" data-driver-share-clean ${bundleError?'disabled':''}>Tek ZIP paketini paylaş</button><p class="small muted" data-driver-bundle-error>${esc(bundleError)}</p><button class="btn block" data-driver-share-text ${cleanError?'disabled':''}>Sade mesaj + ayrı dosyalar</button><p class="small muted" data-driver-text-error>${esc(cleanError)}</p></details><button class="btn block" data-driver-share-cancel style="margin-top:8px">Vazgeç · kayıtlar telefonda kalsın</button></section>`;
  const go=box.querySelector('[data-driver-share-go]'),cancel=box.querySelector('[data-driver-share-cancel]'),status=box.querySelector('[data-driver-share-status]'),clean=box.querySelector('[data-driver-share-clean]'),text=box.querySelector('[data-driver-share-text]'),download=box.querySelector('[data-driver-share-download]'),pdf=box.querySelector('[data-driver-share-pdf]'),manual=box.querySelector('[data-driver-share-manual]'),prepareFiles=box.querySelector('[data-driver-files-prepare]'),filesStatus=box.querySelector('[data-driver-files-status]');
  function close(value){if(closed)return;closed=true;urls.forEach(URL.revokeObjectURL);box.remove();root.inert=wasInert;document.removeEventListener('keydown',keys,true);previousFocus?.focus();resolve(value);}
  function keys(e){if(e.key==='Escape'){e.preventDefault();if(!active)close(null);}if(e.key==='Tab'){const els=[...box.querySelectorAll('button:not(:disabled),summary')];const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
  cancel.onclick=()=>{if(!active)close(null);};
  const currentError=()=>preparedPacketError(packet,readEntries(),cfg,readConfig(),todayStr());
  function unlock(){
   active=false;go.disabled=cancel.disabled=false;
   clean.disabled=!!bundleError;text.disabled=!!cleanError;pdf.disabled=!!pdfError;download.disabled=!downloadPayload;
   prepareFiles.disabled=!!pdfPayload;prepareFiles.textContent=pdfPayload?'Dosya seçenekleri hazır':'Dosya seçeneklerini yeniden hazırla';
  }
  prepareFiles.onclick=async()=>{
   if(active)return;
   try{
    const error=currentError();if(error)throw Error(error);
    active=true;go.disabled=cancel.disabled=prepareFiles.disabled=true;
    clean.disabled=text.disabled=pdf.disabled=download.disabled=true;
    filesStatus.setAttribute('role','status');filesStatus.textContent='Dosya seçenekleri hazırlanıyor…';
    bundleError=pdfError=cleanError='';
    try{cleanPayload=cleanDriverShare(packet);if(cleanPayload.files.length>20||cleanPayload.files.reduce((n,f)=>n+f.size,0)>20*1048576)cleanError='Aktarım dosyasıyla birlikte dosya sınırı aşılıyor. Kodlu yöntemle veya daha az kayıt seçerek gönderin.';else if(!navigator.share||!navigator.canShare?.(cleanPayload))cleanError='Bu tarayıcı aktarım dosyasını paylaşamıyor. Kodlu mesaj yöntemini kullanabilirsiniz.';}catch(e){cleanError=e.message;}
    try{bundlePayload=await makeDriverBundle(packet);if(!navigator.share||!navigator.canShare?.(bundlePayload))bundleError='Bu tarayıcı doğrudan paket paylaşamıyor. Paketi indirip WhatsApp’ta Belge olarak gönderebilirsiniz.';}catch(e){bundleError=e.message;}
    if(bundlePayload){try{pdfPayload=await makeDriverPDF(packet,cfg,bundlePayload);if(!navigator.share||!navigator.canShare?.(pdfPayload))pdfError='Bu tarayıcı PDF paylaşımını desteklemiyor; diğer yöntemleri kullanabilirsiniz.';}catch(e){pdfError=e.message;}}
    else pdfError=bundleError;
    downloadPayload=pdfPayload||bundlePayload;
    box.querySelector('[data-driver-file-name]').textContent=downloadPayload?.files[0]?.name||'SAHAPRO iş özeti';
    box.querySelector('[data-driver-pdf-error]').textContent=pdfError;
    box.querySelector('[data-driver-bundle-error]').textContent=bundleError;
    box.querySelector('[data-driver-text-error]').textContent=cleanError;
    const changed=currentError();if(changed)throw Error(changed);
    filesStatus.textContent='Hazırlık tamamlandı. Kullanacağınız yönteme ayrıca basın; henüz paylaşım açılmadı.';
   }catch(e){filesStatus.textContent='Dosya hazırlığı tamamlanamadı: '+(e.message||e)+'. Kodlu gönderim seçeneği korunuyor.';filesStatus.setAttribute('role','alert');}
   finally{unlock();}
  };
  download.onclick=()=>{
   if(active)return;
   try{
    const error=currentError();if(error)throw Error(error);
    if(!downloadPayload)throw Error('Paket hazırlanamadı; geri dönüp yeniden hazırlayın');
    const file=downloadPayload.files[0];downloadBlob(file,file.name);
    manual.hidden=false;status.textContent='Paket için indirme isteği açıldı. İndirilen dosyayı WhatsApp’ta Belge olarak gönderin. Patronun aldığı doğrulanmadı; kayıtlar beklemede kalır.';status.setAttribute('role','status');cancel.textContent='Kapat · kayıtlar telefonda kalsın';manual.scrollIntoView({block:'nearest'});
   }catch(e){status.textContent='Paket indirilemedi: '+(e.message||e)+'. Kayıtlar telefonda korunuyor.';status.setAttribute('role','alert');}
  };
  const send=(mode)=>{
   if(active)return;lastMode=mode;
   try{
    const error=currentError();if(error)throw Error(error);
    const payload=mode==='pdf'?pdfPayload:mode==='bundle'?bundlePayload:mode==='text'?cleanPayload:packet.files.length?{text:packet.text,files:packet.files}:{text:packet.text};
    if(mode==='pdf'&&pdfError)throw Error(pdfError);if(mode==='bundle'&&bundleError)throw Error(bundleError);if(mode==='text'&&cleanError)throw Error(cleanError);
    if(payload.files?.length&&(!navigator.share||!navigator.canShare?.(payload)))throw Error('Bu tarayıcı dosyalı paylaşımı desteklemiyor. Chrome / Safari ile açın; dosyalar ve kayıtlar telefonda korunuyor.');
    active=true;go.disabled=clean.disabled=text.disabled=pdf.disabled=download.disabled=cancel.disabled=prepareFiles.disabled=true;status.textContent='Paylaşım ekranı açık. WhatsApp’ta alıcıyı, mesajı ve dosyaları kontrol edin.';
    // No await, cache access, compression or promise before this native call.
    let action;
    if(navigator.share)action=navigator.share(payload);
    else{const w=window.open('about:blank','_blank');if(!w)throw Error('WhatsApp penceresi engellendi; açılır pencereye izin verip tekrar deneyin');w.opener=null;w.location.href='https://wa.me/?text='+encodeURIComponent(packet.text);action=Promise.resolve();status.textContent='WhatsApp bağlantısı açıldı. Gönderildiğini WhatsApp’tan kontrol edin.';}
    Promise.resolve(action).then(()=>close(packet.rows),fail);
   }catch(e){fail(e);}
  };
  pdf.onclick=()=>send('pdf');go.onclick=()=>send(false);clean.onclick=()=>send('bundle');text.onclick=()=>send('text');
  function fail(e){
   if(closed)return;unlock();
   const denied=e?.name==='NotAllowedError'||/permission denied|not allowed/i.test(String(e?.message||''));
   status.textContent=e?.name==='AbortError'?'Paylaşım iptal edildi. Kayıtlar bekliyor; yeniden deneyebilir veya geri dönebilirsiniz.':denied?'Paylaşım izni reddedildi. Tarayıcı bu dosyayı paylaşım ekranına aktaramadı. Paketi indirip WhatsApp’ta Belge olarak gönderebilirsiniz. Kayıtlar telefonda korunuyor.':'Paylaşılamadı: '+(e.message||e)+'. Kayıtlar telefonda korunuyor. Paketi indirip WhatsApp’ta Belge olarak da gönderebilirsiniz.';
   status.setAttribute('role','alert');
   if(denied){prepareFiles.closest('details').open=true;if(downloadPayload){manual.hidden=false;download.focus();}else{status.textContent='Paylaşım izni reddedildi. Kayıtlar telefonda korunuyor. Alternatif aktarım için önce dosya seçeneklerini hazırlayabilirsiniz.';prepareFiles.focus();}return;}
   if(lastMode){const b=lastMode==='pdf'?pdf:lastMode==='bundle'?clean:text;b.textContent=lastMode==='pdf'?'Mesaj ve PDF’i tekrar gönder':lastMode==='bundle'?'Tek paketi tekrar gönder':'Sade mesajı tekrar paylaş';(b.disabled?cancel:b).focus();}else{go.textContent='Kodlu mesajı tekrar paylaş';go.focus();}
  }
  root.inert=true;document.body.append(box);document.addEventListener('keydown',keys,true);box.querySelector('h2').focus({preventScroll:true});
 });
}

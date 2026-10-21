import {qs,qsa,esc,confirmDialog,toast} from './ui.js';
export const ASSISTANT_TASKS=[
 {id:'payment_agenda',group:'Rapor',title:'Kime ödeme yapacağım?',detail:'Alış belgelerinde kayıtlı vadeler ve bağlı ödemeler sonrası kalan borçlar. İnternetsiz çalışır.',text:'Kime ödeme yapacağım?'},
 {id:'overview',group:'Rapor',title:'İşletme panosu',detail:'Dönem seç, grafiğe dokun, kaynak kayıtlarını aç.',hash:'#/isletme-panosu'},
 {id:'priorities',group:'Kontrol',title:'Bugün ne yapmalıyım?',detail:'Tahsilat, personelde nakit, bakım ve eksik kayıtlar için nedenleriyle öncelik önerir. İnternetsiz çalışır.',text:'Bugün ne yapmalıyım?'},
 {id:'today',group:'Rapor',title:'Bugünkü durum',detail:'İş, tahsilat, maliyet ve ayrı birim özeti. İnternetsiz çalışır.',text:'Bugünkü durum'},
 {id:'month',group:'Rapor',title:'Bu ayın özeti',detail:'Rakamlar bu cihazdaki kayıtlardan hesaplanır.',text:'Bu ayın özeti'},
 {id:'week',group:'Rapor',title:'Son 7 günün özeti',detail:'İş sayısı, fiyatlı işler ve tahsilat.',text:'Son 7 günün özeti'},
 {id:'pending',group:'Kontrol',title:'Bekleyen işler',detail:'Fiyatı eksik işler ve inceleme adayları. PDF taslakları panoda.',text:'Bekleyen işler'},
 {id:'quantity',group:'Kayıt',title:'İş miktarını düzelt',detail:'Örneği doldurur. Kayıt seçimi, tutar önizlemesi ve onay gerekir.',text:'Dünkü işi 3 saat yap'},
 {id:'work',group:'Kayıt',title:'Yeni iş kaydı',detail:'Müşteri, araç, miktar ve fiş bilgilerini formda gir.',hash:'#/isler/new'},
 {id:'cash',group:'Kayıt',title:'Tahsilat gir',detail:'Müşteriden alınan para. Kaydetmeden önce tutarı kontrol et.',hash:'#/finans/kasa/new'},
 {id:'customer_fuel',group:'Kayıt',title:'Müşterinin forkliftine mazot',detail:'Depodan düş ve müşteriye TL borç yaz. Tarih, müşteri, litre ve fiyatı kontrol edip onayla; internetsiz çalışır.',text:'Müşteri adının forkliftine 20 litre mazot verildi, litresi 45 TL'},
 {id:'fuel',group:'Kayıt',title:'Yakıt kaydı',detail:'Litre, araç ve kaynağı formda seç.',hash:'#/yakit/new'},
 {id:'expense',group:'Kayıt',title:'Gider kaydı',detail:'Tutarı, kategori ve ödeme durumunu gir.',hash:'#/gider/new'},
 {id:'maintenance',group:'Kayıt',title:'Bakım / arıza bildir',detail:'İlgili araç ve açıklamayla kayıt aç.',hash:'#/bakim/new'},
 {id:'pdf',group:'Aktarım',title:'Geçmiş PDF aktarımı',detail:'İş, yakıt ve gider satırlarını oku; taslaktan devam et. İlk okuma Gemini gerektirir.',hash:'#/akilli-asistan/pdf-gecmis'},
 {id:'wa',group:'Aktarım',title:'WhatsApp grubu',detail:'Günün mesajlarını ve fotoğraflarını kontrol kartlarına hazırla.',hash:'#/whatsapp-toplu'},
 {id:'fuel_accounts',group:'Kontrol',title:'Mazot alacakları',detail:'Hak edilen, alınan ve kalan litreyi ayrı takip et.',hash:'#/mazot-hesaplari'},
 {id:'backup',group:'Kontrol',title:'Yedek ve geri yükleme',detail:'Yedekleri ayarlardan yönet; dosyaları ayrıca sakla.',hash:'#/ayarlar?tab=yedek'},
 {id:'health',group:'Kontrol',title:'Veri sağlığı',detail:'Eksik bağlantı ve yarım geri yüklemeleri incele.',hash:'#/veri-sagligi'},
];
const fold=s=>String(s||'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
export function searchAssistantTasks(query='',group=''){
 const q=fold(query).trim();return ASSISTANT_TASKS.filter(x=>(!group||x.group===group)&&fold(x.title+' '+x.detail+' '+(x.text||'')).includes(q));
}
export function guideHTML(){
 return '<details class="card assistant-guide" data-assistant-guide><summary><b>Neler yapabilirim?</b><span class="muted small">İşlem rehberi ve komut örnekleri</span></summary><p class="small muted">Örnek seçmek mesajı doldurur; kendiliğinden göndermez veya kayıt değiştirmez.</p><label class="field">İşlem ara<input type="search" data-guide-search placeholder="Örn: PDF, mazot, tahsilat…" autocomplete="off"></label><div class="ultimate-periods" role="group" aria-label="İşlem grubu">'+['','Rapor','Kayıt','Aktarım','Kontrol'].map(g=>'<button class="btn sm" data-guide-group="'+g+'" aria-pressed="'+(!g)+'">'+(g||'Tümü')+'</button>').join('')+'</div><div data-guide-list></div><p class="tiny muted">Form işlemleri ve yerel özetler internetsiz çalışır. Gemini ile mesaj/fotoğraf okuma için internet, anahtar ve veri gönderme izni gerekir.</p></details>';
}
export function bindGuide(root,db){
 const guide=qs('[data-assistant-guide]',root);if(!guide)return;
 let group='';const box=qs('[data-guide-list]',guide);
 const draw=()=>{
  const rows=searchAssistantTasks(qs('[data-guide-search]',guide).value,group);
  box.innerHTML=rows.map(x=>'<button class="ultimate-task" data-guide-task="'+x.id+'"><span class="badge">'+x.group+'</span><b>'+esc(x.title)+'</b><small>'+esc(x.detail)+'</small><span>'+(x.text?'Örneği mesaja yaz':'Ekranı aç')+' ›</span></button>').join('')||'<p class="muted">Eşleşen işlem yok. Başka bir kelime deneyin.</p>';
 };
 qs('[data-guide-search]',guide).addEventListener('input',draw);
 for(const b of qsa('[data-guide-group]',guide))b.onclick=()=>{group=b.dataset.guideGroup;for(const other of qsa('[data-guide-group]',guide))other.setAttribute('aria-pressed',String(other===b));draw();};
 let busy=false;
 box.addEventListener('click',async e=>{
  const id=e.target.closest('[data-guide-task]')?.dataset.guideTask;if(!id||busy)return;
  const task=ASSISTANT_TASKS.find(x=>x.id===id),msg=qs('[data-msg]',root);if(!task||!msg)return;
  const hasFiles=!!qs('[data-thumbs] img,[data-thumbs] audio',root)||!!qs('[data-photos]',root)?.files?.length;
  busy=true;
  try{
   if(task.text){
    if(hasFiles){toast('Yerel komut için önce Ekleri temizle düğmesine basın. Dosyalar otomatik kaldırılmaz.','err');return;}
    if(msg.value.trim()&&msg.value.trim()!==task.text&&!(await confirmDialog('Mesaj örnekle değişsin mi?','Yazdığınız mesajın yerine seçilen örnek gelecek. Dosyalar korunur; henüz gönderim yapılmaz.','Örneği yaz')))return;
    if(!root.isConnected)return;msg.value=task.text;const refine=qs('[data-refine]',root);if(refine)refine.checked=false;
    msg.dispatchEvent(new Event('input',{bubbles:true}));msg.focus();msg.scrollIntoView({block:'center',behavior:'smooth'});toast('Örnek hazır. Düzenleyip Asistana Gönder’e basın.','ok');
   }else{
    if((msg.value.trim()||hasFiles)&&!(await confirmDialog('Başka ekrana geçilsin mi?','Yazılı taslak saklanır; seçili fotoğraf ve sesler bu ekrandan ayrılınca yeniden eklenebilir.','Ekranı aç')))return;
    if(!root.isConnected)return;await db.metaSet('assistant_draft',msg.value);if(root.isConnected)location.hash=task.hash;
   }
  }catch(e){toast(e.message||String(e),'err');}finally{busy=false;}
 });
 draw();
}

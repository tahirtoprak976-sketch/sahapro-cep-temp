// Executable assistant workspace catalog. It grants no new model or write authority.
import {isActive,todayStr} from './core.js';
import {routeCommand} from './command-router.js';
import {customerLabel} from './driver-customer.js';
const task=(id,group,title,detail,mode,target)=>({id,group,title,detail,mode,target});
export const HUB_GROUPS=[['all','Tümü'],['records','İş ve kayıt'],['money','Para takibi'],['field','Saha ve filo'],['documents','Belge ve rapor'],['manage','Yönetim']];
export const HUB_TASKS=[
 task('work','records','İş kaydı hazırla','Müşteri, araç, miktar ve tarihi birlikte tamamla.','draft','Yeni iş kaydı oluştur'),
 task('customer','records','Müşteri oluştur','Bağımsız müşteri veya taşeron kartı aç.','entity','customer'),
 task('site','records','Şantiye oluştur','Müşterisine bağlı şantiye hazırla.','entity','site'),
 task('vehicle','field','Araç / makine oluştur','Tür ve plakayı kontrol ederek kart aç.','entity','vehicles'),
 task('personnel','field','Personel oluştur','Ad ve iletişim kartı aç; ücret yazılmaz.','entity','personnel'),
 task('collection','money','Tahsilat hazırla','Alınan parayı ayrı kartta kontrol et.','draft','Yeni tahsilat kaydı oluştur'),
 task('expense','money','Gider hazırla','Tutar, tarih ve açıklamayı tamamla.','draft','Yeni gider kaydı oluştur'),
 task('fuel','field','Yakıt kaydı hazırla','Araç, litre ve kaynağı kontrol et.','draft','Yeni yakıt kaydı oluştur'),
 task('maintenance','field','Bakım / arıza bildir','Araç, tarih ve açıklamayla taslak hazırla.','draft','Yeni bakım kaydı oluştur'),
 task('today','manage','Bugünü özetle','Kayıtlı iş, tahsilat ve maliyeti burada gör.','query','Bugünkü durum'),
 task('week','manage','Son 7 günü özetle','Miktarları birimleriyle ayrı incele.','query','Son 7 günün özeti'),
 task('month','manage','Bu ayı özetle','Aylık kayıtları ve eksik fiyatları incele.','query','Bu ayın özeti'),
 task('priorities','manage','Bugün ne yapmalıyım?','Kayıt kaynaklı öncelikleri burada göster.','query','Bugün ne yapmalıyım?'),
 task('payments','money','Kime ödeme yapacağım?','Vadesi gelen kayıtlı borçları burada göster.','query','Kime ödeme yapacağım?'),
 task('pending','records','Eksikleri bul','Kontrol isteyen kayıtları ve sonraki adımı göster.','query','Bekleyen işler'),
 task('search','records','Kayıt bul','Müşteri, şantiye, araç, personel, iş veya belge ara.','search','all'),
 task('customers','records','Müşterilerimi bul','Ad, telefon veya ana firma üzerinden ara.','search','customers'),
 task('sites','records','Şantiyelerimi bul','Müşteri ve şantiye adlarıyla ara.','search','sites'),
 task('fleet','field','Araçlarımı bul','Araç adı, plaka veya türüyle ara.','search','vehicles'),
 task('staff','field','Personelimi bul','Ad veya telefon üzerinden ara.','search','personnel'),
 task('works','records','İş kayıtlarını bul','Tarih, müşteri, araç ve açıklamayla ara.','search','work_records'),
 task('documents','documents','Belge bul','Belge adı, numarası ve açıklamayla ara.','search','documents'),
 task('claim','money','Hakediş hazırlığını aç','Müşteri ve dönem seç; hazır / eksik işleri incele.','screen','#/hakedis/hazirlik'),
 task('cari','money','Cari hesapları aç','Müşteri bakiyesini kayıt kaynaklarıyla incele.','screen','#/cari'),
 task('bank','money','Banka hesaplarını aç','Hesap ve havale işlemlerini kendi onay ekranında yönet.','screen','#/bankalar'),
 task('tank','field','Depo tankını aç','Giriş, çıkış ve kalan litreyi incele.','screen','#/depo'),
 task('schedule','field','Saha akışını aç','Günlük işler, personel ve araçları takip et.','screen','#/saha-akisi'),
 task('compare','records','Mesajlarla karşılaştır','Günlük iş kayıtlarını mesajlarla kontrol et.','screen','#/isler/kontrol'),
 task('pdf','documents','PDF geçmişini hazırla','PDF satırlarını kontrol taslaklarına dönüştür.','screen','#/akilli-asistan/pdf-gecmis'),
 task('whatsapp','documents','WhatsApp toplu işleme','Çok satırlı mesajları kayıt taslaklarına ayır.','screen','#/whatsapp-toplu'),
 task('report','documents','Raporları aç','İş, müşteri ve dönem raporlarını hazırla.','screen','#/raporlar'),
 task('day','documents','Gün sonu metni hazırla','Kayıtlardan günlük metin hazırla; paylaşımı sen başlat.','screen','#/akilli-asistan/ozet'),
 task('backup','manage','Yedekleri yönet','Yedek almayı ve geri yüklemeyi kendi ekranında aç.','screen','#/ayarlar?tab=yedek'),
 task('health','manage','Veri sağlığını aç','Kopuk bağlantıları ve denetim sonuçlarını incele.','screen','#/veri-sagligi'),
 task('prices','money','Fiyat kurallarını yönet','Müşteri, araç, şantiye ve birim fiyatını kendi ekranında kontrol et.','screen','#/fiyat'),
 task('suppliers','money','Tedarikçileri yönet','Petrolcü ve diğer tedarikçi kartlarını aç.','screen','#/tedarikciler'),
 task('payables','money','Alış belgeleri ve borçlar','Belge, vade ve bağlı ödemeleri kontrol et.','screen','#/alislar'),
 task('supplier_payments','money','Tedarikçi ödemelerini aç','Gerçek ödemeyi açık onayla kendi defterinde kaydet.','screen','#/odemeler'),
 task('payroll','money','Ücret / avans defterini aç','Personel ödemelerini iş ve kasa tesliminden ayrı yönet.','screen','#/ucretler'),
 task('cheques','money','Çek / senet defterini aç','Vade, taraf ve durum kayıtlarını incele.','screen','#/ceksenet'),
 task('due_plans','money','Alacak vade planlarını aç','Ödeme planını tahsilattan ayrı izle.','screen','#/vadeler'),
 task('bank_transfer','money','Hesaplar arası transfer','Tutarı kendi onay ekranında kontrol edip uygula.','screen','#/banka-transfer'),
 task('service_plan','field','Bakım planlarını aç','Planlanan bakımı gerçekleşen giderden ayrı takip et.','screen','#/bakimplani'),
 task('custody','field','Zimmet teslim / iade','Personel ve teslim edilen varlığı kendi formunda onayla.','screen','#/zimmet'),
 task('stock_count','field','Tank fiziksel sayımı','Ölçümü ve kayıt farkını kendi formunda kontrol et.','screen','#/sayim'),
 task('followups','manage','Takip görevlerini aç','Telefon, ziyaret ve hatırlatma kayıtlarını takip et.','screen','#/takipler'),
 task('tasks','manage','Yarım kalan isteklere dön','Kaydedilmiş görevleri ve dosyalarını tekrar aç.','tasks','history'),
];
export const hubFold=s=>String(s??'').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/\s+/g,' ').trim();
export function hubTasks(query='',group='all'){
 const words=hubFold(query).split(' ').filter(Boolean);
 return HUB_TASKS.filter(t=>(group==='all'||t.group===group)&&words.every(w=>hubFold(t.title+' '+t.detail+' '+t.target).includes(w)));
}
export const HUB_RECORDS={customers:['Müşteri','musteriler'],sites:['Şantiye','santiyeler'],vehicles:['Araç / makine','filo'],personnel:['Personel','personel'],work_records:['İş','isler'],documents:['Belge','belgeler']};
export function hubRecordRows(data,query='',store='all'){
 const words=hubFold(query).split(' ').filter(Boolean),live=key=>(data[key]||[]).filter(isActive),find=(key,id)=>live(key).find(r=>r.id===id);
 const rows=[];
 for(const [key,[kind,route]]of Object.entries(HUB_RECORDS)){
  if(store!=='all'&&store!==key)continue;
  for(const r of live(key)){
   const owner=key==='customers'?r:r.customer_id?find('customers',r.customer_id):null,vehicle=r.vehicle_id?find('vehicles',r.vehicle_id):null;
   const title=key==='customers'?customerLabel(r,live('customers')):r.name||r.title||r.document_no||r.work_type||kind;
   const context=[r.date,r.plate,r.phone,r.type,owner?customerLabel(owner,live('customers')):'',vehicle?.name,vehicle?.plate,r.address,r.description,r.note,r.number,r.ticket_no,r.category].filter(Boolean).join(' · ');
   const aliasType={customers:'customer',sites:'site',vehicles:'vehicle',personnel:'personnel'}[key];
   const aliases=live('aliases').filter(a=>a.active!==false&&((a.target_type===aliasType&&a.target_id===r.id)||(a.target_type==='customer'&&a.target_id===owner?.id)||(a.target_type==='vehicle'&&a.target_id===vehicle?.id))).map(a=>a.alias).join(' ');
   if(words.every(w=>hubFold(title+' '+context+' '+aliases).includes(w)))rows.push({store:key,id:r.id,kind,title,context,hash:'#/'+route+'/'+encodeURIComponent(r.id),customer_id:owner?.id||null,site_id:key==='sites'?r.id:r.site_id||null});
  }
 }
 return rows;
}
export function hubAnswer(id,data,meta=[],today=todayStr()){
 const item=HUB_TASKS.find(t=>t.id===id&&t.mode==='query');if(!item)throw Error('Bu işlem yerel soru listesinde yok.');
 const result=routeCommand(item.target,data,today,{priorityMeta:meta});
 if(!result||result.kind!=='answer')throw Error('Yerel cevap hazırlanamadı; mevcut kartlar korunuyor.');
 return result;
}

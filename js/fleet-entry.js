// Navigation context, not authority to post fuel, costs or renew documents.
import {isActive,todayStr,trDate} from './core.js';
import {realDate} from './work-explorer.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function fleetEntryLinks(vehicle,today=todayStr()){
 if(!vehicle?.id||!isActive(vehicle)||vehicle.active===false||!realDate(today))return {};
 const q=new URLSearchParams({source:'fleet',vehicle_id:vehicle.id,date:today});
 return {fuel:'#/yakit/new?'+q,maintenance:'#/bakim/new?'+q,document:'#/belgeler/new?'+new URLSearchParams({owner_type:'vehicle',owner_id:vehicle.id,category:'Muayene Belgesi'}),meter:'#/sayac/new?'+new URLSearchParams({vehicle_id:vehicle.id})};
}
export function fleetEntryContext(query,vehicles,today=todayStr()){
 const vehicle=vehicles.find(v=>v.id===query.vehicle_id&&isActive(v)&&v.active!==false),date=query.date||today;
 if(!vehicle||!realDate(date))return {source:'fleet',error:!vehicle?'Araç bulunamadı veya aktif değil. Araç dosyasını yeniden açın.':'İşlem tarihi geçersiz. Araç dosyasından yeniden başlayın.',returnHash:'#/filo'};
 return {source:'fleet',values:{date,vehicle_id:vehicle.id},vehicleName:vehicle.name||vehicle.plate||vehicle.id,returnHash:'#/filo/'+encodeURIComponent(vehicle.id)};
}
export function fleetEntryContextHTML(c,preserved=false){
 if(c.error)return `<div class="notice warn" data-entry-context role="alert">${esc(c.error)}</div><a class="btn block" href="#/filo">Filoya dön</a>`;
 return `<section class="notice info" data-entry-context><div><b>Araç dosyası · ${esc(c.vehicleName)} · ${esc(trDate(c.values.date))}</b><p class="small">${preserved?'Mevcut iş taslağınız korundu; araç ve tarihi formda kontrol edin.':'Araç ve tarih forma taşındı. Seçimleri kontrol edin;'} litre, yeni sayaç, tutar ve belge bitişi tahmin edilmez. Kaydetmeden işlem yazılmaz.</p><a href="${esc(c.returnHash)}">Araç dosyasına dön</a></div></section>`;
}
export function fleetEntryReturn(c,kind,fields={}){
 if(c?.source!=='fleet'||c.error||!['fuel','maintenance'].includes(kind))return null;
 return '#/filo/'+encodeURIComponent(fields.vehicle_id||c.values.vehicle_id);
}

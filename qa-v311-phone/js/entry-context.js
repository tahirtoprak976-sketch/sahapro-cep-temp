// Only the selected business date/vehicle travel into a new form, never amounts/evidence.
import {isActive,todayStr,trDate} from './core.js';
import {realDate} from './work-explorer.js';
import {SOURCES,streamURL} from './field-stream.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function entryLink(kind,state={}){
 if(!Object.hasOwn(SOURCES,kind)||!realDate(state.date))return null;
 const q=new URLSearchParams({source:'saha',date:state.date,return_to:streamURL(state)});
 if(state.vehicle_id)q.set('vehicle_id',state.vehicle_id);
 return '#/'+SOURCES[kind][2]+'/new?'+q;
}
export function entryContext(query={},vehicles=[],today=todayStr()){
 if(query.source!=='saha')return null;
 if(!realDate(query.date))return {error:'Saha Akışı günü geçersiz. Yeni kayıt açmadan önce günü yeniden seçin.',returnHash:'#/saha-akisi'};
 let back={date:query.date,vehicle_id:query.vehicle_id||''};
 const match=/^#\/saha-akisi(?:\?([^#]*))?$/.exec(String(query.return_to||''));
 if(match){
  const q=new URLSearchParams(match[1]||'');
  back={date:realDate(q.get('date'))?q.get('date'):query.date,kind:Object.hasOwn(SOURCES,q.get('kind'))?q.get('kind'):'',vehicle_id:q.get('vehicle_id')||'',q:q.get('q')||''};
 }
 const vehicle=vehicles.find(v=>v.id===query.vehicle_id&&isActive(v)&&v.active!==false);
 return {values:{date:query.date,vehicle_id:vehicle?.id||''},vehicleName:vehicle?.name||vehicle?.plate||'',vehicleMissing:!!query.vehicle_id&&!vehicle,
  historical:query.date<today,returnState:back,returnHash:streamURL(back)};
}
export function entryContextHTML(context,preserved=false){
 if(!context)return '';
 if(context.error)return `<div class="notice warn" data-entry-context role="alert">${esc(context.error)}</div><a class="btn block" href="${esc(context.returnHash)}">Saha Akışı’na dön</a>`;
 return `<section class="notice info" data-entry-context><div><b>Saha Akışı · ${trDate(context.values.date)}${context.vehicleName?' · '+esc(context.vehicleName):''}</b><p class="small">${preserved?'Mevcut iş taslağınız veya benzer iş seçimleriniz korundu; formdaki tarih ve aracı kontrol edin.':'Saha seçimleri forma taşındı. Tarihi ve seçimleri kontrol edin.'}${context.historical?' Geçmiş tarihli kayıt giriyorsunuz.':''}${context.vehicleMissing?' Seçili araç artık aktif değil; formda yeniden araç seçin.':''}</p><p class="tiny">Kaydedilince kaydın bulunduğu gün Saha Akışı’nda açılır; arama filtresi temizlenir.</p><a href="${esc(context.returnHash)}">Saha Akışı’na dön</a></div></section>`;
}
export function entrySaveHash(context,kind,fields={}){
 if(!context||context.error||!Object.hasOwn(SOURCES,kind))return null;
 const date=realDate(fields.date)?fields.date:context.values.date;
 return streamURL(context.returnState,{date,kind:context.returnState.kind?kind:'',vehicle_id:context.returnState.vehicle_id?fields.vehicle_id||'':'',q:''});
}
export function entryRepeatHash(context,fields={},repeatId=null){
 if(!context||context.error)return null;
 const q=new URLSearchParams({source:'saha',date:realDate(fields.date)?fields.date:context.values.date,return_to:context.returnHash});
 if(fields.vehicle_id)q.set('vehicle_id',fields.vehicle_id);
 if(repeatId)q.set('repeat',repeatId);else q.set('copylast','1');
 return '#/isler/new?'+q;
}

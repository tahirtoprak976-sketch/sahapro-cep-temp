import {VEHICLE_TYPES,vehicleTypeInfo,canonicalVehicleType,existingVehicle,vehicleTypeKey} from './vehicle-type-core.js';
import {confirmVehicleType,vehicleTypeStamp} from './vehicle-type-db.js';
import {watchFleetDocuments} from './fleet-document-ui.js';
import {beginUndo,saveUndo} from './undo.js';
import {appbar,esc,notice,qs,qsa,fSelect,toast,confirmDialog} from './ui.js';
export const vehicleTypeURL=id=>'#/arac-turleri'+(id?'?vehicle_id='+encodeURIComponent(id):'');
export async function vehicleTypeScreen(ctx){
 const {root,db,query}=ctx,choices=new Map();let busy=false;
 root.innerHTML=appbar('Araç türlerini kontrol et','Filo · kart, belge ve fiyat için ortak tür')+notice('info','Gerçek araç türünü seçip doğrulayın. İş fiyatları aynı kalır; türe bağlı depo ve kapasite tahminleri bu seçimi kullanır.')+'<div class="field"><label>Araç ara</label><input type="search" data-type-search placeholder="Ad veya plaka" autocomplete="off"></div><div data-type-summary role="status"></div><div data-type-result role="status"></div><div data-type-list></div><p data-type-empty hidden>Bu aramada araç bulunamadı.</p>';
 const filter=()=>{const key=vehicleTypeKey(qs('[data-type-search]',root).value).replace(/ /g,'');let shown=0;for(const card of qsa('[data-type-row]',root)){card.hidden=!card.dataset.typeSearchText.includes(key);if(!card.hidden)shown++;}qs('[data-type-empty]',root).hidden=shown>0;};
 qs('[data-type-search]',root).oninput=filter;
 await watchFleetDocuments(ctx,(data,error)=>{
  if(error){qs('[data-type-summary]',root).innerHTML=notice('warn','Araçlar okunamadı; ekranı yeniden açın.');return;}
  const all=data.vehicles.filter(existingVehicle),rows=all.filter(v=>!query.vehicle_id||v.id===query.vehicle_id).sort((a,b)=>Number(vehicleTypeInfo(b).needsReview)-Number(vehicleTypeInfo(a).needsReview)||String(a.name).localeCompare(String(b.name),'tr'));
  qs('[data-type-summary]',root).innerHTML=`<p><b>${all.filter(v=>vehicleTypeInfo(v).needsReview).length} araçta kontrol gerekiyor</b> · ${all.length} araç · ${all.filter(v=>v.active===false).length} pasif</p>${query.vehicle_id?'<a class="btn" href="#/arac-turleri">Filonun tümünü göster</a>':''}`;
  qs('[data-type-list]',root).innerHTML=rows.map(v=>{
   const twins=all.filter(o=>o.id!==v.id&&((v.name&&vehicleTypeKey(o.name)===vehicleTypeKey(v.name))||(v.plate&&o.plate&&vehicleTypeKey(o.plate).replace(/ /g,'')===vehicleTypeKey(v.plate).replace(/ /g,'')))).length;
   const i=vehicleTypeInfo(v),stamp=vehicleTypeStamp(v),saved=choices.get(v.id),value=saved?.stamp===stamp?saved.value:i.kind||'';
   return `<section class="card" data-type-row="${esc(v.id)}" data-type-search-text="${esc(vehicleTypeKey([v.name,v.plate,v.brand,v.model,v.type,i.kind].filter(Boolean).join(" ")).replace(/ /g,""))}"><h3 style="overflow-wrap:anywhere">${esc(v.name)}${v.active===false?' <small class="muted">(Pasif)</small>':''}</h3>${[v.plate,v.brand,v.model].some(Boolean)?`<p class="muted">${esc([v.plate,v.brand,v.model].filter(Boolean).join(" · "))}</p>`:""}${twins?notice("warn","Aynı adlı veya plakalı başka kart var; doğru kartı kontrol edin."):""}<p>Kayıtlı tür: <b>${esc(v.type||'Belirtilmemiş')}</b></p><p data-type-status class="notice ${i.needsReview?'warn':'info'}">${esc(i.note)}${i.source==='name'?' · Öneri; henüz tür doğrulaması yapılmadı.':''}</p>${fSelect('Gerçek araç / makine türü','vehicle_kind',VEHICLE_TYPES.filter(k=>k!=='Araç/Makine'),canonicalVehicleType(value)||'',{empty:true})}<button class="btn primary block" data-type-confirm ${busy?'disabled':''}>Türü doğrula</button><a class="btn block" href="#/filo/${encodeURIComponent(v.id)}">Araç kartını aç</a></section>`;
  }).join('')||notice('info','Bu kapsamda aktif araç bulunamadı.');
  filter();
  for(const v of rows){
   const card=qsa('[data-type-row]',root).find(e=>e.dataset.typeRow===v.id),select=qs('[name=vehicle_kind]',card),button=qs('[data-type-confirm]',card),stamp=vehicleTypeStamp(v);
   select.onchange=()=>choices.set(v.id,{stamp,value:select.value});
   button.onclick=async()=>{
    if(busy||!card.isConnected||!root.isConnected)return;const type=select.value;if(!type){toast('Gerçek araç türünü seçin.','err');return;}
    busy=true;for(const b of qsa('[data-type-confirm]',root))b.disabled=true;
    try{
     if(vehicleTypeInfo({...v,type,type_review:null}).conflict&&!(await confirmDialog('Ad ve tür farklı','Kartın adı “'+v.name+'”, seçtiğiniz tür “'+type+'”. Aracın gerçek türünün bu olduğunu doğruluyor musunuz?','Türü doğrula')))return;
     if(!card.isConnected||!root.isConnected)return;
     const undo=beginUndo(db),rec=undo.track(await confirmVehicleType(v.id,type,stamp));
     let undoOk=true;try{await saveUndo(db,undo,'Araç türü doğrulaması');}catch{undoOk=false;}
     choices.delete(v.id);qs('[data-type-result]',root).innerHTML=notice(undoOk?'info':'warn',esc(v.name)+' → '+esc(rec.type)+' doğrulandı. İş fiyatları değişmedi.'+(undoOk?'':' Geri alma kaydı oluşturulamadı.'));
     toast('Araç türü doğrulandı','ok');
    }catch(e){qs('[data-type-result]',root).innerHTML=notice('warn',esc(e.message||String(e)));}
    finally{busy=false;for(const b of qsa('[data-type-confirm]',root))b.disabled=false;}
   };
  }
 });
}

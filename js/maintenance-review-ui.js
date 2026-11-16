import {esc,fmtNum} from './ui.js';
import {isActive} from './core.js';
import {meterNow} from './maint-core.js';
import {maintenanceStamp} from './maintenance-review-core.js';
const options=rows=>'<option value="">— seçin —</option>'+rows.map(([id,text])=>`<option value="${esc(id)}">${esc(text)}</option>`).join('');
export function maintenanceReviewHTML(row){return `<details data-maint-review><summary>Bakım, sayaç ve maliyet kaynağı</summary>
<div class="field"><label>Maliyet kaynağı</label><select name="cost_mode"><option value="new_expense" selected>Yeni fatura / dış servis / işçilik</option><option value="existing">Önceki alıştan malzeme kullanıldı · yeni gider yok</option><option value="tracking" >Yalnız bakım takibi · yeni gider yok</option></select></div>
<div class="field"><label>Mevcut gider / alış</label><select name="cost_source"></select></div>
<div class="formgrid2"><div class="field"><label>Belgedeki tutarın KDV durumu</label><select name="tax_basis"><option value="unknown">Bilinmiyor · net hesaplanmaz</option><option value="included">KDV dahil toplam</option><option value="excluded">KDV hariç tutar</option></select></div><div class="field"><label>KDV oranı (biliniyorsa)</label><input name="maint_kdv" type="number" min="0" max="100" step="any"></div></div>
<p class="small" data-maint-meter-info></p>
<div class="field"><label>Aynı günün kayıtlı sayaç okuması</label><select name="meter_reading_id"></select></div>
<div class="formgrid2"><div class="field"><label>Yeni sayaç okuması (opsiyonel)</label><input type="number" min="0" step="any" name="meter_value" placeholder="Fotoğraftan / makineden kontrol edin"></div><div class="field"><label>Sayaç türü</label><select name="meter_kind"><option value="hours">Çalışma saati</option><option value="km">Kilometre</option></select></div></div>
<label class="history-check"><input type="checkbox" name="meter_confirmed">Sayaç okumasını ve bakım tarihini ayrıca kontrol ettim.</label>
<div class="field"><label>Tamamlanan bakım kuralı (opsiyonel)</label><select name="service_rule_id"></select></div>
<p class="small">Toplam sayaç sıfırlanmaz. Yalnız seçilen bakımın başlangıcı güncellenir. Önceki malzemeye tekrar bedel yazılmaz; yeni işçilik varsa ayrı bakım kartında yalnız işçilik tutarını girin.</p></details>`;}
const draftCache=new WeakMap();
export function bindMaintenanceReview(root,d,context=null){
 const scope=context?String(context.message||'').split('\n[DÜZELTME]')[0]:null;
 let cache=draftCache.get(root);if(!cache||cache.scope!==scope){cache={scope,rows:new Map()};draftCache.set(root,cache);}
 for(const c of root.querySelectorAll('[data-kind="maintenance"]')){
  const original=context?.rows?.[Number(c.dataset.i)],cacheKey=String(original?.source_quote||original?.description||'')+'|'+c.dataset.i;
  const q=n=>c.querySelector(`[name="${n}"]`)||(n==='vehicle'?c.querySelector('[name="vehicle_id"]'):n==='maint_kdv'?c.querySelector('[name="kdv_rate"]'):null),cost=q('cost');let remembered=cost.value;
  const mode=()=>{const fresh=q('cost_mode').value==='new_expense';if(!fresh&&cost.value!==''){remembered=cost.value;cost.value='';}cost.disabled=!fresh;q('cost_source').disabled=q('cost_mode').value!=='existing';q('tax_basis').disabled=q('maint_kdv').disabled=!fresh;};
  let lastVehicle=null;
  const refresh=()=>{
   const priorRule=q('service_rule_id').value;
   const id=q('vehicle').value,date=q('date').value,v=(d.vehicles||[]).find(r=>r.id===id),meter=v?meterNow(d,v,'hours',{today:date}):null;
   c.querySelector('[data-maint-meter-info]').textContent=meter?`Son gösterge: ${fmtNum(meter.value)} saat${meter.est?' · işlerden hesaplanan tahmin; kesin okuma değildir':' · geçmiş kayıt; yeni okumayı ayrıca kontrol edin'}.`:'Sayaç bilinmiyor; tahminle doldurulmaz.';
   q('cost_source').innerHTML=options(['expense_records','payables'].flatMap(store=>(d[store]||[]).filter(r=>isActive(r)&&r.status!=='İptal'&&r.date<=date&&(!r.vehicle_id||r.vehicle_id===id)&&!r.dump_deposit&&r.source_store!=='fuel_tank_movements').map(r=>[store+':'+r.id,`${r.date} · ${r.description||r.company||r.invoice_no||r.id}`])));
   q('meter_reading_id').innerHTML=options((d.meter_readings||[]).filter(r=>isActive(r)&&r.vehicle_id===id&&r.date===date).map(r=>[r.id,`${r.value} ${r.kind==='km'?'km':'saat'} · ${r.date}`]));
   q('service_rule_id').innerHTML=options((v?.service_rules||[]).map(r=>[r.id,r.title]));if(lastVehicle===id&&[...q('service_rule_id').options].some(o=>o.value===priorRule))q('service_rule_id').value=priorRule;lastVehicle=id;q('meter_confirmed').checked=false;q('meter_value').value='';
  };
  q('cost_mode').addEventListener('change',()=>{if(q('cost_mode').value==='new_expense')cost.value=remembered;mode();});
  for(const n of ['vehicle','date'])q(n).addEventListener('change',refresh);
  refresh();
  const old=context?cache.rows.get(cacheKey):null;
  if(old&&old.vehicle===q('vehicle').value&&old.date===q('date').value){
   for(const [n,value]of Object.entries(old.fields)){const el=q(n);if(!el||el.type==='checkbox')continue;if(el.tagName!=='SELECT'||[...el.options].some(o=>o.value===value))el.value=value;}
   remembered=old.remembered;cost.value=old.cost;
  }
  mode();
  if(context){const remember=()=>cache.rows.set(cacheKey,{vehicle:q('vehicle').value,date:q('date').value,cost:cost.value,remembered,fields:Object.fromEntries([...c.querySelectorAll('[data-maint-review] [name]')].filter(el=>el.type!=='checkbox').map(el=>[el.name,el.value]))});for(const event of ['input','change'])c.addEventListener(event,remember);}

 }
}
export function maintenanceCardIntent(c,d,base){
 const v=n=>(c.querySelector(`[name="${n}"]`)||(n==='maint_kdv'?c.querySelector('[name="kdv_rate"]'):null))?.value||'',checked=n=>!!c.querySelector(`[name="${n}"]`)?.checked;
 const source=v('cost_source'),at=source.indexOf(':'),store=source.slice(0,at),id=source.slice(at+1),mode=v('cost_mode');
 return {...base,cost:v('cost'),cost_mode:mode,tax_basis:v('tax_basis')||'unknown',kdv_rate:v('maint_kdv'),cost_source_store:mode==='existing'?store:null,cost_source_id:mode==='existing'?id:null,source_stamp:mode==='existing'?maintenanceStamp((d[store]||[]).find(r=>r.id===id)):null,vehicle_stamp:maintenanceStamp((d.vehicles||[]).find(r=>r.id===base.vehicle_id)),meter_reading_id:v('meter_reading_id')||null,meter_stamp:maintenanceStamp((d.meter_readings||[]).find(r=>r.id===v('meter_reading_id'))),meter_value:v('meter_value'),meter_kind:v('meter_kind'),meter_confirmed:checked('meter_confirmed'),service_rule_id:v('service_rule_id')||null};
}

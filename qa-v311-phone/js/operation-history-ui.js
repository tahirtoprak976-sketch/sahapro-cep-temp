import {pendingFuelBanner} from './historical-fuel-ui.js';
import {recordNoteHTML,recordSourceHTML} from './record-notes-ui.js';
import {appbar,esc,notice,segBar,searchBar,fmtNum,fmtTL,badge,statusBadge,shareOrDownload,toast} from './ui.js';
import {isActive,FUEL_SOURCES,todayStr,trDate} from './core.js';
import {realDate} from './work-explorer.js';
import {groupByDate,pageGroups} from './date-groups.js';
import {exploreOperations,operationURL,operationRoute,operationName,operationCSV} from './operation-history.js';
import {maintenanceHistory,readMaintenanceData} from './maintenance-history-core.js';
import {maintenanceSourcesHTML} from './maintenance-history-ui.js';

export async function operationHistory({root,db,query={}},kind){
 const mount=document.createElement('div');root.replaceChildren(mount);
 const fuel=kind==='fuel',title=fuel?'Yakıt Kayıtları':'Bakım / Arıza',store=fuel?'fuel_records':'maintenance_records';
 mount.innerHTML=appbar(title)+'<p role="status">Kayıtlar yükleniyor…</p>';
 let data;try{if(fuel)data=await Promise.all([db.getAll(store),db.getAll('vehicles'),db.getAll('personnel'),db.getAll('customers'),db.getAll('pending_fuel_records')]);else{const snapshot=await readMaintenanceData(db);data=[maintenanceHistory(snapshot),snapshot.vehicles,snapshot.personnel];}}
 catch{if(mount.isConnected)mount.innerHTML=appbar(title)+notice('danger','Kayıtlar okunamadı. Listeyi yeniden açın; kayıtlarınız değiştirilmedi.');return;}
 if(!mount.isConnected)return;
 const [all,vehicles,personnel,customers=[],pending=[]]=data,names={};
 for(const [k,list] of Object.entries({vehicles,personnel,customers}))names[k]=Object.fromEntries(list.map(r=>[r.id,r.name||r.plate||r.id]));
 const today=todayStr(),m=exploreOperations(kind,all,names,query,today),s=m.state,route=operationRoute(kind),renderHash=location.hash;
 const pendingRows=fuel?exploreOperations('fuel',pending,names,query,today).rows:[];
 const url=patch=>operationURL(kind,query,patch);
 const hiddenMaintenance=fuel||s.f==='all'?0:exploreOperations(kind,all,names,{...query,f:'all'},today).rows.length-m.rows.length;
 const selectedLabel=(list,value)=>{const r=list.find(x=>x.id===value);return r?`${r.name||r.plate||r.id}${isActive(r)?'':' (arşiv)'}`:value+' (listede yok)';};
 const opts=(list,value,label)=>`<option value="">${esc(label)}</option>`+(value&&!list.some(r=>r.id===value)?`<option selected value="${esc(value)}">${esc(selectedLabel(list,value))}</option>`:'')+list.filter(r=>isActive(r)||r.id===value).map(r=>`<option value="${esc(r.id)}" ${r.id===value?'selected':''}>${esc(selectedLabel(list,r.id))}</option>`).join('');
 const scope=s.from||s.to?`${s.from?trDate(s.from):'Başlangıçtan'} – ${s.to?trDate(s.to):'Tüm tarihlere'}`:'Tüm tarihler';
 const metric=(value,label)=>`<div><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;
 const chips=[['vehicle_id','Araç',vehicles],['personnel_id','Personel',personnel]].filter(([key])=>s[key]);
 const sources=[...new Set([...FUEL_SOURCES,...all.filter(isActive).map(r=>r.fuel_source),s.source].filter(Boolean))];
 mount.innerHTML=appbar(title,`${m.rows.length} kayıt${fuel?' · '+fmtNum(m.liters)+' L':''}`)+`
 <section class="card operation-summary" data-operation-summary ${fuel?'':'data-maintenance-summary'}><div class="row between"><b>Seçili kayıtların özeti</b><span class="small muted">${esc(scope)}</span></div>
 ${s.error?`<div role="alert">${notice('danger',s.error)}</div>`:`<div class="work-explorer-metrics">${metric(m.rows.length,'kayıt')}${metric(m.days,'farklı gün')}${fuel?metric(fmtNum(m.liters)+' L','verilen yakıt'):metric(fmtTL(m.cost)+' ₺','kayıtlı maliyet')}</div>
 ${fuel?`<div class="operation-source-summary">${m.sources.map(x=>`<span class="badge">${esc(x.source)} · ${fmtNum(x.liters)} L</span>`).join('')}</div><details class="operation-explanation"><summary>Bu özet neyi gösterir?</summary><p class="small muted">Litre, araca verilen yakıttır; ölçülmüş tüketim değildir. Müşterinin verdiği mazot burada ayrı görünür; müşteri hakedişine otomatik para yazılmaz.</p></details>${m.invalidLiters?notice('warn',m.invalidLiters+' kaydın litre bilgisi geçersiz; litre toplamına alınmadı.'):''}`:`<p class="small muted">${m.priced} kaydın maliyeti girilmiş · ${m.unpriced} kaydın maliyeti belirtilmemiş. 0 ₺ açıkça girildiyse belirtilmiş sayılır. Bu toplam ödeme veya kasa çıkışı değildir.</p>`}
 ${m.undated?notice('warn',m.undated+' kaydın tarihi eksik veya geçersiz; listenin sonunda gösterilir. Tarih filtresinde bu kayıtlar görünmez.'):''}`}</section>
 ${fuel?pendingFuelBanner({pending_fuel_records:pendingRows}):''}
 ${segBar([{v:'all',t:'Tüm tarihler'},{v:'today',t:'Bugün'},{v:'week',t:'Son 7 gün'},{v:'month',t:'Bu ay'}],query.from||query.to?'custom':s.period,p=>url({period:p,from:null,to:null}))}
 ${fuel?'':segBar([{v:'all',t:'Tümü'},{v:'open',t:'Açık'},{v:'done',t:'Tamamlanan'}],s.f,f=>url({f}))}
 ${fuel?'':`<p class="small muted" data-maintenance-policy>Bakım, esnaf / alış ve bakım kategorili giderler birlikte gösterilir. Bağlı maliyet bir kez sayılır. Alış veya ödeme belgesi, işin tamamlandığı anlamına gelmez.</p>${hiddenMaintenance>0?`<a class="btn block" data-maintenance-hidden href="${esc(url({f:'all'}))}">Durum filtresinin gizlediği ${hiddenMaintenance} kaydı da göster</a>`:''}`}
 ${searchBar(fuel?'Araç, personel, kaynak, müşteri, açıklama…':'Araç, personel, arıza, parça, servis…',s.q)}
 ${chips.length||s.source||query.from||query.to?`<div class="work-explorer-checks" aria-label="Etkin filtreler">${chips.map(([key,label,list])=>`<a class="btn sm" data-history-link href="${esc(url({[key]:null}))}">${label}: ${esc(selectedLabel(list,s[key]))} ×</a>`).join('')}${s.source?`<a class="btn sm" data-history-link href="${esc(url({source:null}))}">${esc(s.source)} ×</a>`:''}${query.from||query.to?`<a class="btn sm" data-history-link href="${esc(url({from:null,to:null,period:'all'}))}">Özel tarih ×</a>`:''}</div>`:''}
 <details class="card" data-operation-filters ${s.error?'open':''}><summary>Filtreler ve CSV · tarih, araç, personel${fuel?', kaynak':''}</summary><div class="formgrid2" style="margin-top:12px">
 <div class="field"><label>Başlangıç<input type="date" data-ofilter="from" value="${esc(s.from)}"></label></div><div class="field"><label>Bitiş<input type="date" data-ofilter="to" value="${esc(s.to)}"></label></div>
 <div class="field"><label>Araç / makine<select data-ofilter="vehicle_id">${opts(vehicles,s.vehicle_id,'Tüm araçlar')}</select></label></div><div class="field"><label>Personel<select data-ofilter="personnel_id">${opts(personnel,s.personnel_id,'Tüm personel')}</select></label></div>
 ${fuel?`<div class="field"><label>Yakıtın kaynağı<select data-ofilter="source"><option value="">Tüm kaynaklar</option>${sources.map(x=>`<option value="${esc(x)}" ${s.source===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label></div>`:''}</div>
 <div class="field-actions"><button class="btn primary" data-operation-apply>Filtreleri uygula</button><a class="btn" data-history-clear href="#/${route}${fuel?'':'?f=all'}">Tümünü temizle</a></div>
 <div class="field-actions">${!s.error&&m.rows.length?`<button class="btn sm" data-operation-csv>Filtreli CSV · ${m.rows.length} kayıt</button>`:''}${fuel?'':'<a class="btn sm" href="#/bakim-takvimi">Bakım Takvimi</a>'}</div></details>
 <div data-list data-operation-list></div><div class="actionbar"><a class="btn primary" href="#/${route}/new">${fuel?'+ Yakıt Kaydı':'+ Arıza / Bakım'}</a></div>`;
 const row=r=>{
  const name=(store,id)=>operationName(names,store,id),cost=r.cost!==''&&r.cost!=null&&Number.isFinite(Number(r.cost))&&Number(r.cost)>=0;
  return `<a class="li work-explorer-row" data-operation-record="${esc(r.id)}" href="${esc(r.history_href||'#/'+route+'/'+encodeURIComponent(r.id))}"><div class="work-explorer-row-head"><strong>${esc(name('vehicles',r.vehicle_id))}</strong><strong class="work-explorer-quantity">${fuel?(r.liters!==''&&r.liters!=null&&Number.isFinite(Number(r.liters))&&Number(r.liters)>=0?fmtNum(r.liters)+' L':'Litre eksik'):esc(r.maint_type||'Bakım / Arıza')}</strong></div>
  <div class="small">${esc(name('personnel',r.personnel_id))}${fuel?' · '+esc(r.fuel_source||'Kaynak belirtilmedi'):r.service_company?' · '+esc(r.service_company):''}</div>
  ${fuel&&r.fuel_source==='Müşteri Verdi'?`<div class="small">Mazotu veren: ${esc(name('customers',r.customer_id))}</div>`:''}
  ${recordNoteHTML(r,'description',names,kind,{source:false})}
  ${fuel&&r.fuel_source!=='Müşteri Verdi'?`<div class="small muted">${r.total!==''&&r.total!=null&&Number.isFinite(Number(r.total))&&Number(r.total)>=0?'Kayıtlı tutar: '+fmtTL(r.total)+' ₺':'Tutar belirtilmedi'}</div>`:''}
  ${!fuel&&r.part?`<div class="small muted">Parça: ${esc(r.part)}</div>`:''}
  <div class="work-explorer-row-tags">${fuel?(r.fuel_source==='Depo Tankı'?badge('Depodan',''):r.fuel_source==='Müşteri Verdi'?badge('Müşteri verdi','info'):'')+(r.receipt==='Hayır'?badge('Fişsiz','warn'):''):(r.history_unknown_status?badge('İş durumu belirtilmemiş','warn'):statusBadge(r.status||'Açık'))+(r.severity?badge(r.severity,r.severity==='Kritik'?'danger':''):'')+(cost?badge(fmtTL(r.cost)+' ₺ kayıtlı maliyet',''):badge('Maliyet belirtilmedi','warn'))}${fuel&&r.pump_no?`<span class="tiny">Pompa: ${esc(r.pump_no)}</span>`:''}${fuel&&r.km!=null?`<span class="tiny">${fmtNum(r.km)} km</span>`:''}${fuel&&r.machine_hours!=null?`<span class="tiny">${fmtNum(r.machine_hours)} sa</span>`:''}</div></a>${fuel?'':maintenanceSourcesHTML(r)}${recordSourceHTML(r,'description',names,kind)}`;
 };
 const list=mount.querySelector('[data-operation-list]'),pages=pageGroups(groupByDate(m.rows,r=>realDate(r.date)?r.date:''),30);let shown=0;
 function more(){
  list.querySelector('[data-operation-more]')?.remove();
  for(const g of pages[shown]||[]){const liters=g.items.reduce((n,r)=>{const x=Number(r.liters);return n+(Number.isFinite(x)&&x>=0?x:0);},0);
   list.insertAdjacentHTML('beforeend',`<div class="section-title operation-date-group" data-operation-date="${esc(g.key)}"><span>${esc(g.key?g.label:'Tarih eksik / geçersiz')}</span><span class="small muted">${g.items.length} kayıt${fuel?' · '+fmtNum(liters)+' L':''}</span></div>`+g.items.map(row).join(''));
  }shown++;
  if(shown<pages.length)list.insertAdjacentHTML('beforeend','<button class="btn block" data-operation-more>Daha eski tarihler</button>');
 }
 if(m.rows.length)more();else list.innerHTML=notice('info',s.error?'Tarih filtresini düzeltin.':'Bu filtrelere uyan kayıt yok. Filtreleri temizleyebilir veya yeni kayıt ekleyebilirsiniz.');
 list.addEventListener('click',e=>{if(e.target.closest('[data-operation-more]'))more();});
 let timer;const search=mount.querySelector('[data-search]');
 search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{if(mount.isConnected&&location.hash===renderHash)location.hash=url({q:search.value});},450);});
 mount.querySelector('[data-operation-apply]').onclick=()=>{clearTimeout(timer);const patch=Object.fromEntries([...mount.querySelectorAll('[data-ofilter]')].map(el=>[el.dataset.ofilter,el.value]));location.hash=url({...patch,q:search.value,period:'all'});};
 for(const button of mount.querySelectorAll('button[data-go]'))button.addEventListener('click',()=>{clearTimeout(timer);const patch=Object.fromEntries(new URLSearchParams(button.dataset.go.split('?')[1]||''));button.dataset.go=operationURL(kind,patch,{q:search.value});});
 for(const link of mount.querySelectorAll('[data-history-link]'))link.addEventListener('click',()=>{clearTimeout(timer);const patch=Object.fromEntries(new URLSearchParams(link.hash.split('?')[1]||''));link.href=operationURL(kind,patch,{q:search.value});});
 mount.querySelector('[data-history-clear]').onclick=()=>clearTimeout(timer);
 mount.querySelector('[data-operation-csv]')?.addEventListener('click',async e=>{
  const button=e.currentTarget;button.disabled=true;
  try{await shareOrDownload(new Blob([operationCSV(kind,m.rows,names)],{type:'text/csv;charset=utf-8'}),`SAHAPRO_${fuel?'Yakit':'Bakim'}_${today}_${m.rows.length}.csv`,`${m.rows.length} filtreli kayıt`);}
  catch(error){if(error.name!=='AbortError')toast('CSV hazırlanamadı: '+(error.message||error),'err');}finally{button.disabled=false;}
 });
}

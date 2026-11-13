import {workReviewContext} from './collect-core.js';
import {qs,qsa,esc,appbar,fmtTL,fmtNum,trDate,todayStr,notice} from './ui.js';
import {businessOverview,OVERVIEW_PERIODS,workPriceState} from './business-overview.js';
const unitText=units=>Object.entries(units).map(([u,q])=>fmtNum(q)+' '+u).join(' · ')||'Miktar yok';
const priceLabels={missing:'Fiyat eksik',fuel:'Mazot karşılığı',included:'Sözleşmeye dahil',internal:'İç iş',locked:'Fiyat kilitli',billed:'Hakedişe dahil'};
export async function screen(ctx){
 const {root,db,query}=ctx;
 let today=todayStr(),data={},meta=[],model=null,busy=false,loaded=false,shown=30;
 const state={period:OVERVIEW_PERIODS.some(x=>x[0]===query.period)?query.period:'month',from:query.from||today.slice(0,8)+'01',to:query.to||today,metric:['works','cash','cost'].includes(query.metric)?query.metric:'works',source:['works','cash','cost','missing','value'].includes(query.source)?query.source:'works',bucket:null,customer:null,vehicle:null};
 const title={works:'İş kayıtları',cash:'Tahsilat kayıtları',cost:'Maliyet kaynakları',missing:'Fiyatı eksik işler',value:'Fiyatlı işler'};
 const nm=(s,id)=>data[s]?.find(x=>x.id===id)?.name||data[s]?.find(x=>x.id===id)?.plate||'—';
 const header=()=>appbar('İşletme Panosu','Rakamdan kaynağa · bu cihazdaki kayıtlar')+`<section class="ultimate-intro"><span class="ultimate-eyebrow">SAHAPRO · İŞLETMENİ GÖR</span><h2>Durumu gör. Kaydı aç.</h2><p>Dönemi seçin; grafik veya özet kartına dokunup rakamın hangi kayıtlardan geldiğini görün.</p><div class="ultimate-periods" role="group" aria-label="Pano dönemi">${OVERVIEW_PERIODS.map(([k,l])=>`<button class="btn sm ${state.period===k?'primary':''}" data-overview-period="${k}" aria-pressed="${state.period===k}" ${loaded?'':'disabled'}>${l}</button>`).join('')}</div>${state.period==='custom'?`<div class="ultimate-range"><label class="field">Başlangıç<input type="date" data-overview-from value="${esc(state.from)}" max="${today}"></label><label class="field">Bitiş<input type="date" data-overview-to value="${esc(state.to)}" max="${today}"></label></div><button class="btn block" data-overview-apply ${loaded?'':'disabled'}>Tarihleri uygula</button>`:''}</section>`;
 function url(){
  const q=new URLSearchParams({period:state.period,metric:state.metric,source:state.source});
  if(state.period==='custom'){q.set('from',state.from);q.set('to',state.to);}
  history.replaceState(null,'','#/isletme-panosu?'+q);
 }
 function inspect(){
  if(!model)return;
  const priceContext=workReviewContext(data);
  let rows=state.source==='cash'?model.cash:state.source==='cost'?model.costs:state.source==='missing'?model.missing:state.source==='value'?model.priced:model.works;
  if(state.bucket)rows=rows.filter(x=>x.date>=state.bucket.from&&x.date<=state.bucket.to);
  if(state.customer)rows=rows.filter(x=>x.customer_id===state.customer);
  if(state.vehicle)rows=rows.filter(x=>x.vehicle_id===state.vehicle);
  rows=[...rows].sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(a.id).localeCompare(String(b.id)));
  const box=qs('[data-overview-inspector]',root);if(!box)return;
  const filters=[state.bucket?trDate(state.bucket.from)+' → '+trDate(state.bucket.to):null,state.customer?nm('customers',state.customer):null,state.vehicle?nm('vehicles',state.vehicle):null].filter(Boolean);
  box.innerHTML=`<div class="row between"><h3>${title[state.source]} <span class="muted small">(${rows.length})</span></h3>${filters.length?'<button class="btn sm" data-overview-clear>Filtreyi temizle</button>':''}</div><p class="small muted">${filters.map(esc).join(' · ')||'Seçilen dönemdeki kayıtlar'}</p>`+rows.slice(0,shown).map(r=>{
   const isCost=state.source==='cost',isCash=state.source==='cash';
   let label,sub,amount,href;
   if(isCost){label=r.label;sub=r.sub;amount=fmtTL(r.amount)+' ₺';href=r.href||'#/gider/'+encodeURIComponent(r.id);}
   else if(isCash){label=nm('customers',r.customer_id);sub=r.payment_method||'Tahsilat';amount=fmtTL(r.amount)+' ₺';href='#/kasa/'+encodeURIComponent(r.id);}
   else{label=nm('customers',r.customer_id)+' · '+(r.work_type||'İş');sub=nm('vehicles',r.vehicle_id)+' · '+fmtNum(r.quantity)+' '+(r.unit||'');const p=model.priced.includes(r);amount=p?fmtTL(r.price_snapshot?.amount??Number(r.price_snapshot?.unit_price)*Number(r.quantity))+' ₺':priceLabels[workPriceState(r,data,priceContext)];href='#/isler/'+encodeURIComponent(r.id);}
   return `<button class="ultimate-source" data-go="${esc(href)}"><span><b>${esc(label)}</b><small>${trDate(r.date)} · ${esc(sub||'')}</small></span><strong>${esc(amount)}</strong></button>`;
  }).join('')+(!rows.length?'<p class="muted">Bu seçimde kayıt yok.</p>':'')+(rows.length>shown?`<button class="btn block" data-overview-more>Daha fazla göster (${rows.length-shown})</button>`:'');
 }
 function chart(){
  const labels={works:['İş sayısı','iş'],cash:['Tahsilat','₺'],cost:['Maliyet','₺']},[label,unit]=labels[state.metric];
  const max=Math.max(1,...model.timeline.map(b=>b[state.metric]));
  return `<section class="card ultimate-chart"><div class="row between"><h3>Dönemin akışı</h3><span class="badge">${unit}</span></div><div class="ultimate-periods" role="group" aria-label="Grafik türü">${Object.entries(labels).map(([k,v])=>`<button class="btn sm ${k===state.metric?'primary':''}" data-overview-metric="${k}" aria-pressed="${k===state.metric}">${v[0]}</button>`).join('')}</div><p class="small muted">${label} · çubuğa dokunun, altındaki kaynakları görün.</p><div class="ultimate-chart-scroll"><div class="ultimate-bars" style="grid-template-columns:repeat(${model.timeline.length},minmax(32px,1fr));min-width:${model.timeline.length*32}px">${model.timeline.map((b,i)=>`<button data-overview-bar="${i}" aria-label="${esc(trDate(b.from)+' → '+trDate(b.to)+': '+fmtNum(b[state.metric])+' '+unit)}" title="${esc(fmtNum(b[state.metric])+' '+unit)}"><span class="ultimate-bar-space"><span class="ultimate-bar ${state.metric}" style="height:${Math.round(b[state.metric]/max*100)}%;min-height:${b[state.metric]?3:0}px"></span></span><small>${esc(b.label)}</small></button>`).join('')}</div></div></section>`;
 }
 function draw(){
  if(!root.isConnected||!loaded)return;
  try{model=businessOverview(data,{today,period:state.period,from:state.from,to:state.to,meta});}
  catch(e){model=null;root.innerHTML=header()+notice('warn',e.message);return;}
  const r=model.range,t=model.totals;
  const tile=(key,label,value,hint)=>`<button class="ultimate-metric ${state.source===key?'selected':''}" data-overview-source="${key}"><span>${label}</span><strong>${value}</strong><small>${hint}</small></button>`;
  root.innerHTML=header()+`<div class="row between ultimate-stamp"><span>${trDate(r.from)} → ${trDate(r.to)}</span><button class="btn sm" data-overview-refresh ${busy?'disabled':''}>Yenile</button></div><div class="ultimate-metrics">
   ${tile('works','Yapılan işler',fmtNum(t.works),model.comparison.count?'Önceki eşit dönemde '+model.comparison.count+' iş':'Önceki eşit dönemde kayıt yok')}
   ${tile('value','Fiyatlı iş değeri',fmtTL(t.value)+' ₺',model.missing.length+' işin fiyatı eksik')}
   ${tile('cash','Tahsilat',fmtTL(t.cash)+' ₺','Müşteriden alınan para')}
   ${tile('cost','Kayıtlı maliyet',fmtTL(t.cost)+' ₺','Gider, yakıt, bakım ve diğerleri')}
  </div><p class="tiny muted">İş değeri kayıtlardaki tutardır; KDV esasları farklı olabilir. Tahsilatla aynı şey değildir. Bu özet kâr veya cari bakiye değildir.</p>
  <div>${model.missing.length?`<button class="btn block" data-overview-source="missing">Fiyatı eksik ${model.missing.length} işi aç</button>`:""}</div>
  <section class="ultimate-unit-strip" aria-label="Ayrı iş birimleri">${Object.entries(model.units).map(([u,n])=>`<span><strong>${fmtNum(n)}</strong> ${esc(u)}</span>`).join('')||'<span>Bu dönemde iş miktarı yok.</span>'}<span><strong>${fmtNum(t.liters)}</strong> L yakıt kaydı</span></section>
  ${model.pendingFuel.count?notice("warn",model.pendingFuel.warning):""}
  ${chart()}
  <section class="card ultimate-inspector" data-overview-inspector aria-live="polite"></section>
  <section class="card"><div class="row between"><h3>Kontrol listesi</h3><span class="badge">Tüm kayıtlar</span></div><p class="tiny muted">Dönem seçimine bağlı değildir. İnceleme adayları otomatik düzeltilmez.</p>${model.attention.length?model.attention.map(a=>`<button class="ultimate-attention" data-go="${esc(a.hash)}"><strong>${esc(a.title)} ›</strong><small>${esc(a.why)}</small><span>${esc(a.next)}</span></button>`).join(''):'<p class="muted">Mevcut denetimlerde kontrol maddesi bulunmadı.</p>'}</section>
  <div class="ultimate-rank-grid">${[['customers','Müşterilere göre işler'],['vehicles','Araçlara göre işler']].map(([key,label])=>`<section class="card"><h3>${label}</h3><p class="tiny muted">Seçilen dönem · iş sayısına göre ilk 6</p>${model[key].slice(0,6).map(x=>`<button class="ultimate-rank" data-overview-${key==='customers'?'customer':'vehicle'}="${esc(x.id)}"><b>${esc(x.name)}</b><span>${x.count} iş · ${esc(unitText(x.units))}</span></button>`).join('')||'<p class="muted">Bu dönemde kayıt yok.</p>'}</section>`).join('')}</div>
  <section class="card"><div class="row between"><h3>Mazot alacağı</h3><span class="badge">Tüm zamanlar · L</span></div><p class="tiny muted">TL hesabından ayrıdır; dönem seçimi bu bakiyeleri değiştirmez.</p>${model.fuelAccounts.map(f=>`<button class="ultimate-source" data-go="#/musteriler/${esc(encodeURIComponent(f.id))}"><span><b>${esc(f.name)}</b><small>Hak edilen ${fmtNum(f.earned)} L · Alınan ${fmtNum(f.received)} L</small></span><strong>${f.balance>=0?'Kalan ':'Fazla '}${fmtNum(Math.abs(f.balance))} L</strong></button>`).join('')||'<p class="muted">Kayıtlı mazot hareketi yok.</p>'}</section>
  <section class="ultimate-footer"><button class="btn primary block" data-go="#/akilli-asistan">Asistana sor / işlem yap</button><button class="btn block" data-go="#/akilli-asistan/pdf-gecmis">Geçmiş PDF aktarımına devam et</button><p class="tiny muted">Bu ekran kayıt değiştirmez. Yenile ile bu cihazdaki son kayıtları okuyabilirsiniz.</p></section>`;
  inspect();url();
 }
 async function load(){
  if(busy)return;busy=true;
  for(const b of qsa('[data-overview-refresh],[data-overview-period],[data-overview-apply]',root))b.disabled=true;
  try{const result=await Promise.all([db.dumpAll(),db.getAll('meta')]);if(!root.isConnected)return;[data,meta]=result;today=todayStr();loaded=true;busy=false;draw();}
  catch(e){loaded=false;model=null;if(root.isConnected)root.innerHTML=header()+notice('warn','Pano okunamadı; rakamlar gösterilmedi. '+e.message)+'<button class="btn block" data-overview-refresh>Yeniden dene</button>';}
  finally{busy=false;}
 }
 root.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||busy)return;
  const d=b.dataset;
  if(d.overviewPeriod){state.period=d.overviewPeriod;state.bucket=state.customer=state.vehicle=null;shown=30;draw();}
  else if('overviewApply' in d){state.from=qs('[data-overview-from]',root).value;state.to=qs('[data-overview-to]',root).value;state.bucket=null;draw();}
  else if(d.overviewMetric){state.metric=d.overviewMetric;draw();}
  else if(d.overviewSource){state.source=d.overviewSource;state.bucket=state.customer=state.vehicle=null;shown=30;draw();}
  else if('overviewBar' in d){state.source=state.metric==='works'?'works':state.metric;state.bucket=model.timeline[Number(d.overviewBar)];state.customer=state.vehicle=null;shown=30;inspect();qs('[data-overview-inspector]',root).scrollIntoView({block:'start',behavior:'smooth'});}
  else if(d.overviewCustomer||d.overviewVehicle){state.source='works';state.bucket=null;state.customer=d.overviewCustomer||null;state.vehicle=d.overviewVehicle||null;shown=30;inspect();qs('[data-overview-inspector]',root).scrollIntoView({block:'start',behavior:'smooth'});}
  else if('overviewClear' in d){state.bucket=state.customer=state.vehicle=null;inspect();}
  else if('overviewMore' in d){shown+=30;inspect();}
  else if('overviewRefresh' in d)load();
 });
 root.innerHTML=header()+notice('info','Kayıtlar okunuyor…');await load();return true;
}

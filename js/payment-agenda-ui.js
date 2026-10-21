import {appbar,esc,notice,fmtTL,trDate,shareOrDownload,toast} from './ui.js';
import {paymentAgenda,paymentView,paymentCSV,PAYMENT_BUCKETS} from './payment-agenda.js';
export async function screen({root,db,query={}}){
 const mount=document.createElement('div');root.replaceChildren(mount);
 let plan=null,busy=false,shown=30;
 const state={q:String(query.q||''),bucket:PAYMENT_BUCKETS.some(x=>x[0]===query.bucket)?query.bucket:'all'};
 const money=n=>n==null?'Hesaplanmadı':fmtTL(n)+' ₺';
 const header=()=>appbar('Ödeme Takibi','Alış belgeleri / borçlar · bu cihazdaki kayıtlar');
 function draw(){
  if(!mount.isConnected||!plan)return;
  const view=paymentView(plan,state),t=view.totals;
  const params=new URLSearchParams();if(state.q)params.set('q',state.q);if(state.bucket!=='all')params.set('bucket',state.bucket);
  history.replaceState(null,'','#/odeme-takibi'+(params.size?'?'+params:''));
  mount.innerHTML=header()+`<section class="card payment-agenda-intro"><div class="row between"><b>${trDate(plan.today)} itibarıyla</b><button class="btn sm" data-payment-refresh>Yenile</button></div><p class="small muted">${esc(plan.note)}</p><p class="tiny muted">${plan.futureBills?plan.futureBills+' ileri tarihli belge bugünkü borç listesine alınmadı. ':''}İleri tarihli ödemeler bugünkü ödenenden ayrı tutulur.</p></section>
  <form data-payment-search class="card"><label class="field">Taraf, belge no veya açıklama<input type="search" data-payment-query value="${esc(state.q)}" placeholder="Örn: lastikçi, petrolcü, belge no…"></label><div class="field-actions"><button class="btn primary" type="submit">Ara</button><button class="btn" type="button" data-payment-clear>Temizle</button></div></form>
  <p class="small muted">${state.q?'Aramaya uyan kayıtlarda':'Tüm kayıtlı belgelerde'} vade dağılımı · karta dokunup listeyi açın.</p>
  <div class="payment-agenda-buckets">${PAYMENT_BUCKETS.map(([key,label])=>`<button class="card payment-agenda-bucket ${state.bucket===key?'selected':''}" data-payment-bucket="${key}" aria-pressed="${state.bucket===key}"><span>${esc(label)}</span><strong>${key==='review'?t[key].count+' belge':money(t[key].amount)}</strong><small>${key==='review'?'Vade toplamlarına dahil değil':t[key].count+' açık belge'}</small></button>`).join('')}</div>
  <div class="field-actions"><button class="btn sm" data-payment-bucket="all">Tüm gruplar</button>${view.rows.length?`<button class="btn sm" data-payment-csv>Filtreli CSV · ${view.rows.length} belge</button>`:''}<a class="btn sm" href="#/alislar">Alış belgeleri</a></div>
  <p class="small" data-payment-count>${view.rows.length} belge · ${state.bucket==='all'?'Tüm gruplar':PAYMENT_BUCKETS.find(x=>x[0]===state.bucket)[1]}${state.q?' · Arama: '+esc(state.q):''}</p>
  <div data-payment-list>${view.rows.slice(0,shown).map(r=>`<article class="card payment-agenda-record" data-payment-record="${esc(r.id)}"><div class="row between"><strong>${esc(r.name)}${r.archived?' (arşiv)':''}</strong><span class="badge ${r.bucket==='overdue'?'danger':r.bucket==='review'?'warn':''}">${esc(PAYMENT_BUCKETS.find(x=>x[0]===r.bucket)[1])}</span></div><p class="small">${esc(r.partyType)} · ${esc(r.document)}</p><p class="small muted">Belge: ${esc(trDate(r.date)||'Tarih belirtilmedi')} · Kayıtlı vade: ${esc(trDate(r.due)||'Belirtilmedi')}</p>${r.description?`<p class="small">${esc(r.description)}</p>`:''}<div class="payment-agenda-money"><span>Belge <b>${money(r.gross)}</b></span><span>Bağlı ödenen <b>${money(r.paid)}</b></span><span>Kalan <b>${money(r.remaining)}</b></span></div>${r.issues.map(x=>notice('warn',x)).join('')}${r.futurePayments?notice('info',r.futurePayments+' ileri tarihli ödeme var; bugünkü ödenene dahil edilmedi.'):''}${r.cheques.length?notice('warn','Aynı tarafa verilmiş '+r.cheques.length+' açık çek/senet var. Bu belgeyi kapattığı doğrulanmadı; aynı borç için tekrar ödeme yapmadan önce kontrol edin.')+r.cheques.slice(0,2).map(q=>`<a class="btn sm" href="${esc(q.hash)}">${esc(q.label)}</a>`).join(''):''}<a class="btn block" href="${esc(r.hash)}">Belge ve ödemeleri incele →</a></article>`).join('')||notice('info','Bu arama ve grupta açık belge bulunmadı. Bu, bütün işletme borçlarının kaydedilmiş olduğu anlamına gelmez.')}</div>
  ${view.rows.length>shown?'<button class="btn block" data-payment-more>Daha fazla belge</button>':''}`;
  mount.querySelector('[data-payment-search]').onsubmit=e=>{e.preventDefault();state.q=mount.querySelector('[data-payment-query]').value.trim();shown=30;draw();};
  mount.querySelector('[data-payment-clear]').onclick=()=>{state.q='';state.bucket='all';shown=30;draw();};
  mount.querySelector('[data-payment-refresh]').onclick=()=>{state.q=mount.querySelector('[data-payment-query]').value.trim();load();};
  for(const b of mount.querySelectorAll('[data-payment-bucket]'))b.onclick=()=>{state.q=mount.querySelector('[data-payment-query]').value.trim();state.bucket=b.dataset.paymentBucket;shown=30;draw();};
  mount.querySelector('[data-payment-more]')?.addEventListener('click',()=>{shown+=30;draw();});
  mount.querySelector('[data-payment-csv]')?.addEventListener('click',async e=>{
   const button=e.currentTarget;button.disabled=true;
   try{await shareOrDownload(new Blob([paymentCSV(view.rows)],{type:'text/csv;charset=utf-8'}),'SAHAPRO_Odeme_Takibi_'+plan.today+'.csv','Kayıtlı ödeme takibi');}
   catch(error){if(error.name!=='AbortError')toast('CSV hazırlanamadı: '+(error.message||error),'err');}finally{button.disabled=false;}
  });
 }
 async function load(){
  if(busy)return;busy=true;const refresh=mount.querySelector('[data-payment-refresh]');if(refresh)refresh.disabled=true;
  try{const snapshot=await db.readSnapshot({attachments:false});if(!mount.isConnected)return;plan=paymentAgenda(snapshot.data);shown=30;draw();}
  catch(error){plan=null;if(mount.isConnected){mount.innerHTML=header()+notice('warn','Ödeme kayıtları okunamadı; tutarlar gösterilmedi. '+(error.message||error))+'<button class="btn block" data-payment-retry>Yeniden dene</button>';mount.querySelector('[data-payment-retry]').onclick=load;}}
  finally{busy=false;}
 }
 mount.innerHTML=header()+'<p role="status">Ödeme kayıtları okunuyor…</p>';await load();
}

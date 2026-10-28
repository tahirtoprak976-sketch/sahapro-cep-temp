import {hakedisPreparation,preparationURL} from './hakedis-preparation.js';
import {customerLabel} from './driver-customer.js';
import {validDate} from './driver-delivery.js';
import {isActive} from './core.js';
import {appbar,qs,qsa,esc,fSelect,fDate,stat,notice,kv,fmtTL,fmtNum,trDate,pagedRender} from './ui.js';

const groups={ready:'Hazır',missing:'Eksik bilgi',review:'Kontrol gerekli',agreement:'Anlaşma kapsamı',claimed:'Hakedişe bağlı'};
const monthRange=(month,today)=>{
 if(!/^\d{4}-\d{2}$/.test(month))return null;
 const from=month+'-01',m=Number(month.slice(5));
 if(m<1||m>12||!validDate(from))return null;
 const date=new Date(from+'T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+1);date.setUTCDate(0);
 const end=date.toISOString().slice(0,10);return {from,to:end>today?today:end};
};
export async function screen(ctx){
 const {root,db}=ctx,today=new Date().toISOString().slice(0,10),initial=await db.dumpAll();
 if(!root.isConnected)return;
 const customers=(initial.customers||[]).filter(isActive),q=ctx.query||{},range=monthRange(today.slice(0,7),today);
 root.innerHTML=appbar('Hakediş hazırlığı','Müşteri + dönem · eksikleri tamamla',{back:'#/hakedis'})+`
 <div class="card" data-prep-filters style="margin-top:10px">
 ${fSelect('Müşteri','prep_customer',customers.map(c=>({v:c.id,t:customerLabel(c,customers)})),q.customer_id||'')}
 <div class="field"><label for="prep-month">Ay seç</label><input id="prep-month" name="prep_month" type="month" max="${today.slice(0,7)}" value="${validDate(q.date_from)?q.date_from.slice(0,7):today.slice(0,7)}"></div>
 <div class="formgrid2">${fDate('Başlangıç','prep_from',validDate(q.date_from)?q.date_from:range.from)}${fDate('Bitiş','prep_to',validDate(q.date_to)?q.date_to:range.to)}</div>
 <button class="btn block" data-prep-refresh>Kontrol et / yenile</button>
 <p class="tiny muted">Yalnız seçilen müşterinin uygulamaya girilmiş işleri incelenir. Ana firma ve taşeronların hesapları ayrı kalır.</p></div>
 <div data-prep-content></div>`;
 const output=qs('[data-prep-content]',root),button=qs('[data-prep-refresh]',root);let revision=0,tab='ready';
 const draw=(model,data)=>{
  const {counts:c,totals:t,fuel:f}=model;
  output.innerHTML=`<section data-preparation><div class="statgrid" style="grid-template-columns:repeat(3,minmax(0,1fr))">${stat(String(c.ready),'Hazır','ok')}${stat(String(c.missing),'Eksik bilgi','warn')}${stat(String(c.review),'Kontrol gerekli','warn')}</div>
  <div class="card" data-prep-totals><h3>Hazır işlerin TL toplamı</h3>${t?kv('Ana para',fmtTL(t.subtotal)+' ₺')+kv('KDV',fmtTL(t.kdv)+' ₺')+kv('Toplam',fmtTL(t.grand)+' ₺'):'<p class="small">Henüz hazır TL işi yok. Eksik fiyatlar 0 TL sayılmadı.</p>'}
  <p class="tiny muted">Bu tutar tahsilat veya cari bakiye değildir. İşler seçilip taslak oluşturulmadan ve ardından kesinleştirilmeden yeni borç oluşmaz.</p>
  ${c.ready?`<a class="btn primary block" data-prep-open-ready href="${esc(preparationURL('new',model.scope,{ready_only:'1'}))}">${c.ready} hazır işi hakedişte incele</a>`:''}
  <a class="btn block" href="${esc(preparationURL('new',model.scope))}" style="margin-top:8px">Tüm işleri normal hakediş formunda aç</a></div>
  ${f.hasRecords?`<div class="card" data-prep-fuel><h3>Müşterinin mazot hesabı · litre</h3>${kv('Dönem başı devir',fmtNum(f.opening)+' L')}${kv('Bu dönemde hak edilen',fmtNum(f.earned)+' L')}${kv('Bu dönemde alınan',fmtNum(f.received)+' L')}${kv('Dönem sonu fark',f.closing==null?'Hesaplanamadı':fmtNum(f.closing)+' L')}
  <p class="tiny muted">Pozitif fark mazot alacağımız, negatif fark fazla alınan / avans mazottur. TL tahsilatı değildir; teslimler belirli işe dağıtılmaz. Müşterinin tüm şantiyelerini kapsar.</p>${f.incomplete?notice('warn',`${f.invalid} mazot kaydının tarih/litresi kontrol edilmeli. Kalan litre kesin gösterilmedi.`):''}</div>`:''}
  <div class="row" style="flex-wrap:wrap;gap:6px;margin:12px 0" data-prep-tabs>${Object.entries(groups).map(([key,label])=>`<button class="chip ${tab===key?'on':''}" data-prep-tab="${key}" aria-pressed="${tab===key}">${label} (${c[key]})</button>`).join('')}</div>
  <p class="tiny muted">Hazır: kayıtlı fiyat, miktar, müşteri/araç ve gerekiyorsa sefer/fiş kontrolleri tamam. Numara kaydı fotoğrafın okuma doğruluğunu ölçmez. Eksikler otomatik düzeltilmez.</p>
  <div data-prep-list></div></section>`;
  const paintRows=()=>{
   for(const b of qsa('[data-prep-tab]',output)){b.classList.toggle('on',b.dataset.prepTab===tab);b.setAttribute('aria-pressed',String(b.dataset.prepTab===tab));}
   const rows=model[tab],list=qs('[data-prep-list]',output);
   if(!rows.length){list.innerHTML='<div class="card small">Bu bölümde kayıt yok.</div>';return;}
   pagedRender(list,rows,row=>{
    const w=row.work,vehicle=(data.vehicles||[]).find(v=>v.id===w.vehicle_id),site=(data.sites||[]).find(s=>s.id===w.site_id),reasons=[...row.issues,...row.missing];
    return `<article class="card" data-prep-row="${esc(w.id)}" style="overflow-wrap:anywhere"><div class="strong">${row.undated?'Tarih kontrolü gerekli':esc(trDate(w.date))} · ${esc(w.work_type||'İş türü eksik')}</div><p class="small">${esc(vehicle?.plate||vehicle?.name||'Araç belirsiz')} · ${fmtNum(w.quantity)} ${esc(w.unit||'')} ${site?'· '+esc(site.name):''}</p>
    ${row.undated?'<p class="small">Tarih eksik olduğu için bu kayıt seçilen aya dahil varsayılmadı.</p>':''}
    ${reasons.length?`<ul class="small">${reasons.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul>`:'<p class="small">'+esc(tab==='agreement'?(w.price_snapshot?.price_source||'İç iş')+' · TL hazırlık toplamına eklenmedi.':tab==='claimed'?'Bu iş aktif bir hakedişe bağlı; yeniden seçilmez.':'Hazırlık kontrolleri tamam.')+'</p>'}
    ${row.expectedTickets!=null?`<p class="tiny muted">${fmtNum(row.expectedTickets)} sefer · ${row.ticketCount} fiş numarası</p>`:''}
    <div class="row" style="flex-wrap:wrap;gap:6px"><a class="btn sm" href="#/isler/${encodeURIComponent(w.id)}">İşi ve belgelerini incele</a>
    ${row.claims.map(h=>`<a class="btn sm" href="#/hakedis/${encodeURIComponent(h.id)}">Hakediş #${esc(h.hakedis_no||'')} · ${esc(h.status||'')}</a>`).join('')}
    ${row.documents.map(doc=>`<a class="btn sm" href="#/belgeler/${encodeURIComponent(doc.id)}">Fiş ${esc(doc.doc_no||'numarasız')}</a>`).join('')}
    ${row.peerIds.map(id=>`<a class="btn sm" href="#/isler/${encodeURIComponent(id)}">Benzer işi incele</a>`).join('')}</div></article>`;
   });
  };
  for(const b of qsa('[data-prep-tab]',output))b.onclick=()=>{tab=b.dataset.prepTab;paintRows();};paintRows();
 };
 const load=async()=>{
  const token=++revision;button.disabled=true;output.innerHTML=notice('info','Güncel kayıtlar kontrol ediliyor…');
  const scope={customer_id:qs('[name=prep_customer]',root).value,from:qs('[name=prep_from]',root).value,to:qs('[name=prep_to]',root).value};
  try{
   const data=await db.dumpAll();if(token!==revision||!root.isConnected)return;
   const picker=qs('[name=prep_customer]',root),fresh=(data.customers||[]).filter(isActive);
   picker.innerHTML='<option value="">— seç —</option>'+fresh.map(c=>`<option value="${esc(c.id)}" ${c.id===scope.customer_id?'selected':''}>${esc(customerLabel(c,fresh))}</option>`).join('');
   const model=hakedisPreparation(data,{...scope,today});
   history.replaceState(history.state,'',preparationURL('hazirlik',scope));draw(model,data);
  }catch(e){if(token===revision&&root.isConnected)output.innerHTML=notice('warn',e.message||'Kayıtlar okunamadı; tekrar deneyin.');}
  finally{if(token===revision&&root.isConnected)button.disabled=false;}
 };
 button.onclick=load;
 for(const field of ['prep_customer','prep_from','prep_to'])qs('[name='+field+']',root).onchange=load;
 qs('[name=prep_month]',root).onchange=()=>{
  const period=monthRange(qs('[name=prep_month]',root).value,today);
  if(period){qs('[name=prep_from]',root).value=period.from;qs('[name=prep_to]',root).value=period.to;}void load();
 };
 if(q.customer_id)await load();else output.innerHTML=notice('info','Müşteri ve dönemi seçin; hazır işler ve eksikler burada görünecek.');
}

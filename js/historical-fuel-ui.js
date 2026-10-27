// Historical fuel is a separate review queue, never a factual tank movement.
import {esc,fmtNum,fmtTL,trDate,qs,sheet,sheetClose,toast,go} from './ui.js';
import {isPendingFuel,pendingFuelSummary,historicalFuelProjection} from './historical-fuel.js';

export function historicalProjectionText(projection){
 if(projection?.timeline?.invalid?.length)return 'Depo geçmişinde geçersiz hareket var; bekleyen çıkışların hesap önizlemesi doğrulanamadı. Gerçek stok ve maliyet kesinleştirilmedi.';
 const gap=projection?.firstDeficit||projection?.timeline?.firstDeficit;
 if(gap)return `${trDate(gap.date)} tarihinde, bekleyen çıkışlar da hesaba katılırsa kayıtlı geçmiş bakiye −${fmtNum(Math.abs(gap.balance))} L. Bu, eksik depo geçmişinin hesap açığıdır; fiziksel deponun eksi olduğu anlamına gelmez.`;
 return 'Bekleyen çıkışlarla birlikte kayıtlı geçmişte hesap açığı görünmüyor. Bu önizleme onay değildir; her kayıt kesinleştirilirken tarih sırası ve güncel stok yeniden doğrulanır.';
}
export function pendingFuelBanner(data,options={}){
 const summary=pendingFuelSummary(data,options);
 if(!summary.count)return '';
 return `<section class="card" data-pending-fuel-banner><b>Depo geçmişi eksik · mutabakat bekliyor</b><p class="small">${summary.count} geçmiş yakıt kaydı · ${fmtNum(summary.liters)} L ayrı bekliyor. Gerçekleşmiş yakıt listesine, depo çıkışına ve kesin maliyete dahil değildir. İlgili maliyet / kâr sonuçları eksiktir.</p><a class="btn block" href="#/depo">Bekleyen yakıtları incele</a></section>`;
}
export function pendingFuelPanel(data,names={}){
 const summary=pendingFuelSummary(data);
 if(!summary.count)return '';
 const projection=historicalFuelProjection(data);
 return `<section class="card" data-pending-fuel-panel><h3>Geçmiş yakıt · mutabakat bekliyor</h3><p class="notice warn">${summary.count} kayıt · ${fmtNum(summary.liters)} L henüz kesinleşmedi. Yukarıdaki gerçek depo hareketlerine dahil değildir; stok, kasa, borç veya kesin maliyet oluşturmaz. İlgili maliyet ve kâr sonuçları eksiktir.</p><p class="small" data-pending-fuel-projection>${esc(historicalProjectionText(projection))}</p><p class="small">Önce gerçek tarihli eksik giriş / açılış kayıtlarını tamamlayın. Sonra ilgili çıkışı yeniden hesaplayıp ayrı onayla kesinleştirin. Sonraki tarihli giriş geçmiş açığı karşılamaz.</p>${summary.rows.map(r=>`<div class="card" data-pending-fuel-record="${esc(r.id)}"><b>${esc(trDate(r.date))} · ${fmtNum(r.liters)} L</b><div class="small">${esc(names.vehicles?.[r.vehicle_id]||'Araç kaydı bulunamadı')}${r.personnel_id?' · '+esc(names.personnel?.[r.personnel_id]||'Personel kaydı bulunamadı'):''}</div><button type="button" class="btn block" data-review-pending-fuel="${esc(r.id)}">Yeniden hesapla ve incele</button></div>`).join('')}</section>`;
}

// Dependency injection keeps the approval boundary independently testable.
// Re-reading never mutates. A cancelled/dismissed or no-longer-current view cannot promote.
export async function confirmPendingReconciliation(id,{review,reconcile,confirm,isCurrent=()=>true}){
 const preview=await review(id);
 if(!isCurrent())return null;
 if(!preview.canReconcile)throw Error(preview.error||'Geçmiş depo kayıtları henüz bu çıkışı karşılamıyor.');
 const r=preview.record;
 if(!isPendingFuel(r))throw Error('Bu kayıt artık mutabakat beklemiyor; listeyi yenileyin.');
 const cost=preview.total!=null&&Number.isFinite(Number(preview.total))?`Tarihli depo girişlerinden hesaplanan maliyet ${fmtTL(preview.total)} ₺.`:'Maliyet henüz bilinmiyor; 0 ₺ veya kesin kâr sayılmaz.';
 const approved=await confirm('Geçmiş yakıt kesinleştirilsin mi?',`${trDate(r.date)} · ${fmtNum(r.liters)} L gerçek depo çıkışına bir kez eklenecek. ${cost} Kaynak, tarih, araç ve personel korunur. Yeni iş, kasa hareketi veya borç oluşturulmaz.`, 'Çıkışı kesinleştir');
 if(!approved||!isCurrent())return null;
 return reconcile(id,preview.token);
}

const reviewRequests=new WeakMap();
function pendingApprovalDialog(title,text,label){
 return new Promise(resolve=>{
  const sh=sheet(`<h3>${esc(title)}</h3><p class="small">${esc(text)}</p><div class="row"><button type="button" class="btn grow" data-pending-approval="no">Vazgeç</button><button type="button" class="btn primary grow" data-pending-approval="yes">${esc(label)}</button></div>`,{modal:true});
  let settled=false;
  const finish=value=>{if(settled)return;settled=true;window.removeEventListener('hashchange',onNavigation);if(sh.isConnected)sheetClose();resolve(value);};
  const onNavigation=()=>finish(false);window.addEventListener('hashchange',onNavigation);
  for(const button of sh.querySelectorAll('[data-pending-approval]'))button.onclick=()=>finish(button.dataset.pendingApproval==='yes');
 });
}
export async function openPendingFuelReview(ctx,id,{mayOpen=()=>true}={}){
 const {root,names={}}=ctx,hash=location.hash,request=(reviewRequests.get(root)||0)+1;reviewRequests.set(root,request);
 const isCurrent=()=>root.isConnected&&location.hash===hash&&reviewRequests.get(root)===request;
 const {reviewPendingFuel,reconcilePendingFuel}=await import('./historical-fuel-db.js');
 const review=await reviewPendingFuel(id);
 if(!isCurrent()||!mayOpen())return;
 const r=review.record;
 if(!r||!isPendingFuel(r)){toast('Bu kayıt artık mutabakat beklemiyor; listeyi yenileyin.','warn');ctx.reload?.();return;}
 const source=r.reconciliation?.source_amounts||{};
 const sourceAmount=(key,label)=>source[key]!=null&&source[key]!==''?`<p class="small">${label}: <b>${esc(String(source[key]))} ₺</b> — yalnız kaynak bilgisi, kesinleşmiş maliyet değildir.</p>`:'';
 const cost=review.total!=null&&Number.isFinite(Number(review.total))?fmtTL(review.total)+' ₺ (yalnız onay sonrası)':'Bilinmiyor; 0 ₺ değildir';
 const sh=sheet(`<section data-pending-fuel-review><h3>Geçmiş yakıtı incele</h3><p><b>${esc(trDate(r.date))} · ${fmtNum(r.liters)} L</b><br>${esc(names.vehicles?.[r.vehicle_id]||'Araç kaydı bulunamadı')}${r.personnel_id?'<br>'+esc(names.personnel?.[r.personnel_id]||'Personel kaydı bulunamadı'):''}</p><p class="notice warn">Mutabakat bekliyor. Henüz depo çıkışı, kesin maliyet veya kasa hareketi değildir.</p><p class="small" data-pending-fuel-projection>${esc(historicalProjectionText(review.projection))}</p>${r.description?`<p class="small" style="white-space:pre-wrap">${esc(r.description)}</p>`:''}${sourceAmount('total','Kaynakta yazan toplam')}${sourceAmount('unit_price','Kaynakta yazan litre fiyatı')}<p class="small">Hesaplanan maliyet: <b>${esc(cost)}</b></p>${review.canReconcile?'':`<p class="notice warn" data-pending-fuel-blocked>${esc(review.error||'Eksik geçmiş giriş / açılış kaydını kontrol edin.')}</p>`}<button type="button" class="btn block" data-pending-fuel-refresh>Yeniden hesapla</button>${review.canReconcile?'<button type="button" class="btn primary block" data-pending-fuel-confirm>Kontrol ettim · kesinleştir</button>':''}<button type="button" class="btn block" data-pending-fuel-close>Kapat · beklemede kalsın</button></section>`,{modal:true});
 let busy=false,closed=false;
 const dismiss=()=>{closed=true;window.removeEventListener('hashchange',onNavigation);if(sh.isConnected)sheetClose();};
 const onNavigation=()=>dismiss();window.addEventListener('hashchange',onNavigation,{once:true});
 qs('[data-pending-fuel-close]',sh).onclick=dismiss;
 qs('[data-pending-fuel-refresh]',sh).onclick=async()=>{
  if(busy)return;busy=true;
  try{await openPendingFuelReview(ctx,id,{mayOpen:()=>!closed&&sh.isConnected});}catch(e){toast(e.message||String(e),'err');}finally{busy=false;if(!sh.isConnected)window.removeEventListener('hashchange',onNavigation);}
 };
 qs('[data-pending-fuel-confirm]',sh)?.addEventListener('click',async event=>{
  if(busy)return;busy=true;event.currentTarget.disabled=true;
  try{
   const result=await confirmPendingReconciliation(id,{review:reviewPendingFuel,reconcile:reconcilePendingFuel,confirm:pendingApprovalDialog,isCurrent:()=>isCurrent()&&!closed});
   if(!isCurrent()||closed)return;
   if(!result){await openPendingFuelReview(ctx,id);return;}
   sheetClose();toast('Geçmiş yakıt bir kez kesinleştirildi; iş kayıtları korunuyor.','ok');go('#/yakit/'+encodeURIComponent(result.id||id));
  }catch(e){toast(e.message||String(e),'err');if(isCurrent()&&!closed)await openPendingFuelReview(ctx,id).catch(()=>{});}
  finally{busy=false;if(!sh.isConnected)window.removeEventListener('hashchange',onNavigation);if(sh.isConnected)qs('[data-pending-fuel-confirm]',sh)?.removeAttribute('disabled');}
 });
}

export function bindPendingFuelReview(ctx){
 for(const button of ctx.root.querySelectorAll('[data-review-pending-fuel]'))button.addEventListener('click',async()=>{
  if(button.disabled)return;button.disabled=true;
  try{await openPendingFuelReview(ctx,button.dataset.reviewPendingFuel);}catch(e){toast(e.message||String(e),'err');}
  finally{if(button.isConnected)button.disabled=false;}
 });
}

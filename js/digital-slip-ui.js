import {slipWorkState,slipWorkCandidates,slipToWork} from './digital-slip-core.js';
import {linkDigitalSlip} from './digital-slip-db.js';
import {isActive} from './core.js';
import {appbar,esc,notice,kv,trDate,fmtNum,fSelect,confirmDialog,toast,go} from './ui.js';

export async function linkScreen(ctx,id) {
  const {root,db}=ctx,d=await db.dumpAll(),s=d.slips.find(x=>x.id===id&&isActive(x));
  if(!s){root.innerHTML=appbar('Fiş ve İş Bağlantısı')+notice('warn','Fiş bulunamadı.');return;}
  const state=slipWorkState(d,s);
  if(state.state!=='unlinked'){
    root.innerHTML=appbar('Fiş ve İş Bağlantısı')+notice(state.state==='linked'?'ok':'warn',state.state==='linked'?'Bu fişin iş kaydı zaten var; ikinci iş oluşturulmadı.':'Bu fişin kaynak işi silinmiş veya bulunamıyor. Yeni iş açmadan Çöp Kutusunu inceleyin.')+state.works.map(w=>`<a class="btn block" href="#/isler/${esc(encodeURIComponent(w.id))}">Kaynak işi incele →</a>`).join('');return;
  }
  if(!['Taslak','İmzalandı'].includes(s.status)){root.innerHTML=appbar('Fiş ve İş Bağlantısı')+notice('warn','İptal / eski revizyon fişinden iş oluşturulmaz; güncel fişi inceleyin.');return;}
  const candidates=slipWorkCandidates(d,s),available=candidates.filter(w=>!w.slip_id);
  const options=[...available.map(w=>({v:w.id,t:`Mevcut iş · ${trDate(w.date)} · ${(d.vehicles.find(v=>v.id===w.vehicle_id)||{}).name||'Araç'} · ${fmtNum(w.quantity)} ${w.unit} · ${w.work_type}`})),{v:'new',t:'Yeni iş olarak kaydet (fiyat bekliyor)'}];
  root.innerHTML=appbar('Fişi Müşteri İşlerine Bağla',`FS-${String(s.slip_no).padStart(6,'0')}`,{back:'#/fisler/'+encodeURIComponent(id)})+`<section class="card" data-slip-work-link>
    ${kv('Müşteri',(d.customers.find(x=>x.id===s.customer_id)||{}).name||'—')}${kv('Tarih',trDate(s.date))}${kv('Yapılan iş',s.work_text)}${kv('Miktar',fmtNum(s.quantity)+' '+s.unit)}
    ${notice('info','Fiş ve imzası korunur. Yeni işte fiyat tahmin edilmez; müşteri işler listesine fiyatsız eklenir. Mevcut işe bağlarsanız fiyatı ve miktarı değiştirilmez.')}
    ${fSelect('İş kaydı','work_id',options,available[0]?.id||'new',{empty:false})}
    ${fSelect('Yeni iş için araç / makine','vehicle_id',d.vehicles.filter(isActive).map(v=>({v:v.id,t:v.name})),s.vehicle_id||'',{req:true})}
    ${candidates.some(w=>w.slip_id)?notice('warn','Benzer kayıtlı işlerden bazıları zaten başka fişe bağlı. Yeni iş açmadan ilgili fişi kontrol edin.'):''}
    <button class="btn primary block" data-link-slip-work>Onayla ve müşteri işlerine bağla</button><div data-link-status role="status"></div></section>`;
  const select=root.querySelector('[name=work_id]'),vehicle=root.querySelector('[name=vehicle_id]'),button=root.querySelector('[data-link-slip-work]');
  const update=()=>{vehicle.disabled=select.value!=='new'||!!s.vehicle_id;};select.onchange=update;update();
  let busy=false;
  button.onclick=async()=>{
    if(busy)return;busy=true;button.disabled=true;
    try{
      const mode=select.value==='new'?'new':'existing',vehicle_id=s.vehicle_id||vehicle.value;
      if(mode==='new')slipToWork(s,{vehicle_id});
      const separate=mode==='new'&&candidates.length>0;
      if(!(await confirmDialog(separate?'Bu ayrı bir iş mi?':'Fiş işlere bağlansın mı?',separate?'Benzer iş zaten var. Ayrı iş olduğunu onaylarsanız ikinci iş kaydı oluşturulur.':'İşlem bir kez uygulanır. Mevcut imza ve müşteri fişi değişmez.',mode==='new'?'İşi oluştur ve bağla':'Mevcut işe bağla')))return;
      const result=await linkDigitalSlip(id,{mode,work_id:mode==='existing'?select.value:null,vehicle_id,allow_separate:separate},s);
      toast(result._existing?'Bu fiş zaten iş kaydına bağlı.':'Fiş müşteri işlerine bağlandı.','ok');go('#/isler/'+encodeURIComponent(result.works[0].id));
    }catch(e){root.querySelector('[data-link-status]').textContent=e.message;toast(e.message,'err');}
    finally{busy=false;button.disabled=false;}
  };
}

import {transaction} from './enterprise-db.js';
import {newRecord,isActive,nowISO,stableStringify} from './core.js';
import {assertSlipService,slipWorkState,slipToWork,compatibleSlipWork,assertSlipExpected,slipWorkCandidates} from './digital-slip-core.js';

const stores=['slips','work_records','customers','sites','vehicles','personnel','meta','hakedis','payables','dump_entries','cash_records','cari_movements','cost_allocations'];
const contentFields=['date','customer_id','site_id','vehicle_id','personnel_id','plate','work_text','quantity','unit','description','receiver_name'];
const stamp=r=>new Date(Math.max(Date.now(),(Date.parse(r.updated_at)||0)+1)).toISOString();
function context(d,w) {
  for(const [field,store] of [['customer_id','customers'],['vehicle_id','vehicles'],['personnel_id','personnel']])
    if((field!=='personnel_id'||w[field])&&!d[store].some(x=>x.id===w[field]&&isActive(x)))throw Error('İşin müşteri, araç veya personel kartı değişmiş; yeniden seçin.');
  if(w.site_id&&!d.sites.some(x=>x.id===w.site_id&&isActive(x)&&x.customer_id===w.customer_id))throw Error('Şantiye müşteriye ait değil.');
}
function connect(d,t,s,{mode,work_id,vehicle_id,allow_separate=false},expected) {
  assertSlipService(s);if(expected)assertSlipExpected(s,expected);
  const state=slipWorkState(d,s);
  if(state.state==='missing')throw Error('Bu fişin bağlı işi silinmiş veya bulunamıyor; ikinci iş açmak yerine kaynak işi Çöp Kutusunda inceleyin.');
  if(state.state==='linked'){
    if(mode==='existing'&&!state.ids.includes(work_id)||mode==='new'&&vehicle_id&&state.works.length===1&&state.works[0].vehicle_id!==vehicle_id)throw Error('Fiş başka bir işe bağlanmış; ikinci iş oluşturulmadı.');
    return {slip:s,works:state.works,_existing:true};
  }
  if(!['new','existing'].includes(mode))throw Error('Yeni iş veya mevcut iş seçin.');
  if(mode==='new'&&!allow_separate&&slipWorkCandidates(d,{...s,vehicle_id:s.vehicle_id||vehicle_id}).length)
    throw Error('Aynı müşteri / tarih / araç / miktarla iş var. İkinci iş açılmadı; mevcut işi seçin veya ayrı iş olduğunu açıkça onaylayın.');
  const w=mode==='new'?newRecord({...slipToWork(s,{vehicle_id}),slip_id:s.id,digital_slip_source_id:state.root}):d.work_records.find(x=>x.id===work_id);
  if(!compatibleSlipWork(s,w))throw Error('Mevcut işin müşterisi, tarihi, aracı, şantiyesi veya miktarı fişle uyuşmuyor.');
  context(d,w);
  if(mode==='existing'&&w.slip_id&&!state.family.some(x=>x.id===w.slip_id))throw Error('Seçilen iş başka bir dijital fişe bağlı; yeni iş açmadan o fişi inceleyin.');
  const work=mode==='new'?w:{...w,slip_id:s.id,updated_at:stamp(w)};
  if(mode==='new')t.add('work_records',work);else t.put('work_records',work);
  const linked={...s,work_record_id:work.id,work_record_ids:[work.id],work_linked_at:nowISO(),work_link_mode:mode,updated_at:stamp(s)};
  // Only linkage metadata changes. Signed customer content/signature stay frozen.
  for(const member of state.family)t.put('slips',member.id===s.id?linked:{...member,work_record_id:work.id,work_record_ids:[work.id],work_linked_at:linked.work_linked_at,work_link_mode:mode,updated_at:stamp(member)});
  return {slip:linked,works:[work],created_work:mode==='new'};
}
export async function linkDigitalSlip(slip_id,intent,expected) {
  if(!expected)throw Error('Önce fişi inceleyip bağlantıyı onaylayın.');
  return transaction(stores,(d,t)=>{
    const s=d.slips.find(x=>x.id===slip_id);if(!s)throw Error('Fiş bulunamadı.');
    return connect(d,t,s,intent,expected);
  });
}
export async function createDigitalSlip(fields,{key,mode='new',work_id=null,allow_separate=false}={}) {
  if(typeof key!=='string'||!key||key.length>160)throw Error('Fiş işlem kimliği gerekli.');
  const signature=stableStringify({fields,mode,work_id,allow_separate});
  return transaction(stores,(d,t)=>{
    const opKey='op:digital-slip:'+key,prior=d.meta.find(x=>x.key===opKey)?.value;
    if(prior){
      if(prior.signature!==signature)throw Error('Bu işlem farklı içerikle kullanıldı; mevcut fişi inceleyin.');
      const s=d.slips.find(x=>x.id===prior.slip_id);if(!s||!isActive(s))throw Error('Bu fiş kaldırılmış; yeni fiş açmadan kaynağı inceleyin.');
      const state=slipWorkState(d,s);if(state.state!=='linked')throw Error('Fişin kaynak işi bulunamıyor; ikinci kayıt açılmadı.');
      return {slip:s,works:state.works,_existing:true};
    }
    const sequence=Math.max(Number(d.meta.find(x=>x.key==='seq_slip')?.value)||0,...d.slips.map(x=>Number(x.slip_no)||0))+1;
    if(!Number.isSafeInteger(sequence))throw Error('Fiş sıra numarası geçersiz.');
    const content=Object.fromEntries(contentFields.filter(k=>Object.hasOwn(fields,k)).map(k=>[k,fields[k]]));
    const s=newRecord({...content,slip_no:sequence,status:'Taslak',revision_no:1});assertSlipService(s);
    // Makes the new slip visible to the family resolver in this same transaction.
    d.slips.push(s);t.add('slips',s);
    const result=connect(d,t,s,{mode,work_id,vehicle_id:fields.vehicle_id,allow_separate});
    t.put('meta',{key:'seq_slip',value:sequence});t.add('meta',{key:opKey,value:{signature,slip_id:s.id}});
    return result;
  });
}

export async function updateDigitalSlipDraft(id,expected,fields) {
  fields=Object.fromEntries(contentFields.filter(k=>Object.hasOwn(fields,k)).map(k=>[k,fields[k]]));
  return transaction(stores,(d,t)=>{
    const s=d.slips.find(x=>x.id===id);assertSlipService(s);assertSlipExpected(s,expected);
    if(s.status!=='Taslak'||s.signed_at)throw Error('İmzalı fiş değiştirilemez; revizyon oluşturun.');
    const state=slipWorkState(d,s);
    if(state.state==='missing')throw Error('Bağlı iş silinmiş; fişi değiştirmeden kaynak işi inceleyin.');
    const owned=state.works.length===1&&state.works[0].digital_slip_source_id===state.root&&!s.revision_of;
    const serviceKeys=['date','customer_id','site_id','vehicle_id','personnel_id','plate','work_text','quantity','unit'];
    const sameService=key=>key==='plate'?String(fields[key]||'')===String(s[key]||''):stableStringify(fields[key]??null)===stableStringify(s[key]??null);
    const serviceChanged=serviceKeys.some(key=>!sameService(key));
    if(owned&&serviceChanged){
      const w=state.works[0],references=d.hakedis.some(h=>isActive(h)&&h.status!=='İptal'&&(h.items||[]).some(i=>i.work_record_id===w.id))||
        d.payables.some(b=>isActive(b)&&b.status!=='İptal'&&(b.items||[]).some(i=>i.work_record_id===w.id))||
        d.dump_entries.some(e=>isActive(e)&&e.work_record_id===w.id)||d.cash_records.some(r=>isActive(r)&&r.work_record_id===w.id)||
        d.cari_movements.some(r=>isActive(r)&&r.ref_id===w.id)||d.cost_allocations.some(r=>isActive(r)&&((r.source_store==='work_records'&&r.source_id===w.id)||(r.targets||[]).some(i=>i.work_record_id===w.id)));
      if(w.price_snapshot!=null||w.customer_fuel_allowance_l!=null||references)throw Error('İş fiyatlandırılmış veya başka kayda bağlanmış; fiş üzerinden hizmet değiştirilemez. Kaynak işi inceleyin.');
      const nextSlip={...s,...fields,id:s.id,status:s.status,slip_no:s.slip_no,updated_at:stamp(s)};
      const work={...w,...slipToWork(nextSlip),slip_id:s.id,updated_at:stamp(w)};context(d,work);
      t.put('work_records',work);t.put('slips',nextSlip);return nextSlip;
    }
    if(state.state==='linked'&&!s.revision_of){
      for(const key of serviceKeys)
        if(!sameService(key))throw Error('İşe bağlı fişin hizmet alanları burada değiştirilemez; kaynak işi inceleyin.');
      if(state.works.some(w=>w.customer_id!==s.customer_id||w.date!==s.date||w.unit!==s.unit||(w.site_id||null)!==(s.site_id||null))||state.works.reduce((n,w)=>n+Number(w.quantity),0)!==Number(s.quantity))throw Error('Kaynak iş ile fiş uyuşmuyor; yeniden inceleyin.');
    }
    const next={...s,description:String(fields.description||''),receiver_name:String(fields.receiver_name||''),updated_at:stamp(s)};
    if(state.state==='unlinked'||s.revision_of)Object.assign(next,fields,{id:s.id,slip_no:s.slip_no,status:s.status,updated_at:stamp(s)});
    assertSlipService(next);t.put('slips',next);return next;
  });
}

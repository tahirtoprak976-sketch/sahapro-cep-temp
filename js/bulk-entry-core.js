// Pure review decisions. Model proposals never supply authority, source IDs or write receipts.
import {assertHistoricalScope,pendingFuelFields,historicalFuelProjection,historicalFuelIdentity} from './historical-fuel.js';
import {foldTr} from './parser.js';
import {analyzeMessage} from './message-engine.js';
import {isActive,WORK_TYPES,WORK_UNITS,todayStr} from './core.js';
import {customerNameKey} from './driver-customer.js';
import {historyWorkKey,historyFuelKey,validHistoryDate} from './history-core.js';

export const BULK_VERSION=1;
export const BULK_STORES=['customers','sites','vehicles','personnel','quarries','dump_sites','aliases','work_records','fuel_records','fuel_tank_movements','pending_fuel_records'];
const norm=s=>foldTr(String(s||'')).replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const contains=(hay,needle)=>!!norm(needle)&&(' '+norm(hay)+' ').includes(' '+norm(needle)+' ');
const text=s=>String(s||'').trim();
const positive=n=>typeof n!=='boolean'&&['number','string'].includes(typeof n)&&Number.isFinite(Number(n))&&Number(n)>0&&Number(n)<=1e12;
const nonnegative=n=>n===0||n==='0'||positive(n);
const fields={customer_id:['customers','Müşteri'],vehicle_id:['vehicles','Araç'],site_id:['sites','Şantiye'],personnel_id:['personnel','Personel'],quarry_id:['quarries','Malzeme ocağı'],dump_site_id:['dump_sites','Döküm yeri']};
const caption={date:'Gerçek tarih',quantity:'Miktar',unit:'Birim',work_type:'İş türü',liters:'Litre',source:'Kaynak mesaj'};
const clones=x=>JSON.parse(JSON.stringify(x));
export function bulkSourceLines(message){
 let header='';const lines=[];
 for(const raw of String(message||'').split('\n[DÜZELTME]')[0].split(/\r?\n/)){
  if(!raw.trim())continue;
  const m=/^\s*\[?\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?[\s,\]]+\d{1,2}:\d{2}\]?\s*(?:-\s*)?([^:]+):\s*(.*)$/.exec(raw);
  if(m){header=raw.slice(0,raw.length-m[2].length).trim();if(m[2].trim())lines.push({text:m[2].trim(),header});}
  else lines.push({text:raw.trim(),header});
 }
 return lines.map(l=>({...l,key:JSON.stringify([norm(l.header),norm(l.text)])}));
}
export function normalizeBulkRows(v,message,data,rawPlan={}){
 if(!v||typeof v!=='object'||['works','fuel'].some(k=>v[k]!=null&&!Array.isArray(v[k])||rawPlan[k]!=null&&!Array.isArray(rawPlan[k])))throw Error('Geçersiz toplu kayıt listesi.');
 if((rawPlan.works||v.works||[]).length>20||(rawPlan.fuel||v.fuel||[]).length>10)throw Error('Toplu kontrolde en fazla 20 iş ve 10 yakıt olabilir; hiçbir satır kesilmedi. Mesajı bölün.');
 const lines=bulkSourceLines(message),rows=[];
 for(const [kind,group]of [['work','works'],['fuel','fuel']])for(const [i,r]of (v[group]||[]).entries()){
  if(!r||typeof r!=='object'||Array.isArray(r))throw Error('Geçersiz toplu kayıt satırı.');
  const raw=rawPlan[group]?.[i]||r,q=text(raw.quote||r.quote||raw.description||r.description),nq=norm(q);
  let hits=nq?lines.filter(l=>contains(l.text,q)||contains(l.header+' '+l.text,q)):[];
  // Missing/short source evidence is a question, never an invented row identity.
  if(nq.length<5)hits=[];
  const unique=[...new Map(hits.map(l=>[l.key,l])).values()];
  const labels={};
  for(const [field,[store]]of Object.entries(fields)){
   const newName={customer_id:'new_customer',site_id:'new_site',quarry_id:'new_quarry',dump_site_id:'new_dump_site'}[field];
   const reviewed=r._bulkReviewed?.includes(field);
   labels[field]=text((!reviewed&&raw[newName])||r[newName]||(data[store]||[]).find(x=>x.id===(r[field]||raw[field]))?.name);
  }
  const f=Object.fromEntries(['date','customer_id','vehicle_id','site_id','personnel_id','quarry_id','dump_site_id','work_type','quantity','unit','material','description','dump_cost','tonnage','slip_no'].filter(k=>r[k]!=null).map(k=>[k,r[k]]));
  const review=[];
  const evidence=unique.length===1?unique[0].header+' '+q:q;
  for(const [field,[store]]of Object.entries(fields))if(labels[field]&&!contains(evidence,labels[field])){
   const targetStore=type=>({customer:'customers',vehicle:'vehicles',site:'sites',personnel:'personnel',quarry:'quarries',dump_site:'dump_sites'}[type]||type);
   const id=r[field]||raw[field],aliases=(data.aliases||[]).filter(a=>isActive(a)&&a.active!==false&&targetStore(a.target_type)===store&&contains(evidence,a.alias));
   const matched=aliases.some(a=>a.target_id===id),ambiguous=matched&&aliases.some(a=>a.target_id!==id&&aliases.some(b=>b.target_id===id&&norm(a.alias)===norm(b.alias)));
   const vehicle=field==='vehicle_id'?(data.vehicles||[]).find(x=>x.id===id):null;
   const plate=vehicle?.plate&&norm(evidence).replace(/ /g,'').includes(norm(vehicle.plate).replace(/ /g,''));
   if(!plate&&(!matched||ambiguous))review.push(field);
  }
  if(r.dateUnsure||kind==='fuel'&&!validHistoryDate(raw.date)&&!r._bulkReviewed?.includes('date'))f.date='';
  if(r.customerGuess||r.hinted||r.ambiguous||raw.customer_id&&!r.customer_id&&!r.new_customer)review.push('customer_id');if(r.vehicleGuess)review.push('vehicle_id');
  if(r.guessed){
   // Reuse literal quantity evidence from the existing parser. E.g. its tokenizer
   // can mark "JCB 20" as a machine code although the row explicitly says "20 saat".
   const parsed=unique.length===1?analyzeMessage({text:q},data).rows:[];
   const vehicleNumbers=String((data.vehicles||[]).find(x=>x.id===r.vehicle_id)?.name||'').match(/\d+/g)||[];
   const literal=parsed.length===1&&parsed[0].evidence?.quantity?.via==='quantity_unit'&&Number(parsed[0].quantity)===Number(r.quantity)&&parsed[0].unit===r.unit&&!vehicleNumbers.includes(String(r.quantity));
   if(!literal)review.push('quantity');
  }
  if(r.typeDoubt)review.push('work_type');
  const blocked=r.fromDriver||r.driver_entry_id||r.unverified||r.rejectedSource||r.driverDup?'Şoför aktarımı kendi doğrulanmış kartından incelenmeli.':
   raw.settlement_status&&raw.settlement_status!=='unbilled_unpaid'||raw.hakedis_id||raw.paid===true?'Ödeme/hakediş içeren kayıt ayrı akıştan kontrol edilmeli.':
   /\b(?:odendi|tahsil edildi|nakit alindi|hakedise alindi)\b/.test(norm(q))?'Ödeme/hakediş içeren kayıt ayrı akıştan kontrol edilmeli.':null;
  rows.push({key:kind+':'+i,kind,quote:q,raw_message:unique.length===1?unique[0].header+' '+unique[0].text:q,
   source_key:unique.length===1?JSON.stringify([unique[0].key,kind,nq]):null,source_candidates:unique.length===1?[]:lines,
   labels,fields:f,review:[...new Set(review)].filter(field=>!r._bulkReviewed?.includes(field)),blocked,parent_id:(!r._bulkReviewed?.includes('customer_id')&&raw.new_customer_parent_id)||r.new_customer_parent_id||(data.customers||[]).find(c=>c.id===f.customer_id)?.parent_customer_id||null,
   ...(kind==='fuel'?{fields:{date:f.date,vehicle_id:f.vehicle_id,personnel_id:f.personnel_id||null,liters:r.liters,total:r.total??raw.total??null,unit_price:r.unit_price??raw.unit_price??null,fuel_source:r.source||r.fuel_source||raw.source||raw.fuel_source||'',description:q}}:{})});
 }
 return rows;
}
export function answerBulkQuestions(draft,id,answer){
 if(!draft||draft.version!==BULK_VERSION)throw Error('Geçersiz toplu taslak');
 return {...clones(draft),answers:{...draft.answers,[id]:clones(answer)}};
}
export function bulkSourceKey(r,answers={}){
 if(r.source_key)return r.source_key;
 const answer=answers[JSON.stringify(['source','Kaynak mesajı seçin','',r.key])];
 const l=(r.source_candidates||[]).find(x=>x.key===answer?.value);
 return l?JSON.stringify([l.key,r.kind,norm(r.quote)]):null;
}
export const bulkInputSignature=r=>JSON.stringify(Object.fromEntries(['kind','date','work_type','quantity','unit','material','liters','fuel_source'].map(k=>[k,k==='kind'?r.kind:r.fields[k]??null])));
export function buildBulkPlan(draft,data,{today=todayStr()}={}){
 if(!draft||draft.version!==BULK_VERSION||!Array.isArray(draft.rows)||draft.rows.length>30||draft.rows.filter(r=>r.kind==='work').length>20||draft.rows.filter(r=>r.kind==='fuel').length>10)throw Error('Geçersiz toplu taslak veya satır sınırı');
 if(new Set(draft.rows.map(r=>r?.key)).size!==draft.rows.length)throw Error('Toplu taslakta satır kimlikleri tekil olmalı.');
 const registry=Object.fromEntries(BULK_STORES.map(s=>[s,(data[s]||[]).filter(isActive).map(r=>({...r}))]));
 const questions=new Map(),cards=new Map(),sourceSeen=new Map(),rows=[],answers=draft.answers||{};
 const ask=(r,field,label,options=[],extra={})=>{
  const id=JSON.stringify([field,label,extra.scope||'',extra.perRow?r.key:'']);
  if(!questions.has(id))questions.set(id,{id,field,label:label||caption[field]||fields[field]?.[1]||field,options,rows:[],...extra});
  const question=questions.get(id);if(!question.rows.includes(r.key))question.rows.push(r.key);
  return {question,answer:answers[id]};
 };
 function resolve(r,field,label,scope=null,required=false){
  const [store]=fields[field],all=registry[store].filter(x=>field!=='site_id'||x.customer_id===scope);
  const exact=all.filter(x=>customerNameKey(x.name)===customerNameKey(label)||(store==='vehicles'&&norm(x.plate).replace(/ /g,'')===norm(label).replace(/ /g,'')&&label)||(data.aliases||[]).some(a=>isActive(a)&&a.active!==false&&a.target_id===x.id&&({customer:'customers',vehicle:'vehicles',site:'sites',personnel:'personnel',quarry:'quarries',dump_site:'dump_sites'}[a.target_type]||a.target_type)===store&&norm(a.alias)===norm(label)));
  const selected=all.find(x=>x.id===r.fields[field]);
  if(!required&&!label&&!selected)return null;
  const forced=r.review?.includes(field),parent=store==='customers'?scope:null;
  const matching=store==='customers'?exact.filter(x=>(x.parent_customer_id||null)===(parent||null)):exact;
  if(!forced&&matching.length===1)return matching[0].id;
  const {question,answer}=ask(r,field,label,all.map(x=>({value:x.id,label:x.name+(x.parent_customer_id?' ('+(registry.customers.find(p=>p.id===x.parent_customer_id)?.name||'')+')':'')})),{scope:scope||'',scopeLabel:registry.customers.find(x=>x.id===scope)?.name||'',canNew:['customers','sites','quarries','dump_sites'].includes(store)&&!!label&&label.length<=120,store});
  if(answer?.value&&all.some(x=>x.id===answer.value)){question.resolved=true;return answer.value;}
  if(answer?.create===true&&question.canNew){
   const same=matching;if(same.length>1)return null;
   if(same.length===1){question.resolved=true;return same[0].id;}
   const id='bulk-new:'+question.id;
   if(!cards.has(id)){const card={id,store,name:label,...(store==='customers'&&scope?{parent_customer_id:scope}:{}),...(store==='sites'?{customer_id:scope}:{})};cards.set(id,card);registry[store].push(card);}
   question.resolved=true;return id;
  }
  return null;
 }
 for(const original of draft.rows){
  if(!original||typeof original!=='object'||!original.fields||!original.labels||typeof original.key!=='string'||original.source_key!=null&&typeof original.source_key!=='string')throw Error('Geçersiz toplu kayıt satırı.');
  const r=clones(original),f={...r.fields},issues=[];r.fields=f;r.status='waiting';r.issues=issues;
  if(!['work','fuel'].includes(r.kind)||!r.key)throw Error('Geçersiz kayıt türü');
  if(draft.excluded?.includes(r.key)){r.status='excluded';rows.push(r);continue;}
  if(r.blocked){issues.push(r.blocked);rows.push(r);continue;}
  if(!r.source_key){
   const {question,answer}=ask(r,'source','Kaynak mesajı seçin',(r.source_candidates||[]).map(l=>({value:l.key,label:l.header+' '+l.text})),{perRow:true});
   const l=(r.source_candidates||[]).find(x=>x.key===answer?.value);
   if(l){r.source_key=JSON.stringify([l.key,r.kind,norm(r.quote)]);r.raw_message=l.header+' '+l.text;question.resolved=true;}else issues.push('Kaynak mesaj doğrulanmalı.');
  }
  if(r.source_key){
   const receipt=data.bulk_receipts?.[r.source_key];
   if(receipt){
    r.status=receipt.input_signature&&receipt.input_signature!==bulkInputSignature(original)?'conflict':'recorded';
    const saved=(data[receipt.store]||[]).find(x=>x.id===receipt.record_id&&isActive(x));
    if(saved){r.record_id=saved.id;r.record_store=receipt.store;if(r.status==='recorded')for(const field of [...Object.keys(fields),'date','quantity','unit','work_type','liters'])if(saved[field]!=null)r.fields[field]=saved[field];}
    issues.push(r.status==='conflict'?'Bu kaynak daha önce farklı bilgilerle işlendi; mevcut kaydı açıp düzeltin.':receipt.state==='undone'?'Bu kaynak geri alınmış; yeniden oluşturmak için kayıt geçmişini inceleyin.':'Bu kaynak daha önce işlendi.');rows.push(r);continue;
   }
   if(sourceSeen.has(r.source_key)){
    const previous=sourceSeen.get(r.source_key),conflict=previous.signature!==bulkInputSignature(original);
    r.status=conflict?'conflict':'duplicate';issues.push(conflict?'Aynı kaynak farklı bilgilerle yorumlanmış; kaynağı ayırıp tekrar kontrol edin.':'Paket içinde aynı kaynak tekrarlandı.');
    if(conflict){const first=rows.find(x=>x.key===previous.key);if(first){first.status='conflict';first.issues.push(issues[0]);}}
    rows.push(r);continue;
   }sourceSeen.set(r.source_key,{key:r.key,signature:bulkInputSignature(original)});
  }
  for(const [field,options]of [['date',[]],...(r.kind==='work'?[['quantity',[]],['work_type',WORK_TYPES],['unit',WORK_UNITS]]:[['liters',[]]])]){
   const valid=field==='date'?validHistoryDate(f[field],today):options.length?options.includes(f[field]):positive(f[field]);
   if(!valid||r.review?.includes(field)){
    const {question,answer}=ask(r,field,caption[field],options.map(x=>({value:x,label:x})),{scope:field==='date'?r.kind:'',perRow:field!=='date'});
    const value=answer?.value;
    if(field==='date'?validHistoryDate(value,today):options.length?options.includes(value):positive(value)){f[field]=options.length||field==='date'?value:Number(value);question.resolved=true;}else issues.push((caption[field]||field)+' tamamlanmalı.');
   }
  }
  if(r.kind==='work'){
   let label=r.labels.customer_id,parent=r.parent_id||null;
   const parts=/^(.+?)\s*\(([^()]+)\)\s*$/.exec(label||'');
   if(parts){label=parts[1].trim();const pr={...r,review:[],fields:{customer_id:parent}};parent=resolve(pr,'customer_id',parts[2].trim(),null,true);if(!parent)issues.push('Ana firma seçilmeli.');}
   if(parent&&!registry.customers.some(x=>x.id===parent)){parent=null;issues.push('Ana firma artık kullanılamıyor.');}
   f.customer_id=parts&&!parent?null:resolve(r,'customer_id',label,parent,true);
   if(!f.customer_id)issues.push('Müşteri seçilmeli.');
   if(f.customer_id)f.site_id=resolve(r,'site_id',r.labels.site_id,f.customer_id);
   for(const field of ['quarry_id','dump_site_id'])f[field]=resolve(r,field,r.labels[field]);
   if(f.unit==='Sefer'&&positive(f.quantity)&&!Number.isInteger(Number(f.quantity)))issues.push('Sefer tam sayı olmalı.');
   Object.assign(f,{quantity:Number(f.quantity),price_snapshot:null,price_deferred_by_user:true,source:'asistan-toplu',settlement_status:'unbilled_unpaid'});
  }else{
   if(!f.fuel_source){
    const {question,answer}=ask(r,'fuel_source','Yakıtın gerçek kaynağı',[{value:'Depo Tankı',label:'Kendi depo tankımızdan çıktı'}]);
    if(answer?.value==='Depo Tankı'){f.fuel_source=answer.value;question.resolved=true;}
   }
   if(f.fuel_source!=='Depo Tankı')issues.push('Yalnız kaynağı açıkça Depo Tankı olan çıkış desteklenir; diğer yakıt ayrı incelenmeli.');
   if(!draft.tank_confirmed)issues.push('Yakıtların daha önce stoktan düşülmediğini paket için doğrulayın.');
   f.liters=Number(f.liters);f.customer_billable=false;f.receipt='Depo';delete f.total;delete f.unit_price;
  }
  f.vehicle_id=resolve(r,'vehicle_id',r.labels.vehicle_id,null,true);if(!f.vehicle_id)issues.push('Araç seçilmeli.');
  f.personnel_id=resolve(r,'personnel_id',r.labels.personnel_id);
  // An optional named card is not silently discarded when unresolved.
  for(const [field]of Object.entries(fields))if(r.labels[field]&&!f[field]&&!issues.some(x=>x.startsWith(field)))issues.push((fields[field][1])+' doğrulanmalı.');
  const signature=r.kind==='work'?historyWorkKey(f):historyFuelKey(f),store=r.kind==='work'?'work_records':'fuel_records';
  const similar=[...registry[store],...(r.kind==='fuel'?registry.pending_fuel_records.filter(x=>x.reconciliation_status!=='cancelled'):[])].filter(x=>r.kind==='fuel'&&x.reconciliation_status&&historicalFuelIdentity(x)===historicalFuelIdentity(f)||(r.kind==='work'?historyWorkKey(x):historyFuelKey(x))===signature);
  const earlier=rows.filter(x=>x.kind===r.kind&&x.status==='ready'&&(r.kind==='work'?historyWorkKey(x.fields):historyFuelKey(x.fields))===signature);
  const historicalRequested=r.kind==='fuel'&&draft.historical_fuel?.enabled&&draft.historical_fuel.keys?.includes(r.key);
  const historicalDuplicates=historicalRequested&&[...registry.fuel_records,...registry.pending_fuel_records.filter(x=>x.reconciliation_status!=='cancelled'),...rows.filter(x=>x.kind==='fuel'&&x.status==='ready'&&!draft.deselected?.includes(x.key)).map(x=>x.fields)].some(x=>historicalFuelIdentity(x)===historicalFuelIdentity(f));
  if(historicalDuplicates)issues.push('Aynı tarih / araç / litreyle gerçek veya bekleyen yakıt var. Bu modda ikinci kayıt kesinleştirilemez; mevcut kaydı inceleyin veya bu satırı dışlayın.');
  else if(similar.length||earlier.length){
   const {question,answer}=ask(r,'similar','Benzer kayıt var; ayrı bir iş/çıkış mı?',[{value:'separate',label:'Gerçekten ayrı kayıt'},{value:'exclude',label:'Tekrar; bu satırı dışla'}],{perRow:true});
   if(answer?.value==='exclude'){question.resolved=true;r.status='excluded';rows.push(r);continue;}
   if(answer?.value==='separate')question.resolved=true;else issues.push('Olası mükerrer kaydı kontrol edin.');
  }
  if(historicalRequested){
   try{assertHistoricalScope(draft.historical_fuel,f.date,today);r.pending_fuel=true;Object.assign(f,pendingFuelFields({...f,total:original.fields.total??null,unit_price:original.fields.unit_price??null},draft.historical_fuel,draft.historical_fuel.approved_at));}catch(e){issues.push(e.message);}
  }
  r.status=issues.length?'waiting':'ready';rows.push(r);
 }
 // A later normal/pending row cannot make already accepted review evidence unpromotable.
 for(const r of rows.filter(r=>r.pending_fuel&&r.status==='ready'&&!draft.deselected?.includes(r.key))){
  if(rows.some(x=>x!==r&&x.kind==='fuel'&&x.status==='ready'&&!draft.deselected?.includes(x.key)&&historicalFuelIdentity(x.fields)===historicalFuelIdentity(r.fields))){r.status='waiting';r.issues.push('Aynı tarih / araç / litreyle seçili ikinci yakıt var. Çift çıkış riski nedeniyle bu kaydı ayrı mutabakat olarak alamıyoruz; kaynağı inceleyin veya tekrar satırını dışlayın.');}
 }
 // Historical stock must remain nonnegative on every date, including later existing outs.
 const candidates=rows.filter(r=>r.kind==='fuel'&&!r.pending_fuel&&r.status==='ready'&&!draft.deselected?.includes(r.key));
 for(const r of candidates){
  const selected=candidates.filter(x=>x!==r&&x.status==='ready');
  const timeline=[...(data.fuel_tank_movements||[]).filter(isActive),...selected.map(x=>({...x.fields,move_type:'ÇIKIŞ'})),{...r.fields,move_type:'ÇIKIŞ'}].sort((a,b)=>String(a.date).localeCompare(String(b.date))||(a.move_type==='GİRİŞ'?-1:1));
  let stock=0;
  for(const m of timeline){
   if(!validHistoryDate(m.date,'9999-12-31')||!nonnegative(m.liters)||!['GİRİŞ','ÇIKIŞ'].includes(m.move_type)){r.issues.push('Depo geçmişinde geçersiz hareket var; kontrol edin.');break;}
   const before=stock;stock+=(m.move_type==='GİRİŞ'?1:-1)*Number(m.liters);
   if(stock < -0.000001){r.issues.push(`${m.date} tarihinde depo ${Math.max(0,before)} L; ${m.liters} L çıkış karşılanmıyor. Gerçek geçmiş giriş/açılış kaydını kontrol edin; iş kayıtları ayrıca kaydedilebilir.`);break;}
  }
  if(r.issues.length)r.status='waiting';
 }
 const needed=new Set(rows.filter(r=>r.status==='ready').flatMap(r=>Object.values(r.fields)));
 const newCards=[...cards.values()].filter(c=>needed.has(c.id)||[...cards.values()].some(child=>needed.has(child.id)&&child.parent_customer_id===c.id));
 const totals={};for(const r of rows.filter(r=>r.status==='ready'))if(r.kind==='work'){const k=JSON.stringify([r.fields.customer_id,r.fields.unit]);totals[k]=(totals[k]||0)+r.fields.quantity;}
 return {rows,questions:[...questions.values()].filter(q=>!q.resolved),newCards,totals,counts:Object.fromEntries(['ready','waiting','duplicate','recorded','excluded','conflict'].map(s=>[s,rows.filter(r=>r.status===s).length])),priceNote:'Fiyatlar bekliyor; güncel fiyat, sözleşme ve mazot anlaşması uygulanmayacak.'};
}
export function finalizeBulk(draft,data,options){
 const plan=buildBulkPlan(draft,data,options);
 const atomicBlocked=draft.historical_fuel?.enabled&&plan.rows.some(r=>!draft.deselected?.includes(r.key)&&['waiting','conflict'].includes(r.status));
 const writes=atomicBlocked?[]:plan.rows.filter(r=>r.status==='ready'&&!draft.deselected?.includes(r.key));
 const needed=new Set(writes.flatMap(r=>Object.values(r.fields)));
 for(let i=0;i<plan.newCards.length;i++)for(const c of plan.newCards)if(needed.has(c.id))for(const ref of ['parent_customer_id','customer_id'])if(c[ref])needed.add(c[ref]);
 const totals={};for(const r of writes)if(r.kind==='work'){const k=JSON.stringify([r.fields.customer_id,r.fields.unit]);totals[k]=(totals[k]||0)+r.fields.quantity;}
 return {...plan,atomicBlocked,projection:historicalFuelProjection(data,writes.filter(r=>r.pending_fuel).map(r=>r.fields)),totals,newCards:plan.newCards.filter(c=>needed.has(c.id)),writes,skipped:plan.rows.filter(r=>!writes.includes(r)).map(r=>({key:r.key,status:r.status,reasons:r.issues}))};
}
export const bulkSelectionToken=plan=>JSON.stringify({writes:plan.writes.map(r=>({key:r.key,source_key:r.source_key,fields:r.fields})),cards:plan.newCards});

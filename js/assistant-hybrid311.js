// Phone-owned provenance and a minimal model envelope. No database writes or inferred money.
import {isActive} from './core.js';
import {foldTr} from './parser.js';
import {registeredMatches,sourceContextHints} from './assistant-source-context.js';
const stores=['customers','sites','vehicles','personnel','aliases','dump_sites','quarries','suppliers','bank_accounts','work_records','price_book','fuel_records','cash_records','expense_records','fuel_tank_movements'];
const types={customers:'customer',sites:'site',vehicles:'vehicle',personnel:'personnel',dump_sites:'dump_site',quarries:'quarry',suppliers:'supplier'};
const norm=s=>foldTr(String(s||'')).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const live=(d,k)=>(d[k]||[]).filter(isActive);
export function buildHybridEnvelope(d,message,today,rules=''){
 const hints=sourceContextHints(message,d,today,rules),ids=Object.fromEntries(Object.keys(types).map(k=>[k,new Set()])),bounds=[];
 for(const [index,text]of String(message||'').split(/\r?\n/).entries()){
  if(!text.trim())continue;
  const candidates={};
  for(const store of Object.keys(types)){
   let matches;
   if(['personnel','suppliers'].includes(store))matches=live(d,store).filter(r=>norm(r.name)&&(' '+norm(text)+' ').includes(' '+norm(r.name)+' ')||live(d,'aliases').some(a=>a.active!==false&&a.target_type===types[store]&&a.target_id===r.id&&norm(a.alias)&&(' '+norm(text)+' ').includes(' '+norm(a.alias)+' ')));
   else matches=registeredMatches(d,store,text);
   const shown=matches.slice(0,3);for(const r of shown)ids[store].add(r.id);
   if(shown.length)candidates[store]={ids:shown.map(r=>r.id),more:matches.length>3};
  }
  if(Object.keys(candidates).length)bounds.push({line:index,candidates});
 }
 // Verified sender assignments/site owners are relevant even when omitted from the text.
 for(const h of hints){
  for(const [field,store]of [['customer_id','customers'],['site_id','sites'],['vehicle_id','vehicles'],['personnel_id','personnel']]){const id=h.fields?.[field]?.value;if(id)ids[store].add(id);}
  if(h.sender_id)ids.personnel.add(h.sender_id);
 }
 for(const s of live(d,'sites').filter(s=>ids.sites.has(s.id)))if(s.customer_id)ids.customers.add(s.customer_id);
 for(const c of live(d,'customers').filter(c=>ids.customers.has(c.id)))if(c.parent_customer_id)ids.customers.add(c.parent_customer_id);
 const allowed={customers:['id','name','parent_customer_id'],sites:['id','name','customer_id','deal'],vehicles:['id','name','plate','type','assignee_id'],personnel:['id','name','vehicle_id'],dump_sites:['id','name','own_yard'],quarries:['id','name'],suppliers:['id','name']};
 const data=Object.fromEntries(stores.map(k=>[k,[]]));
 for(const store of Object.keys(types))data[store]=live(d,store).filter(r=>ids[store].has(r.id)).map(r=>Object.fromEntries(allowed[store].filter(k=>r[k]!=null).map(k=>[k,r[k]])));
 data.aliases=live(d,'aliases').filter(a=>a.active!==false&&Object.entries(types).some(([store,type])=>a.target_type===type&&ids[store].has(a.target_id))&&String(message).split(/\r?\n/).some(line=>norm(a.alias)&&norm(line).includes(norm(a.alias)))).map(a=>({id:a.id,alias:a.alias,target_type:a.target_type,target_id:a.target_id,active:true}));
 return {data,hints,bounds,note:'Yalnız mesajla ilişkili adaylar; satır ve varlık türü başına en çok üç doğrudan aday. more=true ise sessiz seçim yapma. Tarih/para çelişkisini yerel çıkarımla bastırma.'};
}
export function attachSourcePriorities(row){
 const priorities={};for(const [field,f]of Object.entries(row.fieldConfidence||{})){
  priorities[field]=String(f.source||'').startsWith('user')?4:f.level==='KESIN'?3:f.level==='CIKARIM'?2:0;
  if(['amount','unit_price','total','cost','dump_cost'].includes(field)&&priorities[field]===2)priorities[field]=0;
 }
 Object.defineProperty(row,'kaynak_onceligi',{enumerable:false,configurable:true,value:priorities});return row;
}
const questions={vehicle_id:/^(hangi arac|hangi makine|plaka nedir|arac hangisi)$/,customer_id:/^(musteri kim|hangi musteri|musteri kimdir)$/,date:/^(tarih nedir|hangi tarih|tarihi nedir)$/,quantity:/^(kac saat|kac sefer|miktar nedir|sure ne kadar)$/,unit:/^(birimi nedir|hangi birim)$/};
export function suppressResolvedQuestions(v){
 const rows=[...(v.works||[]),...(v.fuel||[])],mixed=['collections','personnel','expenses','fuelOut','tankIn','maintenance','actions','settings','cards','prices','docs','tickets','edits','memory','partDocuments'].some(k=>Array.isArray(v[k])?v[k].length:v[k]&&Object.values(v[k]).some(x=>Array.isArray(x)&&x.length));
 if(!rows.length||mixed)return {...v,questions:[...(v.questions||[])]};
 const resolved=field=>rows.every(r=>{
  const f=r.fieldConfidence?.[field];if(!f||!['KESIN','CIKARIM'].includes(f.level)||f.rejected||f.conflict||f.value==null||f.value==='')return false;
  if(field==='date'&&(r.dateConflict||r.calendarConflict||r.dateUnsure))return false;
  if(field==='customer_id'&&(r.ambiguous||r.parentMismatch||r.customerGuess||r.badNew))return false;
  if(field==='vehicle_id'&&r.vehicleGuess)return false;
  if(field==='quantity'&&(r.guessed||!(Number(r.quantity)>0)))return false;
  return true;
 });
 return {...v,questions:(v.questions||[]).filter(q=>{const field=Object.keys(questions).find(k=>questions[k].test(norm(q)));return !field||!resolved(field);})};
}

// A model can expand a relevant search, but cannot enumerate the phone's catalog.
export function hybridReadRunner(run,envelope,message){
 const known=new Map(Object.keys(types).map(store=>[store,new Set((envelope.data[store]||[]).map(r=>r.id))]));
 const words=new Set(norm(message+' '+Object.values(envelope.data).flat().map(r=>[r.name,r.plate,r.type,r.alias].filter(Boolean).join(' ')).join(' ')).split(' ').filter(w=>w.length>=3));
 return async(name,args={})=>{
  if(name==='find_records'){
   const query=norm(args.query),related=query.split(' ').filter(Boolean).every(w=>words.has(w));
   const scoped=args.customer_id&&known.get('customers')?.has(args.customer_id)||args.vehicle_id&&known.get('vehicles')?.has(args.vehicle_id);
   if(!query&&!scoped||query&&!related)return {error:'Yalnız bu mesajla ilişkili ad, plaka veya seçili kayıt kapsamında arayın; tüm kayıt listesi gönderilmez.'};
   if(args.customer_id&&!known.get('customers')?.has(args.customer_id)||args.vehicle_id&&!known.get('vehicles')?.has(args.vehicle_id))return {error:'Kayıt bu mesajın kapsamında değil.'};
   const result=await run(name,{...args,limit:Math.min(3,Math.max(1,Number(args.limit)||3))});
   if(Array.isArray(result.records)){if(!known.has(args.store))known.set(args.store,new Set());for(const r of result.records)if(r.id)known.get(args.store).add(r.id);}
   return result;
  }
  if(name==='get_records'){
   if(!Array.isArray(args.ids)||args.ids.length>3||args.ids.some(id=>!known.get(args.store)?.has(id)))return {error:'Önce mesajla ilişkili en fazla üç kaydı arayıp seçin.'};
  }
  return run(name,args);
 };
}

// OCR gives a literal plate; the phone resolves the ID after reading, without sending its fleet.
export function fillReceiptReferences(plan,d,photoCount){
 const texts=Array.isArray(plan?.photo_texts)?plan.photo_texts:[],next={...plan};
 const compact=x=>String(x||'').toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9]/g,'');
 for(const group of ['works','fuel','expenses','maintenance'])if(Array.isArray(plan[group]))next[group]=plan[group].map(row=>{
  if(row.vehicle_id||!Number.isInteger(row.photo)||row.photo<0||row.photo>=photoCount||typeof texts[row.photo]!=='string')return row;
  const plates=new Set([...texts[row.photo].matchAll(/\b\d{2}\s*[A-Z]{1,3}\s*\d{2,5}\b/giu)].map(m=>compact(m[0])));
  const matches=live(d,'vehicles').filter(v=>v.plate&&plates.has(compact(v.plate)));
  return matches.length===1?{...row,vehicle_id:matches[0].id}:row;
 });
 return next;
}

export function secondaryReviewTriggers({message='',plan={},schemaError=false}={}){
 const result=[];if(schemaError)result.push('JSON şeması geçersiz');
 for(const clause of String(message).split(/\n|[;!?]|\.(?=\s)/)){
  const t=norm(clause),received=/\b(?:aldik|aldim|tahsil edildi|odedi)\b/.test(t),promised=/\b(?:odeyecek|verecek|yatiracak|odenecek)\b/.test(t);
  if(received&&promised&&!/\b(?:kalan|kalani|kismi|bir kismini|geri kalani)\b/.test(t)){result.push('Aynı cümlede para yönü çelişkili');break;}
 }
 const number=x=>x!==''&&x!=null&&Number.isFinite(Number(x))&&Number(x)>=0?Number(x):null;
 for(const doc of [...(Array.isArray(plan.documents)?plan.documents:[]),...(Array.isArray(plan.expenses)?plan.expenses:[])]){
  const details=doc.invoice&&typeof doc.invoice==='object'?doc.invoice:doc,lines=details.lines;
  const total=number(doc.total??doc.amount??details.total),net=number(details.net??doc.invoice_net),vat=number(details.kdv??doc.invoice_kdv);
  if(total!=null&&net!=null&&vat!=null&&Math.abs(net+vat-total)>.02){result.push('Fiş ara toplamı ve genel toplamı uyuşmuyor');break;}
  if(total!=null&&Array.isArray(lines)&&lines.length&&lines.every(l=>number(l.amount??l.total)!=null)&&Math.abs(lines.reduce((sum,l)=>sum+number(l.amount??l.total),0)-(net??total))>.02){result.push('Fiş satırları ve genel toplamı uyuşmuyor');break;}
 }
 return [...new Set(result)];
}
export function recoverableSchemaError(error){if(/^Plan satır sınırı aşıldı: [a-z_]+$/i.test(error?.message||''))return true;return error?.code!=='ASSISTANT_ABORT'&&error?.name!=='AbortError'&&!/çok büyük|en fazla|sınır|böl|limit/i.test(error?.message||'')&&/JSON|şema|planı döndürmedi|listesi geçersiz|satırı eksik veya bozuk/i.test(error?.message||'');}

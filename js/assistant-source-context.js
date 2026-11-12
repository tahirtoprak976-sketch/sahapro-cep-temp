import {canonicalVehicleType} from './vehicle-type-core.js';
import {businessRules,bossDispatch,bossNames} from './assistant-business-rules.js';
import {jobFor,checkDeal} from './job-core.js';
// Phone-side interpretation of registered WhatsApp senders. No writes, prices or model authority.
import {foldTr} from './parser.js';
import {isActive} from './core.js';
import {senderPersonnel} from './assistant-rules.js';
const PROOF=Symbol('phone-source-proof');
const live=(d,k)=>(d[k]||[]).filter(isActive);
const norm=s=>foldTr(String(s||'')).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const compact=s=>norm(s).replace(/ /g,'');
const quoteBody=s=>String(s||'').replace(/^\[[^\]]+\]\s*[^:]+:\s*/, '');
const unique=xs=>[...new Set(xs)];
const months=['ocak','subat','mart','nisan','mayis','haziran','temmuz','agustos','eylul','ekim','kasim','aralik'];
const num=s=>/^\d/.test(norm(s))?Number(foldTr(String(s)).replace(/\s/g,'').replace('bucuk','.5').replace(',','.')):({bir:1,iki:2,uc:3,dort:4,bes:5,alti:6,yedi:7,sekiz:8,dokuz:9,on:10,'iki bucuk':2.5}[norm(s)]??null);
const iso=(y,m,day)=>{const s=`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`,v=new Date(s+'T12:00:00Z');return !Number.isNaN(+v)&&v.toISOString().slice(0,10)===s?s:null;};
const CERTAIN=(value,reason,source='source_row')=>({value,level:'KESIN',reason,source});
const INFERRED=(value,reason)=>({value,level:'CIKARIM',reason,source:'source_context'});
export const sourceProof=row=>row?.[PROOF]||null;
// Ephemeral phone provenance: never serialized into a business record or trusted from a model.
export function carrySourceProof(row,proof){if(proof)row[PROOF]=proof;return row;}
export function registeredMatches(d,store,text){
 const t=compact(text),singular={customers:'customer',sites:'site',vehicles:'vehicle',quarries:'quarry',dump_sites:'dump_site'}[store];
 const found=live(d,store).filter(r=>compact(r.name).length>=3&&t.includes(compact(r.name))||live(d,'aliases').some(a=>a.active!==false&&a.target_type===singular&&a.target_id===r.id&&compact(a.alias).length>=3&&t.includes(compact(a.alias))));
 return found;
}
// One character typo in a long registered site name: a unique local candidate,
// never a digit/address guess and never preferred over an exact match.
function siteMatches(d,text){
 const exact=registeredMatches(d,'sites',text);if(exact.length)return {rows:exact,inferred:false};
 const words=norm(text).split(' '),near=[];
 const oneEdit=(a,b)=>{if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,edits=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}return edits+(a.length-i)+(b.length-j)===1;};
 for(const site of live(d,'sites')){
  const names=[site.name,...live(d,'aliases').filter(a=>a.active!==false&&a.target_type==='site'&&a.target_id===site.id).map(a=>a.alias)];
  if(names.some(name=>{const n=norm(name),parts=n.split(' ');if(n.length<7||/\d/.test(n))return false;return words.some((_,i)=>{const token=words.slice(i,i+parts.length).join(' ');return [token,token.replace(/(?:dan|den|tan|ten|ya|ye|da|de)$/,'')].some(t=>oneEdit(n,t));});}))near.push(site);
 }
 return {rows:near,inferred:true};
}
function sourceDate(text,fallback,today,anchor=fallback){
 const dates=[],spans=[];let explicit=false,invalid=false;const n=foldTr(text);
 const add=value=>{explicit=true;if(value)dates.push(value);else invalid=true;};
 for(const m of text.matchAll(/(?<!\d)(\d{1,2})[./](\d{1,2})(?:[. /]+)(\d{4})(?!\d)/g)){spans.push([m.index,m.index+m[0].length]);add(iso(m[3],m[2],m[1]));}
 for(const m of text.matchAll(/(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/g)){spans.push([m.index,m.index+m[0].length]);add(iso(m[1],m[2],m[3]));}
 for(const m of text.matchAll(/(?<!\d)(\d{1,2})[./](\d{1,2})(?:[./](\d{4}|\d{2}))?(?![\d./])/g)){
  if(spans.some(([start,end])=>m.index>=start&&m.index<end)||/^\s*(?:saat|sefer|yevmiye|gun|litre|lt|l|ton|adet|tl|lira|bin|milyon|₺)(?![a-z])/u.test(foldTr(text.slice(m.index+m[0].length))))continue;
  add(iso(m[3]?(m[3].length===2?'20'+m[3]:m[3]):today.slice(0,4),m[2],m[1]));
 }
 for(const m of n.matchAll(/(?<!\d)(\d{1,2})\s*([a-z]+)(?:\s+(\d{4}))?/g)){const month=months.indexOf(m[2]);if(month>=0)add(iso(m[3]||today.slice(0,4),month+1,m[1]));}
 for(const m of n.matchAll(/(?:^|[^a-z])(evvelsi gun|evvelki gun|onceki gun|dunku|dun|bugunku|bugun|yarin)(?![a-z])/g)){
  const offsets={'evvelsi gun':-2,'evvelki gun':-2,'onceki gun':-2,dunku:-1,dun:-1,bugunku:0,bugun:0,yarin:1};
  const dt=anchor?new Date(anchor+'T12:00:00Z'):null;if(dt&&!Number.isNaN(+dt)){dt.setUTCDate(dt.getUTCDate()+offsets[m[1]]);add(dt.toISOString().slice(0,10));}else add(null);
 }
 const values=unique(dates);if(values.length>1)invalid=true;
 const date=invalid?null:values[0]||fallback;
 const dayNames=['pazar','pazartesi','sali','carsamba','persembe','cuma','cumartesi'],said=dayNames.findIndex(w=>new RegExp('(?:^|[^a-z])'+w+'(?:$|[^a-z])(?!\\s+(?:mesai|mesay|ucret|maas))').test(n));
 return {date,explicit,invalid,weekdayConflict:!!(date&&said>=0&&new Date(date+'T12:00:00Z').getUTCDay()!==said)};
}
function linesFor(message,d,today){
 const result=[];let sender=null,date=today,anchor=today,dateIssue=false,header='',weekdayConflict=false,block=0,datePart=0;
 for(const original of message.split(/\r?\n/)){
  let text=original;const m=/^\[(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?[^\]]*\]\s*([^:]+):\s*(.*)$/.exec(original);
  if(m){block++;datePart=0;sender=senderPersonnel(d,m[4],original);date=iso(m[3]?.length===2?'20'+m[3]:m[3]||today.slice(0,4),m[2],m[1]);anchor=date;dateIssue=!date;header=original.slice(0,original.length-m[5].length);text=m[5];weekdayConflict=false;}
  if(!sender||!text.trim())continue;
  const dt=sourceDate(text,date,today,anchor);if(dt.explicit){datePart++;date=dt.date;dateIssue=dt.invalid;weekdayConflict=dt.weekdayConflict;}
  if(!/[\p{L}]/u.test(text)||/^\s*\d{1,2}[./]\d{1,2}[. /]+\d{4}\s*$/.test(text))continue;
  result.push({text,original,header,sender,date,dateIssue,weekdayConflict,scope:{block,datePart,date,sender:sender.id}});
 }
 return result;
}
function splitMachines(line,d){
 const positions=[];const names=live(d,'vehicles').flatMap(v=>[v.name,...live(d,'aliases').filter(a=>a.target_type==='vehicle'&&a.target_id===v.id).map(a=>a.alias)]);
 for(const name of names)if(name.length>=3){const at=foldTr(line).indexOf(foldTr(name));if(at>0)positions.push(at);}
 for(const m of line.matchAll(/\d+\s*tonluk\s+makine/giu))if(m.index>0)positions.push(m.index);
 const cuts=unique(positions).sort((a,b)=>a-b).filter(at=>/calis|yukle|indir|veril|yapildi/.test(norm(line.slice(0,at))));
 if(!cuts.length)return [line];const out=[];let start=0;for(const end of [...cuts,line.length]){if(end>start)out.push(line.slice(start,end).trim());start=end;}return out;
}
const WORK_QUANTITY=/(\d+(?:[.,]\d+)?\s*(?:buçuk|bucuk)?|bir|iki\s*buçuk|iki|üç|uc|dört|dort|beş|bes)\s*(sefer|saat|yevmiye|gün|gun)(?![\p{L}])/giu;
const FUEL_QUANTITY=/(\d+(?:[.,]\d+)?)\s*(litre|lt|l)(?![\p{L}])/giu;
const MATERIALS=[['hafriyat',/hafriyat|harfiyat/],['moloz',/moloz/],['çöp',/cop/],['mıcır',/micir/],['kum',/(?:^| )kum(?: |dan|u|$)/],['gravak',/gravak/],['toprak',/toprak/],['taş',/(?:^| )tas(?: |$)/]];
function materialIn(text){const n=norm(text);return MATERIALS.find(([,re])=>re.test(n))?.[0]||null;}
function workType(unit,vehicle,material){
 if(unit==='Sefer')return {'hafriyat':'Hafriyat Nakliye',moloz:'Moloz Nakliye','çöp':'Çöp Nakliye','mıcır':'Mıcır Nakliye',kum:'Kum Nakliye',gravak:'Gravak Nakliye'}[material]||'Diğer';
 const type=canonicalVehicleType(vehicle?.type),registered=norm(vehicle?.type);return type==='Telehandler'||registered==='manitou'?'Manitou Çalışması':['JCB','Kazıcı Yükleyici'].includes(type)?'JCB Çalışması':registered==='mini ekskavator'?'Mini Kato Çalışması':'Makine Çalışması';
}
export function sourceCandidates(message,d,today,rulesText=''){
 const rules=businessRules(rulesText);
 const works=[],fuel=[];let prevSender=null,prevHeader=null,prevDatePart=null,context={};
 for(const line of linesFor(message,d,today)){
  if(line.sender.id!==prevSender||line.scope.block!==prevHeader||line.scope.datePart!==prevDatePart){context={};prevSender=line.sender.id;prevHeader=line.scope.block;prevDatePart=line.scope.datePart;}
  for(const text of splitMachines(line.text,d)){
   const n=norm(text);if(/(?:tahsil|avans|odeme|odeyecek|teklif|biz verdik|musteriye.*mazot)/.test(n))context={};if(/(?:odeme onda|gonderdi)/.test(n)&&!WORK_QUANTITY.test(text)&&!FUEL_QUANTITY.test(text)){WORK_QUANTITY.lastIndex=0;FUEL_QUANTITY.lastIndex=0;continue;}WORK_QUANTITY.lastIndex=0;FUEL_QUANTITY.lastIndex=0;
   const assigned=live(d,'vehicles').filter(v=>v.assignee_id===line.sender.id||v.id===line.sender.vehicle_id);
   const explicitVehicles=registeredMatches(d,'vehicles',text),unknownMachine=/\d+\s*tonluk\s+makine/iu.exec(text),vehicle=explicitVehicles.length===1?explicitVehicles[0]:unknownMachine||explicitVehicles.length>1?null:live(d,'vehicles').find(v=>v.id===(context.vehicle_id||(assigned.length===1?assigned[0].id:null)));
   const unknownVehicle=explicitVehicles.length>1||!!unknownMachine&&!explicitVehicles.length;
   const unknownVehicleLabel=explicitVehicles.length>1?'Birden fazla araç: '+explicitVehicles.map(v=>v.name).join(', '):unknownMachine?.[0];
   if(vehicle)context.vehicle_id=vehicle.id;if(unknownVehicle)context.vehicle_id=null;
   const dispatch=bossDispatch(text,d,rulesText),names=dispatch?bossNames(d,rulesText):[],blocked=live(d,'customers').filter(c=>names.some(name=>norm(name)===norm(c.name))).map(c=>c.id);
   const cs=registeredMatches(d,'customers',text).filter(c=>!blocked.includes(c.id)),siteEvidence=siteMatches(d,text),ss=siteEvidence.rows,site=ss.length===1?ss[0]:null;
   // Only explicit catalog matches or a quantity-led continuation may inherit a client.
   // An unknown place/name must not silently borrow the previous client's identity.
   const continuation=/^\s*\d+(?:[.,]\d+)?\s*(?:sefer|saat|yevmiye|tanesi)/iu.test(text);
   const unresolvedSite=site&&!site.customer_id?site:null;
   const customer=cs.length>1||ss.length>1?null:cs.length===1?cs[0]:site?live(d,'customers').find(c=>c.id===site.customer_id):continuation?live(d,'customers').find(c=>c.id===context.customer_id):null;
   if(!customer){context.customer_id=null;context.site_id=null;if(!continuation)context.material=null;}
   else {if(context.customer_id!==customer.id||site&&site.id!==context.site_id)context.material=null;context.customer_id=customer.id;context.site_id=site?.id||(continuation?context.site_id:null)||null;}
   const newCustomer=null;
   const inheritedSite=site||live(d,'sites').find(s=>s.id===context.site_id&&s.customer_id===customer?.id);
   const material=materialIn(text)||context.material||null;if(material)context.material=material;
   const quarries=registeredMatches(d,'quarries',text),dumps=registeredMatches(d,'dump_sites',text),own=live(d,'dump_sites').find(s=>s.own_yard);
   const yardMention=value=>{const scope=rules.yardIsOwn?value:String(value).replace(/şant[ıi]ye(?:den|ye)?/giu,'');return !!own&&(registeredMatches(d,'dump_sites',scope).some(x=>x.id===own.id)||rules.yardIsOwn&&/(?:^| )santiye(?:den|ye)?(?: |$)/.test(norm(scope)));};
   const allowedDumps=dumps.filter(x=>!x.own_yard||yardMention(text)),dump=allowedDumps.length===1?allowedDumps[0]:yardMention(text)?own:null;
   const fuels=[...text.matchAll(FUEL_QUANTITY)];
   if(fuels.length&&/mazot|yakit|motorin/.test(n)&&/alindi|aldim|aldi|doldur/.test(n))for(const q of fuels){
    const row={date:line.date,vehicle_id:vehicle?.id||null,liters:Number(q[1].replace(',','.')),source:yardMention(text)?'Depo Tankı':undefined,quote:text};
    row[PROOF]={scope:{...line.scope,customer:customer?.id||null,site:site?.id||context.site_id||null},sender:line.sender,dateIssue:line.dateIssue,weekdayConflict:line.weekdayConflict,unknownVehicle:unknownVehicle?unknownVehicleLabel:null,fields:{date:INFERRED(line.date,'WhatsApp satırının tarihi'),...(vehicle?{vehicle_id:explicitVehicles.length?CERTAIN(vehicle.id,'Satırdaki kayıtlı araç'):INFERRED(vehicle.id,'Aynı gönderenin araç bağlamı / zimmeti')}:{}),liters:CERTAIN(row.liters,'Satırdaki açık litre')}};fuel.push(row);
   }
   let quantities=[...text.matchAll(WORK_QUANTITY)].map(q=>({quantity:num(q[1]),unit:/sefer/i.test(q[2])?'Sefer':/saat/i.test(q[2])?'Saat':'Yevmiye',at:q.index,end:q.index+q[0].length}));
   if(!quantities.length&&/tam gun|yevmiye calis/.test(n))quantities=[{quantity:1,unit:'Yevmiye',at:0,end:0}];
   if(!quantities.length&&/yukle|calis|tasindi|tasima|verildi|indirildi/.test(n)&&!/^\s*pazar/.test(n)&&!fuels.length)quantities=[{quantity:null,unit:'Saat',at:0,end:0}];
   // Loading without duration is still a work card when fuel is reported in the same line.
   if(!quantities.length&&fuels.length&&/hafriyat yukleme/.test(n))quantities=[{quantity:null,unit:'Saat',at:0,end:0}];
   const distribution=[...text.matchAll(/(\d+)\s*(?:tanesi|tanesi)\s+([^\n]+?)(?=\d+\s*tanesi|$)/giu)];
   if(quantities.length===1&&quantities[0].unit==='Sefer'&&distribution.length>1&&distribution.reduce((s,m)=>s+Number(m[1]),0)===quantities[0].quantity)quantities=distribution.map(m=>({quantity:Number(m[1]),unit:'Sefer',at:m.index,end:m.index+m[0].length,destination:m[2]}));
   for(let qi=0;qi<quantities.length;qi++){
    const q=quantities[qi],part=q.destination||text.slice(q.at,quantities[qi+1]?.at??text.length),partMaterial=materialIn(part)||material,partDumps=registeredMatches(d,'dump_sites',part).filter(x=>!x.own_yard||yardMention(part)),partYard=yardMention(part),dest=partDumps.length===1?partDumps[0]:partYard?own:quantities.length===1?dump:null;
    const row={date:line.date,date_source:'whatsapp',customer_id:customer?.id||null,new_customer:newCustomer,site_id:inheritedSite?.id||null,vehicle_id:vehicle?.id||null,personnel_id:line.sender.id,reporter:line.sender.name,quantity:q.quantity,unit:q.unit,work_type:workType(q.unit,vehicle,partMaterial),material:q.unit==='Saat'&&partMaterial==='hafriyat'&&/hafriyat yukleme/.test(n)?'hafriyat yükleme':partMaterial,quarry_id:(quantities.length===1||qi===0)&&quarries.length===1?quarries[0].id:null,dump_site_id:dest?.id||null,from_place:(quantities.length===1||qi===0)&&quarries.length===1?quarries[0].name:null,to_place:dest?.name||null,quote:text,description:text,note:rules.sundayPersonnelNote&&/pazar mesa[yi]*s/.test(n)?'Pazar mesaisi (personel ücreti; müşteri fiyatı değişmez)':''};
    const location=/([\p{L}'’]+\s+[\p{L}'’]+\s+evinin\s+arkası)/iu.exec(text);if(location&&customer&&!inheritedSite)row.new_site=location[1];
    const fields={date:INFERRED(line.date,'Satırdaki iş tarihi / WhatsApp başlığı'),personnel_id:CERTAIN(line.sender.id,'WhatsApp göndereni','sender_row'),work_type:INFERRED(row.work_type,'İşin birimi ve kayıtlı araç türü'),unit:CERTAIN(q.unit,'Satırdaki çalışma birimi')};
    if(q.destination&&dest){fields.dump_site_id=CERTAIN(dest.id,'Satırdaki açık sefer dağılımı ve kayıtlı döküm yeri');fields.to_place=CERTAIN(dest.name,'Satırdaki açık sefer dağılımı');}
    if(q.quantity!=null)fields.quantity=CERTAIN(q.quantity,'Satırdaki açık miktar / tam gün');
    if(vehicle)fields.vehicle_id=explicitVehicles.length?CERTAIN(vehicle.id,'Satırdaki kayıtlı araç'):INFERRED(vehicle.id,'Gönderenin zimmetli aracı / aynı mesaj araç bağlamı');
    if(customer)fields.customer_id=cs.length?CERTAIN(customer.id,'Satırdaki tek müşteri eşleşmesi'):INFERRED(customer.id,inheritedSite?'Şantiyenin kayıtlı müşterisi':'Aynı iş bloğunun müşteri bağlamı');
    if(inheritedSite)fields.site_id=ss.length&&!siteEvidence.inferred?CERTAIN(inheritedSite.id,'Satırdaki kayıtlı şantiye'):INFERRED(inheritedSite.id,siteEvidence.inferred?'Uzun şantiye adında tek harf farkıyla tek kayıt adayı':'Aynı sefer bloğunun şantiyesi');
    const job=jobFor(d,row),included=job&&!job.ambiguous&&!checkDeal(job.site.deal)&&job.site.deal.basis==='Sefer'&&row.unit!=='Sefer';
    row[PROOF]={scope:{...line.scope,customer:customer?.id||null,site:site?.id||context.site_id||null},sender:line.sender,dateIssue:line.dateIssue,unknownVehicle:unknownVehicle?unknownVehicleLabel:null,bossCustomerIds:blocked,bossNames:names,unknownCustomer:unresolvedSite?.name||(!customer&&dispatch?'İşi isteyen müşteri':null),place:unresolvedSite?.name||null,weekdayConflict:line.weekdayConflict,includedWork:!!included,fields};works.push(row);
   }
  }
 }
 return {works,fuel};
}
export function prepareSourcePlan(plan,{message,d,today,rules=''}){
 if(/SP1:|\[DÜZELTME\]/.test(message)||plan.answer&&!plan.works?.length&&!plan.fuel?.length||!['works','fuel'].some(k=>Array.isArray(plan[k])))return plan;
 const candidates=sourceCandidates(message,d,today,rules);if(!candidates.works.length&&!candidates.fuel.length)return plan;
 const result={...plan};
 for(const group of ['works','fuel']){
  const old=plan[group]||[],used=new Set(),output=[];
  for(const c of candidates[group]){
   const candidatesOld=old.map((r,i)=>({r,i})).filter(x=>!used.has(x.i)&&!x.r.from_driver);
   const sameQuote=candidatesOld.filter(x=>x.r.quote&&compact(quoteBody(x.r.quote)).length>=12&&(compact(c.quote).includes(compact(quoteBody(x.r.quote)))||compact(quoteBody(x.r.quote)).includes(compact(c.quote))));
   const ranked=(sameQuote.length?sameQuote:candidatesOld.filter(x=>!x.r.quote&&norm(x.r.reporter)===norm(c.reporter)&&Number(x.r.quantity??x.r.liters)===Number(c.quantity??c.liters))).map(x=>({...x,score:(x.r.date===c.date?2:0)+(x.r.customer_id&&x.r.customer_id===c.customer_id?4:0)+(x.r.vehicle_id&&x.r.vehicle_id===c.vehicle_id?3:0)+(Number(x.r.quantity??x.r.liters)===Number(c.quantity??c.liters)?20:0)+(x.r.unit&&x.r.unit===c.unit?2:0)})).sort((a,b)=>b.score-a.score);
   const match=ranked[0]&&(sameQuote.length||ranked[0].score>=5)?ranked[0]:null;
   if(match){used.add(match.i);const original=match.r,proof=c[PROOF],merged={...c,...original};
    if(group==='fuel'&&c.source==='Depo Tankı'){merged.source='Depo Tankı';merged.customer_id=null;}
    merged.reporter=c.reporter;merged.personnel_id=c.personnel_id;
    if(proof.bossCustomerIds?.includes(merged.customer_id))merged.customer_id=c.customer_id||null;
    if(proof.bossNames?.some(name=>norm(name)===norm(merged.new_customer)))merged.new_customer=null;
    const dateMismatch=!!(original.date&&original.date!==c.date);merged.date=c.date;
    for(const key of ['customer_id','site_id'])if(c[key]!=null&&c[key]!=='')merged[key]=c[key];
    if(proof.fields.vehicle_id?.level==='KESIN')merged.vehicle_id=c.vehicle_id;
    if(proof.fields.quantity)merged.quantity=c.quantity;
    if(c.unit)merged.unit=c.unit;
    if(proof.fields.dump_site_id){merged.dump_site_id=c.dump_site_id;merged.to_place=c.to_place;}
    for(const key of ['date','customer_id','site_id','vehicle_id','personnel_id','work_type','quantity','unit','material','quarry_id','dump_site_id','from_place','to_place','new_site','new_customer'])if(merged[key]==null||merged[key]==='')merged[key]=c[key];
    // Source metadata only describes fields actually matching phone evidence, never invented model values.
    const fields=Object.fromEntries(Object.entries(proof.fields).filter(([key,v])=>merged[key]===v.value));
    merged[PROOF]={...proof,fields,dateMismatch};if(c.note&&!String(merged.note||'').includes(c.note))merged.note=[merged.note,c.note].filter(Boolean).join(' · ');output.push(merged);
   }else output.push(c);
  }
  for(const [i,r]of old.entries())if(!used.has(i)){
   // Some parser bridges mistake a date fragment for a trip quantity. Reject only
   // date-only prefixes covered by a complete phone-verified work line, without money.
   if(group==='works'&&r.quote&&!['unit_price','amount','total','cost'].some(k=>r[k]!=null)&&/\d{1,2}[./]\d{1,2}/.test(r.quote)&&!new RegExp(WORK_QUANTITY.source,'iu').test(r.quote)&&!/(?:calis|yukle|indir|veril|yevmiye|tam gun)/.test(norm(r.quote))&&candidates.works.some(c=>compact(c.quote).includes(compact(quoteBody(r.quote)))))continue;
   if(group==='fuel'&&/mazot tank[ıi].*yüklendi/iu.test(r.quote||'')&&!/\d+\s*(?:lt|litre)/iu.test(r.quote||''))continue;
   output.push(r);
  }
  result[group]=output;
 }
 return result;
}

export const OPERATIONAL_GUIDANCE=[
 'Kişi, müşteri ve şantiye diğer adlarını yalnız onaylı alias kayıtlarından çöz; listede olmayan adres için müşteri uydurma.',
 'Sözleşmeye dahil işi sites.deal kaydından belirle. Boş sözleşme fiyatı sıfır değildir; geçmiş fiyat teklifini yeni fiyat kuralı sayma.',
 'Gönderenin kayıtlı tek zimmeti çıkarımdır; birden çok araçta seçim yapma.',
 'Açık iş tarihi başlık tarihinden önceliklidir; çelişkide kullanıcıya sor. Fotoğraf tarih çelişkisini başka çıkarımla bastırma.',
 'Miktarı birimiyle oku; süre eksikse sor. Tam gün bir yevmiyedir. Mazot tankı yüklendi bir yük taşıma işidir, yakıt alımı değildir.',
 'Farklı araçların işleri ayrıdır. Küçük litreyi sırf küçük olduğu için reddetme.'
];

// Bounded local block evidence for model input; no amounts, authority flags or arbitrary stores.
export function sourceContextHints(message,d,today,rules=''){
 const p=sourceCandidates(message,d,today,rules);
 return ['works','fuel'].flatMap(group=>p[group].map(r=>{const proof=sourceProof(r);return {kind:group==='works'?'work':'fuel',quote:r.quote.slice(0,1600),date:r.date,block:proof.scope.block,datePart:proof.scope.datePart,sender_id:proof.sender.id,fields:proof.fields,date_needs_confirmation:!!(proof.dateIssue||proof.weekdayConflict)};})).slice(0,100);
}

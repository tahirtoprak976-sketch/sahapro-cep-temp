// Phone-side evidence only. Model confidence, counts and explanations are never authority.
import {isActive} from './core.js';
import {foldTr} from './parser.js';
import {vehicleNamed} from './assistant-rules.js';
import {customerSpans} from './money-roles.js';
import {openJobs,jobFor} from './job-core.js';
import {isMachineKind,vehicleTypeInfo} from './vehicle-type-core.js';
export const CONFIDENCE=Object.freeze({CERTAIN:'KESIN',INFERRED:'CIKARIM',UNKNOWN:'BILINMIYOR'});
const live=(d,k)=>(d[k]||[]).filter(isActive);
const norm=s=>foldTr(String(s||'')).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const contains=(text,name)=>!!norm(name)&&(' '+norm(text)+' ').includes(' '+norm(name)+' ');
const unique=xs=>[...new Set(xs)];
const evidence=(value,level,reason,source)=>({value,level,reason,source});
const unknown=reason=>evidence(null,CONFIDENCE.UNKNOWN,reason,'none');
const certain=(v,reason='Mesaj/fiş doğrulamasından',source='message')=>v==null||v===''?unknown('Bilgi bulunamadı'):evidence(v,CONFIDENCE.CERTAIN,reason,source);
const inferred=(v,reason,source)=>evidence(v,CONFIDENCE.INFERRED,reason,source);
function reference(d,store,id,text,type){
 const rows=live(d,store),chosen=rows.find(x=>x.id===id);
 if(!chosen)return unknown('Kart bulunamadı');
 if(type==='vehicle')return vehicleNamed(d,chosen,text)?certain(id,'Mesajdaki kayıtlı araç','message'):unknown('Araç mesajda doğrulanamadı');
 const named=rows.filter(x=>contains(text,x.name)).map(x=>x.id);
 const aliases=live(d,'aliases').filter(a=>a.active!==false&&a.target_type===type&&contains(text,a.alias)).map(a=>a.target_id);
 const ids=unique([...named,...aliases]);
 if(ids.length)return ids.length===1&&ids[0]===id?certain(id,aliases.includes(id)?'Kayıtlı tek takma ad':'Mesajdaki tek kart eşleşmesi',aliases.includes(id)?'alias':'message'):unknown('Birden fazla gerçek kart adayı');
 if(['customer','supplier','bank'].includes(type)){
  const spans=unique(customerSpans(text,rows,type==='customer'?live(d,'aliases'):[]).map(x=>x.id));
  if(spans.length===1&&spans[0]===id)return certain(id,'Mesajdaki adın tek kayıtlı eşleşmesi');
 }
 if(type==='personnel'){
  const first=norm(chosen.name).split(' ')[0],hits=rows.filter(x=>norm(x.name).split(' ')[0]===first);
  if(first.length>=3&&hits.length===1&&norm(text).split(' ').some(t=>t===first||t.startsWith(first+"'")||t.startsWith(first+'a')||t.startsWith(first+'e')))return certain(id,'Mesajdaki tek personel adı');
 }
 return unknown('Mesajda kesin kart eşleşmesi yok');
}
// Resolve only a missing/previously guessed customer, never override a conflicting real candidate.
export function fillWorkEvidence(r,{d,text,hasUnknownName=false,negative=false}={}){
 r._fieldEvidence={};
 if(r.fromDriver||r.badNew||r.badQuote||r.ambiguous||r.parentMismatch||r.hinted||negative||r.new_customer)return;
 const customers=live(d,'customers'),byId=id=>customers.find(c=>c.id===id);
 if(hasUnknownName&&!live(d,'aliases').some(a=>a.active!==false&&a.target_type==='customer'&&byId(a.target_id)&&contains(String(hasUnknownName),a.alias)))return;
 const named=unique([...customers.filter(c=>contains(text,c.name)).map(c=>c.id),...live(d,'aliases').filter(a=>a.active!==false&&a.target_type==='customer'&&contains(text,a.alias)).map(a=>a.target_id)]);
 const candidates=named.length?named:unique(customerSpans(text,customers,live(d,'aliases')).map(x=>x.id));
 if(candidates.length>1||candidates.some(id=>!byId(id)))return;
 if(!r.customer_id||r.customerGuess){
  let match=null;
  const explicit=customers.filter(c=>reference(d,'customers',c.id,text,'customer').level===CONFIDENCE.CERTAIN);
  if(explicit.length===1)match={id:explicit[0].id,proof:reference(d,'customers',explicit[0].id,text,'customer')};
  const sites=live(d,'sites').filter(s=>byId(s.customer_id)&&contains(text,s.name));
  const siteOwners=unique(sites.map(s=>s.customer_id));
  if(!match&&siteOwners.length>1)return;
  if(!match&&siteOwners.length===1){const site=sites.length===1?sites[0]:null;match={id:siteOwners[0],site,proof:inferred(siteOwners[0],'Mesajdaki şantiyenin tek kayıtlı müşterisi','site_owner')};}
  if(!match&&!r.dateUnsure&&r.vehicle_id&&!r.vehicleGuess){
   const works=live(d,'work_records').filter(w=>w.vehicle_id===r.vehicle_id&&w.date===r.date&&byId(w.customer_id));
   if(works.length===1)match={id:works[0].customer_id,proof:inferred(works[0].customer_id,'Aynı gün bu aracın tek kayıtlı işi','vehicle_day')};
  }
  if(!match&&customers.length===1)match={id:customers[0].id,proof:inferred(customers[0].id,'Kayıtlarda tek müşteri adayı','single_customer')};
  if(match&&(!r.customer_id||r.customer_id===match.id)){
   r.customer_id=match.id;r.customerGuess=false;r._fieldEvidence.customer_id=match.proof;
   if(match.site&&!r.site_id){r.site_id=match.site.id;r._fieldEvidence.site_id=certain(match.site.id,'Mesajdaki tek şantiye');}
   for(let i=r.issues.length-1;i>=0;i--)if(/^Müşteri (mesajda yazmıyor|seçilmeli)/.test(r.issues[i]))r.issues.splice(i,1);
  }
 }
 if(r.customer_id&&!r.customerGuess&&!r.site_id&&!r.new_site&&!r.siteHint){
  const jobs=openJobs(d,r.customer_id,r.date);
  if(jobs.length===1){r.site_id=jobs[0].id;r._fieldEvidence.site_id=inferred(jobs[0].id,'Müşterinin bu tarihte tek açık iş sözleşmesi','open_job');}
 }
}
function typeEvidence(r,d,text){
 if(!r.work_type||r.typeDoubt)return unknown('İş türü doğrulanamadı');
 if(contains(text,r.work_type))return certain(r.work_type);
 const words={"Moloz Nakliye":'moloz',"Hafriyat Nakliye":'hafriyat',"Çöp Nakliye":'cop',"Mıcır Nakliye":'micir',"Kum Nakliye":'kum',"Gravak Nakliye":'gravak',"Makine Çalışması":'calis',"Kazı":'kazi',"Yıkım":'yikim',"Kırım":'kirim',"Tesviye":'tesviye',"Yükleme":'yukle'};
 const keyword=words[r.work_type];
 const v=live(d,'vehicles').find(x=>x.id===r.vehicle_id);
 const specific={'JCB Çalışması':'jcb','Mini Kato Çalışması':'mini','Manitou Çalışması':'manitou','Vinç Çalışması':'vinc','Lowbed Nakliye':'lowbed'}[r.work_type];
 if(specific&&v&&norm(v.name+' '+(v.type||'')).includes(specific))return inferred(r.work_type,'Kayıtlı araç kartındaki çalışma türü','vehicle_type');
 if(r.work_type==='Hafriyat Nakliye'&&/harfiyat/.test(norm(text)))return certain(r.work_type,'Mesajdaki hafriyat ifadesi');
 if(r.work_type==='Makine Çalışması'&&['Saat','Yevmiye'].includes(r.unit)&&v&&isMachineKind(v))return inferred(r.work_type,'Kayıtlı iş makinesi ve çalışma birimi','vehicle_type');
 if(keyword&&norm(text).split(' ').some(t=>t.startsWith(keyword)))return certain(r.work_type,'Mesajdaki iş ifadesi');
 if(r.work_type==='Makine Çalışması'&&r.unit==='Yevmiye'&&v&&!vehicleTypeInfo(v).family&&/tonluk|kato|kepce/.test(norm(v.name)))return inferred(r.work_type,'Kayıtlı araç adı ve yevmiye çalışma birimi','vehicle_name_unit');
 if(r.work_type==='Diğer')return inferred(r.work_type,'Belirli tür bulunamadı; genel iş sınıfı','default_category');
 const same=live(d,'work_records').filter(w=>w.vehicle_id===r.vehicle_id&&w.customer_id===r.customer_id&&w.date===r.date&&w.unit===r.unit);
 if(same.length===1&&same[0].work_type===r.work_type)return inferred(r.work_type,'Aynı gün aracın tek işindeki tür ve birim','vehicle_day_type');
 return unknown('İş türünün mesaj/kayıt dayanağı yok');
}
function unitEvidence(r,d,text){
 const units={Saat:/(?:^|[^a-z])saat/,Sefer:/(?:^|[^a-z])sefer/,Yevmiye:/(?:^|[^a-z])(?:yevmiye|gun)/,Ton:/(?:^|[^a-z])ton(?!luk)/,'m³':/(?:^|[^a-z])(?:m³|m3|metrekup)/,Adet:/(?:^|[^a-z])adet/};
 if(!r.unit)return unknown('Birim bulunamadı');
 if(r.fromDriver)return certain(r.unit,'Şoför ekranında seçilen alan','driver');
 const found=Object.entries(units).filter(([,re])=>re.test(foldTr(text))).map(([u])=>u);
 if(found.length===1&&found[0]===r.unit)return certain(r.unit,'Mesajda açık çalışma birimi');
 if(found.length)return unknown('Mesajdaki birim bu satıra kesin bağlanamadı');
 const previous=live(d,'work_records').filter(w=>w.date===r.date&&w.vehicle_id===r.vehicle_id&&w.customer_id===r.customer_id);
 if(previous.length===1&&previous[0].unit===r.unit)return inferred(r.unit,'Aynı gün aracın tek işindeki çalışma birimi','vehicle_day_unit');
 return unknown('Birim için mesaj/kayıt dayanağı yok');
}
const required={work:['date','customer_id','vehicle_id','work_type','quantity','unit'],expense:['date','amount','category'],fuel:['date','vehicle_id','liters','source'],tank:['date','liters'],collection:['date','customer_id','amount','method'],personnel:['date','personnel_id','event_type'],maintenance:['date','vehicle_id','description']};
export function confidenceReady(row,kind='work'){
 if(!row.fieldConfidence)return true;
 const fields=[...(required[kind]||[])];
 if(kind==='fuel'&&row.source==='Müşteri Verdi')fields.push('customer_id');
 if(kind==='collection'&&row.method==='Havale')fields.push('bank_account_id');
 if(kind==='expense'&&row.payment_method==='Personel Ödedi')fields.push('paid_by');
 if((kind==='expense'||kind==='maintenance')&&row.credit)fields.push('supplier_id');
 if(kind==='maintenance'&&row.credit)fields.push('cost');
 return fields.every(k=>row.fieldConfidence[k]?.level!==CONFIDENCE.UNKNOWN&&row.fieldConfidence[k]?.value!=null&&row.fieldConfidence[k]?.value!=='');
}
export function annotateConfidence(r,kind,{d,text,fullMessage=text,today,original={}}={}){
 const f={},certainValue=(k,reason)=>{f[k]=certain(r[k],reason);};
 if('date' in r){
  const parts=String(r.date||'').split('-'),[y,m,day]=parts,months=['ocak','subat','mart','nisan','mayis','haziran','temmuz','agustos','eylul','ekim','kasim','aralik'];
  const dates=r.date?[r.date,`${day}.${m}.${y}`,`${Number(day)}.${Number(m)}.${y}`,`${day}/${m}/${String(y).slice(-2)}`,`${Number(day)}/${Number(m)}/${String(y).slice(-2)}`,`${Number(day)} ${months[Number(m)-1]} ${y}`]:[];
  const yesterday=new Date(today+'T12:00:00Z');yesterday.setUTCDate(yesterday.getUTCDate()-1);
  const explicit=dates.some(x=>contains(text,x))||contains(text,'bugün')&&r.date===today||contains(text,'dün')&&r.date===yesterday.toISOString().slice(0,10);
  f.date=r.date&&!r.dateUnsure?(explicit?certain(r.date,'Mesajdaki tarih'):r.date===today?inferred(r.date,'Tarih yazılmamış; mevcut işlem günü varsayılanı','default_date'):unknown('Eski tarih mesajda doğrulanmalı')):unknown('Tarih doğrulanmalı');
 }
 if(r.fromDriver&&r.date&&!r.dateUnsure)f.date=certain(r.date,'Şoför ekranında seçilen tarih','driver');
 for(const [key,store,type]of [['customer_id','customers','customer'],['vehicle_id','vehicles','vehicle'],['personnel_id','personnel','personnel'],['site_id','sites','site'],['supplier_id','suppliers','supplier'],['bank_account_id','bank_accounts','bank'],['paid_by','personnel','personnel']])if(key in r){
  f[key]=r.fromDriver?certain(r[key],'Şoför ekranında seçilen alan','driver'):reference(d,store,r[key],text,type);
 }
 if(kind==='expense'&&r.payment_method==='Personel Ödedi')f.payment_option=f.paid_by?.level===CONFIDENCE.UNKNOWN?unknown('Ödeyen personel doğrulanmalı'):{...f.paid_by,value:'p:'+r.paid_by};
 if(r.new_site)f.site_id=certain('new:'+r.new_site,'Mesajdaki yeni şantiye');
 if(r.new_customer)f.customer_id=r.badNew||r.customerGuess?unknown('Yeni müşteri doğrulanmalı'):certain('new:'+r.new_customer,'Mesajda açık yeni müşteri');
 if(r.ambiguous)f.customer_id=unknown('Birden fazla gerçek müşteri adayı');
 if(r.customerGuess||r.hinted)f.customer_id=unknown('Tek ve deterministik eşleşme bulunamadı');
 if(f.vehicle_id?.level===CONFIDENCE.UNKNOWN&&r.vehicle_id){const named=live(d,'vehicles').filter(v=>vehicleNamed(d,v,fullMessage));if(named.length===1&&named[0].id===r.vehicle_id&&!/\b\d{2}\s*[a-z]{1,3}\s*\d{2,5}\b/i.test(text))f.vehicle_id=inferred(r.vehicle_id,'Mesaj başlığındaki tek kayıtlı araç','message_vehicle');}
 if(r.yard==='out'&&r.customer_id)f.customer_id=inferred(r.customer_id,'Kendi depodan çıkış için kayıtlı iç iş müşterisi','own_yard');
 if(r.vehicleGuess)f.vehicle_id=unknown('Araç eşleşmesi doğrulanmalı');
 if(r.vehicleNote&&!r.vehicleGuess&&r.vehicle_id)f.vehicle_id=inferred(r.vehicle_id,'Kayıtlı gönderenin zimmetli aracı','assignment');
 for(const [k,v]of Object.entries(r._fieldEvidence||{}))f[k]=v;
 for(const k of ['amount','cost','total','unit_price','dump_cost','liters','hours_days'])if(k in r)certainValue(k,'Mesaj/ilgili fişte doğrulanan sayı');
 if('quantity'in r)f.quantity=r.guessed?unknown('Miktar için mesajda kanıt yok'):certain(r.quantity,'Mesajda doğrulanan miktar');
 if('unit'in r)f.unit=unitEvidence(r,d,text);
 if(kind==='work')f.work_type=r.fromDriver?certain(r.work_type,'Şoför ekranında seçilen alan','driver'):typeEvidence(r,d,text);
 for(const k of ['category','event_type','method','source','description'])if(k in r)certainValue(k,'Mevcut doğrulama kuralından');
 if(r.priceUncertain)f.unit_price=unknown('Mesajdaki fiyatın bu işe ait olduğu doğrulanmadı');
 const price=r.priceInfo?.summary&&!r.priceInfo.ambiguous&&r.priceInfo.candidates?.length===1?r.priceInfo.candidates[0]:null;
 const job=kind==='work'?jobFor(d,r):null;
 if(price&&(!job||job.ambiguous)&&!r.fuelAllowance?.only_pay&&r.yard!=='out'&&(f.date?.level===CONFIDENCE.CERTAIN||!price.valid_from&&!price.valid_to)&&!price.formula&&Number.isFinite(price.price)&&price.price>0&&!r.priceUncertain&&!r.price_pending&&!r.dateUnsure){
  f.effective_unit_price=certain(price.price,'Bu iş için tek geçerli kayıtlı fiyat kuralı','price_rule');
 }
 r.fieldConfidence=f;
 r.okData=r.okData??r.ok;
 r.ok=!!r.ok&&confidenceReady(r,kind)&&!r.needsApproval&&(r.price_pending||!r.priceInfo?.ambiguous);
 return r;
}
export function confidenceValue(row,key,fallback){const f=row.fieldConfidence?.[key];return f?(f.level===CONFIDENCE.UNKNOWN?null:f.value):fallback;}
export function invalidateConfidenceDate(row){if(row.fieldConfidence&&row.dateUnsure){row.fieldConfidence.date=unknown('Mesaj/fişte tarih doğrulanmalı');delete row.fieldConfidence.effective_unit_price;}}

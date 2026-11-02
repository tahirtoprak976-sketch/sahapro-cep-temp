import {vehicleTypeMatches,existingVehicle} from "./vehicle-type-core.js";
import {priceVehicleContext} from "./core.js";
// Asistan ile fiyat kuralı: "Leda'ya manitou saatliği 3000 TL uygula" → fiyat listesine müşteriye özel kural
// ve (isteğe bağlı) fiyatı boş / farklı olan eski işlere uygulama. SAF katman: kayıt yazmaz.
// Doğrulama: tutar mesajda yazmalı; müşteri, iş türü ve araç mesajda anılmalı; birim mesajdaki kelimeden.
import { isActive, WORK_TYPES, PRICE_VEHICLE_GROUPS, transportVehicleType, transportVehicleInfo, priceVehicleScope, stableStringify, rankPrices, priceForQuantity } from "./core.js";
import { foldTr } from "./parser.js";
import { moneyInText } from "./assistant-core.js";

const live = (d, s) => (d[s] || []).filter(isActive);
const norm = (s) => foldTr(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const words = (s) => norm(s).split(" ").filter(Boolean);
const GENERIC = new Set(["insaat", "yapi", "ltd", "sti", "as", "san", "tic", "hafriyat", "nakliyat", "nakliye", "taahhut", "muhendislik", "mimarlik", "grup", "bey", "hanim", "usta", "abi"]);
const TYPE_STOP = new Set(["nakliye", "calismasi"]);
// Mesajdaki kelime, adın kelimesiyle başlıyorsa (Türkçe ek: "ledaya", "manitouya") anılmış sayılır
const said = (w, msgWords) => w.length >= 3 && msgWords.some((m) => m === w || (m.startsWith(w) && m.length - w.length <= 5));

export const UNIT_WORDS = [
  ["Saat", /\bsaat/],
  ["Sefer", /\bsefer|\btur\b|\bgidis/],
  ["Yevmiye", /\byevmiye|\bgunluk|\bgun\b/],
  ["Ton", /\bton\b|\btonu\b|\btonluk\b/],
  ["m³", /\bm3\b|\bkup\b|\bmetrekup/],
  ["Adet", /\badet|\btane/],
];
export function unitInText(text) {
  const t = ` ${norm(text)} `;
  return UNIT_WORDS.filter(([, re]) => re.test(t)).map(([u]) => u);
}

export function customerNamed(c, text) {
  const mw = words(text);
  const tw = words(c.name).filter((w) => !GENERIC.has(w));
  return tw.length > 0 && tw.some((w) => said(w, mw));
}
export function workTypeNamed(type, text) {
  const mw = words(text);
  const tw = words(type).filter((w) => !TYPE_STOP.has(w));
  return tw.length > 0 && tw.every((w) => said(w, mw));
}
export function vehicleNamedIn(v, text) {
  const mw = words(text);
  const tw = words(v.name).filter((w) => !/^\d+$/.test(w) && w.length >= 3 && !GENERIC.has(w));
  return tw.length > 0 && said(tw[0], mw);
}

function differentWorkPrice(rule,w){
 const p=w.price_snapshot,expected=priceForQuantity({price:Number(rule.price)},Number(w.quantity));
 return Math.abs(Number(p?.unit_price)-Number(rule.price))>0.001 ||
   (p?.amount!=null && (!Number.isFinite(Number(p.amount)) || Math.abs(Number(p.amount)-expected)>0.005)) ||
   !!p?.kdv_included!==!!rule.kdv_included;
}
// Bir kuralın kapsadığı eski işler
export function pastWorksFor(d, rule) {
  const out = { unpriced: [], differ: [], locked: 0 };
  for (const w of live(d, "work_records")) {
    if (rule.customer_id && w.customer_id !== rule.customer_id) continue;
    if (rule.site_id && w.site_id !== rule.site_id) continue;
    if (w.unit !== rule.unit) continue;
    if (rule.work_type && w.work_type !== rule.work_type) continue;
    if (rule.vehicle_id && w.vehicle_id !== rule.vehicle_id) continue;
    const vehicle = (d.vehicles||[]).find(v => v.id === w.vehicle_id), ctx=priceVehicleContext(w,vehicle);
    if (!existingVehicle(vehicle)) continue;
    if (rule.vehicle_group && (ctx.vehicle_missing || !PRICE_VEHICLE_GROUPS[rule.vehicle_group]?.types.includes(transportVehicleType(ctx.vehicle_type,ctx.vehicle_name,ctx.vehicle_type_review)))) continue;
    if (rule.vehicle_type && !vehicleTypeMatches(rule.vehicle_type,ctx)) continue;
    if (rule.valid_from && w.date < rule.valid_from) continue;
    if (rule.valid_to && w.date > rule.valid_to) continue;
    if (w.fuel_rule_id || w.customer_fuel_allowance_l || ["Mazot karşılığı","Sözleşmeye dahil","İç iş (kendi depo)"].includes(w.price_snapshot?.price_source)) continue; // mazotla ödenen iş
    const p = w.price_snapshot;
    if (p?.locked || live(d,"hakedis").some(h=>h.status!=="İptal" && h.items?.some(i=>i.work_record_id===w.id))) { out.locked++; continue; } // hakedişe girmiş: dokunulmaz
    if (!p || p.unit_price == null || p.unit_price === "" || !Number.isFinite(Number(p.unit_price))) out.unpriced.push(w);
    else if (differentWorkPrice(rule,w)) out.differ.push(w);
  }
  return out;
}

export function sameRule(d, rule, {exactDates=false}={}) {
  return live(d, "price_book").find((e) => e.active !== false && e.unit === rule.unit
    && (e.customer_id || null) === (rule.customer_id || null) && (e.site_id || null) === (rule.site_id || null)
    && (e.work_type || null) === (rule.work_type || null) && (e.vehicle_id || null) === (rule.vehicle_id || null)
    && (e.vehicle_type || null) === (rule.vehicle_type || null) && (e.vehicle_group || null) === (rule.vehicle_group || null)
    && (!exactDates || (e.valid_from || null) === (rule.valid_from || null) && (e.valid_to || null) === (rule.valid_to || null))
    && !e.material && e.distance_min == null && e.distance_max == null && !e.formula) || null;
}

export function priceSnapshotFor(rule, w, ruleId) {
  const q = Number(w.quantity) || 0;
  return {
    unit_price: Number(rule.price),
    kdv_rate: rule.kdv_rate ?? 20,
    kdv_included: !!rule.kdv_included,
    formula: null,
    amount: priceForQuantity({price:Number(rule.price)},q),
    price_source: rule.site_id ? "Şantiyeye Özel Fiyat" : rule.customer_id ? "Müşteriye Özel Fiyat" : "Genel Liste",
    price_scope: priceVehicleScope(rule),
    price_rule_id: ruleId || null,
    snapshot_at: new Date().toISOString(),
  };
}

export function validatePriceRules(plan, { message = "", d } = {}) {
  const out = [];
  const money = moneyInText(message);
  const units = unitInText(message);
  const customers = live(d, "customers"), vehicles = live(d, "vehicles");
  for (const p of (Array.isArray(plan?.price_rules) ? plan.price_rules : []).slice(0, 5)) {
    const issues = [];
    const n = Math.round(Number(p.price) * 100) / 100;
    const price = Number.isFinite(n) && n > 0 && money.has(n) ? n : null;
    if (!price) issues.push(p.price ? `Fiyat ${p.price} mesajda yazmıyor` : "Fiyat yok");
    // Birim: mesajdaki kelimeden; model başka birim dediyse mesajdaki geçerli
    let unit = units.includes(p.unit) ? p.unit : units.length === 1 ? units[0] : null;
    if (!unit) issues.push(units.length > 1 ? "Birim belirsiz (saat mi sefer mi?)" : "Birim mesajda yok (saatlik / sefer başı …)");
    // Müşteri
    let customer = p.customer_id ? customers.find((c) => c.id === p.customer_id) || null : null;
    if (customer && !customerNamed(customer, message)) { issues.push(`"${customer.name}" mesajda geçmiyor`); customer = null; }
    if (!customer) {
      const named = customers.filter((c) => !c.internal && customerNamed(c, message));
      if (named.length === 1) customer = named[0];
      else if (named.length > 1) issues.push("Birden fazla müşteri adı benziyor: " + named.slice(0, 3).map((c) => c.name).join(", "));
    }
    const newCustomer = !customer && p.new_customer && words(p.new_customer).some((w) => said(w, words(message))) ? String(p.new_customer).trim().slice(0, 80) : null;
    if (!customer && !newCustomer) issues.push("Müşteri seçilmedi: kural TÜM müşterilere uygulanır");
    const allSites = live(d, "sites"), namedSites = allSites.filter(s => siteNamed(s, message));
    const ownSites = namedSites.filter(s => s.customer_id === customer?.id);
    const hint = originSiteHint(message) || (p.site_name && siteNamed({name:p.site_name},message) ? String(p.site_name).trim().slice(0,80) : null);
    const site = ownSites.length === 1 ? ownSites[0] : null;
    const siteRequired = !!(site || hint || namedSites.length || p.site_id);
    if (ownSites.length > 1) issues.push("Şantiye belirsiz: aynı müşteride birden fazla şantiye eşleşiyor; şantiye seçin.");
    else if (siteRequired && !site) issues.push(`Şantiye seçin${hint ? ": " + hint : ""}. Başka müşterinin şantiyesi veya bulunamayan şantiye müşteri geneline uygulanmaz.`);
    const wt = WORK_TYPES.includes(p.work_type) && workTypeNamed(p.work_type, message) ? p.work_type : WORK_TYPES.find((t) => t !== "Diğer" && workTypeNamed(t, message)) || null;
    const namedVehicles = vehicles.filter(v => vehicleNamedIn(v,message));
    const veh = namedVehicles.length === 1 && !/^(kamyonet|kamyon|tir|cekici)$/.test(words(namedVehicles[0].name)[0]) ? namedVehicles[0] : null;
    const group = vehicleGroupInText(message);
    if (!veh && !group && namedVehicles.length > 1) issues.push("Araç belirsiz: birden fazla araç eşleşiyor; araç adını veya plakayı belirtin.");
    if (p.vehicle_group && !veh && !group) issues.push("Araç kapsamı doğrulanamadı; araç türünü mesajda netleştirin.");
    if (p.vehicle_id && !veh && !group) issues.push("Araç kapsamı doğrulanamadı; araç adını veya plakayı belirtin.");
    const base = { customer_id: customer?.id || null, site_id: site?.id || null, unit, price, kdv_rate: 20, kdv_included: false, valid_from: null };
    // Every named restriction is an AND condition. Never rank broader alternatives by job count.
    const scope = { key:"combined", work_type:wt, vehicle_id:veh?.id || null, vehicle_group:veh ? null : group, vehicle_type:null };
    scope.label = [wt, veh?.name || (group && PRICE_VEHICLE_GROUPS[group].label)].filter(Boolean).join(" · ") || "Bu müşterinin tüm iş türleri ve araçları";
    const scopes = [scope];
    const rule = {...base,...scope};
    scope.existing = unit && price ? sameRule(d,rule,{exactDates:true}) : null;
    const pw = unit && price ? pastWorksFor(d,rule) : {unpriced:[],differ:[],locked:0};
    Object.assign(scope,{unpriced:pw.unpriced.length,differ:pw.differ.length,locked:pw.locked});
    out.push({ ...base, new_customer: newCustomer, apply_existing:priceApplicationIntent(message), site_required:siteRequired, site_hint:hint, scopes, issues, quote: String(p.quote || "").slice(0, 200),
      ok: !!(price && unit && (customer || newCustomer)) && !issues.some((x) => /mesajda yazmıyor|belirsiz|Birden fazla|Şantiye seçin|doğrulanamadı/.test(x)) });
  }
  return out;
}
// Yer adı (döküm sahası / ocak) mesajda anıldı mı: "Bolluca'ya", "göktürk dolguya"
const PLACE_STOP = new Set(["dokum", "sahasi", "saha", "dolgu", "dolgusu", "depo", "alani", "ocak", "ocagi", "son", "durak"]);
export function placeNamed(p, text) {
  const mw = words(text);
  const tw = words(p.name).filter((w) => !PLACE_STOP.has(w) && !/^\d+$/.test(w));
  return tw.length > 0 && said(tw[0], mw);
}

// Whole distinctive site name, including number: "Tarabya" matches "Tarabyadan";
// "Kemer No 53" never silently selects "Kemer No 54".
export function siteNamed(site,text) {
  const mw=words(text), tw=words(site.name).filter(w=>!["santiye","santiyesi","santiye­si","no"].includes(w));
  return tw.length>0 && tw.every(w=>/^\d+$/.test(w)?mw.includes(w):said(w,mw));
}
export function originSiteHint(text) {
  const match=norm(text).match(/(?:^| )([a-zçğıöşü0-9]+?)(?:dan|den|tan|ten) (?:kamyonet|kamyon|tir|cekici|alinan|aldigimiz|gelen)/);
  return match?.[1] || null;
}
export function vehicleGroupInText(text) {
  const t=norm(text);
  if (/\bkamyonet/.test(t)) return "VAN";
  if (/\bkamyon/.test(t) && /\b(?:tir|cekici)/.test(t)) return "TRUCK_TIR";
  if (/\bkamyon/.test(t)) return "TRUCK";
  if (/\b(?:tir|cekici)/.test(t)) return "TIR";
  return null;
}
export function priceCardRule(row,fields,d) {
  const customer=live(d,"customers").find(c=>c.id===fields.customer_id);
  if (!customer && !String(fields.customer_id||"").startsWith("new:")) throw Error("Fiyat kuralı için müşteri seçin.");
  const site=live(d,"sites").find(s=>s.id===fields.site_id && s.customer_id===customer?.id);
  if (fields.site_id!=="__all__" && !site) throw Error("Bu müşteriye ait şantiyeyi seçin; kural müşteri geneline genişletilmedi.");
  if(row.site_required && !site) throw Error("Mesajda şantiye belirtilmiş; bu fiyat için şantiye seçin.");
  const scope=row.scopes[Number(fields.scope)];
  if(!scope || !(Number(fields.price)>0) || !Number.isFinite(Number(fields.price)) || !["Saat","Sefer","Yevmiye","Ton","m³","Adet"].includes(fields.unit)) throw Error("Fiyat, birim veya kapsam eksik.");
  if(scope.vehicle_id && !live(d,"vehicles").some(v=>v.id===scope.vehicle_id))throw Error("Araç değişmiş veya silinmiş; yeniden inceleyin.");
  if(scope.vehicle_group && !PRICE_VEHICLE_GROUPS[scope.vehicle_group])throw Error("Araç grubu geçersiz.");
  if(row.issues.some(x=>/Araç belirsiz|Araç kapsamı doğrulanamadı/.test(x)))throw Error("Araç kapsamını mesajda netleştirip yeniden isteyin.");
  return {customer_id:fields.customer_id,site_id:site?.id||null,work_type:scope.work_type||null,vehicle_id:scope.vehicle_id||null,vehicle_group:scope.vehicle_group||null,vehicle_type:scope.vehicle_type||null,unit:fields.unit,price:Number(fields.price),kdv_rate:20,kdv_included:false,valid_from:null,valid_to:null};
}
export function priceRuleReview(d,rule,{unpriced=true,differ=false,bind_ids=[],applyExisting=false}={}) {
  if(typeof rule.price!=="number" || !(Number(rule.price)>0)||!Number.isFinite(Number(rule.price))||!["Saat","Sefer","Yevmiye","Ton","m³","Adet"].includes(rule.unit))throw Error("Fiyat veya birim geçersiz.");
  if(rule.work_type && !WORK_TYPES.includes(rule.work_type))throw Error("İş türü geçersiz.");
  if(rule.vehicle_group && (!PRICE_VEHICLE_GROUPS[rule.vehicle_group] || rule.vehicle_id || rule.vehicle_type))throw Error("Araç kapsamı geçersiz.");
  if(rule.vehicle_id && !live(d,"vehicles").some(v=>v.id===rule.vehicle_id))throw Error("Araç silinmiş veya bulunamadı.");
  const customer=live(d,"customers").find(c=>c.id===rule.customer_id && !c.internal);
  if(!customer && !String(rule.customer_id||"").startsWith("new:"))throw Error("Müşteri değişmiş veya silinmiş.");
  if(rule.site_id && !live(d,"sites").some(s=>s.id===rule.site_id && s.customer_id===rule.customer_id))throw Error("Şantiye bu müşteriye ait değil.");
  const old=sameRule(d,rule,{exactDates:true}), bounded=sameRule({...d,price_book:live(d,"price_book").filter(e=>e.valid_from||e.valid_to)},rule);
  if(bounded && (!rule.valid_from && !rule.valid_to))throw Error("Bu kapsamda tarih sınırlı fiyat var; Fiyat Listesi ekranından geçerlilik tarihleriyle inceleyin.");
  const matching=live(d,"price_book").filter(e=>sameRule({price_book:[e]},rule,{exactDates:true}));
  if(matching.length>1)throw Error("Aynı kapsamda birden fazla fiyat var; Fiyat Listesi ekranından inceleyin.");
  const pw=pastWorksFor(d,rule);
  if(!Array.isArray(bind_ids)||new Set(bind_ids).size!==bind_ids.length)throw Error("Şantiye bağlantısı seçimi geçersiz.");
  const analysis=priceApplicationRows(d,rule), bindings=bind_ids.map(id=>{
    const row=analysis.find(r=>r.work.id===id && r.status==='bind');
    if(!row)throw Error("Seçilen işin şantiye bağlantısı değişmiş veya kapsam dışında; yeniden inceleyin.");
    return row.work;
  });
  const todo=[...(unpriced?pw.unpriced:[]),...(differ?pw.differ:[]),...bindings].sort((a,b)=>a.id.localeCompare(b.id));
  const already=analysis.filter(r=>r.status==='already').length;
  if(applyExisting && !todo.length && !already)throw Error("Bu seçimle fiyatı değişecek iş yok. Aşağıdaki iş nedenlerini inceleyin; şantiyesi eksik işleri seçin veya yalnız fiyat listesine kayıt seçeneğini açıkça seçin.");
  if(todo.some(w=>!(Number(w.quantity)>0)||!Number.isFinite(Number(w.quantity)*rule.price)))throw Error("İş miktarı veya hesaplanan fiyat geçersiz.");
  for(const w of todo){
    const vehicle=live(d,"vehicles").find(v=>v.id===w.vehicle_id);
    if(w.price_snapshot?.formula || rankPrices(d.price_book||[],priceVehicleContext(w,vehicle)).some(x=>x.e.formula))throw Error("Formüllü fiyat bu karttan tek birim fiyata çevrilmez; işin tarifesini inceleyin.");
    if(!Number.isSafeInteger(Math.round(rule.price*Number(w.quantity)*100*2)))throw Error("Hesaplanan tutar geçersiz.");
  }
  const related=live(d,"work_records").filter(w=>w.customer_id===rule.customer_id && (!rule.work_type||w.work_type===rule.work_type) && w.unit===rule.unit && !w.site_id);
  const vehicleIds=new Set(analysis.map(r=>r.work.vehicle_id)),vehicleFacts=(d.vehicles||[]).filter(v=>vehicleIds.has(v.id)).map(v=>({id:v.id,name:v.name,type:v.type,type_review:v.type_review,updated_at:v.updated_at,deleted_at:v.deleted_at,active:v.active})).sort((a,b)=>a.id.localeCompare(b.id));
  const signature=stableStringify({rule,vehicleFacts,unpriced,differ,bind_ids:[...bind_ids].sort(),applyExisting,old:old||null,todo,locked:pw.locked});
  return {signature,old,pw,todo,bindings:bindings.map(w=>w.id),already,analysis,missingSite:rule.site_id?related.length:0};
}

export function priceApplicationIntent(message){
 const t=norm(message);
 if(/bundan sonra|yalniz yeni|sadece yeni|gelecek is|yalniz fiyat listesi|sadece fiyat listesi/.test(t))return false;
 return /(?:^| )(?:yap(?:alim|in|ilsin)?|guncelle(?:yelim|yin|nsin)?|degistir(?:elim|in|ilsin)?|uygula(?:yalim|yin|nsin)?|cevir(?:elim|in|ilsin)?)(?: |$)/.test(t);
}
function linkedPriceWorkSlip(d,w){return live(d,'slips').some(s=>(s.status!=='İptal'||s.signed_at)&&(s.id===w.slip_id||s.id===w.digital_slip_source_id||s.work_record_id===w.id||(s.work_record_ids||[]).includes(w.id)));}
// Explain every exclusion. A missing site may be bound only through an explicitly
// previewed row; a different recorded site is never overwritten by this command.
export function priceApplicationRows(d,rule){
 const site=live(d,'sites').find(s=>s.id===rule.site_id),out=[];
 for(const w of live(d,'work_records').filter(w=>w.customer_id===rule.customer_id && w.unit===rule.unit)){
  let reason='',status='blocked';
  const vehicle=(d.vehicles||[]).find(v=>v.id===w.vehicle_id),p=w.price_snapshot,ctx=priceVehicleContext(w,vehicle),info=transportVehicleInfo(ctx.vehicle_type,ctx.vehicle_name,ctx.vehicle_type_review);
  if(!existingVehicle(vehicle))reason='Araç kartı yok veya silinmiş';
  else if(rule.work_type && w.work_type!==rule.work_type)reason='İş türü farklı';
  else if(rule.vehicle_id && w.vehicle_id!==rule.vehicle_id)reason='Araç farklı';
  else if(rule.vehicle_group && !PRICE_VEHICLE_GROUPS[rule.vehicle_group]?.types.includes(info.type))reason=info.conflict?'Araç kartında ad ve tür çelişiyor':info.type?'Araç türü kapsam dışında':'Araç türü doğrulanamadı; kartı kontrol edin';
  else if(rule.vehicle_type&&!vehicleTypeMatches(rule.vehicle_type,ctx))reason='Araç türü kapsam dışında';
  else if(rule.site_id && w.site_id && w.site_id!==rule.site_id)reason='Başka şantiye kayıtlı';
  else if(p?.locked||live(d,'hakedis').some(h=>h.status!=='İptal'&&h.items?.some(i=>i.work_record_id===w.id)))reason='Hakedişe bağlı; fiyatı korunur';
  else if(w.fuel_rule_id||w.customer_fuel_allowance_l||['Mazot karşılığı','Sözleşmeye dahil','İç iş (kendi depo)'].includes(p?.price_source))reason='Mazot / sözleşme hesabı; bu işlemle değiştirilmez';
  else if(rule.valid_from&&w.date<rule.valid_from||rule.valid_to&&w.date>rule.valid_to)reason='Tarih kapsam dışında';
  else if(site&&!w.site_id){
   const source=[w.from_place,w.to_place,w.description,w.note].filter(Boolean).join(' ');
   if(!siteNamed(site,source))reason='Şantiye boş; kaynakta seçilen yer doğrulanamadı';
   else if(linkedPriceWorkSlip(d,w))reason='Şantiye boş ve dijital fişe bağlı; kaynak fişte inceleyin';
   else {status='bind';reason='Şantiye bağlanacak: '+site.name;}
  }else if(!p||p.unit_price==null||p.unit_price===''||!Number.isFinite(Number(p.unit_price))){status='unpriced';reason='Fiyatı boş';}
  else if(differentWorkPrice(rule,w)){status='differ';reason='Eski fiyat değişecek';}
  else {status='already';reason='Birim fiyat zaten aynı';}
  const names=site?live(d,'sites').filter(s=>s.customer_id===rule.customer_id&&siteNamed(s,w.from_place||'')):[];
  out.push({work:w,status,reason,vehicle:vehicle?.name||w.vehicle_id||'Araç yok',vehicleNote:info.note,suggested:status==='bind'&&names.length===1&&names[0].id===site.id});
 }
 return out.sort((a,b)=>String(b.work.date).localeCompare(String(a.work.date))||a.work.id.localeCompare(b.work.id));
}

// Some model responses use the generic card editor for prices. Route supported
// edits through the same work-level preview; never let an alternate tool silently
// update only price_book when the user asked to apply a price to existing jobs.
export function normalizePriceActionPlan(plan,d){
 const prices=[...(plan.price_rules||[])],actions=[];
 for(const action of plan.actions||[]){
  if(action?.op!=='update'||action.store!=='price_book'||!Object.hasOwn(action.fields||{},'price')){actions.push(action);continue;}
  const old=live(d,'price_book').find(r=>r.id===action.id);
  const simple=old&&old.active!==false&&!old.formula&&!old.material&&!old.vehicle_type&&!old.valid_from&&!old.valid_to&&old.distance_min==null&&old.distance_max==null&&Object.keys(action.fields).every(k=>k==='price');
  if(!simple){actions.push(action);continue;}
  const row={customer_id:old.customer_id||null,site_id:old.site_id||null,work_type:old.work_type||null,vehicle_id:old.vehicle_id||null,vehicle_group:old.vehicle_group||null,unit:old.unit,price:action.fields.price};
  if(!prices.some(p=>Number(p.price)===Number(row.price)&&(p.customer_id||null)===(row.customer_id||null)&&(p.site_id||null)===(row.site_id||null)&&p.unit===row.unit))prices.push(row);
 }
 return {...plan,price_rules:prices,actions};
}

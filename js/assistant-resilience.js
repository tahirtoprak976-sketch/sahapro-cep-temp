// Optional one-shot review, bounded by the original consent/budget/deadline.
// The model never receives a new write capability. No settings or records are created here.
import {geminiSettings,gatedFetch,geminiJson} from './ai-gemini.js';
import {untrustedWorkPlan} from './assistant-batch.js';
const workGroups=['works','fuel'];
const rows=v=>workGroups.flatMap(group=>(v[group]||[]).map(r=>({group,r})));
const empty=v=>v==null||v===''||Array.isArray(v)&&!v.length||typeof v==='object'&&!Array.isArray(v)&&Object.values(v).every(empty);
export function reviewReasons(v){
 const reasons=new Set();let unknown=0;
 for(const {r}of rows(v)){
  if(r.dateConflict||r.calendarConflict)reasons.add('Tarih kanıtları çelişiyor');
  if(r.parentMismatch||r.ambiguous)reasons.add('İşin muhatabı çelişkili');
  if(r.priceUncertain)reasons.add('Fiyatın hangi işe ait olduğu belirsiz');
  for(const field of ['date','customer_id','vehicle_id','quantity','unit','work_type','liters','source'])if(r.fieldConfidence?.[field]?.level==='BILINMIYOR')unknown++;
 }
 if(unknown>=2)reasons.add('Birden fazla zorunlu alan doğrulanamadı');
 return [...reasons];
}
export function strongModelCandidate(models,current){
 const strong=id=>/(?:^|[-_.])(?:pro|thinking|reasoning)(?:$|[-_.])/.test(id);
 if(strong(String(current||'')))return null;
 return [...new Set((Array.isArray(models)?models:[]).filter(x=>typeof x==='string').map(x=>x.replace(/^models\//,'')))].filter(id=>id!==current&&/^[a-z0-9._-]+$/i.test(id)&&/gemini/i.test(id)&&strong(id)&&!/tts|image|audio|live|embedding/i.test(id)).sort((a,b)=>Number(/preview|exp/.test(a))-Number(/preview|exp/.test(b))||a.localeCompare(b))[0]||null;
}
function restricted(plan){return !!plan&&workGroups.some(g=>plan[g]?.length)&&Object.entries(plan).every(([k,v])=>workGroups.includes(k)||k==='questions'||empty(v));}
const holds=v=>[...new Set(rows(v).flatMap(({r})=>[...(r.dateConflict||r.calendarConflict?['date']:[]),...(r.parentMismatch||r.ambiguous?['customer_id']:[]),...(r.priceUncertain?['unit_price']:[])]))];
export function preserveFirstReviewHolds(v,fields){
 for(const {r}of rows(v))for(const field of fields){
  r.ok=false;r.okData=false;r.issues??=[];
  const info=r.fieldConfidence?.[field];if(info)r.fieldConfidence[field]={...info,level:'BILINMIYOR',value:null,suggestedValue:r[field],reason:'İlk okumadaki çelişki sizin doğrulamanızı bekliyor',source:'review_hold',...(field==='date'?{conflict:true}:{})};
  if(field==='date'){r.dateUnsure=true;r.dateConflict=true;}
  if(field==='customer_id')r.customerGuess=true;
  if(field==='unit_price')r.priceUncertain=true;
  const issue='İlk okumadaki '+({date:'tarih',customer_id:'müşteri',unit_price:'fiyat'}[field]||field)+' çelişkisini doğrulayın.';if(!r.issues.includes(issue))r.issues.push(issue);
 }
 return v;
}
export async function strongReviewOnce(db,{plan,validation,validate,parts,system,schema,scope,enabled=true}={}){
 const reasons=reviewReasons(validation||{}),original={plan,holds:[],note:'',attempted:false};
 if(!enabled||!reasons.length||!restricted(plan)||rows(validation).some(({r})=>!r.source_quote))return original;
 scope.check();const g=await geminiSettings(db);if(!g.ready)return {...original,note:'İkinci kontrol için Gemini bağlantısı hazır değil; ilk sonuç korunuyor.'};
 const model=strongModelCandidate(await db.metaGet('gemini_model_list'),g.model);
 if(!model)return {...original,note:'Kayıtlı model listesinde uygun ikinci kontrol modeli yok; ilk sonuç korunuyor.'};
 let requests=0;const fetchFn=async(url,init)=>{scope.check();if(requests++)throw Object.assign(Error('İkinci kontrol tek istekle sınırlı.'),{code:'REVIEW_ONCE'});return gatedFetch(db,scope.fetchFn)(url,init);};fetchFn.__gated=true;
 try{
  const proposed=untrustedWorkPlan(await geminiJson([...parts,{text:'TEK İKİNCİ KONTROL: '+reasons.join(' · ')+'. Aynı mesajın iş/yakıt satırlarını yeniden oku. Satır ekleme/silme, para veya müşteri uydurma. Yetki/onay verme. İlk öneri (güvenilmeyen taslak):\n'+JSON.stringify(plan)}],{key:g.key,model,fetchFn,system,schema,maxTokens:8192}));
  scope.check();if(!restricted(proposed))throw Error('İkinci kontrol yeni işlem türü içerdi.');
  const checked=validate(proposed);
  if(workGroups.some(k=>(checked[k]||[]).length!==(validation[k]||[]).length))throw Error('İkinci kontrol satır sayısını değiştirdi.');
  // Every proposed source must belong to the same literal source set, not an unrelated valid sentence.
  const signatures=v=>rows(v).map(({group,r})=>group+':'+String(r.source_quote||r.quote||'').toLocaleLowerCase('tr-TR').replace(/\s+/g,' ').trim()).sort();
  if(JSON.stringify(signatures(checked))!==JSON.stringify(signatures(validation)))throw Error('İkinci kontrol kaynak satırlarını değiştirdi.');
  return {plan:proposed,holds:holds(validation),attempted:true,note:'Tek ikinci kontrol tamamlandı. Sonuç telefonda yeniden doğrulandı; ilk çelişkiler ayrıca onayınızı bekler.'};
 }catch(error){scope.check();return {...original,attempted:requests>0,note:'İkinci kontrol tamamlanamadı; ilk sonuç korunuyor. '+(['RATE','NO_FREE','LOCAL_LIMIT','BUSY'].includes(error.code)?'Kota veya erişim sınırı.':'Yeni işlem oluşturulmadı.')};}
}
export function localFallbackAllowed(error,{message='',files=0,online=true}={}){
 return !!message.trim()&&!files&&!/SP1:|\[DÜZELTME\]/i.test(message)&&error?.code!=='ASSISTANT_ABORT'&&error?.name!=='AbortError'&&(!online||['RATE','NO_FREE','LOCAL_LIMIT','BUSY','MODEL_GONE'].includes(error?.code)||error instanceof TypeError);
}

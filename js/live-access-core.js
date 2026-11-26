// Separate AES-GCM domain from the existing approved-packet mailbox.
export const LIVE_FORMAT='SAHAPRO_LIVE_ACCESS_V1';
export const LIVE_URL='https://oumoklilsujvjikjvtwu.supabase.co/functions/v1/solo-access';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function un64(s,max){if(typeof s!=='string'||s.length>max||!/^[A-Za-z0-9_-]+$/.test(s))throw Error('Şifreli içerik geçersiz');const b=Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));if(b64(b)!==s)throw Error('Şifreli içerik geçersiz');return b;}
const aad=h=>enc.encode(JSON.stringify([h.format,h.channel,h.id,h.direction,h.expires_at,h.iv]));
export function readLiveCode(code,channel){const p=String(code||'').trim().split('.');if(p.length!==3||p[0]!=='SPAL1'||!ID.test(p[1])||p[1]!==channel||un64(p[2],43).length!==32)throw Error('Bu telefona ait canlı bağlantı kodu gerekli');return {channel:p[1],token:p[2]};}
export async function sealLive(value,authority,id,direction,{now=Date.now(),expires=now+3600000}={}){
 if(!ID.test(id)||!ID.test(authority?.channel)||!['request','response'].includes(direction)||expires<=now||expires>now+86400000)throw Error('Canlı talep geçersiz');
 const plain=enc.encode(JSON.stringify(value));if(plain.length>600000)throw Error('Yanıt çok büyük; daha küçük sayfa isteyin');
 const h={format:LIVE_FORMAT,channel:authority.channel,id,direction,expires_at:new Date(expires).toISOString(),iv:b64(crypto.getRandomValues(new Uint8Array(12)))};
 return {...h,ciphertext:b64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:un64(h.iv,16),additionalData:aad(h)},authority.key,plain)))};
}
export async function openLive(box,authority,id,direction,{now=Date.now()}={}){
 const fields=['format','channel','id','direction','expires_at','iv','ciphertext'];
 if(!box||Object.keys(box).length!==fields.length||fields.some(k=>typeof box[k]!=='string')||box.format!==LIVE_FORMAT||box.channel!==authority?.channel||box.id!==id||!ID.test(id)||box.direction!==direction)throw Error('Canlı talep kimliği geçersiz');
 const expires=Date.parse(box.expires_at);if(!Number.isFinite(expires)||new Date(expires).toISOString()!==box.expires_at||expires<=now||expires>now+86400000)throw Error('Canlı talebin süresi dolmuş');
 const iv=un64(box.iv,16);if(iv.length!==12)throw Error('Şifreli içerik geçersiz');
 const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(box)},authority.key,un64(box.ciphertext,810000));
 if(raw.byteLength>600000)throw Error('Canlı talep çok büyük');return JSON.parse(dec.decode(raw));
}
const fields={
 customers:['id','name','active','created_at','updated_at','fuel_rules','fuel_per_trip'],
 sites:['id','name','customer_id','active','created_at','updated_at','deal'],
 vehicles:['id','name','plate','type','active','created_at','updated_at'],
 personnel:['id','name','active','created_at','updated_at'],
 dump_sites:['id','name','active','created_at','updated_at'],
 quarries:['id','name','active','created_at','updated_at'],
 price_book:['id','customer_id','site_id','vehicle_id','vehicle_group','vehicle_type','work_type','unit','price','formula','kdv_rate','kdv_included','valid_from','valid_to','active','updated_at']
};
export function catalogSpec(request){
 if(!request||request.type!=='catalog'||!Object.hasOwn(fields,request.store)||Object.keys(request).some(k=>!['type','store','after','limit'].includes(k)))throw Error('Desteklenmeyen okuma talebi');
 const limit=request.limit??25;if(!Number.isInteger(limit)||limit<1||limit>50||typeof(request.after??'')!=='string'||(request.after||'').length>100)throw Error('Sayfa bilgisi geçersiz');
 return {store:request.store,limit,after:request.after||''};
}
export function catalogPage(request,rows){
 const spec=catalogSpec(request),sorted=rows.filter(r=>typeof r.id==='string'&&r.id>spec.after).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),page=sorted.slice(0,spec.limit);
 return {store:spec.store,rows:page.map(r=>Object.fromEntries([...fields[spec.store],'deleted_at'].filter(k=>Object.hasOwn(r,k)).map(k=>[k,r[k]]))),next:sorted.length>spec.limit?page.at(-1).id:null,read_at:new Date().toISOString()};
}

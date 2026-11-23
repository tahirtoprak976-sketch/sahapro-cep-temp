// A separate, explicit capability; old public SPAK1 pairing cannot authorize writes.
import {REMOTE_ID,REMOTE_AGE,readApprovedPacket} from './remote-approved-core.js';
export const REMOTE_BOX='SAHAPRO_REMOTE_BOX_V1',MAX_REMOTE_BOX=3*1024*1024;
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const b64=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function bytes(s,n){if(typeof s!=='string'||!new RegExp('^[A-Za-z0-9_-]{'+Math.ceil(n*4/3)+'}$').test(s))throw Error('Bağlantı kodu geçersiz');let b;try{b=Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}catch{throw Error('Bağlantı kodu geçersiz');}if(b.length!==n||b64(b)!==s)throw Error('Bağlantı kodu geçersiz');return b;}
const key=raw=>crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);
export async function createRemoteAuthority(){const raw=crypto.getRandomValues(new Uint8Array(32)),channel=crypto.randomUUID();return {authority:{channel,key:await key(raw)},code:'SPAR1.'+channel+'.'+b64(raw)};}
export async function readRemoteCode(code){if(typeof code!=='string'||code.length>120)throw Error('Yeni SPAR1 bağlantı kodu gerekli');const p=code.trim().split('.');if(p.length!==3||p[0]!=='SPAR1'||!REMOTE_ID.test(p[1]))throw Error('Yeni SPAR1 bağlantı kodu gerekli');return {channel:p[1],key:await key(bytes(p[2],32))};}
function header(p){return {format:p.format,channel:p.channel,created_at:p.created_at,expires_at:p.expires_at,iv:p.iv};}
export async function sealRemoteBox(packets,authority,{now=Date.now()}={}){
 if(!REMOTE_ID.test(authority?.channel)||!authority.key||!Array.isArray(packets)||!packets.length||packets.length>50)throw Error('Teslim kutusu geçersiz');
 const items=packets.map(p=>readApprovedPacket(p,{now}));if(new Set(items.map(p=>p.id)).size!==items.length)throw Error('Paket kimliği tekrarlı');
 const h={format:REMOTE_BOX,channel:authority.channel,created_at:new Date(now).toISOString(),expires_at:new Date(now+REMOTE_AGE).toISOString(),iv:b64(crypto.getRandomValues(new Uint8Array(12)))};
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv:bytes(h.iv,12),additionalData:enc.encode(JSON.stringify(h))},authority.key,enc.encode(JSON.stringify(items)));
 const raw=new Uint8Array(ciphertext);let str='';for(let i=0;i<raw.length;i+=8192)str+=String.fromCharCode(...raw.subarray(i,i+8192));
 const result=enc.encode(JSON.stringify({...h,ciphertext:btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')})+'\n');if(result.length>MAX_REMOTE_BOX)throw Error('Teslim kutusu en fazla3MB olabilir');return result;
}
export async function openRemoteBox(raw,authority,{now=Date.now(),allowExpired=false}={}){
 if(raw.byteLength>MAX_REMOTE_BOX)throw Error('Teslim kutusu çok büyük');const p=JSON.parse(dec.decode(raw));
 const keys=['format','channel','created_at','expires_at','iv','ciphertext'];if(!p||Object.keys(p).length!==keys.length||keys.some(k=>typeof p[k]!=='string')||p.format!==REMOTE_BOX||p.channel!==authority?.channel||!REMOTE_ID.test(p.channel))throw Error('Teslim kutusu bu bağlantıya ait değil');
 const created=Date.parse(p.created_at),expires=Date.parse(p.expires_at);if(!Number.isFinite(created)||!Number.isFinite(expires)||new Date(created).toISOString()!==p.created_at||new Date(expires).toISOString()!==p.expires_at||created>now+300000||(!allowExpired&&expires<=now)||expires-created!==REMOTE_AGE)throw Error('Teslim kutusu süresi geçersiz veya dolmuş');
 if(!/^[A-Za-z0-9_-]+$/.test(p.ciphertext)||p.ciphertext.length>MAX_REMOTE_BOX)throw Error('Şifreli içerik geçersiz');
 let plain;try{const ct=Uint8Array.from(atob(p.ciphertext.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(p.iv,12),additionalData:enc.encode(JSON.stringify(header(p)))},authority.key,ct);}catch{throw Error('Gönderici doğrulanamadı veya paket değiştirilmiş');}
 const items=JSON.parse(dec.decode(plain));if(!Array.isArray(items)||!items.length||items.length>50||new Set(items.map(p=>p.id)).size!==items.length)throw Error('Teslim kutusu paketleri geçersiz');
 // Expired packets are not written; still expose their IDs for an honest status.
 return items.map(p=>{try{return {packet:readApprovedPacket(p,{now}),error:null};}catch(e){return {packet:null,id:REMOTE_ID.test(p?.id)?p.id:'',error:e.message};}});
}
export async function fetchRemoteBox(base,channel,{fetcher=fetch}={}){
 if(!REMOTE_ID.test(channel))throw Error('Teslim bağlantısı geçersiz');const u=new URL('data/remote-inbox/'+channel+'.json',base);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)))throw Error('HTTPS gerekli');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);let reader;
 try{const r=await fetcher(u.href,{signal:controller.signal,cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});if(r.status===404)return null;if(!r.ok)throw Error('Teslim kutusu indirilemedi');if(Number(r.headers.get('content-length'))>MAX_REMOTE_BOX||!r.body)throw Error('Teslim kutusu boyutu geçersiz');reader=r.body.getReader();let size=0;const chunks=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_REMOTE_BOX)throw Error('Teslim kutusu çok büyük');chunks.push(value);}const raw=new Uint8Array(size);let at=0;for(const c of chunks){raw.set(c,at);at+=c.length;}return raw;}finally{clearTimeout(timer);await reader?.cancel().catch(()=>{});}
}

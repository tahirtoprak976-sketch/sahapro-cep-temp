import {LIVE_URL,openLive,sealLive,catalogSpec,catalogPage} from './live-access-core.js';
import {getLiveAccess,cacheLiveResponse,deleteLiveAccess} from './secure-transfer-db.js';
import {remoteAuthority,commitApprovedPacket} from './remote-approved-db.js';
import {remoteCanWrite} from './remote-approved-runner.js';
import {isSessionUnlocked} from './security.js';
import {startActivity,updateRisk} from './update-safety.js';
import * as db from './db.js';
let started=false,running=false;
export async function liveTransport(config,action,extra={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const r=await fetch(LIVE_URL,{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify({channel:config.channel,action,...extra}),signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
  if(!r.ok)throw Error(r.status===401?'Canlı bağlantı süresi dolmuş veya kapatılmış':'Canlı bağlantı şu anda yanıt vermiyor');
  const text=await r.text();if(text.length>5500000)throw Error('Sunucu yanıtı çok büyük');return JSON.parse(text);
 }finally{clearTimeout(timer);}
}
const sessionReady=()=>localStorage.getItem('sp_driver')!=='1'&&document.visibilityState==='visible'&&isSessionUnlocked()&&!document.querySelector('#lock-root')&&document.querySelector('#screen')?.dataset.viewReady==='1'&&!updateRisk(document.querySelector('#screen')).unsaved;
async function current(config){const [saved,a]=await Promise.all([getLiveAccess(),remoteAuthority()]);return saved?.enabled===true&&saved.channel===config.channel&&saved.token===config.token&&a?.channel===config.channel&&sessionReady()?{saved,authority:a}:null;}
export async function stopLiveAccess(){const old=await getLiveAccess();await deleteLiveAccess();if(old)try{await liveTransport(old,'revoke');}catch{}window.dispatchEvent(new Event('sp-live-access'));}
export async function checkLiveAccess(){
 if(running||!remoteCanWrite()||!navigator.locks)return;
 running=true;
 try{return await navigator.locks.request('sahapro-live-access',{ifAvailable:true},async lock=>{
  if(!lock)return;const config=await getLiveAccess();if(!config?.enabled)return;
  let state=await current(config);if(!state)return;
  const inbox=await liveTransport(config,'poll');if(!Array.isArray(inbox.messages)||inbox.messages.length>5)throw Error('Canlı talep listesi geçersiz');
  for(const item of inbox.messages){
   if(!remoteCanWrite()||!(state=await current(config)))return;
   let request;try{request=await openLive(item.request,state.authority,item.id,'request');}catch{continue;}
   const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(item.request))))].map(x=>x.toString(16).padStart(2,'0')).join('');
   const cached=(state.saved.retries||[]).find(x=>x.id===item.id);
   if(cached&&cached.digest!==digest)continue;
   let box=cached?.box;
   const release=startActivity('live-access');
   try{
    if(!box){
     let response;
     try{
      if(request.type==='catalog'){
       const spec=catalogSpec(request),rows=await db.getAll(spec.store);response={ok:true,result:catalogPage(request,rows)};
      }else if(request.type==='approved_packet'&&Object.keys(request).length===2&&Object.hasOwn(request,'packet')){
       if(!state.saved.allow_writes)throw Error('Canlı kayıt yazma izni kapalı');
       const result=await commitApprovedPacket(request.packet,config.channel,{canWrite:sessionReady});response={ok:true,result};
      }else throw Error('Desteklenmeyen canlı işlem');
     }catch(e){response={ok:false,error:String(e.message).slice(0,4000),code:e.code==='OP_CONFLICT'?'OP_CONFLICT':'HELD'};}
     if(!(state=await current(config)))return;
     box=await sealLive(response,state.authority,item.id,'response',{expires:Date.parse(item.request.expires_at)});
     if(!await cacheLiveResponse(config,{id:item.id,digest,box}))return;
    }
    if(!await current(config))return;
    await liveTransport(config,'respond',{id:item.id,response:box});
   }finally{release();}
  }
 });}finally{running=false;}
}
export function startLiveAccess(){if(started)return;started=true;const tick=()=>checkLiveAccess().catch(()=>{});setInterval(tick,20000);window.addEventListener('online',tick);document.addEventListener('visibilitychange',tick);tick();}

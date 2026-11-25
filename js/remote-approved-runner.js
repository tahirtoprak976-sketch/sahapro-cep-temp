import {remoteAuthority,commitApprovedPacket} from './remote-approved-db.js';
import {fetchRemoteBox,openRemoteBox} from './remote-approved-crypto.js';
import {updateRisk,startActivity} from './update-safety.js';
import {isSessionUnlocked} from './security.js';
import * as db from './db.js';
let running=false,started=false;
const base=new URL('../',import.meta.url).href;
export function remoteCanWrite(){const root=document.querySelector('#screen');return localStorage.getItem('sp_driver')!=='1'&&document.visibilityState==='visible'&&isSessionUnlocked()&&!document.querySelector('#lock-root')&&root?.dataset.viewReady==='1'&&!updateRisk(root).busy&&!updateRisk(root).unsaved;}
const notify=()=>window.dispatchEvent(new Event('sp-remote-status'));
export async function checkRemoteApproved(){
 if(running)return;const authority=await remoteAuthority();if(!authority)return;
 if(!remoteCanWrite())return {waiting:true};running=true;let release;
 const status={at:new Date().toISOString(),saved:0,replayed:0,review:0,held:[],empty:false};
 try{
  const raw=await fetchRemoteBox(base,authority.channel);if(!raw){status.empty=true;return status;}
  const items=await openRemoteBox(raw,authority);
  for(const item of items){
   if(item.error){status.held.push({id:item.id,message:item.error});continue;}
   // Activity is acquired only after the final edit/lock check. It also blocks app updates.
   if(!remoteCanWrite()){status.held.push({id:item.packet.id,message:'Açık form veya kilit var; sonraki kontrolde yeniden denenecek'});break;}
   release=startActivity('remote-approved');
   try{const saved=await commitApprovedPacket(item.packet,authority.channel,{canWrite:()=>localStorage.getItem('sp_driver')!=='1'&&document.visibilityState==='visible'&&isSessionUnlocked()&&!document.querySelector('#lock-root')&&!updateRisk(document.querySelector('#screen')).unsaved});status[saved.status==='review'?'review':saved.replayed?'replayed':'saved']++;}
   catch(e){status.held.push({id:item.packet.id,message:e.message});}
   finally{release();release=null;}
  }
  return status;
 }catch(e){status.held.push({id:'',message:e.name==='AbortError'?'Bağlantı zaman aşımı; tekrar denenecek':e.message});return status;}
 finally{release?.();try{await db.metaSet('remote_approved_status',status);}finally{running=false;notify();}}
}
export function startRemoteApproved(){if(started)return;started=true;const tick=()=>checkRemoteApproved().catch(()=>{});window.addEventListener('online',tick);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')tick();});setInterval(tick,60000);tick();}

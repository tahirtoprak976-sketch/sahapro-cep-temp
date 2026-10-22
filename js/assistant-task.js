// One durable active request, bound to the chat epoch and guarded by a revision. Never resumes a posted plan.
import {uuid,nowISO} from './core.js';
import {chatText} from './assistant-conversation.js';
import {cleanAgentPlan} from './assistant-agent-core.js';
export const TASK_KEY='assistant_task_v1';
const CHAT_KEY='assistant_conversation_v1';
const states=new Set(['draft','clarify','applying','complete','review','cancelled']);
export const taskOpen=t=>!!t&&['draft','clarify'].includes(t.status);
export function cleanTask(raw){
 if(!raw||raw.version!==1||typeof raw.id!=='string'||typeof raw.chat_id!=='string'||!Number.isInteger(raw.rev)||raw.rev<1||!states.has(raw.status))return null;
 try{return {version:1,id:raw.id.slice(0,80),chat_id:raw.chat_id.slice(0,80),rev:raw.rev,status:raw.status,native:!!raw.native,goal:chatText(raw.goal,240),source:chatText(raw.source,12000),plan:cleanAgentPlan(raw.plan),updated_at:String(raw.updated_at||'').slice(0,35),receipt:chatText(raw.receipt,1000)};}catch{return null;}
}
export async function readTask(db){
 const [raw,chat]=await Promise.all([db.metaGet(TASK_KEY),db.metaGet(CHAT_KEY)]),task=cleanTask(raw);
 return task&&task.chat_id===chat?.id?task:null;
}
export function taskContext(task){
 if(!task)return null;
 return taskOpen(task)?{id:task.id,status:task.status,goal:task.goal,source:task.source,plan:task.plan}:{id:task.id,status:task.status,goal:task.goal,receipt:task.receipt,note:'Bu görev tekrar uygulanmaz. Kayıtları sorgula; yeni işlem gerekiyorsa yeni isteği hazırla.'};
}
const stale=()=>Error('Görev başka sekmede değişmiş veya sohbet yenilenmiş. Yeniden okuyup devam edin.');
function assertCurrent(values,epoch,previous){
 if(values[CHAT_KEY]?.id!==epoch)throw stale();
 const raw=cleanTask(values[TASK_KEY]),current=raw?.chat_id===epoch?raw:null;
 if((current?.id||null)!==(previous?.id||null)||(current?.rev||0)!==(previous?.rev||0))throw stale();
 return current;
}
export async function saveTaskProposal(db,{epoch,previous,result,source}){
 if(String(source).length>12000)throw Error('Bu görev çok uzadı. Kaydı kontrol edip yeni bir istek başlatın.');
 const plan=cleanAgentPlan(result.plan),status=(plan.questions||[]).length?'clarify':'draft';
 return db.metaTxn([TASK_KEY,CHAT_KEY],values=>{
  const current=assertCurrent(values,epoch,previous),continuing=result.mode==='continue';
  if(continuing&&(!taskOpen(current)||current.id!==result.task_id))throw stale();
  const task=cleanTask({version:1,id:continuing?current.id:uuid(),chat_id:epoch,rev:continuing?current.rev+1:1,status,native:continuing?current.native:!result.legacy||!!current?.native,goal:result.goal||current?.goal||'İşlem isteği',source,plan,updated_at:nowISO(),receipt:''});
  if(!task)throw Error('Görev saklanamadı.');return {set:{[TASK_KEY]:task},result:task};
 });
}
export async function transitionTask(db,previous,status,receipt=''){
 if(!previous)return null;
 if(!states.has(status))throw Error('Geçersiz görev durumu');
 return db.metaTxn([TASK_KEY,CHAT_KEY],values=>{
  const current=assertCurrent(values,previous.chat_id,previous);
  const allowed=taskOpen(current)?['applying','cancelled']:current.status==='applying'?['complete','review']:[];
  if(!allowed.includes(status))throw Error('Bu görev artık uygulanamaz; kayıtları inceleyin.');
  const next={...current,rev:current.rev+1,status,updated_at:nowISO(),receipt:chatText(receipt,1000)};
  return {set:{[TASK_KEY]:next},result:next};
 });
}
export function hasTaskProposal(plan){
 return (plan.questions||[]).length>0||Object.entries(plan).some(([k,v])=>!['questions','photo_texts'].includes(k)&&(Array.isArray(v)?v.length>0:k==='cards'&&v&&Object.values(v).some(rows=>Array.isArray(rows)&&rows.length)));
}

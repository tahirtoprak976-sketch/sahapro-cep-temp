// No third-party dependencies. Database keys never leave the server.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const ORIGIN='https://tahirtoprak976-sketch.github.io';
export function makeHandler({rpc,cryptoProvider=crypto}) {
 return async request=>{
  const origin=request.headers.get('origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(origin===ORIGIN)Object.assign(headers,{'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'});
  const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
  if(origin && origin!==ORIGIN)return reply({error:'Origin denied'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply({error:'POST required'},405);
  const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
  if(!TOKEN.test(token||''))return reply({error:'Access denied'},401);
  let reader;
  try {
   if(Number(request.headers.get('content-length'))>1100000)return reply({error:'Request too large'},413);
   reader=request.body?.getReader();if(!reader)return reply({error:'Body required'},400);
   const chunks=[];let size=0;
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1100000){await reader.cancel();return reply({error:'Request too large'},413);}chunks.push(value);}
   const bytes=new Uint8Array(size);let at=0;for(const x of chunks){bytes.set(x,at);at+=x.length;}
   const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(!UUID.test(body.channel)||!['poll','respond','revoke'].includes(body.action))return reply({error:'Invalid request'},400);
   const fields=body.action==='respond'?['channel','action','id','response']:['channel','action'];
   if(Object.keys(body).length!==fields.length||fields.some(k=>!Object.hasOwn(body,k)))return reply({error:'Invalid request'},400);
   if(body.action==='respond'&&(!UUID.test(body.id)||!body.response||Array.isArray(body.response)||typeof body.response!=='object'))return reply({error:'Invalid response'},400);
   const hash=[...new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(x=>x.toString(16).padStart(2,'0')).join('');
   const result=await rpc({p_channel:body.channel,p_token_hash:hash,p_action:body.action,p_id:body.id||null,p_response:body.response||null});
   if(!result.ok){if(result.code==='28000')return reply({error:'Access denied'},401);if(result.message==='Rate limited')return reply({error:'Retry later'},429);return reply({error:'Request unavailable'},409);}
   return reply(result.value);
  } catch {return reply({error:'Invalid request or service unavailable'},400);}
  finally {reader?.releaseLock();}
 };
}

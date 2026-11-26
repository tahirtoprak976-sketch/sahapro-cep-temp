import {makeHandler} from './handler.mjs';
const rpc=async args=>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!key)throw Error('Server credentials missing');
  const r=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/solo_access_device',{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify(args),signal:controller.signal
  });
  const value=await r.json();return r.ok?{ok:true,value}:{ok:false,code:value.code,message:value.message};
 }finally{clearTimeout(timer);}
};
Deno.serve(makeHandler({rpc}));

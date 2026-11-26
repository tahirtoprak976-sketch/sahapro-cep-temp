// Authorized operator uses connected Supabase MCP to execute generated SQL.
// No service role key or business plaintext goes into the deployed web app.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {readRemoteCode} from '../js/remote-approved-crypto.js';
import {sealLive,openLive,catalogSpec} from '../js/live-access-core.js';
import {readApprovedPacket} from '../js/remote-approved-core.js';
const sql=s=>"'"+String(s).replaceAll("'","''")+"'";
try{
 const args=process.argv.slice(2),mode=args.shift(),options={};
 while(args.length){const key=args.shift();if(!['--pair-file','--out-dir','--request-file','--response-file','--request-id','--approved'].includes(key)||Object.hasOwn(options,key))throw Error('Geçersiz seçenek');options[key]=key==='--approved'?true:args.shift();}
 if(!options['--pair-file']||!options['--out-dir'])throw Error('--pair-file ve özel --out-dir gerekli');
 const out=resolve(options['--out-dir']);await mkdir(out,{recursive:true,mode:0o700});const authority=await readRemoteCode(await readFile(options['--pair-file'],'utf8'));
 if(mode==='provision'){
  const token=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'),hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
  await writeFile(resolve(out,'phone-code.txt'),'SPAL1.'+authority.channel+'.'+token+'\n',{mode:0o600,flag:'wx'});
  await writeFile(resolve(out,'provision.sql'),`insert into solo_access.devices(channel,token_hash,expires_at) values (${sql(authority.channel)},${sql(hash)},now()+interval '30 days');\n`,{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({channel:authority.channel,phone_code_file:resolve(out,'phone-code.txt'),provision_sql:resolve(out,'provision.sql'),expires_in_days:30}));
 }else if(mode==='request'){
  const raw=await readFile(options['--request-file']);if(raw.length>600000)throw Error('Talep çok büyük');const request=JSON.parse(raw);
  if(request.type==='catalog')catalogSpec(request);
  else if(request.type==='approved_packet'&&options['--approved']===true&&Object.keys(request).length===2)readApprovedPacket(request.packet);
  else throw Error('Desteklenen talep veya açık paket onayı gerekli');
  const id=crypto.randomUUID(),expires=Date.now()+3600000,box=await sealLive(request,authority,id,'request',{expires});
  await writeFile(resolve(out,id+'.sql'),`insert into solo_access.messages(id,channel,request,expires_at) values (${sql(id)},${sql(authority.channel)},${sql(JSON.stringify(box))}::jsonb,${sql(new Date(expires).toISOString())});\n`,{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({id,sql_file:resolve(out,id+'.sql'),status:'prepared_not_saved'}));
 }else if(mode==='response'){
  const box=JSON.parse(await readFile(options['--response-file'],'utf8')),id=options['--request-id'];const result=await openLive(box,authority,id,'response');
  const file=resolve(out,id+'-result.json');await writeFile(file,JSON.stringify(result,null,2)+'\n',{mode:0o600,flag:'wx'});console.log(JSON.stringify({result_file:file,ok:result.ok}));
 }else throw Error('provision, request veya response gerekli');
}catch(e){console.error('Canlı bağlantı: '+e.message);process.exitCode=1;}

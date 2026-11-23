#!/usr/bin/env node
// Run only after showing the exact packet to Tahir and receiving his explicit approval.
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {readRemoteCode,openRemoteBox,sealRemoteBox,MAX_REMOTE_BOX} from '../js/remote-approved-crypto.js';
import {readApprovedPacket} from '../js/remote-approved-core.js';
import {stableStringify} from '../js/core.js';
const flags=new Map();let confirmed=false;
try{
 for(let i=2;i<process.argv.length;i++){const arg=process.argv[i];if(arg==='--approved'){if(confirmed)throw Error('Tekrarlı onay');confirmed=true;continue;}if(!['--pair-file','--packet','--out-dir'].includes(arg)||!process.argv[i+1]||flags.has(arg))throw Error('Geçersiz parametre');flags.set(arg,process.argv[++i]);}
 if(!confirmed||!flags.has('--pair-file')||!flags.has('--packet'))throw Error('Açık sohbet onayından sonra --approved --pair-file /özel/kod.txt --packet /özel/paket.json gerekli');
 const raw=await readFile(flags.get('--packet'));if(raw.byteLength>2*1024*1024)throw Error('Kaynak paket çok büyük');
 const packet=readApprovedPacket(raw.toString('utf8')),authority=await readRemoteCode(await readFile(flags.get('--pair-file'),'utf8'));
 const dest=resolve(flags.get('--out-dir')||'data/remote-inbox',authority.channel+'.json');await mkdir(dirname(dest),{recursive:true});
 let existing=[];try{const bytes=await readFile(dest);if(bytes.byteLength>MAX_REMOTE_BOX)throw Error('Mevcut kutu çok büyük');existing=(await openRemoteBox(bytes,authority,{allowExpired:true})).filter(x=>!x.error).map(x=>x.packet);}catch(e){if(e.code!=='ENOENT')throw e;}
 const old=existing.find(x=>x.id===packet.id);if(old&&stableStringify(old)!==stableStringify(packet))throw Error('OP_CONFLICT: aynı paket kimliği farklı içerik');
 if(!old)existing.push(packet);const sealed=await sealRemoteBox(existing,authority),tmp=dest+'.tmp-'+crypto.randomUUID();
 await writeFile(tmp,sealed,{flag:'wx',mode:0o600});await rename(tmp,dest);
 console.log(JSON.stringify({encrypted_file:dest,packets:existing.length,packet_id:packet.id,already_queued:!!old,phone_receipt:'Paket yalnız kuyruğa hazırlandı; telefona yazıldığı henüz doğrulanmadı.'},null,2));
}catch(e){console.error('Teslim hazırlanamadı: '+e.message);process.exitCode=1;}

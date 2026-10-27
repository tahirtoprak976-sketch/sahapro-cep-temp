import { prepareAttachment } from "./attachment-safety.js";
// Self-contained, bounded stored-ZIP transport. No decompression, filesystem writes or remote service.
import {buildZip,crc32} from './core.js';
import {listZip,readEntry} from './unzip.js';
import {cleanDriverShare,readDriverTransfer} from './driver-transfer.js';
export const DRIVER_BUNDLE_LIMIT=20*1048576;
export const isDriverBundle=f=>/\.sahapro(?:\s*\(\d+\))?\.zip$/i.test(f?.name||'');
const MIME=new Set(['image/jpeg','image/png','image/webp','image/gif','image/bmp','image/heic','image/heif','image/avif']);
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
export async function makeDriverBundle(packet){
 if(packet.files.length>20)throw Error('Tek pakette en fazla 20 fotoğraf olabilir');
 const legacy=cleanDriverShare(packet),transfer=legacy.files[0];
 const files=[{name:'transfer.sahapro.txt',data:new Uint8Array(await transfer.arrayBuffer())}],photos=[];
 let bytes=transfer.size;
 for(const [i,original] of packet.files.entries()){
  const f=await prepareAttachment(original,{imageOnly:true,maxBytes:DRIVER_BUNDLE_LIMIT});
  if(!MIME.has(f.type)||f.name.length>240)throw Error('Pakette desteklenmeyen fotoğraf var; yeniden hazırlayın');
  bytes+=f.size;if(bytes>DRIVER_BUNDLE_LIMIT)throw Error('Tek paket 20 MB sınırını aşıyor; daha az kayıt seçin');
  const path='photos/'+String(i).padStart(2,'0')+'-'+f.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,80);
  photos.push({path,name:f.name,type:f.type,size:f.size});files.push({name:path,data:new Uint8Array(await f.arrayBuffer())});
 }
 files.unshift({name:'index.json',data:enc.encode(JSON.stringify({kind:'SAHAPRO_DRIVER_BUNDLE',version:1,photos}))});
 const zip=buildZip(files,new Date(2000,0,1,12));
 if(zip.byteLength>DRIVER_BUNDLE_LIMIT)throw Error('Tek paket 20 MB sınırını aşıyor; daha az kayıt seçin');
 return {text:packet.text.slice(0,packet.text.lastIndexOf('\nSP1:'))+'\n📦 İş bilgileri ve fotoğraflar ekli tek SAHAPRO paketinde. Paketi Asistan’a ekleyin.',files:[new File([zip],transfer.name.replace(/\.txt$/,'.zip'),{type:'application/zip',lastModified:0})]};
}
export async function openDriverBundle(file){
 try{
  if(!isDriverBundle(file)||file.size>DRIVER_BUNDLE_LIMIT)throw Error('Paket en fazla 20 MB olabilir');
  const buf=await file.arrayBuffer(),entries=listZip(buf),v=new DataView(buf);
  if(entries.length<2||entries.length>22||new Set(entries.map(e=>e.name)).size!==entries.length)throw Error('Paket dosya listesi geçersiz');
  let total=0;const ranges=[];
  for(const e of entries){
   if(e.name!=='index.json'&&e.name!=='transfer.sahapro.txt'&&!/^photos\/\d{2}-[a-zA-Z0-9._-]+$/.test(e.name))throw Error('Paket dosya yolu geçersiz');
   if(e.method!==0||e.csize!==e.size||e.size>DRIVER_BUNDLE_LIMIT||(total+=e.size)>DRIVER_BUNDLE_LIMIT)throw Error('Desteklenmeyen veya sınırı aşan paket');
   if(e.offset+30>buf.byteLength||v.getUint32(e.offset,true)!==0x04034b50||v.getUint16(e.offset+6,true)&1||v.getUint16(e.offset+8,true)!==0)throw Error('Paket başlığı geçersiz');
   const start=e.offset+30+v.getUint16(e.offset+26,true)+v.getUint16(e.offset+28,true),end=start+e.size;
   if(end>buf.byteLength||v.getUint32(e.offset+18,true)!==e.size||v.getUint32(e.offset+22,true)!==e.size||dec.decode(new Uint8Array(buf,e.offset+30,v.getUint16(e.offset+26,true)))!==e.name)throw Error('Paket boyutları veya adları uyuşmuyor');
   ranges.push([e.offset,end]);
  }
  ranges.sort((a,b)=>a[0]-b[0]);for(let i=1;i<ranges.length;i++)if(ranges[i][0]<ranges[i-1][1])throw Error('Paket bölümleri çakışıyor');
  const byName=new Map(entries.map(e=>[e.name,e]));
  const read=async(name,limit)=>{const e=byName.get(name);if(!e||e.size>limit)throw Error('Paket içeriği eksik veya sınırı aşıyor');const bytes=await readEntry(buf,e);if(bytes.length!==e.size||crc32(bytes)!==v.getUint32(e.offset+14,true))throw Error('Paket bozulmuş; yeniden gönderilmeli');return bytes;};
  const index=JSON.parse(dec.decode(await read('index.json',65536)));
  if(index.kind!=='SAHAPRO_DRIVER_BUNDLE'||index.version!==1||!Array.isArray(index.photos)||index.photos.length>20||entries.length!==index.photos.length+2)throw Error('Paket içeriği veya sürümü geçersiz');
  const message=await readDriverTransfer(new File([await read('transfer.sahapro.txt',65536)],'transfer.sahapro.txt',{type:'text/plain'}));
  const seen=new Set(['index.json','transfer.sahapro.txt']),files=[];
  for(const p of index.photos){
   if(!p||typeof p.path!=='string'||!/^photos\/[a-zA-Z0-9._-]+$/.test(p.path)||seen.has(p.path)||typeof p.name!=='string'||p.name.length>240||/[\u0000-\u001f]/.test(p.name)||!MIME.has(p.type)||!Number.isInteger(p.size)||p.size<0||byName.get(p.path)?.size!==p.size)throw Error('Paket fotoğraf listesi geçersiz');
   seen.add(p.path);files.push(await prepareAttachment(new File([await read(p.path,DRIVER_BUNDLE_LIMIT)],p.name,{type:p.type,lastModified:0}),{imageOnly:true,maxBytes:DRIVER_BUNDLE_LIMIT}));
  }
  return {message,files};
 }catch(e){throw Error('SAHAPRO paketi açılamadı: '+(e.message||e)+'. Şoförden aynı kaydı yeniden paylaşmasını isteyin.');}
}

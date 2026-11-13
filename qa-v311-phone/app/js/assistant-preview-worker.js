import {previewPackets,encodePreview} from './assistant-preview-stream.js';
let generation=0;
self.onmessage=async({data})=>{
 if(data?.kind==='cancel'){generation++;return;}if(data?.kind!=='prepare')return;
 const own=++generation,{id,text,d,today,rules}=data;
 try{for(const packet of previewPackets(text,{d,today,rules,cancelled:()=>own!==generation})){
  if(own!==generation)return;self.postMessage({kind:'packet',id,index:packet.index,total:packet.total,...encodePreview(packet.value)});
  await new Promise(resolve=>setTimeout(resolve,0));
 }if(own===generation)self.postMessage({kind:'complete',id});}
 catch(error){if(own===generation)self.postMessage({kind:'failed',id,message:String(error.message||error)});}
};
self.postMessage({kind:'ready'});

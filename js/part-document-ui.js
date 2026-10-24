import {uuid} from './core.js';
import {esc,qs,qsa,toast,collectForm} from './ui.js';
import {preparePartFiles} from './parts-db.js';
import {readPartDocument} from './part-document-read.js';
import {normalizePartDocument,partDocumentFill} from './part-document-core.js';
import {startActivity} from './update-safety.js';

export async function stagePartDocuments(ctx,files,{message='',part=null,results=[]}={}){
 const prepared=await preparePartFiles(files);if(!prepared.length)throw Error('Önce parça/garanti belgesinin fotoğrafını veya PDF’sini seçin.');
 const token=uuid(),id='part-document:'+token;
 const data=results.length?await ctx.db.dumpAll():{};
 const readerResults=results.map(r=>{
  const i=Number(r.photo);if(!Number.isInteger(i)||!prepared[i])return null;
  return {hash:prepared[i].src_sha256,name:prepared[i].name,result:normalizePartDocument(r,{data})};
 }).filter(Boolean);
 await ctx.db.draftSave(id,{key:uuid(),files:[...files],editedFields:part?Object.keys(part):[],fields:part?{brand:part.brand,serial_numbers:part.serial_numbers,seller:part.seller,invoice_no:part.invoice_no,warranty_start:part.warranty_start,warranty_until:part.warranty_until,note:part.note}:undefined,base_version:part?.updated_at,readerResults,source_message:String(message).slice(0,2000),auto_read_attempted:!!readerResults.length&&readerResults.every(r=>r.result.text&&r.result.candidates.length)});
 ctx.go('#/yedek-parca/'+(part?part.id+'/garanti':'new')+'?part_draft='+token+'&read=1');
}

export function bindPartDocumentReader({ctx,form,data,getFiles,getEdited,onApply,onState,initial=[],autoRead=false}){
 const panel=document.createElement('section');panel.className='card';panel.dataset.partReader='';
 qs('[type=submit]',form).before(panel);
 let results=Array.isArray(initial)?initial:[],controller=null,busy=false;
 const render=()=>{
  panel.innerHTML='<b>Parça / garanti belgesini oku</b><p class="small">Seçili fotoğraf veya PDF, Gemini’ye gönderilir. Orijinal dosya telefonda korunur. Okunan alanları kontrol edip forma aktarın; kayıt için ayrıca Kaydet düğmesine basın.</p><button class="btn" type="button" data-part-read>Belgeyi oku / yeniden oku</button><button class="btn" type="button" data-part-cancel hidden>Okumayı durdur</button><div data-part-read-status role="status"></div><div data-part-read-results></div>';
  const holder=qs('[data-part-read-results]',panel);
  holder.innerHTML=results.map((r,i)=>`<div class="card" style="overflow-wrap:anywhere" data-part-read-result="${i}"><b>${esc(r.name)}</b>${r.error?`<p class="notice warn">${esc(r.error)}</p>`:''}${r.result?`<p class="small">${r.result.warnings.map(esc).join(' · ')}</p>${r.result.candidates.filter(c=>qs(`[name="${c.field}"]`,form)).map((c,j)=>{
   const fill=partDocumentFill(r.result,collectForm(form),getEdited()),conflict=fill.conflicts.includes(c.field);
   return `<label class="history-check"><input type="checkbox" data-part-field="${esc(c.field)}" ${Object.hasOwn(fill.updates,c.field)?'checked':''}><span><b>${esc(c.label)}:</b> ${esc(c.value)}${conflict?'<br>Mevcut değer korunacak; değiştirmek için açıkça seçin.':c.verified?'':'<br>Fotoğraf üzerinden kontrol edin: '+esc(c.issue)}</span></label>`;
  }).join('')}<details><summary>Okunan belge metni</summary><p style="white-space:pre-wrap">${esc(r.result.text||'Ham metin gelmedi; orijinal belgeyi kontrol edin.')}</p></details><button class="btn block" type="button" data-part-apply="${i}">Seçili bilgileri forma aktar</button>`:''}</div>`).join('');
  for(const button of qsa('[data-part-apply]',panel))button.onclick=()=>{
   const item=results[Number(button.dataset.partApply)],row=button.closest('[data-part-read-result]');
   const selected=qsa('[data-part-field]:checked',row),updates={},current=collectForm(form);
   for(const c of item.result.candidates){const input=selected.find(x=>x.dataset.partField===c.field);if(!input)continue;
    if(getEdited().includes(c.field)&&String(current[c.field]??'')!==String(c.value)&&input.dataset.explicit!=='1')continue;
    updates[c.field]=c.value;}
   if(!Object.keys(updates).length)return toast('Aktarılacak alanları seçin.','err');
   onApply(updates);render();toast('Seçili alanlar forma aktarıldı. Kaydetmeden önce kontrol edin.','ok');
  };
  for(const input of qsa('[data-part-field]',panel))input.onchange=()=>{input.dataset.explicit='1';};
  qs('[data-part-read]',panel).onclick=read;
  qs('[data-part-cancel]',panel).onclick=()=>controller?.abort();
 };
 async function read(){
  if(busy)return;busy=true;controller=new AbortController();const finish=startActivity('Parça belgesi okunuyor');
  const fileInput=qs('[name=documents]',form),save=qs('[type=submit]',form);
  const readBtn=qs('[data-part-read]',panel),cancel=qs('[data-part-cancel]',panel),status=qs('[data-part-read-status]',panel);
  const oldSave=save.disabled;save.disabled=true;if(fileInput)fileInput.disabled=true;readBtn.disabled=true;cancel.hidden=false;
  const remove=qsa('[data-remove-part-file]',form);remove.forEach(b=>b.disabled=true);
  try{
   const files=await getFiles(),prepared=await preparePartFiles(files);if(!prepared.length)throw Error('Önce belge fotoğrafı veya PDF seçin.');
   await onState(results,true);
   for(const [i,file]of prepared.entries()){
    if(controller.signal.aborted||!panel.isConnected)break;
    status.textContent=`${i+1} / ${prepared.length}: ${file.name} okunuyor…`;
    let entry;
    try{entry={hash:file.src_sha256,name:file.name,result:await readPartDocument(file,{db:ctx.db,data,signal:controller.signal})};}
    catch(e){entry={hash:file.src_sha256,name:file.name,error:e.message,result:results.find(r=>r.hash===file.src_sha256)?.result};}
    if(!panel.isConnected)break;
    results=[...results.filter(r=>r.hash!==file.src_sha256),entry];await onState(results,true);
    if(controller.signal.aborted)break;
   }
  }catch(e){toast(e.message||String(e),'err');}
  finally{finish();busy=false;controller=null;if(save.isConnected)save.disabled=oldSave;if(fileInput?.isConnected)fileInput.disabled=false;remove.forEach(b=>{if(b.isConnected)b.disabled=false;});if(panel.isConnected)render();}
 }
 const observer=new MutationObserver(()=>{if(!panel.isConnected){controller?.abort();observer.disconnect();}});observer.observe(ctx.root,{childList:true,subtree:true});
 form.addEventListener('input',e=>{if(!e.target.name||panel.contains(e.target))return;for(const input of qsa('[data-part-field]',panel))if(input.dataset.partField===e.target.name){input.checked=false;input.dataset.explicit='';}});
 render();if(autoRead)queueMicrotask(read);
 return {state:()=>results,refresh:render,syncFiles:prepared=>{const hashes=new Set(prepared.map(f=>f.src_sha256));results=results.filter(r=>hashes.has(r.hash));render();}};
}

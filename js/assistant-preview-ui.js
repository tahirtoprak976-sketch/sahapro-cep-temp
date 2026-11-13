import {quickPreview,decodePreview,samePreviewShape} from './assistant-preview-stream.js';
// Stage markup has never had action listeners. Reuse fields BEFORE the normal renderer binds them.
export function installPreviewHTML(out,html,{before,after}={}){
 if(!before||!samePreviewShape(before,after)){out.innerHTML=html;return false;}
 const next=document.createElement('div');next.innerHTML=html;
 for(const kind of ['work','fuel'])for(const oldCard of out.querySelectorAll('[data-stage-kind="'+kind+'"]')){
  const card=next.querySelector('[data-kind="'+kind+'"][data-i="'+oldCard.dataset.i+'"]');if(!card)continue;
  for(const fresh of card.querySelectorAll('input,select,textarea')){
   const selector=fresh.hasAttribute('data-pick')?'[data-pick]':fresh.name?'[name="'+CSS.escape(fresh.name)+'"]':null;
   const old=selector&&oldCard.querySelector(selector);if(!old||old.tagName!==fresh.tagName||old===document.activeElement)continue;
   const value=fresh.value,checked=fresh.checked;
   for(const a of [...old.attributes])old.removeAttribute(a.name);
   for(const a of fresh.attributes)old.setAttribute(a.name,a.value);
   if(old.tagName==='SELECT')old.replaceChildren(...fresh.childNodes);
   old.value=value;if(old.tagName==='INPUT')old.checked=checked;
   fresh.replaceWith(old);
  }
 }
 out.replaceChildren(...next.childNodes);return true;
}
export function startPreview({out,text,d,today,rules,draw,WorkerClass=globalThis.Worker}){
 let worker=null,current=null,closed=false;const combined={works:[],fuel:[]};
 const show=value=>{
  if(closed||!out.isConnected)return;
  // Copies only; no selected/accepted state escapes the provisional view.
  value._stagePending=true;for(const group of ['works','fuel'])for(const row of value[group]||[]){row.ok=false;row.okData=false;}
  current=value;draw(value);
 };
 try{const fast=quickPreview(text,{d,today,rules});if(fast)show(fast);}catch{/* Optional preview must not prevent normal validation. */}
 try{
  worker=new WorkerClass(new URL('./assistant-preview-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
   if(closed||data.id!==1)return;
   if(data.kind==='packet'){
    const value=decodePreview(data);combined.works.push(...value.works);combined.fuel.push(...value.fuel);
    show({...value,works:[...combined.works],fuel:[...combined.fuel]});
   }
   if(data.kind==='failed'||data.kind==='complete'){worker?.terminate();worker=null;}
  };
  worker.onerror=()=>{worker?.terminate();worker=null;};
  worker.postMessage({kind:'prepare',id:1,text,d,today,rules});
 }catch{worker?.terminate();worker=null;}
 return {finish(){closed=true;worker?.terminate();worker=null;return current;},cancel(){closed=true;worker?.terminate();worker=null;current=null;}};
}

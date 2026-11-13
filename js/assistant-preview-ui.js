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

export function resetPreviewStatus(root,onAbort){
 const status=root.querySelector('[data-read-status]');if(!status?.hasAttribute('data-preview-complete'))return;
 status.removeAttribute('data-preview-complete');status.style.height='';status.firstChild.replaceWith(document.createTextNode('İstek okunuyor; henüz kayıt yazılmıyor.'));
 const button=status.querySelector('[data-stop-reading]');button.textContent='Okumayı durdur';button.onclick=onAbort;
}
export function completePreviewStatus(root){
 const status=root.querySelector('[data-read-status]');if(!status||status.hidden)return;
 // Removing the reading strip moves every fixed composer control. Keep its exact slot until the next request.
 const button=status.querySelector('[data-stop-reading]'),box=status.getBoundingClientRect(),css=getComputedStyle(status),buttonCss=getComputedStyle(button);
 const textHeight=button.getBoundingClientRect().top-box.top-parseFloat(css.borderTopWidth)-parseFloat(css.paddingTop)-(parseFloat(buttonCss.marginTop)||0);
 status.style.height=box.height+'px';status.dataset.previewComplete='';
 const text=document.createElement('span');text.dataset.previewStatusText='';text.style.cssText='display:block;overflow:hidden;height:'+Math.max(0,textHeight)+'px';text.textContent='Kartlar hazır; henüz kayıt yazılmadı.';status.firstChild.replaceWith(text);
 button.disabled=false;button.textContent='Kontrol kartlarına git';button.onclick=()=>root.querySelector('[data-out]')?.scrollIntoView({block:'start',behavior:'smooth'});
}

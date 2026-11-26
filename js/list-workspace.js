// View-only session memory. Never persists records, form values or attachments.
const routes=new Set(['isler','yakit','gider']);
const memories=new Map(),lastLists=new Map();
let current=null,previousHash='';
export function listRoute(hash){
 const path=String(hash||'').split('?')[0].replace(/^#\//,'');
 return routes.has(path)?path:'';
}
export function listReturnHash(hash,previous,last){
 const route=listRoute(hash);
 // An explicit filter/deep link always wins. Only the matching detail's bare
 // back link resumes its list; opening a list from Home starts normally.
 if(!route||String(hash).includes('?')||!String(previous).startsWith('#/'+route+'/'))return hash;
 return last?.get(route)||hash;
}
export function prepareListNavigation(){
 if(current){current.save();current.stop();current=null;}
 const hash=listReturnHash(location.hash,previousHash,lastLists);
 if(hash!==location.hash)history.replaceState(history.state,'',hash);
 const restore=memories.get(hash);
 const route=listRoute(hash);
 const mayRestore=!!route&&(previousHash===hash||previousHash.startsWith('#/'+route+'/'));
 previousHash=hash;
 return mayRestore?restore:null;
}
export function mountListWorkspace(root,restore){
 const hash=location.hash,route=listRoute(hash);
 if(!route)return false;
 root.classList.add('record-workspace');root.dataset.recordWorkspace=route;
 const list=root.querySelector('[data-list]');
 if(!list)return false;
 const rowCount=()=>list.querySelectorAll('.li').length;
 if(restore){
  // Reopen only already-viewed pages, using existing read-only pagination.
  let attempts=0;
  while(rowCount()<restore.rows&&attempts++<500){
   const more=list.querySelector('[data-more],[data-operation-more]');
   if(!more)break;
   const before=rowCount();more.click();if(rowCount()<=before)break;
  }
  [...root.querySelectorAll('details')].forEach((el,i)=>{if(restore.open?.includes(i))el.open=true;});
 }
 const search=root.querySelector('[data-search]');
 if(search){
  search.setAttribute('aria-label',route==='isler'?'İş kayıtlarında ara':route==='yakit'?'Yakıt kayıtlarında ara':'Masraf kayıtlarında ara');
  const clear=document.createElement('button');clear.type='button';clear.className='record-search-clear';clear.textContent='Temizle';clear.setAttribute('aria-label','Aramayı temizle');clear.hidden=!search.value;
  search.parentElement.append(clear);
  search.addEventListener('input',()=>{clear.hidden=!search.value;});
  clear.onclick=()=>{search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));search.focus();};
 }
 const heading=document.createElement('div');heading.className='record-list-heading';
 heading.innerHTML='<strong>Kayıt listesi</strong><span>Ayrıntılar için kayda dokunun</span>';
 list.before(heading);
 let position=restore?.scroll||0;
 const scroll=()=>{position=window.scrollY;};
 const save=()=>{
  const value={scroll:position,rows:rowCount(),open:[...root.querySelectorAll('details')].flatMap((el,i)=>el.open?[i]:[])};
  memories.delete(hash);memories.set(hash,value);lastLists.set(route,hash);
  // Bounded session-only memory, not a business record or draft store.
  while(memories.size>30)memories.delete(memories.keys().next().value);
 };
 const capture=()=>{position=window.scrollY;save();};
 root.addEventListener('click',capture,true);window.addEventListener('scroll',scroll,{passive:true});
 current={save,stop:()=>{window.removeEventListener('scroll',scroll);root.removeEventListener('click',capture,true);}};
 window.scrollTo(0,position);return true;
}

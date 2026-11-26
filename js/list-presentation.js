// Presentation preferences live only in this tab, never in business records.
const densityByRoute=new Map();
export function validDensity(value){return value==='detail'?'detail':'compact';}
export function mountListPresentation(root,route,list){
 const search=root.querySelector('[data-search]')?.closest('.searchbar');
 const total=Number(list.dataset.recordCount);
 const toolbar=document.createElement('section');toolbar.className='record-toolbar';toolbar.dataset.recordToolbar='';
 const title=document.createElement('strong');title.textContent='Hareketler';
 const group=document.createElement('div');group.className='record-density';group.setAttribute('role','group');group.setAttribute('aria-label','Liste görünümü');
 const buttons=['compact','detail'].map((value,i)=>{const b=document.createElement('button');b.type='button';b.dataset.recordDensity=value;b.textContent=i?'Ayrıntılı':'Kısa';group.appendChild(b);return b;});
 const select=value=>{value=validDensity(value);root.dataset.listDensity=value;densityByRoute.set(route,value);for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.recordDensity===value));};
 for(const b of buttons)b.onclick=()=>select(b.dataset.recordDensity);
 toolbar.append(title,group);select(densityByRoute.get(route));
 const secondary=[...root.querySelectorAll('.exportbar,.history-tools,[aria-label="Seçili işler kontrolü"]')];
 if(secondary.length){
  const footer=document.createElement('section');footer.className='record-secondary';footer.dataset.recordSecondary='';
  const h=document.createElement('h3');h.textContent='Rapor ve diğer araçlar';footer.appendChild(h);
  for(const node of secondary)footer.appendChild(node);list.after(footer);
 }
 const filters=root.querySelector('[data-work-filters],[data-operation-filters]');
 if(filters){
  filters.classList.add('record-inline-filters');
  const summary=filters.querySelector('summary'),full=document.createElement('span'),short=document.createElement('span');
  full.className='record-filter-long';full.textContent=summary.textContent;short.textContent='Filtrele';short.setAttribute('aria-hidden','true');summary.replaceChildren(full,short);summary.classList.add('record-filter-button');
  if(secondary.length){const jump=document.createElement('button');jump.type='button';jump.className='btn sm';jump.textContent='Rapor ve diğer araçlara git';jump.onclick=()=>{const footer=root.querySelector('[data-record-secondary]');footer.scrollIntoView({block:'start'});footer.querySelector('button,a')?.focus({preventScroll:true});};filters.appendChild(jump);}
  toolbar.appendChild(filters);
 }
 // Secondary accounting explanations stay available; invalid/missing warnings
 // remain outside these disclosures and are never hidden by presentation.
 const summary=root.querySelector('[data-operation-summary]');
 const sources=summary?.querySelector('.operation-source-summary'),explanation=summary?.querySelector('.operation-explanation');
 if(sources&&explanation)explanation.appendChild(sources);
 const workSummary=root.querySelector('[data-work-summary]');
 const policy=workSummary?.querySelector('p.tiny.muted');
 if(policy){const d=document.createElement('details'),s=document.createElement('summary');d.className='operation-explanation';s.textContent='Hesap kapsamı';policy.before(d);d.append(s,policy);}

 if(search)search.before(toolbar);else list.before(toolbar);
 const scope=document.createElement('p');scope.className='record-list-heading';scope.dataset.recordScope='';
 const count=document.createElement('strong');count.textContent=Number.isSafeInteger(total)&&total>=0?total+' kayıt':'Kayıt listesi';
 const hint=document.createElement('span');hint.textContent='Ayrıntılar için dokunun';scope.append(count,hint);list.before(scope);
}

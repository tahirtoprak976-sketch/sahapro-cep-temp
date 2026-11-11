// Search existing navigation in place. Keeps every route and click handler intact.
import {matchSearch} from './core.js';
export function mountWorkspaceMenu(root){
 const box=document.createElement('section');box.className='card workspace-search';box.dataset.workspaceSearch='';
 box.innerHTML='<h2>İşletme araçları</h2><label class="field">Modül ara<input type="search" data-menu-search placeholder="Örn: banka, bakım, yedek" autocomplete="off"></label><div class="row between"><span class="small muted" data-menu-status role="status" aria-live="polite"></span><button class="btn sm" data-menu-clear>Temizle</button></div>';
 root.querySelector('.appbar').insertAdjacentElement('afterend',box);
 const input=box.querySelector('[data-menu-search]'),targets=[...root.querySelectorAll('button[data-go],a[href^="#/"]')],initial=new Map(targets.map(el=>[el,el.hidden]));
 const groups=[...root.querySelectorAll('.quickgrid,section.card')].filter(el=>el!==box&&targets.some(t=>el.contains(t))),groupInitial=new Map(groups.map(el=>[el,el.hidden]));
 const apply=()=>{
  const q=input.value.trim();let count=0;
  for(const target of targets){target.hidden=initial.get(target)||!!q&&!matchSearch(target.textContent,q);if(!target.hidden)count++;}
  for(const group of groups)group.hidden=groupInitial.get(group)||!!q&&!targets.some(t=>group.contains(t)&&!t.hidden);
  box.querySelector('[data-menu-status]').textContent=q?(count?count+' bağlantı bulundu':'Modül bulunamadı. Başka bir kelime deneyin.'):count+' modül bağlantısı';
 };
 input.addEventListener('input',apply);box.querySelector('[data-menu-clear]').onclick=()=>{input.value='';apply();input.focus();};apply();
}

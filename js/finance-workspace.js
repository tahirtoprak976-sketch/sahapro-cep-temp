// Read-only navigation and triage. Money calculations stay in their source modules.
import {isActive,matchSearch} from './core.js';
import {collectBoardItems} from './collect-core.js';
import {paymentAgenda,paymentPriorityItems} from './payment-agenda.js';
import {esc} from './ui.js';
const paths={receipt:'M12 3v18m-4-4 4 4 4-4M4 4h4m8 0h4M4 9h3m10 0h3',expense:'M12 21V3m-4 4 4-4 4 4M4 20h4m8 0h4M4 15h3m10 0h3',document:'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h7',account:'M3 21h18M5 21V10m5 11V10m4 11V10m5 11V10M3 7l9-4 9 4v3H3z',chart:'M4 3v18h17M8 16l4-5 4 2 5-8',tools:'M5 4h14v16H5zM9 8h6m-6 4h6m-6 4h3',search:'M21 21l-5-5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14'};
export const financeIcon=(name='tools')=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.tools}"/></svg>`;
export function financeToolHTML(route,title,description='',icon='tools'){
 return `<a class="finance-tool" data-finance-tool href="${esc(route)}"><span class="finance-tool-icon">${financeIcon(icon)}</span><span><b>${esc(title)}</b>${description?`<small>${esc(description)}</small>`:''}</span><span aria-hidden="true">›</span></a>`;
}
export const financeToolGroup=(title,html)=>`<section class="finance-tool-group" data-finance-tool-group><h3>${esc(title)}</h3>${html}</section>`;
export function financeWorkspaceTasks(d,{today,from,to,summary,notes={}}){
 const items=[];
 if(summary.unpriced)items.push({key:'price',rank:0,title:`${summary.unpriced} işin fiyatı eksik`,why:'Seçili dönem · İş değeri ve alacak eksik görünebilir. Fiyatı bilinmeyen iş ücretsiz sayılmaz.',href:'#/isler?f=fiyatsiz&period=all',action:'İşleri incele'});
 const waiting=(d.cash_records||[]).filter(r=>isActive(r)&&r.cash_type==='Müşteriden Para Alındı'&&r.cash_status==='TESLIM_BILDIRILDI'&&(!from||r.date>=from)&&r.date<=to);
 if(waiting.length)items.push({key:'handover',rank:1,title:`${waiting.length} teslim bildirimi onay bekliyor`,why:'Seçili dönem · Bildirim, kasaya teslim onayı değildir.',href:'#/kasa',action:'Teslimleri incele'});
 const agenda=paymentAgenda(d,{today});
 const review=agenda.rows.filter(r=>r.bucket==='review');
 if(review.length)items.push({key:'pay-review',rank:2,title:`${review.length} ödeme belgesi kontrol istiyor`,why:'Bugün itibarıyla · Vade veya taraf bilgisi eksik; ödeme tutarı varsayılmadı.',href:'#/odeme-takibi',action:'Ödeme takibini aç'});
 for(const p of paymentPriorityItems(agenda))items.push({key:p.key,rank:3+p.urgency,title:p.title,why:'Bugün itibarıyla · '+p.why,href:p.hash,action:p.action});
 for(const [i,r]of collectBoardItems(d,{today,notes}).entries())items.push({key:'collect:'+i,rank:r.kind==='alert'?3:5,title:r.text,why:'Bugün itibarıyla · '+r.sub,href:r.href,action:'Kaydı incele'});
 const drafts=(d.hakedis||[]).filter(h=>isActive(h)&&h.status==='Taslak');
 if(drafts.length)items.push({key:'claims',rank:8,title:`${drafts.length} taslak hakediş bekliyor`,why:'Tüm tarihler · Taslak, kesinleşmiş müşteri borcu değildir.',href:'#/hakedis',action:'Hakedişleri incele'});
 // Stable sort preserves the source agenda's due-date order within urgency.
 return items.sort((a,b)=>a.rank-b.rank);
}
export function bindFinanceTools(root){
 const input=root.querySelector('[data-finance-search]'),box=root.querySelector('[data-finance-tools]'),status=root.querySelector('[data-finance-search-status]');
 let previousOpen=false,searching=false;
 const apply=()=>{
  const q=input.value.trim();
  if(q&&!searching){previousOpen=box.open;searching=true;}
  if(q)box.open=true;else if(searching){box.open=previousOpen;searching=false;}
  let count=0;
  for(const tool of root.querySelectorAll('[data-finance-tool]')){tool.hidden=!!q&&!matchSearch(tool.textContent,q);if(!tool.hidden)count++;}
  for(const group of root.querySelectorAll('[data-finance-tool-group]'))group.hidden=![...group.querySelectorAll('[data-finance-tool]')].some(el=>!el.hidden);
  status.textContent=q?(count?`${count} araç bulundu`:'Araç bulunamadı. Başka bir kelime deneyin.'):'Tüm finans araçlarına buradan ulaşabilirsiniz.';
 };
 root.querySelector('[data-finance-open-tools]').onclick=()=>{input.focus({preventScroll:true});input.scrollIntoView({block:'center',behavior:'auto'});};
 input.addEventListener('input',apply);
 root.querySelector('[data-finance-search-clear]').onclick=()=>{input.value='';apply();input.focus();};
 root.addEventListener('finance-tools-updated',apply);apply();
}

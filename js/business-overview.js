import {pdfPending} from './pending-records.js';
export {pdfPending} from './pending-records.js';
// İşletme panosu ve yerel asistan özetleri. SAF, kayıt yazmaz; para ve birimler ayrı.
import {isActive,todayStr,addDays,toKurus,fromKurus,WORK_UNITS} from './core.js';
import {workAmount,hasWorkPrice,workReviewContext} from './collect-core.js';
import {costRows,costTotals} from './costs-core.js';
import {attentionItems,fuelSummaries} from './attention.js';
import {isIncluded} from './job-core.js';
import {maintenanceBoard} from './maint-core.js';

export const OVERVIEW_PERIODS=[['today','Bugün'],['week','Son 7 gün'],['month','Bu ay'],['lastmonth','Geçen ay'],['custom','Tarih seç']];
export function overviewDate(s){
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;
}
export function overviewRange(period='month',today=todayStr(),custom={}){
 if(!overviewDate(today))throw Error('Bugünün tarihi geçersiz.');
 if(!OVERVIEW_PERIODS.some(x=>x[0]===period))period='month';
 let from=today,to=today;
 if(period==='week')from=addDays(today,-6);
 if(period==='month')from=today.slice(0,8)+'01';
 if(period==='lastmonth'){to=addDays(today.slice(0,8)+'01',-1);from=to.slice(0,8)+'01';}
 if(period==='custom'){from=custom.from;to=custom.to;}
 if(!overviewDate(from)||!overviewDate(to)||from>to)throw Error('Başlangıç ve bitiş tarihini kontrol edin.');
 if(to>today)throw Error('Pano gerçekleşmiş kayıtları gösterir; bitiş bugün veya daha önce olmalı.');
 const days=Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/864e5)+1;
 if(days>366)throw Error('Tek seferde en fazla 366 gün seçin.');
 return {period,from,to,days,label:OVERVIEW_PERIODS.find(x=>x[0]===period)[1]};
}
const live=(d,s)=>(d[s]||[]).filter(isActive);
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const sumMoney=(a,get)=>fromKurus(a.reduce((n,x)=>n+toKurus(get(x)),0));
export function workPriceState(w,d,context=workReviewContext(d)){
 if(context.internal.has(w.customer_id)||w.price_snapshot?.price_source==='İç iş (kendi depo)')return 'internal';
 if(isIncluded(w))return 'included';
 if(w.price_snapshot?.price_source==='Mazot karşılığı')return 'fuel';
 if(hasWorkPrice(w))return 'priced';
 if(Number(w.customer_fuel_allowance_l)>0)return 'fuel';
 if(w.price_snapshot?.locked)return 'locked';
 if(context.billed.has(w.id))return 'billed';
 return 'missing';
}
const inRange=(x,r)=>overviewDate(x.date)&&x.date>=r.from&&x.date<=r.to;
function timeline(d,r){
 const out=[];
 if(r.days<=31){for(let date=r.from;date<=r.to;date=addDays(date,1))out.push({from:date,to:date,label:date.slice(8)+'.'+date.slice(5,7)});}
 else{for(let date=r.from;date<=r.to;){const end=new Date(date+'T12:00:00Z');end.setUTCMonth(end.getUTCMonth()+1,0);const to=end.toISOString().slice(0,10)>r.to?r.to:end.toISOString().slice(0,10);out.push({from:date,to,label:date.slice(5,7)+'.'+date.slice(0,4)});date=addDays(to,1);}}
 const works=live(d,'work_records').filter(x=>inRange(x,r));
 const cash=live(d,'cash_records').filter(x=>inRange(x,r)&&x.cash_type==='Müşteriden Para Alındı');
 const costs=costRows(d,{from:r.from,to:r.to});
 for(const b of out){
  b.works=works.filter(x=>inRange(x,b)).length;
  b.cash=sumMoney(cash.filter(x=>inRange(x,b)),x=>x.amount);
  b.cost=sumMoney(costs.filter(x=>inRange(x,b)),x=>x.amount);
 }
 return out;
}
export function businessOverview(d,{today=todayStr(),period='month',from,to,meta=[]}={}){
 const range=overviewRange(period,today,{from,to});
 const works=live(d,'work_records').filter(x=>inRange(x,range));
 const cash=live(d,'cash_records').filter(x=>inRange(x,range)&&x.cash_type==='Müşteriden Para Alındı');
 const costs=costRows(d,{from:range.from,to:range.to});
 const fuel=live(d,'fuel_records').filter(x=>inRange(x,range));
 const context=workReviewContext(d);
 const priced=works.filter(w=>workPriceState(w,d,context)==='priced');
 const missing=works.filter(w=>workPriceState(w,d,context)==='missing');
 const units={};for(const unit of WORK_UNITS){const a=works.filter(w=>w.unit===unit);if(a.length)units[unit]=Math.round(a.reduce((n,w)=>n+num(w.quantity),0)*100)/100;}
 const previous={from:addDays(range.from,-range.days),to:addDays(range.from,-1)};
 const previousCount=live(d,'work_records').filter(x=>inRange(x,previous)).length;
 const group=(store,key)=>live(d,store).map(entity=>{
  const rows=works.filter(x=>x[key]===entity.id);if(!rows.length)return null;
  const units={};for(const w of rows)if(w.unit)units[w.unit]=Math.round(((units[w.unit]||0)+num(w.quantity))*100)/100;
  return {id:entity.id,name:entity.name||entity.plate||'Adsız',count:rows.length,units};
 }).filter(Boolean).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'tr'));
 const pending=pdfPending(meta,d);
 const restore=meta.filter(m=>m.key.startsWith('restore_set:')).map(m=>m.value);
 const attention=attentionItems(d,{today,restoreSets:restore,meta});
 const due=maintenanceBoard(d,{today}).filter(x=>x.state==='late'||x.state==='soon');
 if(due.length)attention.push({key:'maintenance',count:due.length,title:due.length+' bakım kuralı yaklaşıyor veya gecikti',why:'Bakım takvimindeki gün / sayaç kayıtlarına göre.',next:'İlgili aracı ve bakım kuralını kontrol edin.',hash:'#/bakim-takvimi'});
 return {range,works,cash,costs,fuel,priced,missing,units,
  totals:{works:works.length,value:sumMoney(priced,workAmount),cash:sumMoney(cash,x=>x.amount),cost:costTotals(costs).total,liters:Math.round(fuel.reduce((n,f)=>n+num(f.liters),0)*100)/100},
  comparison:{...previous,count:previousCount,change:works.length-previousCount,percent:previousCount?Math.round((works.length-previousCount)/previousCount*100):null},
  timeline:timeline(d,range),customers:group('customers','customer_id'),vehicles:group('vehicles','vehicle_id'),
  attention,pending,fuelAccounts:fuelSummaries(d)};
}
const fmt=n=>Number(n).toLocaleString('tr-TR',{maximumFractionDigits:2});
export function localOverviewCommand(text,d,today=todayStr()){
 const t=String(text||'').trim().toLocaleLowerCase('tr-TR').replace(/[.!?]+$/,'').replace(/\s+/g,' ');
 const periods={'bugünkü durum':'today','bugunku durum':'today','bugünü özetle':'today','bugunu ozetle':'today','bu ayın özeti':'month','bu ayin ozeti':'month','son 7 günün özeti':'week','son 7 gunun ozeti':'week','geçen ayın özeti':'lastmonth','gecen ayin ozeti':'lastmonth'};
 const aliases={'bugün ne yaptık':'today','bugun ne yaptik':'today','bugünün özeti':'today','bugunun ozeti':'today','bugünkü durum nedir':'today','bu ay ne yaptık':'month','bu ay ne yaptik':'month','bu ayın özetini göster':'month','bana bu ayın özetini göster':'month','son 7 günü özetle':'week','geçen ay ne yaptık':'lastmonth'};
 Object.assign(periods,aliases);
 if(['işletme panosunu aç','isletme panosunu ac','işletme panosu','isletme panosu'].includes(t))return {kind:'open',label:'İşletme Panosu',hash:'#/isletme-panosu'};
 if(['bekleyen işler','bekleyen isler','dikkat isteyen işler','dikkat isteyen isler'].includes(t)){
  const items=attentionItems(d,{today});
  return {kind:'answer',label:'Kontrol bekleyen kayıtlar',text:items.length?items.map(x=>x.title+'. '+x.next).join('\n'):'Mevcut denetimlerde kontrol maddesi bulunmadı. PDF taslakları ve yedek durumu için işletme panosunu açabilirsiniz.',items:[{hash:'#/isletme-panosu',label:'PDF taslakları dahil işletme panosu'},...items.map(x=>({hash:x.hash,label:x.title}))]};
 }
 if(!periods[t])return null;
 const p=businessOverview(d,{period:periods[t],today});
 const units=Object.entries(p.units).map(([u,n])=>fmt(n)+' '+u).join(' · ')||'Miktar kaydı yok';
 return {kind:'answer',label:p.range.label+' — işletme özeti',text:p.range.from+' → '+p.range.to+'\n'+p.totals.works+' iş · '+units+'\nFiyatlı iş değeri: '+fmt(p.totals.value)+' TL (kayıttaki tutarlar; KDV esasları farklı olabilir).\nTahsilat: '+fmt(p.totals.cash)+' TL · Kayıtlı maliyet: '+fmt(p.totals.cost)+' TL.\n'+p.missing.length+' işin fiyatı eksik. Mazot hesabı litre olarak ayrı izlenir; bu rakamlar kâr veya cari bakiye değildir.',items:[{hash:'#/isletme-panosu?period='+p.range.period,label:'Grafikleri ve kaynak kayıtlarını aç'},{hash:'#/isler?from='+p.range.from+'&to='+p.range.to,label:'Bu dönemin işleri'}]};
}

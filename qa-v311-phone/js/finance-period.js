import {isActive,todayStr} from './core.js';
import {validDate} from './driver-delivery.js';
import {costRows} from './costs-core.js';
import {pendingFuelSummary} from './historical-fuel.js';
import {financePeriodSummary,lastMonths} from './finance-chart.js';
const months=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
export const financeMonthLabel=key=>months[Number(key.slice(5,7))-1]+' '+key.slice(0,4);
export function financePeriod(data,query={},today=todayStr()){
 const keys=new Set();
 const rows=[...(data.work_records||[]).filter(isActive),...(data.cash_records||[]).filter(r=>isActive(r)&&r.cash_type==='Müşteriden Para Alındı'),...costRows(data,{to:today}),...pendingFuelSummary(data,{to:today}).rows];
 for(const r of rows)if(validDate(r.date)&&r.date<=today)keys.add(r.date.slice(0,7));
 const available=[...keys].sort().reverse(),current=today.slice(0,7);
 let period=['month','last','3m','all'].includes(query.period)?query.period:null;
 const explicit=/^\d{4}-\d{2}$/.test(query.month||'')&&validDate(query.month+'-01')&&query.month<=current?query.month:null;
 let month=explicit||(period==='last'?lastMonths(today,2)[0]:current),automatic=false;
 if(!period&&!explicit&&!keys.has(current)&&available.length){month=available[0];automatic=month!==current;}
 period=period||(explicit?'month':'month');
 let from=period==='all'?'':period==='3m'?lastMonths(today,3)[0]+'-01':month+'-01';
 const end=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0),endDate=todayStr(end);
 const to=period==='all'||period==='3m'?today:endDate<today?endDate:today;
 if(from>to)from=to;
 const label=period==='all'?'Tüm tarihler':period==='3m'?'Son 3 ay':financeMonthLabel(month);
 return {period,month,from,to,label,automatic,available,current,invalid:!!query.month&&!explicit,summary:financePeriodSummary(data,{from,to,today})};
}

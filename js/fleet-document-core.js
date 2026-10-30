// Read-only calendar-day counters. A future renewal cannot hide today's expiry.
import {isActive,todayStr,DOC_FAMILY,matchSearch} from './core.js';
import {validDate as realDate} from './driver-delivery.js';
import {VEHICLE_DOCS} from './business.js';

const timeless=new Set(['Ruhsat','Makine Tescil Belgesi']);
const timed=new Set(VEHICLE_DOCS.filter(type=>!timeless.has(type)));
const family=value=>{const name=typeof value==='string'?value:'Belge';return Object.hasOwn(DOC_FAMILY,name)?DOC_FAMILY[name]:name;};
const day=value=>Date.parse(value+'T00:00:00Z')/86400000;
const order={overdue:0,today:1,soon:2,invalid:3,unknown:3,owner:3,valid:4,future:5,unlimited:6};
export function documentVehicle(d){
  if(d.owner_type&&d.owner_type!=='vehicle')return null;
  const ids=[...new Set([d.vehicle_id,d.owner_type==='vehicle'?d.owner_id:null].filter(x=>typeof x==='string'&&x))];
  return ids.length===1?ids[0]:null;
}
export function documentCountdown(d,today=todayStr()){
  if(!realDate(today))throw Error('Sayaç için geçerli gün gerekli.');
  const start=d.valid_from||d.date,end=d.expiry_date;
  if(!realDate(d.date)||!realDate(start)||(d.valid_from!=null&&d.valid_from!==''&&!realDate(d.valid_from))||(end!=null&&end!==''&&!realDate(end))||end&&(end<start||end<d.date))
    return {state:'invalid',days:null,label:'Tarihleri kontrol edin',progress:null};
  if(!end&&timed.has(family(d.category)))return {state:'unknown',days:null,label:'Bitiş tarihi eksik',progress:null};
  const days=end?day(end)-day(today):null,startsIn=day(start)-day(today);
  if(startsIn>0)return {state:'future',days,startsIn,label:d.valid_from?startsIn+' gün sonra başlar':'Belge tarihi '+startsIn+' gün sonra',progress:0};
  if(!end)return {state:'unlimited',days:null,label:timeless.has(family(d.category))?'Süre sınırı girilmemiş':'Süre takibi yok',progress:null};
  const state=days<0?'overdue':days===0?'today':days<=30?'soon':'valid';
  return {state,days,label:days<0?Math.abs(days)+' gün geçti':days===0?'Bugün bitiyor':days+' gün kaldı',
    progress:days===0?100:Math.max(0,Math.min(100,(day(today)-day(start))/Math.max(1,day(end)-day(start))*100))};
}
export function fleetDocumentModel(data,{today=todayStr(),includeInactive=false,vehicle_id='',q='',status='all'}={}){
  if(!realDate(today))throw Error('Sayaç için geçerli gün gerekli.');
  const vehicles=(data.vehicles||[]).filter(v=>isActive(v)&&(includeInactive||v.active!==false));
  const byId=new Map(vehicles.map(v=>[v.id,v])),groups=new Map(),rows=[];
  for(const doc of (data.documents||[]).filter(d=>isActive(d)&&d.status!=='İptal')){
    const id=documentVehicle(doc);
    if(!id){
      if(doc.owner_type==='vehicle'&&(!doc.owner_id&&!doc.vehicle_id||[doc.owner_id,doc.vehicle_id].some(id=>byId.has(id)))){
        const candidates=[...new Set([doc.owner_id,doc.vehicle_id].filter(id=>byId.has(id)))];
        rows.push({doc,vehicle:null,candidates,state:'owner',days:null,label:'Araç eşleşmesini kontrol edin',progress:null,history:[]});
      }
      continue;
    }
    const vehicle=byId.get(id);if(!vehicle)continue;
    const key=JSON.stringify([id,family(doc.category)]),group=groups.get(key)||{vehicle,docs:[]};
    group.docs.push(doc);groups.set(key,group);
  }
  for(const {vehicle,docs} of groups.values()){
    const dated=docs.map(doc=>({doc,vehicle,...documentCountdown(doc,today),history:[]}));
    const current=dated.filter(r=>!['future','invalid','unknown'].includes(r.state))
      .sort((a,b)=>String(b.doc.expiry_date||'9999').localeCompare(String(a.doc.expiry_date||'9999'))||String(b.doc.date).localeCompare(String(a.doc.date))||String(a.doc.id).localeCompare(String(b.doc.id)));
    if(current.length)rows.push({...current[0],history:current.slice(1).map(r=>r.doc)});
    // Unknown/invalid evidence stays visible even when a dated copy exists.
    rows.push(...dated.filter(r=>['future','invalid','unknown'].includes(r.state)));
  }
  rows.sort((a,b)=>order[a.state]-order[b.state]||(a.days??Infinity)-(b.days??Infinity)||String(a.vehicle?.name||'').localeCompare(String(b.vehicle?.name||''),'tr')||String(a.doc.id).localeCompare(String(b.doc.id)));
  const scoped=rows.filter(r=>(!vehicle_id||r.vehicle?.id===vehicle_id||r.candidates?.includes(vehicle_id))&&matchSearch([r.vehicle?.name,r.vehicle?.plate,r.doc.category,r.doc.doc_no,r.doc.institution].join(' '),q));
  const counts={all:scoped.length,overdue:0,today:0,soon:0,week:0,review:0,future:0,valid:0};
  for(const row of scoped){if(row.state==='soon'&&row.days<=7)counts.week++;if(['invalid','unknown','owner'].includes(row.state))counts.review++;else if(Object.hasOwn(counts,row.state))counts[row.state]++;}
  const selected=scoped.filter(r=>status==='all'||status==='review'&&['invalid','unknown','owner'].includes(r.state)||status==='week'&&rowInWeek(r)||status===r.state);
  return {today,vehicles,rows,scoped,selected,counts};
}
const rowInWeek=r=>r.state==='soon'&&r.days<=7;
export function nearestVehicleDocument(model,id){
  return model.rows.find(r=>r.vehicle?.id===id||r.candidates?.includes(id))||null;
}

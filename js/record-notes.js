// Record-local notes only. Full source is evidence, never history/matching input.
import {foldTr} from './parser.js';
const str=x=>typeof x==='string'?x:'';
const norm=x=>foldTr(str(x)).replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const has=(text,value)=>!!norm(value)&&(' '+norm(text)+' ').includes(' '+norm(value)+' ');
const wire=s=>str(s).replace(/\bSP(?:AK)?1:[A-Za-z0-9_.-]+/g,'').trim();
const legacy=/^(?:Bildiren:[^\n]*?·\s*)?Asistan:\s*/u;
const number=s=>Number(String(s).replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'));
const nameMatch=(text,value)=>{
 const n=norm(value);if(!n)return false;if(has(text,n))return true;
 // Space/punctuation differences in U(55), U55 and 34 GAM 627 are equivalent.
 if(/\d/.test(n)&&n.replace(/ /g,'').length>=3){const p=n.match(/[a-z]+|\d+/g)?.join('\\s*');return !!p&&new RegExp('(?:^| )'+p+'(?: |$)').test(norm(text));}
 return false;
};
function cards(context,store){const x=context[store]||context.names?.[store]||{};return Array.isArray(x)?x:Object.entries(x).map(([id,name])=>({id,name}));}
function identities(row,context){
 return ['vehicles','customers','personnel'].map(store=>{
  const field={vehicles:'vehicle_id',customers:'customer_id',personnel:'personnel_id'}[store],all=cards(context,store),r=all.find(r=>r.id===row[field]);
  const values=[r?.name,r?.plate,store==='customers'?row.new_customer:store==='personnel'?row.reporter:null,...(context.aliases||[]).filter(a=>!a.deleted_at&&a.active!==false&&a.target_id===row[field]).map(a=>a.alias)].filter(Boolean);
  return {store,values,others:['vehicles','customers'].includes(store)&&values.length?all.filter(v=>v.id!==row[field]).flatMap(v=>[v.name,v.plate]).filter(Boolean):[]};
 });
}
export function sourceMessageBlocks(message){
 const text=wire(message),heads=[...text.matchAll(/\[\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?[,\s]+\d{1,2}[:.]\d{2}(?::\d{2})?\]\s*([^:\r\n]{1,80}):[ \t]*|(?<!\S)\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?[,\s]+\d{1,2}[:.]\d{2}(?::\d{2})?\s*[-–]\s*([^:\r\n]{1,80}):[ \t]*/gm)];
 if(!heads.length)return text?[{body:text,sender:'',header:''}]:[];
 return heads.map((h,i)=>({body:text.slice(h.index+h[0].length,heads[i+1]?.index??text.length).trim(),sender:h[1]||h[2]||'',header:h[0].trim()})).filter(b=>b.body);
}
function quantityMatch(text,row,kind){
 if(['fuel','tank','fuelout'].includes(kind))return [...foldTr(text).matchAll(/(\d+(?:[.,]\d+)?)\s*\)?\s*(?:litre|lit|lt|l)(?![a-z])/g)].some(m=>number(m[1])===Number(row.liters));
 if(kind==='work'){
  const u={Saat:'saat',Sefer:'sefer',Yevmiye:'yevmiye|yevmi|yevmiyelik',Ton:'ton',Adet:'adet','m³':'m3|metrekup'}[row.unit];
  return !!u&&[...foldTr(text).matchAll(new RegExp('(\\d+(?:[.,]\\d+)?)\\s*(?:'+u+')(?![a-z])','g'))].some(m=>number(m[1])===Number(row.quantity));
 }
 const amount=row.amount??row.cost??row.total;
 return Number(amount)>0&&[...foldTr(text).matchAll(/(\d[\d.,]*)\s*(?:tl|₺|lira)(?![a-z])/g)].some(m=>number(m[1])===Number(amount));
}
function score(block,row,kind,ids){
 const text=block.body,full=block.sender+' '+text;
 const vehicle=ids[0].values.some(v=>nameMatch(text,v)),customer=ids[1].values.some(v=>nameMatch(text,v)),person=ids[2].values.some(v=>nameMatch(full,v));
 if(!vehicle&&ids[0].others.some(v=>nameMatch(text,v)))return -1;
 if(!customer&&ids[1].others.some(v=>nameMatch(text,v)))return -1;
 const quantity=quantityMatch(text,row,kind),fuel=['fuel','tank','fuelout'].includes(kind);
 if(fuel&&!quantity)return -1;
 const domain=fuel?/mazot|yakit|motorin|\blt\b|litre/.test(norm(text)):kind==='work'?/saat|sefer|yevmiye|calis|nakliye|indiril|yukle|verildi/.test(norm(text)):kind==='maintenance'?/ariza|bakim|onar|tamir|degis|filtre|aku|lastik/.test(norm(text)):kind==='collection'?/odedi|tahsil|alindi|para|nakit|havale/.test(norm(text)):kind==='personnel'?/izin|avans|mesai|rapor|maas/.test(norm(text)):true;
 return (vehicle?5:0)+(customer?5:0)+(person?3:0)+(quantity?5:0)+(domain?2:0);
}
export function scopeRecordSource(message,row={},kind='work',context={}){
 const blocks=sourceMessageBlocks(message),ids=identities(row,context),candidates=[];
 const quote=str(row.source_quote||row.quote||row.src?.quote).trim();
 // A quoted batch is not a record quote. Never validate one photo/message with another.
 if(norm(quote).length>=8&&!/[\n;]/.test(quote)&&sourceMessageBlocks(quote).length<=1){
  const hits=blocks.filter(b=>has(b.body,quote));
  const unique=[...new Map(hits.map(b=>[norm(b.body),b])).values()];
  if(unique.length===1&&score({...unique[0],body:quote},row,kind,ids)>=5){
   const literal=unique[0].body.includes(quote)?quote:unique[0].body;
   return {text:wire(literal),status:'matched',sender:unique[0].sender};
  }
 }
 for(const b of blocks)for(const body of b.body.split(/\r?\n|\s*;\s*/).map(s=>s.trim()).filter(Boolean))candidates.push({...b,body});
 // User-written description can locate one source line, but cannot replace it.
 const description=!legacy.test(str(row.description))?str(row.description):'';
 const ranked=[...new Map(candidates.map(b=>[norm(b.sender+' '+b.body),{...b,score:score(b,row,kind,ids)+(norm(description).length>=8&&has(b.body,description)?3:0)}])).values()].filter(b=>b.score>=5).sort((a,b)=>b.score-a.score);
 if(ranked.length&&(!ranked[1]||ranked[0].score>ranked[1].score))return {text:ranked[0].body,status:'matched',sender:ranked[0].sender};
 return {text:'',status:blocks.length?'unresolved':'empty',sender:''};
}
export function withRecordSource(fields,message,row,kind,context={},autoFields=['description']){
 let match=scopeRecordSource(message,{...row,...fields},kind,context);
 const quote=str(row.source_quote||row.quote||row.src?.quote);
 // A user correction changes the record, not the identity of its original message.
 if(quote&&['vehicle_id','customer_id','personnel_id','quantity','liters','amount'].some(k=>row[k]!=null&&fields[k]!=null&&String(row[k])!==String(fields[k]))){
  const original=scopeRecordSource(message,row,kind,context);
  if(original.status==='matched'&&has(quote,original.text))match=original;
 }
 if(row.driver_entry_id&&str(row.driver_source_note))match={text:wire(row.driver_source_note),status:'matched',sender:row.reporter||''};
 const out={...fields};
 for(const field of autoFields)out[field]=match.text;
 out.assistant_origin={version:1,kind,message:str(message),fragment:match.text,status:match.status,sender:match.sender,fields:Object.fromEntries(autoFields.map(k=>[k,out[k]]))};
 return out;
}
export function recordNoteView(record,field='description',context={},kind){
 const value=str(record[field]),origin=record.assistant_origin;
 if(origin?.version===1&&origin.fields?.[field]===value)return {text:value,source:str(origin.message),unresolved:origin.status==='unresolved',scoped:true};
 if(!legacy.test(value))return {text:value,source:origin?.version===1?str(origin.message):'',unresolved:false,scoped:false};
 const source=value.replace(legacy,''),type=kind||(record.liters!=null?'fuel':record.work_type?'work':record.maint_type?'maintenance':record.event_type?'personnel':record.cash_type?'collection':'expense');
 const match=scopeRecordSource(source,record,type,context);
 return {text:match.text,source:value,unresolved:match.status==='unresolved',scoped:true};
}
export const recordNoteText=(r,field='description',context={},kind)=>recordNoteView(r,field,context,kind).text;
export function recordLocalText(r,context={},kind){return [...new Set(['description','internal_note','note'].map(f=>recordNoteText(r,f,context,kind)).filter(Boolean))].join(' · ');}
export function noteEditPatch(record,values,context={},kind){
 if(record.assistant_origin)return values;
 const originals=Object.fromEntries(Object.keys(values).filter(f=>['description','internal_note','note'].includes(f)&&recordNoteView(record,f,context,kind).scoped).map(f=>[f,str(record[f])]));
 if(!Object.keys(originals).length)return values;
 return {...values,assistant_origin:{version:1,kind,message:Object.values(originals)[0],original_fields:originals,fragment:values.internal_note||values.description||values.note||'',status:'matched',fields:Object.fromEntries(Object.keys(originals).map(f=>[f,values[f]]))}};
}

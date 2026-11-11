import {realDate} from './work-explorer.js';
// Draft-only question queue. Answers authorize one explicit field change, never Save.
const raw={customer:'customer_id',vehicle:'vehicle_id',site:'site_id',personnel:'personnel_id',unit_price:'unit_price'};
const label={source:'Yakıt nereden alındı?',date:'Tarihi doğrulayın',customer:'Müşteri kim?',vehicle:'Hangi araç?',work_type:'İş türü nedir?',quantity:'Miktar / süre ne kadar?',unit:'Birimi nedir?',material:'Hangi malzeme?',unit_price:'Birim fiyatı doğrulayın'};
export function assistantQuestions(rows){
 const groups=new Map(),dateGroups=new Map();
 const sharedDate=row=>{const r=row.r||{},proof=r._fieldEvidence?.date,f=r.fieldConfidence?.date;return !row.saved&&proof?.value===r.date&&realDate(r.date)&&['source_context','source_row'].includes(proof.source)&&['KESIN','CIKARIM'].includes(proof.level)&&!f?.photoConflict&&((row.missing||[]).includes('date')||r.calendarConflict||r.dateConflict||f?.level==='BILINMIYOR')?r.date:null;};
 for(const row of rows){const date=sharedDate(row);if(date)dateGroups.set(date,(dateGroups.get(date)||0)+1);}
 for(const row of rows.filter(r=>!r.saved)){
  const r=row.r||{},fields=new Set(row.missing||[]);
  for(const [field,f]of Object.entries(r.fieldConfidence||{})){
   const name=Object.keys(raw).find(k=>raw[k]===field)||field;
   if(f.level==='BILINMIYOR'&&(fields.has(name)||row.fields?.[name]!==undefined&&row.fields[name]!==''&&row.fields[name]!=null))fields.add(name);
  }
  if(r.calendarConflict||r.dateConflict)fields.add('date');
  if(r.sourceNeedsMaterial)fields.add('material');
  if(r.sourceUncertain)fields.add('source');
  const combined=row.kind==='work'&&fields.has('quantity');
  if(combined)fields.delete('unit');
  for(const field of fields){
   const hint=field==='customer'?r.unknownCustomerLabel:field==='vehicle'?r.unknownVehicleLabel:null;
   const commonDate=field==='date'?sharedDate(row):null;
   const key=hint?field+':'+hint:commonDate&&dateGroups.get(commonDate)>1?'date:phone:'+commonDate:row.kind+':'+row.index+':'+field;
   const q=groups.get(key)||{key,field,fields:combined&&field==='quantity'?['quantity','unit']:[field],optional:!!(field==='quantity'&&r.contractIncluded),priority:({vehicle:0,customer:1,date:2}[field]??(field==='quantity'&&r.contractIncluded?9:4)),label:hint?hint+' — '+(label[field]||field):(field==='quantity'&&row.kind==='work'?(r.unit==='Saat'?'Miktar / süre: Kaç saat?':r.unit==='Sefer'?'Miktar: Kaç sefer?':'Miktar / süre: Kaç saat / sefer?'):label[field]||field),targets:[],suggested:r.fieldConfidence?.[raw[field]||field]?.suggestedValue??(field==='date'&&r.calendarConflict?r.date:null)};
   q.targets.push({kind:row.kind,index:row.index,key:row.key||row.kind+':'+row.index});groups.set(key,q);
  }
 }
 return [...groups.values()].sort((a,b)=>a.priority-b.priority);
}

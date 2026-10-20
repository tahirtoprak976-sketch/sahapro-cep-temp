// Explicit structured driver names must never be fuzzy-matched to a parent company.
import {foldTr} from './parser.js';
import {isActive} from './core.js';
export const customerNameKey=s=>foldTr(String(s||'')).replace(/\s+/g,' ').trim();
export function customerLabel(c,customers){const parent=customers.find(x=>x.id===c.parent_customer_id);return c.name+(parent&&!customerNameKey(c.name).endsWith('('+customerNameKey(parent.name)+')')?' ('+parent.name+')':'');}
export function resolveDriverCustomer(e,d){
 const all=(d.customers||[]).filter(isActive),id=all.find(c=>c.id===e.cid);
 const result=(c,name=null,parent=null,issue='')=>({customer_id:c?.id||null,new_customer:name,new_customer_parent_id:parent,customer_issue:issue});
 if(id)return result(id);
 const name=String(e.cn||'').trim();if(!name)return result(null,null,null,'Müşteri kartı bulunamadı; müşteriyi seçin.');
 const exact=all.filter(c=>customerNameKey(c.name)===customerNameKey(name));
 if(exact.length===1)return result(exact[0]);
 if(exact.length>1)return result(null,null,null,'Aynı adlı birden fazla müşteri var; ana firmasını kontrol ederek seçin.');
 const parts=/^(.+?)\s*\(([^()]+)\)\s*$/.exec(name);
 if(parts){
  const parents=all.filter(c=>customerNameKey(c.name)===customerNameKey(parts[2]));
  if(parents.length===1){
   const parent=parents[0],childName=parts[1].trim();
   const children=all.filter(c=>c.parent_customer_id===parent.id&&customerNameKey(c.name)===customerNameKey(childName));
   if(children.length===1)return result(children[0]);
   if(children.length>1)return result(null,null,null,'Bu ana firmada aynı adlı birden fazla alt müşteri var; doğru kartı seçin.');
   return result(null,childName,parent.id);
  }
  return result(null,name,null,'Parantezdeki ana firma kesin bulunamadı; müşteri ve ana firma ilişkisini kontrol edin.');
 }
 return result(null,name);
}
export function driverCashAmount(value){
 if(value==null||value==='')return 0;
 const n=Number(String(value).replace(',','.'));
 return Number.isFinite(n)&&n>=0&&(n===0||n>=0.01)&&n<=1e12&&Math.abs(n*100-Math.round(n*100))<0.0000001?Math.round(n*100)/100:null;
}

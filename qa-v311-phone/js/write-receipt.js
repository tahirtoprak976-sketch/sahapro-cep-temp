// Receipts belong to one successful transaction and its returned result, never
// to a global before/after database diff. Nothing here changes stored rows.
import {ENTITY_STORES} from './core.js';
export const RECEIPT_META = ['collect_notes','collect_iban','fuel_ref_price','assistant_rules','company_profile'];
const receipts=new WeakMap(), transactions=new WeakMap();
export function journalTransaction(native) {
  const changes=new Map(), stores=new Map();
  const proxy=new Proxy(native,{
    get(target,key){
      if(key==='objectStore')return name=>{
        if(stores.has(name))return stores.get(name);
        const os=target.objectStore(name), wrapped=new Proxy(os,{
          get(store,method){
            if(['put','add','delete'].includes(method))return (...args)=>{
              const value=method==='delete'?null:structuredClone(args[0]);
              const id=method==='delete'?args[0]:value?.[store.keyPath];
              const eligible=(ENTITY_STORES.includes(name)&&name!=='audit_log')||name==='attachments'||name==='meta'&&RECEIPT_META.includes(id);
              if(eligible){
                const old=store.get(id), token=JSON.stringify([name,id]);
                old.addEventListener('success',()=>{const prior=changes.get(token);changes.set(token,{store:name,id,before:prior?prior.before:old.result??null,after:value});});
              }
              return store[method](...args);
            };
            const result=Reflect.get(store,method,store);return typeof result==='function'?result.bind(store):result;
          }
        });stores.set(name,wrapped);return wrapped;
      };
      const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
    },
    set(target,key,value){return Reflect.set(target,key,value,target);}
  });
  transactions.set(proxy,changes);return proxy;
}
export function rememberWrites(result, transaction) {
  if(result&&typeof result==='object')receipts.set(result,[...(transactions.get(transaction)?.values()||[])]);
  return result;
}
export const writesOf=result=>result&&typeof result==='object'?receipts.get(result):null;
export const transactionWrites=transaction=>[...(transactions.get(transaction)?.values()||[])];

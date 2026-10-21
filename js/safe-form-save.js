// A form owns one write attempt; attachments can resume without writing money twice.
import {uuid} from './core.js';
import {collectForm,esc,notice,toast} from './ui.js';
const clean=r=>{const {_existing,...record}=r;return record;};
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const equal=(a,b)=>JSON.stringify(canonical(a??null))===JSON.stringify(canonical(b??null));
const routes={fuel_records:'yakit',expense_records:'gider',maintenance_records:'bakim',payables:'alislar'};

export function createSaveAttempt(db,key='form:'+uuid()){
 let saved=null,signature=null,uncertain=false;
 const remember=(store,record,hash)=>{saved={store,record:clean(record)};signature=hash;uncertain=false;return saved.record;};
 const current=async()=>{
  const record=await db.get(saved.store,saved.record.id);
  if(!record||record.deleted_at||record.status==='İptal')throw Error('Kaydedilen kayıt artık kullanılamıyor. Yeni kayıt oluşturulmadı.');
  if(!equal(record,saved.record))throw Error('Kaydedilen kayıt başka yerde değişti. Kaydı açıp inceleyin; yeni kayıt oluşturulmadı.');
  return record;
 };
 const perform=async(store,payload,write,lookup)=>{
  const hash=await db.opHash({store,payload});
  if(saved){if(saved.store!==store||signature!==hash)throw Error('Kayıt zaten oluşturuldu. Bilgileri değiştirmek için kayıt ekranını açın.');return current();}
  if(uncertain){const recovered=await lookup(hash);if(recovered)return remember(store,recovered,hash);uncertain=false;}
  try{const result=await write(hash);return result?remember(store,result,hash):null;}
  catch(error){
   try{const recovered=await lookup(hash);if(recovered)remember(store,recovered,hash);else uncertain=false;}
   catch{uncertain=true;}
   throw error;
  }
 };
 return {
  key,get record(){return saved;},get uncertain(){return uncertain;},
  saveNew(store,fields,reason){return perform(store,fields,hash=>db.saveNew(store,fields,reason,{op:{id:key,hash}}),async hash=>{
   const op=await db.opLookup(key);if(!op)return null;
   if(op.store!==store||op.hash!==hash)throw Error('Önceki işlemin içeriği uyuşmuyor.');
   return op.record;
  });},
  update(store,record,fields,reason){return perform(store,{id:record.id,fields},()=>db.saveExisting(store,record,fields,reason),async()=>{
   const now=await db.get(store,record.id);
   return now&&!now.deleted_at&&Object.entries(fields).every(([k,v])=>equal(now[k],v))?now:null;
  });},
  external(store,payload,write){return perform(store,payload,()=>write(key),async()=>{
   return (await db.getAll(store)).find(r=>r.request_id===key&&!r.deleted_at)||null;
  });},
  async attach(type,file){if(!saved)throw Error('Önce kayıt tamamlanmalı.');const record=await current();if(file)await db.addAttachment(type,record.id,file);return record;},
 };
}

export function bindSafeFormSave(root,db,handler){
 const form=root.querySelector('[data-form]'),button=root.querySelector('[data-save]');
 const attempt=createSaveAttempt(db),original=button.textContent;
 const feedback=document.createElement('div');feedback.dataset.saveFeedback='';feedback.setAttribute('aria-live','polite');form.after(feedback);
 let busy=false,done=false,frozen=null;
 root.addEventListener('click',e=>{if(busy&&e.target.closest('a,[data-go]')){e.preventDefault();e.stopImmediatePropagation();}},true);
 button.addEventListener('click',async()=>{
  if(busy||done)return;busy=true;
  const values=frozen||collectForm(form);
  if(!frozen)for(const input of form.querySelectorAll('input[type=checkbox][name]'))values[input.name]=input.checked;
  const files=Object.fromEntries([...form.querySelectorAll('input[type=file][name]')].map(input=>[input.name,input.files[0]||null]));
  const controls=[...root.querySelectorAll('input,select,textarea,button')].filter(el=>!el.disabled);
  for(const control of controls)control.disabled=true;
  button.textContent='Kaydediliyor…';feedback.innerHTML=notice('info','İşlem sürüyor. Tekrar basmanıza gerek yok.');
  attempt.values=values;attempt.files=files;attempt.finish=action=>{done=true;if(root.isConnected)action();};
  let failed=false;
  try{await handler(attempt);}
  catch(error){
   failed=true;
   if(root.isConnected){
    const partial=!!attempt.record,message=partial?'Kayıt kaydedildi; son adım tamamlanamadı. Yeni kayıt oluşturmadan tekrar deneyin. ':attempt.uncertain?'İşlem sonucu doğrulanamadı. Bilgiler korunuyor; aynı işlemi tekrar deneyin. ':'Kayıt tamamlanamadı; formdaki bilgiler korunuyor. ';
    const target=attempt.record;
    feedback.innerHTML=notice('warn',message+(error.message||String(error)))+(target?`<a class="btn block" data-saved-record href="#/${routes[target.store]}/${encodeURIComponent(target.record.id)}">Kaydedilen kaydı aç</a>`:'');
    toast(partial?'Kayıt var; eksik adımı tekrar deneyin.':error.message||'Kayıt tamamlanamadı','err');
    feedback.scrollIntoView({block:'nearest'});
   }
  }finally{
   busy=false;
   if(attempt.record||attempt.uncertain)frozen=structuredClone(values);
   if(root.isConnected&&!done){
    for(const control of controls)if(!frozen||control.type==='file'||control===button)control.disabled=false;
    button.textContent=frozen?'İşlemi tamamla':original;
    if(!failed)feedback.innerHTML='';
   }
  }
 });
 return attempt;
}

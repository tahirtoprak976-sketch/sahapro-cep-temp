// One reviewed scope, one atomic write. No generic reprice command or inferred site edits.
import {newRecord, nowISO, stableStringify, isActive} from './core.js';
import {transaction} from './enterprise-db.js';
import {priceRuleReview, priceSnapshotFor} from './price-rule-core.js';

export async function saveReviewedPriceRule(rule, options, reviewSignature, key, note={}) {
  if(!key || !reviewSignature)throw Error('Fiyat önizlemesi eksik; yeniden inceleyin.');
  const request=stableStringify({rule,options,reviewSignature});
  const stamp=row=>new Date(Math.max(Date.now(),(Date.parse(row?.updated_at)||0)+1)).toISOString();
  return transaction(['price_book','work_records','customers','sites','vehicles','hakedis','slips','meta'],(d,t)=>{
    const opKey='assistant_price:'+key, prior=d.meta.find(r=>r.key===opKey)?.value;
    if(prior){
      if(prior.request!==request)throw Error('Aynı fiyat işlemi farklı kapsamla tekrar gönderildi; yeniden isteyin.');
      if(prior.after.some(saved=>stableStringify(d[saved.store].find(r=>r.id===saved.row.id)||null)!==stableStringify(saved.row)))
        throw Error('Bu fiyat işlemi geri alınmış veya değiştirilmiş; güncel kayıtları inceleyin.');
      return {...prior.result,_existing:true};
    }
    const newName=String(rule.customer_id||'').startsWith('new:')?rule.customer_id.slice(4).trim():null;
    if(newName && d.customers.some(c=>isActive(c)&&c.name.trim().toLocaleLowerCase('tr')===newName.toLocaleLowerCase('tr')))throw Error('Bu müşteri artık var; güncel müşteri kartıyla yeniden inceleyin.');
    if(!newName && !d.customers.some(c=>c.id===rule.customer_id && isActive(c)))throw Error('Müşteri bulunamadı.');
    const review=priceRuleReview(d,rule,options);
    if(review.signature!==reviewSignature)throw Error('Fiyat kapsamı veya işler önizlemeden sonra değişti. Yeniden isteyip güncel iş sayısını kontrol edin; bu fiyat işlemi yazılmadı.');
    const old=review.old, now=nowISO();
    const rate=old?.kdv_rate==null?20:Number(old.kdv_rate);
    if(!Number.isFinite(rate)||rate<0||rate>100)throw Error('Mevcut fiyatın KDV oranını düzeltin.');
    const customer=newName?newRecord({name:newName}):null;
    const pricedRule={...rule,customer_id:customer?.id||rule.customer_id,kdv_rate:rate,kdv_included:false};
    const rec=old?{...old,price:rule.price,kdv_rate:rate,kdv_included:false,updated_at:stamp(old),
      price_history:Number(old.price)===Number(rule.price)&&Number(old.kdv_rate)===rate&&!old.kdv_included?(old.price_history||[]):[...(old.price_history||[]),{price:old.price,kdv_rate:old.kdv_rate,kdv_included:old.kdv_included,valid_from:old.valid_from??null,valid_to:old.valid_to??null,until:now,reason:'Asistan: kapsamı onaylanan fiyat'}].slice(-50)}
      :newRecord({...note,...pricedRule,active:true});
    const after=[...(customer?[{store:'customers',row:customer}]:[]),{store:'price_book',row:rec}];
    // All checks precede every write; a quota/write failure aborts the whole transaction.
    for(const w of review.todo)after.push({store:'work_records',row:{...w,...(review.bindings.includes(w.id)?{site_id:rule.site_id}:{}),price_snapshot:priceSnapshotFor(pricedRule,w,rec.id),updated_at:stamp(w)}});
    for(const {store,row} of after)(store==='customers'||store==='price_book'&&!old?t.add:t.put)(store,row);
    const result={rule:rec,priced:review.todo.length,customerCreated:!!customer,already:review.already,ruleOnly:!review.todo.length&&!options.applyExisting,
      applied:review.todo.map(w=>({id:w.id,date:w.date,quantity:w.quantity,unit:w.unit,old_price:w.price_snapshot?.unit_price??null,new_price:rule.price,amount:priceSnapshotFor(pricedRule,w,rec.id).amount,site_bound:review.bindings.includes(w.id)}))};
    t.put('meta',{key:opKey,value:{request,result,after}});
    return result;
  });
}

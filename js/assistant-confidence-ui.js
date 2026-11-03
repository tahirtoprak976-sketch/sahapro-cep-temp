import {CONFIDENCE,confidenceValue} from './assistant-confidence.js';
const groups={work:'works',expense:'expenses',fuel:'fuel',fuelout:'fuelOut',tank:'tankIn',collection:'collections',maintenance:'maintenance',personnel:'personnel'};
const raw={customer:'customer_id',vehicle:'vehicle_id',site:'site_id',personnel:'personnel_id',fuel_customer:'customer_id',bank:'bank_account_id',supplier:'supplier_id',pay:'payment_option'};
const labels={KESIN:'Kesin',CIKARIM:'Çıkarım',BILINMIYOR:'Bilinmiyor'};
function badge(el,field,info){
 const label=el.closest('.field')?.querySelector('label');if(!label||!info)return;
 let b=label.querySelector('[data-field-confidence]');if(!b){b=document.createElement('span');b.dataset.fieldConfidence=field;label.append(' ',b);}
 b.dataset.fieldConfidence=field;
 b.className='badge '+(info.level===CONFIDENCE.CERTAIN?'ok':info.level===CONFIDENCE.INFERRED?'warn':'');b.dataset.level=info.level;b.textContent=labels[info.level];b.title=info.reason||'';
}
export function mountConfidenceInputs(out,v){
 for(const card of out.querySelectorAll('.card[data-kind]')){
  const r=v[groups[card.dataset.kind]]?.[Number(card.dataset.i)];if(!r?.fieldConfidence)continue;
  for(const el of card.querySelectorAll('[name]')){
   const field=raw[el.name]||el.name,info=r.fieldConfidence[field];if(!info||el.type==='checkbox')continue;
   const value=confidenceValue(r,field,el.value);el.value=value??'';badge(el,field,info);
  }
  if(r.credit&&r.fieldConfidence.supplier_id?.level===CONFIDENCE.UNKNOWN){
   const supplier=card.querySelector('[name=supplier]');if(supplier?.options[0]?.value==='')supplier.options[0].textContent='— Esnafı doğrulayın —';
   const paid=document.createElement('button');paid.type='button';paid.className='btn sm';paid.dataset.confidencePaid='';paid.textContent='Peşin ödendi; esnaf borcu yazma';supplier?.after(paid);
   paid.onclick=()=>{r.credit=false;if(supplier)supplier.value='';paid.textContent='Peşin gider seçildi; Kaydet ile uygulanır';paid.disabled=true;};
  }
  const price=r.fieldConfidence.effective_unit_price,priceInput=card.querySelector('[name=unit_price]');
  if(price&&priceInput){
   const output=document.createElement('output');output.dataset.confidencePrice='';output.className='small';output.textContent='Kayıtlı fiyat: '+Number(price.value).toLocaleString('tr-TR')+' ₺ · Kesin';priceInput.after(output);badge(priceInput,'effective_unit_price',price);
  }
  const edited=ev=>{
   const el=ev.target;if(!el.matches('input[name],select[name],textarea[name]'))return;
   const field=raw[el.name]||el.name;if(el.type==='checkbox')return;
   if(el.name==='supplier')r.credit=!!el.value;
   if(r.fieldConfidence[field])r.fieldConfidence[field]={value:el.value||null,level:el.value?CONFIDENCE.CERTAIN:CONFIDENCE.UNKNOWN,reason:el.value?'Sizin açık düzeltmeniz':'Alan boş',source:'user'};if(r.fieldConfidence[field])badge(el,field,r.fieldConfidence[field]);
   // Never leave a registered-price label attached to a changed price context.
   if(['customer','site','vehicle','work_type','unit','date','material','unit_price'].includes(el.name)){
    delete r.fieldConfidence.effective_unit_price;card.querySelector('[data-confidence-price]')?.remove();
    if(priceInput&&!priceInput.value)badge(priceInput,'unit_price',{level:CONFIDENCE.UNKNOWN,reason:'Fiyat önizlemesinden güncel kuralı kontrol edin'});
   }
  };
  card.addEventListener('input',edited,true);card.addEventListener('change',edited,true);
 }
}
export function inferenceReason(row){return [...new Set(Object.values(row.fieldConfidence||{}).filter(f=>f.level===CONFIDENCE.INFERRED&&f.source!=='user').map(f=>f.reason))].join(' · ');}
// Called with the existing phone-side price decision; never turns the manual input into a rule price.
export function clearRuleConfidence(card,row){
 delete row.fieldConfidence?.effective_unit_price;card.querySelector('[data-confidence-price]')?.remove();
 const input=card.querySelector('[name=unit_price]');if(input&&!input.value)badge(input,'unit_price',{level:CONFIDENCE.UNKNOWN,reason:'Birim fiyatın kaynağını kontrol edin'});
}
export function paintRuleConfidence(card,row,decision){
 const rule=decision?.rule,input=card.querySelector('[name=unit_price]');
 if(!row.fieldConfidence||!input||!rule||decision.ambiguous||rule.formula||!(Number(rule.price)>0)||row.priceUncertain||row.price_pending||row.fuelAllowance?.only_pay||row.yard==='out')return;
 if((rule.valid_from||rule.valid_to)&&row.fieldConfidence?.date?.level!==CONFIDENCE.CERTAIN)return;
 const info={value:Number(rule.price),level:CONFIDENCE.CERTAIN,reason:'Bu bağlamda tek kayıtlı fiyat sonucu',source:'price_rule'};row.fieldConfidence.effective_unit_price=info;
 const output=document.createElement('output');output.dataset.confidencePrice='';output.className='small';output.textContent='Kayıtlı fiyat: '+info.value.toLocaleString('tr-TR')+' ₺ · Kesin';input.after(output);badge(input,'effective_unit_price',info);
}

// Measurement only: real application validators, no storage and no provider requests.
import {readTestJSON} from './test-json.mjs';
import {validatePlan,validateExtras} from '../../js/assistant-core.js';
import {validateTickets} from '../../js/assistant-docs.js';
import {untrustedWorkPlan} from '../../js/assistant-batch.js';
const confidenceModule=new URL('../../js/assistant-confidence.js',import.meta.url);
let confidenceProjection;if(typeof process!=='undefined'&&process.versions?.node){const {existsSync}=await import('node:fs');confidenceProjection=existsSync(confidenceModule)?(await import(confidenceModule)).confidenceValue:(_row,_key,value)=>value;}else confidenceProjection=(await import(confidenceModule)).confidenceValue;
export const cases=await readTestJSON(new URL('./cases.json',import.meta.url));
export const confidenceCases=await readTestJSON(new URL('./confidence-cases.json',import.meta.url));
export const cards=await readTestJSON(new URL('./cards.json',import.meta.url));
const groups={work:'works',expense:'expenses',fuel:'fuel',fuelout:'fuelOut',tank:'tankIn',collection:'collections',personnel:'personnel',maintenance:'maintenance',ticket:'tickets'};
const moneyFields=new Set(['amount','unit_price','total','cost','dump_cost']);
const eq=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const prompt=s=>/\?|seçilmeli|seçin|girin|tutar yok|litre .*yok|doğru tarihi|hangi .*ait/i.test(s);
export function replay(c,response=c.recordedResponse){
 const d=structuredClone({...cards,...c.cardsPatch}),plan=untrustedWorkPlan(structuredClone(response));
 const opts={d,today:'2026-11-02',message:c.message,photoCount:c.photoTexts.length};
 const out=validatePlan(plan,opts);
 Object.assign(out,validateExtras(plan,{...opts,photoTexts:out.photoTexts}));
 out.tickets=validateTickets(plan,{...opts,photoTexts:out.photoTexts});
 const actual=Object.entries(groups).flatMap(([kind,group])=>(out[group]||[]).map(row=>({kind,checked:!!row.ok,fields:{...row,...Object.fromEntries(Object.entries(row.fieldConfidence||{}).filter(([k])=>k!=='effective_unit_price'&&k!=='payment_option').map(([k,v])=>[k,confidenceProjection(row,k,row[k])])),duplicate:!!row.dup,suggested_date:row.fieldConfidence?.date?.suggestedValue,price_rule:row.priceInfo?.candidates?.length===1?row.priceInfo.candidates[0].id:null,money_role:row.roles?.map(r=>({price_quote:'offer',negative:'negated'}[r]||r))[0]??null}})));
 const prompts=[...new Set([...(out.questions||[]),...actual.flatMap(r=>(r.fields.issues||[]).filter(prompt))])];
 return {actual,prompts};
}
export function measure(input=cases,responses=null){
 const m={messages:input.length,cards:0,silentWrong:0,moneyGuesses:0,mandatoryChecked:0,checkedCorrect:0,correctCards:0,unnecessaryQuestions:0,questions:0,questionMessages:0,shouldAskCorrect:0,cardCountErrors:0,fields:{},failures:[]};
 for(const c of input){
  const {actual,prompts}=replay(c,responses?.[c.id]??c.recordedResponse),problems=[];
  m.cards+=c.expectedCards.length;m.questions+=prompts.length;m.questionMessages+=Number(prompts.length>0);m.unnecessaryQuestions+=c.shouldAsk?0:prompts.length;m.shouldAskCorrect+=Number((prompts.length>0)===c.shouldAsk);
  if(actual.length!==c.expectedCards.length){m.cardCountErrors++;problems.push(`kart sayısı ${actual.length} / ${c.expectedCards.length}`);}
  for(let i=0;i<Math.max(actual.length,c.expectedCards.length);i++){
   const a=actual[i],e=c.expectedCards[i];
   if(!a||!e){if(a?.checked)m.silentWrong++;continue;}
   const bad=[];
   if(a.kind!==e.kind)bad.push('kind');
   for(const [field,value]of Object.entries(e.fields)){
    const stat=m.fields[field]??={correct:0,total:0};stat.total++;
    if(eq(a.fields[field],value))stat.correct++;else bad.push(field);
   }
   // Money must match the independently authored oracle, even on an unchecked card.
   for(const key of moneyFields){
    const v=a.fields[key];if(v==null||v==='')continue;
    const approved=Object.hasOwn(e.fields,key)?[e.fields[key]]:[];
    // Other explicit amounts in this same source still cannot authorize this field.
    if(!approved.some(x=>eq(v,x))){m.moneyGuesses++;problems.push(`${i}.${key}: kanıtlanmamış para ${v}`);}
   }
   const effective=a.fields.fieldConfidence?.effective_unit_price?.value;
   if(effective!=null){
    const ruleId=e.fields.price_rule,rule=({...cards,...c.cardsPatch}.price_book||[]).find(p=>p.id===ruleId);
    const approved=Object.hasOwn(e.fields,'effective_unit_price')?e.fields.effective_unit_price:rule?.price;
    if(!eq(effective,approved)){m.moneyGuesses++;problems.push(`${i}.effective_unit_price: kayıtta doğrulanmamış fiyat ${effective}`);}
   }
   if(bad.length || a.checked && !e.checked && !e.mandatoryUnchecked){if(a.checked)m.silentWrong++;problems.push(`${i}: yanlış ${bad.length?bad.join(','):'onaysız işaret'}`);}
   else if(!(e.mandatoryUnchecked&&a.checked)){m.correctCards++;if(a.checked)m.checkedCorrect++;}
   if(e.mandatoryUnchecked&&a.checked){m.mandatoryChecked++;problems.push(`${i}: zorunlu işaretsiz ${e.mandatoryUnchecked} işaretli`);}
   if(a.checked!==e.checked)problems.push(`${i}: işaret ${a.checked} / ${e.checked}`);
  }
  if(prompts.length>0&&!c.shouldAsk)problems.push('gereksiz soru/alan istemi');
  if(!prompts.length&&c.shouldAsk)problems.push('gerekli soru/alan istemi yok');
  if(problems.length)m.failures.push({id:c.id,problems});
 }
 m.checkedCorrectRate=m.cards?m.checkedCorrect/m.cards:0;
 m.unnecessaryQuestionRate=m.questions?m.unnecessaryQuestions/m.questions:0;
 m.questionsPerMessage=m.questions/m.messages;
 return m;
}
export function gate(m){return m.silentWrong===0&&m.moneyGuesses===0&&m.mandatoryChecked===0;}

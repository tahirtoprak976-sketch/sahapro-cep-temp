// Diagnose a measured result without changing matching, truth labels or scoring.
import {readFileSync} from 'node:fs';
export function diagnose(report){
 const questions={},blocked={},categories=report.categories;
 for(const detail of report.details){
  for(const q of detail.questions){
   const expectedRows=detail.rowsByExpected.flatMap((r,i)=>r&&q.actualRows.includes(r.actualRow)?[i]:[]);
   const required=detail.expectedQuestions.some(eq=>eq.field===q.field&&eq.expectedRows.some(i=>expectedRows.includes(i)));
   const optional=q.field==='quantity'&&q.actualRows.some(i=>detail.actual[i]?.contractIncluded);
   const count=questions[q.field]??={total:0,required:0,optional:0,unnecessary:0};count.total++;count[required?'required':optional?'optional':'unnecessary']++;
  }
  for(const row of detail.actual.filter(r=>!r.ok)){
   for(const flag of ['calendarConflict','dateUnsure','customerGuess','vehicleGuess','guessed','sourceNeedsMaterial','sourceUncertain','parentMismatch','ambiguous','priceUncertain'])if(row[flag])blocked[flag]=(blocked[flag]||0)+1;
   for(const [field,info]of Object.entries(row.fieldConfidence||{}))if(info.level==='BILINMIYOR'&&['date','customer_id','vehicle_id','quantity','unit','work_type'].includes(field))blocked['unknown:'+field]=(blocked['unknown:'+field]||0)+1;
  }
 }
 return {version:report.version,realGemini:false,mode:report.mode,totals:report.totals,questions,blocked,categories};
}
if(process.argv[1]?.endsWith('/diagnose-real.mjs'))console.log(JSON.stringify(diagnose(JSON.parse(readFileSync(process.argv[2]))),null,2));

// Counts are derived from actual draft controls; this layer never authorizes a write.
export function reviewTotals(rows){
 const active=rows.filter(r=>!r.saved);
 return {total:active.length,selected:active.filter(r=>r.selected&&!r.disabled).length,review:active.filter(r=>r.missing.length||r.issues).length,duplicates:active.filter(r=>r.duplicate).length};
}
export function groupedDraftQuestions(rows){
 const groups=new Map();
 for(const row of rows.filter(r=>!r.saved))for(const field of row.missing){const k=row.kind+':'+field,old=groups.get(k)||{kind:row.kind,label:row.label,field,rows:[]};old.rows.push(row.index+1);groups.set(k,old);}
 return [...groups.values()];
}

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

// View state only. A selected card still requires the existing Save/preflight gates.
export function sensitiveAssistantRow(row){
 const r=row.r||{};
 return !!r.needsApproval||row.kind==='collection'||row.kind==='fuelout'||row.kind==='tank'&&!!r.customer_id||row.kind==='personnel'&&['Kasa Teslimi','Avans','Personel Gideri','Tahsilat'].includes(r.event_type);
}
export function reviewState(row){
 if(row.saved)return 'saved';
 return row.disabled||row.missing?.length||row.issues||row.duplicate||sensitiveAssistantRow(row)&&!row.selected?'review':'ready';
}
export function reviewStates(rows){const counts={all:rows.length,ready:0,review:0,saved:0};for(const row of rows)counts[reviewState(row)]++;return counts;}

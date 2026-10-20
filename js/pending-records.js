// Shared read-only PDF queue status. A row is complete only in its expected store.
import {isActive} from './core.js';
const stores={work:'work_records',fuel:'fuel_records',expense:'expense_records'};
export function pdfRowRecorded(ops,data,hash,row){
  const store=stores[row?.kind],op=ops.get('op:pdf-history:'+hash+':'+row?.id);
  return !!(store&&op?.store===store&&(data[store]||[]).some(record=>record.id===op.record_id&&isActive(record)));
}
export function pdfPending(meta=[],data={}){
  const ops=new Map(meta.map(item=>[item.key,item.value])),files=[];
  for(const item of meta){
    if(!item.key.startsWith('pdf_history_draft:')||!Array.isArray(item.value?.rows))continue;
    const hash=item.key.slice('pdf_history_draft:'.length);
    const rows=item.value.rows.filter(row=>row&&Object.hasOwn(stores,row.kind)&&!pdfRowRecorded(ops,data,hash,row));
    if(rows.length)files.push({hash,name:item.value._file_name||'PDF taslağı',count:rows.length});
  }
  return {files,rows:files.reduce((sum,file)=>sum+file.count,0)};
}

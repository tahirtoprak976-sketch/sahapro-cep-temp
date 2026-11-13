import {esc} from './ui.js';
import {recordNoteView} from './record-notes.js';
export function recordSourceHTML(record,field='description',context={},kind){
 const view=recordNoteView(record,field,context,kind);
 return view.source?`<details data-record-source style="margin:8px 12px 12px"><summary class="small">Tam kaynak mesajı göster</summary><div class="small muted" style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(view.source)}</div></details>`:'';
}
export function recordNoteHTML(record,field='description',context={},kind,{source=true,label=''}={}){
 const view=recordNoteView(record,field,context,kind);
 return (view.text?`<div class="small muted" data-record-note style="white-space:pre-wrap;overflow-wrap:anywhere">${label?'<b>'+esc(label)+':</b> ':''}${esc(view.text)}</div>`:'')+(view.unresolved?'<div class="small muted" data-note-unresolved>Kayda ait mesaj kesin eşleştirilemedi. Tam kaynak mesajı inceleyebilirsiniz.</div>':'')+(source?recordSourceHTML(record,field,context,kind):'');
}

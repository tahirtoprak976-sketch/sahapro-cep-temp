// Connect the app's visible labels to their controls, including dynamically added fields.
let sequence=0;
export function associateFieldLabels(root){
 for(const label of root.querySelectorAll('.field > label')){
  if(label.control||label.hasAttribute('for'))continue;
  const field=label.parentElement,controls=[...field.querySelectorAll('input:not([type="hidden"]),select,textarea')];
  const control=controls.length===1?controls[0]:label.nextElementSibling?.matches('input,select,textarea')?label.nextElementSibling:null;
  if(!control||label.contains(control))continue;
  if(!control.id){let id;do{id='sp-field-'+(++sequence);}while(root.ownerDocument.getElementById(id));control.id=id;}
  label.htmlFor=control.id;
 }
}
export function installFormAccessibility(root){
 associateFieldLabels(root);
 const observer=new MutationObserver(mutations=>{
  if(mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('input,select,textarea,label,.field')||n.querySelector?.('input,select,textarea,label')))))associateFieldLabels(root);
 });
 observer.observe(root,{childList:true,subtree:true});return ()=>observer.disconnect();
}
export function accessibleDialog(dialog){
 const doc=dialog.ownerDocument,opener=doc.activeElement,heading=dialog.querySelector('h1,h2,h3');
 dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.tabIndex=-1;
 if(heading){heading.id=heading.id||'sp-dialog-title-'+(++sequence);dialog.setAttribute('aria-labelledby',heading.id);}else dialog.setAttribute('aria-label','İşlem penceresi');
 associateFieldLabels(dialog);
 const focusable=()=>[...dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length&&(!el.checkVisibility||el.checkVisibility()));
 const keydown=e=>{
  if(e.key!=='Tab')return;
  const fields=focusable(),first=fields[0]||dialog,last=fields.at(-1)||dialog;
  if(e.shiftKey&&(doc.activeElement===first||doc.activeElement===dialog)){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&(doc.activeElement===last||doc.activeElement===dialog)){e.preventDefault();first.focus();}
 };
 dialog.addEventListener('keydown',keydown);
 requestAnimationFrame(()=>{if(dialog.isConnected&&!dialog.contains(doc.activeElement))(focusable()[0]||dialog).focus({preventScroll:true});});
 return ()=>{dialog.removeEventListener('keydown',keydown);if(dialog.contains(doc.activeElement)&&opener?.isConnected)opener.focus({preventScroll:true});};
}

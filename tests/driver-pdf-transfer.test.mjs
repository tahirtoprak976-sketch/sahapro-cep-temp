import assert from 'node:assert/strict';
import {openDriverPDF,isDriverPDF,DRIVER_PDF_LIMIT} from '../js/driver-pdf-transfer.js';
import {makeDriverBundle} from '../js/driver-bundle.js';
const text='📋 TEST\n🚚 TEST iş\nSP1:abcdefghijk.signature123';
const zip=(await makeDriverBundle({text,rows:[{id:'test'}],files:[new File(['one'],'one.jpg',{type:'image/jpeg'})]})).files[0];
const enc=new TextEncoder();
function pdfOf(data){
 const header='%PDF-1.7\n',a='1 0 obj\n<< /Type /Catalog >>\nendobj\n',h='2 0 obj\n<< /Length '+data.length+' /Type /EmbeddedFile /Subtype /application#2Fzip >>\nstream\n',end='\nendstream\nendobj\n';
 const o1=enc.encode(header).length,o2=o1+enc.encode(a).length,xref=o2+enc.encode(h).length+data.length+enc.encode(end).length;
 const tail='xref\n0 3\n0000000000 65535 f \n'+String(o1).padStart(10,'0')+' 00000 n \n'+String(o2).padStart(10,'0')+' 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R /SAHAPROTransfer 2 0 R >>\nstartxref\n'+xref+'\n%%EOF';
 return new File([header,a,h,data,end,tail],'report.sahapro.pdf',{type:'application/pdf'});
}
const pdf=pdfOf(new Uint8Array(await zip.arrayBuffer())),opened=await openDriverPDF(pdf);assert.equal(opened.message,text);assert.equal(await opened.files[0].text(),'one');
assert.ok(isDriverPDF({name:'report.sahapro (1).pdf'}));assert.ok(!isDriverPDF({name:'ordinary.pdf'}));
await assert.rejects(()=>openDriverPDF(new File(['%PDF-1.7\nordinary'],'x.sahapro.pdf')));
await assert.rejects(()=>openDriverPDF(new File([new Uint8Array(DRIVER_PDF_LIMIT+1)],'big.sahapro.pdf')));
const raw=new Uint8Array(await pdf.arrayBuffer());raw[20]^=1; // visible catalog edit cannot change the signed source.
assert.equal((await openDriverPDF(new File([raw],'changed.sahapro.pdf'))).message,text);
const broken=await pdf.text();await assert.rejects(()=>openDriverPDF(new File([broken.replace('/SAHAPROTransfer 2','/SAHAPROTransfer 99')],'bad.sahapro.pdf')));
await assert.rejects(()=>openDriverPDF(pdfOf(new Uint8Array([1,2,3]))));
console.log('driver-pdf-transfer: bounded dedicated PDF reader, exact embedded source, visible/source separation, invalid reference/format/size rejection OK');

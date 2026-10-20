// Readable PDF report with a standard embedded signed bundle. Never render SP1 on the report pages.
import {buildDocument} from './document-engine.js';
import {makeDriverBundle,openDriverBundle,DRIVER_BUNDLE_LIMIT} from './driver-bundle.js';
import {entryLine} from './driver-core.js';
export const DRIVER_PDF_LIMIT=20*1048576;
export const isDriverPDF=f=>/\.sahapro(?:\s*\(\d+\))?\.pdf$/i.test(f?.name||'');
export async function makeDriverPDF(packet,cfg,bundle=null){
 bundle ||= await makeDriverBundle(packet);
 const sections=[{pairs:[['Personel',cfg.p[1]],['Kayıt sayısı',packet.rows.length],['Fotoğraf sayısı',packet.files.length]],text:'Şoför bildirimi — patronun kontrolü ve onayı bekleniyor.'}];
 packet.rows.forEach((e,i)=>sections.push({title:(i+1)+'. kayıt',text:entryLine(e,cfg).replace(/📷\s*(\d+)/g,'$1 fotoğraf')}));
 for(const [i,f] of packet.files.entries()){
  const bmp=await createImageBitmap(f),scale=Math.min(1,480/Math.max(bmp.width,bmp.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bmp.width*scale));canvas.height=Math.max(1,Math.round(bmp.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bmp,0,0,canvas.width,canvas.height);bmp.close();
  const image=await new Promise(r=>canvas.toBlob(r,'image/jpeg',0.7));if(!image)throw Error('PDF fotoğraf özeti hazırlanamadı');
  sections.push({title:'Fotoğraf '+(i+1)+' — '+f.name,image,image_width:190,max_h:140});
 }
 const blob=await buildDocument({title:'Şoför iş bildirimi — '+cfg.p[1],template:'report',audience:'internal',sections,sahaproTransfer:new Uint8Array(await bundle.files[0].arrayBuffer())});
 if(blob.size>DRIVER_PDF_LIMIT)throw Error('İş özeti PDF’i 20 MB sınırını aşıyor; daha az kayıtla hazırlayın');
 return {text:packet.text.slice(0,packet.text.lastIndexOf('\nSP1:'))+'\n📄 İş özeti ve fotoğraflar ekli PDF’te.',files:[new File([blob],bundle.files[0].name.replace(/\.zip$/,'.pdf'),{type:'application/pdf'})]};
}
export async function openDriverPDF(file){
 try{
  if(!isDriverPDF(file)||file.size>DRIVER_PDF_LIMIT)throw Error('Geçerli SAHAPRO iş özeti PDF’i seçin (en fazla 20 MB)');
  const buf=new Uint8Array(await file.arrayBuffer()),dec=new TextDecoder('latin1');
  if(dec.decode(buf.slice(0,9))!=='%PDF-1.7\n')throw Error('PDF başlığı geçersiz');
  // Only our exact bounded xref/stream format is read; no PDF execution, JS or general parser.
  const tail=dec.decode(buf.slice(-4096)),m=/trailer\n<< \/Size (\d+) \/Root (\d+) 0 R \/SAHAPROTransfer (\d+) 0 R >>\nstartxref\n(\d+)\n%%EOF$/.exec(tail);
  if(!m)throw Error('PDF’in SAHAPRO aktarım verisi yok veya değiştirilmiş');
  const count=Number(m[1]),ref=Number(m[3]),xref=Number(m[4]);
  if(count<2||count>4096||ref<1||ref>=count||xref<9||xref>=buf.length)throw Error('PDF dizini geçersiz');
  const table=dec.decode(buf.slice(xref,Math.min(buf.length,xref+count*24+256))).split('\n');
  if(table[0]!=='xref'||table[1]!=='0 '+count||!/^\d{10} 00000 n $/.test(table[ref+2]||''))throw Error('PDF aktarım dizini geçersiz');
  const offset=Number(table[ref+2].slice(0,10));if(offset<9||offset>=xref)throw Error('PDF aktarım konumu geçersiz');
  const header=dec.decode(buf.slice(offset,offset+256)),h=new RegExp('^'+ref+' 0 obj\\n<< /Length (\\d+) /Type /EmbeddedFile /Subtype /application#2Fzip >>\\nstream\\n').exec(header);
  if(!h)throw Error('PDF aktarım bölümü geçersiz');
  const n=Number(h[1]),start=offset+h[0].length,end=start+n;
  if(n<22||n>DRIVER_BUNDLE_LIMIT||end>=xref||dec.decode(buf.slice(end,end+18))!=='\nendstream\nendobj\n')throw Error('PDF aktarım boyutu geçersiz');
  return await openDriverBundle(new File([buf.slice(start,end)],'transfer.sahapro.zip',{type:'application/zip'}));
 }catch(e){throw Error('İş özeti PDF’i açılamadı: '+(e.message||e)+'. Şoförden aynı kaydı yeniden paylaşmasını isteyin.');}
}

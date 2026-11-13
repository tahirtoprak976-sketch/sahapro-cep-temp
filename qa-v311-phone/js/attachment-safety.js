// One byte-based boundary for new files and old/restored originals. Metadata is
// not evidence of content type. Reading never updates or removes the original.
export const ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
const error = () => Error('Dosya desteklenmiyor veya bozuk. Geçerli JPEG, PNG, WebP veya PDF seçin; SVG/HTML eklenemez.');
// Voice notes are not document attachments, but their preview URL must not
// inherit arbitrary HTML/SVG MIME from a share target or misleading extension.
export async function prepareAudioPreview(file) {
  if (!file?.size || file.size > 30*1024*1024) throw Error('Ses dosyası boş veya 30 MB sınırını aşıyor.');
  const b=new Uint8Array(await file.slice(0,16).arrayBuffer()), text=(a,z)=>String.fromCharCode(...b.slice(a,z));
  const type=text(0,3)==='ID3'||(b[0]===255&&(b[1]&224)===224)?'audio/mpeg':
    text(0,4)==='OggS'?'audio/ogg':text(0,4)==='RIFF'&&text(8,12)==='WAVE'?'audio/wav':
    [26,69,223,163].every((n,i)=>b[i]===n)?'audio/webm':text(4,8)==='ftyp'?'audio/mp4':
    text(0,5)==='#!AMR'?'audio/amr':null;
  if (!type) throw Error('Ses dosyasının içeriği doğrulanamadı; özgün dosya korunuyor.');
  const result=new File([file],file.name||'ses',{type,lastModified:file.lastModified||Date.now()});
  if (file._rec) result._rec=true;
  return result;
}
// Compatibility for the existing e-invoice importer only. XML/ZIP is parsed as
// data, retained byte-for-byte, and is never eligible for a navigable view.
export async function prepareInvoiceOriginal(file) {
  if (!file?.size || file.size > 30*1024*1024) throw Error('Fatura kaynağı boş veya 30 MB sınırını aşıyor.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const {parseUblInvoice}=await import('./invoice-import.js');
  let invoice=null;
  if (bytes[0]===80 && bytes[1]===75) {
    const {listZip,readEntry}=await import('./unzip.js'), entries=listZip(bytes);
    if (entries.length>100) throw Error('Fatura ZIP dosyasında çok fazla kayıt var.');
    const xml=entries.find(e=>/\.xml$/i.test(e.name));
    if (!xml || xml.size>15*1024*1024) throw Error('ZIP içinde sınırlı bir fatura XML kaynağı yok.');
    invoice=parseUblInvoice(new TextDecoder().decode(await readEntry(bytes,xml)));
  } else invoice=parseUblInvoice(new TextDecoder().decode(bytes));
  if (!invoice) throw Error('Kaynak geçerli bir e-fatura XML/ZIP belgesi değil.');
  return file;
}
export function attachmentType(bytes) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b)) return 'image/png';
  const text = (a,b) => String.fromCharCode(...bytes.slice(a,b));
  if (text(0,4) === 'RIFF' && text(8,12) === 'WEBP') return 'image/webp';
  if (text(0,5) === '%PDF-') return 'application/pdf';
  return null;
}
function framed(bytes, type) {
  const end = bytes.length;
  if (type === 'image/jpeg') return end > 20 && bytes[end-2] === 255 && bytes[end-1] === 217;
  if (type === 'image/png') return end >= 45 && String.fromCharCode(...bytes.slice(12,16)) === 'IHDR' && String.fromCharCode(...bytes.slice(-8,-4)) === 'IEND';
  if (type === 'image/webp') return end >= 20 && new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(4,true) + 8 === end && /^(VP8 |VP8L|VP8X)$/.test(String.fromCharCode(...bytes.slice(12,16)));
  if (type === 'application/pdf') {
    const text = new TextDecoder('latin1');
    const head = text.decode(bytes.slice(0,16)), tail = text.decode(bytes.slice(-4096));
    // Canonical PDF framing, not a claim to interpret or execute PDF contents.
    // Browser PDF handling is separate from app HTML/JS; never use HTML MIME.
    return /^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(head) && /startxref\s+\d+\s+%%EOF\s*$/.test(tail);
  }
  return false;
}
export async function prepareAttachment(file, { maxBytes = 30 * 1024 * 1024, imageOnly = false, pdfOnly = false } = {}) {
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size || file.size > maxBytes) throw error();
  const bytes = new Uint8Array(await file.arrayBuffer()), type = attachmentType(bytes);
  if (!type || !framed(bytes,type) || (imageOnly && !type.startsWith('image/')) || (pdfOnly && type !== 'application/pdf')) throw error();
  const blob = new Blob([file], { type });
  if (type.startsWith('image/') && typeof createImageBitmap === 'function') {
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob);
      if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40000000) throw error();
    } catch { throw error(); }
    finally { bitmap?.close?.(); }
  } else if (type.startsWith('image/') && typeof document !== 'undefined') {
    // Older browsers still fail closed if their safe image decoder fails.
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image(); img.src = url; await img.decode();
      if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 40000000) throw error();
    } catch { throw error(); }
    finally { URL.revokeObjectURL(url); }
  }
  // Only metadata is normalized. The source bytes are retained exactly here.
  return typeof File === 'function' ? new File([blob], file.name || 'belge', { type, lastModified: file.lastModified || Date.now() }) : blob;
}
export function safeAttachmentName(name, type) {
  const base = String(name || 'belge').replace(/[\\/\u0000-\u001f\u007f]/g, '_').slice(0,180);
  const ext = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'application/pdf':'pdf' }[type];
  return ext ? base.replace(/\.[^.]*$/, '') + '.' + ext : base + '.quarantined.bin';
}
export async function attachmentView(attachment) {
  const original = attachment.blob || attachment;
  const name = attachment.name || original.name || 'belge';
  try {
    const blob = await prepareAttachment(original);
    return { blob, type:blob.type, safe:true, image:blob.type.startsWith('image/'), name, downloadName:safeAttachmentName(name,blob.type) };
  } catch {
    // Never navigate an untrusted original. It remains recoverable as inert
    // bytes with an explicit quarantine filename, including after restore.
    return { blob:new Blob([original], {type:'application/octet-stream'}), type:'application/octet-stream', safe:false, image:false, name, downloadName:safeAttachmentName(name,null) };
  }
}

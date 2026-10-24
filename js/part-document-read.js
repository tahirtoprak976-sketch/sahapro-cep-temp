import * as G from './ai-gemini.js';
import {shrinkImage} from './image-shrink.js';
import {PART_DOCUMENT_PROMPT,partDocumentProperties,normalizePartDocument} from './part-document-core.js';

export async function readPartDocument(prepared,{db,data,signal,fetchImpl}={}){
 if(signal?.aborted)throw new DOMException('Okuma iptal edildi','AbortError');
 if(!(await G.geminiSettings(db)).ready)throw Error('Belge okumak için Ayarlar → Yapay Zeka bölümündeki Gemini anahtarı ve veri gönderme iznini kontrol edin. Belgeyi okuyucu olmadan da saklayabilirsiniz.');
 const file=new File([prepared.blob],prepared.name,{type:prepared.type});
 const blob=prepared.type==='application/pdf'?file:await shrinkImage(file,{maxEdge:3000,quality:0.94,kind:'warranty_ocr'});
 const parts=[{text:'Yalnız bu belgeyi oku. Dosya adı içerik kanıtı değildir.'},{inlineData:{mimeType:prepared.type==='application/pdf'?'application/pdf':blob.type,data:await G.blobToBase64(blob)}}];
 const raw=await G.geminiDocument(parts,{db,signal,fetchImpl,system:PART_DOCUMENT_PROMPT,schema:{type:'object',properties:partDocumentProperties()}});
 return normalizePartDocument(raw,{data});
}

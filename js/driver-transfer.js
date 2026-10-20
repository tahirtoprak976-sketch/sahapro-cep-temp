// A text attachment carries the original SP1 message unchanged; trust still comes from its signature.
export const DRIVER_TRANSFER_HEADER='SAHAPRO_DRIVER_TRANSFER_V1';
export const DRIVER_TRANSFER_LIMIT=65536;
export const isDriverTransferFile=f=>/\.sahapro(?:\s*\(\d+\))?\.txt$/i.test(f?.name||'');
export function cleanDriverShare(packet){
 const cut=packet.text.lastIndexOf('\nSP1:');
 if(cut<0)throw Error('Aktarım kodu bulunamadı; paketi yeniden hazırlayın');
 const name='SAHAPRO-'+String(packet.rows[0]?.id||'paket').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64)+'-'+packet.rows.length+'.sahapro.txt';
 const file=new File([DRIVER_TRANSFER_HEADER+'\n'+packet.text],name,{type:'text/plain',lastModified:0});
 if(file.size>DRIVER_TRANSFER_LIMIT)throw Error('Aktarım dosyası sınırı aşıldı');
 return {text:packet.text.slice(0,cut)+'\n📎 Kayıtları aktarmak için ekli SAHAPRO dosyasını ve fotoğrafları Asistan’a ekleyin.',files:[file,...packet.files]};
}
export async function readDriverTransfer(file){
 if(!isDriverTransferFile(file)||file.size>DRIVER_TRANSFER_LIMIT)throw Error('Geçerli bir SAHAPRO aktarım dosyası seçin (en fazla 64 KB)');
 const text=await file.text(),prefix=DRIVER_TRANSFER_HEADER+'\n';
 if(!text.startsWith(prefix))throw Error('SAHAPRO aktarım dosyası bozuk veya biçimi desteklenmiyor; şoförden yeniden paylaşmasını isteyin');
 const message=text.slice(prefix.length);
 if((message.match(/^SP1:/gm)||[]).length!==1||(message.match(/^SP1:[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?$/gm)||[]).length!==1)throw Error('Aktarım dosyasının kayıt kodu eksik veya bozuk; yeniden paylaşılmalı');
 return message;
}

// The identical approved corpus/scorer runs in Node and the phone. No copied expected results.
export async function readTestJSON(url){
 if(typeof process!=='undefined'&&process.versions?.node){const {readFileSync}=await import('node:fs');return JSON.parse(readFileSync(url,'utf8'));}
 const response=await fetch(url);if(!response.ok)throw Error('Test dosyası okunamadı.');return response.json();
}

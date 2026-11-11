// Verify a repeated request against stored business fields; no new record format or writes.
import {isActive} from './core.js';
const conflict=()=>Object.assign(Error('Aynı işlem kimliği farklı bilgilerle kullanılmış; kayıt yazılmadı.'),{code:'OP_CONFLICT'});
const canonical=value=>{if(typeof value==='number'&&!Number.isFinite(value))throw conflict();return Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).filter(k=>k!=='id').sort().map(k=>[k,canonical(value[k])])):value??null;};
export function matchingRequest(old,makeExpected){
 if(!isActive(old)||old.status==='İptal')throw Object.assign(Error('Bu işlem geri alınmış veya iptal edilmiş; yeni işlem kimliğiyle kontrol edin.'),{code:'OP_REVERSED'});
 let expected;try{expected=makeExpected();}catch{throw conflict();}
 for(const key of Object.keys(expected))if(JSON.stringify(canonical(old[key]))!==JSON.stringify(canonical(expected[key])))throw conflict();
 return old;
}

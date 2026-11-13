// User choice: pending work is principal; VAT posts only with a finalized claim.
// Pure calculations. Frozen claims and their source snapshots are never rewritten.
import {kdvRateOf,toKurus,fromKurus,calcHakedisLine} from './core.js';
export function pendingPrincipal(w,amount){
 const p=w?.price_snapshot,rate=kdvRateOf(p?.kdv_rate);
 // An unknown historical basis cannot be repaired by assuming a tax rate.
 if(!p?.locked&&p?.kdv_included===true&&rate!=null)return fromKurus(Math.round(toKurus(amount)/(1+rate/100)));
 return amount;
}
export function claimVatItem(item,includeVat){
 const copy={...item};
 if(item.source_price_snapshot&&typeof item.source_price_snapshot.kdv_included!=='boolean')throw Error('Kaynak fiyatın KDV dahil / hariç temeli kayıtlı değil; fiyatı kontrol edin.');
 if(includeVat){if(kdvRateOf(copy.kdv_rate)==null)throw Error('KDV seçildi; kayıtlı oran eksik. Fiyatın KDV oranını tamamlayın.');return copy;}
 if(copy.kdv_included===true){
  const rate=kdvRateOf(copy.kdv_rate);if(rate==null)throw Error('KDV dahil fiyatın oranı eksik; ana para hesaplanamadı. Fiyatı kontrol edin.');
  const expected=calcHakedisLine(copy).amount;
  const net=n=>n==null||n===''?n:fromKurus(Math.round(toKurus(n)/(1+rate/100)));
  if(copy.formula==='CRANE_FIRST_HOUR'){copy.first_hour_price=net(copy.first_hour_price);copy.next_hour_price=net(copy.next_hour_price);}
  else copy.unit_price=net(copy.unit_price);
  copy.kdv_included=false;copy.kdv_rate=0;
  if(toKurus(calcHakedisLine(copy).amount)!==toKurus(expected))throw Error('Dahil fiyatın net birim tarifesi kuruşa tam bölünmüyor. Net tarifeyi işin fiyat ekranında ayrıca doğrulayın; otomatik fiyat yazılmadı.');
 }else {copy.kdv_rate=0;copy.kdv_included=false;}
 return copy;
}

export function claimNetItems(items){
 const known=n=>n!==''&&n!=null&&Number.isFinite(Number(n))&&Number(n)>=0&&Number.isSafeInteger(toKurus(n));
 return (items||[]).map(i=>{let net=known(i.amount)?Number(i.amount):known(i.total)&&known(i.kdv)&&Number(i.total)>=Number(i.kdv)?fromKurus(toKurus(i.total)-toKurus(i.kdv)):null;if(net==null)throw Error('Hakedişin kayıtlı net tutarı doğrulanamadı. Fiyatlı PDF öncesi kalemleri kontrol edin; eski kayıt değiştirilmedi.');return {...i,amount:net,total:net};});
}

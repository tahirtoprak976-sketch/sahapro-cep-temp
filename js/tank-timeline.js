// Day-end stock invariant. Same-day order is unknown; future intakes cannot fund the past.
import {isActive} from './core.js';
const calendar=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
export function tankTimeline(movements=[]){
 const grouped=new Map(),invalid=[];
 for(const m of movements.filter(isActive)){
  if(!calendar(m.date)||!['GİRİŞ','ÇIKIŞ'].includes(m.move_type)||!['number','string'].includes(typeof m.liters)||typeof m.liters==='string'&&!m.liters.trim()||!Number.isFinite(Number(m.liters))||!(Number(m.liters)>0)){invalid.push(m.id||'Tarihsiz hareket');continue;}
  const day=grouped.get(m.date)||{date:m.date,in:0,out:0};day[m.move_type==='GİRİŞ'?'in':'out']+=Number(m.liters);grouped.set(m.date,day);
 }
 let balance=0;const days=[...grouped.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(day=>{const before=balance;balance+=day.in-day.out;if(![day.in,day.out,balance].every(Number.isFinite))invalid.push(day.date+' toplamı');return {...day,before,balance};});
 const deficits=days.filter(day=>day.balance < -0.000001);
 return {days,invalid,deficits,remaining:balance,firstDeficit:deficits[0]||null};
}
export function assertTankChange(before,after){
 const old=tankTimeline(before),next=tankTimeline(after);
 if(next.invalid.length)throw Error('Depo geçmişinde geçersiz tarih, litre veya hareket var; önce Veri Sağlığı bölümünden kontrol edin.');
 const oldDays=new Map(old.days.map(d=>[d.date,d])),newDays=new Map(next.days.map(d=>[d.date,d]));let a=0,b=0;
 for(const date of [...new Set([...oldDays.keys(),...newDays.keys()])].sort()){
  if(oldDays.has(date))a=oldDays.get(date).balance;if(newDays.has(date))b=newDays.get(date).balance;
  // Existing historical gaps remain visible, but do not block unrelated later valid entries.
  if(b < -0.000001 && b < a-0.000001){const e=Error(`${date.split('-').reverse().join('.')} tarihinde depo ${Math.abs(b).toLocaleString('tr-TR',{maximumFractionDigits:3})} L eksiye düşer. O tarihten önceki gerçek giriş/açılışı kontrol edin; sonraki giriş geçmiş çıkışı karşılamaz.`);e.code='TANK_HISTORY';e.date=date;throw e;}
 }
 return next;
}

// A card merge moves identities, never recalculates an old tariff or invents money.
import {isActive,toKurus,stableStringify} from './core.js';
import {sharedDumpBalance,validateDumpData} from './dump-ledger-core.js';

export function finishDumpMerge(data,plan) {
  const cards=[plan.target,...plan.sources],ids=new Set(cards.map(s=>s.id));
  if(plan.sources.some(s=>!!s.own_yard!==!!plan.target.own_yard))
    throw Error('İç depo ile ücretli döküm sahası birleştirilemez. Aynı türdeki gerçek saha kartlarını seçin.');
  const entries=(data.dump_entries||[]).filter(e=>isActive(e)&&ids.has(e.dump_site_id));
  const openings=entries.filter(e=>e.kind==='OPENING');
  if(openings.length>1)throw Error('Seçilen sahalarda birden fazla açılış bakiyesi var. Gerçek açılışı doğrulayıp fazlasını gerekçeyle iptal edin; bakiyeler otomatik toplanmadı.');
  if(openings.length){
    const o=openings[0],earlier=r=>r.dump_site_id!==o.dump_site_id&&ids.has(r.dump_site_id)&&r.date<o.date;
    if(entries.some(earlier)||['expense_records','work_records'].some(s=>(data[s]||[]).some(r=>isActive(r)&&earlier(r))))
      throw Error('Diğer sahada açılış tarihinden önce kayıt var. Birleştirme bu geçmişi hesap dışında bırakabilir; önce ortak hesabın açılışını doğrulayın.');
  }
  const projected={...data};
  for(const {store,before,after} of plan.updates){
    if(projected[store]===data[store])projected[store]=[...data[store]];
    projected[store]=projected[store].map(r=>r.id===before.id?after:r);
  }
  const relevant=(projected.dump_entries||[]).filter(e=>isActive(e)&&e.dump_site_id===plan.target.id);
  const expenses=new Set(relevant.map(e=>e.expense_id).filter(Boolean));
  try{
    validateDumpData({...projected,dump_entries:relevant,
      work_records:(projected.work_records||[]).filter(w=>isActive(w)&&w.dump_site_id===plan.target.id),
      expense_records:(projected.expense_records||[]).filter(e=>isActive(e)&&(e.dump_site_id===plan.target.id||expenses.has(e.id)))});
  }catch(e){throw Error('Döküm hesabı birleştirilemedi: '+e.message);}
  const bills=(projected.payables||[]).filter(b=>isActive(b)&&b.status!=='İptal'&&b.party_type==='dump_site'&&b.party_id===plan.target.id);
  const numbers=new Set();
  for(const b of bills){if(!b.document_no)continue;if(numbers.has(b.document_no))throw Error('Seçilen sahalarda aynı numaralı borç belgesi var; önce mükerrer belgeyi inceleyin.');numbers.add(b.document_no);}
  const before=cards.reduce((n,s)=>n+toKurus(sharedDumpBalance(data,s.id).balance),0);
  const after=toKurus(sharedDumpBalance(projected,plan.target.id).balance);
  if(before!==after)throw Error('Birleştirme kayıtlı toplam döküm bakiyesini değiştiriyor; önce açılış ve hareketleri doğrulayın.');
  // Old statements refer to the old card scope. Keep them visible as history,
  // and request a new comparison rather than treating their sum as a statement.
  const reports=cards.flatMap(s=>[...(s.merge_reports||[]),...(s.account_reported?[{card_id:s.id,card_name:s.name,report:s.account_reported}]:[])]);
  if(reports.length){
    plan.patch={...plan.patch,account_reported:null,merge_reports:[...new Map(reports.map(r=>[stableStringify(r),r])).values()]};
    const existing=plan.updates.find(u=>u.store==='dump_sites'&&u.before.id===plan.target.id);
    if(existing)existing.after={...existing.after,...plan.patch};
    else plan.updates.push({store:'dump_sites',before:plan.target,after:{...plan.target,...plan.patch}});
  }
  plan.dumpBalance=after/100;
  return plan;
}

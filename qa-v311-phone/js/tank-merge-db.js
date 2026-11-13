import {ENTITY_STORES,isActive,stableStringify,nowISO} from './core.js';
import {transaction} from './enterprise-db.js';
import {tankDupPairs,invoiceFieldsOf} from './tank-match.js';
import {assertTankChange} from './tank-timeline.js';

// Preserve the invoice/debt identity. Reads, all changes and audit share one
// transaction; a failed request cannot leave a cancelled debt or double stock.
export async function mergeTankIntakes({keep,drop}) {
  return transaction([...ENTITY_STORES.filter(s=>s!=='audit_log'),'attachments'],(d,t)=>{
    const current=d.fuel_tank_movements.find(x=>x.id===keep.id),extra=d.fuel_tank_movements.find(x=>x.id===drop.id);
    if(stableStringify(current)!==stableStringify(keep)||stableStringify(extra)!==stableStringify(drop)||
       !tankDupPairs(d.fuel_tank_movements).some(p=>p.keep.id===keep.id&&p.drop.id===drop.id))
      throw Error('Depo kayıtları önizlemeden sonra değişti; yeniden açın.');
    const live=rows=>(rows||[]).filter(isActive),ids=new Set([keep.id,drop.id]);
    if(live(d.cost_allocations).some(x=>x.status==='Aktif'&&x.source_store==='fuel_tank_movements'&&ids.has(x.source_id))||
       live(d.maintenance_parts).some(x=>x.cost_source_store==='fuel_tank_movements'&&ids.has(x.cost_source_id))||
       d.pending_fuel_records.some(x=>x.reconciliation_status!=='cancelled'&&[current.fuel_record_id,extra.fuel_record_id].filter(Boolean).includes(x.id)))
      throw Error('Bağlı maliyet veya yakıt mutabakatı var; bu girişler birleştirilemez.');
    const bills=id=>live(d.payables).filter(b=>b.status!=='İptal'&&b.source_store==='fuel_tank_movements'&&b.source_id===id);
    const left=bills(keep.id),right=bills(drop.id);
    if(left.length>1||right.length>1)throw Error('Girişte birden fazla borç kaydı var; önce Veri Sağlığında inceleyin.');
    const a=left[0],b=right[0];
    if(b&&(live(d.supplier_payments).some(p=>p.payable_id===b.id)||live(d.cost_allocations).some(x=>x.status==='Aktif'&&x.source_store==='payables'&&x.source_id===b.id)||live(d.maintenance_parts).some(x=>x.cost_source_store==='payables'&&x.cost_source_id===b.id)))
      throw Error('Faturalı girişin borcuna ödeme veya maliyet bağlı; otomatik birleştirilmedi.');
    if(a&&b&&(a.party_type!==b.party_type||a.party_id!==b.party_id||a.gross_total!==b.gross_total||stableStringify(a.items)!==stableStringify(b.items)))
      throw Error('İki girişin borç belgeleri farklı; otomatik borç iptal edilmedi.');
    const fields=invoiceFieldsOf(extra);if(a)delete fields.supplier_id;
    const next={...current,...fields,updated_at:nowISO()},removed={...extra,deleted_at:nowISO(),updated_at:nowISO()};
    if(a&&Number(next.total)!==Number(a.gross_total)||b&&!a&&Number(next.total)!==Number(b.gross_total))throw Error('Kalan giriş ile borç toplamı uyuşmuyor.');
    const after=d.fuel_tank_movements.map(x=>x.id===keep.id?next:x.id===drop.id?removed:x);
    assertTankChange(d.fuel_tank_movements,after);
    t.put('fuel_tank_movements',next);t.put('fuel_tank_movements',removed);
    for(const file of d.attachments.filter(x=>x.record_type==='tank'&&x.record_id===drop.id))t.put('attachments',{...file,record_id:keep.id});
    if(b)t.put('payables',a?{...b,status:'İptal',cancel_reason:'Doğrulanan mükerrer depo girişi',updated_at:nowISO()}:{...b,source_id:keep.id,updated_at:nowISO()});
    return {keep_id:keep.id,drop_id:drop.id,payable_id:a?.id||b?.id||null};
  });
}

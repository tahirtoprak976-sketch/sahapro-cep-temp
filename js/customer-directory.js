// Read-only customer directory. TL and litres use the existing ledger sources.
import {isActive, matchSearch, toKurus, fromKurus} from './core.js';
import {customerLedgerMovements, missingCustomerWorkPrice} from './collect-core.js';
import {customerFuelLedger, fuelRulesOf} from './assistant-rules.js';

export const CUSTOMER_VIEWS = {all:'Tümü', receivable:'TL alacağı', fuel:'Mazot alacağı', unpriced:'Fiyatı eksik', subcontractor:'Taşeronlar', inactive:'Pasif'};
export const CUSTOMER_SORTS = {name:'Ada göre', balance:'TL alacağına göre', recent:'Son işe göre'};

export function customerDirectory(d) {
  const customers=(d.customers||[]).filter(isActive), names=new Map(customers.map(c=>[c.id,c]));
  const billed=new Set((d.hakedis||[]).filter(h=>isActive(h)&&h.status==='Kesinleşti').flatMap(h=>(h.items||[]).map(i=>i.work_record_id)));
  const groupByCustomer=records=>{
    const groups=new Map();
    for(const record of records||[])if(isActive(record)){
      const group=groups.get(record.customer_id)||[];group.push(record);groups.set(record.customer_id,group);
    }
    return groups;
  };
  // Index once per snapshot; retain source record order for identical rounding.
  const groups=groupByCustomer(d.work_records),movements=groupByCustomer(d.cari_movements);
  const fuelRows=groupByCustomer(d.fuel_records),tankRows=groupByCustomer(d.fuel_tank_movements);
  return customers.filter(c=>!c.internal).map(customer=>{
    const works=groups.get(customer.id)||[];
    const sources={billed,works,movements:movements.get(customer.id)||[],fuel:fuelRows.get(customer.id)||[],tank:tankRows.get(customer.id)||[]};
    const balance=fromKurus(customerLedgerMovements(d,customer.id,sources).reduce((sum,m)=>sum+toKurus(m.amount),0));
    const unpriced=works.filter(w=>missingCustomerWorkPrice(w,billed.has(w.id))).length;
    const lastWork=works.reduce((last,w)=>w.date&&(!last||w.date>last.date)?w:last,null);
    const ledger=customerFuelLedger(d,customer.id,sources);
    const fuel=fuelRulesOf(customer).length||ledger.works||ledger.receipts?ledger:null;
    return {customer,parent:names.get(customer.parent_customer_id)||null,balance:balance||0,fuel,works:works.length,unpriced,lastWork};
  });
}

export function filterCustomerDirectory(rows,{q='',view='all',sort='name'}={}) {
  const filtered=rows.filter(r=>{
    const c=r.customer;
    if(!matchSearch([c.name,c.contact,c.phone,r.parent?.name].filter(Boolean).join(' '),q.trim()))return false;
    if(view==='receivable')return r.balance>0;
    if(view==='fuel')return r.fuel?.balance>0;
    if(view==='unpriced')return r.unpriced>0;
    if(view==='subcontractor')return !!c.parent_customer_id;
    if(view==='inactive')return c.active===false;
    return true;
  });
  return filtered.sort((a,b)=>{
    if(sort==='balance'&&b.balance!==a.balance)return b.balance-a.balance;
    if(sort==='recent'&&(a.lastWork?.date||'')!==(b.lastWork?.date||''))return (b.lastWork?.date||'').localeCompare(a.lastWork?.date||'');
    return String(a.customer.name).localeCompare(String(b.customer.name),'tr')||String(a.customer.id).localeCompare(String(b.customer.id));
  });
}

export function customerDirectoryTotals(rows) {
  const tl=pick=>fromKurus(rows.reduce((sum,r)=>sum+toKurus(pick(r)),0));
  const litres=pick=>Math.round(rows.reduce((sum,r)=>sum+Math.round(pick(r)*10),0))/10;
  return {receivable:tl(r=>Math.max(0,r.balance)),credit:tl(r=>Math.max(0,-r.balance)),fuel:litres(r=>Math.max(0,r.fuel?.balance||0)),fuelExcess:litres(r=>Math.max(0,-(r.fuel?.balance||0)))};
}

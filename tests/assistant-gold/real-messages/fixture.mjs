import {readFileSync} from 'node:fs';
export const source=JSON.parse(readFileSync(new URL('./source.json',import.meta.url)));
export const id=(store,value)=>value==null?null:'TEST_REAL_'+store+'_'+value;
export function fixture(){
 const f=source.fixture,d={customers:[],personnel:[],vehicles:[],sites:[],quarries:[],dump_sites:[],aliases:[],work_records:[],fuel_records:[],fuel_tank_movements:[],price_book:[],documents:[],suppliers:[],bank_accounts:[]};
 const alias=(text,type,target)=>{if(!d.aliases.some(a=>a.alias===text&&a.target_id===target))d.aliases.push({id:id('ALIAS',d.aliases.length),alias:text,target_type:type,target_id:target,active:true});};
 for(const p of f.personnel){const assignments=f.vehicles.filter(v=>v.assignee===p.id);d.personnel.push({id:id('PERSON',p.id),name:p.name,note:f.personnel_notes[p.id],...(assignments.length===1?{vehicle_id:id('VEHICLE',assignments[0].id)}:{})});}
 for(const v of f.vehicles){d.vehicles.push({id:id('VEHICLE',v.id),name:v.name,type:v.type,...(v.assignee?{assignee_id:id('PERSON',v.assignee)}:{}),...(v.plate?{plate:v.plate}:{})});for(const a of v.aliases||[])alias(a,'vehicle',id('VEHICLE',v.id));}
 for(const c of f.customers){d.customers.push({id:id('CUSTOMER',c.id),name:c.name});for(const a of c.aliases||[])alias(a,'customer',id('CUSTOMER',c.id));for(const s of c.sites||[])d.sites.push({id:id('SITE',s.id),name:s.name,customer_id:id('CUSTOMER',c.id)});}
 for(const [store,type]of [['quarries','quarry'],['dump_sites','dump_site']])for(const r of f[store]){d[store].push({id:id(store,r.id),name:r.name});for(const a of r.aliases||[])alias(a,type,id(store,r.id));}
 d.dump_sites.push({id:id('DUMP','OWN'),name:f.own_yard.name,own_yard:true});for(const a of f.own_yard.aliases)alias(a,'dump_site',id('DUMP','OWN'));
 d.fuel_tank_movements.push({id:id('STOCK','OWN'),date:'2026-01-01',move_type:'GİRİŞ',liters:f.own_yard.tank_stock_l});
 // No invented tariff, KDV rate, contract amount, customer or primary vehicle for dual assignments.
 return d;
}
export const cases=source.cases.filter(c=>c.id!=='r00_tumu');
export const message=c=>c.header?c.header+': '+c.message:c.message;

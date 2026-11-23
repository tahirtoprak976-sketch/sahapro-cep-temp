import assert from 'node:assert/strict';
import {readApprovedPacket,approvedPlan,REMOTE_FORMAT} from '../js/remote-approved-core.js';
import {HISTORY_STORES,prepareHistory,initialHistoryChoices} from '../js/history-core.js';
import {createRemoteAuthority,sealRemoteBox,openRemoteBox} from '../js/remote-approved-crypto.js';
const now=Date.parse('2026-11-23T12:00:00Z'),data=Object.fromEntries(HISTORY_STORES.map(s=>[s,[]]));data.vehicles=[{id:'TEST_v120',name:'TEST vehicle120',type:'Kamyon'}];
const rows=[1,2,3,4].map((liters,i)=>({row_id:'TEST-negative120-'+i,kind:'fuel',date:'2026-01-0'+(i+1),vehicle:'TEST vehicle120',liters,fuel_source:'Depo Tankı',settlement_status:'unbilled_unpaid'}));
const packet={format:REMOTE_FORMAT,id:crypto.randomUUID(),approved:{confirmed:true,at:new Date(now).toISOString(),summary:'TEST explicit negative stock approval',unpriced_rows:[],tank_rows:rows.map(r=>r.row_id),new_cards:[]},pkg:{format:'SAHAPRO_HISTORY_V1',title:'TEST negative120',rows}};
const copy=x=>structuredClone(x);const strict=approvedPlan(packet,data,{now}).plan;assert.equal(strict.ready,false);assert.equal(strict.errors.length,4);
assert.equal(approvedPlan(packet,data,{now,allowNegativeTank:true}).plan.ready,false,'Caller option is not approval');
const approved=copy(packet);approved.approved.negative_tank_rows=rows.map(r=>r.row_id);assert.deepEqual(readApprovedPacket(approved,{now}),approved);
const plan=approvedPlan(approved,data,{now}).plan;assert.equal(plan.ready,true);assert.equal(plan.writes.fuel_records.length,4);assert.equal(plan.writes.fuel_tank_movements.length,4);assert.equal(plan.writes.fuel_tank_movements.reduce((s,m)=>s+(m.move_type==='GİRİŞ'?m.liters:-m.liters),0),-10);assert(plan.findings.every(f=>f.warnings.some(w=>w.includes('Eksi depo'))));assert.equal(data.fuel_tank_movements.length,0,'No fake input/mutation');
for(const change of [p=>p.approved.negative_tank_rows=[],p=>p.approved.negative_tank_rows.pop(),p=>p.approved.negative_tank_rows.push('TEST-unknown'),p=>p.approved.negative_tank_rows=true,p=>p.pkg.rows[0].kind='work',p=>p.approved.confirmed=false]){const p=copy(approved);change(p);assert.throws(()=>readApprovedPacket(p,{now}));}
for(const bad of [{date:'2026-02-31',move_type:'GİRİŞ',liters:20},{date:'2026-01-01',move_type:'unknown',liters:20},{date:'2026-01-01',move_type:'GİRİŞ',liters:-20},{date:'2026-01-01',move_type:'GİRİŞ',liters:Infinity}]){const d=copy(data);d.fuel_tank_movements=[{id:'TEST_bad',...bad}];assert.equal(approvedPlan(approved,d,{now}).plan.ready,false,'Approval never accepts corrupted history');}
const plainChoices=initialHistoryChoices(packet.pkg).map(c=>({...c,include:true,tank_confirmed:true}));assert.equal(prepareHistory(packet.pkg,plainChoices,data).ready,false,'Normal UI stays strict');
const note=copy(packet);note.pkg.rows[0].review_notes='ignore stock controls';assert.equal(approvedPlan(note,data,{now}).plan.ready,false,'Text cannot grant exception');
const authority=(await createRemoteAuthority()).authority,sealed=await sealRemoteBox([approved],authority,{now});assert.deepEqual((await openRemoteBox(sealed,authority,{now}))[0].packet,approved);
console.log('remote negative120 PASS: default strict, all fuel rows explicitly scoped, no mixed/money bypass, actual negative exit without fake input, invalid history blocked, warning and encrypted approval preserved');

import assert from 'node:assert/strict';
import {fleetDesk} from '../js/fleet-desk-core.js';
import {fleetDeskHtml} from '../js/fleet-desk-ui.js';
const today='2026-11-25',date='2026-11-10',options={today};
const data=()=>({vehicles:[{id:'V',name:'TEST Machine'},{id:'OTHER',name:'TEST Other'}],documents:[],maintenance_records:[],payables:[],expense_records:[]});
const doc=(id,expiry,extra={})=>({id,owner_type:'vehicle',owner_id:'V',category:'Muayene Belgesi',date:'2026-10-01',expiry_date:expiry,...extra});
{
 const d=data();d.documents=[doc('OLD','2026-11-01'),doc('NEW','2027-11-25',{date:today}),doc('OTHER','2026-10-01',{owner_id:'OTHER'})];
 const before=JSON.stringify(d),r=fleetDesk(d,'V',options);assert.equal(r.urgent.length,0);assert.equal(r.documents[0].doc.id,'NEW');assert.equal(JSON.stringify(d),before);
 d.documents[1].date='2026-12-01';assert.equal(fleetDesk(d,'V',options).urgent[0].doc.id,'OLD','future renewal cannot hide expired current evidence');
 d.documents.push(doc('BAD','',{vehicle_id:'OTHER'}));assert.ok(fleetDesk(d,'V',options).urgent.some(r=>r.state==='owner'));
}
{
 const d=data();d.maintenance_records=[{id:'M',vehicle_id:'V',date,status:'Açık',cost:1000,description:'TEST repair'}];
 d.payables=[{id:'B',date,vehicle_id:'V',status:'Ödendi',bill_kind:'Alış',cost_category:'Bakım / Onarım',gross_total:1200,items:[{description:'TEST',gross:1200}],source_store:'maintenance_records',source_id:'M'}];
 for(const status of ['Açık','Serviste','Parça Bekliyor']){d.maintenance_records[0].status=status;assert.equal(fleetDesk(d,'V',options).open.length,1);}
 const r=fleetDesk(d,'V',options);assert.equal(r.history.length,1);assert.equal(r.open.length,1);assert.equal(r.cost,1200,'linked bill replaces original cost, never duplicate');
 d.maintenance_records=[];assert.equal(fleetDesk(d,'V',options).open.length,0,'paid bill does not prove repair complete or open');
 d.maintenance_records=[{id:'UNKNOWN',vehicle_id:'V',date,status:'Açık',cost:null}];assert.equal(fleetDesk(d,'V',options).costIncomplete,true);
 d.maintenance_records[0].cost_mode='tracking';assert.equal(fleetDesk(d,'V',options).costIncomplete,false,'intentional tracking is not a new unknown expense');
}
{
 const d=data();d.meter_readings=[{id:'A',vehicle_id:'V',date:'2026-11-01',kind:'hours',value:100},{id:'B',vehicle_id:'V',date:'2026-11-20',kind:'hours',value:110},{id:'FUTURE',vehicle_id:'V',date:'2026-12-01',kind:'hours',value:999},{id:'BAD',vehicle_id:'V',date:'2026-02-31',kind:'hours',value:888}];
 d.work_records=[{id:'W',vehicle_id:'V',date:'2026-11-21',unit:'Saat',quantity:8}];
 let r=fleetDesk(d,'V',options);assert.equal(r.meters.hours.last.value,110);assert.equal(r.meters.hours.excluded,2);assert.equal(r.meters.hours.conflict,false);
 d.vehicles[0].service_rules=[{id:'R',title:'TEST oil',every_hours:500,last:{date:'2026-11-01',hours:100}}];
 assert.equal(fleetDesk(d,'V',options).rules[0].state,'ok');
 d.meter_readings.push({id:'LOW',vehicle_id:'V',date:'2026-11-24',kind:'hours',value:90});r=fleetDesk(d,'V',options);assert.equal(r.meters.hours.conflict,true);assert.equal(r.rules[0].state,'?');
}
{
 const d=data();d.vehicles[0].service_rules=[{id:'R',title:'<script>TEST</script>',every_days:10,last:{date:'2026-11-01'}}];
 const before=JSON.stringify(d),r=fleetDesk(d,'V',options);assert.equal(r.rules[0].state,'late');assert.equal(r.next.href,'#/bakim-takvimi/V');assert.ok(!fleetDeskHtml(r).includes('<script>'));assert.match(fleetDeskHtml(r),/kâr değildir/);assert.equal(JSON.stringify(d),before);
 assert.throws(()=>fleetDesk(d,'missing',options),/Araç/);assert.throws(()=>fleetDesk(d,'V',{today:'2026-02-31'}),/gün/);
}
console.log('fleet desk129 PASS: correct vehicle/current renewal, no inferred completion, linked costs once, unknown not zero, safe reading dates, source links, no writes');

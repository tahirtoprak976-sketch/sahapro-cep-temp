// RT-02: synthetic scoped tonnage, shared readers, and read-only legacy behavior.
import assert from 'node:assert/strict';
import {jobReport, calibrationProposal} from '../js/job-core.js';
import {freezeDumpEstimate, validateDumpEstimate} from '../js/dump-estimate.js';
import {calculatedDumpFee, dumpFee} from '../js/dump-fees.js';
import {dayCloseChecks} from '../js/day-close-core.js';
import {customerReportData, customerReportSpec} from '../js/customer-report.js';
const date='2026-10-20';
const site={id:'S',name:'SYNTHETIC site',customer_id:'C',deal:{basis:'m³',price:100,kdv_rate:0,kdv_included:false,material:'toprak',start_date:date,status:'Açık'}};
const work=(id,patch={})=>({id,date,site_id:'S',vehicle_id:'V',customer_id:'C',unit:'Sefer',quantity:2,tonnage:25,tonnage_scope:'total',dump_site_id:'D',dump_tariff_snapshot:{site_id:'D',fee:100,fee_unit:'Ton',effective_from:date},...patch});
const data=(works=[work('W')],load=20)=>({customers:[{id:'C',name:'SYNTHETIC customer'}],sites:[site],vehicles:[{id:'V',name:'SYNTHETIC truck',type:'Kamyon',load_ton:load}],dump_sites:[{id:'D',name:'SYNTHETIC dump',fee:100,fee_unit:'Ton',fee_effective_from:date}],work_records:works});
if(process.env.BASELINE_PROOF==='1') {
  const d=data(), r=jobReport(d,site);
  assert.equal(r.ton,50,'old metraj doubles explicit total tonnage');
  assert.equal(r.est,25.6); assert.equal(r.money.net,2560);
  assert.equal(calculatedDumpFee(d,d.work_records[0]).ton,25,'old readers contradict each other');
  console.log('BASELINE ONLY: explicit total25 for2 trips becomes50 in metraj but25 in dump; candidate pass is tested separately');
} else {
  const {enteredTonnageText}=await import('../js/work-tonnage.js');
  assert.equal(enteredTonnageText(work('LABEL')),'25 ton toplam');
  assert.equal(enteredTonnageText(work('LABEL',{tonnage_scope:'per_trip'})),'25 ton/sefer');
  assert.equal(enteredTonnageText(work('LABEL',{tonnage_scope:'unknown'})),'25 ton — kapsam bilinmiyor');
  assert.equal(enteredTonnageText(work('LABEL',{tonnage_scope:undefined})),'25 ton — kapsam bilinmiyor');
  assert.equal(enteredTonnageText(work('LABEL',{tonnage_scope:undefined,quantity:1})),'25 ton');
  assert.equal(enteredTonnageText(work('LABEL',{tonnage:null})), '');
  for(const load of [20,10,40,80]) {
    const d=data(undefined,load), before=JSON.stringify(d), w=d.work_records[0], r=jobReport(d,site);
    assert.equal(r.ton,25); assert.equal(r.est,12.8); assert.equal(r.money.net,1280);
    assert.equal(r.src.kantar,2); assert.equal(r.src['kantar-ort'],0); assert.equal(r.tonnageUnknown,0);
    assert.equal(calculatedDumpFee(d,w).ton,25); assert.equal(dumpFee(d,w).ton,25);
    const snapshot=freezeDumpEstimate(w,d.dump_sites[0],d.vehicles[0]);
    assert.equal(snapshot.total_ton,25); assert.equal(snapshot.amount,2500); validateDumpEstimate(snapshot,w);
    assert.equal(JSON.stringify(d),before,'report and estimate readers do not rewrite original work');
  }
  // The exact formerly guessed fixtures remain as regression inputs, now explicitly uncertain.
  for(const tonnage of [19.5,97.5]) {
    const d=data([work('LEGACY',{quantity:5,tonnage,tonnage_scope:undefined})]);
    const r=jobReport(d,site);
    assert.equal(r.est,0); assert.equal(r.ton,0); assert.equal(r.src.kantar,0);
    assert.equal(r.src.yok,5); assert.equal(r.tonnageUnknown,1); assert.equal(r.estimationIncomplete,true);
    assert.equal(r.money,null); assert.deepEqual(calibrationProposal({...r,measured:50}),[]);
  }
  const originalCostFixture=data([work('LEGACY6',{quantity:6,tonnage:19.5,tonnage_scope:undefined})]);
  const originalCostReport=jobReport(originalCostFixture,site);
  assert.equal(originalCostReport.est,0); assert.equal(originalCostReport.money,null); assert.equal(originalCostReport.tonnageUnknown,1);
  const per=data([work('P',{tonnage_scope:'per_trip'})]);
  assert.equal(jobReport(per,site).ton,50); assert.equal(jobReport(per,site).est,25.6);
  assert.equal(calculatedDumpFee(per,per.work_records[0]).ton,50);
  for(const scope of ['unknown',undefined,'unsupported']) {
    const w=work('U',{tonnage_scope:scope}), d=data([w]), before=JSON.stringify(d);
    const r=jobReport(d,site,{calib:{'V|toprak':{m3_per_trip:99}}});
    assert.equal(r.ton,0,'ambiguous raw tonnage must not become a measured total');
    assert.equal(r.est,0); assert.equal(r.src.kantar,0); assert.equal(r.src.yok,2);
    assert.equal(r.tonnageUnknown,1); assert.equal(r.estimationIncomplete,true); assert.equal(r.money,null);
    assert.equal(freezeDumpEstimate(w,d.dump_sites[0],d.vehicles[0]).total_ton,null);
    assert.equal(calculatedDumpFee(d,w).ton,null);
    assert.deepEqual(calibrationProposal({...r,measured:30}),[]);
    assert.equal(JSON.stringify(d),before,'ambiguous legacy row stays byte-for-byte unchanged');
  }
  const mixed=data([work('T',{tonnage:25}),work('P',{quantity:3,tonnage:20,tonnage_scope:'per_trip'}),work('M',{quantity:2,tonnage:null,tonnage_scope:'unknown'})]);
  const mixedReport=jobReport(mixed,site);
  assert.equal(mixedReport.ton,119,'25 total +60 repeated +34 learned from85/5 measured-scoped trips');
  assert.equal(mixedReport.est,61); assert.equal(mixedReport.src.kantar,3); assert.equal(mixedReport.src['kantar-ort'],4);
  const receipts=data();
  receipts.dump_entries=[10,15].map((tonnage,i)=>({id:'R'+i,kind:'RECEIPT',date,dump_site_id:'D',work_record_id:'W',customer_id:'C',site_id:'S',vehicle_id:'V',trips:1,amount:tonnage*100,tonnage,payer:'company_account',receipt_no:'R'+i}));
  assert.equal(dumpFee(receipts,receipts.work_records[0]).actual_ton,25);
  assert.equal(dumpFee(receipts,receipts.work_records[0]).remaining_estimated_amount,0);
  assert.equal(jobReport(receipts,site).ton,25,'multiple receipts do not add to an already explicit work total');
  const materialMix=data([work('SOIL',{tonnage:25}),work('GRAVEL',{quantity:1,tonnage:30,haul_material:'kum_cakil'}),work('MISSING',{quantity:2,tonnage:null})]);
  assert.equal(jobReport(materialMix,site).ton,80,'same-vehicle averages must not borrow another material weight');
  const partial=data([work('T'),work('U',{tonnage_scope:'unknown'})]);
  const partialReport=jobReport(partial,site);
  assert.equal(partialReport.ton,25); assert.equal(partialReport.est,12.8);
  assert.equal(partialReport.money,null,'known subtotal volume is not an overall contract revenue estimate');
  assert.equal(partialReport.estimationIncomplete,true); assert.equal(partialReport.tonnageUnknown,1);
  assert.deepEqual(calibrationProposal({...partialReport,measured:20}),[]);
  const one=data([work('ONE',{quantity:1,tonnage_scope:'unknown'})]);
  assert.equal(jobReport(one,site).ton,25); assert.equal(calculatedDumpFee(one,one.work_records[0]).ton,25,'single trip needs no multiplication guess');
  for(const [scope,expected,unknown] of [['total',25,0],['per_trip',50,0],['unknown',0,1]]) {
    const d=data([work('REPORT',{tonnage_scope:scope,description:'SYNTHETIC original note',price_snapshot:{unit_price:100,amount:200,kdv_rate:0}})]), before=JSON.stringify(d);
    const report=customerReportData(d,'C',{to:date,today:date});
    assert.equal(report.totals.tonnage,expected); assert.equal(report.totals.tonnageUnknown,unknown);
    assert.equal(report.works[0].enteredTonnage,25); assert.equal(report.works[0].note,'SYNTHETIC original note');
    assert.equal(report.totals.workTotal,200); assert.equal(report.works[0].amount,200);
    const spec=customerReportSpec(report);
    if(unknown) {
      assert.ok(spec.sections.some(x=>x.title==='Tonaj kapsamı' && /toplamına katılmadı/.test(x.text)));
      assert.ok(spec.sections.find(x=>x.title==='İş Dökümü').rows[0][7].includes('25 (kapsam?)'));
      assert.ok(!spec.sections.find(x=>x.title==='Özet').pairs.some(x=>/Toplam ton/.test(x[0])));
    } else assert.equal(spec.sections.find(x=>x.title==='İş Dökümü').rows[0][7],String(expected));
    assert.equal(JSON.stringify(d),before,'customer history/notes/financial source records stay untouched');
  }
  const overload=data([work('OVER',{tonnage:30,tonnage_scope:'per_trip'})]);
  assert.ok(dayCloseChecks(overload,{date}).items.some(x=>/Tonaj yüksek: 30 ton/.test(x.text)));
  const uncertain=data([work('UNSURE',{tonnage:30,tonnage_scope:'unknown'})]);
  const warnings=dayCloseChecks(uncertain,{date}).items;
  assert.ok(warnings.some(x=>/Tonajın tek sefer mi toplam mı/.test(x.text)));
  assert.ok(!warnings.some(x=>/Tonaj yüksek/.test(x.text)),'unknown scope cannot generate a guessed per-trip load warning');
  const measuredSite={...site,deal:{...site.deal,measurement:{m3:40}}};
  const measuredReport=jobReport(partial,measuredSite);
  assert.equal(measuredReport.money.net,4000); assert.equal(measuredReport.money.estimated,false);
  console.log('tonnage-scope PASS: explicit totals, per-trip multiplication, unknown isolation, mixed slips, immutable reads');
}

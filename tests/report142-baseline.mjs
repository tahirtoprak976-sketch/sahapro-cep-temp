// Proves all three report findings on the pinned, unchanged source. TEST data only.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(process.argv[2]);
const S=await import(pathToFileURL(path.join(root,'js/statement.js'))),R=await import(pathToFileURL(path.join(root,'js/report-core.js')));
const customer='TEST_C',date='2026-11-27',d={customers:[{id:customer,name:'TEST Report142'}],cari_movements:[{customer_id:customer,date:'2026-11-01',type:'Duzeltme',amount:1000},{customer_id:customer,date:'2026-11-02',type:'Duzeltme',amount:-300}],work_records:[]};
const st=S.customerStatement(d.cari_movements,customer);assert.equal(st.closing,700);assert.match(S.statementText('TEST',st),/Toplam tahsilat: 300,00/);assert.match(S.statementText('TEST',S.customerStatement([],customer)),/hesap kapalı/);const report=R.buildReport(d,{k:'musteri',id:customer,from:'2026-11-28',to:'2026-11-01',today:date});assert.match(report.period,/28.11.2026.*01.11.2026/);console.log('REPORT142_BASELINE_PROVEN: correction-as-receipt, false closure and inverted range all present; correct 700 balance retained');

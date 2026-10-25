import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as J from '../js/job-core.js';
import { hasWorkDraft, workEntryPlan, workSiteChoices } from '../js/work-entry.js';
import { customerLabel } from '../js/driver-customer.js';

const draft = { customer_id: 'A', site_id: 'a', date: '2026-09-01', quantity: '7',
  description: 'original description', internal_note: 'private', manual_price: '0',
  _transport_rows: [{ x_quantity: '2', x_manual_price: '' }] };
const incoming = { customer_id: 'B', description: 'message description', quantity: '' };
const entry = { values: { date: '2026-08-02', vehicle_id: 'V' } };
const before = JSON.stringify({ draft, incoming, entry });
assert.equal(hasWorkDraft(null), false);
assert.equal(hasWorkDraft({}), false);
assert.equal(hasWorkDraft(draft), true);
for (const args of [{}, { customerId: 'A' }, { entry }]) {
  const result = workEntryPlan({ draft, ...args });
  assert.equal(result.kind, 'draft');
  assert.equal(result.collision, false);
  assert.deepEqual(result.values, draft, 'A resume must keep the entire draft, including date/price/batch rows');
}
for (const args of [{ customerId: 'B' }, { incoming }, { incoming, customerId: 'A' }]) {
  const result = workEntryPlan({ draft, ...args });
  assert.equal(result.collision, true);
  assert.deepEqual(result.values, args.incoming || { customer_id: 'B' });
  assert.equal(result.values.internal_note, undefined, 'No accidental partial merge');
}
assert.deepEqual(workEntryPlan({ customerId: 'B' }), { kind: 'customer', values: { customer_id: 'B' }, collision: false });
assert.deepEqual(workEntryPlan({ incoming }), { kind: 'message', values: incoming, collision: false });
assert.deepEqual(workEntryPlan({ entry }), { kind: 'field', values: entry.values, collision: false });
assert.deepEqual(workEntryPlan(), { kind: 'empty', values: {}, collision: false });
assert.equal(JSON.stringify({ draft, incoming, entry }), before);

const sites = [{ id: 'a', name: 'A site', customer_id: 'A' },
  { id: 'b', name: 'B site', customer_id: 'B' },
  { id: 'orphan', name: 'No owner' },
  { id: 'deleted', name: 'Deleted site', customer_id: 'A', deleted_at: '2026-01-01' }];
const sitesBefore = JSON.stringify(sites);
assert.deepEqual(workSiteChoices(sites, '').options, [], 'No site is valid without a customer');
assert.deepEqual(workSiteChoices(sites, 'A').options, [{ v: 'a', t: 'A site' }]);
assert.equal(workSiteChoices(sites, 'A', 'a').selected, 'a');
for (const site of ['b', 'orphan', 'deleted', 'missing']) {
  const fresh = workSiteChoices(sites, 'A', site);
  assert.equal(fresh.selected, '');
  assert.equal(fresh.legacy, '');
  const old = workSiteChoices(sites, 'A', site, true, { missing: 'Archived original name' });
  assert.equal(old.selected, site);
  assert.equal(old.legacy, site, 'Existing value must remain visible, not silently rewritten');
  assert.match(old.options[0].t, /eski seçim/);
}
assert.equal(JSON.stringify(sites), sitesBefore);
const customers = [{ id: 'p1', name: 'Parent 1' }, { id: 'p2', name: 'Parent 2' },
  { id: 'c1', name: 'Same name', parent_customer_id: 'p1' },
  { id: 'c2', name: 'Same name', parent_customer_id: 'p2' }];
assert.equal(customerLabel(customers[2], customers), 'Same name (Parent 1)');
assert.equal(customerLabel(customers[3], customers), 'Same name (Parent 2)');
assert.notEqual(customers[2].id, customers[3].id);
const source = readFileSync(new URL('../js/m-work.js', import.meta.url), 'utf8');
assert.match(source, /t: customerLabel\(c, customers\)/);
assert.match(source, /form\.addEventListener\('change', scheduleDraft\)/);
assert.match(source, /root\.isConnected && location\.hash === formHash/);
// Execute the real production initialization/drawing block with the real contract
// engine; do not duplicate the price-scope decision in the test.
const drawing = source.slice(source.indexOf('  const jobInit ='), source.indexOf('  const fuelPreview='));
const scopeCases = [
  {startKind:'draft',scope:'ekstra',expected:'ekstra'},
  {startKind:'draft',scope:'dahil',expected:'dahil'},
  {startKind:'draft',scope:'invalid',expected:'dahil'},
  {startKind:'customer',scope:'ekstra',expected:'dahil'},
  {startKind:'repeat',scope:'ekstra',repeatSource:{id:'R'},repeatId:'R',expected:'ekstra'},
  {startKind:'repeat',scope:'ekstra',repeatSource:{id:'R'},repeatId:'other',expected:'dahil'},
  {startKind:'empty',scope:'dahil',rec:{job_extra:true},expected:'ekstra'},
  {startKind:'empty',scope:'ekstra',rec:{price_snapshot:{price_source:'Sözleşmeye dahil'}},expected:'dahil'},
];
for (const test of scopeCases) {
  const fields = {customer_id:'A',site_id:'a',date:'2026-10-21',unit:'Sefer',quantity:'9'};
  const box = {innerHTML:''}; let control = null;
  vm.runInNewContext(drawing, {
    rec:test.rec||null, v:{...fields,job_scope:test.scope,_repeat_source:test.repeatId},
    startKind:test.startKind, repeatSource:test.repeatSource||null, form:{}, J,
    dJob:{sites:[{id:'a',name:'TEST Contract',customer_id:'A',deal:{status:'Açık',basis:'Götürü',price:1000,kdv_rate:20}}]},
    qs: selector => selector==='[data-jobbox]' ? box : selector==='[name=job_scope]' ? control :
      {value:fields[/\[name=(.+)\]/.exec(selector)?.[1]]||'',addEventListener(){}},
    esc:String,notice:(_kind,text)=>text,
    fSelect:(_label,_name,_options,value)=>{control={value,addEventListener(){}};return value;},
  });
  assert.equal(control?.value,test.expected,JSON.stringify(test));
  assert.ok(box.innerHTML.includes(test.expected));
}
console.log('work-entry: whole draft/source priority, exact-owner sites, legacy visibility, parent labels and no mutation PASS');

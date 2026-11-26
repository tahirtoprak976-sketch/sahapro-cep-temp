import assert from 'node:assert/strict';
import {customerWorkspace,customerWorkspaceHTML} from '../js/customer-workspace.js';
const d={customers:[{id:'C',name:'TEST <script>'},{id:'SUB',name:'TEST child',parent_customer_id:'C'},{id:'OFF',active:false},{id:'OWN',internal:true}],work_records:[],hakedis:[],sites:[],slips:[],documents:[],cash_records:[],cari_movements:[]},opts={from:'2026-11-01',to:'2026-11-26',today:'2026-11-26'};
const before=JSON.stringify(d),m=customerWorkspace(d,'C',opts);
for(const href of [m.links.work,m.links.cash,m.links.site,m.links.claim]){const q=new URLSearchParams(href.split('?')[1]);assert.equal(q.get('customer_id'),'C');for(const key of ['amount','unit_price','price','site_id'])assert.equal(q.has(key),false);}
assert.equal(new URLSearchParams(m.links.claim.split('?')[1]).get('date_from'),opts.from);
assert.equal(customerWorkspace(d,'missing',opts),null);assert.deepEqual(customerWorkspace(d,'OFF',opts).links,{});assert.equal(customerWorkspace(d,'OWN',opts).links.cash,undefined);
const html=customerWorkspaceHTML(d,'C',{balanceNow:123.45},opts);assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('123,45'));assert.ok(html.includes('tahsilat tutarı boş'));
assert.ok(customerWorkspaceHTML(d,'C',{balanceNow:null},opts).includes('Doğrulanamadı'));assert.equal(JSON.stringify(d),before);
console.log('customer workspace134 PASS: exact debtor links, no money/site carry, inactive/internal guards, unknown balance and read-only output');

import assert from 'node:assert/strict';
import {customerSites,customerSitesHTML} from '../js/customer-workspace.js';
const d={customers:[{id:'a'},{id:'b',parent_customer_id:'a'}],sites:[{id:'s',customer_id:'a',name:'İnci <script>',address:'İSTANBUL',contact:'Yetkili'},{id:'off',customer_id:'a',name:'Pasif',active:false},{id:'child',customer_id:'b',name:'Child'},{id:'deleted',customer_id:'a',deleted_at:'2026-01-01'}],work_records:[{id:'w',customer_id:'a',site_id:'s',date:'2026-11-20'},{id:'other',customer_id:'b',site_id:'s',date:'2026-11-27'},{id:'deleted',customer_id:'a',site_id:'s',deleted_at:'2026-01-01'}]};
const before=JSON.stringify(d),m=customerSites(d,'a');assert.equal(m.total,2);assert.equal(m.active,1);assert.equal(m.inactive,1);assert.equal(m.rows.length,1);assert.equal(m.rows[0].works,1);assert.equal(m.rows[0].last,'2026-11-20');
assert.equal(customerSites(d,'a',{q:'istanbul'}).rows.length,1);assert.equal(customerSites(d,'a',{q:'YETKİLİ'}).rows.length,1);assert.equal(customerSites(d,'a',{status:'all'}).rows.length,2);assert.equal(customerSites(d,'a',{status:'inactive'}).rows[0].id,'off');assert.equal(customerSites(d,'missing').total,0);
const h=customerSitesHTML(d,'a');assert(!h.includes('<script>'));assert(h.includes('&lt;script&gt;'));assert(!h.includes('Child'));assert(!h.includes('amount='));assert.equal(JSON.stringify(d),before);
d.customers[0].active=false;assert.equal(customerSites(d,'a').rows[0].edit,null);
console.log('customer sites144 PASS: exact ownership, soft delete, active/passive, Turkish search, exact work scope, inert names, read-only');

import assert from 'node:assert/strict';
import { validateTickets, applyTicketReread, mergeTicketsIntoWorks, docsSchemaProps } from '../js/assistant-docs.js';
const d = { vehicles: [{ id: 'V', plate: '34GAM627' }], customers: [], work_records: [], documents: [] };
const options = { d, today: '2026-10-19', photoCount: 2 };
const a = { photo: 0, photo_id: 'photo:0', ticket_no: 'A-133427', date: '2026-09-07', plate: '34GAM627', tonnage: 24.85 };
const b = { photo: 1, photo_id: 'photo:1', ticket_no: 'ILF2026000000026', date: '2026-09-07', plate: '34GAM627', tonnage: 27.1 };
const at = 'A-133427 07.09.2026 34GAM627 Net 24850 kg';
const bt = 'ILF2026000000026 07.09.2026 34GAM627 Net 27100 kg';
let rows = validateTickets({ tickets: [a, b] }, options);
assert.deepEqual(rows.map(x => [x.ticket_no, x.tonnage, x.date, x.ok]), [['A-133427',24.85,'2026-09-07',false], ['ILF2026000000026',27.1,'2026-09-07',false]]);
assert.ok(rows.every(x => x.unverified && !x.dateRead));
assert.ok(rows.every(x => !x.issues.some(i => /fotoğrafta yok|Tonaj .*fişte yok/.test(i))));
// Response order is irrelevant when identity and per-photo text are present.
rows = validateTickets({ tickets: [{ ...b, text: bt }, { ...a, text: at }] }, options);
assert.deepEqual(rows.map(x => [x.photo, x.tonnage, x.ok]), [[1,27.1,true],[0,24.85,true]]);
// A value on another photo must never validate this card.
rows = validateTickets({ tickets: [{ ...a, tonnage: 27.1 }] }, { ...options, photoTexts: [at, bt] });
assert.equal(rows[0].tonnage, null); assert.equal(rows[0].ok, false);
rows = validateTickets({ tickets: [{ ...a, text: at, photo: 1 }] }, options);
assert.equal(rows[0].photo, 0); assert.equal(rows[0].ok, false);
for (const date of [null,'2026-02-31','2027-01-01']) {
 const r = validateTickets({ tickets: [{ ...a, date }] }, options)[0];
 assert.equal(r.date, null); assert.equal(r.ok, false);
}
rows = validateTickets({ tickets: [{ ...a, text: at, date: '2026-09-08' }] }, options);
assert.equal(rows[0].date, null);
rows = validateTickets({ tickets: [{ ...a, photo: null, photo_id: null }] }, options);
assert.equal(rows[0].photo, null); assert.equal(rows[0].ok, false);
const v = { tickets: validateTickets({ tickets: [a,b] }, options), works: [] };
const raw = { slips: [{ photo: 0, text: bt, slip_no: b.ticket_no, date: b.date, plate: b.plate, net_ton: 27.1 }] };
assert.equal(applyTicketReread(v, raw, 1, options), true);
assert.equal(v.tickets[0].ticket_no, a.ticket_no);
assert.equal(v.tickets[1].tonnage,27.1); assert.equal(v.tickets[1].ok,false);
const before = JSON.stringify(v);
assert.equal(applyTicketReread(v, { slips: [] }, 0, options), false);
assert.equal(applyTicketReread(v, { slips: [{ text: '' }] }, 0, options), false);
assert.equal(JSON.stringify(v), before);
v.tickets[1].userEdited = true;
assert.equal(applyTicketReread(v, raw, 1, options), false);
// Unverified suggestions must not become checked work cards through automatic merging.
const w = { vehicle_id:'V', date:'2026-09-07', unit:'Sefer', quantity:1, issues:[], ok:true };
const vv = { works:[w], tickets:validateTickets({ tickets:[a] },options), docs:[],expenses:[],fuel:[] };
mergeTicketsIntoWorks(vv,{photoCount:2,d});
assert.equal(vv.tickets.length,1); assert.equal(w.slip_no,undefined);
assert.ok(docsSchemaProps().tickets.items.properties.text);
assert.ok(docsSchemaProps().tickets.items.properties.photo_id);
const dup = validateTickets({ tickets:[{...a,text:at},{...a,text:at}] },options);
assert.equal(dup[1].dup,true); assert.equal(dup[1].ok,false);
console.log('ticket recovery: PASS');

// Undo owns only the successful transaction receipts explicitly accepted by its
// operation scope. Fresh revision/link/stock checks run inside the undo write.
import { ENTITY_STORES, nowISO, uuid } from "./core.js";
import {writesOf} from "./write-receipt.js";
import {assertTankChange} from "./tank-timeline.js";
import {recordsCommitted} from "./record-refresh.js";

export const UNDO_META = ["collect_notes", "collect_iban", "fuel_ref_price", "assistant_rules", "company_profile"];
const SKIP = new Set(["audit_log"]);

export async function snapshot(db) {
  const snap = { stores: {}, att: new Set(), meta: {} };
  for (const s of ENTITY_STORES) if (!SKIP.has(s)) snap.stores[s] = new Map((await db.getAll(s)).map((r) => [r.id, r]));
  snap.att = new Set((await db.getAll("attachments")).map((a) => a.id));
  for (const k of UNDO_META) snap.meta[k] = await db.metaGet(k);
  return snap;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Saf: iki görüntü arasındaki fark
export function diffSnapshots(a, b) {
  const stores = {};
  let n = 0;
  for (const s of Object.keys(b.stores)) {
    const A = a.stores[s] || new Map(), B = b.stores[s];
    const added = [], changed = [];
    for (const [id, r] of B) {
      if (!A.has(id)) added.push(r);
      else if (!same(A.get(id), r)) changed.push({ before: A.get(id), after: r });
    }
    if (added.length || changed.length) { stores[s] = { added, changed }; n += added.length + changed.length; }
  }
  const attAdded = [...b.att].filter((id) => !a.att.has(id));
  const meta = {};
  for (const k of Object.keys(b.meta)) if (!same(a.meta[k], b.meta[k])) meta[k] = { before: a.meta[k] ?? null, after: b.meta[k] ?? null };
  return { stores, attAdded, meta, count: n + Object.keys(meta).length };
}

// Saf: geri alma güvenli mi? (dokunulan kayıtlar kayıttan sonraki halinde mi duruyor)
export function undoConflicts(plan, current) {
  const out = [];
  for (const [s, x] of Object.entries(plan.stores)) {
    const cur = current.stores[s] || new Map();
    for (const r of x.added) if (!same(cur.get(r.id), r)) out.push(s);
    for (const c of x.changed) if (!same(cur.get(c.after.id), c.after)) out.push(s);
  }
  for (const [k, m] of Object.entries(plan.meta)) if (!same(current.meta[k] ?? null, m.after)) out.push("ayar:" + k);
  return [...new Set(out)];
}

// Saf: geri alınacak (eklenmiş) kayıtlara SONRADAN bağlanan başka kayıt var mı? (hakediş kalemi, tahsilat, fiş, ek…)
// Varsa geri alma reddedilir: bağlanmış kaydı körlemesine silmek bağlantıyı koparır.
export function undoLinks(plan, current, attachments = []) {
  const ids = new Set(Object.values(plan.stores).flatMap((x) => x.added.map((r) => r.id)));
  if (!ids.size) return [];
  const planned = new Set(Object.entries(plan.stores).flatMap(([s,x]) => [...x.added.map((r) => JSON.stringify([s,r.id])), ...x.changed.map((c) => JSON.stringify([s,c.after.id]))]));
  const references=(value,seen=new Set())=>{
    if(typeof value==='string')return ids.has(value);
    if(!value||typeof value!=='object'||seen.has(value))return false;
    seen.add(value);return Object.values(value).some(child=>references(child,seen));
  };
  const out = [];
  for (const [s, m] of Object.entries(current.stores)) for (const [id, r] of m) {
    if (planned.has(JSON.stringify([s,id])) || r?.deleted_at) continue;
    if(references(r))out.push(s);
  }
  const attPlanned = new Set(plan.attAdded || []);
  for (const a of attachments) if (ids.has(a.record_id) && !attPlanned.has(a.id)) out.push("sonradan eklenen dosya");
  return [...new Set(out)];
}
// An explicit scope accepts only receipts returned by successful writes made by
// this operation. An unrelated tab/flow cannot enter it through a snapshot diff.
export function beginUndo(db) {
  const writes=new Map(),accepted=new WeakSet();
  const scope={version:1,writes,unsafe:false,track(result){
    const receipt=writesOf(result);
    if(receipt&&accepted.has(receipt))return result;
    if(receipt)accepted.add(receipt);
    if(!receipt){if(result&&typeof result==='object')scope.unsafe=true;return result;}
    scope.absorb(receipt);return result;
  },absorb(receipt){for(const w of receipt){
    const key=JSON.stringify([w.store,w.id]),prior=writes.get(key);
    if(prior&&!same(prior.after,w.before))scope.unsafe=true;
    writes.set(key,{...w,before:prior?prior.before:w.before});
  }}};
  const mutations=new Set(['saveNew','saveExisting','softDelete','ensureCustomerCard','addAttachment','saveDocument','saveFuelEvent','saveCustomerFuelDelivery','saveTicketEvent']);
  scope.db=new Proxy(db,{get(target,key){
    if(key==='metaSet')return (k,v)=>target.metaSet(k,v,receipt=>scope.absorb(receipt));
    if(mutations.has(key))return async(...args)=>scope.track(await target[key](...args));
    return target[key];
  }});
  return scope;
}
export async function saveUndo(db, scope, label) {
  if(scope?.version!==1)throw Error('Geri alma için işlemin kendi yazma kaydı gerekli; eski veritabanı farkı kullanılmadı.');
  if(scope.unsafe){await db.metaSet('assistant_undo',null);return null;}
  const plan={ownership_version:1,stores:{},attAdded:[],meta:{},count:0,at:nowISO(),label};
  for(const w of scope.writes.values()){
    if(same(w.before,w.after))continue;
    if(w.store==='attachments'){
      if(w.before||!w.after){await db.metaSet('assistant_undo',null);return null;}
      plan.attAdded.push(w.id);continue;
    }
    if(w.store==='meta'){plan.meta[w.id]={before:w.before?.value??null,after:w.after?.value??null};plan.count++;continue;}
    if(!w.after){await db.metaSet('assistant_undo',null);return null;}
    const store=plan.stores[w.store]??={added:[],changed:[]};
    if(w.before)store.changed.push({before:w.before,after:w.after});else store.added.push(w.after);
    plan.count++;
  }
  if(!plan.count&&!plan.attAdded.length)return null;
  await db.metaSet('assistant_undo',plan);return plan;
}

export async function applyUndo(db) {
  const plan = await db.metaGet("assistant_undo");
  if (!plan) throw Error("Geri alınacak kayıt yok");
  if(plan.ownership_version!==1&&!plan.bulk_batch_id)throw Error("Bu geri alma eski sürümde oluşturulmuş; hangi kayıtların bu işleme ait olduğu doğrulanamıyor. Kayıtları tek tek inceleyin; hiçbir şey silinmedi.");
  const cur = await snapshot(db);
  const conflicts = undoConflicts(plan, cur);
  if (conflicts.length) throw Error("Bu kayıtlar sonradan değişmiş, geri alınamaz (" + conflicts.slice(0, 3).join(", ") + "). Tek tek düzeltin.");
  const links = undoLinks(plan, cur, await db.getAll("attachments"));
  if (links.length) throw Error("Geri alınamaz: eklenen kayıtlara sonradan başka kayıt bağlandı (" + links.slice(0, 3).join(", ") + "). Bağlı kaydı silmeden tek tek düzeltin.");
  const idb = await db.openDB();
  const stores = [...new Set([...Object.keys(plan.stores), ...ENTITY_STORES, "attachments", "meta", "audit_log"])];
  await new Promise((resolve, reject) => {
    const t = idb.transaction(stores, "readwrite");
    let error;
    // İki sekme aynı anda geri alırsa: plan işlem içinde yeniden okunur, yalnız biri uygular
    const pr = t.objectStore("meta").get("assistant_undo");
    const apply=()=>{
    for (const [s, x] of Object.entries(plan.stores)) {
      const os = t.objectStore(s);
      for (const r of x.added) {if(s==='pending_fuel_records')os.put({...r,reconciliation_status:'cancelled',updated_at:nowISO(),reconciliation:{...r.reconciliation,cancelled_at:nowISO()}});else os.delete(r.id);}
      for (const c of x.changed) os.put(c.before);
    }
    for (const id of plan.attAdded) t.objectStore("attachments").delete(id);
    for (const [k, m] of Object.entries(plan.meta)) t.objectStore("meta").put({ key: k, value: m.before });
    t.objectStore("meta").delete("assistant_undo");
    // A bulk undo never makes the original source eligible for silent re-import.
    for(const id of plan.bulk_sources||[]){
      const source=t.objectStore('meta').get('op:'+id);
      source.onsuccess=()=>{if(source.result)t.objectStore('meta').put({...source.result,value:{...source.result.value,state:'undone'}});};
    }
    if(plan.bulk_batch_id){const draft=t.objectStore('meta').get('assistant_bulk_v1');draft.onsuccess=()=>{if(draft.result?.value?.id===plan.bulk_batch_id)t.objectStore('meta').put({...draft.result,value:{...draft.result.value,status:'closed',rev:draft.result.value.rev+1}});};}
    t.objectStore("audit_log").put({ id: uuid(), entity: "assistant", entity_id: plan.at, action: "undo", old: null, new: null, reason: "Asistan kaydı geri alındı: " + (plan.label || ""), at: nowISO() });
    };
    pr.onsuccess = () => {
      if (!pr.result || !same(pr.result.value,plan)) { t.abort(); return; }
      // A new relation or edit between the preview and Undo must not be erased.
      // Bulk undo holds the same store locks while checking and removing records.
      const current={stores:{},meta:{}},all=ENTITY_STORES.filter(s=>s!=='audit_log');let pending=all.length+2,attachments=[];
      const checked=()=>{if(--pending)return;const changed=undoConflicts(plan,current),linked=undoLinks(plan,current,attachments);if(changed.length||linked.length){error=Error('Kayıt sonradan değişmiş veya başka kayda bağlanmış; geri alınamaz.');t.abort();return;}try{const before=[...(current.stores.fuel_tank_movements?.values()||[])],change=plan.stores.fuel_tank_movements;const after=before.filter(r=>!change?.added.some(x=>x.id===r.id)).map(r=>change?.changed.find(x=>x.after.id===r.id)?.before||r);assertTankChange(before,after);}catch(e){error=e;t.abort();return;}apply();};
      for(const s of all){const q=t.objectStore(s).getAll();q.onsuccess=()=>{current.stores[s]=new Map(q.result.map(r=>[r.id,r]));checked();};}
      const a=t.objectStore('attachments').getAll();a.onsuccess=()=>{attachments=a.result;checked();};
      const m=t.objectStore('meta').getAll();m.onsuccess=()=>{for(const row of m.result)if(UNDO_META.includes(row.key))current.meta[row.key]=row.value;checked();};
    };
    t.oncomplete = resolve;
    t.onerror = t.onabort = () => reject(error || t.error || Error("Geri alınamadı (başka ekranda zaten geri alınmış olabilir)"));
  });
  recordsCommitted(idb.name,[...Object.keys(plan.stores),'attachments','meta']);
  return plan;
}

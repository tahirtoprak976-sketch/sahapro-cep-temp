// Local outbox helpers. No network request or delivery acknowledgement is implied.
export function mergeEntries(latest, before, next) {
  const old = new Map(before.map(e => [e.id, JSON.stringify(e)]));
  const changed = new Map(next.filter(e => old.get(e.id) !== JSON.stringify(e)).map(e => [e.id, e]));
  const keep = new Set(next.map(e => e.id));
  const removed = new Set(before.filter(e => !keep.has(e.id)).map(e => e.id));
  const current = new Map(latest.map(e => [e.id, e]));
  for (const [id, value] of changed) {
    if (old.has(id) && !current.has(id)) changed.delete(id); // another tab deleted it
    else if (old.has(id) && JSON.stringify(current.get(id)) !== old.get(id) && JSON.stringify(current.get(id)) !== JSON.stringify(value)) throw new Error("Bu kayıt başka sekmede değişti. Sayfayı yenileyip yeniden deneyin");
  }
  for (const id of removed) if (current.has(id) && JSON.stringify(current.get(id)) !== old.get(id)) throw new Error("Kayıt başka sekmede değişti; silmeden önce sayfayı yenileyin");
  return [...latest.filter(e => !removed.has(e.id)).map(e => { const n = changed.get(e.id); changed.delete(e.id); return n || e; }), ...changed.values()];
}
export function validConfig(c) {
  return c?.v === 1 && Array.isArray(c.p) && c.p.length >= 2 &&
    c.p.every(x => typeof x === "string" && x.length > 0 && x.length <= 300) &&
    ["V", "C", "S", "D", "E", "Q"].every(k => c[k] == null || (Array.isArray(c[k]) && c[k].length <= 2000 && c[k].every(row => Array.isArray(row) && row.length >= 2 && typeof row[0] === "string" && typeof row[1] === "string"))) &&
    (!c.exp || validDate(c.exp));
}
export function validDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s + "T12:00:00Z")) && new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
}
export function validNumber(v, required = false) {
  if (v == null || v === "") return !required;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= (required ? Number.MIN_VALUE : 0) && n <= 1e12;
}
// The IDB write transaction serializes localStorage read/modify/write across tabs,
// including browsers without Web Locks. localStorage remains the existing data format.
let lockDB;
async function openLock() {
  if (!lockDB) lockDB = new Promise((resolve, reject) => {
    const req = indexedDB.open("sahapro-driver-lock", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("mutex");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return lockDB;
}
export async function commitEntries(key, before, next) {
  const db = await openLock();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("mutex", "readwrite"), store = tx.objectStore("mutex");
    let result, failure;
    const req = store.get(key);
    req.onsuccess = () => {
      try {
        const raw = localStorage.getItem(key), latest = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(latest)) throw new Error("Kayıt listesi okunamadı; verileri silmeden destek isteyin");
        result = mergeEntries(latest, before, next);
        localStorage.setItem(key, JSON.stringify(result));
        // No IDB write is needed: the readwrite transaction itself holds the lock.
      } catch (e) { failure = e; tx.abort(); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = tx.onerror = () => reject(failure || tx.error || new Error("Kayıt saklanamadı"));
  });
}

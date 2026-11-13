// Separate from business backups. CryptoKey is non-extractable and survives browser reloads only here.
import { createRecipient } from "./secure-transfer.js";
import { openDB } from "./db.js";
async function storage() {
  const business = await openDB();
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(business.name + "_secure_transfer", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("keys");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(Error("Diğer SAHAPRO sekmelerini kapatıp tekrar deneyin."));
  });
}
async function access(write, operation) {
  const db = await storage();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction("keys", write ? "readwrite" : "readonly");
      let result;
      const r = operation(t.objectStore("keys"));
      if (r) r.onsuccess = () => { result = r.result; };
      t.oncomplete = () => resolve(result);
      t.onabort = t.onerror = (e) => reject(t.error || e?.target?.error || Error("Telefon eşleştirmesi kaydedilemedi."));
    });
  } finally { db.close(); }
}
export const getRecipient = () => access(false, (s) => s.get("recipient"));
export async function ensureRecipient() {
  const old = await getRecipient();
  if (old) return old;
  const candidate = await createRecipient();
  // Concurrent tabs must converge on the same key, never silently replace one another.
  const db = await storage();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction("keys", "readwrite"), s = t.objectStore("keys");
      let result;
      s.get("recipient").onsuccess = (e) => {
        result = e.target.result || candidate;
        if (!e.target.result) s.put(result, "recipient");
      };
      t.oncomplete = () => resolve(result);
      t.onabort = t.onerror = (e) => reject(t.error || e?.target?.error || Error("Eşleştirme kaydedilemedi."));
    });
  } finally { db.close(); }
}
export const forgetRecipient = () => access(true, (s) => s.delete("recipient"));

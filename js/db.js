// SAHAPRO CEP — IndexedDB katmanı (local-first, offline-first)
// Backend YOK · Supabase YOK · ana SAHAPRO API YOK.

import { ENTITY_STORES, SYSTEM_STORES, newRecord, touchRecord, isActive, nowISO, uuid, SEED_VEHICLES, SEED_PERSONNEL, VEHICLE_OWNERSHIP } from './core.js';

const DB_NAME = 'sahapro_cep_db';
const DB_VERSION = 1;
let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      for (const s of ENTITY_STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('attachments')) db.createObjectStore('attachments', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'form' });
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(db, store, mode) { return db.transaction(store, mode).objectStore(store); }
function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function put(store, rec) {
  const db = await openDB();
  return wrap(tx(db, store, 'readwrite').put(rec));
}
export async function get(store, id) {
  const db = await openDB();
  return wrap(tx(db, store, 'readonly').get(id));
}
export async function getAll(store) {
  const db = await openDB();
  const rows = await wrap(tx(db, store, 'readonly').getAll());
  return rows || [];
}
export async function listActive(store) {
  return (await getAll(store)).filter(isActive);
}
export async function softDelete(store, id) {
  const rec = await get(store, id);
  if (!rec) return null;
  const upd = { ...rec, deleted_at: nowISO(), updated_at: nowISO() };
  await put(store, upd);
  return upd;
}
export async function restore(store, id) {
  const rec = await get(store, id);
  if (!rec) return null;
  const upd = { ...rec, deleted_at: null, updated_at: nowISO() };
  await put(store, upd);
  return upd;
}

// ---- meta (key/value): device_install_id, last_backup_at, pin_hash ... ----
export async function metaGet(key) {
  const db = await openDB();
  const row = await wrap(tx(db, 'meta', 'readonly').get(key));
  return row ? row.value : null;
}
export async function metaSet(key, value) {
  const db = await openDB();
  return wrap(tx(db, 'meta', 'readwrite').put({ key, value }));
}

// ---- taslak autosave (§25) ----
export async function draftSave(form, values) {
  const db = await openDB();
  return wrap(tx(db, 'drafts', 'readwrite').put({ form, values, saved_at: nowISO() }));
}
export async function draftGet(form) {
  const db = await openDB();
  const row = await wrap(tx(db, 'drafts', 'readonly').get(form));
  return row ? row.values : null;
}
export async function draftClear(form) {
  const db = await openDB();
  return wrap(tx(db, 'drafts', 'readwrite').delete(form));
}

// ---- attachments (fotoğraflar ayrı store'da Blob olarak; JSON'a GÖMÜLMEZ §39) ----
export async function addAttachment(recordType, recordId, file) {
  const rec = {
    id: uuid(),
    record_type: recordType,
    record_id: recordId,
    name: file.name || 'foto',
    type: file.type || 'image/jpeg',
    size: file.size || 0,
    blob: file,
    created_at: nowISO()
  };
  await put('attachments', rec);
  return rec;
}
export async function attachmentsFor(recordType, recordId) {
  const all = await getAll('attachments');
  return all.filter(a => a.record_type === recordType && a.record_id === recordId);
}
export async function attachmentsCountMap() {
  const all = await getAll('attachments');
  const m = {};
  for (const a of all) m[a.record_id] = (m[a.record_id] || 0) + 1;
  return m;
}

// ---- ilk açılış: device_install_id + seed araç/personel ----
export async function ensureSeeded() {
  let installId = await metaGet('device_install_id');
  if (!installId) {
    installId = uuid();
    await metaSet('device_install_id', installId);
  }
  const seeded = await metaGet('seeded_v1');
  if (!seeded) {
    for (const name of SEED_VEHICLES) {
      await put('vehicles', newRecord({ name, type: 'Araç/Makine', ownership: VEHICLE_OWNERSHIP[0], active: true }));
    }
    for (const name of SEED_PERSONNEL) {
      await put('personnel', newRecord({ name, role: '', active: true }));
    }
    await metaSet('seeded_v1', true);
  }
  return installId;
}

// ---- tüm entity verisi (backup için) ----
export async function dumpAll() {
  const out = {};
  for (const s of ENTITY_STORES) out[s] = await getAll(s);
  return out;
}

// ---- kayıt güncelleme yardımcıları ----
export async function saveNew(store, fields) {
  const rec = newRecord(fields);
  await put(store, rec);
  return rec;
}
export async function saveExisting(store, rec, fields) {
  const upd = { ...touchRecord(rec), ...fields, id: rec.id, created_at: rec.created_at, source: rec.source, schema_version: rec.schema_version, migration_status: rec.migration_status, deleted_at: rec.deleted_at };
  await put(store, upd);
  return upd;
}

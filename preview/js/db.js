// SAHAPRO SOLO — IndexedDB katmanı (local-first, offline-first)
// Backend YOK · Supabase YOK · ana SAHAPRO API YOK.
// v1 (sahapro_cep_db @ version 1) → v2 (version 2) VERSIONED MIGRATION — kayıtlar korunur.

import {
  ENTITY_STORES, newRecord, touchRecord, isActive, nowISO, uuid,
  SEED_VEHICLES, SEED_PERSONNEL, SEED_ALIASES, VEHICLE_OWNERSHIP, SCHEMA_VERSION
} from './core.js';

const DB_NAME = 'sahapro_cep_db'; // v1 ile AYNI isim — veri bu DB'de
const DB_VERSION = 2;
let _db = null;

// Test harness için: ?db=<isim> ile ayrı DB açılabilir (migration simülasyonu)
function dbName() {
  try {
    const p = new URLSearchParams(location.search).get('db');
    if (p && /^[a-z0-9_-]{1,32}$/i.test(p)) return 'sahapro_cep_db_' + p;
  } catch (e) { /* noop */ }
  return DB_NAME;
}

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName(), DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      // v1 store'ları eksikse oluştur (v1→v2 upgrade'de zaten var; taze kurulumda hepsi kurulur)
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
function wrap(req) { return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }

export async function put(store, rec) { const db = await openDB(); return wrap(tx(db, store, 'readwrite').put(rec)); }
export async function get(store, id) { const db = await openDB(); return wrap(tx(db, store, 'readonly').get(id)); }
export async function getAll(store) { const db = await openDB(); return (await wrap(tx(db, store, 'readonly').getAll())) || []; }
export async function listActive(store) { return (await getAll(store)).filter(isActive); }
export async function softDelete(store, id, reason) {
  const rec = await get(store, id);
  if (!rec) return null;
  const upd = { ...rec, deleted_at: nowISO(), updated_at: nowISO() };
  await put(store, upd);
  await audit(store, id, 'soft_delete', { deleted_at: rec.deleted_at }, { deleted_at: upd.deleted_at }, reason || '');
  return upd;
}
export async function restore(store, id) {
  const rec = await get(store, id);
  if (!rec) return null;
  const upd = { ...rec, deleted_at: null, updated_at: nowISO() };
  await put(store, upd);
  await audit(store, id, 'restore', { deleted_at: rec.deleted_at }, { deleted_at: null }, '');
  return upd;
}

// ---- meta ----
export async function metaGet(key) {
  const db = await openDB();
  const row = await wrap(tx(db, 'meta', 'readonly').get(key));
  return row ? row.value : null;
}
export async function metaSet(key, value) { const db = await openDB(); return wrap(tx(db, 'meta', 'readwrite').put({ key, value })); }

// Sayaç (fiş/teklif/hakediş seri no) — tek transaction'da atomik artış
export async function nextSeq(name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('meta', 'readwrite');
    const st = t.objectStore('meta');
    const g = st.get('seq_' + name);
    g.onsuccess = () => {
      const cur = (g.result && g.result.value) || 0;
      const nx = cur + 1;
      st.put({ key: 'seq_' + name, value: nx });
      t.oncomplete = () => resolve(nx);
    };
    g.onerror = () => reject(g.error);
    t.onerror = () => reject(t.error);
  });
}

// ---- audit (§48): old/new/reason/timestamp ----
export async function audit(entity, entityId, action, oldV, newV, reason) {
  const db = await openDB();
  const rec = { id: uuid(), entity, entity_id: entityId, action, old: oldV ?? null, new: newV ?? null, reason: reason || '', at: nowISO() };
  return wrap(tx(db, 'audit_log', 'readwrite').put(rec));
}

// ---- taslak autosave ----
export async function draftSave(form, values) { const db = await openDB(); return wrap(tx(db, 'drafts', 'readwrite').put({ form, values, saved_at: nowISO() })); }
export async function draftGet(form) { const db = await openDB(); const row = await wrap(tx(db, 'drafts', 'readonly').get(form)); return row ? row.values : null; }
export async function draftClear(form) { const db = await openDB(); return wrap(tx(db, 'drafts', 'readwrite').delete(form)); }

// ---- attachments (Blob ayrı store; JSON'a GÖMÜLMEZ; orijinal immutable, türev derived_of) ----
export async function addAttachment(recordType, recordId, file, extra = {}) {
  const rec = {
    id: uuid(),
    record_type: recordType,
    record_id: recordId,
    name: file.name || 'foto',
    type: file.type || 'image/jpeg',
    size: file.size || 0,
    blob: file,
    derived_of: extra.derived_of || null,
    kind: extra.kind || 'photo',
    created_at: nowISO()
  };
  await put('attachments', rec);
  return rec;
}
export async function attachmentsFor(recordType, recordId) {
  return (await getAll('attachments')).filter(a => a.record_type === recordType && a.record_id === recordId);
}
export async function attachmentsCountMap() {
  const m = {};
  for (const a of await getAll('attachments')) m[a.record_id] = (m[a.record_id] || 0) + 1;
  return m;
}

// ---- v1→v2 kayıt seviyesi migration + ilk kurulum seed ----
export async function ensureSeeded() {
  let installId = await metaGet('device_install_id');
  if (!installId) { installId = uuid(); await metaSet('device_install_id', installId); }

  // v1 seed (taze kurulum)
  if (!(await metaGet('seeded_v1'))) {
    for (const name of SEED_VEHICLES) await put('vehicles', newRecord({ name, type: 'Araç/Makine', ownership: VEHICLE_OWNERSHIP[0], active: true }));
    for (const name of SEED_PERSONNEL) await put('personnel', newRecord({ name, role: '', active: true }));
    await metaSet('seeded_v1', true);
  }

  // v2 migration: v1 kayıtlarına eksik alanlar (kayıp alan YOK; yalnız ek alanlar, ids Dokunulmaz)
  if (!(await metaGet('migrated_v2'))) {
    for (const store of ENTITY_STORES) {
      for (const r of await getAll(store)) {
        let ch = false;
        const upd = { ...r };
        if (upd.schema_version == null) { upd.schema_version = 1; ch = true; }
        if (upd.migration_status == null) { upd.migration_status = 'NOT_IMPORTED'; ch = true; }
        if (upd.deleted_at === undefined) { upd.deleted_at = null; ch = true; }
        if (store === 'work_records' && upd.slip_id === undefined) { upd.slip_id = null; ch = true; }
        if (store === 'documents' && upd.ocr === undefined) { upd.ocr = { status: 'YOK' }; ch = true; }
        if (ch) await put(store, upd);
      }
    }
    // v2 varsayılan ayarlar (fiyatlar/KDV ayarlardan okunur — koda gömülü değil)
    if ((await metaGet('kdv_default')) == null) await metaSet('kdv_default', 20);
    if ((await metaGet('crane_first_hour')) == null) await metaSet('crane_first_hour', 9000);
    if ((await metaGet('crane_next_hour')) == null) await metaSet('crane_next_hour', 3000);

    // Alias seed (sahapro-domain kuralları)
    if (!(await metaGet('seeded_aliases_v2'))) {
      const vehs = await listActive('vehicles');
      const byName = {};
      for (const v of vehs) byName[v.name] = v.id;
      for (const [alias, targetName] of SEED_ALIASES) {
        if (byName[targetName]) await put('aliases', newRecord({ alias, target_type: 'vehicle', target_id: byName[targetName], active: true }));
      }
      await metaSet('seeded_aliases_v2', true);
    }

    // Başlangıç fiyat listesi (hakedis-engine örnekleri; kullanıcı düzenleyebilir)
    if (!(await metaGet('seeded_pricebook_v2'))) {
      const vehs = await listActive('vehicles');
      const vid = (n) => { const v = vehs.find(x => x.name === n); return v ? v.id : null; };
      const seeds = [
        { work_type: 'Hafriyat Nakliye', unit: 'Sefer', price: 10000 },
        { work_type: 'Moloz Nakliye', unit: 'Sefer', price: 12500 },
        { vehicle_id: vid('DX225 / Yeni Makine'), unit: 'Saat', price: 4000 },
        { vehicle_id: vid('DX225 / Yeni Makine'), unit: 'Yevmiye', price: 25000 },
        { vehicle_id: vid('14 Tonluk Kato'), unit: 'Yevmiye', price: 20000 },
        { vehicle_id: vid('Mobil Vinç'), unit: 'Saat', formula: 'CRANE_FIRST_HOUR' }
      ];
      for (const s of seeds) {
        await put('price_book', newRecord({ ...s, kdv_rate: 20, kdv_included: false, valid_from: null, valid_to: null, customer_id: null, site_id: null, active: true }));
      }
      await metaSet('seeded_pricebook_v2', true);
    }
    await metaSet('migrated_v2', true);
    await metaSet('schema_version_current', SCHEMA_VERSION);
  }
  return installId;
}

// ---- backup için tüm entity verisi ----
export async function dumpAll() {
  const out = {};
  for (const s of ENTITY_STORES) out[s] = await getAll(s);
  return out;
}

// ---- kayıt yardımcıları ----
export async function saveNew(store, fields, auditReason) {
  const rec = newRecord(fields);
  await put(store, rec);
  await audit(store, rec.id, 'create', null, fields, auditReason || '');
  return rec;
}
export async function saveExisting(store, rec, fields, auditReason) {
  const upd = { ...touchRecord(rec), ...fields, id: rec.id, created_at: rec.created_at, source: rec.source, schema_version: rec.schema_version, migration_status: rec.migration_status, deleted_at: rec.deleted_at };
  await put(store, upd);
  await audit(store, rec.id, 'update', rec, fields, auditReason || '');
  return upd;
}

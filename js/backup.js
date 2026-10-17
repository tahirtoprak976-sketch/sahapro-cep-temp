import { validateSmartData } from "./message-smart-core.js";
import { validateSoloData, SOLO_STORES } from "./solo-core.js";
import {
  ENTERPRISE_STORES,
  validateEnterpriseData,
} from "./enterprise-core.js";
import {
  ENTITY_STORES,
  SCHEMA_VERSION,
  APP_ID,
  APP_VERSION,
  mergePreview,
  isValidBackup,
} from "./core.js";
const SECRET_META = ["gemini_key", "backup_pw", "sec_lock", "sec_fail", "pin_hash"];
// Şoför bağlantılarının imza anahtarları ve çıkış kodları: yalnız ŞİFRELİ yedeğe yazılır. Şifresiz yedeği ele geçiren
// imzalı şoför mesajı üretemesin. (Telefon içi kurtarma kopyaları şifreli sayılır; telefondan çıkmaz.)
const LINK_META = ["driver_links"];
// Yedek dosyasını oku: eski .json, sıkıştırılmış ya da şifreli .sahapro (şifre sorulur)
export async function readBackupFile(file) {
  const { decodeBackup, MAX_BACKUP_FILE } = await import("./backup-crypt.js");
  if (file.size > MAX_BACKUP_FILE) throw Error("Yedek dosyası çok büyük (sınır " + Math.round(MAX_BACKUP_FILE / 1048576) + " MB)");
  const { promptDialog } = await import("./ui.js");
  return decodeBackup(new Uint8Array(await file.arrayBuffer()), () => promptDialog("Şifreli yedek", "Yedek şifresi", "", { type: "password" }));
}
async function toB64(blob) {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 8192) binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
  return btoa(binary);
}
// attachments: "base64" (dosyaya yazılan yedek) | "blob" (telefon içi kurtarma kopyası: kopya yok, bellek az) | "none"
export async function fullBackup(db, { encrypted = true, attachments: mode = "base64" } = {}) {
  const data = await db.dumpAll(),
    attachments = [];
  if (mode !== "none")
    for (const a of await db.getAll("attachments"))
      attachments.push(mode === "blob" ? { ...a } : { ...a, blob: undefined, base64: await toB64(a.blob) });
  return {
    app: APP_ID,
    app_version: APP_VERSION,
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    device_install_id: await db.metaGet("device_install_id"),
    data,
    attachments,
    // API anahtarı gibi gizli ayarlar yedek dosyasına yazılmaz (yedek WhatsApp/Drive ile paylaşılabilir)
    meta: (await db.getAll("meta")).filter((m) => !SECRET_META.includes(m.key) && (encrypted || !LINK_META.includes(m.key))),
    ...(encrypted ? {} : { driver_links_omitted: true }),
  };
}
// ---- Parçalı yedek (telefon belleği) ----
// Bir parçanın açılmış (JSON) boyutu bu bütçeyi aşmaz. Ölçüm (masaüstü Chromium, v3.9.04): geri yüklemede bellek
// tepe artışı ≈ 2–2,5 × açılmış boyut. 120 MB parça → ~300 MB ek bellek: 3–4 GB RAM'li Android'de güvenli kabul edildi
// (fiziksel telefonda ölçülmedi). Fotoğraflar parçalara bölünür; her parça tek başına okunabilir (okuma sınırının altında).
export const PART_JSON_BUDGET = 120 * 1024 * 1024;
const b64Len = (n) => Math.ceil(n / 3) * 4;
export async function backupParts(db, { encrypted = true, budget = PART_JSON_BUDGET } = {}) {
  const head = await fullBackup(db, { encrypted, attachments: "none" });
  const headLen = JSON.stringify(head).length;
  if (headLen > budget) throw Error(`Kayıt verisi tek parçaya sığmıyor (${Math.round(headLen / 1048576)} MB). Lütfen bildirin.`);
  const atts = (await db.getAll("attachments")).map(({ blob, ...m }) => ({ m, blob, est: b64Len(blob?.size || 0) + JSON.stringify(m).length + 32 }));
  const groups = [[]];
  let size = headLen;
  for (const a of atts) {
    if (a.est > budget - Math.min(1024 * 1024, budget / 10)) throw Error(`Tek dosya yedek parçasına sığmıyor: ${a.m.name || a.m.id}`);
    if (size + a.est > budget && groups.at(-1).length) { groups.push([]); size = 2048; }
    groups.at(-1).push(a);
    size += a.est;
  }
  const set = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const n = groups.length;
  // Parçalar sırayla üretilir (aynı anda yalnız bir parçanın JSON'u bellekte)
  return {
    count: n,
    async *[Symbol.asyncIterator]() {
      for (let i = 0; i < n; i++) {
        const attachments = [];
        for (const a of groups[i]) attachments.push({ ...a.m, base64: await toB64(a.blob) });
        yield { ...(i === 0 ? head : { app: head.app, app_version: head.app_version, schema_version: head.schema_version, exported_at: head.exported_at, device_install_id: head.device_install_id, data: {}, meta: [] }),
          attachments, ...(n > 1 ? { part: { set, no: i + 1, of: n } } : {}) };
        groups[i] = null;
      }
    },
  };
}
export async function previewBackup(db, obj) {
  if (!isValidBackup(obj) || obj.schema_version > SCHEMA_VERSION)
    throw Error("Desteklenmeyen yedek / şema");
  const local = await db.dumpAll(),
    stores = {};
  let added = 0,
    same = 0,
    conflicts = 0;
  for (const s of ENTITY_STORES) {
    if (obj.data[s] && !Array.isArray(obj.data[s]))
      throw Error("Yedek kayıtları geçersiz");
    const rows = obj.data[s] || [];
    const ids = new Set();
    for (const r of rows) {
      if (!r || typeof r.id !== "string" || ids.has(r.id))
        throw Error("Yedekte geçersiz veya mükerrer ID");
      ids.add(r.id);
    }
    const p = mergePreview(local[s], rows);
    stores[s] = p;
    added += p.new.length;
    same += p.existing.length;
    conflicts += p.conflict.length;
  }
  return {
    stores,
    added,
    same,
    conflicts,
    attachments: (obj.attachments || []).length,
  };
}
const USER_STORES = ["work_records", "fuel_records", "expense_records", "cash_records", "documents", "customers", "sites", "maintenance_records", "personnel_events", "fuel_tank_movements", "payables", "hakedis", "slips", "quotes"];
const keyName = (x) => String(x?.name || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
export function freshDeviceDrops(local, obj) {
  const live = (rows) => (rows || []).filter((r) => r && !r.deleted_at);
  if (USER_STORES.some((s) => live(local[s]).length)) return {};
  const inBackup = (s) => new Set((obj.data?.[s] || []).map((r) => r.id));
  const out = {}, dropped = new Set();
  for (const s of ["vehicles", "personnel", "dump_sites", "quarries"]) {
    const ids = inBackup(s), names = new Set((obj.data?.[s] || []).filter((r) => !r.deleted_at).map(keyName));
    const ds = (local[s] || []).filter((r) => !ids.has(r.id) && names.has(keyName(r))).map((r) => r.id);
    if (ds.length) { out[s] = ds; ds.forEach((id) => dropped.add(id)); }
  }
  const al = inBackup("aliases"), alk = new Set((obj.data?.aliases || []).map((a) => String(a.alias || "").toLocaleLowerCase("tr-TR") + "|" + a.target_type));
  const da = (local.aliases || []).filter((a) => !al.has(a.id) && (dropped.has(a.target_id) || alk.has(String(a.alias || "").toLocaleLowerCase("tr-TR") + "|" + a.target_type))).map((a) => a.id);
  if (da.length) out.aliases = da;
  const pb = inBackup("price_book");
  const vName = (rows) => new Map((rows || []).map((v) => [v.id, keyName(v)]));
  const lv = vName(local.vehicles), bv = vName(obj.data?.vehicles);
  const pk = (r, vm) => [r.work_type || "", r.unit || "", r.vehicle_id ? vm.get(r.vehicle_id) || "?" : "", r.customer_id || "", r.site_id || ""].join("|");
  const bk = new Set((obj.data?.price_book || []).filter((r) => !r.deleted_at).map((r) => pk(r, bv)));
  const dp = (local.price_book || []).filter((r) => !pb.has(r.id) && (dropped.has(r.vehicle_id) || bk.has(pk(r, lv)))).map((r) => r.id);
  if (dp.length) out.price_book = dp;
  return out;
}

export async function restoreBackup(db, obj, replace = false) {
  const preview = await previewBackup(db, obj);
  // Telefon içi kurtarma kopyası: ekler Blob olarak (base64 kopyası yok — bellek iki katına çıkmaz)
  await saveRecovery(db, await fullBackup(db, { attachments: "blob" }));
  try { validateRestoreLinks(await db.dumpAll(), obj, preview, replace); }
  catch (e) { if (obj.part?.no > 1 && /bağlı olmayan dosya eki/.test(e.message)) throw Error(`Bu, yedeğin ${obj.part.no}. parçası (toplam ${obj.part.of}). Önce 1. parçayı yükleyin.`); throw e; }
  const decoded = [];
  for (const a of obj.attachments || []) {
    if (!a.id || !a.record_id || typeof a.base64 !== "string")
      throw Error("Ek geçersiz");
    const bin = atob(a.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const { base64, ...fields } = a;
    decoded.push({ ...fields, blob: new Blob([bytes], { type: a.type }) });
    a.base64 = null; // çözülen metin hemen bırakılır (tepe bellek düşer)
  }
  // Yeni telefon (henüz işletme kaydı yok): ilk açılışta oluşturulan başlangıç kartları, yedekteki aynı adlı kartların
  // yerine geçer. Yoksa araç / personel / döküm sahası / eşleştirme / fiyat ikişer olur.
  const drop = freshDeviceDrops(await db.dumpAll(), obj);
  const connection = await db.openDB(),
    stores = [...ENTITY_STORES, "attachments", "meta"];
  return new Promise((resolve, reject) => {
    const t = connection.transaction(stores, "readwrite");
    let error;
    for (const [s, ids] of Object.entries(drop)) for (const id of ids) t.objectStore(s).delete(id);
    for (const s of ENTITY_STORES) {
      const rows = [
        ...preview.stores[s].new,
        ...(replace ? preview.stores[s].conflict : []),
      ];
      for (const r of rows) {
        const get = t.objectStore(s).get(r.id);
        get.onsuccess = () => {
          const existing = get.result;
          if (
            existing &&
            (ENTERPRISE_STORES.includes(s) ||
              SOLO_STORES.includes(s) ||
              (s === "contracts" && existing.status === "İmzalandı") ||
              (s === "hakedis" && existing.status === "Kesinleşti") ||
              (s === "slips" && existing.status === "İmzalandı"))
          ) {
            error = Error("İmzalı/kesinleşmiş kayıt yedekle değiştirilemez");
            t.abort();
            return;
          }
          t.objectStore(s).put(r);
        };
      }
    }
    for (const a of decoded) {
      const q = t.objectStore("attachments").get(a.id);
      q.onsuccess = () => {
        if (!q.result) t.objectStore("attachments").put(a);
      };
    }
    for (const m of obj.meta || []) {
      if (m.key.startsWith("seq_")) {
        const q = t.objectStore("meta").get(m.key);
        q.onsuccess = () =>
          t.objectStore("meta").put({
            ...m,
            value: Math.max(Number(q.result?.value) || 0, Number(m.value) || 0),
          });
      } else if (
        !["device_install_id", "pin_hash", "last_backup_at", "sec_lock", "sec_fail"].includes(m.key)
      ) {
        const q = t.objectStore("meta").get(m.key);
        q.onsuccess = () => {
          if (!q.result) t.objectStore("meta").put(m);
        };
      }
    }
    // Legacy backups lack counters; derive counters from actual documents.
    for (const [s, key, seq] of [
      ["slips", "slip_no", "slip"],
      ["quotes", "quote_no", "quote"],
      ["hakedis", "hakedis_no", "hakedis"],
      ["contracts", "contract_no", "contract"],
    ]) {
      const max = Math.max(
        0,
        ...(obj.data[s] || []).map((r) => Number(r[key]) || 0),
      );
      const q = t.objectStore("meta").get("seq_" + seq);
      q.onsuccess = () =>
        t.objectStore("meta").put({
          key: "seq_" + seq,
          value: Math.max(max, Number(q.result?.value) || 0),
        });
    }
    t.oncomplete = () => resolve(preview);
    t.onabort = t.onerror = () =>
      reject(error || t.error || Error("Geri yükleme iptal edildi"));
  });
}
export async function backupBeforeSoloOperation(
  db,
  prefix = "before-solo-operation",
) {
  await saveRecovery(db, await fullBackup(db, { attachments: "blob" }), prefix);
}
export async function backupBeforeHistoryImport(db) {
  const snapshot = await fullBackup(db, { attachments: "blob" });
  await saveRecovery(db, snapshot, "before-history-import");
}
async function saveRecovery(db, obj, prefix = "before-restore") {
  const name = (await db.openDB()).name + "_recovery";
  const connection = await new Promise((res, rej) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("snapshots", { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  try {
    await new Promise((res, rej) => {
      const t = connection.transaction("snapshots", "readwrite");
      t.objectStore("snapshots").put({
        id: prefix + "-" + Date.now(),
        full: obj,
      });
      t.oncomplete = res;
      t.onabort = t.onerror = () =>
        rej(t.error || Error("Kurtarma yedeği kaydedilemedi"));
    });
  } finally {
    connection.close();
  }
}

export function validateRestoreLinks(local, obj, preview, replace = false) {
  const merged = {};
  for (const store of ENTITY_STORES) {
    const rows = [
      ...(local[store] || []),
      ...preview.stores[store].new,
      ...(replace ? preview.stores[store].conflict : []),
    ];
    merged[store] = new Map(rows.map((r) => [r.id, r]));
  }
  const ownStores = {
    vehicle: "vehicles",
    personnel: "personnel",
    customer: "customers",
    fuel: "fuel_records",
    expense: "expense_records",
    hakedis: "hakedis",
    work: "work_records",
    contract: "contracts",
  };
  for (const doc of preview.stores.documents.new) {
    if (
      doc.owner_type &&
      (!ownStores[doc.owner_type] ||
        !merged[ownStores[doc.owner_type]].has(doc.owner_id))
    )
      throw Error("Yedekte sahipsiz belge: " + (doc.doc_no || "Belge"));
  }
  for (const fuel of preview.stores.fuel_records.new)
    if (fuel.tank_movement_id) {
      const move = merged.fuel_tank_movements.get(fuel.tank_movement_id);
      if (
        !move ||
        move.fuel_record_id !== fuel.id ||
        move.event_id !== fuel.event_id
      )
        throw Error("Yedekte kopuk yakıt / tank olayı");
    }
  for (const move of preview.stores.fuel_tank_movements.new)
    if (move.fuel_record_id) {
      const fuel = merged.fuel_records.get(move.fuel_record_id);
      if (
        !fuel ||
        fuel.tank_movement_id !== move.id ||
        fuel.event_id !== move.event_id
      )
        throw Error("Yedekte kopuk tank / yakıt olayı");
    }
  validateEnterpriseData(
    Object.fromEntries(
      Object.entries(merged).map(([s, m]) => [s, [...m.values()]]),
    ),
  );
  validateSoloData(
    Object.fromEntries(
      Object.entries(merged).map(([s, m]) => [s, [...m.values()]]),
    ),
  );
  validateSmartData(
    Object.fromEntries(
      Object.entries(merged).map(([s, m]) => [s, [...m.values()]]),
    ),
  );
  const attachments = new Set();
  for (const a of obj.attachments || []) {
    if (attachments.has(a.id)) throw Error("Yedekte mükerrer ek");
    attachments.add(a.id);
    const type =
      {
        document: "documents",
        maintenance: "maintenance_records",
        expense: "expense_records",
        slip_signature: "slips",
        contract_signature: "contracts",
        leave_signature: "documents",
        tank: "fuel_tank_movements",
        payable: "payables",
        work: "work_records",
        fuel: "fuel_records",
      }[a.record_type] || a.record_type;
    if (!merged[type]?.has(a.record_id))
      throw Error("Yedekte kaydına bağlı olmayan dosya eki");
  }
}

import {validateDumpData} from "./dump-ledger-core.js";
import { startActivity } from "./update-safety.js";
import {validateCustomerFuelLinks} from './customer-fuel.js';
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
async function capture(db, files) {
  if (typeof db.readSnapshot === "function") return { ...(await db.readSnapshot({ attachments: files, meta: true, drafts: true })), consistent: true };
  // Compatibility with external adapters/test doubles. The real app always uses readSnapshot.
  return { data: await db.dumpAll(), attachments: files ? await db.getAll("attachments") : [], meta: await db.getAll("meta"), drafts: [], captured_at: new Date().toISOString(), consistent: false };
}
async function backupFromSnapshot(snapshot, encrypted, mode) {
  const attachments = [];
  if (mode !== "none") for (const a of snapshot.attachments)
    attachments.push(mode === "blob" ? { ...a } : { ...a, blob: undefined, base64: await toB64(a.blob) });
  return {
    app: APP_ID, app_version: APP_VERSION, schema_version: SCHEMA_VERSION,
    exported_at: snapshot.captured_at,
    device_install_id: snapshot.meta.find(m => m.key === "device_install_id")?.value || null,
    data: snapshot.data, attachments,
    meta: snapshot.meta.filter(m => !SECRET_META.includes(m.key) && !m.key.startsWith(RESTORE_SET) && (encrypted || !LINK_META.includes(m.key))),
    coverage: { consistent_snapshot: snapshot.consistent, attachments_included: mode !== "none", draft_files_included: false, driver_phone_queue_included: false,
      parts_draft_files_not_included: snapshot.drafts.filter(d => ["spare-part-new:","spare-part-edit:","part-document:"].some(prefix=>String(d.form).startsWith(prefix))).reduce((n,d)=>n+(d.values?.files?.length||0),0),
      pdf_draft_files_not_included: snapshot.drafts.filter(d => String(d.form).startsWith("pdf_history_file:") && d.blob).length },
    ...(encrypted ? {} : { driver_links_omitted: true }),
  };
}
export async function fullBackup(db, { encrypted = true, attachments: mode = "base64" } = {}) {
  return backupFromSnapshot(await capture(db, mode !== "none"), encrypted, mode);
}
// ---- Parçalı yedek (telefon belleği) ----
// Bir parçanın açılmış (JSON) boyutu bu bütçeyi aşmaz. Ölçüm (masaüstü Chromium, v3.9.04): geri yüklemede bellek
// tepe artışı ≈ 2–2,5 × açılmış boyut. 120 MB parça → ~300 MB ek bellek: 3–4 GB RAM'li Android'de güvenli kabul edildi
// (fiziksel telefonda ölçülmedi). Fotoğraflar parçalara bölünür; her parça tek başına okunabilir (okuma sınırının altında).
export const PART_JSON_BUDGET = 120 * 1024 * 1024;
const b64Len = (n) => Math.ceil(n / 3) * 4;
export async function backupParts(db, { encrypted = true, budget = PART_JSON_BUDGET } = {}) {
  if(!Number.isSafeInteger(budget)||budget<1024||budget>PART_JSON_BUDGET)throw Error('Yedek parça bütçesi geçersiz');
  const snapshot = await capture(db, true);
  const head = await backupFromSnapshot(snapshot, encrypted, "none");
  head.coverage.attachments_included = true;
  const atts = snapshot.attachments.map(({ blob, ...m }) => ({ m, blob, est: b64Len(blob?.size || 0) + JSON.stringify({...m,base64:''}).length }));
  const set = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const records = Object.values(head.data || {}).reduce((k, rows) => k + (Array.isArray(rows) ? rows.length : 0), 0);
  const totals = { records, attachments: atts.length, attachment_bytes: atts.reduce((k, a) => k + (a.blob?.size || 0), 0) };
  const tail = { app:head.app,app_version:head.app_version,schema_version:head.schema_version,exported_at:head.exported_at,device_install_id:head.device_install_id,coverage:head.coverage,data:{},meta:[],attachments:[] };
  // Manifest ve TÜM ek dizini de bütçenin içindedir. En büyük olası sıra/sayıları
  // kullan: gerçek parça başlığı bu üst sınırdan büyük olamaz.
  const maxParts=atts.length+1;
  const manifest={set,no:maxParts,of:maxParts,created_at:head.exported_at,limit_basis:"açılmış JSON (karakter)",budget,totals,part_attachments:atts.length,part_attachment_bytes:totals.attachment_bytes};
  const maxIndex=atts.map(a=>[a.m.id,a.m.record_type,a.m.record_id,maxParts]);
  const firstBase=JSON.stringify({...head,part:{...manifest,index:maxIndex}}).length;
  const tailBase=JSON.stringify({...tail,part:manifest}).length;
  if(firstBase>budget)throw Error('Kayıt verisi ve ek dizini tek parçaya sığmıyor; daha büyük parça bütçesi gerekli.');
  const groups=[[]];let size=firstBase;
  for(const a of atts){
    if(tailBase+a.est>budget)throw Error(`Tek dosya yedek parçasına sığmıyor: ${a.m.name||a.m.id}`);
    const comma=groups.at(-1).length?1:0;
    if(size+a.est+comma>budget){groups.push([]);size=tailBase;}
    size+=a.est+(groups.at(-1).length?1:0);groups.at(-1).push(a);
  }
  const n=groups.length;
  const index=groups.flatMap((g,i)=>g.map(a=>[a.m.id,a.m.record_type,a.m.record_id,i+1]));
  return {
    count: n, set, captured_at: head.exported_at,
    async *[Symbol.asyncIterator]() {
      for (let i = 0; i < n; i++) {
        const attachments = [];
        for (const a of groups[i]) attachments.push({ ...a.m, base64: await toB64(a.blob) });
        const part = { ...(i === 0 ? head : { app: head.app, app_version: head.app_version, schema_version: head.schema_version, exported_at: head.exported_at, device_install_id: head.device_install_id, coverage: head.coverage, data: {}, meta: [] }),
          attachments,
          part: { set, no: i + 1, of: n, created_at: head.exported_at, limit_basis: "açılmış JSON (karakter)", budget, totals,
            part_attachments: attachments.length, part_attachment_bytes: groups[i].reduce((k, a) => k + (a.blob?.size || 0), 0),
            ...(i === 0 ? { index } : {}) } };
        if(JSON.stringify(part).length>budget)throw Error('Yedek parçası bütçeyi aşıyor; dosya üretilmedi.');
        yield part;
        groups[i] = null;
      }
    },
  };
}
// ---- Geri yükleme seti durumu (meta "restore_set:<set>") ----
// { set, of, done:[no], pending:{ekId:[record_type, record_id, partNo]}, started_at, finished_at }
// Parça verisiyle AYNI transaction'da yazılır: parça ya bütünüyle yüklenir ve işaretlenir, ya hiç.
export const RESTORE_SET = "restore_set:";
export async function restoreSets(db) {
  return (await db.getAll("meta")).filter((m) => m.key.startsWith(RESTORE_SET)).map((m) => m.value);
}
function checkPart(obj, state) {
  const P = obj.part;
  if (!P) return;
  if (typeof P.set!=='string'||!P.set||P.set.length>200||!Number.isSafeInteger(P.no)||!Number.isSafeInteger(P.of)||P.no<1||P.of<P.no||P.of>10000) throw Error("Yedek parçasının bilgileri bozuk (set / sıra)");
  if ((obj.attachments || []).length !== P.part_attachments && P.part_attachments != null) throw Error(`Parça eksik ya da bozuk: ${P.part_attachments} ek olmalı, ${(obj.attachments || []).length} var`);
  if (P.no > 1 && !state) throw Error(`Bu, bir yedek setinin ${P.no}/${P.of}. parçası; bu setin 1. parçası bu telefonda yüklenmemiş (yanlış set ya da sıra). Önce aynı setin 1. parçasını yükleyin.`);
  if (state && state.of !== P.of) throw Error("Parça başka bir yedek setine ait (toplam parça sayısı tutmuyor)");
  if (P.no === 1 && !Array.isArray(P.index)) throw Error("1. parçada ek dizini yok — dosya bozuk");
  if (P.no===1) {
    const ids=new Set();
    for(const item of P.index){
      if(!Array.isArray(item)||item.length!==4||item.slice(0,3).some(x=>typeof x!=='string'||!x)||['__proto__','constructor','prototype'].includes(item[0])||ids.has(item[0])||!Number.isSafeInteger(item[3])||item[3]<1||item[3]>P.of)throw Error('Yedek ek dizini geçersiz veya mükerrer');
      ids.add(item[0]);
    }
    if(P.totals?.attachments!=null&&P.totals.attachments!==P.index.length)throw Error('Yedek ek dizini toplamla uyuşmuyor');
  }
  // Yanlış parçaya ait, eksik ya da dizinden farklı ekler seti tamamlayamaz.
  if(!state?.done?.includes(P.no)){
    const expected=P.no===1?P.index.filter(x=>x[3]===1):Object.entries(state.pending||{}).filter(([,x])=>x[2]===P.no).map(([id,x])=>[id,...x]);
    const incoming=obj.attachments||[];
    if(expected.length!==incoming.length||expected.some(([id,rt,rid])=>!incoming.some(a=>a.id===id&&a.record_type===rt&&a.record_id===rid)))throw Error('Yedek parçasının ekleri dizinle uyuşmuyor');
  }

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
  const release = startActivity("restore");
  try {
  const state0 = obj.part ? await db.metaGet(RESTORE_SET + obj.part.set) : null;
  checkPart(obj, state0);
  if (obj.part && state0?.done?.includes(obj.part.no))
    return { ...(await previewBackup(db, obj)), part: obj.part, already: true, set: state0 }; // aynı parça ikinci kez: hiçbir şey yazılmaz
  const preview = await previewBackup(db, obj);
  // Telefon içi kurtarma kopyası: ekler Blob olarak (base64 kopyası yok — bellek iki katına çıkmaz)
  await saveRecovery(db, await fullBackup(db, { attachments: "blob" }));
  try { validateRestoreLinks(await db.dumpAll(), obj, preview, replace); }
  catch (e) { if (obj.part?.no > 1 && /bağlı olmayan dosya eki/.test(e.message)) throw Error(`Bu, yedeğin ${obj.part.no}. parçası (toplam ${obj.part.of}). Önce 1. parçayı yükleyin.`); throw e; }
  const decoded = [];
  for (const a of obj.attachments || []) {
    if (!a.id || !a.record_id || typeof a.base64 !== "string")
      throw Error("Ek geçersiz");
    let bin;
    try { bin = atob(a.base64); } catch { throw Error(`Ek bozuk (${a.name || a.id}) — yedek parçası hasarlı`); }
    if (a.size && bin.length !== a.size) throw Error(`Ek bozuk (${a.name || a.id}): ${a.size} bayt olmalı, ${bin.length} geldi`);
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
  return await new Promise((resolve, reject) => {
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
        !["device_install_id", "pin_hash", "last_backup_at", "last_backup_result", "sec_lock", "sec_fail"].includes(m.key)
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
    // Parçalı set: bu parçanın yüklendiği ve gelen eklerin bekleyenlerden düştüğü AYNI işlemde işaretlenir
    let setState = null;
    if (obj.part) {
      const key = RESTORE_SET + obj.part.set;
      const q = t.objectStore("meta").get(key);
      q.onsuccess = () => {
        const st = q.result?.value || { set: obj.part.set, of: obj.part.of, done: [], pending: {}, started_at: new Date().toISOString(), created_at: obj.part.created_at || null, totals: obj.part.totals || null };
        if (st.done.includes(obj.part.no)) { error = Error("Bu parça az önce başka bir ekranda yüklendi"); t.abort(); return; }
        if (obj.part.no === 1) for (const [id, rt, rid, no] of obj.part.index || []) if (no !== 1) st.pending[id] = [rt, rid, no];
        for (const a of decoded) delete st.pending[a.id];
        st.done = [...st.done, obj.part.no].sort((x, y) => x - y);
        if (st.done.length === st.of) st.finished_at = new Date().toISOString();
        t.objectStore("meta").put({ key, value: st });
        setState = st;
      };
    }
    t.oncomplete = () => resolve({ ...preview, part: obj.part || null, set: setState });
    t.onabort = t.onerror = () =>
      reject(error || t.error || Error("Geri yükleme iptal edildi"));
  });
  } finally { release(); }
}
// Kullanıcıya gösterilecek durum: tamamlandı mı, eksik parçalar, eki beklenen kayıt sayısı
export function setStatusText(st) {
  if (!st) return "";
  const missing = Array.from({ length: st.of }, (_, i) => i + 1).filter((n) => !st.done.includes(n));
  const waitRecs = new Set(Object.values(st.pending || {}).map((x) => x[1])).size;
  return missing.length
    ? `Yedek seti TAMAMLANMADI: ${st.done.length}/${st.of} parça yüklendi; eksik parça: ${missing.join(", ")}. ${waitRecs} kaydın eki bekleniyor.`
    : `Yedek seti tamamlandı (${st.of}/${st.of} parça).`;
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
    dump_site: "dump_sites",
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
  validateCustomerFuelLinks(Object.fromEntries(Object.entries(merged).map(([s,m]) => [s,[...m.values()]])));
  validateDumpData(Object.fromEntries(Object.entries(merged).map(([s,m])=>[s,[...m.values()]])));
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

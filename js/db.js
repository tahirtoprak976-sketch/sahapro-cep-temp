import { prepareAttachment, prepareInvoiceOriginal } from "./attachment-safety.js";
import {historicalFuelIdentity} from './historical-fuel.js';
import {recordsCommitted} from "./record-refresh.js";
import {assertHakedisItems, assertHakedisDocument, captureHakedisSources, assertHakedisSources, hakedisWorkSnapshot} from './hakedis-validation.js';
import {assertTankChange} from './tank-timeline.js';
import {freezeDumpTariff, liveDumpEntries} from "./dump-ledger-core.js";
import {freezeDumpEstimate} from "./dump-estimate.js";
import { validDate } from "./driver-delivery.js";
import {customerFuelFields, validateCustomerFuelLinks} from './customer-fuel.js';
import { customerNameKey } from "./driver-customer.js";
import { linkVerdict } from "./security-core.js";
import { ENTERPRISE_STORES, workHours } from "./enterprise-core.js";
// SAHAPRO SOLO — IndexedDB katmanı (local-first, offline-first)
// Backend YOK · Supabase YOK · ana SAHAPRO API YOK.
// v1 (sahapro_cep_db @ version 1) → v2 (version 2) VERSIONED MIGRATION — kayıtlar korunur.

import {
  ENTITY_STORES,
  newRecord,
  touchRecord,
  isActive,
  nowISO,
  uuid,
  SEED_VEHICLES,
  SEED_PERSONNEL,
  SEED_ALIASES,
  VEHICLE_OWNERSHIP,
  SCHEMA_VERSION,
  tankUnitCost,
  todayStr,
} from "./core.js";

const DB_NAME = "sahapro_cep_db"; // v1 ile AYNI isim — veri bu DB'de
const DB_VERSION = 7;
let _db = null;

// Test harness için: ?db=<isim> ile ayrı DB açılabilir (migration simülasyonu)
function dbName() {
  try {
    const p = new URLSearchParams(location.search).get("db");
    if (p && /^[a-z0-9_-]{1,32}$/i.test(p)) return "sahapro_cep_db_" + p;
  } catch (e) {
    /* noop */
  }
  return DB_NAME;
}

export async function openDB() {
  if (_db) return Promise.resolve(_db);
  await backupBeforeUpgrade();
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName(), DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      // v1 store'ları eksikse oluştur (v1→v2 upgrade'de zaten var; taze kurulumda hepsi kurulur)
      for (const s of ENTITY_STORES) {
        const st = db.objectStoreNames.contains(s)
          ? ev.target.transaction.objectStore(s)
          : db.createObjectStore(s, { keyPath: "id" });
        for (const key of [
          "date",
          "customer_id",
          "site_id",
          "vehicle_id",
          "personnel_id",
          "owner_id",
          "party_id",
          "due_date",
          "payable_id",
          "bank_account_id",
          "work_record_id",
        ])
          if (!st.indexNames.contains(key))
            st.createIndex(key, key, { unique: false });
      }
      if (!db.objectStoreNames.contains("attachments"))
        db.createObjectStore("attachments", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta"))
        db.createObjectStore("meta", { keyPath: "key" });
      if (!db.objectStoreNames.contains("drafts"))
        db.createObjectStore("drafts", { keyPath: "form" });
    };
    req.onsuccess = () => {
      _db = req.result;
      _db.onversionchange = () => {
        _db.close();
        _db = null;
      };
      resolve(_db);
    };
    req.onblocked = () =>
      reject(Error("Güncelleme için diğer SAHAPRO sekmelerini kapatın"));
    req.onerror = () => reject(req.error?.name==='VersionError'?Error('Bu cihazdaki veri daha yeni uygulama sürümüyle açılmış. Sayfayı güncelleyin; verileri / depolamayı silmeyin.'):req.error);
  });
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}
function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Request error events bubble before IDBTransaction.error is necessarily populated.
// Always reject with an Error so callers can report failure and offer recovery.
const transactionError = (t, event) => t.error || event?.target?.error || Error("Veritabanı işlemi iptal edildi");

// These guards run inside the same write transaction as their protected row.
// Dedicated audited merge/event paths remain separate; generic editing must not
// silently detach a historical identity or one side of a financial event.
const HISTORY_STORES = ENTITY_STORES.filter(store => store !== 'audit_log');
const financeError = (message, code) => Object.assign(Error(message), {code});
const changedField = (before, after, key) => JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null);
function readTransactionRows(transaction, stores, done) {
  const data = {}; let pending = stores.length;
  if (!pending) { done(data); return; }
  for (const store of stores) {
    const request = transaction.objectStore(store).getAll();
    request.onsuccess = () => { data[store] = request.result; if (!--pending) done(data); };
  }
}
function identityReference(value, type, id, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  const keys = type === 'customer' ? ['customer_id', 'recipient_customer_id', 'parent_customer_id'] : ['site_id'];
  if (keys.some(key => value[key] === id) ||
      (value.owner_type === type && value.owner_id === id) ||
      (value.party_type === type && value.party_id === id) ||
      (value.target_type === type && value.target_id === id)) return true;
  return Object.values(value).some(child => child && typeof child === 'object' && identityReference(child, type, id, seen));
}
function hasIdentityHistory(data, type, id) {
  const own = type === 'customer' ? 'customers' : 'sites';
  return Object.entries(data).some(([store, rows]) => rows.some(row => !(store === own && row.id === id) && identityReference(row, type, id)));
}
const CLAIM_WORK_FIELDS = ['date', 'customer_id', 'site_id', 'vehicle_id', 'personnel_id', 'work_type', 'material',
  'quantity', 'unit', 'price_snapshot', 'time_start', 'time_end', 'break_minutes', 'customer_fuel_allowance_l', 'customer_fuel_rule',
  'dump_site_id', 'dump_cost', 'dump_tariff_snapshot', 'dump_estimate_snapshot', 'tonnage', 'tonnage_scope', 'dump_payer', 'deleted_at'];
const CASH_MONEY_FIELDS = ['amount', 'date', 'customer_id', 'cash_type', 'payment_method', 'bank_account_id', 'bank_movement_id',
  'personnel_id', 'request_id', 'driver_entry_id', 'event_id', 'deleted_at'];
function financeGuardStores(store, delta) {
  if (store === 'sites' && 'customer_id' in delta) return HISTORY_STORES;
  if (store === 'work_records') return ['hakedis'];
  if (store === 'fuel_tank_movements') return ['pending_fuel_records'];
  if (store === 'hakedis') return ['cari_movements'];
  if (store === 'cash_records') return ['cari_movements', 'bank_movements', 'settlement_allocations'];
  return [];
}
function assertFinancialEdit(store, current, next, delta, data) {
  if (!current || current.deleted_at) throw financeError('Kayıt değişmiş veya silinmiş; yeniden açın.', 'STALE');
  const changes = keys => keys.some(key => key in delta && changedField(current, next, key));
  if(store==='fuel_tank_movements'&&(data.pending_fuel_records||[]).some(r=>[current.fuel_record_id,next.fuel_record_id].includes(r.id))&&changes(['date','liters','move_type','vehicle_id','personnel_id','fuel_record_id','event_id','deleted_at']))throw Error('Mutabakatı tamamlanan yakıtın depo eş kaydı tek başına değiştirilemez.');
  if(store==='fuel_records'&&changes(['historical_pending_id']))throw Error('Mutabakat kaynak bağlantısı yalnız açık onaylı kesinleştirmede oluşturulabilir.');
  if(store==='fuel_records'&&current.historical_pending_id&&changes(['historical_pending_id','date','liters','fuel_source','vehicle_id','personnel_id','total','unit_price','cost_source','tank_movement_id','event_id','deleted_at']))throw Error('Mutabakatı tamamlanmış geçmiş yakıtın kaynak ve maliyeti tek başına değiştirilemez.');
  if (store === 'hakedis') {
    if (current.status !== 'Taslak' ||
        changes(['items', 'customer_id', 'site_id', 'date_from', 'date_to', 'created_date', 'subtotal', 'kdv_total', 'grand_total', 'deleted_at']) ||
        ('status' in delta && next.status !== 'İptal' && next.status !== 'Taslak') ||
        (data.cari_movements || []).some(row => isActive(row) && row.ref_id === current.id))
      throw financeError('Kesinleşmiş / cariye bağlı hakediş değiştirilemez. Taslak düzeltmesi için iptal edip yeniden oluşturun.', 'HAKEDIS_LOCKED');
  }
  if (store === 'work_records' && changes(CLAIM_WORK_FIELDS) && (current.price_snapshot?.locked ||
      (data.hakedis || []).some(claim => isActive(claim) && claim.status !== 'İptal' && (claim.items || []).some(item => item.work_record_id === current.id))))
    throw financeError('Hakedişe bağlı iş değiştirilemez. Taslak hakedişi iptal edip güncel bilgilerle yeniden oluşturun; kesinleşmiş kaydı yeniden fiyatlandırmayın.', 'HAKEDIS_LOCKED');
  if (store === 'cash_records' && changes(CASH_MONEY_FIELDS) && (current.cash_type === 'Müşteriden Para Alındı' || current.bank_movement_id ||
      (data.cari_movements || []).some(row => isActive(row) && row.ref_id === current.id) ||
      (data.bank_movements || []).some(row => isActive(row) && row.source_store === 'cash_records' && row.source_id === current.id) ||
      (data.settlement_allocations || []).some(row => isActive(row) && row.receipt_id === current.id)))
    throw financeError('Tahsilatın tutarı, tarihi ve tarafları cariye / bankaya bağlıdır; kasa kaydı tek başına değiştirilemez. Yanlış kaydı Veri Sağlığı / ilgili finans işleminden inceleyin; farkı yeni tahsilat gibi tekrar yazmayın.', 'FINANCE_LINKED');
  if (store === 'cari_movements' && ['Tahsilat', 'Hakedis', 'MazotTeslimi'].includes(current.type) &&
      changes(['date', 'amount', 'customer_id', 'type', 'ref_id', 'source', 'event_id', 'deleted_at']))
    throw financeError('Bağlı cari hareket tek başına değiştirilemez; kaynak finans işlemini inceleyin.', 'FINANCE_LINKED');
  if (store === 'sites' && changes(['customer_id']) && hasIdentityHistory(data, 'site', current.id))
    throw financeError('Geçmiş kayıtlarda kullanılan şantiyenin müşterisi değiştirilemez. Yeni müşteri için ayrı şantiye açın; mükerrer kartları Kartları Birleştir ekranından inceleyin.', 'CARD_HISTORY');
}
function increasingStamp(record) {
  const now = nowISO(), previous = Date.parse(record?.updated_at || '');
  return Number.isFinite(previous) && now <= record.updated_at ? new Date(previous + 1).toISOString() : now;
}

export async function put(store, rec) {
  if(store==='pending_fuel_records')throw Error('Geçmiş yakıt yalnız mutabakat incelemesinden değiştirilebilir.');
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const t=db.transaction(['fuel_tank_movements','fuel_records'].includes(store)?[store,'pending_fuel_records']:store,"readwrite");let error,result;
    const q=t.objectStore(store).get(rec.id);q.onsuccess=()=>{if(store==='fuel_records'&&(q.result?.historical_pending_id||rec.historical_pending_id)){error=Error('Geçmiş yakıt mutabakatı doğrudan değiştirilemez.');t.abort();return;}const write=()=>{const w=t.objectStore(store).put(rec);w.onsuccess=()=>{result=w.result;};};
    if(store==='fuel_tank_movements'){const ids=[...new Set([q.result?.fuel_record_id,rec.fuel_record_id].filter(Boolean))];let left=ids.length;if(!left){write();return;}for(const id of ids){const p=t.objectStore('pending_fuel_records').get(id);p.onsuccess=()=>{if(p.result&&['date','liters','move_type','vehicle_id','personnel_id','fuel_record_id','event_id','deleted_at'].some(k=>changedField(q.result,rec,k))){error=Error('Mutabakat depo eş kaydı doğrudan değiştirilemez.');t.abort();return;}if(!--left)write();};}}
    else if(store==='fuel_records'){const p=t.objectStore('pending_fuel_records').get(rec.id);p.onsuccess=()=>{if(p.result){error=Error('Geçmiş yakıt için ayrılmış kimlik doğrudan kullanılamaz.');t.abort();return;}write();};}else write();};
    t.oncomplete=()=>{recordsCommitted(db.name,[store]);resolve(result);};
    t.onerror=t.onabort=()=>reject(error||t.error||Error("Kayıt işlemi iptal edildi"));
  });
}
export async function get(store, id) {
  const db = await openDB();
  return wrap(tx(db, store, "readonly").get(id));
}
export async function getAll(store) {
  const db = await openDB();
  return (await wrap(tx(db, store, "readonly").getAll())) || [];
}
export async function listActive(store) {
  return (await getAll(store)).filter(isActive);
}
export async function softDelete(store, id, reason) {
  if(store==='pending_fuel_records')throw Error('Geçmiş yakıt yalnız mutabakat incelemesinden değiştirilebilir.');
  if (store === 'customers' && (await listActive('fuel_tank_movements')).some(m => m.delivery_kind === 'customer_fuel' && m.recipient_customer_id === id)) throw Error('Mazot teslimine bağlı müşteri silinemez; pasife alın');
  if (['customers','sites','vehicles','personnel','dump_sites'].includes(store)) {
    const key={customers:'customer_id',sites:'site_id',vehicles:'vehicle_id',personnel:'personnel_id',dump_sites:'dump_site_id'}[store];
    if ((await getAll('inbox_messages')).some(m=>isActive(m)&&(m.review_rows||[]).some(r=>r[key]===id))) throw Error('Kontrol edilmiş mesaj taslağına bağlı kart silinemez; pasife alın');
  }

  const rec = await get(store, id);
  if (!rec) return null;
  if (store === "dump_entries") throw Error("Döküm işlemi ortak hesap ekranından yapılmalı");
  if (ENTERPRISE_STORES.includes(store) || ["inbox_messages","meter_readings","shift_assignments","custody_records","downtime_records","maintenance_parts","cost_allocations","bank_import_rows","stock_counts"].includes(store))
    throw Error(
      "İşletme defteri kaydı silinemez; ilgili işlem ekranını kullanın",
    );
  const extensionRefs = {vehicles:[['custody_records','owner_id'],['meter_readings','vehicle_id'],['shift_assignments','vehicle_id'],['downtime_records','vehicle_id'],['maintenance_parts','vehicle_id']],customers:[['shift_assignments','customer_id']],sites:[['shift_assignments','site_id']],personnel:[['shift_assignments','personnel_id'],['custody_records','personnel_id']],documents:[['custody_records','owner_id']],maintenance_records:[['maintenance_parts','maintenance_id'],['downtime_records','maintenance_id']],bank_accounts:[['bank_import_rows','bank_account_id']],bank_movements:[['bank_import_rows','bank_movement_id']]};
  for(const [target,key] of extensionRefs[store]||[])if((await getAll(target)).some(r=>isActive(r)&&r[key]===id))throw Error('İşletme geçmişine bağlı kayıt silinemez; pasife alın');
  if(['vehicles','sites','customers'].includes(store)&&(await getAll('cost_allocations')).some(r=>(r.targets||[]).some(t=>t[{vehicles:'vehicle_id',sites:'site_id',customers:'customer_id'}[store]]===id)))throw Error('Maliyet geçmişine bağlı kart silinemez; pasife alın');
  if((await getAll('cost_allocations')).some(r=>isActive(r)&&r.status==='Aktif'&&r.source_store===store&&r.source_id===id))throw Error('Dağıtılmış maliyet kaynağı silinemez');
  if ((await getAll("maintenance_parts")).some(r => isActive(r) && r.tracking && r.cost_source_store === store && r.cost_source_id === id)) throw Error("Parça / garanti kaydına bağlı maliyet silinemez; önce parça ekranından bağlantıyı kaldırın");
  const linked = (await getAll("payables")).some(
    (b) =>
      isActive(b) &&
      b.status !== "İptal" &&
      ((b.source_store === store && b.source_id === id) ||
        (b.party_id === id &&
          {
            supplier: "suppliers",
            contractor: "contractors",
            dump_site: "dump_sites",
            quarry: "quarries",
          }[b.party_type] === store) ||
        (b.items || []).some(
          (i) => store === "work_records" && i.work_record_id === id,
        )),
  );
  if (linked) throw Error("Borç/maliyete bağlı kayıt silinemez");
  if (
    [
      "vehicles",
      "personnel",
      "customers",
      "sites",
      "quotes",
      "contracts",
    ].includes(store)
  ) {
    const type = {
      vehicles: "vehicle",
      personnel: "personnel",
      customers: "customer",
      sites: "site",
      quotes: "quote",
      contracts: "contract",
    }[store];
    if (
      (await listActive("activities")).some(
        (r) => r.owner_type === type && r.owner_id === id,
      ) ||
      (store === "vehicles" &&
        (await listActive("service_plans")).some((r) => r.vehicle_id === id)) ||
      (store === "personnel" &&
        (await listActive("payroll_entries")).some(
          (r) => r.personnel_id === id,
        ))
    )
      throw Error("İşletme defterine bağlı kart silinemez");
  }
  if (store === "sites" && (rec.deal?.measurement || rec.deal?.charge))
    throw Error("Bedeli / ölçümü cariye yazılmış iş sözleşmesi olan şantiye silinemez");
  if (
    ["contracts", "hakedis", "slips"].includes(store) &&
    ["İmzalandı", "Kesinleşti"].includes(rec.status)
  )
    throw Error("İmzalı veya kesinleşmiş kayıt silinemez");
  if (
    store === "work_records" &&
    (await listActive("hakedis")).some(
      (h) =>
        h.status !== "İptal" &&
        (h.items || []).some((i) => i.work_record_id === id),
    )
  )
    throw Error("Hakedişe bağlı iş silinemez");
  if (
    [
      "fuel_records",
      "fuel_tank_movements",
      "cash_records",
      "cari_movements",
    ].includes(store)
  )
    throw Error("Bağlı finans/yakıt hareketi tek başına silinemez");
  if (store === "work_records" && rec.work_batch_id && rec.slip_id)
    throw Error("Toplu fişe bağlı iş tek başına silinemez");
  const upd = { ...rec, deleted_at: nowISO(), updated_at: nowISO() };
  const connection = await openDB();
  await new Promise((resolve, reject) => {
    const historyStores = store === 'customers' ? HISTORY_STORES : store === 'work_records' ? ['hakedis'] : ['vehicles','personnel'].includes(store)?['pending_fuel_records']:[];
    const t = connection.transaction([...new Set([store, "maintenance_parts", "dump_entries", "audit_log", ...historyStores, ...(store==="dump_sites"?["expense_records","work_records"]:[])])], "readwrite"); let error;
    if(store==="dump_sites")for(const s of ["expense_records","work_records"]){const q=t.objectStore(s).getAll();q.onsuccess=()=>{if(q.result.some(r=>isActive(r)&&r.dump_site_id===id)){error=Error("Eski döküm geçmişine bağlı saha silinemez");t.abort();}};}
    const dumpCheck=t.objectStore("dump_entries").getAll();
    dumpCheck.onsuccess=()=>{const key={expense_records:"expense_id",work_records:"work_record_id",dump_sites:"dump_site_id",vehicles:"vehicle_id",customers:"customer_id",sites:"site_id"}[store];if(key&&dumpCheck.result.some(e=>isActive(e)&&e[key]===id)){error=Error("Ortak döküm hesabına bağlı kayıt silinemez; döküm işlemini inceleyin");t.abort();}};
    const q = t.objectStore("maintenance_parts").getAll();
    q.onsuccess = () => {
      if (q.result.some(r => isActive(r) && ((r.tracking && r.cost_source_store === store && r.cost_source_id === id) || (store === "vehicles" && r.vehicle_id === id) || (store === "maintenance_records" && r.maintenance_id === id)))) { error = Error("Parça / garanti geçmişine bağlı kayıt silinemez"); t.abort(); return; }
      const get = t.objectStore(store).get(id);
      get.onsuccess = () => {
        readTransactionRows(t, historyStores, history => {
          if (JSON.stringify(get.result) !== JSON.stringify(rec)) { error = financeError("Kayıt değişti; yeniden açın", 'STALE'); t.abort(); return; }
          if(['vehicles','personnel'].includes(store)&&(history.pending_fuel_records||[]).some(r=>r.reconciliation_status!=='cancelled'&&r[store==='vehicles'?'vehicle_id':'personnel_id']===id)){error=Error('Geçmiş yakıt mutabakatına bağlı araç / personel silinemez; kaynak kartı korunuyor.');t.abort();return;}
          if (store === 'customers' && hasIdentityHistory(history, 'customer', id)) {
            error = financeError('İş / finans geçmişine bağlı müşteri silinemez; müşteri kartında Durum → Pasif seçin. Mükerrer kartlar için Kartları Birleştir ekranını kullanın.', 'CARD_HISTORY'); t.abort(); return;
          }
          if (store === 'work_records' && (history.hakedis || []).some(claim => isActive(claim) && claim.status !== 'İptal' && (claim.items || []).some(item => item.work_record_id === id))) {
            error = financeError('Hakedişe bağlı iş silinemez; önce ilgili taslağı inceleyin.', 'HAKEDIS_LOCKED'); t.abort(); return;
          }
          if (store === 'hakedis' && get.result?.status === 'Kesinleşti') {
            error = financeError('Kesinleşmiş hakediş silinemez.', 'HAKEDIS_LOCKED'); t.abort(); return;
          }
          t.objectStore(store).put(upd);
          t.objectStore("audit_log").put({id:uuid(),entity:store,entity_id:id,action:"soft_delete",old:{deleted_at:rec.deleted_at},new:{deleted_at:upd.deleted_at},reason:reason||"",at:nowISO()});
        });
      };
    };
    t.oncomplete = resolve; t.onabort = t.onerror = (event) => reject(error || transactionError(t, event));
  });
  recordsCommitted(connection.name,[store]);
  return upd;
}
// Mükerrer depo GİRİŞİ silme (birleştirme sonrası). Sayım/çıkış hareketi ve borca bağlı giriş silinmez.
export async function deleteTankIn(id, reason) {
  const rec = await get("fuel_tank_movements", id);
  if (!rec || rec.deleted_at) return null;
  if (rec.move_type !== "GİRİŞ" || rec.count_id || rec.fuel_record_id) throw Error("Yalnız depo girişi silinebilir");
  if ((await getAll("payables")).some((b) => isActive(b) && b.status !== "İptal" && b.source_store === "fuel_tank_movements" && b.source_id === id)) throw Error("Borca bağlı giriş silinemez");
  const upd = { ...rec, deleted_at: nowISO(), updated_at: nowISO() };
  await put("fuel_tank_movements", upd);
  await audit("fuel_tank_movements", id, "soft_delete", { deleted_at: null }, { deleted_at: upd.deleted_at }, reason || "");
  return upd;
}
// Veri Sağlığı düzeltmeleri (yalnız denetimin bulduğu kesin durumlar için)
// Yakıt kaydı silinmiş ama depo çıkışı kalmış: çıkış da silinir (stok doğru görünür)
export async function removeOrphanTankOut(id) {
  const m = await get("fuel_tank_movements", id);
  if (!m || m.deleted_at || m.move_type !== "ÇIKIŞ" || !m.fuel_record_id) throw Error("Uygun depo çıkışı değil");
  const f = await get("fuel_records", m.fuel_record_id);
  if (f && !f.deleted_at) throw Error("Yakıt kaydı duruyor; çıkış silinemez");
  const upd = { ...m, deleted_at: nowISO(), updated_at: nowISO() };
  await put("fuel_tank_movements", upd);
  await audit("fuel_tank_movements", id, "soft_delete", { deleted_at: null }, { deleted_at: upd.deleted_at }, "Veri sağlığı: sahipsiz depo çıkışı");
  return upd;
}
// Sahibi hiç olmayan ek (dosya/fotoğraf) kaldırılır
export async function removeOrphanAttachment(id) {
  const a = await get("attachments", id);
  if (!a) return null;
  const owner = { document: "documents", maintenance: "maintenance_records", expense: "expense_records", slip_signature: "slips", contract_signature: "contracts", leave_signature: "documents", tank: "fuel_tank_movements", payable: "payables", work: "work_records", fuel: "fuel_records" }[a.record_type] || a.record_type;
  let parent = null; try { parent = await get(owner, a.record_id); } catch (e) {}
  if (parent) throw Error("Bu dosyanın sahibi var; silinmez");
  const d = await openDB();
  await new Promise((res, rej) => { const t = d.transaction(["attachments"], "readwrite"); t.objectStore("attachments").delete(id); t.oncomplete = res; t.onerror = t.onabort = (event) => rej(transactionError(t, event)); });
  await audit("attachments", id, "delete", { name: a.name, record_type: a.record_type, record_id: a.record_id }, null, "Veri sağlığı: sahipsiz dosya");
  return true;
}
export async function restore(store, id) {
  if(store==='pending_fuel_records')throw Error('Geçmiş yakıt yalnız mutabakat incelemesinden değiştirilebilir.');
  if(store==='fuel_records')return restoreFuelEvent(id);
  if(store==='fuel_tank_movements'){const move=await get(store,id);if(move?.fuel_record_id)return restoreFuelEvent(move.fuel_record_id);throw Error('Bağlı stok hareketi tek başına geri yüklenemez; ilgili yakıt / teslim işlemini inceleyin.');}
  if(['cash_records','cari_movements'].includes(store))throw Error('Bağlı finans hareketi tek başına geri yüklenemez; işlemin tamamını Geri Al veya tam yedekten geri yükleme ile inceleyin.');
  const connection=await openDB();return new Promise((resolve,reject)=>{
    const t=connection.transaction([...new Set([store,'audit_log'])],'readwrite');let result,error,changed=false;
    const q=t.objectStore(store).get(id);q.onsuccess=()=>{try{
      const rec=q.result;if(!rec||!rec.deleted_at){result=rec||null;return;}
      result={...rec,deleted_at:null,updated_at:new Date(Math.max(Date.now(),(Date.parse(rec.updated_at)||0)+1)).toISOString()};t.objectStore(store).put(result);
      t.objectStore('audit_log').put({id:uuid(),entity:store,entity_id:id,action:'restore',old:{deleted_at:rec.deleted_at},new:{deleted_at:null},reason:'',at:nowISO()});changed=true;
    }catch(e){error=e;t.abort();}};
    t.oncomplete=()=>{if(changed)recordsCommitted(connection.name,[store]);resolve(result);};t.onerror=t.onabort=event=>reject(error||transactionError(t,event));
  });
}

// ---- meta ----
export async function metaGet(key) {
  const db = await openDB();
  const row = await wrap(tx(db, "meta", "readonly").get(key));
  return row ? row.value : null;
}
export async function metaSet(key, value) {
  const db = await openDB();
  return wrap(tx(db, "meta", "readwrite").put({ key, value }));
}

// Meta değerini tek transaction'da oku-değiştir-yaz (iki sekme aynı anda artırsa da kayıp olmaz)
export async function metaUpdate(key, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction("meta", "readwrite");
    const st = t.objectStore("meta");
    let nx;
    const g = st.get(key);
    g.onsuccess = () => { nx = fn(g.result ? g.result.value : null); st.put({ key, value: nx }); };
    t.oncomplete = () => resolve(nx);
    t.onerror = t.onabort = (event) => reject(transactionError(t, event));
  });
}
// Birden çok meta anahtarını tek transaction'da oku → fn(değerler) → { set: {anahtar: değer}, result } (fn hata atarsa hiçbir şey yazılmaz)
export async function metaTxn(keys, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction("meta", "readwrite");
    const st = t.objectStore("meta");
    const reqs = keys.map((k) => st.get(k));
    let out, error;
    reqs.at(-1).onsuccess = () => {
      try {
        const r = fn(Object.fromEntries(keys.map((k, i) => [k, reqs[i].result ? reqs[i].result.value : null])));
        for (const [k, v] of Object.entries(r?.set || {})) st.put({ key: k, value: v });
        out = r?.result;
      } catch (e) { error = e; t.abort(); }
    };
    t.oncomplete = () => resolve(out);
    t.onerror = t.onabort = (event) => reject(error || transactionError(t, event));
  });
}
// Sayaç (fiş/teklif/hakediş seri no) — tek transaction'da atomik artış
export async function nextSeq(name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction("meta", "readwrite");
    const st = t.objectStore("meta");
    const g = st.get("seq_" + name);
    g.onsuccess = () => {
      const cur = (g.result && g.result.value) || 0;
      const nx = cur + 1;
      st.put({ key: "seq_" + name, value: nx });
      t.oncomplete = () => resolve(nx);
    };
    g.onerror = () => reject(g.error);
    t.onerror = (event) => reject(transactionError(t, event));
  });
}

// ---- audit (§48): old/new/reason/timestamp ----
export async function audit(entity, entityId, action, oldV, newV, reason) {
  const db = await openDB();
  const rec = {
    id: uuid(),
    entity,
    entity_id: entityId,
    action,
    old: oldV ?? null,
    new: newV ?? null,
    reason: reason || "",
    at: nowISO(),
  };
  return wrap(tx(db, "audit_log", "readwrite").put(rec));
}

// Name + explicit parent is one identity; concurrent approvals must reuse the same card.
export async function ensureCustomerCard(name, parent = null, options = {}) {
  name = String(name || "").trim(); if (!name) throw new Error("Müşteri adı gerekli");
  if (name.length > 120) throw new Error("Müşteri adı en fazla 120 karakter olabilir");
  const fields = {};
  for (const key of ['phone','note']) if (options.fields?.[key] != null) fields[key] = String(options.fields[key]).trim().slice(0,key==='phone'?40:300);
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction(["customers", "audit_log", ...(options.conversation?['meta']:[])], "readwrite"), store = t.objectStore("customers");
    let result, error;
    if(options.conversation){
      const chat=t.objectStore('meta').get('assistant_conversation_v1');
      chat.onsuccess=()=>{
        const state=chat.result?.value,turn=options.conversation;
        if(state?.id!==turn.epoch||!state?.turns?.some(x=>x.id===turn.id&&x.status!=='cancelled')){
          error=new Error('Sohbet yenilendi veya taslak kapandı. Müşteri isteğini yeniden gönderin.');t.abort();
        }
      };
    }
    const q = store.getAll();
    q.onsuccess = () => {
      try {
        const active = q.result.filter(isActive);
        if (parent && !active.some(c => c.id === parent)) { error = new Error("Ana firma artık kullanılamıyor; müşteriyi tekrar seçin"); t.abort(); return; }
        const matches = active.filter(c => customerNameKey(c.name) === customerNameKey(name) && (c.parent_customer_id || null) === (parent || null));
        if (matches.length > 1) { error = new Error("Aynı ad ve ana firmayla birden fazla müşteri var; doğru kartı seçin"); t.abort(); return; }
        if (matches.length) { result = { ...matches[0], _existing: true }; return; }
        result = newRecord({ name, note: "Asistan ile açıldı", ...fields, ...(parent ? { parent_customer_id: parent } : {}) });
        store.put(result);
        t.objectStore("audit_log").put({ id: uuid(), entity: "customers", entity_id: result.id, action: "create", old: null, new: result, reason: String(options.reason||"Asistan: yeni müşteri").slice(0,300), at: nowISO() });
      } catch(e) { error=e; try{t.abort();}catch{} }
    };
    t.oncomplete = () => resolve(result);
    t.onerror = t.onabort = (event) => reject(error || transactionError(t, event));
  });
}

// ---- taslak autosave ----
export async function draftSave(form, values) {
  const db = await openDB();
  return wrap(
    tx(db, "drafts", "readwrite").put({ form, values, saved_at: nowISO() }),
  );
}
export async function draftGet(form) {
  const db = await openDB();
  const row = await wrap(tx(db, "drafts", "readonly").get(form));
  return row ? row.values : null;
}
export async function draftClear(form) {
  const db = await openDB();
  return wrap(tx(db, "drafts", "readwrite").delete(form));
}

// ---- attachments (Blob ayrı store; JSON'a GÖMÜLMEZ; orijinal immutable, türev derived_of) ----
export async function addAttachment(recordType, recordId, file, extra = {}) {
  file = await prepareAttachment(file);
  // Aynı dosya aynı kayda ikinci kez eklenmez (tekrar Kaydet / yarım kalan işlemin yeniden denenmesi): özgün dosyanın özeti
  let src_sha256 = null;
  try { src_sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))].map((b) => b.toString(16).padStart(2, "0")).join(""); } catch {}
  file = await (await import("./image-shrink.js")).shrinkImage(file, { kind: extra.kind });
  const rec = {
    src_sha256,
    id: uuid(),
    record_type: recordType,
    record_id: recordId,
    name: file.name || "foto",
    type: file.type || "image/jpeg",
    size: file.size || 0,
    blob: file,
    derived_of: extra.derived_of || null,
    kind: extra.kind || "photo",
    created_at: nowISO(),
  };
  if (!src_sha256) { await put("attachments", rec); return rec; }
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction("attachments", "readwrite");
    let out = rec;
    const q = t.objectStore("attachments").getAll();
    q.onsuccess = () => {
      const same = q.result.find((a) => a.record_type === recordType && a.record_id === recordId && a.src_sha256 === src_sha256 && (a.kind || "photo") === rec.kind);
      if (same) out = { ...same, _existing: true };
      else t.objectStore("attachments").put(rec);
    };
    t.oncomplete = () => resolve(out);
    t.onabort = t.onerror = (event) => reject(transactionError(t, event));
  });
}
export async function attachmentsFor(recordType, recordId) {
  return (await getAll("attachments")).filter(
    (a) => a.record_type === recordType && a.record_id === recordId,
  );
}
export async function attachmentsCountMap() {
  const m = {};
  for (const a of await getAll("attachments"))
    m[a.record_id] = (m[a.record_id] || 0) + 1;
  return m;
}

// ---- v1→v2 kayıt seviyesi migration + ilk kurulum seed ----
export async function ensureSeeded() {
  let installId = await metaGet("device_install_id");
  if (!installId) {
    installId = uuid();
    await metaSet("device_install_id", installId);
  }

  // v1 seed (taze kurulum)
  if (!(await metaGet("seeded_v1"))) {
    for (const name of SEED_VEHICLES)
      await put(
        "vehicles",
        newRecord({
          name,
          type: "Araç/Makine",
          ownership: VEHICLE_OWNERSHIP[0],
          active: true,
        }),
      );
    for (const name of SEED_PERSONNEL)
      await put("personnel", newRecord({ name, role: "", active: true }));
    await metaSet("seeded_v1", true);
  }

  // v2 migration: v1 kayıtlarına eksik alanlar (kayıp alan YOK; yalnız ek alanlar, ids Dokunulmaz)
  if (!(await metaGet("migrated_v2"))) {
    for (const store of ENTITY_STORES) {
      for (const r of await getAll(store)) {
        let ch = false;
        const upd = { ...r };
        if (upd.schema_version == null) {
          upd.schema_version = 1;
          ch = true;
        }
        if (upd.migration_status == null) {
          upd.migration_status = "NOT_IMPORTED";
          ch = true;
        }
        if (upd.deleted_at === undefined) {
          upd.deleted_at = null;
          ch = true;
        }
        if (store === "work_records" && upd.slip_id === undefined) {
          upd.slip_id = null;
          ch = true;
        }
        if (store === "documents" && upd.ocr === undefined) {
          upd.ocr = { status: "YOK" };
          ch = true;
        }
        if (ch) await put(store, upd);
      }
    }
    // v2 varsayılan ayarlar (fiyatlar/KDV ayarlardan okunur — koda gömülü değil)
    if ((await metaGet("kdv_default")) == null)
      await metaSet("kdv_default", 20);
    if ((await metaGet("crane_first_hour")) == null)
      await metaSet("crane_first_hour", 9000);
    if ((await metaGet("crane_next_hour")) == null)
      await metaSet("crane_next_hour", 3000);

    // Alias seed (sahapro-domain kuralları)
    if (!(await metaGet("seeded_aliases_v2"))) {
      const vehs = await listActive("vehicles");
      const byName = {};
      for (const v of vehs) byName[v.name] = v.id;
      for (const [alias, targetName] of SEED_ALIASES) {
        if (byName[targetName])
          await put(
            "aliases",
            newRecord({
              alias,
              target_type: "vehicle",
              target_id: byName[targetName],
              active: true,
            }),
          );
      }
      await metaSet("seeded_aliases_v2", true);
    }

    // Başlangıç fiyat listesi (hakedis-engine örnekleri; kullanıcı düzenleyebilir)
    if (!(await metaGet("seeded_pricebook_v2"))) {
      const vehs = await listActive("vehicles");
      const vid = (n) => {
        const v = vehs.find((x) => x.name === n);
        return v ? v.id : null;
      };
      const seeds = [
        { work_type: "Hafriyat Nakliye", unit: "Sefer", price: 10000 },
        { work_type: "Moloz Nakliye", unit: "Sefer", price: 12500 },
        { vehicle_id: vid("DX225 / Yeni Makine"), unit: "Saat", price: 4000 },
        {
          vehicle_id: vid("DX225 / Yeni Makine"),
          unit: "Yevmiye",
          price: 25000,
        },
        { vehicle_id: vid("14 Tonluk Kato"), unit: "Yevmiye", price: 20000 },
        {
          vehicle_id: vid("Mobil Vinç"),
          unit: "Saat",
          formula: "CRANE_FIRST_HOUR",
        },
      ];
      for (const s of seeds) {
        await put(
          "price_book",
          newRecord({
            ...s,
            kdv_rate: 20,
            kdv_included: false,
            valid_from: null,
            valid_to: null,
            customer_id: null,
            site_id: null,
            active: true,
          }),
        );
      }
      await metaSet("seeded_pricebook_v2", true);
    }
    await metaSet("migrated_v2", true);
    await metaSet("schema_version_current", SCHEMA_VERSION);
  }
  if (!(await metaGet("migrated_business_v3"))) {
    const { documentOwner, OWNER_STORES } = await import("./business.js");
    for (const doc of await getAll("documents"))
      if (!doc.owner_type) {
        const expected = documentOwner(doc.category),
          candidates = ["vehicle", "personnel", "customer"].filter(
            (k) => doc[k + "_id"],
          );
        const type =
          expected && doc[expected + "_id"]
            ? expected
            : candidates.length === 1
              ? candidates[0]
              : null;
        const ownerId = type ? doc[type + "_id"] : null,
          exists = ownerId ? await get(OWNER_STORES[type], ownerId) : null;
        await put("documents", {
          ...doc,
          owner_type: exists ? type : null,
          owner_id: exists ? ownerId : null,
          needs_owner_review: !exists || candidates.length > 1,
        });
      }
    await metaSet("migrated_business_v3", true);
  }
  if (!(await metaGet("doc_dedupe_v1"))) {
    try { await dedupeDocuments(); } catch (e) { console.warn("Mükerrer belge temizliği", e); }
    await metaSet("doc_dedupe_v1", true);
  }
  await metaSet("schema_version_current", SCHEMA_VERSION);
  return installId;
}

// One readonly transaction: records, files and settings describe the same database state.
export async function readSnapshot({ attachments = true, meta = true, drafts = false } = {}) {
  const db = await openDB();
  const stores = [...ENTITY_STORES, ...(attachments ? ["attachments"] : []), ...(meta ? ["meta"] : []), ...(drafts ? ["drafts"] : [])];
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, "readonly");
    const out = { data: {}, attachments: [], meta: [], drafts: [], captured_at: null };
    for (const name of stores) {
      const request = t.objectStore(name).getAll();
      request.onsuccess = () => { if (ENTITY_STORES.includes(name)) out.data[name] = request.result; else out[name] = request.result; };
    }
    t.oncomplete = () => { out.captured_at = nowISO(); resolve(out); };
    t.onabort = t.onerror = () => reject(t.error || new Error("Veritabanı anlık görüntüsü okunamadı"));
  });
}
// All entities are read together, not one transaction per table.
export async function dumpAll() {
  return (await readSnapshot({ attachments: false, meta: false })).data;
}

// ---- kayıt yardımcıları ----
// ---- Kalıcı işlem kimliği (idempotent kayıt) ----
// op = { id, hash }: aynı kimlik + aynı içerik → mevcut kayıt döner (_existing), yeniden yazılmaz;
// aynı kimlik + farklı içerik → OP_CONFLICT. Kimlik kaydı, asıl kayıtla AYNI işlemde (transaction) yazılır.
export const OP = "op:";
export async function opHash(obj) {
  const canon = (x) => Array.isArray(x) ? x.map(canon) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canon(obj))));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}
export async function opLookup(id) {
  const x = await metaGet(OP + id);
  if (!x) return null;
  const rec = await get(x.store, x.record_id);
  return rec && !rec.deleted_at ? { ...x, record: rec } : null; // silinmiş kaydın kimliği yeniden kullanılabilir
}
const opConflict = (x) => Object.assign(Error("Bu kayıt daha önce farklı bilgilerle kaydedilmiş — o kaydı açıp düzeltin"), { code: "OP_CONFLICT", record_id: x.record_id, store: x.store });
// İşlem içinde: opReq (meta.get) sonucu → "new" | "same" | "conflict"; "same" ise mevcut kayıt okunur (cb ile)
function opDecide(t, opReq, op, onSame) {
  const x = opReq?.result?.value;
  if (!op || !x) return "new";
  if (x.hash !== op.hash) return "conflict";
  const r = t.objectStore(x.store).get(x.record_id);
  r.onsuccess = () => onSame(r.result && !r.result.deleted_at ? r.result : null);
  return "same";
}
const opPut = (t, op, store, recordId) => op && t.objectStore("meta").put({ key: OP + op.id, value: { hash: op.hash, store, record_id: recordId, at: nowISO() } });
async function putPlainOp(store, fields, auditReason, op) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction([store, "audit_log", "meta"], "readwrite");
    let rec = null, existing = null, error = null;
    const g = t.objectStore("meta").get(OP + op.id);
    g.onsuccess = () => {
      const st = opDecide(t, g, op, (r) => {
        if (r) { existing = r; return; }
        rec = newRecord(fields); t.objectStore(store).put(rec); opPut(t, op, store, rec.id);
        t.objectStore("audit_log").put({ id: uuid(), entity: store, entity_id: rec.id, action: "create", old: null, new: fields, reason: auditReason || "", at: nowISO() });
      });
      if (st === "conflict") { error = opConflict(g.result.value); t.abort(); return; }
      if (st === "new") {
        rec = newRecord(fields); t.objectStore(store).put(rec); opPut(t, op, store, rec.id);
        t.objectStore("audit_log").put({ id: uuid(), entity: store, entity_id: rec.id, action: "create", old: null, new: fields, reason: auditReason || "", at: nowISO() });
      }
    };
    t.oncomplete = () => {if(!existing)recordsCommitted(d.name,[store]);resolve(existing ? { ...existing, _existing: true } : rec);};
    t.onabort = t.onerror = (event) => reject(error || transactionError(t, event));
  });
}
export async function saveNew(store, fields, auditReason, { op = null } = {}) {
  if (store === 'work_records' && fields.plan_assignment_id) throw Error('Planlı iş, planla birlikte kaydedilmeli.');
  if(store==='pending_fuel_records')throw Error('Geçmiş yakıt yalnız açık onaylı toplu incelemeden oluşturulabilir.');
  if(store==='fuel_tank_movements'&&fields.fuel_record_id!=null)throw Error('Yakıt / depo eş bağlantısı yalnız yakıt işlemi içinde oluşturulabilir.');
  if(store==='expense_records'&&fields.dump_deposit&&fields.invoice_paid)throw Error('Döküm faturası kendiliğinden ödenmiş sayılamaz; gerçek yükleme veya açılış bakiyesi girin');
  if ((store === 'fuel_tank_movements' && fields.delivery_kind === 'customer_fuel') || (store === 'cari_movements' && fields.type === 'MazotTeslimi')) throw Error('Müşteri mazotu stok ve cariyle birlikte kaydedilmeli');
  if (store === "dump_entries") throw Error("Döküm işlemi ortak hesap ekranından yapılmalı");
  if (ENTERPRISE_STORES.includes(store) || ["inbox_messages","meter_readings","shift_assignments","custody_records","downtime_records","maintenance_parts","cost_allocations","bank_import_rows","stock_counts"].includes(store))
    throw Error("İşletme defteri ilgili işlem ekranından oluşturulmalı");
  if (store === "fuel_records") return saveFuelEvent(fields, auditReason, { op });
  if (store === "cash_records") return saveCashEvent(fields, { op });
  fields = await validateFields(store, fields);
  if (fields.driver_entry_id && ["work_records", "expense_records", "maintenance_records"].includes(store)) return putUniqueDriver(store, fields, auditReason);
  if (op && ["work_records", "expense_records", "maintenance_records"].includes(store)) return putPlainOp(store, fields, auditReason, op);
  if (store === "fuel_tank_movements" && fields.move_type === "ÇIKIŞ") {
    const fuel = await saveFuelEvent(
      { ...fields, fuel_source: "Depo Tankı" },
      auditReason,
    );
    return get("fuel_tank_movements", fuel.tank_movement_id);
  }
  if (store === "hakedis") return createHakedis(fields);
  if (store === "documents") await assertNotDuplicateDoc(fields);
  const rec = newRecord(fields);
  const connection=await openDB();
  await new Promise((resolve,reject)=>{
    const t=connection.transaction([...new Set([store,'audit_log'])],'readwrite');let error;
    const write=()=>{try{t.objectStore(store).put(rec);t.objectStore('audit_log').put({id:uuid(),entity:store,entity_id:rec.id,action:'create',old:null,new:fields,reason:auditReason||'',at:nowISO()});}catch(e){error=e;t.abort();}};
    if(store==='fuel_tank_movements'){const all=t.objectStore(store).getAll();all.onsuccess=()=>{try{assertTankChange(all.result,[...all.result,rec]);write();}catch(e){error=e;t.abort();}};}else write();
    t.oncomplete=()=>resolve();t.onerror=t.onabort=event=>reject(error||transactionError(t,event));
  });
  recordsCommitted(connection.name,[store]);
  return rec;
}

// The plan revision, actual work, operation receipt and both audit rows commit together.
export async function savePlannedWork(expectedPlan, fields) {
  if (!expectedPlan?.id || fields.plan_assignment_id !== expectedPlan.id || fields.driver_entry_id)
    throw Error('Plan ve iş kaynağı uyuşmuyor.');
  const identity = structuredClone(fields);
  if (identity.price_snapshot) delete identity.price_snapshot.snapshot_at;
  const op = { id: 'shift-work:' + expectedPlan.id, hash: await opHash(identity) };
  const prepared = await validateFields('work_records', fields);
  const references = {customer_id:'customers',site_id:'sites',vehicle_id:'vehicles',personnel_id:'personnel',contractor_id:'contractors',dump_site_id:'dump_sites',quarry_id:'quarries'};
  const stores = ['shift_assignments','work_records',...new Set(Object.values(references))];
  const connection = await openDB();
  return new Promise((resolve,reject) => {
    const t = connection.transaction([...stores,'meta','audit_log'],'readwrite');
    const receipt = t.objectStore('meta').get(OP + op.id);
    let result, error, wrote = false;
    readTransactionRows(t, stores, data => {
      try {
        const plan = data.shift_assignments.find(r => r.id === expectedPlan.id);
        const previous = receipt.result?.value;
        if (previous) {
          if (previous.hash !== op.hash || previous.store !== 'work_records') throw opConflict(previous);
          const work = data.work_records.find(r => r.id === previous.record_id && isActive(r));
          if (!work || !plan || !isActive(plan) || plan.status === 'İptal' || plan.work_record_id !== work.id || work.plan_assignment_id !== plan.id)
            throw Error('Önceki plan işleminin kaydı veya bağlantısı değişmiş; kayıtları inceleyin. Yeni iş oluşturulmadı.');
          result = {...work,_existing:true};
          return;
        }
        if (!plan || !isActive(plan) || plan.status !== 'Planlı' || plan.work_record_id)
          throw Error('Plan artık açık değil veya işe bağlanmış. Yeni iş oluşturulmadı.');
        if ([...new Set([...Object.keys(plan),...Object.keys(expectedPlan)])].some(k => changedField(plan,expectedPlan,k)))
          throw Error('Plan başka sekmede değişti. Güncel planı açıp tekrar kontrol edin; yeni iş oluşturulmadı.');
        if (data.work_records.some(r => isActive(r) && r.plan_assignment_id === plan.id))
          throw Error('Bu plana ait iş zaten var; bağlantıyı inceleyin. Yeni iş oluşturulmadı.');
        for (const [key,store] of Object.entries(references))
          if (prepared[key] && !data[store].some(r => r.id === prepared[key] && isActive(r)))
            throw Error('İlgili kayıt artık kullanılamıyor: ' + key);
        if (prepared.site_id && !data.sites.some(s => s.id === prepared.site_id && s.customer_id === prepared.customer_id))
          throw Error('Şantiye seçilen müşteriye ait değil.');
        result = newRecord(prepared);
        const updated = {...plan,status:'Tamamlandı',work_record_id:result.id,work_request_id:op.id,converted_at:nowISO(),updated_at:nowISO()};
        t.objectStore('work_records').add(result);
        t.objectStore('shift_assignments').put(updated);
        opPut(t,op,'work_records',result.id);
        for (const [entity,id,old,value] of [['work_records',result.id,null,result],['shift_assignments',plan.id,plan,updated]])
          t.objectStore('audit_log').add({id:uuid(),entity,entity_id:id,action:old?'update':'create',old,new:value,reason:'Planlı görevden onaylı iş',at:nowISO()});
        wrote = true;
      } catch (e) { error=e;t.abort(); }
    });
    t.oncomplete = () => {if(wrote)recordsCommitted(connection.name,['work_records','shift_assignments']);resolve(result);};
    t.onabort = t.onerror = event => reject(error || transactionError(t,event));
  });
}

// Doğrulanmış şoför kayıtları: imzası bu telefonda doğrulanan (security.checkPayloads) şoför kaydı kimlikleri.
// Şoför kimlikli (driver_entry_id) kayıt YALNIZ bu listedeyse yazılabilir — ekran atlatılsa, kayıt fonksiyonu doğrudan
// çağrılsa da imzasız / tanınmayan / iptal edilmiş paketten kayıt çıkmaz.
export const DRV_OK = "drv_ok:";
export async function markDriverVerified(entries) {
  if (!entries?.length) return;
  const d = await openDB();
  await new Promise((resolve, reject) => {
    const t = d.transaction("meta", "readwrite");
    for (const e of entries) t.objectStore("meta").put({ key: DRV_OK + e.id, value: { pid: e.pid || null, lid: e.lid || null, at: nowISO() } });
    t.oncomplete = resolve;
    t.onabort = t.onerror = (event) => reject(transactionError(t, event));
  });
}
// Bağlantı değişiklikleri iki sekmede birbirinin iptalini/yenisini ezemez.
export async function updateDriverLinks(change) {
  const db=await openDB();return new Promise((resolve,reject)=>{
    const t=db.transaction('meta','readwrite'),s=t.objectStore('meta'),q=s.get('driver_links');let out,error;
    q.onsuccess=()=>{try{out=change(q.result?.value||[]);if(!Array.isArray(out))throw Error('Bağlantı listesi geçersiz');s.put({key:'driver_links',value:out});}catch(e){error=e;t.abort();}};
    t.oncomplete=()=>resolve(out);t.onabort=t.onerror=(event) => reject(error || transactionError(t, event));
  });
}
// İmza doğrulama ile Kaydet arasındaki iptal/pasifleştirme de son transaction'da görülür.
function driverProofRequests(t,id,expectedPid=null) {
  const marker=t.objectStore('meta').get(DRV_OK+id),links=t.objectStore('meta').get('driver_links'),people=t.objectStore('personnel').getAll();
  return ()=>{
    const proof=marker.result?.value;
    if(!proof?.pid||!proof.lid||(expectedPid&&proof.pid!==expectedPid))return false;
    const link=(links.result?.value||[]).find(x=>x.lid===proof.lid&&x.pid===proof.pid),person=people.result.find(x=>x.id===proof.pid);
    return linkVerdict(link,{today:todayStr(),personnelActive:!!person&&!person.deleted_at&&person.active!==false}).ok;
  };
}
const unverifiedDriver = () => Object.assign(Error("Şoför kaydı doğrulanmamış (imzasız / tanınmayan / iptal edilmiş bağlantı) — kaydedilemez"), { code: "UNVERIFIED_DRIVER" });
// Şoför kaydı (driver_entry_id) bir kez yazılır: denetim ve yazma TEK işlemde (IndexedDB aynı depoya yazan işlemleri sıraya koyar)
async function putUniqueDriver(store, fields, auditReason) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction([store, "audit_log", "meta", "personnel"], "readwrite");
    let rec = null, error = null;
    const verified = driverProofRequests(t,fields.driver_entry_id);
    const q = t.objectStore(store).getAll();
    q.onsuccess = () => {
      if (!verified()) { error = unverifiedDriver(); t.abort(); return; }
      if (q.result.some((x) => isActive(x) && x.driver_entry_id === fields.driver_entry_id)) { error = Object.assign(Error("Şoför kaydı zaten alınmış"), { code: "DUP_DRIVER" }); t.abort(); return; }
      rec = newRecord(fields);
      t.objectStore(store).put(rec);
      t.objectStore("audit_log").put({ id: uuid(), entity: store, entity_id: rec.id, action: "create", old: null, new: fields, reason: auditReason || "", at: nowISO() });
    };
    t.oncomplete = () => {recordsCommitted(d.name,[store]);resolve(rec);};
    t.onabort = t.onerror = (event) => reject(error || transactionError(t, event));
  });
}

// All transport rows commit together; invalid rows cannot leave a partial job.
export async function saveWorkBatch(rows) {
  if (!Array.isArray(rows) || rows.length < 2)
    throw Error("En az iki satır gerekli");
  const first = rows[0];
  if (
    rows.some(
      (r) =>
        r.customer_id !== first.customer_id ||
        r.site_id !== first.site_id ||
        r.date !== first.date ||
        r.work_type !== first.work_type ||
        r.unit !== "Sefer",
    ) ||
    !["Hafriyat Nakliye", "Moloz Nakliye", "Çöp Nakliye", "Mıcır Nakliye", "Kum Nakliye", "Gravak Nakliye"].includes(
      first.work_type,
    )
  )
    throw Error(
      "Satırlar aynı müşteri, şantiye, tarih ve nakliye işine ait olmalı",
    );
  const batch = uuid(),
    validated = [];
  for (const [index, row] of rows.entries()) {
    if (!row.dump_site_id && !row.dump_area?.trim())
      throw Error("Her satır için döküm yeri seçin");
    if (!Number.isInteger(Number(row.quantity)))
      throw Error("Sefer miktarı tam sayı olmalı");
    if (
      row.distance_km != null &&
      (!Number.isFinite(Number(row.distance_km)) || Number(row.distance_km) < 0)
    )
      throw Error("Mesafe geçersiz");
    if (
      row.price_snapshot &&
      (!Number.isFinite(Number(row.price_snapshot.unit_price)) ||
        Number(row.price_snapshot.unit_price) < 0 ||
        !Number.isFinite(Number(row.price_snapshot.kdv_rate)) ||
        Number(row.price_snapshot.kdv_rate) < 0 ||
        Number(row.price_snapshot.kdv_rate) > 100)
    )
      throw Error("Satır fiyatı veya KDV geçersiz");
    const fields = await validateFields("work_records", row);
    validated.push(
      newRecord({ ...fields, work_batch_id: batch, batch_row: index + 1 }),
    );
  }
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction(["work_records", "audit_log"], "readwrite");
    for (const rec of validated) {
      t.objectStore("work_records").add(rec);
      t.objectStore("audit_log").add(
        newRecord({
          entity: "work_records",
          entity_id: rec.id,
          action: "create",
          old: null,
          new: rec,
          at: nowISO(),
          reason: "Çok satırlı nakliye girişi",
        }),
      );
    }
    t.oncomplete = () => {recordsCommitted(d.name,["work_records"]);resolve(validated);};
    t.onabort = t.onerror = () =>
      reject(t.error || Error("Satırlar kaydedilemedi"));
  });
}

export async function saveWorkSlip(fields, workIds) {
  if (
    !Array.isArray(workIds) ||
    !workIds.length ||
    new Set(workIds).size !== workIds.length
  )
    throw Error("Fiş için geçerli işler gerekli");
  fields = await validateFields("slips", fields);
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction(["slips", "work_records"], "readwrite");
    const rows = [],
      rec = newRecord({
        ...fields,
        work_record_id: workIds[0],
        work_record_ids: workIds,
      });
    let error;
    for (const id of workIds) {
      const req = t.objectStore("work_records").get(id);
      req.onsuccess = () => {
        rows.push(req.result);
        if (rows.length !== workIds.length) return;
        if (
          rows.some(
            (w) =>
              !w ||
              !isActive(w) ||
              w.slip_id ||
              w.customer_id !== fields.customer_id ||
              (w.site_id || null) !== (fields.site_id || null) ||
              w.date !== fields.date ||
              w.unit !== fields.unit ||
              w.work_type !== fields.work_text,
          ) ||
          rows.some((w) => w.work_batch_id !== rows[0].work_batch_id) ||
          (rows.length > 1 && !rows[0].work_batch_id) ||
          rows.reduce((sum, w) => sum + Number(w.quantity), 0) !==
            Number(fields.quantity)
        ) {
          error = Error(
            "Fiş işleri değişmiş, başka fişe bağlı veya miktar/müşteri uyuşmuyor",
          );
          t.abort();
          return;
        }
        // Frozen, whitelisted customer lines; neither owner-private fields nor dump locations enter the slip.
        rec.customer_items = rows.map((w) => ({
          date: w.date,
          customer_id: w.customer_id,
          site_id: w.site_id,
          work_type: w.work_type,
          material: w.material || "",
          quantity: w.quantity,
          unit: w.unit,
          unit_price: w.price_snapshot?.unit_price ?? null,
          kdv_rate: w.price_snapshot?.kdv_rate ?? 20,
          kdv_included: !!w.price_snapshot?.kdv_included,
        }));
        t.objectStore("slips").add(rec);
        for (const w of rows)
          t.objectStore("work_records").put({
            ...w,
            slip_id: rec.id,
            updated_at: nowISO(),
          });
      };
    }
    t.oncomplete = () => resolve(rec);
    t.onabort = t.onerror = (event) => reject(error || transactionError(t, event));
  });
}

const DEPENDENT = {
  customer_id: ["site_id", "price_snapshot", "contractor_id"], site_id: ["customer_id", "price_snapshot"],
  unit: ["quantity", "price_snapshot"], quantity: ["unit"], price_snapshot: ["customer_id", "site_id", "unit", "work_type"], work_type: ["price_snapshot", "unit"],
  vehicle_id: ["contractor_id", "vehicle_type", "personnel_id"], personnel_id: ["vehicle_id"],
  amount: ["kdv_rate", "net_amount", "kdv_amount", "total"], kdv_rate: ["amount", "net_amount", "kdv_amount"], net_amount: ["amount", "kdv_rate", "kdv_amount"], kdv_amount: ["amount", "kdv_rate", "net_amount"],
  liters: ["unit_price", "total"], unit_price: ["liters", "total"], total: ["liters", "unit_price", "amount"],
  cash_type: ["amount", "customer_id"], date: [],
};
export async function saveExisting(store, rec, fields, auditReason, _retry = 0, options = {}) {
  if(store==='pending_fuel_records')throw Error('Geçmiş yakıt yalnız mutabakat incelemesinden değiştirilebilir.');
  const delta = fields; // çağıranın değiştirmek istediği alanlar (çakışma denetimi bunlara bakar)
  if (store === "dump_entries") throw Error("Döküm işlemi ortak hesap ekranından yapılmalı");
  if (ENTERPRISE_STORES.includes(store) || ["inbox_messages","meter_readings","shift_assignments","custody_records","downtime_records","maintenance_parts","cost_allocations","bank_import_rows","stock_counts"].includes(store))
    throw Error("İşletme defteri ilgili işlem ekranından güncellenmeli");
  if ((await getAll("maintenance_parts")).some(r => isActive(r) && r.tracking && r.cost_source_store === store && r.cost_source_id === rec.id) && Object.keys(fields).some(k => ['amount','total','cost','kdv_rate','date','vehicle_id','site_id','customer_id'].includes(k))) throw Error('Parça / garanti kaydına bağlı maliyet değiştirilemez; önce parça ekranından bağlantıyı kaldırın');
  const current = await get(store, rec.id);
  if(store==='fuel_tank_movements'&&current?.fuel_record_id&&Object.keys(fields).some(k=>['date','liters','move_type','vehicle_id','personnel_id','fuel_record_id','event_id','deleted_at'].includes(k)&&(k==='liters'?Number(fields[k])!==Number(current[k]):JSON.stringify(fields[k]??null)!==JSON.stringify(current[k]??null))))throw Error('Yakıt kaydına bağlı depo hareketi tek başına değiştirilemez; yakıt kaydını kontrol edin.');
  if(store==='fuel_records'&&current?.tank_movement_id&&Object.keys(fields).some(k=>['date','liters','fuel_source','vehicle_id','tank_movement_id','event_id','deleted_at'].includes(k)&&(k==='liters'?Number(fields[k])!==Number(current[k]):JSON.stringify(fields[k]??null)!==JSON.stringify(current[k]??null))))throw Error('Depoya bağlı yakıtın tarihi, litresi veya kaynağı tek başına değiştirilemez; yanlışsa yakıt işlemini silip doğru bilgilerle yeniden girin.');
  if (store === "work_records") for (const key of ["dump_tariff_snapshot", "dump_estimate_snapshot"])
    if (key in fields && JSON.stringify(fields[key]) !== JSON.stringify(current?.[key]))
      throw Error("Döküm tarife / tahmin kopyası doğrudan değiştirilemez");
  if ((store === 'fuel_tank_movements' && (current?.delivery_kind === 'customer_fuel' || fields.delivery_kind === 'customer_fuel')) || (store === 'cari_movements' && (current?.type === 'MazotTeslimi' || fields.type === 'MazotTeslimi'))) throw Error('Müşteri mazotu tek başına değiştirilemez; Depo ekranından teslimi iptal edip doğru bilgilerle yeniden kaydedin');
  // Şoför kaydı kimliği sonradan eklenemez / değiştirilemez (doğrulanmamış kayıt "şoför kaydı" gibi gösterilmesin)
  if ("driver_entry_id" in fields && (fields.driver_entry_id || null) !== (current?.driver_entry_id || null)) throw Error("Şoför kaydı kimliği değiştirilemez");
  if (store === "sites" && (current?.deal?.measurement || current?.deal?.charge) && (("deal" in fields && (JSON.stringify(fields.deal?.measurement || null) !== JSON.stringify(current.deal.measurement || null) || JSON.stringify(fields.deal?.charge || null) !== JSON.stringify(current.deal.charge || null) || Number(fields.deal?.price) !== Number(current.deal.price) || Number(fields.deal?.kdv_rate) !== Number(current.deal.kdv_rate) || !!fields.deal?.kdv_included !== !!current.deal.kdv_included || fields.deal?.basis !== current.deal.basis)) || ("customer_id" in fields && fields.customer_id !== current.customer_id)))
    throw Error("Ölçümü cariye yazılmış iş değiştirilemez; yanlışsa caride düzeltme kaydı açın");
  if(store==='fuel_tank_movements'&&current?.count_id)throw Error("Sayım hareketi tek başına değiştirilemez; yeni fiziksel sayım yapın");
  if((await getAll('cost_allocations')).some(r=>isActive(r)&&r.status==='Aktif'&&r.source_store===store&&r.source_id===rec.id)&&Object.keys(fields).some(k=>['amount','total','cost','kdv_rate','date','vehicle_id','site_id','customer_id'].includes(k)))throw Error('Maliyeti değiştirmeden önce dağıtımı iptal edin');
  if (
    current?.bank_movement_id &&
    Object.keys(fields).some((k) =>
      [
        "amount",
        "date",
        "customer_id",
        "personnel_id",
        "bank_account_id",
        "bank_movement_id",
        "payment_method",
        "cash_type",
      ].includes(k),
    )
  )
    throw Error("Bankaya bağlı hareket tek başına değiştirilemez");
  if (
    (store === "contracts" && current?.status === "İmzalandı") ||
    (store === "hakedis" && current?.status === "Kesinleşti") ||
    (store === "work_records" &&
      current?.price_snapshot?.locked &&
      Object.keys(fields).some((k) =>
        [
          "date",
          "customer_id",
          "site_id",
          "vehicle_id",
          "personnel_id",
          "work_type",
          "material",
          "quantity",
          "unit",
          "price_snapshot",
          "time_start",
          "time_end",
          "break_minutes",
        ].includes(k),
      )) ||
    (store === "slips" &&
      (current?.signed_at || current?.status === "İmzalandı") &&
      !(fields.status === "Revize" && Object.keys(fields).length === 1))
  )
    throw Error("Kesinleşmiş kayıt değiştirilemez; revizyon oluşturun");
  if (
    store === "work_records" &&
    current?.work_batch_id &&
    current?.slip_id &&
    Object.keys(fields).some((k) =>
      [
        "date",
        "customer_id",
        "site_id",
        "work_type",
        "quantity",
        "unit",
        "material",
        "price_snapshot",
      ].includes(k),
    )
  )
    throw Error(
      "Toplu fişe bağlı iş değiştirilemez; düzeltme için yeni iş ve fiş oluşturun",
    );
  if (
    ["expense_records", "fuel_records", "maintenance_records"].includes(
      store,
    ) &&
    Object.keys(fields).some((k) =>
      [
        "date",
        "amount",
        "total",
        "total_amount",
        "cost",
        "liters",
        "unit_price",
        "kdv_rate",
        "vehicle_id",
        "personnel_id",
        "customer_id",
        "site_id",
      ].includes(k),
    ) &&
    (await listActive("payables")).some(
      (b) =>
        b.status !== "İptal" &&
        b.source_store === store &&
        b.source_id === rec.id,
    )
  )
    throw Error(
      "Alış belgesine bağlı maliyet değiştirilemez; borç kaydını inceleyin",
    );
  // Fiyat kuralı geçmişi: fiyat / KDV / geçerlilik değişince eski hâl kuralın üstünde saklanır (hangi tarihte ne fiyat vardı)
  if (store === "price_book" && current) {
    const H = ["price", "kdv_rate", "kdv_included", "valid_from", "valid_to", "first_hour_price", "next_hour_price", "formula"];
    if (H.some((k) => k in fields && String(fields[k] ?? "") !== String(current[k] ?? ""))) {
      const old = Object.fromEntries(H.map((k) => [k, current[k] ?? null]));
      fields = { ...fields, price_history: [...(current.price_history || []), { ...old, until: nowISO(), reason: auditReason || "" }].slice(-50) };
    }
  }
  fields = await validateFields(store, { ...current, ...fields }, current);
  if(store==="dump_sites" && ["fee","fee_unit","fee_effective_from"].some(k=>k in delta && String(delta[k]??"")!==String(current[k]??""))) return (await import("./dump-ledger-db.js")).changeDumpTariff(rec,fields,auditReason);
  const upd = {
    ...touchRecord(rec),
    ...fields,
    id: rec.id,
    created_at: rec.created_at,
    source: rec.source,
    schema_version: rec.schema_version,
    migration_status: rec.migration_status,
    deleted_at: rec.deleted_at,
    // Sürüm damgası her güncellemede yenilenir (önceden birleşen alanlar eski damgayı geri yazıyordu → çakışma görünmüyordu)
    updated_at: nowISO(),
  };
  // Eşzamanlı düzenleme: ekranın yüklediği sürüm (rec.updated_at) veritabanındakiyle aynı değilse yazılmaz — eski ekran
  // başka sekmede/ekranda yapılan değişikliği ezemez. Okuma-karşılaştırma-yazma TEK transaction'da.
  const d = await openDB();
  const wrote = await new Promise((resolve, reject) => {
    const guardStores = financeGuardStores(store, delta);
    const t = d.transaction([...new Set([store, "audit_log", "maintenance_parts", "dump_entries", ...guardStores, ...(store==="dump_sites"&&delta.own_yard?["work_records","expense_records"]:[])])], "readwrite");
    let error = null;
    if(store==='fuel_tank_movements'){const all=t.objectStore(store).getAll();all.onsuccess=()=>{try{assertTankChange(all.result,all.result.map(m=>m.id===upd.id?upd:m));}catch(e){error=e;t.abort();}};}
    if(store==="dump_sites"&&delta.own_yard)for(const s of ["work_records","expense_records"]){const q=t.objectStore(s).getAll();q.onsuccess=()=>{if(q.result.some(r=>isActive(r)&&r.dump_site_id===rec.id)){error=Error("Geçmişi olan döküm sahası iç depoya çevrilemez");t.abort();}};}
    const dumpCheck = t.objectStore("dump_entries").getAll();
    dumpCheck.onsuccess=()=>{
      const key={expense_records:"expense_id",work_records:"work_record_id"}[store];
      const protectedKeys=store==="work_records"?["date","quantity","unit","vehicle_id","customer_id","site_id","dump_site_id","dump_cost","dump_tariff_snapshot","dump_estimate_snapshot","tonnage","tonnage_scope","dump_payer"]:["amount","date","vehicle_id","dump_site_id","dump_deposit","dump_entry_id","invoice_paid","deleted_at"];
      if(key&&Object.keys(delta).some(k=>protectedKeys.includes(k))&&dumpCheck.result.some(e=>isActive(e)&&e[key]===rec.id)){error=Error("Döküm fişine/yüklemesine bağlı kayıt burada değiştirilemez; önce ortak hesaptaki işlemi inceleyin");t.abort();}
      if(store==="dump_sites"&&delta.own_yard&&dumpCheck.result.some(e=>isActive(e)&&e.dump_site_id===rec.id)){error=Error("Hareketi olan saha iç depoya çevrilemez");t.abort();}
    };
    const partCheck = t.objectStore("maintenance_parts").getAll();
    partCheck.onsuccess = () => {
      if (Object.keys(delta).some(k => ['amount','total','cost','kdv_rate','date','vehicle_id','site_id','customer_id'].includes(k)) && partCheck.result.some(r => isActive(r) && r.tracking && r.cost_source_store === store && r.cost_source_id === rec.id)) { error = Error("Parça / garanti kaydına bağlı maliyet değiştirilemez; önce bağlantıyı kaldırın"); t.abort(); }
    };
    const g = t.objectStore(store).get(rec.id);
    g.onsuccess = () => {
      const now = g.result;
      readTransactionRows(t, guardStores, guardData => {
      try { assertFinancialEdit(store, now, upd, delta, guardData); }
      catch (e) { error = e; t.abort(); return; }
      if (options.strict && (!now || now.deleted_at || JSON.stringify(now) !== JSON.stringify(rec))) {
        error = Object.assign(Error("Kayıt önizlemeden sonra değişti; yeniden önizleyin."), { code:"STALE" });
        t.abort(); return;
      }
      if (rec.updated_at && now && now.updated_at && now.updated_at !== rec.updated_at) {
        // Arada başka yazım olmuş. Sizin değiştirdiğiniz alanlardan biri de değiştiyse: ÇAKIŞMA (ezilmez).
        // Yalnız başka alanlar değiştiyse: güncel kayıt üzerine yeniden uygulanır (aşağıda, doğrulama yeniden çalışır).
        const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
        // Bağlı alanlar: biri değişince diğeriyle birlikte anlam taşır (müşteri↔şantiye↔fiyat, miktar↔birim, birim↔fiyat,
        // tutar↔KDV…). Alan adları farklı diye bunlar otomatik birleştirilmez → çakışma. Miktar ile fiyat bağımsızdır:
        // birleşince tutar, doğrulamada (validateFields) birim fiyat × miktar olarak yeniden hesaplanır.
        // Türetilen değerler (fiyat snapshot'ındaki tutar = birim fiyat × miktar) "değişiklik" sayılmaz; yeniden hesaplanır
        const core = (k, v) => (k === "price_snapshot" && v && typeof v === "object" ? (({ amount, snapshot_at, ...x }) => x)(v) : v);
        const changedByOther = new Set(Object.keys({ ...now, ...rec }).filter((k) => k !== "updated_at" && !same(core(k, now[k]), core(k, rec[k]))));
        const overlap = Object.keys(delta || {}).filter((k) => changedByOther.has(k) || (DEPENDENT[k] || []).some((x) => changedByOther.has(x)));
        error = overlap.length || _retry >= 2
          ? Object.assign(Error("Bu kayıt, siz açtıktan sonra başka bir ekranda / sekmede değiştirildi. Sayfayı yenileyip değişikliği yeniden yapın."), { code: "STALE", current: now, mine: upd, fields: overlap })
          : Object.assign(Error("rebase"), { code: "REBASE", current: now });
        t.abort();
        return;
      }
      // Damga kesin artan: aynı milisaniyedeki iki yazım da farklı sürüm olur
      if (now?.updated_at && upd.updated_at <= now.updated_at) upd.updated_at = new Date(Date.parse(now.updated_at) + 1).toISOString();
      t.objectStore(store).put(upd);
      t.objectStore("audit_log").put({ id: uuid(), entity: store, entity_id: rec.id, action: "update", old: rec ?? null, new: fields ?? null, reason: auditReason || "", at: nowISO() });
      });
    };
    t.oncomplete = resolve;
    t.onabort = t.onerror = (event) => reject(error || transactionError(t, event));
  }).catch((e) => { if (e?.code === "REBASE") return e; throw e; });
  if (wrote?.code === "REBASE") return saveExisting(store, wrote.current, delta, auditReason, _retry + 1);
  recordsCommitted(d.name,[store]);
  return upd;
}

let backupPromise;
function backupBeforeUpgrade() {
  if (backupPromise) return backupPromise;
  backupPromise = (async () => {
    const databases =
      typeof indexedDB.databases === "function"
        ? await indexedDB.databases()
        : null;
    const info = databases?.find((d) => d.name === dbName());
    if (databases && (!info || info.version >= DB_VERSION)) return;
    const old = await new Promise((res, rej) => {
      const r = indexedDB.open(dbName());
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const stores = [...old.objectStoreNames],
      snapshot = {
        id: dbName() + "-v" + old.version + "-" + nowISO(),
        version: old.version,
        created_at: nowISO(),
        stores: {},
      };
    await new Promise((res, rej) => {
      const t = old.transaction(stores, "readonly");
      for (const name of stores) {
        const r = t.objectStore(name).getAll();
        r.onsuccess = () => (snapshot.stores[name] = r.result);
      }
      t.oncomplete = res;
      t.onerror = (event) => rej(transactionError(t, event));
    });
    old.close();
    const recovery = await new Promise((res, rej) => {
      const r = indexedDB.open(dbName() + "_recovery", 1);
      r.onupgradeneeded = () =>
        r.result.createObjectStore("snapshots", { keyPath: "id" });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const t = recovery.transaction("snapshots", "readwrite");
      t.objectStore("snapshots").put(snapshot);
      t.oncomplete = res;
      t.onerror = (event) => rej(transactionError(t, event));
    });
    recovery.close();
  })();
  return backupPromise;
}
// Form/model girişinde sayısal alanların boolean/nesne/Infinity olarak yazılmasını önle.
function assertNumericFields(f) {
  const keys=['quantity','liters','amount','unit_price','total','total_amount','cost','kdv_rate','price','first_hour_price','next_hour_price'];
  for(const key of keys){const v=f?.[key];if(v==null||v==='')continue;
    if(!['number','string'].includes(typeof v)||typeof v==='string'&&!v.trim()||!Number.isFinite(Number(v))||Math.abs(Number(v))>1e12)
      throw Error('Sayısal alan geçersiz veya sınırı aşıyor: '+key);
  }
  if(f?.price_snapshot){
    if(typeof f.price_snapshot!=='object'||Array.isArray(f.price_snapshot))throw Error('Fiyat bilgisi geçersiz');
    for(const key of keys){const v=f.price_snapshot[key];if(v==null||v==='')continue;
      if(!['number','string'].includes(typeof v)||typeof v==='string'&&!v.trim()||!Number.isFinite(Number(v))||Math.abs(Number(v))>1e12)throw Error('Fiyat alanı geçersiz veya sınırı aşıyor: '+key);
    }
    if(f.price_snapshot.kdv_included!=null&&typeof f.price_snapshot.kdv_included!=='boolean')throw Error('KDV dahil/hariç bilgisi geçersiz');
  }
}
async function validateFields(store, fields, previous = null) {
  assertNumericFields(fields);
  const f = { ...fields };
  // Only new/explicitly changed estimate inputs are validated here. An ordinary
  // note edit must not rewrite or reinterpret an old, unverified record.
  const dumpNumbers = store === "work_records" ? ["tonnage", "dump_cost"] : store === "vehicles" ? ["load_ton"] : [];
  for (const key of dumpNumbers) {
    const value = f[key];
    if (previous && JSON.stringify(value ?? null) === JSON.stringify(previous[key] ?? null)) continue;
    if (value == null || value === "") continue;
    if (!["string", "number"].includes(typeof value) || !String(value).trim() ||
        !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1e12)
      throw Error("Döküm tonajı / tahmin tutarı geçersiz: " + key);
  }
  if (store === "work_records" && f.tonnage_scope != null &&
      (!previous || f.tonnage_scope !== previous.tonnage_scope) &&
      !["unknown", "total", "per_trip"].includes(f.tonnage_scope))
    throw Error("Tonajın kapsamı geçersiz; bilinmiyor, toplam veya sefer başı seçin");
  if(['fuel_records','fuel_tank_movements'].includes(store)&&typeof f.date==='string'&&f.date>todayStr())throw Error('Gerçek yakıt / depo tarihi gelecekte olamaz');
  if(store==='fuel_tank_movements'&&(!['GİRİŞ','ÇIKIŞ'].includes(f.move_type)||!(Number(f.liters)>0)))throw Error('Depo için GİRİŞ / ÇIKIŞ ve pozitif litre zorunlu');
  if (f.date) {
    const parsed = new Date(f.date + "T12:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(f.date) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== f.date
    )
      throw Error("Geçerli tarih girin");
  }
  if (
    [
      "work_records",
      "fuel_records",
      "fuel_tank_movements",
      "cash_records",
      "expense_records",
      "maintenance_records",
      "personnel_events",
    ].includes(store) &&
    !f.date
  )
    throw Error("Tarih zorunlu");
  for (const [key, target] of Object.entries({
    customer_id: "customers",
    vehicle_id: "vehicles",
    personnel_id: "personnel",
    contractor_id: "contractors",
    dump_site_id: "dump_sites",
    quarry_id: "quarries",
  })) {
    if (f[key]) {
      const owner = await get(target, f[key]);
      if (!owner || owner.deleted_at)
        throw Error("İlgili kayıt bulunamadı: " + key);
    }
  }
  if (
    store === "expense_records" &&
    (!(Number(f.amount) >= 0.01) ||
      (f.payment_method === "Personel Ödedi" && !f.personnel_id))
  )
    throw Error("Pozitif gider tutarı ve personel ödemesinde personel zorunlu");
  if (f.site_id) {
    const site = await get("sites", f.site_id);
    if (
      !site ||
      site.deleted_at ||
      !f.customer_id ||
      site.customer_id !== f.customer_id
    )
      throw Error("Şantiye seçilen müşteriye ait değil");
  }
  if (store === "documents") {
    const { normalizedDocument, OWNER_STORES } = await import("./business.js");
    const d = normalizedDocument(f);
    if (d.owner_type === "company") await ensureCompany();
    const owner = await get(OWNER_STORES[d.owner_type], d.owner_id);
    if (!owner || owner.deleted_at) throw Error("Belge sahibi bulunamadı");
    return d;
  }
  if (store === "cash_records") {
    if (!(Number(f.amount) >= 0.01))
      throw Error("Tahsilat/kasa tutarı pozitif olmalı");
    if (f.cash_type === "Müşteriden Para Alındı" && !f.customer_id)
      throw Error("Tahsilat için müşteri zorunlu");
    if (f.cash_status === "PERSONELDE" && !f.personnel_id)
      throw Error("Personeldeki para için personel seçin");
  }
  if (
    store === "cari_movements" &&
    (!Number.isFinite(Number(f.amount)) ||
      (f.type === "Duzeltme" && !f.reason?.trim()))
  )
    throw Error("Cari tutarı veya düzeltme nedeni geçersiz");
  if (store === "work_records" && (f.dump_site_id || Number(f.dump_cost) > 0 || f.dump_estimate_snapshot || f.dump_tariff_snapshot || previous?.dump_estimate_snapshot || previous?.dump_tariff_snapshot)) {
    const dumpSite = f.dump_site_id ? await get("dump_sites", f.dump_site_id) : null;
    // Never turn an unverified historical basis into a newly captured fact on edit.
    if (!previous || previous.dump_tariff_snapshot) {
      const tariff = freezeDumpTariff(f, dumpSite, previous);
      if (tariff) f.dump_tariff_snapshot = tariff;
      else delete f.dump_tariff_snapshot;
    }
    const estimate = freezeDumpEstimate(f, dumpSite, f.vehicle_id ? await get("vehicles", f.vehicle_id) : null, previous);
    if (estimate) f.dump_estimate_snapshot = estimate;
    else delete f.dump_estimate_snapshot;
  }
  if (store === "work_records") {
    if (f.time_start || f.time_end) {
      if (f.unit !== "Saat")
        throw Error("Saat puantajı yalnız Saat biriminde kullanılabilir");
      const hours = workHours(f.time_start, f.time_end, f.break_minutes || 0);
      if (Math.abs(hours - Number(f.quantity)) > 0.0001)
        throw Error(
          "Puantaj ile saat miktarı aynı olmalı; Saat Miktarını Hesapla kullanın",
        );
    }
    if (
      !f.customer_id ||
      !f.vehicle_id ||
      !f.work_type ||
      !(Number(f.quantity) > 0)
    )
      throw Error("Müşteri, araç, iş türü ve pozitif miktar zorunlu");
  }
  if (
    ["expense_records", "fuel_records", "maintenance_records"].includes(
      store,
    ) &&
    f.kdv_rate != null &&
    (!Number.isFinite(Number(f.kdv_rate)) ||
      Number(f.kdv_rate) < 0 ||
      Number(f.kdv_rate) > 100)
  )
    throw Error("KDV 0–100 aralığında olmalı");
  if (store === "maintenance_records" && !f.vehicle_id)
    throw Error("Bakım/arıza araca bağlanmalı");
  if (store === "price_book") {
    const { PRICE_VEHICLE_GROUPS } = await import("./core.js");
    if (
      f.vehicle_group &&
      (!PRICE_VEHICLE_GROUPS[f.vehicle_group] || f.vehicle_id || f.vehicle_type)
    )
      throw Error(
        "Araç grubu, belirli plaka ve tür aynı fiyat kuralında birlikte seçilemez",
      );
    if (f.site_id && !f.customer_id)
      throw Error("Şantiye fiyatında müşteri zorunlu");
    if (
      f.distance_min != null &&
      f.distance_max != null &&
      Number(f.distance_min) > Number(f.distance_max)
    )
      throw Error("Mesafe aralığı geçersiz");
  }
  if (
    ["fuel_records", "fuel_tank_movements"].includes(store) &&
    !(Number(f.liters) > 0)
  )
    throw Error("Litre sıfırdan büyük olmalı");
  if (
    store === "work_records" &&
    f.price_snapshot &&
    !f.price_snapshot.locked
  ) {
    const { priceForQuantity } = await import("./core.js");
    f.price_snapshot = {
      ...f.price_snapshot,
      amount: priceForQuantity(
        { ...f.price_snapshot, price: f.price_snapshot.unit_price },
        f.quantity,
        {
          first: f.price_snapshot.first_hour_price,
          next: f.price_snapshot.next_hour_price,
        },
      ),
    };
  }
  assertNumericFields(f);
  return f;
}
// Dış alıcıya teslim: stok çıkışı + TL cari borcu + işlem kimliği tek transaction.
// Şirket aracına yakıt tüketimi veya müşteriden alınan mazot kaydı OLUŞTURMAZ.
export async function saveCustomerFuelDelivery(fields, reason = 'Müşteriye mazot teslimi', {op = null} = {}) {
  const f = customerFuelFields(fields);
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction(['customers','fuel_tank_movements','cari_movements','meta','audit_log'], 'readwrite');
    let result, error;
    const customer = t.objectStore('customers').get(f.customer_id);
    const prior = op ? t.objectStore('meta').get(OP + op.id) : null;
    const all = t.objectStore('fuel_tank_movements').getAll();
    all.onsuccess = () => {
      const fail = e => {error = e; t.abort();};
      const write = () => {
        try {
          if (!customer.result || !isActive(customer.result) || customer.result.active === false || customer.result.internal) throw Error('Mazotu alan aktif müşteri bulunamadı');
          const remaining = all.result.filter(isActive).reduce((s,m) => s + (m.move_type === 'GİRİŞ' ? 1 : -1) * Number(m.liters), 0);
          if (!Number.isFinite(remaining)) throw Error('Depo stoku hesaplanamadı; kayıtları kontrol edin');
          if (f.liters > remaining + 0.000001) throw Error('Tank stokundan fazla teslim: kalan ' + remaining + ' L');
          const event_id = uuid(), cari = newRecord({date:f.date, customer_id:f.customer_id, type:'MazotTeslimi', amount:f.total, event_id,
            note:`${f.machine} · ${f.liters} L mazot × ${f.unit_price.toLocaleString('tr-TR', {maximumFractionDigits:6})} ₺/L`});
          const move = newRecord({date:f.date, move_type:'ÇIKIŞ', delivery_kind:'customer_fuel', recipient_customer_id:f.customer_id,
            recipient_machine:f.machine, liters:f.liters, charge_unit_price:f.unit_price, charge_total:f.total,
            cari_movement_id:cari.id, event_id, note:f.note,...(fields.assistant_origin?.version===1?{assistant_origin:fields.assistant_origin}:{})});
          assertTankChange(all.result,[...all.result,move]);
          cari.ref_id = move.id;
          validateCustomerFuelLinks({fuel_tank_movements:[move], cari_movements:[cari]});
          t.objectStore('fuel_tank_movements').put(move); t.objectStore('cari_movements').put(cari);
          opPut(t, op, 'fuel_tank_movements', move.id);
          for (const [entity, rec] of [['fuel_tank_movements',move], ['cari_movements',cari]]) t.objectStore('audit_log').put({id:uuid(), entity, entity_id:rec.id, action:'create', new:rec, reason, at:nowISO()});
          result = move;
        } catch(e) {fail(e);}
      };
      if (op && prior.result?.value) {
        const x = prior.result.value;
        if (x.hash !== op.hash || x.store !== 'fuel_tank_movements') {fail(opConflict(x)); return;}
        const q = t.objectStore('fuel_tank_movements').get(x.record_id);
        q.onsuccess = () => {
          if (!q.result || q.result.deleted_at) {write(); return;}
          const m = q.result;
          if (m.date !== f.date || m.recipient_customer_id !== f.customer_id || m.recipient_machine !== f.machine || m.liters !== f.liters || m.charge_unit_price !== f.unit_price || m.charge_total !== f.total) {fail(opConflict(x));return;}
          const c = t.objectStore('cari_movements').get(q.result.cari_movement_id);
          c.onsuccess = () => {try {validateCustomerFuelLinks({fuel_tank_movements:[q.result],cari_movements:c.result ? [c.result] : []});result = {...q.result,_existing:true};} catch(e){fail(e);}};
        };
      } else write();
    };
    t.oncomplete = () => {if(!result?._existing)recordsCommitted(d.name,['fuel_tank_movements','cari_movements']);resolve(result);};
    t.onabort = t.onerror = () => reject(error || t.error || Error('Mazot teslimi iptal edildi'));
  });
}

export async function cancelCustomerFuelDelivery(id, reason) {
  if (!String(reason || '').trim()) throw Error('Teslim iptal nedeni zorunlu');
  const d = await openDB();
  return new Promise((resolve,reject) => {
    const t = d.transaction(['fuel_tank_movements','cari_movements','audit_log'], 'readwrite');
    let result, error;
    const q = t.objectStore('fuel_tank_movements').get(id);
    q.onsuccess = () => {
      const m = q.result;
      if (!m || m.delivery_kind !== 'customer_fuel') {error=Error('Müşteri mazot teslimi bulunamadı');t.abort();return;}
      const c = t.objectStore('cari_movements').get(m.cari_movement_id);
      c.onsuccess = () => {
        try {
          validateCustomerFuelLinks({fuel_tank_movements:[m],cari_movements:c.result ? [c.result] : []});
          if (m.deleted_at) {result=m;return;}
          const now = nowISO();
          for (const [entity,rec] of [['fuel_tank_movements',m],['cari_movements',c.result]]) {
            const next={...rec,deleted_at:now,updated_at:now};
            t.objectStore(entity).put(next);
            t.objectStore('audit_log').put({id:uuid(),entity,entity_id:rec.id,action:'soft_delete',old:rec,new:next,reason,at:now});
            if(entity==='fuel_tank_movements')result=next;
          }
        } catch(e) {error=e;t.abort();}
      };
    };
    t.oncomplete=()=>{recordsCommitted(d.name,['fuel_tank_movements','cari_movements']);resolve(result);};t.onabort=t.onerror=()=>reject(error||t.error||Error('Teslim iptal edilemedi'));
  });
}

export async function saveFuelEvent(fields, reason = "Yakıt", { op = null } = {}) {
  if(["historical_pending_id","reconciliation_status","reconciliation"].some(k=>Object.hasOwn(fields,k)))throw Error("Mutabakat kaynak kimliği normal yakıt girişinden oluşturulamaz.");
  fields=await validateFields('fuel_records',fields);
  if (!fields.vehicle_id || !(Number(fields.liters) > 0))
    throw Error("Araç ve pozitif litre zorunlu");
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const stores = ["fuel_records", "fuel_tank_movements", "pending_fuel_records", "audit_log", ...(fields.driver_entry_id || op ? ["meta"] : []), ...(fields.driver_entry_id ? ["personnel"] : [])];
    const t = d.transaction(stores, "readwrite");
    let result, error, existing = null;
    const verified = fields.driver_entry_id ? driverProofRequests(t,fields.driver_entry_id) : null;
    const opReq = op ? t.objectStore("meta").get(OP + op.id) : null;
    // Şoför kaydı tekilliği aynı işlemde denetlenir (iki sekme / çift dokunma aynı anda kaydetse de bir kez yazılır).
    // fuel_records ve fuel_tank_movements aynı istekte sıraya girer: önce yakıtlar okunur, sonra depo.
    const fr = fields.driver_entry_id ? t.objectStore("fuel_records").getAll() : null;
    const pendingFuel = t.objectStore("pending_fuel_records").getAll();
    const request = t.objectStore("fuel_tank_movements").getAll();
    request.onsuccess = () => {
      if (verified && !verified()) { error = unverifiedDriver(); t.abort(); return; }
      if (fr && fr.result.some((x) => isActive(x) && x.driver_entry_id === fields.driver_entry_id)) { error = Object.assign(Error("Şoför kaydı zaten alınmış"), { code: "DUP_DRIVER" }); t.abort(); return; }
      if (op) {
        let sameRec;
        const st = opDecide(t, opReq, op, (r) => { sameRec = r; if (r) existing = r; else writeFuel(); });
        if (st === "conflict") { error = opConflict(opReq.result.value); t.abort(); return; }
        if (st === "same") return; // mevcut kayıt okunuyor (silinmişse yeni yazılır)
      }
      writeFuel();
    };
    const writeFuel = () => {
      if(pendingFuel.result.some(r=>r.id===fields.id||r.reconciliation_status==='pending'&&isActive(r)&&historicalFuelIdentity(r)===historicalFuelIdentity(fields))){error=Error('Bu tarih / araç / litreyle geçmiş yakıt mutabakat bekliyor. İkinci gerçek çıkış yazmak yerine Depo ekranında bu kaydı inceleyin.');t.abort();return;}
      const tank = fields.fuel_source === "Depo Tankı";
      const remaining = request.result
        .filter(isActive)
        .reduce(
          (s, r) => s + (r.move_type === "GİRİŞ" ? 1 : -1) * Number(r.liters),
          0,
        );
      if (tank && Number(fields.liters) > remaining) {
        error = Error("Tank stokundan fazla yakıt: kalan " + remaining + " Lt");
        t.abort();
        return;
      }
      const event = uuid();
      result = newRecord({
        ...fields,
        liters: Number(fields.liters),
        event_id: event,
      });
      // Depodan verilen yakıtın tutarı girilmediyse depo girişlerinin ortalama litre fiyatıyla maliyetlenir
      if (tank && !(Number(result.total) > 0)) {
        const up = tankUnitCost(request.result, result.date);
        if (up) Object.assign(result, { unit_price: up, total: Math.round(up * result.liters * 100) / 100, cost_source: "Depo ortalaması" });
      }
      try{assertNumericFields(result);}catch(e){error=e;t.abort();return;}
      if (tank) {
        const move = newRecord({
          date: fields.date,
          move_type: "ÇIKIŞ",
          liters: result.liters,
          vehicle_id: fields.vehicle_id,
          personnel_id: fields.personnel_id || null,
          pump_no: fields.pump_no || "",
          signature_name: fields.signature_name || "",
          event_id: event,
          fuel_record_id: result.id,
        });
        try{assertTankChange(request.result,[...request.result,move]);}catch(e){error=e;t.abort();return;}
        result.tank_movement_id = move.id;
        t.objectStore("fuel_tank_movements").put(move);
      }
      t.objectStore("fuel_records").put(result);
      opPut(t, op, "fuel_records", result.id);
      t.objectStore("audit_log").put({
        id: uuid(),
        entity: "fuel_records",
        entity_id: result.id,
        action: "create",
        new: fields,
        reason,
        at: nowISO(),
      });
    };
    t.oncomplete = () => {if(!existing)recordsCommitted(d.name,["fuel_records","fuel_tank_movements"]);resolve(existing ? { ...existing, _existing: true } : result);};
    t.onabort = t.onerror = () =>
      reject(error || t.error || Error("Yakıt işlemi iptal edildi"));
  });
}
// Yakıt kaydının kaynağını "Depo Tankı" yapar ya da kaydı (depo hareketiyle birlikte) siler — tek işlemde.
// mode: "to_tank" | "delete". Tedarikçi borcuna bağlı yakıt değiştirilmez.
export async function fuelFix(id, mode, reason = "") {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction(["fuel_records", "fuel_tank_movements", "payables", "cost_allocations", "audit_log"], "readwrite");
    let error, result;
    const fr = t.objectStore("fuel_records").get(id);
    const mv = t.objectStore("fuel_tank_movements").getAll();
    let f, moves,links=2,bills,allocations;
    for(const store of ['payables','cost_allocations']){const q=t.objectStore(store).getAll();q.onsuccess=()=>{if(store==='payables')bills=q.result;else allocations=q.result;links--;run();};}
    const run = () => {
      if (f === undefined || !moves||links) return;
      if (!f || f.deleted_at) { error = Error("Yakıt kaydı bulunamadı"); return t.abort(); }
      if(bills.some(b=>isActive(b)&&b.status!=='İptal'&&b.source_store==='fuel_records'&&b.source_id===id)){error=Error('Tedarikçi borcuna bağlı yakıt değiştirilemez');return t.abort();}
      if(allocations.some(a=>isActive(a)&&a.status==='Aktif'&&a.source_store==='fuel_records'&&a.source_id===id)){error=Error('Dağıtılmış yakıt maliyeti değiştirilemez; önce maliyet dağıtımını inceleyin');return t.abort();}
      const now = nowISO();
      const live = moves.filter(isActive);
      if (mode === "to_tank") {
        if (f.fuel_source === "Depo Tankı") { error = Error("Zaten depodan"); return t.abort(); }
        const remaining = live.reduce((s, r) => s + (r.move_type === "GİRİŞ" ? 1 : -1) * Number(r.liters), 0);
        if (Number(f.liters) > remaining) { error = Error("Depoda kayıtlı " + remaining + " Lt var; önce depoya yakıt girişi yapın"); return t.abort(); }
        const ev = f.event_id || uuid();
        const move = newRecord({ date: f.date, move_type: "ÇIKIŞ", liters: Number(f.liters), vehicle_id: f.vehicle_id, personnel_id: f.personnel_id || null,
          pump_no: f.pump_no || "", signature_name: "", event_id: ev, fuel_record_id: f.id });
        try{assertTankChange(moves,[...moves,move]);}catch(e){error=e;t.abort();return;}
        t.objectStore("fuel_tank_movements").put(move);
        result = { ...f, fuel_source: "Depo Tankı", receipt: "Depo", tank_movement_id: move.id, event_id: ev, updated_at: now };
        if (!(Number(f.total) > 0)) {
          const up = tankUnitCost(moves, f.date);
          if (up) Object.assign(result, { unit_price: up, total: Math.round(up * Number(f.liters) * 100) / 100, cost_source: "Depo ortalaması" });
        }
      } else if (mode === "delete") {
        const m = live.find((x) => x.id === f.tank_movement_id || x.fuel_record_id === f.id);
        if (m) t.objectStore("fuel_tank_movements").put({ ...m, deleted_at: now, updated_at: now });
        result = { ...f, deleted_at: now, updated_at: now };
      } else { error = Error("Geçersiz işlem"); return t.abort(); }
      t.objectStore("fuel_records").put(result);
      t.objectStore("audit_log").put({ id: uuid(), entity: "fuel_records", entity_id: f.id, action: mode === "delete" ? "soft_delete" : "update",
        old: { fuel_source: f.fuel_source, deleted_at: f.deleted_at || null }, new: { fuel_source: result.fuel_source, deleted_at: result.deleted_at || null }, reason, at: now });
    };
    fr.onsuccess = () => { f = fr.result || null; run(); };
    mv.onsuccess = () => { moves = mv.result; run(); };
    t.oncomplete = () => {recordsCommitted(d.name,['fuel_records','fuel_tank_movements']);resolve(result);};
    t.onabort = t.onerror = () => reject(error || t.error || Error("Yakıt işlemi iptal edildi"));
  });
}
// Trash recovery restores the fuel and its tank exit as one stock-checked operation.
export async function restoreFuelEvent(id){
 const connection=await openDB();return new Promise((resolve,reject)=>{
  const t=connection.transaction(['fuel_records','fuel_tank_movements','vehicles','personnel','audit_log'],'readwrite');let error,result,f,moves,changed=false,owners=2,vehicles,people;
  const fuel=t.objectStore('fuel_records').get(id),all=t.objectStore('fuel_tank_movements').getAll();
  for(const store of ['vehicles','personnel']){const q=t.objectStore(store).getAll();q.onsuccess=()=>{if(store==='vehicles')vehicles=q.result;else people=q.result;owners--;run();};}
  const run=()=>{if(f===undefined||!moves||owners)return;try{
   if(!f)throw Error('Yakıt kaydı bulunamadı');
   assertNumericFields(f);
   if(!validDate(f.date)||f.date>todayStr()||!(Number(f.liters)>0))throw Error('Geri yüklemeden önce gerçek yakıt tarihi ve litresini kontrol edin.');
   if(!vehicles.some(v=>v.id===f.vehicle_id&&isActive(v))||f.personnel_id&&!people.some(p=>p.id===f.personnel_id&&isActive(p)))throw Error('Önce yakıta bağlı araç / personel kartını geri yükleyin.');
   const next={...f,deleted_at:null,updated_at:new Date(Math.max(Date.now(),(Date.parse(f.updated_at)||0)+1)).toISOString()};
   const paired=f.fuel_source==='Depo Tankı'||f.tank_movement_id;
   let movement;
   if(paired){const old=moves.find(m=>m.id===f.tank_movement_id&&m.fuel_record_id===f.id);
    if(!old||old.move_type!=='ÇIKIŞ'||old.date!==f.date||Number(old.liters)!==Number(f.liters))throw Error('Yakıt ve depo bağlantısı tutarsız; Veri Sağlığı bölümünden inceleyin.');
    if(!old.deleted_at&&!f.deleted_at){result=f;return;}
    movement={...old,deleted_at:null,updated_at:next.updated_at};assertTankChange(moves,moves.map(m=>m.id===old.id?movement:m));
    if(old.deleted_at){changed=true;t.objectStore('fuel_tank_movements').put(movement);t.objectStore('audit_log').put({id:uuid(),entity:'fuel_tank_movements',entity_id:movement.id,action:'restore',old,new:movement,reason:'Yakıt ile birlikte geri yüklendi',at:nowISO()});}
   }
   if(f.deleted_at){changed=true;t.objectStore('fuel_records').put(next);t.objectStore('audit_log').put({id:uuid(),entity:'fuel_records',entity_id:id,action:'restore',old:f,new:next,reason:'Yakıt ve depo birlikte geri yüklendi',at:nowISO()});}
   result=f.deleted_at?next:f;
  }catch(e){error=e;t.abort();}};
  fuel.onsuccess=()=>{f=fuel.result||null;run();};all.onsuccess=()=>{moves=all.result;run();};
  t.oncomplete=()=>{if(changed)recordsCommitted(connection.name,['fuel_records','fuel_tank_movements']);resolve(result);};t.onerror=t.onabort=event=>reject(error||transactionError(t,event));
 });
}
// Tutarı olmayan depo yakıtlarına ortalama depo fiyatıyla maliyet yazar (tek işlem). Kaç kayıt güncellendiğini döner.
export async function fillTankFuelCosts() {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction(["fuel_records", "fuel_tank_movements", "payables", "cost_allocations", "audit_log"], "readwrite");
    let n = 0, fuels, moves, pendingLinks=2;
    const linkedFuel=new Set();
    const run = () => {
      if (!fuels || !moves || pendingLinks) return;
      const now = nowISO();
      for (const f of fuels) {
        if (f.historical_pending_id||!validDate(f.date)||f.date>todayStr()||linkedFuel.has(f.id) || !isActive(f) || f.fuel_source !== "Depo Tankı" || Number(f.total) > 0) continue;
        const up = tankUnitCost(moves, f.date);
        if (!up) continue;
        const upd = { ...f, unit_price: up, total: Math.round(up * Number(f.liters) * 100) / 100, cost_source: "Depo ortalaması", updated_at: now };
        t.objectStore("fuel_records").put(upd);
        t.objectStore("audit_log").put({ id: uuid(), entity: "fuel_records", entity_id: f.id, action: "update", old: { total: f.total ?? null }, new: { total: upd.total }, reason: "Depo ortalama maliyeti", at: now });
        n++;
      }
    };
    for(const store of ['payables','cost_allocations']){const q=t.objectStore(store).getAll();q.onsuccess=()=>{for(const r of q.result)if(isActive(r)&&r.status!=='İptal'&&(store==='payables'||r.status==='Aktif')&&r.source_store==='fuel_records')linkedFuel.add(r.source_id);pendingLinks--;run();};}
    const a = t.objectStore("fuel_records").getAll(), b = t.objectStore("fuel_tank_movements").getAll();
    a.onsuccess = () => { fuels = a.result; run(); };
    b.onsuccess = () => { moves = b.result; run(); };
    t.oncomplete = () => {if(n)recordsCommitted(d.name,["fuel_records"]);resolve(n);};
    t.onabort = t.onerror = (event) => reject(transactionError(t, event));
  });
}
// Depo girişlerinde litre fiyatı toplamla tutmuyorsa (ör. faturadaki KDV hariç birim fiyat yazılmış) toplam ÷ litre yapılır;
// ortalamayla otomatik maliyetlenmiş depo yakıtları yeni ortalamayla yeniden hesaplanır. Tek işlem; ne değiştiğini döner.
export async function repairTankPrices() {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction(["fuel_records", "fuel_tank_movements", "payables", "cost_allocations", "audit_log"], "readwrite");
    const out = { moves: 0, fuels: 0 };
    let fuels, moves, pendingLinks=2;
    const linkedFuel=new Set();
    const run = () => {
      if (!fuels || !moves || pendingLinks) return;
      const now = nowISO();
      for (const m of moves) {
        if (!isActive(m) || m.move_type !== "GİRİŞ" || m.count_id || !(Number(m.total) > 0) || !(Number(m.liters) > 0)) continue;
        const up = Math.round((Number(m.total) / Number(m.liters)) * 100) / 100;
        if (Math.abs((Number(m.unit_price) || 0) - up) <= Math.max(0.05, up * 0.005)) continue;
        const old = m.unit_price ?? null;
        const upd = { ...m, unit_price: up, updated_at: now };
        Object.assign(m, upd);
        t.objectStore("fuel_tank_movements").put(upd);
        t.objectStore("audit_log").put({ id: uuid(), entity: "fuel_tank_movements", entity_id: m.id, action: "update", old: { unit_price: old }, new: { unit_price: up }, reason: "Litre fiyatı = toplam ÷ litre (KDV dahil)", at: now });
        out.moves++;
      }
      for (const f of fuels) {
        if (f.historical_pending_id||!validDate(f.date)||f.date>todayStr()||linkedFuel.has(f.id) || !isActive(f) || f.fuel_source !== "Depo Tankı" || f.cost_source !== "Depo ortalaması" || !(Number(f.liters) > 0)) continue;
        const up = tankUnitCost(moves, f.date);
        if (!up) continue;
        const total = Math.round(up * Number(f.liters) * 100) / 100;
        if (Math.abs((Number(f.total) || 0) - total) < 0.5) continue;
        t.objectStore("fuel_records").put({ ...f, unit_price: up, total, updated_at: now });
        t.objectStore("audit_log").put({ id: uuid(), entity: "fuel_records", entity_id: f.id, action: "update", old: { total: f.total ?? null }, new: { total }, reason: "Depo ortalama maliyeti düzeltildi", at: now });
        out.fuels++;
      }
    };
    for(const store of ['payables','cost_allocations']){const q=t.objectStore(store).getAll();q.onsuccess=()=>{for(const r of q.result)if(isActive(r)&&r.status!=='İptal'&&(store==='payables'||r.status==='Aktif')&&r.source_store==='fuel_records')linkedFuel.add(r.source_id);pendingLinks--;run();};}
    const a = t.objectStore("fuel_records").getAll(), b = t.objectStore("fuel_tank_movements").getAll();
    a.onsuccess = () => { fuels = a.result; run(); };
    b.onsuccess = () => { moves = b.result; run(); };
    t.oncomplete = () => {if(out.moves||out.fuels)recordsCommitted(d.name,["fuel_records","fuel_tank_movements"]);resolve(out);};
    t.onabort = t.onerror = (event) => reject(transactionError(t, event));
  });
}
export async function createHakedis(fields) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const stores = ['hakedis', 'work_records', 'customers', 'sites'];
    const t = d.transaction(stores, 'readwrite');
    let rec, error;
    readTransactionRows(t, stores, data => {
      try {
        assertHakedisItems(fields.items);
        if (fields.id && data.hakedis.some(claim => claim.id === fields.id))
          throw financeError('Hakediş kimliği zaten kayıtlı; mevcut kayıt üzerine yazılmadı.', 'HAKEDIS_SOURCE');
        const draft = {...fields, items:captureHakedisSources(fields.items, data.work_records)};
        assertHakedisDocument(draft);
        assertHakedisSources(draft, data);
        rec = newRecord(draft);
        t.objectStore('hakedis').put(rec);
      } catch (e) { error = e; t.abort(); }
    });
    t.oncomplete = () => {recordsCommitted(d.name, ['hakedis']); resolve(rec);};
    t.onabort = t.onerror = event => reject(error || transactionError(t, event));
  });
}
export async function finalizeHakedis(id) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const stores = ['hakedis', 'cari_movements', 'work_records', 'customers', 'sites'];
    const t = d.transaction(stores, 'readwrite');
    let result, error;
    readTransactionRows(t, stores, data => {
      try {
        const h = data.hakedis.find(claim => claim.id === id);
        // All validation precedes the first write. Old stale/incoherent drafts
        // require review, never automatic repricing or partial ledger creation.
        assertHakedisDocument(h);
        assertHakedisSources(h, data);
        if (data.cari_movements.some(row => isActive(row) && row.ref_id === id))
          throw financeError('Hakedişe bağlı cari hareket zaten var; yeniden kesinleştirilmedi.', 'HAKEDIS_LOCKED');
        const snapshots = h.items.map(item => ({item, snapshot:hakedisWorkSnapshot(item)}));
        result = {...h, status:'Kesinleşti', finalized_at:nowISO(), updated_at:increasingStamp(h)};
        t.objectStore('hakedis').put(result);
        t.objectStore('cari_movements').put(newRecord({date:h.created_date, customer_id:h.customer_id,
          type:'Hakedis', amount:h.grand_total, ref_id:id, note:'Hakediş #' + h.hakedis_no}));
        for (const {item, snapshot} of snapshots) {
          const work = data.work_records.find(row => row.id === item.work_record_id);
          t.objectStore('work_records').put({...work, price_snapshot:snapshot, updated_at:increasingStamp(work)});
        }
      } catch (e) { error = e; t.abort(); }
    });
    t.oncomplete = () => {recordsCommitted(d.name, ['hakedis', 'cari_movements', 'work_records']); resolve(result);};
    t.onabort = t.onerror = event => reject(error || transactionError(t, event));
  });
}
export async function byRelation(store, key, value) {
  const d = await openDB();
  return wrap(
    d
      .transaction(store, "readonly")
      .objectStore(store)
      .index(key)
      .getAll(value),
  );
}
// Eski fotoğrafları küçült (Ayarlar): imza ve PDF'ler hariç. Dönen: { count, before, after } bayt
export async function shrinkAllAttachments(onProgress) {
  const { shrinkImage, SHRINK_MIN } = await import("./image-shrink.js");
  const list = (await getAll("attachments")).filter((a) => a.blob && a.kind !== "signature" && /^image\//.test(a.type || "") && (a.size || a.blob.size || 0) >= SHRINK_MIN);
  let count = 0, before = 0, after = 0, i = 0;
  for (const a of list) {
    i++;
    const small = await shrinkImage(a.blob instanceof File ? a.blob : new File([a.blob], a.name || "foto", { type: a.type }), { maxEdge: a.record_type === "document" ? 2000 : 1600, quality: a.record_type === "document" ? 0.85 : 0.82 });
    if (small.size < (a.blob.size || 0)) {
      before += a.blob.size; after += small.size; count++;
      await put("attachments", { ...a, blob: small, size: small.size, type: small.type, name: small.name, shrunk_at: nowISO() });
    }
    onProgress?.(i, list.length);
  }
  return { count, before, after, total: list.length };
}
// Aynı belge iki kez kaydedildiyse (aynı sahip + tür ailesi + numara/tarih): ilki tutulur, en geç bitiş tarihi ona yazılır,
// fotoğrafı yoksa diğerinin fotoğrafı ona taşınır, fazlalar çöp kutusuna gider (geri alınabilir).
export async function dedupeDocuments() {
  const { duplicateDocuments } = await import("./core.js");
  const groups = duplicateDocuments(await listActive("documents"));
  const atts = await getAll("attachments");
  let removed = 0;
  for (const [keep, ...dups] of groups) {
    const exp = [keep, ...dups].map((d) => d.expiry_date).filter(Boolean).sort().pop() || keep.expiry_date || null;
    const pref = [keep, ...dups].find((d) => d.expiry_date === exp) || keep;
    const fields = {};
    if (exp !== keep.expiry_date) { fields.expiry_date = exp; if (pref.date) fields.date = pref.date; }
    if (DOC_PREF.includes(pref.category) && pref.category !== keep.category) { fields.category = pref.category; fields.title = pref.category; }
    if (Object.keys(fields).length) await saveExisting("documents", keep, fields, "Mükerrer belge birleştirildi");
    let keepHas = atts.some((a) => a.record_type === "document" && a.record_id === keep.id && !a.deleted_at);
    for (const d of dups) {
      if (!keepHas) for (const a of atts.filter((x) => x.record_type === "document" && x.record_id === d.id)) { await put("attachments", { ...a, record_id: keep.id }); keepHas = true; }
      await softDelete("documents", d.id, "Mükerrer belge (aynı belge iki kez kaydedilmiş)");
      removed++;
    }
  }
  return removed;
}
async function assertNotDuplicateDoc(f) {
  const { sameDocument, trDate } = await import("./core.js");
  const ex = (await listActive("documents")).find((d) => sameDocument(d, f));
  if (ex) throw Error(`Bu belge zaten kayıtlı (${ex.category} · ${ex.doc_no || "no yok"}${ex.expiry_date ? " · bitiş " + trDate(ex.expiry_date) : ""}). Aynı belgeyi ikinci kez eklemeyin; gerekiyorsa kayıtlı belgeyi düzenleyin.`);
}
const DOC_PREF = ["TÜVTÜRK / Periyodik Muayene", "Zorunlu Trafik Sigortası"];
// Şirket evrakının sahibi: meta "company_profile" (ünvan, vergi no…). Yoksa varsayılan adla açılır.
export async function ensureCompany() {
  const cur = await metaGet("company_profile");
  if (!cur) await metaSet("company_profile", { name: (await import("./core.js")).COMPANY_NAME });
}
export async function saveDocument(fields, file) {
  file = await prepareAttachment(file);
  return persistDocument(fields,file);
}
// Only the already-parsed invoice importer uses this inert archival path.
// Every viewer still validates actual bytes; no stored flag grants navigation.
export async function saveInvoiceSourceDocument(fields,file) {
  if (fields.category !== 'Fatura') throw Error('Arşiv kaynağı yalnız e-fatura içindir.');
  file = await prepareInvoiceOriginal(file);
  return persistDocument(fields,file);
}
async function persistDocument(fields,file) {
  const f = await validateFields("documents", fields),
    owner = await get(
      (await import("./business.js")).OWNER_STORES[f.owner_type],
      f.owner_id,
    );
  if (!owner || owner.deleted_at) throw Error("Belge sahibi geçersiz");
  await assertNotDuplicateDoc(f);
  file = await (await import("./image-shrink.js")).shrinkImage(file, { maxEdge: 2000, quality: 0.85 });
  const rec = newRecord(f),
    attachment = {
      id: uuid(),
      record_type: "document",
      record_id: rec.id,
      name: file.name || "Belge",
      type: file.type,
      size: file.size,
      blob: file,
      kind: "scan_original",
      derived_of: null,
      created_at: nowISO(),
    };
  const d = await openDB();
  await new Promise((resolve, reject) => {
    const t = d.transaction(["documents", "attachments"], "readwrite");
    t.objectStore("documents").put(rec);
    t.objectStore("attachments").put(attachment);
    t.oncomplete = resolve;
    t.onerror = t.onabort = (event) => reject(transactionError(t, event));
  });
  return rec;
}
export async function signContract(id, blobs) {
  blobs = await Promise.all(blobs.map(blob => prepareAttachment(blob, { imageOnly:true })));
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction(["contracts", "attachments"], "readwrite");
    let error;
    const r = t.objectStore("contracts").get(id);
    r.onsuccess = () => {
      const c = r.result;
      if (
        !c ||
        c.status === "İmzalandı" ||
        blobs.length !== 2 ||
        blobs.some((b) => !b?.size)
      ) {
        error = Error("Sözleşme veya imzalar geçersiz");
        t.abort();
        return;
      }
      const ids = [];
      for (let i = 0; i < 2; i++) {
        const a = {
          id: uuid(),
          record_type: "contract_signature",
          record_id: id,
          name: i ? "Yuklenici.png" : "Isveren.png",
          type: "image/png",
          size: blobs[i].size,
          blob: blobs[i],
          kind: i ? "contractor" : "employer",
          created_at: nowISO(),
        };
        ids.push(a.id);
        t.objectStore("attachments").put(a);
      }
      t.objectStore("contracts").put({
        ...c,
        status: "İmzalandı",
        signed_at: nowISO(),
        signature_ids: ids,
        signed_snapshot: structuredClone(c),
      });
    };
    t.oncomplete = resolve;
    t.onerror = t.onabort = (event) => reject(error || transactionError(t, event));
  });
}

// Tahsilat içeriği (kaynak kimliği çakışma denetimi için): müşteri, tutar, tarih, ödeme şekli, banka
export function sameCollection(a, b) {
  const k = (f) => [f.cash_type || null,f.customer_id || null,f.personnel_id || null,f.site_id || null,f.vehicle_id || null,f.work_record_id || null,Math.round(Number(f.amount) * 100) / 100, f.date || null, f.payment_method || null, f.payment_method === "Havale" ? f.bank_account_id || null : null].join("|");
  return k(a) === k(b);
}
// Tahsilat: (1) kaynak kimliği (request_id, PR #122) ve (2) kalıcı işlem kimliği (op, PR #121) AYNI transaction'da denetlenir.
// Aynı request_id + aynı içerik → mevcut kayıt; farklı içerik → OP_CONFLICT. op aynı kurallarla.
export async function saveCashEvent(fields, { op = null } = {}) {
  assertNumericFields(fields);
  if (fields.driver_entry_id && !validDate(fields.date)) throw new Error("Şoför nakit bildirimi için geçerli tarih gereklidir");
  if (fields.driver_entry_id && (fields.cash_type !== "Müşteriden Para Alındı" || fields.payment_method !== "Nakit" || fields.cash_status !== "PERSONELDE" || !fields.personnel_id || !(Number(fields.amount) >= 0.01) || Number(fields.amount) > 1e12 || Math.abs(Number(fields.amount)*100-Math.round(Number(fields.amount)*100)) > 0.0000001)) throw new Error("Şoför nakit bildirimi pozitif tutar, nakit ödeme ve parayı alan personelle kaydedilmelidir");
  if(fields.driver_entry_id){const proof=await metaGet(DRV_OK+fields.driver_entry_id);if(!proof?.pid||proof.pid!==fields.personnel_id)throw unverifiedDriver();}
  fields=await validateFields('cash_records',fields);
  const d = await openDB(),
    rec = newRecord(fields);
  return new Promise((res, rej) => {
    const referenceStores={customer_id:'customers',personnel_id:'personnel',vehicle_id:'vehicles',site_id:'sites',contractor_id:'contractors',quarry_id:'quarries',dump_site_id:'dump_sites'};
    const references=Object.entries(referenceStores).filter(([key])=>fields[key]);
    const t = d.transaction([...new Set(["cash_records", "cari_movements", "audit_log", ...references.map(([,store])=>store), ...(op || fields.driver_entry_id ? ["meta"] : [])])], "readwrite");
    let existing = null, error = null;
    const verified = fields.driver_entry_id ? driverProofRequests(t, fields.driver_entry_id, fields.personnel_id) : null;
    const allowed = () => { if (verified && !verified()) { error = unverifiedDriver(); t.abort(); return false; } return true; };
    const write = () => {
      t.objectStore("cash_records").put(rec);
      opPut(t, op, "cash_records", rec.id);
      t.objectStore("audit_log").put({ id: uuid(), entity: "cash_records", entity_id: rec.id, action: "create", old: null, new: fields, reason: "Kasa", at: nowISO() });
      if (fields.cash_type === "Müşteriden Para Alındı")
        t.objectStore("cari_movements").put(
          newRecord({
            date: fields.date,
            customer_id: fields.customer_id,
            type: "Tahsilat",
            amount: -Number(fields.amount),
            ref_id: rec.id,
            note: "Tahsilat",
          }),
        );
    };
    const viaOp = () => {
      if (!allowed()) return;
      if (!op) return write();
      const g = t.objectStore("meta").get(OP + op.id);
      g.onsuccess = () => {
        const st = opDecide(t, g, op, (r) => { if (r) existing = r; else write(); });
        if (st === "conflict") { error = opConflict(g.result.value); t.abort(); return; }
        if (st === "new") write();
      };
    };
    const begin=()=>{if (fields.request_id || fields.driver_entry_id) {
      const q = t.objectStore("cash_records").getAll();
      q.onsuccess = () => {
        if (!allowed()) return;
        const old = q.result.find((x) => !x.deleted_at && ((fields.request_id && x.request_id === fields.request_id) || (fields.driver_entry_id && x.driver_entry_id === fields.driver_entry_id))) || null;
        if (old && !sameCollection(old, fields)) { error = Object.assign(Error("Aynı kaynak kimliğiyle farklı tahsilat kayıtlı — yazılmadı"), { code: "OP_CONFLICT", old }); t.abort(); return; }
        if (old) { existing = old; return; }
        viaOp();
      };
    } else if (verified) { const ready = t.objectStore("meta").get(DRV_OK + fields.driver_entry_id); ready.onsuccess = viaOp; } else viaOp();};
    let left=references.length;
    if(!left)begin();
    else for(const [key,store] of references){
      const request=t.objectStore(store).get(fields[key]);
      request.onsuccess=()=>{
        const row=request.result;
        if(!row||!isActive(row)||(key==='site_id'&&row.customer_id!==fields.customer_id)){
          error=financeError('Tahsilat / kasa kaydının ilgili kartı değişmiş veya silinmiş: '+key,'FINANCE_REFERENCE');t.abort();return;
        }
        if(!--left)begin();
      };
    }
    t.oncomplete = () => {if(!existing)recordsCommitted(d.name,['cash_records','cari_movements']);res(existing ? { ...existing, _existing: true } : rec);};
    t.onerror = t.onabort = (event) => rej(error || transactionError(t, event));
  });
}

export async function signSlip(id, file) {
  file = await prepareAttachment(file, { imageOnly:true });
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction(["slips", "attachments"], "readwrite");
    let result, error;
    const req = t.objectStore("slips").get(id);
    req.onsuccess = () => {
      const s = req.result;
      if (!s || s.status !== "Taslak" || !file?.size) {
        error = Error("Fiş taslak olmalı; imza zorunlu");
        t.abort();
        return;
      }
      const att = {
        id: uuid(),
        record_type: "slip_signature",
        record_id: id,
        name: "imza.png",
        type: "image/png",
        size: file.size,
        blob: file,
        kind: "signature",
        created_at: nowISO(),
      };
      result = {
        ...s,
        status: "İmzalandı",
        signed_at: nowISO(),
        signature_attachment_id: att.id,
      };
      t.objectStore("attachments").put(att);
      t.objectStore("slips").put(result);
      if (s.revision_of) {
        const r = t.objectStore("slips").get(s.revision_of);
        r.onsuccess = () => {
          if (r.result?.status === "İmzalandı")
            t.objectStore("slips").put({ ...r.result, status: "Revize" });
        };
      }
    };
    t.oncomplete = () => resolve(result);
    t.onerror = t.onabort = (event) => reject(error || transactionError(t, event));
  });
}

// Koşullu tek kayıt güncellemesi: okuma, koşul denetimi, yazma ve audit AYNI transaction'da.
// İki sekme aynı düzeltmeyi aynı anda onaylarsa yalnız biri yazar; öteki { skipped: true } alır.
export async function updateIf(store, id, pred, fields, auditReason) {
  if(store==='pending_fuel_records')throw Error('Geçmiş yakıt yalnız mutabakat incelemesinden değiştirilebilir.');
  if(store === "dump_entries") throw Error("Döküm işlemi ortak hesap ekranından yapılmalı");
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const t = d.transaction([...new Set([store, "audit_log", "dump_entries", ...(store==='fuel_tank_movements'?['pending_fuel_records']:[])])], "readwrite");
    let out = { skipped: true }, error;
    const q = t.objectStore(store).get(id);
    q.onsuccess = () => {
      const cur = q.result;
      if (!cur || cur.deleted_at || !pred(cur)) return;
      if(store==='fuel_records'&&(cur.historical_pending_id||fields.historical_pending_id!=null)){error=Error('Mutabakatı tamamlanan geçmiş yakıt koşullu düzenlemeyle değiştirilemez.');t.abort();return;}
      const changed = key => key in fields && JSON.stringify(fields[key] ?? null) !== JSON.stringify(cur[key] ?? null);
      if (store === "work_records" && (
        ["dump_tariff_snapshot", "dump_estimate_snapshot"].some(changed) ||
        (cur.dump_estimate_snapshot && ["date", "quantity", "unit", "vehicle_id", "dump_site_id", "dump_cost", "tonnage", "tonnage_scope", "dump_payer"].some(changed))
      )) {
        error = Error("Döküm tahmininin dayanağı koşullu güncellemeyle değiştirilemez; iş düzenleme ekranını kullanın");
        t.abort(); return;
      }
      if(store==='fuel_tank_movements'&&['date','liters','move_type','vehicle_id','personnel_id','fuel_record_id','event_id','deleted_at'].some(changed))for(const id of new Set([cur.fuel_record_id,fields.fuel_record_id].filter(Boolean))){const p=t.objectStore('pending_fuel_records').get(id);p.onsuccess=()=>{if(p.result){error=Error('Mutabakat depo eş kaydı koşullu düzenlemeyle değiştirilemez.');t.abort();}};}
      const linked = t.objectStore("dump_entries").getAll();
      linked.onsuccess = () => {
        const key={work_records:"work_record_id",expense_records:"expense_id"}[store];
        const protectedKeys=store==="work_records"?["date","quantity","unit","vehicle_id","customer_id","site_id","dump_site_id","dump_cost","dump_tariff_snapshot","dump_estimate_snapshot","tonnage","tonnage_scope","dump_payer","deleted_at"]:["amount","date","vehicle_id","dump_site_id","dump_deposit","dump_entry_id","invoice_paid","deleted_at"];
        if(key && Object.keys(fields).some(k=>protectedKeys.includes(k)) && linked.result.some(e=>isActive(e)&&e[key]===id)){
          error=Error("Döküm fişine bağlı kayıt burada değiştirilemez; ortak hesap işlemini inceleyin");t.abort();return;
        }
        const rec = { ...cur, ...fields, updated_at: nowISO() };
        t.objectStore(store).put(rec);
        t.objectStore("audit_log").put({ id: uuid(), entity: store, entity_id: id, action: "update", old: Object.fromEntries(Object.keys(fields).map((k) => [k, cur[k] ?? null])), new: fields, reason: auditReason || "", at: nowISO() });
        out = rec;
      };
    };
    t.oncomplete = () => {if(!out.skipped)recordsCommitted(d.name,[store]);resolve(out);};
    t.onerror = t.onabort = (event) => reject(error || transactionError(t, event));
  });
}

// İş sözleşmesi (m³) ölçümü: şantiyedeki anlaşmaya ölçüm + cariye metraj hakedişi TEK işlemde yazılır.
// Anlaşma açık değilse ya da ölçüm zaten kayıtlıysa hiçbir şey yazılmaz (iki sekme / çift basma tek kayıt).
export async function saveJobMeasurement(siteId, measurement, cariFields, reason) {
  const d = await openDB();
  const cari = newRecord(cariFields);
  return new Promise((resolve, reject) => {
    const t = d.transaction(["sites", "cari_movements", "audit_log"], "readwrite");
    let out = null, error = null;
    const q = t.objectStore("sites").get(siteId);
    q.onsuccess = () => {
      const s = q.result, D = s?.deal;
      if (!s || s.deleted_at || !D || D.status !== "Açık" || D.measurement) { error = Error("Bu işin ölçümü zaten kayıtlı ya da iş açık değil"); t.abort(); return; }
      const deal = { ...D, status: "Ölçüldü", measurement: { ...measurement, cari_id: cari.id } };
      const rec = { ...s, deal, updated_at: nowISO() };
      t.objectStore("sites").put(rec);
      t.objectStore("cari_movements").put(cari);
      t.objectStore("audit_log").put({ id: uuid(), entity: "sites", entity_id: siteId, action: "update", old: { deal: D }, new: { deal }, reason: reason || "", at: nowISO() });
      t.objectStore("audit_log").put({ id: uuid(), entity: "cari_movements", entity_id: cari.id, action: "create", old: null, new: cariFields, reason: reason || "", at: nowISO() });
      out = { site: rec, cari };
    };
    t.oncomplete = () => {recordsCommitted(d.name,["sites","cari_movements"]);resolve(out);};
    t.onerror = t.onabort = (event) => reject(error || transactionError(t, event));
  });
}

// Götürü iş sözleşmesi: sözleşme bedeli cariye TEK işlemde yazılır (anlaşmada bedel kaydı + cari hareketi). İkinci kez yazılmaz.
export async function saveJobCharge(siteId, charge, cariFields, reason) {
  const d = await openDB();
  const cari = newRecord(cariFields);
  return new Promise((resolve, reject) => {
    const t = d.transaction(["sites", "cari_movements", "audit_log"], "readwrite");
    let out = null, error = null;
    const q = t.objectStore("sites").get(siteId);
    q.onsuccess = () => {
      const s = q.result, D = s?.deal;
      if (!s || s.deleted_at || !D || D.basis !== "Götürü" || D.status !== "Açık" || D.charge) { error = Error("Sözleşme bedeli zaten cariye yazılmış ya da iş açık değil"); t.abort(); return; }
      const deal = { ...D, charge: { ...charge, cari_id: cari.id } };
      const rec = { ...s, deal, updated_at: nowISO() };
      t.objectStore("sites").put(rec);
      t.objectStore("cari_movements").put(cari);
      t.objectStore("audit_log").put({ id: uuid(), entity: "sites", entity_id: siteId, action: "update", old: { deal: D }, new: { deal }, reason: reason || "", at: nowISO() });
      t.objectStore("audit_log").put({ id: uuid(), entity: "cari_movements", entity_id: cari.id, action: "create", old: null, new: cariFields, reason: reason || "", at: nowISO() });
      out = { site: rec, cari };
    };
    t.oncomplete = () => {recordsCommitted(d.name,["sites","cari_movements"]);resolve(out);};
    t.onerror = t.onabort = (event) => reject(error || transactionError(t, event));
  });
}

// Yalnız kaynak metaverisi: iş bedeli/miktarı/hakedişi değişmez. Kaynak + op + audit atomik.
export async function linkPdfWorkSource({recordId,expected,source,op}) {
  if (!recordId || !expected || !source?.document_id || !source?.hash || !op?.id || !op?.hash) throw Error('Kaynak bağlantısı eksik');
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const t=db.transaction(['work_records','documents','meta','audit_log'],'readwrite');
    const w=t.objectStore('work_records').get(recordId),doc=t.objectStore('documents').get(source.document_id),key=t.objectStore('meta').get(OP+op.id);
    let out,error;
    key.onsuccess=()=>{
      try {
        const current=w.result,archive=doc.result,prior=key.result?.value;
        if(!current||current.deleted_at)throw Error('Bağlanacak iş bulunamadı.');
        if(!archive||archive.deleted_at||archive.source_pdf_hash!==source.hash)throw Error('Kaynak PDF arşivi doğrulanamadı.');
        if(prior){
          if(prior.hash!==op.hash||prior.store!=='work_records'||prior.record_id!==recordId)throw opConflict(prior);
          out={...current,_existing:true};return;
        }
        if(JSON.stringify(current)!==JSON.stringify(expected))throw Object.assign(Error('İş siz kontrol ettikten sonra değişti; yeniden inceleyin.'),{code:'STALE'});
        const links=current.source_pdf_links||[];
        const found=links.some(x=>x.hash===source.hash&&x.row===source.row)||(current.source_pdf_hash===source.hash&&current.source_pdf_row===source.row);
        const at=nowISO(), stamp=current.updated_at&&at<=current.updated_at?new Date(Date.parse(current.updated_at)+1).toISOString():at;
        out=found?current:{...current,source_pdf_links:[...links,{...source,linked_at:at}],updated_at:stamp};
        if(!found){
          t.objectStore('work_records').put(out);
          t.objectStore('audit_log').put({id:uuid(),entity:'work_records',entity_id:recordId,action:'pdf_source_link',old:null,new:source,reason:'Kullanıcı onayıyla mevcut işe PDF kaynağı bağlandı; iş tutarı değişmedi',at});
        }
        t.objectStore('meta').put({key:OP+op.id,value:{hash:op.hash,store:'work_records',record_id:recordId,action:'link',at}});
      }catch(e){error=e;t.abort();}
    };
    t.oncomplete=()=>resolve(out);t.onabort=t.onerror=(event) => reject(error || transactionError(t, event));
  });
}

// Taslak PDF dosyaları için cihaz başına 60 MB bütçe; iki sekmede de atomik.
export async function storePdfHistoryFile(hash,file) {
  file = await prepareAttachment(file, { pdfOnly:true, maxBytes:15*1024*1024 });
  if(!/^[a-f0-9]{64}$/.test(hash)||!(file instanceof Blob)||!file.size||file.size>15*1024*1024)throw Error('PDF taslak dosyası geçersiz.');
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const t=db.transaction('drafts','readwrite'),s=t.objectStore('drafts'),g=s.getAll();let error;
    g.onsuccess=()=>{try{
      const id='pdf_history_file:'+hash;
      const size=g.result.filter(x=>String(x.form).startsWith('pdf_history_file:')&&x.form!==id).reduce((n,x)=>n+(x.blob?.size||0),0);
      if(size+file.size>60*1024*1024){error=Error('Dosya taslak alanına sığmadı. Satırlar korunur; devam ederken PDF’yi yeniden seçin.');t.abort();return;}
      s.put({form:id,blob:file,name:file.name||'kaynak.pdf',hash,updated_at:nowISO()});
    }catch(e){error=e;t.abort();}};
    t.oncomplete=()=>resolve(true);t.onabort=t.onerror=(event) => reject(error || transactionError(t, event));
  });
}

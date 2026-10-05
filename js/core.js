// SAHAPRO CEP — çekirdek saf mantık (tarayıcı + Node ortak)
// Hiçbir DOM / IndexedDB bağımlılığı YOK — testler bu dosyayı Node'da koşar.

export const APP_ID = 'SAHAPRO_CEP';
export const APP_VERSION = 'SAHAPRO CEP TEMP v1';
export const SCHEMA_VERSION = 1;
export const SOURCE = 'temporary_mobile_logger';
export const SW_CACHE = 'sahapro-cep-temp-v1';

// ---- Kayıt depoları (IndexedDB store adları = backup JSON anahtarları) ----
export const ENTITY_STORES = [
  'customers', 'sites', 'vehicles', 'personnel',
  'work_records', 'fuel_records', 'fuel_tank_movements', 'expense_records',
  'maintenance_records', 'cash_records', 'personnel_events', 'documents'
];
export const SYSTEM_STORES = ['attachments', 'meta', 'drafts'];

// ---- UUID (crypto.randomUUID veya güvenli eşdeğer) ----
export function uuid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function nowISO() { return new Date().toISOString(); }

// Her kayıt: id/source/created_at/updated_at/deleted_at/schema_version/migration_status
export function newRecord(fields = {}) {
  const t = nowISO();
  return {
    id: uuid(),
    source: SOURCE,
    created_at: t,
    updated_at: t,
    deleted_at: null,
    schema_version: SCHEMA_VERSION,
    migration_status: 'NOT_IMPORTED',
    ...fields
  };
}

export function touchRecord(rec) { return { ...rec, updated_at: nowISO() }; }
export function isActive(rec) { return !rec.deleted_at; }

// ---- Sabit listeler ----
export const WORK_UNITS = ['Sefer', 'Saat', 'Yevmiye', 'Ton', 'm³', 'Adet'];
export const WORK_TYPES = [
  'Hafriyat Nakliye', 'Moloz Nakliye', 'Çöp Nakliye', 'Mıcır Nakliye', 'Kum Nakliye', 'Gravak Nakliye',
  'Kazı', 'Yıkım', 'Kırım', 'Tesviye', 'Yükleme',
  'Makine Çalışması', 'Mini Kato Çalışması', 'JCB Çalışması', 'Manitou Çalışması', 'Vinç Çalışması',
  'Lowbed Nakliye', 'Diğer'
];
export const FUEL_SOURCES = ['Depo Tankı', 'Akaryakıt İstasyonu', 'Şantiye', 'Diğer'];
export const EXPENSE_CATEGORIES = [
  'Yakıt', 'Yemek', 'Otopark', 'Otoyol / HGS', 'Döküm', 'Malzeme', 'Yedek Parça', 'Tamir',
  'Servis', 'Lastik', 'Yağ / Filtre', 'Nakliye', 'Şantiye Gideri', 'Ofis Gideri', 'Personel', 'Diğer'
];
export const PAYMENT_METHODS = ['Nakit', 'Kart', 'Havale', 'Personel Ödedi', 'Şirket Ödedi', 'Diğer'];
export const REIMBURSEMENT_STATUS = ['Bekliyor', 'Ödendi'];
export const MAINT_TYPES = [
  'Arıza', 'Bakım', 'Periyodik Bakım', 'Lastik', 'Yağ', 'Filtre',
  'Elektrik', 'Hidrolik', 'Motor', 'Şanzıman', 'Kaporta', 'Diğer'
];
export const MAINT_STATUS = ['Açık', 'Serviste', 'Parça Bekliyor', 'Tamamlandı'];
export const CASH_TYPES = [
  'Müşteriden Para Alındı', 'Personelde Para', 'Kasaya Teslim Bildirildi',
  'Kasaya Teslim Edildi', 'Şirket Gideri İçin Para Verildi', 'Diğer'
];
export const CASH_STATUS = ['PERSONELDE', 'TESLIM_BILDIRILDI', 'KASAYA_TESLIM_EDILDI'];
// Hedef akış: Personelde → Teslim Bildirildi → Kasaya Teslim Edildi (cari otomatik KAPANMAZ)
export function nextCashStatus(s) {
  if (s === 'PERSONELDE') return 'TESLIM_BILDIRILDI';
  if (s === 'TESLIM_BILDIRILDI') return 'KASAYA_TESLIM_EDILDI';
  return null;
}
export const PERSONNEL_EVENT_TYPES = ['Avans', 'Mesai', 'İzin', 'Devamsızlık', 'Zimmet Notu', 'Personel Gideri', 'Diğer'];
export const DOC_CATEGORIES = ['Döküm fişi', 'Akaryakıt fişi', 'Servis faturası', 'İrsaliye', 'Makbuz', 'Diğer'];
export const VEHICLE_OWNERSHIP = ['Özmal', 'Taşeron'];

// ---- Seed listeler (§19 / §20) ----
export const SEED_VEHICLES = [
  'DX225 / Yeni Makine', 'Sany 225', 'Doosan 225 / Eski Kato', 'DX140', '14 Tonluk Kato', 'Uzun Bomlu',
  'U55', 'U17', 'U36',
  'JCB', 'Manitou MTX 1840', 'Mobil Vinç', 'Silindir',
  '34UL9492', '34GA2261', '34FY2482', '34GAM627'
];
export const SEED_PERSONNEL = [
  'Tahir Toprak', 'Serdar', 'Bayram', 'Niyazi', 'Olcay', 'Cihan', 'Soner', 'Metin', 'Hüseyin', 'Ahmet'
];

// ---- Depo yakıt dengesi (§10): Toplam Giriş - Toplam Çıkış = Tahmini Kalan ----
export function calcTankBalance(movements) {
  let inn = 0, out = 0;
  for (const m of movements.filter(isActive)) {
    const l = Number(m.liters) || 0;
    if (m.move_type === 'GİRİŞ') inn += l; else if (m.move_type === 'ÇIKIŞ') out += l;
  }
  return { in: inn, out, remaining: inn - out };
}

// ---- Gün sonu özeti (§22) ----
export function daySummary(dateStr, data) {
  const on = (r) => isActive(r) && r.date === dateStr;
  const works = (data.work_records || []).filter(on);
  const fuels = (data.fuel_records || []).filter(on);
  const expenses = (data.expense_records || []).filter(on);
  const cash = (data.cash_records || []).filter(on);
  const maint = (data.maintenance_records || []).filter(on);
  const pevents = (data.personnel_events || []).filter(on);
  const sumUnit = (u) => works.filter(w => w.unit === u).reduce((s, w) => s + (Number(w.quantity) || 0), 0);
  return {
    work_count: works.length,
    total_sefer: sumUnit('Sefer'),
    total_saat: sumUnit('Saat'),
    total_yevmiye: sumUnit('Yevmiye'),
    fuel_liters: fuels.reduce((s, f) => s + (Number(f.liters) || 0), 0),
    expense_total: expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    tahsilat_total: cash.filter(c => c.cash_type === 'Müşteriden Para Alındı').reduce((s, c) => s + (Number(c.amount) || 0), 0),
    open_breakdowns: maint.filter(m => m.status !== 'Tamamlandı').length,
    personnel_events: pevents.length
  };
}

// ---- WhatsApp gün sonu metni (§33) ----
export function trDate(dateStr) {
  const [y, m, d] = String(dateStr).split('-');
  return (y && m && d) ? `${d}.${m}.${y}` : String(dateStr);
}
export function buildWhatsAppText(dateStr, data, names = {}) {
  const nm = (store, id) => (names[store] && names[store][id]) || '';
  const on = (arr) => (arr || []).filter(r => isActive(r) && r.date === dateStr);
  const L = [`${trDate(dateStr)} — SAHAPRO CEP Gün Sonu`, ''];
  const works = on(data.work_records);
  if (works.length) {
    L.push('İŞLER');
    for (const w of works) {
      L.push(`${nm('customers', w.customer_id) || '—'} / ${nm('sites', w.site_id) || '—'}`);
      L.push(`${nm('vehicles', w.vehicle_id) || '—'} — ${nm('personnel', w.personnel_id) || '—'}`);
      L.push(`${w.quantity ?? ''} ${w.unit || ''} · ${w.work_type || ''}`.trim());
      if (w.description) L.push(String(w.description));
    }
    L.push('');
  }
  const fuels = on(data.fuel_records);
  if (fuels.length) {
    L.push('YAKIT');
    for (const f of fuels) L.push(`${nm('vehicles', f.vehicle_id) || '—'} — ${f.liters} Lt`);
    L.push('');
  }
  const expenses = on(data.expense_records);
  if (expenses.length) {
    L.push('GİDER');
    for (const e of expenses) L.push(`${e.category || 'Gider'} — ${fmtTL(e.amount)} TL`);
    L.push('');
  }
  const cash = on(data.cash_records);
  if (cash.length) {
    L.push('KASA');
    for (const c of cash) {
      L.push(`${c.cash_type || ''} — ${fmtTL(c.amount)} TL`);
      if (c.cash_status === 'PERSONELDE' && c.personnel_id) L.push(`Personelde: ${nm('personnel', c.personnel_id)}`);
    }
    L.push('');
  }
  const maint = on(data.maintenance_records);
  if (maint.length) {
    L.push('ARIZA/BAKIM');
    for (const m of maint) {
      L.push(`${nm('vehicles', m.vehicle_id) || '—'} — ${m.description || m.maint_type || ''}`);
      L.push(`Durum: ${m.status || 'Açık'}`);
    }
  }
  return L.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---- CSV (§31): Türkçe/UTF-8, Excel uyumlu (noktalı virgül; BOM indirme tarafında) ----
export function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function toCSV(headers, rows) {
  const lines = [headers.map(csvEscape).join(';')];
  for (const r of rows) lines.push(r.map(csvEscape).join(';'));
  return lines.join('\r\n');
}

// ---- Sayı/para biçimi ----
export function fmtTL(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}
export function todayStr(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---- Arama (§27) ----
export function matchSearch(haystack, q) {
  if (!q) return true;
  return String(haystack).toLocaleLowerCase('tr-TR').includes(String(q).toLocaleLowerCase('tr-TR'));
}

// ---- Backup paketi (§28/§29) ----
export function buildBackup(dataByStore, deviceInstallId, exportedAt = nowISO()) {
  const data = {};
  for (const s of ENTITY_STORES) data[s] = (dataByStore[s] || []).map(r => ({ ...r }));
  return {
    app: APP_ID,
    schema_version: SCHEMA_VERSION,
    exported_at: exportedAt,
    device_install_id: deviceInstallId,
    data
  };
}
export function isValidBackup(obj) {
  return !!obj && obj.app === APP_ID && typeof obj.schema_version === 'number' && !!obj.data && typeof obj.data === 'object';
}

// ---- Import preview (§34): UUID aynıysa duplicate YOK, kör overwrite YOK ----
export function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}
export function mergePreview(localRecords, importedRecords) {
  const localById = new Map((localRecords || []).map(r => [r.id, r]));
  const res = { new: [], existing: [], conflict: [] };
  const seen = new Set();
  for (const r of (importedRecords || [])) {
    if (!r || !r.id) continue;
    if (seen.has(r.id)) { res.conflict.push(r); continue; }
    seen.add(r.id);
    const l = localById.get(r.id);
    if (!l) res.new.push(r);
    else if (stableStringify(l) === stableStringify(r)) res.existing.push(r);
    else res.conflict.push(r);
  }
  return res;
}

// ---- ZIP (store-only, UTF-8 bayraklı) — SAHAPRO-CEP-EXPORT.zip için ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function u16(v) { return new Uint8Array([v & 255, (v >>> 8) & 255]); }
function u32(v) { return new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]); }
function dosDateTime(d = new Date()) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = (((d.getFullYear() - 1980) & 127) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}
export function buildZip(files, date = new Date()) {
  const enc = new TextEncoder();
  const { time, date: dt } = dosDateTime(date);
  const chunks = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const head = [
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(time), u16(dt),
      u32(crc), u32(f.data.length), u32(f.data.length), u16(name.length), u16(0)
    ];
    let headLen = 0; for (const h of head) headLen += h.length;
    central.push({ name, crc, size: f.data.length, offset, time });
    for (const h of head) chunks.push(h);
    chunks.push(name, f.data);
    offset += headLen + name.length + f.data.length;
  }
  const cdStart = offset;
  let cdSize = 0;
  for (const c of central) {
    const e = [
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(c.time), u16(dt),
      u32(c.crc), u32(c.size), u32(c.size), u16(c.name.length),
      u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.offset)
    ];
    for (const x of e) { chunks.push(x); cdSize += x.length; }
    chunks.push(c.name); cdSize += c.name.length;
  }
  const end = [u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(cdSize), u32(cdStart), u16(0)];
  for (const x of end) chunks.push(x);
  let total = 0; for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let p = 0; for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}

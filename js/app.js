// SAHAPRO CEP — uygulama kabuğu (mobil öncelikli, tek el, koyu kurumsal tema)
import * as C from './core.js';
import * as DB from './db.js';

const $ = (s, r = document) => r.querySelector(s);
const screen = () => $('#screen');
const state = { masters: { customers: [], sites: [], vehicles: [], personnel: [] }, attMap: {}, editing: null };

// ---------- yardımcılar ----------
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.value = v;
    else e.setAttribute(k, v);
  }
  for (const k of kids) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
function toast(msg) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
}
function nameOf(store, id) {
  const r = state.masters[store]?.find(x => x.id === id);
  return r ? r.name : '';
}
async function loadMasters() {
  for (const s of ['customers', 'sites', 'vehicles', 'personnel']) {
    state.masters[s] = (await DB.listActive(s)).filter(r => r.active !== false);
  }
  state.attMap = await DB.attachmentsCountMap();
}
function download(filename, content, type = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function backupStamp(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

// ---------- modül/form şemaları ----------
const YESNO = ['Evet', 'Hayır'];
const MODULES = {
  work: {
    store: 'work_records', title: 'İş Kaydı', warn: 'Farklı iş veya malzeme türlerini ayrı kayıt girin. HER İŞ AYRI KAYIT.',
    fields: [
      { n: 'date', l: 'Tarih', t: 'date', req: 1 },
      { n: 'time', l: 'Saat (opsiyonel)', t: 'time' },
      { n: 'customer_id', l: 'Müşteri', t: 'master', master: 'customers' },
      { n: 'site_id', l: 'Şantiye', t: 'master', master: 'sites' },
      { n: 'vehicle_id', l: 'Araç / Makine', t: 'master', master: 'vehicles' },
      { n: 'personnel_id', l: 'Şoför / Operatör', t: 'master', master: 'personnel' },
      { n: 'work_type', l: 'İş Türü', t: 'datalist', opts: C.WORK_TYPES },
      { n: 'description', l: 'İş Açıklaması', t: 'textarea' },
      { n: 'material', l: 'Malzeme', t: 'text' },
      { n: 'quantity', l: 'Miktar', t: 'number' },
      { n: 'unit', l: 'Birim', t: 'datalist', opts: C.WORK_UNITS },
      { n: 'dump_area', l: 'Döküm Sahası', t: 'text' },
      { n: 'quarry', l: 'Malzeme Ocağı', t: 'text' },
      { n: 'slip_status', l: 'Fiş Durumu', t: 'select', opts: ['Fiş Var', 'Fiş Yok'] },
      { n: 'slip_no', l: 'Fiş No (opsiyonel)', t: 'text' },
      { n: 'customer_note', l: 'Müşteri Notu', t: 'textarea' },
      { n: 'internal_note', l: 'İç Not', t: 'textarea' }
    ]
  },
  fuel: {
    store: 'fuel_records', title: 'Yakıt', note: 'Bu kayıt müşteri hakedişine GİRMEZ (customer_billable = false).',
    fields: [
      { n: 'date', l: 'Tarih', t: 'date', req: 1 },
      { n: 'vehicle_id', l: 'Yakıt Alan Araç / Makine', t: 'master', master: 'vehicles' },
      { n: 'personnel_id', l: 'Personel', t: 'master', master: 'personnel' },
      { n: 'liters', l: 'Litre', t: 'number', req: 1 },
      { n: 'unit_price', l: 'Birim Fiyat (opsiyonel)', t: 'number' },
      { n: 'total', l: 'Toplam Tutar (opsiyonel — otomatik hesaplanır)', t: 'number' },
      { n: 'fuel_source', l: 'Yakıt Kaynağı', t: 'select', opts: C.FUEL_SOURCES },
      { n: 'receipt', l: 'Fiş Var mı?', t: 'select', opts: YESNO },
      { n: 'pump_no', l: 'Pompa Sayaç No (opsiyonel)', t: 'text' },
      { n: 'km', l: 'KM (opsiyonel)', t: 'number' },
      { n: 'machine_hours', l: 'Makine Çalışma Saati (opsiyonel)', t: 'number' },
      { n: 'description', l: 'Açıklama', t: 'textarea' }
    ], hidden: { customer_billable: false }
  },
  expense: {
    store: 'expense_records', title: 'Gider',
    fields: [
      { n: 'date', l: 'Tarih', t: 'date', req: 1 },
      { n: 'personnel_id', l: 'Personel', t: 'master', master: 'personnel' },
      { n: 'category', l: 'Kategori', t: 'select', opts: C.EXPENSE_CATEGORIES },
      { n: 'amount', l: 'Tutar (TL)', t: 'number', req: 1 },
      { n: 'payment_method', l: 'Ödeme Şekli', t: 'select', opts: C.PAYMENT_METHODS },
      { n: 'reimbursement_status', l: 'Personel Ödemesi Durumu', t: 'select', opts: C.REIMBURSEMENT_STATUS, showIf: { n: 'payment_method', eq: 'Personel Ödedi' } },
      { n: 'company', l: 'Firma', t: 'text' },
      { n: 'description', l: 'Açıklama', t: 'textarea' },
      { n: 'receipt', l: 'Fiş Var mı?', t: 'select', opts: YESNO },
      { n: 'doc_note', l: 'Belge Notu', t: 'text' }
    ]
  },
  maintenance: {
    store: 'maintenance_records', title: 'Bakım / Arıza',
    fields: [
      { n: 'date', l: 'Tarih', t: 'date', req: 1 },
      { n: 'vehicle_id', l: 'Araç / Makine', t: 'master', master: 'vehicles' },
      { n: 'personnel_id', l: 'Personel', t: 'master', master: 'personnel' },
      { n: 'maint_type', l: 'Kayıt Tipi', t: 'select', opts: C.MAINT_TYPES },
      { n: 'description', l: 'Arıza / Açıklama', t: 'textarea' },
      { n: 'status', l: 'Durum', t: 'select', opts: C.MAINT_STATUS },
      { n: 'cost', l: 'Maliyet (opsiyonel)', t: 'number' },
      { n: 'service_company', l: 'Servis / Firma (opsiyonel)', t: 'text' },
      { n: 'km_hours', l: 'KM / Çalışma Saati (opsiyonel)', t: 'text' },
      { n: 'photo', l: 'Fotoğraf (cihazda saklanır)', t: 'file' }
    ]
  },
  cash: {
    store: 'cash_records', title: 'Kasa / Tahsilat', note: 'Bu modül muhasebe kesinleştirmesi DEĞİLDİR; cari otomatik kapanmaz.',
    fields: [
      { n: 'date', l: 'Tarih', t: 'date', req: 1 },
      { n: 'cash_type', l: 'İşlem Türü', t: 'select', opts: C.CASH_TYPES },
      { n: 'amount', l: 'Tutar (TL)', t: 'number', req: 1 },
      { n: 'personnel_id', l: 'Personel', t: 'master', master: 'personnel' },
      { n: 'customer_id', l: 'Müşteri (opsiyonel)', t: 'master', master: 'customers' },
      { n: 'cash_status', l: 'Durum', t: 'select', opts: C.CASH_STATUS },
      { n: 'description', l: 'Açıklama', t: 'textarea' }
    ]
  },
  personnel_event: {
    store: 'personnel_events', title: 'Personel Hareketi', note: 'Geçici kayıttır — maaş bordrosu üretmez.',
    fields: [
      { n: 'date', l: 'Tarih', t: 'date', req: 1 },
      { n: 'personnel_id', l: 'Personel', t: 'master', master: 'personnel' },
      { n: 'event_type', l: 'İşlem Türü', t: 'select', opts: C.PERSONNEL_EVENT_TYPES },
      { n: 'amount', l: 'Miktar / Tutar (opsiyonel)', t: 'number' },
      { n: 'hours_days', l: 'Saat / Gün (opsiyonel)', t: 'text' },
      { n: 'description', l: 'Açıklama', t: 'textarea' }
    ]
  },
  document: {
    store: 'documents', title: 'Belge / Fiş Notu', note: 'Resmi belge sistemi değildir — geçici belge toplama alanıdır.',
    fields: [
      { n: 'date', l: 'Tarih', t: 'date', req: 1 },
      { n: 'doc_category', l: 'Kategori', t: 'select', opts: C.DOC_CATEGORIES },
      { n: 'related_type', l: 'İlgili Kayıt Tipi (opsiyonel)', t: 'select', opts: ['', 'İş', 'Yakıt', 'Gider', 'Bakım', 'Kasa', 'Personel'] },
      { n: 'related_id', l: 'İlgili Kayıt ID (opsiyonel)', t: 'text' },
      { n: 'description', l: 'Açıklama', t: 'textarea' },
      { n: 'photo', l: 'Fotoğraf (opsiyonel)', t: 'file' }
    ]
  },
  customer: {
    store: 'customers', title: 'Müşteri',
    fields: [
      { n: 'name', l: 'İsim', t: 'text', req: 1 },
      { n: 'phone', l: 'Telefon (opsiyonel)', t: 'text' },
      { n: 'note', l: 'Not', t: 'textarea' }
    ], hidden: { active: true }
  },
  site: {
    store: 'sites', title: 'Şantiye',
    fields: [
      { n: 'customer_id', l: 'Müşteri', t: 'master', master: 'customers' },
      { n: 'name', l: 'Şantiye Adı', t: 'text', req: 1 },
      { n: 'location', l: 'Konum Metni (opsiyonel)', t: 'text' },
      { n: 'note', l: 'Not', t: 'textarea' }
    ], hidden: { active: true }
  },
  vehicle: {
    store: 'vehicles', title: 'Araç / Makine',
    fields: [
      { n: 'name', l: 'İsim / Plaka', t: 'text', req: 1 },
      { n: 'type', l: 'Tür', t: 'text' },
      { n: 'ownership', l: 'Özmal / Taşeron', t: 'select', opts: C.VEHICLE_OWNERSHIP }
    ], hidden: { active: true }
  },
  personnel: {
    store: 'personnel', title: 'Personel',
    fields: [
      { n: 'name', l: 'İsim', t: 'text', req: 1 },
      { n: 'role', l: 'Rol', t: 'text' }
    ], hidden: { active: true }
  }
};

// ---------- satır özetleri ----------
function rowTitle(store, r) {
  switch (store) {
    case 'work_records': return `${nameOf('customers', r.customer_id) || '—'} · ${r.work_type || ''} · ${r.quantity ?? ''} ${r.unit || ''}`.trim();
    case 'fuel_records': return `${nameOf('vehicles', r.vehicle_id) || '—'} · ${r.liters} Lt`;
    case 'fuel_tank_movements': return `Tank ${r.move_type} · ${r.liters} Lt`;
    case 'expense_records': return `${r.category || 'Gider'} · ${C.fmtTL(r.amount)} TL`;
    case 'maintenance_records': return `${nameOf('vehicles', r.vehicle_id) || '—'} · ${r.maint_type || ''} · ${r.status || ''}`;
    case 'cash_records': return `${r.cash_type || ''} · ${C.fmtTL(r.amount)} TL`;
    case 'personnel_events': return `${nameOf('personnel', r.personnel_id) || '—'} · ${r.event_type || ''}`;
    case 'documents': return `${r.doc_category || 'Belge'} ${r.description ? '· ' + r.description.slice(0, 30) : ''}`;
    default: return r.name || r.id;
  }
}
function rowSub(store, r) {
  const bits = [C.trDate(r.date || '')];
  if (store === 'work_records') bits.push(nameOf('sites', r.site_id), nameOf('vehicles', r.vehicle_id), nameOf('personnel', r.personnel_id), r.description);
  if (store === 'fuel_records') bits.push(nameOf('personnel', r.personnel_id), r.fuel_source);
  if (store === 'fuel_tank_movements') bits.push(nameOf('vehicles', r.vehicle_id), nameOf('personnel', r.personnel_id), r.note);
  if (store === 'expense_records') bits.push(nameOf('personnel', r.personnel_id), r.payment_method, r.payment_method === 'Personel Ödedi' ? `Ödeme: ${r.reimbursement_status || 'Bekliyor'}` : '');
  if (store === 'maintenance_records') bits.push(r.description);
  if (store === 'cash_records') bits.push(nameOf('personnel', r.personnel_id), nameOf('customers', r.customer_id), `Durum: ${r.cash_status || '—'}`);
  if (store === 'personnel_events') bits.push(r.amount ? `${C.fmtTL(r.amount)} TL` : '', r.hours_days, r.description);
  if (state.attMap[r.id]) bits.push(`📎 ${state.attMap[r.id]}`);
  return bits.filter(Boolean).join(' · ');
}
function haystack(store, r) {
  return [rowTitle(store, r), rowSub(store, r), r.internal_note, r.customer_note, r.material, r.company, r.doc_note].filter(Boolean).join(' ');
}

// ---------- üst bar ----------
function topbar(title, back = true) {
  const bar = h('div', { class: 'topbar' });
  if (back) bar.append(h('button', { class: 'backbtn', onclick: () => history.back() }, '‹'));
  bar.append(h('div', { class: 'topbar-title' }, title));
  bar.append(h('button', { class: 'homebtn', onclick: () => { location.hash = ''; } }, '⌂'));
  return bar;
}

// ---------- DASHBOARD ----------
async function renderDashboard() {
  const today = C.todayStr();
  const data = {};
  for (const s of C.ENTITY_STORES) data[s] = await DB.listActive(s);
  const sum = C.daySummary(today, data);
  const lastBackup = await DB.metaGet('last_backup_at');

  const root = h('div', { class: 'dash' });
  root.append(h('div', { class: 'brand' },
    h('div', { class: 'brand-name' }, 'SAHAPRO CEP'),
    h('div', { class: 'brand-sub' }, 'Geçici Mobil Operasyon Sistemi'),
    h('div', { class: 'brand-desc' }, 'Ana SAHAPRO devreye alınana kadar günlük işletme verilerinizi güvenle kaydeder. Daha sonra ana sisteme aktarılabilir.')
  ));

  // §41 yedek uyarısı (popup spam yok, küçük sarı şerit)
  if (!lastBackup || (Date.now() - new Date(lastBackup).getTime()) > 24 * 3600 * 1000) {
    root.append(h('div', { class: 'warnbar' }, '⚠ Son yedeğiniz 1 günden eski. Ayarlar → Tüm Verileri Yedekle.'));
  }

  root.append(h('div', { class: 'todayline' }, `BUGÜN — ${C.trDate(today)}`));
  const cards = h('div', { class: 'cards' });
  const card = (label, val) => h('div', { class: 'card' }, h('div', { class: 'card-val' }, String(val)), h('div', { class: 'card-label' }, label));
  cards.append(
    card('İş Kaydı', sum.work_count),
    card('Yakıt (Litre)', C.fmtTL(sum.fuel_liters)),
    card('Gider (TL)', C.fmtTL(sum.expense_total)),
    card('Bakım/Arıza', data.maintenance_records.filter(r => r.date === today).length),
    card('Açık Arıza (tümü)', data.maintenance_records.filter(r => r.status !== 'Tamamlandı').length),
    card('Tahsilat (TL)', C.fmtTL(sum.tahsilat_total))
  );
  root.append(cards);

  const q = h('div', { class: 'quick' });
  const qb = (label, mod) => h('button', { class: 'qbtn', onclick: () => { location.hash = 'form/' + mod; } }, label);
  q.append(qb('+ İş', 'work'), qb('+ Yakıt', 'fuel'), qb('+ Gider', 'expense'), qb('+ Arıza', 'maintenance'), qb('+ Tahsilat', 'cash'), qb('+ Personel', 'personnel_event'));
  root.append(q);

  const links = h('div', { class: 'linklist' });
  const lb = (label, hash) => h('button', { class: 'lbtn', onclick: () => { location.hash = hash; } }, label);
  links.append(
    lb('📋 Bugünün Kayıtları', 'today'),
    lb('🗂 Tüm Kayıtlar', 'records'),
    lb('⛽ Depo Yakıt', 'tank'),
    lb('🌙 Gün Sonu Özeti', 'dayend'),
    lb('📄 Belge / Fiş Notu', 'form/document'),
    lb('🗑 Çöp Kutusu', 'trash'),
    lb('⚙ Ayarlar · Yedekle · Dışa Aktar', 'settings')
  );
  root.append(links);
  root.append(h('div', { class: 'verline' }, C.APP_VERSION));

  screen().replaceChildren(topbar('SAHAPRO CEP', false), root);
}

// ---------- FORM (taslak autosave §25, son kaydı kopyala §24) ----------
let draftTimer = null;
async function renderForm(modKey, editRec = null) {
  const mod = MODULES[modKey];
  if (!mod) { location.hash = ''; return; }
  await loadMasters();
  const draftKey = 'form:' + modKey;
  let values = editRec ? { ...editRec } : {};
  let draftNote = null;
  if (!editRec) {
    const d = await DB.draftGet(draftKey);
    if (d && Object.keys(d).length) { values = { ...d }; draftNote = 'Taslak geri yüklendi (otomatik kayıt).'; }
  }
  if (!values.date) values.date = C.todayStr();

  const root = h('div', { class: 'formwrap' });
  if (mod.warn) root.append(h('div', { class: 'warnbar' }, '⚠ ' + mod.warn));
  if (mod.note) root.append(h('div', { class: 'notebar' }, mod.note));
  if (draftNote) root.append(h('div', { class: 'notebar' }, draftNote));

  const form = h('div', { class: 'form' });
  const inputs = {};
  const pendingFiles = {};

  const collect = () => {
    const v = {};
    for (const f of mod.fields) {
      if (f.t === 'file') continue;
      const el = inputs[f.n];
      if (!el) continue;
      v[f.n] = el.value;
    }
    return v;
  };
  const scheduleDraft = () => {
    if (editRec) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => DB.draftSave(draftKey, collect()), 400);
  };

  for (const f of mod.fields) {
    const wrapEl = h('label', { class: 'fld' });
    wrapEl.append(h('span', { class: 'fld-label' }, f.l + (f.req ? ' *' : '')));
    let el;
    if (f.t === 'select') {
      el = h('select', { name: f.n });
      for (const o of f.opts) el.append(h('option', { value: o }, o));
    } else if (f.t === 'master') {
      el = h('select', { name: f.n });
      const refill = () => {
        el.replaceChildren(h('option', { value: '' }, '— seç —'));
        for (const m of state.masters[f.master]) el.append(h('option', { value: m.id }, m.name));
        el.append(h('option', { value: '__new__' }, '➕ Yeni ekle…'));
      };
      refill();
      el.addEventListener('change', async () => {
        if (el.value === '__new__') {
          const nm = prompt('Yeni ' + f.l + ' adı:');
          if (nm && nm.trim()) {
            const rec = await DB.saveNew(f.master, { name: nm.trim(), active: true });
            await loadMasters(); refill(); el.value = rec.id;
          } else el.value = '';
        }
        scheduleDraft();
      });
    } else if (f.t === 'datalist') {
      el = h('input', { name: f.n, list: 'dl-' + f.n, autocomplete: 'off' });
      const dl = h('datalist', { id: 'dl-' + f.n });
      for (const o of f.opts) dl.append(h('option', { value: o }));
      wrapEl.append(dl);
    } else if (f.t === 'textarea') {
      el = h('textarea', { name: f.n, rows: '2' });
    } else if (f.t === 'file') {
      el = h('input', { name: f.n, type: 'file', accept: 'image/*', capture: 'environment' });
      el.addEventListener('change', () => { pendingFiles[f.n] = el.files[0] || null; });
    } else {
      el = h('input', { name: f.n, type: f.t === 'number' ? 'number' : f.t, step: f.t === 'number' ? 'any' : null, inputmode: f.t === 'number' ? 'decimal' : null });
    }
    if (f.t !== 'file') {
      el.value = values[f.n] ?? '';
      el.addEventListener('input', scheduleDraft);
    }
    inputs[f.n] = el;
    wrapEl.append(el);
    if (f.showIf) {
      const sync = () => { wrapEl.style.display = inputs[f.showIf.n].value === f.showIf.eq ? '' : 'none'; };
      inputs[f.showIf.n]?.addEventListener('input', sync);
      inputs[f.showIf.n]?.addEventListener('change', sync);
      setTimeout(sync, 0);
    }
    form.append(wrapEl);
  }

  // Yakıt: litre × birim fiyat → toplam otomatik (zorunlu değil §9)
  if (modKey === 'fuel') {
    const auto = () => {
      const l = parseFloat(inputs.liters.value), p = parseFloat(inputs.unit_price.value);
      if (!isNaN(l) && !isNaN(p)) inputs.total.value = (l * p).toFixed(2);
    };
    inputs.liters.addEventListener('input', auto);
    inputs.unit_price.addEventListener('input', auto);
  }

  const btns = h('div', { class: 'btnrow' });
  btns.append(h('button', {
    class: 'savebtn', onclick: async () => {
      const v = collect();
      for (const f of mod.fields) {
        if (f.req && !String(v[f.n] ?? '').trim()) { toast('Eksik alan: ' + f.l); inputs[f.n].focus(); return; }
      }
      for (const f of mod.fields) if (f.t === 'number' && v[f.n] !== '' && v[f.n] != null) v[f.n] = parseFloat(v[f.n]);
      Object.assign(v, mod.hidden || {});
      let rec;
      if (editRec) rec = await DB.saveExisting(mod.store, editRec, v);
      else rec = await DB.saveNew(mod.store, v);
      for (const f of mod.fields) {
        if (f.t === 'file' && pendingFiles[f.n]) await DB.addAttachment(mod.store, rec.id, pendingFiles[f.n]);
      }
      await DB.draftClear(draftKey);
      toast('Kaydedildi ✓');
      location.hash = '';
    }
  }, editRec ? 'Güncelle' : 'Kaydet'));

  if (modKey === 'work' && !editRec) {
    btns.append(h('button', {
      class: 'ghostbtn', onclick: async () => {
        const all = (await DB.listActive('work_records')).sort((a, b) => b.created_at.localeCompare(a.created_at));
        const last = all[0];
        if (!last) { toast('Kopyalanacak kayıt yok'); return; }
        for (const k of ['customer_id', 'site_id', 'vehicle_id', 'personnel_id', 'work_type', 'unit', 'material', 'dump_area', 'quarry']) {
          if (inputs[k] && last[k] != null) inputs[k].value = last[k];
        }
        scheduleDraft();
        toast('Son kayıt kopyalandı — iş/miktar değiştirilebilir');
      }
    }, 'Son Kaydı Kopyala'));
  }
  btns.append(h('button', { class: 'ghostbtn', onclick: () => { location.hash = ''; } }, 'Vazgeç'));

  root.append(form, btns);
  screen().replaceChildren(topbar((editRec ? 'Düzenle — ' : '+ ') + mod.title), root);
}

// ---------- kayıt listeleri (arama/filtre §27, soft delete §26) ----------
const LISTABLE = [
  ['work_records', 'İş'], ['fuel_records', 'Yakıt'], ['fuel_tank_movements', 'Depo'],
  ['expense_records', 'Gider'], ['maintenance_records', 'Bakım'], ['cash_records', 'Kasa'],
  ['personnel_events', 'Personel'], ['documents', 'Belge']
];
async function renderRecords(onlyToday = false) {
  await loadMasters();
  const root = h('div', { class: 'listwrap' });
  const filt = h('div', { class: 'filters' });
  const fDate = h('input', { type: 'date', value: onlyToday ? C.todayStr() : '' });
  const fType = h('select'); fType.append(h('option', { value: '' }, 'Tüm türler'));
  for (const [s, label] of LISTABLE) fType.append(h('option', { value: s }, label));
  const fCust = h('select'); fCust.append(h('option', { value: '' }, 'Müşteri (tümü)'));
  for (const m of state.masters.customers) fCust.append(h('option', { value: m.id }, m.name));
  const fVeh = h('select'); fVeh.append(h('option', { value: '' }, 'Araç (tümü)'));
  for (const m of state.masters.vehicles) fVeh.append(h('option', { value: m.id }, m.name));
  const fPer = h('select'); fPer.append(h('option', { value: '' }, 'Personel (tümü)'));
  for (const m of state.masters.personnel) fPer.append(h('option', { value: m.id }, m.name));
  const fQ = h('input', { type: 'search', placeholder: 'Ara: isim / açıklama' });
  filt.append(fDate, fType, fCust, fVeh, fPer, fQ);
  const listEl = h('div', { class: 'reclist' });
  root.append(filt, listEl);

  const redraw = async () => {
    const rows = [];
    for (const [store, label] of LISTABLE) {
      if (fType.value && fType.value !== store) continue;
      for (const r of await DB.listActive(store)) {
        if (fDate.value && r.date !== fDate.value) continue;
        if (onlyToday && r.date !== C.todayStr()) continue;
        if (fCust.value && r.customer_id !== fCust.value && !(store === 'sites' && r.customer_id === fCust.value)) continue;
        if (fVeh.value && r.vehicle_id !== fVeh.value) continue;
        if (fPer.value && r.personnel_id !== fPer.value) continue;
        if (!C.matchSearch(haystack(store, r), fQ.value)) continue;
        rows.push({ store, label, r });
      }
    }
    rows.sort((a, b) => (b.r.date || '').localeCompare(a.r.date || '') || b.r.created_at.localeCompare(a.r.created_at));
    listEl.replaceChildren();
    if (!rows.length) listEl.append(h('div', { class: 'empty' }, 'Kayıt yok.'));
    for (const { store, label, r } of rows) {
      const row = h('div', { class: 'rec' });
      const main = h('div', { class: 'rec-main' },
        h('div', { class: 'rec-title' }, `[${label}] ${rowTitle(store, r)}`),
        h('div', { class: 'rec-sub' }, rowSub(store, r)));
      const acts = h('div', { class: 'rec-acts' });
      acts.append(h('button', { class: 'minibtn', onclick: () => { state.editing = { store, id: r.id }; location.hash = `edit/${store}/${r.id}`; } }, '✎'));
      if (store === 'cash_records') {
        const nx = C.nextCashStatus(r.cash_status);
        if (nx) acts.append(h('button', {
          class: 'minibtn ok', onclick: async () => {
            await DB.saveExisting(store, r, { cash_status: nx });
            toast('Durum → ' + nx); redraw();
          }
        }, nx === 'TESLIM_BILDIRILDI' ? 'Teslim Bildir' : 'Kasaya Teslim'));
      }
      acts.append(h('button', {
        class: 'minibtn danger', onclick: async () => {
          if (confirm('Bu kayıt çöp kutusuna taşınsın mı? (Geri yüklenebilir)')) {
            await DB.softDelete(store, r.id); toast('Çöp kutusunda'); redraw();
          }
        }
      }, '🗑'));
      row.append(main, acts);
      listEl.append(row);
    }
  };
  for (const el of [fDate, fType, fCust, fVeh, fPer, fQ]) { el.addEventListener('input', redraw); el.addEventListener('change', redraw); }
  await redraw();
  screen().replaceChildren(topbar(onlyToday ? 'Bugünün Kayıtları' : 'Tüm Kayıtlar'), root);
}

// ---------- çöp kutusu (§26) ----------
async function renderTrash() {
  await loadMasters();
  const root = h('div', { class: 'listwrap' });
  const listEl = h('div', { class: 'reclist' });
  let count = 0;
  for (const [store, label] of LISTABLE) {
    for (const r of await DB.getAll(store)) {
      if (!r.deleted_at) continue;
      count++;
      const row = h('div', { class: 'rec deleted' });
      row.append(h('div', { class: 'rec-main' },
        h('div', { class: 'rec-title' }, `[${label}] ${rowTitle(store, r)}`),
        h('div', { class: 'rec-sub' }, `Silinme: ${C.trDate((r.deleted_at || '').slice(0, 10))}`)));
      row.append(h('div', { class: 'rec-acts' }, h('button', {
        class: 'minibtn ok', onclick: async () => { await DB.restore(store, r.id); toast('Geri yüklendi ✓'); renderTrash(); }
      }, 'Geri Yükle')));
      listEl.append(row);
    }
  }
  if (!count) listEl.append(h('div', { class: 'empty' }, 'Çöp kutusu boş.'));
  root.append(h('div', { class: 'notebar' }, 'Kalıcı silme bu uygulamada YOKTUR — kayıtlar buradan geri yüklenir.'), listEl);
  screen().replaceChildren(topbar('Çöp Kutusu'), root);
}

// ---------- depo yakıt (§10) ----------
async function renderTank() {
  await loadMasters();
  const moves = await DB.listActive('fuel_tank_movements');
  const bal = C.calcTankBalance(moves);
  const root = h('div', { class: 'formwrap' });
  root.append(h('div', { class: 'cards' },
    h('div', { class: 'card' }, h('div', { class: 'card-val' }, C.fmtTL(bal.in)), h('div', { class: 'card-label' }, 'Toplam Giriş (Lt)')),
    h('div', { class: 'card' }, h('div', { class: 'card-val' }, C.fmtTL(bal.out)), h('div', { class: 'card-label' }, 'Toplam Çıkış (Lt)')),
    h('div', { class: 'card big' }, h('div', { class: 'card-val' }, C.fmtTL(bal.remaining)), h('div', { class: 'card-label' }, 'Tahmini Kalan (Lt)'))
  ));
  root.append(h('div', { class: 'notebar' }, 'Geçici takiptir — gerçek finansal stok muhasebesi değildir.'));

  const form = h('div', { class: 'form' });
  const fDate = h('input', { type: 'date', value: C.todayStr() });
  const fType = h('select'); fType.append(h('option', {}, 'GİRİŞ'), h('option', {}, 'ÇIKIŞ'));
  const fLit = h('input', { type: 'number', step: 'any', inputmode: 'decimal', placeholder: 'Litre' });
  const fVeh = h('select'); fVeh.append(h('option', { value: '' }, 'Araç/Makine (çıkışta)'));
  for (const m of state.masters.vehicles) fVeh.append(h('option', { value: m.id }, m.name));
  const fPer = h('select'); fPer.append(h('option', { value: '' }, 'Personel'));
  for (const m of state.masters.personnel) fPer.append(h('option', { value: m.id }, m.name));
  const fPump = h('input', { placeholder: 'Pompa sayaç no (opsiyonel)' });
  const fSign = h('input', { placeholder: 'İmza / Ad' });
  const fNote = h('input', { placeholder: 'Not' });
  const wrap = (l, el) => h('label', { class: 'fld' }, h('span', { class: 'fld-label' }, l), el);
  form.append(wrap('Tarih', fDate), wrap('İşlem Tipi', fType), wrap('Litre', fLit), wrap('Araç/Makine', fVeh), wrap('Personel', fPer), wrap('Pompa Sayaç No', fPump), wrap('İmza / Ad', fSign), wrap('Not', fNote));
  root.append(form);
  root.append(h('div', { class: 'btnrow' }, h('button', {
    class: 'savebtn', onclick: async () => {
      if (!fLit.value || parseFloat(fLit.value) <= 0) { toast('Litre girin'); return; }
      await DB.saveNew('fuel_tank_movements', {
        date: fDate.value, move_type: fType.value, liters: parseFloat(fLit.value),
        vehicle_id: fVeh.value, personnel_id: fPer.value, pump_no: fPump.value, signer: fSign.value, note: fNote.value
      });
      toast('Tank hareketi kaydedildi ✓'); renderTank();
    }
  }, 'Kaydet')));

  const hist = h('div', { class: 'reclist' });
  for (const m of moves.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)) {
    hist.append(h('div', { class: 'rec' }, h('div', { class: 'rec-main' },
      h('div', { class: 'rec-title' }, `${m.move_type} · ${m.liters} Lt`),
      h('div', { class: 'rec-sub' }, [C.trDate(m.date), nameOf('vehicles', m.vehicle_id), nameOf('personnel', m.personnel_id), m.signer, m.note].filter(Boolean).join(' · ')))));
  }
  root.append(h('div', { class: 'todayline' }, 'Son Hareketler'), hist);
  screen().replaceChildren(topbar('Depo Yakıt Takibi'), root);
}

// ---------- gün sonu (§22/§32/§33) ----------
async function renderDayEnd() {
  const today = C.todayStr();
  const data = {};
  for (const s of C.ENTITY_STORES) data[s] = await DB.getAll(s);
  const sum = C.daySummary(today, data);
  await loadMasters();
  const names = {};
  for (const s of ['customers', 'sites', 'vehicles', 'personnel']) {
    names[s] = {}; for (const m of state.masters[s]) names[s][m.id] = m.name;
  }
  const waText = C.buildWhatsAppText(today, data, names);

  const root = h('div', { class: 'formwrap' });
  root.append(h('div', { class: 'todayline' }, `Gün Sonu — ${C.trDate(today)}`));
  const g = h('div', { class: 'sumlist' });
  const line = (l, v) => h('div', { class: 'sumline' }, h('span', {}, l), h('b', {}, String(v)));
  g.append(
    line('İş kayıtları', sum.work_count),
    line('Toplam sefer', sum.total_sefer),
    line('Toplam makine saat', sum.total_saat),
    line('Toplam yevmiye', sum.total_yevmiye),
    line('Yakıt', C.fmtTL(sum.fuel_liters) + ' litre'),
    line('Gider', C.fmtTL(sum.expense_total) + ' TL'),
    line('Tahsilat bildirimi', C.fmtTL(sum.tahsilat_total) + ' TL'),
    line('Açık arıza (bugün)', sum.open_breakdowns),
    line('Personel hareketi', sum.personnel_events)
  );
  root.append(g);

  root.append(h('div', { class: 'todayline' }, 'WhatsApp Özeti'));
  root.append(h('pre', { class: 'wabox' }, waText));

  const btns = h('div', { class: 'btnrow col' });
  btns.append(h('button', {
    class: 'savebtn', onclick: async () => {
      try { await navigator.clipboard.writeText(waText); toast('WhatsApp metni kopyalandı ✓'); }
      catch { toast('Kopyalama başarısız — metni elle seçin'); }
    }
  }, '📲 WhatsApp Metnini Kopyala'));
  btns.append(h('button', {
    class: 'ghostbtn', onclick: async () => {
      const dayData = {};
      for (const s of C.ENTITY_STORES) dayData[s] = (data[s] || []).filter(r => r.date === today || !r.date);
      const installId = await DB.metaGet('device_install_id');
      const backup = C.buildBackup(dayData, installId);
      download(`SAHAPRO-CEP-GUN-${today}.json`, JSON.stringify(backup, null, 2), 'application/json');
      await DB.metaSet('last_backup_at', C.nowISO());
      toast('Bugün yedeklendi ✓');
    }
  }, '💾 BUGÜNÜ YEDEKLE (JSON)'));
  btns.append(h('button', {
    class: 'ghostbtn', onclick: async () => { await exportCSVZip(today); }
  }, '📄 Bugünün CSV Paketi'));
  root.append(btns);
  screen().replaceChildren(topbar('Gün Sonu Özeti'), root);
}

// ---------- CSV üretimi (modül başına §31) ----------
function csvFor(store, rows) {
  const nm = (s, id) => nameOf(s, id);
  switch (store) {
    case 'work_records': return C.toCSV(['tarih', 'saat', 'musteri', 'santiye', 'arac', 'personel', 'is_turu', 'aciklama', 'malzeme', 'miktar', 'birim', 'dokum_sahasi', 'ocak', 'fis_durumu', 'musteri_notu', 'ic_not', 'id'],
      rows.map(r => [r.date, r.time, nm('customers', r.customer_id), nm('sites', r.site_id), nm('vehicles', r.vehicle_id), nm('personnel', r.personnel_id), r.work_type, r.description, r.material, r.quantity, r.unit, r.dump_area, r.quarry, r.slip_status, r.customer_note, r.internal_note, r.id]));
    case 'fuel_records': return C.toCSV(['tarih', 'arac', 'personel', 'litre', 'birim_fiyat', 'toplam', 'kaynak', 'fis', 'pompa_no', 'km', 'saat', 'aciklama', 'id'],
      rows.map(r => [r.date, nm('vehicles', r.vehicle_id), nm('personnel', r.personnel_id), r.liters, r.unit_price, r.total, r.fuel_source, r.receipt, r.pump_no, r.km, r.machine_hours, r.description, r.id]));
    case 'fuel_tank_movements': return C.toCSV(['tarih', 'tip', 'litre', 'arac', 'personel', 'pompa_no', 'imza', 'not', 'id'],
      rows.map(r => [r.date, r.move_type, r.liters, nm('vehicles', r.vehicle_id), nm('personnel', r.personnel_id), r.pump_no, r.signer, r.note, r.id]));
    case 'expense_records': return C.toCSV(['tarih', 'personel', 'kategori', 'tutar', 'odeme', 'personel_odeme_durumu', 'firma', 'aciklama', 'fis', 'belge_notu', 'id'],
      rows.map(r => [r.date, nm('personnel', r.personnel_id), r.category, r.amount, r.payment_method, r.reimbursement_status, r.company, r.description, r.receipt, r.doc_note, r.id]));
    case 'maintenance_records': return C.toCSV(['tarih', 'arac', 'personel', 'tip', 'aciklama', 'durum', 'maliyet', 'servis', 'km_saat', 'id'],
      rows.map(r => [r.date, nm('vehicles', r.vehicle_id), nm('personnel', r.personnel_id), r.maint_type, r.description, r.status, r.cost, r.service_company, r.km_hours, r.id]));
    case 'cash_records': return C.toCSV(['tarih', 'islem', 'tutar', 'personel', 'musteri', 'durum', 'aciklama', 'id'],
      rows.map(r => [r.date, r.cash_type, r.amount, nm('personnel', r.personnel_id), nm('customers', r.customer_id), r.cash_status, r.description, r.id]));
    case 'personnel_events': return C.toCSV(['tarih', 'personel', 'islem', 'tutar', 'saat_gun', 'aciklama', 'id'],
      rows.map(r => [r.date, nm('personnel', r.personnel_id), r.event_type, r.amount, r.hours_days, r.description, r.id]));
    case 'documents': return C.toCSV(['tarih', 'kategori', 'ilgili_tip', 'ilgili_id', 'aciklama', 'id'],
      rows.map(r => [r.date, r.doc_category, r.related_type, r.related_id, r.description, r.id]));
    case 'customers': return C.toCSV(['isim', 'telefon', 'not', 'aktif', 'id'], rows.map(r => [r.name, r.phone, r.note, r.active ? 'evet' : 'hayir', r.id]));
    case 'sites': return C.toCSV(['musteri', 'santiye', 'konum', 'not', 'aktif', 'id'], rows.map(r => [nm('customers', r.customer_id), r.name, r.location, r.note, r.active ? 'evet' : 'hayir', r.id]));
    case 'vehicles': return C.toCSV(['isim_plaka', 'tur', 'ozmal_taseron', 'aktif', 'id'], rows.map(r => [r.name, r.type, r.ownership, r.active ? 'evet' : 'hayir', r.id]));
    case 'personnel': return C.toCSV(['isim', 'rol', 'aktif', 'id'], rows.map(r => [r.name, r.role, r.active ? 'evet' : 'hayir', r.id]));
    default: return '';
  }
}
const CSV_NAMES = {
  work_records: 'is_kayitlari.csv', fuel_records: 'yakit.csv', fuel_tank_movements: 'depo_yakit.csv',
  expense_records: 'giderler.csv', maintenance_records: 'bakim_ariza.csv', cash_records: 'kasa.csv',
  personnel_events: 'personel_hareketleri.csv', documents: 'belgeler.csv',
  customers: 'musteriler.csv', sites: 'santiyeler.csv', vehicles: 'arac_makine.csv', personnel: 'personel.csv'
};
async function exportCSVZip(onlyDate = null) {
  await loadMasters();
  const enc = new TextEncoder();
  const files = [];
  for (const s of C.ENTITY_STORES) {
    let rows = await DB.listActive(s);
    if (onlyDate) rows = rows.filter(r => !r.date || r.date === onlyDate);
    const csv = '﻿' + csvFor(s, rows); // BOM — Excel Türkçe uyumu
    files.push({ name: CSV_NAMES[s], data: enc.encode(csv) });
  }
  const zip = C.buildZip(files);
  const name = onlyDate ? `SAHAPRO-CEP-GUN-${onlyDate}-CSV.zip` : 'SAHAPRO-CEP-EXPORT.zip';
  download(name, new Blob([zip], { type: 'application/zip' }));
  toast('CSV paketi indirildi ✓');
}

// ---------- tam yedek / geri yükle / foto export (§28/§31/§34/§39) ----------
async function fullBackup() {
  const data = await DB.dumpAll();
  const installId = await DB.metaGet('device_install_id');
  const backup = C.buildBackup(data, installId);
  download(`SAHAPRO-CEP-BACKUP-${backupStamp()}.json`, JSON.stringify(backup, null, 2), 'application/json');
  await DB.metaSet('last_backup_at', C.nowISO());
  toast('Tam yedek indirildi ✓');
}
async function fullExportZip() {
  const data = await DB.dumpAll();
  const installId = await DB.metaGet('device_install_id');
  const backup = C.buildBackup(data, installId);
  const enc = new TextEncoder();
  const files = [{ name: `SAHAPRO-CEP-BACKUP-${backupStamp()}.json`, data: enc.encode(JSON.stringify(backup, null, 2)) }];
  await loadMasters();
  for (const s of C.ENTITY_STORES) {
    files.push({ name: CSV_NAMES[s], data: enc.encode('﻿' + csvFor(s, (data[s] || []).filter(C.isActive))) });
  }
  download('SAHAPRO-CEP-EXPORT.zip', new Blob([C.buildZip(files)], { type: 'application/zip' }));
  await DB.metaSet('last_backup_at', C.nowISO());
  toast('JSON + CSV paketi indirildi ✓');
}
async function exportPhotosZip() {
  const atts = await DB.getAll('attachments');
  if (!atts.length) { toast('Kayıtlı fotoğraf yok'); return; }
  const files = [];
  for (const a of atts) {
    const buf = new Uint8Array(await a.blob.arrayBuffer());
    files.push({ name: `${a.record_type}/${a.id}_${a.name}` });
    files[files.length - 1].data = buf;
  }
  download('SAHAPRO-CEP-FOTOGRAFLAR.zip', new Blob([C.buildZip(files)], { type: 'application/zip' }));
  toast(`${atts.length} fotoğraf paketlendi ✓`);
}
async function importBackup(file, reportEl) {
  let obj;
  try { obj = JSON.parse(await file.text()); } catch { reportEl.textContent = 'Geçersiz dosya: JSON okunamadı.'; return; }
  if (!C.isValidBackup(obj)) { reportEl.textContent = 'Geçersiz dosya: SAHAPRO CEP yedeği değil.'; return; }
  const lines = [`Dosya: ${file.name}`, `Yedek tarihi: ${obj.exported_at || '?'} · şema v${obj.schema_version}`, ''];
  let totalNew = 0, totalExist = 0, totalConf = 0;
  const plan = [];
  for (const s of C.ENTITY_STORES) {
    const imported = obj.data[s] || [];
    if (!imported.length) continue;
    const local = await DB.getAll(s);
    const pv = C.mergePreview(local, imported);
    totalNew += pv.new.length; totalExist += pv.existing.length; totalConf += pv.conflict.length;
    lines.push(`${s}: Yeni ${pv.new.length} · Mevcut ${pv.existing.length} · Çakışma ${pv.conflict.length}`);
    plan.push({ s, add: pv.new });
  }
  lines.push('', `TOPLAM — Yeni: ${totalNew} · Mevcut: ${totalExist} · Çakışma: ${totalConf}`);
  lines.push(totalConf ? 'Çakışan kayıtlar ATLANACAK (kör overwrite yapılmaz).' : 'Çakışma yok.');
  reportEl.textContent = lines.join('\n');
  if (!totalNew) { toast('Eklenecek yeni kayıt yok'); return; }
  if (!confirm(`${totalNew} yeni kayıt içe aktarılsın mı? (Mevcutlar korunur, çakışmalar atlanır)`)) return;
  for (const p of plan) for (const r of p.add) await DB.put(p.s, r);
  await DB.metaSet('last_backup_at', C.nowISO());
  toast(`İçe aktarım tamam: ${totalNew} kayıt ✓`);
  renderSettings();
}

// ---------- PIN (§45 — basit local UI lock, kriptografik iddia YOK) ----------
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function checkPinLock() {
  const pinHash = await DB.metaGet('pin_hash');
  if (!pinHash || sessionStorage.getItem('cep_unlocked') === '1') return true;
  return new Promise((resolve) => {
    const ov = h('div', { class: 'pinoverlay' });
    const inp = h('input', { type: 'password', inputmode: 'numeric', placeholder: 'PIN', maxlength: '8' });
    ov.append(
      h('div', { class: 'pinbox' },
        h('div', { class: 'brand-name' }, 'SAHAPRO CEP'),
        h('div', { class: 'notebar' }, 'Basit local ekran kilidi (kriptografik koruma değildir).'),
        inp,
        h('button', {
          class: 'savebtn', onclick: async () => {
            if (await sha256(inp.value) === pinHash) {
              sessionStorage.setItem('cep_unlocked', '1'); ov.remove(); resolve(true);
            } else { toast('Yanlış PIN'); inp.value = ''; }
          }
        }, 'Aç')));
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ov.querySelector('.savebtn').click(); });
    document.body.append(ov);
    inp.focus();
  });
}

// ---------- ayarlar ----------
async function renderSettings() {
  await loadMasters();
  const root = h('div', { class: 'formwrap' });

  // §40 sistem durumu
  const counts = [];
  let totalRec = 0;
  for (const s of C.ENTITY_STORES) { const n = (await DB.getAll(s)).length; totalRec += n; }
  const photos = (await DB.getAll('attachments')).length;
  let est = '';
  try {
    const e = await navigator.storage.estimate();
    est = C.fmtTL(((e.usage || 0) / 1048576).toFixed(1)) + ' MB' + (e.quota ? ` / kota ~${C.fmtTL((e.quota / 1073741824).toFixed(1))} GB` : '');
  } catch { est = 'ölçülemedi'; }
  const lastBackup = await DB.metaGet('last_backup_at');
  const stat = h('div', { class: 'sumlist' });
  stat.append(
    h('div', { class: 'sumline' }, h('span', {}, 'Kayıt'), h('b', {}, String(totalRec))),
    h('div', { class: 'sumline' }, h('span', {}, 'Fotoğraf'), h('b', {}, String(photos))),
    h('div', { class: 'sumline' }, h('span', {}, 'Tahmini local storage'), h('b', {}, est)),
    h('div', { class: 'sumline' }, h('span', {}, 'Son yedek'), h('b', {}, lastBackup ? new Date(lastBackup).toLocaleString('tr-TR') : 'hiç')),
    h('div', { class: 'sumline' }, h('span', {}, 'Sürüm'), h('b', {}, C.APP_VERSION))
  );
  root.append(h('div', { class: 'todayline' }, 'Sistem Durumu'), stat);

  // yedek / dışa aktar / içe aktar
  const bk = h('div', { class: 'btnrow col' });
  bk.append(h('button', { class: 'savebtn', onclick: fullBackup }, '💾 TÜM VERİLERİ YEDEKLE (JSON)'));
  bk.append(h('button', { class: 'ghostbtn', onclick: fullExportZip }, '📦 DIŞA AKTAR (ZIP = JSON + tüm CSV)'));
  bk.append(h('button', { class: 'ghostbtn', onclick: exportPhotosZip }, '🖼 Fotoğrafları Ayrı Dışa Aktar (ZIP)'));
  const importInput = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  const importReport = h('pre', { class: 'wabox', style: 'display:none' });
  importInput.addEventListener('change', () => {
    if (importInput.files[0]) {
      importReport.style.display = '';
      importBackup(importInput.files[0], importReport);
      importInput.value = '';
    }
  });
  bk.append(h('button', { class: 'ghostbtn', onclick: () => importInput.click() }, '♻ YEDEKTEN GERİ YÜKLE (önizlemeli)'), importInput, importReport);
  root.append(h('div', { class: 'todayline' }, 'Yedekleme / Aktarım'), bk);

  // PIN
  const pinRow = h('div', { class: 'btnrow col' });
  const pinHash = await DB.metaGet('pin_hash');
  pinRow.append(h('div', { class: 'notebar' }, 'PIN yalnızca basit bir local ekran kilididir; kriptografik güvenlik sağlamaz. Kurtarma yoktur — unutursanız tarayıcı verisini temizlemeniz gerekir.'));
  pinRow.append(h('button', {
    class: 'ghostbtn', onclick: async () => {
      if (pinHash) {
        if (confirm('PIN kilidi kaldırılsın mı?')) { await DB.metaSet('pin_hash', null); renderSettings(); }
      } else {
        const p1 = prompt('Yeni PIN (4-8 rakam):');
        if (!p1 || !/^\d{4,8}$/.test(p1)) { toast('Geçersiz PIN'); return; }
        const p2 = prompt('PIN tekrar:');
        if (p1 !== p2) { toast('PINler eşleşmedi'); return; }
        await DB.metaSet('pin_hash', await sha256(p1));
        toast('PIN ayarlandı ✓'); renderSettings();
      }
    }
  }, pinHash ? '🔓 PIN Kilidini Kaldır' : '🔒 PIN Kilidi Kur'));
  root.append(h('div', { class: 'todayline' }, 'Ekran Kilidi (opsiyonel)'), pinRow);

  // ana listeler yönetimi
  root.append(h('div', { class: 'todayline' }, 'Ana Listeler'));
  const masterMods = [['customer', 'Müşteriler'], ['site', 'Şantiyeler'], ['vehicle', 'Araç / Makine'], ['personnel', 'Personel']];
  for (const [mk, label] of masterMods) {
    const mod = MODULES[mk];
    const box = h('details', { class: 'masterbox' });
    box.append(h('summary', {}, `${label} (${state.masters[mod.store].length})`));
    const ul = h('div', { class: 'reclist' });
    const all = await DB.getAll(mod.store);
    for (const r of all.filter(x => !x.deleted_at)) {
      const tgl = h('button', {
        class: 'minibtn' + (r.active === false ? '' : ' ok'), onclick: async () => {
          await DB.saveExisting(mod.store, r, { active: r.active === false ? true : false });
          renderSettings();
        }
      }, r.active === false ? 'Pasif' : 'Aktif');
      ul.append(h('div', { class: 'rec' },
        h('div', { class: 'rec-main' }, h('div', { class: 'rec-title' }, r.name || '—'), h('div', { class: 'rec-sub' }, [r.phone, r.role, r.type, r.ownership, r.location].filter(Boolean).join(' · '))),
        h('div', { class: 'rec-acts' }, tgl)));
    }
    box.append(ul, h('button', { class: 'ghostbtn', onclick: () => { location.hash = 'form/' + mk; } }, '+ Yeni ' + label.replace(/ler$/, '').replace(/lar$/, '')));
    root.append(box);
  }

  root.append(h('div', { class: 'notebar' },
    'Bu uygulama ANA SAHAPRO DEĞİLDİR: Supabase/Cloud bağlantısı yoktur, hakediş/muhasebe kesinleştirmesi yapmaz, resmi finansal onay üretmez. Tüm veriler bu cihazda (IndexedDB) tutulur.'));
  screen().replaceChildren(topbar('Ayarlar'), root);
}

// ---------- düzenleme köprüsü ----------
async function renderEdit(store, id) {
  const rec = await DB.get(store, id);
  if (!rec) { toast('Kayıt bulunamadı'); location.hash = 'records'; return; }
  const modKey = Object.keys(MODULES).find(k => MODULES[k].store === store);
  if (!modKey) { location.hash = 'records'; return; }
  renderForm(modKey, rec);
}

// ---------- router ----------
async function route() {
  if (!(await checkPinLock())) return;
  const hash = location.hash.replace(/^#\/?/, '');
  const [page, a, b] = hash.split('/');
  try {
    if (!page) await renderDashboard();
    else if (page === 'form') await renderForm(a);
    else if (page === 'edit') await renderEdit(a, b);
    else if (page === 'records') await renderRecords(false);
    else if (page === 'today') await renderRecords(true);
    else if (page === 'trash') await renderTrash();
    else if (page === 'tank') await renderTank();
    else if (page === 'dayend') await renderDayEnd();
    else if (page === 'settings') await renderSettings();
    else await renderDashboard();
  } catch (err) {
    console.error(err);
    screen().replaceChildren(topbar('Hata'), h('div', { class: 'warnbar' }, 'Beklenmeyen hata: ' + (err && err.message)));
  }
}

// ---------- başlat ----------
(async function boot() {
  await DB.ensureSeeded();
  window.addEventListener('hashchange', route);
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) { console.warn('SW kaydı başarısız', e); }
  }
  await route();
})();

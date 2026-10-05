// SAHAPRO SOLO — İş Kayıtları · Dijital Fiş (imza, immutable, revizyon) · WhatsApp Ayrıştırıcı
import { qs, qsa, esc, appbar, stat, li, emptyState, notice, kv, badge, statusBadge, segBar, searchBar, sheet, sheetClose, toast, confirmDialog, promptDialog, fText, fNum, fDate, fArea, fSelect, collectForm, setForm, fmtTL, fmtNum, trDate, todayStr, pagedRender, shareOrDownload, back, go } from './ui.js';
import { WORK_UNITS, WORK_TYPES, isActive, todayStr as td, matchSearch, newRecord } from './core.js';
import { parseWhatsApp, buildAliasIndex, voiceSupported, startVoice } from './parser.js';

export async function screen(ctx) {
  const root0 = ctx.parts[0];
  if (root0 === 'isler') return work(ctx);
  if (root0 === 'fisler') return slips(ctx);
  if (root0 === 'whatsapp') return whatsapp(ctx);
  return work(ctx);
}

// ============ İŞ KAYITLARI ============
async function work(ctx) {
  const sub = ctx.parts[1];
  if (sub === 'new') return workForm(ctx, null);
  if (sub && ctx.parts[2] === 'edit') return workForm(ctx, sub);
  if (sub) return workDetail(ctx, sub);
  return workList(ctx);
}

async function workList(ctx) {
  const { root, db, names, query } = ctx;
  const filter = query.f || 'all';
  const q = query.q || '';
  let rows = (await db.getAll('work_records')).filter(isActive);
  const today = todayStr();
  if (filter === 'today') rows = rows.filter(r => r.date === today);
  if (filter === 'week') { const from = new Date(); from.setDate(from.getDate() - 7); const fs = from.toISOString().slice(0, 10); rows = rows.filter(r => r.date >= fs); }
  if (filter === 'noslip') rows = rows.filter(r => !r.slip_id);
  rows = rows.filter(r => matchSearch(`${names.customers[r.customer_id] || ''} ${names.sites[r.site_id] || ''} ${names.vehicles[r.vehicle_id] || ''} ${names.personnel[r.personnel_id] || ''} ${r.work_type} ${r.description || ''} ${r.material || ''}`, q));
  rows.sort((a, b) => (b.date + (b.created_at || '')) < (a.date + (a.created_at || '')) ? -1 : 1);

  root.innerHTML = appbar('İş Kayıtları', `${rows.length} kayıt`, { right: '<button class="iconbtn" data-go="#/whatsapp">💬</button>' }) + `
    <div style="height:10px"></div>
    ${segBar([{ v: 'all', t: 'Tümü' }, { v: 'today', t: 'Bugün' }, { v: 'week', t: '7 Gün' }, { v: 'noslip', t: 'Fişsiz' }], filter, v => `#/isler?f=${v}${q ? '&q=' + encodeURIComponent(q) : ''}`)}
    ${searchBar('Müşteri, araç, personel, iş…', q)}
    <div data-list></div>
    <div class="actionbar"><button class="btn primary" data-go="#/isler/new">+ Yeni İş Kaydı</button></div>`;

  const listEl = qs('[data-list]', root);
  if (!rows.length) listEl.innerHTML = emptyState('⚒', 'Kayıt yok', '<button class="btn primary" data-go="#/isler/new">+ İş Kaydı</button>');
  else pagedRender(listEl, rows, (w) => li({
    ic: '⚒', href: '#/isler/' + w.id,
    t1: `${esc(names.customers[w.customer_id] || '—')} · ${esc(w.work_type || 'İş')}`,
    t2: `${trDate(w.date)} · ${esc(names.vehicles[w.vehicle_id] || '—')} — ${esc(names.personnel[w.personnel_id] || '—')}${w.site_id ? ' · ' + esc(names.sites[w.site_id]) : ''}`,
    badgeHtml: w.slip_id ? badge('Fişli', 'ok') : (w.slip_status === 'Fiş Var' ? badge('Fiş Var', 'info') : ''),
    end: `<div class="amt nowrap">${fmtNum(w.quantity)} ${esc(w.unit || '')}</div>`
  }));

  let st;
  qs('[data-search]', root).addEventListener('input', (e) => { clearTimeout(st); st = setTimeout(() => go(`#/isler?f=${filter}&q=${encodeURIComponent(e.target.value)}`), 450); });
}

async function workForm(ctx, editId) {
  const { root, db, names, query } = ctx;
  const [customers, sites, vehicles, personnel] = await Promise.all([db.listActive('customers'), db.listActive('sites'), db.listActive('vehicles'), db.listActive('personnel')]);
  let rec = editId ? await db.get('work_records', editId) : null;

  // Ön-doldurma: WhatsApp taslağı / son kayıt kopyası
  let prefill = null;
  if (!editId && window.__prefill) { prefill = window.__prefill; window.__prefill = null; }
  if (!editId && !prefill && query.copylast === '1') {
    const all = (await db.getAll('work_records')).filter(isActive);
    if (all.length) { const last = all[all.length - 1]; prefill = { customer_id: last.customer_id, site_id: last.site_id, vehicle_id: last.vehicle_id, personnel_id: last.personnel_id, work_type: last.work_type, unit: last.unit }; }
  }
  // Taslak autosave
  if (!editId && !prefill) {
    const draft = await db.draftGet('work');
    if (draft && Object.values(draft).some(v => v)) prefill = draft;
  }
  const v = rec || prefill || {};

  const custOpts = customers.map(c => ({ v: c.id, t: c.name }));
  const siteOpts = sites.map(s => ({ v: s.id, t: s.name }));
  const vehOpts = vehicles.map(x => ({ v: x.id, t: x.name }));
  const perOpts = personnel.map(x => ({ v: x.id, t: x.name }));

  root.innerHTML = appbar(editId ? 'İş Düzenle' : '+ İş Kaydı', 'Her iş ayrı kayıt') + `
    ${editId ? '' : notice('info', 'Farklı iş veya malzeme türlerini ayrı kayıt girin. HER İŞ AYRI KAYIT.')}
    ${!editId && prefill && !rec ? '<div class="notice info"><span>ℹ</span><span>Taslak/son kayıt bilgileri yüklendi.</span></div>' : ''}
    <form data-form novalidate>
      ${fDate('Tarih', 'date', v.date)}
      <div class="formgrid2">
        ${fSelect('Müşteri', 'customer_id', [...custOpts, { v: '__new__', t: '➕ Yeni müşteri…' }], v.customer_id)}
        ${fSelect('Şantiye', 'site_id', [...siteOpts, { v: '__new__', t: '➕ Yeni şantiye…' }], v.site_id)}
      </div>
      <div class="formgrid2">
        ${fSelect('Araç / Makine', 'vehicle_id', [...vehOpts, { v: '__new__', t: '➕ Yeni…' }], v.vehicle_id)}
        ${fSelect('Şoför / Operatör', 'personnel_id', [...perOpts, { v: '__new__', t: '➕ Yeni…' }], v.personnel_id)}
      </div>
      ${fSelect('İş Türü', 'work_type', WORK_TYPES, v.work_type || '')}
      <div class="formgrid2">
        ${fNum('Miktar', 'quantity', v.quantity ?? '', { req: true, step: 'any' })}
        ${fSelect('Birim', 'unit', WORK_UNITS, v.unit || 'Sefer', { empty: false })}
      </div>
      ${fText('Malzeme', 'material', v.material || '', { ph: 'mıcır, kum…' })}
      <div class="formgrid2">
        ${fText('Döküm Sahası', 'dump_area', v.dump_area || '')}
        ${fText('Malzeme Ocağı', 'quarry', v.quarry || '')}
      </div>
      <div class="formgrid2">
        ${fSelect('Fiş Durumu', 'slip_status', ['Fiş Var', 'Fiş Yok'], v.slip_status || '')}
        ${fText('Fiş No', 'slip_no', v.slip_no || '')}
      </div>
      ${fArea('İş Açıklaması', 'description', v.description || '')}
      ${fArea('Müşteri Notu (PDF\'te görünür)', 'customer_note', v.customer_note || '')}
      ${fArea('İç Not (müşteriye GÖSTERİLMEZ)', 'internal_note', v.internal_note || '')}
    </form>
    <div class="actionbar">
      ${editId ? '' : '<button class="btn" data-copylast>Son Kaydı Kopyala</button>'}
      <button class="btn primary" data-save>Kaydet</button>
    </div>`;

  const form = qs('[data-form]', root);
  // Yeni ekleme akışları
  const bindNew = (name, store, label, extra = {}) => {
    const sel = qs(`select[name=${name}]`, form);
    sel.addEventListener('change', async () => {
      if (sel.value !== '__new__') return;
      sel.value = rec ? (rec[name] || '') : '';
      const name2 = await promptDialog('Yeni ' + label, 'Ad');
      if (!name2) return;
      if (store === 'sites') {
        const cid = qs('select[name=customer_id]', form).value || null;
        const created = await db.saveNew('sites', { name: name2, customer_id: cid, active: true });
        sel.insertAdjacentHTML('beforeend', `<option value="${created.id}">${esc(name2)}</option>`);
        sel.value = created.id;
      } else {
        const fields = store === 'vehicles' ? { name: name2, type: 'Araç/Makine', ownership: 'Özmal', active: true } : store === 'personnel' ? { name: name2, active: true } : { name: name2, active: true };
        const created = await db.saveNew(store, fields);
        sel.insertAdjacentHTML('beforeend', `<option value="${created.id}">${esc(name2)}</option>`);
        sel.value = created.id;
      }
      toast('Eklendi: ' + name2, 'ok');
    });
  };
  bindNew('customer_id', 'customers', 'Müşteri');
  bindNew('site_id', 'sites', 'Şantiye');
  bindNew('vehicle_id', 'vehicles', 'Araç/Makine');
  bindNew('personnel_id', 'personnel', 'Personel');

  // Müşteri seçilince şantiyeleri filtrele
  qs('select[name=customer_id]', form).addEventListener('change', (e) => {
    const cid = e.target.value;
    const sel = qs('select[name=site_id]', form);
    const opts = sites.filter(s => !cid || s.customer_id === cid || !s.customer_id);
    sel.innerHTML = '<option value="">— seç —</option>' + opts.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('') + '<option value="__new__">➕ Yeni şantiye…</option>';
  });

  // Autosave (yeni kayıtta)
  if (!editId) {
    let t;
    form.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => db.draftSave('work', collectForm(form)), 600); });
  }
  const copyBtn = qs('[data-copylast]', root);
  if (copyBtn) copyBtn.addEventListener('click', () => go('#/isler/new?copylast=1'));

  qs('[data-save]', root).addEventListener('click', async () => {
    const val = collectForm(form);
    if (!val.quantity || Number(val.quantity) <= 0) { toast('Miktar girin (0\'dan büyük)', 'err'); return; }
    if (!val.vehicle_id && !val.personnel_id) { toast('Araç veya personel seçin', 'err'); return; }
    const fields = {
      date: val.date || todayStr(), time: val.time || null,
      customer_id: val.customer_id || null, site_id: val.site_id || null,
      vehicle_id: val.vehicle_id || null, personnel_id: val.personnel_id || null,
      work_type: val.work_type || 'Diğer', description: val.description || '',
      material: val.material || '', quantity: Number(val.quantity), unit: val.unit || 'Sefer',
      dump_area: val.dump_area || '', quarry: val.quarry || '',
      slip_status: val.slip_status || null, slip_no: val.slip_no || '',
      customer_note: val.customer_note || '', internal_note: val.internal_note || ''
    };
    // Duplicate adayı uyarısı (otomatik engelleme YOK)
    if (!editId) {
      const sameDay = (await db.getAll('work_records')).filter(r => isActive(r) && r.date === fields.date && r.vehicle_id === fields.vehicle_id && r.customer_id === fields.customer_id && r.work_type === fields.work_type && Number(r.quantity) === fields.quantity);
      if (sameDay.length) {
        const ok = await confirmDialog('Olası mükerrer kayıt', 'Aynı gün/araç/müşteri/iş/miktar ile kayıt var. Yine de kaydedilsin mi?', 'Kaydet', false);
        if (!ok) return;
      }
    }
    if (editId) {
      await db.saveExisting('work_records', rec, fields);
      toast('İş güncellendi', 'ok');
      go('#/isler/' + editId);
    } else {
      const created = await db.saveNew('work_records', fields);
      await db.draftClear('work');
      toast('İş kaydedildi', 'ok');
      go('#/isler/' + created.id);
    }
  });
}

async function workDetail(ctx, id) {
  const { root, db, names } = ctx;
  const w = await db.get('work_records', id);
  if (!w) { root.innerHTML = appbar('İş') + emptyState('⚒', 'Kayıt bulunamadı'); return; }
  const slip = w.slip_id ? await db.get('slips', w.slip_id) : null;
  const inHakedis = (await db.getAll('hakedis')).some(h => isActive(h) && h.status !== 'İptal' && (h.items || []).some(it => it.work_record_id === id));
  root.innerHTML = appbar('İş Detayı', trDate(w.date)) + `
    <div class="card">
      <div class="row between"><span class="strong" style="font-size:16px">${esc(w.work_type || 'İş')}</span><span class="amt">${fmtNum(w.quantity)} ${esc(w.unit || '')}</span></div>
      <div class="divider"></div>
      ${kv('Tarih', trDate(w.date) + (w.time ? ' ' + w.time : ''))}
      ${kv('Müşteri', names.customers[w.customer_id] || '—')}
      ${kv('Şantiye', names.sites[w.site_id] || '—')}
      ${kv('Araç/Makine', names.vehicles[w.vehicle_id] || '—')}
      ${kv('Personel', names.personnel[w.personnel_id] || '—')}
      ${w.material ? kv('Malzeme', w.material) : ''}
      ${w.dump_area ? kv('Döküm', w.dump_area) : ''}
      ${w.quarry ? kv('Ocak', w.quarry) : ''}
      ${w.slip_status ? kv('Fiş', w.slip_status + (w.slip_no ? ' #' + w.slip_no : '')) : ''}
      ${w.description ? kv('Açıklama', w.description) : ''}
      ${w.customer_note ? kv('Müşteri Notu', w.customer_note) : ''}
      ${w.internal_note ? kv('İç Not', w.internal_note) : ''}
      ${slip ? kv('Dijital Fiş', '#' + String(slip.slip_no).padStart(6, '0') + ' (' + slip.status + ')') : ''}
      ${inHakedis ? kv('Hakediş', 'Bu iş hakedişe dahil') : ''}
    </div>
    <div class="actionbar">
      ${slip ? `<button class="btn" data-go="#/fisler/${slip.id}">🧾 Fiş</button>` : `<button class="btn" data-mkslip>🧾 Fiş Oluştur</button>`}
      ${inHakedis ? '' : `<button class="btn" data-go="#/isler/${id}/edit">Düzenle</button>`}
      <button class="btn danger" data-del>Sil</button>
    </div>`;
  const mk = qs('[data-mkslip]', root);
  if (mk) mk.addEventListener('click', () => go('#/fisler/new?work=' + id));
  qs('[data-del]', root).addEventListener('click', async () => {
    const reason = await promptDialog('Kayıt siliniyor', 'Silme nedeni (çöp kutusuna taşınır)');
    if (reason === null) return;
    await db.softDelete('work_records', id, reason);
    toast('Çöp kutusuna taşındı', 'ok');
    go('#/isler');
  });
}

// ============ DİJİTAL FİŞLER ============
async function slips(ctx) {
  const sub = ctx.parts[1];
  if (sub === 'new') return slipForm(ctx, null);
  if (sub && ctx.parts[2] === 'imza') return slipSign(ctx, sub);
  if (sub) return slipDetail(ctx, sub);
  return slipList(ctx);
}

async function slipList(ctx) {
  const { root, db, names, query } = ctx;
  const f = query.f || 'all';
  let rows = (await db.getAll('slips')).filter(isActive).sort((a, b) => (b.slip_no || 0) - (a.slip_no || 0));
  if (f !== 'all') rows = rows.filter(r => r.status === f);
  root.innerHTML = appbar('Dijital İş Fişleri', `${rows.length} fiş`, { right: '<button class="iconbtn" data-go="#/belgeler">🗂</button>' }) + `
    <div style="height:10px"></div>
    ${segBar([{ v: 'all', t: 'Tümü' }, { v: 'Taslak', t: 'Taslak' }, { v: 'İmzalandı', t: 'İmzalandı' }, { v: 'Revize', t: 'Revize' }], f, v => `#/fisler?f=${v}`)}
    <div data-list></div>
    <div class="actionbar"><button class="btn primary" data-go="#/fisler/new">+ Yeni Fiş</button></div>`;
  const listEl = qs('[data-list]', root);
  if (!rows.length) listEl.innerHTML = emptyState('🧾', 'Henüz dijital fiş yok', '<button class="btn primary" data-go="#/fisler/new">+ Fiş Oluştur</button>');
  else pagedRender(listEl, rows, (s) => li({
    ic: '🧾', href: '#/fisler/' + s.id,
    t1: `#${String(s.slip_no || 0).padStart(6, '0')} · ${esc(names.customers[s.customer_id] || '—')}`,
    t2: `${trDate(s.date)} · ${esc(names.vehicles[s.vehicle_id] || '—')} · ${fmtNum(s.quantity)} ${esc(s.unit || '')}`,
    badgeHtml: statusBadge(s.status || 'Taslak')
  }));
}

async function slipForm(ctx, editId) {
  const { root, db, names, query } = ctx;
  const [customers, sites, vehicles, personnel] = await Promise.all([db.listActive('customers'), db.listActive('sites'), db.listActive('vehicles'), db.listActive('personnel')]);
  let rec = editId ? await db.get('slips', editId) : null;
  if (rec && rec.status === 'İmzalandı') { toast('İmzalı fiş düzenlenemez — revizyon oluşturun', 'err'); go('#/fisler/' + editId); return; }
  let v = rec || {};
  if (!editId && query.work) {
    const w = await db.get('work_records', query.work);
    if (w) v = { date: w.date, customer_id: w.customer_id, site_id: w.site_id, vehicle_id: w.vehicle_id, personnel_id: w.personnel_id, work_text: w.work_type, quantity: w.quantity, unit: w.unit, description: w.description, work_record_id: w.id };
  }
  const vehName = (id) => (vehicles.find(x => x.id === id) || {}).name || '';

  root.innerHTML = appbar(editId ? 'Fiş Düzenle' : '+ Dijital Fiş', editId ? 'Seri #' + String(rec.slip_no).padStart(6, '0') : 'Seri no otomatik verilir') + `
    <form data-form novalidate>
      ${fDate('Tarih', 'date', v.date)}
      <div class="formgrid2">
        ${fSelect('Müşteri', 'customer_id', customers.map(c => ({ v: c.id, t: c.name })), v.customer_id, { req: true })}
        ${fSelect('Şantiye', 'site_id', sites.map(s => ({ v: s.id, t: s.name })), v.site_id)}
      </div>
      <div class="formgrid2">
        ${fSelect('Araç / Makine', 'vehicle_id', vehicles.map(x => ({ v: x.id, t: x.name })), v.vehicle_id)}
        ${fText('Plaka', 'plate', v.plate || vehName(v.vehicle_id), {})}
      </div>
      ${fSelect('Personel', 'personnel_id', personnel.map(x => ({ v: x.id, t: x.name })), v.personnel_id)}
      ${fText('Yapılan İş', 'work_text', v.work_text || '', { req: true, ph: 'Hafriyat nakliye…' })}
      <div class="formgrid2">
        ${fNum('Miktar', 'quantity', v.quantity ?? '', { req: true, step: 'any' })}
        ${fSelect('Birim', 'unit', WORK_UNITS, v.unit || 'Sefer', { empty: false })}
      </div>
      ${fArea('Açıklama', 'description', v.description || '')}
      ${fText('Teslim Alan (ad soyad)', 'receiver_name', v.receiver_name || '')}
    </form>
    <div class="actionbar"><button class="btn primary" data-save>${editId ? 'Kaydet' : 'Kaydet ve İmzaya Geç'}</button></div>`;

  qs('select[name=vehicle_id]', root).addEventListener('change', (e) => { qs('input[name=plate]', root).value = vehName(e.target.value); });

  qs('[data-save]', root).addEventListener('click', async () => {
    const val = collectForm(qs('[data-form]', root));
    if (!val.customer_id) { toast('Müşteri seçin', 'err'); return; }
    if (!val.work_text) { toast('Yapılan iş yazın', 'err'); return; }
    if (!val.quantity || Number(val.quantity) <= 0) { toast('Miktar girin', 'err'); return; }
    const fields = {
      date: val.date || todayStr(), customer_id: val.customer_id, site_id: val.site_id || null,
      vehicle_id: val.vehicle_id || null, plate: val.plate || '', personnel_id: val.personnel_id || null,
      work_text: val.work_text, quantity: Number(val.quantity), unit: val.unit,
      description: val.description || '', receiver_name: val.receiver_name || '',
      work_record_id: v.work_record_id || null
    };
    if (editId) {
      await db.saveExisting('slips', rec, fields, 'Fiş düzenlendi');
      toast('Fiş güncellendi', 'ok');
      go('#/fisler/' + editId);
    } else {
      const no = await db.nextSeq('slip');
      const created = await db.saveNew('slips', { ...fields, slip_no: no, status: 'Taslak', revision_no: 1 });
      if (created.work_record_id) {
        const w = await db.get('work_records', created.work_record_id);
        if (w) await db.saveExisting('work_records', w, { slip_id: created.id }, 'Fiş bağlandı');
      }
      toast('Fiş #' + String(no).padStart(6, '0') + ' oluşturuldu', 'ok');
      go('#/fisler/' + created.id + '/imza');
    }
  });
}

async function slipSign(ctx, id) {
  const { root, db } = ctx;
  const s = await db.get('slips', id);
  if (!s) { root.innerHTML = appbar('İmza') + emptyState('🧾', 'Fiş yok'); return; }
  if (s.status === 'İmzalandı') { go('#/fisler/' + id); return; }
  root.innerHTML = appbar('Parmak İmzası', 'Fiş #' + String(s.slip_no).padStart(6, '0')) + `
    <div class="notice info"><span>ℹ</span><span>İmzalayan ekrana parmağıyla imza atar. İmzadan sonra fiş değiştirilemez; düzeltme için revizyon oluşturulur.</span></div>
    <div class="sigframe"><canvas class="sigpad" data-pad></canvas></div>
    <div class="row" style="margin-top:10px;gap:8px">
      <button class="btn ghost grow" data-clear>Temizle</button>
      <button class="btn ghost grow" data-skip>İmzasız Kaydet</button>
      <button class="btn ok grow" data-sign>İmzala ✓</button>
    </div>`;
  const pad = qs('[data-pad]', root);
  const rect = () => pad.getBoundingClientRect();
  pad.width = 640; pad.height = 320;
  const c2 = pad.getContext('2d');
  c2.lineWidth = 5; c2.lineCap = 'round'; c2.strokeStyle = '#12233a';
  let drawing = false, hasInk = false;
  const pos = (e) => { const r = rect(); const t = e.touches ? e.touches[0] : e; return [(t.clientX - r.left) * (pad.width / r.width), (t.clientY - r.top) * (pad.height / r.height)]; };
  const start = (e) => { drawing = true; const [x, y] = pos(e); c2.beginPath(); c2.moveTo(x, y); e.preventDefault(); };
  const move = (e) => { if (!drawing) return; const [x, y] = pos(e); c2.lineTo(x, y); c2.stroke(); hasInk = true; e.preventDefault(); };
  const end = () => { drawing = false; };
  pad.addEventListener('pointerdown', start); pad.addEventListener('pointermove', move); pad.addEventListener('pointerup', end); pad.addEventListener('pointerleave', end);
  pad.addEventListener('touchstart', start, { passive: false }); pad.addEventListener('touchmove', move, { passive: false }); pad.addEventListener('touchend', end);

  qs('[data-clear]', root).addEventListener('click', () => { c2.clearRect(0, 0, pad.width, pad.height); hasInk = false; });
  qs('[data-skip]', root).addEventListener('click', () => go('#/fisler/' + id));
  qs('[data-sign]', root).addEventListener('click', async () => {
    if (!hasInk) { toast('Önce imza atın', 'err'); return; }
    const blob = await new Promise(r => pad.toBlob(r, 'image/png'));
    const att = await db.addAttachment('slip_signature', id, new File([blob], 'imza.png', { type: 'image/png' }), { kind: 'signature' });
    await db.saveExisting('slips', s, { status: 'İmzalandı', signed_at: new Date().toISOString(), signature_attachment_id: att.id }, 'Fiş imzalandı — immutable');
    // Revizyon zinciri: bu fiş bir revizyon ise orijinali "Revize" işaretle
    if (s.revision_of) {
      const orig = await db.get('slips', s.revision_of);
      if (orig && orig.status === 'İmzalandı') await db.saveExisting('slips', orig, { status: 'Revize' }, 'Revizyon imzalandı: #' + s.slip_no);
    }
    toast('Fiş imzalandı ve kilitlendi', 'ok');
    go('#/fisler/' + id);
  });
}

async function slipDetail(ctx, id) {
  const { root, db, names } = ctx;
  const s = await db.get('slips', id);
  if (!s) { root.innerHTML = appbar('Fiş') + emptyState('🧾', 'Fiş yok'); return; }
  const atts = await db.attachmentsFor('slip_signature', id);
  const sig = atts.find(a => a.kind === 'signature');
  const revisions = (await db.getAll('slips')).filter(x => isActive(x) && x.revision_of === id);

  root.innerHTML = appbar('Fiş #' + String(s.slip_no).padStart(6, '0'), trDate(s.date), { right: statusBadge(s.status || 'Taslak') }) + `
    <div style="height:10px"></div>
    <div class="card">
      ${kv('Müşteri', names.customers[s.customer_id] || '—')}
      ${kv('Şantiye', names.sites[s.site_id] || '—')}
      ${kv('Araç / Plaka', (names.vehicles[s.vehicle_id] || '—') + (s.plate ? ' / ' + s.plate : ''))}
      ${kv('Personel', names.personnel[s.personnel_id] || '—')}
      ${kv('Yapılan İş', s.work_text || '—')}
      ${kv('Miktar', fmtNum(s.quantity) + ' ' + (s.unit || ''))}
      ${s.description ? kv('Açıklama', s.description) : ''}
      ${kv('Teslim Alan', s.receiver_name || '—')}
      ${s.signed_at ? kv('İmza Zamanı', new Date(s.signed_at).toLocaleString('tr-TR')) : ''}
      ${s.revision_no > 1 ? kv('Revizyon', 'v' + s.revision_no) : ''}
    </div>
    ${sig ? `<div class="section-title">İmza</div><div class="sigframe"><img data-sig alt="İmza"></div>` : ''}
    ${revisions.length ? `<div class="section-title">Revizyonlar</div>` + revisions.map(r => li({ ic: '🧾', href: '#/fisler/' + r.id, t1: `#${String(r.slip_no).padStart(6, '0')} (v${r.revision_no})`, badgeHtml: statusBadge(r.status) })).join('') : ''}
    <div class="actionbar">
      ${s.status === 'Taslak' ? `<button class="btn ok" data-go="#/fisler/${id}/imza">İmzala</button><button class="btn" data-go="#/fisler/${id}/edit">Düzenle</button>` : ''}
      ${s.status === 'İmzalandı' ? `<button class="btn" data-revize>Revizyon</button>` : ''}
      <button class="btn primary" data-pdf>PDF</button>
      ${s.status !== 'İmzalandı' ? '<button class="btn danger" data-del>İptal</button>' : ''}
    </div>`;

  if (sig) {
    const url = URL.createObjectURL(sig.blob);
    qs('[data-sig]', root).src = url;
  }
  const rv = qs('[data-revize]', root);
  if (rv) rv.addEventListener('click', async () => {
    const ok = await confirmDialog('Revizyon oluşturulsun mu?', 'Orijinal imzalı fiş korunur; yeni taslak kopya açılır.', 'Oluştur');
    if (!ok) return;
    const no = await db.nextSeq('slip');
    const copy = { ...s, id: undefined, slip_no: no, status: 'Taslak', signed_at: null, signature_attachment_id: null, revision_of: s.revision_of || s.id, revision_no: (s.revision_no || 1) + 1, work_record_id: s.work_record_id };
    delete copy.id; delete copy.created_at; delete copy.updated_at; delete copy.deleted_at; delete copy.schema_version; delete copy.migration_status; delete copy.source;
    const created = await db.saveNew('slips', copy, 'Revizyon #' + no);
    toast('Revizyon taslağı #' + String(no).padStart(6, '0'), 'ok');
    go('#/fisler/' + created.id);
  });
  qs('[data-pdf]', root).addEventListener('click', async () => {
    const pdf = await import('./pdf.js');
    await pdf.slipPdf(s, names, sig ? sig.blob : null, ctx);
  });
  const del = qs('[data-del]', root);
  if (del) del.addEventListener('click', async () => {
    const reason = await promptDialog('Fiş iptali', 'İptal nedeni');
    if (!reason) return;
    await db.saveExisting('slips', s, { status: 'İptal' }, reason);
    toast('Fiş iptal edildi', 'ok');
    ctx.reload();
  });
}

// ============ WHATSAPP AYRIŞTIRICI ============
async function whatsapp(ctx) {
  const { root, db } = ctx;
  const [vehicles, customers, sites, personnel, aliases] = await Promise.all([db.listActive('vehicles'), db.listActive('customers'), db.listActive('sites'), db.listActive('personnel'), db.listActive('aliases')]);
  const aliasIdx = buildAliasIndex(aliases, vehicles, customers, sites, personnel);

  root.innerHTML = appbar('WhatsApp Ayrıştırıcı', 'Mesajı yapıştır → taslak → sen onayla') + `
    <div class="notice info"><span>ℹ</span><span>Taslaklar otomatik kaydedilmez; her birini tek tek onaylarsın. Belirsizler "KONTROL GEREKLİ" işaretlenir. Ham mesaj saklanır.</span></div>
    <div class="field"><label>Mesaj metni</label><textarea data-raw style="min-height:130px" placeholder="U55 sevgi sokak ahmet bey 1 yevmiye&#10;34UL9492 leda 3 sefer hafriyat"></textarea></div>
    <div class="row" style="gap:8px;margin-bottom:12px">
      <button class="btn primary grow" data-parse>Ayrıştır</button>
      ${voiceSupported() ? '<button class="btn" data-voice>🎙 Sesli</button>' : ''}
    </div>
    <div data-out></div>`;

  const rawEl = qs('[data-raw]', root);
  const vBtn = qs('[data-voice]', root);
  if (vBtn) vBtn.addEventListener('click', () => {
    toast('Konuşun…', 'ok');
    startVoice((t) => { rawEl.value = (rawEl.value + '\n' + t).trim(); }, () => {});
  });
  qs('[data-parse]', root).addEventListener('click', () => {
    const drafts = parseWhatsApp(rawEl.value, { vehicles, customers, sites, personnel, aliasIdx, defaultDate: todayStr() });
    const out = qs('[data-out]', root);
    if (!drafts.length) { out.innerHTML = emptyState('💬', 'Satır bulunamadı'); return; }
    out.innerHTML = `<div class="section-title">${drafts.length} taslak</div>` + drafts.map((d, i) => `
      <div class="card">
        <div class="row between">
          <span class="badge ${d.confidence >= 80 ? 'ok' : d.confidence >= 50 ? 'warn' : 'danger'}">%${d.confidence} güven</span>
          ${d.kontrol_gerekli ? '<span class="badge warn">KONTROL GEREKLİ</span>' : ''}
        </div>
        <div style="margin:8px 0" class="small">
          ${kv('Tarih', trDate(d.date))}
          ${kv('Müşteri/Şantiye', (d.customer_id ? esc((customers.find(c => c.id === d.customer_id) || {}).name) : '—') + ' / ' + (d.site_id ? esc((sites.find(s => s.id === d.site_id) || {}).name) : '—'))}
          ${kv('Araç/Personel', (d.vehicle_id ? esc((vehicles.find(v => v.id === d.vehicle_id) || {}).name) : '—') + ' / ' + (d.personnel_id ? esc((personnel.find(p => p.id === d.personnel_id) || {}).name) : '—'))}
          ${kv('İş', (d.work_type || '—') + ' · ' + (d.quantity ?? '?') + ' ' + (d.unit || ''))}
          ${d.fuel_liters ? kv('Yakıt', d.fuel_liters + ' Lt') : ''}
          ${d.notes.length ? kv('Notlar', d.notes.join('; ')) : ''}
        </div>
        <div class="tiny muted ellipsis" style="margin-bottom:8px">Ham: ${esc(d.raw_message)}</div>
        <div class="row" style="gap:8px">
          <button class="btn sm grow" data-edit="${i}">Düzenle</button>
          <button class="btn sm primary grow" data-save="${i}">Onayla & Kaydet</button>
        </div>
      </div>`).join('');
    out.onclick = async (ev) => {
      const eb = ev.target.closest('[data-edit]');
      const sb = ev.target.closest('[data-save]');
      if (eb) {
        const d = drafts[Number(eb.dataset.edit)];
        window.__prefill = { date: d.date, customer_id: d.customer_id, site_id: d.site_id, vehicle_id: d.vehicle_id, personnel_id: d.personnel_id, work_type: d.work_type, quantity: d.quantity, unit: d.unit, description: d.description, dump_area: d.dump_area, quarry: d.quarry };
        go('#/isler/new');
      }
      if (sb) {
        const d = drafts[Number(sb.dataset.save)];
        await db.saveNew('work_records', {
          date: d.date, customer_id: d.customer_id, site_id: d.site_id, vehicle_id: d.vehicle_id, personnel_id: d.personnel_id,
          work_type: d.work_type || 'Diğer', quantity: d.quantity || 1, unit: d.unit || 'Adet',
          description: d.description || '', dump_area: d.dump_area || '', quarry: d.quarry || '', slip_status: d.slip_status,
          raw_message: d.raw_message, parse_confidence: d.confidence, kontrol_gerekli: d.kontrol_gerekli
        }, 'WhatsApp onay');
        if (d.fuel_liters && d.vehicle_id) {
          await db.saveNew('fuel_records', { date: d.date, vehicle_id: d.vehicle_id, personnel_id: d.personnel_id, liters: d.fuel_liters, fuel_source: 'Depo Tankı', receipt: 'Hayır', customer_billable: false, description: 'WhatsApp: ' + d.raw_message }, 'WhatsApp onay');
        }
        sb.closest('.card').style.opacity = '.4';
        sb.disabled = true; sb.textContent = 'Kaydedildi ✓';
        toast('Kaydedildi', 'ok');
      }
    };
  });
}

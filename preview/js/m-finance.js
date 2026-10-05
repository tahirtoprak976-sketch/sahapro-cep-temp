// SAHAPRO SOLO — Finans: Teklif · Fiyat Listesi · Hakediş · Cari · Kasa · Gider
import { qs, qsa, esc, appbar, stat, li, emptyState, notice, kv, badge, statusBadge, segBar, searchBar, sheet, toast, confirmDialog, promptDialog, fText, fNum, fDate, fArea, fSelect, collectForm, fmtTL, fmtNum, trDate, todayStr, pagedRender, go, downloadBlob } from './ui.js';
import { isActive, matchSearch, calcQuoteTotals, calcHakedisTotals, resolvePrice, cariBalance, QUOTE_TYPES, PAYMENT_METHODS, CASH_TYPES, EXPENSE_CATEGORIES, REIMBURSEMENT_STATUS, WORK_UNITS, WORK_TYPES, nextCashStatus } from './core.js';

export async function screen(ctx) {
  const sub = ctx.parts[0];
  if (sub === 'teklif') return quotes(ctx);
  if (sub === 'fiyat') return priceBook(ctx);
  if (sub === 'hakedis') return hakedis(ctx);
  if (sub === 'cari') return cari(ctx);
  if (sub === 'kasa') return cash(ctx);
  if (sub === 'gider') return expenses(ctx);
  return hub(ctx);
}

// ============ FİNANS HUB ============
async function hub(ctx) {
  const { root, db } = ctx;
  const today = todayStr();
  const from = today.slice(0, 8) + '01';
  const [hak, cashR, exp] = await Promise.all([db.getAll('hakedis'), db.getAll('cash_records'), db.getAll('expense_records')]);
  const monthH = hak.filter(h => isActive(h) && h.status === 'Kesinleşti' && (h.created_date || '') >= from).reduce((s, h) => s + (Number(h.grand_total) || 0), 0);
  const monthT = cashR.filter(c => isActive(c) && c.cash_type === 'Müşteriden Para Alındı' && c.date >= from).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const monthG = exp.filter(e => isActive(e) && e.date >= from).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const items = [
    ['#/teklif', '📄', 'Teklif', '4 teklif türü + PDF'],
    ['#/hakedis', '📑', 'Hakediş', 'snapshot + kesinleştirme'],
    ['#/cari', '🏦', 'Cari', 'müşteri bakiyeleri'],
    ['#/kasa', '💰', 'Kasa', 'tahsilat akışı'],
    ['#/gider', '💸', 'Gider', 'fişli takip'],
    ['#/fiyat', '🏷', 'Fiyat Listesi', 'fiyatlar + vinç tarifesi']
  ];
  root.innerHTML = appbar('Finans', 'Bu ay') + `
    <div class="statgrid" style="grid-template-columns:repeat(3,1fr);margin-top:10px">
      ${stat(fmtTL(monthH), 'Hakediş ₺', 'accent')}
      ${stat(fmtTL(monthT), 'Tahsilat ₺', 'ok')}
      ${stat(fmtTL(monthG), 'Gider ₺', 'warn')}
    </div>
    <div class="quickgrid" style="grid-template-columns:repeat(3,1fr);margin-top:10px">
      ${items.map(([h, ic, t, d]) => `<button data-go="${h}" style="aspect-ratio:1.35"><span class="ic">${ic}</span>${t}<span class="tiny muted">${d}</span></button>`).join('')}
    </div>`;
}

// ============ TEKLİF ============
async function quotes(ctx) {
  const sub = ctx.parts[1];
  if (sub === 'new') return quoteForm(ctx, null);
  if (sub && ctx.parts[2] === 'edit') return quoteForm(ctx, sub);
  if (sub) return quoteDetail(ctx, sub);
  const { root, db, names } = ctx;
  const rows = (await db.getAll('quotes')).filter(isActive).sort((a, b) => (b.quote_no || 0) - (a.quote_no || 0));
  root.innerHTML = appbar('Teklifler', `${rows.length} teklif`) + `
    <div style="height:10px"></div><div data-list></div>
    <div class="actionbar"><button class="btn primary" data-go="#/teklif/new">+ Yeni Teklif</button></div>`;
  const listEl = qs('[data-list]', root);
  if (!rows.length) listEl.innerHTML = emptyState('📄', 'Henüz teklif yok', '<button class="btn primary" data-go="#/teklif/new">+ Teklif</button>');
  else pagedRender(listEl, rows, (t) => {
    const tot = calcQuoteTotals(t);
    return li({
      ic: '📄', href: '#/teklif/' + t.id,
      t1: `#${String(t.quote_no || 0).padStart(4, '0')} · ${esc(names.customers[t.customer_id] || '—')}`,
      t2: `${trDate(t.date)} · ${t.type}`,
      badgeHtml: statusBadge(t.status || 'Taslak'),
      end: tot.show_total ? `<div class="amt nowrap">${fmtTL(tot.grand)} ₺</div>` : `<div class="tiny muted">toplam yok</div>`
    });
  });
}

function quoteTypeNote(type) {
  if (type === 'UNIT_PRICE') return 'Birim fiyat teklifidir — satır fiyatları toplanmaz, toplam gösterilmez.';
  if (type === 'ALTERNATIVE') return 'Alternatifli teklif — alternatifler birbirine EKLENMEZ.';
  if (type === 'LUMP_SUM') return 'Götürü bedel — anlaşılan toplam esastır.';
  return 'Miktar × birim fiyat üzerinden hesaplanır.';
}

async function quoteForm(ctx, editId) {
  const { root, db } = ctx;
  const [customers, sites] = await Promise.all([db.listActive('customers'), db.listActive('sites')]);
  const rec = editId ? await db.get('quotes', editId) : null;
  const v = rec || { type: 'QUANTITY_BASED', items: [{ label: '', unit: 'Sefer', quantity: 1, unit_price: '' }], kdv_rate: 20 };
  let items = JSON.parse(JSON.stringify(v.items || []));

  root.innerHTML = appbar(editId ? 'Teklif Düzenle' : '+ Teklif', editId ? '#' + String(rec.quote_no).padStart(4, '0') : 'No otomatik') + `
    <form data-form novalidate>
      ${fDate('Tarih', 'date', v.date)}
      <div class="formgrid2">
        ${fSelect('Müşteri', 'customer_id', customers.map(c => ({ v: c.id, t: c.name })), v.customer_id, { req: true })}
        ${fSelect('Şantiye', 'site_id', sites.map(s => ({ v: s.id, t: s.name })), v.site_id)}
      </div>
      <div class="field"><label>Teklif Türü</label><div class="chiprow" data-types>
        ${QUOTE_TYPES.map(t => `<button type="button" class="chip ${v.type === t ? 'on' : ''}" data-type="${t}">${t}</button>`).join('')}
      </div><div class="hint" data-typenote>${quoteTypeNote(v.type)}</div></div>
      <div class="section-title">Kalemler</div>
      <div data-items></div>
      <button type="button" class="btn ghost sm" data-additem>+ Kalem Ekle</button>
      <div class="formgrid2" style="margin-top:12px">
        ${fNum('KDV %', 'kdv_rate', v.kdv_rate ?? 20)}
        <div class="field" data-lump style="display:${v.type === 'LUMP_SUM' ? 'block' : 'none'}"><label>Anlaşılan Toplam (₺)</label><input type="number" name="lump_total" value="${v.lump_total ?? ''}" step="any"></div>
      </div>
      ${fArea('Notlar (PDF\'te görünür)', 'notes', v.notes || '')}
      <div data-preview></div>
    </form>
    <div class="actionbar"><button class="btn primary" data-save>Kaydet</button></div>`;

  let type = v.type || 'QUANTITY_BASED';
  const itemsEl = qs('[data-items]', root);
  function renderItems() {
    itemsEl.innerHTML = items.map((it, i) => `
      <div class="card" style="padding:10px">
        <div class="row" style="gap:6px;margin-bottom:6px">
          <input type="text" class="grow" data-i="${i}" data-k="label" value="${esc(it.label)}" placeholder="Kalem (ör. Hafriyat nakliye)" style="min-height:42px;background:var(--bg2);border:1.5px solid var(--border);border-radius:10px;color:var(--text);padding:8px 10px">
          <button type="button" class="btn sm danger" data-del="${i}">✕</button>
        </div>
        <div class="row" style="gap:6px">
          <select data-i="${i}" data-k="unit" style="flex:1;min-height:42px;background:var(--bg2);border:1.5px solid var(--border);border-radius:10px;color:var(--text)">${WORK_UNITS.map(u => `<option ${u === it.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>
          ${type === 'QUANTITY_BASED' ? `<input type="number" data-i="${i}" data-k="quantity" value="${it.quantity}" step="any" placeholder="Miktar" style="width:80px;min-height:42px;background:var(--bg2);border:1.5px solid var(--border);border-radius:10px;color:var(--text);padding:8px">` : ''}
          <input type="number" data-i="${i}" data-k="unit_price" value="${it.unit_price}" step="any" placeholder="Birim ₺" style="width:110px;min-height:42px;background:var(--bg2);border:1.5px solid var(--border);border-radius:10px;color:var(--text);padding:8px">
        </div>
      </div>`).join('');
    preview();
  }
  function preview() {
    const q = { type, items, kdv_rate: Number(qs('input[name=kdv_rate]', root).value) || 0, lump_total: Number(qs('input[name=lump_total]', root)?.value) || 0 };
    const tot = calcQuoteTotals(q);
    qs('[data-preview]', root).innerHTML = tot.show_total
      ? `<div class="card" style="margin-top:12px">${kv('Ara Toplam', fmtTL(tot.subtotal) + ' ₺')}${kv('KDV %' + tot.kdv_rate, fmtTL(tot.kdv) + ' ₺')}${kv('<b>GENEL TOPLAM</b>', fmtTL(tot.grand) + ' ₺')}</div>`
      : `<div class="notice info" style="margin-top:12px"><span>ℹ</span><span>${quoteTypeNote(type)}</span></div>`;
  }
  qs('[data-types]', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]'); if (!b) return;
    type = b.dataset.type;
    qsa('[data-type]', root).forEach(x => x.classList.toggle('on', x === b));
    qs('[data-typenote]', root).textContent = quoteTypeNote(type);
    qs('[data-lump]', root).style.display = type === 'LUMP_SUM' ? 'block' : 'none';
    renderItems();
  });
  itemsEl.addEventListener('input', (e) => {
    const t = e.target.closest('[data-i]'); if (!t) return;
    const i = Number(t.dataset.i), k = t.dataset.k;
    items[i][k] = (k === 'quantity' || k === 'unit_price') ? t.value : t.value;
    if (k !== 'label') preview();
  });
  itemsEl.addEventListener('click', (e) => {
    const d = e.target.closest('[data-del]'); if (!d) return;
    items.splice(Number(d.dataset.del), 1); renderItems();
  });
  qs('[data-additem]', root).addEventListener('click', () => { items.push({ label: '', unit: 'Sefer', quantity: 1, unit_price: '' }); renderItems(); });
  qs('input[name=kdv_rate]', root).addEventListener('input', preview);
  const lumpEl = qs('input[name=lump_total]', root);
  if (lumpEl) lumpEl.addEventListener('input', preview);
  renderItems();

  qs('[data-save]', root).addEventListener('click', async () => {
    const val = collectForm(qs('[data-form]', root));
    if (!val.customer_id) { toast('Müşteri seçin', 'err'); return; }
    const clean = items.filter(it => it.label && it.unit_price !== '');
    if (!clean.length && type !== 'LUMP_SUM') { toast('En az bir kalem girin', 'err'); return; }
    if (type === 'LUMP_SUM' && !Number(val.lump_total)) { toast('Anlaşılan toplamı girin', 'err'); return; }
    const fields = {
      date: val.date, customer_id: val.customer_id, site_id: val.site_id || null, type,
      items: clean.map(it => ({ ...it, quantity: Number(it.quantity) || 0, unit_price: Number(it.unit_price) || 0 })),
      kdv_rate: Number(val.kdv_rate) || 0, lump_total: Number(val.lump_total) || 0, notes: val.notes || ''
    };
    if (editId) { await db.saveExisting('quotes', rec, fields, 'Teklif düzenlendi'); toast('Teklif güncellendi', 'ok'); go('#/teklif/' + editId); }
    else {
      const no = await db.nextSeq('quote');
      const created = await db.saveNew('quotes', { ...fields, quote_no: no, status: 'Taslak' });
      toast('Teklif #' + String(no).padStart(4, '0') + ' kaydedildi', 'ok');
      go('#/teklif/' + created.id);
    }
  });
}

async function quoteDetail(ctx, id) {
  const { root, db, names } = ctx;
  const t = await db.get('quotes', id);
  if (!t) { root.innerHTML = appbar('Teklif') + emptyState('📄', 'Teklif yok'); return; }
  const tot = calcQuoteTotals(t);
  root.innerHTML = appbar('Teklif #' + String(t.quote_no).padStart(4, '0'), trDate(t.date), { right: statusBadge(t.status || 'Taslak') }) + `
    <div style="height:10px"></div>
    <div class="card">
      ${kv('Müşteri', names.customers[t.customer_id] || '—')}
      ${kv('Şantiye', names.sites[t.site_id] || '—')}
      ${kv('Tür', t.type)}
      <div class="divider"></div>
      ${tot.lines.map(l => kv(esc(l.label) + (t.type === 'QUANTITY_BASED' ? ` (${fmtNum(l.quantity)} ${l.unit})` : ` (${l.unit})`), fmtTL(l.unit_price) + ' ₺' + (l.line_total != null ? ' = ' + fmtTL(l.line_total) + ' ₺' : ''))).join('')}
      <div class="divider"></div>
      ${tot.show_total ? kv('Ara Toplam', fmtTL(tot.subtotal) + ' ₺') + kv('KDV %' + tot.kdv_rate, fmtTL(tot.kdv) + ' ₺') + kv('GENEL TOPLAM', fmtTL(tot.grand) + ' ₺') : `<div class="notice info"><span>ℹ</span><span>${quoteTypeNote(t.type)}</span></div>`}
      ${t.notes ? kv('Notlar', t.notes) : ''}
    </div>
    <div class="actionbar">
      <button class="btn primary" data-pdf>PDF</button>
      ${t.status === 'Taslak' ? `<button class="btn" data-go="#/teklif/${id}/edit">Düzenle</button>` : ''}
      <button class="btn" data-status>Durum</button>
    </div>`;
  qs('[data-pdf]', root).addEventListener('click', async () => {
    const pdf = await import('./pdf.js');
    await pdf.quotePdf(t, names, tot);
  });
  qs('[data-status]', root).addEventListener('click', () => {
    const sh = sheet(`<h3>Teklif Durumu</h3>` + ['Taslak', 'Gönderildi', 'Kabul', 'Red', 'İptal'].map(s => `<button class="btn block ${s === t.status ? 'primary' : ''}" style="margin-bottom:8px" data-s="${s}">${s}</button>`).join(''));
    sh.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      await db.saveExisting('quotes', t, { status: b.dataset.s }, 'Durum: ' + b.dataset.s);
      (await import('./ui.js')).sheetClose();
      ctx.reload();
    });
  });
}

// ============ FİYAT LİSTESİ ============
async function priceBook(ctx) {
  const { root, db, names } = ctx;
  if (ctx.parts[1] === 'new' || ctx.parts[2] === 'edit') return priceForm(ctx, ctx.parts[2] === 'edit' ? ctx.parts[1] : null);
  const rows = (await db.getAll('price_book')).filter(isActive);
  const crane = { first: await db.metaGet('crane_first_hour'), next: await db.metaGet('crane_next_hour') };
  root.innerHTML = appbar('Fiyat Listesi', 'Öncelik: müşteri › şantiye › tarih › genel') + `
    <div class="card" style="margin-top:10px">
      <div class="row between"><span class="strong">Vinç tarifesi</span><span class="badge accent">ilk ${fmtTL(crane.first)} ₺ + sonraki ${fmtTL(crane.next)} ₺/saat</span></div>
      <div class="tiny muted" style="margin-top:4px">Ayarlar → Finans bölümünden değiştirilebilir.</div>
    </div>
    <div data-list></div>
    <div class="actionbar"><button class="btn primary" data-go="#/fiyat/new">+ Fiyat Ekle</button></div>`;
  const listEl = qs('[data-list]', root);
  if (!rows.length) listEl.innerHTML = emptyState('🏷', 'Fiyat yok');
  else listEl.innerHTML = rows.map(p => li({
    ic: '🏷', href: `#/fiyat/${p.id}/edit`,
    t1: esc(p.work_type || names.vehicles[p.vehicle_id] || 'Genel'),
    t2: `${p.customer_id ? esc(names.customers[p.customer_id] || '') + ' · ' : ''}${p.site_id ? esc(names.sites[p.site_id] || '') + ' · ' : ''}${p.valid_from ? trDate(p.valid_from) + '→' + (p.valid_to ? trDate(p.valid_to) : '∞') : 'sürekli'} · KDV %${p.kdv_rate ?? 20}${p.kdv_included ? ' dahil' : ' +KDV'}`,
    end: p.formula === 'CRANE_FIRST_HOUR' ? '<span class="badge accent">vinç formülü</span>' : `<span class="amt nowrap">${fmtTL(p.price)} ₺/${esc(p.unit)}</span>`
  })).join('');
}

async function priceForm(ctx, editId) {
  const { root, db } = ctx;
  const [customers, sites, vehicles] = await Promise.all([db.listActive('customers'), db.listActive('sites'), db.listActive('vehicles')]);
  const rec = editId ? await db.get('price_book', editId) : null;
  const v = rec || { unit: 'Sefer', kdv_rate: 20, kdv_included: false, active: true };
  root.innerHTML = appbar(editId ? 'Fiyat Düzenle' : '+ Fiyat', 'Boş bırakılan alan "hepsi" demektir') + `
    <form data-form novalidate>
      ${fSelect('Araç/Makine', 'vehicle_id', vehicles.map(x => ({ v: x.id, t: x.name })), v.vehicle_id)}
      ${fSelect('İş Türü', 'work_type', WORK_TYPES, v.work_type)}
      <div class="formgrid2">
        ${fSelect('Birim', 'unit', WORK_UNITS, v.unit, { empty: false })}
        ${fNum('Fiyat (₺)', 'price', v.price ?? '')}
      </div>
      <div class="formgrid2">
        ${fNum('KDV %', 'kdv_rate', v.kdv_rate ?? 20)}
        ${fSelect('KDV Durumu', 'kdv_included', [{ v: '0', t: '+KDV (hariç)' }, { v: '1', t: 'KDV dahil' }], v.kdv_included ? '1' : '0', { empty: false })}
      </div>
      <div class="formgrid2">
        ${fSelect('Müşteri (özel)', 'customer_id', customers.map(c => ({ v: c.id, t: c.name })), v.customer_id)}
        ${fSelect('Şantiye (özel)', 'site_id', sites.map(s => ({ v: s.id, t: s.name })), v.site_id)}
      </div>
      <div class="formgrid2">
        ${fDate('Geçerlilik Başlangıç', 'valid_from', v.valid_from || '', false)}
        ${fDate('Geçerlilik Bitiş', 'valid_to', v.valid_to || '', false)}
      </div>
      ${fSelect('Hesap', 'formula', [{ v: '', t: 'Normal (miktar × fiyat)' }, { v: 'CRANE_FIRST_HOUR', t: 'Vinç: ilk saat + sonraki saat' }], v.formula || '', { empty: false })}
      <div data-crane style="display:${v.formula === 'CRANE_FIRST_HOUR' ? 'block' : 'none'}">
        <div class="formgrid2">
          ${fNum('İlk Saat (₺)', 'first_hour_price', v.first_hour_price ?? '')}
          ${fNum('Sonraki Saat (₺)', 'next_hour_price', v.next_hour_price ?? '')}
        </div>
        <div class="hint" style="margin-bottom:10px">Boş bırakılırsa Ayarlar\'daki genel vinç tarifesi kullanılır.</div>
      </div>
    </form>
    <div class="actionbar">
      <button class="btn primary" data-save>Kaydet</button>
      ${editId ? '<button class="btn danger" data-del>Sil</button>' : ''}
    </div>`;
  qs('select[name=formula]', root).addEventListener('change', (e) => { qs('[data-crane]', root).style.display = e.target.value === 'CRANE_FIRST_HOUR' ? 'block' : 'none'; });
  qs('[data-save]', root).addEventListener('click', async () => {
    const val = collectForm(qs('[data-form]', root));
    if (val.formula !== 'CRANE_FIRST_HOUR' && !Number(val.price)) { toast('Fiyat girin', 'err'); return; }
    const fields = {
      vehicle_id: val.vehicle_id || null, work_type: val.work_type || null, unit: val.unit,
      price: Number(val.price) || 0, kdv_rate: Number(val.kdv_rate) || 0, kdv_included: val.kdv_included === '1',
      customer_id: val.customer_id || null, site_id: val.site_id || null,
      valid_from: val.valid_from || null, valid_to: val.valid_to || null,
      formula: val.formula || null, first_hour_price: val.first_hour_price ? Number(val.first_hour_price) : null, next_hour_price: val.next_hour_price ? Number(val.next_hour_price) : null,
      active: true
    };
    if (editId) await db.saveExisting('price_book', rec, fields, 'Fiyat güncellendi');
    else await db.saveNew('price_book', fields, 'Fiyat eklendi');
    toast('Fiyat kaydedildi', 'ok');
    go('#/fiyat');
  });
  const del = qs('[data-del]', root);
  if (del) del.addEventListener('click', async () => {
    const ok = await confirmDialog('Fiyat silinsin mi?', 'Eski kesinleşmiş belgeler etkilenmez (snapshot).', 'Sil', true);
    if (!ok) return;
    await db.softDelete('price_book', editId, 'Kullanıcı sildi');
    toast('Silindi', 'ok'); go('#/fiyat');
  });
}

// ============ HAKEDİŞ ============
async function hakedis(ctx) {
  const sub = ctx.parts[1];
  if (sub === 'new') return hakedisNew(ctx);
  if (sub) return hakedisDetail(ctx, sub);
  const { root, db, names } = ctx;
  const rows = (await db.getAll('hakedis')).filter(isActive).sort((a, b) => (b.hakedis_no || 0) - (a.hakedis_no || 0));
  root.innerHTML = appbar('Hakediş', `${rows.length} kayıt`) + `
    <div style="height:10px"></div><div data-list></div>
    <div class="actionbar"><button class="btn primary" data-go="#/hakedis/new">+ Hakediş Oluştur</button></div>`;
  const listEl = qs('[data-list]', root);
  if (!rows.length) listEl.innerHTML = emptyState('📑', 'Hakediş yok', '<button class="btn primary" data-go="#/hakedis/new">+ Hakediş</button>');
  else pagedRender(listEl, rows, (h) => li({
    ic: '📑', href: '#/hakedis/' + h.id,
    t1: `#${String(h.hakedis_no || 0).padStart(6, '0')} · ${esc(names.customers[h.customer_id] || '—')}`,
    t2: `${trDate(h.date_from)} – ${trDate(h.date_to)} · ${(h.items || []).length} kalem`,
    badgeHtml: statusBadge(h.status || 'Taslak'),
    end: `<div class="amt nowrap">${fmtTL(h.grand_total)} ₺</div>`
  }));
}

async function hakedisNew(ctx) {
  const { root, db, names } = ctx;
  const [customers, sites, works, pricebook, allHak] = await Promise.all([db.listActive('customers'), db.listActive('sites'), db.getAll('work_records'), db.listActive('price_book'), db.getAll('hakedis')]);
  const today = todayStr();
  const inActiveHak = new Set();
  for (const h of allHak.filter(h => isActive(h) && h.status !== 'İptal')) for (const it of h.items || []) inActiveHak.add(it.work_record_id);
  const crane = { first: await db.metaGet('crane_first_hour'), next: await db.metaGet('crane_next_hour') };
  let selected = new Map(); // work_id → {unit_price, kdv_rate}

  root.innerHTML = appbar('+ Hakediş', 'İşleri seç · fiyatlar snapshot olarak kopyalanır') + `
    <div class="card" style="margin-top:10px">
      ${fSelect('Müşteri *', 'customer_id', customers.map(c => ({ v: c.id, t: c.name })), '', { req: true })}
      ${fSelect('Şantiye', 'site_id', sites.map(s => ({ v: s.id, t: s.name })), '')}
      <div class="formgrid2">
        ${fDate('Başlangıç', 'date_from', today.slice(0, 8) + '01')}
        ${fDate('Bitiş', 'date_to', today)}
      </div>
      <button class="btn block" data-fetch>İşleri Getir</button>
    </div>
    <div data-rows></div>
    <div data-total></div>
    <div class="actionbar"><button class="btn primary" data-create disabled>Hakediş Oluştur</button></div>`;

  const rowsEl = qs('[data-rows]', root);
  qs('[data-fetch]', root).addEventListener('click', () => {
    const val = collectForm(root);
    if (!val.customer_id) { toast('Müşteri seçin', 'err'); return; }
    const list = works.filter(w => isActive(w) && w.customer_id === val.customer_id
      && (!val.site_id || w.site_id === val.site_id)
      && w.date >= val.date_from && w.date <= val.date_to
      && !inActiveHak.has(w.id))
      .sort((a, b) => a.date < b.date ? -1 : 1);
    if (!list.length) { rowsEl.innerHTML = emptyState('⚒', 'Bu filtrede hakedişe girmemiş iş yok'); return; }
    rowsEl.innerHTML = `<div class="section-title">${list.length} iş — seç ve fiyatı kontrol et</div>` + list.map(w => {
      const price = resolvePrice(pricebook, { customer_id: w.customer_id, site_id: w.site_id, vehicle_id: w.vehicle_id, work_type: w.work_type, unit: w.unit, date: w.date });
      const isCrane = price && price.formula === 'CRANE_FIRST_HOUR';
      return `<div class="card" style="padding:10px">
        <div class="row">
          <input type="checkbox" data-chk="${w.id}" style="width:24px;height:24px;flex:none" ${price ? '' : ''}>
          <div class="grow">
            <div class="strong small">${trDate(w.date)} · ${esc(w.work_type || 'İş')} · ${fmtNum(w.quantity)} ${esc(w.unit || '')}</div>
            <div class="tiny muted">${esc(names.vehicles[w.vehicle_id] || '—')} · ${esc(names.sites[w.site_id] || names.customers[w.customer_id] || '')}</div>
          </div>
          <div style="width:96px">
            ${isCrane ? '<span class="badge accent">vinç</span>' : `<input type="number" data-price="${w.id}" value="${price ? price.price : ''}" placeholder="₺" step="any" style="width:100%;min-height:40px;background:var(--bg2);border:1.5px solid var(--border);border-radius:10px;color:var(--text);padding:6px 8px;text-align:right">`}
          </div>
        </div>
        ${price ? '' : '<div class="tiny" style="color:var(--warn);margin-top:5px">⚠ Fiyat bulunamadı — el ile girin</div>'}
      </div>`;
    }).join('');
    const upd = () => {
      selected = new Map();
      for (const chk of qsa('[data-chk]', rowsEl)) {
        if (!chk.checked) continue;
        const w = list.find(x => x.id === chk.dataset.chk);
        const price = resolvePrice(pricebook, { customer_id: w.customer_id, site_id: w.site_id, vehicle_id: w.vehicle_id, work_type: w.work_type, unit: w.unit, date: w.date });
        const manual = qs(`[data-price="${w.id}"]`, rowsEl);
        selected.set(w.id, {
          work_record_id: w.id, date: w.date, site_name: names.sites[w.site_id] || '', vehicle_name: names.vehicles[w.vehicle_id] || '',
          work_type: w.work_type, quantity: Number(w.quantity) || 0, unit: w.unit,
          unit_price: manual ? Number(manual.value) || 0 : 0,
          kdv_rate: price ? (price.kdv_rate ?? 20) : 20,
          formula: price && price.formula === 'CRANE_FIRST_HOUR' ? 'CRANE_FIRST_HOUR' : null,
          first_hour_price: price ? price.first_hour_price : null, next_hour_price: price ? price.next_hour_price : null
        });
      }
      const tot = calcHakedisTotals([...selected.values()], crane);
      qs('[data-total]', root).innerHTML = selected.size ? `<div class="card">${kv('Kalem', String(selected.size))}${kv('Ara Toplam', fmtTL(tot.subtotal) + ' ₺')}${kv('KDV', fmtTL(tot.kdv) + ' ₺')}${kv('GENEL TOPLAM', fmtTL(tot.grand) + ' ₺')}</div>` : '';
      qs('[data-create]', root).disabled = !selected.size;
    };
    rowsEl.addEventListener('change', upd);
    rowsEl.addEventListener('input', upd);
  });

  qs('[data-create]', root).addEventListener('click', async () => {
    const val = collectForm(root);
    const ok = await confirmDialog('Hakediş oluşturulsun mu?', `${selected.size} kalem · toplam snapshot alınır. Kesinleştirme sonraki adımdır.`, 'Oluştur');
    if (!ok) return;
    const items = [...selected.values()];
    const tot = calcHakedisTotals(items, crane);
    const no = await db.nextSeq('hakedis');
    const created = await db.saveNew('hakedis', {
      hakedis_no: no, customer_id: val.customer_id, site_id: val.site_id || null,
      date_from: val.date_from, date_to: val.date_to, created_date: today,
      status: 'Taslak', items: tot.lines, subtotal: tot.subtotal, kdv_total: tot.kdv, grand_total: tot.grand
    }, 'Hakediş taslak');
    toast('Hakediş #' + String(no).padStart(6, '0'), 'ok');
    go('#/hakedis/' + created.id);
  });
}

async function hakedisDetail(ctx, id) {
  const { root, db, names } = ctx;
  const h = await db.get('hakedis', id);
  if (!h) { root.innerHTML = appbar('Hakediş') + emptyState('📑', 'Yok'); return; }
  const finalized = h.status === 'Kesinleşti';
  root.innerHTML = appbar('Hakediş #' + String(h.hakedis_no).padStart(6, '0'), `${trDate(h.date_from)} – ${trDate(h.date_to)}`, { right: statusBadge(h.status) }) + `
    <div style="height:10px"></div>
    <div class="card">
      ${kv('Müşteri', names.customers[h.customer_id] || '—')}
      ${h.site_id ? kv('Şantiye', names.sites[h.site_id]) : ''}
      ${kv('Kalem', String((h.items || []).length))}
      ${kv('Oluşturma', trDate(h.created_date))}
    </div>
    <div class="section-title">Kalemler (snapshot)</div>
    ${(h.items || []).map(it => li({ ic: it.unit === 'Sefer' ? '🚛' : '🚜', t1: `${trDate(it.date)} · ${esc(it.work_type || '')}`, t2: `${esc(it.vehicle_name || '')} · ${fmtNum(it.quantity)} ${esc(it.unit || '')} × ${it.formula === 'CRANE_FIRST_HOUR' ? 'vinç tarifesi' : fmtTL(it.unit_price) + ' ₺'}`, end: `<span class="amt nowrap">${fmtTL(it.total)} ₺</span>` })).join('')}
    <div class="card">
      ${kv('Ara Toplam', fmtTL(h.subtotal) + ' ₺')}
      ${kv('KDV', fmtTL(h.kdv_total) + ' ₺')}
      ${kv('GENEL TOPLAM', fmtTL(h.grand_total) + ' ₺')}
    </div>
    <div class="actionbar">
      <button class="btn" data-pdf>PDF</button>
      ${!finalized && h.status !== 'İptal' ? '<button class="btn ok" data-final>Kesinleştir</button><button class="btn danger" data-iptal>İptal</button>' : ''}
    </div>`;
  qs('[data-pdf]', root).addEventListener('click', async () => {
    const pdf = await import('./pdf.js');
    await pdf.hakedisPdf(h, names);
  });
  const fin = qs('[data-final]', root);
  if (fin) fin.addEventListener('click', async () => {
    const ok = await confirmDialog('Hakediş kesinleşsin mi?', 'Kesinleşen hakediş değiştirilemez; müşteri carisine borç yazılır.', 'Kesinleştir');
    if (!ok) return;
    // Aynı iş iki aktif hakedişte olmasın (son kontrol)
    const allHak = await db.getAll('hakedis');
    for (const o of allHak) {
      if (o.id === id || !isActive(o) || o.status === 'İptal') continue;
      const clash = (o.items || []).filter(it => (h.items || []).some(x => x.work_record_id === it.work_record_id));
      if (clash.length) { toast('Çakışma: ' + clash.length + ' iş başka hakedişte (#' + o.hakedis_no + ')', 'err'); return; }
    }
    await db.saveExisting('hakedis', h, { status: 'Kesinleşti', finalized_at: new Date().toISOString() }, 'Kesinleştirildi');
    await db.saveNew('cari_movements', { date: h.created_date, customer_id: h.customer_id, type: 'Hakedis', amount: h.grand_total, ref_id: id, note: 'Hakediş #' + String(h.hakedis_no).padStart(6, '0') }, 'Hakediş kesinleşti');
    toast('Kesinleşti — cariye işlendi', 'ok');
    ctx.reload();
  });
  const ipt = qs('[data-iptal]', root);
  if (ipt) ipt.addEventListener('click', async () => {
    const reason = await promptDialog('Hakediş iptali', 'İptal nedeni');
    if (!reason) return;
    await db.saveExisting('hakedis', h, { status: 'İptal' }, reason);
    toast('İptal edildi', 'ok');
    ctx.reload();
  });
}

// ============ CARİ ============
async function cari(ctx) {
  const sub = ctx.parts[1];
  const { root, db, names } = ctx;
  if (sub) return cariDetail(ctx, sub);
  const [customers, movements] = await Promise.all([db.listActive('customers'), db.getAll('cari_movements')]);
  const bal = {};
  for (const m of movements.filter(isActive)) bal[m.customer_id] = (bal[m.customer_id] || 0) + (Number(m.amount) || 0);
  root.innerHTML = appbar('Cari', 'Müşteri bakiyeleri') + `
    <div style="height:10px"></div><div data-list></div>`;
  const rows = customers.map(c => ({ c, b: bal[c.id] || 0 }));
  qs('[data-list]', root).innerHTML = rows.length ? rows.map(({ c, b }) => li({
    ic: '🏢', href: '#/cari/' + c.id, t1: esc(c.name),
    end: `<span class="amt ${b > 0 ? '' : 'muted'}">${b > 0 ? '+' : ''}${fmtTL(b)} ₺</span>`
  })).join('') : emptyState('🏢', 'Müşteri yok');
}

async function cariDetail(ctx, cid) {
  const { root, db, names } = ctx;
  const c = await db.get('customers', cid);
  const movements = (await db.getAll('cari_movements')).filter(m => isActive(m) && m.customer_id === cid).sort((a, b) => a.date < b.date ? -1 : 1);
  const hak = movements.filter(m => m.type === 'Hakedis').reduce((s, m) => s + Number(m.amount) || 0, 0);
  const tah = -movements.filter(m => m.type === 'Tahsilat').reduce((s, m) => s + Number(m.amount) || 0, 0);
  const balance = cariBalance(movements);
  root.innerHTML = appbar(c ? c.name : 'Cari', 'Müşteri cari kartı') + `
    <div class="statgrid" style="grid-template-columns:repeat(3,1fr);margin-top:10px">
      ${stat(fmtTL(hak), 'Hakediş ₺', 'accent')}
      ${stat(fmtTL(tah), 'Tahsilat ₺', 'ok')}
      ${stat((balance > 0 ? '+' : '') + fmtTL(balance), 'Bakiye ₺', balance > 0 ? 'warn' : '')}
    </div>
    <div class="section-title">Hareketler</div>
    ${movements.length ? `<div class="timeline">${movements.map(m => `<div class="ti"><div class="small strong">${trDate(m.date)} · ${esc(m.type)} · ${m.amount > 0 ? '+' : ''}${fmtTL(m.amount)} ₺</div><div class="tiny muted">${esc(m.note || m.reason || '')}${m.ref_id ? ' · kaynak: ' + esc(String(m.ref_id).slice(0, 8)) : ''}</div></div>`).join('')}</div>` : emptyState('🏦', 'Hareket yok')}
    <div class="actionbar"><button class="btn primary" data-duzelt>± Manuel Düzeltme</button></div>`;
  qs('[data-duzelt]', root).addEventListener('click', async () => {
    const amt = await promptDialog('Manuel Düzeltme', 'Tutar (alacak için −, borç için +)');
    if (amt === null) return;
    const reason = await promptDialog('Zorunlu: Düzeltme nedeni', 'Neden');
    if (!reason) { toast('Neden girilmeden düzeltme yapılmaz', 'err'); return; }
    await db.saveNew('cari_movements', { date: todayStr(), customer_id: cid, type: 'Duzeltme', amount: Number(String(amt).replace(',', '.')), reason }, 'Manuel düzeltme: ' + reason);
    toast('Düzeltme işlendi', 'ok');
    ctx.reload();
  });
}

// ============ KASA ============
async function cash(ctx) {
  const sub = ctx.parts[1];
  if (sub === 'new') return cashForm(ctx);
  const { root, db, names } = ctx;
  const rows = (await db.getAll('cash_records')).filter(isActive).sort((a, b) => (b.date + (b.created_at || '')) < (a.date + (a.created_at || '')) ? -1 : 1);
  root.innerHTML = appbar('Kasa / Tahsilat', 'Personelde → Teslim Bildirildi → Kasaya Teslim') + `
    <div style="height:10px"></div>
    <div data-list></div>
    <div class="actionbar"><button class="btn primary" data-go="#/finans/kasa/new">+ Tahsilat / Kasa İşlemi</button></div>`;
  const listEl = qs('[data-list]', root);
  if (!rows.length) listEl.innerHTML = emptyState('💰', 'Kayıt yok');
  else pagedRender(listEl, rows, (c) => li({
    ic: '💰',
    t1: `${esc(c.cash_type || '')} · ${esc(names.personnel[c.personnel_id] || '')}`,
    t2: `${trDate(c.date)}${names.customers[c.customer_id] ? ' · ' + esc(names.customers[c.customer_id]) : ''}${c.description ? ' · ' + esc(c.description) : ''}`,
    badgeHtml: statusBadge(c.cash_status || ''),
    end: `<div class="amt nowrap">${fmtTL(c.amount)} ₺</div>${nextCashStatus(c.cash_status) ? `<button class="btn sm" data-next="${c.id}" style="margin-top:5px">${nextCashStatus(c.cash_status) === 'TESLIM_BILDIRILDI' ? 'Teslim Bildir' : 'Kasaya Teslim'}</button>` : ''}`
  }));
  listEl.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-next]'); if (!b) return;
    const rec = await db.get('cash_records', b.dataset.next);
    const nx = nextCashStatus(rec.cash_status);
    await db.saveExisting('cash_records', rec, { cash_status: nx }, 'Durum: ' + nx);
    toast('Durum: ' + nx, 'ok');
    ctx.reload();
  });
}

async function cashForm(ctx) {
  const { root, db } = ctx;
  const [customers, personnel] = await Promise.all([db.listActive('customers'), db.listActive('personnel')]);
  root.innerHTML = appbar('+ Kasa / Tahsilat', 'Muhasebe kesinleştirmesi değildir; saha akışıdır') + `
    <form data-form novalidate>
      ${fDate('Tarih', 'date', todayStr())}
      ${fSelect('İşlem Türü', 'cash_type', CASH_TYPES, 'Müşteriden Para Alındı', { empty: false })}
      ${fNum('Tutar (₺)', 'amount', '', { req: true, step: 'any' })}
      <div class="formgrid2">
        ${fSelect('Personel', 'personnel_id', personnel.map(p => ({ v: p.id, t: p.name })), '')}
        ${fSelect('Müşteri', 'customer_id', customers.map(c => ({ v: c.id, t: c.name })), '')}
      </div>
      ${fSelect('Ödeme Şekli', 'payment_method', PAYMENT_METHODS, 'Nakit', { empty: false })}
      ${fArea('Açıklama', 'description', '')}
    </form>
    <div class="actionbar"><button class="btn primary" data-save>Kaydet</button></div>`;
  qs('[data-save]', root).addEventListener('click', async () => {
    const val = collectForm(qs('[data-form]', root));
    if (!Number(val.amount)) { toast('Tutar girin', 'err'); return; }
    const fields = {
      date: val.date, cash_type: val.cash_type, amount: Number(val.amount),
      personnel_id: val.personnel_id || null, customer_id: val.customer_id || null,
      payment_method: val.payment_method, description: val.description || '',
      cash_status: val.cash_type === 'Müşteriden Para Alındı' ? 'PERSONELDE' : 'KASAYA_TESLIM_EDILDI'
    };
    const created = await db.saveNew('cash_records', fields, 'Kasa kaydı');
    if (val.cash_type === 'Müşteriden Para Alındı' && val.customer_id) {
      await db.saveNew('cari_movements', { date: val.date, customer_id: val.customer_id, type: 'Tahsilat', amount: -Number(val.amount), ref_id: created.id, note: 'Tahsilat' }, 'Tahsilat cari');
    }
    toast('Kaydedildi', 'ok');
    go('#/finans/kasa');
  });
}

// ============ GİDER ============
async function expenses(ctx) {
  const sub = ctx.parts[1];
  if (sub === 'new') return expenseForm(ctx);
  const { root, db, names, query } = ctx;
  const q = query.q || '';
  let rows = (await db.getAll('expense_records')).filter(isActive).sort((a, b) => b.date < a.date ? -1 : 1);
  rows = rows.filter(r => matchSearch(`${r.category} ${r.description || ''} ${names.personnel[r.personnel_id] || ''}`, q));
  const attMap = await db.attachmentsCountMap();
  root.innerHTML = appbar('Giderler', `${rows.length} kayıt`) + `
    <div style="height:10px"></div>
    ${searchBar('Kategori, açıklama…', q)}
    <div data-list></div>
    <div class="actionbar"><button class="btn primary" data-go="#/gider/new">+ Gider</button></div>`;
  const listEl = qs('[data-list]', root);
  if (!rows.length) listEl.innerHTML = emptyState('💸', 'Gider yok');
  else pagedRender(listEl, rows, (e) => li({
    ic: '💸',
    t1: `${esc(e.category || 'Gider')} · ${fmtTL(e.amount)} ₺`,
    t2: `${trDate(e.date)} · ${esc(names.personnel[e.personnel_id] || '—')} · ${esc(e.payment_method || '')}${attMap[e.id] ? ' · 📷' + attMap[e.id] : ''}${e.description ? ' · ' + esc(e.description) : ''}`,
    badgeHtml: e.payment_method === 'Personel Ödedi' ? statusBadge(e.reimbursement_status || 'Bekliyor') : (e.receipt === 'Hayır' ? badge('Fişsiz', 'warn') : '')
  }));
  let st;
  qs('[data-search]', root).addEventListener('input', (ev) => { clearTimeout(st); st = setTimeout(() => go('#/gider?q=' + encodeURIComponent(ev.target.value)), 450); });
  listEl.addEventListener('click', async (e) => {
    const card = e.target.closest('.li'); if (!card) return;
  });
}

async function expenseForm(ctx) {
  const { root, db } = ctx;
  const [personnel, vehicles] = await Promise.all([db.listActive('personnel'), db.listActive('vehicles')]);
  root.innerHTML = appbar('+ Gider', 'Fiş fotoğrafı eklenebilir') + `
    <form data-form novalidate>
      ${fDate('Tarih', 'date', todayStr())}
      <div class="formgrid2">
        ${fSelect('Kategori', 'category', EXPENSE_CATEGORIES, 'Yakıt', { empty: false })}
        ${fNum('Tutar (₺)', 'amount', '', { req: true, step: 'any' })}
      </div>
      <div class="formgrid2">
        ${fSelect('Personel', 'personnel_id', personnel.map(p => ({ v: p.id, t: p.name })), '')}
        ${fSelect('İlgili Araç', 'vehicle_id', vehicles.map(v => ({ v: v.id, t: v.name })), '')}
      </div>
      <div class="formgrid2">
        ${fSelect('Ödeme Şekli', 'payment_method', PAYMENT_METHODS, 'Şirket Ödedi', { empty: false })}
        ${fSelect('Fiş Var mı?', 'receipt', ['Evet', 'Hayır'], 'Evet', { empty: false })}
      </div>
      <div class="field" data-reimb style="display:none">${fSelect('Personele Ödeme', 'reimbursement_status', REIMBURSEMENT_STATUS, 'Bekliyor', { empty: false })}</div>
      ${fText('Firma', 'company', '')}
      ${fArea('Açıklama', 'description', '')}
      <div class="field"><label>Fiş Fotoğrafı</label><input type="file" name="photo" accept="image/*" capture="environment"></div>
    </form>
    <div class="actionbar"><button class="btn primary" data-save>Kaydet</button></div>`;
  const pmSel = qs('select[name=payment_method]', root);
  pmSel.addEventListener('change', () => { qs('[data-reimb]', root).style.display = pmSel.value === 'Personel Ödedi' ? 'block' : 'none'; });
  qs('[data-save]', root).addEventListener('click', async () => {
    const val = collectForm(qs('[data-form]', root));
    if (!Number(val.amount)) { toast('Tutar girin', 'err'); return; }
    const fields = {
      date: val.date, category: val.category, amount: Number(val.amount),
      personnel_id: val.personnel_id || null, vehicle_id: val.vehicle_id || null,
      payment_method: val.payment_method, receipt: val.receipt,
      reimbursement_status: val.payment_method === 'Personel Ödedi' ? (val.reimbursement_status || 'Bekliyor') : null,
      company: val.company || '', description: val.description || ''
    };
    const created = await db.saveNew('expense_records', fields, 'Gider');
    const file = qs('input[name=photo]', root).files[0];
    if (file) await db.addAttachment('expense', created.id, file);
    toast('Gider kaydedildi', 'ok');
    go('#/gider');
  });
}

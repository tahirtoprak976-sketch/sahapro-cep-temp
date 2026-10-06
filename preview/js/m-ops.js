// SAHAPRO SOLO — Operasyon: Yakıt · Depo Tankı · Filo · Bakım · Personel · Taşeron
import { qs, qsa, esc, appbar, stat, li, emptyState, notice, kv, badge, statusBadge, segBar, searchBar, sheet, toast, confirmDialog, promptDialog, fText, fNum, fDate, fArea, fSelect, collectForm, fmtTL, fmtNum, trDate, todayStr, pagedRender, go } from './ui.js';
import { isActive, matchSearch, calcTankBalance, FUEL_SOURCES, MAINT_TYPES, MAINT_STATUS, PERSONNEL_EVENT_TYPES, VEHICLE_OWNERSHIP, nowISO } from './core.js';

const VEHICLE_TYPES = ['Kamyon', 'Ekskavatör', 'Mini Ekskavatör', 'JCB', 'Manitou', 'Vinç', 'Silindir', 'Lowbed', 'Kamyonet', 'Araç/Makine', 'Diğer'];
const FUEL_TYPES = ['Dizel', 'Benzin', 'LPG', 'Elektrik', 'Diğer'];

export async function screen(ctx) {
  const sub = ctx.parts[0];
  if (sub === 'yakit') return fuel(ctx);
  if (sub === 'depo') return tank(ctx);
  if (sub === 'filo') return fleet(ctx);
  if (sub === 'bakim') return maint(ctx);
  if (sub === 'personel') return personnel(ctx);
  if (sub === 'taseron') return contractors(ctx);
  return fleet(ctx);
}

// ---- Ortak: depo stok kontrolü (sessiz negatif stok YOK — açık uyarı + zorunlu neden) ----
async function checkTankStock(db, liters) {
  const moves = await db.getAll('fuel_tank_movements');
  const bal = calcTankBalance(moves);
  if (liters <= bal.remaining) return { ok: true, override: false, bal };
  const go1 = await confirmDialog('Depo stoğu yetersiz',
    `Kalan: ${fmtNum(bal.remaining)} Lt · Çıkış: ${fmtNum(liters)} Lt. Stok eksiye düşecek — devam için neden zorunlu.`,
    'Devam', true);
  if (!go1) return { ok: false, bal };
  const reason = await promptDialog('Stok aşımı nedeni', 'Neden (zorunlu — kayıt altına alınır)');
  if (!reason) { toast('Neden girilmeden kayıt yapılmaz', 'err'); return { ok: false, bal }; }
  return { ok: true, override: true, reason, bal };
}

// ---- Ortak: tank hareketi iptali = TERS HAREKET (reverse movement; stok asla bozulmaz) ----
async function reverseMovement(db, m) {
  const rev = await db.saveNew('fuel_tank_movements', {
    date: todayStr(), move_type: m.move_type === 'GİRİŞ' ? 'ÇIKIŞ' : 'GİRİŞ', liters: m.liters,
    vehicle_id: m.vehicle_id || null, personnel_id: m.personnel_id || null,
    pump_no: m.pump_no || '', signature_name: m.signature_name || '',
    reverses_id: m.id, fuel_record_id: null
  }, 'Hareket iptali (ters kayıt)');
  await db.saveExisting('fuel_tank_movements', m, { reversed_at: nowISO() }, 'İptal edildi — ters kayıt ' + rev.id);
  if (m.fuel_record_id) {
    const fr = await db.get('fuel_records', m.fuel_record_id);
    if (fr && !fr.deleted_at) await db.softDelete('fuel_records', fr.id, 'Tank hareketi iptal edildi');
  }
  return rev;
}

// ---- Belge bitiş rozeti (araç/personel detay + liste) ----
function docExpiryBadge(d, today = todayStr()) {
  if (!d.expiry_date) return '';
  const days = Math.round((new Date(d.expiry_date + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000);
  if (days < 0) return badge('SÜRESİ GEÇMİŞ', 'danger');
  if (days <= 7) return badge(days + ' gün kaldı', 'warn');
  if (days <= 30) return badge(days + ' gün', 'info');
  return '';
}

// ============ YAKIT ============
async function fuel(ctx) {
  const sub = ctx.parts[1];
  if (sub === 'new') return fuelForm(ctx);
  if (sub) return fuelDetail(ctx, sub);
  const { root, db, names, query } = ctx;
  const q = query.q || '';
  let rows = (await db.getAll('fuel_records')).filter(isActive).sort((a, b) => b.date < a.date ? -1 : 1);
  rows = rows.filter(r => matchSearch(`${names.vehicles[r.vehicle_id] || ''} ${names.personnel[r.personnel_id] || ''} ${r.description || ''}`, q));
  const totalLt = rows.reduce((s, r) => s + (Number(r.liters) || 0), 0);
  root.innerHTML = appbar('Yakıt Kayıtları', `${rows.length} kayıt · ${fmtNum(totalLt)} Lt`) + `
    <div class="notice info" style="margin-top:10px"><span>ℹ</span><span>Yakıt müşteri hakedişine otomatik girmez (iç maliyet).</span></div>
    ${searchBar('Araç, personel…', q)}
    <div data-list></div>
    <div class="actionbar"><button class="btn primary" data-go="#/yakit/new">+ Yakıt Kaydı</button></div>`;
  const listEl = qs('[data-list]', root);
  if (!rows.length) listEl.innerHTML = emptyState('⛽', 'Yakıt kaydı yok');
  else pagedRender(listEl, rows, (f) => li({
    ic: '⛽', href: '#/yakit/' + f.id,
    t1: `${esc(names.vehicles[f.vehicle_id] || '—')} · ${fmtNum(f.liters)} Lt`,
    t2: `${trDate(f.date)} · ${esc(names.personnel[f.personnel_id] || '—')} · ${esc(f.fuel_source || '')}${f.total ? ' · ' + fmtTL(f.total) + ' ₺' : ''}${f.km ? ' · ' + fmtNum(f.km) + ' km' : ''}${f.machine_hours ? ' · ' + fmtNum(f.machine_hours) + ' sa' : ''}`,
    badgeHtml: f.receipt === 'Hayır' ? badge('Fişsiz', 'warn') : ''
  }));
  let st;
  qs('[data-search]', root).addEventListener('input', (ev) => { clearTimeout(st); st = setTimeout(() => go('#/yakit?q=' + encodeURIComponent(ev.target.value)), 450); });
}

async function fuelForm(ctx) {
  const { root, db } = ctx;
  const [vehicles, personnel] = await Promise.all([db.listActive('vehicles'), db.listActive('personnel')]);
  root.innerHTML = appbar('+ Yakıt', 'Litre zorunlu; fiyat/tutar opsiyonel') + `
    <form data-form novalidate>
      ${fDate('Tarih', 'date', todayStr())}
      <div class="formgrid2">
        ${fSelect('Araç / Makine', 'vehicle_id', vehicles.map(v => ({ v: v.id, t: v.name })), '', { req: true })}
        ${fSelect('Personel', 'personnel_id', personnel.map(p => ({ v: p.id, t: p.name })), '')}
      </div>
      <div class="formgrid2">
        ${fNum('Litre', 'liters', '', { req: true, step: 'any' })}
        ${fNum('Birim Fiyat (₺, ops.)', 'unit_price', '', { step: 'any' })}
      </div>
      <div class="formgrid2">
        ${fNum('Toplam (₺, ops.)', 'total', '', { step: 'any' })}
        ${fSelect('Kaynak', 'fuel_source', FUEL_SOURCES, 'Depo Tankı', { empty: false })}
      </div>
      <div class="hint" data-tankhint>Depo Tankı seçilirse stoktan otomatik ÇIKIŞ düşer (iki kayıt tek olay).</div>
      <div class="formgrid2">
        ${fSelect('Fiş', 'receipt', ['Evet', 'Hayır'], 'Evet', { empty: false })}
        ${fText('Pompa Sayaç No (ops.)', 'pump_no', '')}
      </div>
      <div class="formgrid2">
        ${fNum('KM (ops.)', 'km', '')}
        ${fNum('Makine Saati (ops.)', 'machine_hours', '', { step: 'any' })}
      </div>
      ${fArea('Açıklama', 'description', '')}
    </form>
    <div class="actionbar"><button class="btn primary" data-save>Kaydet</button></div>`;
  const srcSel = qs('select[name=fuel_source]', root);
  const syncHint = () => { qs('[data-tankhint]', root).style.display = srcSel.value === 'Depo Tankı' ? '' : 'none'; };
  srcSel.addEventListener('change', syncHint); syncHint();
  const lt = qs('input[name=liters]', root), up = qs('input[name=unit_price]', root), tt = qs('input[name=total]', root);
  const auto = () => { if (lt.value && up.value && !tt.dataset.manual) tt.value = (Number(lt.value) * Number(up.value)).toFixed(2); };
  lt.addEventListener('input', auto); up.addEventListener('input', auto);
  tt.addEventListener('input', () => { tt.dataset.manual = '1'; });
  qs('[data-save]', root).addEventListener('click', async () => {
    const val = collectForm(qs('[data-form]', root));
    if (!val.vehicle_id) { toast('Araç seçin', 'err'); return; }
    if (!Number(val.liters)) { toast('Litre girin', 'err'); return; }
    const liters = Number(val.liters);
    let tankFields = {};
    if (val.fuel_source === 'Depo Tankı') {
      const chk = await checkTankStock(db, liters);
      if (!chk.ok) return;
      if (chk.override) tankFields = { stock_override: true, override_reason: chk.reason };
    }
    const rec = await db.saveNew('fuel_records', {
      date: val.date, vehicle_id: val.vehicle_id, personnel_id: val.personnel_id || null,
      liters, unit_price: val.unit_price ? Number(val.unit_price) : null,
      total: val.total ? Number(val.total) : null, fuel_source: val.fuel_source, receipt: val.receipt,
      pump_no: val.pump_no || '', km: val.km ? Number(val.km) : null, machine_hours: val.machine_hours ? Number(val.machine_hours) : null,
      description: val.description || '', customer_billable: false, tank_movement_id: null, ...tankFields
    }, 'Yakıt kaydı');
    if (val.fuel_source === 'Depo Tankı') {
      const mv = await db.saveNew('fuel_tank_movements', {
        date: val.date, move_type: 'ÇIKIŞ', liters,
        vehicle_id: val.vehicle_id, personnel_id: val.personnel_id || null,
        pump_no: val.pump_no || '', signature_name: '', fuel_record_id: rec.id
      }, 'Tank ÇIKIŞ (yakıt kaydından)');
      await db.saveExisting('fuel_records', rec, { tank_movement_id: mv.id }, 'Tank hareketi bağlantısı');
    }
    toast('Yakıt kaydedildi', 'ok');
    go('#/yakit/' + rec.id);
  });
}

async function fuelDetail(ctx, id) {
  const { root, db, names } = ctx;
  const f = await db.get('fuel_records', id);
  if (!f || !isActive(f)) { root.innerHTML = appbar('Yakıt') + emptyState('⛽', 'Kayıt yok'); return; }
  const mv = f.tank_movement_id ? await db.get('fuel_tank_movements', f.tank_movement_id) : null;
  root.innerHTML = appbar(names.vehicles[f.vehicle_id] || 'Yakıt', trDate(f.date), { right: f.receipt === 'Hayır' ? badge('Fişsiz', 'warn') : '' }) + `
    <div style="height:10px"></div>
    <div class="card">
      ${kv('Araç / Makine', names.vehicles[f.vehicle_id] || '—')}
      ${kv('Personel', names.personnel[f.personnel_id] || '—')}
      ${kv('Litre', fmtNum(f.liters) + ' Lt')}
      ${f.unit_price ? kv('Birim Fiyat', fmtTL(f.unit_price) + ' ₺') : ''}
      ${f.total ? kv('Toplam', fmtTL(f.total) + ' ₺') : ''}
      ${kv('Kaynak', f.fuel_source || '—')}
      ${kv('Fiş', f.receipt || '—')}
      ${f.pump_no ? kv('Pompa Sayaç', f.pump_no) : ''}
      ${f.km ? kv('KM', fmtNum(f.km)) : ''}
      ${f.machine_hours ? kv('Makine Saati', fmtNum(f.machine_hours)) : ''}
      ${f.description ? kv('Açıklama', f.description) : ''}
      ${f.stock_override ? kv('⚠ Stok Aşımı', 'Onaylı — neden: ' + (f.override_reason || '—')) : ''}
    </div>
    ${mv ? `<div class="card">${kv('Depo Hareketi', `${mv.move_type} · ${fmtNum(mv.liters)} Lt · ${trDate(mv.date)}`)}${mv.reversed_at ? kv('Durum', 'İptal edildi (ters kayıt)') : ''}<div class="tiny muted">Bu yakıt kaydı depo ÇIKIŞ hareketiyle bağlı — silme hareketi de iptal eder.</div></div>` : ''}
    <div class="actionbar">
      <button class="btn danger" data-del>Sil</button>
    </div>`;
  qs('[data-del]', root).addEventListener('click', async () => {
    const ok = await confirmDialog('Yakıt kaydı silinsin mi?',
      mv && !mv.reversed_at ? 'Bağlı depo ÇIKIŞ hareketi de iptal edilir (stok geri yüklenir).' : 'Çöp kutusuna taşınır.', 'Sil', true);
    if (!ok) return;
    await db.softDelete('fuel_records', id, 'Kullanıcı sildi');
    if (mv && !mv.reversed_at) await reverseMovement(db, mv);
    toast('Silindi', 'ok');
    go('#/yakit');
  });
}

// ============ DEPO TANKI ============
async function tank(ctx) {
  const { root, db, names } = ctx;
  const rows = (await db.getAll('fuel_tank_movements')).filter(isActive).sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : (b.created_at || '') < (a.created_at || '') ? -1 : 1));
  const bal = calcTankBalance(rows);
  const [vehicles, personnel] = await Promise.all([db.listActive('vehicles'), db.listActive('personnel')]);

  root.innerHTML = appbar('Depo Yakıt Tankı', 'Geçici takip — finansal stok değildir') + `
    <div class="statgrid" style="grid-template-columns:repeat(3,1fr);margin-top:10px">
      ${stat(fmtNum(bal.in), 'Giriş L', 'ok')}
      ${stat(fmtNum(bal.out), 'Çıkış L', 'warn')}
      ${stat(fmtNum(bal.remaining), 'Kalan L', bal.remaining < 0 ? 'danger' : 'accent')}
    </div>
    <div class="card">
      <div class="section-title" style="margin:0 0 8px">Yeni Hareket</div>
      <form data-form novalidate>
        <div class="formgrid2">
          ${fDate('Tarih', 'date', todayStr())}
          ${fSelect('İşlem', 'move_type', ['GİRİŞ', 'ÇIKIŞ'], 'GİRİŞ', { empty: false })}
        </div>
        <div class="formgrid2">
          ${fNum('Litre', 'liters', '', { req: true, step: 'any' })}
          ${fSelect('Araç (çıkışta zorunlu)', 'vehicle_id', vehicles.map(v => ({ v: v.id, t: v.name })), '')}
        </div>
        <div class="formgrid2">
          ${fSelect('Personel', 'personnel_id', personnel.map(p => ({ v: p.id, t: p.name })), '')}
          ${fText('Pompa Sayaç No', 'pump_no', '')}
        </div>
        ${fText('İmza / Teslim Alan Adı', 'signature_name', '')}
      </form>
      <div class="hint">Çıkışta araç seçilirse aynı anda yakıt kaydı da oluşur (tek olay, iki görünüm).</div>
      <button class="btn primary block" data-add>Hareketi Kaydet</button>
    </div>
    <div class="row between"><div class="section-title" style="margin:0">Hareketler</div><button class="btn sm" data-pdf>🖨 A4 Rapor</button></div>
    <div data-list style="margin-top:8px"></div>`;

  const listEl = qs('[data-list]', root);
  listEl.innerHTML = rows.length ? rows.map(m => {
    const reversed = !!m.reversed_at;
    const isReversal = !!m.reverses_id;
    return li({
      ic: m.move_type === 'GİRİŞ' ? '📥' : '📤',
      t1: `${m.move_type} · ${fmtNum(m.liters)} Lt`,
      t2: `${trDate(m.date)} · ${esc(names.personnel[m.personnel_id] || '—')}${m.vehicle_id ? ' · ' + esc(names.vehicles[m.vehicle_id]) : ''}${m.signature_name ? ' · ✍ ' + esc(m.signature_name) : ''}${m.pump_no ? ' · #' + esc(m.pump_no) : ''}${m.fuel_record_id ? ' · ⛽ bağlı' : ''}`,
      badgeHtml: reversed ? badge('İptal edildi', 'danger') : isReversal ? badge('İptal kaydı', 'info') : '',
      end: (!reversed && !isReversal) ? `<button class="btn sm danger" data-rev="${m.id}">İptal</button>` : ''
    });
  }).join('') : emptyState('🛢', 'Hareket yok');

  for (const b of qsa('[data-rev]', listEl)) {
    b.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const m = rows.find(x => x.id === b.dataset.rev);
      if (!m) return;
      const ok = await confirmDialog('Hareket iptal edilsin mi?',
        `${m.move_type} ${fmtNum(m.liters)} Lt — ters hareket yazılır, stok otomatik düzelir.${m.fuel_record_id ? ' Bağlı yakıt kaydı da silinir.' : ''}`, 'İptal Et', true);
      if (!ok) return;
      await reverseMovement(db, m);
      toast('Hareket iptal edildi — stok düzeltildi', 'ok');
      ctx.reload();
    });
  }

  qs('[data-add]', root).addEventListener('click', async () => {
    const val = collectForm(qs('[data-form]', root));
    const liters = Number(val.liters);
    if (!liters) { toast('Litre girin', 'err'); return; }
    if (val.move_type === 'ÇIKIŞ' && !val.vehicle_id) { toast('Çıkışta araç seçin', 'err'); return; }
    if (val.move_type === 'ÇIKIŞ') {
      const chk = await checkTankStock(db, liters);
      if (!chk.ok) return;
      if (chk.override) { /* neden audit'e hareket notuyla yazılır */ }
      var overrideNote = chk.override ? ' · STOK AŞIMI: ' + chk.reason : '';
    }
    const mv = await db.saveNew('fuel_tank_movements', {
      date: val.date, move_type: val.move_type, liters,
      vehicle_id: val.vehicle_id || null, personnel_id: val.personnel_id || null,
      pump_no: val.pump_no || '', signature_name: val.signature_name || '',
      fuel_record_id: null
    }, 'Tank ' + val.move_type + (overrideNote || ''));
    if (val.move_type === 'ÇIKIŞ' && val.vehicle_id) {
      const fr = await db.saveNew('fuel_records', {
        date: val.date, vehicle_id: val.vehicle_id, personnel_id: val.personnel_id || null,
        liters, unit_price: null, total: null, fuel_source: 'Depo Tankı', receipt: '',
        pump_no: val.pump_no || '', km: null, machine_hours: null,
        description: 'Depo tankından yakıt', customer_billable: false, tank_movement_id: mv.id
      }, 'Yakıt kaydı (tank çıkışından)');
      await db.saveExisting('fuel_tank_movements', mv, { fuel_record_id: fr.id }, 'Yakıt kaydı bağlantısı');
    }
    toast('Kaydedildi', 'ok');
    ctx.reload();
  });
  qs('[data-pdf]', root).addEventListener('click', async () => {
    const pdf = await import('./pdf.js');
    await pdf.tankPdf(rows, bal, names);
  });
}

// ============ FİLO ============
async function fleet(ctx) {
  const sub = ctx.parts[1];
  const { root, db, names } = ctx;
  if (sub === 'new') return vehicleForm(ctx);
  if (sub && ctx.parts[2] === 'edit') return vehicleForm(ctx, sub);
  if (sub) return vehicleDetail(ctx, sub);
  const rows = (await db.getAll('vehicles')).filter(isActive);
  const [maint, docs] = await Promise.all([db.getAll('maintenance_records'), db.getAll('documents')]);
  const today = todayStr();
  const docBadgeFor = (vid) => {
    const ds = docs.filter(d => isActive(d) && ((d.owner_type === 'vehicle' && d.owner_id === vid) || d.vehicle_id === vid));
    const withExp = ds.filter(d => d.expiry_date);
    if (!ds.length) return badge('belge yok');
    if (!withExp.length) return '';
    let worst = null;
    for (const d of withExp) {
      const days = Math.round((new Date(d.expiry_date + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000);
      if (worst === null || days < worst) worst = days;
    }
    if (worst < 0) return badge('SÜRESİ GEÇMİŞ', 'danger');
    if (worst <= 7) return badge('belge ≤7 gün', 'warn');
    if (worst <= 30) return badge('belge ≤30 gün', 'info');
    return '';
  };
  root.innerHTML = appbar('Filo', `${rows.length} araç/makine`) + `
    <div style="height:10px"></div>
    <div data-list></div>
    <div class="actionbar"><button class="btn primary" data-go="#/filo/new">+ Araç/Makine</button></div>`;
  qs('[data-list]', root).innerHTML = rows.map(v => {
    const open = maint.filter(m => isActive(m) && m.vehicle_id === v.id && m.status !== 'Tamamlandı').length;
    return li({
      ic: v.ownership === 'Taşeron' ? '🤝' : '🚜', href: '#/filo/' + v.id,
      t1: esc(v.name) + (v.plate ? ` <span class="tiny muted">${esc(v.plate)}</span>` : ''),
      t2: `${esc(v.type || '')} · ${esc(v.ownership || '')}${v.assignee_id ? ' · zimmet: ' + esc(names.personnel[v.assignee_id] || '') : ''}`,
      badgeHtml: open ? badge(open + ' açık', 'danger') : (docBadgeFor(v.id) || (v.next_maintenance_date ? badge('bakım ' + trDate(v.next_maintenance_date), 'warn') : ''))
    });
  }).join('');
}

async function vehicleForm(ctx, editId) {
  const { root, db } = ctx;
  const rec = editId ? await db.get('vehicles', editId) : null;
  const v = rec || {};
  const personnel = await db.listActive('personnel');
  root.innerHTML = appbar(editId ? 'Araç Düzenle' : '+ Araç / Makine', editId ? (v.name || '') : 'Filo kartı') + `
    <form data-form novalidate>
      ${fText('Ad / Tanım', 'name', v.name || '', { req: true })}
      <div class="formgrid2">
        ${fText('Plaka (ops.)', 'plate', v.plate || '')}
        ${fSelect('Tür', 'type', VEHICLE_TYPES, v.type || 'Araç/Makine', { empty: false })}
      </div>
      <div class="formgrid2">
        ${fText('Marka (ops.)', 'brand', v.brand || '')}
        ${fText('Model (ops.)', 'model', v.model || '')}
      </div>
      <div class="formgrid2">
        ${fNum('Model Yılı (ops.)', 'model_year', v.model_year ?? '')}
        ${fSelect('Yakıt Türü', 'fuel_type', FUEL_TYPES, v.fuel_type || 'Dizel', { empty: false })}
      </div>
      <div class="formgrid2">
        ${fSelect('Özmal/Taşeron', 'ownership', VEHICLE_OWNERSHIP, v.ownership || 'Özmal', { empty: false })}
        ${fSelect('Zimmetli Personel', 'assignee_id', personnel.map(p => ({ v: p.id, t: p.name })), v.assignee_id)}
      </div>
      <div class="formgrid2">
        ${fNum('KM (ops.)', 'km', v.km ?? '')}
        ${fNum('Makine Saati (ops.)', 'machine_hours', v.machine_hours ?? '', { step: 'any' })}
      </div>
      <div class="formgrid2">
        ${fDate('Sonraki Bakım', 'next_maintenance_date', v.next_maintenance_date || '', false)}
        ${fSelect('Durum', 'active', [{ v: '1', t: 'Aktif' }, { v: '0', t: 'Pasif' }], v.active === false ? '0' : '1', { empty: false })}
      </div>
      ${fText('Not (ops.)', 'note', v.note || '')}
    </form>
    <div class="actionbar"><button class="btn primary" data-save>Kaydet</button></div>`;
  qs('[data-save]', root).addEventListener('click', async () => {
    const val = collectForm(qs('[data-form]', root));
    if (!val.name || !val.name.trim()) { toast('Ad girin', 'err'); return; }
    const fields = {
      name: val.name.trim(), plate: val.plate || null, type: val.type,
      brand: val.brand || null, model: val.model || null,
      model_year: val.model_year ? Number(val.model_year) : null, fuel_type: val.fuel_type || null,
      ownership: val.ownership, assignee_id: val.assignee_id || null,
      km: val.km ? Number(val.km) : null, machine_hours: val.machine_hours ? Number(val.machine_hours) : null,
      next_maintenance_date: val.next_maintenance_date || null,
      active: val.active !== '0', note: val.note || ''
    };
    let saved;
    if (editId) saved = await db.saveExisting('vehicles', rec, fields, 'Araç kartı güncellendi');
    else saved = await db.saveNew('vehicles', fields, 'Araç eklendi');
    toast('Kaydedildi', 'ok');
    go('#/filo/' + saved.id);
  });
}

async function vehicleDetail(ctx, id) {
  const { root, db, names } = ctx;
  const v = await db.get('vehicles', id);
  if (!v) { root.innerHTML = appbar('Araç') + emptyState('🚜', 'Yok'); return; }
  const [works, fuels, maints, docs] = await Promise.all([db.getAll('work_records'), db.getAll('fuel_records'), db.getAll('maintenance_records'), db.getAll('documents')]);
  const w = works.filter(x => isActive(x) && x.vehicle_id === id);
  const f = fuels.filter(x => isActive(x) && x.vehicle_id === id);
  const m = maints.filter(x => isActive(x) && x.vehicle_id === id);
  const d = docs.filter(x => isActive(x) && ((x.owner_type === 'vehicle' && x.owner_id === id) || x.vehicle_id === id));
  const saat = w.filter(x => x.unit === 'Saat').reduce((s, x) => s + (Number(x.quantity) || 0), 0);
  const sefer = w.filter(x => x.unit === 'Sefer').reduce((s, x) => s + (Number(x.quantity) || 0), 0);
  const yev = w.filter(x => x.unit === 'Yevmiye').reduce((s, x) => s + (Number(x.quantity) || 0), 0);
  const lt = f.reduce((s, x) => s + (Number(x.liters) || 0), 0);
  const lastMaint = m.filter(x => x.status === 'Tamamlandı').sort((a, b) => a.date < b.date ? 1 : -1)[0];

  root.innerHTML = appbar(v.name, v.plate || 'Araç kartı', { right: badge(v.active === false ? 'Pasif' : 'Aktif', v.active === false ? '' : 'ok') }) + `
    <div class="statgrid" style="margin-top:10px">
      ${stat(fmtNum(w.length), 'İş')}${stat(fmtNum(sefer), 'Sefer')}${stat(fmtNum(saat), 'Saat')}${stat(fmtNum(yev), 'Yevmiye')}
      ${stat(fmtNum(lt), 'Yakıt L')}${stat(fmtNum(m.length), 'Bakım')}${stat(fmtNum(m.filter(x => x.status !== 'Tamamlandı').length), 'Açık', m.some(x => x.status !== 'Tamamlandı') ? 'danger' : '')}${stat(fmtNum(d.length), 'Belge')}
    </div>
    <div class="card">
      ${kv('Tür', v.type || '—')}
      ${v.brand || v.model ? kv('Marka/Model', [v.brand, v.model, v.model_year].filter(Boolean).join(' ')) : ''}
      ${v.fuel_type ? kv('Yakıt', v.fuel_type) : ''}
      ${kv('Özmal/Taşeron', v.ownership || '—')}
      ${kv('Zimmetli', names.personnel[v.assignee_id] || '—')}
      ${v.km ? kv('KM', fmtNum(v.km)) : ''}
      ${v.machine_hours ? kv('Makine Saati', fmtNum(v.machine_hours)) : ''}
      ${v.next_maintenance_date ? kv('Sonraki Bakım', trDate(v.next_maintenance_date)) : ''}
      ${v.note ? kv('Not', v.note) : ''}
    </div>
    <div class="actionbar"><button class="btn" data-go="#/filo/${id}/edit">Kartı Düzenle</button></div>
    ${lastMaint ? notice('ok', `Son tamamlanan bakım: ${trDate(lastMaint.date)} — ${lastMaint.maint_type || ''}`) : ''}
    <div class="row between"><div class="section-title" style="margin:0">Belgeler</div><button class="btn sm" data-go="#/belgeler/new?owner=vehicle&id=${id}">+ Belge Ekle</button></div>
    <div style="height:8px"></div>
    ${d.length ? d.slice(-6).reverse().map(x => li({ ic: '🗂', href: '#/belgeler/' + x.id, t1: esc(x.category || 'Belge'), t2: `${trDate(x.date)}${x.expiry_date ? ' · bitiş ' + trDate(x.expiry_date) : ''}`, badgeHtml: docExpiryBadge(x) })).join('') : emptyState('🗂', 'Belge yok — ruhsat/muayene/sigorta ekleyin')}
    <div class="section-title">Son İşler</div>
    ${w.length ? w.slice(-5).reverse().map(x => li({ ic: '⚒', href: '#/isler/' + x.id, t1: `${trDate(x.date)} · ${esc(x.work_type || '')}`, t2: esc(names.customers[x.customer_id] || ''), end: `<span class="amt nowrap">${fmtNum(x.quantity)} ${esc(x.unit || '')}</span>` })).join('') : emptyState('⚒', 'İş yok')}
    <div class="section-title">Son Yakıtlar</div>
    ${f.length ? f.slice(-5).reverse().map(x => li({ ic: '⛽', href: '#/yakit/' + x.id, t1: `${trDate(x.date)} · ${fmtNum(x.liters)} Lt`, t2: esc(x.fuel_source || '') })).join('') : emptyState('⛽', 'Yakıt yok')}
    <div class="section-title">Bakım/Arıza</div>
    ${m.length ? m.slice(-5).reverse().map(x => li({ ic: '🔧', href: '#/bakim/' + x.id, t1: `${trDate(x.date)} · ${esc(x.maint_type || '')}`, t2: esc(x.description || ''), badgeHtml: statusBadge(x.status || 'Açık') })).join('') : emptyState('🔧', 'Kayıt yok')}`;
}

// ============ BAKIM / ARIZA ============
async function maint(ctx) {
  const sub = ctx.parts[1];
  if (sub === 'new') return maintForm(ctx);
  if (sub && ctx.parts[2] === 'edit') return maintForm(ctx, sub);
  if (sub) return maintDetail(ctx, sub);
  const { root, db, names, query } = ctx;
  const f = query.f || 'open';
  let rows = (await db.getAll('maintenance_records')).filter(isActive).sort((a, b) => b.date < a.date ? -1 : 1);
  if (f === 'open') rows = rows.filter(r => r.status !== 'Tamamlandı');
  if (f === 'done') rows = rows.filter(r => r.status === 'Tamamlandı');
  root.innerHTML = appbar('Bakım / Arıza', `${rows.length} kayıt`) + `
    <div style="height:10px"></div>
    ${segBar([{ v: 'open', t: 'Açık' }, { v: 'all', t: 'Tümü' }, { v: 'done', t: 'Tamamlanan' }], f, v => `#/bakim?f=${v}`)}
    <div data-list></div>
    <div class="actionbar"><button class="btn primary" data-go="#/bakim/new">+ Arıza / Bakım</button></div>`;
  const listEl = qs('[data-list]', root);
  if (!rows.length) listEl.innerHTML = emptyState('🔧', 'Kayıt yok');
  else pagedRender(listEl, rows, (m) => li({
    ic: '🔧', href: '#/bakim/' + m.id,
    t1: `${esc(names.vehicles[m.vehicle_id] || '—')} · ${esc(m.maint_type || '')}`,
    t2: `${trDate(m.date)} · ${esc(names.personnel[m.personnel_id] || '—')}${m.cost ? ' · ' + fmtTL(m.cost) + ' ₺' : ''}${m.description ? ' · ' + esc(m.description) : ''}`,
    badgeHtml: statusBadge(m.status || 'Açık')
  }));
}

async function maintForm(ctx, editId) {
  const { root, db } = ctx;
  const rec = editId ? await db.get('maintenance_records', editId) : null;
  const v = rec || {};
  const [vehicles, personnel] = await Promise.all([db.listActive('vehicles'), db.listActive('personnel')]);
  root.innerHTML = appbar(editId ? 'Bakım Düzenle' : '+ Arıza / Bakım', '') + `
    <form data-form novalidate>
      ${fDate('Tarih', 'date', v.date || todayStr())}
      <div class="formgrid2">
        ${fSelect('Araç / Makine', 'vehicle_id', vehicles.map(x => ({ v: x.id, t: x.name })), v.vehicle_id, { req: true })}
        ${fSelect('Personel', 'personnel_id', personnel.map(p => ({ v: p.id, t: p.name })), v.personnel_id)}
      </div>
      <div class="formgrid2">
        ${fSelect('Kayıt Tipi', 'maint_type', MAINT_TYPES, v.maint_type || 'Arıza', { empty: false })}
        ${fSelect('Durum', 'status', MAINT_STATUS, v.status || 'Açık', { empty: false })}
      </div>
      ${fArea('Arıza / Açıklama', 'description', v.description || '')}
      <div class="formgrid2">
        ${fNum('Maliyet (₺, ops.)', 'cost', v.cost ?? '', { step: 'any' })}
        ${fText('Servis/Firma (ops.)', 'service_company', v.service_company || '')}
      </div>
      ${fText('KM / Çalışma Saati (ops.)', 'km_hours', v.km_hours || '')}
      <div class="field"><label>Fotoğraf</label><input type="file" name="photo" accept="image/*" capture="environment"></div>
    </form>
    <div class="actionbar"><button class="btn primary" data-save>Kaydet</button></div>`;
  qs('[data-save]', root).addEventListener('click', async () => {
    const val = collectForm(qs('[data-form]', root));
    if (!val.vehicle_id) { toast('Araç seçin', 'err'); return; }
    const fields = {
      date: val.date, vehicle_id: val.vehicle_id, personnel_id: val.personnel_id || null,
      maint_type: val.maint_type, status: val.status, description: val.description || '',
      cost: val.cost ? Number(val.cost) : null, service_company: val.service_company || '', km_hours: val.km_hours || ''
    };
    let saved;
    if (editId) { saved = await db.saveExisting('maintenance_records', rec, fields, 'Bakım güncellendi'); }
    else { saved = await db.saveNew('maintenance_records', fields, 'Bakım kaydı'); }
    const file = qs('input[name=photo]', root).files[0];
    if (file) await db.addAttachment('maintenance', saved.id, file);
    toast('Kaydedildi', 'ok');
    go('#/bakim/' + saved.id);
  });
}

async function maintDetail(ctx, id) {
  const { root, db, names } = ctx;
  const m = await db.get('maintenance_records', id);
  if (!m) { root.innerHTML = appbar('Bakım') + emptyState('🔧', 'Yok'); return; }
  const atts = await db.attachmentsFor('maintenance', id);
  root.innerHTML = appbar(`${names.vehicles[m.vehicle_id] || 'Bakım'}`, trDate(m.date), { right: statusBadge(m.status || 'Açık') }) + `
    <div style="height:10px"></div>
    <div class="card">
      ${kv('Tür', m.maint_type || '—')}
      ${kv('Personel', names.personnel[m.personnel_id] || '—')}
      ${m.description ? kv('Açıklama', m.description) : ''}
      ${m.cost ? kv('Maliyet', fmtTL(m.cost) + ' ₺') : ''}
      ${m.service_company ? kv('Servis', m.service_company) : ''}
      ${m.km_hours ? kv('KM/Saat', m.km_hours) : ''}
    </div>
    ${atts.length ? `<div class="section-title">Fotoğraflar</div><div class="row" style="flex-wrap:wrap">${atts.map((a) => `<img data-att="${a.id}" style="width:calc(50% - 5px);border-radius:10px;cursor:pointer" src="">`).join('')}</div>` : ''}
    <div class="actionbar">
      ${m.status !== 'Tamamlandı' ? `<button class="btn" data-st="${m.status === 'Açık' ? 'Serviste' : m.status === 'Serviste' ? 'Parça Bekliyor' : 'Tamamlandı'}">${m.status === 'Açık' ? '→ Serviste' : m.status === 'Serviste' ? '→ Parça Bekliyor' : '→ Tamamla'}</button><button class="btn ok" data-done>Tamamlandı ✓</button>` : ''}
      <button class="btn" data-go="#/bakim/${id}/edit">Düzenle</button>
      <button class="btn danger" data-del>Sil</button>
    </div>`;
  for (const img of qsa('[data-att]', root)) {
    const a = atts.find(x => x.id === img.dataset.att);
    if (a) img.src = URL.createObjectURL(a.blob);
    img.addEventListener('click', () => {
      sheet(`<h3>Fotoğraf</h3><img src="${img.src}" style="width:100%;border-radius:10px">`);
    });
  }
  const stBtn = qs('[data-st]', root);
  if (stBtn) stBtn.addEventListener('click', async () => { await db.saveExisting('maintenance_records', m, { status: stBtn.dataset.st }, 'Durum geçişi'); toast('Güncellendi', 'ok'); ctx.reload(); });
  const done = qs('[data-done]', root);
  if (done) done.addEventListener('click', async () => { await db.saveExisting('maintenance_records', m, { status: 'Tamamlandı' }, 'Tamamlandı'); toast('Tamamlandı', 'ok'); ctx.reload(); });
  qs('[data-del]', root).addEventListener('click', async () => {
    const ok = await confirmDialog('Kayıt silinsin mi?', 'Çöp kutusuna taşınır.', 'Sil', true);
    if (!ok) return;
    await db.softDelete('maintenance_records', id, 'Kullanıcı sildi');
    go('#/bakim');
  });
}

// ============ PERSONEL ============
async function personnel(ctx) {
  const sub = ctx.parts[1];
  const { root, db } = ctx;
  if (sub === 'hareket') return personnelEventForm(ctx);
  if (sub === 'new') return personnelForm(ctx);
  if (sub && ctx.parts[2] === 'edit') return personnelForm(ctx, sub);
  if (sub) return personnelDetail(ctx, sub);
  const rows = (await db.getAll('personnel')).filter(isActive);
  const events = await db.getAll('personnel_events');
  root.innerHTML = appbar('Personel', `${rows.length} kişi`) + `
    <div style="height:10px"></div>
    <div data-list></div>
    <div class="row actionbar"><button class="btn" data-go="#/personel/new">+ Personel</button><button class="btn primary" data-go="#/personel/hareket">+ Hareket (Avans/Mesai/İzin)</button></div>`;
  qs('[data-list]', root).innerHTML = rows.map(p => {
    const pending = events.filter(e => isActive(e) && e.personnel_id === p.id && e.event_type === 'Avans').reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return li({ ic: '👷', href: '#/personel/' + p.id, t1: esc(p.name), t2: esc(p.role || ''), badgeHtml: p.active === false ? badge('Pasif') : '', end: pending ? `<span class="badge warn">avans ${fmtTL(pending)} ₺</span>` : '' });
  }).join('');
}

async function personnelForm(ctx, editId) {
  const { root, db } = ctx;
  const rec = editId ? await db.get('personnel', editId) : null;
  const p = rec || {};
  root.innerHTML = appbar(editId ? 'Personel Düzenle' : '+ Personel', editId ? (p.name || '') : '') + `
    <form data-form novalidate>
      ${fText('Ad Soyad', 'name', p.name || '', { req: true })}
      <div class="formgrid2">
        ${fText('Rol (ops.)', 'role', p.role || '')}
        ${fText('Telefon (ops.)', 'phone', p.phone || '', { type: 'tel' })}
      </div>
      <div class="formgrid2">
        ${fDate('İşe Giriş (ops.)', 'hire_date', p.hire_date || '', false)}
        ${fSelect('Durum', 'active', [{ v: '1', t: 'Aktif' }, { v: '0', t: 'Pasif' }], p.active === false ? '0' : '1', { empty: false })}
      </div>
    </form>
    <div class="actionbar"><button class="btn primary" data-save>Kaydet</button></div>`;
  qs('[data-save]', root).addEventListener('click', async () => {
    const val = collectForm(qs('[data-form]', root));
    if (!val.name || !val.name.trim()) { toast('Ad girin', 'err'); return; }
    const fields = { name: val.name.trim(), role: val.role || '', phone: val.phone || null, hire_date: val.hire_date || null, active: val.active !== '0' };
    let saved;
    if (editId) saved = await db.saveExisting('personnel', rec, fields, 'Personel güncellendi');
    else saved = await db.saveNew('personnel', fields, 'Personel eklendi');
    toast('Kaydedildi', 'ok');
    go('#/personel/' + saved.id);
  });
}

async function personnelDetail(ctx, id) {
  const { root, db, names } = ctx;
  const p = await db.get('personnel', id);
  if (!p) { root.innerHTML = appbar('Personel') + emptyState('👷', 'Yok'); return; }
  const [works, events, fuels, cashR, maints, docs] = await Promise.all([db.getAll('work_records'), db.getAll('personnel_events'), db.getAll('fuel_records'), db.getAll('cash_records'), db.getAll('maintenance_records'), db.getAll('documents')]);
  const w = works.filter(x => isActive(x) && x.personnel_id === id);
  const ev = events.filter(x => isActive(x) && x.personnel_id === id).sort((a, b) => a.date < b.date ? -1 : 1);
  const fu = fuels.filter(x => isActive(x) && x.personnel_id === id);
  const ca = cashR.filter(x => isActive(x) && x.personnel_id === id);
  const ma = maints.filter(x => isActive(x) && x.personnel_id === id);
  const pd = docs.filter(x => isActive(x) && ((x.owner_type === 'personnel' && x.owner_id === id) || x.personnel_id === id));
  const pendingCash = ca.filter(c => c.cash_status === 'PERSONELDE').reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const saat = w.filter(x => x.unit === 'Saat').reduce((s, x) => s + (Number(x.quantity) || 0), 0);
  const mesai = ev.filter(e => e.event_type === 'Mesai').reduce((s, e) => s + (Number(e.hours_days) || 0), 0);
  const avans = ev.filter(e => e.event_type === 'Avans').reduce((s, e) => s + (Number(e.amount) || 0), 0);

  root.innerHTML = appbar(p.name, p.role || 'Personel', { right: badge(p.active === false ? 'Pasif' : 'Aktif', p.active === false ? '' : 'ok') }) + `
    <div class="statgrid" style="margin-top:10px">
      ${stat(fmtNum(w.length), 'İş')}${stat(fmtNum(saat), 'Saat')}${stat(fmtNum(mesai), 'Mesai')}${stat(fmtNum(fu.length), 'Yakıt')}
      ${stat(fmtTL(avans), 'Avans ₺', avans ? 'warn' : '')}${stat(fmtTL(pendingCash), 'Üzerinde ₺', pendingCash ? 'danger' : '')}${stat(fmtNum(ma.length), 'Arıza')}${stat(fmtNum(ev.length), 'Hareket')}
    </div>
    ${p.phone || p.hire_date ? `<div class="card">${p.phone ? kv('Telefon', p.phone) : ''}${p.hire_date ? kv('İşe Giriş', trDate(p.hire_date)) : ''}</div>` : ''}
    <div class="actionbar"><button class="btn" data-go="#/personel/${id}/edit">Kartı Düzenle</button></div>
    <div class="row between"><div class="section-title" style="margin:0">Belgeler</div><button class="btn sm" data-go="#/belgeler/new?owner=personnel&id=${id}">+ Belge Ekle</button></div>
    <div style="height:8px"></div>
    ${pd.length ? pd.slice(-6).reverse().map(x => li({ ic: '🗂', href: '#/belgeler/' + x.id, t1: esc(x.category || 'Belge'), t2: `${trDate(x.date)}${x.expiry_date ? ' · bitiş ' + trDate(x.expiry_date) : ''}`, badgeHtml: docExpiryBadge(x) })).join('') : emptyState('🗂', 'Belge yok — ehliyet/SRC/psikoteknik ekleyin')}
    <div class="section-title">Hareketler</div>
    ${ev.length ? `<div class="timeline">${ev.slice(-12).reverse().map(e => `<div class="ti"><div class="small strong">${trDate(e.date)} · ${esc(e.event_type)}${e.amount ? ' · ' + fmtTL(e.amount) + ' ₺' : ''}${e.hours_days ? ' · ' + fmtNum(e.hours_days) + ' sa/gün' : ''}</div><div class="tiny muted">${esc(e.description || '')}</div></div>`).join('')}</div>` : emptyState('📋', 'Hareket yok')}
    <div class="section-title">Son İşler</div>
    ${w.length ? w.slice(-5).reverse().map(x => li({ ic: '⚒', href: '#/isler/' + x.id, t1: `${trDate(x.date)} · ${esc(x.work_type || '')}`, t2: esc(names.customers[x.customer_id] || '') })).join('') : emptyState('⚒', 'İş yok')}
    <div class="actionbar"><button class="btn primary" data-go="#/personel/hareket?pid=${id}">+ Hareket</button></div>`;
}

async function personnelEventForm(ctx) {
  const { root, db, query } = ctx;
  const personnelL = await db.listActive('personnel');
  root.innerHTML = appbar('+ Personel Hareketi', 'Bordro değildir; saha takibidir') + `
    <form data-form novalidate>
      ${fDate('Tarih', 'date', todayStr())}
      ${fSelect('Personel', 'personnel_id', personnelL.map(p => ({ v: p.id, t: p.name })), query.pid || '', { req: true })}
      ${fSelect('İşlem', 'event_type', PERSONNEL_EVENT_TYPES, 'Avans', { empty: false })}
      <div class="formgrid2">
        ${fNum('Tutar (₺, ops.)', 'amount', '', { step: 'any' })}
        ${fNum('Saat / Gün (ops.)', 'hours_days', '', { step: 'any' })}
      </div>
      ${fArea('Açıklama', 'description', '')}
    </form>
    <div class="actionbar"><button class="btn primary" data-save>Kaydet</button></div>`;
  qs('[data-save]', root).addEventListener('click', async () => {
    const val = collectForm(qs('[data-form]', root));
    if (!val.personnel_id) { toast('Personel seçin', 'err'); return; }
    await db.saveNew('personnel_events', {
      date: val.date, personnel_id: val.personnel_id, event_type: val.event_type,
      amount: val.amount ? Number(val.amount) : null, hours_days: val.hours_days ? Number(val.hours_days) : null,
      description: val.description || ''
    }, 'Personel hareketi');
    toast('Kaydedildi', 'ok');
    go('#/personel/' + val.personnel_id);
  });
}

// ============ TAŞERON ============
async function contractors(ctx) {
  const { root, db, names } = ctx;
  const sub = ctx.parts[1];
  const rows = (await db.getAll('contractors')).filter(isActive);
  if (sub) {
    const c = await db.get('contractors', sub);
    if (!c) { root.innerHTML = appbar('Taşeron') + emptyState('🤝', 'Yok'); return; }
    const works = (await db.getAll('work_records')).filter(w => isActive(w) && w.contractor_id === sub);
    const sefer = works.filter(w => w.unit === 'Sefer').reduce((s, w) => s + (Number(w.quantity) || 0), 0);
    const saat = works.filter(w => w.unit === 'Saat').reduce((s, w) => s + (Number(w.quantity) || 0), 0);
    const yev = works.filter(w => w.unit === 'Yevmiye').reduce((s, w) => s + (Number(w.quantity) || 0), 0);
    root.innerHTML = appbar(c.name, 'Taşeron kartı') + `
      <div class="statgrid" style="margin-top:10px;grid-template-columns:repeat(3,1fr)">
        ${stat(fmtNum(sefer), 'Sefer')}${stat(fmtNum(saat), 'Saat')}${stat(fmtNum(yev), 'Yevmiye')}
      </div>
      <div class="card">${kv('Araç/Plaka', (c.vehicle_text || '—') + (c.plate ? ' / ' + c.plate : ''))}${kv('Makine', c.machine || '—')}${kv('Telefon', c.phone || '—')}${c.note ? kv('Not', c.note) : ''}</div>
      <div class="section-title">Yaptığı İşler (mutabakat taslağı)</div>
      ${works.length ? works.map(w => li({ ic: '⚒', href: '#/isler/' + w.id, t1: `${trDate(w.date)} · ${esc(w.work_type || '')}`, t2: esc(names.customers[w.customer_id] || ''), end: `<span class="amt nowrap">${fmtNum(w.quantity)} ${esc(w.unit || '')}</span>` })).join('') : emptyState('⚒', 'İş bağlı değil — iş formunda taşeron seçilebilir')}
      <div class="tiny muted">Bu ekran local mutabakat taslağıdır; resmi hakediş değildir.</div>`;
    return;
  }
  root.innerHTML = appbar('Taşeronlar', `${rows.length} firma`) + `
    <div style="height:10px"></div>
    <div data-list></div>
    <div class="actionbar"><button class="btn primary" data-cadd>+ Taşeron</button></div>`;
  qs('[data-list]', root).innerHTML = rows.length ? rows.map(c => li({ ic: '🤝', href: '#/taseron/' + c.id, t1: esc(c.name), t2: esc((c.vehicle_text || '') + (c.plate ? ' · ' + c.plate : '')) })).join('') : emptyState('🤝', 'Taşeron yok');
  qs('[data-cadd]', root).addEventListener('click', async () => {
    const name = await promptDialog('Yeni Taşeron', 'Firma adı');
    if (!name) return;
    const plate = await promptDialog('Plaka (ops.)', 'Plaka — boş geçilebilir') || '';
    const created = await db.saveNew('contractors', { name, plate, active: true });
    toast('Eklendi', 'ok');
    go('#/taseron/' + created.id);
  });
}

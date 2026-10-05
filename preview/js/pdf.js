// ============================================================
// SAHAPRO SOLO — PDF katmanı (§9, §12, §16, §43)
// jsPDF + autoTable + DejaVuSans (Türkçe karakter) — CDN'den lazy yüklenir.
// CDN/ font yüklenemezse printHTML (tarayıcı yazdırma) fallback.
// Müşteri PDF'i GİZLİLİK: iç not, maliyet, UUID, storage bilgisi ASLA basılmaz.
// İmzalı fişte imza blob'u yoksa PDF ÜRETME (fail-closed).
// ============================================================
import { fmtTL, fmtNum, trDate, daySummary } from './core.js';
import { toast, shareOrDownload, printHTML } from './ui.js';

const CDN_JSPDF = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
const CDN_AUTOTABLE = 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js';
const FONT_REG = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf';
const FONT_BOLD = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans-Bold.ttf';

const scriptOnce = {};
function loadScript(src) {
  if (!scriptOnce[src]) scriptOnce[src] = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => res(); s.onerror = () => rej(new Error('script: ' + src));
    document.head.appendChild(s);
  });
  return scriptOnce[src];
}

async function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1] || '');
    fr.onerror = () => rej(new Error('base64'));
    fr.readAsDataURL(blob);
  });
}

let fontState = null; // 'ok' | 'no'
async function ensureFonts(jsPDF) {
  if (fontState === 'ok') return;
  if (fontState === 'no') throw new Error('font yok');
  try {
    const mk = new jsPDF();
    for (const [url, file, style] of [[FONT_REG, 'DejaVuSans.ttf', 'normal'], [FONT_BOLD, 'DejaVuSans-Bold.ttf', 'bold']]) {
      const r = await fetch(url);
      if (!r.ok) throw new Error('font http ' + r.status);
      const b64 = await blobToBase64(await r.blob());
      mk.addFileToVFS(file, b64);
      mk.addFont(file, 'DejaVuSans', style);
    }
    fontState = 'ok';
  } catch (e) { fontState = 'no'; throw e; }
}

let pdfOnce = null;
export async function ensurePdf() {
  if (!pdfOnce) pdfOnce = (async () => {
    await loadScript(CDN_JSPDF);
    await loadScript(CDN_AUTOTABLE);
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error('jsPDF yok');
    await ensureFonts(jsPDF);
    return jsPDF;
  })().catch(e => { pdfOnce = null; throw e; });
  return pdfOnce;
}

// ---- Ortak parçalar ----
function asciiFold(s) {
  return String(s || '').replace(/[ğĞ]/g, 'g').replace(/[şŞ]/g, 's').replace(/[ıI]/g, 'i').replace(/İ/g, 'I')
    .replace(/[çÇ]/g, 'c').replace(/[öO]/g, 'o').replace(/[üU]/g, 'u').replace(/[^A-Za-z0-9._-]+/g, '_');
}
function head(doc, title, sub) {
  doc.setFont('DejaVuSans', 'bold'); doc.setFontSize(15); doc.setTextColor(13, 26, 43);
  doc.text('MURATOĞLU HAFRİYAT', 105, 15, { align: 'center' });
  doc.setFontSize(8); doc.setTextColor(110, 118, 130);
  doc.text('SAHAPRO SOLO — Mobil Operasyon Sistemi', 105, 20.5, { align: 'center' });
  doc.setDrawColor(13, 26, 43); doc.setLineWidth(0.6); doc.line(14, 24, 196, 24);
  doc.setFontSize(12.5); doc.setTextColor(13, 26, 43); doc.text(title, 105, 32, { align: 'center' });
  if (sub) { doc.setFont('DejaVuSans', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 88, 100); doc.text(sub, 105, 38, { align: 'center' }); }
  return sub ? 44 : 40;
}
function foot(doc) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFont('DejaVuSans', 'normal'); doc.setFontSize(7); doc.setTextColor(140, 146, 158);
    doc.text(`Muratoğlu Hafriyat · SAHAPRO SOLO — Sayfa ${i} / ${n}`, 105, 292, { align: 'center' });
  }
}
function kvRows(pairs) { return pairs.filter(p => p[1] != null && p[1] !== '').map(p => [p[0], String(p[1])]); }
function kvTable(doc, pairs, y) {
  const rows = kvRows(pairs);
  if (!rows.length) return y;
  doc.autoTable({
    startY: y, body: rows, theme: 'plain',
    styles: { font: 'DejaVuSans', fontSize: 9.5, cellPadding: 1.6, textColor: [30, 36, 46] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42, textColor: [90, 98, 112] }, 1: { cellWidth: 'auto' } },
    margin: { left: 14, right: 14 }
  });
  return doc.lastAutoTable.finalY + 3;
}
function table(doc, headers, rows, y, opts = {}) {
  doc.autoTable({
    startY: y, head: [headers], body: rows, theme: 'grid',
    styles: { font: 'DejaVuSans', fontSize: 8.3, cellPadding: 1.7, textColor: [30, 36, 46], lineColor: [210, 214, 222], lineWidth: 0.15 },
    headStyles: { font: 'DejaVuSans', fontStyle: 'bold', fillColor: [13, 26, 43], textColor: 255, fontSize: 8.3 },
    alternateRowStyles: { fillColor: [245, 247, 251] },
    margin: { left: 14, right: 14 }, ...opts
  });
  return doc.lastAutoTable.finalY + 4;
}
function sectionTitle(doc, txt, y) {
  if (y > 262) { doc.addPage(); y = 20; }
  doc.setFont('DejaVuSans', 'bold'); doc.setFontSize(10); doc.setTextColor(13, 26, 43);
  doc.text(txt, 14, y);
  return y + 2.5;
}
function totalsBox(doc, rows, y) {
  if (y > 250) { doc.addPage(); y = 20; }
  doc.autoTable({
    startY: y, body: rows, theme: 'plain',
    styles: { font: 'DejaVuSans', fontSize: 10, cellPadding: 1.8 },
    columnStyles: { 0: { cellWidth: 120, halign: 'right', textColor: [90, 98, 112] }, 1: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold', textColor: [13, 26, 43] } },
    margin: { left: 14, right: 14 }
  });
  return doc.lastAutoTable.finalY + 3;
}
async function emit(doc, filename, title, fallbackHtml) {
  foot(doc);
  const blob = doc.output('blob');
  await shareOrDownload(blob, filename, title);
  return true;
}
function blobToDataUrl(blob) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
}
const pad6 = (n) => String(n || 0).padStart(6, '0');
const pad4 = (n) => String(n || 0).padStart(4, '0');
const tl = (n) => fmtTL(n) + ' TL';

// ============================================================
// 1) DİJİTAL İŞ FİŞİ — fail-closed (§9)
// ============================================================
export async function slipPdf(s, names, sigBlob, ctx) {
  if (s.status === 'İmzalandı' && !sigBlob) {
    try { if (ctx && ctx.db) await ctx.db.audit('slips', s.id, 'pdf_blocked', null, null, 'İmzalı fiş PDF: imza blob yok (fail-closed)'); } catch (e) { /* yut */ }
    toast('İmza verisi okunamadı — imzalı fiş için PDF ÜRETİLMEZ. Önce imzayı kontrol edin.', 'err');
    return false;
  }
  const file = `SAHAPRO_Fis_${pad6(s.slip_no)}.pdf`;
  const cust = names.customers[s.customer_id] || '—';
  try {
    const jsPDF = await ensurePdf();
    const doc = new jsPDF();
    let y = head(doc, 'DİJİTAL İŞ FİŞİ', `Seri No: ${pad6(s.slip_no)}${s.revision_no > 1 ? ' · Revizyon ' + s.revision_no : ''}`);
    y = kvTable(doc, [
      ['Tarih', trDate(s.date)], ['Müşteri', cust], ['Şantiye', names.sites[s.site_id] || null],
      ['Araç / Makine', names.vehicles[s.vehicle_id] || null], ['Plaka', s.plate || null],
      ['Personel', names.personnel[s.personnel_id] || null], ['Yapılan İş', s.work_text],
      ['Miktar', `${fmtNum(s.quantity)} ${s.unit || ''}`], ['Açıklama', s.description || null],
      ['Teslim Alan', s.receiver_name || null]
    ], y);
    if (s.status === 'İmzalandı' && sigBlob) {
      const dataUrl = await blobToDataUrl(sigBlob);
      y = sectionTitle(doc, 'TESLİM ALAN İMZASI', y + 2);
      const iw = 70, ih = 32;
      if (y + ih > 270) { doc.addPage(); y = 20; }
      doc.setDrawColor(150, 156, 168); doc.setLineWidth(0.3); doc.rect(14, y, iw, ih);
      doc.addImage(dataUrl, 'PNG', 15, y + 1, iw - 2, ih - 2);
      doc.setFont('DejaVuSans', 'normal'); doc.setFontSize(8); doc.setTextColor(110, 118, 130);
      doc.text(`İmzalandı: ${trDate((s.signed_at || '').slice(0, 10))} ${(s.signed_at || '').slice(11, 16)}`, 14, y + ih + 5);
      y += ih + 9;
    } else if (s.status === 'Taslak') {
      y = sectionTitle(doc, 'İMZA', y + 2);
      doc.setFont('DejaVuSans', 'normal'); doc.setFontSize(9); doc.setTextColor(150, 90, 20);
      doc.text('Bu fiş henüz imzalanmadı — TASLAK kopyadır.', 14, y + 4); y += 9;
    }
    if (s.status === 'Revize') { doc.setFont('DejaVuSans', 'bold'); doc.setFontSize(10); doc.setTextColor(176, 32, 32); doc.text('REVİZE EDİLDİ — Bu belge yerine güncel revizyon geçerlidir.', 105, y + 4, { align: 'center' }); }
    if (s.status === 'İptal') { doc.setFont('DejaVuSans', 'bold'); doc.setFontSize(10); doc.setTextColor(176, 32, 32); doc.text('İPTAL EDİLDİ', 105, y + 4, { align: 'center' }); }
    return await emit(doc, file, 'Dijital İş Fişi ' + pad6(s.slip_no));
  } catch (e) {
    return printHTML(`Dijital İş Fişi #${pad6(s.slip_no)}`, `<div class="pv-card"><h2>MURATOĞLU HAFRİYAT</h2><h3>DİJİTAL İŞ FİŞİ — Seri No: ${pad6(s.slip_no)}</h3><table>${kvRows([
      ['Tarih', trDate(s.date)], ['Müşteri', cust], ['Şantiye', names.sites[s.site_id] || ''],
      ['Araç', names.vehicles[s.vehicle_id] || ''], ['Plaka', s.plate || ''], ['Personel', names.personnel[s.personnel_id] || ''],
      ['Yapılan İş', s.work_text], ['Miktar', `${fmtNum(s.quantity)} ${s.unit || ''}`], ['Açıklama', s.description || ''], ['Teslim Alan', s.receiver_name || '']
    ]).map(r => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td></tr>`).join('')}</table><p><b>İmza:</b> ${s.status === 'İmzalandı' ? 'İmzalı (ekranda görüntüleyin)' : 'Taslak — imza bekleniyor'}</p></div>`);
  }
}

// ============================================================
// 2) TEKLİF PDF (§12) — UNIT_PRICE toplam YOK, ALTERNATIVE toplanmaz
// ============================================================
const QUOTE_NOTES = {
  UNIT_PRICE: 'Bu teklif birim fiyat teklifidir. Kalem fiyatları toplanmaz; toplam tutar, gerçekleşen iş miktarlarına göre hakedişte hesaplanır.',
  QUANTITY_BASED: 'Tutarlar miktar × birim fiyat esasıyla hesaplanmıştır.',
  LUMP_SUM: 'Anahtar teslim (götürü) tekliftir; anlaşılan toplam geçerlidir.',
  ALTERNATIVE: 'Alternatifli tekliftir: satırlar birbirinin alternatifidir ve toplanmaz.'
};
export async function quotePdf(t, names, tot) {
  const file = `SAHAPRO_Teklif_${pad4(t.quote_no)}.pdf`;
  try {
    const jsPDF = await ensurePdf();
    const doc = new jsPDF();
    let y = head(doc, 'TEKLİF', `Teklif No: ${pad4(t.quote_no)} · Tarih: ${trDate(t.date)}`);
    y = kvTable(doc, [['Müşteri', names.customers[t.customer_id] || '—'], ['Şantiye', names.sites[t.site_id] || null], ['Teklif Türü', t.type]], y);
    const rows = (tot.lines || []).map(l => [l.label || '', l.unit || '', l.quantity ? fmtNum(l.quantity) : '—', tl(l.unit_price), l.line_total != null ? tl(l.line_total) : '—']);
    y = sectionTitle(doc, 'KALEMLER', y + 1);
    y = table(doc, ['Kalem', 'Birim', 'Miktar', 'Birim Fiyat', 'Tutar'], rows, y);
    if (tot.show_total) y = totalsBox(doc, [['Ara Toplam', tl(tot.subtotal)], [`KDV %${tot.kdv_rate}`, tl(tot.kdv)], ['GENEL TOPLAM', tl(tot.grand)]], y + 1);
    else { doc.setFont('DejaVuSans', 'normal'); doc.setFontSize(8.6); doc.setTextColor(90, 98, 112); const lines = doc.splitTextToSize(QUOTE_NOTES[t.type] || '', 178); doc.text(lines, 14, y + 3); y += lines.length * 4.4 + 3; }
    if (t.notes) { y = sectionTitle(doc, 'NOTLAR', y + 2); doc.setFont('DejaVuSans', 'normal'); doc.setFontSize(8.8); doc.setTextColor(60, 66, 78); const ln = doc.splitTextToSize(String(t.notes), 178); doc.text(ln, 14, y + 3); }
    return await emit(doc, file, 'Teklif ' + pad4(t.quote_no));
  } catch (e) {
    return printHTML(`Teklif #${pad4(t.quote_no)}`, `<div class="pv-card"><h2>MURATOĞLU HAFRİYAT — TEKLİF ${pad4(t.quote_no)}</h2><p>${trDate(t.date)} · ${names.customers[t.customer_id] || ''}</p><table border="1" cellspacing="0" cellpadding="5"><tr><th>Kalem</th><th>Birim</th><th>Miktar</th><th>Birim Fiyat</th><th>Tutar</th></tr>${(tot.lines || []).map(l => `<tr><td>${l.label || ''}</td><td>${l.unit || ''}</td><td>${l.quantity ? fmtNum(l.quantity) : '—'}</td><td>${tl(l.unit_price)}</td><td>${l.line_total != null ? tl(l.line_total) : '—'}</td></tr>`).join('')}</table>${tot.show_total ? `<p><b>Ara Toplam:</b> ${tl(tot.subtotal)} · <b>KDV %${tot.kdv_rate}:</b> ${tl(tot.kdv)} · <b>GENEL TOPLAM: ${tl(tot.grand)}</b></p>` : `<p><i>${QUOTE_NOTES[t.type] || ''}</i></p>`}${t.notes ? `<p><b>Notlar:</b> ${t.notes}</p>` : ''}</div>`);
  }
}

// ============================================================
// 3) HAKEDİŞ PDF (§16) — kamyon / makine kalemleri ayrı tablolar
// ============================================================
export async function hakedisPdf(h, names) {
  const file = `SAHAPRO_Hakedis_${pad6(h.hakedis_no)}.pdf`;
  const items = (h.items || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const truck = items.filter(i => i.unit === 'Sefer');
  const machine = items.filter(i => i.unit !== 'Sefer');
  const rowOf = (i) => [trDate(i.date), i.work_type || '', i.vehicle_name || '', fmtNum(i.quantity), i.unit || '', i.formula === 'CRANE_FIRST_HOUR' ? 'Vinç tarifesi' : tl(i.unit_price), tl(i.total)];
  try {
    const jsPDF = await ensurePdf();
    const doc = new jsPDF();
    let y = head(doc, 'HAKEDİŞ', `No: ${pad6(h.hakedis_no)} · Dönem: ${trDate(h.date_from)} – ${trDate(h.date_to)}`);
    y = kvTable(doc, [['Müşteri', names.customers[h.customer_id] || '—'], ['Şantiye', names.sites[h.site_id] || null], ['Durum', h.status]], y);
    const cols = ['Tarih', 'İş', 'Araç', 'Miktar', 'Birim', 'Birim Fiyat', 'Tutar'];
    if (truck.length) { y = sectionTitle(doc, 'NAKLİYE / KAMYON KALEMLERİ', y + 1); y = table(doc, cols, truck.map(rowOf), y); }
    if (machine.length) { y = sectionTitle(doc, 'MAKİNE / SAAT – YEVMİYE KALEMLERİ', y + 1); y = table(doc, cols, machine.map(rowOf), y); }
    totalsBox(doc, [['Ara Toplam', tl(h.subtotal)], ['KDV', tl(h.kdv_total)], ['GENEL TOPLAM', tl(h.grand_total)]], y + 1);
    return await emit(doc, file, 'Hakediş ' + pad6(h.hakedis_no));
  } catch (e) {
    const htmlRows = (arr) => arr.map(i => `<tr>${rowOf(i).map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
    return printHTML(`Hakediş #${pad6(h.hakedis_no)}`, `<div class="pv-card"><h2>MURATOĞLU HAFRİYAT — HAKEDİŞ ${pad6(h.hakedis_no)}</h2><p>${names.customers[h.customer_id] || ''} · ${trDate(h.date_from)}–${trDate(h.date_to)}</p>${truck.length ? '<h4>Nakliye / Kamyon</h4><table border="1" cellspacing="0" cellpadding="4">' + htmlRows(truck) + '</table>' : ''}${machine.length ? '<h4>Makine / Saat-Yevmiye</h4><table border="1" cellspacing="0" cellpadding="4">' + htmlRows(machine) + '</table>' : ''}<p><b>Ara Toplam:</b> ${tl(h.subtotal)} · <b>KDV:</b> ${tl(h.kdv_total)} · <b>GENEL TOPLAM: ${tl(h.grand_total)}</b></p></div>`);
  }
}

// ============================================================
// 4) GÜNLÜK RAPOR PDF (§43)
// ============================================================
export async function dailyReportPdf(dateStr, data, names) {
  const file = `SAHAPRO_Gunluk_${dateStr}.pdf`;
  const sum = daySummary(dateStr, data);
  const works = (data.work_records || []).filter(w => w.date === dateStr && !w.deleted_at);
  const fuels = (data.fuel_records || []).filter(w => w.date === dateStr && !w.deleted_at);
  const expenses = (data.expense_records || []).filter(w => w.date === dateStr && !w.deleted_at);
  const cash = (data.cash_records || []).filter(w => w.date === dateStr && !w.deleted_at);
  try {
    const jsPDF = await ensurePdf();
    const doc = new jsPDF();
    let y = head(doc, 'GÜNLÜK OPERASYON RAPORU', trDate(dateStr));
    y = table(doc, ['Gösterge', 'Değer'], [
      ['İş Kaydı', fmtNum(sum.work_count)], ['Dijital Fiş', fmtNum(sum.slip_count)],
      ['Toplam Sefer', fmtNum(sum.total_sefer)], ['Makine Saati', fmtNum(sum.total_saat)], ['Yevmiye', fmtNum(sum.total_yevmiye)],
      ['Yakıt', fmtNum(sum.fuel_liters) + ' Lt'], ['Gider', tl(sum.expense_total)], ['Tahsilat', tl(sum.tahsilat_total)],
      ['Açık Arıza', fmtNum(sum.open_breakdowns)], ['Çalışan Personel', fmtNum(sum.personnel_active)]
    ], y);
    if (works.length) { y = sectionTitle(doc, 'İŞLER', y + 1); y = table(doc, ['Müşteri', 'Araç', 'İş', 'Miktar'], works.map(w => [names.customers[w.customer_id] || '', names.vehicles[w.vehicle_id] || '', w.work_type || '', `${fmtNum(w.quantity)} ${w.unit || ''}`]), y); }
    if (fuels.length) { y = sectionTitle(doc, 'YAKIT', y + 1); y = table(doc, ['Araç', 'Litre', 'Tutar', 'Kaynak'], fuels.map(f => [names.vehicles[f.vehicle_id] || '', fmtNum(f.liters), f.total_amount ? tl(f.total_amount) : '—', f.source_type || '']), y); }
    if (expenses.length) { y = sectionTitle(doc, 'GİDERLER', y + 1); y = table(doc, ['Kategori', 'Tutar', 'Açıklama'], expenses.map(x => [x.category || '', tl(x.amount), x.description || '']), y); }
    if (cash.length) { y = sectionTitle(doc, 'KASA / TAHSİLAT', y + 1); table(doc, ['Tür', 'Tutar', 'Personel', 'Durum'], cash.map(c => [c.cash_type || '', tl(c.amount), names.personnel[c.personnel_id] || '', c.cash_status || '']), y); }
    return await emit(doc, file, 'Günlük Rapor ' + trDate(dateStr));
  } catch (e) {
    return printHTML('Günlük Rapor ' + trDate(dateStr), `<div class="pv-card"><h2>GÜNLÜK OPERASYON RAPORU — ${trDate(dateStr)}</h2><table border="1" cellspacing="0" cellpadding="5"><tr><td>İş</td><td>${sum.work_count}</td></tr><tr><td>Sefer</td><td>${sum.total_sefer}</td></tr><tr><td>Saat</td><td>${sum.total_saat}</td></tr><tr><td>Yakıt</td><td>${sum.fuel_liters} Lt</td></tr><tr><td>Gider</td><td>${tl(sum.expense_total)}</td></tr><tr><td>Tahsilat</td><td>${tl(sum.tahsilat_total)}</td></tr></table></div>`);
  }
}

// ============================================================
// 5) GENEL TABLO RAPORU PDF (rapor merkezi)
// ============================================================
export async function tableReportPdf(title, headers, rows, total, filename) {
  const file = asciiFold(filename || 'SAHAPRO_Rapor.pdf');
  try {
    const jsPDF = await ensurePdf();
    const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait' });
    let y = head(doc, String(title).toLocaleUpperCase('tr-TR'), `${rows.length} satır`);
    y = table(doc, headers, rows.slice(0, 500).map(r => r.map(c => String(c ?? ''))), y);
    if (total) { doc.setFont('DejaVuSans', 'bold'); doc.setFontSize(10); doc.setTextColor(13, 26, 43); doc.text(String(total), doc.internal.pageSize.getWidth() - 14, y + 2, { align: 'right' }); }
    return await emit(doc, file, title);
  } catch (e) {
    return printHTML(title, `<div class="pv-card"><h3>${title}</h3><table border="1" cellspacing="0" cellpadding="4"><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>${total ? `<p><b>${total}</b></p>` : ''}</div>`);
  }
}

// ============================================================
// 6) DEPO YAKIT RAPORU PDF (§21)
// ============================================================
export async function tankPdf(rows, bal, names) {
  const file = `SAHAPRO_Depo_Yakit_${new Date().toISOString().slice(0, 10)}.pdf`;
  try {
    const jsPDF = await ensurePdf();
    const doc = new jsPDF();
    let y = head(doc, 'DEPO YAKIT RAPORU', 'Tanka giriş / tanktan çıkış hareketleri');
    y = totalsBox(doc, [['Toplam Giriş', fmtNum(bal.in) + ' Lt'], ['Toplam Çıkış', fmtNum(bal.out) + ' Lt'], ['TAHMİNİ KALAN', fmtNum(bal.remaining) + ' Lt']], y);
    y = table(doc, ['Tarih', 'İşlem', 'Litre', 'Araç', 'Personel', 'Sayaç', 'İmza / Teslim'], rows.map(m => [trDate(m.date), m.move_type || '', fmtNum(m.liters), names.vehicles[m.vehicle_id] || '—', names.personnel[m.personnel_id] || '—', m.pump_no || '', m.signature_name || '']), y);
    doc.setFont('DejaVuSans', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 128, 140);
    doc.text('Not: Tahmini stoktur; resmi finansal stok muhasebesi değildir.', 14, y + 1);
    return await emit(doc, file, 'Depo Yakıt Raporu');
  } catch (e) {
    return printHTML('Depo Yakıt Raporu', `<div class="pv-card"><h2>DEPO YAKIT RAPORU</h2><p><b>Giriş:</b> ${fmtNum(bal.in)} Lt · <b>Çıkış:</b> ${fmtNum(bal.out)} Lt · <b>Kalan:</b> ${fmtNum(bal.remaining)} Lt</p><table border="1" cellspacing="0" cellpadding="4"><tr><th>Tarih</th><th>İşlem</th><th>Litre</th><th>Araç</th><th>Personel</th></tr>${rows.map(m => `<tr><td>${trDate(m.date)}</td><td>${m.move_type || ''}</td><td>${fmtNum(m.liters)}</td><td>${names.vehicles[m.vehicle_id] || '—'}</td><td>${names.personnel[m.personnel_id] || '—'}</td></tr>`).join('')}</table><p><i>Tahmini stoktur; resmi finansal stok kaydı değildir.</i></p></div>`);
  }
}

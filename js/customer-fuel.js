// Müşterinin kendi makinesine verilen mazot. Saf önizleme; stok/cari yazmaz.
import { isActive, todayStr } from './core.js';
import { customerSpans, parseTrNumber } from './money-roles.js';
import { dateWords } from './command-router.js';
import { validDate } from './driver-delivery.js';

const fold = s => String(s || '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
const number = '(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)';
const positive = v => ['number','string'].includes(typeof v) && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= 1e9;
const money = n => Math.round(n * 100) / 100;

// Dar, belirgin tek teslimat yolu internetsiz de çalışır. Çoklu/karışık mesajı modele bırakır.
export function customerFuelDraft(message, d, today = todayStr()) {
  const text = String(message || '').trim(), f = fold(text);
  if (text.length > 500 || /[\n;]|\b(?:calisti|sefer|tahsilat|odeme|ode[dn]|aldi[mk]|aldik|geldi)\b/.test(f)) return null;
  if (/bizim\s+(?:forklift|makine)/.test(f)) return null;
  if (!/forklift(?:ine|e|i|in)?\b/.test(f) || !/mazot|motorin/.test(f) || !/\b(?:verildi|verilmisti|verdim|verdik)\b/.test(f)) return null;
  if (/verilmedi|vermedik|vermedim|verilmesin|degil|borc(?:a)?\s+yazma|borclandirma|\?|\b(?:mi|mu|nasil|kac|iptal|sil|ornek|yerine|iade|nakit|havale|ucretsiz|hediye|bedelsiz|emanet|takas|mahsup|odendi|veya|yaklasik|tahminen|geri|sonra|ama|fakat|ancak)\b|\bya da\b/.test(f)) return null;
  const liters = [...f.matchAll(new RegExp(number + '\\s*(?:litre|lt|l)(?:n)?(?=\\s|mazot|motorin|$|[.,])', 'g'))];
  if (liters.length !== 1) return null;
  if (/[\d\-+/:.,]\s*$/.test(f.slice(0,liters[0].index))) return null;
  const spans = customerSpans(text, (d.customers || []).filter(isActive), (d.aliases || []).filter(isActive));
  const strongest = spans.filter(s => !spans.some(t => t.start <= s.start && t.end >= s.end && t.key.length > s.key.length));
  const ids = [...new Set(strongest.map(s => s.id))];
  if ([...f.matchAll(/\b(?:litresi|litre(?:\s+birim)?\s+fiyati|birim\s+fiyat(?:i)?)\s*[:=]?\s*\d/g)].length > 1) return null;
  const price = f.match(new RegExp('(?:litresi|litre(?:\\s+birim)?\\s+fiyati|birim\\s+fiyat(?:i)?)\\s*[:=]?\\s*' + number + '\\s*(?:tl|₺|lira)'))
    || f.match(new RegExp(number + '\\s*(?:tl|₺|lira)\\s*/\\s*(?:litre|lt|l)\\b'));
  const total = f.match(new RegExp('(?:toplam|bedel(?:i)?|tutar(?:i)?)\\s*[:=]?\\s*' + number + '\\s*(?:tl|₺|lira)'));
  // Ondalıklı litre/fiyatı 20.5 gibi gün/ay sanma.
  const dateText = text.replace(new RegExp(number + '\\s*(?:tl|₺|lira|litre|lt|l)(?![a-zçğıöşü])','gi'),' ');
  const range = dateWords(dateText, today), date = range ? range[0] === range[1] ? range[0] : null : /verilmisti|eskiden|gecmis/.test(f) ? null : today;
  return { customer_id: ids.length === 1 ? ids[0] : null, machine: 'Forklift', liters: parseTrNumber(liters[0][1]),
    unit_price: price ? parseTrNumber(price[1]) : null, total: total ? parseTrNumber(total[1]) : null, date,
    source: /istasyon|petrol|shell|opet|musteri(?:den)?\s+(?:aldi|verdi)/.test(f) ? 'Belirsiz' : 'Depo Tankı', quote: text, local: true };
}

export function customerFuelRows(plan, { message, d, today = todayStr() }) {
  const local = customerFuelDraft(message, d, today);
  const rows = local ? [local] : (Array.isArray(plan.customer_fuel) ? plan.customer_fuel.slice(0, 10) : []);
  return rows.map(raw => {
    const issues = [], quote = String(raw.quote || '');
    const details=Array.isArray(raw.details_quotes)?raw.details_quotes:typeof raw.details_quote==='string'&&raw.details_quote.trim()?[raw.details_quote.trim()]:[];
    const text=String(message),quoteAt=text.indexOf(quote);let after=quoteAt+quote.length;
    // Every continuation is an exact later user quote, in order. A model number is never evidence.
    const hasDetails=details.length>0&&details.length<=6&&quoteAt>=0&&details.every(part=>{if(typeof part!=='string'||!part.trim()||part.length>600)return false;const at=text.indexOf(part,after);if(at<after)return false;after=at+part.length;return true;});
    const source = raw.local ? raw : details.length&&!hasDetails ? null : customerFuelDraft(hasDetails?[quote,...details].join(', '):quote, d, today);
    // Model çıktısı tek başına işlem kanıtı değildir: yön ve miktar kendi alıntısında doğrulanır.
    const evidence = source && quote && text.includes(quote);
    const customer_id = evidence && (d.customers || []).some(c => isActive(c) && c.id === source.customer_id) ? source.customer_id : null;
    const liters = evidence && positive(source.liters) ? source.liters : null;
    let unit_price = evidence && positive(source.unit_price) ? source.unit_price : null;
    const quotedTotal = evidence && positive(source.total) ? money(source.total) : null;
    if (!unit_price && quotedTotal && liters) unit_price = quotedTotal / liters;
    const total = positive(unit_price) && liters ? money(liters * unit_price) : null;
    const date = evidence && validDate(source.date) && source.date <= today ? source.date : '';
    const blocked = !evidence || source.source !== 'Depo Tankı';
    if (!customer_id) issues.push('Mazotu alan müşteriyi seçin; benzer adlarda tahmin yapılmadı');
    if (!liters) issues.push('Verilen litre mesajda açıkça bulunamadı');
    if (!date) issues.push('Teslim tarihini kontrol edip girin');
    if (!unit_price) issues.push('Müşteriye yazılacak litre fiyatı veya toplam bedel mesajda yok; tutarı girin');
    if (quotedTotal && total != null && Math.abs(quotedTotal - total) > 0.01) issues.push('Litre fiyatı ile toplam bedel uyuşmuyor; fiyatı kontrol edin');
    if (blocked) issues.push('Bu yol yalnız kendi depomuzdan müşterinin forkliftine teslim içindir; kaynağı ve teslim yönünü mesajda netleştirin');
    return { customer_id, machine: 'Forklift', date, liters, unit_price, total, quote, blocked, issues, ok: !issues.length };
  });
}

export function customerFuelFields(fields, today = todayStr()) {
  if (!validDate(fields.date) || fields.date > today) throw Error('Geçerli teslim tarihi girin (gelecek tarih olamaz)');
  if (typeof fields.customer_id !== 'string' || !fields.customer_id) throw Error('Mazotu alan müşteri zorunlu');
  if (typeof fields.machine !== 'string' || !fields.machine.trim() || fields.machine.trim().length > 120) throw Error('Müşterinin makinesini belirtin');
  if (!positive(fields.liters) || !positive(fields.unit_price)) throw Error('Pozitif litre ve müşteriye yazılacak litre fiyatı zorunlu');
  const liters = Number(fields.liters), unit_price = Number(fields.unit_price), total = money(liters * unit_price);
  if (!positive(total) || !Number.isSafeInteger(Math.round(total * 100))) throw Error('Mazot bedeli geçersiz');
  return { date: fields.date, customer_id: fields.customer_id, machine: fields.machine.trim(), liters, unit_price, total,
    note: String(fields.note || '').slice(0, 1000) };
}

// Yedekten içe aktarmada da stok çıkışı ve cari borcu ayrı ayrı kabul edilmez.
export function validateCustomerFuelLinks(d) {
  const moves = new Map((d.fuel_tank_movements || []).map(x => [x.id, x]));
  const cari = new Map((d.cari_movements || []).map(x => [x.id, x]));
  const customers = Array.isArray(d.customers) ? new Set(d.customers.map(c => c.id)) : null;
  for (const m of moves.values()) if (m.delivery_kind === 'customer_fuel') {
    const c = cari.get(m.cari_movement_id);
    if (!positive(m.liters) || !positive(m.charge_unit_price) || !positive(m.charge_total) || money(m.liters*m.charge_unit_price) !== m.charge_total || !m.recipient_customer_id || !m.event_id) throw Error('Müşteri mazot tesliminin miktarı/bedeli geçersiz');
    if (customers && !customers.has(m.recipient_customer_id)) throw Error('Müşteri mazot tesliminin alıcısı bulunamadı');
    if (!c || c.type !== 'MazotTeslimi' || c.ref_id !== m.id || c.customer_id !== m.recipient_customer_id || c.event_id !== m.event_id ||
        c.amount !== m.charge_total || c.date !== m.date || !!c.deleted_at !== !!m.deleted_at || m.move_type !== 'ÇIKIŞ') throw Error('Kopuk müşteri mazot teslimi / cari bağlantısı');
  }
  for (const c of cari.values()) if (c.type === 'MazotTeslimi' && (moves.get(c.ref_id)?.delivery_kind !== 'customer_fuel' || moves.get(c.ref_id)?.cari_movement_id !== c.id)) throw Error('Sahipsiz müşteri mazot borcu');
}

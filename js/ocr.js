// ============================================================
// SAHAPRO SOLO — OCR / akıllı belge tarama (ADDENDUM)
// Cihaz içi OCR: tesseract.js (CDN'den lazy; SW ilk kullanımda cache'ler → sonra offline).
// OCR sonucu ASLA otomatik kesin veri olmaz: BELGE → OCR → ALAN ÖNERİSİ → KULLANICI ONAYI.
// Harici ücretli OCR/AI API kullanılmaz; görüntü cihazdan çıkmaz.
// ============================================================

const CDN_TESSERACT =
  "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const LANG_PATH =
  "https://cdn.jsdelivr.net/npm/@tesseract.js-data/tur@1.0.0/4.0.0_best_int";

export function ocrLikelyAvailable() {
  return navigator.onLine || !!window.Tesseract;
}

let tessOnce = null;
function loadTesseract() {
  if (!tessOnce)
    tessOnce = new Promise((res, rej) => {
      if (window.Tesseract) return res(window.Tesseract);
      const s = document.createElement("script");
      s.src = CDN_TESSERACT;
      s.async = true;
      s.onload = () =>
        window.Tesseract
          ? res(window.Tesseract)
          : rej(new Error("Tesseract yok"));
      s.onerror = () => {
        tessOnce = null;
        rej(new Error("OCR kütüphanesi yüklenemedi (çevrimdışı olabilir)"));
      };
      document.head.appendChild(s);
    });
  return tessOnce;
}

// Tek dilli 'tur' modeli — jsdelivr üzerinden (SW cache-first ile offline'a taşınır)
export async function runOcr(image, onProgress) {
  const T = await loadTesseract();
  const opts = {
    logger: (m) => {
      if (onProgress && m && m.status) onProgress(m.status, m.progress || 0);
    },
  };
  let out;
  try {
    out = await T.recognize(image, "tur", {
      ...opts,
      langPath: LANG_PATH,
      gzip: true,
      cacheMethod: "none",
    });
  } catch (e) {
    out = await T.recognize(image, "tur", opts);
  } // varsayılan langPath'e düş
  const data = out && out.data ? out.data : {};
  return {
    text: String(data.text || ""),
    confidence: Number(data.confidence) || 0,
  };
}

// ---- Görüntü ön-işleme: gri ton, kontrast, isteğe bağlı S/B eşiği, döndürme ----
export async function preprocessImage(blob, opts = {}) {
  const bmp = await createImageBitmap(blob).catch(() => null);
  if (!bmp) throw new Error("Görüntü okunamadı");
  const rot = Number(opts.rotate) || 0;
  const swap = rot === 90 || rot === 270;
  const maxW = 1800;
  const scale = Math.min(1, maxW / Math.max(bmp.width, bmp.height));
  const cw = Math.max(1, Math.round((swap ? bmp.height : bmp.width) * scale));
  const ch = Math.max(1, Math.round((swap ? bmp.width : bmp.height) * scale));
  const cv = document.createElement("canvas");
  cv.width = cw;
  cv.height = ch;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.save();
  cx.translate(cw / 2, ch / 2);
  cx.rotate((rot * Math.PI) / 180);
  cx.drawImage(
    bmp,
    -Math.round(bmp.width * scale) / 2,
    -Math.round(bmp.height * scale) / 2,
    Math.round(bmp.width * scale),
    Math.round(bmp.height * scale),
  );
  cx.restore();
  const img = cx.getImageData(0, 0, cw, ch);
  const d = img.data;
  const contrast = opts.contrast == null ? 1.25 : Number(opts.contrast);
  for (let i = 0; i < d.length; i += 4) {
    let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    g = (g - 128) * contrast + 128;
    if (opts.bw) g = g >= 165 ? 255 : 0;
    g = g < 0 ? 0 : g > 255 ? 255 : g;
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  cx.putImageData(img, 0, 0);
  const outBlob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.92));
  return { canvas: cv, blob: outBlob };
}

// ---- Türkçe sayı/tarih ayrıştırma yardımcıları ----
export function parseTrNum(s) {
  if (s == null) return null;
  let t = String(s)
    .trim()
    .replace(/[^\d.,-]/g, "");
  if (!t) return null;
  if (t.includes(",") && t.includes("."))
    t = t.replace(/\./g, "").replace(",", "."); // 1.234,56
  else if (t.includes(",")) t = t.replace(",", "."); // 63,50
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
function findDate(text) {
  const m = String(text).match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const m2 = String(text).match(/\b(\d{2})[./](\d{2})[./](\d{2})\b/);
  if (m2) return `20${m2[3]}-${m2[2]}-${m2[1]}`;
  return null;
}
function findAllDates(text) {
  const out = [];
  const re = /\b(\d{2})[./-](\d{2})[./-](\d{4})\b/g;
  let m;
  while ((m = re.exec(String(text)))) out.push(`${m[3]}-${m[2]}-${m[1]}`);
  return out;
}
function findPlate(text) {
  const m = String(text)
    .toUpperCase()
    .replace(/[ÖO]/g, "O")
    .match(/\b(0[1-9]|[1-7]\d|8[01])\s?[A-Z]{1,3}\s?\d{2,5}\b/);
  return m ? m[0].replace(/\s+/g, "") : null;
}
function moneyNear(text, keys) {
  const lines = String(text).split(/\n/);
  for (const key of keys) {
    for (const ln of lines) {
      if (!ln.toLocaleUpperCase("tr-TR").includes(key)) continue;
      const nums = ln.match(
        /\d{1,3}(?:[.\s]?\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2}/g,
      );
      if (nums && nums.length) return parseTrNum(nums[nums.length - 1]);
    }
  }
  return null;
}
function textNear(text, keys) {
  const lines = String(text).split(/\n/);
  for (const key of keys)
    for (const ln of lines) {
      const u = ln.toLocaleUpperCase("tr-TR");
      if (u.includes(key)) {
        const v = ln
          .replace(/[^0-9A-Za-zÇĞİÖŞÜçğıöşü ./-]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (v) return v;
      }
    }
  return null;
}

// ---- Belge türüne göre alan önerileri (§4–§8) ----
// Dönüş: { fields, missing, conf } — fields yalnız ÖNERİDİR; kullanıcı onayı olmadan kayda yazılmaz.
export function extractFields(docType, text, ocrConf) {
  const t = String(text || "");
  const U = t.toLocaleUpperCase("tr-TR");
  const f = {};
  const missing = [];
  const conf = ocrConf >= 85 ? "Yüksek" : ocrConf >= 60 ? "Orta" : "Düşük";

  const date = findDate(t);
  if (date) f.date = date;
  const plate = findPlate(t);
  if (plate) f.plate = plate;
  const total = moneyNear(t, [
    "GENEL TOPLAM",
    "TOPLAM TUTAR",
    "TOPLAM",
    "TUTAR",
    "ODENECEK",
  ]);
  if (total != null) f.total = total;

  if (docType === "Akaryakıt Fişi") {
    const lm = t.match(
      /(\d{1,3}(?:[.,]\d{1,3})?)\s*(?:LT|LİTRE|LITER|LT\.|L\b)/i,
    );
    if (lm) f.liters = parseTrNum(lm[1]);
    const up = moneyNear(t, [
      "LT FİYAT",
      "LTFIYAT",
      "BİRİM FİYAT",
      "FIYAT",
      "FİYAT",
    ]);
    if (up != null) f.unit_price = up;
    const kdv = moneyNear(t, ["KDV"]);
    if (kdv != null) f.kdv = kdv;
    const no = textNear(t, ["FİŞ NO", "FIS NO", "FİŞNO", "NO:"]);
    if (no) f.doc_no = no;
    const firmLines = t
      .split(/\n/)
      .map((x) => x.trim())
      .filter((x) => x.length > 3);
    if (firmLines.length) f.firma = firmLines[0].slice(0, 60);
    if (/MOTOR[İI]N|D[İI]ZEL|DIESEL/i.test(U)) f.fuel_type = "Motorin";
    else if (/BENZ[İI]N/i.test(U)) f.fuel_type = "Benzin";
    else if (/LPG/i.test(U)) f.fuel_type = "LPG";
    for (const k of ["date", "liters", "total"])
      if (f[k] == null) missing.push(k);
  } else if (
    ["Fatura", "Gider Fişi", "Servis Belgesi", "Makbuz", "İrsaliye"].includes(
      docType,
    )
  ) {
    const vkn = t.match(/\b(\d{10,11})\b/);
    if (vkn) f.tax_no = vkn[1];
    const no = textNear(t, [
      "FATURA NO",
      "BELGE NO",
      "FİŞ NO",
      "FIS NO",
      "SERİ NO",
      "NO:",
    ]);
    if (no) f.doc_no = no;
    const sub = moneyNear(t, ["ARA TOPLAM", "MAL HİZMET", "MAL/HİZMET"]);
    if (sub != null) f.subtotal = sub;
    const kdv = moneyNear(t, ["KDV", "VERGİ"]);
    if (kdv != null) f.kdv = kdv;
    const firmLines = t
      .split(/\n/)
      .map((x) => x.trim())
      .filter((x) => x.length > 3);
    if (firmLines.length) f.firma = firmLines[0].slice(0, 60);
    // Kategori önerisi (kullanıcı onaylar)
    if (/LAST[İI]K/i.test(U)) f.category_suggestion = "Lastik";
    else if (/YAĞ|F[İI]LTRE/i.test(U)) f.category_suggestion = "Yağ / Filtre";
    else if (/YEDEK PARÇA/i.test(U)) f.category_suggestion = "Yedek Parça";
    else if (/HGS|OTOYOL|GEÇ[İI]Ş/i.test(U))
      f.category_suggestion = "Otoyol / HGS";
    else if (/OTOPARK|PARK/i.test(U)) f.category_suggestion = "Otopark";
    else if (/YEMEK|RESTORAN|LOKANTA/i.test(U)) f.category_suggestion = "Yemek";
    else if (/SERV[İI]S|TAM[İI]R/i.test(U)) f.category_suggestion = "Servis";
    for (const k of ["date", "total"]) if (f[k] == null) missing.push(k);
  } else if (docType === "Döküm Fişi") {
    const no = textNear(t, ["FİŞ NO", "FIS NO", "BELGE NO", "NO:"]);
    if (no) f.doc_no = no;
    const brut = moneyNear(t, ["BRÜT", "BRUT"]);
    if (brut != null) f.gross = brut;
    const dara = moneyNear(t, ["DARA"]);
    if (dara != null) f.tare = dara;
    const net = moneyNear(t, ["NET"]);
    if (net != null) f.net = net;
    const mat = textNear(t, ["MALZEME", "MICIR", "KUM", "GRAVAK", "HAFRİYAT"]);
    if (mat) f.material = mat;
    for (const k of ["date"]) if (f[k] == null) missing.push(k);
  } else if (
    ["Ruhsat", "Sigorta / Poliçe", "Muayene Belgesi"].includes(docType)
  ) {
    const dates = findAllDates(t);
    if (dates.length >= 2) {
      f.date_start = dates[0];
      f.date_end = dates[dates.length - 1];
    } else if (dates.length === 1) f.date_start = dates[0];
    const no = textNear(t, [
      "BELGE NO",
      "POLİÇE NO",
      "POLICE NO",
      "SERİ NO",
      "NO:",
    ]);
    if (no) f.doc_no = no;
    if (!f.plate) missing.push("plate");
  }
  return { fields: f, missing, conf };
}

// Hangi belge türü hangi kayda öneri üretir
export function suggestionFor(docType, fields) {
  if (docType === "Akaryakıt Fişi")
    return { kind: "fuel", label: "⛽ Yakıt Kaydı Oluştur" };
  if (
    ["Fatura", "Gider Fişi", "Servis Belgesi", "Makbuz", "İrsaliye"].includes(
      docType,
    )
  )
    return { kind: "expense", label: "💸 Gider Kaydı Oluştur" };
  if (docType === "Döküm Fişi")
    return { kind: "work_match", label: "🔗 İş Kaydı ile Eşleştir" };
  if (["Ruhsat", "Sigorta / Poliçe", "Muayene Belgesi"].includes(docType))
    return { kind: "vehicle_doc", label: "🚜 Araç Belge Takibine Bağla" };
  return null;
}

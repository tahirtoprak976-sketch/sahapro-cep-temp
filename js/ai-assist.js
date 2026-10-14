// Yapay zeka yardımcısı — SAF katman (tarayıcı/model bağımsız, testlenebilir).
// Kural motoru önce çalışır. Yapay zeka yalnız motorun anlayamadığı ifadeler için
// miktar / birim / iş türü ÖNERİR. Hiçbir şey kaydetmez. Her öneri burada doğrulanır:
// - miktar mesajda yazan bir sayı olmalı (plaka, tarih, saat rakamları sayılmaz)
// - birim ve iş türü sabit listeden olmalı
// - müşteri / araç / şantiye yapay zekadan ALINMAZ; kartlar kural motorundan gelir.
import { analyzeMessage, tokenize } from "./message-engine.js";
import { WORK_TYPES } from "./core.js";

export const AI_UNITS = ["Sefer", "Saat", "Yevmiye", "Ton", "m³", "Adet"];
const WORDS = {
  bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10,
  yirmi: 20, otuz: 30, kırk: 40, elli: 50,
  yarım: 0.5, yarim: 0.5,
};
const TENS = new Set([10, 20, 30, 40, 50]);

// Mesajda gerçekten yazan miktar adayları (plaka/tarih/saat/makine kodu rakamları hariç)
export function writtenNumbers(text) {
  const out = new Set();
  const toks = tokenize(String(text || ""));
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.type === "number") {
      const n = Number(t.raw.replace(/(?:si|sı|su|sü)$/i, "").replace(",", "."));
      if (Number.isFinite(n)) out.add(n);
    } else if (t.type === "word") {
      const w = t.norm;
      if (Object.hasOwn(WORDS, w)) {
        const next = toks[i + 1];
        if (next && next.type === "word" && /^buçuk$|^bucuk$/.test(next.norm)) out.add(WORDS[w] + 0.5);
        else out.add(WORDS[w]);
        // "on iki" = 12, "yirmi beş" = 25
        if (TENS.has(WORDS[w]) && next && next.type === "word" && Object.hasOwn(WORDS, next.norm) && WORDS[next.norm] < 10 && WORDS[next.norm] >= 1)
          out.add(WORDS[w] + WORDS[next.norm]);
      }
    }
  }
  // "3 buçuk"
  for (let i = 0; i + 1 < toks.length; i++)
    if (toks[i].type === "number" && /^buçuk$|^bucuk$/.test(toks[i + 1].norm || ""))
      out.add(Number(toks[i].raw.replace(",", ".")) + 0.5);
  return out;
}

export function aiMessages(text) {
  const system =
    "You read short Turkish WhatsApp messages from an excavation / truck haulage company " +
    "and extract work quantities. Reply with ONLY a JSON object, no other text: " +
    '{"rows":[{"quantity":number|null,"unit":"Sefer"|"Saat"|"Yevmiye"|"Ton"|"m³"|"Adet"|null,"work_type":string|null}]}. ' +
    "sefer/gidiş/tur = Sefer (trips), saat = Saat (hours), yevmiye/gün = Yevmiye (day), ton = Ton. " +
    "Use ONLY numbers that are literally written in the message as quantity. Never use license plate digits " +
    "(like 34 ABC 123), dates or clock times as quantity. If you are not sure, use null. " +
    "work_type must be one of: " + WORK_TYPES.join(", ") + ".";
  return [
    { role: "system", content: system },
    { role: "user", content: "Mesaj: 34 ABC 123 Ahmet Bey'e 6 gidiş yaptı moloz" },
    { role: "assistant", content: '{"rows":[{"quantity":6,"unit":"Sefer","work_type":"Moloz Nakliye"}]}' },
    { role: "user", content: "Mesaj: kepçe bütün gün Leda'da çalıştı" },
    { role: "assistant", content: '{"rows":[{"quantity":null,"unit":"Yevmiye","work_type":"Makine Çalışması"}]}' },
    { role: "user", content: "Mesaj: " + String(text || "").slice(0, 600) },
  ];
}

export function parseAiJson(s) {
  s = String(s || "").replace(/```(?:json)?/gi, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    const o = JSON.parse(s.slice(a, b + 1));
    return o && Array.isArray(o.rows) ? o : Array.isArray(o) ? { rows: o } : o && "quantity" in o ? { rows: [o] } : null;
  } catch {
    return null;
  }
}

// Model çıktısını doğrular; geçmeyen alanı atar ve nedenini yazar
export function validateAi(text, obj) {
  const nums = writtenNumbers(text);
  const rows = [];
  for (const r of (obj && obj.rows) || []) {
    const out = { quantity: null, unit: null, work_type: null, rejected: [] };
    const q = r && r.quantity != null ? Number(String(r.quantity).replace(",", ".")) : null;
    if (q != null) {
      if (!Number.isFinite(q) || q <= 0 || q >= 1000) out.rejected.push(`miktar ${r.quantity} geçersiz`);
      else if (![...nums].some((n) => Math.abs(n - q) < 1e-9))
        out.rejected.push(`miktar ${q} mesajda yazmıyor (uydurma olabilir)`);
      else out.quantity = q;
    }
    if (r && r.unit != null) {
      const u = AI_UNITS.find((x) => x.toLocaleLowerCase("tr-TR") === String(r.unit).toLocaleLowerCase("tr-TR"));
      if (u) out.unit = u;
      else out.rejected.push(`birim "${r.unit}" listede yok`);
    }
    if (r && r.work_type != null) {
      if (WORK_TYPES.includes(r.work_type)) out.work_type = r.work_type;
      else out.rejected.push(`iş türü "${r.work_type}" listede yok`);
    }
    if (out.quantity != null || out.unit || out.work_type || out.rejected.length) rows.push(out);
  }
  return rows.slice(0, 5);
}

// Kural motorunun anlayamadığı yerler: tanınmayan/devam ifadeleri ve miktarı boş iş satırları
export function aiTargets(analysis) {
  const out = [];
  for (const n of analysis.notices || [])
    if (["unknown", "continuation"].includes(n.type))
      out.push({ kind: "segment", text: analysis.raw.slice(n.span.start, n.span.end) });
  (analysis.rows || []).forEach((r, i) => {
    if (r.kind === "work" && r.quantity == null) out.push({ kind: "row", row: i, text: r.description || "" });
  });
  return out;
}

// generate(messages) → Promise<string>; tarayıcıda WebLLM, testte sahte model
export async function aiSuggest(message, d, generate, opts = {}) {
  const analysis = analyzeMessage(message, d);
  const targets = aiTargets(analysis);
  const suggestions = [];
  for (const t of targets.slice(0, opts.max || 4)) {
    const started = Date.now();
    let rawOut = "", parsed = null, error = null;
    try {
      rawOut = await generate(aiMessages(t.text));
      parsed = parseAiJson(rawOut);
      if (!parsed) error = "Model geçerli JSON döndürmedi";
    } catch (e) {
      error = e.message || String(e);
    }
    suggestions.push({
      ...t,
      ms: Date.now() - started,
      raw: rawOut,
      error,
      rows: parsed ? validateAi(t.text, parsed) : [],
    });
  }
  return { analysis, suggestions };
}

// Gemini (Google) bağlantısı. Anahtar yalnız bu telefonda (IndexedDB meta) saklanır ve doğrudan
// Google'a gönderilir; araya başka sunucu girmez. Kullanıcı açıkça onay vermeden çağrı yapılmaz.
// Çıktılar ai-assist.js içinde doğrulanır; burada kayıt yazılmaz.
import { parseAiJson, receiptPrompt, validateReceipt } from "./ai-assist.js";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function geminiSettings(db) {
  const [key, model, consent] = await Promise.all([
    db.metaGet("gemini_key"),
    db.metaGet("gemini_model"),
    db.metaGet("gemini_consent"),
  ]);
  return { key: key || "", model: model || "", consent: !!consent, ready: !!(key && model && consent) };
}

async function call(path, key, body, fetchFn = fetch) {
  const res = await fetchFn(BASE + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const msg = data?.error?.message || "HTTP " + res.status;
    if (res.status === 429) {
      // "limit: 0" = bu model ücretsiz katmanda hiç açık değil (kota dolmadı, hiç yok)
      if (/limit:\s*0\b/.test(msg)) {
        const e = new Error("Bu model ücretsiz kullanımda kapalı (kota 0). Yapay Zeka ekranında \"Çalışan Modeli Bul\" ile başka model seçin.");
        e.code = "NO_FREE";
        throw e;
      }
      const wait = msg.match(/retry in\s*([\dhms.]+)/i)?.[1]?.replace(/\.\d+s$/, "s");
      const e = new Error("Gemini kotası doldu" + (wait ? `, yaklaşık ${wait} sonra` : ", biraz sonra") + " tekrar deneyin.");
      e.code = "RATE";
      throw e;
    }
    // Model kapatılmış / yeni anahtarlara verilmiyor / bu istekte desteklenmiyor → başka modele geçilebilir
    if (res.status === 404 || ((res.status === 400 || res.status === 403) && /not found|no longer (?:available|supported)|not supported|is not available|deprecated|unsupported model/i.test(msg))) {
      const e = new Error("Bu model artık kullanılamıyor: " + msg);
      e.code = "MODEL_GONE";
      throw e;
    }
    if (res.status === 500 || res.status === 503 || res.status === 504) {
      const e = new Error("Gemini şu an yoğun, tekrar deneyin (" + res.status + ")");
      e.code = "BUSY";
      throw e;
    }
    if (res.status === 400 || res.status === 403) throw new Error("Gemini anahtarı veya izin sorunu: " + msg);
    throw new Error("Gemini hatası: " + msg);
  }
  return data;
}

// Metin + görsel üretebilen modeller; "flash" olanlar öne (hızlı ve ucuz)
export async function listModels(key, fetchFn) {
  const data = await call("/models?pageSize=200", key, null, fetchFn);
  return (data.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent") && /gemini/i.test(m.name) && !/embedding|tts|image-generation|live|audio/i.test(m.name))
    .map((m) => ({ id: m.name.replace(/^models\//, ""), label: m.displayName || m.name }))
    .sort((a, b) => rank(a.id) - rank(b.id) || b.id.localeCompare(a.id));
}
// Kararlı "flash" modeller önce; önizleme/deneysel/omni sona (genelde ücretsiz kotaları yok)
function rank(id) {
  let r = /flash-lite/.test(id) ? 0 : /flash/.test(id) ? 1 : /pro/.test(id) ? 20 : 5;
  if (/preview|exp|omni|thinking|latest|live|tts|image|audio/.test(id)) r += 10;
  return r;
}

// ---- Ücretsiz kullanım: otomatik model değiştirme + günlük sayaç ----
// Seçili model "kota 0 / kapatıldı / yoğun / kota doldu" hatası verirse listedeki sıradaki ücretsiz
// modele kendiliğinden geçer; çalışanı kaydeder. Faturalandırma hiçbir zaman açılmaz.
const SWITCHABLE = new Set(["NO_FREE", "MODEL_GONE", "BUSY", "RATE"]);
export async function withModelFallback(db, run, { fetchFn, onSwitch } = {}) {
  const g = await geminiSettings(db);
  if (!g.ready) throw new Error("Gemini ayarları eksik (Ayarlar → Yapay Zeka)");
  const tried = new Set();
  let model = g.model, lastErr = null;
  let pool = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    tried.add(model);
    try {
      const out = await run({ key: g.key, model, fetchFn });
      await countUse(db, model);
      if (model !== g.model) {
        await db.metaSet("gemini_model", model);
        onSwitch?.(g.model, model);
      }
      return out;
    } catch (e) {
      lastErr = e;
      if (!SWITCHABLE.has(e.code)) throw e;
      if (!pool) {
        const cached = (await db.metaGet("gemini_model_list")) || [];
        pool = cached.length ? cached : (await listModels(g.key, fetchFn).catch(() => [])).map((m) => m.id);
        if (!cached.length && pool.length) await db.metaSet("gemini_model_list", pool);
      }
      const next = pool.find((id) => !tried.has(id));
      if (!next) break;
      model = next;
    }
  }
  throw lastErr || new Error("Çalışan ücretsiz model bulunamadı");
}
async function countUse(db, model) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const u = (await db.metaGet("gemini_usage")) || {};
    const day = u.date === today ? u : { date: today, counts: {} };
    day.counts[model] = (day.counts[model] || 0) + 1;
    await db.metaSet("gemini_usage", day);
  } catch {}
}
export async function usageToday(db) {
  const u = (await db.metaGet("gemini_usage")) || {};
  const today = new Date().toISOString().slice(0, 10);
  return u.date === today ? u.counts || {} : {};
}
// Anahtarla gerçekten çalışan ilk modeli bulur (her deneme tek, çok kısa istek)
export async function findWorkingModel(key, models, fetchFn) {
  const tried = [];
  for (const m of models.slice(0, 8)) {
    try {
      await call(`/models/${encodeURIComponent(m.id)}:generateContent`, key, {
        contents: [{ role: "user", parts: [{ text: "Reply with {}" }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8 },
      }, fetchFn);
      tried.push({ id: m.id, ok: true });
      return { id: m.id, tried };
    } catch (e) {
      tried.push({ id: m.id, ok: false, reason: e.code === "NO_FREE" ? "ücretsiz kota yok" : e.code === "RATE" ? "kota dolu" : e.message });
      if (!["NO_FREE", "RATE"].includes(e.code) && /anahtar/i.test(e.message)) break;
    }
  }
  return { id: null, tried };
}

function text(data) {
  return (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
}

// Sohbet biçimindeki mesajları (system/user/assistant) Gemini biçimine çevirir
export async function geminiChat(messages, { key, model, fetchFn } = {}) {
  const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const data = await call(`/models/${encodeURIComponent(model)}:generateContent`, key, {
    systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
    contents,
    generationConfig: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: 4096 },
  }, fetchFn);
  return text(data);
}

export async function blobToBase64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

// Büyük fotoğrafı küçültür (hem hız hem kota için); tarayıcı yoksa olduğu gibi döner
async function shrink(blob, max = 1600) {
  try {
    if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") return blob;
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k >= 1 && blob.size < 1.5e6) return blob;
    const c = new OffscreenCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return await c.convertToBlob({ type: "image/jpeg", quality: 0.85 });
  } catch {
    return blob;
  }
}

export async function geminiReadReceipt(blob, { key, model, docType = "Gider Fişi", fetchFn } = {}) {
  const img = await shrink(blob);
  const data = await call(`/models/${encodeURIComponent(model)}:generateContent`, key, {
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: img.type || "image/jpeg", data: await blobToBase64(img) } },
          { text: receiptPrompt(docType) },
        ],
      },
    ],
    generationConfig: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: 8192 },
  }, fetchFn);
  const raw = text(data);
  let obj = null;
  try {
    const s = raw.replace(/```(?:json)?/gi, "");
    obj = JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1));
  } catch {
    obj = null;
  }
  return { raw, ...validateReceipt(obj, docType) };
}

// Serbest parça listesi (metin + görseller) ile JSON yanıt
export async function geminiJson(parts, { key, model, system, fetchFn, maxTokens = 8192 } = {}) {
  const data = await call(`/models/${encodeURIComponent(model)}:generateContent`, key, {
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: maxTokens },
  }, fetchFn);
  const raw = text(data).replace(/```(?:json)?/gi, "");
  try {
    return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {
    throw new Error("Gemini geçerli bir yanıt döndürmedi; tekrar deneyin");
  }
}
export { parseAiJson, shrink };

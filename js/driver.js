// Şoför ekranı (#/sofor) ve patron tarafında şoför bağlantısı (#/sofor-kur).
// Şoför telefonu "şoför modunda" yalnız bu ekranı gösterir; kayıtlar telefonda (localStorage + fotoğraflar Cache Storage) durur,
// "Patrona gönder" ile WhatsApp'tan okunur metin + SP1 kodu + fiş fotoğrafları gider. Patronun asistanı kodu Gemini'siz çözer.
import { qs, qsa, esc, appbar, toast, notice, todayStr, trDate, confirmDialog, shareText } from "./ui.js";
import { commitEntries, validConfig, validDate, validNumber } from "./driver-delivery.js";
import { isActive, COMPANY_NAME } from "./core.js";

const K_MODE = "sp_driver", K_CFG = "sp_driver_cfg", K_ENT = "sp_driver_entries", PHOTO_CACHE = "sahapro-driver";
const ls = {
  get: (k, def = null) => { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { throw new Error("Telefon hafızasına yazılamadı. Form korunuyor; depolama alanını kontrol edip tekrar deneyin"); } },
  del: (k) => { try { localStorage.removeItem(k); } catch (e) {} },
};
export const isDriverMode = () => ls.get(K_MODE) === 1;

async function putPhotos(id, files) {
  if (!files.length) return 0;
  if (!("caches" in self)) throw new Error("Fotoğraf saklama bu tarayıcıda kullanılamıyor");
  const c = await caches.open(PHOTO_CACHE);
  let i = 0;
  try { for (const f of files) await c.put(`./__drv/${id}-${i++}`, new Response(f, { headers: { "content-type": f.type || "image/jpeg", "x-name": encodeURIComponent(f.name || `fis-${id}-${i}.jpg`) } }));
  } catch (e) { await dropPhotos({ id, ph: i }).catch(() => {}); throw e; }
  return i;
}
async function getPhotos(e) {
  if (!("caches" in self) || !e.ph) return [];
  const c = await caches.open(PHOTO_CACHE), out = [];
  for (let i = 0; i < e.ph; i++) { const r = await c.match(`./__drv/${e.photoId || e.id}-${i}`); if (r) { const b = await r.blob(); out.push(new File([b], decodeURIComponent(r.headers.get("x-name") || `fis-${i}.jpg`), { type: b.type || "image/jpeg" })); } }
  return out;
}
async function dropPhotos(e) { if ("caches" in self && e.ph) { const c = await caches.open(PHOTO_CACHE); for (let i = 0; i < e.ph; i++) await c.delete(`./__drv/${e.photoId || e.id}-${i}`); } }
// Fotoğrafı küçült (WhatsApp ve hafıza için)
export const PHOTO_LIMITS = { count: 10, mb: 25 };
async function shrinkPhoto(f) {
  try {
    // Yön bilgisi korunur (EXIF); fiş yazısı okunsun diye uzun kenar 1600 px, JPEG kalite 0,8
    const bmp = await createImageBitmap(f, { imageOrientation: "from-image" });
    const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    const b = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.8));
    bmp.close();
    return b ? new File([b], (f.name || "fis").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : f;
  } catch (e) { return f; }
}

export async function screen(ctx) {
  const r0 = ctx.parts[0];
  if (r0 === "sofor-kur") return setupScreen(ctx);
  if (r0 !== "sofor") return false;
  const { root, db } = ctx;
  const core = await import("./driver-core.js");
  // Bağlantıyla açıldı: ayarı al
  if (ctx.query?.k) {
    try {
      const cfg = await core.unpack(ctx.query.k);
      if (!validConfig(cfg)) throw new Error("Bağlantı bozuk");
      const previous = ls.get(K_CFG);
      if (previous && previous.p?.[0] !== cfg.p[0] && (ls.get(K_ENT, []).length || ls.get("sp_driver_draft"))) throw new Error("Bu telefonda başka şoförün kayıtları var. Kişi değişikliği için ayrı tarayıcı profili veya başka telefon kullanın");
      const own = ((await db.dumpAll()).work_records || []).filter(isActive).length;
      if (own > 5 && !isDriverMode() && !(await confirmDialog("Bu telefon patron telefonu mu?", `Bu telefonda ${own} iş kaydı var. Şoför moduna geçerseniz yalnız şoför ekranı görünür (kayıtlar silinmez, istediğinizde çıkabilirsiniz).`, "Şoför moduna geç"))) { location.replace("#/"); return true; }
      const first = !isDriverMode();
      const prev = ls.get(K_CFG);
      // Adresteki eski kod, sonradan kurulan daha yeni bağlantıyı ezmesin (ana ekran simgesi hep ilk adresi açar)
      if (prev && prev.p?.[0] === cfg.p[0] && (Number(prev.ts) || 0) > (Number(cfg.ts) || 0)) { ls.set(K_MODE, 1); }
      else ls.set(K_CFG, cfg), ls.set(K_MODE, 1);
      try { localStorage.setItem("sp_role", "driver"); } catch (e) {}
      if (first) toast(`Hoş geldin ${cfg.p[1]}`, "ok");
    } catch (e) { root.innerHTML = appbar("Şoför Ekranı") + notice("danger", "Bağlantı açılamadı: " + (e.message || e) + ". Patrondan yeni bağlantı isteyin."); return true; }
    // iPhone'da "Ana Ekrana Ekle" bu sayfanın adresini kullansın: bağlantı adreste kalır, uygulama bildirimi (manifest) kaldırılır.
    // Ana ekran uygulaması Safari'den ayrı hafızayla açıldığında da kendini bu bağlantıdan kurar.
    if (ctx.standaloneDriver) { /* sofor.html: kod adreste kalır (ana ekran simgesi kendini kurabilsin) */ }
    else if (!/iPhone|iPad|iPod/.test(navigator.userAgent)) history.replaceState(null, "", location.pathname + "#/sofor");
    else {
      document.querySelector('link[rel="manifest"]')?.remove();
      let t = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (!t) { t = document.createElement("meta"); t.name = "apple-mobile-web-app-title"; document.head.appendChild(t); }
      t.content = "SAHAPRO Şoför";
    }
  }
  const cfg = ls.get(K_CFG);
  if (!cfg) {
    root.innerHTML = appbar("Şoför Ekranı") + notice("info", "Bu ekran patronun WhatsApp'tan gönderdiği bağlantıyla açılır. Patron: Personel → kişi → 📲 Şoför bağlantısı.") +
      '<button class="btn block" data-go="#/">Ana sayfa</button>';
    return true;
  }
  const today = todayStr();
  const expired = cfg.exp && today > cfg.exp;
  let entries;
  try {
    const raw = localStorage.getItem(K_ENT); entries = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(entries) || entries.some(e => !e || typeof e.id !== "string" || !validDate(e.date))) throw new Error("Kayıt listesi bozuk");
  } catch (e) { root.innerHTML = notice("danger", "Telefondaki şoför kayıtları okunamadı. Verileri silmeyin; destek için yedek alın. " + (e.message || e)); return true; }
  let savedEntries = structuredClone(entries);
  const nm = (list, id) => (list || []).find((x) => x[0] === id)?.[1] || "";
  let tab = "is", photos = [], slipFor = null, busy = false, photoBusy = false, sharing = false;
  let draftPhotoId = "draft", draftPhotoCount = 0, missingDraftPhotos = 0, draftQueue = Promise.resolve();
  window.onbeforeunload = () => busy || photoBusy || sharing ? "İşlem sürüyor" : undefined;
  const lockForm = () => { for (const el of qsa("button, input, select, textarea", root)) el.disabled = busy || photoBusy || sharing; };
  // Yarım form taslağı (uygulama kapanır / WhatsApp'a geçilir / internet kesilirse kaybolmaz): alanlar localStorage, fotoğraflar Cache
  const K_DRAFT = "sp_driver_draft";
  let previewURLs = [];
  const picture = (f, alt) => { const url = URL.createObjectURL(f); previewURLs.push(url); return `<img src="${url}" alt="${esc(alt)}" style="width:76px;height:88px;object-fit:contain;border-radius:8px;background:#fff">`; };
  const photoListHtml = () => photos.length ? `<div class="small strong">${photos.length} fotoğraf hazır</div><div class="driver-photos">` + photos.map((f, i) => `<div>${picture(f, "Fotoğraf " + (i + 1))}<button class="btn sm ghost" data-phrm="${i}" aria-label="Fotoğraf ${i + 1} kaldır">${i + 1} · Kaldır</button></div>`).join("") + "</div>" : "";
  const st = { vid: ls.get("sp_driver_vid") || cfg.veh || "", cid: "", cn: "", sid: "", wt: core.DRIVER_TYPES[0], q: 1, u: "Sefer", ds: "", dn: "", ton: "", slip: "", note: "", mat: "", f: {} };
  let draftNote = "";
  {
    const dr = ls.get(K_DRAFT);
    if (dr && dr.st) {
      Object.assign(st, dr.st, { vid: st.vid || dr.st.vid });
      if (dr.tab) tab = dr.tab;
      draftPhotoId = dr.photoId || "draft"; draftPhotoCount = dr.ph || 0;
      if (dr.ph) photos = await getPhotos({ id: draftPhotoId, ph: dr.ph });
      missingDraftPhotos = (Number(dr.missing) || 0) + Math.max(0, (dr.ph || 0) - photos.length);
      draftNote = `Yarım kalan form geri yüklendi (${new Date(dr.at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })})${dr.ph ? ` · ${photos.length}/${dr.ph} fotoğraf` : ""}`;
      if (missingDraftPhotos) draftNote += " — bazı fotoğraflar telefonda bulunamadı, yeniden ekleyin";
    }
  }
  const saveDraft = (withPhotos = false) => {
    const snapshot = { at: Date.now(), tab, st: structuredClone(st), ph: photos.length, missing: missingDraftPhotos };
    const files = [...photos];
    draftQueue = draftQueue.catch(() => {}).then(async () => {
      const empty = !snapshot.ph && !snapshot.missing && !files.length && !String(snapshot.st.note || snapshot.st.slip || snapshot.st.ton || snapshot.st.cn || "").trim() && !Object.values(snapshot.st.f || {}).some(Boolean) && !Object.values(snapshot.st.x || {}).some(Boolean) && !snapshot.st.cid;
      if (empty) { ls.del(K_DRAFT); return; }
      const old = { id: draftPhotoId, ph: draftPhotoCount };
      const photoId = withPhotos ? "draft-" + core.newId() : draftPhotoId;
      if (withPhotos) await putPhotos(photoId, files);
      try { ls.set(K_DRAFT, { ...snapshot, photoId }); }
      catch (e) { if (withPhotos) await dropPhotos({ id: photoId, ph: files.length }).catch(() => {}); throw e; }
      if (withPhotos) { draftPhotoId = photoId; draftPhotoCount = files.length; await dropPhotos(old).catch(() => {}); }
    });
    return draftQueue;
  };
  const clearDraft = async () => { clearTimeout(root._dt); await draftQueue.catch(() => {}); ls.del(K_DRAFT); await dropPhotos({ id: draftPhotoId, ph: draftPhotoCount }).catch(() => {}); draftPhotoCount = 0; missingDraftPhotos = 0; draftNote = ""; };
  // No automatic deletion: opening a share sheet is not a delivery receipt.
  const opt = (rows, val, empty) => (empty != null ? `<option value="">${esc(empty)}</option>` : "") + rows.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(t)}</option>`).join("");
  const big = "min-height:52px;font-size:17px";

  // Bu hafta (pazartesiden): gün gün sefer / saat ve mazot — şoför kendi işini görür
  const weekHtml = () => {
    const t = new Date(today + "T12:00:00"), mon = new Date(t); mon.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    const from = mon.toISOString().slice(0, 10);
    const ws = entries.filter((e) => e.date >= from && e.date <= today);
    if (!ws.length) return "";
    const days = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
    const per = {};
    for (const e of ws) { const k = (new Date(e.date + "T12:00:00").getDay() + 6) % 7; const x = (per[k] ||= {}); if (e.k === "f") x.L = (x.L || 0) + Number(e.L); else if (e.k === "g" || e.k === "m") { if (Number(e.tl) > 0) x.TL = (x.TL || 0) + Number(e.tl); } else if (e.u) x[e.u] = (x[e.u] || 0) + Number(e.q); }
    const tot = {};
    for (const x of Object.values(per)) for (const [u, n] of Object.entries(x)) tot[u] = (tot[u] || 0) + n;
    const fmtU = (x) => Object.entries(x).filter(([u]) => u !== "L" && u !== "TL").map(([u, n]) => `${n} ${u.toLocaleLowerCase("tr-TR")}`).join(", ");
    return `<div class="card"><div class="row between"><b class="small">Bu hafta</b><span class="small">${esc([fmtU(tot), tot.L ? `⛽ ${tot.L} L` : "", tot.TL ? `💸 ${tot.TL} TL` : ""].filter(Boolean).join(" · "))}</span></div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:6px;text-align:center">${days.map((d, i) => `<div style="border-radius:8px;padding:4px 0;background:${per[i] ? "#2e9e6b22" : "var(--bg2)"}"><div class="tiny muted">${d}</div><div class="tiny" style="font-weight:700">${per[i] ? esc(fmtU(per[i]).replace(/ sefer/g, "s").replace(/ saat/g, "sa").replace(/ ton/g, "t").replace(/ yevmiye/g, "y") || (per[i].L ? "⛽" : "💸")) : "·"}</div></div>`).join("")}</div></div>`;
  };
  // Arıza / bakım ve gider formu (ortak alanlar: tutar, esnaf/usta, nasıl ödendi, fotoğraf)
  const x = (st.x ||= {});
  const xForm = () => {
    const isM = tab === "ariza";
    const kinds = isM ? core.DRIVER_MAINT : core.DRIVER_EXP;
    const kind = isM ? x.mt : x.cat;
    const chip = (key, val, label, on) => `<button class="chip ${on ? "on" : ""}" data-x-${key}="${esc(val)}">${esc(label)}</button>`;
    return `<div class="card">
      <div class="field"><label>Tarih</label><input type="date" data-k="date" value="${esc(st.date || today)}" max="${today}"></div>
      <div class="field"><label>${isM ? "Ne oldu?" : "Ne için?"}</label><div class="row" style="gap:6px;flex-wrap:wrap">${kinds.map(([v, t]) => chip("kind", v, t, kind === v)).join("")}</div></div>
      ${isM ? `<div class="field"><label>Açıklama</label><input data-x="desc" value="${esc(x.desc || "")}" placeholder="ör. sol arka lastik patladı, hidrolik hortum kaçırıyor"></div>
        <div class="field"><label>Durum</label><div class="row" style="gap:6px">${chip("st", "Açık", "⚠ Hâlâ arızalı", x.st !== "Tamamlandı")}${chip("st", "Tamamlandı", "✓ Yapıldı / tamir edildi", x.st === "Tamamlandı")}</div></div>` : ""}
      <div class="field"><label>Tutar (TL)${isM ? " — ödendiyse" : ""}</label><input type="number" inputmode="decimal" data-x="tl" value="${esc(x.tl ?? "")}" style="${big};font-size:22px;font-weight:800"></div>
      <div class="field"><label>${isM ? "Usta / servis / lastikçi" : "Nerede / kime"}</label><select data-x-sup style="${big}">${opt([...(cfg.E || []), ["__new", "➕ Listede yok — yaz"]], x.sup || "", "— seçin (isteğe bağlı) —")}</select></div>
      ${x.sup === "__new" ? `<div class="field"><label>Adı</label><input data-x="sn" value="${esc(x.sn || "")}" placeholder="ör. Yıldız Oto Lastik"></div>` : ""}
      <div class="field"><label>Nasıl ödendi?</label><div class="row" style="gap:6px;flex-wrap:wrap">${Object.entries(core.PAY_WAYS).map(([k, t]) => chip("pay", k, t, x.pay === k)).join("")}</div>
        ${x.pay === "cep" ? '<div class="tiny muted" style="margin-top:4px">Patron maaşınla birlikte geri öder.</div>' : x.pay === "veresiye" ? '<div class="tiny muted" style="margin-top:4px">Esnafa borç yazılır; esnafı listeden seçin.</div>' : ""}</div>
      ${!isM ? `<label class="row small" style="gap:8px;margin:4px 0"><input type="checkbox" data-x-veh ${x.noVeh ? "" : "checked"}> Araçla ilgili (${esc(nm(cfg.V, st.vid) || "araç")})</label>` : `<div class="formgrid2"><div class="field"><label>Km</label><input type="number" inputmode="numeric" data-x="km" value="${esc(x.km ?? "")}"></div><div class="field"><label>Makine saati</label><input type="number" inputmode="decimal" data-x="hr" value="${esc(x.hr ?? "")}"></div></div>`}
      <div class="field"><label>Not</label><input data-x="desc2" value="${esc(x.desc2 || "")}"></div>
      <div class="field"><label>📷 ${isM ? "Fotoğraf / fiş" : "Fiş fotoğrafı"}</label><input type="file" accept="image/*" capture="environment" multiple data-photo></div>
      <div class="tiny muted">En çok ${PHOTO_LIMITS.count} fotoğraf · her biri ${PHOTO_LIMITS.mb} MB'a kadar · telefonda küçültülür, yönü korunur</div><div class="small" data-phc>${photoListHtml()}</div>
      <button class="btn primary block" data-addx style="${big};margin-top:8px">✓ Kaydet</button>
    </div>`;
  };
  // ---- Dijital iş fişi: şantiye şefi telefonda imzalar, PDF WhatsApp'tan şefe gider ----
  const drawSlip = () => {
    const e = entries.find((x) => x.id === slipFor);
    if (!e) { slipFor = null; return draw(); }
    const sc = core.siteContact(cfg, e.sid);
    root.innerHTML = `
      <div class="row between" style="margin:10px 0"><button class="btn" data-slipback>‹ Geri</button><b>🧾 Dijital iş fişi</b><span></span></div>
      <div class="card small">${esc(core.entryLine({ ...e, dfs: null }, cfg))}</div>
      ${e.dfs ? notice("ok", `Fiş ${e.dfs} oluşturuldu${e.rcv ? " · imzalayan " + e.rcv : ""}. Tekrar gönderebilir ya da yeni imza alabilirsiniz.`) : ""}
      <div class="card">
        <div class="field"><label>Teslim alan (şantiye şefi / yetkili)</label><input data-rcv value="${esc(e.rcv || sc.name)}" placeholder="Ad Soyad" style="${big}"></div>
        ${sc.phone ? `<div class="small muted" style="margin:-4px 0 8px">📞 Şantiye: ${esc(sc.name || "")} ${esc(sc.phone)}</div>` : ""}
        <label class="small strong">İmza (parmakla)</label>
        <canvas data-sig width="600" height="220" class="signature" style="width:100%;height:170px;background:#fff;border:1.5px dashed var(--border);border-radius:10px;touch-action:none"></canvas>
        <div class="row between" style="margin-top:4px"><span class="tiny muted">Şefe telefonu uzatın, kutuya imzalasın.</span><button class="btn sm ghost" data-sigclear>Temizle</button></div>
        ${e.ph ? '<label class="row small" style="gap:8px;margin-top:8px"><input type="checkbox" data-slipphoto checked> Döküm/kantar fişi fotoğrafı PDF\'e eklensin</label>' : ""}
        <button class="btn primary block" data-slipgo style="${big};margin-top:10px">📄 İmzala, PDF oluştur ve gönder</button>
        ${e.dfs ? '<button class="btn block" data-slipresend style="margin-top:6px">📤 Aynı fişi tekrar gönder</button>' : ""}
      </div>
      <div class="tiny muted" style="margin:6px 4px">PDF'i WhatsApp'ta şantiye şefine gönderin. Fiş numarası ve imzalayan adı akşam patrona giden kayda da eklenir.</div>`;
    const cv = qs("[data-sig]", root), ctx2 = cv.getContext("2d");
    ctx2.lineWidth = 3.2; ctx2.lineCap = "round"; ctx2.strokeStyle = "#0b2340";
    let down = false, drawn = false;
    const pt = (ev) => { const r = cv.getBoundingClientRect(); return [(ev.clientX - r.left) * (cv.width / r.width), (ev.clientY - r.top) * (cv.height / r.height)]; };
    // Çizgiler ayrıca kaydedilir: patrona giden mesajda imza resmi yerine bu küçük veri gider
    let strokes = [];
    cv.onpointerdown = (ev) => { down = true; cv.setPointerCapture?.(ev.pointerId); ctx2.beginPath(); const p = pt(ev); ctx2.moveTo(...p); strokes.push([Math.round(p[0]), Math.round(p[1])]); };
    cv.onpointermove = (ev) => { if (!down) return; const p = pt(ev); ctx2.lineTo(...p); ctx2.stroke(); drawn = true; strokes.at(-1)?.push(Math.round(p[0]), Math.round(p[1])); };
    cv.onpointerup = cv.onpointercancel = () => (down = false);
    qs("[data-sigclear]", root).onclick = () => { ctx2.clearRect(0, 0, cv.width, cv.height); drawn = false; strokes = []; };
    qs("[data-slipback]", root).onclick = () => { slipFor = null; draw(); };
    const sigKey = `./__drv/sig-${e.id}`;
    const send = async (sigBlob, no, receiver, signedAt) => {
      const photo = e.ph && qs("[data-slipphoto]", root)?.checked !== false ? (await getPhotos(e))[0] || null : null;
      const { buildDocument } = await import("./document-engine.js");
      const pdf = await buildDocument(core.driverSlipSpec(e, cfg, { no, receiver, signedAt, sigBlob, photo }));
      const file = new File([pdf], `Is_Fisi_${no}.pdf`, { type: "application/pdf" });
      const text = core.slipShareText(e, cfg, no, receiver);
      try {
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text });
        else { const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); toast("PDF indirildi; WhatsApp'tan dosya olarak gönderin", "ok"); }
      } catch (err) { if (err?.name !== "AbortError") throw err; }
    };
    qs("[data-slipgo]", root).onclick = async (ev) => {
      const receiver = qs("[data-rcv]", root).value.trim();
      if (!receiver) return toast("Teslim alanın adını yazın", "err");
      if (!drawn && !(await confirmDialog("İmza yok", "Fiş imzasız (taslak) olarak mı oluşturulsun?", "İmzasız oluştur"))) return;
      const b = ev.currentTarget; b.disabled = true;
      try {
        const sigBlob = drawn ? await new Promise((r) => cv.toBlob(r, "image/png")) : null;
        const no = e.dfs || core.slipNo(cfg, (ls.get("sp_driver_slip_seq", 0) || 0) + 1);
        if (!e.dfs) ls.set("sp_driver_slip_seq", (ls.get("sp_driver_slip_seq", 0) || 0) + 1);
        const signedAt = sigBlob ? new Date().toISOString() : "";
        if (sigBlob && "caches" in self) await (await caches.open(PHOTO_CACHE)).put(sigKey, new Response(sigBlob, { headers: { "content-type": "image/png" } }));
        Object.assign(e, { dfs: no, rcv: receiver, ...(signedAt ? { sgt: signedAt, sg: 1, sv: core.encodeStrokes(strokes) } : {}) });
        await save();
        await send(sigBlob, no, receiver, signedAt);
        toast(`Fiş ${no} hazır`, "ok"); slipFor = null; draw();
      } catch (err) { toast("Fiş oluşturulamadı: " + (err.message || err), "err"); }
      b.disabled = false;
    };
    qs("[data-slipresend]", root)?.addEventListener("click", async () => {
      try {
        const r = "caches" in self ? await (await caches.open(PHOTO_CACHE)).match(sigKey) : null;
        await send(r ? await r.blob() : null, e.dfs, e.rcv || "", e.sgt || "");
      } catch (err) { toast("Gönderilemedi: " + (err.message || err), "err"); }
    });
  };
  const entryCards = (list) => {
    let date = "";
    return [...list].sort((a, b) => b.date.localeCompare(a.date)).map(e => {
      const heading = date !== e.date ? `<div class="section-title">${esc(trDate(e.date))}</div>` : ""; date = e.date;
      return heading + `<div class="card driver-entry" data-entry="${esc(e.id)}">
        <div class="row between"><span class="badge">${e.sent ? "Paylaşım açıldı" : "Telefonda bekliyor"}</span><span class="tiny muted">${e.ph || e.ph_dropped || 0} fotoğraf</span></div>
        <p class="small" style="line-height:1.6;overflow-wrap:anywhere">${esc(core.entryLine(e, cfg))}</p>
        <div class="driver-actions"><button class="btn sm" data-sendone="${esc(e.id)}">${e.sent ? "Tekrar paylaş" : "Bu kaydı paylaş"}</button>
        ${!e.k ? `<button class="btn sm" data-slip="${esc(e.id)}">Dijital fiş</button>` : ""}
        ${(e.ph || e.ph_dropped) ? `<button class="btn sm" data-viewphotos="${esc(e.id)}">Fotoğrafları kontrol et</button>` : ""}
        <button class="btn sm ghost" data-del="${esc(e.id)}" aria-label="Kaydı telefondan kaldır">${e.sent ? "Telefondan kaldır" : "Sil"}</button></div>
        ${(e.ph || e.ph_dropped) ? `<div data-photo-panel="${esc(e.id)}" hidden><div class="driver-photos" data-savedphotos="${esc(e.id)}"></div><div class="tiny muted" data-photo-status="${esc(e.id)}"></div>
        <label class="small">Fotoğrafları yeniden seç<input type="file" accept="image/*" multiple data-repair="${esc(e.id)}"></label>
        ${!e.sent ? `<button class="btn sm ghost" data-nophoto="${esc(e.id)}">Fotoğraf bağlantısını kaldır</button>` : ""}</div>` : ""}
      </div>`;
    }).join("");
  };
  const draw = () => {
    for (const url of previewURLs) URL.revokeObjectURL(url); previewURLs = [];
    if (slipFor) return drawSlip();
    const unsent = entries.filter((e) => !e.sent), sent = entries.filter((e) => e.sent).reverse();
    const sites = (cfg.S || []).filter((s) => s[2] === st.cid);
    root.innerHTML = `
      <div class="card" style="margin-top:10px;background:#0f2238;color:#fff">
        <div class="row between"><div><div style="font-size:20px;font-weight:800">👷 ${esc(cfg.p[1])}</div><div class="small" style="opacity:.8">${esc(cfg.co || "")} · şoför ekranı</div></div><div style="font-size:28px">🚚</div></div>
        <select data-vid style="margin-top:8px;width:100%;${big};border-radius:10px;padding:6px 10px">${opt(cfg.V || [], st.vid, "— araç seçin —")}</select>
      </div>
      ${expired ? `<div class="notice danger"><div>Bağlantının süresi ${esc(trDate(cfg.exp))} tarihinde doldu. Gönderdiğin kayıtlar işlenmez: patrondan <b>yeni bağlantı</b> iste.</div></div>` : ""}
      <div class="card driver-delivery" aria-label="Gönderim durumu">
        <div class="row between"><b>Gönderim merkezi</b><span class="badge">${navigator.onLine ? "Bağlantı var" : "Çevrimdışı"}</span></div>
        <div class="driver-stats"><div><strong>${unsent.length}</strong><span>Paylaşılmayı bekliyor</span></div><div><strong>${sent.length}</strong><span>Paylaşım ekranı açıldı</span></div><div><strong>${entries.reduce((n,e)=>n+(e.ph || e.ph_dropped || 0),0)}</strong><span>Fotoğraf bağlantısı</span></div></div>
        <div class="small muted" style="line-height:1.6">1. Kaydet → 2. WhatsApp'ta paylaş → 3. Patron Asistan'da kontrol edip kaydeder.</div>
        <div class="tiny muted" style="margin-top:6px">Patronun aldığı bu telefonda doğrulanamaz. Kayıtlar ve fotoğraflar kendiliğinden silinmez. İnternetsiz kayıt girebilirsiniz; paylaşmak için bağlantınızı kontrol edin.</div>
        ${unsent.length ? `<button class="btn primary block" data-pending style="margin-top:10px">${unsent.length} bekleyen kayda git ↓</button>` : ""}
      </div>
      ${weekHtml()}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0">${[["is", "🚚 İş"], ["yakit", "⛽ Mazot"], ["ariza", "🔧 Arıza / Bakım"], ["gider", "💸 Gider"]].map(([k, t]) => `<button class="btn ${tab === k ? "primary" : ""}" data-tab="${k}" style="${big}">${t}</button>`).join("")}</div>
      ${tab === "is" ? `<div class="card">
        <div class="field"><label>Tarih</label><input type="date" data-k="date" value="${esc(st.date || today)}" max="${today}"></div>
        <div class="field"><label>Müşteri</label><select data-cid style="${big}">${opt([...(cfg.Y ? [[cfg.Y, "📦 Kendi depodan çıkış"]] : []), ...(cfg.C || []), ["__new", "➕ Listede yok — yaz"]], st.cid, "— müşteri seçin —")}</select></div>
        ${st.cid === "__new" ? `<div class="field"><label>Müşteri adı</label><input data-k="cn" value="${esc(st.cn)}" placeholder="ör. Kaya İnşaat"></div>` : ""}
        ${sites.length ? `<div class="field"><label>Şantiye</label><select data-k="sid">${opt(sites.map((s) => [s[0], s[1]]), st.sid, "— şantiye (isteğe bağlı) —")}</select></div>` : ""}
        <div class="field"><label>İş</label><div class="row" style="gap:6px;flex-wrap:wrap">${core.DRIVER_TYPES.map((t) => `<button class="chip ${st.wt === t ? "on" : ""}" data-wt="${esc(t)}">${esc(t.replace(" Nakliye", ""))}</button>`).join("")}</div></div>
        <div class="field"><label>Miktar</label><div class="row" style="gap:8px;align-items:center">
          <button class="btn" data-q="-1" style="${big};width:56px;font-size:24px">−</button>
          <input type="number" inputmode="decimal" data-k="q" value="${esc(st.q)}" style="${big};text-align:center;font-size:24px;font-weight:800;flex:1">
          <button class="btn" data-q="1" style="${big};width:56px;font-size:24px">+</button></div>
          <div class="row" style="gap:6px;margin-top:6px">${core.DRIVER_UNITS.map((u) => `<button class="chip ${st.u === u ? "on" : ""}" data-u="${u}">${u}</button>`).join("")}</div></div>
        <div class="field"><label>Döküm / teslim yeri</label><select data-ds style="${big}">${opt([...(cfg.D || []), ["__new", "➕ Başka yer — yaz"]], st.ds, "— yok —")}</select></div>
        ${st.ds === "__new" ? `<div class="field"><label>Yer adı</label><input data-k="dn" value="${esc(st.dn)}" placeholder="ör. Göktürk dolgu"></div>` : ""}
        <div class="formgrid2"><div class="field"><label>Malzeme</label><input data-k="mat" value="${esc(st.mat)}" placeholder="moloz, mıcır…"></div>
          <div class="field"><label>Fişteki ton</label><input type="number" inputmode="decimal" data-k="ton" value="${esc(st.ton)}"></div>
          <div class="field"><label>Fiş no</label><input data-k="slip" value="${esc(st.slip)}"></div>
          <div class="field"><label>Not</label><input data-k="note" value="${esc(st.note)}"></div></div>
        <div class="field"><label>📷 Fiş fotoğrafı</label><input type="file" accept="image/*" capture="environment" multiple data-photo></div>
        <div class="tiny muted">En çok ${PHOTO_LIMITS.count} fotoğraf · her biri ${PHOTO_LIMITS.mb} MB'a kadar · telefonda küçültülür, yönü korunur</div><div class="small" data-phc>${photoListHtml()}</div>
        <button class="btn primary block" data-add style="${big};margin-top:8px">✓ Kaydet</button>
      </div>` : tab === "ariza" || tab === "gider" ? xForm() : `<div class="card">
        <div class="field"><label>Tarih</label><input type="date" data-k="date" value="${esc(st.date || today)}" max="${today}"></div>
        <div class="field"><label>Litre</label><input type="number" inputmode="decimal" data-f="L" value="${esc(st.f.L ?? "")}" style="${big};font-size:22px;font-weight:800"></div>
        <div class="field"><label>Nereden?</label><div class="row" style="gap:6px;flex-wrap:wrap">${[["Depo Tankı", "Depodan"], ["Akaryakıt İstasyonu", "İstasyondan"], ["Müşteri Verdi", "Müşteri verdi"]].map(([v, t]) => `<button class="chip ${st.src === v ? "on" : ""}" data-src="${v}">${t}</button>`).join("")}</div></div>
        ${st.src === "Müşteri Verdi" ? `<div class="field"><label>Hangi müşteri?</label><select data-f="cid">${opt(cfg.C || [], st.f.cid || "", "— seçin —")}</select></div>` : ""}
        <div class="formgrid2">${st.src === "Akaryakıt İstasyonu" ? `<div class="field"><label>Tutar (TL)</label><input type="number" inputmode="decimal" data-f="tl" value="${esc(st.f.tl ?? "")}"></div>` : ""}
          <div class="field"><label>Km</label><input type="number" inputmode="numeric" data-f="km" value="${esc(st.f.km ?? "")}"></div>
          <div class="field"><label>Makine saati</label><input type="number" inputmode="decimal" data-f="hr" value="${esc(st.f.hr ?? "")}"></div></div>
        <div class="field"><label>📷 Yakıt fişi / fotoğraf</label><input type="file" accept="image/*" capture="environment" multiple data-photo></div>
        <div class="tiny muted">En çok ${PHOTO_LIMITS.count} fotoğraf · her biri ${PHOTO_LIMITS.mb} MB'a kadar</div><div class="small" data-phc>${photoListHtml()}</div>
        <button class="btn primary block" data-addf style="${big};margin-top:8px">✓ Kaydet</button>
      </div>`}
      ${draftNote ? `<div class="card small" data-draftnote>📝 ${esc(draftNote)} ${missingDraftPhotos ? `<button class="btn sm" data-forgetmissing>Eksik fotoğrafları yok say</button>` : ""} <button class="btn sm ghost" data-draftclear>Taslağı temizle</button></div>` : ""}<div class="section-title">Telefonda bekleyen — henüz paylaşılmadı (${unsent.length})</div>
      <div id="driver-pending">${entryCards(unsent) || '<div class="muted small" style="padding:0 4px 8px">Gönderilecek kayıt yok.</div>'}</div>
      ${unsent.length ? `<button class="btn block" data-send style="${big};background:#168a45;color:#fff;border:0;font-weight:800">📤 Patrona paylaş (WhatsApp) · ${unsent.length} kayıt</button><p class="tiny muted">Uzun listeler parçalara ayrılır. Kalan kayıt sayısı her paylaşımın ardından gösterilir. Fotoğraflar aynı pakette, kayıt sırasıyla eklenir.</p>` : ""}
      ${sent.length ? `<details class="card" data-shared style="margin-top:10px"><summary class="small">Paylaşılanlar (${sent.length}) — patronun aldığı bu telefonda doğrulanamaz</summary><p class="tiny muted">Tekrar paylaşım aynı kayıt kimliğini taşır; patronda ikinci kayıt oluşturmaz. WhatsApp'ta mesajı ve ekleri kontrol edin.</p>${entryCards(sent)}<button class="btn sm" style="margin-top:6px" data-resend>Son paylaşılanı tekrar paylaş</button></details>` : ""}
      <details style="margin:14px 4px"><summary class="tiny muted">Ayarlar</summary><div class="tiny muted" style="margin:6px 0">Liste güncellemesi için patrondan yeni bağlantı isteyin. Bağlantı tarihi: ${esc(cfg.iss ? trDate(cfg.iss) : "—")}</div><div class="field" style="margin-top:6px"><label class="tiny">Patron yeni bağlantı gönderdiyse buraya yapıştırın</label><textarea data-newlink rows="2" placeholder="Yeni bağlantı"></textarea><button class="btn sm block" data-newlink-ok style="margin-top:4px">Yeni bağlantıyı kur</button></div><button class="btn sm ghost" data-exit>Şoför modundan çık</button></details>`;
    bind(); lockForm();
  };
  const readForm = () => {
    for (const el of qsa("[data-k]", root)) st[el.dataset.k] = el.value;
    for (const el of qsa("[data-f]", root)) st.f[el.dataset.f] = el.value;
    for (const el of qsa("[data-x]", root)) x[el.dataset.x] = el.value;
    const vb = qs("[data-x-veh]", root); if (vb) x.noVeh = !vb.checked;
    saveDraft().catch(e => toast(e.message || String(e), "err"));
  };
  const save = async () => {
    try { entries = await commitEntries(K_ENT, savedEntries, entries); savedEntries = structuredClone(entries); }
    catch (e) { entries = structuredClone(savedEntries); throw e; }
  };
  const persist = async (e) => {
    if (busy || photoBusy || sharing) return false;
    if (missingDraftPhotos) { toast("Taslakta eksik fotoğraf var. Fotoğrafları yeniden ekleyin veya eksikleri yok saymayı açıkça seçin", "err"); return false; }
    busy = true; lockForm();
    try {
      await draftQueue.catch(() => {});
      e.ph = await putPhotos(e.id, photos);
      if (!e.ph) delete e.ph;
      entries.push(e); await save();
      return true;
    } catch (err) {
      busy = false; lockForm();
      await dropPhotos(e).catch(() => {});
      toast("Kaydedilemedi: " + (err.message || err) + ". Formu tekrar deneyebilirsiniz.", "err"); return false;
    }
  };
  const checkForm = () => {
    if (!validDate(st.date || today) || (st.date || today) > today) { toast("Geçerli bir tarih seçin; gelecek tarih olamaz", "err"); return false; }
    const vals = tab === "is" ? [st.ton] : tab === "yakit" ? [st.f.L, st.f.tl, st.f.km, st.f.hr] : [x.tl, x.km, x.hr];
    if (!vals.every(v => validNumber(v))) { toast("Sayılar sıfır veya pozitif, en fazla 1 trilyon olmalı", "err"); return false; }
    return true;
  };
  const redrawForm = () => { saveDraft().catch(e => toast(e.message || String(e), "err")); draw(); };
  const bind = () => {
    qs("[data-vid]", root).addEventListener("change", (e) => { st.vid = e.target.value; try { ls.set("sp_driver_vid", st.vid); saveDraft().catch(err => toast(err.message, "err")); } catch (err) { toast(err.message, "err"); } });
    qs("[data-pending]", root)?.addEventListener("click", () => qs("#driver-pending", root)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    for (const b of qsa("[data-tab]", root)) b.addEventListener("click", () => {
      if (photoBusy || busy || sharing) return;
      if (photos.length && b.dataset.tab !== tab) return toast("Fotoğraflı formu önce kaydedin veya fotoğrafları kaldırın; fotoğraflar başka kayıt türüne taşınmaz", "err");
      readForm(); tab = b.dataset.tab; redrawForm();
    });
    qs("[data-cid]", root)?.addEventListener("change", (e) => { readForm(); st.cid = e.target.value; st.sid = ""; redrawForm(); });
    qs("[data-ds]", root)?.addEventListener("change", (e) => { readForm(); st.ds = e.target.value; redrawForm(); });
    for (const b of qsa("[data-wt]", root)) b.addEventListener("click", () => { readForm(); st.wt = b.dataset.wt; if (/Makine|Kazı|Yükleme/.test(st.wt) && st.u === "Sefer") st.u = "Saat"; else if (/Nakliye/.test(st.wt) && st.u === "Saat") st.u = "Sefer"; redrawForm(); });
    for (const b of qsa("[data-u]", root)) b.addEventListener("click", () => { readForm(); st.u = b.dataset.u; redrawForm(); });
    for (const b of qsa("[data-src]", root)) b.addEventListener("click", () => { readForm(); st.src = b.dataset.src; redrawForm(); });
    for (const b of qsa("[data-q]", root)) b.addEventListener("click", () => { readForm(); st.q = Math.max(0, (Number(st.q) || 0) + Number(b.dataset.q)); redrawForm(); });
    root.oninput = () => { if (!qs("[data-vid]", root)) return; clearTimeout(root._dt); readForm(); };
    qs("[data-photo]", root)?.addEventListener("change", async (e) => {
      if (photoBusy || busy || sharing) return;
      photoBusy = true; lockForm();
      try {
      const el = qs("[data-phc]", root), list = [...e.target.files], bad = [];
      e.target.value = "";
      if (photos.length + list.length > PHOTO_LIMITS.count) toast(`En çok ${PHOTO_LIMITS.count} fotoğraf eklenebilir; ilk ${Math.max(0, PHOTO_LIMITS.count - photos.length)} tanesi alındı`, "err");
      const take = list.slice(0, Math.max(0, PHOTO_LIMITS.count - photos.length));
      for (let i = 0; i < take.length; i++) {
        const f = take[i];
        el.textContent = `Fotoğraf hazırlanıyor ${i + 1}/${take.length}…`;
        if (f.type && !f.type.startsWith("image/")) { bad.push(`${f.name || i + 1}: fotoğraf değil`); continue; }
        if (f.size > PHOTO_LIMITS.mb * 1048576) { bad.push(`${f.name || i + 1}: ${PHOTO_LIMITS.mb} MB'tan büyük`); continue; }
        const g = await shrinkPhoto(f); // sırayla: telefonun belleği bir kerede dolmaz
        if (g === f && f.size > 8 * 1048576) { bad.push(`${f.name || i + 1}: hazırlanamadı`); continue; }
        photos.push(g);
      }
      if (missingDraftPhotos) toast("Yeni fotoğraflar hazır. Eski eksik fotoğrafları yok say düğmesiyle taslağı doğrulayın", "err");
      await saveDraft(true);
      el.innerHTML = photoListHtml() + (bad.length ? `<div class="tiny" style="color:#c0392b">Eklenemedi: ${esc(bad.join(" · "))} — yeniden deneyin</div>` : "");
      bindPhotoRemove();
      } catch (err) { toast("Fotoğraf taslağı saklanamadı: " + (err.message || err) + ". Kaydet ile tekrar deneyin.", "err"); }
      finally { photoBusy = false; lockForm(); }
    });
    const bindPhotoRemove = () => { for (const b of qsa("[data-phrm]", root)) b.onclick = async (ev) => {
      ev.preventDefault(); if (photoBusy || busy || sharing) return;
      photoBusy = true; lockForm(); const before = [...photos];
      try { photos.splice(Number(b.dataset.phrm), 1); await saveDraft(true); }
      catch (err) { photos = before; toast("Fotoğraf kaldırılamadı: " + (err.message || err), "err"); }
      finally { photoBusy = false; qs("[data-phc]", root).innerHTML = photoListHtml(); bindPhotoRemove(); lockForm(); }
    }; };
    bindPhotoRemove();
    qs("[data-forgetmissing]", root)?.addEventListener("click", async () => {
      if (!(await confirmDialog("Taslak fotoğrafları", "Telefonda bulunamayan eski fotoğraflar bu taslaktan çıkarılacak. Yalnız ekranda görünen fotoğraflar kayda eklenecek.", "Görünenlerle devam"))) return;
      const before = missingDraftPhotos; missingDraftPhotos = 0;
      try { await saveDraft(true); draftNote = "Taslakta yalnız görünen fotoğraflar kullanılacak"; draw(); }
      catch (err) { missingDraftPhotos = before; toast(err.message || String(err), "err"); }
    });
    qs("[data-draftclear]", root)?.addEventListener("click", async () => { await clearDraft(); photos = []; Object.assign(st, { q: 1, ton: "", slip: "", note: "", f: {} }); Object.keys(x).forEach((k) => delete x[k]); draw(); });
    qs("[data-add]", root)?.addEventListener("click", async () => {
      if (busy || photoBusy || sharing) return; // iki kez basma: tek kayıt
      readForm();
      if (!checkForm()) return;
      const q = Number(String(st.q).replace(",", "."));
      if (!st.vid) return toast("Araç seçin", "err");
      if (!st.cid || (st.cid === "__new" && !st.cn.trim())) return toast("Müşteri seçin", "err");
      if (!validNumber(q, true)) return toast("Miktar yazın", "err");
      if (/Nakliye/.test(st.wt) && st.u === "Saat" && !(await confirmDialog("Birim saat mi?", `${st.wt} genelde sefer olur. ${q} SAAT olarak mı kaydedilsin?`, "Evet, saat"))) return;
      const e = { id: core.newId(), date: st.date || today, vid: st.vid, wt: st.wt, q, u: st.u,
        ...(st.cid === "__new" ? { cn: st.cn.trim() } : { cid: st.cid }), ...(st.sid ? { sid: st.sid } : {}),
        ...(st.ds && st.ds !== "__new" ? { ds: st.ds } : st.ds === "__new" && st.dn.trim() ? { dn: st.dn.trim() } : {}),
        ...(Number(String(st.ton).replace(",", ".")) > 0 ? { ton: Number(String(st.ton).replace(",", ".")) } : {}), ...(st.slip.trim() ? { slip: st.slip.trim() } : {}),
        ...(st.mat.trim() ? { mat: st.mat.trim() } : {}), ...(st.note.trim() ? { note: st.note.trim() } : {}) };
      if (!(await persist(e))) return;
      photos = []; Object.assign(st, { q: 1, ton: "", slip: "", note: "" }); await clearDraft(); busy = false;
      toast("Telefonda kaydedildi — patrona henüz gitmedi; 'Patrona paylaş' ile gönderin", "ok"); draw();
    });
    for (const b of qsa("[data-x-kind]", root)) b.addEventListener("click", () => { readForm(); if (tab === "ariza") x.mt = b.dataset.xKind; else { x.cat = b.dataset.xKind; if (x.cat === "Yemek") x.noVeh = true; } redrawForm(); });
    for (const b of qsa("[data-x-st]", root)) b.addEventListener("click", () => { readForm(); x.st = b.dataset.xSt; redrawForm(); });
    for (const b of qsa("[data-x-pay]", root)) b.addEventListener("click", () => { readForm(); x.pay = b.dataset.xPay; redrawForm(); });
    qs("[data-x-sup]", root)?.addEventListener("change", (e) => { readForm(); x.sup = e.target.value; redrawForm(); });
    qs("[data-addx]", root)?.addEventListener("click", async () => {
      if (busy || photoBusy || sharing) return;
      readForm();
      if (!checkForm()) return;
      const isM = tab === "ariza";
      const tl = Number(String(x.tl || "").replace(",", "."));
      if (isM ? !x.mt : !x.cat) return toast(isM ? "Ne olduğunu seçin" : "Ne için olduğunu seçin", "err");
      if (isM && !st.vid) return toast("Araç seçin", "err");
      if (isM && !String(x.desc || "").trim()) return toast("Kısaca ne olduğunu yazın", "err");
      if (!isM && !(tl > 0)) return toast("Tutarı yazın", "err");
      if (tl > 0 && !x.pay) return toast("Nasıl ödendiğini seçin", "err");
      if (x.pay === "veresiye" && (!x.sup || x.sup === "__new")) return toast("Veresiye için esnafı listeden seçin", "err");
      const sup = x.sup && x.sup !== "__new" ? { sup: x.sup } : x.sup === "__new" && String(x.sn || "").trim() ? { sn: String(x.sn).trim() } : {};
      const note = String(x.desc2 || "").trim();
      const e = isM
        ? { id: core.newId(), k: "m", date: st.date || today, vid: st.vid, mt: x.mt, desc: [String(x.desc).trim(), note].filter(Boolean).join(" · "), st: x.st === "Tamamlandı" ? "Tamamlandı" : "Açık", ...(tl > 0 ? { tl, pay: x.pay } : {}), ...sup, ...(Number(x.km) > 0 ? { km: Number(x.km) } : {}), ...(Number(x.hr) > 0 ? { hr: Number(x.hr) } : {}) }
        : { id: core.newId(), k: "g", date: st.date || today, cat: x.cat, tl, pay: x.pay, ...sup, ...(x.noVeh || !st.vid ? {} : { vid: st.vid }), ...(note ? { desc: note } : {}) };
      if (!(await persist(e))) return;
      photos = []; Object.keys(x).forEach((k) => delete x[k]); await clearDraft(); busy = false;
      toast("Telefonda kaydedildi — patrona henüz gitmedi; 'Patrona paylaş' ile gönderin", "ok"); draw();
    });
    qs("[data-addf]", root)?.addEventListener("click", async () => {
      if (busy || photoBusy || sharing) return;
      readForm();
      if (!checkForm()) return;
      const f = Object.fromEntries(qsa("[data-f]", root).map((el) => [el.dataset.f, el.value]));
      const L = Number(String(f.L).replace(",", "."));
      if (!st.vid) return toast("Araç seçin", "err");
      if (!validNumber(L, true)) return toast("Litre yazın", "err");
      if (!st.src) return toast("Nereden aldığınızı seçin", "err");
      if (st.src === "Müşteri Verdi" && !f.cid) return toast("Müşteriyi seçin", "err");
      const e = { id: core.newId(), k: "f", date: st.date || today, vid: st.vid, L, src: st.src, ...(f.cid ? { cid: f.cid } : {}), ...(Number(f.tl) > 0 ? { tl: Number(f.tl) } : {}), ...(Number(f.km) > 0 ? { km: Number(f.km) } : {}), ...(Number(f.hr) > 0 ? { hr: Number(f.hr) } : {}) };
      if (!(await persist(e))) return;
      photos = []; st.f = {}; await clearDraft(); busy = false; toast("Telefonda kaydedildi — patrona henüz gitmedi; 'Patrona paylaş' ile gönderin", "ok"); draw();
    });
    for (const b of qsa("[data-slip]", root)) b.addEventListener("click", () => { readForm(); slipFor = b.dataset.slip; draw(); window.scrollTo(0, 0); });
    for (const b of qsa("[data-del]", root)) b.addEventListener("click", async () => {
      if (busy || photoBusy || sharing) return;
      const e = entries.find((x) => x.id === b.dataset.del);
      if (!e || !(await confirmDialog("Telefondan silinsin mi?", core.entryLine(e, cfg) + (e.sent ? " — Patronun aldığı doğrulanamaz. Bu telefondaki kayıt ve fotoğrafları kaldırmadan önce gerektiğinde tekrar paylaşın." : ""), "Sil", true))) return;
      try { entries = entries.filter((x) => x !== e); await save(); await dropPhotos(e); draw(); } catch (err) { toast(err.message || String(err), "err"); }
    });
    const send = async (list) => {
      // İmza mesajın KODUNUN İÇİNDE gider (çizgi verisi; eski kayıtlarda küçültülmüş PNG): patron kopyala-yapıştır yapsa da imza gelir.
      // WhatsApp ~4 KB'tan uzun metni kesebildiği için mesaj MSG_LIMIT altında tutulur; sığmayan kayıtlar sonraki gönderime kalır.
      const sigOf = async (e) => {
        if (!e.sg || !("caches" in self)) return null;
        const r = await (await caches.open(PHOTO_CACHE)).match(`./__drv/sig-${e.id}`);
        return r ? r.blob() : null;
      };
      const smallB64 = async (blob, maxW) => {
        const bmp = await createImageBitmap(blob);
        const s = Math.min(1, maxW / bmp.width), cv = document.createElement("canvas");
        cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
        const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(bmp, 0, 0, cv.width, cv.height);
        // Siyah-beyaz (2 renk): PNG çok daha küçük olur, imza okunur kalır
        const im = g.getImageData(0, 0, cv.width, cv.height), px = im.data;
        for (let i = 0; i < px.length; i += 4) { const v = (px[i] + px[i + 1] + px[i + 2]) / 3 < 170 && px[i + 3] > 40 ? 0 : 255; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; }
        g.putImageData(im, 0, 0);
        const b = await new Promise((r) => cv.toBlob(r, "image/png"));
        const u = new Uint8Array(await b.arrayBuffer()); let str = ""; for (let i = 0; i < u.length; i += 0x8000) str += String.fromCharCode(...u.subarray(i, i + 0x8000));
        return btoa(str);
      };
      // Bir kaydın gönderilecek hali: çizgi verisi varsa o; yoksa imza resmi (genişlik w) ya da ayrı dosya
      const prep = async (e, w) => {
        const c = { ...e, _e: e };
        if (c.sv?.length) { delete c.sg; return c; }
        if (c.sg) { const sb = await sigOf(e); if (!sb) throw new Error("Bu kaydın imzası telefonda bulunamadı. Dijital fişi kontrol edin; eksik imzayla paylaşılmadı"); delete c.sg; if (sb) { if (w) { try { c.sig = await smallB64(sb, w); } catch (err) { c._file = sb; c.sg = 1; } } else { c._file = sb; c.sg = 1; } } }
        return c;
      };
      const msg = (arr) => core.driverMessage(arr.map(({ _e, _file, ...c }) => c), cfg);
      let attachmentCount = 0, recordLimit = 0;
      for (const e of list) { const count = (e.ph || 0) + (e.sg && !e.sv?.length ? 1 : 0); if (recordLimit && attachmentCount + count > 20) break; attachmentCount += count; recordLimit++; }
      list = list.slice(0, recordLimit);
      let out = [], text = "";
      // Önce tüm kayıtlar; sığmazsa imza resmi küçültülür, yine sığmazsa son kayıtlar sonraki mesaja bırakılır
      for (let n = list.length; n >= 1; n--) {
        for (const w of [280, 200, 140, 0]) {
          out = []; for (const e of list.slice(0, n)) out.push(await prep(e, w));
          text = await msg(out);
          if (core.msgBytes(text) <= core.MSG_LIMIT) break;
        }
        if (core.msgBytes(text) <= core.MSG_LIMIT || n === 1) break;
      }
      if (core.msgBytes(text) > core.MSG_LIMIT) throw new Error("Bu kayıt paylaşım sınırını aşıyor. Dijital fişi ayrıca paylaşın; kayıt telefonda korunuyor");
      const files = []; let totalBytes = 0, completeRecords = 0;
      for (const c of out) {
        const images = await getPhotos(c);
        if (c.ph_dropped || images.length !== (c.ph || 0)) throw new Error("Bu kaydın fotoğrafları eksik. Fotoğrafları onarın veya kaydı fotoğrafsız paylaşmayı açıkça seçin");
        const group = [...images];
        if (c.sg && c._file) group.push(new File([c._file], `imza-${c.dfs || c.id}.png`, { type: "image/png" }));
        const bytes = group.reduce((n,f)=>n+f.size,0);
        if (bytes > 20 * 1048576) throw new Error("Bir kaydın fotoğrafları 20 MB'ı aşıyor. Daha küçük fotoğraflarla yeniden seçin");
        if (totalBytes + bytes > 20 * 1048576) break;
        totalBytes += bytes; files.push(...group); completeRecords++;

      }
      out = out.slice(0, completeRecords); text = await msg(out);
      let ok = false;
      try {
        if (files.length && navigator.canShare?.({ files, text })) { await navigator.share({ text, files }); ok = true; }
        else if (files.length) throw new Error("Tarayıcı fotoğraflı paylaşımı desteklemiyor. Chrome / Safari ile açın; kayıt ve fotoğraflar beklemede kalır");
        else if (navigator.share) { await navigator.share({ text }); ok = true; }
        else { location.href = "https://wa.me/?text=" + encodeURIComponent(text); ok = true; }
      } catch (e) { toast(e?.name === "AbortError" ? "Paylaşım iptal edildi; kayıtlar telefonda duruyor" : "Paylaşılamadı: " + (e.message || e), "err"); }
      return ok ? out.map((c) => c._e) : null;
    };
    const shareRows = async (list) => {
      if (sharing || busy || photoBusy || !list.length) return;
      if (expired) return toast("Bağlantı süresi doldu. Ayarlar bölümünden yeni bağlantıyı kurun; kayıtlar korunuyor", "err");
      sharing = true; lockForm();
      try {
        const done = await send(list);
        if (done) {
          const at = new Date().toISOString();
          for (const e of done) e.sent = at;
          await save();
          const left = list.length - done.length;
          toast(left ? `${done.length} kayıt için paylaşım ekranı açıldı. ${left} kayıt kaldı — tekrar basın` : "Paylaşım ekranı açıldı — WhatsApp'ta gönderildiğini kontrol edin. Gitmediyse tekrar paylaşın.", "ok");
        }
      } catch (e) { toast("Paylaşım tamamlanamadı: " + (e.message || e) + ". Kayıtlar telefonda korunuyor.", "err"); }
      finally { sharing = false; draw(); }
    };
    qs("[data-send]", root)?.addEventListener("click", () => shareRows(entries.filter(e => !e.sent)));
    qs("[data-resend]", root)?.addEventListener("click", () => {
      const last = entries.filter(e => e.sent).map(e => e.sent).sort().at(-1);
      return shareRows(entries.filter(e => e.sent === last));
    });
    for (const b of qsa("[data-viewphotos]", root)) b.onclick = async () => {
      const e = entries.find(e => e.id === b.dataset.viewphotos), card = b.closest("[data-entry]"), panel = qs("[data-photo-panel]", card);
      panel.hidden = !panel.hidden; if (panel.hidden) return;
      try {
        const files = await getPhotos(e), expected = e.ph || e.ph_dropped || 0;
        qs("[data-savedphotos]", card).innerHTML = files.map((f, i) => picture(f, "Kayıt fotoğrafı " + (i + 1))).join("");
        qs("[data-photo-status]", card).textContent = files.length === expected ? `${files.length}/${expected} fotoğraf telefonda hazır` : `${files.length}/${expected} fotoğraf bulundu. Eksik fotoğrafları yeniden seçmeden paylaşılmaz.`;
      } catch (err) { qs("[data-photo-status]", card).textContent = "Fotoğraflar okunamadı: " + (err.message || err); }
    };
    for (const b of qsa("[data-sendone]", root)) b.onclick = () => shareRows(entries.filter(e => e.id === b.dataset.sendone));
    for (const b of qsa("[data-nophoto]", root)) b.onclick = async () => {
      const e = entries.find(e => e.id === b.dataset.nophoto);
      if (!e || e.sent || sharing || busy || photoBusy || !(await confirmDialog("Fotoğrafsız paylaşım", "Bu kaydın fotoğraf bağlantısı kaldırılır. Patrona yalnız kayıt bilgileri gidecek. Elinizdeki fişleri ayrıca iletin.", "Fotoğrafsız devam"))) return;
      const old = { ...e }; delete e.ph; delete e.ph_dropped;
      try { await save(); await dropPhotos(old).catch(() => {}); draw(); } catch (err) { toast(err.message || String(err), "err"); }
    };
    for (const el of qsa("[data-repair]", root)) el.onchange = async () => {
      if (sharing || busy || photoBusy) return;
      const e = entries.find(e => e.id === el.dataset.repair), files = [...el.files];
      if (!e || !files.length) return;
      busy = true; lockForm();
      const id = "repair-" + core.newId(), old = { id: e.photoId || e.id, ph: e.ph || e.ph_dropped };
      try {
        if (files.length > PHOTO_LIMITS.count || files.some(f => !f.type.startsWith("image/") || f.size > PHOTO_LIMITS.mb * 1048576)) throw new Error("En çok 10 fotoğraf; her biri en fazla 25 MB olmalı");
        if (e.sent && files.length !== (e.ph || e.ph_dropped || 0)) throw new Error("Paylaşılan kayıt için aynı sayıda fotoğraf seçin; eski paketin fotoğraf sırası korunmalı");
        const resized = []; for (const f of files) { const image = await shrinkPhoto(f); if (image.size > 8 * 1048576) throw new Error("Fotoğraf küçültülemedi; daha küçük bir fotoğraf seçin"); resized.push(image); }
        await putPhotos(id, resized); e.photoId = id; e.ph = resized.length; delete e.ph_dropped;
        await save(); await dropPhotos(old).catch(() => {}); toast("Fotoğraflar yenilendi; aynı kayıt tekrar paylaşılabilir", "ok");
      } catch (err) { await dropPhotos({ id, ph: files.length }).catch(() => {}); toast("Fotoğraf yenilenemedi: " + (err.message || err), "err"); }
      finally { busy = false; draw(); }
    };
    qs("[data-newlink-ok]", root)?.addEventListener("click", async () => {
      const m = /(?:^|[#&?/])k=([A-Za-z0-9_-]{20,})/.exec(qs("[data-newlink]", root).value);
      if (!m) return toast("Bağlantı bulunamadı; mesajın tamamını yapıştırın", "err");
      try {
        const n = await core.unpack(m[1]);
        if (!validConfig(n)) throw new Error("Bağlantı bozuk");
        if (n.p[0] !== cfg.p[0] && (entries.length || ls.get(K_DRAFT))) throw new Error("Bu telefonda başka şoförün kayıtları var; ayrı telefon veya tarayıcı profili kullanın");
        ls.set(K_CFG, { ...n, ts: Math.max(Number(n.ts) || 0, Date.now()) });
        toast("Yeni bağlantı kuruldu", "ok");
        location.reload();
      } catch (e) { toast(e.message || String(e), "err"); }
    });
    qs("[data-exit]", root)?.addEventListener("click", async () => {
      // İmzalı bağlantıda çıkış yalnız patronun çıkış koduyla (şoför yönetici ekranlarına geçemez)
      if (cfg.xk) {
        if (!(await exitProof(cfg.xk))) return;
      } else if (!(await confirmDialog("Şoför modundan çıkılsın mı?", "Bu telefon patron telefonu olarak açılır. Gönderilmemiş kayıtlar telefonda kalır.", "Çık"))) return;
      try { localStorage.setItem("sp_role", "boss"); } catch (e) {}
      ls.del(K_MODE); location.replace(location.pathname.replace(/[^/]*$/, "") + "index.html#/guvenlik");
    });
  };
  draw();
  return true;
}

// Şoför modundan çıkış kanıtı: patronun 8 haneli çıkış kodu; bu telefon patron telefonuysa (yönetici kilidi kurulu) yönetici şifresi de olur.
// Şoför telefonunda yönetici kilidi olmadığından şoför için tek yol çıkış kodudur. Şifre denemeleri kilit ekranının bekleme süresine tabidir.
export async function exitProof(xk, title = "Şoför modundan çıkış") {
  const sec = await import("./security.js");
  if (await sec.lockEnabled()) {
    const { choiceDialog } = await import("./ui.js");
    const how = await choiceDialog(title, "Bu telefonda yönetici kilidi kurulu. Nasıl doğrulansın?", [["sifre", "Bu telefonun yönetici şifresi (patron telefonu)"], ["kod", "Patronun verdiği 8 haneli çıkış kodu"]]);
    if (how == null) return false;
    if (how === "sifre") return await sec.reauth("Şoför modundan çıkış");
  }
  const { promptDialog } = await import("./ui.js");
  const code = await promptDialog(title, "Patronun verdiği 8 haneli çıkış kodu", "", { type: "password" });
  if (code == null) return false;
  const { verifySecret } = await import("./security-core.js");
  if (!(await verifySecret(code.replace(/\s/g, ""), xk))) { toast("Çıkış kodu hatalı", "err"); return false; }
  return true;
}

// Patron: şoföre bağlantı gönder (#/sofor-kur?pid=)
async function setupScreen(ctx) {
  const { root, db } = ctx;
  const core = await import("./driver-core.js");
  const d = await db.dumpAll();
  const people = (d.personnel || []).filter((p) => isActive(p) && p.active !== false);
  const vehicles = (d.vehicles || []).filter(isActive);
  const pid = ctx.query?.pid || "";
  root.innerHTML = appbar("Şoför Bağlantısı", "şoför kendi telefonundan iş girer") +
    `<div style="height:10px"></div>
    <div class="card small" style="line-height:1.55">
      <b>Nasıl çalışır?</b><br>
      1. Şoförü seçin, <b>📤 WhatsApp'tan gönder</b>'e basın.<br>
      2. Şoför bağlantıya dokunur; açılan sayfada tarayıcı menüsünden <b>Ana ekrana ekle</b> der. Artık telefonunda yalnız kendi ekranı açılır.<br>
      3. Şoför seferleri, mazotu, arıza ve giderleri girer; istenirse işe <b>🧾 dijital fiş</b> açar: şantiye şefi telefonda imzalar, PDF WhatsApp'tan şefe gider (şefin adı/telefonu şantiye kartından gelir). Akşam <b>Patrona gönder</b>'e basar (size ya da gruba).<br>
      4. Mesajı SAHAPRO'ya paylaşın ya da Akıllı Asistan'a yapıştırın / WhatsApp toplu işlemeyle alın: kartlar <b>Gemini'siz, birebir</b> dolar; aynı kayıt iki kez gelirse atlanır.<br>
      Müşteri listesi değişince bağlantıyı yeniden gönderin.
    </div>
    <div class="card">
      <div class="field"><label>Şoför / operatör</label><select data-pid>${people.map((p) => `<option value="${esc(p.id)}" ${p.id === pid ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>
      <div class="field"><label>Bağlantı geçerliliği</label><select data-days><option value="30">30 gün</option><option value="90">90 gün</option><option value="180" selected>180 gün</option><option value="365">1 yıl</option></select></div>
      <div class="field"><label>Aracı (değiştirebilir)</label><select data-vid><option value="">— zimmetli aracı —</option>${vehicles.map((v) => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join("")}</select></div>
      <div class="row" style="gap:6px"><button class="btn primary grow" data-share>📤 WhatsApp'tan gönder</button><button class="btn grow" data-copy>Bağlantıyı kopyala</button></div>
      <div class="tiny muted" data-info style="margin-top:6px"></div>
    </div>`;
  if (!people.length) qs("[data-share]", root).disabled = qs("[data-copy]", root).disabled = true;
  const sec = await import("./security.js");
  const locked = await sec.lockEnabled();
  if (!locked) {
    qs("[data-share]", root).disabled = qs("[data-copy]", root).disabled = true;
    qs("[data-info]", root).insertAdjacentHTML("beforebegin", `<div class="notice warn" style="margin-top:8px"><div>Şoför bağlantısı göndermeden önce <b>yönetici kilidini</b> kurun. Böylece bağlantılar imzalı olur, şoför telefonu yönetici ekranına geçemez.<br><button class="btn sm primary" data-go="#/guvenlik" style="margin-top:6px">🛡 Kilidi kur</button></div></div>`);
  }
  const links = await sec.driverLinks();
  const currentLinks = links.filter(l => !l.revoked_at && l.exp >= todayStr());
  root.insertAdjacentHTML("beforeend", `<div class="card"><div class="row between"><b>Bağlantı kontrolü</b><span class="badge">${currentLinks.length} geçerli bağlantı</span></div>
    <p class="small muted">Yeni bağlantı üretmek eski bağlantıyı iptal etmez. Önce şoförün yenisini açtığını doğrulayın; kayıp telefon veya eski bağlantıyı Güvenlik ekranından iptal edin.</p>
    ${currentLinks.slice(0, 12).map(l => `<div class="row between small" style="gap:10px;margin:6px 0"><span>${esc(l.name)}</span><span>${esc(trDate(l.exp))} tarihine kadar</span></div>`).join("")}
    <button class="btn block" data-go="#/guvenlik">Güvenlik ve bağlantı iptali</button></div>`);
  let made = null; // aynı ekranda paylaş + kopyala aynı bağlantıyı kullansın
  const link = async () => {
    const p = people.find((x) => x.id === qs("[data-pid]", root).value);
    if (made && made.pid === p.id && made.vid === (qs("[data-vid]", root).value || null) && made.days === Number(qs("[data-days]", root).value)) return made.out;
    if (!(await sec.reauth("Şoför bağlantısı oluşturma: " + p.name))) throw new Error("Vazgeçildi");
    // Existing links remain valid until explicitly revoked in Security: a canceled share must not strand the driver.
    const { forDriver } = await sec.newDriverLink({ pid: p.id, name: p.name, vid: qs("[data-vid]", root).value || null, days: Number(qs("[data-days]", root)?.value) || 180 });
    const cfg = { ...core.driverConfig(d, { personnel_id: p.id, vehicle_id: qs("[data-vid]", root).value || null, company: COMPANY_NAME, issued: todayStr() }), ...forDriver, ts: Date.now() };
    // Ayrı şoför uygulaması: yönetici ekranları hiç yüklenmez; iPhone ana ekran simgesi bu adresi açar
    const url = location.origin + location.pathname.replace(/[^/]*$/, "") + "sofor.html?k=" + (await core.pack(cfg));
    qs("[data-info]", root).textContent = `İmzalı bağlantı · geçerlilik ${trDate(cfg.exp)} · ${cfg.C.length} müşteri, ${cfg.V.length} araç · ${url.length} karakter. Çıkış kodu: Güvenlik ekranında. Eski bağlantılar otomatik iptal edilmedi; kayıp telefon için Güvenlik ekranından iptal edin.`;
    made = { pid: p.id, days: Number(qs("[data-days]", root).value), vid: qs("[data-vid]", root).value || null, out: { p, url } };
    return made.out;
  };
  let creating = false;
  const setupBusy = value => { creating = value; for (const el of qsa("[data-share], [data-copy], [data-pid], [data-vid], [data-days]", root)) el.disabled = value; };
  qs("[data-share]", root).addEventListener("click", async () => {
    if (creating) return; setupBusy(true);
    try { const { p, url } = await link(); await shareText(`Merhaba ${p.name}, iş kayıtlarını buradan gir:\n${url}\n\nAndroid: bağlantıyı aç → Chrome menüsü (⋮) → "Ana ekrana ekle".\niPhone: bağlantıyı Safari'de aç → Paylaş (⬆) → "Ana Ekrana Ekle". Sonra ana ekrandaki "SAHAPRO Şoför" simgesinden aç.\nAkşam "Patrona gönder"e basman yeterli.`); } catch (e) { toast(e.message || String(e), "err"); } finally { setupBusy(false); }
  });
  qs("[data-copy]", root).addEventListener("click", async () => {
    if (creating) return; setupBusy(true);
    try { const { url } = await link(); await navigator.clipboard.writeText(url); toast("Kopyalandı", "ok"); } catch (e) { toast(e.message || String(e), "err"); } finally { setupBusy(false); }
  });
  return true;
}

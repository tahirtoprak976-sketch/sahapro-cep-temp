// Şoför ekranı (#/sofor) ve patron tarafında şoför bağlantısı (#/sofor-kur).
// Şoför telefonu "şoför modunda" yalnız bu ekranı gösterir; kayıtlar telefonda (localStorage + fotoğraflar Cache Storage) durur,
// "Patrona gönder" ile WhatsApp'tan okunur metin + SP1 kodu + fiş fotoğrafları gider. Patronun asistanı kodu Gemini'siz çözer.
import { qs, qsa, esc, appbar, toast, notice, todayStr, trDate, confirmDialog, shareText } from "./ui.js";
import { isActive, COMPANY_NAME } from "./core.js";

const K_MODE = "sp_driver", K_CFG = "sp_driver_cfg", K_ENT = "sp_driver_entries", PHOTO_CACHE = "sahapro-driver";
const ls = {
  get: (k, def = null) => { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast("Telefon hafızası dolu: eski kayıtları silin", "err"); } },
  del: (k) => { try { localStorage.removeItem(k); } catch (e) {} },
};
export const isDriverMode = () => ls.get(K_MODE) === 1;

async function putPhotos(id, files) {
  if (!("caches" in self) || !files.length) return 0;
  const c = await caches.open(PHOTO_CACHE);
  let i = 0;
  for (const f of files) await c.put(`./__drv/${id}-${i++}`, new Response(f, { headers: { "content-type": f.type || "image/jpeg", "x-name": encodeURIComponent(f.name || `fis-${id}-${i}.jpg`) } }));
  return i;
}
async function getPhotos(e) {
  if (!("caches" in self) || !e.ph) return [];
  const c = await caches.open(PHOTO_CACHE), out = [];
  for (let i = 0; i < e.ph; i++) { const r = await c.match(`./__drv/${e.id}-${i}`); if (r) { const b = await r.blob(); out.push(new File([b], decodeURIComponent(r.headers.get("x-name") || `fis-${i}.jpg`), { type: b.type || "image/jpeg" })); } }
  return out;
}
async function dropPhotos(e) { if ("caches" in self && e.ph) { const c = await caches.open(PHOTO_CACHE); for (let i = 0; i < e.ph; i++) await c.delete(`./__drv/${e.id}-${i}`); } }
// Fotoğrafı küçült (WhatsApp ve hafıza için)
async function shrinkPhoto(f) {
  try {
    const bmp = await createImageBitmap(f);
    const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    const b = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.8));
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
      if (cfg?.v !== 1 || !cfg.p) throw new Error("Bağlantı bozuk");
      const own = ((await db.dumpAll()).work_records || []).filter(isActive).length;
      if (own > 5 && !isDriverMode() && !(await confirmDialog("Bu telefon patron telefonu mu?", `Bu telefonda ${own} iş kaydı var. Şoför moduna geçerseniz yalnız şoför ekranı görünür (kayıtlar silinmez, istediğinizde çıkabilirsiniz).`, "Şoför moduna geç"))) { location.replace("#/"); return true; }
      ls.set(K_CFG, cfg); ls.set(K_MODE, 1);
      toast(`Hoş geldin ${cfg.p[1]}`, "ok");
    } catch (e) { root.innerHTML = appbar("Şoför Ekranı") + notice("danger", "Bağlantı açılamadı: " + (e.message || e) + ". Patrondan yeni bağlantı isteyin."); return true; }
    history.replaceState(null, "", location.pathname + "#/sofor");
  }
  const cfg = ls.get(K_CFG);
  if (!cfg) {
    root.innerHTML = appbar("Şoför Ekranı") + notice("info", "Bu ekran patronun WhatsApp'tan gönderdiği bağlantıyla açılır. Patron: Personel → kişi → 📲 Şoför bağlantısı.") +
      '<button class="btn block" data-go="#/">Ana sayfa</button>';
    return true;
  }
  const today = todayStr();
  let entries = ls.get(K_ENT, []).filter((e) => !e.sent || e.date >= new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10));
  const nm = (list, id) => (list || []).find((x) => x[0] === id)?.[1] || "";
  let tab = "is", photos = [];
  const st = { vid: ls.get("sp_driver_vid") || cfg.veh || "", cid: "", cn: "", sid: "", wt: core.DRIVER_TYPES[0], q: 1, u: "Sefer", ds: "", dn: "", ton: "", slip: "", note: "", mat: "", f: {} };
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
      <div class="small muted" data-phc>${photos.length ? photos.length + " fotoğraf eklendi" : ""}</div>
      <button class="btn primary block" data-addx style="${big};margin-top:8px">✓ Kaydet</button>
    </div>`;
  };
  const draw = () => {
    const unsent = entries.filter((e) => !e.sent), sent = entries.filter((e) => e.sent).slice(-15).reverse();
    const sites = (cfg.S || []).filter((s) => s[2] === st.cid);
    root.innerHTML = `
      <div class="card" style="margin-top:10px;background:#0f2238;color:#fff">
        <div class="row between"><div><div style="font-size:20px;font-weight:800">👷 ${esc(cfg.p[1])}</div><div class="small" style="opacity:.8">${esc(cfg.co || "")} · şoför ekranı</div></div><div style="font-size:28px">🚚</div></div>
        <select data-vid style="margin-top:8px;width:100%;${big};border-radius:10px;padding:6px 10px">${opt(cfg.V || [], st.vid, "— araç seçin —")}</select>
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
        <div class="small muted" data-phc>${photos.length ? photos.length + " fotoğraf eklendi" : ""}</div>
        <button class="btn primary block" data-add style="${big};margin-top:8px">✓ Kaydet</button>
      </div>` : tab === "ariza" || tab === "gider" ? xForm() : `<div class="card">
        <div class="field"><label>Tarih</label><input type="date" data-k="date" value="${esc(st.date || today)}" max="${today}"></div>
        <div class="field"><label>Litre</label><input type="number" inputmode="decimal" data-f="L" value="${esc(st.f.L ?? "")}" style="${big};font-size:22px;font-weight:800"></div>
        <div class="field"><label>Nereden?</label><div class="row" style="gap:6px;flex-wrap:wrap">${[["Depo Tankı", "Depodan"], ["Akaryakıt İstasyonu", "İstasyondan"], ["Müşteri Verdi", "Müşteri verdi"]].map(([v, t]) => `<button class="chip ${st.src === v ? "on" : ""}" data-src="${v}">${t}</button>`).join("")}</div></div>
        ${st.src === "Müşteri Verdi" ? `<div class="field"><label>Hangi müşteri?</label><select data-f="cid">${opt(cfg.C || [], st.f.cid || "", "— seçin —")}</select></div>` : ""}
        <div class="formgrid2">${st.src === "Akaryakıt İstasyonu" ? '<div class="field"><label>Tutar (TL)</label><input type="number" inputmode="decimal" data-f="tl" value="${esc(st.f.tl ?? "")}"></div>' : ""}
          <div class="field"><label>Km</label><input type="number" inputmode="numeric" data-f="km" value="${esc(st.f.km ?? "")}"></div>
          <div class="field"><label>Makine saati</label><input type="number" inputmode="decimal" data-f="hr" value="${esc(st.f.hr ?? "")}"></div></div>
        <button class="btn primary block" data-addf style="${big};margin-top:8px">✓ Kaydet</button>
      </div>`}
      <div class="section-title">Gönderilmemiş (${unsent.length})</div>
      ${unsent.map((e) => `<div class="card"><div class="row between"><span class="small">${esc(core.entryLine(e, cfg))}</span><button class="btn sm ghost" data-del="${esc(e.id)}">🗑</button></div></div>`).join("") || '<div class="muted small" style="padding:0 4px 8px">Gönderilecek kayıt yok.</div>'}
      ${unsent.length ? `<button class="btn block" data-send style="${big};background:#25d366;color:#fff;border:0;font-weight:800">📤 Patrona gönder (WhatsApp)</button>` : ""}
      ${sent.length ? `<details class="card" style="margin-top:10px"><summary class="small">Gönderilenler (${sent.length})</summary>${sent.map((e) => `<div class="tiny muted" style="margin-top:4px">✓ ${esc(core.entryLine(e, cfg))}</div>`).join("")}<button class="btn sm" style="margin-top:6px" data-resend>Son gönderileni tekrar gönder</button></details>` : ""}
      <details style="margin:14px 4px"><summary class="tiny muted">Ayarlar</summary><div class="tiny muted" style="margin:6px 0">Liste güncellemesi için patrondan yeni bağlantı isteyin. Bağlantı tarihi: ${esc(cfg.iss ? trDate(cfg.iss) : "—")}</div><button class="btn sm ghost" data-exit>Şoför modundan çık</button></details>`;
    bind();
  };
  const readForm = () => {
    for (const el of qsa("[data-k]", root)) st[el.dataset.k] = el.value;
    for (const el of qsa("[data-f]", root)) st.f[el.dataset.f] = el.value;
    for (const el of qsa("[data-x]", root)) x[el.dataset.x] = el.value;
    const vb = qs("[data-x-veh]", root); if (vb) x.noVeh = !vb.checked;
  };
  const save = () => ls.set(K_ENT, entries);
  const bind = () => {
    qs("[data-vid]", root).addEventListener("change", (e) => { st.vid = e.target.value; ls.set("sp_driver_vid", st.vid); });
    for (const b of qsa("[data-tab]", root)) b.addEventListener("click", () => { readForm(); tab = b.dataset.tab; draw(); });
    qs("[data-cid]", root)?.addEventListener("change", (e) => { readForm(); st.cid = e.target.value; st.sid = ""; draw(); });
    qs("[data-ds]", root)?.addEventListener("change", (e) => { readForm(); st.ds = e.target.value; draw(); });
    for (const b of qsa("[data-wt]", root)) b.addEventListener("click", () => { readForm(); st.wt = b.dataset.wt; if (/Makine|Kazı|Yükleme/.test(st.wt) && st.u === "Sefer") st.u = "Saat"; else if (/Nakliye/.test(st.wt) && st.u === "Saat") st.u = "Sefer"; draw(); });
    for (const b of qsa("[data-u]", root)) b.addEventListener("click", () => { readForm(); st.u = b.dataset.u; draw(); });
    for (const b of qsa("[data-src]", root)) b.addEventListener("click", () => { readForm(); st.src = b.dataset.src; draw(); });
    for (const b of qsa("[data-q]", root)) b.addEventListener("click", () => { readForm(); st.q = Math.max(0, (Number(st.q) || 0) + Number(b.dataset.q)); draw(); });
    qs("[data-photo]", root)?.addEventListener("change", async (e) => { for (const f of e.target.files) photos.push(await shrinkPhoto(f)); qs("[data-phc]", root).textContent = photos.length + " fotoğraf eklendi"; });
    qs("[data-add]", root)?.addEventListener("click", async () => {
      readForm();
      const q = Number(String(st.q).replace(",", "."));
      if (!st.vid) return toast("Araç seçin", "err");
      if (!st.cid || (st.cid === "__new" && !st.cn.trim())) return toast("Müşteri seçin", "err");
      if (!(q > 0)) return toast("Miktar yazın", "err");
      if (/Nakliye/.test(st.wt) && st.u === "Saat" && !(await confirmDialog("Birim saat mi?", `${st.wt} genelde sefer olur. ${q} SAAT olarak mı kaydedilsin?`, "Evet, saat"))) return;
      const e = { id: core.newId(), date: st.date || today, vid: st.vid, wt: st.wt, q, u: st.u,
        ...(st.cid === "__new" ? { cn: st.cn.trim() } : { cid: st.cid }), ...(st.sid ? { sid: st.sid } : {}),
        ...(st.ds && st.ds !== "__new" ? { ds: st.ds } : st.ds === "__new" && st.dn.trim() ? { dn: st.dn.trim() } : {}),
        ...(Number(st.ton) > 0 ? { ton: Number(String(st.ton).replace(",", ".")) } : {}), ...(st.slip.trim() ? { slip: st.slip.trim() } : {}),
        ...(st.mat.trim() ? { mat: st.mat.trim() } : {}), ...(st.note.trim() ? { note: st.note.trim() } : {}) };
      e.ph = await putPhotos(e.id, photos);
      if (!e.ph) delete e.ph;
      entries.push(e); save();
      photos = []; Object.assign(st, { q: 1, ton: "", slip: "", note: "" });
      toast("Kaydedildi", "ok"); draw();
    });
    for (const b of qsa("[data-x-kind]", root)) b.addEventListener("click", () => { readForm(); if (tab === "ariza") x.mt = b.dataset.xKind; else { x.cat = b.dataset.xKind; if (x.cat === "Yemek") x.noVeh = true; } draw(); });
    for (const b of qsa("[data-x-st]", root)) b.addEventListener("click", () => { readForm(); x.st = b.dataset.xSt; draw(); });
    for (const b of qsa("[data-x-pay]", root)) b.addEventListener("click", () => { readForm(); x.pay = b.dataset.xPay; draw(); });
    qs("[data-x-sup]", root)?.addEventListener("change", (e) => { readForm(); x.sup = e.target.value; draw(); });
    qs("[data-addx]", root)?.addEventListener("click", async () => {
      readForm();
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
      e.ph = await putPhotos(e.id, photos);
      if (!e.ph) delete e.ph;
      entries.push(e); save();
      photos = []; Object.keys(x).forEach((k) => delete x[k]);
      toast("Kaydedildi", "ok"); draw();
    });
    qs("[data-addf]", root)?.addEventListener("click", () => {
      readForm();
      const f = Object.fromEntries(qsa("[data-f]", root).map((el) => [el.dataset.f, el.value]));
      const L = Number(String(f.L).replace(",", "."));
      if (!st.vid) return toast("Araç seçin", "err");
      if (!(L > 0)) return toast("Litre yazın", "err");
      if (!st.src) return toast("Nereden aldığınızı seçin", "err");
      if (st.src === "Müşteri Verdi" && !f.cid) return toast("Müşteriyi seçin", "err");
      entries.push({ id: core.newId(), k: "f", date: st.date || today, vid: st.vid, L, src: st.src, ...(f.cid ? { cid: f.cid } : {}), ...(Number(f.tl) > 0 ? { tl: Number(f.tl) } : {}), ...(Number(f.km) > 0 ? { km: Number(f.km) } : {}), ...(Number(f.hr) > 0 ? { hr: Number(f.hr) } : {}) });
      st.f = {}; save(); toast("Kaydedildi", "ok"); draw();
    });
    for (const b of qsa("[data-del]", root)) b.addEventListener("click", async () => {
      const e = entries.find((x) => x.id === b.dataset.del);
      if (!(await confirmDialog("Silinsin mi?", core.entryLine(e, cfg), "Sil", true))) return;
      await dropPhotos(e); entries = entries.filter((x) => x !== e); save(); draw();
    });
    const send = async (list) => {
      const text = await core.driverMessage(list, cfg);
      const files = []; for (const e of list) files.push(...(await getPhotos(e)));
      let ok = false;
      try {
        if (files.length && navigator.canShare?.({ files, text })) { await navigator.share({ text, files }); ok = true; }
        else if (navigator.share) { await navigator.share({ text }); ok = true; if (files.length) toast("Fotoğraflar eklenemedi; fişleri ayrıca gönderin", "err"); }
        else { location.href = "https://wa.me/?text=" + encodeURIComponent(text); ok = true; }
      } catch (e) { if (e?.name !== "AbortError") toast("Paylaşılamadı: " + (e.message || e), "err"); }
      return ok;
    };
    qs("[data-send]", root)?.addEventListener("click", async () => {
      const list = entries.filter((e) => !e.sent);
      if (await send(list)) {
        const at = new Date().toISOString();
        for (const e of list) { e.sent = at; }
        save();
        for (const e of list) await dropPhotos(e).catch(() => {});
        toast("Gönderildi ✓", "ok"); draw();
      }
    });
    qs("[data-resend]", root)?.addEventListener("click", async () => {
      const last = entries.filter((e) => e.sent).map((e) => e.sent).sort().at(-1);
      await send(entries.filter((e) => e.sent === last));
    });
    qs("[data-exit]", root)?.addEventListener("click", async () => {
      if (!(await confirmDialog("Şoför modundan çıkılsın mı?", "Bu telefon patron telefonu olarak açılır. Gönderilmemiş kayıtlar telefonda kalır.", "Çık"))) return;
      ls.del(K_MODE); location.replace("#/");
    });
  };
  draw();
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
      3. Şoför seferleri, mazotu ve fiş fotoğrafını girer, akşam <b>Patrona gönder</b>'e basar (size ya da gruba).<br>
      4. Mesajı SAHAPRO'ya paylaşın ya da Akıllı Asistan'a yapıştırın / WhatsApp toplu işlemeyle alın: kartlar <b>Gemini'siz, birebir</b> dolar; aynı kayıt iki kez gelirse atlanır.<br>
      Müşteri listesi değişince bağlantıyı yeniden gönderin.
    </div>
    <div class="card">
      <div class="field"><label>Şoför / operatör</label><select data-pid>${people.map((p) => `<option value="${esc(p.id)}" ${p.id === pid ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>
      <div class="field"><label>Aracı (değiştirebilir)</label><select data-vid><option value="">— zimmetli aracı —</option>${vehicles.map((v) => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join("")}</select></div>
      <div class="row" style="gap:6px"><button class="btn primary grow" data-share>📤 WhatsApp'tan gönder</button><button class="btn grow" data-copy>Bağlantıyı kopyala</button></div>
      <div class="tiny muted" data-info style="margin-top:6px"></div>
    </div>`;
  if (!people.length) qs("[data-share]", root).disabled = qs("[data-copy]", root).disabled = true;
  const link = async () => {
    const p = people.find((x) => x.id === qs("[data-pid]", root).value);
    const cfg = core.driverConfig(d, { personnel_id: p.id, vehicle_id: qs("[data-vid]", root).value || null, company: COMPANY_NAME, issued: todayStr() });
    const url = location.origin + location.pathname + "#/sofor?k=" + (await core.pack(cfg));
    qs("[data-info]", root).textContent = `${cfg.C.length} müşteri, ${cfg.V.length} araç, ${cfg.D.length} döküm yeri · bağlantı ${url.length} karakter`;
    return { p, url };
  };
  qs("[data-share]", root).addEventListener("click", async () => {
    try { const { p, url } = await link(); shareText(`Merhaba ${p.name}, iş kayıtlarını buradan gir:\n${url}\n\nAçılınca tarayıcı menüsünden "Ana ekrana ekle" de. Akşam "Patrona gönder"e basman yeterli.`); } catch (e) { toast(e.message || String(e), "err"); }
  });
  qs("[data-copy]", root).addEventListener("click", async () => {
    try { const { url } = await link(); await navigator.clipboard.writeText(url); toast("Kopyalandı", "ok"); } catch (e) { toast(e.message || String(e), "err"); }
  });
  return true;
}

// Asistan ekranı: mesaj yaz/yapıştır + fiş fotoğrafı ekle → Gemini işletmeni tanıyarak işleri,
// giderleri, yakıtı çıkarır → doğrulanmış kartlar → tek dokunuşla kaydet. Yeni müşteri/şantiye,
// fişin fotoğrafı ve kaynak mesaj kayda birlikte yazılır. Doğrulamadan geçmeyen satır işaretsiz gelir.
import { qs, qsa, esc, appbar, toast, notice, confirmDialog, fmtTL, todayStr } from "./ui.js";
import { WORK_TYPES, EXPENSE_CATEGORIES, MAINT_TYPES, MAINT_STATUS, PERSONNEL_EVENT_TYPES, isActive } from "./core.js";
import { documentOwner } from "./business.js";
import { validateTickets, validateDocuments, heardText, ASSIST_DOC_TYPES, NO_EXPIRY } from "./assistant-docs.js";
import { occupationOnly } from "./assistant-core.js";
import { planTotals, applyFuelPay } from "./assistant-rules.js";
import { assistantContext, assistantSystem, validatePlan, validateExtras, validateCards, validateMemory, businessFacts, checkAnswer, ASSIST_UNITS, assistantSchema, pickExamples, addExample, measureCorrection, addQuality } from "./assistant-core.js";

const opt = (list, val, empty = "— seçin —") =>
  `<option value="">${esc(empty)}</option>` +
  list.map(([v, t]) => `<option value="${esc(v)}" ${v === val ? "selected" : ""}>${esc(t)}</option>`).join("");

export async function screen(ctx) {
  if (ctx.parts[0] !== "akilli-asistan") return false;
  if (ctx.parts[1] && (await (await import("./assistant-tools.js")).screen(ctx))) return true;
  const { root, db } = ctx;
  const { geminiSettings } = await import("./ai-gemini.js");
  const g = await geminiSettings(db);
  root.innerHTML =
    appbar("Akıllı Asistan", "Gemini · işletmenizi tanır") +
    `<div style="height:10px"></div>
    ${g.ready ? notice("info", "Mesajı yazın veya WhatsApp'tan yapıştırın, fiş fotoğraflarını ekleyin. Gemini müşteri, şantiye ve araç listenizi bilerek okur. Kaydetmeden önce kartları kontrol edin; şüpheli satırlar işaretsiz gelir.") : notice("warn", "Önce Ayarlar → Yapay Zeka'da Gemini anahtarını kaydedin.") + '<button class="btn block" data-go="#/yapay-zeka">Yapay Zeka Ayarları</button>'}
    <div class="row" style="gap:6px;margin-bottom:8px"><button class="btn grow" data-go="#/akilli-asistan/ozet">📝 Gün Sonu Özeti</button><button class="btn grow" data-go="#/akilli-asistan/soru">❓ Soru Sor</button></div>
    <div class="card">
      <div class="field"><label>Mesaj</label><textarea data-msg rows="5" placeholder="Örn: Mahir bey 14 tonluk yarım yevmiye, 34 ABC 123 Kaya İnşaat 4 sefer moloz, lastikçiye 500 veresiye"></textarea></div>
      <div class="field"><label>Fiş / döküm fişi / belge fotoğrafı veya ses kaydı (isteğe bağlı)</label><input type="file" accept="image/*,audio/*" multiple data-photos></div>
      <button class="btn block" data-rec ${g.ready ? "" : "disabled"}>🎤 Sesli not kaydet</button>
      <div class="row" style="gap:6px;flex-wrap:wrap" data-thumbs></div>
      <button class="btn primary block" style="margin-top:10px" data-ask ${g.ready ? "" : "disabled"}>🤖 Asistana Gönder</button>
    </div>
    <div data-out></div>`;
  const photosIn = qs("[data-photos]", root), msgEl = qs("[data-msg]", root);
  let files = [];
  const isAudio = (f) => /^audio\//.test(f.type) || /\.(m4a|mp3|ogg|opus|wav|aac|webm|amr)$/i.test(f.name || "");
  const showThumbs = () => {
    const box = qs("[data-thumbs]", root);
    box.innerHTML = files
      .map((f, i) => isAudio(f)
        ? `<div class="card" style="margin:0;padding:6px;width:100%"><div class="small">🎤 Ses kaydı ${esc(f.name || "")} <button class="btn small" data-rm="${i}">Sil</button></div><audio controls src="${URL.createObjectURL(f)}" style="width:100%"></audio></div>`
        : `<img src="${URL.createObjectURL(f)}" alt="Fiş ${i + 1}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">`)
      .join("");
    for (const b of qsa("[data-rm]", box)) b.addEventListener("click", () => { files.splice(Number(b.dataset.rm), 1); showThumbs(); });
  };
  photosIn.addEventListener("change", () => {
    files = [...files.filter((f) => f._rec), ...photosIn.files].slice(0, 10);
    showThumbs();
  });
  // Sesli not: telefonun mikrofonu ile kayıt (en çok 3 dakika)
  let rec = null, recT = null;
  qs("[data-rec]", root).addEventListener("click", async (ev) => {
    const b = ev.currentTarget;
    if (rec) return rec.stop();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return toast("Bu tarayıcı ses kaydını desteklemiyor; WhatsApp sesli mesajını dosya olarak ekleyin", "err");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported?.(t)) || "";
      rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        clearTimeout(recT);
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: (rec.mimeType || type || "audio/webm").split(";")[0] });
        rec = null;
        b.textContent = "🎤 Sesli not kaydet";
        if (blob.size < 500) return toast("Kayıt boş", "err");
        const f = new File([blob], "sesli-not-" + new Date().toTimeString().slice(0, 5).replace(":", "") + "." + (blob.type.split("/")[1] || "webm"), { type: blob.type });
        f._rec = true;
        files = [...files, f].slice(0, 10);
        showThumbs();
      };
      rec.start();
      b.textContent = "⏹ Kaydı bitir";
      recT = setTimeout(() => rec?.stop(), 180000);
    } catch (e) {
      rec = null;
      toast("Mikrofon izni verilmedi", "err");
    }
  });
  // WhatsApp'tan "Paylaş" ile gelen metin / fotoğraflar
  if (ctx.query?.shared && "caches" in self) {
    try {
      const cache = await caches.open("sahapro-share");
      const t = await cache.match("./__share/text");
      if (t) msgEl.value = await t.text();
      for (let i = 0; i < 10; i++) {
        const r = await cache.match(`./__share/file-${i}`);
        if (!r) break;
        const b = await r.blob();
        files.push(new File([b], decodeURIComponent(r.headers.get("x-name") || "foto.jpg"), { type: b.type || r.headers.get("content-type") || "image/jpeg" }));
      }
      await caches.delete("sahapro-share");
      showThumbs();
      if (msgEl.value || files.length) toast("Paylaşılan içerik alındı", "ok");
    } catch (e) {}
  }
  // Yarım kalan mesaj saklanır (internet yoksa veya ekran kapanırsa kaybolmaz)
  if (!msgEl.value) msgEl.value = (await db.metaGet("assistant_draft")) || "";
  let draftT = null;
  msgEl.addEventListener("input", () => {
    clearTimeout(draftT);
    draftT = setTimeout(() => db.metaSet("assistant_draft", msgEl.value), 500);
  });
  qs("[data-ask]", root).addEventListener("click", async () => {
    const message = qs("[data-msg]", root).value.trim();
    if (!message && !files.length) return toast("Mesaj yazın, fotoğraf veya ses ekleyin", "err");
    if (rec) return toast("Önce ses kaydını bitirin", "err");
    const images = files.filter((f) => !isAudio(f)), audios = files.filter(isAudio);
    await db.metaSet("assistant_draft", message);
    if (!navigator.onLine) return toast("İnternet yok. Mesaj saklandı; internet gelince tekrar Gönder'e basın.", "err");
    const out = qs("[data-out]", root), btn = qs("[data-ask]", root);
    btn.disabled = true;
    out.innerHTML = '<div class="muted small" style="padding:10px">Gemini okuyor…</div>';
    try {
      const { geminiJson, blobToBase64, shrink, audioToWav } = await import("./ai-gemini.js");
      const d = await db.dumpAll();
      const today = todayStr();
      const facts = await businessFacts(d, today);
      const negatives = (await db.metaGet("ai_negative_aliases")) || [];
      const examples = pickExamples((await db.metaGet("ai_examples")) || [], message, 3);
      const parts = [
        { text: "İşletme kartları (JSON):\n" + JSON.stringify(assistantContext(d, today, message)) },
        { text: "facts (yerelde hesaplanmış güncel rakamlar; sorulara yalnız bunlarla cevap ver):\n" + JSON.stringify(facts) },
        ...(negatives.length ? [{ text: "not_aliases:\n" + JSON.stringify(negatives.slice(0, 50).map((x) => [x.alias, x.target_type, x.target_id])) }] : []),
        ...(examples.length ? [{ text: "examples (onaylı):\n" + examples.map((e) => `<mesaj>${e.msg}</mesaj> → ${e.out}`).join("\n") }] : []),
      ];
      for (const f of images) {
        const img = await shrink(f);
        parts.push({ inlineData: { mimeType: img.type || "image/jpeg", data: await blobToBase64(img) } });
      }
      for (const f of audios) {
        const a = await audioToWav(f);
        if (a.size > 15e6) throw new Error("Ses kaydı çok uzun; 3 dakikadan kısa kaydedin");
        parts.push({ inlineData: { mimeType: (a.type || "audio/ogg").split(";")[0], data: await blobToBase64(a) } });
      }
      parts.push({ text: `Fotoğraf sayısı: ${images.length} (sıra 0'dan başlar)${audios.length ? `\nSes kaydı: ${audios.length} (fotoğraflardan sonra gelir; heard_text'e yaz)` : ""}\n<mesaj>\n${(message || (audios.length ? "(mesaj yok, sesli not)" : "(mesaj yok, yalnız fotoğraflar)")).replace(/<\/?mesaj>/gi, "")}\n</mesaj>` });
      const t0 = Date.now();
      const { withModelFallback } = await import("./ai-gemini.js");
      const { effectiveRules } = await import("./assistant-rules.js");
      const system = assistantSystem(effectiveRules(await db.metaGet("assistant_rules")));
      const plan = await withModelFallback(db, (o) => geminiJson(parts, { ...o, system, schema: assistantSchema() }), {
        onSwitch: (a, b) => toast(`Gemini modeli değişti: ${a} → ${b} (ücretsiz kota için)`, "ok"),
      });
      // Sesli notta Gemini'nin duyduğu metin mesaj yerine geçer; kullanıcıya gösterilir, sayılar onunla doğrulanır
      const heard = audios.length ? heardText(plan) : "";
      const vmsg = [message, heard].filter(Boolean).join("\n");
      const v = validatePlan(plan, { message: vmsg, d, today, photoCount: images.length, negatives });
      Object.assign(v, validateExtras(plan, { message: vmsg, d, today, photoTexts: v.photoTexts }));
      v.cards = validateCards(plan, { message: vmsg, d, photoTexts: v.photoTexts });
      v.memory = validateMemory(plan, { message: vmsg, d });
      v.tickets = validateTickets(plan, { d, today, photoTexts: v.photoTexts, photoCount: images.length });
      v.docs = validateDocuments(plan, { d, today, photoTexts: v.photoTexts, photoCount: images.length });
      v.heard = heard;
      v.audioMissing = audios.length > 0 && !heard;
      v.answer = typeof plan.answer === "string" && plan.answer.trim() ? plan.answer.trim().slice(0, 1500) : null;
      v.answerBad = checkAnswer(v.answer, facts);
      render(ctx, out, v, d, { message: vmsg, files: images, ms: Date.now() - t0 });
    } catch (e) {
      out.innerHTML = notice("warn", e.message || String(e));
    }
    btn.disabled = false;
  });
  return true;
}

// Araç / müşteri toplamları (kesin = işaretli satırlar) ve teyit gerekenler
function summaryHtml(v, d) {
  if (v.works.length < 2) return "";
  const t = planTotals(v.works, d);
  const line = (x) => `<div class="small">• <b>${esc(x.name)}</b>: ${esc(x.sure || "—")}${x.unsure ? ` <span class="muted">(+ teyit bekleyen ${esc(x.unsure)})</span>` : ""}</div>`;
  const todo = v.works.map((r, i) => (r.ok ? null : `${i + 1}. iş: ${r.issues.filter((x) => !/zimmetli aracı/.test(x)).join(" · ") || "eksik alan"}`)).filter(Boolean);
  return `<div class="card"><div class="strong small">Toplamlar (kesin olanlar)</div>${t.vehicles.map(line).join("")}<div class="divider"></div>${t.customers.map(line).join("")}
    ${todo.length ? `<div class="strong small" style="margin-top:8px">Teyit gerekenler (${todo.length})</div>${todo.map((x) => `<div class="tiny muted">${esc(x)}</div>`).join("")}` : ""}</div>`;
}

function render(ctx, out, v, d, { message, files, ms }) {
  const live = (s) => (d[s] || []).filter(isActive);
  const customers = live("customers").map((c) => [c.id, c.name]);
  const vehicles = live("vehicles").map((x) => [x.id, x.name]);
  const sites = live("sites");
  const suppliers = live("suppliers").map((s) => [s.id, s.name]);
  const issues = (r) => (r.issues.length ? `<div class="muted tiny" style="margin-top:4px">⚠ ${esc(r.issues.join(" · "))}</div>` : "");
  const total = v.works.length + v.expenses.length + v.fuel.length + v.collections.length + v.maintenance.length + v.personnel.length + v.edits.length + v.cards.length + v.memory.length + v.tickets.length + v.docs.length + v.tankIn.length;
  const KIND_TR = { customers: "Müşteri", sites: "Şantiye", vehicles: "Araç / makine", personnel: "Personel", suppliers: "Esnaf / tedarikçi", quarries: "Malzeme ocağı", dump_sites: "Döküm / dolgu sahası" };
  const quarries = live("quarries").map((x) => [x.id, x.name]);
  const personnel = live("personnel").map((p) => [p.id, p.name]);
  const dumpSites = live("dump_sites").map((x) => [x.id, x.name]);
  const banks = live("bank_accounts").map((b) => [b.id, b.name || b.bank_name || "Banka"]);
  const nameOf = (s, id) => (d[s] || []).find((x) => x.id === id)?.name || id || "—";
  out.innerHTML =
    `<div class="section-title">Asistanın bulduğu (${total}) · ${(ms / 1000).toFixed(1)} sn</div>` +
    summaryHtml(v, d) +
    (v.answer ? `<div class="card"><div class="strong small">🤖 Cevap</div><div style="white-space:pre-wrap;margin-top:6px">${esc(v.answer)}</div>${v.answerBad.length ? notice("warn", "Bu sayılar kayıtlarınızda bulunamadı, güvenmeyin: " + v.answerBad.join(", ")) : '<div class="muted tiny" style="margin-top:6px">Rakamlar telefondaki kayıtlarınızdan hesaplandı.</div>'}</div>` : "") +
    (v.heard ? `<div class="card"><div class="strong small">🎤 Gemini'nin duyduğu</div><div style="white-space:pre-wrap;margin-top:6px">${esc(v.heard)}</div><div class="muted tiny" style="margin-top:6px">Rakamlar bu metinle kontrol edildi. Yanlış duyduysa mesaj kutusuna düzeltip tekrar gönderin.</div></div>` : "") +
    (v.audioMissing ? notice("warn", "Ses kaydı anlaşılamadı. Daha yakından ve sessiz bir yerde tekrar kaydedin.") : "") +
    v.questions.map((q) => notice("info", "Soru: " + q)).join("") +
    v.memory
      .map((r, i) => `<div class="card" data-kind="memory" data-i="${i}">
        <label class="history-check"><input type="checkbox" data-pick ${r.ok ? "checked" : ""}> <b>🧠 Hafızaya ekle</b></label>
        <div class="small">"${esc(r.alias)}" dendiğinde → <b>${esc(r.target_name || "?")}</b></div>${issues(r)}</div>`)
      .join("") +
    (v.cards.length ? `<div class="section-title">Yeni kartlar (${v.cards.filter((c) => c.ok).length}/${v.cards.length})</div>` : "") +
    v.cards
      .map((r, i) => `<div class="card" data-kind="card" data-i="${i}">
        <label class="history-check"><input type="checkbox" data-pick ${r.ok ? "checked" : ""}> <b>${esc(KIND_TR[r.kind])}</b></label>
        <div class="formgrid2">
          <div class="field"><label>Ad</label><input name="name" value="${esc(r.name)}"></div>
          ${r.kind === "vehicles" ? `<div class="field"><label>Plaka</label><input name="plate" value="${esc(r.data.plate || "")}"></div><div class="field"><label>Tür</label><input name="type" value="${esc(r.data.type || "")}"></div>` : ""}
          ${["customers", "personnel", "suppliers"].includes(r.kind) ? `<div class="field"><label>Telefon</label><input name="phone" value="${esc(r.data.phone || "")}"></div>` : ""}
          ${r.kind === "sites" ? `<div class="field"><label>Müşteri</label><select name="customer">${opt([...customers, ...(r.data.customer_name ? [["new:" + r.data.customer_name, "➕ " + r.data.customer_name + " (listede yeni)"]] : [])], r.data.customer_id || (r.data.customer_name ? "new:" + r.data.customer_name : ""))}</select></div>` : ""}
        </div>${issues(r)}</div>`)
      .join("") +
    (v.newCustomers.length ? notice("warn", "Yeni müşteri kartı açılacak: " + v.newCustomers.join(", ")) : "") +
    v.works
      .map((r, i) => {
        const parentName = r.new_customer_parent_id ? nameOf("customers", r.new_customer_parent_id) : "";
        const custOpts = [...customers, ...(r.new_customer ? [["new:" + r.new_customer, "➕ Yeni: " + r.new_customer + (parentName ? ` (${parentName} taşeronu)` : "")]] : [])];
        const siteOpts = sites.filter((s) => !r.customer_id || s.customer_id === r.customer_id).map((s) => [s.id, s.name]);
        return `<div class="card" data-kind="work" data-i="${i}">
        <label class="history-check"><input type="checkbox" data-pick ${r.ok ? "checked" : ""}> <b>İş</b> ${r.guessed ? "· tahmin içeriyor" : ""}</label>
        <div class="formgrid2">
          <div class="field"><label>Tarih</label><input type="date" name="date" value="${esc(r.date)}"></div>
          <div class="field"><label>Müşteri</label><select name="customer">${opt(custOpts, r.customer_id || (r.new_customer ? "new:" + r.new_customer : ""))}</select></div>
          <div class="field"><label>Şantiye</label><select name="site">${opt([...siteOpts, ...(r.new_site ? [["new:" + r.new_site, "➕ Yeni: " + r.new_site]] : [])], r.site_id || (r.new_site ? "new:" + r.new_site : ""), "— yok —")}</select></div>
          <div class="field"><label>Araç</label><select name="vehicle">${opt(vehicles, r.vehicle_id)}</select></div>
          <div class="field"><label>İş türü</label><select name="work_type">${opt(WORK_TYPES.map((x) => [x, x]), r.work_type)}</select></div>
          <div class="field"><label>Miktar</label><input type="number" step="any" name="quantity" value="${r.quantity ?? ""}"></div>
          <div class="field"><label>Birim</label><select name="unit">${opt(ASSIST_UNITS.map((x) => [x, x]), r.unit)}</select></div>
          <div class="field"><label>Operatör / şoför</label><select name="personnel">${opt(personnel, r.personnel_id, "— yok —")}</select></div>
          <div class="field"><label>Malzeme</label><input name="material" value="${esc(r.material || "")}" placeholder="moloz, kum, mıcır…"></div>
          <div class="field"><label>Malzeme ocağı</label><select name="quarry">${opt([...quarries, ...(r.new_quarry ? [["new:" + r.new_quarry, "➕ Yeni ocak: " + r.new_quarry]] : [])], r.quarry_id || (r.new_quarry ? "new:" + r.new_quarry : ""), "— yok —")}</select></div>
          <div class="field"><label>Döküm / dolgu yeri</label><select name="dump_site">${opt([...dumpSites, ...(r.new_dump_site ? [["new:" + r.new_dump_site, "➕ Yeni döküm yeri: " + r.new_dump_site]] : [])], r.dump_site_id || (r.new_dump_site ? "new:" + r.new_dump_site : ""), "— yok —")}</select></div>
          <div class="field"><label>Birim fiyat (₺, boşsa fiyat listesi)</label><input type="number" step="any" name="unit_price" value="${r.unit_price ?? ""}"></div>
          <div class="field"><label>Alındığı yer</label><input name="from_place" value="${esc(r.from_place || "")}" placeholder="ocak / saha"></div>
          <div class="field"><label>Teslim yeri</label><input name="to_place" value="${esc(r.to_place || "")}" placeholder="şantiye / dolgu"></div>
          <div class="field"><label>Fiş no</label><input name="slip_no" value="${esc(r.slip_no || "")}"></div>
        </div>
        ${r.reporter ? `<div class="muted tiny">Bildiren: ${esc(r.reporter)}</div>` : ""}
        ${r.fuelAllowance ? `<div class="small" style="margin-top:4px">⛽ ${esc(r.fuelAllowance.customer)} sefer başı ${r.fuelAllowance.per} L mazot verir → bu iş için <b>${r.fuelAllowance.liters} L</b> mazot hak edildi → müşterinin mazot hesabına eklenir (ücret yalnız mazotsa hakedişe 0 ₺ yazılır)</div>` : ""}
        <div class="field"><label>İş açıklaması</label><textarea name="description" rows="2">${esc(r.description || "")}</textarea></div>
        ${r.ambiguous ? `<div class="small" style="margin-top:6px">❓ Kime çalışıldı?</div><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:4px">${r.ambiguous.map((a) => `<button class="chip" data-pickcust="${esc(a.id)}" title="${esc(a.why || "")}">${esc(a.name)}${a.why ? " ★" : ""}</button>`).join("")}</div>` : ""}${issues(r)}</div>`;
      })
      .join("") +
    v.tickets
      .map((r, i) => {
        const linkOpts = [...r.works.map((id) => { const w = d.work_records.find((x) => x.id === id); return [id, `Mevcut: ${nameOf("customers", w.customer_id)} · ${w.quantity} sefer`]; }), ["new", "➕ Yeni 1 sefer iş aç"]];
        return `<div class="card" data-kind="ticket" data-i="${i}">
        <label class="history-check"><input type="checkbox" data-pick ${r.ok ? "checked" : ""}> <b>🧾 Döküm / kantar fişi</b></label>
        ${files[r.photo] ? `<img src="${URL.createObjectURL(files[r.photo])}" alt="Döküm fişi" style="width:100%;max-height:200px;object-fit:contain;border-radius:8px;margin:6px 0">` : ""}
        <div class="formgrid2">
          <div class="field"><label>Fiş no</label><input name="ticket_no" value="${esc(r.ticket_no)}"></div>
          <div class="field"><label>Tarih</label><input type="date" name="date" value="${esc(r.date)}"></div>
          <div class="field"><label>Araç</label><select name="vehicle">${opt(vehicles, r.vehicle_id)}</select></div>
          <div class="field"><label>Net ton</label><input type="number" step="any" name="tonnage" value="${r.tonnage ?? ""}"></div>
          <div class="field"><label>Döküm yeri</label><select name="dump_site">${opt(dumpSites, r.dump_site_id, r.dump_site_name ? "— " + r.dump_site_name + " (listede yok) —" : "— yok —")}</select></div>
          <div class="field"><label>Bağlanacak iş</label><select name="link">${opt(linkOpts, r.link, "— seçin —")}</select></div>
          <div class="field"><label>Müşteri (yeni iş için)</label><select name="customer">${opt(customers, r.customer_id)}</select></div>
          <div class="field"><label>İş türü (yeni iş için)</label><select name="work_type">${opt(WORK_TYPES.map((x) => [x, x]), WORK_TYPES.includes("Hafriyat Nakliye") ? "Hafriyat Nakliye" : WORK_TYPES[0])}</select></div>
        </div>${issues(r)}</div>`;
      })
      .join("") +
    v.docs
      .map((r, i) => {
        const owners = [...vehicles.map(([id, n]) => ["vehicle:" + id, "🚚 " + n]), ...personnel.map(([id, n]) => ["personnel:" + id, "👤 " + n])];
        return `<div class="card" data-kind="doc" data-i="${i}">
        <label class="history-check"><input type="checkbox" data-pick ${r.ok ? "checked" : ""}> <b>📄 Belge</b> · bitiş tarihi takibe alınır</label>
        ${files[r.photo] ? `<img src="${URL.createObjectURL(files[r.photo])}" alt="Belge" style="width:100%;max-height:200px;object-fit:contain;border-radius:8px;margin:6px 0">` : ""}
        <div class="formgrid2">
          <div class="field"><label>Belge türü</label><select name="category">${opt(ASSIST_DOC_TYPES.map((x) => [x, x]), r.category)}</select></div>
          <div class="field"><label>Sahibi</label><select name="owner">${opt(owners, r.owner_id ? r.owner_type + ":" + r.owner_id : "")}</select></div>
          <div class="field"><label>Belge no</label><input name="doc_no" value="${esc(r.doc_no)}"></div>
          <div class="field"><label>Düzenleme tarihi</label><input type="date" name="date" value="${esc(r.date || "")}"></div>
          <div class="field"><label>Bitiş tarihi</label><input type="date" name="expiry_date" value="${esc(r.expiry_date || "")}"></div>
        </div>${issues(r)}</div>`;
      })
      .join("") +
    v.expenses
      .map((r, i) => `<div class="card" data-kind="expense" data-i="${i}">
        <label class="history-check"><input type="checkbox" data-pick ${r.ok ? "checked" : ""}> <b>Gider</b>${r.photo != null ? " · fiş fotoğrafı eklenecek" : ""}</label>
        ${r.photo != null && files[r.photo] ? `<img src="${URL.createObjectURL(files[r.photo])}" alt="Fiş" style="width:100%;max-height:200px;object-fit:contain;border-radius:8px;margin:6px 0">` : ""}
        <div class="formgrid2">
          <div class="field"><label>Tarih</label><input type="date" name="date" value="${esc(r.date)}"></div>
          <div class="field"><label>Tutar (₺)</label><input type="number" step="any" name="amount" value="${r.amount ?? ""}"></div>
          <div class="field"><label>Kategori</label><select name="category">${opt(EXPENSE_CATEGORIES.map((x) => [x, x]), r.category, "Diğer")}</select></div>
          <div class="field"><label>Firma</label><input name="company" value="${esc(r.company)}"></div>
          <div class="field"><label>Araç</label><select name="vehicle">${opt(vehicles, r.vehicle_id, "— yok —")}</select></div>
          <div class="field"><label>Veresiye esnaf</label><select name="supplier">${opt(suppliers, r.credit ? r.supplier_id : "", "— peşin —")}</select></div>
        </div>
        <div class="field"><label>Açıklama</label><input name="description" value="${esc(r.note || "")}" placeholder="ne alındı / yapıldı"></div>${issues(r)}</div>`)
      .join("") +
    v.tankIn
      .map((r, i) => `<div class="card" data-kind="tank" data-i="${i}">
        <label class="history-check"><input type="checkbox" data-pick ${r.ok ? "checked" : ""}> <b>🛢 Depoya yakıt girişi</b></label>
        <div class="formgrid2">
          <div class="field"><label>Tarih</label><input type="date" name="date" value="${esc(r.date)}"></div>
          <div class="field"><label>Litre</label><input type="number" step="any" name="liters" value="${r.liters ?? ""}"></div>
          <div class="field"><label>Litre fiyatı (₺)</label><input type="number" step="any" name="unit_price" value="${r.unit_price ?? ""}"></div>
          <div class="field"><label>Toplam (₺, ops.)</label><input type="number" step="any" name="total" value="${r.total ?? ""}"></div>
          <div class="field"><label>Veresiye petrolcü</label><select name="supplier">${opt(suppliers, r.supplier_id, "— peşin / yok —")}</select></div>
          <div class="field"><label>Müşteriden (sefer karşılığı)</label><select name="tank_customer">${opt(customers, r.customer_id, "— yok —")}</select></div>
        </div>${issues(r)}</div>`)
      .join("") +
    v.fuel
      .map((r, i) => `<div class="card" data-kind="fuel" data-i="${i}">
        <label class="history-check"><input type="checkbox" data-pick ${r.ok ? "checked" : ""}> <b>Yakıt</b> <span class="muted small">· depoda kayıtlı ${Math.round(v.tankStock)} L</span></label>
        <div class="formgrid2">
          <div class="field"><label>Tarih</label><input type="date" name="date" value="${esc(r.date)}"></div>
          <div class="field"><label>Araç</label><select name="vehicle">${opt(vehicles, r.vehicle_id)}</select></div>
          <div class="field"><label>Nereden</label><select name="source">${opt([["Depo Tankı", "Depo tankından"], ["Akaryakıt İstasyonu", "Akaryakıt istasyonu"], ["Müşteri Verdi", "Müşteri verdi (örn. Kılıç)"]], r.source, "Depo Tankı")}</select></div>
          <div class="field"><label>Veren müşteri (müşteri verdiyse)</label><select name="fuel_customer">${opt(customers, r.customer_id, "— yok —")}</select></div>
          <div class="field"><label>Litre</label><input type="number" step="any" name="liters" value="${r.liters ?? ""}"></div>
          <div class="field"><label>Tutar (₺)</label><input type="number" step="any" name="total" value="${r.total ?? ""}"></div>
        </div>${issues(r)}</div>`)
      .join("") +
    v.collections
      .map((r, i) => `<div class="card" data-kind="collection" data-i="${i}">
        <label class="history-check"><input type="checkbox" data-pick ${r.ok ? "checked" : ""}> <b>Tahsilat</b> (müşteriden para)</label>
        <div class="formgrid2">
          <div class="field"><label>Tarih</label><input type="date" name="date" value="${esc(r.date)}"></div>
          <div class="field"><label>Müşteri</label><select name="customer">${opt([...customers, ...(r.new_customer ? [["new:" + r.new_customer, "➕ Yeni: " + r.new_customer]] : [])], r.customer_id || (r.new_customer ? "new:" + r.new_customer : ""))}</select></div>
          <div class="field"><label>Tutar (₺)</label><input type="number" step="any" name="amount" value="${r.amount ?? ""}"></div>
          <div class="field"><label>Şekil</label><select name="method">${opt([["Nakit", "Nakit"], ["Havale", "Havale / EFT"]], r.method, "Nakit")}</select></div>
          <div class="field"><label>Banka hesabı (havale)</label><select name="bank">${opt(banks, r.bank_account_id, "— yok —")}</select></div>
          <div class="field"><label>Parayı alan personel</label><select name="personnel">${opt(personnel, r.personnel_id, "— kasaya —")}</select></div>
        </div>${issues(r)}</div>`)
      .join("") +
    v.maintenance
      .map((r, i) => `<div class="card" data-kind="maintenance" data-i="${i}">
        <label class="history-check"><input type="checkbox" data-pick ${r.ok ? "checked" : ""}> <b>Arıza / Bakım</b></label>
        <div class="formgrid2">
          <div class="field"><label>Tarih</label><input type="date" name="date" value="${esc(r.date)}"></div>
          <div class="field"><label>Araç</label><select name="vehicle">${opt(vehicles, r.vehicle_id)}</select></div>
          <div class="field"><label>Tür</label><select name="maint_type">${opt(MAINT_TYPES.map((x) => [x, x]), r.maint_type)}</select></div>
          <div class="field"><label>Durum</label><select name="status">${opt(MAINT_STATUS.map((x) => [x, x]), r.status)}</select></div>
          <div class="field"><label>Tutar (₺, ops.)</label><input type="number" step="any" name="cost" value="${r.cost ?? ""}"></div>
          <div class="field"><label>Servis / usta</label><input name="service_company" value="${esc(r.service_company)}"></div>
          <div class="field"><label>Veresiye esnaf</label><select name="supplier">${opt(suppliers, r.credit ? r.supplier_id : "", "— peşin / yok —")}</select></div>
        </div>
        <div class="field"><label>Açıklama</label><input name="description" value="${esc(r.description)}"></div>${issues(r)}</div>`)
      .join("") +
    v.personnel
      .map((r, i) => `<div class="card" data-kind="personnel" data-i="${i}">
        <label class="history-check"><input type="checkbox" data-pick ${r.ok ? "checked" : ""}> <b>Personel hareketi</b></label>
        <div class="formgrid2">
          <div class="field"><label>Tarih</label><input type="date" name="date" value="${esc(r.date)}"></div>
          <div class="field"><label>Personel</label><select name="personnel">${opt(personnel, r.personnel_id)}</select></div>
          <div class="field"><label>İşlem</label><select name="event_type">${opt(PERSONNEL_EVENT_TYPES.map((x) => [x, x]), r.event_type)}</select></div>
          <div class="field"><label>Tutar (₺)</label><input type="number" step="any" name="amount" value="${r.amount ?? ""}"></div>
          <div class="field"><label>Saat / Gün</label><input type="number" step="any" name="hours_days" value="${r.hours_days ?? ""}"></div>
        </div>${issues(r)}</div>`)
      .join("") +
    v.edits
      .map((r, i) => {
        const label = { work_records: "İş", expense_records: "Gider", fuel_records: "Yakıt", cash_records: "Kasa" }[r.store] || r.store;
        const show = (k, val) => (k.endsWith("_id") ? nameOf({ customer_id: "customers", site_id: "sites", vehicle_id: "vehicles" }[k], val) : String(val ?? "—"));
        const before = r.rec ? `${label} · ${r.rec.date} · ${r.store === "work_records" ? nameOf("customers", r.rec.customer_id) + " · " + (r.rec.quantity ?? "") + " " + (r.rec.unit || "") : (r.rec.amount ?? r.rec.liters ?? "")}` : "Kayıt bulunamadı";
        return `<div class="card" data-kind="edit" data-i="${i}" ${r.rec ? "" : 'data-disabled="1"'}>
        <label class="history-check"><input type="checkbox" data-pick ${r.rec ? "" : "disabled"}> <b>${r.remove ? "🗑 Kaydı sil" : "✏ Kaydı düzelt"}</b> — bilerek işaretleyin</label>
        <div class="small">${esc(before)}</div>
        ${Object.entries(r.changes).map(([k, val]) => `<div class="small">• ${esc(k)}: <s>${esc(show(k, r.rec?.[k]))}</s> → <b>${esc(show(k, val))}</b></div>`).join("")}
        ${r.remove ? `<div class="small">Neden: ${esc(r.reason)}</div>` : ""}${issues(r)}</div>`;
      })
      .join("") +
    (total ? '<button class="btn primary block" data-save>✓ Seçilenleri Kaydet</button>' : v.answer ? "" : notice("warn", "Kaydedilecek bir şey bulunamadı. Mesajı daha açık yazıp tekrar deneyin."));
  // Belirsiz müşteri: aday düğmesi seçer ve kartı işaretler
  for (const b of qsa("[data-pickcust]", out))
    b.addEventListener("click", () => {
      const card = b.closest(".card");
      qs("[name=customer]", card).value = b.dataset.pickcust;
      qs("[name=customer]", card).dispatchEvent(new Event("change"));
      qs("[data-pick]", card).checked = true;
      for (const x of qsa("[data-pickcust]", card)) x.classList.toggle("on", x === b);
    });
  // Müşteri değişince önerilen "yeni şantiye" o müşteriye ait olmayabilir: temizle
  for (const card of qsa('.card[data-kind="work"]', out)) {
    const cs = qs("[name=customer]", card), ss = qs("[name=site]", card);
    cs?.addEventListener("change", () => {
      if (ss && ss.value.startsWith("new:")) ss.value = "";
    });
  }
  qs("[data-save]", out)?.addEventListener("click", () => save(ctx, out, v, d, { message, files }));
}

async function save(ctx, out, v, d, { message, files }) {
  const { db } = ctx;
  const cards = qsa(".card[data-kind]", out)
    .filter((c) => qs("[data-pick]", c).checked)
    .sort((a, b) => (["card", "memory", "tank"].includes(a.dataset.kind) ? 0 : 1) - (["card", "memory", "tank"].includes(b.dataset.kind) ? 0 : 1));
  if (!cards.length) return toast("Kaydedilecek kart seçin", "err");
  const val = (c, n) => qs(`[name=${n}]`, c)?.value ?? "";
  // Önce eksik kontrolü: hiçbir şey yazılmadan
  for (const c of cards) {
    const k = c.dataset.kind;
    const miss =
      k === "work" ? !val(c, "customer") || !val(c, "vehicle") || !val(c, "work_type") || !(Number(val(c, "quantity")) > 0) || !val(c, "unit")
      : k === "expense" ? !(Number(val(c, "amount")) > 0)
      : k === "fuel" ? !val(c, "vehicle") || !(Number(val(c, "liters")) > 0) || (val(c, "source") === "Müşteri Verdi" && !val(c, "fuel_customer"))
      : k === "tank" ? !(Number(val(c, "liters")) > 0) || (val(c, "supplier") && !(Number(val(c, "total")) > 0 || Number(val(c, "unit_price")) > 0))
      : k === "collection" ? !val(c, "customer") || !(Number(val(c, "amount")) > 0) || (val(c, "method") === "Havale" && !val(c, "bank"))
      : k === "maintenance" ? !val(c, "vehicle") || !val(c, "description") || (val(c, "supplier") && !(Number(val(c, "cost")) > 0))
      : k === "personnel" ? !val(c, "personnel")
      : k === "ticket" ? !val(c, "ticket_no").trim() || !val(c, "date") || !val(c, "vehicle") || !val(c, "link") || (val(c, "link") === "new" && (!val(c, "customer") || !val(c, "work_type")))
      : k === "doc" ? !val(c, "category") || !val(c, "owner") || !val(c, "doc_no").trim() || !val(c, "date") || documentOwner(val(c, "category")) !== val(c, "owner").split(":")[0] || (val(c, "expiry_date") && val(c, "expiry_date") < val(c, "date")) || (!val(c, "expiry_date") && !NO_EXPIRY.includes(val(c, "category")))
      : k === "card" ? !val(c, "name").trim() || (v.cards[Number(c.dataset.i)].kind === "sites" && !val(c, "customer"))
      : false;
    if (miss) {
      c.scrollIntoView({ behavior: "smooth", block: "center" });
      return toast(k === "doc" ? "Belge kartında eksik/uyumsuz alan var (araç belgesi araca, personel belgesi personele)" : "İşaretli kartta eksik alan var", "err");
    }
  }
  // Depo stoku: işaretli depo girişleri + mevcut stok, depodan verilen yakıta yetmeli
  {
    const sum = (kind, f) => cards.filter((c) => c.dataset.kind === kind && f(c)).reduce((n, c) => n + Number(val(c, "liters")), 0);
    const need = sum("fuel", (c) => (val(c, "source") || "Depo Tankı") === "Depo Tankı");
    const have = v.tankStock + sum("tank", () => true);
    if (need > have + 0.001)
      return toast(`Depoda kayıtlı ${Math.round(have)} L var, ${need} L verilmek isteniyor. Önce depoya yakıt girişi yapın (mesaja "depoya X litre geldi" yazabilirsiniz) ya da kaynağı İstasyon seçin.`, "err");
  }
  const btn = qs("[data-save]", out);
  btn.disabled = true;
  const done = { tank: 0, ticket: 0, doc: 0, work: 0, expense: 0, fuel: 0, customer: 0, site: 0, collection: 0, maintenance: 0, personnel: 0, edit: 0, cards: 0, learned: 0 };
  const { saveMessageMemory } = await import("./message-smart-db.js");
  // Kaydedilen seçim hafızaya: mesajdaki ifade → seçilen kart (bir dahaki sefere otomatik)
  const learn = async (alias, target_type, target_id, cardName) => {
    if (!alias || !target_id) return;
    const n = (x) => String(x || "").toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (n(alias) === n(cardName)) return;
    // "kuyucu", "camcılar" gibi yalnız meslek adı birden fazla kişiyi anlatır: hafızaya alınmaz
    if (occupationOnly(alias)) return;
    try {
      const before = (await db.getAll("aliases")).filter((a) => !a.deleted_at && a.active !== false).length;
      await saveMessageMemory({ alias, target_type, target_id, confirmed: true });
      const after = (await db.getAll("aliases")).filter((a) => !a.deleted_at && a.active !== false).length;
      if (after > before) done.learned++;
    } catch (e) {
      /* başka karta bağlı takma ad: dokunma */
    }
  };
  const ensureCustomer = async (customer, parent = null) => {
    if (!customer.startsWith("new:")) return customer;
    const name = customer.slice(4);
    if (!newIds.has("c:" + name)) {
      const rec = await db.saveNew("customers", { name, note: "Asistan ile açıldı", ...(parent ? { parent_customer_id: parent } : {}) }, "Asistan: yeni müşteri");
      newIds.set("c:" + name, rec.id);
      done.customer++;
    }
    return newIds.get("c:" + name);
  };
  const newIds = new Map();
  const source = "Asistan: " + message.slice(0, 300);
  try {
    const { priceSnapshot } = await import("./business.js");
    const prices = await db.listActive("price_book");
    const crane = { first: await db.metaGet("crane_first_hour"), next: await db.metaGet("crane_next_hour") };
    const vehicles = (d.vehicles || []).filter(isActive);
    const existingWorks = (d.work_records || []).filter(isActive);
    for (const c of cards) {
      const k = c.dataset.kind;
      if (k === "memory") {
        const r = v.memory[Number(c.dataset.i)];
        await learn(r.alias, r.target_type, r.target_id, r.target_name);
        continue;
      }
      if (k === "card") {
        const r = v.cards[Number(c.dataset.i)];
        const name = val(c, "name").trim();
        if (r.kind === "customers") {
          const rec = await db.saveNew("customers", { name, phone: val(c, "phone"), note: r.data.note || "Asistan listesinden" }, "Asistan: kart");
          newIds.set("c:" + name, rec.id);
          if (r.name !== name) newIds.set("c:" + r.name, rec.id);
          done.customer++;
        } else if (r.kind === "sites") {
          const customer = await ensureCustomer(val(c, "customer"));
          await db.saveNew("sites", { name, customer_id: customer }, "Asistan: kart");
          done.site++;
        } else if (r.kind === "vehicles") {
          await db.saveNew("vehicles", { name, plate: val(c, "plate"), type: val(c, "type") || "Araç/Makine", ownership: r.data.ownership, active: true }, "Asistan: kart");
          done.cards++;
        } else if (r.kind === "personnel") {
          await db.saveNew("personnel", { name, phone: val(c, "phone"), role: r.data.role || "", active: true }, "Asistan: kart");
          done.cards++;
        } else if (r.kind === "quarries" || r.kind === "dump_sites") {
          await db.saveNew(r.kind, { name, address: r.data.address || "" }, "Asistan: kart");
          done.cards++;
        } else if (r.kind === "suppliers") {
          const edb = await import("./enterprise-db.js");
          await edb.saveSupplier({ name, type: r.data.type, phone: val(c, "phone") });
          done.cards++;
        }
        continue;
      }
      if (k === "tank") {
        const liters = Number(val(c, "liters"));
        let total = Number(val(c, "total")) || null, unit_price = Number(val(c, "unit_price")) || null;
        if (unit_price && !total) total = Math.round(unit_price * liters * 100) / 100;
        if (total && !unit_price) unit_price = Math.round((total / liters) * 100) / 100;
        const supId = val(c, "supplier") || null;
        const mv = await db.saveNew("fuel_tank_movements", {
          date: val(c, "date") || todayStr(), move_type: "GİRİŞ", liters, vehicle_id: null, personnel_id: null,
          pump_no: "", signature_name: "", unit_price, total, supplier_id: supId, customer_id: val(c, "tank_customer") || null, description: source,
        }, "Asistan: depo girişi");
        if (supId && total) {
          const { createCreditBill } = await import("./esnaf.js");
          const fresh = await db.dumpAll();
          await createCreditBill(ctx, fresh, fresh.suppliers.find((x) => x.id === supId),
            { date: mv.date, amount: total, description: `Depoya yakıt ${liters} L`, category: "Yakıt", vehicle_id: null, kdv_rate: null },
            { source: { store: "fuel_tank_movements", id: mv.id } });
        }
        done.tank++;
        continue;
      }
      if (k === "ticket") {
        const r = v.tickets[Number(c.dataset.i)];
        const file = files[r.photo];
        const date = val(c, "date"), vid = val(c, "vehicle"), no = val(c, "ticket_no").trim();
        const fresh = await db.dumpAll();
        if ((fresh.documents || []).some((x) => isActive(x) && x.category === "Döküm Fişi" && String(x.doc_no).trim() === no)) {
          toast(`Fiş ${no} zaten kayıtlı, atlandı`, "err");
          continue;
        }
        let workId = val(c, "link");
        const veh = vehicles.find((x) => x.id === vid);
        if (workId === "new") {
          const f = {
            date, customer_id: val(c, "customer"), site_id: null, vehicle_id: vid, personnel_id: null, vehicle_type: veh.type || null,
            contractor_id: veh.contractor_id || null, work_type: val(c, "work_type"), description: `Döküm fişi ${no}` + (val(c, "tonnage") ? ` · ${val(c, "tonnage")} ton` : ""),
            internal_note: source, material: r.material || "", quantity: 1, unit: "Sefer",
            dump_site_id: val(c, "dump_site") || null, quarry_id: null, dump_area: (d.dump_sites || []).find((x) => x.id === val(c, "dump_site"))?.name || r.dump_site_name || "",
            quarry: "", slip_status: null, slip_no: no, customer_note: "", distance_km: null, source: "asistan",
          };
          f.price_snapshot = priceSnapshot(f, prices, crane);
          workId = (await db.saveNew("work_records", f, "Asistan: döküm fişi")).id;
          done.work++;
        }
        const docFields = { category: "Döküm Fişi", owner_type: "work", owner_id: workId, date, doc_no: no, title: "Döküm fişi " + no,
          note: [val(c, "tonnage") ? val(c, "tonnage") + " ton" : "", r.dump_site_name].filter(Boolean).join(" · "),
          ticket_vehicle_id: vid, ticket_tonnage: Number(val(c, "tonnage")) || null, ticket_dump_site_id: val(c, "dump_site") || null };
        await (file ? db.saveDocument(docFields, file) : db.saveNew("documents", docFields, "Asistan: döküm fişi"));
        done.ticket++;
        continue;
      }
      if (k === "doc") {
        const r = v.docs[Number(c.dataset.i)];
        const file = files[r.photo];
        const category = val(c, "category");
        const [otype, oid] = val(c, "owner").split(":");
        const f = { category, owner_type: otype, owner_id: oid, [otype + "_id"]: oid, date: val(c, "date"), doc_no: val(c, "doc_no").trim(),
          expiry_date: val(c, "expiry_date") || null, title: category, note: "Asistan fotoğraftan okudu" };
        await (file ? db.saveDocument(f, file) : db.saveNew("documents", f, "Asistan: belge"));
        done.doc++;
        continue;
      }
      if (k === "work") {
        const customer = await ensureCustomer(val(c, "customer"), v.works[Number(c.dataset.i)].new_customer_parent_id || null);
        let site = val(c, "site") || null;
        if (site && site.startsWith("new:")) {
          const name = site.slice(4), key = "s:" + customer + ":" + name;
          if (!newIds.has(key)) {
            const rec = await db.saveNew("sites", { name, customer_id: customer }, "Asistan: yeni şantiye");
            newIds.set(key, rec.id);
            done.site++;
          }
          site = newIds.get(key);
        }
        const veh = vehicles.find((x) => x.id === val(c, "vehicle"));
        // Yeni malzeme ocağı / döküm yeri kartı (aynı adla bir kez açılır)
        const ensurePlace = async (store, raw) => {
          if (!raw || !raw.startsWith("new:")) return raw || null;
          const name = raw.slice(4), key = store + ":" + name;
          if (!newIds.has(key)) {
            const rec = await db.saveNew(store, { name, note: "Asistan ile açıldı" }, "Asistan: yeni " + (store === "quarries" ? "malzeme ocağı" : "döküm yeri"));
            newIds.set(key, rec.id);
            done.cards++;
          }
          return newIds.get(key);
        };
        const quarryId = await ensurePlace("quarries", val(c, "quarry"));
        const dumpId = await ensurePlace("dump_sites", val(c, "dump_site"));
        const placeName = async (store, id) => (id ? (await db.get(store, id))?.name || "" : "");
        const fields = {
          date: val(c, "date") || todayStr(),
          customer_id: customer,
          site_id: site,
          vehicle_id: veh.id,
          personnel_id: val(c, "personnel") || null,
          vehicle_type: veh.type || null,
          contractor_id: veh.contractor_id || null,
          work_type: val(c, "work_type"),
          description: val(c, "description") || source,
          internal_note_src: source,
          material: val(c, "material") || "",
          quantity: Number(val(c, "quantity")),
          unit: val(c, "unit"),
          dump_site_id: dumpId, quarry_id: quarryId,
          dump_area: (await placeName("dump_sites", dumpId)) || val(c, "to_place") || "", quarry: (await placeName("quarries", quarryId)) || val(c, "from_place") || "",
          slip_status: null, slip_no: val(c, "slip_no") || "", customer_note: "", distance_km: null,
          source: "asistan",
        };
        delete fields.internal_note_src;
        const wr0 = v.works[Number(c.dataset.i)];
        fields.internal_note = (wr0.reporter ? "Bildiren: " + wr0.reporter + " · " : "") + source;
        const up = Number(val(c, "unit_price"));
        fields.price_snapshot = up > 0
          ? { unit_price: up, kdv_rate: Number(await db.metaGet("kdv_default")) || 20, kdv_included: false, amount: up * fields.quantity, price_source: "Manuel", snapshot_at: new Date().toISOString() }
          : priceSnapshot(fields, prices, crane);
        // Mazot karşılığı (Kılıç: sefer başı 75 L, ücret yalnız mazot) — kartta değişen müşteri/miktara göre yeniden hesaplanır
        Object.assign(fields, applyFuelPay(await db.dumpAll(), fields, message));
        const dup = existingWorks.some((w) => w.date === fields.date && w.vehicle_id === fields.vehicle_id && w.customer_id === fields.customer_id && w.work_type === fields.work_type && Number(w.quantity) === fields.quantity);
        if (dup && !(await confirmDialog("Olası mükerrer iş", `${fields.date} · ${veh.name} · ${fields.quantity} ${fields.unit} zaten kayıtlı görünüyor. Yine de kaydedilsin mi?`, "Kaydet"))) continue;
        await db.saveNew("work_records", fields, "Asistan");
        done.work++;
        const wr = v.works[Number(c.dataset.i)];
        const nm = (st, id) => (d[st] || []).find((x) => x.id === id)?.name || "";
        // Ölçüm + onaylı örnek + reddedilen eşleşme
        try {
          const m = measureCorrection(wr.ai, fields, wr.issues.length > 0);
          await db.metaSet("ai_quality", addQuality(await db.metaGet("ai_quality"), m));
          const out = `${nm("customers", customer) || "?"} | ${veh.name} | ${fields.work_type} | ${fields.quantity} ${fields.unit}`;
          await db.metaSet("ai_examples", addExample(await db.metaGet("ai_examples"), { msg: message.slice(0, 300), out }));
          if (!wr.ambiguous && wr.ai?.customer_id && wr.ai.customer_id !== customer && wr.mentions?.customer) {
            const neg = (await db.metaGet("ai_negative_aliases")) || [];
            neg.unshift({ alias: wr.mentions.customer, target_type: "customer", target_id: wr.ai.customer_id });
            await db.metaSet("ai_negative_aliases", neg.slice(0, 200));
          }
        } catch (e) {}
        const custSel = val(c, "customer");
        if (!wr.ambiguous) await learn(wr.mentions?.customer, "customer", customer, nm("customers", customer) || (custSel.startsWith("new:") ? custSel.slice(4) : ""));
        // "Yeni: Mahir Bey" önerisi yerine mevcut Hisar Polat seçildiyse "Mahir Bey" → Hisar Polat öğrenilir
        if (!wr.ambiguous && !custSel.startsWith("new:") && wr.new_customer_text) await learn(wr.new_customer_text, "customer", customer, nm("customers", customer));
        if (site) await learn(wr.mentions?.site, "site", site, nm("sites", site));
        await learn(wr.mentions?.vehicle, "vehicle", veh.id, veh.name);
        if (fields.personnel_id) await learn(wr.mentions?.personnel, "personnel", fields.personnel_id, nm("personnel", fields.personnel_id));
      } else if (k === "expense") {
        const r = v.expenses[Number(c.dataset.i)];
        const file = r.photo != null ? files[r.photo] : null;
        const f = { date: val(c, "date") || todayStr(), amount: Number(val(c, "amount")), category: val(c, "category") || "Diğer", vehicle_id: val(c, "vehicle") || null, description: val(c, "description") || (val(c, "company") ? val(c, "company") + " · " : "") + (r.note || val(c, "category")), kdv_rate: null, file };
        const supId = val(c, "supplier");
        const fresh = await db.dumpAll();
        if (supId) {
          const { createCreditBill } = await import("./esnaf.js");
          const s = fresh.suppliers.find((x) => x.id === supId);
          const res = await createCreditBill(ctx, fresh, s, f);
          if (res) done.expense++;
        } else {
          const { findDuplicates } = await import("./esnaf.js");
          const dup = findDuplicates(fresh, { date: f.date, amount: f.amount });
          if ((dup.bills.length || dup.expenses.length) && !(await confirmDialog("Aynı gün aynı tutarda kayıt var", `${f.date} · ${fmtTL(f.amount)} ₺ zaten kayıtlı (gider veya esnaf borcu). Farklı bir harcama mı?`, "Farklı, kaydet"))) continue;
          const rec = await db.saveNew("expense_records", {
            date: f.date, category: f.category, kdv_rate: null, amount: f.amount, personnel_id: null, vehicle_id: f.vehicle_id,
            payment_method: "Şirket Ödedi", receipt: file ? "Evet" : "Hayır", reimbursement_status: null,
            company: val(c, "company"), description: val(c, "description") || source,
          }, "Asistan");
          if (file) await db.addAttachment("expense", rec.id, file);
          done.expense++;
        }
      } else if (k === "collection") {
        const customer = await ensureCustomer(val(c, "customer"));
        const amount = Number(val(c, "amount")), date = val(c, "date") || todayStr();
        const fresh = await db.dumpAll();
        const same = (fresh.cash_records || []).filter((x) => isActive(x) && x.cash_type === "Müşteriden Para Alındı" && x.customer_id === customer && x.date === date && Number(x.amount) === amount);
        if (same.length && !(await confirmDialog("Aynı tahsilat kayıtlı olabilir", `${date} · ${fmtTL(amount)} ₺ bu müşteriden zaten alınmış görünüyor. Yine de kaydedilsin mi?`, "Kaydet"))) continue;
        if (val(c, "method") === "Havale") {
          const { customerBankReceipt } = await import("./enterprise-db.js");
          await customerBankReceipt({ date, customer_id: customer, bank_account_id: val(c, "bank"), amount, note: source }, ctx.core.uuid());
        } else {
          const pid = val(c, "personnel") || null;
          await db.saveNew("cash_records", {
            request_id: ctx.core.uuid(), date, cash_type: "Müşteriden Para Alındı", amount, personnel_id: pid, customer_id: customer,
            payment_method: "Nakit", description: source, cash_status: pid ? "PERSONELDE" : "KASAYA_TESLIM_EDILDI",
          }, "Asistan tahsilat");
        }
        done.collection++;
      } else if (k === "maintenance") {
        const cost = Number(val(c, "cost")) || null;
        const files0 = files[0] && v.expenses.every((e) => e.photo !== 0) ? files[0] : null;
        const rec = await db.saveNew("maintenance_records", {
          date: val(c, "date") || todayStr(), vehicle_id: val(c, "vehicle"), personnel_id: null, severity: "Normal", part: "",
          maint_type: val(c, "maint_type") || "Arıza", status: val(c, "status") || "Açık", description: val(c, "description"),
          cost, kdv_rate: null, service_company: val(c, "service_company"), km_hours: "",
        }, "Asistan arıza/bakım");
        if (files0) await db.addAttachment("maintenance", rec.id, files0);
        const supId = val(c, "supplier");
        if (supId && cost) {
          const { createCreditBill } = await import("./esnaf.js");
          const fresh = await db.dumpAll();
          const s = fresh.suppliers.find((x) => x.id === supId);
          await createCreditBill(ctx, fresh, s, { date: rec.date, amount: cost, description: val(c, "description"), category: "Bakım / Onarım", vehicle_id: rec.vehicle_id, kdv_rate: null }, { source: { store: "maintenance_records", id: rec.id } });
        }
        done.maintenance++;
      } else if (k === "personnel") {
        await db.saveNew("personnel_events", {
          date: val(c, "date") || todayStr(), personnel_id: val(c, "personnel"), event_type: val(c, "event_type") || "Diğer",
          amount: Number(val(c, "amount")) || null, hours_days: Number(val(c, "hours_days")) || null, description: source,
        }, "Asistan personel hareketi");
        done.personnel++;
      } else if (k === "edit") {
        const r = v.edits[Number(c.dataset.i)];
        const cur = await db.get(r.store, r.id);
        if (!cur || cur.deleted_at) continue;
        if (r.remove) await db.softDelete(r.store, r.id, "Asistan: " + r.reason);
        else await db.saveExisting(r.store, cur, r.changes, "Asistan düzeltmesi: " + message.slice(0, 200));
        done.edit++;
      } else {
        const r = v.fuel[Number(c.dataset.i)];
        const liters = Number(val(c, "liters")), total = Number(val(c, "total")) || null;
        const src = val(c, "source") || "Depo Tankı";
        const byCustomer = src === "Müşteri Verdi";
        const rec = await db.saveNew("fuel_records", {
          date: val(c, "date") || todayStr(), vehicle_id: val(c, "vehicle"), personnel_id: null, liters,
          unit_price: !byCustomer && total ? Math.round((total / liters) * 100) / 100 : null, total: byCustomer ? null : total,
          ...(byCustomer ? { customer_id: val(c, "fuel_customer") || null } : {}),
          fuel_source: src, receipt: src === "Depo Tankı" ? "Depo" : byCustomer ? "Müşteri" : r.photo != null ? "Evet" : "Hayır", pump_no: "", km: null,
          machine_hours: null, description: source, customer_billable: false,
        }, "Asistan");
        if (r.photo != null && files[r.photo]) await db.addAttachment("fuel", rec.id, files[r.photo]);
        done.fuel++;
      }
    }
    const parts = [[done.tank, "depo girişi"], [done.ticket, "döküm fişi"], [done.doc, "belge"], [done.work, "iş"], [done.expense, "gider"], [done.fuel, "yakıt"], [done.collection, "tahsilat"], [done.maintenance, "arıza/bakım"], [done.personnel, "personel hareketi"], [done.edit, "düzeltme"], [done.customer, "yeni müşteri"], [done.site, "yeni şantiye"], [done.cards, "yeni kart (araç/personel/esnaf/ocak/döküm yeri)"], [done.learned, "yeni eşleştirme hafızaya alındı"]].filter(([n]) => n).map(([n, t]) => n + " " + t);
    out.innerHTML = notice("ok", "Kaydedildi: " + (parts.join(", ") || "hiçbir şey") + ".") +
      '<div class="row" style="gap:8px"><button class="btn grow" data-go="#/isler">İşler</button><button class="btn grow" data-go="#/gider">Giderler</button></div>';
    qs("[data-msg]", ctx.root).value = "";
    await db.metaSet("assistant_draft", "");
  } catch (e) {
    btn.disabled = false;
    toast((e.message || String(e)) + ` (kaydedilen: ${done.work} iş, ${done.expense} gider, ${done.fuel} yakıt)`, "err");
  }
}

// Asistan ekranı: mesaj yaz/yapıştır + fiş fotoğrafı ekle → Gemini işletmeni tanıyarak işleri,
// giderleri, yakıtı çıkarır → doğrulanmış kartlar → tek dokunuşla kaydet. Yeni müşteri/şantiye,
// fişin fotoğrafı ve kaynak mesaj kayda birlikte yazılır. Doğrulamadan geçmeyen satır işaretsiz gelir.
import { qs, qsa, esc, appbar, toast, notice, confirmDialog, fmtTL, todayStr } from "./ui.js";
import { WORK_TYPES, EXPENSE_CATEGORIES, MAINT_TYPES, MAINT_STATUS, PERSONNEL_EVENT_TYPES, isActive } from "./core.js";
import { assistantContext, assistantSystem, validatePlan, validateExtras, businessFacts, checkAnswer, ASSIST_UNITS } from "./assistant-core.js";

const opt = (list, val, empty = "— seçin —") =>
  `<option value="">${esc(empty)}</option>` +
  list.map(([v, t]) => `<option value="${esc(v)}" ${v === val ? "selected" : ""}>${esc(t)}</option>`).join("");

export async function screen(ctx) {
  if (ctx.parts[0] !== "akilli-asistan") return false;
  const { root, db } = ctx;
  const { geminiSettings } = await import("./ai-gemini.js");
  const g = await geminiSettings(db);
  root.innerHTML =
    appbar("Akıllı Asistan", "Gemini · işletmenizi tanır") +
    `<div style="height:10px"></div>
    ${g.ready ? notice("info", "Mesajı yazın veya WhatsApp'tan yapıştırın, fiş fotoğraflarını ekleyin. Gemini müşteri, şantiye ve araç listenizi bilerek okur. Kaydetmeden önce kartları kontrol edin; şüpheli satırlar işaretsiz gelir.") : notice("warn", "Önce Ayarlar → Yapay Zeka'da Gemini anahtarını kaydedin.") + '<button class="btn block" data-go="#/yapay-zeka">Yapay Zeka Ayarları</button>'}
    <div class="card">
      <div class="field"><label>Mesaj</label><textarea data-msg rows="5" placeholder="Örn: Mahir bey 14 tonluk yarım yevmiye, 34 ABC 123 Kaya İnşaat 4 sefer moloz, lastikçiye 500 veresiye"></textarea></div>
      <div class="field"><label>Fiş / belge fotoğrafları (isteğe bağlı)</label><input type="file" accept="image/*" multiple data-photos></div>
      <div class="row" style="gap:6px;flex-wrap:wrap" data-thumbs></div>
      <button class="btn primary block" style="margin-top:10px" data-ask ${g.ready ? "" : "disabled"}>🤖 Asistana Gönder</button>
    </div>
    <div data-out></div>`;
  const photosIn = qs("[data-photos]", root), msgEl = qs("[data-msg]", root);
  let files = [];
  const showThumbs = () =>
    (qs("[data-thumbs]", root).innerHTML = files
      .map((f, i) => `<img src="${URL.createObjectURL(f)}" alt="Fiş ${i + 1}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">`)
      .join(""));
  photosIn.addEventListener("change", () => {
    files = [...photosIn.files].slice(0, 10);
    showThumbs();
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
        files.push(new File([b], decodeURIComponent(r.headers.get("x-name") || "foto.jpg"), { type: b.type || "image/jpeg" }));
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
    if (!message && !files.length) return toast("Mesaj yazın veya fotoğraf ekleyin", "err");
    await db.metaSet("assistant_draft", message);
    if (!navigator.onLine) return toast("İnternet yok. Mesaj saklandı; internet gelince tekrar Gönder'e basın.", "err");
    const out = qs("[data-out]", root), btn = qs("[data-ask]", root);
    btn.disabled = true;
    out.innerHTML = '<div class="muted small" style="padding:10px">Gemini okuyor…</div>';
    try {
      const { geminiJson, blobToBase64, shrink } = await import("./ai-gemini.js");
      const d = await db.dumpAll();
      const today = todayStr();
      const facts = await businessFacts(d, today);
      const parts = [
        { text: "İşletme kartları (JSON):\n" + JSON.stringify(assistantContext(d, today)) },
        { text: "facts (yerelde hesaplanmış güncel rakamlar; sorulara yalnız bunlarla cevap ver):\n" + JSON.stringify(facts) },
      ];
      for (const f of files) {
        const img = await shrink(f);
        parts.push({ inlineData: { mimeType: img.type || "image/jpeg", data: await blobToBase64(img) } });
      }
      parts.push({ text: `Fotoğraf sayısı: ${files.length}\nMesaj:\n${message || "(mesaj yok, yalnız fotoğraflar)"}` });
      const t0 = Date.now();
      const plan = await geminiJson(parts, { key: g.key, model: g.model, system: assistantSystem() });
      const v = validatePlan(plan, { message, d, today, photoCount: files.length });
      Object.assign(v, validateExtras(plan, { message, d, today, photoTexts: v.photoTexts }));
      v.answer = typeof plan.answer === "string" && plan.answer.trim() ? plan.answer.trim().slice(0, 1500) : null;
      v.answerBad = checkAnswer(v.answer, facts);
      render(ctx, out, v, d, { message, files, ms: Date.now() - t0 });
    } catch (e) {
      out.innerHTML = notice("warn", e.message || String(e));
    }
    btn.disabled = false;
  });
  return true;
}

function render(ctx, out, v, d, { message, files, ms }) {
  const live = (s) => (d[s] || []).filter(isActive);
  const customers = live("customers").map((c) => [c.id, c.name]);
  const vehicles = live("vehicles").map((x) => [x.id, x.name]);
  const sites = live("sites");
  const suppliers = live("suppliers").map((s) => [s.id, s.name]);
  const issues = (r) => (r.issues.length ? `<div class="muted tiny" style="margin-top:4px">⚠ ${esc(r.issues.join(" · "))}</div>` : "");
  const total = v.works.length + v.expenses.length + v.fuel.length + v.collections.length + v.maintenance.length + v.personnel.length + v.edits.length;
  const personnel = live("personnel").map((p) => [p.id, p.name]);
  const banks = live("bank_accounts").map((b) => [b.id, b.name || b.bank_name || "Banka"]);
  const nameOf = (s, id) => (d[s] || []).find((x) => x.id === id)?.name || id || "—";
  out.innerHTML =
    `<div class="section-title">Asistanın bulduğu (${total}) · ${(ms / 1000).toFixed(1)} sn</div>` +
    (v.answer ? `<div class="card"><div class="strong small">🤖 Cevap</div><div style="white-space:pre-wrap;margin-top:6px">${esc(v.answer)}</div>${v.answerBad.length ? notice("warn", "Bu sayılar kayıtlarınızda bulunamadı, güvenmeyin: " + v.answerBad.join(", ")) : '<div class="muted tiny" style="margin-top:6px">Rakamlar telefondaki kayıtlarınızdan hesaplandı.</div>'}</div>` : "") +
    v.questions.map((q) => notice("info", "Soru: " + q)).join("") +
    (v.newCustomers.length ? notice("warn", "Yeni müşteri kartı açılacak: " + v.newCustomers.join(", ")) : "") +
    v.works
      .map((r, i) => {
        const custOpts = [...customers, ...(r.new_customer ? [["new:" + r.new_customer, "➕ Yeni: " + r.new_customer]] : [])];
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
        </div>${issues(r)}</div>`)
      .join("") +
    v.fuel
      .map((r, i) => `<div class="card" data-kind="fuel" data-i="${i}">
        <label class="history-check"><input type="checkbox" data-pick ${r.ok ? "checked" : ""}> <b>Yakıt</b></label>
        <div class="formgrid2">
          <div class="field"><label>Tarih</label><input type="date" name="date" value="${esc(r.date)}"></div>
          <div class="field"><label>Araç</label><select name="vehicle">${opt(vehicles, r.vehicle_id)}</select></div>
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
  qs("[data-save]", out)?.addEventListener("click", () => save(ctx, out, v, d, { message, files }));
}

async function save(ctx, out, v, d, { message, files }) {
  const { db } = ctx;
  const cards = qsa(".card[data-kind]", out).filter((c) => qs("[data-pick]", c).checked);
  if (!cards.length) return toast("Kaydedilecek kart seçin", "err");
  const val = (c, n) => qs(`[name=${n}]`, c)?.value ?? "";
  // Önce eksik kontrolü: hiçbir şey yazılmadan
  for (const c of cards) {
    const k = c.dataset.kind;
    const miss =
      k === "work" ? !val(c, "customer") || !val(c, "vehicle") || !val(c, "work_type") || !(Number(val(c, "quantity")) > 0) || !val(c, "unit")
      : k === "expense" ? !(Number(val(c, "amount")) > 0)
      : k === "fuel" ? !val(c, "vehicle") || !(Number(val(c, "liters")) > 0)
      : k === "collection" ? !val(c, "customer") || !(Number(val(c, "amount")) > 0) || (val(c, "method") === "Havale" && !val(c, "bank"))
      : k === "maintenance" ? !val(c, "vehicle") || !val(c, "description") || (val(c, "supplier") && !(Number(val(c, "cost")) > 0))
      : k === "personnel" ? !val(c, "personnel")
      : false;
    if (miss) {
      c.scrollIntoView({ behavior: "smooth", block: "center" });
      return toast("İşaretli kartta eksik alan var", "err");
    }
  }
  const btn = qs("[data-save]", out);
  btn.disabled = true;
  const done = { work: 0, expense: 0, fuel: 0, customer: 0, site: 0, collection: 0, maintenance: 0, personnel: 0, edit: 0 };
  const ensureCustomer = async (customer) => {
    if (!customer.startsWith("new:")) return customer;
    const name = customer.slice(4);
    if (!newIds.has("c:" + name)) {
      const rec = await db.saveNew("customers", { name, note: "Asistan ile açıldı" }, "Asistan: yeni müşteri");
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
      if (k === "work") {
        const customer = await ensureCustomer(val(c, "customer"));
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
        const fields = {
          date: val(c, "date") || todayStr(),
          customer_id: customer,
          site_id: site,
          vehicle_id: veh.id,
          personnel_id: null,
          vehicle_type: veh.type || null,
          contractor_id: veh.contractor_id || null,
          work_type: val(c, "work_type"),
          description: source,
          material: "",
          quantity: Number(val(c, "quantity")),
          unit: val(c, "unit"),
          dump_site_id: null, quarry_id: null, dump_area: "", quarry: "",
          slip_status: null, slip_no: "", customer_note: "", internal_note: "", distance_km: null,
          source: "asistan",
        };
        fields.price_snapshot = priceSnapshot(fields, prices, crane);
        const dup = existingWorks.some((w) => w.date === fields.date && w.vehicle_id === fields.vehicle_id && w.customer_id === fields.customer_id && w.work_type === fields.work_type && Number(w.quantity) === fields.quantity);
        if (dup && !(await confirmDialog("Olası mükerrer iş", `${fields.date} · ${veh.name} · ${fields.quantity} ${fields.unit} zaten kayıtlı görünüyor. Yine de kaydedilsin mi?`, "Kaydet"))) continue;
        await db.saveNew("work_records", fields, "Asistan");
        done.work++;
      } else if (k === "expense") {
        const r = v.expenses[Number(c.dataset.i)];
        const file = r.photo != null ? files[r.photo] : null;
        const f = { date: val(c, "date") || todayStr(), amount: Number(val(c, "amount")), category: val(c, "category") || "Diğer", vehicle_id: val(c, "vehicle") || null, description: (val(c, "company") ? val(c, "company") + " · " : "") + (r.note || val(c, "category")), kdv_rate: null, file };
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
            company: val(c, "company"), description: source,
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
        const rec = await db.saveNew("fuel_records", {
          date: val(c, "date") || todayStr(), vehicle_id: val(c, "vehicle"), personnel_id: null, liters,
          unit_price: total ? Math.round((total / liters) * 100) / 100 : null, total,
          fuel_source: "Akaryakıt İstasyonu", receipt: r.photo != null ? "Evet" : "Hayır", pump_no: "", km: null,
          machine_hours: null, description: source, customer_billable: false,
        }, "Asistan");
        if (r.photo != null && files[r.photo]) await db.addAttachment("fuel", rec.id, files[r.photo]);
        done.fuel++;
      }
    }
    const parts = [[done.work, "iş"], [done.expense, "gider"], [done.fuel, "yakıt"], [done.collection, "tahsilat"], [done.maintenance, "arıza/bakım"], [done.personnel, "personel hareketi"], [done.edit, "düzeltme"], [done.customer, "yeni müşteri"], [done.site, "yeni şantiye"]].filter(([n]) => n).map(([n, t]) => n + " " + t);
    out.innerHTML = notice("ok", "Kaydedildi: " + (parts.join(", ") || "hiçbir şey") + ".") +
      '<div class="row" style="gap:8px"><button class="btn grow" data-go="#/isler">İşler</button><button class="btn grow" data-go="#/gider">Giderler</button></div>';
    qs("[data-msg]", ctx.root).value = "";
    await db.metaSet("assistant_draft", "");
  } catch (e) {
    btn.disabled = false;
    toast((e.message || String(e)) + ` (kaydedilen: ${done.work} iş, ${done.expense} gider, ${done.fuel} yakıt)`, "err");
  }
}

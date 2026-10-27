// Single document -> record preview. No independent archive, OCR claim or financial write before approval.
import { appbar, esc, notice, toast, fText, fNum, fDate, fSelect, collectForm, go } from "./ui.js";
import { isActive, todayStr } from "./core.js";
import { ATTACHMENT_ACCEPT, prepareAttachment } from "./attachment-safety.js";
import { sha256File, validateDocumentLink, documentDuplicateCandidates } from "./document-link-core.js";
import { stagePartDocuments } from "./part-document-ui.js";
import { saveDumpEntry } from "./dump-ledger-db.js";

const options = rows => rows.map(x => ({ v: x.id, t: x.name || x.work_type || x.id }));

export async function screen(ctx) {
  const { root, db, query } = ctx, d = await db.dumpAll();
  d.attachments = (await db.getAll("attachments")) || [];
  const works = (d.work_records || []).filter(isActive).map(w => ({ ...w, name: `${w.date} · ${(d.customers || []).find(c => c.id === w.customer_id)?.name || "Müşteri"} · ${w.work_type || "İş"} ${w.quantity || ""} ${w.unit || ""}` }));
  const customers = (d.customers || []).filter(isActive), vehicles = (d.vehicles || []).filter(isActive);
  const initialWork = works.find(w => w.id === query.work_id) || null;
  let file = null, hash = "", generation = 0, busy = false, lastDuplicate = null;
  root.innerHTML = appbar("Belgeyi Kayda Bağla", "Önce dosya ve hedef · sonra açık onay") + `
    <form data-link-form class="card" novalidate>
      <div class="notice info small">Türü ve hedef kaydı siz seçersiniz. Belge okumak tek başına gider, ödeme, iş veya stok oluşturmaz. Özgün dosya korunur.</div>
      ${fSelect("Belge türü", "kind", [{ v: "dump_receipt", t: "Kantar / döküm fişi" }, { v: "warranty", t: "Yedek parça / akü garantisi" }, { v: "generic", t: "Diğer belge" }], query.kind || "dump_receipt", { empty: false })}
      <div data-work-field>${fSelect("Bağlanacak iş", "work_record_id", options(works), initialWork?.id || "")}</div>
      <div data-warranty-field hidden>${fSelect("Parçanın aracı", "vehicle_id", options(vehicles), initialWork?.vehicle_id || "")}</div>
      <div data-generic-fields hidden>
        ${fSelect("Belge kategorisi", "category", ["Sözleşme", "Fatura", "Garanti", "İrsaliye", "Muayene Belgesi", "Diğer"], "Diğer", { empty: false })}
        ${fSelect("Belge sahibi", "owner_type", [{ v: "customer", t: "Müşteri" }, { v: "vehicle", t: "Araç" }, { v: "work", t: "İş" }], initialWork ? "work" : "customer", { empty: false })}
        <div data-owner-field></div>
        ${fText("Belge numarası", "doc_no", "")}
        ${fText("Açıklama", "description", "")}
      </div>
      <div data-dump-fields>
        ${fDate("Fişin gerçek tarihi", "date", initialWork?.date || todayStr())}
        ${fText("Fiş numarası", "receipt_no", "")}
        <div class="formgrid2">${fNum("Kapsanan sefer", "trips", 1, { req: true, step: 1 })}${fNum("Gerçek kesinti (₺)", "amount", "", { req: true, step: "any" })}</div>
        <div class="formgrid2">${fNum("Net ton (opsiyonel)", "tonnage", "", { step: "any" })}${fSelect("Tonaj kapsamı", "tonnage_scope", [{ v: "unknown", t: "Bilinmiyor" }, { v: "total", t: "Kapsanan seferlerin toplamı" }, { v: "per_trip", t: "Sefer başı" }], "total", { empty: false })}</div>
        ${fText("Açıklama (tarih farkı / kapsam)", "note", "")}
      </div>
      <div class="field"><label>Fotoğraf veya PDF</label><input type="file" name="document" accept="${ATTACHMENT_ACCEPT}" required><small>SVG/HTML ve sahte MIME reddedilir. Özgün baytlar değiştirilmez.</small></div>
      <div data-file-preview role="status"></div><div data-duplicate></div>
      <label class="history-check small" data-similar-row hidden><input type="checkbox" name="allow_similar"> Farklı dosya ama aynı fiş numarası: benzer kaydı kontrol ettim, ayrı fiş olarak bağla</label>
      <button class="btn primary block" type="submit" data-link-save disabled>Kontrol Et ve Bağla</button>
      <div role="alert" data-link-error></div>
    </form>`;
  const form = root.querySelector("[data-link-form]"), input = form.elements.document, save = form.querySelector("[data-link-save]"), error = form.querySelector("[data-link-error]");
  const setError = message => { error.innerHTML = message ? notice("warn", message) : ""; };
  const kind = () => form.elements.kind.value;
  const drawOwner = () => {
    const type = form.elements.owner_type.value, rows = type === "vehicle" ? vehicles : type === "work" ? works : customers;
    form.querySelector("[data-owner-field]").innerHTML = fSelect("Gerçek kayıt", "owner_id", options(rows), type === "work" ? initialWork?.id || "" : type === "vehicle" ? initialWork?.vehicle_id || "" : initialWork?.customer_id || "");
  };
  const drawKind = () => {
    form.querySelector("[data-work-field]").hidden = kind() !== "dump_receipt";
    form.querySelector("[data-dump-fields]").hidden = kind() !== "dump_receipt";
    form.querySelector("[data-warranty-field]").hidden = kind() !== "warranty";
    form.querySelector("[data-generic-fields]").hidden = kind() !== "generic";
  };
  form.elements.kind.addEventListener("change", drawKind); form.elements.owner_type.addEventListener("change", drawOwner);
  drawKind(); drawOwner();
  const reviewDuplicate = () => {
    if (!hash) { lastDuplicate = null; form.querySelector("[data-duplicate]").innerHTML = ""; return; }
    const candidates = documentDuplicateCandidates(d, { sha256: hash, receipt_no: form.elements.receipt_no?.value || "", dump_site_id: initialWork?.dump_site_id || "" });
    lastDuplicate = candidates;
    const exact = candidates.exact[0];
    form.querySelector("[data-duplicate]").innerHTML = exact ? notice("info", `Bu dosya zaten bağlı: ${exact.receipt_no || exact.id}. Yeni kayıt açılmayacak.`) + `<a class="btn sm" href="#/dokum-hareket/${esc(exact.id)}">Mevcut kaydı aç</a>` : candidates.similar.length ? notice("warn", "Aynı fiş numarasıyla farklı dosya bulundu. Bu kesin tekrar değil, benzer adaydır; açık onay olmadan bağlanmaz.") : "";
    form.querySelector("[data-similar-row]").hidden = !candidates.similar.length || !!exact;
  };
  input.addEventListener("change", async () => {
    const current = ++generation; file = null; hash = ""; save.disabled = true; setError("");
    try {
      const candidate = input.files[0]; if (!candidate) return;
      const safe = await prepareAttachment(candidate), digest = await sha256File(safe);
      if (current !== generation) return;
      file = safe; hash = digest;
      form.querySelector("[data-file-preview]").innerHTML = `<p class="small">Seçili: <b>${esc(file.name)}</b> · ${esc(file.type) || "bilinmiyor"} · ${file.size} bayt</p>`;
      save.disabled = false; reviewDuplicate();
    } catch (e) { if (current === generation) setError(e.message || String(e)); }
  });
  form.elements.receipt_no?.addEventListener("input", reviewDuplicate);
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (busy || !file) return;
    busy = true; save.disabled = true; setError("");
    try {
      const values = collectForm(form), checked = { ...values, sha256: hash, allow_similar: !!form.elements.allow_similar?.checked, dump_site_id: initialWork?.dump_site_id || "" };
      const result = await validateDocumentLink(d, checked, file);
      if (result.duplicate === "exact") { form.querySelector("[data-duplicate]").innerHTML = notice("info", "Kesin tekrar: yeni kayıt veya parasal hareket oluşturulmadı.") + `<a class="btn block" href="#/dokum-hareket/${esc(result.existing.id)}">Mevcut kaydı aç</a>`; return; }
      if (result.duplicate === "similar") { form.querySelector("[data-similar-row]").hidden = false; form.querySelector("[data-duplicate]").innerHTML = notice("warn", "Benzer fiş bulundu. Devam etmek için açık onay kutusunu işaretleyin; ikinci onay olmadan kayıt yok."); save.disabled = false; return; }
      if (result.kind === "warranty") { await stagePartDocuments(ctx, [result.file], { message: "Yedek parça / akü garanti belgesi" }); return; }
      if (result.kind === "dump_receipt") {
        const entry = await saveDumpEntry(result.fields, [result.file], "document-link:" + hash);
        toast(entry._existing ? "Mevcut döküm kaydı açıldı" : "Fiş, iş ve özgün belgeyle bağlandı", "ok");
        go("#/dokum-hareket/" + entry.id); return;
      }
      const doc = await db.saveDocument(result.fields, result.file);
      toast("Belge sahibine ve özgün dosyasıyla kaydedildi; ödeme oluşturulmadı", "ok");
      go("#/belgeler/" + doc.id);
    } catch (e) { setError(e.message || String(e)); save.disabled = false; }
    finally { busy = false; }
  });
  return true;
}

import { startActivity } from "./update-safety.js";
import { isActive, todayStr, uuid, fmtTL, trDate } from "./core.js";
import * as ui from "./ui.js";
import { PART_SOURCES, warrantyState } from "./parts-core.js";
import {
  saveSparePart,
  addPartFiles,
  updatePartWarranty,
  unlinkPartCost,
} from "./parts-db.js";
const {
  esc,
  appbar,
  fText,
  fNum,
  fSelect,
  fDate,
  fArea,
  kv,
  badge,
  notice,
  collectForm,
  toast,
  qs,
} = ui;
const money = (v) => (v == null ? "Belirtilmedi" : fmtTL(v) + " ₺");
const button = (text, href) =>
  `<button class="btn" data-go="${esc(href)}">${esc(text)}</button>`;
export async function screen(ctx) {
  if (ctx.parts[0] !== "yedek-parca") return false;
  const { root, db, parts, query: q } = ctx,
    d = await db.dumpAll();
  const name = (id) => d.vehicles.find((v) => v.id === id)?.name || "Araç";
  const liveParts = (d.maintenance_parts || []).filter(
    (r) => isActive(r) && r.kind !== "İşçilik",
  );
  const r = liveParts.find((r) => r.id === parts[1]);
  const edit = !!r && parts[2] === "garanti";
  const fileInput =
    '<div class="field"><label>Garanti belgesi / fatura fotoğrafları veya PDF (isteğe bağlı)</label><input name="documents" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple><small>En fazla 8 belge, toplam 30 MB. Belgeler bu telefonda saklanır; ekleri içeren yedek alın.</small><div data-file-preview></div></div>';
  const warrantyForm = (r = {}) =>
    `<div class="formgrid2">${fText("Marka / model", "brand", r.brand || "")}${fText("Satıcı / servis", "seller", r.seller || "")}${fText("Fatura / belge no", "invoice_no", r.invoice_no || "")}${fDate("Garanti başlangıcı (opsiyonel)", "warranty_start", r.warranty_start || "", false)}${fDate("Garanti bitişi (opsiyonel)", "warranty_until", r.warranty_until || "", false)}</div>${fArea("Seri numaraları (her parça ayrı satır)", "serial_numbers", r.serial_numbers || "")}${fArea("Not", "note", r.note || "")}`;
  if (parts[1] === "new" || edit) {
    const vehicles = d.vehicles
      .filter(isActive)
      .map((v) => ({ v: v.id, t: v.name }));
    root.innerHTML =
      appbar(
        edit ? "Garanti Bilgilerini Düzenle" : "Yeni Yedek Parça",
        edit
          ? r.description
          : "Araç, parça, maliyet ve belgeleri birlikte takip edin",
      ) +
      `<form data-part-form><div class="card">${
        edit
          ? kv("Araç", name(r.vehicle_id))
          : `${fSelect("Araç / Makine", "vehicle_id", vehicles, q.vehicle_id || "")}${fDate("Alış tarihi", "date", todayStr(), true)}${fText("Parça adı", "description", "", { req: true, ph: "Akü, lastik, filtre…" })}<div class="formgrid2">${fNum("Miktar", "quantity", 1, { min: 0.001, step: "any", req: true })}${fNum("Birim fiyat (KDV dahil, opsiyonel)", "unit_price", "", { min: 0, step: "any" })}</div><div data-total class="notice info">Tutar belirtilmedi</div>${fSelect(
              "Maliyet kaydı",
              "cost_mode",
              [
                { v: "tracking", t: "Yalnız parça ve garanti takibi" },
                { v: "existing", t: "Mevcut gider / bakım / alışa bağla" },
                { v: "new_expense", t: "Bu işlem için yeni gider oluştur" },
              ],
              "tracking",
            )}<div data-source hidden>${fSelect("Mevcut maliyet", "source", [], "")}</div>${notice("info", "Bakım veya alış bedeli önceden kaydedildiyse mevcut kayda bağlayın. Yeni gider seçimi bedeli bir kez giderlere yazar; kasa/banka ödemesi oluşturmaz. Veresiye için Alış Belgeleri / Borçlar bölümündeki belgeye bağlayın.")}`
      }${warrantyForm(edit ? r : {})}${edit ? "" : fileInput}</div><button class="btn primary block" type="submit">${edit ? "Garanti Bilgilerini Kaydet" : "Parça ve Belgeleri Kaydet"}</button><div data-part-error role="alert"></div></form>`;
    const form = qs("form", root),
      draftId = "spare-part-new:" + (q.vehicle_id || "all");
    const draft = edit ? null : await db.draftGet(draftId);
    const committed =
      draft?.key &&
      d.maintenance_parts.find(
        (r) => r.request_id === draft.key && isActive(r),
      );
    if (!edit && committed) {
      await db.draftClear(draftId);
      ctx.go("#/yedek-parca/" + committed.id);
      return true;
    }
    const key = draft?.key || uuid();
    let selectedFiles = draft?.files || [],
      pendingDraft = Promise.resolve();
    if (draft?.fields) ui.setForm(form, draft.fields);
    if (!edit) {
      qs("[data-file-preview]", form).textContent = selectedFiles
        .map((f) => f.name || "belge")
        .join(" · ");
      const persist = () => {
        if (form.inert) return;
        const fields = collectForm(form),
          files = [...selectedFiles];
        pendingDraft = pendingDraft
          .then(() => db.draftSave(draftId, { key, fields, files }))
          .catch((e) => {
            qs("[data-part-error]", root).textContent =
              "Taslak kaydedilemedi: " + e.message;
          });
      };
      form.addEventListener("input", persist);
      qs("[name=documents]", form).addEventListener("change", (e) => {
        selectedFiles = [...e.target.files];
        if (
          selectedFiles.length > 8 ||
          selectedFiles.reduce((n, f) => n + f.size, 0) > 30 * 1024 * 1024
        ) {
          qs("[data-part-error]", root).textContent =
            "En fazla 8 belge / 30 MB seçin";
          return;
        }
        persist();
      });
    }
    const update = () => {
      if (edit) return;
      const f = collectForm(form),
        select = qs("[name=source]", form),
        prior = select.value;
      qs("[data-source]", form).hidden = f.cost_mode !== "existing";
      select.innerHTML =
        '<option value="">— seçin —</option>' +
        Object.entries(PART_SOURCES)
          .flatMap(([store, label]) =>
            (d[store] || [])
              .filter(
                (s) =>
                  isActive(s) &&
                  s.status !== "İptal" &&
                  s.vehicle_id === f.vehicle_id &&
                  !(
                    store === "payables" &&
                    (s.bill_kind === "Açılış / Devir" ||
                      s.source_store === "fuel_tank_movements")
                  ),
              )
              .map(
                (s) =>
                  `<option value="${esc(store + ":" + s.id)}">${esc(label + " · " + trDate(s.date) + " · " + (s.description || s.maint_type || s.cost_category || "") + " · " + money(s.amount ?? s.cost ?? s.gross_total))}</option>`,
              ),
          )
          .join("");
      select.value = prior;
      qs("[data-total]", form).textContent =
        f.unit_price === ""
          ? "Tutar belirtilmedi"
          : `Parça toplamı: ${money(Number(f.quantity) * Number(f.unit_price))}`;
    };
    form.addEventListener("input", (e) => {
      if (e.target.name !== "source") update();
    });
    update();
    if (draft?.fields?.source)
      qs("[name=source]", form).value = draft.fields.source;
    qs("[name=documents]", form)?.addEventListener("change", (e) => {
      qs("[data-file-preview]", form).textContent = [...e.target.files]
        .map((f) => f.name)
        .join(" · ");
    });
    form.onsubmit = async (e) => {
      e.preventDefault();
      const b = qs("[type=submit]", form);
      if (b.disabled) return;
      b.disabled = true;
      form.inert = true;
      const finish = startActivity("Yedek parça ve belgeler kaydediliyor");
      qs("[data-part-error]", root).textContent = "";
      try {
        await pendingDraft;
        const f = collectForm(form);
        if (f.source) {
          const i = f.source.indexOf(":");
          f.cost_source_store = f.source.slice(0, i);
          f.cost_source_id = f.source.slice(i + 1);
        }
        delete f.source;
        delete f.documents;
        const saved = edit
          ? await updatePartWarranty(r.id, f, r.updated_at)
          : await saveSparePart(f, selectedFiles, key);
        if (!edit) await db.draftClear(draftId);
        toast("Parça ve belgeler kaydedildi", "ok");
        ctx.go("#/yedek-parca/" + saved.id);
      } catch (err) {
        qs("[data-part-error]", root).textContent = err.message;
        toast(err.message, "err");
      } finally {
        finish();
        form.inert = false;
        b.disabled = false;
      }
    };
    return true;
  }
  if (parts[1]) {
    if (!r) {
      root.innerHTML =
        appbar("Yedek Parça") + notice("warn", "Parça bulunamadı");
      return true;
    }
    const state = warrantyState(r),
      source = r.cost_source_store && r.cost_source_id;
    const href = source
      ? {
          expense_records: "#/gider/",
          maintenance_records: "#/bakim/",
          payables: "#/alislar/",
        }[r.cost_source_store] + r.cost_source_id
      : r.maintenance_id
        ? "#/bakim/" + r.maintenance_id
        : null;
    root.innerHTML =
      appbar(r.description, name(r.vehicle_id)) +
      `<div class="card">${badge(state.label, state.kind)}${kv("Araç", name(r.vehicle_id))}${kv("Alış tarihi", trDate(r.date))}${kv("Miktar", r.quantity)}${kv("Birim fiyat", money(r.unit_price))}${kv("Parça toplamı", money(r.total))}${kv("Marka / model", r.brand || "—")}${kv("Satıcı", r.seller || "—")}${kv("Belge no", r.invoice_no || "—")}${kv("Seri numaraları", r.serial_numbers || "—")}${kv("Garanti başlangıcı", r.warranty_start ? trDate(r.warranty_start) : "Belirtilmedi")}${kv("Garanti bitişi", r.warranty_until ? trDate(r.warranty_until) : "Belirtilmedi")}${kv("Not", r.note || "—")}${notice("info", source ? "Maliyet bağlı kayıtta bir kez sayılır. Bu parça kartı ayrıca gider üretmez." : r.maintenance_id ? "Bu kalem bakım bedelinin ayrıntısıdır; ayrıca gider sayılmaz." : "Yalnız parça ve garanti takibi. Bu kayıt gider, stok veya kasa hareketi oluşturmaz.")}${href ? button("Maliyet Kaydını Aç", href) : ""}${source ? '<button class="btn" data-unlink>Maliyet Bağlantısını Kaldır</button>' : ""}${button("Araç Kartı", "#/filo/" + r.vehicle_id)}${r.tracking ? button("Garanti Bilgilerini Düzenle", "#/yedek-parca/" + r.id + "/garanti") : ""}</div><div class="card"><h3>Garanti / Fatura Belgeleri</h3><div data-attachments></div><form data-add-files>${fileInput}<button class="btn primary" type="submit">Belgeleri Ekle</button><div role="alert" data-file-error></div></form></div>`;
    qs("[data-unlink]", root)?.addEventListener("click", async () => {
      const reason = await ui.promptDialog(
        "Maliyet bağlantısını kaldır",
        "Gerekçe (gider / alış kaydı silinmez; ayrı düzeltilebilir)",
      );
      if (!reason) return;
      try {
        await unlinkPartCost(r.id, reason);
        await ctx.reload();
      } catch (e) {
        toast(e.message, "err");
      }
    });
    const atts = await db.attachmentsFor("maintenance_parts", r.id),
      holder = qs("[data-attachments]", root);
    holder.innerHTML = atts.length
      ? ""
      : notice("info", "Henüz belge eklenmedi.");
    const urls = [];
    const observer = new MutationObserver(() => {
      if (!root.isConnected) {
        urls.forEach((u) => URL.revokeObjectURL(u));
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    for (const a of atts) {
      if (a.type?.startsWith("image/")) {
        const img = document.createElement("img");
        img.alt = a.name;
        img.loading = "lazy";
        img.decoding = "async";
        img.style.cssText = "width:100%;max-height:240px;object-fit:contain";
        const url = URL.createObjectURL(a.blob);
        urls.push(url);
        img.src = url;
        holder.append(img);
      }
      const b = document.createElement("button");
      b.className = "btn block";
      b.textContent = "📎 " + a.name;
      b.onclick = () => ui.downloadBlob(a.blob, a.name);
      holder.append(b);
    }
    qs("[data-add-files]", root).onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target,
        b = qs("button[type=submit]", form);
      if (b.disabled) return;
      b.disabled = true;
      form.inert = true;
      const finish = startActivity("Parça belgeleri kaydediliyor");
      try {
        await addPartFiles(r.id, [...qs("[name=documents]", form).files]);
        await ctx.reload();
      } catch (err) {
        qs("[data-file-error]", form).textContent = err.message;
      } finally {
        finish();
        form.inert = false;
        b.disabled = false;
      }
    };
    return true;
  }
  const selected = q.vehicle_id || "";
  root.innerHTML =
    appbar(
      "Yedek Parça / Garanti",
      "Araçlara alınan parçalar ve garanti belgeleri",
    ) +
    button(
      "+ Yedek Parça Ekle",
      "#/yedek-parca/new" +
        (selected ? "?vehicle_id=" + encodeURIComponent(selected) : ""),
    ) +
    `<div class="card">${fSelect(
      "Araç filtresi",
      "vehicle_filter",
      d.vehicles.filter(isActive).map((v) => ({ v: v.id, t: v.name })),
      selected,
    )}<div class="field"><label>Parça / marka / seri no ara</label><input data-search type="search" placeholder="Akü, lastik, seri no…"></div>${fSelect(
      "Garanti filtresi",
      "warranty_filter",
      [
        { v: "expired", t: "Garantisi dolanlar" },
        { v: "soon", t: "30 gün içinde dolacaklar" },
        { v: "unknown", t: "Garanti tarihi eksik" },
      ],
      "",
    )}</div><div data-parts-list></div>`;
  const show = () => {
    const term = qs("[data-search]", root).value.toLocaleLowerCase("tr-TR"),
      v = qs("[name=vehicle_filter]", root).value,
      w = qs("[name=warranty_filter]", root).value;
    const rows = liveParts
      .filter((r) => !v || r.vehicle_id === v)
      .filter((r) =>
        [r.description, r.brand, r.serial_numbers, name(r.vehicle_id)]
          .join(" ")
          .toLocaleLowerCase("tr-TR")
          .includes(term),
      )
      .filter((r) => {
        const s = warrantyState(r);
        return (
          !w ||
          (w === "expired"
            ? s.days < 0
            : w === "soon"
              ? s.days >= 0 && s.days <= 30
              : s.days == null)
        );
      })
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    qs("[data-parts-list]", root).innerHTML = rows.length
      ? rows
          .map((r) => {
            const s = warrantyState(r);
            return `<div class="card tap" data-go="#/yedek-parca/${esc(r.id)}"><b>${esc(r.description)}</b>${kv(name(r.vehicle_id), `${r.quantity} adet · ${trDate(r.date)}`)}${badge(s.label, s.kind)}<p class="small">${r.cost_source_id ? "Bağlı maliyet" : r.maintenance_id ? "Bakım ayrıntısı" : "Yalnız takip"} · ${esc(money(r.total))}</p></div>`;
          })
          .join("")
      : notice("info", "Bu filtrede parça yok.");
  };
  root.addEventListener("input", show);
  root.addEventListener("change", show);
  show();
  return true;
}

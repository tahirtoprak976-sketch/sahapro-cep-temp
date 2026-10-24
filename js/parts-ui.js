import { startActivity } from "./update-safety.js";
import { isActive, todayStr, uuid, fmtTL, trDate } from "./core.js";
import * as ui from "./ui.js";
import { PART_SOURCES, warrantyState } from "./parts-core.js";
import {bindPartDocumentReader,stagePartDocuments} from './part-document-ui.js';
import {
  saveSparePart,
  addPartFiles,
  updatePartWarranty,
  unlinkPartCost,
  preparePartFiles,
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
  `<button type="button" class="btn" data-go="${esc(href)}">${esc(text)}</button>`;
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
    '<div class="field"><label>Garanti belgesi / fatura fotoğrafları veya PDF (isteğe bağlı)</label><input name="documents" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf" multiple><small>En fazla 8 belge, toplam 30 MB. Kaydedilmiş belgeler korunur. Orijinaller bu telefonda saklanır; ekleri içeren yedek alın.</small><div data-file-preview></div><div data-original-part-files></div><div data-shared-parts></div></div>';
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
          : `${fSelect("Araç / Makine", "vehicle_id", vehicles, q.vehicle_id || "")}${fDate("Alış tarihi", "date", q.part_draft?'':todayStr(), true)}${fText("Parça adı", "description", "", { req: true, ph: "Akü, lastik, filtre…" })}<div class="formgrid2">${fNum("Miktar", "quantity", q.part_draft?'':1, { min: 0.001, step: "any", req: true })}${fNum("Birim fiyat (KDV dahil, opsiyonel)", "unit_price", "", { min: 0, step: "any" })}</div><div data-total class="notice info">Tutar belirtilmedi</div>${fSelect(
              "Maliyet kaydı",
              "cost_mode",
              [
                { v: "tracking", t: "Yalnız parça ve garanti takibi" },
                { v: "existing", t: "Mevcut gider / bakım / alışa bağla" },
                { v: "new_expense", t: "Bu işlem için yeni gider oluştur" },
              ],
              "tracking",
            )}<div data-source hidden>${fSelect("Mevcut maliyet", "source", [], "")}</div>${notice("info", "Bakım veya alış bedeli önceden kaydedildiyse mevcut kayda bağlayın. Yeni gider seçimi bedeli bir kez giderlere yazar; kasa/banka ödemesi oluşturmaz. Veresiye için Alış Belgeleri / Borçlar bölümündeki belgeye bağlayın.")}`
      }${warrantyForm(edit ? r : {})}${fileInput}</div><button class="btn primary block" type="submit">${edit ? "Garanti ve Belgeleri Kaydet" : "Parça ve Belgeleri Kaydet"}</button><div data-part-error role="alert"></div></form>`;
    const form = qs("form", root),
      draftId = /^[a-f0-9-]{36}$/i.test(q.part_draft||'')?'part-document:'+q.part_draft:edit?'spare-part-edit:'+r.id:"spare-part-new:" + (q.vehicle_id || "all");
    form.inert=true;
    const draft = await db.draftGet(draftId);
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
      pendingDraft = Promise.resolve(),pendingFiles=Promise.resolve(),readerResults=draft?.readerResults||[],readAttempted=!!draft?.auto_read_attempted,reader;
    const editedFields=new Set(draft?.editedFields||(draft?.fields?Object.keys(draft.fields):edit?Object.keys(r):[]));
    let baseVersion=draft?.base_version||r?.updated_at;
    const originalUrls=[];
    const revokeOriginals=()=>{for(const url of originalUrls.splice(0))URL.revokeObjectURL(url);};
    const observer=new MutationObserver(()=>{if(!form.isConnected){revokeOriginals();observer.disconnect();}});observer.observe(root,{childList:true,subtree:true});
    if (draft?.fields) ui.setForm(form, draft.fields);
    if(!edit&&q.part_draft&&!draft?.fields?.date)qs('[name=date]',form).value='';
      const persist = (pendingSelection=null) => {
        if (form.inert) return;
        const fields = collectForm(form),
          files = Array.isArray(pendingSelection)?pendingSelection:[...selectedFiles];
        pendingDraft = pendingDraft
          .then(() => db.draftSave(draftId, { key, fields, files,editedFields:[...editedFields],readerResults,auto_read_attempted:readAttempted,base_version:baseVersion }))
          .catch((e) => {
            qs("[data-part-error]", root).textContent =
              "Taslak kaydedilemedi: " + e.message;
          });
        return pendingDraft;
      };
      form.addEventListener("input",e=>{if(e.target.name)editedFields.add(e.target.name);persist();});
      const previewFiles=()=>{
       const holder=qs('[data-file-preview]',form);
       holder.innerHTML=selectedFiles.map((f,i)=>`<p class="small">${esc(f.name||'belge')} <button class="btn small" type="button" data-remove-part-file="${i}">Kaldır</button></p>`).join('');
       for(const b of ui.qsa('[data-remove-part-file]',holder))b.onclick=()=>{const file=selectedFiles[Number(b.dataset.removePartFile)];pendingFiles=pendingFiles.then(async()=>{selectedFiles=selectedFiles.filter(f=>f!==file);reader?.syncFiles(await preparePartFiles(selectedFiles));readerResults=reader?.state()||[];previewFiles();await sharedFiles();await persist();}).catch(e=>{qs('[data-part-error]',root).textContent=e.message;});};
      };
      const sharedFiles=async()=>{
       const prepared=await preparePartFiles(selectedFiles);
       revokeOriginals();const view=qs('[data-original-part-files]',form);view.innerHTML='';
       for(const file of prepared){const url=URL.createObjectURL(file.blob);originalUrls.push(url);const detail=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Orijinal belge: '+file.name;detail.append(summary);
        if(file.type.startsWith('image/')){const img=document.createElement('img');img.src=url;img.alt=file.name;img.style.cssText='width:100%;max-height:360px;object-fit:contain';detail.append(img);}
        const open=document.createElement('button');open.type='button';open.className='btn small';open.textContent='Orijinali aç / indir';open.onclick=()=>ui.downloadBlob(file.blob,file.name);detail.append(open);view.append(detail);}
       if(edit)return;const atts=await db.getAll('attachments'),all=await db.listActive('maintenance_parts');
       const found=all.filter(p=>atts.some(a=>a.record_type==='maintenance_parts'&&a.record_id===p.id&&prepared.some(x=>x.src_sha256===a.src_sha256)));
       qs('[data-shared-parts]',form).innerHTML=found.length?notice('warn','Bu belge mevcut parça kartında kayıtlı; yanlışlıkla ikinci kart açmayın.')+found.map(p=>button(p.description,'#/yedek-parca/'+p.id)).join('')+'<label class="history-check small"><input type="checkbox" data-part-shared-allow> Belge farklı bir parçaya da ait; yeni kart oluşturmak istiyorum.</label>':'';
      };
      qs("[name=documents]", form).addEventListener("change", (e) => {
       const incoming=[...e.target.files];e.target.value='';
       if(selectedFiles.length+incoming.length>8||[...selectedFiles,...incoming].reduce((n,f)=>n+f.size,0)>30*1024*1024){qs('[data-part-error]',root).textContent='En fazla 8 belge / 30 MB seçin';return;}
       form.dataset.partFilesReady='0';persist([...selectedFiles,...incoming]);
       pendingFiles=pendingFiles.then(async()=>{
        const all=[...selectedFiles,...incoming];const prepared=await preparePartFiles(all);
        if(!form.isConnected)return;const seen=new Set();selectedFiles=all.filter((f,i)=>!seen.has(prepared[i].src_sha256)&&seen.add(prepared[i].src_sha256));
        reader?.syncFiles(prepared);readerResults=reader?.state()||[];previewFiles();await sharedFiles();await persist();form.dataset.partFilesReady='1';
       }).catch(err=>{if(form.isConnected){qs('[data-part-error]',root).textContent=err.message;previewFiles();persist();form.dataset.partFilesReady='1';}});
      });
      previewFiles();try{await sharedFiles();}catch(e){qs('[data-part-error]',root).textContent=e.message;}
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
    reader=bindPartDocumentReader({ctx,form,data:d,getFiles:async()=>{await pendingFiles;return [...selectedFiles];},getEdited:()=>[...editedFields],initial:readerResults,autoRead:q.read==='1'&&!readAttempted,
      onApply:updates=>{ui.setForm(form,updates);for(const k of Object.keys(updates))editedFields.add(k);update();persist();},
      onState:async(results,attempted)=>{readerResults=results;readAttempted=attempted;if(!edit)for(const field of ['date','quantity'])if(!editedFields.has(field))qs(`[name="${field}"]`,form).value='';persist();await pendingDraft;}});
    form.onsubmit = async (e) => {
      e.preventDefault();
      const b = qs("[type=submit]", form);
      if (b.disabled) return;
      b.disabled = true;
      form.inert = true;
      const finish = startActivity("Yedek parça ve belgeler kaydediliyor");
      qs("[data-part-error]", root).textContent = "";
      try {
        await pendingFiles;
        await pendingDraft;
        const f = collectForm(form);
        if (f.source) {
          const i = f.source.indexOf(":");
          f.cost_source_store = f.source.slice(0, i);
          f.cost_source_id = f.source.slice(i + 1);
        }
        delete f.source;
        delete f.documents;
        f.allow_shared_document=qs('[data-part-shared-allow]',form)?.checked===true;
        const saved = edit
          ? await updatePartWarranty(r.id, f, baseVersion,selectedFiles)
          : await saveSparePart(f, selectedFiles, key);
        await db.draftClear(draftId);
        toast("Parça ve belgeler kaydedildi", "ok");
        ctx.go("#/yedek-parca/" + saved.id);
      } catch (err) {
        try{await sharedFiles();}catch{}
        qs("[data-part-error]", root).textContent = err.message;
        if(edit&&/başka ekranda değişti/.test(err.message)){
         const refresh=document.createElement('button');refresh.type='button';refresh.className='btn block';refresh.textContent='Güncel garanti bilgilerini yükle; belgeleri koru';refresh.dataset.partRefresh='';qs('[data-part-error]',root).append(refresh);
         refresh.onclick=async()=>{try{const current=await db.get('maintenance_parts',r.id);if(!current||current.deleted_at)throw Error('Parça artık kullanılamıyor');ui.setForm(form,current);baseVersion=current.updated_at;editedFields.clear();for(const k of Object.keys(current))editedFields.add(k);reader.refresh();persist();qs('[data-part-error]',root).textContent='Güncel bilgiler yüklendi. Belgeden aktarılacak değişiklikleri tekrar seçin.';}catch(e){toast(e.message,'err');}};
        }
        toast(err.message, "err");
      } finally {
        finish();
        form.inert = false;
        b.disabled = false;
      }
    };
    form.inert=false;
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
    if(atts.length&&r.tracking){const read=document.createElement('button');read.className='btn block';read.textContent='Belgelerden garanti bilgilerini oku';read.dataset.readSavedPart='';holder.before(read);read.onclick=async()=>{if(read.disabled)return;read.disabled=true;try{await stagePartDocuments(ctx,atts.map(a=>new File([a.blob],a.name,{type:a.type})),{part:r});}catch(e){toast(e.message,'err');read.disabled=false;}};}
    holder.innerHTML = atts.length
      ? ""
      : notice("info", "Henüz belge eklenmedi.");
    const urls = [];
    const observer = new MutationObserver(() => {
      if (!holder.isConnected) {
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

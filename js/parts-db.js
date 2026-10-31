import { prepareAttachment } from "./attachment-safety.js";
import { newRecord, uuid, stableStringify, nowISO, isActive } from "./core.js";
import { transaction } from "./enterprise-db.js";
import { sparePartFields } from "./parts-core.js";
import {purchaseDraft} from './parts-history-core.js';
const stores = [
  "maintenance_parts",
  "vehicles",
  "expense_records",
  "maintenance_records",
  "payables",
  "suppliers",
];
function createPartExpense(r, t) {
  const expense = newRecord({date:r.date,vehicle_id:r.vehicle_id,category:"Yedek Parça",amount:r.total,company:r.seller,description:`${r.quantity} × ${r.description}`,payment_method:null,kdv_rate:null,part_id:r.id});
  t.add("expense_records",expense);
  return {...r,cost_mode:"existing",cost_source_store:"expense_records",cost_source_id:expense.id};
}
export async function preparePartFiles(files = []) {
  if (files.length > 8) throw Error("Bir seferde en fazla 8 belge ekleyin");
  if (files.reduce((s, f) => s + f.size, 0) > 30 * 1024 * 1024)
    throw Error("Belgelerin toplamı en fazla 30 MB olabilir");
  const result = [];
  for (const file of files) {
    if (!file.size || file.size > 15 * 1024 * 1024)
      throw Error("Her belge 0–15 MB arasında olmalı");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const normalized = await prepareAttachment(file, { maxBytes:15*1024*1024 });
    const hash = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    // Garanti/fatura kanıtı özgün çözünürlükte korunur; boyut sınırı girişte uygulanır.
    const type=normalized.type;
    const blob = normalized;
    result.push({
      id: uuid(),
      name: file.name || "belge",
      type,
      size: blob.size,
      blob,
      src_sha256: hash,
      kind: "warranty",
      created_at: nowISO(),
    });
  }
  return result;
}
export async function saveSparePart(f, files = [], key = uuid()) {
  const prepared = await preparePartFiles(files);
  const {allow_shared_document,...contentFields}=f;
  const signature = stableStringify({
    fields: contentFields,
    files: prepared.map((a) => a.src_sha256),
  });
  return transaction([...stores, "attachments"], (d, t) => {
    const old = d.maintenance_parts.find((r) => r.request_id === key);
    if (old) {
      if (old.request_signature !== signature)
        throw Error(
          "Bu işlem anahtarı farklı içerikle kullanılmış; ekranı yeniden açın",
        );
      return old;
    }
    if(f.purchase_source_key){
      const at=String(f.purchase_source_key).indexOf(':');
      const {group}=purchaseDraft(d,String(f.purchase_source_key).slice(0,at),String(f.purchase_source_key).slice(at+1));
      if(group.signature!==f.purchase_source_signature)throw Error('Alış / gider değişti. Güncel kaynağı yeniden açın.');
      if(f.cost_mode!=='existing'||f.cost_source_store!==group.store||f.cost_source_id!==group.source.id||f.vehicle_id!==group.vehicle_id)throw Error('Bu alış için mevcut maliyet bağlantısını koruyun; ikinci gider oluşturulmaz.');
    }
    const fields = sparePartFields(d, f);
    const shared=prepared.some(a=>d.attachments.some(old=>old.src_sha256===a.src_sha256&&old.record_type==='maintenance_parts'&&d.maintenance_parts.some(p=>isActive(p)&&p.id===old.record_id)));
    if(shared&&f.allow_shared_document!==true)throw Error('Bu belge başka bir parça kartında zaten var. Mevcut kartı inceleyin veya farklı parçaya da ait olduğunu açıkça işaretleyin.');
    let r = newRecord({
      ...fields,
      request_id: key,
      request_signature: signature,
    });
    if (fields.cost_mode === "new_expense") {
      r = createPartExpense(r,t);
    }
    t.add("maintenance_parts", r);
    const seen = new Set();
    for (const a of prepared) {
      if (seen.has(a.src_sha256)) continue;
      seen.add(a.src_sha256);
      t.add("attachments", {
        ...a,
        record_type: "maintenance_parts",
        record_id: r.id,
      });
    }
    return r;
  });
}
// A saved tracking card can acquire one cost without recreating the part or its documents.
export async function attachPartCost(id, f, expectedVersion, key=uuid()) {
  if(!["existing","new_expense"].includes(f.cost_mode))throw Error("Yeni gider veya mevcut maliyet seçin");
  const intent={cost_mode:f.cost_mode,unit_price:f.cost_mode==='new_expense'?f.unit_price:null,cost_source_store:f.cost_mode==='existing'?f.cost_source_store:null,cost_source_id:f.cost_mode==='existing'?f.cost_source_id:null};
  const signature=stableStringify(intent);
  return transaction(stores,(d,t)=>{
    const old=d.maintenance_parts.find(r=>r.id===id&&r.tracking&&isActive(r));
    if(!old)throw Error("Parça bulunamadı");
    if(old.cost_request?.id===key){
      if(old.cost_request.signature!==signature)throw Error("Bu maliyet işlemi farklı içerikle tekrar gönderildi");
      if(!old.cost_source_id)throw Error("Bu maliyet bağlantısı kaldırılmış; güncel kartı açın");
      sparePartFields(d,old);return old;
    }
    if(!expectedVersion||old.updated_at!==expectedVersion)throw Error("Parça başka ekranda değişti; yeniden açın");
    if(old.cost_source_id||old.maintenance_id)throw Error("Parçanın maliyeti zaten bağlı; ikinci gider oluşturulamaz");
    const unlinked=old.cost_unlinked;
    if(f.cost_mode==='new_expense'&&unlinked&&(d[unlinked.store]||[]).some(r=>r.id===unlinked.id&&isActive(r)&&r.status!=="İptal"))throw Error("Önceki maliyet kaydı hâlâ duruyor. Mevcut kayda bağlayın veya önce o kaydı düzeltin; ikinci gider oluşturulmadı.");
    const fields=sparePartFields(d,{...old,...intent,unit_price:f.cost_mode==='new_expense'?f.unit_price:old.unit_price});
    let saved={...old,...fields,cost_request:{id:key,signature},updated_at:new Date(Math.max(Date.now(),(Date.parse(old.updated_at)||0)+1)).toISOString()};
    if(f.cost_mode==='new_expense')saved=createPartExpense(saved,t);
    t.put('maintenance_parts',saved);return saved;
  });
}
export async function addPartFiles(id, files) {
  const prepared = await preparePartFiles(files);
  if (!prepared.length) throw Error("Belge seçin");
  return transaction(["maintenance_parts", "attachments"], (d, t) => {
    if (!d.maintenance_parts.some((r) => r.id === id && isActive(r)))
      throw Error("Parça bulunamadı");
    const seen = new Set(
      d.attachments
        .filter(
          (a) => a.record_type === "maintenance_parts" && a.record_id === id,
        )
        .map((a) => a.src_sha256),
    );
    for (const a of prepared) {
      if (seen.has(a.src_sha256)) continue;
      seen.add(a.src_sha256);
      t.add("attachments", {
        ...a,
        record_type: "maintenance_parts",
        record_id: id,
      });
    }
  });
}
export async function updatePartWarranty(id, f, expectedVersion, files=[]) {
  const prepared=await preparePartFiles(files);
  return transaction([...stores,'attachments'], (d, t) => {
    const old = d.maintenance_parts.find(
      (r) => r.id === id && isActive(r) && r.kind!=="İşçilik",
    );
    if (!old) throw Error("Parça bulunamadı");
    const maintenance=old.maintenance_id&&d.maintenance_records.find(m=>m.id===old.maintenance_id&&isActive(m)&&m.status!=="İptal"&&m.vehicle_id===old.vehicle_id);
    if(!old.tracking&&!maintenance)throw Error("Parçanın bakım kaydı bulunamadı; kaynağı kontrol edin.");
    if (!expectedVersion || old.updated_at !== expectedVersion)
      throw Error("Parça başka ekranda değişti; yeniden açın");
    const current = sparePartFields(d, {
      ...old,
      date:old.date||maintenance?.date,
      cost_mode:old.cost_mode||"tracking",
      warranty_start: f.warranty_start,
      warranty_until: f.warranty_until,
      brand: f.brand,
      serial_numbers: f.serial_numbers,
      seller: f.seller,
      invoice_no: f.invoice_no,
      note: f.note,
    });
    const r = {
      ...old,
      ...current,
      updated_at: new Date(
        Math.max(Date.now(), (Date.parse(old.updated_at) || 0) + 1),
      ).toISOString(),
    };
    t.put("maintenance_parts", r);
    const seen=new Set(d.attachments.filter(a=>a.record_type==='maintenance_parts'&&a.record_id===id).map(a=>a.src_sha256));
    for(const a of prepared)if(!seen.has(a.src_sha256)){seen.add(a.src_sha256);t.add('attachments',{...a,record_type:'maintenance_parts',record_id:id});}
    return r;
  });
}
export async function unlinkPartCost(id, reason) {
  if (!reason?.trim()) throw Error("Bağlantıyı kaldırma nedeni zorunlu");
  return transaction(stores, (d, t) => {
    const old = d.maintenance_parts.find(
      (r) => r.id === id && r.tracking && isActive(r),
    );
    if (!old?.cost_source_id) throw Error("Bağlı maliyet bulunamadı");
    const r = {
      ...old,
      cost_mode: "tracking",
      cost_source_store: null,
      cost_source_id: null,
      cost_unlinked: {
        store: old.cost_source_store,
        id: old.cost_source_id,
        reason: reason.trim(),
        at: nowISO(),
      },
      updated_at: nowISO(),
    };
    t.put("maintenance_parts", r);
    return r;
  });
}

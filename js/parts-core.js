// Araç parça/garanti takibi. Depo stok miktarı veya kasa hareketi üretmez.
import { isActive, toKurus, fromKurus, todayStr } from "./core.js";
import { validDate } from "./enterprise-core.js";
export const PART_SOURCES = {
  expense_records: "Gider",
  maintenance_records: "Bakım",
  payables: "Alış belgesi",
};
const clean = (v, max = 500) =>
  String(v || "")
    .trim()
    .slice(0, max);
export function sparePartFields(d, f) {
  const vehicle = (d.vehicles || []).find(
    (v) => isActive(v) && v.id === f.vehicle_id,
  );
  if (!vehicle) throw Error("Araç seçin");
  validDate(f.date);
  if (f.date > todayStr()) throw Error("Alış tarihi gelecekte olamaz");
  const description = clean(f.description, 150),
    quantity = Number(f.quantity);
  if (!description) throw Error("Parça adı zorunlu");
  if(!['string','number'].includes(typeof f.quantity))throw Error('Miktar sayısal olmalı');
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000)
    throw Error("Miktar pozitif olmalı");
  const price =
    f.unit_price === "" || f.unit_price == null ? null : Number(f.unit_price);
  if(f.unit_price!=null&&f.unit_price!==''&&!['string','number'].includes(typeof f.unit_price))throw Error('Birim fiyat sayısal olmalı');
  if (
    price != null &&
    (!Number.isFinite(price) ||
      price < 0 ||
      !Number.isSafeInteger(Math.round(quantity * toKurus(price))))
  )
    throw Error("Birim fiyat geçersiz");
  const total =
    price == null ? null : fromKurus(Math.round(quantity * toKurus(price)));
  const mode = f.cost_mode;
  if (!["tracking", "existing", "new_expense"].includes(mode))
    throw Error("Maliyet seçin: yeni gider, mevcut maliyete bağlantı veya yalnız garanti takibi.");
  if (mode === "new_expense" && !(total > 0))
    throw Error("Gider için fiyat girin");
  let source_store = null,
    source_id = null;
  if (mode === "existing") {
    source_store = f.cost_source_store;
    source_id = f.cost_source_id;
    if (!Object.hasOwn(PART_SOURCES, source_store))
      throw Error("Maliyet kaynağı geçersiz");
    const r = (d[source_store] || []).find(
      (r) => isActive(r) && r.id === source_id && r.status !== "İptal",
    );
    if (!r) throw Error("Maliyet kaynağı bulunamadı");
    if (r.vehicle_id !== f.vehicle_id)
      throw Error("Maliyet kaynağı aynı araca ait olmalı");
    if (
      source_store === "payables" &&
      (r.bill_kind === "Açılış / Devir" ||
        r.source_store === "fuel_tank_movements")
    )
      throw Error("Devir veya stok alışı parçaya bağlanamaz");
  }
  const warranty_start = f.warranty_start || null,
    warranty_until = f.warranty_until || null;
  if (warranty_start) {
    validDate(warranty_start, "Garanti başlangıcı");
  }
  if (warranty_until) {
    validDate(warranty_until, "Garanti bitişi");
    if (warranty_start && warranty_until < warranty_start)
      throw Error("Garanti bitişi başlangıçtan önce olamaz");
  }
  return {
    tracking: true,
    kind: "Parça",
    vehicle_id: vehicle.id,
    date: f.date,
    description,
    quantity,
    unit_price: price,
    total,
    brand: clean(f.brand, 200),
    serial_numbers: clean(f.serial_numbers, 1000),
    seller: clean(f.seller, 150),
    invoice_no: clean(f.invoice_no, 100),
    note: clean(f.note, 2000),
    warranty_start,
    warranty_until,
    cost_mode: mode,
    cost_source_store: source_store,
    cost_source_id: source_id,
    informational: true,
  };
}
export function partCostState(d, r) {
  const store=r.cost_source_store, id=r.cost_source_id;
  if(store&&id){
    const source=(d[store]||[]).find(s=>s.id===id&&isActive(s)&&s.status!=="İptal");
    if(!source)return {label:"Maliyet bağlantısı kontrol edilmeli",kind:"warn",detail:"Bağlı kayıt bulunamadı veya iptal edildi. Yeni gider eklemeden önce bağlantıyı kontrol edin."};
    return {label:(PART_SOURCES[store]||"Maliyet")+" kaydına bağlı",kind:"ok",detail:"Maliyet bağlı kayıtta bir kez sayılır. Parça kartı ikinci gider veya kasa/banka ödemesi oluşturmaz."};
  }
  if(r.maintenance_id)return {label:"Bakım maliyetine dahil",kind:"ok",detail:"Bu kalem bakım bedelinin ayrıntısıdır; ayrıca gider sayılmaz."};
  const previous=r.cost_unlinked;
  if(previous&&(d[previous.store]||[]).some(s=>s.id===previous.id&&isActive(s)&&s.status!=="İptal"))return {label:"Önceki maliyet kaydı duruyor; bağlantı yok",kind:"warn",detail:"Bağlantı kaldırılırken gider / alış kaydı silinmedi. İkinci gider eklemeyin; mevcut maliyet kaydını kontrol edip yeniden bağlayın."};
  return {label:"Gider kaydı yok",kind:"warn",detail:"Bu kart yalnız parça ve garanti takibidir. Bedeli giderlere işlemek için yeni gider oluşturun veya mevcut maliyet kaydına bağlayın."};
}
export function warrantyState(r, today = todayStr()) {
  if (!r.warranty_until)
    return { label: "Garanti tarihi belirtilmedi", kind: "" };
  const days = Math.round(
    (Date.parse(r.warranty_until + "T12:00:00Z") -
      Date.parse(today + "T12:00:00Z")) /
      86400000,
  );
  return {
    days,
    label:
      days < 0
        ? "Garanti doldu"
        : days <= 30
          ? `Garanti: ${days} gün kaldı`
          : "Garanti devam ediyor",
    kind: days < 0 ? "danger" : days <= 30 ? "warn" : "ok",
  };
}
export function validateStoredPart(d, r) {
  // Yeni gider oluşturma komutu saklanmaz: oluşmuş gider artık bağlı maliyet kaynağıdır.
  const fields = sparePartFields(d, r);
  if (
    fields.total !== r.total ||
    !["tracking", "existing"].includes(r.cost_mode)
  )
    throw Error("Parça kaydı tutarsız");
  return fields;
}

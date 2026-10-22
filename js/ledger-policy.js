// Ortak maliyet tanımı: açılış ve stok alışı faaliyet gideri değildir.
import { isActive } from "./core.js";
export function recognizedBill(b) {
  return (
    isActive(b) &&
    b.status !== "İptal" &&
    b.bill_kind !== "Açılış / Devir" &&
    b.source_store !== "fuel_tank_movements"
  );
}
export function pricedBill(b) {
  return recognizedBill(b) && Array.isArray(b.items) && b.items.length > 0;
}
export function applyAllocations(data, base, f = {}) {
  const alloc = (data.cost_allocations || []).filter(
    (a) => isActive(a) && a.status === "Aktif",
  );
  return base
    .flatMap((r) => {
      const a = alloc.find(
        (a) => a.source_store === r.source_store && a.source_id === r.source_id,
      );
      return a
        ? a.targets.map((t) => ({
            ...r,
            ...t,
            known_tax: r.known_tax,
            allocation_id: a.id,
          }))
        : [
            {
              ...r,
              unallocated: !r.site_id && !r.vehicle_id && !r.work_record_id,
            },
          ];
    })
    .filter(
      (r) =>
        (!f.from || r.date >= f.from) &&
        (!f.to || r.date <= f.to) &&
        ["customer_id", "site_id", "vehicle_id", "personnel_id"].every(
          (k) => !f[k] || r[k] === f[k],
        ),
    );
}

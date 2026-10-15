import assert from "node:assert/strict";
import { morningBrief } from "../js/brief.js";
const n = "x";
const d = {
  customers: [{ id: "K", name: "Kaya", created_at: n }, { id: "L", name: "Leda", created_at: n }],
  vehicles: [{ id: "T", name: "34GAM627", created_at: n }, { id: "U", name: "34UL9492", created_at: n }],
  work_records: [
    { id: "W1", date: "2026-10-14", customer_id: "K", vehicle_id: "T", unit: "Sefer", quantity: 4, price_snapshot: { amount: 12000 }, created_at: n },
    { id: "W2", date: "2026-10-14", customer_id: "L", vehicle_id: "U", unit: "Saat", quantity: 8, created_at: n },
    { id: "W0", date: "2026-07-01", customer_id: "L", vehicle_id: "U", unit: "Sefer", quantity: 1, price_snapshot: { amount: 5000 }, created_at: n },
  ],
  cash_records: [{ id: "C", date: "2026-10-14", customer_id: "K", cash_type: "Müşteriden Para Alındı", amount: 3000, created_at: n }],
  cari_movements: [{ id: "M", date: "2026-10-14", customer_id: "K", type: "Tahsilat", amount: -3000, created_at: n }],
  fuel_tank_movements: [{ id: "F1", date: "2026-10-01", move_type: "GİRİŞ", liters: 1000, created_at: n }, { id: "F2", date: "2026-10-14", move_type: "ÇIKIŞ", liters: 700, created_at: n }],
  documents: [{ id: "D", vehicle_id: "T", category: "Muayene", expiry_date: "2026-10-20", created_at: n }],
};
const B = morningBrief(d, { today: "2026-10-15", notes: { K: { promise_date: "2026-10-15", promise_amount: 9000 } } });
const t = B.text;
assert.match(t, /Dün: 2 iş \(4 sefer, 8 saat\) · 12\.000 ₺ · 1 iş fiyatsız/);
assert.match(t, /34GAM627 4 sefer · 34UL9492 8 saat/);
assert.match(t, /Toplam alacak 14\.000 ₺ \(90 günü geçen 5\.000 ₺\) · dün 3\.000 ₺ tahsilat/);
assert.match(t, /Kaya bugün ödeyecek · 9\.000 ₺/);
assert.match(t, /Leda: 5\.000 ₺, en eskisi 106 gün/);
assert.match(t, /Depoda 300 L mazot · günde ~50 L → 6 gün yeter/);
assert.match(t, /34GAM627 · Muayene 20\.10\.2026'de bitiyor/);
// Pazartesi: hafta sonu
const M = morningBrief({ ...d, work_records: [] }, { today: "2026-10-19" });
assert.match(M.text, /Hafta sonu hiç iş kaydı yok/);
console.log("brief ok");

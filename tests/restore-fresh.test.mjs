import assert from "node:assert/strict";
import { freshDeviceDrops } from "../js/backup.js";
const local = { vehicles: [{ id: "lv1", name: "U36" }, { id: "lv2", name: "Benim Yeni Aracım" }], personnel: [{ id: "lp1", name: "Soner" }],
  aliases: [{ id: "la1", alias: "u35", target_type: "vehicle", target_id: "lv1" }], price_book: [{ id: "lpb", vehicle_id: "lv1" }], dump_sites: [{ id: "ld", name: "Bolluca" }] };
const obj = { data: { vehicles: [{ id: "bv1", name: "U36" }], personnel: [{ id: "bp1", name: "Soner" }], aliases: [{ id: "ba1", alias: "u35", target_type: "vehicle", target_id: "bv1" }],
  price_book: [{ id: "bpb", vehicle_id: "bv1" }], dump_sites: [{ id: "bd", name: "Bolluca" }] } };
const dr = freshDeviceDrops(local, obj);
assert.deepEqual(dr.vehicles, ["lv1"]); // aynı adlı başlangıç kartı düşer, kullanıcının yeni aracı kalır
assert.deepEqual(dr.personnel, ["lp1"]); assert.deepEqual(dr.aliases, ["la1"]); assert.deepEqual(dr.price_book, ["lpb"]); assert.deepEqual(dr.dump_sites, ["ld"]);
// İşletme kaydı olan telefonda hiçbir şey silinmez (birleştirme)
assert.deepEqual(freshDeviceDrops({ ...local, work_records: [{ id: "w" }] }, obj), {});
console.log("restore-fresh ok");

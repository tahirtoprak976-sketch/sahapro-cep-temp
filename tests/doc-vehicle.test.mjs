import assert from "node:assert/strict";
import { validateDocuments, plateKey, vehicleKind, docsSchemaProps } from "../js/assistant-docs.js";
import { templatesFor, isRoadVehicle } from "../js/maint-core.js";
const n = "x", today = "2026-10-16";
const d = { vehicles: [{ id: "V1", name: "34GAM627", plate: "34 GAM 627", type: "Tır", created_at: n }], personnel: [] };
const muayene = "ARAÇ MUAYENE RAPORU No: MR-55821 PLAKA: 34 ABC 123 CİNSİ: YARI RÖMORK MARKASI: TIRSAN MODEL YILI: 2018 Muayene Tarihi 10.10.2026 Geçerlilik 10.10.2027";
const binek = "MUAYENE No 7781 Plaka 34 XY 4455 Cinsi OTOMOBİL Marka FIAT Model Yılı 2015 Geçerlilik: 01.03.2027";
assert.equal(plateKey("34 abc 123"), "34ABC123"); assert.equal(plateKey("ABC"), ""); assert.equal(plateKey("99A12"), "");
assert.equal(vehicleKind("YARI RÖMORK"), "Yarı Römork"); assert.equal(vehicleKind("Römork"), "Römork");
assert.equal(vehicleKind("OTOMOBİL"), "Binek"); assert.equal(vehicleKind("ÇEKİCİ"), "Çekici"); assert.equal(vehicleKind("KAMYONET"), "Kamyonet");
assert.equal(vehicleKind("KAMYON"), "Kamyon"); assert.equal(vehicleKind("lastik tırnak"), "Araç/Makine");
assert.ok(docsSchemaProps().documents.items.properties.vehicle_kind);
const plan = { documents: [
  { photo: 0, category: "TÜVTÜRK / Periyodik Muayene", owner_id: null, doc_no: "MR-55821", date: "2026-10-10", expiry_date: "2027-10-10", plate: "34 ABC 123", vehicle_kind: "Yarı Römork", brand: "TIRSAN", model_year: 2018 },
  { photo: 1, category: "TÜVTÜRK / Periyodik Muayene", owner_id: null, doc_no: "7781", expiry_date: "2027-03-01", plate: "34XY4455", vehicle_kind: "Otomobil", brand: "FIAT", model_year: 2015 },
  { photo: 0, category: "TÜVTÜRK / Periyodik Muayene", owner_id: null, doc_no: "MR-55821", expiry_date: "2027-10-10", plate: "06 ZZ 999" }, // belgede yok
] };
const [a, b, c] = validateDocuments(plan, { d, today, photoTexts: [muayene, binek], photoCount: 2 });
assert.deepEqual(a.new_vehicle, { plate: "34ABC123", type: "Yarı Römork", brand: "TIRSAN", model: "", model_year: 2018 });
assert.equal(a.ok, true); assert.ok(a.issues.some((x) => /kayıtlı değil/.test(x)));
assert.equal(b.new_vehicle.type, "Binek"); assert.equal(b.ok, true);
assert.equal(c.new_vehicle, null, "uydurma plaka"); assert.equal(c.ok, false);
// Kayıtlı araç: yeni kart yok
const [e] = validateDocuments({ documents: [{ photo: 0, category: "TÜVTÜRK / Periyodik Muayene", doc_no: "1234", expiry_date: "2027-01-05", plate: "34GAM627" }] }, { d, today, photoTexts: ["no 1234 34 GAM 627 2027-01-05 05.01.2027"], photoCount: 1 });
assert.equal(e.owner_id, "V1"); assert.equal(e.new_vehicle, null);
// Bakım şablonları
assert.equal(templatesFor({ type: "Yarı Römork" })[0].title, "Fren / balata kontrolü");
assert.ok(isRoadVehicle({ type: "Binek" })); assert.equal(templatesFor({ type: "Binek" })[0].every_km, 20000);
console.log("doc-vehicle ok");

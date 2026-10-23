import assert from "node:assert/strict";
import { customerReportData, customerReportSpec, panelModel, customerChartsHtml, monthsSvg, FUEL_CHART, hasMoneyChart } from "../js/customer-report.js";

const TODAY = "2026-10-23";
const record = (id, data) => ({ id, created_at: "2026-10-01T10:00:00Z", ...data });
const job = (id, date, q, customer_id = "G") => record(id, {
  date, customer_id, vehicle_id: "V", work_type: "Gravak Nakliye", quantity: q, unit: "Sefer",
  customer_fuel_allowance_l: q * 75, price_snapshot: { amount: 0, unit_price: 0, price_source: "Mazot karşılığı" },
});
const receipt = (id, date, liters, extra = {}) => record(id, { date, customer_id: "G", vehicle_id: "V", liters, fuel_source: "Müşteri Verdi", ...extra });
function fixture() {
  return {
    customers: [record("G", { name: "TEST Güneş", fuel_rules: [{ per: 90, unit: "Sefer", only_pay: true }] }), record("C", { name: "TEST Taşeron", parent_customer_id: "G" }), record("O", { name: "TEST Diğer" })],
    vehicles: [record("V", { name: "TEST Kamyon" })],
    work_records: [job("W1", "2026-09-10", 3), job("W2", "2026-10-15", 2)],
    fuel_records: [receipt("F1", "2026-09-20", 200)],
    fuel_tank_movements: [record("T1", { date: "2026-10-20", customer_id: "G", move_type: "GİRİŞ", liters: 100 })],
    cari_movements: [],
  };
}
const report = (d, options = {}) => customerReportData(d, "G", { from: "2026-10-01", to: TODAY, today: TODAY, ...options });
let count = 0;
function test(name, fn) { fn(); count++; console.log("PASS " + name); }

test("Hak edilen 375 L ve alınan 300 L, iş/teslim aylarında; güncel kural eski hakkı değiştirmez", () => {
  const d = fixture(), before = JSON.stringify(d), R = report(d);
  assert.deepEqual([R.fuel.earned, R.fuel.received, R.fuel.balance], [375, 300, 75]);
  assert.deepEqual(R.fuelMonths.at(-2), { key: "2026-09", work: 225, collected: 200 });
  assert.deepEqual(R.fuelMonths.at(-1), { key: "2026-10", work: 150, collected: 100 });
  assert.equal(R.fuelMonths.length, 12);
  assert.deepEqual([R.fuelMonths[0].key, R.fuelMonths.at(-1).key], ["2025-11", "2026-10"]);
  assert.deepEqual([R.totals.fuelL, R.totals.fuelReceivedL], [150, 100]);
  assert.deepEqual([panelModel(R).fuel.periodEarned, panelModel(R).fuel.periodReceived], [150, 100]);
  assert.deepEqual(R.months.at(-1), { key: "2026-10", work: 0, collected: 0 });
  assert.equal(R.balanceNow, 0);
  assert.equal(R.byVehicle["TEST Kamyon"].fuelL, 150);
  assert.equal(R.byType["Gravak Nakliye"].fuelL, 150);
  assert.equal(JSON.stringify(d), before, "Rapor ve grafik verisi salt okunur");
});

test("İptal, başka müşteri, istasyon, depodan çıkış ve müşteriye satış tahsilata eklenmez", () => {
  const d = fixture();
  d.work_records.push(job("DELETED-W", "2026-10-20", 99), job("OTHER-W", "2026-10-20", 99, "O"));
  d.work_records.at(-2).deleted_at = TODAY;
  d.fuel_records.push(receipt("DELETED-F", TODAY, 999, { deleted_at: TODAY }), receipt("OTHER-F", TODAY, 999, { customer_id: "O" }), receipt("STATION-F", TODAY, 999, { fuel_source: "Petrol" }), receipt("TANK-F", TODAY, 999, { fuel_source: "Depo Tankı" }));
  for (const extra of [
    { move_type: "ÇIKIŞ" },
    { move_type: "ÇIKIŞ", delivery_kind: "customer_fuel", recipient_customer_id: "G" },
    { deleted_at: TODAY },
    { customer_id: "O" },
  ]) d.fuel_tank_movements.push(record("IGNORED" + JSON.stringify(extra), { date: TODAY, customer_id: "G", move_type: "GİRİŞ", liters: 999, ...extra }));
  const R = report(d);
  assert.deepEqual([R.fuel.earned, R.fuel.received, R.fuel.balance], [375, 300, 75]);
  assert.deepEqual([R.totals.fuelReceivedL, R.fuelCollections.length], [100, 1]);
  assert.equal(R.fuelMonths.at(-1).collected, 100);
});

test("Aynı ayın gelecekteki kayıtları dahil edilmez; 12 aydan eski devir grafiğe taşınmaz", () => {
  const d = fixture();
  d.work_records.push(job("FUTURE-W", "2026-10-24", 99), job("OLD-W", "2025-10-31", 1));
  d.fuel_records.push(receipt("FUTURE-F", "2026-10-24", 999), receipt("OLD-F", "2025-10-31", 25));
  d.fuel_tank_movements.push(record("FUTURE-T", { date: "2026-10-24", customer_id: "G", move_type: "GİRİŞ", liters: 999 }));
  d.cari_movements.push(record("FUTURE-M", { date: "2026-10-24", customer_id: "G", type: "Tahsilat", amount: -999 }));
  const R = report(d);
  assert.deepEqual([R.fuel.earned, R.fuel.received, R.fuel.balance], [450, 325, 125]);
  assert.equal(R.fuelMonths.reduce((n, m) => n + m.work, 0), 375);
  assert.equal(R.fuelMonths.reduce((n, m) => n + m.collected, 0), 300);
  assert.equal(R.months.at(-1).collected, 0);
});

test("Dönem filtresi tahsilat özetini süzer; sabit 12 aylık grafik ve güncel hesap korunur", () => {
  const d = fixture(), R = report(d), september = report(d, { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual([september.totals.fuelL, september.totals.fuelReceivedL], [225, 200]);
  assert.equal(september.fuelCollections[0].target, "TEST Kamyon");
  assert.equal(R.fuelCollections[0].target, "Depo");
  assert.deepEqual(september.fuelMonths, R.fuelMonths);
  assert.deepEqual(september.fuel, R.fuel);
});

test("Taşeronlar dahil seçiminde iş, tahsilat, grafik ve güncel mazot aynı kapsamı kullanır", () => {
  const d = fixture();
  d.work_records.push(job("CHILD-W", "2026-10-10", 1, "C"));
  d.fuel_records.push(receipt("CHILD-F", "2026-10-10", 50, { customer_id: "C" }));
  const only = report(d), all = report(d, { subs: true });
  assert.deepEqual([only.fuel.earned, only.fuel.received], [375, 300]);
  assert.deepEqual([all.fuel.earned, all.fuel.received, all.fuel.balance], [450, 350, 100]);
  assert.deepEqual([all.totals.fuelL, all.totals.fuelReceivedL], [225, 150]);
  assert.deepEqual(all.fuelMonths.at(-1), { key: "2026-10", work: 225, collected: 150 });
  assert.equal(all.fuelCollections[0].customer, "TEST Taşeron");
});

test("Kural kaldırılmış veya dönem boş olsa da geçmiş mazot ve avans teslimatı görünür", () => {
  const d = fixture(); d.customers[0].fuel_rules = [];
  const R = report(d, { from: "2026-01-01", to: "2026-01-31" });
  assert.equal(R.totals.fuelL, 0);
  assert.equal(R.fuel.earned, 375);
  d.work_records = []; d.fuel_tank_movements = [];
  const advance = report(d);
  assert.deepEqual([advance.fuel.earned, advance.fuel.received, advance.fuel.balance], [0, 200, -200]);
  assert.ok(customerChartsHtml(advance).includes('data-customer-chart="fuel"'));
});

test("Karma müşteri: TL iş/tahsilat ve litre birbirine eklenmeden iki grafik olarak çizilir", () => {
  const d = fixture();
  d.work_records.push(record("MONEY-W", { customer_id: "G", date: "2026-10-21", work_type: "Makine Çalışması", quantity: 1, unit: "Saat", price_snapshot: { unit_price: 1200, amount: 1200 } }));
  d.cari_movements.push(record("MONEY-C", { customer_id: "G", date: "2026-10-22", type: "Tahsilat", amount: -500 }));
  const R = report(d);
  assert.deepEqual([R.totals.workTotal, R.totals.collected, R.balanceNow], [1200, 500, 700]);
  assert.deepEqual(R.months.at(-1), { key: "2026-10", work: 1200, collected: 500 });
  assert.deepEqual(R.fuelMonths.at(-1), { key: "2026-10", work: 150, collected: 100 });
  assert.ok(hasMoneyChart(R));
  const markup = customerChartsHtml(R);
  assert.match(markup, /data-customer-chart="fuel"/); assert.match(markup, /data-customer-chart="money"/);
  assert.match(markup, /Hak edilen mazot \(L\)/); assert.match(markup, /Tahsilat \(₺\)/);
});

test("Grafik erişilebilir seri adı, gerçek ay/yıl, L birimi ve kesin aylık döküm sunar", () => {
  const R = report(fixture()), svg = monthsSvg(R.fuelMonths, FUEL_CHART), markup = customerChartsHtml(R);
  assert.match(svg, /role="img" aria-label="Son 12 ay: Hak edilen mazot ve Alınan mazot \(L\)"/);
  assert.match(svg, /2026-10 Alınan mazot 100 L/);
  assert.doesNotMatch(svg, /₺/);
  assert.match(markup, /Alınan mazot: <b>300 L<\/b>/);
  assert.match(markup, /10\.2026<\/td><td>150<\/td><td>100/);
  assert.doesNotMatch(markup, /data-customer-chart="money"/, "Yalnız mazot müşterisine boş TL grafiği sunulmaz");
  const d = fixture(); d.fuel_records = []; d.fuel_tank_movements = [];
  assert.match(customerChartsHtml(report(d)), /mazot alımı kaydedilmemiş/);
});

test("PDF aynı mazot grafiğini, dönem teslimlerini ve litreli dağılımı içerir; TL ayrı kalır", () => {
  const R = report(fixture());
  const fuelChart = new Blob(["fuel"], { type: "image/png" }), chart = new Blob(["money"], { type: "image/png" });
  const S = customerReportSpec(R, { fuelChart, chart }).sections;
  assert.equal(S.find((s) => s.title === "Son 12 ay: hak edilen ve alınan mazot (L)").image, fuelChart);
  assert.equal(S.find((s) => s.title === "Son 12 ay: iş tutarı ve tahsilat (TL)").image, chart);
  assert.deepEqual(S.find((s) => s.title === "Özet").pairs.find(([k]) => k === "Mazot tahsilatı (dönem)"), ["Mazot tahsilatı (dönem)", "100 L"]);
  assert.deepEqual(S.find((s) => s.title === "Mazot tahsilatları (dönem, L)").rows, [["20.10.2026", "TEST Güneş", "Depo", "100 L"]]);
  assert.equal(S.find((s) => s.title === "Araca göre").rows[0].at(-1), "150 L mazot");
});

test("Mazotsuz müşteride mevcut TL grafiği ve raporu korunur", () => {
  const d = fixture(); d.customers[0].fuel_rules = []; d.work_records = []; d.fuel_records = []; d.fuel_tank_movements = [];
  const R = report(d), markup = customerChartsHtml(R);
  assert.equal(R.fuel, null); assert.ok(hasMoneyChart(R));
  assert.doesNotMatch(markup, /data-customer-chart="fuel"/);
  assert.match(markup, /data-customer-chart="money"/);
  assert.ok(!customerReportSpec(R).sections.some((s) => s.title?.startsWith("Mazot")));
});
console.log(`customer-fuel-chart: ${count} senaryo geçti`);

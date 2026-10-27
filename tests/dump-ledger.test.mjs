import { freezeDumpEstimate } from "../js/dump-estimate.js";
import assert from "node:assert/strict";
import {
  dumpEntryFields,
  sharedDumpBalance,
  validateDumpData,
  receiptKey,
  freezeDumpTariff,
} from "../js/dump-ledger-core.js";
import { dumpFee, calculatedDumpFee } from "../js/dump-fees.js";
import { dumpAccounts, depositSiteOf } from "../js/dump-account.js";
import { costRows, costTotals } from "../js/costs-core.js";
import { costLedger, operatingResult } from "../js/enterprise-core.js";
import { resultReport } from "../js/solo-core.js";
const date = "2026-10-20",
  d = {
    dump_sites: [{ id: "D", name: "TEST Saha", fee: 200, fee_unit: "Ton" }],
    vehicles: [
      { id: "A", name: "TEST A", type: "Kamyon" },
      { id: "B", name: "TEST B", type: "Kamyon" },
    ],
    customers: [{ id: "C", name: "TEST Müşteri" }],
    work_records: [
      {
        id: "W1",
        date,
        vehicle_id: "A",
        customer_id: "C",
        dump_site_id: "D",
        quantity: 1,
        unit: "Sefer",
        tonnage: 15,
        price_snapshot: { amount: 10000 },
      },
      {
        id: "W2",
        date,
        vehicle_id: "B",
        customer_id: "C",
        dump_site_id: "D",
        quantity: 1,
        unit: "Sefer",
        tonnage: 20,
        price_snapshot: { amount: 10000 },
      },
    ],
    expense_records: [
      { id: "T", date, amount: 20000, dump_site_id: "D", dump_deposit: true },
    ],
    dump_entries: [],
    documents: [],
    cari_movements: [],
  };
// Preserve explicit legacy tonnage + recorded tariff basis; no inferred vehicle loads.
for (const w of d.work_records) w.dump_tariff_snapshot = freezeDumpTariff(w,d.dump_sites[0]);
const receipt = (work, amount, no) =>
  dumpEntryFields(d, {
    kind: "RECEIPT",
    date,
    dump_site_id: "D",
    vehicle_id: work.vehicle_id,
    work_record_id: work.id,
    amount,
    receipt_no: no,
    trips: 1,
    payer: "company_account",
  });
d.dump_entries = [
  { id: "R1", ...receipt(d.work_records[0], 3000, "F-1") },
  { id: "R2", ...receipt(d.work_records[1], 4000, "F-2") },
];
assert.equal(sharedDumpBalance(d, "D", { today: date }).balance, 13000);
assert.equal(costTotals(costRows(d)).total, 7000);
assert.equal(
  costLedger(d).reduce((n, r) => n + r.gross, 0),
  7000,
);
assert.equal(operatingResult(d).unknown_cost, resultReport(d).unknown_cost);
assert.equal(
  d.cari_movements.length,
  0,
  "döküm dahil iş müşteriye ek borç çıkarmaz",
);
validateDumpData(d);
for (const invalid of [
  { amount: -1 },
  { amount: true },
  { date: "2026-02-30" },
  { vehicle_id: "none" },
  { vehicle_id: "B", work_record_id: "W1" },
  { trips: 0 },
  { trips: 2 },
  { tonnage: -1 },
  { payer: "x" },
])
  assert.throws(() =>
    dumpEntryFields(
      { ...d, dump_entries: [] },
      { ...d.dump_entries[0], ...invalid },
    ),
  );
assert.equal(
  receiptKey({ ...d.dump_entries[0], receipt_no: " F-1 " }),
  receiptKey(d.dump_entries[0]),
);
assert.throws(
  () => dumpEntryFields(d, { ...d.dump_entries[0] }),
  /aşıyor|zaten/,
);
const noPayment = {
  ...d,
  documents: [
    {
      id: "INV",
      category: "Döküm Faturası",
      owner_id: "D",
      date,
      amount: 7000,
      ton: 35,
    },
  ],
};
assert.equal(
  dumpAccounts(noPayment, { today: date, siteId: "D" })[0].balance,
  13000,
  "fatura kesinti veya yükleme yaratmaz",
);
assert.equal(
  dumpAccounts(noPayment, { today: date, siteId: "D" })[0].invoices[0]
    .ourAmount,
  null,
  "belirsiz dönem eşleştirilmez",
);
noPayment.documents[0].period_from = date;
noPayment.documents[0].period_to = date;
assert.equal(
  dumpAccounts(noPayment, { today: date, siteId: "D" })[0].invoices[0]
    .ourAmount,
  7000,
);
const customer = {
  ...d,
  dump_entries: [
    { ...d.dump_entries[0], payer: "customer" },
    d.dump_entries[1],
  ],
};
assert.equal(sharedDumpBalance(customer, "D", { today: date }).balance, 16000);
assert.equal(costTotals(costRows(customer)).total, 4000);
assert.equal(
  dumpFee(customer, d.work_records[0]),
  null,
  "müşteri öderse şirket maliyeti olmaz",
);
const direct = {
  ...d,
  dump_entries: [
    { ...d.dump_entries[0], payer: "company_direct" },
    d.dump_entries[1],
  ],
};
assert.equal(sharedDumpBalance(direct, "D", { today: date }).balance, 16000);
assert.equal(costTotals(costRows(direct)).total, 7000);
const pending = { ...d, dump_entries: [] };
assert.equal(sharedDumpBalance(pending, "D", { today: date }).balance, 20000);
const a = dumpAccounts(pending, { today: date, siteId: "D" })[0];
assert.equal(a.used, 0);
assert.equal(a.pending_count, 2);
assert.equal(a.projected_balance, 13000);
assert.equal(a.usedEst, 7000);
const grouped = {
  ...d,
  work_records: [{ ...d.work_records[0], quantity: 2, tonnage_scope: "per_trip" }],
  dump_entries: [d.dump_entries[0]],
};
const groupedAccount = dumpAccounts(grouped, { today: date, siteId: "D" })[0];
assert.equal(groupedAccount.pending_count, 1);
assert.equal(groupedAccount.pending[0].remaining_trips, 1);
assert.equal(
  dumpFee(grouped, grouped.work_records[0]).amount,
  6000,
  "3000 fişli kısım + 3000 kalan sefer tahmini; fiş yalnız kapsadığı tahmini değiştirir",
);
const unassigned = {
  ...d,
  work_records: [],
  dump_entries: d.dump_entries.map((e) => ({
    ...e,
    work_record_id: null,
    customer_id: null,
  })),
};
assert.equal(costTotals(costRows(unassigned)).total, 7000);
assert.equal(
  costLedger(unassigned).reduce((n, r) => n + r.gross, 0),
  7000,
  "işsiz gerçek kesinti genel maliyette kaybolmaz",
);
const tied = {
  ...d,
  expense_records: [
    ...d.expense_records,
    { id: "EXP", date, amount: 3000, category: "Döküm", vehicle_id: "A" },
  ],
  dump_entries: [
    { ...d.dump_entries[0], expense_id: "EXP" },
    d.dump_entries[1],
  ],
};
assert.equal(costTotals(costRows(tied)).total, 7000);
assert.equal(
  costLedger(tied).reduce((n, r) => n + r.gross, 0),
  7000,
  "bağlı normal gider ikinci kez sayılmaz",
);
const synthetic = {
  ...d,
  expense_records: [
    ...d.expense_records,
    {
      id: "FAKE",
      date,
      amount: 5000,
      dump_site_id: "D",
      dump_deposit: true,
      invoice_paid: true,
    },
  ],
};
assert.equal(sharedDumpBalance(synthetic, "D", { today: date }).balance, 13000);
assert.equal(
  sharedDumpBalance(synthetic, "D", { today: date }).assumed_credit,
  5000,
);
const future = {
  ...d,
  dump_entries: [
    ...d.dump_entries,
    {
      id: "FUTURE",
      kind: "RECEIPT",
      date: "2026-12-01",
      dump_site_id: "D",
      amount: 10000,
      payer: "company_account",
      vehicle_id: "A",
      trips: 1,
    },
  ],
};
assert.equal(sharedDumpBalance(future, "D", { today: date }).balance, 13000);
const opening = {
  ...d,
  dump_entries: [
    ...d.dump_entries,
    {
      id: "OPEN",
      kind: "OPENING",
      date: "2026-10-21",
      dump_site_id: "D",
      amount: 9000,
      note: "TEST ekstre",
    },
  ],
};
assert.equal(
  sharedDumpBalance(opening, "D", { today: "2026-10-21" }).balance,
  9000,
  "açılış öncesi hareketler tekrar sayılmaz",
);
assert.equal(
  sharedDumpBalance(opening, "D", { today: date }).balance,
  13000,
  "gelecekteki açılış geçmiş bakiyeyi değiştirmez",
);
const frozen = structuredClone(d);
frozen.dump_entries = [];
frozen.work_records[0].dump_tariff_snapshot = freezeDumpTariff(
  frozen.work_records[0],
  frozen.dump_sites[0],
);
frozen.dump_sites[0].fee = 999;
assert.equal(calculatedDumpFee(frozen, frozen.work_records[0]).amount, 3000);
assert.equal(
  calculatedDumpFee(d, {
    ...d.work_records[0],
    quantity: 2,
    tonnage: 24,
    tonnage_scope: "total",
  }).amount,
  4800,
);
assert.equal(
  calculatedDumpFee(d, {
    ...d.work_records[0],
    quantity: 2,
    tonnage: 24,
    tonnage_scope: "per_trip",
  }).amount,
  9600,
);
assert.equal(
  depositSiteOf(d, {
    category: "Döküm",
    company: "TEST Saha",
    description: "Döküm ücreti 3000",
  }),
  null,
);
assert.equal(
  depositSiteOf(d, {
    category: "Döküm",
    company: "TEST Saha",
    description: "Ortak hesaba para yatırdım",
  }).id,
  "D",
);
assert.throws(() => validateDumpData({ ...d, vehicles: [] }), /Bağlı kayıt/);
assert.throws(
  () =>
    validateDumpData({
      ...d,
      dump_entries: [d.dump_entries[0], { ...d.dump_entries[0], id: "COPY" }],
    }),
  /mükerrer|zaten kayıtlı/,
);
console.log(
  "dump-ledger OK: shared vehicles, no double costs, no customer debt, actual vs pending, invoices, opening, future dates, payer distinction, unassigned costs, snapshots, exact ton scope, backup integrity",
);

for (const trips of [0, -1, true, "x", 1.5])
  assert.throws(() =>
    dumpEntryFields(
      { ...d, dump_entries: [] },
      { ...d.dump_entries[0], trips },
    ),
  );
for (const amount of [true, 0.001, -1, NaN, Infinity])
  assert.throws(() =>
    dumpEntryFields(
      { ...d, dump_entries: [] },
      { ...d.dump_entries[0], amount },
    ),
  );
for (const patch of [
  { trips: 0 },
  { trips: "1" },
  { tonnage: true },
  { payer: "customer", expense_id: "T" },
]) {
  assert.throws(() =>
    validateDumpData({
      ...d,
      dump_entries: [{ ...d.dump_entries[0], ...patch }],
    }),
  );
}
const dupeOperation = structuredClone(d);
dupeOperation.dump_entries.forEach((e) => (e.request_id = "SAME"));
assert.throws(() => validateDumpData(dupeOperation), /anahtarı/);
const staleSource = structuredClone(d);
staleSource.expense_records[0].dump_entry_id = "missing";
assert.throws(() => validateDumpData(staleSource), /sahipsiz/);
const duplicateTopup = {
  kind: "TOPUP",
  date,
  dump_site_id: "D",
  amount: 20000,
  reference: "TEST-DEKONT",
  note: "TEST",
};
assert.throws(
  () =>
    dumpEntryFields({ ...d, dump_entries: [duplicateTopup] }, duplicateTopup),
  /dekont/,
);
assert.throws(
  () =>
    dumpEntryFields(d, { ...duplicateTopup, payment_method: "Personel Ödedi" }),
  /personnel/,
);
assert.equal(
  dumpEntryFields(
    { ...d, personnel: [{ id: "P" }] },
    { ...duplicateTopup, payment_method: "Personel Ödedi", personnel_id: "P" },
  ).personnel_id,
  "P",
);

const ambiguousSites = {
  dump_sites: [
    { id: "DA", name: "TEST Saha A" },
    { id: "DB", name: "TEST Saha B" },
  ],
};
assert.equal(
  depositSiteOf(ambiguousSites, {
    category: "Döküm",
    company: "TEST",
    description: "Para yatırdım",
  }),
  null,
);
assert.equal(
  depositSiteOf(ambiguousSites, {
    category: "Döküm",
    company: "TEST Saha B",
    description: "Para yatırdım",
  }).id,
  "DB",
);

// Operasyon Masası: mevcut saha/öncelik/kapanış modellerinin ortak, salt-okunur kapsamı.
import { isActive, todayStr } from "./core.js";
import { fieldStream } from "./field-stream.js";
import { businessPriorities } from "./business-priorities.js";
import { dayCloseChecks } from "./day-close-core.js";
import { closingSummary } from "./enterprise-core.js";
import { shiftWindow } from "./solo-core.js";

const live = (d, s) => (d?.[s] || []).filter(isActive);

export function plannedWorkDraft(plan) {
  if (!plan) return null;
  return {
    _plan_id: plan.id,
    date: plan.date,
    customer_id: plan.customer_id || "",
    site_id: plan.site_id || "",
    vehicle_id: plan.vehicle_id || "",
    personnel_id: plan.personnel_id || "",
    work_type: plan.work_type || "Makine Çalışması",
    quantity: Number(plan.quantity ?? plan.hours) || "",
    unit: plan.unit || "Saat",
    time_start: plan.start || "",
    time_end: plan.end || "",
    break_minutes: Number(plan.break_minutes || 0),
    description: plan.task ? "Planlı görev: " + plan.task : "",
  };
}

export function planConflict(plans, candidate) {
  if (!candidate?.start || !candidate?.end) return null;
  let window;
  try { window = shiftWindow(candidate); } catch { return null; }
  const [start, end] = window;
  return (plans || []).filter(r => r && r.id !== candidate.id && r.status !== "İptal" && r.start && r.end &&
    ((candidate.personnel_id && r.personnel_id === candidate.personnel_id) || (candidate.vehicle_id && r.vehicle_id === candidate.vehicle_id)))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .find(r => {
      try { const [a, b] = shiftWindow(r); return a < end && start < b; } catch { return false; }
    }) || null;
}

const DIFF_FIELDS = [
  ["work_count", "İş kaydı"], ["fuel_liters", "Yakıt litresi"],
  ["supplier_payments", "Tedarikçi ödemesi"], ["customer_receipts", "Müşteri tahsilatı"],
  ["missing_price", "Fiyatı eksik iş"], ["missing_slip", "Fişi eksik iş"],
  ["units", "Birim toplamları"], ["source_signature", "Kaynak kayıt imzası"],
];
export function closingDifference(saved, current) {
  if (!saved?.summary || !current) return [];
  return DIFF_FIELDS.filter(([key]) => JSON.stringify(saved.summary[key]) !== JSON.stringify(current[key]))
    .map(([key, label]) => ({ key, label, before: saved.summary[key], after: current[key] }));
}

function recordScope(d, href) {
  const match = String(href || "").match(/^#\/(isler|yakit|gider|bakim|kasa)\/([^?/]+)/);
  if (!match) return null;
  const store = { isler: "work_records", yakit: "fuel_records", gider: "expense_records", bakim: "maintenance_records", kasa: "cash_records" }[match[1]];
  const id = decodeURIComponent(match[2]);
  return live(d, store).find(r => r.id === id) || null;
}

export function operationModel(d, { date = todayStr(), vehicle_id = "", personnel_id = "", meta = null } = {}) {
  const stream = fieldStream(d, { date, vehicle_id, personnel_id }, date);
  const plans = live(d, "shift_assignments").filter(r => r.date === date && (!vehicle_id || r.vehicle_id === vehicle_id) && (!personnel_id || r.personnel_id === personnel_id))
    .sort((a, b) => String(a.start || "99:99").localeCompare(String(b.start || "99:99")) || String(a.id).localeCompare(String(b.id)))
    .map(r => ({ ...r, conflict: planConflict(live(d, "shift_assignments"), r) }));
  const attCount = {};
  for (const a of live(d, "attachments")) attCount[a.record_type + ":" + a.record_id] = (attCount[a.record_type + ":" + a.record_id] || 0) + 1;
  const checks = dayCloseChecks(d, { date, attCount }).items;
  const priorities = businessPriorities(d, { today: date, meta: meta || live(d, "meta") }).items;
  const inScope = href => {
    if (!vehicle_id && !personnel_id) return true;
    const r = recordScope(d, href);
    return !!r && (!vehicle_id || r.vehicle_id === vehicle_id) && (!personnel_id || r.personnel_id === personnel_id);
  };
  const pending = [
    ...checks.map(x => ({ key: "check:" + x.text + ":" + x.sub, title: x.text, why: x.sub, action: "Kaynağı aç", href: x.href, kind: x.kind })),
    ...priorities.map(x => ({ key: "priority:" + x.key, title: x.title, why: x.why, action: x.action, href: x.hash, kind: x.urgency === 0 ? "alert" : "warn" })),
  ].filter(x => x.href && inScope(x.href));
  const seen = new Set();
  const uniquePending = pending.filter(x => !seen.has(x.href + "|" + x.title) && seen.add(x.href + "|" + x.title));
  const current = closingSummary(d, date);
  const filtered = !!(vehicle_id || personnel_id);
  const scopedData = {...d};
  if (filtered) for (const store of ['work_records','fuel_records','pending_fuel_records','cash_records','supplier_payments'])
    scopedData[store] = (d[store] || []).filter(r => (!vehicle_id || r.vehicle_id === vehicle_id) && (!personnel_id || r.personnel_id === personnel_id));
  const scoped = filtered ? closingSummary(scopedData,date) : current;
  const saved = live(d, "daily_closings").find(r => r.date === date) || null;
  const vehicleStops = live(d, "downtime_records").filter(r => !r.ended_at && (!vehicle_id || r.vehicle_id === vehicle_id) && String(r.started_at || "").slice(0, 10) <= date);
  return { date, vehicle_id, personnel_id, stream, plans, pending: uniquePending, vehicleStops,
    close: { current, scoped, filtered, saved, difference: closingDifference(saved, current), checks } };
}

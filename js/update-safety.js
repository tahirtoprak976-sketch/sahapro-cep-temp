// Deliberate updates only. A worker activation is not a user's reload request.
const edited = new WeakSet(), activities = new Set();
export function startActivity(label) { const token = { label }; activities.add(token); return () => activities.delete(token); }
export function updateRisk(root) {
  if (activities.size || root?.querySelector('[data-ask]:disabled, [data-out] [data-save]:disabled, [data-pdf-read]:disabled, [data-pdf-save]:disabled') || (root?.querySelector('form[data-form]') && root?.querySelector('[data-save]:disabled'))) return { busy: true, unsaved: false };
  const fields = [...(root?.querySelectorAll('input,textarea,select') || [])];
  const openForm = !!root?.querySelector('form') && /\/(new|edit)(?:$|[?/#])/.test(globalThis.location?.hash || '');
  const unsaved = openForm || fields.some(el => edited.has(el) || (el.type === 'file' && el.files?.length) || (el.matches('[data-msg]') && el.value.trim())) || !!root?.querySelector('[data-out] .card[data-kind]:not([data-saved="1"]), [data-history-preview]:not([hidden])[data-history-pending="1"]');
  return { busy: false, unsaved };
}
export function trackUpdateEdits(root) {
  const mark = e => { const el = e.target; if (!el.matches?.('input,textarea,select') || el.matches('[data-search],[data-wfilter],[data-customer-sort],input[type=search]')) return; edited.add(el); };
  root.addEventListener('input', mark, true); root.addEventListener('change', mark, true);
  return () => { root.removeEventListener('input', mark, true); root.removeEventListener('change', mark, true); };
}
export async function allowUpdate(root, confirm) {
  const risk = updateRisk(root);
  if (risk.busy) return { allowed: false, reason: 'İşlem sürüyor; tamamlandıktan sonra güncelleyin.' };
  if (risk.unsaved && !await confirm()) return { allowed: false, reason: '' };
  return { allowed: true, reason: '' };
}

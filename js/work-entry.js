// New-entry context never silently merges into an unfinished job.
import { isActive } from './core.js';

export const hasWorkDraft = draft => !!draft && Object.values(draft).some(Boolean);

export function workEntryPlan({ draft = null, incoming = null, customerId = '', entry = null } = {}) {
  const saved = hasWorkDraft(draft);
  const candidate = incoming || (customerId ? { customer_id: customerId } : null);
  const kind = incoming ? 'message' : customerId ? 'customer' : entry ? 'field' : 'empty';
  if (saved && (!candidate || (!incoming && draft.customer_id === customerId)))
    return { kind: 'draft', values: draft, collision: false };
  return { kind, values: candidate || entry?.values || {}, collision: saved && !!candidate };
}

// Match the existing database guard: a site always needs its exact customer.
// An old selection can stay visible for review, but is not offered as a new choice.
export function workSiteChoices(sites, customerId, selected = '', preserve = false, names = {}) {
  const rows = sites.filter(s => isActive(s) && customerId && s.customer_id === customerId);
  const legacy = preserve && selected && !rows.some(s => s.id === selected) ? selected : '';
  const options = rows.map(s => ({ v: s.id, t: s.name }));
  if (legacy) options.unshift({ v: legacy, t: `${names[legacy] || sites.find(s => s.id === legacy)?.name || legacy} (eski seçim — kontrol edin)` });
  return { options, selected: rows.some(s => s.id === selected) || legacy ? selected : '', legacy };
}

// Descriptive device information; no estimate is a guarantee of retention or external delivery.
export async function deviceStorageStatus(db, storage = globalThis.navigator?.storage) {
  const [drafts, last, handoff] = await Promise.all([db.getAll('drafts'), db.metaGet('last_backup_at'), db.metaGet('last_backup_result')]);
  let estimate=null,persisted=null;
  try { if(storage?.estimate) estimate=await storage.estimate(); } catch {}
  try { if(storage?.persisted) persisted=await storage.persisted(); } catch {}
  return { pdfDraftFiles:drafts.filter(d=>String(d.form).startsWith('pdf_history_file:')&&d.blob).length,last: last || null,handoff: handoff || null,
    usage:Number.isFinite(estimate?.usage)?estimate.usage:null,quota:Number.isFinite(estimate?.quota)?estimate.quota:null,persisted };
}

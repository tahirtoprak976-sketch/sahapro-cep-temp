// Assistant-selected files live in IndexedDB drafts, never localStorage/model context.
const PENDING = "assistant-pending-files";
const prefix = "assistant-task-files:";
export async function savePendingFiles(db, files = []) {
  if (!Array.isArray(files) || files.length > 20) throw Error("En fazla 20 dosya saklanabilir.");
  await db.draftSave(PENDING, { files, updated_at: new Date().toISOString() });
}
export async function loadPendingFiles(db) {
  return (await db.draftGet(PENDING))?.files || [];
}
export async function attachFilesToTask(db, taskId) {
  if (!taskId) throw Error("Görev kimliği yok.");
  const pending = await loadPendingFiles(db);
  if (!pending.length) return [];
  await db.draftSave(prefix + taskId, { files: pending, updated_at: new Date().toISOString() });
  await db.draftClear(PENDING);
  return pending;
}
export async function loadTaskFiles(db, taskId) {
  if (!taskId) return [];
  return (await db.draftGet(prefix + taskId))?.files || [];
}
export async function saveTaskFiles(db, taskId, files = []) {
  if (!taskId || !Array.isArray(files) || files.length > 20) throw Error('Görev dosyaları geçersiz.');
  await db.draftSave(prefix + taskId, {files,updated_at:new Date().toISOString()});
}
export async function clearPendingFiles(db) { await db.draftClear(PENDING); }
export async function clearTaskFiles(db, taskId) { if (taskId) await db.draftClear(prefix + taskId); }

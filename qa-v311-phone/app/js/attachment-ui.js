import { attachmentView } from './attachment-safety.js';
import { esc, downloadBlob } from './ui.js';

export async function attachmentHTML(attachment, { imageStyle = 'width:100%;max-height:360px;object-fit:contain', label = '' } = {}) {
  const view = await attachmentView(attachment);
  const url = URL.createObjectURL(view.blob);
  const state = `data-attachment-id="${esc(attachment.id || '')}" data-attachment-safety="${view.safe ? 'safe' : 'quarantined'}"`;
  // URLs expire after a generous viewing interval; they never enter storage.
  setTimeout(() => URL.revokeObjectURL(url), 30 * 60 * 1000);
  if (!view.safe) return `<span class="attachment-quarantine"><a class="btn sm" ${state} data-quarantined-attachment href="${url}" download="${esc(view.downloadName)}">⚠ ${esc(view.name)} — güvenli indirme</a><span class="tiny muted"> Desteklenmeyen/bozuk özgün dosya korunuyor; uygulamada açılmaz.</span></span>`;
  return `<a class="${view.image ? '' : 'btn sm'}" ${state} data-safe-attachment href="${url}" target="_blank" rel="noopener noreferrer">${view.image ? `<img src="${url}" alt="${esc(view.name)}" style="${imageStyle}">` : esc(label || ('📄 ' + view.name + ' — aç'))}</a>`;
}
export async function downloadAttachment(attachment) {
  const view = await attachmentView(attachment);
  downloadBlob(view.blob, view.downloadName);
}

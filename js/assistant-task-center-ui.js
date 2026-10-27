// Independent task list: resume without replaying a closed proposal.
import { esc, toast } from "./ui.js";
import { CENTER_KEY, listTaskCenter, activateTaskCenter } from "./assistant-task-center.js";
import { loadTaskFiles, savePendingFiles } from "./assistant-task-files.js";

const statusText = { draft: "Onay bekliyor", clarify: "Bilgi eksik", applying: "Sonuç incelenmeli", complete: "Tamamlandı", review: "Kısmi / inceleme", cancelled: "İptal" };
export async function mountTaskCenter(ctx, holder) {
  const { db } = ctx;
  const draw = async () => {
    if (!holder.isConnected) return;
    const center = listTaskCenter(await db.metaGet(CENTER_KEY));
    const rows = [...center.open, ...center.recovery, ...center.closed.slice(-3)];
    holder.innerHTML = `<details class="card" data-task-center ${center.open.length ? "open" : ""}><summary>Açık görevler (${center.open.length}/5) · görev ve dosyalarla devam et</summary>
      ${center.open.length >= 5 ? '<p class="notice warn small">Açık görev sınırı dolu. Yeni görev için önce birini tamamlayın veya kapatın; mevcutlar silinmez.</p>' : ""}
      ${rows.map(t => `<article class="card small" data-task-id="${esc(t.id)}"><div class="row between"><b>${esc(t.goal || "İşlem isteği")}</b><span class="badge ${t.status === "complete" ? "ok" : t.status === "review" || t.status === "applying" ? "warn" : ""}">${esc(statusText[t.status])}</span></div>
        <p class="tiny muted">${esc(String(t.updated_at || "").replace("T", " ").slice(0, 19))}${(t.plan.questions || []).length ? " · Eksik: " + esc(t.plan.questions.slice(0, 3).join(" · ")) : ""}</p>
        ${t.receipt ? `<p class="small">${esc(t.receipt)}</p>` : ""}
        ${["draft", "clarify"].includes(t.status) ? `<button class="btn sm" data-task-activate="${esc(t.id)}">Göreve ve dosyalarına dön</button>` : t.status === "applying" || t.status === "review" ? '<p class="tiny muted">Eski plan otomatik tekrar uygulanmaz; gerçek kayıtlarla sonucu inceleyin.</p>' : ""}</article>`).join("") || '<p class="small muted">Bağımsız görev yok. Yeni bir istek hazırlayın.</p>'}
      <p class="tiny muted">Her görev kendi sohbet/revizyon ve seçili dosya taslağıyla açılır. Tamamlanan plan yeniden uygulanmaz.</p></details>`;
    for (const b of holder.querySelectorAll("[data-task-activate]")) b.onclick = async () => {
      b.disabled = true;
      let release;
      try {
        release = await ctx.prepareTaskSwitch?.();
        await activateTaskCenter(db, b.dataset.taskActivate);
        const files = await loadTaskFiles(db, b.dataset.taskActivate);
        await savePendingFiles(db, files);
        ctx.reload();
      } catch (e) { toast(e.message || String(e), "err"); b.disabled = false; }
      finally { release?.(); }
    };
  };
  await draw();
  return draw;
}

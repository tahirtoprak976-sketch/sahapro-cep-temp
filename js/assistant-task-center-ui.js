// Independent task list: resume without replaying a closed proposal.
import { esc, toast, confirmDialog } from "./ui.js";
import { CENTER_KEY, listTaskCenter, activateTaskCenter, closeTaskCenter, MAX_OPEN_TASKS } from "./assistant-task-center.js";
import { loadTaskFiles, savePendingFiles } from "./assistant-task-files.js";

const statusText = { paused:"Beklemeye alındı", draft: "Onay bekliyor", clarify: "Bilgi eksik", applying: "Sonuç incelenmeli", complete: "Tamamlandı", review: "Kısmi / inceleme", cancelled: "İptal" };
export async function mountTaskCenter(ctx, holder) {
  const { db } = ctx;
  const draw = async () => {
    if (!holder.isConnected) return;
    const center = listTaskCenter(await db.metaGet(CENTER_KEY));
    const rows = [...center.open, ...center.paused, ...center.recovery, ...center.closed.slice(-3)];
    holder.innerHTML = `<details class="card" data-task-center ${(center.open.length || center.paused.length) ? "open" : ""}><summary>Açık görevler (${center.open.length}/${MAX_OPEN_TASKS})${center.paused.length ? ` · ${center.paused.length} bekleyen` : ""} · görev ve dosyalarla devam et</summary>
      ${(center.open.length>=MAX_OPEN_TASKS || center.paused.length) ? '<p class="small muted" data-task-capacity>Yeni isteğiniz engellenmez. En eski yarım istek beklemeye alınır; bilgileri ve dosyaları korunur. Devam et ile geri açabilir veya Kapat ile kaldırabilirsiniz.</p>' : ""}
      ${rows.map(t => `<article class="card small" data-task-id="${esc(t.id)}"><div class="row between"><b>${esc(t.goal || "İşlem isteği")}</b><span class="badge ${t.status === "complete" ? "ok" : t.status === "review" || t.status === "applying" ? "warn" : ""}">${esc(statusText[t.status])}</span></div>
        <p class="tiny muted">${esc(String(t.updated_at || "").replace("T", " ").slice(0, 19))}${(t.plan.questions || []).length ? " · Eksik: " + esc(t.plan.questions.slice(0, 3).join(" · ")) : ""}</p>
        ${t.receipt ? `<p class="small">${esc(t.receipt)}</p>` : ""}
        ${["draft", "clarify", "paused"].includes(t.status) ? `<button class="btn sm" data-task-activate="${esc(t.id)}">Göreve ve dosyalarına dön</button><button class="btn sm" data-task-close="${esc(t.id)}" data-task-rev="${t.rev}">Kapat</button>` : t.status === "applying" || t.status === "review" ? '<p class="tiny muted">Eski plan otomatik tekrar uygulanmaz; gerçek kayıtlarla sonucu inceleyin.</p>' : ""}</article>`).join("") || '<p class="small muted">Bağımsız görev yok. Yeni bir istek hazırlayın.</p>'}
      <p class="tiny muted">Her görev kendi sohbet/revizyon ve seçili dosya taslağıyla açılır. Tamamlanan plan yeniden uygulanmaz.</p></details>`;
    for(const b of holder.querySelectorAll('[data-task-close]'))b.onclick=async()=>{
      b.disabled=true;let release;
      try{
        if(!await confirmDialog("İstek kapatılsın mı?","Bu taslak iş veya para kaydı oluşturmaz. Diğer görevler korunur; bu isteğin kaynağı ve dosyaları silinmez.","İsteği kapat"))return;
        release=await ctx.prepareTaskSwitch?.();
        await ctx.assistantPrepareNavigation?.();
        const closed=await closeTaskCenter(db,b.dataset.taskClose,Number(b.dataset.taskRev));
        if(closed.wasActive)await savePendingFiles(db,[]);
        ctx.reload();
      }catch(e){toast(e.message||String(e),"err");await draw();}
      finally{release?.();if(b.isConnected)b.disabled=false;}
    };
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

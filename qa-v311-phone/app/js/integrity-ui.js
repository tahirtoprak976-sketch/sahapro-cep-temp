// Veri Sağlığı (#/veri-sagligi): tüm kayıtlar, dosyalar ve bağlantılar denetlenir; çelişkiler listelenir, güvenli olanlar tek tuşla düzeltilir.
import { qs, qsa, esc, appbar, toast, notice, todayStr, confirmDialog } from "./ui.js";
import { integrityCheck } from "./integrity-core.js";

const ICON = { error: "⛔", warn: "⚠", info: "ℹ" };
const COLOR = { error: "#d9534f", warn: "#e0a030", info: "#3b82f6" };

export async function runIntegrity(db) {
  const d = await db.dumpAll();
  const attachments = await db.getAll("attachments");
  const restoreSets = (await db.getAll("meta")).filter((m) => m.key.startsWith("restore_set:")).map((m) => m.value);
  return integrityCheck(d, { today: todayStr(), attachments, restoreSets });
}

export async function screen(ctx) {
  if (ctx.parts[0] !== "veri-sagligi") return false;
  const { root, db } = ctx;
  root.innerHTML = appbar("Veri Sağlığı", "Kayıt · dosya · bağlantı denetimi") + '<div class="muted small" style="padding:14px">Denetleniyor…</div>';
  const t0 = performance.now();
  const r = await runIntegrity(db);
  const ms = Math.round(performance.now() - t0);
  const counts = {}; for (const s of ["work_records", "fuel_records", "expense_records", "documents", "attachments", "personnel_events"]) counts[s] = (await db.getAll(s)).length;
  const fixable = r.issues.filter((x) => x.fix);
  root.innerHTML = appbar("Veri Sağlığı", "Kayıt · dosya · bağlantı denetimi") + `
    <div style="height:10px"></div>
    <div class="card" style="border-left:4px solid ${r.errors ? COLOR.error : r.warns ? COLOR.warn : "#2e9e6b"}">
      <div class="row between"><b style="font-size:18px">${r.errors ? `${r.errors} hata` : r.warns ? "Hata yok" : "✅ Her şey tutarlı"}</b><span class="small">${r.warns ? `${r.warns} uyarı` : ""}</span></div>
      <div class="tiny muted" style="margin-top:4px">${counts.work_records} iş · ${counts.fuel_records} yakıt · ${counts.expense_records} gider · ${counts.documents} belge · ${counts.attachments} dosya/fotoğraf · ${counts.personnel_events} personel hareketi denetlendi (${ms} ms)</div>
      ${fixable.length ? `<button class="btn primary block" data-fixall style="margin-top:8px">🩹 Güvenli düzeltmeleri uygula (${fixable.length})</button>` : ""}
    </div>
    ${r.issues.map((x, i) => `<div class="card" style="padding:10px 12px;border-left:4px solid ${COLOR[x.sev]}">
      <div class="small"><b>${ICON[x.sev]} ${esc(x.text)}</b>${x.sub ? `<br><span class="tiny muted">${esc(x.sub)}</span>` : ""}</div>
      <div class="row" style="gap:6px;margin-top:6px">${x.href ? `<button class="btn sm grow" data-go="${esc(x.href)}">Kayda git</button>` : ""}${x.fix ? `<button class="btn sm grow" data-fix="${i}">🩹 Düzelt</button>` : ""}</div>
    </div>`).join("") || notice("ok", "Kopuk bağlantı, mükerrer kayıt, sahipsiz ya da bozuk dosya, eksi stok, geçersiz sayı veya tarih bulunmadı.")}
    <div class="tiny muted" style="margin:8px 4px 80px">Denetlenenler: iş → müşteri/şantiye/araç/personel/döküm bağları, şantiyenin müşterisi, depodan yakıt ↔ depo çıkışı, esnaf borcu ↔ kaynağı, hakediş ↔ işler, belge sahibi, her dosya/fotoğrafın sahibi ve sağlamlığı, şoför kaydının iki kez işlenmesi, aynı fiş/fatura no, sayı ve tarihler, depo stokunun tarih sırasıyla hiç eksiye düşmemesi, litre fiyatı, izin formu ↔ izin günleri, izinli günde iş. Düzeltmeler yalnız kesin durumlarda yapılır ve denetim kaydına yazılır.</div>`;
  const apply = async (x) => {
    const f = x.fix;
    if (f.kind === "tank-price") await db.repairTankPrices();
    else if (f.kind === "orphan-move") await db.removeOrphanTankOut(f.id);
    else if (f.kind === "orphan-att") await db.removeOrphanAttachment(f.id);
    else if (f.kind === "leave-orphan") for (const id of f.ids) await db.softDelete("personnel_events", id, "Veri sağlığı: onaysız forma bağlı izin günü");
  };
  for (const b of qsa("[data-fix]", root))
    b.addEventListener("click", async () => {
      const x = r.issues[Number(b.dataset.fix)];
      if (!(await confirmDialog("Düzeltilsin mi?", x.text, "Düzelt"))) return;
      try { await apply(x); toast("Düzeltildi", "ok"); ctx.reload(); } catch (e) { toast(e.message || String(e), "err"); }
    });
  qs("[data-fixall]", root)?.addEventListener("click", async () => {
    if (!(await confirmDialog("Güvenli düzeltmeler uygulansın mı?", fixable.map((x) => "• " + x.text).slice(0, 8).join("\n"), "Uygula"))) return;
    let n = 0, done = new Set();
    for (const x of fixable) { const k = x.fix.kind === "tank-price" ? "tp" : JSON.stringify(x.fix); if (done.has(k)) continue; done.add(k); try { await apply(x); n++; } catch (e) { toast(e.message || String(e), "err"); } }
    toast(`${n} düzeltme uygulandı`, "ok"); ctx.reload();
  });
  return true;
}

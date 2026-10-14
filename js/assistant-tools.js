// Akıllı Asistan ek ekranları: Gün Sonu Özeti (#/akilli-asistan/ozet) ve Soru Sor (#/akilli-asistan/soru).
// Rakamlar telefonda hesaplanır; Gemini yalnız cümle kurar / hangi hesabın yapılacağını seçer.
import { qs, esc, appbar, toast, notice, todayStr } from "./ui.js";

export async function screen(ctx) {
  if (ctx.parts[0] !== "akilli-asistan" || !["ozet", "soru"].includes(ctx.parts[1])) return false;
  const { geminiSettings } = await import("./ai-gemini.js");
  const g = await geminiSettings(ctx.db);
  return ctx.parts[1] === "ozet" ? summary(ctx, g) : ask(ctx, g);
}

async function summary(ctx, g) {
  const { root, db } = ctx;
  const { dayFacts, localSummary, keepVerified, SUMMARY_SYSTEM } = await import("./day-summary.js");
  root.innerHTML =
    appbar("Gün Sonu Özeti", "rakamlar telefondan") +
    `<div style="height:10px"></div><div class="card">
      <div class="field"><label>Gün</label><input type="date" data-date value="${todayStr()}"></div>
      <div class="field"><label>Özet (düzenleyebilirsiniz)</label><textarea data-text rows="12"></textarea></div>
      <div data-note></div>
      <div class="row" style="gap:6px;flex-wrap:wrap">
        <button class="btn grow" data-ai ${g.ready ? "" : "disabled"}>🤖 Gemini ile yaz</button>
        <button class="btn primary grow" data-share>📤 WhatsApp'ta paylaş</button>
        <button class="btn grow" data-copy>Kopyala</button>
      </div>
      <div class="muted tiny" style="margin-top:6px">Düz özet internetsiz hazırlanır. Gemini metni güzelleştirir; kayıtlarda olmayan rakam içeren cümleler otomatik atılır.</div>
    </div>`;
  let facts = null;
  const text = qs("[data-text]", root), note = qs("[data-note]", root);
  const load = async () => {
    facts = dayFacts(await db.dumpAll(), qs("[data-date]", root).value || todayStr());
    text.value = localSummary(facts);
    note.innerHTML = "";
  };
  qs("[data-date]", root).addEventListener("change", load);
  await load();
  qs("[data-ai]", root).addEventListener("click", async (ev) => {
    const b = ev.currentTarget;
    if (!navigator.onLine) return toast("İnternet yok; düz özeti paylaşabilirsiniz", "err");
    b.disabled = true;
    note.innerHTML = '<div class="muted small">Gemini yazıyor…</div>';
    try {
      const { withModelFallback, geminiText } = await import("./ai-gemini.js");
      const out = await withModelFallback(db, (o) => geminiText("Günün rakamları (JSON):\n" + JSON.stringify(facts), { ...o, system: SUMMARY_SYSTEM }));
      const k = keepVerified(out, facts);
      if (!k.text) throw new Error("Gemini doğrulanabilir bir özet yazamadı; düz özeti kullanın");
      text.value = k.text + (facts.uyarilar.length ? "\n" + facts.uyarilar.slice(0, 4).map((u) => "⚠ " + u).join("\n") : "");
      note.innerHTML = k.dropped.length ? notice("warn", `${k.dropped.length} cümle kayıtlarda olmayan rakam içerdiği için çıkarıldı.`) : "";
    } catch (e) {
      note.innerHTML = notice("warn", e.message || String(e));
    }
    b.disabled = false;
  });
  qs("[data-copy]", root).addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(text.value); toast("Kopyalandı", "ok"); } catch { toast("Kopyalanamadı", "err"); }
  });
  qs("[data-share]", root).addEventListener("click", async () => {
    const t = text.value.trim();
    if (!t) return;
    if (navigator.share) {
      try { await navigator.share({ text: t }); return; } catch (e) { if (e.name === "AbortError") return; }
    }
    location.href = "https://wa.me/?text=" + encodeURIComponent(t);
  });
  return true;
}

const EXAMPLES = ["Bu ay hangi müşteriye kaç sefer yaptık?", "Depoda ne kadar yakıt kaldı?", "Geçen ay yakıta ne kadar verdik?", "Esnafa toplam borcum ne kadar?", "Bu ay tahsilat ne kadar?"];
async function ask(ctx, g) {
  const { root, db } = ctx;
  root.innerHTML =
    appbar("Soru Sor", "kayıtlarınızdan hesaplanır") +
    `<div style="height:10px"></div>
    ${g.ready ? "" : notice("warn", "Önce Ayarlar → Yapay Zeka'da Gemini anahtarını kaydedin.")}
    <div class="card">
      <div class="field"><label>Sorunuz</label><textarea data-q rows="3" placeholder="Örn: Hisar Polat'a bu ay kaç saat çalıştık?"></textarea></div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${EXAMPLES.map((x) => `<button class="chip" data-ex>${esc(x)}</button>`).join("")}</div>
      <button class="btn primary block" style="margin-top:10px" data-send ${g.ready ? "" : "disabled"}>❓ Sor</button>
    </div><div data-out></div>`;
  for (const c of root.querySelectorAll("[data-ex]")) c.addEventListener("click", () => (qs("[data-q]", root).value = c.textContent));
  qs("[data-send]", root).addEventListener("click", async (ev) => {
    const q = qs("[data-q]", root).value.trim();
    if (!q) return toast("Soru yazın", "err");
    if (!navigator.onLine) return toast("İnternet yok", "err");
    const b = ev.currentTarget, out = qs("[data-out]", root);
    b.disabled = true;
    out.innerHTML = '<div class="muted small" style="padding:10px">Hesaplanıyor…</div>';
    try {
      const { ASK_TOOLS, ASK_SYSTEM, runAskTool } = await import("./day-summary.js");
      const { checkAnswer } = await import("./assistant-core.js");
      const { withModelFallback, geminiAsk } = await import("./ai-gemini.js");
      const d = await db.dumpAll(), today = todayStr();
      const yardSettings = (await db.metaGet("yard_settings")) || {};
      const res = await withModelFallback(db, (o) => geminiAsk(`Bugün: ${today}\n<soru>${q.replace(/<\/?soru>/gi, "")}</soru>`, { ...o, system: ASK_SYSTEM, tools: ASK_TOOLS, runTool: (n, a) => runAskTool(d, n, a, today, yardSettings) }));
      const bad = checkAnswer(res.answer, res.trace.map((t) => t.result));
      const TOOL_TR = { work_totals: "İş toplamı", customer_balance: "Müşteri bakiyesi", fuel_totals: "Yakıt toplamı", expense_totals: "Gider toplamı", collection_totals: "Tahsilat toplamı", esnaf_debt: "Esnaf borcu", tank_status: "Depo durumu", customer_fuel: "Mazot hesabı", yard_stock: "Depo stoku" };
      out.innerHTML = `<div class="card"><div class="strong small">🤖 Cevap</div><div style="white-space:pre-wrap;margin-top:6px">${esc(res.answer || "Cevap alınamadı, soruyu farklı yazın.")}</div>
        ${bad.length ? notice("warn", "Bu sayılar hesaplanan sonuçlarda yok, güvenmeyin: " + bad.join(", ")) : res.trace.length ? '<div class="muted tiny" style="margin-top:6px">Rakamlar telefondaki kayıtlardan hesaplandı.</div>' : notice("warn", "Hiç hesap yapılmadı; cevaptaki rakamlara güvenmeyin.")}
        ${res.trace.length ? `<details style="margin-top:8px"><summary class="small">Yapılan hesaplar (${res.trace.length})</summary>${res.trace.map((t) => `<div class="tiny muted" style="margin-top:4px"><b>${esc(TOOL_TR[t.name] || t.name)}</b> ${esc(JSON.stringify(t.args))}<br>${esc(JSON.stringify(t.result).slice(0, 600))}</div>`).join("")}</details>` : ""}</div>`;
    } catch (e) {
      out.innerHTML = notice("warn", e.message || String(e));
    }
    b.disabled = false;
  });
  return true;
}

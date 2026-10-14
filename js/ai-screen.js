// "Yapay Zeka (deneysel)" ekranı: telefonda çalışan ücretsiz modeli indirme ve örnek mesajlarla deneme.
// Bu ekran hiçbir kayıt oluşturmaz; yalnız önerileri ve doğrulama sonucunu gösterir.
import { qs, esc, appbar, toast, confirmDialog, notice, kv } from "./ui.js";
import { aiSuggest } from "./ai-assist.js";

const SAMPLES = [
  "Ahmet Bey 34 ABC 123 6 gidiş yaptı moloz",
  "kepçe bütün gün Leda Yeşilpınar'da çalıştı",
  "34 ABC 123 Firma F Eyüp altı kere gitti hafriyat",
  "jcb sabahtan akşama kadar Bahçeşehir Ahmet Bey",
  "34EC1353 Gümüş Yapı on iki tur moloz",
  "Öztürk Kağıthane 34 ABC 123 dört tur hafriyat",
  "34 ABC 123 Ahmet beyin işinde 3 kere döktü",
  "Mahir bey 14 tonluk öğlene kadar çalıştı",
];

export async function screen(ctx) {
  if (ctx.parts[0] !== "yapay-zeka") return false;
  const { root, db } = ctx;
  const ai = await import("./ai-local.js");
  const gpu = await ai.gpuStatus();
  const savedId = (await db.metaGet("ai_model_id")) || "";
  root.innerHTML =
    appbar("Yapay Zeka (deneysel)", "Telefonda çalışır · ücretsiz", { back: "#/ayarlar" }) +
    `<div style="height:10px"></div>
    ${notice("info", "Model telefonunuzda çalışır; mesajlar dışarı gönderilmez. İlk indirme yaklaşık 1 GB'tır — Wi-Fi'da yapın. Yapay zeka hiçbir kaydı kendisi oluşturmaz: yalnız kural motorunun anlayamadığı ifadelere miktar/birim/iş türü önerir; mesajda yazmayan sayı veya listede olmayan değer otomatik reddedilir.")}
    <div class="card">
      ${kv("WebGPU", gpu.ok ? "Var ✓" + (gpu.f16 ? " (f16)" : "") : "Yok — " + gpu.reason)}
      <div class="field" style="margin-top:8px"><label>Model</label><select data-model disabled><option>Liste yükleniyor…</option></select></div>
      <div class="muted small" data-cache></div>
      <div class="row" style="gap:8px;margin-top:10px">
        <button class="btn primary grow" data-load ${gpu.ok ? "" : "disabled"}>⬇ İndir ve Başlat</button>
        <button class="btn grow" data-del ${gpu.ok ? "" : "disabled"}>🗑 Modeli Sil</button>
      </div>
      <div data-prog style="margin-top:10px"></div>
    </div>
    <div class="section-title">Deneme</div>
    <div class="card">
      <div class="field"><label>Her satır bir mesaj</label><textarea data-samples rows="8">${esc(SAMPLES.join("\n"))}</textarea></div>
      <button class="btn primary block" data-run disabled>🤖 Örnek Mesajları Dene</button>
      <div class="muted tiny" style="margin-top:6px">Önce kural motoru çalışır. Yapay zeka yalnız motorun miktarı bulamadığı yerlerde sorulur.</div>
    </div>
    <div data-results></div>`;

  const sel = qs("[data-model]", root),
    prog = qs("[data-prog]", root),
    runBtn = qs("[data-run]", root),
    cacheEl = qs("[data-cache]", root);
  const refreshCache = async () => {
    if (!sel.value) return;
    cacheEl.textContent = (await ai.isCached(sel.value))
      ? "Bu model telefonda kayıtlı (internetsiz açılır)."
      : "Bu model henüz indirilmedi.";
  };
  if (gpu.ok)
    ai.availableModels(gpu.f16)
      .then((list) => {
        if (!list.length) {
          sel.innerHTML = "<option value=''>Uygun model bulunamadı</option>";
          return;
        }
        sel.innerHTML = list
          .map(
            (m) =>
              `<option value="${esc(m.id)}" ${m.id === savedId ? "selected" : ""}>${esc(m.id)}${m.vram ? " · ~" + Math.round(m.vram) + " MB bellek" : ""}</option>`,
          )
          .join("");
        sel.disabled = false;
        refreshCache();
      })
      .catch((e) => {
        sel.innerHTML = "<option value=''>Liste alınamadı</option>";
        prog.innerHTML = notice("warn", e.message || String(e));
      });
  sel.addEventListener("change", refreshCache);
  if (ai.loaded()) runBtn.disabled = false;

  qs("[data-load]", root).addEventListener("click", async () => {
    const id = sel.value;
    if (!id) return;
    if (!(await ai.isCached(id))) {
      const ok = await confirmDialog(
        "Model indirilsin mi?",
        "Yaklaşık 1 GB indirilecek. Wi-Fi'da olduğunuzdan emin olun. İndirme sırasında bu ekranı kapatmayın.",
        "İndir",
      );
      if (!ok) return;
    }
    prog.innerHTML = `<div class="muted small" data-ptext>Başlıyor…</div><div style="height:8px;background:var(--border);border-radius:6px;overflow:hidden;margin-top:6px"><div data-pbar style="height:100%;width:0;background:var(--accent,#f5a623)"></div></div>`;
    const started = Date.now();
    try {
      await ai.load(id, (p, text) => {
        const b = qs("[data-pbar]", prog), t = qs("[data-ptext]", prog);
        if (b) b.style.width = Math.round(p * 100) + "%";
        if (t) t.textContent = Math.round(p * 100) + "% · " + text.slice(0, 90);
      });
      await db.metaSet("ai_model_id", id);
      prog.innerHTML = notice("ok", `Model hazır (${Math.round((Date.now() - started) / 1000)} sn).`);
      runBtn.disabled = false;
      refreshCache();
    } catch (e) {
      prog.innerHTML = notice(
        "warn",
        "Model başlatılamadı: " + (e.message || e) + " — Daha küçük bir model seçip tekrar deneyin.",
      );
    }
  });

  qs("[data-del]", root).addEventListener("click", async () => {
    const id = sel.value;
    if (!id || !(await confirmDialog("Model silinsin mi?", "Telefondaki model dosyaları silinir; kayıtlarınız etkilenmez.", "Sil", true))) return;
    try {
      await ai.remove(id);
      runBtn.disabled = true;
      toast("Model silindi", "ok");
      refreshCache();
    } catch (e) {
      toast(e.message || String(e), "err");
    }
  });

  runBtn.addEventListener("click", async () => {
    const lines = qs("[data-samples]", root).value.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 15);
    const box = qs("[data-results]", root);
    runBtn.disabled = true;
    box.innerHTML = `<div class="muted small" style="padding:8px">Çalışıyor… (0/${lines.length})</div>`;
    const d = await db.dumpAll();
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const t0 = Date.now();
      const r = await aiSuggest({ id: "ai-test-" + i, text: lines[i] }, d, ai.generate);
      out.push({ text: lines[i], r, ms: Date.now() - t0 });
      box.innerHTML = `<div class="muted small" style="padding:8px">Çalışıyor… (${i + 1}/${lines.length})</div>`;
    }
    runBtn.disabled = false;
    const engineLine = (a) =>
      a.rows.length
        ? a.rows
            .map((x) => `${x.quantity ?? "?"} ${x.unit || ""} ${x.work_type || ""}`.trim())
            .join(" · ")
        : "satır yok";
    box.innerHTML =
      `<div class="section-title">Sonuçlar</div>` +
      out
        .map(
          ({ text, r, ms }) => `<div class="card">
        <div class="strong small">${esc(text)}</div>
        ${kv("Kural motoru", engineLine(r.analysis))}
        ${
          r.suggestions.length
            ? r.suggestions
                .map(
                  (s) =>
                    (s.error ? kv("Yapay zeka", "Hata: " + s.error) : "") +
                    s.rows
                      .map(
                        (x) =>
                          kv("Yapay zeka önerisi", `${x.quantity ?? "?"} ${x.unit || ""} ${x.work_type || ""}`.trim() || "—") +
                          (x.rejected.length ? `<div class="muted tiny">Reddedilen: ${esc(x.rejected.join("; "))}</div>` : ""),
                      )
                      .join("") +
                    (!s.error && !s.rows.length ? kv("Yapay zeka", "öneri yok") : ""),
                )
                .join("")
            : kv("Yapay zeka", "gerekmedi (motor anladı)")
        }
        <div class="muted tiny">${(ms / 1000).toFixed(1)} sn</div>
      </div>`,
        )
        .join("");
  });
  return true;
}

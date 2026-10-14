// "Müşteri Kartlarını Birleştir" ekranı: aynı firmanın farklı yazılmış kartlarını tek karta toplar,
// istenirse eski adları hedef müşterinin şantiyesi yapar. Önizleme → onay → tek işlem (ya hep ya hiç).
import { qs, qsa, esc, appbar, toast, notice, confirmDialog } from "./ui.js";
import { newRecord, nowISO, isActive } from "./core.js";
import { planMerge, suggestGroups } from "./merge-core.js";

const LABEL = {
  work_records: "İş kaydı", sites: "Şantiye", cari_movements: "Cari hareket", cash_records: "Kasa/tahsilat",
  hakedis: "Hakediş", quotes: "Teklif", contracts: "Sözleşme", slips: "Fiş", documents: "Belge", price_book: "Fiyat",
  aliases: "Takma ad", inbox_messages: "Mesaj taslağı", payables: "Borç/alacak belgesi", receivable_plans: "Vade planı",
  bank_movements: "Banka hareketi", activities: "Takip", shift_assignments: "Görev", cost_allocations: "Maliyet dağıtımı",
};

export async function screen(ctx) {
  if (ctx.parts[0] !== "kart-birlestir") return false;
  const { root, db } = ctx;
  const d = await db.dumpAll();
  const customers = (d.customers || []).filter(isActive);
  const works = (id) => (d.work_records || []).filter((w) => isActive(w) && w.customer_id === id).length;
  const list = customers.map((c) => ({ ...c, works: works(c.id) })).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const groups = suggestGroups(d);
  root.innerHTML =
    appbar("Müşteri Kartlarını Birleştir", `${customers.length} müşteri kartı`) +
    `<div style="height:10px"></div>
    ${notice("info", "Aynı firma birden çok kart olarak açıldıysa tek karta toplayın. Şantiyesi ayrı müşteri gibi açılmışsa \"şantiye olarak ekle\"yi işaretleyin. Kayıtlar silinmez; eski kart çöp kutusuna gider, eski ad hafızaya yazılır. Önce yedek almanız önerilir.")}
    ${groups.length ? `<div class="section-title">Benzer görünenler (${groups.length})</div>` + groups.map((g, i) => `<div class="card tap" data-group="${i}"><div class="small">${g.level === "güçlü" ? "🔴" : "🟡"} ${g.customers.map((c) => `<b>${esc(c.name)}</b> <span class="muted">(${c.works} iş)</span>`).join(" · ")}</div><div class="muted tiny" style="margin-top:4px">Dokunun → aşağıda seçilsin</div></div>`).join("") : ""}
    <button class="btn block" data-go="#/kime-kontrol">🔎 Benzer adlı ama farklı müşteriler: işleri tek tek kontrol et</button>
    <div class="section-title">Birleştirme</div>
    <div class="card">
      <div class="field"><label>Kalacak (doğru) müşteri</label><select data-target><option value="">— seçin —</option>${list.map((c) => `<option value="${esc(c.id)}">${esc(c.name)} (${c.works} iş)</option>`).join("")}</select></div>
      <div class="field"><label>Birleşecek kartlar</label><input data-filter placeholder="Ara…"></div>
      <div data-list style="max-height:320px;overflow:auto;border:1px solid var(--border);border-radius:10px;padding:6px">${list.map((c) => `<label class="history-check" data-row="${esc(c.name.toLocaleLowerCase("tr-TR"))}"><input type="checkbox" data-src value="${esc(c.id)}"> ${esc(c.name)} <span class="muted small">(${c.works} iş)</span></label>`).join("")}</div>
      <label class="history-check" style="margin-top:8px"><input type="checkbox" data-assite> Seçilenlerin adı, kalacak müşterinin <b>şantiyesi</b> olsun (şantiyesiz işleri o şantiyeye bağlanır)</label>
      <button class="btn primary block" style="margin-top:8px" data-preview>Önizle</button>
    </div>
    <div data-out></div>`;
  const target = qs("[data-target]", root), out = qs("[data-out]", root);
  qs("[data-filter]", root).addEventListener("input", (e) => {
    const q = e.target.value.toLocaleLowerCase("tr-TR");
    for (const r of qsa("[data-row]", root)) r.style.display = !q || r.dataset.row.includes(q) ? "" : "none";
  });
  for (const el of qsa("[data-group]", root))
    el.addEventListener("click", () => {
      const g = groups[Number(el.dataset.group)];
      target.value = g.customers[0].id; // en çok işi olan kalır (değiştirilebilir)
      for (const cb of qsa("[data-src]", root)) cb.checked = g.customers.slice(1).some((c) => c.id === cb.value);
      qs("[data-preview]", root).scrollIntoView({ behavior: "smooth", block: "center" });
      toast("Seçildi — kalacak kartı kontrol edip Önizle'ye basın", "ok");
    });
  qs("[data-preview]", root).addEventListener("click", () => {
    const src = qsa("[data-src]", root).filter((c) => c.checked).map((c) => c.value).filter((id) => id !== target.value);
    let plan;
    try {
      plan = planMerge(d, src, target.value, { asSite: qs("[data-assite]", root).checked });
    } catch (e) {
      out.innerHTML = notice("warn", e.message);
      return;
    }
    out.innerHTML = `<div class="card">
      <div class="strong">${plan.sources.map((s) => esc(s.name)).join(", ")} → <span style="color:var(--accent,#f5a623)">${esc(plan.target.name)}</span></div>
      <div class="small" style="margin-top:6px">${Object.entries(plan.counts).map(([k, n]) => `${esc(LABEL[k] || k)}: <b>${n}</b>`).join(" · ") || "Taşınacak kayıt yok"}</div>
      ${plan.newSites.length ? `<div class="small" style="margin-top:6px">Yeni şantiye: ${plan.newSites.map((s) => esc(s.name)).join(", ")}</div>` : ""}
      <div class="muted tiny" style="margin-top:6px">Eski adlar hafızaya yazılır; mesajda geçince doğru karta gider.</div>
      <div class="row" style="gap:8px;margin-top:10px"><button class="btn grow" data-backup>💾 Önce Yedek Al</button><button class="btn primary grow" data-apply>Birleştir</button></div>
    </div>`;
    qs("[data-backup]", out).addEventListener("click", async () => (await import("./m-crm.js")).doBackup(ctx));
    qs("[data-apply]", out).addEventListener("click", async () => {
      if (!(await confirmDialog("Birleştirilsin mi?", `${plan.sources.length} kart "${plan.target.name}" kartına toplanacak. Bu işlem tek seferde yapılır.`, "Birleştir"))) return;
      try {
        await applyMerge(plan);
        toast("Birleştirildi", "ok");
        ctx.reload();
      } catch (e) {
        out.insertAdjacentHTML("beforeend", notice("warn", "Birleştirilemedi, hiçbir şey değişmedi: " + (e.message || e)));
      }
    });
  });
  return true;
}

export async function applyMerge(plan) {
  const { transaction } = await import("./enterprise-db.js");
  const stores = [...new Set(["customers", "sites", "aliases", ...plan.updates.map((u) => u.store)])];
  return transaction(stores, (data, t) => {
    const ids = new Map();
    for (const s of plan.newSites) {
      const r = newRecord({ name: s.name, customer_id: s.customer_id, note: s.note, active: true });
      t.add("sites", r);
      ids.set(s.tmp, r.id);
    }
    const fix = (o) => (o && typeof o.site_id === "string" && ids.has(o.site_id) ? { ...o, site_id: ids.get(o.site_id) } : o);
    for (const u of plan.updates) {
      const cur = (data[u.store] || []).find((x) => x.id === u.before.id);
      if (!cur || cur.updated_at !== u.before.updated_at) throw Error("Kayıtlar önizlemeden sonra değişti; tekrar önizleyin");
      t.put(u.store, { ...fix(u.after), updated_at: nowISO() });
    }
    const liveAliases = (data.aliases || []).filter((a) => !a.deleted_at && a.active !== false);
    for (const a of plan.aliases) {
      const target_id = ids.get(a.target_ref) || a.target_ref;
      const key = String(a.alias).toLocaleLowerCase("tr-TR").trim();
      if (liveAliases.some((x) => String(x.alias).toLocaleLowerCase("tr-TR").trim() === key && x.target_type === a.target_type)) continue;
      t.add("aliases", newRecord({ alias: a.alias, target_type: a.target_type, target_id, active: true, origin: "merge", confirmed_at: nowISO() }));
    }
    for (const s of plan.sources) {
      const cur = data.customers.find((x) => x.id === s.id);
      t.put("customers", { ...cur, deleted_at: nowISO(), merged_into: plan.target.id, deleted_reason: `"${plan.target.name}" ile birleştirildi`, updated_at: nowISO() });
    }
  });
}

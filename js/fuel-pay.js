// "Mazotla ödeme hesapları" (#/mazot-hesaplari): ücretini (tamamen ya da kısmen) mazotla ödeyen tüm müşteriler.
import { qs, esc, appbar, notice, toast } from "./ui.js";

export async function screen(ctx) {
  if (ctx.parts[0] !== "mazot-hesaplari") return false;
  if (ctx.parts[1]) return auditScreen(ctx, ctx.parts[1]);
  const { root, db } = ctx;
  const { fuelLedgers, fuelRulesOf } = await import("./assistant-rules.js");
  const d = await db.dumpAll();
  const rows = fuelLedgers(d);
  const { fuelAudit } = await import("./fuel-audit.js");
  const audits = Object.fromEntries(rows.map((r) => [r.id, fuelAudit(d, r.id)]));
  const total = Math.round(rows.reduce((n, r) => n + Math.max(0, r.balance), 0) * 10) / 10;
  const { fuelPrice } = await import("./finance-chart.js");
  const ref = await db.metaGet("fuel_ref_price");
  const price = fuelPrice(d, new Date().toISOString().slice(0, 10), ref);
  root.innerHTML =
    appbar("Mazotla Ödeme Hesapları", rows.length ? `toplam alacak ${total} L` : "") +
    `<div style="height:10px"></div>
    ${notice("info", "Bir müşteri işin karşılığını mazotla ödüyorsa müşteri kartında Kartı Düzenle → \"Mazotla ödeme kuralları\"na kural ekleyin (ör. 75 L / Sefer, gravak maslak, yalnız mazot). Kurala uyan işler hakedişe para yazmaz; hak edilen litre buradan takip edilir.")}
    <div class="card"><div class="small">Litre değeri: <b>${price ? price.toLocaleString("tr-TR") + " ₺/L" : "bilinmiyor"}</b> ${price && !ref ? "(depo alış ortalaması)" : ref ? "(referans)" : ""}${price ? ` · toplam alacak ≈ <b>${Math.round(total * price).toLocaleString("tr-TR")} ₺</b>` : ""}</div>
      <div class="formgrid2" style="margin-top:6px"><div class="field"><label>Referans litre fiyatı (depoya fiyatlı giriş yoksa)</label><input type="number" step="any" data-ref value="${esc(ref ?? "")}"></div></div>
      <button class="btn sm" data-ref-save>Kaydet</button>
      <div class="muted tiny" style="margin-top:4px">Mazotla ödenen işler kâr hesabında TL gelir sayılmaz; müşterinin araca verdiği mazot da masraf sayılmaz. Takip litre iledir; bu fiyat yalnız kalan alacağın yaklaşık değerini gösterir.</div></div>
    ${rows.map((r) => {
      const c = (d.customers || []).find((x) => x.id === r.id);
      const rules = fuelRulesOf(c);
      return `<div class="card tap" data-go="#/musteriler/${esc(r.id)}"><div class="row between"><b>${esc(r.name)}</b><span class="${r.balance > 0 ? "badge warn" : "badge ok"}">${r.balance > 0 ? r.balance + " L alacak" : r.balance < 0 ? -r.balance + " L fazla" : "kapalı"}</span></div>
        <div class="small">${r.earned} L hak edildi · ${r.received} L alındı · ${r.works} iş</div>
        <div class="muted tiny">${rules.map((x) => `${x.per} L/${String(x.unit || "Sefer").toLocaleLowerCase("tr-TR")}${x.match ? " (" + esc(x.match) + ")" : ""}`).join(" · ") || "kural yok"}</div></div>
        ${auditLine(audits[r.id], r.id)}`;
    }).join("") || '<div class="muted small" style="padding:8px">Henüz mazotla ödeme kuralı olan müşteri yok.</div>'}`;
  qs("[data-ref-save]", root).addEventListener("click", async () => {
    const v = Number(qs("[data-ref]", root).value);
    await db.metaSet("fuel_ref_price", v > 0 ? v : null);
    toast("Kaydedildi", "ok");
    ctx.reload();
  });
  return true;
}

// Denetim özeti (liste satırı altında): kayıt değiştirmez, ayrıntı ekranına götürür
function auditLine(a, id) {
  if (!a || a.clean) return "";
  const p = [];
  if (a.tlWorks.length + a.lockedTl.length) p.push(`${a.tlWorks.length + a.lockedTl.length} iş TL fiyatla yazılmış (${a.tlTotal.toLocaleString("tr-TR")} ₺ TL alacakta görünüyor; alınan mazot bunu düşürmez)`);
  if (a.mixed.length) p.push(`${a.mixed.length} işte hem litre hem TL var`);
  if (a.unlinkedFuel.length) p.push(`${a.unlinkedFuel.length} yakıt kaydı bu müşteriye bağlanmamış olabilir`);
  if (a.pricedGift.length) p.push(`${a.pricedGift.length} "müşteri verdi" kaydında TL tutar var`);
  return `<div class="card" style="margin-top:-6px;border-left:4px solid #c98a00" data-go="#/mazot-hesaplari/${esc(id)}"><div class="small">⚠ <b>Denetim:</b> ${esc(p.join(" · "))} <b>— incele ›</b></div></div>`;
}

// Müşterinin mazot hesabı denetimi: nedenler kayıt kayıt; düzeltme yalnız seçilen kayıtlarda, önizleme ve onayla
async function auditScreen(ctx, id) {
  const { root, db } = ctx;
  const { fuelAudit } = await import("./fuel-audit.js");
  const { applyFuelPay } = await import("./assistant-rules.js");
  const { customerBalances } = await import("./collect-core.js");
  const { confirmDialog } = await import("./ui.js");
  const d = await db.dumpAll();
  const a = fuelAudit(d, id);
  const tl = (n) => Number(n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  const tr = (s) => String(s || "").split("-").reverse().join(".");
  const bal = customerBalances(d).bal[id] || 0;
  const row = (w, extra = "") => `<div class="small" style="padding:4px 0;border-top:1px solid var(--border)">${extra}<a href="#/isler/${esc(w.id)}">${tr(w.date)} · ${tl(w.quantity)} ${esc(String(w.unit || "").toLocaleLowerCase("tr-TR"))} ${esc(w.label || "")}</a> · <b>${tl(w.amount)} ₺</b>${w.why ? `<div class="muted tiny">Neden: ${esc(w.why.join(" / "))}</div>` : ""}</div>`;
  root.innerHTML =
    appbar("Mazot Hesabı Denetimi", a.customer) +
    `<div style="height:10px"></div>
    ${notice("info", "Bu müşterinin anlaşması litre üzerinden (sefer başı litre). Litre hakkı olan iş TL alacak oluşturmaz; alınan mazot litre hesabından düşer. Aşağıdaki kayıtlar bu düzenin dışında kalanlardır. Hiçbir kayıt kendiliğinden değişmez.")}
    <div class="card"><div class="small">TL alacak (cari + hakedişe girmemiş fiyatlı işler): <b>${tl(bal)} ₺</b></div>
      <div class="small">Litre: ${a.ledger.earned} L hak edildi · ${a.ledger.received} L alındı · <b>kalan ${a.ledger.balance} L</b></div></div>
    ${a.fixable.length ? `<div class="card"><b>1. Kurala uyan ama TL fiyatla yazılmış işler</b> <span class="muted small">(seçtiklerinize kural uygulanır)</span>
      ${a.fixable.map((w) => row(w, `<label class="history-check" style="display:inline"><input type="checkbox" data-fix="${esc(w.id)}"> </label>`) + `<div class="muted tiny">Düzeltilirse: ${tl(w.amount)} ₺ → ${w.onlyPay ? "0 ₺" : tl(w.amount) + " ₺"} · +${w.liters} L hak</div>`).join("")}
      <div class="small" data-fixprev style="margin-top:8px"></div>
      <button class="btn primary block" data-fixgo disabled style="margin-top:6px">Seçilenleri önizle ve düzelt</button></div>` : ""}
    ${a.tlWorks.filter((w) => !w.wouldMatch).length ? `<div class="card"><b>2. Kurala uymayan TL işler</b><div class="muted tiny">Bu işler kural kelimesi / birimi / tarihi tutmadığı için TL fiyatla yazıldı. Gerçekten mazot karşılığıysa ya müşteri kartındaki kuralı (kelime, birim, tarih) ya da işi düzeltin; burada kendiliğinden değiştirilmez.</div>
      ${a.tlWorks.filter((w) => !w.wouldMatch).map((w) => row(w)).join("")}</div>` : ""}
    ${a.lockedTl.length ? `<div class="card"><b>3. Kesinleşmiş hakedişteki TL işler</b><div class="muted tiny">Hakedişe girmiş iş tek başına değiştirilemez; düzeltme hakediş üzerinden (iptal / düzeltme kaydı) yapılmalı.</div>
      ${a.lockedTl.map((w) => row(w, `Hakediş ${esc(w.hakedis)} · `)).join("")}</div>` : ""}
    ${a.mixed.length ? `<div class="card"><b>4. Hem litre hem TL yazılmış işler</b><div class="muted tiny">Kural "ücret yalnız mazot" ama işte TL tutar da var: alacak iki kez sayılıyor olabilir.</div>
      ${a.mixed.map((w) => row({ ...w, label: "+" + w.liters + " L" })).join("")}</div>` : ""}
    ${a.unlinkedFuel.length ? `<div class="card"><b>5. Bu müşteriye bağlanmamış olabilecek yakıt</b><div class="muted tiny">Açıklamasında müşteri adı geçiyor ama müşteri seçilmemiş: litre hesabından düşmüyor. İstasyon alışı ve depodan araca çıkış müşteri ödemesi değildir; yalnız petrolcüsüz, tutarsız depo girişi buradan bağlanabilir.</div>
      ${a.unlinkedFuel.map((f) => `<div class="small" style="padding:4px 0;border-top:1px solid var(--border)">${tr(f.date)} · ${tl(f.liters)} L · ${esc(f.where)} ${f.store === "fuel_tank_movements" && f.where === "depoya" ? `<button class="btn sm" data-link="${esc(f.id)}">Bu müşteriye bağla</button>` : '<span class="muted tiny">elle kontrol edin</span>'}</div>`).join("")}</div>` : ""}
    ${a.pricedGift.length ? `<div class="card"><b>6. TL tutarlı "müşteri verdi" kayıtları</b><div class="muted tiny">Müşterinin verdiği mazot masraf değildir; tutar alanı yanlışlıkla doldurulmuş olabilir.</div>${a.pricedGift.map((f) => `<div class="small">${tr(f.date)} · ${tl(f.liters)} L · ${tl(f.total)} ₺</div>`).join("")}</div>` : ""}
    ${a.clean ? notice("ok", "Bu müşteride litre düzeninin dışında kalan kayıt bulunmadı.") : ""}`;
  const picks = () => [...root.querySelectorAll("[data-fix]:checked")].map((x) => a.fixable.find((w) => w.id === x.dataset.fix));
  const prev = () => {
    const sel = picks(), box = qs("[data-fixprev]", root), btn = qs("[data-fixgo]", root);
    if (!box) return;
    const dTL = sel.reduce((n, w) => n + (w.onlyPay ? w.amount : 0), 0), dL = sel.reduce((n, w) => n + w.liters, 0);
    btn.disabled = !sel.length;
    box.innerHTML = sel.length ? `Önizleme: TL alacak <b>${tl(bal)} → ${tl(bal - dTL)} ₺</b> · litre hakkı <b>${a.ledger.earned} → ${Math.round((a.ledger.earned + dL) * 10) / 10} L</b> · kalan <b>${a.ledger.balance} → ${Math.round((a.ledger.balance + dL) * 10) / 10} L</b>` : "";
  };
  root.querySelectorAll("[data-fix]").forEach((x) => x.addEventListener("change", prev));
  qs("[data-fixgo]", root)?.addEventListener("click", async () => {
    const sel = picks();
    if (!sel.length || !(await confirmDialog("Mazot kuralı uygulansın mı?", `${sel.length} işe kural uygulanacak: ${qs("[data-fixprev]", root).textContent.replace("Önizleme: ", "")}. Her değişiklik geçmişe (audit) yazılır.`, "Uygula"))) return;
    let n = 0, skip = 0;
    for (const w0 of sel) {
      const cur = await db.get("work_records", w0.id);
      if (!cur) { skip++; continue; }
      const f = applyFuelPay(await db.dumpAll(), cur, "");
      if (!f.customer_fuel_allowance_l) { skip++; continue; }
      const op = "fuelfix:" + cur.id + ":" + (f.fuel_rule_id || "");
      // Koşul ve yazma tek transaction'da: başka sekmede / arada düzeltilmiş, hakedişe girmiş ya da toplu fişe bağlı iş değişmez
      const r = await db.updateIf("work_records", cur.id,
        (x) => !(Number(x.customer_fuel_allowance_l) > 0) && !x.price_snapshot?.locked && !(x.work_batch_id && x.slip_id) && !x.fuel_fix_op,
        { customer_fuel_allowance_l: f.customer_fuel_allowance_l, fuel_rule_id: f.fuel_rule_id || null, price_snapshot: f.price_snapshot, fuel_fix_op: op },
        `Mazot denetimi: kural uygulandı (${op}; önceki ${tl(w0.amount)} ₺)`);
      if (r.skipped) skip++; else n++;
    }
    toast(`${n} iş düzeltildi${skip ? `, ${skip} iş atlandı (zaten düzeltilmiş ya da kilitli)` : ""}`, n ? "ok" : "err");
    ctx.reload();
  });
  root.querySelectorAll("[data-link]").forEach((b) => b.addEventListener("click", async () => {
    const m = await db.get("fuel_tank_movements", b.dataset.link);
    if (!m || m.customer_id || m.supplier_id || Number(m.total) > 0) return toast("Bu kayıt artık bağlanamaz (değişmiş)", "err");
    if (!(await confirmDialog("Depo girişi bu müşteriye bağlansın mı?", `${tr(m.date)} · ${tl(m.liters)} L ${a.customer} tarafından verilmiş sayılır. Kalan litre ${a.ledger.balance} → ${Math.round((a.ledger.balance - Number(m.liters)) * 10) / 10} L olur.`, "Bağla"))) return;
    const r = await db.updateIf("fuel_tank_movements", m.id, (x) => !x.customer_id && !x.supplier_id && !(Number(x.total) > 0) && x.move_type === "GİRİŞ", { customer_id: id }, "Mazot denetimi: depo girişi müşteriye bağlandı");
    if (r.skipped) return toast("Bu kayıt artık bağlanamaz (değişmiş)", "err");
    toast("Bağlandı", "ok"); ctx.reload();
  }));
  return true;
}

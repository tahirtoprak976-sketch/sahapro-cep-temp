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

// İnceleme adayları özeti (liste satırı altında): KESİN HATA DEĞİL; kayıt değiştirmez, ayrıntı ekranına götürür
function auditLine(a, id) {
  if (!a || a.clean) return "";
  const p = [];
  if (a.tlWorks.length + a.lockedTl.length) p.push(`${a.tlWorks.length + a.lockedTl.length} iş TL fiyatla yazılmış (carideki tutar ${a.tlTotal.toLocaleString("tr-TR")} ₺)`);
  if (a.mixed.length) p.push(`${a.mixed.length} işte hem litre hem TL var`);
  if (a.unlinkedFuel.length) p.push(`${a.unlinkedFuel.length} yakıt kaydı bu müşteriye bağlı değil`);
  if (a.pricedGift.length) p.push(`${a.pricedGift.length} "müşteri verdi" kaydında TL tutar var`);
  return `<div class="card" style="margin-top:-6px;border-left:4px solid #c98a00" data-go="#/mazot-hesaplari/${esc(id)}"><div class="small">🔎 <b>İnceleme adayı:</b> ${esc(p.join(" · "))} — hata olduğu kesin değil, anlaşmaya göre doğrulayın <b>›</b></div></div>`;
}

// Müşterinin mazot hesabı incelemesi. Açmak hiçbir kayıt değiştirmez. Düzeltme yalnız seçilen kayıtta, ayrıntılı önizleme,
// anlaşma doğrulaması ve onayla; koşul + yazma + audit tek transaction'da (db.updateIf).
async function auditScreen(ctx, id) {
  const { root, db } = ctx;
  const { fuelAudit, fixPreview } = await import("./fuel-audit.js");
  const { applyFuelPay, customerFuelLedger } = await import("./assistant-rules.js");
  const { customerBalances } = await import("./collect-core.js");
  const { confirmDialog } = await import("./ui.js");
  const d = await db.dumpAll();
  const a = fuelAudit(d, id);
  const tl = (n) => Number(n || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  const tr = (s) => String(s || "").split("-").reverse().join(".");
  const bal = customerBalances(d).bal[id] || 0;
  const row = (w, extra = "") => `<div class="small" style="padding:4px 0;border-top:1px solid var(--border)">${extra}<a href="#/isler/${esc(w.id)}">${tr(w.date)} · ${tl(w.quantity)} ${esc(String(w.unit || "").toLocaleLowerCase("tr-TR"))} ${esc(w.label || "")}</a> · <b>${tl(w.amount)} ₺</b>${w.why ? `<div class="muted tiny">Olası neden: ${esc(w.why.join(" / "))}</div>` : ""}</div>`;
  root.innerHTML =
    appbar("Mazot Hesabı İncelemesi", a.customer) +
    `<div style="height:10px"></div>
    ${notice("info", "Bu ekran müşteri kartındaki litre kuralını esas alarak İNCELEME ADAYLARINI listeler; hiçbiri kesin hata değildir. Müşterinin gerçek anlaşması (sefer başı litre mi, TL borcuna karşılık mazot mu, karma mı) burada doğrulanmaz. Ekranı açmak hiçbir kaydı değiştirmez. Kural, yalnız bakiyeyi düşürmek için genişletilmemelidir.")}
    <div class="card"><div class="small">TL alacak (cari + hakedişe girmemiş fiyatlı işler): <b>${tl(bal)} ₺</b></div>
      <div class="small">Litre: ${a.ledger.earned} L hak edildi · ${a.ledger.received} L alındı · <b>kalan ${a.ledger.balance} L</b></div></div>
    ${a.fixable.length ? `<div class="card"><b>1. Bugünkü kurala uyan ama TL fiyatla yazılmış işler</b><div class="muted tiny">Bu işler gerçekten mazot karşılığı yapıldıysa kurala bağlanabilir. Anlaşma doğrulanmadan dönüştürmeyin.</div>
      ${a.fixable.map((w) => row(w, `<label class="history-check" style="display:inline"><input type="checkbox" data-fix="${esc(w.id)}"> </label>`)).join("")}
      <div data-fixprev style="margin-top:8px"></div>
      <label class="history-check small" data-okwrap hidden style="margin-top:6px"><input type="checkbox" data-agree> Bu işlerin <b>gerçek (geçmiş) anlaşmasının</b> aşağıdaki mevcut kuralla aynı olduğunu kendim doğruladım (belge / müşteriyle mutabakat). Mevcut kural kaydı bunun kanıtı değildir.</label>
      <button class="btn primary block" data-fixgo disabled style="margin-top:6px">Onayla ve uygula</button></div>` : ""}
    ${a.tlWorks.filter((w) => !w.wouldMatch).length ? `<div class="card"><b>2. Bugünkü kurala uymayan TL işler</b><div class="muted tiny">Yalnız bilgi. Kural kelimesi / birimi / tarihi tutmuyor. Bu işler gerçekten mazot karşılığıysa önce anlaşmayı doğrulayın; kuralı bakiyeyi düşürmek için genişletmeyin.</div>
      ${a.tlWorks.filter((w) => !w.wouldMatch).map((w) => row(w)).join("")}</div>` : ""}
    ${a.lockedTl.length ? `<div class="card"><b>3. Kesinleşmiş hakedişteki TL işler</b><div class="muted tiny">Yalnız bilgi. Hakedişe girmiş iş buradan değiştirilmez.</div>
      ${a.lockedTl.map((w) => row(w, `Hakediş ${esc(w.hakedis)} · `)).join("")}</div>` : ""}
    ${a.mixed.length ? `<div class="card"><b>4. Hem litre hem TL yazılmış işler</b><div class="muted tiny">Yalnız bilgi. Kural "ücret yalnız mazot" ama işte TL tutar da var; anlaşma karma olabilir.</div>
      ${a.mixed.map((w) => row({ ...w, label: "+" + w.liters + " L" })).join("")}</div>` : ""}
    ${a.unlinkedFuel.length ? `<div class="card"><b>5. Bu müşteriye bağlı olmayan yakıt kayıtları</b><div class="muted tiny">Yeni yakıt ya da tahsilat kaydı açılmaz. Yalnız mevcut kaydın müşteri alanı, önizleme ve onayla doldurulabilir. İstasyon alışı ve depodan araca çıkış müşteri ödemesi değildir.</div>
      ${a.unlinkedFuel.map((f) => `<div class="small" style="padding:4px 0;border-top:1px solid var(--border)">${tr(f.date)} · ${tl(f.liters)} L · ${esc(f.where)}${f.note ? ` · <span class="muted">${esc(f.note.slice(0, 80))}</span>` : ""} ${f.linkable ? `<button class="btn sm" data-link="${esc(f.store + "|" + f.id)}">Önizle ve bağla</button>` : '<span class="muted tiny">yalnız bilgi</span>'}</div>`).join("")}</div>` : ""}
    ${a.pricedGift.length ? `<div class="card"><b>6. TL tutarlı "müşteri verdi" kayıtları</b><div class="muted tiny">Yalnız bilgi.</div>${a.pricedGift.map((f) => `<div class="small">${tr(f.date)} · ${tl(f.liters)} L · ${tl(f.total)} ₺</div>`).join("")}</div>` : ""}
    ${a.clean ? notice("ok", "Bu müşteride inceleme adayı bulunmadı.") : ""}`;
  const picks = () => [...root.querySelectorAll("[data-fix]:checked")].map((x) => x.dataset.fix);
  const sync = () => {
    const box = qs("[data-fixprev]", root), btn = qs("[data-fixgo]", root), ok = qs("[data-agree]", root), wrap = qs("[data-okwrap]", root);
    if (!box) return;
    const sel = picks();
    wrap.hidden = !sel.length;
    btn.disabled = !sel.length || !ok.checked;
    if (!sel.length) { box.innerHTML = ""; return; }
    const P = fixPreview(d, id, sel);
    box.innerHTML = `<div class="small"><b>Önizleme (henüz bir şey yazılmadı)</b></div>` + P.rows.map((r) => `<div class="small" style="padding:6px 0;border-top:1px dashed var(--border)">
        <div><b>Kayıt:</b> ${esc(r.record)}</div>
        <div><b>Mevcut kurala göre öneri:</b> ${esc(r.current.join(" | "))} <span class="muted tiny">— kural geçmişi tutulmuyor; tarih aralığının uyması, kuralın o tarihte bu içerikte olduğunu kanıtlamaz. Geçmiş anlaşmayı siz doğrulayın.</span></div>
        <div><b>Bugünkü kuraldan fark:</b> ${esc(r.diff)}</div>
        <div><b>Değişecek:</b> ${esc(r.changes.join("; "))}</div>
        <div><b>Tutar (bu iş):</b> net ${tl(r.money.old.net)} → ${tl(r.money.new.net)} ₺ · KDV${r.money.old.rate != null ? " %" + r.money.old.rate : ""} ${tl(r.money.old.kdv)} → ${tl(r.money.new.kdv)} ₺ · brüt ${tl(r.money.old.gross)} → ${tl(r.money.new.gross)} ₺ <span class="muted tiny">(fiyat KDV ${r.money.old.basis || "—"} girilmiş; carinin topladığı: ${tl(r.money.old.booked)} → ${tl(r.money.new.booked)} ₺)</span></div></div>`).join("") +
      `<div class="small" style="padding-top:6px;border-top:1px solid var(--border)"><b>Toplam etki:</b> net ${P.money.net >= 0 ? "+" : ""}${tl(P.money.net)} ₺ · KDV ${P.money.kdv >= 0 ? "+" : ""}${tl(P.money.kdv)} ₺ · brüt ${P.money.gross >= 0 ? "+" : ""}${tl(P.money.gross)} ₺</div>
      <div class="small"><b>Müşteri ekranındaki TL alacak</b> <span class="muted tiny">(hakedişe girmemiş işlerde fiyat nasıl girildiyse o tutar — KDV hariç girildiyse net; hesap yöntemi bu düzeltmeyle değişmez)</span>: ${tl(bal)} → ${tl(bal + P.money.booked)} ₺ · <b>Litre hakkı:</b> ${P.litre.earnedOld} → ${P.litre.earnedNew} L · <b>Alınan:</b> ${P.litre.received} L (değişmez) · <b>Kalan:</b> ${P.litre.remainingOld} → ${P.litre.remainingNew} L</div>`;
  };
  root.querySelectorAll("[data-fix],[data-agree]").forEach((x) => x.addEventListener("change", sync));
  qs("[data-fixgo]", root)?.addEventListener("click", async () => {
    const sel = picks();
    if (!sel.length || !qs("[data-agree]", root).checked) return;
    if (!(await confirmDialog("Onaylıyor musunuz?", `${sel.length} işe litre kuralı uygulanacak (önizlemedeki değişiklikler). Her değişiklik geçmişe (audit) işlem kimliğiyle yazılır; aynı düzeltme ikinci kez uygulanmaz.`, "Uygula"))) return;
    let n = 0, skip = 0;
    for (const wid of sel) {
      const cur = await db.get("work_records", wid);
      if (!cur) { skip++; continue; }
      const f = applyFuelPay(await db.dumpAll(), cur, "");
      if (!f.customer_fuel_allowance_l) { skip++; continue; }
      const op = "fuelfix:" + cur.id + ":" + (f.fuel_rule_id || "");
      // Koşul ve yazma tek transaction'da: arada / başka sekmede düzeltilmiş, litre hakkı olan (eski hak yeniden hesaplanmaz),
      // hakedişe girmiş ya da toplu fişe bağlı iş değişmez
      const r = await db.updateIf("work_records", cur.id,
        (x) => !(Number(x.customer_fuel_allowance_l) > 0) && !x.price_snapshot?.locked && !(x.work_batch_id && x.slip_id) && !x.fuel_fix_op,
        { customer_fuel_allowance_l: f.customer_fuel_allowance_l, fuel_rule_id: f.fuel_rule_id || null, price_snapshot: f.price_snapshot, fuel_fix_op: op, fuel_fix_note: "Kullanıcı anlaşmayı doğruladı" },
        `Mazot incelemesi: kural uygulandı (${op}; önceki ${tl(cur.price_snapshot?.amount)} ₺; kullanıcı anlaşmayı doğruladı)`);
      if (r.skipped) skip++; else n++;
    }
    toast(`${n} iş güncellendi${skip ? `, ${skip} iş atlandı (zaten uygulanmış ya da kilitli)` : ""}`, n ? "ok" : "err");
    ctx.reload();
  });
  root.querySelectorAll("[data-link]").forEach((b) => b.addEventListener("click", async () => {
    const [store, rid] = b.dataset.link.split("|");
    const m = await db.get(store, rid);
    const can = (x) => x && !x.deleted_at && !x.customer_id && (store === "fuel_records" ? x.fuel_source === "Müşteri Verdi" : x.move_type === "GİRİŞ" && !x.supplier_id && !(Number(x.total) > 0));
    if (!can(m)) return toast("Bu kayıt artık bağlanamaz (değişmiş)", "err");
    const L = customerFuelLedger(await db.dumpAll(), id);
    const after = Math.round((L.balance - Number(m.liters)) * 10) / 10;
    if (!(await confirmDialog("Mevcut yakıt kaydı bu müşteriye bağlansın mı?", `Kayıt: ${tr(m.date)} · ${tl(m.liters)} L · ${store === "fuel_records" ? "araca (müşteri verdi)" : "depoya giriş"}${m.description || m.note ? " · " + (m.description || m.note).slice(0, 60) : ""}. Değişecek: yalnız bu kaydın müşteri alanı → ${a.customer}. Yeni yakıt / tahsilat kaydı açılmaz. Alınan ${L.received} → ${Math.round((L.received + Number(m.liters)) * 10) / 10} L · kalan ${L.balance} → ${after} L.`, "Bağla"))) return;
    const r = await db.updateIf(store, rid, can, { customer_id: id }, "Mazot incelemesi: mevcut yakıt kaydı müşteriye bağlandı (kullanıcı onayı)");
    if (r.skipped) return toast("Bu kayıt artık bağlanamaz (değişmiş)", "err");
    toast("Bağlandı", "ok"); ctx.reload();
  }));
  return true;
}

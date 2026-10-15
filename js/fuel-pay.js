// "Mazotla ödeme hesapları" (#/mazot-hesaplari): ücretini (tamamen ya da kısmen) mazotla ödeyen tüm müşteriler.
import { esc, appbar, notice } from "./ui.js";

export async function screen(ctx) {
  if (ctx.parts[0] !== "mazot-hesaplari") return false;
  const { root, db } = ctx;
  const { fuelLedgers, fuelRulesOf } = await import("./assistant-rules.js");
  const d = await db.dumpAll();
  const rows = fuelLedgers(d);
  const total = Math.round(rows.reduce((n, r) => n + Math.max(0, r.balance), 0) * 10) / 10;
  root.innerHTML =
    appbar("Mazotla Ödeme Hesapları", rows.length ? `toplam alacak ${total} L` : "") +
    `<div style="height:10px"></div>
    ${notice("info", "Bir müşteri işin karşılığını mazotla ödüyorsa müşteri kartında Kartı Düzenle → \"Mazotla ödeme kuralları\"na kural ekleyin (ör. 75 L / Sefer, gravak maslak, yalnız mazot). Kurala uyan işler hakedişe para yazmaz; hak edilen litre buradan takip edilir.")}
    ${rows.map((r) => {
      const c = (d.customers || []).find((x) => x.id === r.id);
      const rules = fuelRulesOf(c);
      return `<div class="card tap" data-go="#/musteriler/${esc(r.id)}"><div class="row between"><b>${esc(r.name)}</b><span class="${r.balance > 0 ? "badge warn" : "badge ok"}">${r.balance > 0 ? r.balance + " L alacak" : r.balance < 0 ? -r.balance + " L fazla" : "kapalı"}</span></div>
        <div class="small">${r.earned} L hak edildi · ${r.received} L alındı · ${r.works} iş</div>
        <div class="muted tiny">${rules.map((x) => `${x.per} L/${String(x.unit || "Sefer").toLocaleLowerCase("tr-TR")}${x.match ? " (" + esc(x.match) + ")" : ""}`).join(" · ") || "kural yok"}</div></div>`;
    }).join("") || '<div class="muted small" style="padding:8px">Henüz mazotla ödeme kuralı olan müşteri yok.</div>'}`;
  return true;
}

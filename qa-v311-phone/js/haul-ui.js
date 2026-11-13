// Malzeme katsayıları ekranı (#/malzeme-katsayilari): kabarma payı / yoğunluk varsayımları. Yalnız tahmin hesabını etkiler;
// hiçbir iş, cari, kasa veya fiş kaydı değişmez. Değerler meta "haul_materials" içinde (yedekle birlikte taşınır).
import { qs, qsa, esc, appbar, toast } from "./ui.js";
import { materials, swellPct, checkMaterial, MATERIALS } from "./haul-core.js";

const n2 = (x) => (x == null ? "" : String(x).replace(".", ","));
const parse = (s) => (String(s || "").trim() === "" ? "" : Number(String(s).replace(",", ".")));

export async function screen(ctx) {
  if (ctx.parts[0] !== "malzeme-katsayilari") return false;
  const { root, db } = ctx;
  const over = (await db.metaGet("haul_materials")) || {};
  const mats = materials(over);
  root.innerHTML = appbar("Malzeme Katsayıları", "Kabarma payı · tahmini m³ hesabı") + `
    <div class="notice info small" style="margin-top:10px"><span>ℹ</span><span>Bu değerler yalnız <b>tahmini</b> yerinde m³ hesabında kullanılır. İş, cari, kasa ve fiş kayıtları değişmez. Başlangıç değerleri genel tablolardan (Caterpillar); kendi sahanızda ölçülen işlerden sonra düzeltin.</span></div>
    ${mats.map((m) => `<div class="card" data-mat="${esc(m.key)}">
      <div class="row between"><b>${esc(m.name)}</b><span class="small muted">güven: ${esc(m.trust)}${m.edited ? " · düzeltildi" : ""}</span></div>
      <div class="formgrid2" style="margin-top:6px">
        <div class="field"><label>Kasadaki (gevşek) t/m³</label><input inputmode="decimal" data-loose value="${esc(n2(m.loose))}"></div>
        <div class="field"><label>Yerinde (doğal) t/m³</label><input inputmode="decimal" data-bank value="${esc(n2(m.bank))}" placeholder="bilinmiyor"></div>
      </div>
      <div class="small" data-swell>${swellPct(m) == null ? "Kabarma: hesaplanmıyor (yerinde yoğunluk yok)" : `Kabarma payı ≈ %${swellPct(m)} — 1 m³ yerinden kasada ≈ ${n2(Math.round((m.bank / m.loose) * 100) / 100)} m³`}</div>
      ${m.note ? `<div class="muted small">${esc(m.note)}</div>` : ""}
      <div class="row" style="gap:6px;margin-top:6px"><button class="btn sm" data-save>Kaydet</button>${m.edited ? '<button class="btn sm" data-reset>Varsayılana dön</button>' : ""}</div>
    </div>`).join("")}
    <div class="muted small" style="margin:8px 4px 80px">Kaynak: araştırma raporu "Kamyon kabarma payı ve metraj" (Ekim 2026). Kaya değerleri doğrulanmamış, moloz için güvenilir veri yok.</div>`;
  for (const card of qsa("[data-mat]", root)) {
    const key = card.dataset.mat;
    qs("[data-save]", card).addEventListener("click", async () => {
      const loose = parse(qs("[data-loose]", card).value), bank = parse(qs("[data-bank]", card).value);
      const err = checkMaterial(loose, bank);
      if (err) return toast(err, "err");
      const cur = (await db.metaGet("haul_materials")) || {};
      const def = MATERIALS.find((m) => m.key === key);
      const same = loose === def.loose && (bank === "" ? def.bank == null : bank === def.bank);
      if (same) delete cur[key]; else cur[key] = { loose, bank: bank === "" ? null : bank };
      await db.metaSet("haul_materials", cur);
      toast("Kaydedildi — yalnız tahmin hesabı değişti", "ok");
      ctx.reload();
    });
    qs("[data-reset]", card)?.addEventListener("click", async () => {
      const cur = (await db.metaGet("haul_materials")) || {};
      delete cur[key];
      await db.metaSet("haul_materials", cur);
      toast("Varsayılan değer geri geldi", "ok");
      ctx.reload();
    });
  }
  return true;
}

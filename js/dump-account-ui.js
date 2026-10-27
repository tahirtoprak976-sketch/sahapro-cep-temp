// Firma/saha ortak ön ödemeli hesap. Plakaya göre süzmek bakiyeyi değiştirmez.
import * as ui from "./ui.js";
import { isActive, todayStr, uuid, fmtTL, trDate } from "./core.js";
import { dumpAccounts } from "./dump-account.js";
import { dumpReceiptRows } from "./dump-ledger-core.js";
import {
  saveDumpEntry,
  cancelDumpEntry,
  linkDumpReceipt,
  saveDumpReport,
  setDumpInvoicePeriod,
} from "./dump-ledger-db.js";
import { startActivity } from "./update-safety.js";
const {
  qs,
  qsa,
  esc,
  appbar,
  notice,
  kv,
  fSelect,
  fText,
  fNum,
  fDate,
  fArea,
  collectForm,
  toast,
  sheet,
  sheetClose,
  confirmDialog,
} = ui;
const money = (v) => fmtTL(v) + " ₺";
const kindName = {
  TOPUP: "Para yükleme",
  RECEIPT: "Fiş / gerçek kesinti",
  OPENING: "Açılış bakiyesi",
  REFUND: "Sahadan para iadesi",
};
const payerName = {
  company_account: "Ortak döküm hesabımız",
  company_direct: "Şirket ayrıca ödedi (ortak hesaptan değil)",
  customer: "Müşteri doğrudan ödedi",
};
const button = (label, hash) =>
  `<button class="btn" data-go="${esc(hash)}">${esc(label)}</button>`;
function pendingCostHTML(x) {
  const f=x.f||{},s=x.w.dump_estimate_snapshot;
  const loadSource=s?.load_source==="type_default_estimate"?"Araç türü varsayımı":"Araç kartı tahmini";
  return kv("Kesinleşen",money(f.confirmed_amount||0))
    +(f.confirmed?kv("Fişlerde kayıtlı net ton",f.actual_ton==null?"Belirtilmedi":f.actual_ton+" ton (yalnız tonajı yazılı fişler)"):"")
    +kv("Kalan tahmin (kesinti değil)",x.amount==null?"Hesaplanamadı — doğrulama bekliyor":money(x.amount))
    +kv("Beklenen toplam"+(x.amount==null?" (eksik)":""),x.amount==null?"Kesinleşen tutar + bilinmeyen tahmin":money(f.amount||0))
    +(f.unverified||x.amount==null?notice("warn",f.missing_reason||"Geçmiş tahminin dayanağı doğrulanamadı. Eski tonaj veya tarife varsayılmadı; gerçek fiş ve sefer kapsamını kontrol edin."):"")
    +(s?'<p class="small" data-dump-estimate-source>'+'İş tarihi: '+esc(trDate(s.work_date))+' · Kayda alınma: '+esc(String(s.captured_at||"").slice(0,10))+' · '+(s.manual_amount!=null?'Elle girilen tahmin: '+esc(money(s.manual_amount)):esc(money(s.fee))+' / '+esc(s.fee_unit||"birim bilinmiyor"))+(s.load_ton!=null&&!s.source_tonnage&&s.work_unit==="Sefer"&&s.fee_unit==="Ton"?' · '+esc(loadSource)+': '+esc(s.load_ton)+' ton / sefer':"")+(s.source_tonnage>0?' · Girilen tonaj: '+esc(s.source_tonnage)+' ton ('+esc(({total:"tüm seferler",per_trip:"sefer başı"})[s.tonnage_scope]||"kapsam bilinmiyor")+')':"")+'. Kart değişiklikleri bu işin tahminini yenilemez.</p>':"");
}
async function bindSheetForm(sh, fn) {
  const form = qs("form", sh);
  const releaseForm = startActivity("Döküm formu açık; kaydedin veya kapatın");
  const observer = new MutationObserver(() => {
    if (!sh.isConnected) {
      releaseForm();
      observer.disconnect();
    }
  });
  observer.observe(sh.parentNode, { childList: true });
  qs("[data-close]", sh)?.addEventListener("click", sheetClose);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const b = qs("[type=submit]", form);
    if (b.disabled) return;
    b.disabled = true;
    form.inert = true;
    const finish = startActivity("Döküm hesabı işlemi");
    try {
      await fn(collectForm(form), form);
      sheetClose();
    } catch (error) {
      qs("[data-error]", form).textContent = error.message;
      toast(error.message, "err");
    } finally {
      finish();
      b.disabled = false;
      form.inert = false;
    }
  };
}
const tail =
  '<div data-error role="alert"></div><div class="row" style="gap:8px"><button class="btn" data-close type="button">Vazgeç</button><button class="btn primary" type="submit">Kaydet</button></div>';
export async function screen(ctx) {
  if (!["dokum-hesap", "dokum-hareket"].includes(ctx.parts[0])) return false;
  const { root, db, parts, query: q } = ctx,
    d = await db.dumpAll(),
    today = todayStr();
  const live = (s) => (d[s] || []).filter(isActive),
    name = (s, id) => (d[s] || []).find((r) => r.id === id)?.name || "—";
  const entry =
    parts[0] === "dokum-hareket"
      ? live("dump_entries").find((e) => e.id === parts[1])
      : null;
  const sid =
    entry?.dump_site_id || (parts[0] === "dokum-hesap" ? parts[1] : null);
  const sites = live("dump_sites").filter((s) => !s.own_yard),
    site = sites.find((s) => s.id === sid);
  function entrySheet(kind, work = null, legacy = null) {
    const key = uuid();
    const works = live("work_records").filter(
      (w) => w.dump_site_id === site.id,
    );
    const label = (w) =>
      `${trDate(w.date)} · ${name("vehicles", w.vehicle_id)} · ${name("customers", w.customer_id)} · ${w.quantity} ${w.unit}`;
    const sh = sheet(
      `<h3>${esc(site.name)} · ${kindName[kind]}</h3><form>${notice("info", kind === "RECEIPT" ? "Fiş/ekstredeki gerçek tutarı yazın. Tahmini ton × tarife otomatik kesin kesinti yapılmaz. Döküm dahil işte müşteriye ayrıca borç yazılmaz." : kind === "OPENING" ? "Bu tarihin gün başındaki ortak bakiyeyi girin. Önceki yükleme/kesintiler bu başlangıca dahil kabul edilir; kasa veya gider oluşmaz." : "Yükleme ve para iadesi iş maliyeti değildir. Bu ekran otomatik banka/kasa hareketi oluşturmaz; dekont ve ödeme yöntemi kayıtta saklanır.")}${fDate("Tarih", "date", legacy?.date || work?.date || today, true)}${fNum(kind === "OPENING" ? "Gün başı bakiye (₺)" : "Gerçek tutar (₺)", "amount", legacy?.amount ?? "", { req: true, step: "any" })}${
        kind === "RECEIPT"
          ? `${fSelect(
              "Araç",
              "vehicle_id",
              live("vehicles").map((v) => ({ v: v.id, t: v.name })),
              work?.vehicle_id || q.vehicle_id || "",
              { req: true },
            )}${fSelect(
              "Bağlanacak iş (sonra da bağlanabilir)",
              "work_record_id",
              works.map((w) => ({ v: w.id, t: label(w) })),
              work?.id || "",
            )}${fSelect(
              "Dökümü ödeyen",
              "payer",
              Object.entries(payerName).map(([v, t]) => ({ v, t })),
              "company_account",
              { empty: false },
            )}<div class="formgrid2">${fText("Fiş / kesinti no", "receipt_no", work?.slip_no || "")}${fNum("Fişin kapsadığı sefer", "trips", 1, { step: 1, req: true })}${fNum("Fişteki net ton (opsiyonel)", "tonnage", "", { step: "any" })}</div>${fSelect(
              "Önceden ayrıca gider yazıldıysa aynı gideri bağla",
              "expense_id",
              live("expense_records")
                .filter((e) => !e.dump_deposit)
                .map((e) => ({
                  v: e.id,
                  t: `${trDate(e.date)} · ${e.category} · ${money(e.amount)}`,
                })),
              "",
            )}`
          : kind === "TOPUP"
            ? fSelect(
                "Ödeme bilgisi",
                "payment_method",
                ["Havale", "Nakit", "Kart", "Personel Ödedi", "Diğer"],
                "Havale",
                { empty: false },
              ) +
              fSelect(
                "Personel cebinden ödediyse",
                "personnel_id",
                live("personnel").map((p) => ({ v: p.id, t: p.name })),
                legacy?.personnel_id || "",
              )
            : ""
      }${fText("Barkod / referans (isteğe bağlı)", "barcode", "")}${fText("Dekont / ekstre referansı", "reference", "")}${fArea("Açıklama / belge kaynağı", "note", legacy ? "Kullanıcı kontrolüyle eski giderden yükleme" : "")}${legacy ? notice("warn", "Bu gideri yalnız gerçekten hesaba yatırılan paraysa yüklemeye dönüştürün. Seferdeki döküm ücretini burada yükleme yapmayın.") : ""}${["TOPUP", "RECEIPT"].includes(kind) ? '<div class="field"><label>Dekont / fiş fotoğrafı veya PDF (opsiyonel)</label><input type="file" name="proof" accept="image/jpeg,image/png,image/webp,application/pdf" multiple><small>En fazla 8 dosya / 30 MB; belgeler bu telefonda saklanır.</small></div>' : ""}<label class="history-check"><input type="checkbox" data-confirm required> Bilgileri kontrol ettim</label>${tail}</form>`,
      { modal: true },
    );
    if (kind === "RECEIPT") {
      qs("[name=work_record_id]", sh).onchange = (e) => {
        const w = works.find((w) => w.id === e.target.value);
        if (w) qs("[name=vehicle_id]", sh).value = w.vehicle_id;
      };
    }
    bindSheetForm(sh, async (f, form) => {
      if (!qs("[data-confirm]", form).checked)
        throw Error("Bilgileri kontrol edip işaretleyin");
      await saveDumpEntry(
        {
          ...f,
          kind,
          dump_site_id: site.id,
          ...(legacy ? { expense_id: legacy.id } : {}),
        },
        qs("[name=proof]", form) ? [...qs("[name=proof]", form).files] : [],
        key,
      );
      toast("Ortak döküm hesabına kaydedildi", "ok");
      await ctx.reload();
    });
  }
  if (parts[0] === "dokum-hareket") {
    if (!entry) {
      root.innerHTML =
        appbar("Döküm işlemi") + notice("warn", "İşlem bulunamadı");
      return true;
    }
    root.innerHTML =
      appbar(kindName[entry.kind], name("dump_sites", entry.dump_site_id)) +
      `<div class="card">${kv("Tarih", trDate(entry.date))}${kv("Tutar", money(entry.amount))}${kv("Araç", name("vehicles", entry.vehicle_id))}${kv("Müşteri", name("customers", entry.customer_id))}${kv("Ödeyen", payerName[entry.payer] || entry.payment_method || "—")}${kv("Fiş no", entry.receipt_no || "—")}${kv("Barkod", entry.barcode || "—")}${kv("Açıklama", entry.note || "—")}${button("Ortak Hesabı Aç", "#/dokum-hesap/" + entry.dump_site_id)}${entry.work_record_id ? button("Bağlı İş", "#/isler/" + entry.work_record_id) : ""}<button class="btn" data-cancel-entry>Gerekçeyle İptal Et</button></div><div class="card" data-proof></div>`;
    const holder = qs("[data-proof]", root),
      atts = await db.attachmentsFor("dump_entries", entry.id);
    holder.innerHTML = atts.length
      ? ""
      : notice("info", "Bu işleme belge eklenmemiş.");
    const urls = [];
    for (const a of atts) {
      if (a.type?.startsWith("image/")) {
        const img = document.createElement("img");
        img.alt = a.name;
        img.loading = "lazy";
        img.style.cssText = "width:100%;max-height:260px;object-fit:contain";
        img.src = URL.createObjectURL(a.blob);
        urls.push(img.src);
        holder.append(img);
      }
      const b = document.createElement("button");
      b.className = "btn block";
      b.textContent = a.name;
      b.onclick = () => ui.downloadBlob(a.blob, a.name);
      holder.append(b);
    }
    const observer = new MutationObserver(() => {
      if (!holder.isConnected) {
        urls.forEach((u) => URL.revokeObjectURL(u));
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    qs("[data-cancel-entry]", root).onclick = () => {
      const sh = sheet(
        `<h3>Döküm işlemini iptal et</h3><form>${notice("warn", entry.expense_id ? "Bağlı yükleme/gider de iptal edilir. Belge ve işlem geçmişi saklanır." : "İşlem bakiyeden ve ilgili maliyetten çıkarılır. Bağlı işin kesinti kontrolü yeniden bekler.")}${fArea("Gerekçe", "reason", "")}${entry.kind === "RECEIPT" && entry.expense_id ? '<label><input type="checkbox" name="cancel_expense" data-cancel-expense> Bağlı gideri de iptal et</label>' : ""}${tail}</form>`,
        { modal: true },
      );
      bindSheetForm(sh, async (f, form) => {
        await cancelDumpEntry(entry.id, f.reason, {
          expectedVersion: entry.updated_at,
          cancelExpense: !!qs("[data-cancel-expense]", form)?.checked,
        });
        ctx.go("#/dokum-hesap/" + entry.dump_site_id);
      });
    };
    return true;
  }
  if (!sid) {
    const accounts = dumpAccounts(d, { today });
    root.innerHTML =
      appbar("Ortak Döküm Hesapları", "Saha bakiyesi · bütün araçlar") +
      notice(
        "info",
        "Para yükleme gider değildir. Gerçek kesinti ilgili işe maliyet olur; fatura ve tahmin ayrıca bakiye düşürmez.",
      ) +
      accounts
        .map(
          (a) =>
            `<div class="card tap" data-go="#/dokum-hesap/${esc(a.site.id)}"><b>${esc(a.site.name)}</b>${kv("Kayıtlı ortak bakiye", money(a.balance))}<p class="small">${a.pending_count} işte kesinti kontrolü bekliyor${a.pending_count ? " · tahmini " + money(a.usedEst) : ""}</p></div>`,
        )
        .join("") +
      '<div class="section-title">Döküm Sahaları</div>' +
      sites.map((s) => button(s.name, "#/dokum-hesap/" + s.id)).join("");
    return true;
  }
  if (!site) {
    root.innerHTML = appbar("Döküm hesabı") + notice("warn", "Saha bulunamadı");
    return true;
  }
  const [a] = dumpAccounts(d, { today, siteId: sid }),
    entries = live("dump_entries")
      .filter((e) => e.dump_site_id === sid)
      .sort(
        (x, y) =>
          y.date.localeCompare(x.date) ||
          y.created_at.localeCompare(x.created_at),
      );
  const legacy = live("expense_records").filter(
    (e) =>
      !e.dump_deposit &&
      /döküm|dokum/i.test(e.category || "") &&
      !live("dump_entries").some((x) => x.expense_id === e.id),
  );
  root.innerHTML =
    appbar(site.name, "Bütün araçların ortak döküm bakiyesi") +
    `<section class="card" data-dump-balance>${kv("Kayıtlı ortak bakiye", money(a.balance))}${kv("Başlangıç bakiyesi", money(a.opening?.amount || 0))}${kv("Gerçek yüklemeler", money(a.credit))}${kv("Ortak hesaptan fişli kesinti", money(a.used))}${kv("Sahadan iade", money(a.refund))}${a.opening ? notice("info", trDate(a.opening.date) + " gün başı açılışından itibaren.") : notice("warn", "Açılış bakiyesi yok. Kayıtlardan önce içeride para varsa eksik görünür; hesap başlangıcını doğrulayın.")}${a.balance < 0 ? notice("warn", "Kayıtlı hesap eksi. Eksik yükleme/açılış veya fazla kesinti olabilir; gerçek kesinti gizlenmedi.") : ""}</section><section class="card">${kv("Kesinti kontrolü bekleyen iş", a.pending_count)}${kv("Bu işler için bilinen tahmin", money(a.usedEst)+(a.pending_unknown?" + bilinmeyen kısım":""))}${a.pending_count ? kv("Bekleyenler de düşerse (tahmini)", a.pending_unknown?"Hesaplanamadı — kalan tahmin eksik":money(a.projected_balance)) : ""}${a.pending_unknown ? notice("warn", a.pending_unknown + " işte tahminin dayanağı doğrulanamadı. Bu kısım bilinmiyor; tahmini toplam ve öngörülen bakiye eksik olabilir.") : ""}<p class="small">Tahminler ortak bakiyeden düşülmez. Her fiş yalnız kapsadığı seferin tahminini kaldırır; kalan seferler tahmini kalır. Kesinleşen tutar + kalan tahmin = beklenen maliyet.</p></section><div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" data-new="TOPUP">+ Para Yükle</button><button class="btn" data-new="RECEIPT">+ Gerçek Döküm Kesintisi</button><button class="btn" data-new="OPENING">Açılış Bakiyesi</button><button class="btn" data-new="REFUND">Sahadan Para İadesi</button></div>${a.assumed_credit ? notice("warn", "Eski faturadan varsayılmış " + money(a.assumed_credit) + " ödeme, gerçek yükleme kanıtı sayılmadığı için bakiyeye eklenmedi.") : ""}<section class="card"><h3>Saha Ekstresiyle Karşılaştır</h3>${a.reported ? kv(trDate(a.reported.date) + " gün sonu saha bakiyesi", money(a.reported.amount)) + kv("Aynı tarihte kayıtlarımız", money(a.reported_balance)) + notice(Math.abs(a.reported_difference) < 0.01 ? "ok" : "warn", "Fark: " + money(a.reported_difference)) : notice("info", "Sahanın gün sonu bakiyesini girin; aynı tarihli kayıtlarımızla karşılaştırılır. Fark otomatik para/gider oluşturmaz.")}<button class="btn" data-report>Bakiye Karşılaştır</button></section><div class="card">${fSelect(
      "Araç filtresi (ortak bakiye değişmez)",
      "vehicle_filter",
      live("vehicles").map((v) => ({ v: v.id, t: v.name })),
      q.vehicle_id || "",
    )}${fSelect(
      "Müşteri filtresi",
      "customer_filter",
      live("customers").map((c) => ({ v: c.id, t: c.name })),
      "",
    )}${fText("Fiş / barkod / açıklama ara", "receipt_search", "")}</div><div class="section-title">Kesinti Kontrolü Bekleyen İşler</div><div data-pending></div><div class="section-title">Doğrulanmış Hesap Hareketleri</div><div data-entries></div><div class="section-title">Eski Yükleme Kayıtları</div>${a.deposits
      .filter((e) => !entries.some((x) => x.expense_id === e.id))
      .map(
        (e) =>
          `<div class="card">${kv(trDate(e.date), money(e.amount))}<small>Eski kayıtta yükleme olarak işaretlenmiş; bakiyeye bir kez dahil.</small></div>`,
      )
      .join(
        "",
      )}<div class="section-title">Faturalar — karşılaştırma belgesi</div>${a.invoices.map((i) => `<div class="card">${kv(i.doc.doc_no || "Fatura", money(i.amount))}${i.period_known ? kv(trDate(i.from) + " – " + trDate(i.to) + " fiş toplamı", money(i.ourAmount)) : notice("info", "Fatura dönemi belirtilmemiş; fişlerle otomatik dönem eşleştirilmedi.")}${i.period_known ? notice(Math.abs(i.amount - i.ourAmount) < 0.01 ? "ok" : "warn", "Fatura ile kayıtlı ortak hesap kesintileri farkı: " + money(i.amount - i.ourAmount)) : ""}${button("Faturayı Aç", "#/belgeler/" + i.doc.id)}<button class="btn" data-period="${esc(i.doc.id)}">Dönem Belirt</button><p class="small">Bu fatura ikinci gider veya otomatik yükleme/kesinti oluşturmaz.</p></div>`).join("") || notice("info", "Fatura yok. Faturayı Asistana belge olarak yükleyebilirsiniz.")}<details class="card"><summary>Eski bağlantısız döküm giderleri (${legacy.length})</summary>${notice("warn", "Hepsini yükleme varsaymayın. Gerçek para yatırma ise tek tek dönüştürün; sefer gideriyse ilgili fişe aynı gideri bağlayın.")}${legacy.map((e) => `<p>${esc(trDate(e.date) + " · " + (e.company || e.description || "Döküm") + " · " + money(e.amount))}</p><button class="btn" data-legacy="${esc(e.id)}">Kontrol Ettim: Bu Kayıt Para Yükleme</button>`).join("")}</details><div class="card"><h3>Güncel Tarife</h3>${kv("Tahmin tarifesi", money(site.fee || 0) + " / " + (site.fee_unit || "belirtilmedi"))}<p class="small">Yeni işte tahmini yük ve tarife birlikte saklanır. Eski kaydın dayanağı yoksa güncel karttan geçmiş veri üretilmez. Yeni tarife geçmiş fişlerin tutarını değiştirmez; kesin tutar yalnız gerçek fiş/kesintidir.</p>${button("Saha Kartı / Tarife", "#/dokum/" + site.id)}</div><p class="small">İşlemler bu telefonda saklanır; belgeleri içeren tam yedek alın. İSTAÇ/İBB hesabına otomatik bağlanılmaz.</p>`;
  const renderRows = () => {
    const v = qs("[name=vehicle_filter]", root).value,
      c = qs("[name=customer_filter]", root).value,
      search = qs("[name=receipt_search]", root).value.toLocaleLowerCase(
        "tr-TR",
      );
    const matches = (e) =>
      (!v || e.vehicle_id === v) &&
      (!c || e.customer_id === c) &&
      [e.receipt_no, e.barcode, e.note, e.reference]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(search);
    const ps = a.pending.filter(
      (x) => (!v || x.w.vehicle_id === v) && (!c || x.w.customer_id === c),
    );
    qs("[data-pending]", root).innerHTML =
      ps
        .map(
          (x) =>
            `<div class="card"><b>${esc(trDate(x.w.date) + " · " + name("vehicles", x.w.vehicle_id))}</b>${kv("Müşteri", name("customers", x.w.customer_id))}${kv("Kontrol bekleyen sefer", x.remaining_trips==null?"Kapsam doğrulanamadı":x.remaining_trips)}${pendingCostHTML(x)}${x.w.unit === "Sefer" && x.w.quantity > 1 && x.w.tonnage && (!x.w.tonnage_scope || x.w.tonnage_scope === "unknown") ? notice("warn", "Tonaj tek fiş mi toplam mı belirsiz. Gerçek fişleri sefer sayısıyla girin.") : ""}${button("İşi Aç", "#/isler/" + x.w.id)}<button class="btn primary" data-work-receipt="${esc(x.w.id)}">Fişten Gerçek Kesintiyi Gir</button></div>`,
        )
        .join("") || notice("ok", "Bu filtrede kontrol bekleyen iş yok.");
    for (const b of qsa("[data-work-receipt]", root))
      b.onclick = () =>
        entrySheet(
          "RECEIPT",
          d.work_records.find((w) => w.id === b.dataset.workReceipt),
        );
    const rows = entries.filter(matches);
    qs("[data-entries]", root).innerHTML =
      rows
        .map(
          (e) =>
            `<div class="card"><b>${esc(kindName[e.kind])} · ${esc(money(e.amount))}</b>${kv("Tarih", trDate(e.date))}${e.vehicle_id ? kv("Araç", name("vehicles", e.vehicle_id)) : ""}${e.payer ? kv("Ödeyen", payerName[e.payer]) : ""}${kv("Fiş / referans", e.receipt_no || e.reference || e.barcode || "—")}${button("Belge / İşlem Detayı", "#/dokum-hareket/" + e.id)}${e.kind === "RECEIPT" && !e.work_record_id ? '<button class="btn" data-link-receipt="' + esc(e.id) + '">İş Bağla</button>' : ""}</div>`,
        )
        .join("") || notice("info", "Bu filtrede doğrulanmış hareket yok.");
    for (const b of qsa("[data-link-receipt]", root))
      b.onclick = () => {
        const e = entries.find((e) => e.id === b.dataset.linkReceipt),
          works = live("work_records").filter(
            (w) => w.dump_site_id === sid && w.vehicle_id === e.vehicle_id,
          );
        const sh = sheet(
          `<h3>Fişi İşe Bağla</h3><form>${fSelect(
            "İş",
            "work_record_id",
            works.map((w) => ({
              v: w.id,
              t:
                trDate(w.date) +
                " · " +
                name("customers", w.customer_id) +
                " · " +
                w.quantity +
                " " +
                w.unit,
            })),
            "",
            { req: true },
          )}${tail}</form>`,
          { modal: true },
        );
        bindSheetForm(sh, async (f) => {
          await linkDumpReceipt(e.id, f.work_record_id, e.updated_at);
          await ctx.reload();
        });
      };
  };
  root.addEventListener("input", (e) => {
    if (e.target.closest("[data-sheet]")) return;
    renderRows();
  });
  root.addEventListener("change", renderRows);
  renderRows();
  for (const b of qsa("[data-new]", root))
    b.onclick = () => entrySheet(b.dataset.new);
  for (const b of qsa("[data-legacy]", root))
    b.onclick = () =>
      entrySheet(
        "TOPUP",
        null,
        live("expense_records").find((e) => e.id === b.dataset.legacy),
      );
  qs("[data-report]", root).onclick = () => {
    const sh = sheet(
      `<h3>Sahanın Bildirdiği Gün Sonu Bakiye</h3><form>${fDate("Ekstre tarihi", "date", today, true)}${fNum("Sahanın gün sonu bakiyesi", "amount", "", { req: true, step: "any" })}${fArea("Referans / not", "note", "")}${tail}</form>`,
      { modal: true },
    );
    bindSheetForm(sh, async (f) => {
      await saveDumpReport(sid, f.amount, f.date, f.note);
      await ctx.reload();
    });
  };
  for (const b of qsa("[data-period]", root))
    b.onclick = () => {
      const sh = sheet(
        `<h3>Fatura Dönemi</h3><form>${fDate("Dönem başlangıcı", "from", "", true)}${fDate("Dönem bitişi", "to", "", true)}${tail}</form>`,
        { modal: true },
      );
      bindSheetForm(sh, async (f) => {
        await setDumpInvoicePeriod(b.dataset.period, f.from, f.to);
        await ctx.reload();
      });
    };
  return true;
}

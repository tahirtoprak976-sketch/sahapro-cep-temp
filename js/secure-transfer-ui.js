import { qs, esc, toast, confirmDialog, downloadBlob } from "./ui.js";
import { recipientCode, deliveryReference, fetchTransfer, openTransfer } from "./secure-transfer.js";
import { getRecipient, ensureRecipient, forgetRecipient } from "./secure-transfer-db.js";
import { reauth } from "./security.js";
import { startActivity } from "./update-safety.js";

export async function mountSecureTransfer(ctx, { openPackage, hasPreview, isBusy, clearPreview, setReceiving }) {
  const host = qs("[data-secure-transfer]", ctx.root);
  if (!host) return;
  const base = new URL("../", import.meta.url).href;
  let recipient = await getRecipient(), working = false;
  host.innerHTML = `<h2>Bağlantıyla Güvenli Aktarım</h2>
    <p class="slip-hint">Sohbette birlikte kontrol ettiğimiz geçmiş işleri bu telefona alabilirsiniz. İlk seferde eşleştirme kodunu paylaşın; sonra gönderilen bağlantıyı açın. Kayıtlar önce önizlenir, son onayınızla eklenir.</p>
    <div data-transfer-pair-state></div>
    <button class="btn" data-transfer-pair>Bu Telefonu Eşleştir</button>
    <div data-transfer-pair-tools hidden>
      <label class="field">Sohbete gönderilecek eşleştirme kodu<textarea data-transfer-code readonly rows="4" style="overflow-wrap:anywhere;word-break:break-all" aria-label="Telefon eşleştirme kodu"></textarea></label>
      <div class="row history-tools"><button class="btn" data-transfer-copy>Kodu Kopyala</button><button class="btn" data-transfer-export>Kodu Dosya Olarak İndir</button><button class="btn" data-transfer-forget>Eşleştirmeyi Kaldır</button></div>
      <p class="slip-hint">Bu kod kayıtlarınızı içermez. Telefon değişirse, tarayıcı verisi silinirse veya bağlantı başka tarayıcıda açılırsa yeniden eşleştirmek gerekir. Eşleştirme normal yedekle başka telefona taşınmaz.</p>
    </div>
    <label class="field">Gelen aktarım bağlantısı<input type="url" data-transfer-link placeholder="Gönderilen bağlantıyı buraya yapıştırın" autocomplete="off"></label>
    <button class="btn primary block" data-transfer-open>Bağlantıdaki İşleri Kontrol Et</button>
    <label class="field">Şifreli aktarım dosyası (bağlantı yerine)<input type="file" data-transfer-file accept=".json,application/json"></label>
    <div data-transfer-status role="status" aria-live="polite"></div>`;
  const status = qs("[data-transfer-status]", host);
  function renderPair() {
    qs("[data-transfer-pair-tools]", host).hidden = !recipient;
    qs("[data-transfer-pair]", host).hidden = !!recipient;
    qs("[data-transfer-code]", host).value = recipient ? recipientCode(recipient) : "";
    qs("[data-transfer-pair-state]", host).innerHTML = recipient
      ? `<p><strong>Telefon eşleşti</strong> · ${esc(recipient.id.slice(0, 12))}</p>`
      : `<p class="slip-hint">Bu tarayıcı henüz eşleştirilmedi.</p>`;
  }
  function controls(disabled) {
    working = disabled;
    setReceiving(disabled);
    for (const el of host.querySelectorAll("button,input")) el.disabled = disabled;
  }
  async function run(task) {
    if (working || isBusy()) return;
    controls(true);
    const release = startActivity("secure-transfer");
    try { await task(); }
    catch (e) { status.textContent = e.name === "AbortError" ? "Bağlantı zaman aşımına uğradı. İnternetinizi kontrol edip tekrar deneyin." : e.message || "İşlem tamamlanamadı. Tekrar deneyin."; }
    finally { controls(false); release(); }
  }
  renderPair();
  qs("[data-transfer-pair]", host).onclick = () => run(async () => {
    if (!(await reauth("Güvenli geçmiş iş aktarımı için telefon eşleştirme"))) return;
    recipient = await ensureRecipient();
    renderPair();
    status.textContent = "Eşleştirme kodunu kopyalayıp bu sohbete gönderin. Mevcut iş kayıtlarınız paylaşılmaz.";
  });
  qs("[data-transfer-copy]", host).onclick = async () => {
    try { await navigator.clipboard.writeText(recipientCode(recipient)); toast("Eşleştirme kodu kopyalandı", "ok"); }
    catch { qs("[data-transfer-code]", host).select(); status.textContent = "Kod seçildi. Kopyala düğmesini kullanın veya kodu dosya olarak indirin."; }
  };
  qs("[data-transfer-export]", host).onclick = () => downloadBlob(new Blob([recipientCode(recipient)], { type: "text/plain" }), "SAHAPRO_telefon_eslestirme.txt");
  qs("[data-transfer-forget]", host).onclick = () => run(async () => {
    if (!(await reauth("Telefon aktarım eşleştirmesini kaldırma"))) return;
    if (!(await confirmDialog("Eşleştirme kaldırılsın mı?", "Bu tarayıcı için hazırlanmış eski aktarım dosyaları tekrar açılamaz. İş kayıtları silinmez. Yeniden aktarım için yeni eşleştirme kodu gerekir.", "Kaldır"))) return;
    await forgetRecipient(); recipient = null; renderPair(); clearPreview();
    status.textContent = "Eşleştirme kaldırıldı. İş kayıtlarınız korundu.";
  });
  async function receive(readBytes, reference = null) {
    recipient = await getRecipient();
    if (!recipient) throw Error("Önce bu telefonu eşleştirin ve kodu sohbete gönderin. Başka telefona hazırlanmış bağlantı burada açılamaz.");
    if (hasPreview()) {
      if (!(await confirmDialog("Açık önizleme değişsin mi?", "Kontrol ekranındaki kaydedilmemiş seçimler kapanacak. İş kayıtlarınız değişmez.", "Yeni Aktarımı Aç"))) return;
      clearPreview();
    }
    status.textContent = "Şifreli aktarım alınıyor ve telefon eşleşmesi kontrol ediliyor…";
    const decoded = await openTransfer(await readBytes(), recipient, reference || {});
    // A user can navigate away or forget the key from another tab while the fetch is running.
    const current = await getRecipient();
    if (!ctx.root.isConnected) return;
    if (current?.id !== recipient.id) throw Error("Telefon eşleştirmesi değişti. Yeni bağlantı isteyin.");
    const opened = await openPackage(decoded.pkg, "Güvenli bağlantı · " + decoded.id.slice(0, 8));
    if (opened) status.textContent = `${decoded.pkg.rows.length} satır açıldı. Henüz kayıt yapılmadı; aşağıdaki tarih, müşteri, fiyat ve hesap kontrollerini tamamlayın.`;
  }
  const openLink = () => run(async () => {
    const ref = deliveryReference(qs("[data-transfer-link]", host).value.trim(), base);
    await receive(() => fetchTransfer(base, ref), ref);
  });
  qs("[data-transfer-open]", host).onclick = openLink;
  qs("[data-transfer-file]", host).onchange = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    run(async () => {
      if (file.size > 3 * 1024 * 1024) throw Error("Şifreli aktarım dosyası en fazla 3 MB olabilir.");
      await receive(async () => new Uint8Array(await file.arrayBuffer()));
    });
  };
  if (ctx.query.aktarim || ctx.query.ozet) {
    qs("[data-transfer-link]", host).value = base + "#/gecmis?" + new URLSearchParams({ aktarim: ctx.query.aktarim || "", ozet: ctx.query.ozet || "" });
    await openLink();
  }
}

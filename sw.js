// Versioned atomic app shell. Existing cached assets are never mixed with a new release.
const CACHE = "sahapro-solo-v3-20261024-part-cost-67";
const CDN_CACHE = "sahapro-solo-cdn-v1";
const ASSETS = [
  "./js/dump-ledger-core.js",
  "./js/dump-ledger-db.js",
  "./js/ledger-policy.js",
  "./js/parts-core.js",
  "./js/parts-db.js",
  "./js/parts-ui.js",
  "./js/part-document-core.js",
  "./js/part-document-read.js",
  "./js/part-document-ui.js",
  "./js/assistant-turn.js",
  "./js/assistant-batch.js",
  "./js/bulk-entry-core.js",
  "./js/bulk-entry-db.js",
  "./js/bulk-entry-ui.js",
  "./js/assistant-conversation.js",
  "./js/assistant-customer.js",
  "./js/assistant-workflow.js",
  "./js/assistant-agent-core.js",
  "./js/assistant-task.js",
  "./js/customer-fuel.js",
  "./js/payment-agenda.js",
  "./js/payment-agenda-ui.js",
  "./js/operation-history.js",
  "./js/operation-history-ui.js",
  "./js/safe-form-save.js",
  "./js/entry-context.js",
  "./js/business-priorities.js",
  "./js/pending-records.js",
  "./js/customer-directory.js",
  "./js/driver-group-share.js",
  "./js/driver-pdf-transfer.js",
  "./js/driver-bundle.js",
  "./js/driver-transfer.js",
  "./js/driver-cash-context.js",
  "./js/driver-customer.js",
  "./js/work-repeat.js",
  "./js/driver-share-ui.js",
  "./js/field-stream.js", "./js/field-stream-ui.js",
  "./",
  "./index.html",
  "./sofor.html",
  "./js/sofor-main.js",
  "./styles.css",
  "./js/core.js",
  "./js/message-engine.js",
  "./js/message-smart-core.js", "./js/message-smart-db.js", "./js/message-smart-ui.js",
  "./js/solo-core.js", "./js/solo-db.js", "./js/solo-ui.js", "./vendor/qrcode.js",
  "./js/db.js",
  "./js/ui.js",
  "./js/parser.js",
  "./js/history-core.js",
  "./js/history-db.js",
  "./js/history-ui.js",
  "./js/secure-transfer.js",
  "./js/secure-transfer-db.js",
  "./js/secure-transfer-ui.js",
  "./data/history-template.json",
  "./js/pdf.js",
  "./js/ocr.js",
  "./js/m-dash.js",
  "./js/m-work.js",
  "./js/work-fuel-preview.js",
  "./js/record-refresh.js",
  "./js/work-explorer.js",
  "./js/m-finance.js",
  "./js/m-ops.js",
  "./js/m-crm.js",
  "./js/app.js", "./js/update-safety.js", "./js/storage-status.js", "./js/backup-archive.js",
  "./js/business.js",
  "./js/pro.js",
  "./js/document-engine.js",
  "./js/pdf-templates.js",
  "./js/backup.js",
  "./js/backup-crypt.js",
  "./js/enterprise.js", "./js/enterprise-core.js", "./js/enterprise-db.js",
  "./js/esnaf.js",
  "./js/today.js",
  "./js/finance-chart.js",
  "./js/statement.js",
  "./js/ai-assist.js",
  "./js/ai-local.js",
  "./js/ai-screen.js",
  "./js/ai-gemini.js",
  "./js/assistant-core.js",
  "./js/assistant-docs.js",
  "./js/assistant-rules.js",
  "./js/slip-read.js",
  "./js/fuel-rules.js",
  "./js/day-summary.js",
  "./js/assistant-tools.js",
  "./js/assistant.js",
  "./js/assistant-operations.js",
  "./js/pdf-history-core.js",
  "./js/pdf-history-ui.js",
  "./js/merge-core.js",
  "./js/merge.js",
  "./js/who-check.js",
  "./js/yard-core.js",
  "./js/yard.js",
  "./js/fuel-pay.js",
  "./js/fuel-audit.js",
  "./js/date-groups.js",
  "./js/assistant-fallback.js",
  "./js/command-router.js",
  "./js/attention.js",
  "./js/business-overview.js", "./js/business-overview-ui.js", "./js/assistant-guide.js",
  "./js/collect.js",
  "./js/unzip.js",
  "./js/wa-bulk-core.js",
  "./js/wa-bulk.js",
  "./js/payroll-core.js",
  "./js/payroll.js",
  "./js/maint-core.js",
  "./js/maint.js",
  "./js/receipt-detail.js",
  "./js/tank-match.js",
  "./js/leave-core.js",
  "./js/leave-ui.js",
  "./js/leave-form.js",
  "./js/security-core.js",
  "./js/security.js",
  "./js/integrity-core.js",
  "./js/vat-contract.js",
  "./js/money-roles.js",
  "./js/collection-key.js",
  "./js/price-decision.js",
  "./js/integrity-ui.js",
  "./js/invoice-import.js",
  "./js/invoice-import-ui.js",
  "./js/invoice-core.js",
  "./js/invoice-ui.js",
  "./js/price-health.js",
  "./js/price-health-ui.js",
  "./js/haul-ui.js",
  "./js/haul-core.js",
  "./js/job-core.js",
  "./js/job-ui.js",
  "./js/contract-read.js",
  "./js/price-pick.js",
  "./js/job-cost.js",
  "./js/job-dash.js",
  "./js/dump-account.js",
  "./js/dump-account-ui.js",
  "./js/cashflow-core.js",
  "./js/cashflow.js",
  "./js/day-close-core.js",
  "./js/image-shrink.js",
  "./js/report-core.js",
  "./js/report-ui.js",
  "./js/driver-core.js",
  "./js/driver.js", "./js/driver-delivery.js",
  "./js/quote-core.js",
  "./js/quote-calc.js",
  "./js/collect-core.js",
  "./js/price-rule-core.js",
  "./js/assistant-actions.js",
  "./js/costs-core.js",
  "./js/dump-fees.js",
  "./js/brief.js",
  "./js/expert-core.js",
  "./js/undo.js",
  "./js/customer-report.js",
  "./vendor/DejaVuSans.ttf",
  "./vendor/DejaVuSans-Bold.ttf",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];
// Dosyalar her zaman internetten TAZE indirilir (cache: "reload"): tarayıcının HTTP önbelleğindeki eski kopya
// yeni sürümün içine karışmasın (GitHub Pages dosyaları 10 dk önbellekte tutar).
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" }))))),
);
// New release waits for the user or until every old window is closed.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                k.startsWith("sahapro-solo-") && k !== CACHE && k !== CDN_CACHE,
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
// Android "Paylaş" → SAHAPRO: WhatsApp mesajı / fotoğraf Akıllı Asistan'a düşer
self.addEventListener("fetch", (event) => {
  const u = new URL(event.request.url);
  if (event.request.method !== "POST" || u.origin !== location.origin || !u.pathname.endsWith("/share-target")) return;
  event.respondWith(
    (async () => {
      try {
        const fd = await event.request.formData();
        // WhatsApp "Sohbeti dışa aktar" → SAHAPRO: sohbet dosyası (.txt / .zip) + medya → WhatsApp toplu işleme
        const all = fd.getAll("photos").filter((f) => f && f.size);
        const hasTransfer=all.some(f=>/\.sahapro(?:\s*\(\d+\))?\.(txt|zip|pdf)$/i.test(f.name||""));
        const chat = !hasTransfer && (all.find((f) => /\.zip$/i.test(f.name || "") || /zip/.test(f.type || "")) || all.find((f) => /\.txt$/i.test(f.name || "") || f.type === "text/plain"));
        if (chat) {
          await caches.delete("sahapro-wa");
          const wa = await caches.open("sahapro-wa");
          await wa.put("./__wa/source", new Response(chat, { headers: { "x-name": encodeURIComponent(chat.name || "sohbet.txt"), "content-type": chat.type || "application/octet-stream" } }));
          let j = 0;
          for (const f of all) if (f !== chat) await wa.put(`./__wa/media-${j++}`, new Response(f, { headers: { "x-name": encodeURIComponent(f.name || "medya"), "content-type": f.type || "application/octet-stream" } }));
          return Response.redirect("./index.html#/whatsapp-toplu?shared=1", 303);
        }
        const cache = await caches.open("sahapro-share");
        for (const k of await cache.keys()) await cache.delete(k);
        const text = [fd.get("title"), fd.get("text"), fd.get("url")].filter(Boolean).join("\n");
        await cache.put("./__share/text", new Response(text));
        let i = 0;
        if (all.length > 20) await cache.put("./__share/error", new Response("Paylaşımda " + all.length + " dosya var; en fazla 20 dosya alınabilir. İşleme durduruldu. Bu mesaja ait dosyaları yeniden seçin veya ekleri temizleyin."));
        for (const f of all.slice(0, 20))
          if (f && f.size) await cache.put(`./__share/file-${i++}`, new Response(f, { headers: { "content-type": f.type || "image/jpeg", "x-name": encodeURIComponent(f.name || "foto.jpg") } }));
      } catch (e) {}
      return Response.redirect("./index.html#/akilli-asistan?shared=1", 303);
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url),
    local = url.origin === location.origin,
    cdn = url.origin === "https://cdn.jsdelivr.net";
  if (!local && !cdn) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(cdn ? CDN_CACHE : CACHE),
        cached = await cache.match(event.request, { ignoreSearch: local });
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok && cdn) await cache.put(event.request, response.clone());
      return response;
    })(),
  );
});

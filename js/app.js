import * as solo from "./solo-ui.js";
import * as enterprise from "./enterprise.js";
import * as esnaf from "./esnaf.js";
import * as aiScreen from "./ai-screen.js";
import * as assistant from "./assistant.js";
import * as mergeScreen from "./merge.js";
import * as whoCheck from "./who-check.js";
import * as yardScreen from "./yard.js";
import * as fuelPayScreen from "./fuel-pay.js";
import * as collectScreen from "./collect.js";
import * as pro from "./pro.js";
// SAHAPRO SOLO — uygulama iskeleti: boot, router, alt navigasyon, PIN, SW güncelleme
import * as core from "./core.js";
import * as db from "./db.js";
import { qs, qsa, toast, go, back, sheet, sheetClose, esc } from "./ui.js";
import { screen as dashScreen } from "./m-dash.js";
import { screen as workScreen } from "./m-work.js";
import { screen as finScreen } from "./m-finance.js";
import { screen as opsScreen } from "./m-ops.js";
import { screen as crmScreen } from "./m-crm.js";

// ---- Modül yönlendirme tablosu ----
const MODULES = {
  sozlesmeler: pro.screen,
  dokum: pro.screen,
  ocak: pro.screen,
  tahsilat: finScreen,
  "": dashScreen,
  gunsonu: dashScreen,
  daha: dashScreen,
  raporlar: dashScreen,
  yonetici: dashScreen,
  isler: workScreen,
  fisler: workScreen,
  whatsapp: workScreen,
  gecmis: async(ctx) => (await import("./history-ui.js")).screen(ctx),
  finans: finScreen,
  teklif: finScreen,
  hakedis: finScreen,
  cari: finScreen,
  kasa: finScreen,
  gider: finScreen,
  fiyat: finScreen,
  yakit: opsScreen,
  depo: opsScreen,
  filo: opsScreen,
  bakim: opsScreen,
  personel: opsScreen,
  taseron: opsScreen,
  musteriler: crmScreen,
  santiyeler: crmScreen,
  belgeler: crmScreen,
  tara: crmScreen,
  ara: crmScreen,
  ayarlar: crmScreen,
  cop: crmScreen,
};
const SECTION = {
  "": "ana",
  gunsonu: "ana",
  isler: "isler",
  whatsapp: "isler",
  gecmis: "isler",
  fisler: "fisler",
  belgeler: "fisler",
  tara: "fisler",
  finans: "finans",
  teklif: "finans",
  hakedis: "finans",
  cari: "finans",
  kasa: "finans",
  gider: "finans",
  fiyat: "finans",
};
const NAV = [
  { sec: "ana", hash: "#/", ic: "⌂", t: "ANA SAYFA" },
  { sec: "isler", hash: "#/isler", ic: "⚒", t: "İŞLER" },
  { sec: "fisler", hash: "#/fisler", ic: "🧾", t: "FİŞLER" },
  { sec: "finans", hash: "#/finans", ic: "₺", t: "FİNANS" },
  { sec: "daha", hash: "#/daha", ic: "⋯", t: "DAHA FAZLA" },
];

// ---- İsim haritaları (her ekran render'ında taze) ----
export async function buildNames() {
  const [c, s, v, p] = await Promise.all([
    db.listActive("customers"),
    db.listActive("sites"),
    db.listActive("vehicles"),
    db.listActive("personnel"),
  ]);
  const m = { customers: {}, sites: {}, vehicles: {}, personnel: {} };
  for (const r of c) m.customers[r.id] = r.name;
  for (const r of s) m.sites[r.id] = r.name;
  for (const r of v) m.vehicles[r.id] = r.name;
  for (const r of p) m.personnel[r.id] = r.name;
  return m;
}

// ---- Router ----
function parseHash() {
  const raw = (location.hash || "#/").slice(1);
  const [path, qsStr] = raw.split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  if (
    parts[0] === "finans" &&
    [
      "kasa",
      "gider",
      "teklif",
      "fiyat",
      "hakedis",
      "cari",
      "sozlesmeler",
    ].includes(parts[1])
  )
    parts.shift();
  const query = Object.fromEntries(new URLSearchParams(qsStr || ""));
  return { parts, query };
}

export async function renderCurrent() {
  const { parts, query } = parseHash();
  const previousRoot = qs("#screen");
  const root = previousRoot.cloneNode(false);
  previousRoot.replaceWith(root);
  const mod = MODULES[parts[0] || ""] || dashScreen;
  const names = await buildNames();
  const ctx = {
    root,
    parts,
    query,
    names,
    go,
    back,
    toast,
    sheet,
    sheetClose,
    esc,
    db,
    core,
    reload: renderCurrent,
  };
  root.innerHTML =
    '<div style="padding:40px 0"><div class="skel" style="height:120px;margin-bottom:10px"></div><div class="skel" style="height:64px;margin-bottom:8px"></div><div class="skel" style="height:64px"></div></div>';
  try {
    const soloHandled = (await esnaf.screen(ctx)) || (await aiScreen.screen(ctx)) || (await assistant.screen(ctx)) || (await mergeScreen.screen(ctx)) || (await whoCheck.screen(ctx)) || (await yardScreen.screen(ctx)) || (await fuelPayScreen.screen(ctx)) || (await collectScreen.screen(ctx)) || (await solo.screen(ctx));
    const enterpriseHandled = soloHandled || await enterprise.screen(ctx);
    const handled = enterpriseHandled || (await pro.screen(ctx));
    if (!handled) await mod(ctx);
    if (!root.isConnected) return;
    if (!handled) await pro.augment(ctx);
    if (!enterpriseHandled) await enterprise.augment(ctx);
    await solo.augment(ctx);
    professionalIcons(root);
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="notice danger" style="margin-top:20px"><span>⛔</span><span>Ekran yüklenirken hata: ${esc(e.message || e)}</span></div><button class="btn block" data-go="#/">Ana Sayfaya Dön</button>`;
  }
  if (!root.isConnected) return;
  renderBrandShell(parts[0] || "");
  renderNav(parts[0] || "");
  professionalIcons(qs("#bottomnav"));
  window.scrollTo(0, 0);
}

const OFFICE_NAV = [
  ["", "Genel Bakış"], ["isler", "İş Hareketleri"], ["fisler", "Dijital Fişler"],
  ["musteriler", "Müşteriler"], ["santiyeler", "Şantiyeler"], ["filo", "Filo ve Bakım"],
  ["personel", "Personel"], ["yakit", "Yakıt"], ["depo", "Depo Tankı"],
  ["teklif", "Teklifler"], ["sozlesmeler", "Sözleşmeler"], ["hakedis", "Hakedişler"],
  ["cari", "Cari Hesaplar"], ["kasa", "Kasa"], ["belgeler", "Belge Merkezi"],
  ["raporlar", "Rapor Merkezi"], ["gunsonu", "Gün Sonu"], ["gecmis", "Geçmiş İş Aktarımı"],
  ["sayac", "Sayaç Okumaları"], ["vardiya", "Görev Planı"], ["zimmet", "Zimmetler"],
  ["mesajlar", "Mesaj Gelen Kutusu"], ["arsiv", "Arşiv / QR"], ["sonuc", "Sonuç Analizi"],
  ["banka-aktarim", "Banka Mutabakatı"], ["asistan", "Yerel Asistan"],
  ["ayarlar", "Ayarlar"],
];
function renderBrandShell(first) {
  let shell = document.getElementById("brand-shell");
  if (!shell) {
    shell = document.createElement("aside");
    shell.id = "brand-shell";
    shell.className = "brand-shell";
    document.body.prepend(shell);
  }
  shell.innerHTML = `<a class="brand-logo" href="#/" aria-label="SAHAPRO SOLO ana sayfa"><span class="brand-symbol">${iconSvgFor("#/filo")}</span><span>SAHA<b>PRO</b><small>SOLO · MURATOĞLU HAFRİYAT</small></span></a><nav class="office-nav" aria-label="Modüller">${OFFICE_NAV.map(([route,label]) => `<button data-go="#/${route}" class="${route === first ? "on" : ""}" ${route === first ? 'aria-current="page"' : ""}>${iconSvgFor("#/"+route)}<span>${label}</span></button>`).join("")}</nav><div class="brand-local">Cihazda kayıt · Tek kullanıcı<br><span>Yedeklerinizi dışarıda saklayın.</span></div>`;
}

function renderNav(first) {
  const nav = qs("#bottomnav");
  nav.hidden = false;
  // Her ekranda Akıllı Asistan: dokun → konuş → kartlar gelir
  let fab = qs("#ai-fab");
  if (!fab) {
    fab = document.createElement("div");
    fab.id = "ai-fab";
    fab.className = "ai-fab";
    fab.innerHTML = '<button data-go="#/akilli-asistan?mic=1" aria-label="Sesle asistana söyle">🎤</button><button data-go="#/akilli-asistan" aria-label="Akıllı asistan">🤖</button>';
    document.body.appendChild(fab);
  }
  // Form ekranlarında Kaydet düğmesini örtmesin
  fab.hidden = first === "akilli-asistan" || /\/(new|edit|duzenle)(\b|\?|$)/.test(location.hash);
  const cur = SECTION[first] || "daha";
  nav.innerHTML = NAV.map(
    (n) =>
      `<button aria-label="${n.t}" ${n.sec === cur ? 'aria-current="page"' : ""} class="${n.sec === cur ? "on" : ""}" data-go="${n.hash}"><span class="ic">${n.ic}</span>${n.t}</button>`,
  ).join("");
}

// ---- PIN kilidi (basit local UI lock — kriptografik güvenlik iddiası YOK) ----
function pinHash(pin) {
  let h = 5381;
  const s = "solo-" + pin;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return "h" + h.toString(36);
}
export { pinHash };
async function pinGate() {
  const stored = await db.metaGet("pin_hash");
  if (!stored) return true;
  if (sessionStorage.getItem("solo_unlocked") === "1") return true;
  return new Promise((resolve) => {
    const root = qs("#screen");
    qs("#bottomnav").hidden = true;
    if (qs("#ai-fab")) qs("#ai-fab").hidden = true;
    root.innerHTML = `
      <div style="padding:22vh 20px 0;text-align:center">
        <div style="font-size:44px;margin-bottom:6px">🔒</div>
        <div class="strong" style="font-size:18px;margin-bottom:2px">SAHAPRO SOLO</div>
        <div class="muted small" style="margin-bottom:20px">Devam etmek için PIN girin</div>
        <div class="field" style="max-width:220px;margin:0 auto 14px"><input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" data-pin style="text-align:center;font-size:24px;letter-spacing:6px"></div>
        <button class="btn primary" style="min-width:180px" data-unlock>Aç</button>
        <div class="tiny muted" style="margin-top:16px">Bu yalnızca basit bir cihaz içi ekran kilididir.</div>
      </div>`;
    const inp = qs("[data-pin]", root);
    setTimeout(() => inp.focus(), 300);
    const tryUnlock = () => {
      if (pinHash(inp.value.trim()) === stored) {
        sessionStorage.setItem("solo_unlocked", "1");
        resolve(true);
      } else {
        toast("PIN hatalı", "err");
        inp.value = "";
        inp.focus();
      }
    };
    qs("[data-unlock]", root).addEventListener("click", tryUnlock);
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryUnlock();
    });
  });
}

// ---- Service Worker + güncelleme bildirimi ----
function showUpdateBar(reg) {
  if (document.getElementById("update-bar")) return;
  const bar = document.createElement("div");
  bar.id = "update-bar";
  bar.style.cssText =
    "position:fixed;left:12px;right:12px;bottom:76px;z-index:9999;background:#1d4ed8;color:#fff;border-radius:12px;padding:12px 14px;display:flex;gap:10px;align-items:center;box-shadow:0 6px 20px rgba(0,0,0,.35)";
  bar.innerHTML =
    '<span style="flex:1;font-size:14px">Yeni sürüm hazır</span><button data-upd style="background:#fff;color:#1d4ed8;border:0;border-radius:8px;padding:8px 14px;font-weight:700">Güncelle</button><button data-x style="background:transparent;color:#fff;border:0;font-size:18px" aria-label="Kapat">✕</button>';
  document.body.appendChild(bar);
  bar.querySelector("[data-x]").onclick = () => bar.remove();
  bar.querySelector("[data-upd]").onclick = () => {
    const w = reg.waiting;
    if (w) w.postMessage({ type: "SKIP_WAITING" });
    else location.reload();
  };
}
async function requestPersist() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted()))
      await navigator.storage.persist();
  } catch (e) {
    /* desteklenmiyor */
  }
}
async function registerSW() {
  requestPersist();
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register("./sw.js");
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateBar(reg);
    reg.addEventListener("updatefound", () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener("statechange", () => {
        if (sw.state === "installed" && navigator.serviceWorker.controller) {
          showUpdateBar(reg);
        }
      });
    });
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      const editing = () => (location.hash || "").includes("/new") || (location.hash || "").startsWith("#/gecmis");
      const notify = () => toast("Yeni sürüm yüklendi — formu tamamlayıp yenileyin", "ok");
      if (editing()) notify();
      else setTimeout(() => {
        // A file/preview form may have been opened while the reload was pending.
        if (editing()) notify();
        else location.reload();
      }, 600);
    });
  } catch (e) {
    console.warn("SW", e);
  }
}

// ---- Çevrimdışı göstergesi ----
function bindOnline() {
  const upd = () => {
    document.body.dataset.online = navigator.onLine ? "1" : "0";
  };
  window.addEventListener("online", () => {
    upd();
    toast("Çevrimiçi", "ok");
  });
  window.addEventListener("offline", () => {
    upd();
    toast("Çevrimdışı — kayıtlar cihazda tutulur", "err");
  });
  upd();
}

// ---- Global tıklama delegasyonu ----
document.addEventListener("click", (ev) => {
  const g = ev.target.closest("[data-go]");
  if (g) {
    const control = ev.target.closest("button,input,select,textarea,a");
    if (control && control !== g) return;
    go(g.dataset.go);
    return;
  }
  const b = ev.target.closest('[data-act="back"]');
  if (b) {
    back();
    return;
  }
});

// ---- Boot ----
(async function boot() {
  try {
    await db.openDB();
    await db.ensureSeeded();
    registerSW();
    bindOnline();
    if (!(await pinGate())) return;
    try { await (await import("./dump-fees.js")).seedOfficialDumps(db); } catch (e) { console.warn(e); }
    window.addEventListener("hashchange", renderCurrent);
    await renderCurrent();
  } catch (e) {
    console.error(e);
    qs("#screen").innerHTML =
      `<div class="notice danger" style="margin-top:30px"><span>⛔</span><span>Uygulama başlatılamadı: ${esc(e.message || e)}. Sayfayı yenileyin; verileriniz cihazda güvendedir.</span></div>`;
  }
})();

const ICON_PATHS = {
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M9 15v6",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6",
  home: "M3 11 12 3l9 8M5 9v12h14V9M9 21v-7h6v7",
  work: "M5 4h14v16H5zM8 8h8M8 12h5M8 16h7",
  document: "M5 3h10l4 4v14H5zM15 3v5h4M8 12h8M8 16h6",
  finance: "M3 8 12 3l9 5M4 9h16M6 10v8M10 10v8M14 10v8M18 10v8M3 21h18",
  more: "M4 4h5v5H4zM15 4h5v5h-5zM4 15h5v5H4zM15 15h5v5h-5z",
  vehicle: "M3 6h11v11H3zM14 10h4l3 4v3h-7M6 17v3M18 17v3M5 20h3M17 20h3",
  fuel: "M4 3h9v18H4zM6 6h5v4H6zM13 12h3v5a2 2 0 0 0 4 0V8l-3-3",
  people:
    "M8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M2 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 1 1 0 6M17 14a5 5 0 0 1 5 5v2",
  chart: "M3 3v18h18M7 17V9M12 17V5M17 17v-7",
};
function iconSvgFor(href = "") {
  const route = href.split("/")[1]?.split("?")[0] || "";
  const key =
    route === "ayarlar"
      ? "settings"
      : route === "ara" ? "search" : route === ""
      ? "home"
      : route === "daha"
        ? "more"
        : ["finans", "kasa", "hakedis", "cari", "fiyat", "gider"].includes(
              route,
            )
          ? "finance"
          : ["filo", "bakim"].includes(route)
            ? "vehicle"
            : ["yakit", "depo"].includes(route)
              ? "fuel"
              : ["personel", "musteriler", "taseron"].includes(route)
                ? "people"
                : ["raporlar", "yonetici"].includes(route)
                  ? "chart"
                  : route === "isler"
                    ? "work"
                    : "document";
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[key]}"/></svg>`;
}
function professionalIcons(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    if (n.parentElement?.closest("script,style,input,textarea,select,canvas"))
      continue;
    const clean = n.textContent
      .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
      .trim();
    if (clean !== n.textContent.trim()) {
      const parent = n.parentElement;
      n.textContent = clean;
      if (parent.classList.contains("ic") || parent.classList.contains("li-ic"))
        parent.innerHTML = iconSvgFor(
          parent.closest("[data-go]")?.dataset.go || "",
        );
    }
  }
  for (const el of root.querySelectorAll(".iconbtn[data-go]"))
    if (!el.querySelector("svg")) el.innerHTML = iconSvgFor(el.dataset.go);
  for (const el of root.querySelectorAll(".ic"))
    if (!el.querySelector("svg"))
      el.innerHTML = iconSvgFor(el.closest("[data-go]")?.dataset.go || "");
}
window.addEventListener("unhandledrejection", (e) => {
  console.error(e.reason);
  toast(e.reason?.message || "İşlem tamamlanamadı", "err");
});

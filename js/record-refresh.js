// Bildirim yalnız commit sonrasında: aynı origin/DB'deki açık görünümleri güncel tutar.
// Kanalda müşteri adı, kayıt içeriği, belge veya sır paylaşılmaz.
import { updateRisk } from "./update-safety.js";
const eventName = "sp-records-committed";
const relevant = new Set([
  "customers",
  "cash_records",
  "cari_movements",
  "hakedis",
  "bank_movements",
  "work_records",
  "slips",
  "fuel_records",
  "pending_fuel_records",
  "fuel_tank_movements",
]);
let channel;
function ensureChannel() {
  if (typeof window === "undefined" || channel !== undefined) return;
  channel = null;
  try {
    if (typeof BroadcastChannel === "function") {
      channel = new BroadcastChannel("sahapro-record-refresh-v1");
      channel.onmessage = (e) => {
        const v = e.data;
        if (v && typeof v.database === "string" && Array.isArray(v.stores))
          window.dispatchEvent(new CustomEvent(eventName, { detail: v }));
      };
    }
  } catch {
    /* Eski tarayıcıda aynı sayfadaki bildirim çalışmaya devam eder. */
  }
}
export function recordsCommitted(database, stores) {
  if (typeof window === "undefined") return;
  const selected = [...new Set(stores)].filter((s) => relevant.has(s));
  if (!selected.length) return;
  ensureChannel();
  const detail = { database, stores: selected };
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
  try {
    channel?.postMessage(detail);
  } catch {
    /* Bildirim hatası tamamlanmış kaydı başarısız göstermez. */
  }
}
export function watchRecords(fn) {
  ensureChannel();
  const listener = (e) => fn(e.detail);
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
}
export function fuelReadView(parts) {
  return (
    (!parts[0]) ||
    (['isler','yakit','bakim','fisler'].includes(parts[0]) && !parts[1]) ||
    (parts[0] === "musteriler" &&
      !parts.includes("new") &&
      !parts.includes("edit")) ||
    (parts[0] === "mazot-hesaplari" && !parts[1])
  );
}
export async function installRecordRefresh({ db, context, reload }) {
  const database = (await db.openDB()).name;
  let pending = false,
    timer,
    refreshing = false;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(run, 80);
  };
  const run = async () => {
    if (!pending || refreshing || document.visibilityState === "hidden") return;
    const { root, parts } = context();
    if (!fuelReadView(parts)) {
      pending = false;
      return;
    }
    if (!root?.isConnected || root.dataset.viewReady !== "1") {
      schedule();
      return;
    }
    // Arama/filtre bir finansal taslak değildir; açık form, modal ve değiştirilmiş referans ise korunur.
    const ref = root.querySelector("[data-ref]");
    if (
      root.querySelector("form") ||
      (root.contains(document.activeElement) &&
        document.activeElement.matches("input,select,textarea")) ||
      document.querySelector("#sheet-root .sheet") ||
      (ref && ref.value !== ref.defaultValue) ||
      updateRisk(root).busy
    )
      return;
    pending = false;
    refreshing = true;
    const hash = location.hash,
      scroll = window.scrollY;
    const selected = {
      dper: root.querySelector("[data-dper].on")?.dataset.dper,
      per: root.querySelector("[data-custworks] [data-per].on")?.dataset.per,
      dsubs: !!root.querySelector("[data-dsubs].on"),
      subs: !!root.querySelector("[data-custworks] [data-subs].on"),
    };
    try {
      await reload();
      if (location.hash === hash) {
        const current = context().root;
        for (const [key, value] of Object.entries(selected)) {
          if (!value) continue;
          const selector =
            typeof value === "boolean"
              ? "[data-" + key + "]"
              : "[data-" + key + '="' + value + '"]';
          const button = current.querySelector(selector);
          if (button && !button.classList.contains("on")) button.click();
        }
        window.scrollTo(0, scroll);
      }
    } catch (error) {
      console.warn("Kayıt görünümü yenilenemedi", error.message);
    } finally {
      refreshing = false;
      if (pending) schedule();
    }
  };
  const unwatch = watchRecords((message) => {
    if (
      message.database !== database ||
      !message.stores.some((s) => relevant.has(s))
    )
      return;
    pending = true;
    schedule();
  });
  const visible = () => {
    if (pending) schedule();
  };
  window.addEventListener("focus", visible);
  document.addEventListener("visibilitychange", visible);
  document.addEventListener("focusout", visible);
  return () => {
    clearTimeout(timer);
    unwatch();
    window.removeEventListener("focus", visible);
    document.removeEventListener("visibilitychange", visible);
    document.removeEventListener("focusout", visible);
  };
}

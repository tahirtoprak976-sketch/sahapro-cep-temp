// SAHAPRO SOLO — uygulama iskeleti: boot, router, alt navigasyon, PIN, SW güncelleme
import * as core from './core.js';
import * as db from './db.js';
import { qs, qsa, toast, go, back, sheet, sheetClose, esc } from './ui.js';
import { screen as dashScreen } from './m-dash.js';
import { screen as workScreen } from './m-work.js';
import { screen as finScreen } from './m-finance.js';
import { screen as opsScreen } from './m-ops.js';
import { screen as crmScreen } from './m-crm.js';

// ---- Modül yönlendirme tablosu ----
const MODULES = {
  '': dashScreen, 'gunsonu': dashScreen, 'daha': dashScreen, 'raporlar': dashScreen, 'yonetici': dashScreen,
  'isler': workScreen, 'fisler': workScreen, 'whatsapp': workScreen,
  'finans': finScreen, 'teklif': finScreen, 'hakedis': finScreen, 'cari': finScreen, 'kasa': finScreen, 'gider': finScreen, 'fiyat': finScreen,
  'yakit': opsScreen, 'depo': opsScreen, 'filo': opsScreen, 'bakim': opsScreen, 'personel': opsScreen, 'taseron': opsScreen,
  'musteriler': crmScreen, 'santiyeler': crmScreen, 'belgeler': crmScreen, 'tara': crmScreen, 'ara': crmScreen, 'ayarlar': crmScreen, 'cop': crmScreen
};
const SECTION = {
  '': 'ana', 'gunsonu': 'ana',
  'isler': 'isler', 'whatsapp': 'isler',
  'fisler': 'fisler', 'belgeler': 'fisler', 'tara': 'fisler',
  'finans': 'finans', 'teklif': 'finans', 'hakedis': 'finans', 'cari': 'finans', 'kasa': 'finans', 'gider': 'finans', 'fiyat': 'finans'
};
const NAV = [
  { sec: 'ana', hash: '#/', ic: '⌂', t: 'ANA SAYFA' },
  { sec: 'isler', hash: '#/isler', ic: '⚒', t: 'İŞLER' },
  { sec: 'fisler', hash: '#/fisler', ic: '🧾', t: 'FİŞLER' },
  { sec: 'finans', hash: '#/finans', ic: '₺', t: 'FİNANS' },
  { sec: 'daha', hash: '#/daha', ic: '⋯', t: 'DAHA FAZLA' }
];

// ---- İsim haritaları (her ekran render'ında taze) ----
export async function buildNames() {
  const [c, s, v, p] = await Promise.all([db.listActive('customers'), db.listActive('sites'), db.listActive('vehicles'), db.listActive('personnel')]);
  const m = { customers: {}, sites: {}, vehicles: {}, personnel: {} };
  for (const r of c) m.customers[r.id] = r.name;
  for (const r of s) m.sites[r.id] = r.name;
  for (const r of v) m.vehicles[r.id] = r.name;
  for (const r of p) m.personnel[r.id] = r.name;
  return m;
}

// ---- Router ----
function parseHash() {
  const raw = (location.hash || '#/').slice(1);
  const [path, qsStr] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const query = Object.fromEntries(new URLSearchParams(qsStr || ''));
  return { parts, query };
}

export async function renderCurrent() {
  const { parts, query } = parseHash();
  const root = qs('#screen');
  const mod = MODULES[parts[0] || ''] || dashScreen;
  const names = await buildNames();
  const ctx = {
    root, parts, query, names,
    go, back, toast, sheet, sheetClose, esc,
    db, core,
    reload: renderCurrent
  };
  root.innerHTML = '<div style="padding:40px 0"><div class="skel" style="height:120px;margin-bottom:10px"></div><div class="skel" style="height:64px;margin-bottom:8px"></div><div class="skel" style="height:64px"></div></div>';
  try {
    await mod(ctx);
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="notice danger" style="margin-top:20px"><span>⛔</span><span>Ekran yüklenirken hata: ${esc(e.message || e)}</span></div><button class="btn block" data-go="#/">Ana Sayfaya Dön</button>`;
  }
  renderNav(parts[0] || '');
  window.scrollTo(0, 0);
}

function renderNav(first) {
  const nav = qs('#bottomnav');
  nav.hidden = false;
  const cur = SECTION[first] || 'daha';
  nav.innerHTML = NAV.map(n => `<button class="${n.sec === cur ? 'on' : ''}" data-go="${n.hash}"><span class="ic">${n.ic}</span>${n.t}</button>`).join('');
}

// ---- PIN kilidi (basit local UI lock — kriptografik güvenlik iddiası YOK) ----
function pinHash(pin) {
  let h = 5381;
  const s = 'solo-' + pin;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return 'h' + h.toString(36);
}
export { pinHash };
async function pinGate() {
  const stored = await db.metaGet('pin_hash');
  if (!stored) return true;
  if (sessionStorage.getItem('solo_unlocked') === '1') return true;
  return new Promise((resolve) => {
    const root = qs('#screen');
    qs('#bottomnav').hidden = true;
    root.innerHTML = `
      <div style="padding:22vh 20px 0;text-align:center">
        <div style="font-size:44px;margin-bottom:6px">🔒</div>
        <div class="strong" style="font-size:18px;margin-bottom:2px">SAHAPRO SOLO</div>
        <div class="muted small" style="margin-bottom:20px">Devam etmek için PIN girin</div>
        <div class="field" style="max-width:220px;margin:0 auto 14px"><input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" data-pin style="text-align:center;font-size:24px;letter-spacing:6px"></div>
        <button class="btn primary" style="min-width:180px" data-unlock>Aç</button>
        <div class="tiny muted" style="margin-top:16px">Bu yalnızca basit bir cihaz içi ekran kilididir.</div>
      </div>`;
    const inp = qs('[data-pin]', root);
    setTimeout(() => inp.focus(), 300);
    const tryUnlock = () => {
      if (pinHash(inp.value.trim()) === stored) { sessionStorage.setItem('solo_unlocked', '1'); resolve(true); }
      else { toast('PIN hatalı', 'err'); inp.value = ''; inp.focus(); }
    };
    qs('[data-unlock]', root).addEventListener('click', tryUnlock);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
  });
}

// ---- Service Worker + güncelleme bildirimi ----
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Yeni sürüm hazır — uygulama yenileniyor…', 'ok');
        }
      });
    });
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      if ((location.hash || '').includes('/new')) {
        toast('Yeni sürüm yüklendi — formu kaydedip yenileyin', 'ok');
      } else {
        setTimeout(() => location.reload(), 600);
      }
    });
  } catch (e) { console.warn('SW', e); }
}

// ---- Çevrimdışı göstergesi ----
function bindOnline() {
  const upd = () => { document.body.dataset.online = navigator.onLine ? '1' : '0'; };
  window.addEventListener('online', () => { upd(); toast('Çevrimiçi', 'ok'); });
  window.addEventListener('offline', () => { upd(); toast('Çevrimdışı — kayıtlar cihazda tutulur', 'err'); });
  upd();
}

// ---- Global tıklama delegasyonu ----
document.addEventListener('click', (ev) => {
  const g = ev.target.closest('[data-go]');
  if (g) { go(g.dataset.go); return; }
  const b = ev.target.closest('[data-act="back"]');
  if (b) { back(); return; }
});

// ---- Boot ----
(async function boot() {
  try {
    await db.openDB();
    await db.ensureSeeded();
    registerSW();
    bindOnline();
    if (!(await pinGate())) return;
    window.addEventListener('hashchange', renderCurrent);
    await renderCurrent();
  } catch (e) {
    console.error(e);
    qs('#screen').innerHTML = `<div class="notice danger" style="margin-top:30px"><span>⛔</span><span>Uygulama başlatılamadı: ${esc(e.message || e)}. Sayfayı yenileyin; verileriniz cihazda güvendedir.</span></div>`;
  }
})();

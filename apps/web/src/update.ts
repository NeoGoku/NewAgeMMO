import { useSyncExternalStore } from 'react';
import { state } from './store';
import { net } from './net';

/**
 * Automatisches Web-Update: vergleicht die eingebettete Build-ID mit der veröffentlichten `version.json`
 * (immer vom Netz, ohne HTTP-/Service-Worker-Cache), stellt die neue Version bereit und lädt – sobald kein kritischer
 * Vorgang läuft – genau einmal neu. Spielstände liegen in IndexedDB/localStorage/Server und bleiben unberührt.
 */
export const BUILD = typeof __NAM_BUILD__ === 'undefined' ? { buildId: 'dev', commit: '', release: '', builtAt: '' } : __NAM_BUILD__;
export type UpdateStatus = 'idle' | 'checking' | 'current' | 'preparing' | 'pending' | 'reloading' | 'offline' | 'error';
export interface UpdateView { status: UpdateStatus; lastCheck: number | null; remote: string | null; message: string }

const CHECK_MS = 5 * 60_000, MIN_GAP_MS = 20_000, MAX_RELOADS = 3;
const GUARD = 'nam.update.guard';
let view: UpdateView = { status: 'idle', lastCheck: null, remote: null, message: '' };
const subs = new Set<() => void>();
const set = (patch: Partial<UpdateView>) => { view = { ...view, ...patch }; subs.forEach(f => f()); };
export const useUpdate = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => view);

let running = false, retryTimer: number | undefined, safeTimer: number | undefined, started = false;
const url = (file: string) => new URL(file, document.baseURI).href;

/** Kampf, Szene, Handel, Reise, Tod oder Dialog: Neuladen wird vorgemerkt. */
export const critical = () => !['title', 'chars', 'bye'].includes(state.screen) ||
  state.conn === 'connecting' || net.pend.size > 0;

async function remoteBuild(): Promise<string> {
  const response = await fetch(url('version.json') + '?t=' + Date.now(), { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error('version ' + response.status);
  const data = await response.json();
  if (!data || typeof data.buildId !== 'string' || !data.buildId) throw new Error('version ungültig');
  return data.buildId;
}

/** Prüft, dass die neue Startseite und ihre Hauptdatei erreichbar sind (CDN-Verzögerung / fehlende Chunks). */
async function remoteComplete(expected: string): Promise<boolean> {
  const page = await fetch(url('./') + '?t=' + Date.now(), { cache: 'no-store' });
  if (!page.ok) return false;
  const html = new DOMParser().parseFromString(await page.text(), 'text/html');
  if (html.querySelector('meta[name="nam-build"]')?.getAttribute('content') !== expected) return false;
  const entries = Array.from(html.querySelectorAll('script[type="module"][src], link[rel="stylesheet"][href]'), node =>
    node.getAttribute('src') ?? node.getAttribute('href') ?? '');
  if (!entries.length) return false;
  const checks = await Promise.all(entries.slice(0, 4).map(async file => (await fetch(new URL(file, page.url).href, { cache: 'no-store', method: 'HEAD' })).ok));
  return checks.every(Boolean);
}

async function ensureWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (registration) await registration.update().catch(() => undefined);
}

async function activateWorker() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.waiting) return;
  await new Promise<void>(resolve => {
    const changed = () => { window.clearTimeout(timer); resolve(); };
    const timer = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', changed);
      resolve();
    }, 1500);
    navigator.serviceWorker.addEventListener('controllerchange', changed, { once: true });
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  });
}

function guardState(): { id: string; n: number; at: number } | null {
  try { return JSON.parse(sessionStorage.getItem(GUARD) || 'null'); } catch { return null; }
}

async function install(remote: string) {
  const guard = guardState();
  const attempts = guard?.id === remote && Date.now() - guard.at < 30 * 60_000 ? guard.n : 0;
  if (attempts >= MAX_RELOADS) {
    set({ status: 'error', message: 'Update ist veröffentlicht, wurde aber nicht geladen. Bitte Seite manuell neu laden (Tab/App schließen und neu öffnen).' });
    return;
  }
  if (critical()) {
    set({ status: 'pending', message: 'Neue Version bereit. Sie wird in der Charakterauswahl oder am Titelbildschirm geladen.' });
    window.clearInterval(safeTimer);
    safeTimer = window.setInterval(() => {
      if (critical() || running) return;
      window.clearInterval(safeTimer);
      void checkNow();
    }, 2000);
    return;
  }
  const wait = attempts ? 5000 * 2 ** attempts : 0;
  set({ status: 'reloading', message: wait ? `Neue Version wird geladen (Versuch ${attempts + 1}) …` : 'Neue Version wird geladen …' });
  if (wait) await new Promise(r => setTimeout(r, wait));
  if (critical()) return install(remote);
  await net.closeSolo();
  if (critical()) return install(remote);
  await activateWorker();
  if (critical()) return install(remote);
  try { sessionStorage.setItem(GUARD, JSON.stringify({ id: remote, n: attempts + 1, at: Date.now() })); } catch { /* Session-Speicher ist im privaten Modus optional. */ }
  location.reload();
}

export async function checkNow(manual = false): Promise<void> {
  if (running || BUILD.buildId === 'dev') return;
  running = true;
  window.clearTimeout(retryTimer);
  set({ status: 'checking', message: '' });
  try {
    if (navigator.onLine === false) throw Object.assign(new Error('offline'), { offline: true });
    const remote = await remoteBuild();
    set({ lastCheck: Date.now(), remote });
    if (remote === BUILD.buildId) {
      window.clearInterval(safeTimer);
      try { sessionStorage.removeItem(GUARD); } catch { /* egal */ }
      set({ status: 'current', message: 'Du spielst die aktuelle Version.' });
      return;
    }
    set({ status: 'preparing', message: 'Neue Version gefunden – wird bereitgestellt …' });
    await ensureWorker();
    if (!(await remoteComplete(remote))) throw new Error('unvollständig');
    await install(remote);
  } catch (error) {
    const offline = (error as { offline?: boolean }).offline || navigator.onLine === false;
    set(offline
      ? { status: 'offline', message: 'Offline – die Version wird geprüft, sobald wieder eine Verbindung besteht.' }
      : { status: view.status === 'preparing' ? 'preparing' : 'error', message: view.status === 'preparing' ? 'Neue Version wird noch bereitgestellt – neuer Versuch folgt.' : 'Versionsprüfung fehlgeschlagen' + (manual ? ' – bitte später erneut versuchen.' : '.') });
    if (!offline) retryTimer = window.setTimeout(() => { void checkNow(); }, view.status === 'preparing' ? 45_000 : CHECK_MS);
  } finally { running = false; }
}

/** Registrierung des Service Workers und Prüfzeitpunkte: Start, Vordergrund, pageshow (BFCache), online, Intervall. */
export function startUpdates() {
  if (started || typeof window === 'undefined') return;
  started = true;
  if ('serviceWorker' in navigator && BUILD.buildId !== 'dev') {
    navigator.serviceWorker.register(url('sw.js'), { updateViaCache: 'none' }).then(async registration => {
      // Startseite für Offline-Start vormerken (network-first-Cache des Workers)
      try { await navigator.serviceWorker.ready; const page = await fetch(location.pathname, { cache: 'no-store' }); if (page.ok) await (await caches.open('nam-pages')).put(location.pathname, page); } catch { /* optional */ }
      void registration.update().catch(() => undefined);
    }).catch(() => { /* Das Spiel funktioniert auch ohne Service Worker. */ });
  }
  let last = 0;
  const maybe = (force = false) => {
    if (document.visibilityState !== 'visible') return;
    if (!force && Date.now() - last < MIN_GAP_MS) return;
    last = Date.now();
    void checkNow();
  };
  maybe(true);
  document.addEventListener('visibilitychange', () => maybe());
  window.addEventListener('pageshow', event => maybe((event as PageTransitionEvent).persisted));
  window.addEventListener('online', () => maybe(true));
  window.addEventListener('offline', () => set({ status: 'offline', message: 'Offline – die Version wird geprüft, sobald wieder eine Verbindung besteht.' }));
  window.setInterval(() => maybe(), CHECK_MS);
  // Fehlende Chunks nach einem Deployment: einmal prüfen, dann ggf. kontrolliert neu laden
  window.addEventListener('vite:preloadError', event => { event.preventDefault(); last = 0; maybe(true); });
}

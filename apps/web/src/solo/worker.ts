import { createCore, type SockLike } from '../../../server/src/core'; import { IdbStore } from './idbstore';
// Der komplette Spielserver läuft im Web Worker (Solo-Modus). Eine Verbindung pro Worker.
let core: Awaited<ReturnType<typeof createCore>> | null = null; let msgFn: ((d: any) => void) | null = null; let closeFn: (() => void) | null = null;
const sock: SockLike = { readyState: 1, send: d => (self as any).postMessage({ t: 'm', d }), close: () => { (self as any).postMessage({ t: 'c' }); }, on(ev, fn) { if (ev === 'message') msgFn = fn; else closeFn = fn; } };
(self as any).onmessage = async (e: MessageEvent) => { const m = e.data; if (m.t === 'open') { try { core = await createCore(new IdbStore()); core.onConnection(sock, 'solo'); (self as any).postMessage({ t: 'ready' }); } catch (err: any) { (self as any).postMessage({ t: 'fail', err: String(err?.message || err) }); } } else if (m.t === 'm') msgFn?.(m.d); else if (m.t === 'c') { closeFn?.(); await core?.shutdown(); } };

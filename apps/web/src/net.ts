import type { Msg } from '@nam/shared';
type Fn = (m: Msg) => void;
export function defaultServer(): string {
  try { const s = localStorage.getItem('nam.server'); if (s) return s; } catch { /* kein Storage */ }
  const cap = !!(window as any).Capacitor; if (!cap && location.protocol.startsWith('http') && location.port !== '5173') return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  return 'ws://localhost:8080';
}
class Net {
  ws: WebSocket | null = null; rid = 0; pend = new Map<number, (m: Msg) => void>(); fns = new Set<Fn>(); onClose: (() => void) | null = null; url = '';
  connect(url: string): Promise<void> {
    this.close(); this.url = url;
    return new Promise((res, rej) => {
      let ws: WebSocket; try { ws = new WebSocket(url); } catch (e) { return rej(new Error('Ungültige Serveradresse')); } this.ws = ws; this.rid = 0; const to = setTimeout(() => { rej(new Error('Zeitüberschreitung – Server nicht erreichbar')); ws.close(); }, 8000);
      ws.onopen = () => { clearTimeout(to); res(); }; ws.onerror = () => { clearTimeout(to); rej(new Error('Server nicht erreichbar')); };
      ws.onmessage = e => { let m: Msg; try { m = JSON.parse(e.data); } catch { return; } if (m.rid && this.pend.has(m.rid)) { this.pend.get(m.rid)!(m); this.pend.delete(m.rid); } this.fns.forEach(f => f(m)); };
      ws.onclose = () => { for (const [, f] of this.pend) f({ t: 'err', err: 'Verbindung getrennt' }); this.pend.clear(); if (this.ws === ws) { this.ws = null; this.onClose?.(); } };
    });
  }
  get open() { return !!this.ws && this.ws.readyState === 1; }
  close() { const w = this.ws; this.ws = null; if (w) { w.onclose = null; w.close(); } }
  send(t: string, o: Record<string, any> = {}) { if (this.open) this.ws!.send(JSON.stringify({ t, rid: ++this.rid, ...o })); }
  req(t: string, o: Record<string, any> = {}): Promise<Msg> { return new Promise(res => { if (!this.open) return res({ t: 'err', err: 'Nicht verbunden' }); const rid = ++this.rid; this.pend.set(rid, res); this.ws!.send(JSON.stringify({ t, rid, ...o })); setTimeout(() => { if (this.pend.delete(rid)) res({ t: 'err', err: 'Zeitüberschreitung' }); }, 10000); }); }
  on(f: Fn) { this.fns.add(f); return () => { this.fns.delete(f); }; }
}
export const net = new Net();

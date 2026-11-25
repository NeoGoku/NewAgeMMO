/** WebSocket-kompatible Hülle um den Solo-Worker (lokaler Spielserver im Browser). */
export class SoloSocket {
  readyState = 0; onopen: (() => void) | null = null; onmessage: ((e: { data: string }) => void) | null = null; onclose: (() => void) | null = null; onerror: ((error?: Error) => void) | null = null; w: Worker; private closeTimer?: ReturnType<typeof setTimeout>;
  constructor() {
    this.w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.w.onmessage = e => { const m = e.data; if (m.t === 'closed') { clearTimeout(this.closeTimer); this.w.terminate(); } else if (this.readyState === 3) return; else if (m.t === 'ready') { this.readyState = 1; this.onopen?.(); } else if (m.t === 'm') this.onmessage?.({ data: m.d }); else if (m.t === 'fail') { this.onerror?.(new Error(m.err)); this.close(); } else if (m.t === 'c') this.close(); };
    this.w.onerror = () => this.onerror?.(); this.w.postMessage({ t: 'open' });
  }
  send(d: string) { this.w.postMessage({ t: 'm', d }); }
  close() { if (this.readyState === 3) return; this.readyState = 3; this.w.postMessage({ t: 'c' }); this.closeTimer = setTimeout(() => this.w.terminate(), 8000); this.onclose?.(); }
}

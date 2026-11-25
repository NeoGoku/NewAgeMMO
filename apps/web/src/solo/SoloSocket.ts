/** WebSocket-kompatible Hülle um den Solo-Worker (lokaler Spielserver im Browser). */
export class SoloSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error?: Error) => void) | null = null;
  private w: Worker;
  private closeTimer?: ReturnType<typeof setTimeout>;
  private finish!: (error?: Error) => void;
  readonly closed: Promise<Error | undefined>;

  constructor() {
    this.w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.closed = new Promise(resolve => {
      let closeError: Error | undefined;
      this.finish = error => {
        clearTimeout(this.closeTimer);
        this.w.terminate();
        resolve(error);
      };
      this.w.onmessage = ({ data: m }) => {
        if (m.t === 'closed') this.finish(closeError);
        else if (m.t === 'fail') {
          const error = new Error(m.err);
          if (this.readyState === 3) closeError = error;
          else { this.onerror?.(error); this.close(); }
        } else if (this.readyState === 3) return;
        else if (m.t === 'ready') { this.readyState = 1; this.onopen?.(); }
        else if (m.t === 'm') this.onmessage?.({ data: m.d });
        else if (m.t === 'c') this.close();
      };
      this.w.onerror = () => {
        if (this.readyState !== 3) { this.onerror?.(); this.close(); }
      };
    });
    this.w.postMessage({ t: 'open' });
  }

  send(d: string) { this.w.postMessage({ t: 'm', d }); }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.w.postMessage({ t: 'c' });
    this.closeTimer = setTimeout(() => this.finish(new Error('Der Solo-Spielstand konnte nicht rechtzeitig geschlossen werden.')), 8000);
    this.onclose?.();
  }
}

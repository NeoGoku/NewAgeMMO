/// <reference lib="webworker" />
import { createCore, type SockLike } from '../../../server/src/core';
import { IdbStore } from './idbstore';

let core: Awaited<ReturnType<typeof createCore>> | undefined;
let message: ((data: string) => void) | undefined;
let release: (() => void) | undefined;
const worker = self as unknown as DedicatedWorkerGlobalScope;
const sock: SockLike = {
  readyState: 1,
  send: d => worker.postMessage({ t: 'm', d }),
  close: () => worker.postMessage({ t: 'c' }),
  on(event, fn) { if (event === 'message') message = fn; }
};

async function open() {
  const active = new Promise<void>(resolve => { release = resolve; });
  try {
    await navigator.locks.request('newagemmo-solo', { ifAvailable: true }, async lock => {
      if (sock.readyState !== 1) return;
      if (!lock) throw new Error('Der Solo-Spielstand ist bereits in einem anderen Fenster geöffnet.');
      core = await createCore(new IdbStore());
      if (sock.readyState !== 1) return;
      core.onConnection(sock, 'solo');
      worker.postMessage({ t: 'ready' });
      await active;
    });
  } catch (error) {
    worker.postMessage({ t: 'fail', err: String(error) });
  }
}

worker.onmessage = async ({ data }) => {
  if (data.t === 'open') void open();
  else if (data.t === 'm' && sock.readyState === 1) message?.(data.d);
  else if (data.t === 'c') {
    sock.readyState = 3;
    try {
      await core?.shutdown();
    } catch (error) {
      worker.postMessage({ t: 'fail', err: String(error) });
    } finally {
      release?.();
      worker.postMessage({ t: 'closed' });
    }
  }
};

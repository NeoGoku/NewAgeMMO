/// <reference lib="webworker" />
import { createCore, type SockLike } from '../../../server/src/core';
import { IdbStore, withSoloLock } from './idbstore';

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
    await withSoloLock(async () => {
      if (sock.readyState !== 1) return;
      const store = new IdbStore();
      try {
        core = await createCore(store);
        if (sock.readyState !== 1) {
          await core.shutdown();
          return;
        }
        core.onConnection(sock, 'solo');
        worker.postMessage({ t: 'ready' });
        await active;
      } finally {
        store.close();
      }
    });
  } catch (error) {
    worker.postMessage({ t: 'fail', err: String(error) });
  } finally {
    worker.postMessage({ t: 'closed' });
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
    }
  }
};

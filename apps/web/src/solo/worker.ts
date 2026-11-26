/// <reference lib="webworker" />
import { createCore, type SockLike } from '../../../server/src/core';
import { IdbStore, withSoloLock } from './idbstore';
import { WalkingNetwork, WALKING_NETWORK_MAX_BYTES } from '../../../server/src/walking-network';
import { readPropertyCatalogResponse } from '../../../server/src/property-catalog-response';

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
        const buildRoot = new URL(import.meta.env.BASE_URL, new URL('../', worker.location.href));
        const walkingAsset = import.meta.env.VITE_BUNDLED_WALKING_NETWORK;
        const walkingNetwork = walkingAsset ? async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6500);
          try {
            const response = await fetch(new URL(walkingAsset, buildRoot),
              { signal: controller.signal, credentials: 'same-origin', redirect: 'error' });
            return new WalkingNetwork(await readPropertyCatalogResponse(response, WALKING_NETWORK_MAX_BYTES));
          } finally { clearTimeout(timeout); }
        } : undefined;
        const catalogUrl = import.meta.env.VITE_PROPERTY_CATALOG_URL || import.meta.env.VITE_BUNDLED_PROPERTY_CATALOG_URL;
        let propertyCatalog: unknown;
        if (catalogUrl) {
          const url = new URL(catalogUrl, buildRoot);
          if (url.origin !== worker.location.origin) throw new Error('Der Solo-Immobilienkatalog muss vom selben Web-Ursprung stammen.');
          try {
            const response = await fetch(url, { signal: AbortSignal.timeout(4000), credentials: 'same-origin', redirect: 'error' });
            propertyCatalog = await readPropertyCatalogResponse(response);
          } catch (error) {
            console.warn('solo_property_catalog', String(error));
          }
        }
        core = await createCore(store, { routingUrl: import.meta.env.VITE_VALHALLA_URL, walkingNetwork, propertyCatalog });
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

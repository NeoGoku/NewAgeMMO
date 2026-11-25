import { MemoryStore } from '../../../server/src/store';
import { WriteOrder } from '../../../server/src/write-order';
import { parseSoloBackup, serializeSoloBackup } from './backup';

const DB_NAME = 'newagemmo-solo';
const STORE_NAME = 'kv';
const DATA_KEY = 'data';

export async function withSoloLock<T>(fn: () => Promise<T>): Promise<T> {
  return await navigator.locks.request(DB_NAME, { ifAvailable: true }, lock => {
    if (!lock) throw new Error('Der Solo-Spielstand ist bereits in einem anderen Fenster geöffnet.');
    return fn();
  });
}

/** Keep the existing IndexedDB format and confirm writes only after commit. */
export class IdbStore extends MemoryStore {
  kind = 'indexeddb';
  private connection!: IDBDatabase;
  private writes = new WriteOrder();
  private timer?: ReturnType<typeof setTimeout>;

  async init() {
    this.connection = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const saved = await new Promise<typeof this.data | undefined>((resolve, reject) => {
      const request = this.connection.transaction(STORE_NAME).objectStore(STORE_NAME).get(DATA_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (saved) this.data = saved;
  }

  close() {
    clearTimeout(this.timer);
    this.connection?.close();
  }

  protected touch(collection: string) {
    super.touch(collection);
    this.timer ??= setTimeout(() => {
      this.timer = undefined;
      void this.flush().catch(error => console.error('solo_store_flush', error));
    }, 2000);
  }

  flush() {
    return this.writes.run(DATA_KEY, async () => {
      if (!this.dirty) return;
      this.dirty = false;
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = this.connection.transaction(STORE_NAME, 'readwrite');
          transaction.oncomplete = () => resolve();
          transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB-Transaktion abgebrochen'));
          transaction.objectStore(STORE_NAME).put(this.data, DATA_KEY);
        });
      } catch (error) {
        this.dirty = true;
        throw error;
      }
    });
  }
}

async function withSavedGame<T>(fn: (store: IdbStore) => Promise<T>): Promise<T> {
  return withSoloLock(async () => {
    const store = new IdbStore();
    try {
      await store.init();
      return await fn(store);
    } finally {
      store.close();
    }
  });
}

export function exportSoloBackup(): Promise<string> {
  return withSavedGame(async store => serializeSoloBackup(store.data));
}

export async function importSoloBackup(json: string): Promise<void> {
  const restored = parseSoloBackup(json);
  await withSavedGame(async store => {
    store.data = restored;
    store.dirty = true;
    await store.flush();
  });
}

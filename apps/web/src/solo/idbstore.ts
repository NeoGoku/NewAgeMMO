import { MemoryStore } from '../../../server/src/store';
import { WriteOrder } from '../../../server/src/write-order';

/** Keep the existing IndexedDB format and confirm writes only after commit. */
export class IdbStore extends MemoryStore {
  kind = 'indexeddb';
  private connection!: IDBDatabase;
  private writes = new WriteOrder();
  private timer?: ReturnType<typeof setTimeout>;

  async init() {
    this.connection = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('newagemmo-solo', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('kv');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const saved = await new Promise<typeof this.data | undefined>((resolve, reject) => {
      const request = this.connection.transaction('kv').objectStore('kv').get('data');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (saved) this.data = saved;
  }

  protected touch(collection: string) {
    super.touch(collection);
    this.timer ??= setTimeout(() => {
      this.timer = undefined;
      void this.flush().catch(error => console.error('solo_store_flush', error));
    }, 2000);
  }

  flush() {
    return this.writes.run('data', async () => {
      if (!this.dirty) return;
      this.dirty = false;
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = this.connection.transaction('kv', 'readwrite');
          transaction.oncomplete = () => resolve();
          transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB-Transaktion abgebrochen'));
          transaction.objectStore('kv').put(this.data, 'data');
        });
      } catch (error) {
        this.dirty = true;
        throw error;
      }
    });
  }
}

import { MemoryStore } from '../../../server/src/store';
/** Solo-Speicher im Browser: Arbeitsspeicher + IndexedDB-Persistenz (gesamter Datenstand, entprellt). */
export class IdbStore extends MemoryStore {
  kind = 'indexeddb'; private t: any = null;
  private db(): Promise<IDBDatabase> { return new Promise((res, rej) => { const r = indexedDB.open('newagemmo-solo', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async init() { try { const db = await this.db(); const v = await new Promise<any>(res => { const q = db.transaction('kv').objectStore('kv').get('data'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); if (v) this.data = v; } catch { /* ohne Persistenz weiter */ } }
  protected touch(c: string) { super.touch(c); if (!this.t) this.t = setTimeout(() => { this.t = null; void this.flush(); }, 2000); }
  async flush() { if (!this.dirty) return; this.dirty = false; try { const db = await this.db(); db.transaction('kv', 'readwrite').objectStore('kv').put(this.data, 'data'); } catch { /* */ } }
}

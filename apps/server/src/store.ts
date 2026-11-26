import type { Character, GeoObj } from '@nam/shared';

export type OsmBounds = readonly [south: number, west: number, north: number, east: number];
export interface OsmRegion { until: number; points: GeoObj[] }
export interface OsmCache {
  getRegion(id: string, bounds: OsmBounds): Promise<OsmRegion | null>;
  putRegion(id: string, region: OsmRegion): Promise<void>;
}

/** Dokumentenspeicher. Standard: JSON-Dateien (Entwicklung). Mit DATABASE_URL: PostgreSQL (JSONB-Tabelle `docs`, siehe database/migrations). */
export interface Store { init(): Promise<void>; get<T = any>(coll: string, id: string): Promise<T | null>; put(coll: string, id: string, doc: any): Promise<void>; putCharacters(characters: readonly Character[]): Promise<void>; del(coll: string, id: string): Promise<void>; all<T = any>(coll: string): Promise<T[]>; flush(): Promise<void>; geoUpsert?(id: string, kind: string, lat: number, lon: number, data?: any): void; geoDel?(id: string): void; geoNear?(kind: string, lat: number, lon: number, m: number): Promise<any[]>; osmCache?: OsmCache; kind: string; backup(): Promise<string> }
export class MemoryStore implements Store {
  kind = 'memory'; data: Record<string, Record<string, any>> = {}; dirty = false;
  async init() {}
  protected touch(c: string) { (this.data[c] ||= {}); this.dirty = true; }
  async get(c: string, id: string) { const d = this.data[c]?.[id]; return d ? structuredClone(d) : null; }
  async put(c: string, id: string, doc: any) { this.touch(c); this.data[c][id] = structuredClone(doc); }
  async putCharacters(characters: readonly Character[]) {
    const documents = structuredClone(characters);
    await this.flush();
    this.touch('chars');
    for (const character of documents) this.data.chars[character.id] = character;
  }
  async del(c: string, id: string) { this.touch(c); delete this.data[c][id]; }
  async all(c: string) { return Object.values(this.data[c] || {}).map(d => structuredClone(d)); }
  async flush() {}
  async backup() { return 'memory'; }
}

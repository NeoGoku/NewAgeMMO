import fs from 'node:fs'; import path from 'node:path'; import type { Store } from './store';
class FileStore implements Store {
  kind = 'file'; data: Record<string, Record<string, any>> = {}; dirty = false; timer: NodeJS.Timeout | null = null;
  constructor(private dir: string) {}
  private f(c: string) { return path.join(this.dir, c + '.json'); }
  async init() { fs.mkdirSync(this.dir, { recursive: true }); for (const c of fs.readdirSync(this.dir)) if (c.endsWith('.json')) { try { this.data[c.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(this.dir, c), 'utf8')); } catch { /* korrupt: ignorieren */ } } }
  private touch(c: string) { (this.data[c] ||= {}); this.dirty = true; if (!this.timer) this.timer = setTimeout(() => { this.timer = null; this.flushSync(); }, 1500); }
  async get(c: string, id: string) { const d = this.data[c]?.[id]; return d ? structuredClone(d) : null; }
  async put(c: string, id: string, doc: any) { this.touch(c); this.data[c][id] = structuredClone(doc); }
  async del(c: string, id: string) { this.touch(c); delete this.data[c][id]; }
  async all(c: string) { return Object.values(this.data[c] || {}).map(d => structuredClone(d)); }
  flushSync() { if (!this.dirty) return; this.dirty = false; for (const c in this.data) { const tmp = this.f(c) + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(this.data[c])); fs.renameSync(tmp, this.f(c)); } }
  async flush() { this.flushSync(); }
  async backup() { const d = path.join(this.dir, 'backup', new Date().toISOString().replace(/[:.]/g, '-')); fs.mkdirSync(d, { recursive: true }); this.flushSync(); for (const c in this.data) fs.copyFileSync(this.f(c), path.join(d, c + '.json')); return d; }
}
class PgStore implements Store {
  kind = 'postgres'; pool: any;
  constructor(private url: string) {}
  async init() { const pg = await import('pg'); this.pool = new (pg.default || pg).Pool({ connectionString: this.url, max: 8 }); const sql = fs.readdirSync(new URL('../../../database/migrations', import.meta.url)).filter(f => f.endsWith('.sql')).sort();
    await this.pool.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz default now())');
    for (const f of sql) { const done = await this.pool.query('select 1 from schema_migrations where name=$1', [f]); if (done.rowCount) continue; await this.pool.query(fs.readFileSync(new URL('../../../database/migrations/' + f, import.meta.url), 'utf8')); await this.pool.query('insert into schema_migrations(name) values($1)', [f]); console.log('[db] Migration angewendet:', f); } }
  async get(c: string, id: string) { const r = await this.pool.query('select data from docs where coll=$1 and id=$2', [c, id]); return r.rows[0]?.data ?? null; }
  async put(c: string, id: string, doc: any) { await this.pool.query('insert into docs(coll,id,data,updated_at) values($1,$2,$3,now()) on conflict (coll,id) do update set data=$3, updated_at=now()', [c, id, JSON.stringify(doc)]); }
  async del(c: string, id: string) { await this.pool.query('delete from docs where coll=$1 and id=$2', [c, id]); }
  async all(c: string) { const r = await this.pool.query('select data from docs where coll=$1', [c]); return r.rows.map((x: any) => x.data); }
  geoUpsert(id: string, kind: string, lat: number, lon: number, data: any = {}) { void this.hasGis().then(g => g ? this.pool.query('insert into geo_objects(id,kind,geom,data) values($1,$2,ST_SetSRID(ST_MakePoint($4,$3),4326)::geography,$5) on conflict (id) do update set geom=excluded.geom, data=excluded.data, updated_at=now()', [id, kind, lat, lon, JSON.stringify(data)]) : this.pool.query('insert into geo_objects(id,kind,lat,lon,data) values($1,$2,$3,$4,$5) on conflict (id) do update set lat=excluded.lat, lon=excluded.lon, data=excluded.data, updated_at=now()', [id, kind, lat, lon, JSON.stringify(data)])).catch((e: any) => console.error('geoUpsert', e.message)); }
  geoDel(id: string) { void this.pool.query('delete from geo_objects where id=$1', [id]).catch(() => {}); }
  private gis: boolean | null = null; async hasGis() { if (this.gis === null) { const r = await this.pool.query("select 1 from pg_extension where extname='postgis'"); this.gis = !!r.rowCount; } return this.gis; }
  /** Objekte im Umkreis (Meter) – mit PostGIS per ST_DWithin (GiST-Index). */
  async geoNear(kind: string, lat: number, lon: number, m: number) { if (await this.hasGis()) { const r = await this.pool.query('select id, ST_Y(geom::geometry) as lat, ST_X(geom::geometry) as lon, data from geo_objects where kind=$1 and ST_DWithin(geom, ST_SetSRID(ST_MakePoint($3,$2),4326)::geography, $4)', [kind, lat, lon, m]); return r.rows; } const r = await this.pool.query('select id, lat, lon, data from geo_objects where kind=$1 and abs(lat-$2)<$4/111000.0 and abs(lon-$3)<$4/70000.0', [kind, lat, lon, m]); return r.rows; }
  async flush() {}
  async backup() { return 'Bitte pg_dump verwenden (scripts/backup.sh)'; }
}
export const makeStore = (): Store => process.env.DATABASE_URL ? new PgStore(process.env.DATABASE_URL) : new FileStore(process.env.DATA_DIR || path.resolve(process.cwd(), '../../data'));

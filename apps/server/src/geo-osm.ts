import { GEO, haversine, rad, type GeoObj } from '@nam/shared';
import type { OsmBounds, OsmCache, OsmRegion } from './store';

const TILE_DEGREES = .025;
export const OSM_POINT_LIMIT = 80;
const MAX_TILES = 128;
const MAX_BYTES = 256 * 1024;
const CACHE_TTL_MS = 24 * 3600e3;
const RETRY_MS = 15 * 60e3;
const REQUEST_GAP_MS = 5000;
const tagKinds = [
  ['leisure', 'park', 'Park'],
  ['leisure', 'garden', 'Garten'],
  ['amenity', 'library', 'Bibliothek'],
  ['amenity', 'townhall', 'Rathaus'],
  ['historic', 'monument', 'Denkmal'],
  ['tourism', 'viewpoint', 'Aussichtspunkt'],
] as const;

const fixed = (value: number) => Number(value.toFixed(4));
function regionAt(lat: number, lon: number) {
  const row = Math.floor(lat / TILE_DEGREES);
  const col = Math.floor(lon / TILE_DEGREES);
  const south = row * TILE_DEGREES;
  const west = col * TILE_DEGREES;
  const lonPad = .013 / Math.cos(rad(Math.min(85, Math.abs(south) + TILE_DEGREES)));
  return {
    id: row + ':' + col,
    box: [
      fixed(Math.max(-85, south - .013)), fixed(Math.max(-180, west - lonPad)),
      fixed(Math.min(85, south + TILE_DEGREES + .013)), fixed(Math.min(180, west + TILE_DEGREES + lonPad)),
    ] as OsmBounds,
  };
}

async function readJson(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return undefined;
  let bytes = 0;
  let raw = '';
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) return JSON.parse(raw + decoder.decode());
    bytes += value.byteLength;
    if (bytes > MAX_BYTES) { await reader.cancel(); return undefined; }
    raw += decoder.decode(value, { stream: true });
  }
}

interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}
function parsePoints(data: unknown, [south, west, north, east]: ReturnType<typeof regionAt>['box']): GeoObj[] {
  const elements = (data as { elements?: unknown })?.elements;
  if (!Array.isArray(elements)) return [];
  const points = new Map<string, GeoObj>();
  for (const raw of elements.slice(0, OSM_POINT_LIMIT)) {
    if (!raw || typeof raw !== 'object') continue;
    const el = raw as OverpassElement;
    const { tags, type } = el;
    if (!type || !['node', 'way', 'relation'].includes(type) || !Number.isSafeInteger(el.id)) continue;
    if (!tags || ['no', 'private', 'customers'].includes(tags.access) || ['no', 'private'].includes(tags.foot)) continue;
    const kind = tagKinds.find(([key, value]) => tags[key] === value);
    const name = typeof tags.name === 'string' ? tags.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 96) : '';
    if (!kind || !name) continue;
    const { lat, lon } = el.center || el;
    if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < south || lat > north) continue;
    if (typeof lon !== 'number' || !Number.isFinite(lon) || lon < west || lon > east) continue;
    const id = `osm:${type}:${el.id}`;
    points.set(id, { id, k: 'poi', def: 'osm', lat, lon, name, extra: { source: 'OpenStreetMap', category: kind[2] } });
  }
  return [...points.values()];
}

/** The server shares a bounded cache of public points. The request carries only a coarse tile. */
export class OsmPoints {
  private readonly tiles = new Map<string, OsmRegion>();
  private loading?: { id: string; promise: Promise<void> };
  private nextRequest = 0;

  constructor(private readonly endpoint: string, private readonly request: typeof fetch = fetch, private readonly persistence?: OsmCache) {}

  load(lat: number, lon: number): Promise<void> | undefined {
    const region = regionAt(lat, lon);
    if (this.loading?.id === region.id) return this.loading.promise;
    if (this.loading || (this.tiles.get(region.id)?.until || 0) > Date.now()) return;
    const promise = this.import(region).finally(() => { this.loading = undefined; });
    this.loading = { id: region.id, promise };
    return promise;
  }

  private async import(region: ReturnType<typeof regionAt>) {
    if (this.persistence) {
      try {
        const saved = await this.persistence.getRegion(region.id, region.box);
        if (saved && saved.until > Date.now()) { this.remember(region.id, saved); return; }
      } catch (error) { console.warn('osm_cache_read', String(error)); }
    }
    const time = Date.now();
    if (time < this.nextRequest) return;
    this.nextRequest = time + REQUEST_GAP_MS;
    const filters = tagKinds.map(([key, value]) => `nwr["${key}"="${value}"]["name"]["access"!~"^(no|private|customers)$"];`).join('');
    const query = `[out:json][timeout:5][maxsize:1048576][bbox:${region.box.join(',')}];(${filters});out center ${OSM_POINT_LIMIT};`;
    let fresh: OsmRegion | undefined;
    try {
      const response = await this.request(this.endpoint, {
        method: 'POST', body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(6500),
      });
      if (response.ok) {
        const data = await readJson(response);
        if (Array.isArray(data?.elements) && !data.remark) {
          fresh = { points: parsePoints(data, region.box), until: Date.now() + CACHE_TTL_MS };
        }
      }
    } catch { /* Public POIs are optional. Procedural gameplay continues during outages. */ }
    this.remember(region.id, fresh ?? { points: this.tiles.get(region.id)?.points || [], until: Date.now() + RETRY_MS });
    if (fresh && this.persistence) {
      try { await this.persistence.putRegion(region.id, fresh); }
      catch (error) { console.warn('osm_cache_write', String(error)); }
    }
  }

  private remember(id: string, tile: OsmRegion) {
    this.tiles.delete(id);
    if (this.tiles.size >= MAX_TILES) this.tiles.delete(this.tiles.keys().next().value!);
    this.tiles.set(id, tile);
  }

  nearby(lat: number, lon: number, radius: number) {
    const points = this.tiles.get(regionAt(lat, lon).id)?.points || [];
    return points.filter(p => haversine(lat, lon, p.lat, p.lon) <= radius);
  }
}

let osm: OsmPoints | undefined;
export function configureOsm(endpoint: string, persistence?: OsmCache) { osm = endpoint ? new OsmPoints(endpoint, fetch, persistence) : undefined; }
export function loadOsmPoints(lat: number, lon: number) { void osm?.load(lat, lon); }
export function osmObjects(lat: number, lon: number, radius = GEO.viewM) { return osm?.nearby(lat, lon, radius) || []; }

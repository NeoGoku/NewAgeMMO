import { GEO, PROPERTY_SOURCE, PROPERTY_BUILDINGS, type GeoObj, type GeoPropertyBuilding } from '@nam/shared';
import { nearbyBuildings, parsePropertyBuilding, propertyCatalog } from './geo-property-data';
import { readPropertyCatalogResponse } from './property-catalog-response';

const TILE_DEG = .02;
const TTL_MS = 24 * 3600e3;
const RETRY_MS = 15 * 60e3;
const MAX_CATALOGS = 64;
const MAX_BUILDINGS = 120;
const REQUEST_GAP_MS = 5000;

function regionFor(lat: number, lon: number) {
  const row = Math.floor(lat / TILE_DEG);
  const col = Math.floor(lon / TILE_DEG);
  const margin = .012;
  const lonMargin = margin / Math.cos(Math.min(85, Math.abs(row * TILE_DEG) + TILE_DEG) * Math.PI / 180);
  const box = [
    Math.max(-85, row * TILE_DEG - margin),
    Math.max(-180, col * TILE_DEG - lonMargin),
    Math.min(85, (row + 1) * TILE_DEG + margin),
    Math.min(180, (col + 1) * TILE_DEG + lonMargin),
  ].map(n => n.toFixed(3));
  return { id: row + ':' + col, box };
}

interface Region {
  buildings: Map<string, GeoPropertyBuilding>;
  until: number;
  unavailable?: boolean;
}

interface OverpassBuilding {
  type?: string;
  id?: number;
  tags?: Record<string, string>;
  geometry?: { lat?: number; lon?: number }[];
}

export class RegionalProperties {
  private readonly cache = new Map<string, Region>();
  private loading?: { id: string; promise: Promise<void> };
  private nextRequest = 0;

  constructor(private readonly endpoint: string, private readonly request: typeof fetch = fetch) {}

  async load(lat: number, lon: number) {
    const { id, box } = regionFor(lat, lon);
    if ((this.cache.get(id)?.until ?? 0) > Date.now()) return;
    if (this.loading?.id === id) return this.loading.promise;
    if (this.loading || Date.now() < this.nextRequest) return;
    this.nextRequest = Date.now() + REQUEST_GAP_MS;
    const promise = this.fetchRegion(box).then(region => {
      const previous = this.cache.get(id);
      this.cache.delete(id);
      if (this.cache.size >= MAX_CATALOGS) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(id, region ?? {
        buildings: previous?.buildings ?? new Map(), until: Date.now() + RETRY_MS, unavailable: true,
      });
    }).finally(() => { this.loading = undefined; });
    this.loading = { id, promise };
    return promise;
  }

  private async fetchRegion(box: string[]): Promise<Region | undefined> {
    try {
      const bounds = '(' + box.join(',') + ')';
      const data = '[out:json][timeout:5][maxsize:2097152];(way["building"~"^(' +
        PROPERTY_BUILDINGS.join('|') + ')$"]' + bounds + ';way["landuse"="greenfield"]["access"!~"^(no|private)$"]' +
        bounds + ';);out geom ' + MAX_BUILDINGS + ';';
      const response = await this.request(this.endpoint, {
        method: 'POST', body: new URLSearchParams({ data }), signal: AbortSignal.timeout(6500),
      });
      const raw = await readPropertyCatalogResponse(response, 1024 * 1024) as {
        generator?: string; remark?: unknown; elements?: OverpassBuilding[];
      };
      if (!raw?.generator?.startsWith('Overpass API') || raw.remark || !Array.isArray(raw.elements) ||
        raw.elements.length > MAX_BUILDINGS) return;
      const [south, west, north, east] = box.map(Number);
      const buildings = new Map<string, GeoPropertyBuilding>();
      for (const el of raw.elements) {
        if (el?.type !== 'way' || !Number.isSafeInteger(el.id) || !Array.isArray(el.geometry)) continue;
        const building = parsePropertyBuilding({
          type: 'Feature', id: `way/${el.id}`, properties: el.tags,
          geometry: { type: 'Polygon', coordinates: [el.geometry.map(point => [point?.lon, point?.lat])] },
        });
        if (!building || building.lat < south || building.lat > north || building.lon < west || building.lon > east) continue;
        buildings.set(building.id, building);
      }
      return { buildings, until: Date.now() + TTL_MS };
    } catch { return undefined; }
  }

  at(lat: number, lon: number) { return this.cache.get(regionFor(lat, lon).id); }
}

let regional: RegionalProperties | undefined;
export const configureRegionalProperties = (endpoint?: string) => {
  regional = endpoint ? new RegionalProperties(endpoint) : undefined;
};
export const loadRegionalProperties = (lat: number, lon: number) => regional?.load(lat, lon);
export const regionalPropertyStatus = (lat: number, lon: number) => {
  if (!regional) return 'disabled';
  const region = regional.at(lat, lon);
  return !region || region.unavailable ? 'unavailable' : 'ready';
};
export const nearbyPropertyCatalog = (lat: number, lon: number, radius = GEO.viewM) => {
  const combined = new Map(regional?.at(lat, lon)?.buildings);
  for (const { building } of propertyCatalog().nearby(lat, lon, radius)) combined.set(building.id, building);
  return nearbyBuildings(combined.values(), lat, lon, radius);
};
export function findProperty(id: string, lat: number, lon: number) {
  return propertyCatalog().buildings.get(id) ?? regional?.at(lat, lon)?.buildings.get(id);
}

export function propertyObjects(lat: number, lon: number, radius: number): GeoObj[] {
  return nearbyPropertyCatalog(lat, lon, radius).map(({ building }) => ({
    id: building.id, k: 'house', def: 'property', lat: building.lat, lon: building.lon,
    name: 'Immobilie', extra: { source: PROPERTY_SOURCE, building: building.building },
  }));
}

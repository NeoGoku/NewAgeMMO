import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import { haversine, hash32 } from '@nam/shared';

/**
 * Globales, kostenloses Geländemodell aus den öffentlichen OpenFreeMap-Vektorkacheln (OSM/ODbL, Zoom 14):
 * Landbedeckung, Landnutzung, Gewässer, POIs und Gebäudezahl je Kachel. Wird serverseitig geladen (Node und Solo-Worker),
 * im Speicher gecacht und rasterisiert (64×64 Zellen je Kachel, ≈ 38 m). Fällt der Abruf aus, gilt das Gelände als „unbekannt“ und das Spiel läuft weiter.
 */
export const T = { other: 0, water: 1, forest: 2, grass: 3, farm: 4, residential: 5, commercial: 6, industrial: 7, rock: 8, wetland: 9 } as const;
export type Terrain = typeof T[keyof typeof T];
export const Z = 14;
const N = 64;
const TILEJSON = 'https://tiles.openfreemap.org/planet';
const MAX_TILES = 90, MAX_PENDING = 6, MAX_TILE_BYTES = 2_000_000, RETRY_MS = 3 * 60e3, JSON_TTL_MS = 3600e3, TIMEOUT_MS = 12_000;

export interface TerrainPoi { lat: number; lon: number; cls: string; sub: string; name: string; rank: number }
export interface TerrainTile {
  x: number; y: number; grid: Uint8Array; pois: TerrainPoi[]; places: { lat: number; lon: number; name: string; cls: string }[];
  buildings: number; shares: number[]; failed?: boolean; at: number;
}
const tiles = new Map<string, TerrainTile>();
const pending = new Map<string, Promise<TerrainTile>>();
let template: { url: string; at: number } | undefined;
let terrainEnabled = true;
export const configureTerrain = (enabled: boolean) => { terrainEnabled = enabled; };
let templateRequest: Promise<string> | undefined;

export const tileXY = (lat: number, lon: number) => {
  const n = 2 ** Z;
  const x = Math.floor((lon + 180) / 360 * n);
  const y = Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  return { x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)) };
};
export const tileKey = (x: number, y: number) => `${x}:${y}`;
const lonAt = (x: number) => x / 2 ** Z * 360 - 180;
const latAt = (y: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 2 ** Z))) * 180 / Math.PI;
export const tileBounds = (x: number, y: number) => ({ west: lonAt(x), east: lonAt(x + 1), north: latAt(y), south: latAt(y + 1) });

function tileUrl(): Promise<string> {
  if (template && Date.now() - template.at <= JSON_TTL_MS) return Promise.resolve(template.url);
  return templateRequest ??= (async () => {
    const response = await fetch(TILEJSON, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error('tilejson ' + response.status);
    const json = await response.json() as { tiles?: string[] };
    const url = json.tiles?.[0];
    if (!url || !/^https:\/\/tiles\.openfreemap\.org\//.test(url)) throw new Error('tilejson ungültig');
    template = { url, at: Date.now() };
    return url;
  })().finally(() => { templateRequest = undefined; });
}

type Ring = { x: number; y: number }[];
/** Even-odd-Scanline-Füllung von Polygonringen in das Kachelraster. */
function fill(grid: Uint8Array, rings: Ring[], extent: number, value: number) {
  let minY = Infinity, maxY = -Infinity;
  for (const ring of rings) for (const p of ring) { if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
  const scale = N / extent;
  const j0 = Math.max(0, Math.floor(minY * scale - .5)), j1 = Math.min(N - 1, Math.ceil(maxY * scale - .5));
  for (let j = j0; j <= j1; j++) {
    const y = (j + .5) / scale;
    const xs: number[] = [];
    for (const ring of rings) {
      for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) {
        const a = ring[i], b = ring[k];
        if ((a.y > y) !== (b.y > y)) xs.push(a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const i0 = Math.max(0, Math.ceil(xs[i] * scale - .5)), i1 = Math.min(N - 1, Math.floor(xs[i + 1] * scale - .5));
      for (let c = i0; c <= i1; c++) grid[j * N + c] = value;
    }
  }
}

const LANDCOVER: Record<string, Terrain> = { wood: T.forest, forest: T.forest, grass: T.grass, farmland: T.farm, rock: T.rock, wetland: T.wetland, sand: T.other, ice: T.rock };
const LANDUSE: Record<string, Terrain> = {
  residential: T.residential, suburb: T.residential, neighbourhood: T.residential, quarter: T.residential, commercial: T.commercial, retail: T.commercial,
  industrial: T.industrial, railway: T.industrial, quarry: T.rock, garages: T.industrial, park: T.grass, garden: T.grass, playground: T.grass, pitch: T.grass,
  recreation_ground: T.grass, golf_course: T.grass, cemetery: T.grass, allotments: T.farm, zoo: T.grass, theme_park: T.grass, military: T.industrial,
};

function decode(x: number, y: number, buffer: ArrayBuffer): TerrainTile {
  const tile = new VectorTile(new Pbf(buffer));
  const grid = new Uint8Array(N * N);
  const paint = (name: string, map: Record<string, Terrain> | null, fixed?: number) => {
    const layer = tile.layers[name];
    if (!layer) return;
    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      if (feature.type !== 3) continue;
      const value = fixed ?? map?.[String(feature.properties.class)];
      if (name === 'park' && !['park', 'nature_reserve', 'protected_area'].includes(String(feature.properties.class))) continue;
      if (value === undefined) continue;
      fill(grid, feature.loadGeometry() as Ring[], layer.extent, value);
    }
  };
  const green = new Set(['park', 'garden', 'playground', 'pitch', 'recreation_ground', 'golf_course', 'cemetery', 'allotments', 'zoo', 'theme_park']);
  // Reihenfolge: bebautes Land → Landbedeckung (Wald/Wiese) → Grünflächen der Landnutzung → Gewässer
  paint('landuse', Object.fromEntries(Object.entries(LANDUSE).filter(([k]) => !green.has(k))));
  paint('landcover', LANDCOVER);
  paint('landuse', Object.fromEntries(Object.entries(LANDUSE).filter(([k]) => green.has(k))));
  paint('park', null, T.grass);
  paint('water', null, T.water);
  const b = tileBounds(x, y);
  const toGeo = (feature: { loadGeometry(): { x: number; y: number }[][] }, extent: number) => {
    const p = feature.loadGeometry()[0]?.[0];
    return p ? { lat: b.north + (b.south - b.north) * (p.y / extent), lon: b.west + (b.east - b.west) * (p.x / extent) } : undefined;
  };
  const pois: TerrainPoi[] = [];
  const poiLayer = tile.layers.poi;
  for (let i = 0; poiLayer && i < poiLayer.length && pois.length < 400; i++) {
    const f = poiLayer.feature(i), at = toGeo(f, poiLayer.extent);
    if (at) pois.push({ ...at, cls: String(f.properties.class ?? ''), sub: String(f.properties.subclass ?? ''), name: String(f.properties.name ?? ''), rank: Number(f.properties.rank ?? 99) });
  }
  const places: TerrainTile['places'] = [];
  const placeLayer = tile.layers.place;
  for (let i = 0; placeLayer && i < placeLayer.length && places.length < 20; i++) {
    const f = placeLayer.feature(i), at = toGeo(f, placeLayer.extent);
    if (at && f.properties.name) places.push({ ...at, name: String(f.properties.name_de ?? f.properties.name), cls: String(f.properties.class ?? '') });
  }
  const shares = new Array(10).fill(0);
  for (const v of grid) shares[v]++;
  return { x, y, grid, pois, places, buildings: tile.layers.building?.length ?? 0, shares: shares.map(v => v / grid.length), at: Date.now() };
}

function loadTile(x: number, y: number): Promise<TerrainTile> {
  const key = tileKey(x, y);
  let job = pending.get(key);
  if (job) return job;
  job = (async () => {
    try {
      const url = (await tileUrl()).replace('{z}', String(Z)).replace('{x}', String(x)).replace('{y}', String(y));
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.status === 404 || response.status === 204) return { x, y, grid: new Uint8Array(N * N), pois: [], places: [], buildings: 0, shares: [1], at: Date.now() } as TerrainTile;
      if (!response.ok) throw new Error('tile ' + response.status);
      if (Number(response.headers.get('content-length')) > MAX_TILE_BYTES) throw new Error('Kachel zu groß');
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_TILE_BYTES) throw new Error('Kachel zu groß');
      return decode(x, y, buffer);
    } catch {
      return { x, y, grid: new Uint8Array(N * N), pois: [], places: [], buildings: 0, shares: [1], failed: true, at: Date.now() } as TerrainTile;
    }
  })().then(tile => {
    tiles.set(key, tile);
    while (tiles.size > MAX_TILES) tiles.delete(tiles.keys().next().value!);
    pending.delete(key);
    return tile;
  });
  pending.set(key, job);
  return job;
}

export const getTile = (x: number, y: number) => {
  const tile = tiles.get(tileKey(x, y));
  if (tile?.failed && Date.now() - tile.at > RETRY_MS) { tiles.delete(tileKey(x, y)); return undefined; }
  return tile;
};

/** Lädt fehlende Kacheln im Umkreis; liefert ein Promise (true = neue Daten) oder undefined, wenn nichts zu laden ist. */
export function ensureTerrain(lat: number, lon: number, radiusM: number): Promise<boolean> | undefined {
  if (!terrainEnabled || pending.size >= MAX_PENDING) return;
  const center = tileXY(lat, lon);
  const count = 2 ** Z;
  const lonRadius = radiusM / (111000 * Math.cos(lat * Math.PI / 180));
  const north = tileXY(lat + radiusM / 111000, lon).y;
  const south = tileXY(lat - radiusM / 111000, lon).y;
  const depth = Math.min(20, Math.ceil(lonRadius / 360 * count) + 1);
  const candidates: { x: number; y: number; distance: number }[] = [];
  for (let y = north; y <= south; y++) for (let dx = -depth; dx <= depth; dx++) {
    const x = (center.x + dx + count) % count;
    if (!getTile(x, y) && !pending.has(tileKey(x, y))) candidates.push({ x, y, distance: dx * dx + (y - center.y) ** 2 });
  }
  const jobs = candidates.sort((a, b) => a.distance - b.distance).slice(0, MAX_PENDING - pending.size)
    .map(({ x, y }) => loadTile(x, y));
  return jobs.length ? Promise.all(jobs).then(list => list.some(tile => !tile.failed)) : undefined;
}

/** Gelände an einer Koordinate; undefined = Kachel noch nicht geladen. */
export function terrainAt(lat: number, lon: number): Terrain | undefined {
  const { x, y } = tileXY(lat, lon);
  const tile = getTile(x, y);
  if (!tile || tile.failed) return undefined;
  const b = tileBounds(x, y);
  const c = Math.min(N - 1, Math.max(0, Math.floor((lon - b.west) / (b.east - b.west) * N)));
  const r = Math.min(N - 1, Math.max(0, Math.floor((b.north - lat) / (b.north - b.south) * N)));
  return tile.grid[r * N + c] as Terrain;
}

export const poisNear = (lat: number, lon: number, radiusM: number) => {
  const out: TerrainPoi[] = [];
  const a = tileXY(lat + radiusM / 111000, lon - radiusM / (111000 * Math.cos(lat * Math.PI / 180)));
  const b = tileXY(lat - radiusM / 111000, lon + radiusM / (111000 * Math.cos(lat * Math.PI / 180)));
  for (let y = a.y; y <= b.y; y++) for (let x = a.x; x <= b.x; x++) {
    const tile = getTile(x, y);
    for (const poi of tile?.pois ?? []) if (haversine(lat, lon, poi.lat, poi.lon) <= radiusM) out.push(poi);
  }
  return out;
};

/* ---------- Regionen (je Kachel) ---------- */
export const TIERS = [
  { tier: 1, name: 'Anfängergebiet', lvl: [1, 10] }, { tier: 2, name: 'Fortgeschrittenengebiet', lvl: [11, 25] },
  { tier: 3, name: 'Gefahrengebiet', lvl: [26, 40] }, { tier: 4, name: 'Hochrisikogebiet', lvl: [41, 60] },
  { tier: 5, name: 'Elitegebiet', lvl: [61, 80] }, { tier: 6, name: 'Endgame-Gebiet', lvl: [81, 100] },
] as const;
export interface Region {
  id: string; x: number; y: number; tier: number; lvl: [number, number]; name: string; trait: string; label: string; share: number[];
}
export function regionOf(x: number, y: number): Region | undefined {
  const tile = getTile(x, y);
  if (!tile) return undefined;
  // Hohe Bebauungsdichte = Anfängergebiet; je abgelegener, desto höher die Stufe. Grobe Region (Zoom 11) glättet Nachbarkacheln.
  const r = hash32(`region:${x >> 3}:${y >> 3}`) % 100;
  const b = tile.buildings;
  const tier = tile.failed ? 1 : b >= 150 ? 1 : b >= 40 ? (r < 60 ? 1 : 2) : b >= 6 ? (r < 30 ? 2 : r < 70 ? 3 : 4) : (r < 25 ? 3 : r < 55 ? 4 : r < 80 ? 5 : 6);
  const s = tile.shares;
  const dominant = [[T.forest, 'Dichter Forst'], [T.grass, 'Weideland'], [T.farm, 'Ackerland'], [T.industrial, 'Industriebrache'], [T.residential, 'Siedlungsland'], [T.rock, 'Felsgebiet'], [T.wetland, 'Sumpfland'], [T.water, 'Küstenland']] as const;
  let trait = 'Offenes Land', best = .22;
  for (const [id, label] of dominant) if ((s[id] ?? 0) > best) { best = s[id]; trait = label; }
  if (hash32(`ether:${x}:${y}`) % 7 === 0) trait = 'Ätherströmung';
  const place = tile.places.find(pl => ['city', 'town', 'village', 'suburb', 'hamlet'].includes(pl.cls))?.name;
  const info = TIERS[tier - 1];
  return { id: tileKey(x, y), x, y, tier, lvl: [info.lvl[0], info.lvl[1]], name: info.name, trait, label: place ? `${place} · ${trait}` : trait, share: s };
}
export const regionAt = (lat: number, lon: number) => { const { x, y } = tileXY(lat, lon); return regionOf(x, y); };

export const terrainTilesLoaded = () => tiles.size;
export function resetTerrainForTests() { tiles.clear(); pending.clear(); template = undefined; templateRequest = undefined; }
/** Test-Hilfe: eine Kachel direkt setzen. */
export function setTerrainTile(tile: TerrainTile) { tiles.set(tileKey(tile.x, tile.y), tile); }

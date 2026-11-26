import type { Map as LibreMap, StyleSpecification } from 'maplibre-gl';
import { hex, type Ctx, type StyleDef } from './styles/kit';
import { rasterize } from './styles/sprites';
import { underground } from './styles/underground';
import { metroNoir } from './styles/metro-noir';
import { westCoast } from './styles/west-coast';
import { frontier } from './styles/frontier';
import { pixelAdventure } from './styles/pixel-adventure';
import { neonDistrict } from './styles/neon-district';

export const MAP_TYPES = [
  { id: 'standard', label: 'Standard' },
  { id: 'satellite', label: 'Satellit' },
  { id: 'buildings', label: '3D City' }
] as const;
export const MAP_STYLES = [
  { id: 'underground', label: 'Underground' },
  { id: 'metro-noir', label: 'Metro Noir' },
  { id: 'west-coast', label: 'West Coast' },
  { id: 'frontier', label: 'Frontier' },
  { id: 'pixel-adventure', label: 'Pixel Adventure' },
  { id: 'neon-district', label: 'Neon District' }
] as const;
export type MapKind = typeof MAP_TYPES[number]['id'];
export type MapTheme = typeof MAP_STYLES[number]['id'];

/** Frühere Style-IDs werden auf ihre Nachfolger abgebildet (gespeicherte Einstellungen bleiben gültig). */
export const LEGACY_STYLE_IDS: Record<string, MapTheme> = {
  urban: 'metro-noir', vintage: 'frontier', adventure: 'west-coast', cyber: 'neon-district', pixel: 'pixel-adventure', 'night-city': 'neon-district'
};
const DEFS: Record<MapTheme, StyleDef> = {
  underground, 'metro-noir': metroNoir, 'west-coast': westCoast, frontier, 'pixel-adventure': pixelAdventure, 'neon-district': neonDistrict
};
/** Schriftstapel (lokal erzeugte SDF-Glyphen, siehe public/fonts) */
export const MAP_FONTS = ['Noto Sans Regular', 'Noto Sans Bold', 'NAM Condensed Bold', 'NAM Block Regular', 'NAM Chronicle Regular', 'NAM Frontier Regular', 'NAM Pixel Bold', 'NAM Neon Bold'];

const osmAttribution = '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap-Mitwirkende</a>';
const satelliteAttribution = '<a href="https://s2maps.eu/">Sentinel-2 cloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)';
const vector = {
  type: 'vector' as const,
  url: 'https://tiles.openfreemap.org/planet',
  attribution: '<a href="https://openfreemap.org/">OpenFreeMap</a> <a href="https://www.openmaptiles.org/">© OpenMapTiles</a> · ' + osmAttribution
};
const imageryTile = 'https://tiles.maps.eox.at/wms?service=WMS&version=1.1.1&request=GetMap' +
  '&layers=s2cloudless-2024_3857&styles=&format=image/jpeg&srs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}';
export interface MapPreferences {
  kind: MapKind;
  style: MapTheme | null;
  follow: boolean;
  brightness: number;
  bearing: number;
  pitch: number;
  zoom: number;
}

const key = 'nam.map.preferences';
const defaults: MapPreferences = { kind: 'standard', style: null, follow: true, brightness: 100, bearing: 0, pitch: 0, zoom: 16 };
const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

const resolveStyle = (id: unknown): MapTheme | null => {
  const mapped = typeof id === 'string' ? (LEGACY_STYLE_IDS[id] ?? id) : null;
  return MAP_STYLES.find(theme => theme.id === mapped)?.id ?? null;
};

export function mapPreferences(): MapPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    return {
      kind: MAP_TYPES.find(type => type.id === saved.kind)?.id ?? 'standard',
      style: resolveStyle(saved.style === undefined ? saved.kind : saved.style),
      follow: saved.follow !== false,
      brightness: clamp(saved.version === undefined && saved.brightness === 83 ? 100 : saved.brightness, 40, 100, defaults.brightness),
      bearing: clamp(saved.bearing, -180, 180, 0),
      pitch: clamp(saved.pitch, 0, 65, 0),
      zoom: clamp(saved.zoom, 2, 19, defaults.zoom)
    };
  } catch { return { ...defaults }; }
}

export function saveMapPreferences(preferences: MapPreferences) {
  try { localStorage.setItem(key, JSON.stringify({ ...preferences, version: 2 })); } catch { /* Browser storage unavailable */ }
}

const visible = (enabled: boolean) => enabled ? 'visible' : 'none';
const standard = (preferences: MapPreferences) => preferences.kind !== 'satellite' && !preferences.style;
const publicAsset = (file: string) => (import.meta.env?.BASE_URL ?? '/') + file;

export function mapStyle(preferences: MapPreferences): StyleSpecification {
  const brightness = preferences.brightness / 100;
  const satellite = preferences.kind === 'satellite';
  return {
    version: 8,
    glyphs: new URL(publicAsset('fonts/'), typeof location === 'undefined' ? 'http://localhost/' : location.href).href + '{fontstack}/{range}.pbf',
    sources: {
      osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: osmAttribution },
      'satellite-overview': {
        type: 'raster', tileSize: 256, maxzoom: 0,
        tiles: [new URL(publicAsset('satellite-overview.jpg'), typeof location === 'undefined' ? 'http://localhost/' : location.href).href],
        attribution: '<a href="https://worldview.earthdata.nasa.gov/">NASA Worldview · Blue Marble</a>'
      },
      satellite: {
        type: 'raster', tileSize: 256, maxzoom: 15,
        tiles: [imageryTile],
        attribution: satelliteAttribution
      }
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#172834' } },
      { id: 'osm', type: 'raster', source: 'osm', layout: { visibility: visible(standard(preferences)) },
        paint: { 'raster-brightness-max': brightness } },
      { id: 'satellite-overview', type: 'raster', source: 'satellite-overview', layout: { visibility: visible(satellite) },
        paint: { 'raster-brightness-max': brightness } },
      { id: 'satellite-street-fallback', type: 'raster', source: 'osm', minzoom: 8,
        layout: { visibility: visible(satellite) }, paint: { 'raster-brightness-max': brightness } },
      { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: visible(satellite) },
        paint: { 'raster-brightness-max': brightness } }
    ]
  };
}


const tone = (color: string, brightness: number) => hex(color, brightness);
const loaded = new WeakMap<object, { sig: string; bucket: number; images: Set<string> }>();

function context(preferences: MapPreferences): Ctx {
  const b = preferences.brightness / 100;
  const bucket = Math.round(preferences.brightness / 10);
  return {
    b, c: color => tone(color, b), overlay: preferences.kind === 'satellite', extruded: preferences.kind === 'buildings',
    bucket, img: name => `${name}@${bucket}`
  };
}

/** Alle Layer eines Styles für den aktuellen Kartentyp (Satellit: nur Overlay-Layer). */
export function themeLayers(id: MapTheme, preferences: MapPreferences) {
  const ctx = context(preferences);
  return DEFS[id].layers(ctx).filter(layer => !ctx.overlay || (layer.metadata as { overlay?: boolean } | undefined)?.overlay);
}

function syncImages(map: LibreMap, def: StyleDef, bucket: number, images: Set<string>) {
  if (typeof document === 'undefined') return;
  for (const sprite of def.sprites) {
    const id = `${sprite.name}@${bucket}`;
    if (map.hasImage(id)) { images.add(id); continue; }
    map.addImage(id, rasterize(sprite, bucket / 10), { pixelRatio: sprite.pixelRatio });
    images.add(id);
  }
}

function removeTheme(map: LibreMap, state?: { images: Set<string> }) {
  for (const layer of [...map.getStyle().layers]) if (layer.id.startsWith('theme-')) map.removeLayer(layer.id);
  for (const id of state?.images ?? []) if (map.hasImage(id)) map.removeImage(id);
  state?.images.clear();
}

export function applyMapPreferences(map: LibreMap, preferences: MapPreferences) {
  if (!map.getLayer('osm')) return;
  const def = preferences.style ? DEFS[preferences.style] : null;
  const brightness = preferences.brightness / 100;
  const before = map.getLayer('cities-fill') ? 'cities-fill' : undefined;
  map.setLayoutProperty('osm', 'visibility', visible(standard(preferences)));
  for (const id of ['satellite-overview', 'satellite-street-fallback', 'satellite']) map.setLayoutProperty(id, 'visibility', visible(preferences.kind === 'satellite'));
  for (const id of ['osm', 'satellite-overview', 'satellite-street-fallback', 'satellite']) map.setPaintProperty(id, 'raster-brightness-max', brightness);
  map.setPaintProperty('bg', 'background-color', def && preferences.kind !== 'satellite' ? tone(def.background, brightness) : '#172834');

  if ((def || preferences.kind === 'buildings') && !map.getSource('openmap')) {
    map.addSource('openmap', vector);
    map.addLayer({
      id: 'buildings', type: 'fill-extrusion', source: 'openmap', 'source-layer': 'building', minzoom: 14,
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-opacity': 0.88,
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0]
      }
    }, before);
  }
  const ctx = context(preferences);
  if (map.getLayer('buildings')) {
    const extrusion = def?.extrusion(ctx);
    map.setLayoutProperty('buildings', 'visibility', visible(preferences.kind === 'buildings'));
    map.setPaintProperty('buildings', 'fill-extrusion-color', extrusion?.color ?? tone('#23687a', brightness));
    map.setPaintProperty('buildings', 'fill-extrusion-opacity', extrusion?.opacity ?? 0.88);
    map.setPaintProperty('buildings', 'fill-extrusion-vertical-gradient', extrusion?.vertical ?? true);
  }
  let state = loaded.get(map);
  if (!def) {
    if (state) removeTheme(map, state);
    loaded.delete(map);
    for (const layer of map.getStyle().layers) if (layer.id.startsWith('theme-')) map.removeLayer(layer.id);
    return;
  }
  const sig = `${def.id}|${preferences.kind === 'satellite' ? 'overlay' : preferences.kind}`;
  const bucket = Math.round(preferences.brightness / 10);
  const layers = themeLayers(preferences.style!, preferences);
  if (!state || state.sig !== sig) {
    removeTheme(map, state);
    state = { sig, bucket, images: new Set() };
    loaded.set(map, state);
    syncImages(map, def, bucket, state.images);
    for (const layer of layers) map.addLayer(layer, before);
    return;
  }
  // gleicher Style: nur Helligkeit/Farben nachziehen
  if (state.bucket !== bucket) {
    const stale = new Set(state.images);
    state.images.clear();
    syncImages(map, def, bucket, state.images);
    state.bucket = bucket;
    for (const id of stale) if (!state.images.has(id) && map.hasImage(id)) setTimeout(() => { if (map.hasImage(id)) map.removeImage(id); }, 0);
  }
  for (const layer of layers) {
    if (!map.getLayer(layer.id)) { map.addLayer(layer, before); continue; }
    if ('layout' in layer) for (const [property, value] of Object.entries(layer.layout ?? {})) map.setLayoutProperty(layer.id, property, value);
    if ('paint' in layer) for (const [property, value] of Object.entries(layer.paint ?? {})) map.setPaintProperty(layer.id, property, value);
  }
}

export function mapThemePreview(id: MapTheme): string {
  return publicAsset(`map-previews/${id}.webp`);
}
export function mapWorldPreview(id: MapTheme): string {
  return publicAsset(`map-previews/${id}-world.webp`);
}

import type { Map as LibreMap, StyleSpecification } from 'maplibre-gl';

export type MapKind = 'standard' | 'satellite' | 'buildings';
export interface MapPreferences {
  kind: MapKind;
  brightness: number;
  bearing: number;
  pitch: number;
  zoom: number;
}

const key = 'nam.map.preferences';
const defaults: MapPreferences = { kind: 'standard', brightness: 83, bearing: 0, pitch: 0, zoom: 16 };
const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function mapPreferences(): MapPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    return {
      kind: saved.kind === 'satellite' || saved.kind === 'buildings' ? saved.kind : 'standard',
      brightness: clamp(saved.brightness, 40, 100, defaults.brightness),
      bearing: clamp(saved.bearing, -180, 180, 0),
      pitch: clamp(saved.pitch, 0, 65, 0),
      zoom: clamp(saved.zoom, 2, 19, defaults.zoom)
    };
  } catch { return { ...defaults }; }
}

export function saveMapPreferences(preferences: MapPreferences) {
  try { localStorage.setItem(key, JSON.stringify(preferences)); } catch { /* Browser storage unavailable */ }
}

const osmAttribution = '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap-Mitwirkende</a>';
const visible = (enabled: boolean) => enabled ? 'visible' : 'none';

export function mapStyle(preferences: MapPreferences): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: osmAttribution },
      satellite: {
        type: 'raster', tileSize: 256, maxzoom: 8,
        tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg'],
        attribution: '<a href="https://www.earthdata.nasa.gov/data/projects/gibs">NASA EOSDIS GIBS · Blue Marble</a>'
      }
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#172834' } },
      { id: 'osm', type: 'raster', source: 'osm', layout: { visibility: visible(preferences.kind !== 'satellite') },
        paint: { 'raster-saturation': -0.36, 'raster-contrast': 0.22, 'raster-brightness-min': 0.05, 'raster-brightness-max': preferences.brightness / 100 } },
      { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: visible(preferences.kind === 'satellite') },
        paint: { 'raster-contrast': 0.15, 'raster-brightness-max': preferences.brightness / 100 } }
    ]
  };
}

export function applyMapPreferences(map: LibreMap, preferences: MapPreferences) {
  if (!map.getLayer('osm')) return;
  if (preferences.kind === 'buildings' && !map.getSource('buildings')) {
    map.addSource('buildings', { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '<a href="https://openfreemap.org/">OpenFreeMap</a> · ' + osmAttribution });
    map.addLayer({
      id: 'buildings', type: 'fill-extrusion', source: 'buildings', 'source-layer': 'building', minzoom: 14,
      paint: {
        'fill-extrusion-color': '#23687a',
        'fill-extrusion-opacity': 0.74,
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0]
      }
    }, map.getLayer('cities-fill') ? 'cities-fill' : undefined);
  }
  map.setLayoutProperty('osm', 'visibility', visible(preferences.kind !== 'satellite'));
  map.setLayoutProperty('satellite', 'visibility', visible(preferences.kind === 'satellite'));
  if (map.getLayer('buildings')) map.setLayoutProperty('buildings', 'visibility', visible(preferences.kind === 'buildings'));
  for (const layer of ['osm', 'satellite']) map.setPaintProperty(layer, 'raster-brightness-max', preferences.brightness / 100);
}

import type { Map as LibreMap, StyleSpecification } from 'maplibre-gl';

export const MAP_DESIGNS = [
  { id: 'standard', label: 'Standard' },
  { id: 'underground', label: 'Underground' },
  { id: 'urban', label: 'Urban' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'cyber', label: 'Cyber' },
  { id: 'satellite', label: 'Satellit' },
  { id: 'buildings', label: '3D City' }
] as const;
export type MapKind = typeof MAP_DESIGNS[number]['id'];

type Theme = {
  background: string; land: string; water: string; building: string;
  road: string; casing: string; highway: string; opacity: number; roadWidth: number;
  saturation: number; contrast: number; hue: number;
};
const themes: Partial<Record<MapKind, Theme>> = {
  underground: { background: '#231427', land: '#372149', water: '#291769', building: '#291c3a', road: '#ff76c9', casing: '#310b36', highway: '#ffb15e', opacity: 0.84, roadWidth: 2.2, saturation: -0.8, contrast: 0.38, hue: 268 },
  urban: { background: '#263238', land: '#647266', water: '#316986', building: '#454c50', road: '#e9e2d0', casing: '#37464e', highway: '#f2ab59', opacity: 0.66, roadWidth: 2.7, saturation: -0.78, contrast: 0.36, hue: 12 },
  vintage: { background: '#b49464', land: '#b9a473', water: '#7b958d', building: '#8d6545', road: '#f4deb2', casing: '#7e5e3d', highway: '#d49b5e', opacity: 0.73, roadWidth: 1.7, saturation: -0.48, contrast: 0.06, hue: 347 },
  adventure: { background: '#85c5a4', land: '#83c777', water: '#63bded', building: '#dca1a5', road: '#fff3bd', casing: '#7f9875', highway: '#ffbf78', opacity: 0.77, roadWidth: 2.5, saturation: 0.17, contrast: 0.06, hue: 0 },
  cyber: { background: '#0b2230', land: '#144739', water: '#123960', building: '#163c49', road: '#72edf5', casing: '#153345', highway: '#c5fb92', opacity: 0.83, roadWidth: 1.8, saturation: -0.86, contrast: 0.28, hue: 180 }
};

const osmAttribution = '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap-Mitwirkende</a>';
const vector = {
  type: 'vector' as const,
  url: 'https://tiles.openfreemap.org/planet',
  attribution: '<a href="https://openfreemap.org/">OpenFreeMap</a> · ' + osmAttribution
};
const themeLayers = ['theme-land', 'theme-water', 'theme-building', 'theme-road-casing', 'theme-road'];
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
      kind: MAP_DESIGNS.find(design => design.id === saved.kind)?.id ?? 'standard',
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
  const theme = themes[preferences.kind];
  const before = map.getLayer('cities-fill') ? 'cities-fill' : undefined;
  if ((theme || preferences.kind === 'buildings') && !map.getSource('openmap')) {
    map.addSource('openmap', vector);
    for (const [id, layer, minzoom] of [
      ['theme-land', 'landuse', 5], ['theme-water', 'water', 0], ['theme-building', 'building', 13]
    ] as const) {
      map.addLayer({ id, type: 'fill', source: 'openmap', 'source-layer': layer, minzoom, layout: { visibility: 'none' } }, before);
    }
    for (const id of ['theme-road-casing', 'theme-road']) {
      map.addLayer({
        id, type: 'line', source: 'openmap', 'source-layer': 'transportation',
        minzoom: 7, layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        filter: ['!', ['in', ['get', 'class'], ['literal', ['rail', 'transit', 'ferry']]]]
      }, before);
    }
    map.addLayer({
      id: 'buildings', type: 'fill-extrusion', source: 'openmap', 'source-layer': 'building', minzoom: 14,
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': '#23687a',
        'fill-extrusion-opacity': 0.74,
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0]
      }
    }, before);
  }
  map.setLayoutProperty('osm', 'visibility', visible(preferences.kind !== 'satellite'));
  map.setLayoutProperty('satellite', 'visibility', visible(preferences.kind === 'satellite'));
  if (map.getLayer('buildings')) map.setLayoutProperty('buildings', 'visibility', visible(preferences.kind === 'buildings'));
  for (const layer of themeLayers) if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', visible(!!theme));

  const brightness = preferences.brightness / 100;
  map.setPaintProperty('bg', 'background-color', theme?.background ?? '#172834');
  map.setPaintProperty('osm', 'raster-saturation', theme?.saturation ?? -0.36);
  map.setPaintProperty('osm', 'raster-contrast', theme?.contrast ?? 0.22);
  map.setPaintProperty('osm', 'raster-hue-rotate', theme?.hue ?? 0);
  for (const layer of ['osm', 'satellite']) map.setPaintProperty(layer, 'raster-brightness-max', brightness);
  if (!theme) return;

  for (const [layer, color] of [
    ['theme-land', theme.land], ['theme-water', theme.water], ['theme-building', theme.building]
  ] as const) {
    map.setPaintProperty(layer, 'fill-color', color);
    map.setPaintProperty(layer, 'fill-opacity', theme.opacity * brightness);
  }
  map.setPaintProperty('theme-road', 'line-color', theme.road);
  // Motorways keep their route hierarchy without masking labels in the basemap.
  map.setPaintProperty('theme-road', 'line-width', [
    'interpolate', ['linear'], ['zoom'],
    7, 0.35, 14, theme.roadWidth, 19, theme.roadWidth * 2
  ]);
  map.setPaintProperty('theme-road-casing', 'line-width', [
    'interpolate', ['linear'], ['zoom'],
    7, 0.65, 14, theme.roadWidth + 1.4, 19, theme.roadWidth * 2 + 2
  ]);
  map.setPaintProperty('theme-road-casing', 'line-color', [
    'match', ['get', 'class'], ['motorway', 'trunk'], theme.highway, theme.casing
  ]);
  map.setPaintProperty('theme-road', 'line-opacity', 0.5 + brightness * 0.45);
}

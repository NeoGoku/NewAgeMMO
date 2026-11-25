import type { Map as LibreMap, StyleSpecification } from 'maplibre-gl';

export const MAP_TYPES = [
  { id: 'standard', label: 'Standard' },
  { id: 'satellite', label: 'Satellit' },
  { id: 'buildings', label: '3D' }
] as const;
export const MAP_STYLES = [
  { id: 'underground', label: 'Underground' },
  { id: 'urban', label: 'Urban' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'cyber', label: 'Cyber' }
] as const;
export type MapKind = typeof MAP_TYPES[number]['id'];
export type MapTheme = typeof MAP_STYLES[number]['id'];

type Theme = {
  background: string; land: string; water: string; building: string;
  road: string; casing: string; highway: string; opacity: number; roadWidth: number;
};
const themes: Record<MapTheme, Theme> = {
  underground: { background: '#231427', land: '#372149', water: '#291769', building: '#291c3a', road: '#ff76c9', casing: '#310b36', highway: '#ffb15e', opacity: 0.84, roadWidth: 2.2 },
  urban: { background: '#263238', land: '#647266', water: '#316986', building: '#454c50', road: '#e9e2d0', casing: '#37464e', highway: '#f2ab59', opacity: 0.66, roadWidth: 2.7 },
  vintage: { background: '#b49464', land: '#b9a473', water: '#7b958d', building: '#8d6545', road: '#f4deb2', casing: '#7e5e3d', highway: '#d49b5e', opacity: 0.73, roadWidth: 1.7 },
  adventure: { background: '#85c5a4', land: '#83c777', water: '#63bded', building: '#dca1a5', road: '#fff3bd', casing: '#7f9875', highway: '#ffbf78', opacity: 0.77, roadWidth: 2.5 },
  cyber: { background: '#0b2230', land: '#144739', water: '#123960', building: '#163c49', road: '#72edf5', casing: '#153345', highway: '#c5fb92', opacity: 0.83, roadWidth: 1.8 }
};

const osmAttribution = '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap-Mitwirkende</a>';
const vector = {
  type: 'vector' as const,
  url: 'https://tiles.openfreemap.org/planet',
  attribution: '<a href="https://openfreemap.org/">OpenFreeMap</a> · ' + osmAttribution
};
const themeLayers = ['theme-cover', 'theme-land', 'theme-water', 'theme-building', 'theme-road-casing', 'theme-road'];
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
const defaults: MapPreferences = { kind: 'standard', style: null, follow: true, brightness: 83, bearing: 0, pitch: 0, zoom: 16 };
const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function mapPreferences(): MapPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    return {
      kind: MAP_TYPES.find(type => type.id === saved.kind)?.id ?? 'standard',
      style: MAP_STYLES.find(theme => theme.id === (saved.style === undefined ? saved.kind : saved.style))?.id ?? null,
      follow: saved.follow !== false,
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
  const theme = preferences.style ? themes[preferences.style] : null;
  const before = map.getLayer('cities-fill') ? 'cities-fill' : undefined;
  if ((theme || preferences.kind === 'buildings') && !map.getSource('openmap')) {
    map.addSource('openmap', vector);
    for (const [id, layer, minzoom] of [
      ['theme-cover', 'landcover', 0], ['theme-land', 'landuse', 5], ['theme-water', 'water', 0], ['theme-building', 'building', 13]
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
  for (const layer of themeLayers) {
    if (!map.getLayer(layer)) continue;
    const road = layer.startsWith('theme-road');
    const surface = preferences.kind !== 'satellite' && (layer !== 'theme-building' || preferences.kind !== 'buildings');
    map.setLayoutProperty(layer, 'visibility', visible(!!theme && (road || surface)));
  }

  const brightness = preferences.brightness / 100;
  map.setPaintProperty('bg', 'background-color', theme?.background ?? '#172834');
  if (map.getLayer('buildings')) map.setPaintProperty('buildings', 'fill-extrusion-color', theme?.building ?? '#23687a');
  for (const layer of ['osm', 'satellite']) map.setPaintProperty(layer, 'raster-brightness-max', brightness);
  if (!theme) return;

  for (const [layer, color] of [
    ['theme-cover', theme.land], ['theme-land', theme.land], ['theme-water', theme.water], ['theme-building', theme.building]
  ] as const) {
    map.setPaintProperty(layer, 'fill-color', color);
    map.setPaintProperty(layer, 'fill-opacity', theme.opacity * brightness * (layer === 'theme-cover' ? 0.6 : 1));
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

/** Original schematic preview using the same palette as the live vector map. */
export function mapThemePreview(id: MapTheme): string {
  const t = themes[id];
  const roads = 'M-4 74L38 55 72 58 110 32 154 26 193 8M26-3l19 34 41 15 16 49M153-6l-22 23-7 11 3 34 29 29M-5 23l69-6 36-19M-8 55l35-9 22-17m61 33 75-12';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 85">
    <path fill="${t.background}" d="M0 0h180v85H0z"/>
    <path fill="${t.land}" d="M0 26L37 20 48 33 26 45 0 49zM135 25l45-12v29l-31 11-12-15z"/>
    <path stroke="${t.water}" stroke-width="15" fill="none" d="M-5 8Q46 1 55 15t64 24 68 30"/>
    <path fill="${t.building}" d="M46 64h23v10H46zm-9-7h8v11h-8zm100 2h10v14h-10zm-33-3 12-6 4 8-11 6zM74 27h10v7H74zm-6 44h15v12H68z"/>
    <path stroke="${t.casing}" stroke-width="6" fill="none" d="${roads}"/>
    <path stroke="${t.road}" stroke-width="${t.roadWidth}" fill="none" d="${roads}"/>
    <path stroke="${t.highway}" stroke-width="1.7" fill="none" d="M-4 74L38 55 72 58 110 32 154 26 193 8"/>
    <circle cx="107" cy="50" r="4" fill="${t.highway}" stroke="#ffffff" stroke-width="1.2"/>
  </svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

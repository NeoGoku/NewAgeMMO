import type {
  ExpressionSpecification, FillLayerSpecification, LayerSpecification, LineLayerSpecification,
  Map as LibreMap, StyleSpecification
} from 'maplibre-gl';

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
  { id: 'cyber', label: 'Cyber' },
  { id: 'pixel', label: 'Pixel' },
  { id: 'night-city', label: 'Neonviertel' }
] as const;
export type MapKind = typeof MAP_TYPES[number]['id'];
export type MapTheme = typeof MAP_STYLES[number]['id'];

type Theme = {
  background: string; district: string; park: string; forest: string; water: string; shore: string;
  building: string; outline: string; road: string; casing: string; highway: string; light: string;
  ink: string; halo: string; roadWidth: number; glow: number; cap: 'butt' | 'round' | 'square';
  dash: number[]; font: 'Noto Sans Regular' | 'Noto Sans Bold'; spacing: number;
  texture: 'stripes' | 'blocks' | 'grain' | 'leaves' | 'circuit' | 'dither' | 'windows';
};
const themes: Record<MapTheme, Theme> = {
  underground: {
    background: '#24172f', district: '#34233d', park: '#293f43', forest: '#234440', water: '#21204d', shore: '#5c4195',
    building: '#4a2b57', outline: '#66416d', road: '#cf83bd', casing: '#48284f', highway: '#ffbc7b', light: '#f050bb',
    ink: '#ffdcf5', halo: '#1c1127', roadWidth: 2, glow: 0.36, cap: 'round', dash: [4, 3], font: 'Noto Sans Bold', spacing: 0.12, texture: 'stripes'
  },
  urban: {
    background: '#c1b6a6', district: '#afa69c', park: '#859473', forest: '#697f62', water: '#548598', shore: '#32687d',
    building: '#8f837e', outline: '#71645c', road: '#f3ead6', casing: '#8c827a', highway: '#efb976', light: '#ffffff',
    ink: '#322d2a', halo: '#f1e7d8', roadWidth: 2.8, glow: 0, cap: 'round', dash: [2, 2], font: 'Noto Sans Regular', spacing: 0.01, texture: 'blocks'
  },
  vintage: {
    background: '#d6bc8c', district: '#c7a879', park: '#b2a070', forest: '#89916a', water: '#7f9990', shore: '#526f67',
    building: '#a57c59', outline: '#835d3d', road: '#f3ddb2', casing: '#927452', highway: '#e9a464', light: '#ecd4a3',
    ink: '#523722', halo: '#e3c99c', roadWidth: 1.6, glow: 0, cap: 'butt', dash: [1, 2.8], font: 'Noto Sans Regular', spacing: 0.16, texture: 'grain'
  },
  adventure: {
    background: '#b9d791', district: '#dac798', park: '#92c878', forest: '#52965f', water: '#79c7ec', shore: '#3699c7',
    building: '#e5a9a0', outline: '#b97173', road: '#fff0b8', casing: '#b29862', highway: '#ffc172', light: '#fce2a3',
    ink: '#2e5740', halo: '#f8f5d0', roadWidth: 3.1, glow: 0, cap: 'round', dash: [0.5, 2], font: 'Noto Sans Bold', spacing: 0.045, texture: 'leaves'
  },
  cyber: {
    background: '#0c202c', district: '#132b38', park: '#153e35', forest: '#13493f', water: '#18345f', shore: '#287491',
    building: '#205262', outline: '#2b7281', road: '#67cada', casing: '#245769', highway: '#bbf795', light: '#56e0ef',
    ink: '#b4fcf6', halo: '#05202b', roadWidth: 1.3, glow: 0.29, cap: 'butt', dash: [4, 1, 1, 1], font: 'Noto Sans Regular', spacing: 0.12, texture: 'circuit'
  },
  pixel: {
    background: '#6eac6b', district: '#b9976a', park: '#7fb957', forest: '#458457', water: '#4e88c3', shore: '#345b95',
    building: '#db8b67', outline: '#78465a', road: '#e6d19d', casing: '#91734e', highway: '#feb96e', light: '#eed9a2',
    ink: '#2d3d42', halo: '#efdcac', roadWidth: 2.6, glow: 0, cap: 'square', dash: [1, 1], font: 'Noto Sans Bold', spacing: 0.11, texture: 'dither'
  },
  'night-city': {
    background: '#15172d', district: '#26233d', park: '#273148', forest: '#224046', water: '#122145', shore: '#425ac6',
    building: '#554061', outline: '#84577f', road: '#ab9bd6', casing: '#553760', highway: '#ffe296', light: '#ef65aa',
    ink: '#ffe4a5', halo: '#21132b', roadWidth: 1.85, glow: 0.54, cap: 'square', dash: [5, 2, 1, 2], font: 'Noto Sans Bold', spacing: 0.09, texture: 'windows'
  }
};

const osmAttribution = '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap-Mitwirkende</a>';
const satelliteAttribution = '<a href="https://s2maps.eu/">Sentinel-2 cloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)';
const vector = {
  type: 'vector' as const,
  url: 'https://tiles.openfreemap.org/planet',
  attribution: '<a href="https://openfreemap.org/">OpenFreeMap</a> · ' + osmAttribution
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

export function mapPreferences(): MapPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    return {
      kind: MAP_TYPES.find(type => type.id === saved.kind)?.id ?? 'standard',
      style: MAP_STYLES.find(theme => theme.id === (saved.style === undefined ? saved.kind : saved.style))?.id ?? null,
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
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
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

const terrainPatterns: Record<Theme['texture'], (x: number, y: number) => boolean> = {
  stripes: (x, y) => (x + y) % 8 === 0,
  blocks: (x, y) => y % 8 === 0 || x % 8 === (y < 8 ? 0 : 4),
  grain: (x, y) => (x * 17 + y * 23 + x * y) % 31 < 3,
  leaves: (x, y) => (x % 8 === 2 && y % 8 === 2) || (x % 8 === 3 && y % 8 === 3) || (x % 8 === 4 && y % 8 === 2),
  circuit: (x, y) => (x === 4 && y < 12) || (y === 11 && x >= 4) || (x === 11 && y >= 11),
  dither: (x, y) => (x % 4 < 2 && y % 4 < 2) || (x % 4 >= 2 && y % 4 >= 2),
  windows: (x, y) => (y === 4 || y === 10) && x % 6 < 2
};

function mapTexture(theme: Theme) {
  const size = 16;
  const data = new Uint8Array(size * size * 4);
  const ink = theme.glow ? 255 : 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (terrainPatterns[theme.texture](x, y)) data.set([ink, ink, ink, 42], (y * size + x) * 4);
  }
  return { width: size, height: size, data };
}

function tone(color: string, brightness: number): string {
  const rgb = color.slice(1).match(/../g)!;
  return `rgb(${rgb.map(channel => Math.round(parseInt(channel, 16) * brightness)).join(',')})`;
}

const mainRoads = ['motorway', 'trunk', 'primary'];
const paths = ['path', 'track', 'footway', 'cycleway'];
const isClass = (classes: string[]): ExpressionSpecification => ['in', ['get', 'class'], ['literal', classes]];
const roads = ['!', isClass(['rail', 'transit', 'ferry', ...paths])] as ExpressionSpecification;

function themeLayers(theme: Theme, preferences: MapPreferences): LayerSpecification[] {
  const brightness = preferences.brightness / 100;
  const surface = preferences.kind !== 'satellite';
  const colors = (color: string) => tone(color, brightness);
  const fill = (id: string, sourceLayer: string, minzoom: number, paint: FillLayerSpecification['paint'], enabled = surface): FillLayerSpecification => ({
    id, type: 'fill', source: 'openmap', 'source-layer': sourceLayer, minzoom, layout: { visibility: visible(enabled) }, paint
  });
  const line = (id: string, sourceLayer: string, minzoom: number, paint: LineLayerSpecification['paint'], filter?: ExpressionSpecification, enabled = surface): LineLayerSpecification => ({
    id, type: 'line', source: 'openmap', 'source-layer': sourceLayer, minzoom,
    layout: { visibility: visible(enabled), 'line-cap': theme.cap, 'line-join': theme.cap === 'round' ? 'round' : 'miter' },
    ...(filter ? { filter } : {}), paint
  });
  const roadWidth = (extra: number): ExpressionSpecification => [
    'interpolate', ['linear'], ['zoom'],
    7, ['case', isClass(mainRoads), 0.6 + extra / 4, 0.2 + extra / 4],
    14, ['case', isClass(mainRoads), theme.roadWidth * 1.65 + extra, theme.roadWidth + extra],
    19, ['case', isClass(mainRoads), theme.roadWidth * 3 + extra, theme.roadWidth * 1.8 + extra]
  ];
  return [
    fill('theme-district', 'landuse', 5, {
      'fill-color': ['match', ['get', 'class'], ['park', 'cemetery', 'recreation_ground'], colors(theme.park), colors(theme.district)],
      'fill-opacity': 0.7
    }),
    fill('theme-cover', 'landcover', 0, {
      'fill-color': ['match', ['get', 'class'], ['wood', 'forest'], colors(theme.forest), ['farmland', 'grass'], colors(theme.park), colors(theme.district)],
      'fill-opacity': 0.92
    }),
    fill('theme-texture', 'landcover', 9, { 'fill-pattern': theme.texture, 'fill-opacity': brightness }),
    fill('theme-water', 'water', 0, { 'fill-color': colors(theme.water), 'fill-outline-color': colors(theme.shore) }),
    line('theme-waterway', 'waterway', 10, { 'line-color': colors(theme.shore), 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.55, 19, 2.1] }),
    line('theme-boundary', 'boundary', 2, { 'line-color': colors(theme.ink), 'line-opacity': 0.22, 'line-width': 1, 'line-dasharray': theme.dash }, ['<=', ['get', 'admin_level'], 4]),
    fill('theme-public-space', 'landuse', 10, {
      'fill-pattern': theme.texture,
      'fill-opacity': theme.texture === 'leaves' || theme.texture === 'dither' ? .75 : .33
    }, surface && ['leaves', 'dither', 'blocks'].includes(theme.texture)),
    line('theme-transit-halo', 'transportation', 9, {
      'line-color': colors(theme.halo), 'line-width': 5, 'line-opacity': .7, 'line-blur': 1
    }, isClass(['rail', 'transit']), surface && ['windows', 'circuit', 'blocks'].includes(theme.texture)),
    fill('theme-building', 'building', 13, { 'fill-color': colors(theme.building), 'fill-outline-color': colors(theme.outline) }, preferences.kind === 'standard'),
    line('theme-rail', 'transportation', 11, {
      'line-color': colors(theme.texture === 'blocks' || theme.texture === 'windows' ? theme.highway : theme.outline),
      'line-width': theme.texture === 'blocks' ? 2 : 1.1, 'line-dasharray': theme.texture === 'windows' ? [1, 1] : [3, 1.5]
    }, isClass(['rail', 'transit'])),
    line('theme-path', 'transportation', 13, { 'line-color': colors(theme.ink), 'line-opacity': 0.5, 'line-width': 1.1, 'line-dasharray': theme.dash }, isClass(paths)),
    line('theme-road-light', 'transportation', 8, { 'line-color': colors(theme.light), 'line-width': roadWidth(5), 'line-blur': 3, 'line-opacity': theme.glow }, isClass(mainRoads), surface && theme.glow > 0),
    line('theme-road-casing', 'transportation', 7, { 'line-color': colors(theme.casing), 'line-width': roadWidth(1.7), 'line-opacity': surface ? 1 : 0.55 }, roads, true),
    line('theme-road', 'transportation', 7, { 'line-color': colors(theme.road), 'line-width': roadWidth(0), 'line-opacity': surface ? 1 : 0.65 }, roads, true),
    line('theme-highway', 'transportation', 7, { 'line-color': colors(theme.highway), 'line-width': roadWidth(0), 'line-opacity': surface ? 1 : 0.65 }, isClass(mainRoads), true),
    {
      id: 'theme-poi', type: 'circle', source: 'openmap', 'source-layer': 'poi', minzoom: 14,
      layout: { visibility: visible(surface) }, filter: isClass(['park', 'museum', 'town_hall', 'hospital', 'railway', 'school']),
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 1.5, 19, theme.cap === 'round' ? 4 : 3],
        'circle-color': ['match', ['get', 'class'], ['park', 'school'], colors(theme.park), ['railway', 'hospital'], colors(theme.highway), colors(theme.light)],
        'circle-stroke-color': colors(theme.halo), 'circle-stroke-width': theme.glow ? 1.4 : 0.8
      }
    },
    {
      id: 'theme-label', type: 'symbol', source: 'openmap', 'source-layer': 'place', minzoom: 3,
      layout: {
        visibility: visible(surface), 'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-font': [theme.font], 'text-letter-spacing': theme.spacing,
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 15, 15],
        'text-transform': theme.spacing >= 0.11 ? 'uppercase' : 'none',
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 100]
      },
      paint: { 'text-color': colors(theme.ink), 'text-halo-color': colors(theme.halo), 'text-halo-width': theme.glow ? 1.5 : 1 }
    },
    {
      id: 'theme-street-label', type: 'symbol', source: 'openmap', 'source-layer': 'transportation_name', minzoom: 14,
      layout: {
        visibility: visible(surface), 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-font': [theme.font], 'text-letter-spacing': theme.spacing / 2, 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 9, 19, 12]
      },
      paint: { 'text-color': colors(theme.ink), 'text-halo-color': colors(theme.halo), 'text-halo-width': 1 }
    }
  ];
}

export function applyMapPreferences(map: LibreMap, preferences: MapPreferences) {
  if (!map.getLayer('osm')) return;
  const theme = preferences.style ? themes[preferences.style] : null;
  const brightness = preferences.brightness / 100;
  const before = map.getLayer('cities-fill') ? 'cities-fill' : undefined;
  map.setLayoutProperty('osm', 'visibility', visible(standard(preferences)));
  for (const id of ['satellite-overview', 'satellite-street-fallback', 'satellite']) map.setLayoutProperty(id, 'visibility', visible(preferences.kind === 'satellite'));
  for (const id of ['osm', 'satellite-overview', 'satellite-street-fallback', 'satellite']) map.setPaintProperty(id, 'raster-brightness-max', brightness);
  map.setPaintProperty('bg', 'background-color', theme && preferences.kind !== 'satellite' ? tone(theme.background, brightness) : '#172834');

  if ((theme || preferences.kind === 'buildings') && !map.getSource('openmap')) {
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
  if (map.getLayer('buildings')) {
    map.setLayoutProperty('buildings', 'visibility', visible(preferences.kind === 'buildings'));
    map.setPaintProperty('buildings', 'fill-extrusion-color', tone(theme?.building ?? '#23687a', brightness));
  }
  if (!theme) {
    for (const layer of map.getStyle().layers) {
      if (layer.id.startsWith('theme-')) map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
    return;
  }
  if (!map.hasImage(theme.texture)) map.addImage(theme.texture, mapTexture(theme));
  for (const layer of themeLayers(theme, preferences)) {
    if (!map.getLayer(layer.id)) {
      map.addLayer(layer, layer.id === 'theme-label' || layer.id === 'theme-street-label' ? before : 'buildings');
      continue;
    }
    if ('layout' in layer) for (const [property, value] of Object.entries(layer.layout ?? {})) map.setLayoutProperty(layer.id, property, value);
    if ('paint' in layer) for (const [property, value] of Object.entries(layer.paint ?? {})) map.setPaintProperty(layer.id, property, value);
  }
}

export function mapThemePreview(id: MapTheme): string {
  return publicAsset(`map-previews/${id}.webp`);
}

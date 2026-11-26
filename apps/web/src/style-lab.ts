// Entwicklungswerkzeug (nicht Teil des Builds): rendert die echte Karte mit einem Style, für Vorschau- und Vergleichsbilder.
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { applyMapPreferences, mapStyle, type MapKind, type MapTheme } from './geo/map-style';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number) => (q.has(k) ? Number(q.get(k)) : d);
const prefs = {
  kind: (q.get('kind') ?? 'standard') as MapKind, style: (q.get('style') || null) as MapTheme | null, follow: false,
  brightness: num('brightness', 100), bearing: num('bearing', 0), pitch: num('pitch', 0), zoom: num('zoom', 15)
};
const map = new maplibregl.Map({
  container: 'map', center: [num('lon', 10.5267), num('lat', 52.2625)], zoom: prefs.zoom, bearing: prefs.bearing, pitch: prefs.pitch,
  style: mapStyle(prefs), attributionControl: false, fadeDuration: 0, canvasContextAttributes: { preserveDrawingBuffer: true }
} as maplibregl.MapOptions);
const w = window as unknown as Record<string, unknown>;
w.__errors = [] as string[];
map.on('error', e => (w.__errors as string[]).push(String((e as { error?: Error }).error?.message ?? e)));
map.on('load', () => {
  map.addSource('probe', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'cities-fill', type: 'fill', source: 'probe' });
  applyMapPreferences(map, prefs);
  const settle = () => { if (map.loaded() && !map.isMoving()) w.__ready = true; };
  map.on('idle', settle);
  w.__map = map; w.__apply = (p: unknown) => applyMapPreferences(map, { ...prefs, ...(p as object) } as never);
});

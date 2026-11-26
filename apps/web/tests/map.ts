import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import './markers';
import { GEO_ANCHORS, QUESTS } from '@nam/game-data';
import { distanceLabel, questCategory, questPins } from '../src/geo/quest-map';
import { applyMapPreferences, MAP_FONTS, MAP_TYPES, MAP_STYLES, mapThemePreview, mapWorldPreview, mapPreferences, mapStyle, saveMapPreferences, themeLayers } from '../src/geo/map-style';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => storage.get(key),
  setItem: (key: string, value: string) => storage.set(key, value)
} });
assert.equal(mapPreferences().kind, 'standard');
assert.equal(mapPreferences().brightness, 100);
const saved = { kind: 'satellite' as const, style: null, follow: false, brightness: 92, zoom: 15, bearing: 27, pitch: 36 };
storage.set('nam.map.preferences', '{"brightness":83}');
assert.equal(mapPreferences().brightness, 100);
saveMapPreferences({ ...saved, brightness: 83 });
assert.equal(mapPreferences().brightness, 83);
saveMapPreferences(saved);
assert.deepEqual(mapPreferences(), saved);
const satellite = mapStyle(saved);
assert.equal(satellite.layers.find(l => l.id === 'osm')?.layout?.visibility, 'none');
assert.equal(satellite.layers.find(l => l.id === 'satellite')?.layout?.visibility, 'visible');
assert.equal(satellite.layers.find(l => l.id === 'satellite-overview')?.layout?.visibility, 'visible');
assert.ok(satellite.layers.findIndex(l => l.id === 'satellite-overview') < satellite.layers.findIndex(l => l.id === 'satellite'));
assert.ok(satellite.sources.satellite.type === 'raster');
assert.equal(satellite.sources.satellite.maxzoom, 15);
assert.match(satellite.sources.satellite.tiles![0], /layers=s2cloudless-2024_3857.*bbox=\{bbox-epsg-3857\}/i);
assert.ok(satellite.layers.findIndex(l => l.id === 'satellite-overview') < satellite.layers.findIndex(l => l.id === 'satellite-street-fallback'));
assert.ok(satellite.layers.findIndex(l => l.id === 'satellite-street-fallback') < satellite.layers.findIndex(l => l.id === 'satellite'));
storage.set('nam.map.preferences', '{"brightness":null,"zoom":100}');
assert.equal(mapPreferences().zoom, 19);
assert.equal(mapPreferences().brightness, 100);

assert.equal(questCategory.main, 'Hauptgeschichte');
assert.equal(questCategory.side, 'Nebenquest');
const regional = { lat: 52.266, lon: 10.523 };
const rat = { id: 'nearby', k: 'mob' as const, def: 'rat', name: 'Mutierte Ratte', ...regional };
const quest = QUESTS.m2;
const pins = questPins(quest, [1], [rat], regional);
assert.deepEqual(pins.map(p => p.role), ['giver', 'objective', 'turnin']);
assert.equal(pins[1].lat, regional.lat);
assert.ok(pins[1].radius);
assert.equal(questPins(quest, [0], [])[1].lat, GEO_ANCHORS.stadtpark[0]);
assert.deepEqual(questPins(quest, [5], [rat]).map(p => p.role), ['giver', 'turnin']);
assert.match(distanceLabel(1150), /^1,[12] km$/);
const region = { ...regional, radius: 90, label: 'Regionales Erkundungsgebiet', virtualOnly: true };
const regionalPins = questPins(QUESTS.d_regional, [0], [], regional, region);
const regionalObjective = regionalPins.find(pin => pin.role === 'objective');
assert.equal(regionalObjective?.name, region.label);
assert.equal(regionalObjective?.radius, 90);
assert.equal(regionalObjective?.virtualOnly, true);
console.log('✓ Kartentyp, Helligkeit, Kameraeinstellungen, lokalisierte Questrollen und regionale Zielwahl');

storage.set('nam.map.preferences', '{"kind":"vintage","zoom":13}');
assert.equal(mapPreferences().kind, 'standard');
assert.equal(mapPreferences().style, 'frontier');
assert.equal(mapPreferences().zoom, 13);
// Migration früherer Style-IDs auf Nachfolger
for (const [old, next] of Object.entries({ urban: 'metro-noir', vintage: 'frontier', adventure: 'west-coast', cyber: 'neon-district', pixel: 'pixel-adventure', 'night-city': 'neon-district', underground: 'underground' })) {
  storage.set('nam.map.preferences', JSON.stringify({ kind: 'standard', style: old, version: 2 }));
  assert.equal(mapPreferences().style, next, old);
}
storage.set('nam.map.preferences', '{"kind":"standard","style":"unbekannt"}');
assert.equal(mapPreferences().style, null);

assert.equal(MAP_STYLES.length, 6);
const contract = ['theme-landcover', 'theme-landuse', 'theme-water', 'theme-waterway', 'theme-boundary', 'theme-building', 'theme-rail', 'theme-path',
  'theme-road-minor', 'theme-road-secondary', 'theme-road-primary', 'theme-road-motorway', 'theme-label', 'theme-label-country', 'theme-street-label', 'theme-poi'];
const signatures = new Set<string>();
const roadColors = new Set<string>();
const fonts = new Set<string>();
const idSets = new Set<string>();
for (const { id: kind } of MAP_TYPES) for (const { id: style } of MAP_STYLES) {
  const preferences = { ...saved, kind, style };
  saveMapPreferences(preferences);
  assert.deepEqual(mapPreferences(), preferences);
  const layers = new Map<string, any>(mapStyle(saved).layers.map(layer => [layer.id, layer]));
  layers.set('cities-fill', { id: 'cities-fill' });
  layers.set('quest-line', { id: 'quest-line', layout: { visibility: 'visible' } });
  const sourceIds = new Set<string>();
  const images = new Set<string>();
  const fakeMap = {
    getLayer: (id: string) => layers.get(id),
    getStyle: () => ({ layers: [...layers.values()] }),
    getSource: (id: string) => sourceIds.has(id),
    addSource: (id: string) => sourceIds.add(id),
    addLayer: (layer: any, before: string) => {
      assert.ok(!layers.has(layer.id), `${layer.id} doppelt`);
      const entries = [...layers.entries()];
      const index = entries.findIndex(([id]) => id === before);
      assert.ok(index >= 0, `${layer.id} must be below gameplay layers`);
      entries.splice(index, 0, [layer.id, layer]);
      layers.clear();
      for (const [id, layer] of entries) layers.set(id, layer);
    },
    removeLayer: (id: string) => layers.delete(id),
    hasImage: (id: string) => images.has(id),
    addImage: (id: string) => images.add(id),
    removeImage: (id: string) => images.delete(id),
    setPaintProperty: (id: string, prop: string, value: unknown) => (layers.get(id).paint ??= {})[prop] = value,
    setLayoutProperty: (id: string, prop: string, value: unknown) => (layers.get(id).layout ??= {})[prop] = value
  };
  applyMapPreferences(fakeMap as any, preferences);
  assert.equal(layers.get('quest-line').layout.visibility, 'visible');
  assert.equal(layers.get('satellite').layout.visibility, kind === 'satellite' ? 'visible' : 'none');
  assert.equal(layers.get('osm').layout.visibility, 'none');
  assert.equal(layers.get('satellite-street-fallback').layout.visibility, kind === 'satellite' ? 'visible' : 'none');
  assert.equal(layers.get('buildings').layout.visibility, kind === 'buildings' ? 'visible' : 'none');
  assert.ok(layers.get('buildings').paint['fill-extrusion-color'], 'Gebäudematerial pro Style');
  const ids = [...layers.keys()];
  const themeIds = ids.filter(id => id.startsWith('theme-'));
  assert.ok(themeIds.every(id => ids.indexOf(id) < ids.indexOf('cities-fill')), 'Spiel-Layer bleiben oben');
  if (kind === 'satellite') {
    // nur Overlay: Straßen, Grenzen, Beschriftung – keine Flächen oder Gebäude
    assert.ok(!layers.has('theme-landuse') && !layers.has('theme-water') && !layers.has('theme-building'));
    for (const id of ['theme-road-primary', 'theme-boundary', 'theme-label', 'theme-street-label']) assert.ok(layers.has(id), id + ' im Satelliten-Overlay');
    assert.equal(layers.get('bg').paint['background-color'], '#172834');
  } else {
    for (const id of contract) assert.ok(layers.has(id) || (id === 'theme-building' && kind === 'buildings'), `${style}: ${id}`);
    assert.equal(layers.has('theme-building'), kind === 'standard');
  }
  if (kind === 'standard') {
    roadColors.add(JSON.stringify(layers.get('theme-road-primary').paint['line-color']));
    fonts.add(JSON.stringify(layers.get('theme-label').layout['text-font']));
    signatures.add(JSON.stringify([layers.get('theme-road-primary').layout['line-cap'], layers.get('theme-road-primary').paint['line-width'], layers.get('theme-boundary').paint['line-color']]));
    idSets.add(themeIds.join());
    assert.ok(themeIds.length > 30, `${style}: vollständiges Designsystem`);
  }
  // Helligkeit ändern: gleiche Layer, neue Farben
  applyMapPreferences(fakeMap as any, { ...preferences, brightness: 60 });
  assert.equal(ids.length, [...layers.keys()].length);
  // Style-Wechsel entfernt Layer des alten Styles vollständig
  const other = MAP_STYLES.find(entry => entry.id !== style)!.id;
  applyMapPreferences(fakeMap as any, { ...preferences, style: other });
  assert.equal(layers.get('quest-line').layout.visibility, 'visible');
  applyMapPreferences(fakeMap as any, { ...preferences, style: null });
  assert.ok(![...layers.keys()].some(id => id.startsWith('theme-')), 'alle Style-Layer entfernt');
  assert.equal(images.size, 0, 'Sprites entfernt');
  assert.equal(layers.get('osm').layout.visibility, kind === 'satellite' ? 'none' : 'visible');
}
assert.equal(MAP_TYPES.length, 3);
assert.equal(roadColors.size, 6);
assert.equal(fonts.size, 6);
assert.equal(signatures.size, 6);
assert.equal(idSets.size, 6, 'jeder Style hat eigenen Layeraufbau');
assert.equal(new Set(MAP_STYLES.map(({ id }) => mapThemePreview(id))).size, 6);
for (const { id } of MAP_STYLES) {
  for (const file of [mapThemePreview(id), mapWorldPreview(id)]) {
    const preview = readFileSync(new URL('../public' + file, import.meta.url));
    assert.equal(preview.toString('ascii', 8, 12), 'WEBP');
  }
}
// Alle verwendeten Schriftstapel liegen lokal vor
const used = new Set<string>();
for (const { id } of MAP_STYLES) for (const layer of themeLayers(id, saved as any)) for (const f of (layer.layout as any)?.['text-font'] ?? []) used.add(f);
for (const font of used) assert.ok(MAP_FONTS.includes(font), font);
for (const font of MAP_FONTS) assert.ok(existsSync(new URL(`../public/fonts/${font}/0-255.pbf`, import.meta.url)), font);
console.log('✓ 18 Kartenkombinationen und Migration bisheriger Kartenstile');

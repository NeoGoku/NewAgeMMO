import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './markers';
import { GEO_ANCHORS, QUESTS } from '@nam/game-data';
import { distanceLabel, questCategory, questPins } from '../src/geo/quest-map';
import { applyMapPreferences, MAP_TYPES, MAP_STYLES, mapThemePreview, mapPreferences, mapStyle, saveMapPreferences } from '../src/geo/map-style';

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
assert.equal(satellite.sources.satellite.maxzoom, 12);
assert.match(satellite.sources.satellite.tiles![0], /Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual\/default\/1999-01-02\/GoogleMapsCompatible_Level12\/\{z\}\/\{y\}\/\{x\}\.jpg$/);
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
assert.equal(mapPreferences().style, 'vintage');
assert.equal(mapPreferences().zoom, 13);

const paints = new Set<string>();
const structures = new Set<string>();
assert.ok(MAP_STYLES.some(({ id }) => id === 'pixel'));
assert.ok(MAP_STYLES.some(({ id }) => id === 'night-city'));
for (const { id: kind } of MAP_TYPES) for (const { id: style } of MAP_STYLES) {
  const preferences = { ...saved, kind, style };
  saveMapPreferences(preferences);
  assert.deepEqual(mapPreferences(), preferences);
  const layers = new Map<string, any>(mapStyle(saved).layers.map(layer => [layer.id, layer]));
  layers.set('cities-fill', { id: 'cities-fill' });
  layers.set('quest-line', { id: 'quest-line', layout: { visibility: 'visible' } });
  const sourceIds = new Set<string>();
  const fakeMap = {
    getLayer: (id: string) => layers.get(id),
    getStyle: () => ({ layers: [...layers.values()] }),
    getSource: (id: string) => sourceIds.has(id),
    addSource: (id: string) => sourceIds.add(id),
    addLayer: (layer: any, before: string) => {
      const entries = [...layers.entries()];
      const index = entries.findIndex(([id]) => id === before);
      assert.ok(index >= 0, `${layer.id} must be below gameplay layers`);
      entries.splice(index, 0, [layer.id, layer]);
      layers.clear();
      for (const [id, layer] of entries) layers.set(id, layer);
    },
    hasImage: () => false,
    addImage: () => undefined,
    setPaintProperty: (id: string, prop: string, value: unknown) => (layers.get(id).paint ??= {})[prop] = value,
    setLayoutProperty: (id: string, prop: string, value: unknown) => (layers.get(id).layout ??= {})[prop] = value
  };
  applyMapPreferences(fakeMap as any, preferences);
  assert.equal(layers.get('quest-line').layout.visibility, 'visible');
  assert.equal(layers.get('satellite').layout.visibility, kind === 'satellite' ? 'visible' : 'none');
  assert.equal(layers.get('osm').layout.visibility, 'none');
  assert.equal(layers.get('buildings').layout.visibility, kind === 'buildings' ? 'visible' : 'none');
  assert.equal(layers.get('theme-road').layout.visibility, 'visible');
  assert.equal(layers.get('theme-building').layout.visibility, kind === 'standard' ? 'visible' : 'none');
  paints.add(layers.get('theme-road').paint['line-color']);
  structures.add(JSON.stringify([
    layers.get('theme-road').layout['line-cap'],
    layers.get('theme-path').paint['line-dasharray'],
    layers.get('theme-label').layout['text-font'],
    layers.get('theme-texture').paint['fill-pattern']
  ]));
  applyMapPreferences(fakeMap as any, { ...preferences, style: null });
  assert.equal(layers.get('theme-road').layout.visibility, 'none');
  assert.equal(layers.get('osm').layout.visibility, kind === 'satellite' ? 'none' : 'visible');
}
assert.equal(MAP_TYPES.length, 3);
assert.equal(paints.size, 7);
assert.equal(structures.size, 7);
assert.equal(new Set(MAP_STYLES.map(({ id }) => mapThemePreview(id))).size, 7);
for (const { id } of MAP_STYLES) {
  const preview = readFileSync(new URL('../public' + mapThemePreview(id), import.meta.url));
  assert.equal(preview.toString('ascii', 8, 12), 'WEBP');
}
console.log('✓ 21 Kartenkombinationen und Migration bisheriger Kartenstile');

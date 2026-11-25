import assert from 'node:assert/strict';
import { GEO_ANCHORS, QUESTS } from '@nam/game-data';
import { distanceLabel, questCategory, questPins } from '../src/geo/quest-map';
import { applyMapPreferences, MAP_DESIGNS, mapPreferences, mapStyle, saveMapPreferences } from '../src/geo/map-style';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => storage.get(key),
  setItem: (key: string, value: string) => storage.set(key, value)
} });
assert.equal(mapPreferences().kind, 'standard');
assert.ok(mapPreferences().brightness > 50, 'standard brightness must not clip the basemap at half');
const saved = { kind: 'satellite' as const, brightness: 92, zoom: 15, bearing: 27, pitch: 36 };
saveMapPreferences(saved);
assert.deepEqual(mapPreferences(), saved);
const satellite = mapStyle(saved);
assert.equal(satellite.layers.find(l => l.id === 'osm')?.layout?.visibility, 'none');
assert.equal(satellite.layers.find(l => l.id === 'satellite')?.layout?.visibility, 'visible');
storage.set('nam.map.preferences', '{"brightness":null,"zoom":100}');
assert.equal(mapPreferences().zoom, 19);
assert.equal(mapPreferences().brightness, 83);

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

const paints = new Set<string>();
for (const design of MAP_DESIGNS) {
  saveMapPreferences({ ...saved, kind: design.id });
  assert.deepEqual(mapPreferences(), { ...saved, kind: design.id });
  const layers = new Map<string, any>(mapStyle(saved).layers.map(layer => [layer.id, layer]));
  layers.set('quest-line', { id: 'quest-line', layout: { visibility: 'visible' } });
  const sourceIds = new Set<string>();
  const fakeMap = {
    getLayer: (id: string) => layers.get(id),
    getSource: (id: string) => sourceIds.has(id),
    addSource: (id: string) => sourceIds.add(id),
    addLayer: (layer: any) => layers.set(layer.id, layer),
    setPaintProperty: (id: string, prop: string, value: unknown) => (layers.get(id).paint ??= {})[prop] = value,
    setLayoutProperty: (id: string, prop: string, value: unknown) => (layers.get(id).layout ??= {})[prop] = value
  };
  applyMapPreferences(fakeMap as any, { ...saved, kind: design.id });
  assert.equal(layers.get('quest-line').layout.visibility, 'visible');
  assert.equal(layers.get('satellite').layout.visibility, design.id === 'satellite' ? 'visible' : 'none');
  if (layers.get('theme-road')?.layout.visibility === 'visible') paints.add(layers.get('theme-road').paint['line-color']);
}
assert.equal(MAP_DESIGNS.length, 8);
assert.equal(paints.size, 5, 'each original theme has its own road palette');

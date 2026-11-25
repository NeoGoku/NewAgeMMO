import assert from 'node:assert/strict';
import { GEO_ANCHORS, QUESTS } from '@nam/game-data';
import { distanceLabel, questCategory, questPins } from '../src/geo/quest-map';
import { mapPreferences, mapStyle, saveMapPreferences } from '../src/geo/map-style';

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
console.log('✓ Kartentyp, Helligkeit, Kameraeinstellungen, lokalisierte Questrollen und regionale Zielwahl');

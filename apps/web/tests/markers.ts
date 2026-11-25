import assert from 'node:assert/strict';
import type { GeoObj } from '@nam/shared';
import { clusterMarkers, markerCategories, propertyMarkerStatus, propertyMarkerType } from '../src/geo/map-markers';

const mob: GeoObj = { id: 'mob', k: 'mob', def: 'rat', name: 'Ratte', lat: 52, lon: 10 };
assert.deepEqual(markerCategories(mob), ['mob']);
assert.deepEqual(markerCategories({ ...mob, role: 'boss' }), ['boss']);
assert.deepEqual(markerCategories({ ...mob, role: 'elite' }), ['elite']);
assert.deepEqual(markerCategories({ ...mob, k: 'npc', def: 'torben' }), ['merchant']);
assert.ok(markerCategories({ ...mob, k: 'npc', def: 'schmied' }).includes('craft'));
assert.ok(markerCategories({ ...mob, k: 'npc', def: 'mira' }).includes('questGiver'));
assert.deepEqual(markerCategories({ ...mob, k: 'house', def: 'guild' }), ['guildHouse']);
assert.deepEqual(markerCategories({ ...mob, k: 'territory', def: 'territory', r: 150 }), ['territory']);
assert.deepEqual(markerCategories({ ...mob, k: 'house', def: 'property', extra: { source: 'OpenStreetMap' } }), ['property']);
assert.equal(propertyMarkerStatus('sale')?.label, 'Kauf verfügbar');
assert.equal(propertyMarkerStatus(undefined), undefined);
assert.equal(propertyMarkerType('apartments').label, 'Wohngebäude');
assert.equal(propertyMarkerType('office').label, 'Gewerbeimmobilie');
assert.equal(propertyMarkerType('house').label, 'Haus');
assert.equal(propertyMarkerType('land').label, 'Immobilie');

const points = [
  { ...mob, id: 'a', radius: 15 },
  { ...mob, id: 'b', lat: 52.001, lon: 10.001, radius: 15 },
  { ...mob, id: 'c', lat: 52.007, lon: 10.002, radius: 15 },
];
const project = (scale: number) => (lon: number, lat: number) => ({ x: (lon - 10) * scale, y: (lat - 52) * scale });
const zoomedOut = clusterMarkers(points, project(10000), 10);
assert.deepEqual(zoomedOut.map(group => group.members.map(point => point.id)), [['a', 'b'], ['c']]);
assert.ok(Math.abs(zoomedOut[0].lat - 52.0005) < 1e-9);
assert.ok(Math.abs(zoomedOut[0].lon - 10.0005) < 1e-9);
assert.deepEqual(clusterMarkers(points.slice().reverse(), project(10000), 10), zoomedOut);
const zoomedIn = clusterMarkers(points, project(100000), 10);
assert.deepEqual(zoomedIn.map(({ members, lat, lon }) => [members[0].id, lat, lon]), points.map(({ id, lat, lon }) => [id, lat, lon]));
assert.equal(clusterMarkers([points[0], { ...points[0], id: 'd' }], project(1000000), 10)[0].members.length, 2);
const overlappingCluster = [points[0], { ...points[1], lat: 52, lon: 10.0035 }, { ...points[2], lat: 52, lon: 10.0048 }];
assert.equal(clusterMarkers(overlappingCluster, project(10000), 10).length, 1, 'cluster center must not overlap a remaining marker');
const acrossDateLine = [{ ...points[0], lon: 179.999 }, { ...points[1], lon: -179.999 }];
const wrappedGroup = clusterMarkers(acrossDateLine, (lon, lat) => ({ x: (lon - 180) * 10000, y: (lat - 52) * 10000 }), 180);
assert.equal(wrappedGroup.length, 1);
assert.ok(Math.abs(wrappedGroup[0].lon - 180) < 1e-9);
console.log('✓ Geografische Markergruppen, Zoom, Datumsgrenze und Kategorien');

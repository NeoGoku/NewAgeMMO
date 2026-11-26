import assert from 'node:assert/strict';
import type { GeoObj, GeoPropertyOffer } from '@nam/shared';
import { clusterMarkers, markerCategories, propertyMarkerStatus, propertyMarkerType } from '../src/geo/map-markers';
import { defaultPropertyFilters, matchesProperty } from '../src/geo/property-filter';

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
assert.equal(propertyMarkerStatus('sale', 1000)?.label, 'Kauf oder Miete verfügbar');
assert.equal(propertyMarkerStatus('rentable')?.label, 'Miete verfügbar');
assert.equal(propertyMarkerStatus(undefined), undefined);
assert.equal(propertyMarkerType('apartments').label, 'Wohngebäude');
assert.equal(propertyMarkerType('office').label, 'Gewerbeimmobilie');
assert.equal(propertyMarkerType('house').label, 'Haus');
assert.equal(propertyMarkerType('land').label, 'Immobilie');

const offer: GeoPropertyOffer = {
  id: 'property:osm:way:3', osmId: 'way/3', building: 'apartments', lat: 52, lon: 10,
  status: 'available', marketStatus: 'sale', areaM2: 55, buyGold: 20000, rentGold: 1000, footprintM2: 150, floorAreaM2: 450,
  unitAreaM2: 55, estimatedRooms: 3, levels: 3, levelsEstimated: false, distanceM: 120,
};
const offerMarker: GeoObj = { ...mob, id: offer.id, k: 'house', def: 'property', extra: {
  building: 'apartments', marketStatus: 'sale', buyGold: 20000, rentGold: 1000, areaM2: 55,
} };
for (const candidate of [offer, offerMarker]) {
  const filters = { ...defaultPropertyFilters, types: ['flat'] as const, modes: ['rent'] as const,
    maxPrice: '1000', minArea: '55', maxDistance: '120' };
  assert.equal(matchesProperty(candidate, filters, 120), true, 'rentals use the weekly price and apartment size');
  assert.equal(matchesProperty(candidate, { ...filters, modes: ['buy'] }, 120), false, 'buy uses the purchase price');
  assert.equal(matchesProperty(candidate, { ...filters, modes: ['buy'], maxPrice: '20000' }, 120), true);
  assert.equal(matchesProperty(candidate, { ...filters, minArea: '56' }, 120), false);
  assert.equal(matchesProperty(candidate, { ...filters, maxDistance: '119' }, 120), false);
  assert.equal(matchesProperty(candidate, { ...filters, types: ['house'] }, 120), false);
}
assert.equal(matchesProperty({ ...offerMarker, extra: { marketStatus: 'sale' } }, { ...defaultPropertyFilters, maxPrice: '1000' }), false, 'missing prices are not zero');
assert.equal(matchesProperty({ ...offer, status: 'mine', marketStatus: 'rent', rentUntil: 1000 }, { ...defaultPropertyFilters, modes: ['mine'] }), true);
assert.equal(matchesProperty({ ...offerMarker, extra: { ...offerMarker.extra, marketStatus: 'owned' } }, { ...defaultPropertyFilters, modes: ['rent'] }), false);
const rentOnly = { ...offerMarker, extra: { ...offerMarker.extra, marketStatus: 'rentable' } };
assert.equal(matchesProperty(rentOnly, { ...defaultPropertyFilters, modes: ['rent'] }), true);
assert.equal(matchesProperty(rentOnly, { ...defaultPropertyFilters, modes: ['buy'] }), false);
assert.equal(matchesProperty({ ...offer, marketStatus: 'rentable' }, { ...defaultPropertyFilters, modes: ['buy'] }), false);
const plot = { ...offerMarker, extra: { building: 'virtual_plot', marketStatus: 'plot', buyGold: 2000, areaM2: 150 } };
assert.equal(matchesProperty(plot, { ...defaultPropertyFilters, modes: ['buy'], types: ['plot'] }), true);
assert.equal(matchesProperty(plot, { ...defaultPropertyFilters, modes: ['rent'], types: ['plot'] }), false);

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

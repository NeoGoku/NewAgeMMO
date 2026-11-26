import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCore, type SockLike } from '../src/core';
import { MemoryStore } from '../src/store';
import { G } from '../src/state';
import { RegionalProperties } from '../src/geo-property-regions';
import { PropertyCatalog } from '../src/geo-property-data';
import { readPropertyCatalog } from '../src/property-file';

const square = [
  [10.5268, 52.2689], [10.5269, 52.2689], [10.5269, 52.2690],
  [10.5268, 52.2690], [10.5268, 52.2689],
];
// Synthetic geometry used only to exercise the import and transaction boundaries.
const feature = {
  type: 'Feature', id: 'way/1234', properties: { building: 'residential', 'building:levels': '2' },
  geometry: { type: 'Polygon', coordinates: [square] },
};
const catalog = {
  type: 'FeatureCollection', source: 'OpenStreetMap', osmSnapshot: '2026-08-01T00:00:00Z',
  features: [feature, { ...feature, id: 'way/1235', properties: { landuse: 'greenfield' },
    geometry: { type: 'Polygon', coordinates: [square.map(([lon, lat]) => [lon + .0003, lat])] } }],
};
const location = { lat: 52.26895, lon: 10.52685 };

class Socket implements SockLike {
  readyState = 1;
  messages: any[] = [];
  private pending = new Map<number, (reply: any) => void>();
  private next = 0;
  private handler!: (raw: string) => void;
  send(raw: string) {
    const msg = JSON.parse(raw);
    this.messages.push(msg);
    this.pending.get(msg.rid)?.(msg);
    this.pending.delete(msg.rid);
  }
  close() { this.readyState = 3; }
  on(event: 'message' | 'close', fn: (raw: string) => void) {
    if (event === 'message') this.handler = fn;
  }
  req(t: string, args = {}) {
    const rid = ++this.next;
    return new Promise<any>(resolve => {
      this.pending.set(rid, resolve);
      this.handler(JSON.stringify({ t, rid, ...args }));
    });
  }
}

assert.throws(() => new PropertyCatalog({ ...catalog, source: 'Unknown' }), /Herkunft/);
assert.throws(() => new PropertyCatalog({ ...catalog, features: [feature, feature] }), /Doppeltes OSM/);
assert.throws(() => new PropertyCatalog({
  ...catalog, features: [{ ...feature, geometry: { ...feature.geometry, coordinates: [square.map(([lon, lat]) => [lon + 1, lat])] } }],
}), /keine gültigen Wohngebäude/);

const regional = new RegionalProperties('https://example.invalid/overpass', async (_url, init) => {
  assert.match(String(init?.body), /building/);
  return Response.json({ generator: 'Overpass API test', elements: [{
    type: 'way', id: 4556, tags: { building: 'commercial' },
    geometry: square.map(([lon, lat]) => ({ lon: lon - 11, lat: lat - 1 })),
  }] });
});
await regional.load(location.lat - 1, location.lon - 11);
assert.equal(regional.at(location.lat - 1, location.lon - 11)?.buildings.get('property:osm:way:4556')?.building, 'commercial');
assert.equal(regional.at(location.lat, location.lon), undefined);

const directory = await mkdtemp(path.join(os.tmpdir(), 'nam-property-'));
const filename = path.join(directory, 'braunschweig.geojson');
let imported: unknown;
try {
  await writeFile(filename, JSON.stringify(catalog));
  imported = await readPropertyCatalog(filename);
} finally {
  await rm(directory, { recursive: true, force: true });
}

class FailableStore extends MemoryStore {
  failNextFlush = false;
  async flush() {
    if (!this.failNextFlush) return;
    this.failNextFlush = false;
    throw new Error('test persistence failure');
  }
}

const store = new FailableStore();
const core = await createCore(store, { propertyCatalog: imported });
let buyerId = '';
let restoredTenantId = '';
try {
  const player = async (name: string) => {
    const socket = new Socket();
    core.onConnection(socket);
    assert.equal((await socket.req('register', { user: name, pass: 'a-password' })).t, 'ok');
    const { id } = await socket.req('createChar', {
      name, cls: 'archer',
      look: { gender: 'm', face: 1, body: 1, hair: 2, hairColor: '#aa3311', tattoo: 0, skin: '#e0b090' },
    });
    assert.equal((await socket.req('enter', { id })).t, 'ok');
    const active = G.players.get(id)!;
    active.c.gold = 10000;
    await socket.req('geoConsent', { on: true, gps: false });
    return { socket, active };
  };
  let a = await player('MaklerOne');
  let b = await player('MaklerTwo');
  const contender = await player('MaklerThree');
  Object.assign(contender.active.geo!, location);
  const id = 'property:osm:way:1234';
  const details = await a.socket.req('geoPropertyList', { id });
  assert.equal(details.t, 'ok', 'the configured OSM footprint is visible in the catalog');
  const offer = details.list[0];
  assert.equal(offer.id, id);
  assert.equal(offer.footprintM2, 76);
  assert.equal(offer.floorAreaM2, 152);
  assert.equal(offer.estimatedRooms, 5);
  assert.deepEqual(offer.footprint, feature.geometry);
  assert.equal(offer.levelsEstimated, false);
  assert.equal((await a.socket.req('geoPropertyBuy', { id })).t, 'err', 'remote purchase must fail');
  for (const { active } of [a, b]) Object.assign(active.geo!, location);
  store.failNextFlush = true;
  assert.equal((await a.socket.req('geoPropertyBuy', { id })).t, 'err');
  assert.equal(a.active.c.gold, 10000, 'failed purchase refunds gold');
  assert.equal((await store.get('chars', a.active.id)).geoProperty, undefined, 'failed purchase restores the persisted claim');
  const [buy, race] = await Promise.all([
    a.socket.req('geoPropertyBuy', { id, price: 1, lat: 1, lon: 1 }),
    b.socket.req('geoPropertyBuy', { id, price: 1, lat: 1, lon: 1 }),
  ]);
  assert.deepEqual([buy.t, race.t].sort(), ['err', 'ok'], 'exactly one concurrent request can buy the same footprint');
  if (race.t === 'ok') [a, b] = [b, a];
  assert.equal(a.active.c.gold, 10000 - offer.buyGold, 'server price overrides client values');
  assert.equal((await store.get('chars', a.active.id)).geoProperty.id, id, 'ownership is durable when purchase succeeds');
  assert.equal((await b.socket.req('geoPropertyTravel', { id })).t, 'err', 'non-owner cannot travel to the property');
  a.active.geo!.gps = true;
  assert.equal((await a.socket.req('geoPropertyTravel', { id })).t, 'err', 'fast travel cannot move a GPS player');
  a.active.geo!.gps = false;
  a.active.geo!.lat += 0.05;
  assert.equal((await a.socket.req('geoPropertyTravel', { id })).t, 'ok');
  assert.ok(Math.abs(a.active.geo!.lat - location.lat) < 0.000001);
  const houseId = a.active.c.houseId!;
  assert.equal((await a.socket.req('houseEnter', { id: houseId })).t, 'ok', 'the purchased property has a usable interior');
  assert.equal((await a.socket.req('geoPropertySell', { id })).t, 'err', 'an occupied property cannot be sold');
  const housingLoc = a.active.loc;
  await a.socket.req('houseLeave');
  assert.equal(a.active.loc, housingLoc, 'leaving the interior resumes the same geographic area');
  store.failNextFlush = true;
  assert.equal((await a.socket.req('geoPropertySell', { id })).t, 'err');
  assert.equal(a.active.c.gold, 10000 - offer.buyGold, 'failed sale rolls back credit');
  assert.equal((await store.get('chars', a.active.id)).geoProperty.id, id, 'failed sale preserves stored ownership');
  const sale = await a.socket.req('geoPropertySell', { id, price: 1000000 });
  assert.equal(sale.t, 'ok');
  assert.ok(sale.gold < offer.buyGold && sale.gold > 0);
  assert.equal(a.active.c.gold, 10000 - offer.buyGold + sale.gold);
  assert.equal((await store.get('chars', a.active.id)).geoProperty, undefined);
  assert.equal((await a.socket.req('geoPropertySell', { id })).t, 'err', 'the same property cannot be sold twice');
  {
    // Geografische Vermietung: Wochenmiete serverseitig, Beenden ohne Erstattung, Ablauf nur bei leerer Immobilie
    const gold = a.active.c.gold;
    const listed = (await a.socket.req('geoPropertyList', { id })).list[0];
    assert.ok(listed.rentGold > 0 && listed.rentGold < listed.buyGold, 'Mietpreis kommt vom Server');
    assert.equal((await a.socket.req('geoPropertyRent', { id, rentGold: 1 })).t, 'ok');
    assert.equal(a.active.c.gold, gold - listed.rentGold, 'Client-Preis wird ignoriert');
    assert.ok(a.active.c.geoProperty!.rentUntil! > Date.now(), 'Mietvertrag hat Ablaufzeit');
    assert.equal((await store.get('chars', a.active.id)).geoProperty.rentUntil, a.active.c.geoProperty!.rentUntil, 'Mietvertrag ist gespeichert');
    assert.equal((await b.socket.req('geoPropertyRent', { id })).t, 'err', 'vermietete Immobilie ist vergeben');
    assert.equal((await a.socket.req('geoPropertyRenew', { id })).t, 'ok');
    assert.equal((await a.socket.req('geoPropertyRenew', { id })).t, 'ok');
    assert.equal((await a.socket.req('geoPropertyRenew', { id })).t, 'ok');
    assert.equal((await a.socket.req('geoPropertyRenew', { id })).t, 'err', 'höchstens vier Wochen im Voraus');
    a.active.c.geoProperty!.rentUntil = Date.now() - 1000;
    const expired = await a.socket.req('geoPropertyList', { id });
    assert.equal(a.active.c.geoProperty, undefined, 'abgelaufene, leere Miete wird freigegeben');
    assert.equal(expired.t, 'ok');
    assert.equal((await a.socket.req('geoPropertyRent', { id })).t, 'ok');
    const before = a.active.c.gold;
    assert.equal((await a.socket.req('geoPropertySell', { id })).t, 'ok');
    assert.equal(a.active.c.gold, before, 'Mietvertrag endet ohne Erstattung');
  }
  assert.equal((await b.socket.req('geoPropertyBuy', { id })).t, 'ok', 'sold property becomes available again');
  const tenantGold = a.active.c.gold;
  assert.equal((await a.socket.req('geoPropertyLeaseOffer', { id, on: true })).t, 'err', 'a visitor cannot advertise another owner’s house');
  assert.equal((await b.socket.req('geoPropertyLeaseOffer', { id, on: true })).t, 'ok', 'the owner advertises the property');
  const rental = (await a.socket.req('geoPropertyList', { id })).list[0];
  assert.equal(rental.marketStatus, 'rentable');
  assert.equal((await a.socket.req('geoPropertyBuy', { id })).t, 'err', 'the owner listing offers only a lease');
  store.failNextFlush = true;
  assert.equal((await a.socket.req('geoPropertyRent', { id })).t, 'err');
  assert.equal(a.active.c.gold, tenantGold, 'a failed payment leaves both characters unchanged');
  assert.equal((await store.get('chars', b.active.id)).mail.length, 0);
  const [firstTenant, secondTenant] = await Promise.all([
    a.socket.req('geoPropertyRent', { id, rentGold: 1 }),
    contender.socket.req('geoPropertyRent', { id, rentGold: 1 }),
  ]);
  assert.deepEqual([firstTenant.t, secondTenant.t].sort(), ['err', 'ok'], 'the same private offer cannot be leased twice');
  const renting = firstTenant.t === 'ok' ? a : contender;
  const previousGold = renting === a ? tenantGold : 10000;
  assert.equal(renting.active.c.gold, previousGold - rental.rentGold);
  assert.equal((await store.get('chars', renting.active.id)).geoLease.ownerId, b.active.id);
  assert.equal((await store.get('chars', b.active.id)).mail[0].gold, rental.rentGold);
  assert.equal((await b.socket.req('houseEnter', { id: b.active.c.houseId })).t, 'err', 'landlord access is suspended during the lease');
  assert.equal((await renting.socket.req('houseEnter', { id: renting.active.c.houseId })).t, 'ok');
  const leaseHouse = G.houses.get(renting.active.c.houseId!)!;
  assert.notEqual(leaseHouse.id, b.active.c.houseId);
  await renting.socket.req('houseLeave');
  leaseHouse.garden = { plantedAt: Date.now() };
  assert.equal((await renting.socket.req('geoPropertyEndLease', { id })).t, 'err', 'tenant items or garden cannot be lost at lease end');
  assert.equal((await b.socket.req('geoPropertyLeaseOffer', { id, on: false })).t, 'ok', 'owner can withdraw without evicting the tenant');
  assert.equal((await renting.socket.req('geoPropertyRenew', { id })).t, 'ok', 'current lease retains its agreed renewal terms');
  assert.equal((await store.get('chars', b.active.id)).mail.length, 2);
  leaseHouse.garden = null;
  assert.equal((await renting.socket.req('geoPropertyEndLease', { id })).t, 'ok');
  assert.equal(renting.active.c.geoLease, undefined);
  assert.equal((await renting.socket.req('geoPropertyRent', { id })).t, 'err', 'the withdrawn offer is unavailable when the lease ends');
  assert.equal((await b.socket.req('geoPropertyLeaseOffer', { id, on: true })).t, 'ok');
  assert.equal((await contender.socket.req('geoPropertyRent', { id })).t, 'ok');
  restoredTenantId = contender.active.id;
  const plotId = 'property:osm:way:1235';
  const plot = (await a.socket.req('geoPropertyList', { id: plotId })).list[0];
  assert.equal(plot.building, 'virtual_plot');
  assert.equal(plot.floorAreaM2, 0);
  assert.equal((await a.socket.req('geoPropertyBuy', { id: plotId })).t, 'ok');
  const plotHouse = a.active.c.houseId;
  assert.equal((await a.socket.req('houseEnter', { id: plotHouse })).t, 'err', 'a bare plot cannot be entered');
  assert.equal((await b.socket.req('geoPropertyBuild', { id: plotId })).t, 'err', 'only the owner can build');
  store.failNextFlush = true;
  const beforeBuild = a.active.c.gold;
  assert.equal((await a.socket.req('geoPropertyBuild', { id: plotId })).t, 'err');
  assert.equal(a.active.c.gold, beforeBuild);
  assert.equal((await a.socket.req('geoPropertyBuild', { id: plotId })).t, 'ok');
  assert.equal((await store.get('chars', a.active.id)).geoProperty.built, true);
  assert.equal((await a.socket.req('houseEnter', { id: plotHouse })).t, 'ok', 'the completed building has a usable interior');
  buyerId = b.active.id;
} finally {
  await core.shutdown();
}
G.chars.clear();
G.houses.clear();
const restarted = await createCore(store);
try {
  const owner = G.chars.get(buyerId)!;
  const house = G.houses.get(owner.houseId!);
  assert.ok(owner.geoProperty && house?.propertyId === owner.geoProperty.id, 'restart restores the interior even without an imported catalog');
  const tenant = G.chars.get(restoredTenantId)!;
  assert.equal(tenant.geoLease?.ownerId, owner.id);
  assert.equal(G.houses.get(tenant.houseId!)?.rentalInterior, true, 'restart restores the tenant’s isolated interior');
} finally {
  await restarted.shutdown();
}
console.log('✓ Geographic property catalog, ownership, home travel and interior');

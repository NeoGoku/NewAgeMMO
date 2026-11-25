import { BAL, GEO, PROPERTY_REGION, haversine, validPropertyId, type Character, type GeoPropertyBuilding, type GeoPropertyOffer } from '@nam/shared';
import { saveCharacter } from './character-save';
import { moveToOwnedProperty, pushGeo } from './geo';
import { propertyCatalog } from './geo-property-data';
import { findProperty, loadRegionalProperties, nearbyPropertyCatalog, regionalPropertyStatus } from './geo-property-regions';
import { H, NO_CHAR } from './handlers';
import { G, now, uid, type House, type Player } from './state';

const houseFor = (id: string) => [...G.houses.values()].find(h => h.propertyId === id);
const ownerHouse = (p: Player, id: unknown) => {
  if (!validPropertyId(id) || p.c.geoProperty?.id !== id || !p.c.houseId) return;
  const house = G.houses.get(p.c.houseId);
  if (house?.propertyId === id && house.ownerId === p.id) return house;
};

function seededHouse(id: string, owner: Character, propertyId: string): House {
  return {
    id, kind: 'player', ownerId: owner.id, ownerName: owner.name, slot: 0, style: 'modern', floors: 1,
    furniture: [], stash: [], garden: null, visit: 'private', created: now(), propertyId,
  };
}

export function restorePropertyHouses() {
  for (const house of G.houses.values()) {
    if (!house.propertyId) continue;
    const owner = G.chars.get(house.ownerId);
    if (owner?.houseId !== house.id || owner.geoProperty?.id !== house.propertyId) G.houses.delete(house.id);
  }
  for (const owner of G.chars.values()) {
    if (owner.geoProperty && owner.houseId && !G.houses.has(owner.houseId)) {
      G.houses.set(owner.houseId, seededHouse(owner.houseId, owner, owner.geoProperty.id));
    }
  }
}

export function discardPropertyHouse(owner: Character) {
  if (!owner.geoProperty || !owner.houseId) return;
  const house = G.houses.get(owner.houseId);
  if (house?.ownerId !== owner.id || house.propertyId !== owner.geoProperty.id) return;
  for (const visitor of [...(G.houseOcc.get(house.id) ?? [])]) H.houseLeave(visitor, {});
  G.houses.delete(house.id);
  G.houseOcc.delete(house.id);
  deleteInterior(house.id);
}

function deleteInterior(id: string) {
  void G.store.del('houses', id).catch(error => console.error('property_interior_cleanup', error));
}

export function propertyPosition(house: House) {
  const owner = G.chars.get(house.ownerId);
  if (!house.propertyId || owner?.geoProperty?.id !== house.propertyId) return;
  return owner.geoProperty.building;
}

export function propertyAccess(p: Player, building: { lat: number; lon: number }) {
  const g = p.geo;
  if (!g?.on || !g.has) return 'Standort nicht aktiv';
  if (g.lockUntil > now()) return 'Standort gesperrt';
  if (p.dead || p.duel || p.travel || p.inScene || p.houseId || p.combatUntil > now()) return 'Gerade nicht möglich';
  if (haversine(g.lat, g.lon, building.lat, building.lon) > GEO.interactM) return 'Zu weit von der Immobilie entfernt';
}

function offerFor(p: Player, building: GeoPropertyBuilding, detailed = false): GeoPropertyOffer {
  const { footprint, ...summary } = building;
  const house = houseFor(building.id);
  const owner = p.c.geoProperty;
  const mine = owner?.id === building.id && house?.ownerId === p.id;
  const g = p.geo;
  return {
    ...summary, footprint: detailed ? footprint : undefined, status: mine ? 'mine' : house ? 'owned' : 'available',
    houseId: house?.id,
    sellGold: mine ? Math.floor(owner.purchaseGold * BAL.propertyResaleRate) : undefined,
    distanceM: g?.on && g.has ? Math.round(haversine(g.lat, g.lon, building.lat, building.lon)) : undefined,
  };
}

NO_CHAR.add('geoPropertyList');
H.geoPropertyList = async (p, m) => {
  const catalog = propertyCatalog();
  if (m.id !== undefined && !validPropertyId(m.id)) return 'Ungültige Immobilie';
  const mine = p.c.geoProperty?.building;
  const g = p.geo;
  const location = g?.on && g.has ? { lat: g.lat, lon: g.lon } : undefined;
  const seeded = location && catalog.nearby(location.lat, location.lon).length > 0;
  if (location && !seeded && !m.id) {
    await loadRegionalProperties(location.lat, location.lon);
    pushGeo(p);
  }
  const claimed = m.id ? houseFor(m.id) : undefined;
  const requested = !m.id ? undefined : (claimed && propertyPosition(claimed)) ??
    (location ? findProperty(m.id, location.lat, location.lon) : catalog.buildings.get(m.id));
  if (m.id && !requested) return 'Immobilie nicht im Katalog';
  const buildings = requested ? [requested] : location ?
    nearbyPropertyCatalog(location.lat, location.lon).map(entry => entry.building) : [];
  if (mine && !m.id && !buildings.some(b => b.id === mine.id)) buildings.unshift(mine);
  return { list: buildings.map(building => offerFor(p, building, !!requested)),
    region: seeded ? PROPERTY_REGION : 'In deiner Region', snapshot: seeded ? catalog.osmSnapshot : undefined,
    regionalStatus: location ? regionalPropertyStatus(location.lat, location.lon) : undefined,
    activePosition: !!location, virtual: !!(location && !g?.gps), hasHome: !!p.c.houseId };
};

async function saveOwnership(p: Player, rollback: () => void) {
  try {
    await saveCharacter(p, true);
  } catch (error) {
    rollback();
    try { await saveCharacter(p, true); }
    catch (restoreError) { console.error('property_ownership_restore', restoreError); }
    throw error;
  }
}

H.geoPropertyBuy = async (p, m) => {
  const g = p.geo;
  const building = g?.on && g.has && validPropertyId(m.id) ? findProperty(m.id, g.lat, g.lon) : undefined;
  if (!building) return 'Immobilie nicht im Katalog';
  const error = propertyAccess(p, building);
  if (error) return error;
  if (p.trade) return 'Beende zuerst den Handel';
  if (p.c.houseId) return 'Du besitzt bereits ein Haus';
  if (houseFor(building.id)) return 'Immobilie ist bereits vergeben';
  if (p.c.gold < building.buyGold) return 'Nicht genug Gold';

  const h = seededHouse(uid('h'), p.c, building.id);
  p.c.gold -= building.buyGold;
  p.c.geoProperty = { id: building.id, purchaseGold: building.buyGold, building };
  p.c.houseId = h.id;
  G.houses.set(h.id, h);
  await saveOwnership(p, () => {
    G.houses.delete(h.id);
    delete p.c.geoProperty;
    p.c.houseId = null;
    p.c.gold += building.buyGold;
  });
  pushGeo(p);
  return { property: offerFor(p, building) };
};

H.geoPropertySell = async (p, m) => {
  const house = ownerHouse(p, m.id);
  if (!house) return 'Die Immobilie gehört dir nicht';
  if (p.dead || p.combatUntil > now() || p.travel || p.inScene || p.duel || p.trade || p.houseId || G.houseOcc.get(house.id)?.size)
    return 'Verkauf gerade nicht möglich';
  if (house.stash.length || house.furniture.length || house.garden) return 'Leere zuerst Lager, Garten und Einrichtung';
  const owned = p.c.geoProperty!;
  const gold = Math.floor(owned.purchaseGold * BAL.propertyResaleRate);
  delete p.c.geoProperty;
  p.c.houseId = null;
  p.c.gold += gold;
  // Hold the claim until the sale is durable so another player cannot buy it during the save.
  await saveOwnership(p, () => {
    p.c.geoProperty = owned;
    p.c.houseId = house.id;
    p.c.gold -= gold;
  });
  G.houses.delete(house.id);
  G.houseOcc.delete(house.id);
  deleteInterior(house.id);
  pushGeo(p);
  return { gold };
};

H.geoPropertyTravel = (p, m) => {
  const house = ownerHouse(p, m.id);
  if (!house) return 'Die Immobilie gehört dir nicht';
  const position = propertyPosition(house);
  if (!position) return 'Immobilienposition nicht verfügbar';
  return moveToOwnedProperty(p, position);
};

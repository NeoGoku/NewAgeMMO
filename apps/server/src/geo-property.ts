import { BAL, GEO, PROPERTY_REGION, PROPERTY_RENT_DAYS, propertyRentGold, PROPERTY_BUILD_COST, VIRTUAL_PLOT, haversine, validPropertyId, type Character, type GeoPropertyBuilding, type GeoPropertyLease, type GeoPropertyMarketStatus, type GeoPropertyOffer, type MailItem } from '@nam/shared';
import { commitCharacterChanges, pendingCharacterTransaction, saveCharacter } from './character-save';
import { moveToOwnedProperty, pushGeo } from './geo';
import { propertyCatalog } from './geo-property-data';
import { findProperty, loadRegionalProperties, nearbyPropertyCatalog, regionalPropertyStatus } from './geo-property-regions';
import { H, NO_CHAR } from './handlers';
import { G, now, send, uid, type House, type Player } from './state';

const houseFor = (id: string) => [...G.houses.values()].find(h => h.propertyId === id && !h.rentalInterior);
const tenants = new Map<string, Character>();
const reservedOffers = new Set<string>();
const RENT_WEEK = PROPERTY_RENT_DAYS * 864e5;
const emptyAndVacant = (house: House) => !G.houseOcc.get(house.id)?.size &&
  !house.stash.length && !house.furniture.length && !house.garden;

function tenantHouse(tenant: Character, propertyId: unknown) {
  const lease = tenant.geoLease;
  if (!lease || lease.propertyId !== propertyId || tenant.houseId !== lease.houseId || tenants.get(lease.propertyId) !== tenant) return;
  const house = G.houses.get(lease.houseId);
  if (house?.rentalInterior && house.ownerId === tenant.id && house.propertyId === lease.propertyId) return house;
}
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
  tenants.clear();
  for (const house of G.houses.values()) {
    if (!house.propertyId) continue;
    const owner = G.chars.get(house.ownerId);
    const propertyId = house.rentalInterior ? owner?.geoLease?.propertyId : owner?.geoProperty?.id;
    if (owner?.houseId !== house.id || propertyId !== house.propertyId) G.houses.delete(house.id);
  }
  for (const owner of G.chars.values()) {
    if (owner.geoProperty && owner.houseId && !G.houses.has(owner.houseId)) {
      G.houses.set(owner.houseId, seededHouse(owner.houseId, owner, owner.geoProperty.id));
    }
  }
  for (const tenant of G.chars.values()) {
    const lease = tenant.geoLease;
    if (!lease || lease.houseId !== tenant.houseId || !tenantCanClaim(tenant, lease)) continue;
    tenants.set(lease.propertyId, tenant);
    if (!G.houses.has(lease.houseId)) {
      G.houses.set(lease.houseId, { ...seededHouse(lease.houseId, tenant, lease.propertyId), rentalInterior: true });
    }
  }
}

function tenantCanClaim(tenant: Character, lease: GeoPropertyLease) {
  const owner = G.chars.get(lease.ownerId);
  return tenant.id !== lease.ownerId && !tenants.has(lease.propertyId) && owner?.geoProperty?.id === lease.propertyId &&
    !owner.geoProperty.rentUntil && G.houses.get(owner.houseId ?? '')?.ownerId === owner.id;
}

export function mustResolvePropertyLease(character: Character) {
  return !!character.geoLease || !!(character.geoProperty && tenants.has(character.geoProperty.id));
}

/** Rental interiors have their own inventory. Access to the landlord's interior is suspended for the entire lease. */
export function propertyInteriorAccess(player: Player, house: House): boolean | undefined {
  if (!house.propertyId) return;
  if (house.rentalInterior) return player.id === house.ownerId && tenantHouse(player.c, house.propertyId) === house;
  if (tenants.has(house.propertyId) || reservedOffers.has(house.propertyId)) return false;
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
  if (!house.propertyId) return;
  const resident = G.chars.get(house.ownerId);
  const owner = house.rentalInterior ? G.chars.get(resident?.geoLease?.ownerId ?? '') : resident;
  if (owner?.geoProperty?.id === house.propertyId) return owner.geoProperty.building;
}

export function propertyAccess(p: Player, building: { lat: number; lon: number }) {
  const g = p.geo;
  if (!g?.on || !g.has) return 'Standort nicht aktiv';
  if (g.lockUntil > now()) return 'Standort gesperrt';
  if (p.dead || p.duel || p.travel || p.inScene || p.houseId || p.combatUntil > now()) return 'Gerade nicht möglich';
  if (haversine(g.lat, g.lon, building.lat, building.lon) > GEO.interactM) return 'Zu weit von der Immobilie entfernt';
}

export function propertyMarket(
  viewer: Character, id: string, building: Pick<GeoPropertyBuilding, 'building' | 'buyGold'>, claim?: House,
): { marketStatus: GeoPropertyMarketStatus; rentGold?: number } {
  const tenant = tenants.get(id);
  const ownership = claim && G.chars.get(claim.ownerId)?.geoProperty;
  if (tenant?.id === viewer.id) return { marketStatus: 'rent', rentGold: tenant.geoLease?.weeklyGold };
  if (claim?.ownerId === viewer.id) return ownership?.rentUntil ?
    { marketStatus: 'rent', rentGold: propertyRentGold(building.buyGold) } : { marketStatus: 'own' };
  if (claim) return ownership?.rentalListed && !tenant && !reservedOffers.has(id) ?
    { marketStatus: 'rentable', rentGold: propertyRentGold(building.buyGold) } : { marketStatus: 'owned' };
  return building.building === VIRTUAL_PLOT ? { marketStatus: 'plot' } :
    { marketStatus: 'sale', rentGold: propertyRentGold(building.buyGold) };
}

export function propertyMarketArea(building: GeoPropertyBuilding) {
  return building.unitAreaM2 ?? (building.building === VIRTUAL_PLOT ? building.footprintM2 : building.floorAreaM2);
}

function offerFor(p: Player, building: GeoPropertyBuilding, detailed = false): GeoPropertyOffer {
  const { footprint, ...summary } = building;
  const claim = houseFor(building.id);
  const market = propertyMarket(p.c, building.id, building, claim);
  const ownership = p.c.geoProperty;
  const tenant = tenants.get(building.id);
  const lease = tenant === p.c ? tenant.geoLease : undefined;
  const occupiedUntil = tenant?.geoLease?.until;
  const rentUntil = lease?.until ?? (market.marketStatus === 'rent' ? ownership?.rentUntil : undefined);
  const mine = market.marketStatus === 'own' || market.marketStatus === 'rent';
  const g = p.geo;
  const emptyPlot = building.building === VIRTUAL_PLOT && (!claim || !G.chars.get(claim.ownerId)?.geoProperty?.built);
  const house = lease && tenant ? tenantHouse(tenant, building.id) : tenant ? undefined : claim;
  return {
    ...summary, ...market, areaM2: propertyMarketArea(building), footprint: detailed ? footprint : undefined,
    status: mine ? 'mine' : market.marketStatus === 'owned' ? 'owned' : 'available',
    houseId: emptyPlot ? undefined : house?.id,
    buildGold: emptyPlot && mine ? PROPERTY_BUILD_COST : undefined,
    usableAreaEstimateM2: emptyPlot ? undefined : building.unitAreaM2 ?? Math.round(building.floorAreaM2 * .75),
    sellGold: market.marketStatus === 'own' && ownership && !tenant ? Math.floor(ownership.purchaseGold * BAL.propertyResaleRate) : undefined,
    rentalManagement: market.marketStatus === 'own' && ownership && building.building !== VIRTUAL_PLOT ? {
      listed: !!ownership.rentalListed, weeklyGold: propertyRentGold(building.buyGold), until: occupiedUntil, tenantName: tenant?.name,
    } : undefined,
    rentUntil, rentOverdue: rentUntil !== undefined && rentUntil <= now() || undefined,
    distanceM: g?.on && g.has ? Math.round(haversine(g.lat, g.lon, building.lat, building.lon)) : undefined,
  };
}

async function endRental(tenant: Character, house: House) {
  const snapshot = { ...tenant, houseId: null };
  delete snapshot.geoLease;
  delete snapshot.geoProperty;
  const saved = await commitCharacterChanges([snapshot], () => {
    tenant.houseId = null;
    if (tenant.geoLease) tenants.delete(tenant.geoLease.propertyId);
    delete tenant.geoLease;
    delete tenant.geoProperty;
    G.houses.delete(house.id);
    G.houseOcc.delete(house.id);
  });
  if (!saved) return 'Mietvertrag wird gerade aktualisiert';
  deleteInterior(house.id);
  const player = G.players.get(tenant.id);
  if (player?.online) {
    send(player, { t: 'char', c: tenant });
    pushGeo(player);
  }
}

async function releaseExpiredRental(character: Character) {
  const propertyId = character.geoLease?.propertyId ?? character.geoProperty?.id;
  const until = character.geoLease?.until ?? character.geoProperty?.rentUntil;
  if (!until || until > now() || pendingCharacterTransaction(character.id)) return;
  const house = tenantHouse(character, propertyId) ?? (character.houseId ? G.houses.get(character.houseId) : undefined);
  if (house && house.propertyId === propertyId && house.ownerId === character.id && emptyAndVacant(house)) {
    await endRental(character, house);
  }
}

export function tickPropertyRentals() {
  for (const house of G.houses.values()) {
    if (!house.propertyId) continue;
    const character = G.chars.get(house.ownerId);
    if (character) void releaseExpiredRental(character).catch(error => console.error('property_rental_expiry', error));
  }
}

NO_CHAR.add('geoPropertyList');
H.geoPropertyList = async (p, m) => {
  await releaseExpiredRental(p.c);
  const catalog = propertyCatalog();
  if (m.id !== undefined && !validPropertyId(m.id)) return 'Ungültige Immobilie';
  const leaseHouse = tenantHouse(p.c, p.c.geoLease?.propertyId);
  const mine = p.c.geoProperty?.building ?? (leaseHouse && propertyPosition(leaseHouse));
  const g = p.geo;
  const location = g?.on && g.has ? { lat: g.lat, lon: g.lon } : undefined;
  const seeded = location && catalog.nearby(location.lat, location.lon).length > 0;
  if (location && !m.id) {
    const load = loadRegionalProperties(location.lat, location.lon);
    if (!seeded) await load;
    else if (load) void load.then(() => pushGeo(p));
  }
  const claimed = m.id ? houseFor(m.id) : undefined;
  const requested = !m.id ? undefined : (claimed && propertyPosition(claimed)) ??
    (location ? findProperty(m.id, location.lat, location.lon) : catalog.buildings.get(m.id));
  if (m.id && !requested) return 'Immobilie nicht im Katalog';
  const buildings = requested ? [requested] : location ?
    nearbyPropertyCatalog(location.lat, location.lon).map(entry => {
      const house = houseFor(entry.building.id);
      return house && propertyPosition(house) || entry.building;
    }) : [];
  if (location && !m.id) {
    const ids = new Set(buildings.map(b => b.id));
    const nearbyFallbacks = [...G.houses.values()].filter(house => !house.rentalInterior && house.propertyId && !ids.has(house.propertyId))
      .map(propertyPosition).filter((building): building is GeoPropertyBuilding => !!building)
      .filter(building => haversine(location.lat, location.lon, building.lat, building.lon) <= GEO.viewM)
      .slice(0, 32);
    buildings.push(...nearbyFallbacks);
  }
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

H.geoPropertyLeaseOffer = async (p, m) => {
  const house = ownerHouse(p, m.id);
  const ownership = p.c.geoProperty;
  if (!house || !ownership || ownership.rentUntil || ownership.building.building === VIRTUAL_PLOT) return 'Nur Eigentümer können Gebäude zur Miete anbieten';
  if (typeof m.on !== 'boolean') return 'Ungültiger Angebotsstatus';
  const next = { ...ownership };
  if (m.on) next.rentalListed = true;
  else delete next.rentalListed;
  if (!await commitCharacterChanges([{ ...p.c, geoProperty: next }], () => { p.c.geoProperty = next; })) {
    return 'Mietangebot wird gerade aktualisiert';
  }
  pushGeo(p);
  return { property: offerFor(p, ownership.building) };
};

async function payLandlord(tenant: Player, owner: Character, lease: GeoPropertyLease, house?: House) {
  const payment: MailItem = { id: uid('ml'), from: 'Immobilienmarkt', subject: `Wochenmiete von ${tenant.c.name}`,
    gold: lease.weeklyGold, items: [], t: now() };
  const renter = { ...tenant.c, houseId: lease.houseId, geoLease: lease, gold: tenant.c.gold - lease.weeklyGold };
  const landlord = { ...owner, mail: [...owner.mail, payment] };
  const saved = await commitCharacterChanges([renter, landlord], () => {
    tenant.c.gold -= lease.weeklyGold;
    tenant.c.houseId = lease.houseId;
    tenant.c.geoLease = lease;
    owner.mail.push(payment);
    if (house) {
      tenants.set(lease.propertyId, tenant.c);
      G.houses.set(house.id, house);
    }
  });
  if (!saved) return 'Mietvertrag wird gerade aktualisiert';
  const player = G.players.get(owner.id);
  if (player?.online) {
    send(player, { t: 'char', c: owner });
    pushGeo(player);
  }
}

async function rentFromOwner(p: Player, claim: House, building: GeoPropertyBuilding) {
  const owner = G.chars.get(claim.ownerId);
  const ownership = owner?.geoProperty;
  if (!owner || ownership?.id !== building.id || !ownership.rentalListed || claim.ownerId === p.id ||
    tenants.has(building.id) || reservedOffers.has(building.id) || G.houseOcc.get(claim.id)?.size) return 'Mietangebot ist nicht verfügbar';
  const weeklyGold = propertyRentGold(ownership.purchaseGold);
  if (p.c.gold < weeklyGold) return 'Nicht genug Gold';
  const house: House = { ...seededHouse(uid('h'), p.c, building.id), rentalInterior: true };
  const lease: GeoPropertyLease = { ownerId: owner.id, propertyId: building.id, houseId: house.id, weeklyGold, until: now() + RENT_WEEK };
  reservedOffers.add(building.id);
  try {
    const error = await payLandlord(p, owner, lease, house);
    if (error) return error;
  } finally { reservedOffers.delete(building.id); }
  pushGeo(p);
  return { property: offerFor(p, building) };
}

H.geoPropertyRent = async (p, m) => {
  const g = p.geo;
  const claim = validPropertyId(m.id) ? houseFor(m.id) : undefined;
  const building = claim && propertyPosition(claim) ||
    (g?.on && g.has && validPropertyId(m.id) ? findProperty(m.id, g.lat, g.lon) : undefined);
  if (!building) return 'Immobilie nicht im Katalog';
  if (building.building === VIRTUAL_PLOT) return 'Baugrundstücke können nicht gemietet werden';
  const error = propertyAccess(p, building);
  if (error) return error;
  if (p.trade) return 'Beende zuerst den Handel';
  if (p.c.houseId) return 'Du besitzt bereits ein Haus';
  if (claim) return rentFromOwner(p, claim, building);
  const rent = propertyRentGold(building.buyGold);
  if (p.c.gold < rent) return 'Nicht genug Gold';
  const h = seededHouse(uid('h'), p.c, building.id);
  p.c.gold -= rent;
  p.c.geoProperty = { id: building.id, purchaseGold: building.buyGold, building, rentUntil: now() + PROPERTY_RENT_DAYS * 864e5 };
  p.c.houseId = h.id;
  G.houses.set(h.id, h);
  await saveOwnership(p, () => {
    G.houses.delete(h.id);
    delete p.c.geoProperty;
    p.c.houseId = null;
    p.c.gold += rent;
  });
  pushGeo(p);
  return { property: offerFor(p, building) };
};

H.geoPropertyRenew = async (p, m) => {
  if (p.trade) return 'Beende zuerst den Handel';
  const t = now();
  const lease = p.c.geoLease;
  if (lease) {
    const house = tenantHouse(p.c, m.id);
    const owner = G.chars.get(lease.ownerId);
    const building = house && propertyPosition(house);
    if (!building || !owner) return 'Kein laufender Mietvertrag';
    const until = Math.max(t, lease.until) + RENT_WEEK;
    if (until - t > 4 * RENT_WEEK) return 'Die Miete kann höchstens vier Wochen im Voraus verlängert werden';
    if (p.c.gold < lease.weeklyGold) return 'Nicht genug Gold';
    const error = await payLandlord(p, owner, { ...lease, until });
    return error ?? { property: offerFor(p, building) };
  }
  const house = ownerHouse(p, m.id);
  const owned = p.c.geoProperty;
  if (!house || !owned?.rentUntil) return 'Kein laufender Mietvertrag';
  const rent = propertyRentGold(owned.building.buyGold);
  const previous = owned.rentUntil;
  const next = Math.max(t, previous) + RENT_WEEK;
  if (next - t > 4 * RENT_WEEK) return 'Die Miete kann höchstens vier Wochen im Voraus verlängert werden';
  if (p.c.gold < rent) return 'Nicht genug Gold';
  p.c.gold -= rent;
  owned.rentUntil = next;
  await saveOwnership(p, () => { owned.rentUntil = previous; p.c.gold += rent; });
  return { property: offerFor(p, owned.building) };
};

H.geoPropertyBuild = async (p, m) => {
  const house = ownerHouse(p, m.id);
  const owned = p.c.geoProperty;
  if (!house || !owned || owned.building.building !== VIRTUAL_PLOT) return 'Kein eigenes Baugrundstück';
  if (owned.built) return 'Dieses Grundstück ist bereits bebaut';
  const error = propertyAccess(p, owned.building);
  if (error) return error;
  if (p.trade || p.c.gold < PROPERTY_BUILD_COST) return 'Bauen erfordert verfügbares Gold und einen freien Charakter';
  p.c.gold -= PROPERTY_BUILD_COST;
  owned.built = true;
  await saveOwnership(p, () => {
    delete owned.built;
    p.c.gold += PROPERTY_BUILD_COST;
  });
  return { property: offerFor(p, owned.building) };
};

H.geoPropertyEndLease = async (p, m) => {
  if (!p.c.geoLease && p.c.geoProperty?.rentUntil) return H.geoPropertySell(p, m);
  const house = tenantHouse(p.c, m.id);
  if (!house) return 'Kein laufender Mietvertrag';
  if (p.dead || p.combatUntil > now() || p.travel || p.inScene || p.duel || p.trade || p.houseId)
    return 'Mietende gerade nicht möglich';
  if (!emptyAndVacant(house)) return 'Leere zuerst Lager, Garten und Einrichtung und verlasse die Immobilie';
  const error = await endRental(p.c, house);
  return error ?? { gold: 0 };
};

H.geoPropertySell = async (p, m) => {
  const house = ownerHouse(p, m.id);
  if (!house) return 'Die Immobilie gehört dir nicht';
  if (house.propertyId && (tenants.has(house.propertyId) || reservedOffers.has(house.propertyId))) return 'Immobilie ist vermietet';
  if (p.dead || p.combatUntil > now() || p.travel || p.inScene || p.duel || p.trade || p.houseId || G.houseOcc.get(house.id)?.size)
    return 'Verkauf gerade nicht möglich';
  if (house.stash.length || house.furniture.length || house.garden) return 'Leere zuerst Lager, Garten und Einrichtung';
  const owned = p.c.geoProperty!;
  const gold = owned.rentUntil ? 0 : Math.floor(owned.purchaseGold * BAL.propertyResaleRate); // Mietverträge werden ohne Erstattung beendet
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
  const house = tenantHouse(p.c, m.id) ?? ownerHouse(p, m.id);
  if (!house || propertyInteriorAccess(p, house) === false) return 'Immobilie ist nicht für dich verfügbar';
  const position = propertyPosition(house);
  if (!position) return 'Immobilienposition nicht verfügbar';
  return moveToOwnedProperty(p, position);
};

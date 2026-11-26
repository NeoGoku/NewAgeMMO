import { territoryObjects } from './guild-territories';
import { GEO, cellId, hash32, haversine, rad, rng, type GeoObj } from '@nam/shared';
import { GEO_ANCHORS, GEO_REGIONAL_NPCS, LOCS, MOBS, NODES, NPCS, placeNear, type MobDef } from '@nam/game-data';
import { G, now } from './state';
import { osmObjects } from './geo-osm';
import { propertyMarker, propertyObjects } from './geo-property-regions';
import { npcsNear, pickMob, populateCell, tileFeaturesNear } from './geo-spawn';
import { regionAt, T, terrainAt } from './geo-terrain';

export const anchorList = Object.entries(GEO_ANCHORS);
const nearestAnchor = (lat: number, lon: number) => {
  let best = anchorList[0];
  let distance = Infinity;
  for (const entry of anchorList) {
    const d = haversine(lat, lon, entry[1][0], entry[1][1]);
    if (d < distance) { best = entry; distance = d; }
  }
  return { id: best[0], distance, radius: best[1][2] };
};

const npcObject = (id: string, lat: number, lon: number, marker: string): GeoObj => {
  const npc = NPCS[id];
  return { id: marker, k: 'npc', def: id, lat, lon, name: `${npc.name} · ${npc.title}`, r: 40, extra: { loc: npc.loc, services: npc.services } };
};
const mobObject = (mob: MobDef, lat: number, lon: number, id: string): GeoObj => ({
  id, k: 'mob', def: mob.id, lat, lon, name: mob.name, lvl: mob.lvl, fam: mob.fam, role: mob.role,
});
const STATIC: GeoObj[] = Object.values(NPCS).map(npc => {
  const [lat, lon] = placeNear(npc.loc, 'npc:' + npc.id);
  return npcObject(npc.id, lat, lon, 'x:npc:' + npc.id);
});
for (const npc of Object.values(NPCS).filter(npc => npc.services.includes('teleport'))) {
  const [lat, lon] = GEO_ANCHORS[npc.loc];
  STATIC.push({ id: 'x:tp:' + npc.loc, k: 'teleporter', def: npc.loc, lat, lon, name: 'Teleportportal · ' + LOCS[npc.loc].name });
}
for (const loc of Object.values(LOCS)) {
  for (const h of loc.hotspots) if (h.kind === 'station') {
    const [lat, lon] = placeNear(loc.id, 'st:' + h.id);
    STATIC.push({ id: 'x:st:' + h.id, k: 'station', def: h.prof!, lat, lon, name: h.label, r: 40, extra: { loc: loc.id } });
  }
  for (const spawn of loc.spawns) if (MOBS[spawn.mob].role === 'boss') {
    const [lat, lon] = placeNear(loc.id, 'boss:' + spawn.mob);
    STATIC.push(mobObject(MOBS[spawn.mob], lat, lon, 'x:boss:' + spawn.mob));
  }
  if (loc.kind === 'boss' || loc.theme === 'dungeon') {
    const [lat, lon] = placeNear(loc.id, 'dungeon:' + loc.id);
    STATIC.push({ id: 'x:d:' + loc.id, k: 'dungeon', def: loc.id, lat, lon, name: 'Dungeoneingang: ' + loc.name, lvl: loc.lvl[0], r: 60 });
  }
}

const wrap = (n: number, size: number) => ((n % size) + size) % size;
const longitudeColumns = (row: number) => Math.round(360 * Math.cos(rad((row + .5) * GEO.cellDeg)) / GEO.cellDeg);
type Cell = { row: number; column: number; width: number };
function* nearbyCells(lat: number, lon: number, radius: number): Generator<Cell> {
  const row = Math.floor(lat / GEO.cellDeg);
  const rows = Math.ceil(radius / 110000 / GEO.cellDeg) + 1;
  const minRow = Math.floor(-85 / GEO.cellDeg);
  const maxRow = Math.ceil(85 / GEO.cellDeg) - 1;
  for (let y = Math.max(minRow, row - rows); y <= Math.min(maxRow, row + rows); y++) {
    const count = longitudeColumns(y);
    const width = 360 / count;
    const col = Math.floor((lon + 180) / width);
    const cols = Math.ceil(radius / (110000 * Math.cos(rad((y + .5) * GEO.cellDeg))) / width) + 1;
    for (let x = col - cols; x <= col + cols; x++) yield { row: y, column: wrap(x, count), width };
  }
}
const cellPoint = (c: Cell, uy: number, ux: number) => [(c.row + uy) * GEO.cellDeg, (c.column + ux) * c.width - 180] as const;
const nearAnchor = (lat: number, lon: number) => anchorList.some(([, a]) => haversine(lat, lon, a[0], a[1]) <= a[2] + 300);
function fallbackNpc(cell: Cell) {
  if (wrap(cell.row, 3) !== 0 || cell.column % 3 !== 0) return;
  const id = cellId(cell.row, cell.column);
  const [lat, lon] = cellPoint(cell, .32, .68);
  if (nearAnchor(lat, lon) || terrainAt(lat, lon) !== undefined) return;
  return npcObject(GEO_REGIONAL_NPCS[hash32('npc:' + id) % GEO_REGIONAL_NPCS.length], lat, lon, 'r:npc:' + id);
}

export function regionalNpcNearby(id: string, lat: number, lon: number, radius: number) {
  if (!GEO_REGIONAL_NPCS.includes(id)) return false;
  if (npcsNear(lat, lon, radius).some(npc => npc.def === id)) return true;
  for (const cell of nearbyCells(lat, lon, radius)) {
    const npc = fallbackNpc(cell);
    if (npc?.def === id && haversine(lat, lon, npc.lat, npc.lon) <= radius) return true;
  }
  return false;
}
/** Selbst geschriebene Zonen (Städte) behalten ihre Levelvorgabe */
function authoredLevel(lat: number, lon: number) {
  const anchor = nearestAnchor(lat, lon);
  return anchor.distance <= anchor.radius + 1800 ? LOCS[anchor.id].lvl[0] : undefined;
}

// Keep the established procedural world usable while terrain is unavailable. Never fill a known water tile.
function offlineCell(cell: Cell, id: string, seed: number, level: number, bucket: number, keep: (object: GeoObj) => void) {
  const roll = rng(hash32(id + ':' + bucket));
  for (let slot = 0; slot < 4; slot++) {
    const y = .25 + Math.floor(slot / 2) * .5 + (roll() - .5) * .09;
    const x = .25 + (slot % 2) * .5 + (roll() - .5) * .09;
    const [lat, lon] = cellPoint(cell, y, x);
    const mob = pickMob('normal', Math.max(1, level + Math.floor(roll() * 3) - 1), seed + slot);
    if (terrainAt(lat, lon) === undefined) keep(mobObject(mob, lat, lon, `m:${id}:${slot}:${bucket}`));
  }
  if (seed % 4 === 0) {
    const kinds = ['ore', 'herb', 'wood'];
    const def = 'n_' + kinds[hash32('node:' + id) % kinds.length] + '_' + Math.min(9, Math.floor(level / 10));
    const [lat, lon] = cellPoint(cell, .24, .22);
    if (terrainAt(lat, lon) === undefined) keep({ id: `n:${id}:${bucket}`, k: 'node', def, lat, lon, name: NODES[def].name });
  }
  if (seed % 13 === 0) {
    const [lat, lon] = cellPoint(cell, .73, .74);
    if (terrainAt(lat, lon) === undefined) keep(mobObject(pickMob('elite', level + 4, seed), lat, lon, `e:${id}:${bucket}`));
  }
}

export function geoObjects(lat: number, lon: number, radius = GEO.viewM, t = now()): GeoObj[] {
  const out: GeoObj[] = [];
  const normals: GeoObj[] = [];
  const keep = (object: GeoObj, distance = radius) => {
    if ((G.geoTaken.get(object.id) || 0) > t || haversine(lat, lon, object.lat, object.lon) > distance) return;
    if (object.role === 'boss') object = { ...object, extra: { ...object.extra, endsAt: (Math.floor(t / 36e5) + 1) * 36e5 } };
    (object.role === 'normal' ? normals : out).push(object);
  };
  const byDistance = (a: GeoObj, b: GeoObj) => haversine(lat, lon, a.lat, a.lon) - haversine(lat, lon, b.lat, b.lon);
  const bucket = Math.floor(t / GEO.spawnBucketMs);
  for (const o of STATIC) keep(o);
  for (const territory of territoryObjects()) keep(territory);
  for (const cell of nearbyCells(lat, lon, radius)) {
    const id = cellId(cell.row, cell.column);
    const seed = hash32(id);
    const [clat, clon] = cellPoint(cell, .5, .5);
    if (haversine(lat, lon, clat, clon) > radius + 210) continue;
    populateCell(cell, (uy, ux) => cellPoint(cell, uy, ux), { authoredLevel, keep: object => keep(object) });
    if (terrainAt(clat, clon) === undefined) offlineCell(cell, id, seed, authoredLevel(clat, clon) ?? 1 + seed % 4, bucket, keep);
    const offlineNpc = fallbackNpc(cell);
    if (offlineNpc) keep(offlineNpc);
    const minute = Math.floor(t / 60000);
    const stormOffset = minute + seed % 60;
    const stormMinute = stormOffset % 60;
    if (wrap(cell.row, 4) === 0 && cell.column % 4 === 0 && stormMinute < 20) {
      const [eventLat, eventLon] = cellPoint(cell, .44, .58);
      const terrain = terrainAt(eventLat, eventLon);
      if (terrain !== T.water) {
        const invader = pickMob('elite', (authoredLevel(eventLat, eventLon) ?? regionAt(eventLat, eventLon)?.lvl[0] ?? 1) + 2, hash32('storm:' + id));
        keep({ ...mobObject(invader, eventLat, eventLon, `storm:${id}:${Math.floor(stormOffset / 60)}`),
          name: 'Äthersturm · ' + invader.name, extra: { regionalEvent: 'aetherstorm', endsAt: (minute + 20 - stormMinute) * 60000 } });
      }
    }
    if (seed % 101 === 0) {
      const [plat, plon] = cellPoint(cell, .71, .26);
      if (terrainAt(plat, plon) !== 1) keep({ id: 'p:' + id, k: 'poi', def: 'treasure', lat: plat, lon: plon, name: 'Magische Quelle' });
    }
  }
  for (const npc of npcsNear(lat, lon, radius)) keep(npc);
  for (const feature of tileFeaturesNear(lat, lon, radius)) keep(feature);
  for (const [id, a] of anchorList) {
    keep({ id: 'c:' + id, k: 'city', def: id, lat: a[0], lon: a[1], name: LOCS[id].name, lvl: LOCS[id].lvl[0], r: a[2], extra: { kind: LOCS[id].kind } }, radius + a[2]);
  }
  const properties = new Map(propertyObjects(lat, lon, radius).map(item => [item.id, item]));
  for (const house of G.houses.values()) {
    const owned = house.propertyId && !house.rentalInterior && G.chars.get(house.ownerId)?.geoProperty;
    if (owned && owned.id === house.propertyId) {
      properties.set(owned.id, propertyMarker(owned.building));
    }
    const position = house.geo;
    if (position) keep({ id: 'h:' + house.id, k: 'house', def: house.kind, ...position, name: `${house.kind === 'guild' ? 'Gildenhaus' : 'Haus'} ${house.ownerName}` });
  }
  for (const property of properties.values()) keep(property);
  for (const poi of osmObjects(lat, lon, radius)) keep(poi);
  out.push(...normals.sort(byDistance).slice(0, GEO.maxNormalMobsVisible));
  return out.sort(byDistance);
}

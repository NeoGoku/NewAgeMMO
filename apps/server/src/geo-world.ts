import { territoryObjects } from './guild-territories';
import { GEO, cellId, hash32, haversine, rad, rng, type GeoObj } from '@nam/shared';
import { GEO_ANCHORS, GEO_REGIONAL_NPCS, LOCS, MOBS, NPCS, placeNear, type MobDef } from '@nam/game-data';
import { G, now } from './state';
import { osmObjects } from './geo-osm';
import { propertyObjects } from './geo-property-regions';
import { npcsNear, pickMob, populateCell, tileFeaturesNear } from './geo-spawn';
import { regionAt, terrainAt } from './geo-terrain';

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
export function regionalNpcNearby(id: string, lat: number, lon: number, radius: number) {
  return GEO_REGIONAL_NPCS.includes(id) && npcsNear(lat, lon, radius).some(npc => npc.def === id);
}
/** Selbst geschriebene Zonen (Städte) behalten ihre Levelvorgabe */
function authoredLevel(lat: number, lon: number) {
  const anchor = nearestAnchor(lat, lon);
  return anchor.distance <= anchor.radius + 1800 ? LOCS[anchor.id].lvl[0] : undefined;
}

export function geoObjects(lat: number, lon: number, radius = GEO.viewM, t = now()): GeoObj[] {
  const out: GeoObj[] = [];
  const normals: GeoObj[] = [];
  const keep = (object: GeoObj, distance = radius) => {
    if ((G.geoTaken.get(object.id) || 0) > t || haversine(lat, lon, object.lat, object.lon) > distance) return;
    (object.role === 'normal' ? normals : out).push(object);
  };
  const byDistance = (a: GeoObj, b: GeoObj) => haversine(lat, lon, a.lat, a.lon) - haversine(lat, lon, b.lat, b.lon);
  const bucket = Math.floor(t / GEO.spawnBucketMs);
  const hour = Math.floor(t / 36e5);
  for (const o of STATIC) keep(o);
  for (const territory of territoryObjects()) keep(territory);
  for (const cell of nearbyCells(lat, lon, radius)) {
    const id = cellId(cell.row, cell.column);
    const seed = hash32(id);
    const [clat, clon] = cellPoint(cell, .5, .5);
    if (haversine(lat, lon, clat, clon) > radius + 210) continue;
    populateCell(cell, (uy, ux) => cellPoint(cell, uy, ux), { authoredLevel, keep: object => keep(object) });
    if (wrap(cell.row, 4) === 0 && cell.column % 4 === 0 && (Math.floor(t / 60000) + seed % 60) % 60 < 20) {
      const [eventLat, eventLon] = cellPoint(cell, .44, .58);
      if (terrainAt(eventLat, eventLon) !== 1) {
        const invader = pickMob('elite', (authoredLevel(eventLat, eventLon) ?? regionAt(eventLat, eventLon)?.lvl[0] ?? 1) + 2, hash32('storm:' + id));
        keep({ ...mobObject(invader, eventLat, eventLon, `storm:${id}:${Math.floor((t + (seed % 60) * 60000) / 36e5)}`),
          name: 'Äthersturm · ' + invader.name, extra: { regionalEvent: 'aetherstorm' } });
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
    const owned = house.propertyId && G.chars.get(house.ownerId)?.geoProperty;
    if (owned && owned.id === house.propertyId) {
      const { id, lat, lon } = owned.building;
      properties.set(id, { id, k: 'house', def: 'property', lat, lon, name: 'Immobilie', extra: { source: 'OpenStreetMap', building: owned.building.building } });
    }
    const position = house.geo;
    if (position) keep({ id: 'h:' + house.id, k: 'house', def: house.kind, ...position, name: `${house.kind === 'guild' ? 'Gildenhaus' : 'Haus'} ${house.ownerName}` });
  }
  for (const property of properties.values()) keep(property);
  for (const poi of osmObjects(lat, lon, radius)) keep(poi);
  out.push(...normals.sort(byDistance).slice(0, GEO.maxNormalMobsVisible));
  return out.sort(byDistance);
}

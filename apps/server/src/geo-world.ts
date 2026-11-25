import { GEO, cellId, hash32, haversine, rad, rng, type GeoObj } from '@nam/shared';
import { GEO_ANCHORS, GEO_REGIONAL_NPCS, LOCS, MOBS, NODES, NPCS, placeNear, type MobDef } from '@nam/game-data';
import { G, now } from './state';
import { osmObjects } from './geo-osm';

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

const NODE_KINDS = ['ore', 'herb', 'wood'];
const BY_ROLE = {
  normal: Object.values(MOBS).filter(m => m.role === 'normal'),
  elite: Object.values(MOBS).filter(m => m.role === 'elite'),
  boss: Object.values(MOBS).filter(m => m.role === 'boss'),
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
function regionalNpc(c: Cell): GeoObj | undefined {
  if (wrap(c.row, 3) !== 0 || c.column % 3 !== 0) return;
  const id = cellId(c.row, c.column);
  const seed = hash32('npc:' + id);
  const [lat, lon] = cellPoint(c, .32, .68);
  if (nearAnchor(lat, lon)) return;
  return npcObject(GEO_REGIONAL_NPCS[seed % GEO_REGIONAL_NPCS.length], lat, lon, 'r:npc:' + id);
}

const nearAnchor = (lat: number, lon: number) => anchorList.some(([, a]) => haversine(lat, lon, a[0], a[1]) <= a[2] + 300);
export function regionalNpcNearby(id: string, lat: number, lon: number, radius: number) {
  if (!GEO_REGIONAL_NPCS.includes(id)) return false;
  for (const cell of nearbyCells(lat, lon, radius)) {
    const npc = regionalNpc(cell);
    if (npc?.def === id && haversine(lat, lon, npc.lat, npc.lon) <= radius) return true;
  }
  return false;
}
function regionalLevel(lat: number, lon: number, seed: number) {
  const anchor = nearestAnchor(lat, lon);
  if (anchor.distance <= anchor.radius + 1800) return LOCS[anchor.id].lvl[0];
  // Regions without authored zones have starter cells and intermittent tougher encounters.
  return 1 + seed % 4;
}
function selectMob(role: MobDef['role'], level: number, seed: number) {
  const pool = BY_ROLE[role];
  let bestDistance = Infinity;
  let best: MobDef[] = [];
  for (const mob of pool) {
    const distance = Math.abs(mob.lvl - level);
    if (distance < bestDistance) { bestDistance = distance; best = []; }
    if (distance === bestDistance) best.push(mob);
  }
  return best[seed % best.length];
}

export function geoObjects(lat: number, lon: number, radius = GEO.viewM, t = now()): GeoObj[] {
  const out: GeoObj[] = [];
  const keep = (object: GeoObj, distance = radius) => {
    if ((G.geoTaken.get(object.id) || 0) <= t && haversine(lat, lon, object.lat, object.lon) <= distance) out.push(object);
  };
  const bucket = Math.floor(t / GEO.spawnBucketMs);
  const hour = Math.floor(t / 36e5);
  for (const o of STATIC) keep(o);
  for (const cell of nearbyCells(lat, lon, radius)) {
    const id = cellId(cell.row, cell.column);
    const seed = hash32(id);
    const roll = rng(hash32(id + ':' + bucket));
    const [clat, clon] = cellPoint(cell, .5, .5);
    if (haversine(lat, lon, clat, clon) > radius + 210) continue;
    const level = regionalLevel(clat, clon, seed);
    const [mlat, mlon] = cellPoint(cell, .25 + roll() * .5, .25 + roll() * .5);
    const normal = selectMob('normal', Math.max(1, level + Math.floor(roll() * 3) - 1), seed);
    keep(mobObject(normal, mlat, mlon, `m:${id}:0:${bucket}`));
    if (seed % 4 === 0) {
      const def = 'n_' + NODE_KINDS[hash32('node:' + id) % NODE_KINDS.length] + '_' + Math.min(9, Math.floor(level / 10));
      const [nlat, nlon] = cellPoint(cell, .24, .22);
      keep({ id: `n:${id}:${bucket}`, k: 'node', def, lat: nlat, lon: nlon, name: NODES[def].name });
    }
    const npc = regionalNpc(cell);
    if (npc) keep(npc);
    if (seed % 13 === 0) {
      const [elat, elon] = cellPoint(cell, .73, .74);
      keep(mobObject(selectMob('elite', level + 4, seed), elat, elon, `e:${id}:${bucket}`));
    }
    if (seed % 151 === 0 && !nearAnchor(clat, clon)) {
      const boss = selectMob('boss', level + 36 + (seed % 3) * 18, hash32('boss:' + id));
      keep(mobObject(boss, clat, clon, `b:${id}:${hour}`));
    }
    if (seed % 101 === 0) {
      const [plat, plon] = cellPoint(cell, .71, .26);
      keep({ id: 'p:' + id, k: 'poi', def: 'treasure', lat: plat, lon: plon, name: 'Magische Quelle' });
    }
  }
  for (const [id, a] of anchorList) {
    keep({ id: 'c:' + id, k: 'city', def: id, lat: a[0], lon: a[1], name: LOCS[id].name, lvl: LOCS[id].lvl[0], r: a[2], extra: { kind: LOCS[id].kind } }, radius + a[2]);
  }
  for (const house of G.houses.values()) {
    const position = house.geo;
    if (position) keep({ id: 'h:' + house.id, k: 'house', def: house.kind, ...position, name: `${house.kind === 'guild' ? 'Gildenhaus' : 'Haus'} ${house.ownerName}` });
  }
  for (const poi of osmObjects(lat, lon, radius)) keep(poi);
  return out.sort((a, b) => haversine(lat, lon, a.lat, a.lon) - haversine(lat, lon, b.lat, b.lon));
}

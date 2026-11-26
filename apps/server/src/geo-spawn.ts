import { GEO, cellId, hash32, haversine, rng, type GeoObj } from '@nam/shared';
import { LOCS, MOBS, NODES, NPCS, type MobDef } from '@nam/game-data';
import { T, getTile, poisNear, regionAt, regionOf, terrainAt, tileBounds, tileKey, tileXY, type Region, type Terrain, type TerrainPoi } from './geo-terrain';

/** Deterministische, geländeabhängige Verteilung von Monstern, Ressourcen, NPCs, Dungeoneingängen und Weltbossen. */
type Fam = MobDef['fam'];
const FAM_WEIGHTS: Record<number, Partial<Record<Fam, number>>> = {
  [T.forest]: { beast: 6, magic: 2, demon: 1 }, [T.grass]: { beast: 6, human: 1 }, [T.farm]: { beast: 4, human: 3 },
  [T.residential]: { human: 5, robot: 2, beast: 1 }, [T.commercial]: { human: 4, robot: 4 }, [T.industrial]: { robot: 7, human: 2, demon: 1 },
  [T.rock]: { beast: 3, demon: 4, robot: 1 }, [T.wetland]: { magic: 5, beast: 3 }, [T.other]: { beast: 4, human: 2, magic: 1 }, [T.water]: {},
};
/** Besiedlungsdichte je Gelände (Wahrscheinlichkeit pro Kandidatenpunkt) */
const DENSITY: Record<number, number> = { [T.forest]: .95, [T.grass]: .65, [T.farm]: .55, [T.residential]: .5, [T.commercial]: .4, [T.industrial]: .75, [T.rock]: .8, [T.wetland]: .6, [T.other]: .45, [T.water]: 0 };

const POOLS = { normal: [] as MobDef[], elite: [] as MobDef[], boss: [] as MobDef[] };
for (const mob of Object.values(MOBS)) POOLS[mob.role].push(mob);
export function pickMob(role: MobDef['role'], level: number, seed: number, fam?: Fam): MobDef {
  let pool = POOLS[role];
  // Art nur verwenden, wenn sie in Reichweite der Gebietsstufe vorkommt (z. B. gibt es Menschen/Roboter erst ab Stufe 13)
  const narrowed = fam ? pool.filter(m => m.fam === fam) : pool;
  if (narrowed.some(m => Math.abs(m.lvl - level) <= 6)) pool = narrowed;
  let best: MobDef[] = [], bestD = Infinity;
  for (const mob of pool) {
    const d = Math.abs(mob.lvl - level);
    if (d < bestD) { bestD = d; best = []; }
    if (d === bestD) best.push(mob);
  }
  return best[seed % best.length];
}
const weighted = (weights: Partial<Record<Fam, number>>, roll: number): Fam | undefined => {
  const entries = Object.entries(weights) as [Fam, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (!total) return;
  let at = roll * total;
  for (const [fam, w] of entries) { if ((at -= w) < 0) return fam; }
  return entries[entries.length - 1][0];
};
const famFor = (terrain: Terrain, region: Region, roll: number) => {
  const w = { ...FAM_WEIGHTS[terrain] };
  if (region.trait === 'Ätherströmung') w.magic = (w.magic ?? 0) + 4;
  return weighted(w, roll);
};

export const MOB_TTL = { normal: 10 * 60e3, elite: 30 * 60e3, boss: 60 * 60e3 } as const;
const NODE_TTL = 15 * 60e3;

const mobObject = (mob: MobDef, lat: number, lon: number, id: string, extra?: Record<string, unknown>, name = mob.name): GeoObj => ({
  id, k: 'mob', def: mob.id, lat, lon, name, lvl: mob.lvl, fam: mob.fam, role: mob.role, ...(extra ? { extra } : {}),
});

export interface SpawnCtx {
  /** Levelvorgabe nahe selbst geschriebener Zonen (Städte); sonst undefined */
  authoredLevel: (lat: number, lon: number) => number | undefined;
  keep: (object: GeoObj) => void;
}

const fixedNode = (kind: string, tier: number) => NODES[`n_${kind}_${Math.min(9, tier)}`] ? `n_${kind}_${Math.min(9, tier)}` : undefined;

/** Eine Rasterzelle (≈ 280 m): Kandidatenpunkte frei verteilt, Gelände entscheidet über Besiedlung. Positionen und Arten sind pro Zelle stabil. */
export function populateCell(cell: { row: number; column: number; width: number }, point: (uy: number, ux: number) => readonly [number, number], ctx: SpawnCtx) {
  const id = cellId(cell.row, cell.column);
  const roll = rng(hash32('spawn:' + id));
  const accepted: [number, number][] = [];
  const CANDIDATES = 8;
  for (let i = 0; i < CANDIDATES; i++) {
    const [lat, lon] = point(.04 + roll() * .92, .04 + roll() * .92);
    const terrain = terrainAt(lat, lon);
    const chance = roll(), famRoll = roll(), levelRoll = roll(), seed = Math.floor(roll() * 1e9);
    if (terrain === undefined) continue;
    const region = regionAt(lat, lon);
    if (!region) continue;
    // Fische leben im Wasser, alles andere nicht
    if (terrain === T.water) {
      if (chance < .22 && accepted.every(([a, b]) => haversine(a, b, lat, lon) > 90)) {
        accepted.push([lat, lon]);
        const level = authored(ctx, lat, lon) ?? region.lvl[0] + Math.floor(levelRoll ** 1.5 * (region.lvl[1] - region.lvl[0] + 1));
        const def = fixedNode('fish', Math.floor(level / 10));
        if (def) ctx.keep({ id: `n:${id}:${i}`, k: 'node', def, lat, lon, name: NODES[def].name, extra: { terrain: 'water', ttl: NODE_TTL } });
      }
      continue;
    }
    if (accepted.some(([a, b]) => haversine(a, b, lat, lon) < 70)) continue;
    if (chance >= (DENSITY[terrain] ?? .4)) continue;
    accepted.push([lat, lon]);
    const level = authored(ctx, lat, lon) ?? region.lvl[0] + Math.floor(levelRoll ** 1.5 * (region.lvl[1] - region.lvl[0] + 1));
    const kindRoll = (seed % 100) / 100;
    // ≈ 28 % der Punkte sind Ressourcen, passend zum Gelände
    if (kindRoll < .28) {
      const tier = Math.floor(level / 10);
      const magic = region.trait === 'Ätherströmung' && kindRoll < .1;
      const kind = magic ? 'ess' : terrain === T.forest ? 'wood' : terrain === T.industrial ? (kindRoll < .14 ? 'scrap' : 'ore') :
        terrain === T.rock ? (kindRoll < .08 ? 'gem' : 'ore') : terrain === T.wetland ? (kindRoll < .12 ? 'ess' : 'herb') :
        terrain === T.grass || terrain === T.farm ? 'herb' : terrain === T.residential || terrain === T.commercial ? (kindRoll < .05 ? 'scrap' : undefined) : 'herb';
      const def = kind && fixedNode(kind, tier);
      if (def) { ctx.keep({ id: `n:${id}:${i}`, k: 'node', def, lat, lon, name: NODES[def].name, extra: { terrain: Object.keys(T)[terrain], ttl: NODE_TTL } }); continue; }
    }
    const fam = famFor(terrain, region, famRoll);
    if (!fam) continue;
    const special = (seed >>> 7) % 100;
    if (special < 2) { // selten: stärkerer Elitegegner mit Kennzeichnung
      const mob = pickMob('elite', level + 6, seed, fam);
      ctx.keep(mobObject(mob, lat, lon, `m:${id}:${i}`, { rare: true, ttl: MOB_TTL.elite * 2, terrain: Object.keys(T)[terrain] }, `Seltener ${mob.name}`));
    } else if (special < 12) {
      const mob = pickMob('elite', level + 3, seed, fam);
      ctx.keep(mobObject(mob, lat, lon, `m:${id}:${i}`, { ttl: MOB_TTL.elite, terrain: Object.keys(T)[terrain] }));
    } else {
      const mob = pickMob('normal', Math.max(1, level), seed, fam);
      ctx.keep(mobObject(mob, lat, lon, `m:${id}:${i}`, { ttl: MOB_TTL.normal, terrain: Object.keys(T)[terrain] }));
    }
  }
}
const authored = (ctx: SpawnCtx, lat: number, lon: number) => ctx.authoredLevel(lat, lon);

/* ---------- Kachelweite Besonderheiten: Dungeons und Weltbosse ---------- */
const DUNGEONS = Object.values(LOCS).filter(l => l.kind === 'boss' || l.theme === 'dungeon').sort((a, b) => a.lvl[0] - b.lvl[0]);
function spot(x: number, y: number, seed: string, prefer: Terrain[]): [number, number] | undefined {
  const b = tileBounds(x, y);
  const roll = rng(hash32(seed));
  let fallback: [number, number] | undefined;
  for (let i = 0; i < 14; i++) {
    const lat = b.south + (b.north - b.south) * (.1 + roll() * .8), lon = b.west + (b.east - b.west) * (.1 + roll() * .8);
    const t = terrainAt(lat, lon);
    if (t === undefined || t === T.water) continue;
    if (prefer.includes(t)) return [lat, lon];
    fallback ??= [lat, lon];
  }
  return fallback;
}
export function tileFeatures(x: number, y: number): GeoObj[] {
  const region = regionOf(x, y);
  if (!region || region.tier < 3) return [];
  const out: GeoObj[] = [];
  const key = tileKey(x, y);
  const h = hash32('tilefeat:' + key);
  if (h % 8 === 0) {
    const dungeon = DUNGEONS.find(l => l.lvl[1] >= region.lvl[0] + 5) ?? DUNGEONS[DUNGEONS.length - 1];
    const at = spot(x, y, 'dg:' + key, [T.rock, T.forest, T.industrial, T.wetland]);
    if (at) out.push({ id: `d:${key}`, k: 'dungeon', def: dungeon.id, lat: at[0], lon: at[1], name: `Dungeoneingang: ${dungeon.name}`, lvl: dungeon.lvl[0], r: 60, extra: { regional: true, area: region.name } });
  }
  if (h % 7 === 1) {
    const at = spot(x, y, 'bs:' + key, [T.forest, T.rock, T.wetland, T.grass]);
    if (at) {
      const mob = pickMob('boss', Math.floor((region.lvl[0] + region.lvl[1]) / 2), h);
      out.push(mobObject(mob, at[0], at[1], `b:${key}`, { ttl: MOB_TTL.boss, regional: true, area: region.name, mechanic: mob.phases?.length ? 'phasen' : 'wucht' }, `Weltboss ${mob.name}`));
    }
  }
  return out;
}
export function tileFeaturesNear(lat: number, lon: number, radius: number): GeoObj[] {
  const a = tileXY(lat + radius / 111000, lon - radius / (111000 * Math.cos(lat * Math.PI / 180)));
  const b = tileXY(lat - radius / 111000, lon + radius / (111000 * Math.cos(lat * Math.PI / 180)));
  const out: GeoObj[] = [];
  for (let y = a.y; y <= b.y; y++) for (let x = a.x; x <= b.x; x++) out.push(...tileFeatures(x, y));
  return out;
}

/* ---------- NPCs an realen OSM-POIs ---------- */
const WEAPON_SUB = new Set(['sports', 'outdoor', 'hunting', 'military', 'hardware', 'doityourself', 'bicycle', 'car_repair']);
const ARMOR_SUB = new Set(['clothes', 'clothing', 'shoes', 'boutique', 'leather', 'jewelry', 'fashion']);
const CRAFTS = ['schneider', 'alchemist', 'koch', 'baumeister', 'ingenieur', 'schmied'];
function roleOf(poi: TerrainPoi, h: number): string | undefined {
  const c = poi.cls, s = poi.sub;
  if (['bank', 'atm'].includes(c)) return 'bankier';
  if (['veterinary', 'zoo'].includes(c) || (c === 'shop' && s === 'pet')) return 'petra';
  if (['hospital', 'doctors', 'dentist', 'clinic'].includes(c)) return 'mira';
  if (c === 'pharmacy') return 'lena';
  if (['railway', 'bus', 'subway', 'tram_stop', 'ferry_terminal', 'airport', 'harbor', 'fuel', 'bus_station'].includes(c)) return 'vex';
  if (['library', 'town_hall', 'school', 'university', 'college', 'museum', 'information', 'post', 'courthouse'].includes(c)) return 'orwin';
  if (['bar', 'pub', 'nightclub', 'biergarten', 'social_facility'].includes(c)) return 'gildmeister';
  if (['police', 'fire_station'].includes(c) || WEAPON_SUB.has(s)) return 'torben';
  if (c === 'clothing_store' || ARMOR_SUB.has(s)) return 'schmied';
  if (['lodging', 'hotel', 'hostel', 'estate_agent', 'real_estate'].includes(c) || s === 'estate_agent') return 'makler';
  if (['shop', 'grocery', 'supermarket', 'convenience', 'bakery', 'butcher', 'marketplace', 'department_store', 'mall', 'florist', 'alcohol_shop'].includes(c)) return 'lena';
  if (['restaurant', 'fast_food', 'cafe', 'ice_cream', 'food_court'].includes(c)) return h % 3 === 0 ? 'koch' : undefined;
  if (['car_repair', 'car_wash', 'charging_station'].includes(c) || s === 'craft') return CRAFTS[h % CRAFTS.length];
  return undefined;
}
const KEY_ROLES = ['bankier', 'makler', 'torben', 'schmied', 'lena', 'orwin', 'petra', 'vex', 'gildmeister', 'mira'];
const npcCache = new WeakMap<object, GeoObj[]>();
export function tileNpcs(x: number, y: number): GeoObj[] {
  const tile = getTile(x, y);
  if (!tile || tile.failed || !tile.pois.length) return [];
  const cached = npcCache.get(tile);
  if (cached) return cached;
  const key = tileKey(x, y);
  const pois = tile.pois.map((poi, i) => ({ poi, i, h: hash32(`npc:${key}:${i}:${poi.name}:${poi.cls}`) })).sort((a, b) => a.h - b.h);
  const chosen: { npc: string; poi: TerrainPoi; i: number }[] = [];
  const free = (poi: TerrainPoi) => chosen.every(c => haversine(c.poi.lat, c.poi.lon, poi.lat, poi.lon) >= 110);
  const count = (npc: string) => chosen.filter(c => c.npc === npc).length;
  // 1. passende POIs; je Rolle höchstens 2 pro Kachel
  for (const entry of pois) {
    const npc = roleOf(entry.poi, entry.h);
    if (npc && NPCS[npc] && count(npc) < 2 && free(entry.poi) && chosen.length < 16) chosen.push({ npc, poi: entry.poi, i: entry.i });
  }
  // 2. fehlende Schlüsselrollen in Siedlungen mit beliebigen freien POIs ergänzen
  if (tile.buildings >= 20) {
    for (const npc of KEY_ROLES) {
      if (count(npc) || chosen.length >= 18) continue;
      const entry = pois.find(e => !chosen.some(c => c.i === e.i) && free(e.poi));
      if (entry) chosen.push({ npc, poi: entry.poi, i: entry.i });
    }
  }
  const out = chosen.map(({ npc, poi, i }): GeoObj => {
    const def = NPCS[npc];
    return { id: `r:npc:${npc}:${key}:${i}`, k: 'npc', def: npc, lat: poi.lat, lon: poi.lon, name: `${def.name} · ${def.title}`, r: 40, extra: { loc: def.loc, services: def.services, regional: true, poi: poi.name || undefined, poiClass: poi.cls } };
  });
  npcCache.set(tile, out);
  return out;
}
export function npcsNear(lat: number, lon: number, radius: number): GeoObj[] {
  const a = tileXY(lat + radius / 111000, lon - radius / (111000 * Math.cos(lat * Math.PI / 180)));
  const b = tileXY(lat - radius / 111000, lon + radius / (111000 * Math.cos(lat * Math.PI / 180)));
  const out: GeoObj[] = [];
  for (let y = a.y; y <= b.y; y++) for (let x = a.x; x <= b.x; x++) out.push(...tileNpcs(x, y));
  return out.filter(o => haversine(lat, lon, o.lat, o.lon) <= radius);
}

/* ---------- Gebiete für die Kartenanzeige ---------- */
export function zonesNear(lat: number, lon: number, radius: number) {
  const a = tileXY(lat + radius / 111000, lon - radius / (111000 * Math.cos(lat * Math.PI / 180)));
  const b = tileXY(lat - radius / 111000, lon + radius / (111000 * Math.cos(lat * Math.PI / 180)));
  const zones: { id: string; tier: number; lvl: [number, number]; name: string; label: string; bounds: [number, number, number, number] }[] = [];
  for (let y = a.y; y <= b.y; y++) for (let x = a.x; x <= b.x; x++) {
    const region = regionOf(x, y), box = tileBounds(x, y);
    if (region) zones.push({ id: region.id, tier: region.tier, lvl: region.lvl, name: region.name, label: region.label, bounds: [box.west, box.south, box.east, box.north] });
  }
  return zones;
}
void GEO; void poisNear;

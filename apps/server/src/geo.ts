import { publishProgress } from './character-save';
import { GEO, haversine, moveToward, cellOf, cellId, hash32, rng, quant, type GeoObj } from '@nam/shared';
import { GEO_ANCHORS, GEO_START, LOCS, MOBS, NODES, ITEMS, NPCS, placeNear, type MobDef } from '@nam/game-data';
import { deferMessages, G, now, send, sys, uid, type Player } from './state';
import { H } from './handlers';
import { setLocSilent, enterScene, exitScene, teleportTo } from './world';
import { questEvent } from './quests';
import { spawnMob, profGain, locOf } from './game';
import { invAdd, addTrainExp } from './chars';
const S = (v: any) => (typeof v === 'string' ? v : '');
const NUM = (v: unknown, a: number, b: number) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b ? v : null;
const anchorList = Object.entries(GEO_ANCHORS);
const MOB_LIST = Object.values(MOBS).filter(m => m.role === 'normal'); const ELITES = Object.values(MOBS).filter(m => m.role === 'elite'); const BOSSES = Object.values(MOBS).filter(m => m.role === 'boss');
const DUNGEONS = Object.values(LOCS).filter(l => l.kind === 'boss' || l.theme === 'dungeon');
const NODE_KINDS = ['mining', 'herbalism', 'woodcutting'] as const; const NODE_ID = { mining: 'n_ore_', herbalism: 'n_herb_', woodcutting: 'n_wood_' };
export function nearestAnchor(lat: number, lon: number) { let best = Infinity, id = ''; for (const [k, a] of anchorList) { const d = haversine(lat, lon, a[0], a[1]); if (d < best) { best = d; id = k; } } return { id, d: best }; }
/** Zone (Ort) an realer Position: nur Orte, deren Radius die Position enthält; sonst bisheriger Ort. */
export function zoneAt(lat: number, lon: number, cur: string): string { let best = cur, bd = Infinity; for (const [k, a] of anchorList) { const d = haversine(lat, lon, a[0], a[1]); if (d <= a[2] && d < bd) { bd = d; best = k; } } return best; }
const bucket = () => Math.floor(now() / GEO.spawnBucketMs);
/** Deterministische dynamische Spawns: Zelle × Zeit-Bucket → Objekte. Stufe steigt mit Entfernung zu Städten (Wildnis ist gefährlicher). */
const STATIC: GeoObj[] = [];
for (const n of Object.values(NPCS)) { const [la, lo] = placeNear(n.loc, 'npc:' + n.id); STATIC.push({ id: 'x:npc:' + n.id, k: 'npc', def: n.id, lat: la, lon: lo, name: `${n.name} · ${n.title}`, r: 40, extra: { loc: n.loc, services: n.services } }); }
for (const l of Object.values(LOCS)) for (const h of l.hotspots) if (h.kind === 'station') { const [la, lo] = placeNear(l.id, 'st:' + h.id); STATIC.push({ id: 'x:st:' + h.id, k: 'station', def: h.prof!, lat: la, lon: lo, name: h.label, r: 40, extra: { loc: l.id } }); }
const PORTALS: GeoObj[] = Object.values(NPCS)
  .filter(npc => npc.services.includes('teleport'))
  .map(npc => {
    const [lat, lon] = GEO_ANCHORS[npc.loc];
    return { id: 'x:tp:' + npc.loc, k: 'teleporter', def: npc.loc, lat, lon, name: 'Teleportportal · ' + LOCS[npc.loc].name };
  });
STATIC.push(...PORTALS);
export function geoObjects(lat: number, lon: number, radius = GEO.viewM): GeoObj[] {
  const out: GeoObj[] = []; for (const o of STATIC) if (haversine(lat, lon, o.lat, o.lon) <= radius) out.push(o); const [cy, cx] = cellOf(lat, lon); const n = Math.ceil(radius / 280) + 1; const b = bucket(); const t = now();
  for (let dy = -n; dy <= n; dy++) for (let dx = -n; dx <= n; dx++) {
    const y = cy + dy, x = cx + dx, id = cellId(y, x); const r = rng(hash32(id + ':' + b)); const rs = rng(hash32(id + ':static'));
    const clat = (y + .5) * GEO.cellDeg, clon = (x + .5) * GEO.cellDeg; const na = nearestAnchor(clat, clon); const lvl0 = Math.max(1, Math.min(100, Math.floor(1 + (na.d / 1000) * .5)));
    const pos = (g: () => number) => ({ lat: (y + .1 + g() * .8) * GEO.cellDeg, lon: (x + .1 + g() * .8) * GEO.cellDeg });
    const keep = (o: GeoObj) => { if (haversine(lat, lon, o.lat, o.lon) <= radius && !((G.geoTaken.get(o.id) || 0) > t)) out.push(o); };
    const nm = r() < .28 ? 1 + (r() < .35 ? 1 : 0) : 0;
    for (let i = 0; i < nm; i++) { const lv = Math.max(1, Math.min(100, lvl0 + Math.floor(r() * 5) - 2)); const roll = r(); const pool = roll < .04 ? ELITES : MOB_LIST; const d = pool.reduce((a, m) => (Math.abs(m.lvl - lv) < Math.abs(a.lvl - lv) || (Math.abs(m.lvl - lv) === Math.abs(a.lvl - lv) && r() < .5) ? m : a), pool[0]); const p = pos(r); keep({ id: `m:${id}:${i}:${b}`, k: 'mob', def: d.id, ...p, name: d.name, lvl: d.lvl, fam: d.fam, role: d.role }); }
    if (r() < .14) { const kind = NODE_KINDS[Math.floor(r() * 3)]; const tier = Math.min(9, Math.floor(lvl0 / 10)); const def = NODE_ID[kind] + tier; const p = pos(r); keep({ id: `n:${id}:${b}`, k: 'node', def, ...p, name: NODES[def].name }); }
    if (rs() < .006) { const dg = DUNGEONS.reduce((a, l) => (Math.abs(l.lvl[0] - lvl0) < Math.abs(a.lvl[0] - lvl0) ? l : a), DUNGEONS[0]); const p = pos(rs); keep({ id: `d:${id}`, k: 'dungeon', def: dg.id, ...p, name: `Dungeoneingang: ${dg.name}`, lvl: dg.lvl[0], r: 60 }); }
    if (rs() < .0015 && na.d > 10000) { const bs = BOSSES[Math.floor(rs() * BOSSES.length)]; const p = pos(rs); keep({ id: `b:${id}:${Math.floor(t / 36e5)}`, k: 'mob', def: bs.id, ...p, name: `☠ ${bs.name}`, lvl: bs.lvl, fam: bs.fam, role: 'boss' }); }
    if (rs() < .004) { const p = pos(rs); keep({ id: `p:${id}`, k: 'poi', def: 'treasure', ...p, name: 'Magische Quelle' }); }
  }
  for (const [k, a] of anchorList) if (haversine(lat, lon, a[0], a[1]) <= radius + a[2]) out.push({ id: 'c:' + k, k: 'city', def: k, lat: a[0], lon: a[1], name: LOCS[k].name, lvl: LOCS[k].lvl[0], r: a[2], extra: { kind: LOCS[k].kind } });
  for (const h of G.houses.values()) { const g = (h as any).geo; if (g && haversine(lat, lon, g.lat, g.lon) <= radius) out.push({ id: 'h:' + h.id, k: 'house', def: h.kind, lat: g.lat, lon: g.lon, name: `${h.kind === 'guild' ? 'Gildenhaus' : 'Haus'} ${h.ownerName}` }); }
  return out;
}
function gs(p: Player) { return p.geo ||= { on: false, gps: false, visible: true, lat: GEO_START[0], lon: GEO_START[1], has: false, mode: 'virtual', dest: null, lastT: 0, strikes: [], lockUntil: 0, flags: [], lastPush: 0, day: 0, dayM: 0, visited: new Set() }; }
H.geoConsent = (p, m) => { const g = gs(p); g.on = !!m.on; g.gps = !!m.gps && !!m.on; g.mode = g.gps ? 'gps' : 'virtual'; g.dest = null; g.visible = m.visible !== false; const c = p.c; c.geo = { consent: g.on, visible: g.visible, qlat: c.geo?.qlat ?? 0, qlon: c.geo?.qlon ?? 0, gpsM: c.geo?.gpsM ?? 0, dayM: c.geo?.dayM ?? 0, day: c.geo?.day ?? 0 }; if (g.on && !g.has) { if (c.geo.qlat) { g.lat = c.geo.qlat; g.lon = c.geo.qlon; } g.has = true; } p.dirty = true; if (g.on) pushGeo(p, true); else send(p, { t: 'geo', off: true }); };
H.geoWipe = (p) => { const g = gs(p); g.on = false; g.has = false; g.dest = null; g.visited.clear(); p.c.geo = undefined; for (const h of G.houses.values()) if (h.ownerId === p.c.id) { delete (h as any).geo; G.store.put('houses', h.id, h); G.store.geoDel?.('house:' + h.id); } p.dirty = true; send(p, { t: 'geo', off: true }); sys(p, 'Alle gespeicherten Standortdaten wurden gelöscht.'); };
function strike(p: Player, flag: string) { const g = gs(p); const t = now(); g.strikes = g.strikes.filter(x => t - x < 10 * 60e3); g.strikes.push(t); if (!g.flags.includes(flag)) g.flags.push(flag); if (g.strikes.length >= 6) { g.lockUntil = t + 10 * 60e3; g.flags.push('locked'); sys(p, 'Standortfunktionen wegen unplausibler Bewegungen 10 Min. gesperrt.', 'warn'); } setTimeout(() => { g.flags = g.flags.filter(f => f !== flag); }, 8000); }
H.geoPos = (p, m) => {
  const g = gs(p); if (!g.on || !g.gps) return 'GPS nicht freigegeben'; const t = now(); if (g.lockUntil > t) return 'Standort gesperrt'; if (t - g.lastT < GEO.minPosIntervalMs) return; const lat = NUM(m.lat, -85, 85), lon = NUM(m.lon, -180, 180); if (lat === null || lon === null) { strike(p, 'invalid'); return 'Ungültige Koordinaten'; }
  const acc = Number(m.acc) || 0; if (acc > 150) { g.flags.push('accuracy'); setTimeout(() => { g.flags = g.flags.filter(f => f !== 'accuracy'); }, 5000); return; } if (m.mode !== 'gps') return;
  if (g.has && g.lastT) { const dt = Math.max(.5, (t - g.lastT) / 1000); const d = haversine(g.lat, g.lon, lat, lon); const cap = dt > 600 ? 250 : GEO.maxSpeed.gps; if (d > 40 && d > cap * dt + 40) { strike(p, d > 5000 ? 'teleport' : 'speed'); return 'Bewegung unplausibel (zu schnell)'; }
    if (d < 6000) { const c = p.c.geo!; const day = Math.floor(t / 864e5); if (c.day !== day) { c.day = day; c.dayM = 0; } const credit = Math.min(d, Math.max(0, 10000 - c.dayM)); if (credit >= 20 && acc <= 50) { c.gpsM += credit; c.dayM += credit; const before = Math.floor((c.gpsM - credit) / 100), after = Math.floor(c.gpsM / 100); if (after > before) { addTrainExp(p, (after - before) * 2); p.dirty = true; } } } }
  g.lat = lat; g.lon = lon; g.has = true; g.lastT = t; g.mode = 'gps'; g.dest = null; afterMove(p);
};
const virtualSpeed = (p: Player) => GEO.virtualSpeed * (p.c.equipment.mount ? 1.8 : 1);
H.geoWalk = (p, m) => {
  const g = gs(p);
  if (!g.on) return 'Virtueller Modus nicht aktiv';
  if (g.lockUntil > now()) return 'Standort gesperrt';
  if (g.gps) return 'Wechsle zuerst in den virtuellen Modus';
  if (p.dead || p.travel || p.inScene || p.duel) return 'Bewegung gerade nicht möglich';
  const lat = NUM(m.lat, -85, 85), lon = NUM(m.lon, -180, 180);
  if (lat === null || lon === null) return 'Ungültige Koordinaten';
  const distance = haversine(g.lat, g.lon, lat, lon);
  if (distance > 200000) return 'Ziel zu weit für virtuelles Laufen (max. 200 km)';
  g.dest = distance > 0 ? { lat, lon } : null;
  pushGeo(p);
  return { etaSeconds: Math.ceil(distance / virtualSpeed(p)) };
};
H.geoStop = (p) => { const g = gs(p); g.dest = null; if (g.on) pushGeo(p); };
function afterMove(p: Player) {
  const g = gs(p); const c = p.c; c.geo ||= { consent: true, visible: g.visible, qlat: 0, qlon: 0, gpsM: 0, dayM: 0, day: 0 }; c.geo.qlat = quant(g.lat, GEO.playerQuantDeg); c.geo.qlon = quant(g.lon, GEO.playerQuantDeg);
  for (const [k, a] of anchorList) if (haversine(g.lat, g.lon, a[0], a[1]) <= a[2] && !g.visited.has(k)) { g.visited.add(k); if (!c.discovered.includes(k)) { c.discovered.push(k); sys(p, `Reale Entdeckung: ${LOCS[k].name}!`, 'quest'); p.dirty = true; } questEvent(p, 'visit', k); }
  for (const [k, a] of anchorList) if (g.visited.has(k) && haversine(g.lat, g.lon, a[0], a[1]) > a[2] * 1.5) g.visited.delete(k);
  if (!p.inScene) { const z = zoneAt(g.lat, g.lon, p.loc); if (z !== p.loc) setLocSilent(p, z); }
}
export function geoTick() {
  const t = now(); for (const p of G.players.values()) { const g = p.geo; if (!p.online || !g?.on || !g.has) continue;
    if (g.dest && !p.dead && !p.inScene && !p.travel && !p.duel) { const sp = virtualSpeed(p); const r = moveToward(g.lat, g.lon, g.dest.lat, g.dest.lon, sp); g.lat = r.lat; g.lon = r.lon; g.lastT = t; if (r.arrived) g.dest = null; afterMove(p); }
    if (t - g.lastPush > 2000) pushGeo(p); } }
export function pushGeo(p: Player, force = false) {
  const g = gs(p); const t = now(); if (!g.on) return; g.lastPush = t; const players = [...G.players.values()].filter(q => q !== p && q.online && q.geo?.on && q.geo.has && q.geo.visible && haversine(g.lat, g.lon, q.geo.lat, q.geo.lon) <= GEO.viewM).map(q => ({ id: q.id, name: q.c.name, cls: q.c.cls, lvl: q.c.level, lat: quant(q.geo!.lat, GEO.playerQuantDeg), lon: quant(q.geo!.lon, GEO.playerQuantDeg) }));
  send(p, { t: 'geo', me: { lat: g.lat, lon: g.lon, mode: g.mode, dest: g.dest, speed: g.dest ? virtualSpeed(p) : 0, etaSeconds: g.dest ? Math.ceil(haversine(g.lat, g.lon, g.dest.lat, g.dest.lon) / virtualSpeed(p)) : 0, flags: g.flags.slice(-3), gpsM: Math.round(p.c.geo?.gpsM || 0), dayM: Math.round(p.c.geo?.dayM || 0) }, objs: geoObjects(g.lat, g.lon), players, rev: t }); void force;
}
const findLocWith = (mob: string) => Object.values(LOCS).filter(l => l.spawns.some(s => s.mob === mob) && !l.safe).sort((a, b) => a.lvl[0] - b.lvl[0])[0]?.id || 'stadtpark';
H.geoInteract = (p, m) => {
  const g = gs(p); if (!g.on || !g.has) return 'Standort nicht aktiv'; if (g.lockUntil > now()) return 'Standort gesperrt'; if (p.dead || p.travel || p.inScene) return 'Nicht möglich'; if (p.combatUntil > now()) return 'Im Kampf nicht möglich';
  const o = geoObjects(g.lat, g.lon, GEO.viewM + 200).find(x => x.id === S(m.id)); if (!o) return 'Objekt nicht mehr vorhanden';
  const d = haversine(g.lat, g.lon, o.lat, o.lon); if (d > GEO.interactM + (o.r || 0)) return `Zu weit entfernt (${Math.round(d)} m)`;
  const taken = (ttl = GEO.spawnBucketMs) => G.geoTaken.set(o.id, now() + ttl);
  switch (o.k) {
    case 'npc': { const r = H.npc(p, { id: o.def }); return typeof r === 'string' ? r : { npc: o.def }; }
    case 'teleporter': {
      const destinations = Object.values(LOCS)
        .filter(loc => loc.tele !== undefined && GEO_ANCHORS[loc.id] && loc.id !== o.def && p.c.discovered.includes(loc.id))
        .map(loc => ({ id: loc.id, name: loc.name, cost: loc.tele }));
      if (m.to === undefined) return { destinations };
      const destination = destinations.find(loc => loc.id === m.to);
      if (!destination || destination.cost === undefined) return 'Ziel nicht verfügbar';
      if (g.gps) return 'Teleportieren ist im virtuellen Modus möglich';
      let error: string | null = null;
      const notify = deferMessages(p, () => {
        error = teleportTo(p, destination.id, destination.cost!);
        if (error) return;
        g.dest = null;
        g.lastT = now();
        afterMove(p);
      });
      if (error) return error;
      publishProgress(p, undefined, () => { notify(); pushGeo(p); });
      return { teleported: destination.name };
    }
    case 'station': { setLocSilent(p, o.extra.loc); return { station: o.def }; }
    case 'city': { setLocSilent(p, o.def); return { city: o.def, text: LOCS[o.def].desc }; }
    case 'mob': { const md = MOBS[o.def]; const locId = findLocWith(o.def); if (p.c.level + 15 < md.lvl && md.role !== 'normal') return 'Dieser Gegner ist weit über deiner Stufe'; taken(10 * 60e3); enterScene(p, locId); const l = locOf(p); const mob = spawnMob(l, o.def, true); mob.maxHp = mob.hp = md.hp; mob.skills = md.skills; mob.add = true; mob.x = 70; mob.y = 70; mob.hx = 70; mob.hy = 70; mob.threat[p.id] = 1; p.target = mob.uid; p.auto = true; sys(p, `Begegnung: ${md.name} (Lv ${md.lvl})`, 'warn'); return { scene: locId }; }
    case 'node': { const nd = NODES[o.def]; const pr = p.c.prof[nd.prof] ||= { lvl: 1, exp: 0 }; if (pr.lvl < nd.tier * 10) return `Benötigt Berufslevel ${nd.tier * 10}`; const toolType = { mining: 'pickaxe', herbalism: 'sickle', woodcutting: 'axe' }[nd.prof]; if (!p.c.inventory.some(i => ITEMS[i.id].tool === toolType && ITEMS[i.id].tier >= nd.tier)) return 'Passendes Werkzeug fehlt'; taken(); const q = 1 + Math.floor(Math.random() * 3); invAdd(p.c, nd.yield, q); profGain(p, nd.prof, 8 + nd.tier * 12); questEvent(p, 'gather', nd.yield, q); sys(p, `Gesammelt: ${ITEMS[nd.yield].name} ×${q}`, 'loot'); return { gathered: nd.yield }; }
    case 'dungeon': { const l = LOCS[o.def]; if (p.c.level < l.lvl[0] - 5) return `Empfohlen ab Level ${l.lvl[0]}`; enterScene(p, o.def); return { scene: o.def }; }
    case 'poi': { taken(30 * 60e3); p.c.hp = p.st.maxHp; p.c.res = p.st.maxRes; const g2 = 20 + p.c.level * 5; p.c.gold += g2; sys(p, `Magische Quelle: voll erholt, +${g2} Gold`, 'loot'); return { poi: true }; }
    case 'house': return { house: o.id.slice(2) };
  }
  return 'Nicht interagierbar';
};
/** Kampf-/Dungeonansicht verlassen; Spieler kehrt auf die Weltkarte zurück. */
H.geoFlee = (p) => { if (!p.inScene) return; exitScene(p); const g = p.geo; if (g?.has) setLocSilent(p, zoneAt(g.lat, g.lon, p.loc)); p.dirty = true; };
/** Haus an aktueller (gerundeter) Position verankern – nur mit Einwilligung. */
export function anchorHouse(p: Player, h: any) { const g = p.geo; if (!g?.on || !g.has) return; h.geo = { lat: quant(g.lat, GEO.playerQuantDeg), lon: quant(g.lon, GEO.playerQuantDeg) }; G.store.geoUpsert?.('house:' + h.id, 'house', h.geo.lat, h.geo.lon, { owner: h.ownerName }); }
void uid;

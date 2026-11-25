import { publishProgress } from './character-save';
import { GEO, R_EARTH, haversine, moveToward, quant, rad, wrapLon, type GeoPosition } from '@nam/shared';
import { GEO_ANCHORS, GEO_START, LOCS, MOBS, NODES, ITEMS } from '@nam/game-data';
import { clamp, deferMessages, G, now, send, sys, type GeoState, type House, type Player } from './state';
import { H } from './handlers';
import { setLocSilent, enterScene, exitScene, teleportTo } from './world';
import { questEvent, recordRegionalVisit } from './quests';
import { spawnMob, profGain, locOf } from './game';
import { invAdd, addTrainExp } from './chars';
import { anchorList, geoObjects } from './geo-world';
import { loadOsmPoints } from './geo-osm';

const S = (v: unknown) => typeof v === 'string' ? v.slice(0, 80) : '';
const NUM = (v: unknown, a: number, b: number) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b ? v : null;
const GPS_LOCK_MS = 10 * 60e3;
const GEO_PUSH_MS = 2000;
const virtualSpeed = (p: Player) => GEO.virtualSpeed * (p.c.equipment.mount ? 1.8 : 1);
const positionBlocked = (p: Player) => p.dead || p.travel || p.inScene || p.duel || p.houseId;

export function zoneAt(lat: number, lon: number, current: string): string {
  let nearest = current;
  let distance = Infinity;
  for (const [id, a] of anchorList) {
    const d = haversine(lat, lon, a[0], a[1]);
    if (d <= a[2] && d < distance) { nearest = id; distance = d; }
  }
  return nearest;
}

function gs(p: Player): GeoState {
  if (p.geo) return p.geo;
  const saved = p.c.geo;
  const hasSavedPosition = saved && (saved.positionSet || saved.qlat !== 0 || saved.qlon !== 0);
  return p.geo = {
    on: false, gps: false, visible: saved?.visible ?? true,
    lat: hasSavedPosition ? saved.qlat : GEO_START[0], lon: hasSavedPosition ? saved.qlon : GEO_START[1],
    has: false, regionLabel: 'Regionale Wildnis', dest: null, steer: null, motionAt: 0,
    fix: saved?.gpsFix ? { ...saved.gpsFix, rounded: true } : undefined,
    strikes: saved?.gpsStrikes || [], lockUntil: saved?.gpsLockUntil || 0,
    flags: [], lastPush: 0, visited: new Set(),
  };
}

H.geoConsent = (p, m) => {
  const g = gs(p);
  const enabled = m.on === true;
  const gps = enabled && m.gps === true;
  if (g.gps !== gps || !enabled) {
    g.dest = g.steer = null;
    g.motionAt = 0;
    g.has = false;
  }
  g.on = enabled;
  g.gps = gps;
  g.visible = m.visible !== false;
  p.c.geo = { qlat: 0, qlon: 0, gpsM: 0, dayM: 0, day: 0, ...p.c.geo, consent: g.on, visible: g.visible };
  p.dirty = true;
  if (!g.on) {
    send(p, { t: 'geo', off: true });
    return;
  }
  if (!g.gps) {
    g.has = true;
    afterMove(p);
  }
  pushGeo(p);
};

H.geoWipe = (p) => {
  p.geo = undefined;
  p.c.geo = undefined;
  for (const h of G.houses.values()) if (h.ownerId === p.c.id) {
    delete h.geo;
    void G.store.put('houses', h.id, h);
    G.store.geoDel?.('house:' + h.id);
  }
  p.dirty = true;
  publishProgress(p, undefined, () => {
    send(p, { t: 'geo', off: true });
    sys(p, 'Alle gespeicherten Standortdaten wurden gelöscht.');
  });
};

function flag(g: GeoState, name: string, duration: number) {
  if (g.flags.includes(name)) return;
  g.flags.push(name);
  setTimeout(() => { g.flags = g.flags.filter(f => f !== name); }, duration);
}

function recordStrike(p: Player, g: GeoState, name: string, time: number) {
  g.strikes = [...g.strikes.filter(t => time - t < GPS_LOCK_MS), time];
  p.c.geo!.gpsStrikes = g.strikes;
  flag(g, name, 8000);
  if (g.strikes.length >= 6) {
    p.c.geo!.gpsLockUntil = g.lockUntil = time + GPS_LOCK_MS;
    sys(p, 'Standortfunktionen wegen unplausibler Bewegungen 10 Min. gesperrt.', 'warn');
  }
  p.dirty = true;
}

H.geoPos = (p, m, receivedAt = now()) => {
  const g = gs(p);
  if (!g.on || !g.gps) return 'GPS nicht freigegeben';
  if (g.lockUntil > receivedAt) return 'Standort gesperrt';
  if (m.mode !== 'gps') return 'Ungültiger Standortmodus';
  const previous = g.fix;
  if (g.has && previous && receivedAt - previous.at < GEO.minPosIntervalMs) return;
  const lat = NUM(m.lat, -85, 85), lon = NUM(m.lon, -180, 180);
  const accuracy = NUM(m.acc, 0, 100000);
  if (lat === null || lon === null || accuracy === null) {
    recordStrike(p, g, 'invalid', receivedAt);
    return 'Ungültige Koordinaten';
  }
  if (accuracy > 150) {
    flag(g, 'accuracy', 5000);
    return;
  }

  const saved = p.c.geo!;
  if (previous) {
    const dt = Math.max(.5, (receivedAt - previous.at) / 1000);
    const distance = haversine(previous.lat, previous.lon, lat, lon);
    const speedCap = dt > 600 ? 250 : GEO.maxSpeed.gps;
    const tolerance = previous.rounded ? 120 : 40;
    if (distance > speedCap * dt + tolerance) {
      recordStrike(p, g, distance > 5000 ? 'teleport' : 'speed', receivedAt);
      return 'Bewegung unplausibel (zu schnell)';
    }
    if (g.has && distance < 6000 && accuracy <= 50) {
      const day = Math.floor(receivedAt / 864e5);
      if (saved.day !== day) { saved.day = day; saved.dayM = 0; }
      const credit = Math.min(distance, Math.max(0, 10000 - saved.dayM));
      if (credit >= 20) {
        const before = Math.floor(saved.gpsM / 100);
        saved.gpsM += credit;
        saved.dayM += credit;
        const after = Math.floor(saved.gpsM / 100);
        if (after > before) addTrainExp(p, (after - before) * 2);
      }
    }
  }
  const first = !g.has;
  g.lat = lat;
  g.lon = lon;
  g.has = true;
  g.fix = { lat, lon, at: receivedAt };
  g.flags = g.flags.filter(name => name !== 'accuracy');
  afterMove(p);
  saved.gpsFix = { lat: saved.qlat, lon: saved.qlon, at: receivedAt };
  p.dirty = true;
  if (first) pushGeo(p);
  else sendMotion(p, g);
};

H.geoWalk = (p, m) => {
  const g = gs(p);
  if (!g.on) return 'Virtueller Modus nicht aktiv';
  if (g.lockUntil > now()) return 'Standort gesperrt';
  if (g.gps) return 'Wechsle zuerst in den virtuellen Modus';
  if (positionBlocked(p)) return 'Bewegung gerade nicht möglich';
  const lat = NUM(m.lat, -85, 85), lon = NUM(m.lon, -180, 180);
  if (lat === null || lon === null) return 'Ungültige Koordinaten';
  const distance = haversine(g.lat, g.lon, lat, lon);
  if (distance > 200000) return 'Ziel zu weit für virtuelles Laufen (max. 200 km)';
  g.steer = null;
  g.motionAt = now();
  g.dest = distance > 0 ? { lat, lon } : null;
  pushGeo(p);
  return { etaSeconds: Math.ceil(distance / virtualSpeed(p)) };
};

H.geoSteer = (p, m, receivedAt = now()) => {
  const g = gs(p);
  const t = now();
  const north = NUM(m.north, -1, 1), east = NUM(m.east, -1, 1);
  if (north === null || east === null) return 'Ungültige Bewegungsrichtung';
  if (!g.on || !g.has || g.gps) return 'Virtueller Modus nicht aktiv';
  if (g.lockUntil > t) return 'Standort gesperrt';
  if (t >= receivedAt + GEO.steerTimeoutMs) return;
  const magnitude = Math.hypot(north, east);
  if (!magnitude) {
    if (g.steer) {
      g.steer = null;
      sendMotion(p, g);
    }
    return;
  }
  if (positionBlocked(p)) return 'Bewegung gerade nicht möglich';
  if (!g.steer || g.steer.until <= t) g.motionAt = t;
  g.dest = null;
  const normalization = Math.max(1, magnitude);
  g.steer = { north: north / normalization, east: east / normalization, until: receivedAt + GEO.steerTimeoutMs };
};

H.geoStop = (p) => {
  const g = gs(p);
  g.dest = g.steer = null;
  if (g.on) pushGeo(p);
};

function afterMove(p: Player) {
  const g = gs(p);
  const c = p.c;
  const saved = c.geo!;
  const qlat = quant(g.lat, GEO.playerQuantDeg), qlon = quant(g.lon, GEO.playerQuantDeg);
  if (!saved.positionSet || qlat !== saved.qlat || qlon !== saved.qlon) {
    Object.assign(saved, { qlat, qlon, positionSet: true });
    p.dirty = true;
  }
  let zone = '';
  let nearest = Infinity;
  for (const [id, a] of anchorList) {
    const distance = haversine(g.lat, g.lon, a[0], a[1]);
    if (distance <= a[2] && distance < nearest) { zone = id; nearest = distance; }
    if (g.visited.has(id)) {
      if (distance > a[2] * 1.5) g.visited.delete(id);
    } else if (distance <= a[2]) {
      g.visited.add(id);
      if (!c.discovered.includes(id)) {
        c.discovered.push(id);
        sys(p, `Reale Entdeckung: ${LOCS[id].name}!`, 'quest');
        p.dirty = true;
      }
      questEvent(p, 'visit', id);
    }
  }
  g.regionLabel = zone ? LOCS[zone].name : 'Regionale Wildnis';
  if (zone && zone !== p.loc && !p.inScene && !p.travel) setLocSilent(p, zone);
  recordRegionalVisit(p);
}

function advanceVirtual(p: Player, g: GeoState, t: number) {
  const { steer, dest } = g;
  if (!steer && !dest) return;
  const dt = Math.max(0, Math.min(250, (steer ? Math.min(t, steer.until) : t) - g.motionAt)) / 1000;
  g.motionAt = t;
  if (positionBlocked(p) || g.lockUntil > t) {
    if (steer) { g.steer = null; sendMotion(p, g); }
    return;
  }
  const distance = virtualSpeed(p) * dt;
  if (steer) {
    const radiansToDegrees = 180 / Math.PI;
    g.lat = clamp(g.lat + steer.north * distance / R_EARTH * radiansToDegrees, -85, 85);
    g.lon = wrapLon(g.lon + steer.east * distance / (R_EARTH * Math.cos(rad(g.lat))) * radiansToDegrees);
    if (t >= steer.until) g.steer = null;
  } else if (dest) {
    const step = moveToward(g.lat, g.lon, dest.lat, dest.lon, distance);
    g.lat = step.lat;
    g.lon = step.lon;
    if (step.arrived) g.dest = null;
  }
  if (dt > 0) afterMove(p);
  sendMotion(p, g);
}

let nextGeoCleanup = 0;
export function geoTick() {
  const t = now();
  if (t >= nextGeoCleanup) {
    for (const [id, until] of G.geoTaken) if (until <= t) G.geoTaken.delete(id);
    nextGeoCleanup = t + GEO.spawnBucketMs;
  }
  for (const p of G.players.values()) {
    const g = p.geo;
    if (!p.online || p.ws.readyState !== 1 || !g?.on) continue;
    if (g.has && !g.gps) advanceVirtual(p, g, t);
    if (t - g.lastPush >= GEO_PUSH_MS) pushGeo(p);
  }
}

function geoPosition(p: Player, g: GeoState): GeoPosition {
  const speed = g.dest ? virtualSpeed(p) : g.steer ? virtualSpeed(p) * Math.hypot(g.steer.north, g.steer.east) : 0;
  return {
    lat: g.lat, lon: g.lon, mode: g.gps ? 'gps' : 'virtual', dest: g.dest, speed, regionLabel: g.regionLabel,
    etaSeconds: g.dest ? Math.ceil(haversine(g.lat, g.lon, g.dest.lat, g.dest.lon) / speed) : 0,
    flags: g.flags.slice(-3).concat(g.lockUntil > now() ? ['locked'] : []),
    gpsM: Math.round(p.c.geo?.gpsM || 0), dayM: Math.round(p.c.geo?.dayM || 0),
  };
}

function sendMotion(p: Player, g: GeoState) { send(p, { t: 'geoMotion', position: geoPosition(p, g) }); }

export function pushGeo(p: Player) {
  const g = gs(p);
  if (!g.on) return;
  const t = now();
  g.lastPush = t;
  const position = geoPosition(p, g);
  if (!g.has) {
    send(p, { t: 'geo', pending: true, flags: position.flags, objs: [], players: [], rev: t });
    return;
  }
  const players = [];
  for (const other of G.players.values()) {
    const og = other.geo;
    if (other === p || !other.online || !og?.on || !og.has || !og.visible) continue;
    if (haversine(g.lat, g.lon, og.lat, og.lon) > GEO.viewM) continue;
    players.push({ id: other.id, name: other.c.name, cls: other.c.cls, lvl: other.c.level, lat: quant(og.lat, GEO.playerQuantDeg), lon: quant(og.lon, GEO.playerQuantDeg) });
  }
  loadOsmPoints(g.lat, g.lon);
  send(p, { t: 'geo', me: position, objs: geoObjects(g.lat, g.lon), players, rev: t });
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
        g.steer = null;
        g.motionAt = now();
        afterMove(p);
      });
      if (error) return error;
      publishProgress(p, undefined, () => { notify(); pushGeo(p); });
      return { teleported: destination.name };
    }
    case 'station': { setLocSilent(p, o.extra.loc); return { station: o.def }; }
    case 'city': { setLocSilent(p, o.def); return { city: o.def, text: LOCS[o.def].desc }; }
    case 'mob': {
      const mobDef = MOBS[o.def];
      const origin = p.loc;
      const scene = findLocWith(o.def);
      if (p.c.level + 15 < mobDef.lvl && mobDef.role !== 'normal') return 'Dieser Gegner ist weit über deiner Stufe';
      taken();
      g.dest = g.steer = null;
      enterScene(p, scene);
      const mob = spawnMob(locOf(p), o.def, true, { x: 70, y: 70 });
      mob.maxHp = mob.hp = mobDef.hp;
      mob.skills = mobDef.skills;
      p.mapEncounter = mob.mapEncounter = { target: mob.uid, origin, finish: () => {
        exitScene(p);
        setLocSilent(p, zoneAt(g.lat, g.lon, origin));
        p.combatUntil = 0;
      } };
      mob.threat[p.id] = 1;
      p.target = mob.uid;
      p.auto = true;
      sys(p, `Begegnung: ${mobDef.name} (Lv ${mobDef.lvl})`, 'warn');
      return { scene };
    }
    case 'node': { const nd = NODES[o.def]; const pr = p.c.prof[nd.prof] ||= { lvl: 1, exp: 0 }; if (pr.lvl < nd.tier * 10) return `Benötigt Berufslevel ${nd.tier * 10}`; const toolType = { mining: 'pickaxe', herbalism: 'sickle', woodcutting: 'axe' }[nd.prof]; if (!p.c.inventory.some(i => ITEMS[i.id].tool === toolType && ITEMS[i.id].tier >= nd.tier)) return 'Passendes Werkzeug fehlt'; taken(); const q = 1 + Math.floor(Math.random() * 3); invAdd(p.c, nd.yield, q); profGain(p, nd.prof, 8 + nd.tier * 12); questEvent(p, 'gather', nd.yield, q); sys(p, `Gesammelt: ${ITEMS[nd.yield].name} ×${q}`, 'loot'); return { gathered: nd.yield }; }
    case 'dungeon': { const l = LOCS[o.def]; if (p.c.level < l.lvl[0] - 5) return `Empfohlen ab Level ${l.lvl[0]}`; enterScene(p, o.def); return { scene: o.def }; }
    case 'poi': { if (o.def === 'osm') return { poi: true, osm: true }; taken(30 * 60e3); p.c.hp = p.st.maxHp; p.c.res = p.st.maxRes; const g2 = 20 + p.c.level * 5; p.c.gold += g2; sys(p, `Magische Quelle: voll erholt, +${g2} Gold`, 'loot'); return { poi: true }; }
    case 'house': return { house: o.id.slice(2) };
  }
  return 'Nicht interagierbar';
};
/** Kampf-/Dungeonansicht verlassen; Spieler kehrt auf die Weltkarte zurück. */
H.geoFlee = (p) => {
  if (!p.inScene) return;
  const g = p.geo;
  const fallback = p.mapEncounter?.origin ?? p.loc;
  exitScene(p);
  if (g?.has) setLocSilent(p, zoneAt(g.lat, g.lon, fallback));
  p.dirty = true;
};
/** Haus an aktueller (gerundeter) Position verankern – nur mit Einwilligung. */
export function anchorHouse(p: Player, h: House) { const g = p.geo; if (!g?.on || !g.has) return; h.geo = { lat: quant(g.lat, GEO.playerQuantDeg), lon: quant(g.lon, GEO.playerQuantDeg) }; G.store.geoUpsert?.('house:' + h.id, 'house', h.geo.lat, h.geo.lon, { owner: h.ownerName }); }

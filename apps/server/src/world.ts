import { LOCS, NPCS } from '@nam/game-data';
import { CLASS_BASE, type GeoObj } from '@nam/shared';
import { G, now, send, sys, clamp, toLoc, type DungeonState, type GeoChallenge, type Player } from './state';
import { GEO_ANCHORS } from '@nam/game-data';
import { recalc } from './chars';
import { questEvent, autoStartHidden } from './quests';
import { inPvp, newDungeon } from './game';
import { H } from './handlers';
export function joinLoc(p: Player, to: string, x?: number, y?: number, from?: string) {
  leaveDungeon(p);
  const old = G.locs.get(p.loc); const l = G.locs.get(to)!; const wasPvp = inPvp(p); if (old) old.players.delete(p); leaveHouseSilent(p);
  p.loc = to; p.c.loc = to; l.players.add(p); p.travel = null; p.inScene = false; p.mapEncounter = undefined; p.target = null; p.auto = false; p.autoFarm = null; p.gather = null; p.pending = null;
  const back = from ? LOCS[to].links.find(k => k.to === from) : null; p.x = p.dx = x ?? (back ? clamp(back.x < 50 ? back.x + 8 : back.x - 8, 6, 94) : 50); p.y = p.dy = y ?? (back ? clamp(back.y < 60 ? 62 : back.y - 6, 58, 90) : 78);
  if (!p.c.discovered.includes(to)) { p.c.discovered.push(to); sys(p, `Neuer Ort entdeckt: ${LOCS[to].name}`, 'quest'); }
  if (LOCS[to].kind === 'city') p.c.choices.respawn = to;
  if (wasPvp !== inPvp(p)) { const r = p.c.hp / p.st.maxHp; recalc(p); p.c.hp = Math.max(1, Math.min(p.st.maxHp, Math.round(r * (inPvp(p) ? p.pvpSt!.maxHp : p.st.maxHp)))); }
  questEvent(p, 'visit', to); autoStartHidden(p, to); p.dirty = true;
  send(p, { t: 'enter', loc: to, x: p.x, y: p.y }); send(p, { t: 'char', c: p.c });
  if (LOCS[to].pvp) sys(p, '⚠ PvP-Zone: Spieler können hier angegriffen werden. Werte sind normalisiert.', 'warn');
}
export function startTravel(p: Player, to: string): string | null {
  if (p.mapEncounter || p.dungeon) return 'Verlasse zuerst die Kampfansicht';
  const l = LOCS[p.loc]; const link = l.links.find(k => k.to === to); if (!link) return 'Kein direkter Weg'; if (p.travel) return 'Du reist bereits'; if (p.dead) return 'Du bist tot';
  if (p.combatUntil > now()) return 'Im Kampf kannst du nicht reisen'; if (p.duel) return 'Im Duell nicht möglich'; if (p.c.level < Math.max(1, LOCS[to].lvl[0] - 12) && false) return 'Zu gefährlich';
  const mount = p.c.equipment.mount; const sp = mount ? (mount.id === 'mount_board' ? .25 : mount.id === 'mount_horse' ? .4 : mount.id === 'mount_wolf' ? .5 : .65) : 0;
  const ms = Math.round(link.sec * 1000 * (1 - sp)); p.travel = { to, until: now() + ms, from: p.loc }; G.locs.get(p.loc)!.players.delete(p); p.target = null; p.auto = false; p.autoFarm = null; p.gather = null;
  send(p, { t: 'travel', to, ms, from: p.loc }); return null;
}
export function finishTravel(p: Player) {
  const trip = p.travel;
  if (trip) joinLoc(p, trip.to, undefined, undefined, trip.from);
}
export function teleportTo(p: Player, to: string, cost: number): string | null {
  if (p.dead || p.duel || p.travel || p.inScene) return 'Teleportieren gerade nicht möglich';
  if (p.combatUntil > now()) return 'Im Kampf nicht möglich'; if (p.c.gold < cost) return 'Nicht genug Gold'; p.c.gold -= cost; joinLoc(p, to); const a = GEO_ANCHORS[to]; if (p.geo?.has && a) { p.geo.lat = a[0]; p.geo.lon = a[1]; } return null;
}
export function leaveHouseSilent(p: Player) { if (!p.houseId) return; const occ = G.houseOcc.get(p.houseId); occ?.delete(p); const hid = p.houseId; p.houseId = null; if (occ) for (const q of occ) send(q, { t: 'houseVisitors', id: hid, visitors: [...occ].map(v => ({ id: v.id, name: v.c.name, cls: v.c.cls, look: v.c.look })) }); }
/** Ort wechseln ohne Ladebildschirm (Kartenmodus): Zone folgt der realen Position. */
export function setLocSilent(p: Player, to: string) { if (p.dungeon || p.loc === to || !G.locs.get(to)) return; G.locs.get(p.loc)?.players.delete(p); p.loc = to; p.c.loc = to; G.locs.get(to)!.players.add(p); p.dirty = true; }
/** Kampf-/Dungeonansicht starten (Szene wird im Client angezeigt). */
export function enterScene(p: Player, locId: string) { setLocSilent(p, locId); p.inScene = true; p.x = p.dx = 50; p.y = p.dy = 78; p.target = null; p.auto = false; p.autoFarm = null; send(p, { t: 'scene', on: true, loc: locId }); }
export function exitScene(p: Player) { p.inScene = false; p.mapEncounter = undefined; p.target = null; p.auto = false; p.autoFarm = null; p.gather = null; p.pending = null; send(p, { t: 'scene', on: false }); }

/** Only the party's current members can enter its copy of the geographic dungeon. */
export function enterPartyDungeon(p: Player, locId: string, entranceId?: string): string | undefined {
  const party = p.partyId ? G.parties.get(p.partyId) : undefined;
  if (!party || party.members.length < 2 || !party.members.includes(p.id)) return 'Für die Gruppeninstanz brauchst du eine Gruppe';
  const def = LOCS[locId];
  if (!def || (def.kind !== 'boss' && def.theme !== 'dungeon')) return 'Keine Gruppeninstanz für dieses Ziel';
  if (instanceBlocked(p)) return 'Gruppeninstanz gerade nicht möglich';

  const key = party.id + ':' + locId + (entranceId ? ':' + entranceId : '');
  const dungeon = G.dungeons.get(key) ?? newDungeon(key, def);
  joinDungeon(p, dungeon);
}

export function enterRegionalDungeon(p: Player, locId: string, entranceId: string): string | undefined {
  if (instanceBlocked(p)) return 'Dungeon gerade nicht möglich';
  joinDungeon(p, newDungeon('solo:' + p.id + ':' + entranceId, LOCS[locId]));
}

export function enterGeoChallenge(p: Player, marker: GeoObj, locId: string): string | undefined {
  if (instanceBlocked(p)) return 'Teilnahme gerade nicht möglich';
  const endsAt = marker.extra?.endsAt;
  if (typeof endsAt !== 'number' || endsAt <= now()) return 'Diese Begegnung ist abgelaufen';
  const key = 'challenge:' + marker.id + ':' + endsAt;
  if ((p.c.geoChallengeRewards?.[key] ?? 0) > now()) return 'Diese Begegnung hast du bereits abgeschlossen';
  const challenge: GeoChallenge = {
    markerId: marker.id, target: marker.def, title: marker.name, kind: marker.role === 'boss' ? 'boss' : 'event', endsAt,
    point: { lat: marker.lat, lon: marker.lon },
  };
  const dungeon = G.dungeons.get(key) ?? newDungeon(key, LOCS[locId], challenge);
  if (dungeon.challenge?.completed) return 'Diese Begegnung wurde bereits abgeschlossen';
  joinDungeon(p, dungeon);
  const mob = dungeon.mobs.find(m => !m.add && !m.dead);
  if (mob) {
    mob.threat[p.id] = 1;
    p.target = mob.uid;
    p.auto = true;
  }
  sys(p, `${marker.name}: Trage zum Kampf bei, um eine Belohnung zu erhalten.`, 'boss');
}

const instanceBlocked = (p: Player) => p.dungeon || p.mapEncounter || p.dead || p.inScene || p.travel || p.houseId || p.duel || p.trade || p.combatUntil > now();
function joinDungeon(p: Player, dungeon: DungeonState) {
  G.dungeons.set(dungeon.key, dungeon);
  G.locs.get(p.loc)?.players.delete(p);
  p.dungeon = { dungeon, origin: p.loc, x: p.x, y: p.y };
  p.loc = dungeon.id;
  dungeon.players.add(p);
  p.gather = p.pending = null;
  enterScene(p, dungeon.id);
}

export function leaveDungeon(p: Player): boolean {
  const visit = p.dungeon;
  if (!visit) return false;
  if (p.trade) H.tradeCancel(p, {});
  const { dungeon, origin, x, y } = visit;
  dungeon.players.delete(p);
  if (!dungeon.players.size) G.dungeons.delete(dungeon.key);

  delete p.dungeon;
  p.loc = origin;
  p.x = p.dx = x;
  p.y = p.dy = y;
  if (p.online) G.locs.get(origin)?.players.add(p);
  exitScene(p);
  return true;
}

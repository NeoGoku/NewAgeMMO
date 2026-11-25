import { LOCS, NPCS } from '@nam/game-data';
import { CLASS_BASE } from '@nam/shared';
import { G, now, send, sys, clamp, toLoc, type Player } from './state';
import { recalc } from './chars';
import { questEvent, autoStartHidden } from './quests';
import { setArrive, inPvp } from './game';
export function joinLoc(p: Player, to: string, x?: number, y?: number, from?: string) {
  const old = G.locs.get(p.loc); const l = G.locs.get(to)!; const wasPvp = inPvp(p); if (old) old.players.delete(p); leaveHouseSilent(p);
  p.loc = to; p.c.loc = to; l.players.add(p); p.travel = null; p.target = null; p.auto = false; p.autoFarm = null; p.gather = null; p.pending = null;
  const back = from ? LOCS[to].links.find(k => k.to === from) : null; p.x = p.dx = x ?? (back ? clamp(back.x < 50 ? back.x + 8 : back.x - 8, 6, 94) : 50); p.y = p.dy = y ?? (back ? clamp(back.y < 60 ? 62 : back.y - 6, 58, 90) : 78);
  if (!p.c.discovered.includes(to)) { p.c.discovered.push(to); sys(p, `Neuer Ort entdeckt: ${LOCS[to].name}`, 'quest'); }
  if (LOCS[to].kind === 'city') p.c.choices.respawn = to;
  if (wasPvp !== inPvp(p)) { const r = p.c.hp / p.st.maxHp; recalc(p); p.c.hp = Math.max(1, Math.min(p.st.maxHp, Math.round(r * (inPvp(p) ? p.pvpSt!.maxHp : p.st.maxHp)))); }
  questEvent(p, 'visit', to); autoStartHidden(p, to); p.dirty = true;
  send(p, { t: 'enter', loc: to, x: p.x, y: p.y }); send(p, { t: 'char', c: p.c });
  if (LOCS[to].pvp) sys(p, '⚠ PvP-Zone: Spieler können hier angegriffen werden. Werte sind normalisiert.', 'warn');
}
export function startTravel(p: Player, to: string): string | null {
  const l = LOCS[p.loc]; const link = l.links.find(k => k.to === to); if (!link) return 'Kein direkter Weg'; if (p.travel) return 'Du reist bereits'; if (p.dead) return 'Du bist tot';
  if (p.combatUntil > now()) return 'Im Kampf kannst du nicht reisen'; if (p.duel) return 'Im Duell nicht möglich'; if (p.c.level < Math.max(1, LOCS[to].lvl[0] - 12) && false) return 'Zu gefährlich';
  const mount = p.c.equipment.mount; const sp = mount ? (mount.id === 'mount_board' ? .25 : mount.id === 'mount_horse' ? .4 : mount.id === 'mount_wolf' ? .5 : .65) : 0;
  const ms = Math.round(link.sec * 1000 * (1 - sp)); p.travel = { to, until: now() + ms, from: p.loc }; G.locs.get(p.loc)!.players.delete(p); p.target = null; p.auto = false; p.autoFarm = null; p.gather = null;
  send(p, { t: 'travel', to, ms, from: p.loc }); return null;
}
setArrive(p => { const tr = p.travel; if (!tr) return; joinLoc(p, tr.to, undefined, undefined, tr.from); });
export function teleportTo(p: Player, to: string, cost: number): string | null {
  if (p.combatUntil > now()) return 'Im Kampf nicht möglich'; if (p.c.gold < cost) return 'Nicht genug Gold'; p.c.gold -= cost; joinLoc(p, to); return null;
}
export function leaveHouseSilent(p: Player) { if (!p.houseId) return; const occ = G.houseOcc.get(p.houseId); occ?.delete(p); const hid = p.houseId; p.houseId = null; if (occ) for (const q of occ) send(q, { t: 'houseVisitors', id: hid, visitors: [...occ].map(v => ({ id: v.id, name: v.c.name, cls: v.c.cls, look: v.c.look })) }); }

import { QUESTS, ITEMS, MOBS, LOCS, NPCS, REGIONAL_QUEST_ID, type Goal, type QuestDef } from '@nam/game-data';
import { expToNext, haversine, hash32, rad, wrapLon, type GeoCoord, type QuestRegion, type Rarity } from '@nam/shared';
import { send, sys, now, type Player } from './state';
import { osmObjects } from './geo-osm';
import { geoObjects } from './geo-world';
import { publishProgress } from './character-save';
import { invAdd, invCount, invRemove, gainExp, addTrainExp, recalc } from './chars';
const day = () => Math.floor(Date.now() / 864e5);
type RegionalGoal = Extract<Goal['k'], 'region' | 'survey' | 'regional_hunt'>;
function regionalGoal(q: QuestDef): RegionalGoal | undefined {
  const kind = q.goals[0]?.k;
  if (kind === 'region' || kind === 'survey' || kind === 'regional_hunt') return kind;
}
export function dailyReset(p: Player) { const d = day(); if (p.c.dailyReset !== d) { p.c.dailyReset = d; for (const [id, qs] of Object.entries(p.c.quests)) if (QUESTS[id]?.repeat === 'daily') delete p.c.quests[id]; p.c.questsDone = p.c.questsDone.filter(id => QUESTS[id]?.repeat !== 'daily'); } }
export function questEvent(p: Player, kind: 'kill' | 'item' | 'craft' | 'gather' | 'visit' | 'talk' | RegionalGoal, target: string, n = 1, fam?: string) {
  let changed = false;
  for (const [id, qs] of Object.entries(p.c.quests)) {
    if (qs.state !== 'active') continue; const q = QUESTS[id]; if (!q) continue;
    q.goals.forEach((g, i) => {
      let inc = 0;
      if (kind === 'kill') { if (g.k === 'kill' && (g.t === '*' || g.t === target)) inc = n; else if (g.k === 'boss' && g.t === target) inc = n; else if (g.k === 'dungeon' && g.t === p.loc) inc = n; }
      else if (kind === 'craft' && g.k === 'craft' && (g.t === '*' || g.t === target)) inc = n; else if (kind === 'gather' && g.k === 'gather' && (g.t === '*' || g.t === target)) inc = n;
      else if ((kind === 'region' || kind === 'survey' || kind === 'regional_hunt') && g.k === kind && target === id) inc = 1;
      else if (kind === 'visit' && g.k === 'visit' && g.t === target) inc = 1; else if (kind === 'talk' && g.k === 'talk' && g.t === target) inc = 1;
      if (g.k === 'collect' && (kind === 'item' || kind === 'gather') ) { const c = Math.min(g.n, invCount(p.c, g.t)); if (c !== qs.prog[i]) { qs.prog[i] = c; changed = true; } }
      if (inc && qs.prog[i] < g.n) { qs.prog[i] = Math.min(g.n, qs.prog[i] + inc); changed = true; }
    });
    if (q.goals.every((g, i) => qs.prog[i] >= g.n) && qs.state === 'active') { qs.state = 'done'; sys(p, `Quest abgeschlossen: ${q.name} – melde dich bei ${NPCS[q.turnin]?.name ?? q.turnin}.`, 'quest'); send(p, { t: 'questDone', id }); if (p.c.settings.autoQuest && !qs.region && !q.choice && NPCS[q.turnin]?.loc === p.loc) setTimeout(() => { if (p.online && p.c.quests[id]?.state === 'done') { const e = turnIn(p, id); if (!e) send(p, { t: 'char', c: p.c }); } }, 600); }
  }
  if (changed) { p.dirty = true; send(p, { t: 'quests', q: p.c.quests, done: p.c.questsDone }); }
}
function publicQuestSite(origin: GeoCoord) {
  return osmObjects(origin.lat, origin.lon, 900)
    .map(point => ({ point, distance: haversine(origin.lat, origin.lon, point.lat, point.lon) }))
    .filter(({ distance }) => distance >= 220)
    .sort((a, b) => a.distance - b.distance)[0]?.point;
}

function selectQuestRegion(p: Player, kind: RegionalGoal): QuestRegion | undefined {
  const geo = p.geo;
  if (!geo?.on || !geo.has) return;
  if (kind === 'regional_hunt') {
    const mob = geoObjects(geo.lat, geo.lon, 900).find(point => point.k === 'mob' && point.role === 'normal' &&
      (point.lvl ?? 1) <= p.c.level + 4 && haversine(geo.lat, geo.lon, point.lat, point.lon) >= 260);
    return mob && { lat: mob.lat, lon: mob.lon, radius: 145, label: 'Regionales Patrouillengebiet', virtualOnly: false };
  }
  const publicPoint = publicQuestSite(geo);
  if (publicPoint) {
    return { lat: publicPoint.lat, lon: publicPoint.lon, radius: 90, label: publicPoint.name, virtualOnly: false };
  }
  if (kind === 'survey' && geo.gps) return;
  const cellLat = Math.round(geo.lat * 500) / 500;
  const cellLon = Math.round(geo.lon * 500) / 500;
  const sign = hash32(p.id + ':' + day()) % 2 === 0 ? -1 : 1;
  if (kind === 'survey') {
    return {
      lat: cellLat, lon: wrapLon(cellLon + sign * .0045 / Math.cos(rad(cellLat))),
      radius: 90, label: 'Virtueller Beobachtungspunkt', virtualOnly: true,
    };
  }
  const direction = cellLat > 84.99 ? -1 : cellLat < -84.99 ? 1 : sign;
  return {
    lat: cellLat + direction * .0045, lon: cellLon,
    radius: 90, label: 'Regionales Erkundungsgebiet', virtualOnly: true,
  };
}

function inQuestRegion(point: GeoCoord, region: QuestRegion) {
  return haversine(point.lat, point.lon, region.lat, region.lon) <= region.radius;
}

export function recordRegionalVisit(p: Player): boolean {
  const quest = p.c.quests[REGIONAL_QUEST_ID];
  const geo = p.geo;
  if (!quest?.region || quest.state !== 'active' || p.c.dailyReset !== day() || !geo?.on || !geo.has || p.inScene) return false;
  if ((quest.region.virtualOnly && geo.gps) || !inQuestRegion(geo, quest.region)) return false;
  publishProgress(p, () => questEvent(p, 'region', REGIONAL_QUEST_ID));
  return true;
}

/** The player's current authoritative location is used instead of coordinates from the request. */
export function recordRegionalSurvey(p: Player, id: string): string | undefined {
  dailyReset(p);
  const quest = p.c.quests[id];
  const geo = p.geo;
  if (QUESTS[id]?.goals[0]?.k !== 'survey' || quest?.state !== 'active' || !quest.region) return 'Keine aktive Feldnotiz an diesem Ziel';
  if (!geo?.on || !geo.has) return 'Kartenposition wird benötigt';
  if (quest.region.virtualOnly && geo.gps) return 'Dieses Ziel ist nur im virtuellen Modus erreichbar';
  if (!inQuestRegion(geo, quest.region)) return 'Begib dich zuerst in das markierte Gebiet';
  publishProgress(p, () => questEvent(p, 'survey', id));
}

/** Called within the same durable update as the encounter rewards. */
export function recordRegionalHunt(p: Player, origin: GeoCoord) {
  if (p.c.dailyReset !== day()) return;
  for (const [id, quest] of Object.entries(p.c.quests)) {
    if (QUESTS[id]?.goals[0]?.k === 'regional_hunt' && quest.state === 'active' && quest.region && inQuestRegion(origin, quest.region)) {
      questEvent(p, 'regional_hunt', id);
    }
  }
}

export function canAccept(p: Player, q: QuestDef): string | null {
  const c = p.c; if (c.level < q.lvl) return `Benötigt Level ${q.lvl}`; if (c.quests[q.id] && c.quests[q.id].state !== 'turned') return 'Bereits angenommen'; if (c.questsDone.includes(q.id)) return 'Bereits abgeschlossen';
  if (q.prereq && !c.questsDone.includes(q.prereq)) return 'Vorquest fehlt';
  const kind = regionalGoal(q);
  if (kind && (!p.geo?.on || !p.geo.has || p.inScene || p.houseId)) return 'Kartenposition wird benötigt';
  if (kind === 'survey' && p.geo?.gps && !publicQuestSite(p.geo)) return 'Kein öffentlicher Kartenort für diese Quest in der Nähe';
  return null;
}
export function acceptQuest(p: Player, id: string): string | null {
  const q = QUESTS[id]; if (!q) return 'Unbekannte Quest'; dailyReset(p); const e = canAccept(p, q); if (e) return e;
  const kind = regionalGoal(q);
  const region = kind ? selectQuestRegion(p, kind) : undefined;
  if (kind && !region) return 'Kein geeignetes Ziel für diese Quest in der Nähe';
  if (q.give && invAdd(p.c, q.give.id, q.give.qty) > 0) return 'Inventar voll';
  p.c.quests[id] = { state: 'active', prog: q.goals.map(() => 0), started: now(), ...(region && { region }) };
  p.dirty = true; q.goals.forEach((g, i) => { if (g.k === 'collect') p.c.quests[id].prog[i] = Math.min(g.n, invCount(p.c, g.t)); });
  questEvent(p, 'item', ''); sys(p, `Quest angenommen: ${q.name}`, 'quest'); return null;
}
export function turnIn(p: Player, id: string, choice?: string): string | null {
  const q = QUESTS[id]; const qs = p.c.quests[id]; if (!q || !qs) return 'Quest nicht aktiv'; if (qs.state !== 'done') return 'Noch nicht abgeschlossen';
  if (q.choice && !q.choice.options.some(o => o.id === choice)) return 'Bitte eine Entscheidung treffen';
  for (const g of q.goals) if (g.k === 'collect') { if (!invRemove(p.c, g.t, g.n)) return 'Gegenstände fehlen'; }
  if (q.give) invRemove(p.c, q.give.id, q.give.qty);
  const lv = p.c.level; const r = q.reward; const exp = q.scale ? Math.floor(expToNext(lv) * .12) : r.exp || 0; const gold = q.scale ? lv * 40 : r.gold || 0;
  for (const it of r.items || []) { const left = invAdd(p.c, it.id, it.qty, (it.rar || 0) as Rarity); if (left) p.c.mail.push({ id: 'ml' + now(), from: 'Quest', subject: q.name, gold: 0, items: [{ uid: 'q' + now() + it.id, id: it.id, rar: (it.rar || 0) as Rarity, qty: left }], t: now() }); }
  p.c.gold += gold; gainExp(p, exp); if (r.train) addTrainExp(p, r.train); if (r.stat) p.c.statPoints += r.stat;
  const rep = { ...(r.rep || {}) }; if (q.choice && choice) { const o = q.choice.options.find(x => x.id === choice)!; for (const k in o.rep) rep[k] = (rep[k] || 0) + o.rep[k]; p.c.choices[q.id] = choice; }
  for (const k in rep) p.c.rep[k] = (p.c.rep[k] || 0) + rep[k];
  qs.state = 'turned'; delete p.c.quests[id]; p.c.questsDone.push(id); recalc(p); p.dirty = true; sys(p, `Quest abgegeben: ${q.name} (+${exp} EXP, +${gold} Gold)`, 'quest');
  send(p, { t: 'quests', q: p.c.quests, done: p.c.questsDone }); return null;
}
export function autoStartHidden(p: Player, loc: string) { for (const q of Object.values(QUESTS)) if (q.autoStart === loc && !p.c.quests[q.id] && !p.c.questsDone.includes(q.id) && p.c.level >= q.lvl) acceptQuest(p, q.id); }
export function availableAt(p: Player, npc: string) { dailyReset(p); return Object.values(QUESTS).filter(q => q.giver === npc && !canAccept(p, q)).map(q => q.id); }
export function readyAt(p: Player, npc: string) { return Object.values(p.c.quests).length ? Object.entries(p.c.quests).filter(([id, s]) => s.state === 'done' && QUESTS[id].turnin === npc).map(([id]) => id) : []; }
export { MOBS, LOCS, ITEMS };

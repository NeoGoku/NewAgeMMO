import { finishTravel, leaveDungeon } from './world';
import { publishProgress } from './character-save';
import { BAL, mitig, type EvtView, type Rarity, type ItemInst, CLASS_BASE, RARITY_MULT } from '@nam/shared';
import { LOCS, MOBS, NODES, SKILLS, SPECIES, WEATHER, ITEMS, CLASSES, SUMMON_STATS, QUESTS, EGG_SPECIES_BY_FAMILY, petExp, type MobDef, type SkillDef, type NodeDef } from '@nam/game-data';
import { G, now, rnd, rint, clamp, dist, uid, send, sys, toLoc, type Player, type Mob, type LocState, type Fx, type NodeS, type DungeonState, type GeoChallenge } from './state';
import { invAdd, recalc, curSt, gainExp, mkItem, rollRarity, isEquip, addTrainExp } from './chars';
import { questEvent, recordRegionalEvent, recordRegionalHunt } from './quests';
const Y0 = 52, Y1 = 94;
export function initWorld() {
  for (const def of Object.values(LOCS)) {
    const l: LocState = { id: def.id, def, players: new Set(), mobs: [], nodes: [], weather: 'clear', weatherUntil: 0, evts: [], bossText: [] };
    for (const s of def.spawns) for (let i = 0; i < s.n; i++) spawnMob(l, s.mob, false);
    for (const n of def.nodes) for (let i = 0; i < n.n; i++) l.nodes.push({ uid: uid('n'), def: n.def, x: rnd(8, 92), y: rnd(Y0 + 6, Y1 - 4), ready: true, respawnAt: 0, hp: n.def.includes('crate') ? 3 : 1 });
    G.locs.set(def.id, l);
  }
}
export function newDungeon(key: string, def: LocState['def'], challenge?: GeoChallenge): DungeonState {
  const dungeon: DungeonState = { key, id: def.id, def, players: new Set(), mobs: [], nodes: [], weather: 'clear', weatherUntil: 0, evts: [], bossText: [] };
  if (challenge) {
    dungeon.challenge = challenge;
    const target = spawnMob(dungeon, challenge.target, false, { x: 70, y: 70 });
    if (challenge.kind === 'event') eventProfile(target, challenge.title);
  } else {
    for (const spawn of def.spawns) for (let i = 0; i < spawn.n; i++) spawnMob(dungeon, spawn.mob, false);
  }
  return dungeon;
}
export function spawnMob(l: LocState, id: string, add: boolean, at?: { x: number; y: number }): Mob {
  const d = MOBS[id]; const x = at?.x ?? rnd(10, 90), y = at?.y ?? rnd(Y0 + 8, Y1 - 4);
  const m: Mob = { uid: uid('m'), def: d, hp: d.hp, maxHp: d.hp, x, y, hx: x, hy: y, threat: {}, dmg: {}, target: null, atkAt: 0, tick: rint(0, 5), fx: [], phase: 0, dead: false, respawnAt: 0, add, enrage: 0, lastHit: 0, skills: d.skills, lvl: d.lvl, flashT: 0 };
  if ('key' in l) m.dungeon = l as DungeonState;
  if (add) { m.maxHp = m.hp = Math.round(d.hp * .15); m.skills = []; } l.mobs.push(m); return m;
}
export const isNight = () => { const ph = ((now() % BAL.dayLengthMs) / BAL.dayLengthMs); return ph < .22 || ph > .78; };
export const dayPhase = () => (now() % BAL.dayLengthMs) / BAL.dayLengthMs;
const ev = (l: LocState, e: EvtView) => { l.evts.push(e); };
const fxSum = (fx: Fx[], k: string) => { const t = now(); let s = 0; for (const f of fx) if (f.k === k && f.until > t) s += f.v; return s; };
const fxHas = (fx: Fx[], k: string) => fx.some(f => f.k === k && f.until > now());
const addFx = (fx: Fx[], k: string, dur: number, v: number, src?: string) => { const t = now(); const e = fx.find(f => f.k === k && f.src === src); if (e) { e.until = t + dur * 1000; e.v = Math.max(e.v, v); } else fx.push({ k, until: t + dur * 1000, v, src, next: t + 1000 }); };
const locOf = (p: Player) => p.dungeon?.dungeon ?? G.locs.get(p.loc)!;
const inPvp = (p: Player) => !p.mapEncounter && !!(LOCS[p.loc].pvp || p.duel);
export const canEngageMob = (p: Player, m: Mob) => p.mapEncounter === m.mapEncounter && p.dungeon?.dungeon === m.dungeon;
const isPrimaryEncounter = (m: Mob) => m.mapEncounter?.target === m.uid;
function weatherMult(l: LocState, el: string) { return (WEATHER[l.weather]?.el[el] ?? 1) * (isNight() ? (el === 'shadow' ? 1.1 : el === 'light' ? .95 : 1) : 1); }
// ---------- Schaden ----------
export function playerHit(p: Player, target: Mob | Player, pow: number, el: string, magic: boolean, opts: { noCrit?: boolean; bonus?: number } = {}): number {
  const l = locOf(p); const pvp = inPvp(p); const st = curSt(p, pvp); const isMob = 'def' in target;
  let a = (magic ? st.matk : st.atk) * pow * rnd(.9, 1.1) * (1 + fxSum(p.fx, 'b_atk')) * (1 - fxSum(p.fx, 'weak')) * weatherMult(l, el) * (1 + (opts.bonus || 0));
  let crit = false; if (!opts.noCrit && Math.random() * 100 < st.crit + fxSum(p.fx, 'b_crit')) { a *= st.critDmg; crit = true; }
  if (isMob) { const m = target as Mob; const mit = mitig(m.def.def * (magic ? .75 : 1), p.c.level); a *= (1 - mit) * (1 + fxSum(m.fx, 'vuln')) * (1 - (m.def.res[el] || 0)); a = Math.max(1, Math.round(a)); damageMob(p, m, a, crit, el); return a; }
  const t = target as Player; const ts = curSt(t, pvp); if (Math.random() * 100 < ts.dodge + fxSum(t.fx, 'b_dodge') + (WEATHER[l.weather]?.dodge || 0)) { ev(l, { k: 'miss', x: t.x, y: t.y - 8 }); return 0; }
  a *= (1 - mitig((magic ? ts.mdef : ts.def) * (1 + fxSum(t.fx, 'b_def')), pvp ? 60 : p.c.level)) * (1 + fxSum(t.fx, 'vuln')); a = Math.max(1, Math.round(a));
  if (ts.block && Math.random() * 100 < ts.block) { a = Math.round(a * .5); ev(l, { k: 'block', x: t.x, y: t.y - 8 }); }
  damagePlayer(t, a, crit, p, el); return a;
}
export function damageMob(p: Player, m: Mob, a: number, crit: boolean, el: string) {
  const l = locOf(p); if (m.dead || !canEngageMob(p, m) || (m.dungeon?.challenge?.endsAt ?? Infinity) <= now()) return; m.hp -= a; m.dmg[p.id] = (m.dmg[p.id] || 0) + a; m.threat[p.id] = (m.threat[p.id] || 0) + a * (1 + fxSum(p.fx, 'taunt')); m.lastHit = now(); m.flashT = now() + 150;
  p.combatUntil = now() + 6000; ev(l, { k: crit ? 'crit' : 'dmg', x: m.x, y: m.y - 14, v: a, el, id: m.uid });
  if (CLASS_BASE[p.c.cls].resRegen === 0) p.c.res = Math.min(p.st.maxRes, p.c.res + 5);
  phaseCheck(l, m);
  if (m.hp <= 0) killMob(l, m);
}
function phaseCheck(l: LocState, m: Mob) {
  const ph = m.def.phases; if (!ph) return; for (let i = ph.length - 1; i >= 0; i--) if (m.hp / m.maxHp <= ph[i].hp && m.phase <= i) { m.phase = i + 1; m.skills = ph[i].skills; toLoc(l, { t: 'chat', ch: 'boss', from: m.def.name, text: ph[i].text, at: now() }); ev(l, { k: 'fx', x: m.x, y: m.y, id: 'nova', el: 'arcane' }); break; }
}
export function damagePlayer(t: Player, a: number, crit: boolean, src: Player | Mob | null, el = 'phys') {
  if (t.dead || !t.online || src && ('c' in src ? locOf(src) !== locOf(t) || src.mapEncounter !== t.mapEncounter : !canEngageMob(t, src))) return; const l = locOf(t);
  if (t.shield > 0) { const ab = Math.min(t.shield, a); t.shield -= ab; a -= ab; }
  const red = fxSum(t.fx, 'tankred'); a = Math.round(a * (1 - red)); t.c.hp -= a; t.combatUntil = now() + 6000; ev(l, { k: crit ? 'crit' : 'dmg', x: t.x, y: t.y - 16, v: a, el, c: 'p', id: t.id }); t.hits++;
  if (t.hits % 6 === 0) for (const it of Object.values(t.c.equipment)) if (it?.dur !== undefined && it.dur > 0) it.dur = Math.max(0, it.dur - 1);
  if (CLASS_BASE[t.c.cls].resRegen === 0) t.c.res = Math.min(t.st.maxRes, t.c.res + 3);
  if (t.c.hp <= 0) killPlayer(t, src);
}
function killPlayer(t: Player, src: Player | Mob | null) {
  const l = locOf(t); t.dead = true; t.deadUntil = now() + 5000; t.c.hp = 0; t.target = null; t.auto = false; t.autoFarm = null; t.gather = null; t.dx = t.x; t.dy = t.y; ev(l, { k: 'die', x: t.x, y: t.y, id: t.id });
  const pvpDeath = !!(src && 'c' in src) || !!LOCS[t.loc].pvp;
  if (src && 'c' in src) { const k = src as Player; if (t.duel && t.duel.opp === k.id) { endDuel(k, t); return; } publishProgress(k, () => { k.c.honor += 5; for (const [h, ti] of [[100, 'Gladiator'], [500, 'Champion'], [2000, 'Legende der Arena']] as [number, string][]) if (k.c.honor >= h && !k.c.titles.includes(ti)) { k.c.titles.push(ti); sys(k, `Neuer Titel: ${ti}`, 'quest'); } k.c.arenaPts += LOCS[t.loc].kind === 'arena' ? 3 : 1; sys(k, `Du hast ${t.c.name} besiegt! +5 Ehre.`); guildWarKill(k, t); }); }
  if (!pvpDeath) { const loss = Math.min(t.c.exp, Math.floor(BAL.deathExpLoss * (t.c.level < BAL.maxLevel ? require_exp(t.c.level) : 0))); t.c.exp -= loss; for (const it of Object.values(t.c.equipment)) if (it?.dur !== undefined) it.dur = Math.max(0, it.dur - 8); sys(t, `Du bist gestorben und verlierst ${loss} EXP. Ausrüstung leicht beschädigt.`); }
  else sys(t, 'Du wurdest besiegt.'); send(t, { t: 'died', until: t.deadUntil });
  publishProgress(t);
}
import { expToNext as require_exp } from '@nam/shared';
export function guildWarKill(k: Player, t: Player) { const gk = k.c.guildId ? G.guilds.get(k.c.guildId) : undefined; if (gk?.war && gk.war.until > now() && t.c.guildId === gk.war.vs) { gk.war.score++; const gt = G.guilds.get(gk.war.vs); if (gt?.war) gt.war.theirScore = gk.war.score; } }
export function endDuel(w: Player, l: Player) { const win = w, lose = l; win.duel = null; lose.duel = null; publishProgress(win, () => { win.c.honor += 10; win.c.arenaPts += 5; win.c.gold += 100; sys(win, `Du hast das Duell gegen ${lose.c.name} gewonnen! +10 Ehre, +100 Gold.`); sys(lose, `Du hast das Duell gegen ${win.c.name} verloren.`); lose.dead = false; lose.c.hp = Math.max(1, Math.floor(lose.st.maxHp * .3)); win.c.hp = Math.max(win.c.hp, 1); send(win, { t: 'duelEnd', won: true }); send(lose, { t: 'duelEnd', won: false }); recalc(win); }); recalc(lose); publishProgress(lose); }
// ---------- Tod/Beute ----------
function killMob(l: LocState, m: Mob) {
  m.dead = true; m.hp = 0; m.respawnAt = now() + m.def.respawn * 1000 * (m.add ? 0 : 1); ev(l, { k: 'die', x: m.x, y: m.y, id: m.uid });
  const challenge = !m.add ? m.dungeon?.challenge : undefined;
  if (challenge) {
    challenge.completed = true;
    G.geoTaken.set(challenge.markerId, challenge.endsAt);
  }
  if (m.dungeon && m.def.role === 'boss') m.respawnAt = Infinity;
  const rewarded = new Set<Player>();
  const parts: Player[] = []; const seen = new Set<string>();
  for (const pid of Object.keys(m.dmg)) { const p = G.players.get(pid); if (p && p.online && l.players.has(p) && !seen.has(p.id)) { seen.add(p.id); parts.push(p); if (p.partyId && !m.mapEncounter && !challenge) for (const mid of G.parties.get(p.partyId)?.members || []) { const q = G.players.get(mid); if (q && q.online && l.players.has(q) && !q.dead && !seen.has(q.id)) { seen.add(q.id); parts.push(q); } } } }
  const groups = new Map<string, Player[]>(); for (const p of parts) { const k = p.partyId || p.id; (groups.get(k) || groups.set(k, []).get(k)!).push(p); }
  for (const [, g] of groups) {
    const n = g.length; const bonus = 1 + .15 * (n - 1); const party = n > 1 ? G.parties.get(g[0].partyId!) : null; const totLv = g.reduce((s, p) => s + p.c.level, 0);
    for (const p of g) {
      const share = party?.expMode === 'level' ? p.c.level / totLv : 1 / n; const diff = p.c.level - m.lvl; const lf = diff > 8 ? Math.max(.1, 1 - (diff - 8) * .1) : 1;
      if ((m.dmg[p.id] || 0) < m.maxHp * (m.def.role === 'boss' ? .005 : .0) && (challenge || n === 1)) continue;
      const countsForQuest = !m.add || isPrimaryEncounter(m);
      const bossReward = m.dungeon && m.def.role === 'boss' && !challenge ? 'dungeonReward:' + m.def.id : undefined;
      const rewardDay = String(Math.floor(now() / 864e5));
      if (bossReward && p.c.choices[bossReward] === rewardDay) {
        sys(p, 'Die Gruppenbelohnung für diesen Boss hast du heute bereits erhalten.');
        continue;
      }
      const challengeKey = challenge && m.dungeon?.key;
      if (challengeKey && (p.c.geoChallengeRewards?.[challengeKey] ?? 0) > now()) continue;
      let gold = 0;
      rewarded.add(p);
      publishProgress(p, () => {
        if (challenge && challengeKey) {
          const active = Object.fromEntries(Object.entries(p.c.geoChallengeRewards ?? {}).filter(([, until]) => until > now()));
          p.c.geoChallengeRewards = { ...active, [challengeKey]: challenge.endsAt };
          if (challenge.kind === 'event') recordRegionalEvent(p, challenge.point);
        }
        if (bossReward) p.c.choices[bossReward] = rewardDay;
        if (isPrimaryEncounter(m) && m.mapEncounter) p.c.loc = m.mapEncounter.origin;
        gainExp(p, m.def.exp * share * bonus * lf * (n > 1 ? n : 1) / (n > 1 ? 1 : 1)); lootFor(p, m, m.add ? .1 : 1); petExpGain(p, m.def.exp * .2);
        gold = Math.round(rnd(m.def.gold[0], m.def.gold[1]) * (m.add ? .1 : 1) * (1 + petLoot(p))); p.c.gold += gold;
        p.c.kills[m.def.id] = (p.c.kills[m.def.id] || 0) + 1; if (countsForQuest) questEvent(p, 'kill', m.def.id, 1, m.def.fam);
        if (m.def.role === 'normal' && isPrimaryEncounter(m) && m.mapEncounter && m.mapEncounter === p.mapEncounter) {
          recordRegionalHunt(p, m.mapEncounter.mobPosition);
        }
        const gd = p.c.guildId && G.guilds.get(p.c.guildId); if (gd) { gd.exp += Math.ceil(m.def.exp * .02); const gm = gd.members[p.id]; if (gm) gm.contrib += 1; guildLevel(gd); if (gd.quest.id === 'kills' && countsForQuest) gd.quest.prog++; }
      }, () => {
        ev(l, { k: 'loot', x: m.x, y: m.y - 10, v: `+${gold}g`, id: p.id });
        if (challenge && p.dungeon?.dungeon === l) {
          sys(p, `${challenge.title} abgeschlossen · +${gold} Gold`, 'boss');
          leaveDungeon(p);
          p.combatUntil = 0;
        }
        if (m.mapEncounter && m.mapEncounter === p.mapEncounter && isPrimaryEncounter(m) && p.inScene && !p.dead && p.loc === l.id) {
          m.mapEncounter.finish();
        }
      });
    }
  }
  if (challenge) for (const p of [...l.players]) if (!rewarded.has(p)) {
    sys(p, `${challenge.title} beendet. Du hast nicht genug zum Kampf beigetragen.`, 'boss');
    leaveDungeon(p);
  }
  if (m.def.role === 'boss' && !challenge) toLoc(l, { t: 'chat', ch: 'boss', from: '', text: `${m.def.name} wurde besiegt!`, at: now() });
  if (m.def.role === 'boss' && !m.dungeon) for (const p of G.players.values()) if (p.online) sys(p, `⚔ ${m.def.name} wurde besiegt!`, 'boss');
  for (const p of l.players) if (p.target === m.uid) { p.target = null; if (p.auto && !p.autoFarm) p.auto = false; }
}
export function guildLevel(g: any) { while (g.exp >= 1000 * Math.pow(g.level, 1.8) && g.level < 50) { g.exp -= Math.floor(1000 * Math.pow(g.level, 1.8)); g.level++; } }
function petLoot(p: Player) { const pet = p.c.pets.find(x => x.uid === p.c.activePet); return pet && pet.energy > 0 && SPECIES[pet.species].role === 'loot' ? .1 + pet.level * .005 : 0; }
export function petExpGain(p: Player, amt: number) {
  const pet = p.c.pets.find(x => x.uid === p.c.activePet); if (!pet || pet.hatchAt) return; pet.exp += Math.floor(amt); const cap = 60;
  while (pet.level < cap && pet.exp >= petExp(pet.level)) { pet.exp -= petExp(pet.level); pet.level++; sys(p, `${pet.name} erreicht Level ${pet.level}!`); }
}
function lootFor(p: Player, m: Mob, mult: number) {
  const c = p.c; const gotIt: string[] = [];
  for (const d of m.def.drops) {
    if (Math.random() > d.p * mult * (1 + petLoot(p) + (c.settings ? 0 : 0))) continue; let id = d.id; let rar: Rarity = (d.rar || 0) as Rarity;
    if (id.startsWith('@gear:')) { const [, slot, t] = id.split(':'); id = pickGear(slot, +t, c.cls); if (!id) continue; rar = rollRarity(m.def.role === 'boss' ? 2.5 : m.def.role === 'elite' ? 1 : 0) as Rarity; if ((d.rar || 0) > rar) rar = d.rar as Rarity; }
    else if (id === '@egg') { const sp = (EGG_SPECIES_BY_FAMILY[m.def.role === 'normal' ? m.def.fam : m.def.role] || ['rat']); id = 'egg_' + sp[rint(0, sp.length - 1)]; }
    const qty = d.min ? rint(d.min, d.max || d.min) : 1; const left = invAdd(c, id, qty, ITEMS[id] && isEquip(id) ? rar : 0); if (left < qty) { gotIt.push(ITEMS[id].name + (qty > 1 ? ` x${qty - left}` : '')); questEvent(p, 'item', id, qty - left); }
  }
  if (gotIt.length) { sys(p, `Beute: ${gotIt.join(', ')}`, 'loot'); send(p, { t: 'loot', items: gotIt }); }
}
function pickGear(slot: string, tier: number, cls: string): string {
  if (slot === 'weapon') return `w_${cls}_${tier}`; if (slot === 'ring' || slot === 'amulet') return `r_${slot}_${tier}`; return `a_${slot}_${Math.random() < .5 ? 'plate' : 'cloth'}_${tier}`;
}
// ---------- Fertigkeiten ----------
export function useSkill(p: Player, skillId: string): string | null {
  const s = SKILLS[skillId]; const t = now(); if (!s || s.cls !== p.c.cls) return 'Unbekannte Fertigkeit'; if (p.c.level < s.lvl) return `Benötigt Level ${s.lvl}`; if (p.dead) return 'Du bist tot';
  if (p.travel) return 'Du reist gerade'; if (p.stunnedUntil > t || fxHas(p.fx, 'stun')) return 'Betäubt'; if ((p.cd[skillId] || 0) > t) return 'Abklingzeit'; if (p.c.res < s.cost) return `Nicht genug ${CLASSES[p.c.cls].resource}`;
  const l = locOf(p); if (l.def.safe && !p.duel) { if (s.target === 'enemy' || s.target === 'aoe') return 'In sicheren Zonen nicht erlaubt'; }
  const pvp = inPvp(p); const st = curSt(p, pvp); const magic = ['dark_mage', 'light_mage', 'summoner', 'healer'].includes(p.c.cls); let hits = 0;
  const foe = findFoe(p, l, s); const ally = findAlly(p, l);
  const needFoe = s.target === 'enemy' || s.target === 'aoe'; if (needFoe && !foe) return 'Kein Ziel'; if (foe && needFoe && !inRange(p, foe, s)) { approach(p, foe); return 'Zu weit entfernt'; }
  p.c.res -= s.cost; p.cd[skillId] = t + s.cd * 1000 * (1 - fxSum(p.fx, 'b_speed') * .3); p.combatUntil = t + 6000;
  const cast = (target: Mob | Player, pow: number, o: any = {}) => { hits++; return playerHit(p, target, pow, s.el, magic, o); };
  const proj = (tx: number, ty: number) => ev(l, { k: 'proj', x: p.x, y: p.y - 20, to: tx + ',' + (ty - 14), el: s.el, id: s.id, from: p.id });
  const foeXY = () => foe ? { x: ('def' in foe ? foe.x : (foe as Player).x), y: ('def' in foe ? foe.y : (foe as Player).y) } : { x: p.x, y: p.y };
  const targets = (): (Mob | Player)[] => { if (!foe) return []; const fx = foeXY(); const out: (Mob | Player)[] = l.mobs.filter(m => !m.dead && canEngageMob(p, m) && dist(m, fx) < 38).slice(0, 8); if (pvp) for (const q of l.players) if (q !== p && canPvp(p, q) && dist(q, fx) < 38) out.push(q); return out; };
  switch (s.kind) {
    case 'dmg': case 'stun': { proj(foeXY().x, foeXY().y); cast(foe!, s.pow); if (s.stun) stunTarget(foe!, s.stun); break; }
    case 'execute': { proj(foeXY().x, foeXY().y); const low = 'def' in foe! ? foe!.hp / (foe as Mob).maxHp < .3 : (foe as Player).c.hp / (foe as Player).st.maxHp < .3; cast(foe!, s.pow * (low ? 2 : 1)); break; }
    case 'multi': { const n = s.n || 3; for (let i = 0; i < n; i++) { if (('def' in foe! && (foe as Mob).dead)) break; cast(foe!, s.pow); } proj(foeXY().x, foeXY().y); break; }
    case 'aoe': { const fx = foeXY(); ev(l, { k: 'fx', x: fx.x, y: fx.y, id: 'aoe', el: s.el }); for (const x of targets()) { cast(x, s.pow); if (s.stun) stunTarget(x, s.stun); } break; }
    case 'dot': { const total = Math.max(1, Math.round((magic ? st.matk : st.atk) * s.pow)); addDot(foe!, s.dur || 8, total, p.id); ev(l, { k: 'fx', x: foeXY().x, y: foeXY().y, id: 'dot', el: s.el }); hits++; break; }
    case 'drain': { proj(foeXY().x, foeXY().y); const d = cast(foe!, s.pow); heal(p, Math.round(d * .5)); break; }
    case 'heal': { const tgt = (s.target === 'self' ? p : ally) || p; if (s.stat === 'cleanse') tgt.fx = tgt.fx.filter(f => !['dot', 'weak', 'vuln', 'stun', 'slow'].includes(f.k)); heal(tgt, Math.round(st.healPow * s.pow * rnd(.95, 1.05))); ev(l, { k: 'fx', x: tgt.x, y: tgt.y, id: 'heal', el: s.el }); break; }
    case 'hot': { const tgt = ally || p; addFx(tgt.fx, 'hot', s.dur || 10, Math.round(st.healPow * s.pow / (s.dur || 10)), p.id); ev(l, { k: 'fx', x: tgt.x, y: tgt.y, id: 'heal', el: s.el }); break; }
    case 'aoeheal': { const grp = partyHere(p); for (const q of grp) { heal(q, Math.round(st.healPow * s.pow)); ev(l, { k: 'fx', x: q.x, y: q.y, id: 'heal', el: s.el }); } break; }
    case 'shield': { const tgt = (s.target === 'ally' && ally) || p; tgt.shield = Math.round(s.pow * .1 * tgt.st.maxHp + (s.target === 'self' && magic ? st.matk * s.pow * .3 : 0)); addFx(tgt.fx, 'shield', s.dur || 10, 1, p.id); ev(l, { k: 'fx', x: tgt.x, y: tgt.y, id: 'buff', el: s.el }); break; }
    case 'buff': case 'debuff': {
      const key = s.stat === 'crit' ? 'b_crit' : s.stat === 'def' ? 'b_def' : s.stat === 'atk' ? 'b_atk' : s.stat === 'dodge' ? 'b_dodge' : s.stat === 'speed' ? 'b_speed' : s.stat!;
      if (s.kind === 'debuff') { addFx(('def' in foe! ? (foe as Mob).fx : (foe as Player).fx), key, s.dur || 10, s.val || .2, p.id); proj(foeXY().x, foeXY().y); hits++; break; }
      const grp = s.target === 'party' ? partyHere(p) : [p]; for (const q of grp) { addFx(q.fx, key, s.dur || 10, s.val || .2, p.id); ev(l, { k: 'fx', x: q.x, y: q.y, id: 'buff', el: s.el }); } break; }
    case 'taunt': { addFx(p.fx, 'taunt', s.dur || 8, 3, p.id); addFx(p.fx, 'tankred', s.dur || 8, .25, p.id); for (const m of l.mobs) if (!m.dead && canEngageMob(p, m) && dist(m, p) < 60) { m.threat[p.id] = (m.threat[p.id] || 0) + 1e5; m.target = p.id; } ev(l, { k: 'fx', x: p.x, y: p.y, id: 'aoe', el: s.el }); break; }
    case 'summon': { const sm = SUMMON_STATS[s.summon!]; p.summons = p.summons.filter(x => x.kind !== s.summon); if (p.summons.length >= 3) p.summons.shift(); p.summons.push({ kind: s.summon!, until: t + (s.dur || 30) * 1000, next: t + 800, pow: s.pow }); if (sm.taunt) for (const m of l.mobs) if (!m.dead && canEngageMob(p, m) && dist(m, p) < 60) m.threat[p.id] = (m.threat[p.id] || 0) + 5e4; ev(l, { k: 'fx', x: p.x, y: p.y, id: 'summon', el: s.el }); break; }
  }
  ev(l, { k: 'fx', x: p.x, y: p.y, id: 'cast_' + s.el, el: s.el, from: p.id, v: s.id }); p.dirty = true; return null;
}
function stunTarget(t: Mob | Player, sec: number) { addFx(t.fx, 'stun', sec, 1); if ('c' in t) (t as Player).stunnedUntil = now() + sec * 1000; }
function addDot(t: Mob | Player, dur: number, total: number, src: string) { addFx(t.fx, 'dot', dur, Math.max(1, Math.round(total / dur)), src); }
export function heal(t: Player, a: number) { if (t.dead) return; t.c.hp = Math.min(t.st.maxHp, t.c.hp + a); ev(locOf(t), { k: 'heal', x: t.x, y: t.y - 16, v: a, id: t.id }); }
export const partyHere = (p: Player): Player[] => { const out = [p]; if (p.partyId) for (const id of G.parties.get(p.partyId)?.members || []) { const q = G.players.get(id); if (q && q !== p && q.online && locOf(p).players.has(q) && q.mapEncounter === p.mapEncounter && !q.dead) out.push(q); } return out; };
export const canPvp = (p: Player, q: Player) => !q.dead && q !== p && !p.mapEncounter && !q.mapEncounter && !p.dungeon && !q.dungeon && ((p.duel?.opp === q.id) || (LOCS[p.loc].pvp && !p.duel && !q.duel && !(p.partyId && p.partyId === q.partyId) && !(p.c.guildId && p.c.guildId === q.c.guildId)));
function findFoe(p: Player, l: LocState, s: SkillDef): Mob | Player | null {
  if (!p.target) return null; const m = l.mobs.find(x => x.uid === p.target && !x.dead && canEngageMob(p, x)); if (m) return m; const q = G.players.get(p.target); if (q && l.players.has(q) && canPvp(p, q)) return q; return null;
}
function findAlly(p: Player, l: LocState): Player | null { if (!p.target) return null; const q = G.players.get(p.target); return q && l.players.has(q) && q.mapEncounter === p.mapEncounter && !q.dead && (q === p || partyHere(p).includes(q) || !canPvp(p, q)) ? q : null; }
const range = (p: Player, s?: SkillDef) => (CLASS_BASE[p.c.cls].melee ? 16 : 52) + (s && (s.kind === 'aoe') ? 6 : 0);
const inRange = (p: Player, t: Mob | Player, s?: SkillDef) => dist(p, t) <= range(p, s);
function approach(p: Player, t: { x: number; y: number }) { const d = dist(p, t); if (d < 1) return; const stop = CLASS_BASE[p.c.cls].melee ? 9 : 36; const f = Math.max(0, (d - stop) / d); p.dx = clamp(p.x + (t.x - p.x) * f, 3, 97); p.dy = clamp(p.y + (t.y - p.y) * f, Y0, Y1); }
// ---------- Tick ----------
export function worldTick() {
  const t = now(); const t0 = Date.now(); G.stats.ticks++; const dt = BAL.tickMs / 1000;
  for (const l of [...G.locs.values(), ...G.dungeons.values()]) {
    const challenge = 'key' in l ? (l as DungeonState).challenge : undefined;
    if (challenge && !challenge.completed && t >= challenge.endsAt) {
      for (const p of [...l.players]) {
        sys(p, `${challenge.title} ist abgelaufen.`, 'boss');
        leaveDungeon(p);
        p.combatUntil = 0;
      }
      continue;
    }
    if (!l.weatherUntil || t > l.weatherUntil) { const w = l.def.weather; l.weather = w[rint(0, w.length - 1)]; l.weatherUntil = t + BAL.weatherMs * rnd(.7, 1.4); }
    l.mobs = l.mobs.filter(m => {
      if (!m.mapEncounter || m.dead) return true;
      return [...l.players].some(p => p.online && !p.dead && p.inScene && canEngageMob(p, m));
    });
    const active = l.players.size > 0;
    if (active) { for (const p of [...l.players]) playerTick(p, l, t, dt); for (const m of l.mobs) mobTick(m, l, t, dt); for (const n of l.nodes) if (!n.ready && t > n.respawnAt) { n.ready = true; n.hp = NODES[n.def].kind === 'crate' ? 3 : 1; } }
    else for (const m of l.mobs) if (m.dead) { if (!m.add && t > m.respawnAt) revive(m); } else if (m.hp < m.maxHp) m.hp = m.maxHp;
    l.mobs = l.mobs.filter(m => !((m.add || (m as any).event) && m.dead && t > m.lastHit + 4000));
    if (active) broadcast(l, t);
  }
  for (const p of G.players.values()) if (p.travel && t >= p.travel.until && p.online) { finishTravel(p); }
  G.stats.tickMs = Math.round(G.stats.tickMs * .9 + (Date.now() - t0) * .1);
}
function revive(m: Mob) { m.dead = false; m.hp = m.maxHp; m.x = m.hx; m.y = m.hy; m.threat = {}; m.dmg = {}; m.target = null; m.phase = 0; m.skills = m.def.skills; m.fx = []; m.enrage = 0; }
function playerTick(p: Player, l: LocState, t: number, dt: number) {
  const st = p.st; const c = p.c;
  if (!p.online) { if (t - p.lastAct > 60000) { /* wird in index.ts aufgeräumt */ } }
  if (p.dead) { if (t >= p.deadUntil) respawn(p); return; }
  const stun = p.stunnedUntil > t;
  // Regeneration
  const combat = p.combatUntil > t; const hr = (combat ? .004 : BAL.regenOutOfCombat) * st.maxHp * dt; c.hp = Math.min(st.maxHp, c.hp + hr + fxSum(p.fx, 'regen') * dt);
  if (CLASS_BASE[c.cls].resRegen > 0) c.res = Math.min(st.maxRes, c.res + st.resRegen * dt * (combat ? 1 : 2)); else if (!combat) c.res = Math.max(0, c.res - 4 * dt);
  // Effekte
  for (const f of p.fx) { if ((f.k === 'dot' || f.k === 'hot') && f.until > t && (f.next || 0) <= t) { f.next = t + 1000; if (f.k === 'dot') { c.hp -= f.v; ev(l, { k: 'dmg', x: p.x, y: p.y - 16, v: f.v, c: 'p' }); if (c.hp <= 0) { killPlayer(p, null); return; } } else heal(p, f.v); } }
  p.fx = p.fx.filter(f => f.until > t); if (p.shield > 0 && !fxHas(p.fx, 'shield')) p.shield = 0;
  // Bewegung
  if (stun) { p.dx = p.x; p.dy = p.y; }
  const mv = st.speed * dt * (p.c.equipment.mount ? 1.25 : 1) * (1 - fxSum(p.fx, 'slow')); const d = Math.hypot(p.dx - p.x, p.dy - p.y);
  if (d > .3) { const k = Math.min(1, mv / d); p.x += (p.dx - p.x) * k; p.y += (p.dy - p.y) * k; if (p.gather) { p.gather = null; send(p, { t: 'gatherCancel' }); } }
  // Sammeln
  if (p.pending && d < .5) { const n = l.nodes.find(x => x.uid === p.pending!.uid); if (n && dist(p, n) < 14) { startGather(p, n, l); } p.pending = null; }
  if (p.gather && t >= p.gather.until) finishGather(p, l);
  // Ziel / Auto-Kampf
  if (p.autoFarm) autoFarm(p, l, t);
  const tgtMob = p.target ? l.mobs.find(m => m.uid === p.target && !m.dead && canEngageMob(p, m)) : null; const tgtPl = !tgtMob && p.target ? G.players.get(p.target) : null;
  if (p.target && !tgtMob && !(tgtPl && l.players.has(tgtPl) && !tgtPl.dead)) { p.target = null; if (!p.autoFarm) p.auto = false; }
  if (p.auto && !stun && p.target) {
    const foe = tgtMob || (tgtPl && canPvp(p, tgtPl) ? tgtPl : null);
    if (foe) { if (!inRange(p, foe)) { approach(p, foe); } else { if (d < .5 || true) { p.dx = p.x; p.dy = p.y; } if (t >= p.atkAt && !l.def.safe || (t >= p.atkAt && p.duel)) { p.atkAt = t + st.atkMs; p.combatUntil = t + 6000; const magic = ['dark_mage', 'light_mage', 'summoner', 'healer'].includes(c.cls); playerHit(p, foe, 1, magic ? 'arcane' : 'phys', magic); ev(l, { k: 'proj', x: p.x, y: p.y - 20, to: foe.x + ',' + (foe.y - 14), el: magic ? 'arcane' : 'phys', id: 'auto', from: p.id }); } } }
  }
  // Beschwörungen
  for (const s of p.summons) if (t >= s.next && s.until > t) { s.next = t + 1500; const info = SUMMON_STATS[s.kind]; const tg = (tgtMob && !tgtMob.dead) ? tgtMob : l.mobs.find(m => !m.dead && canEngageMob(p, m) && m.target === p.id) || null; if (tg) { const base = st.matk * s.pow * .6; const targets = info.aoe ? l.mobs.filter(m => !m.dead && canEngageMob(p, m) && dist(m, tg) < 30).slice(0, 5) : [tg]; for (const m of targets) for (let h = 0; h < info.hits; h++) { const a = Math.max(1, Math.round(base * rnd(.9, 1.1) * (1 - mitig(m.def.def, c.level)))); damageMob(p, m, a, false, 'arcane'); } ev(l, { k: 'fx', x: tg.x, y: tg.y, id: 'summonhit', el: 'arcane', from: s.kind }); } }
  p.summons = p.summons.filter(s => s.until > t);
  // Pet
  petTick(p, l, t, tgtMob);
  // Duell-Timeout
  if (p.duel && t > p.duel.until) { const o = G.players.get(p.duel.opp); p.duel = null; if (o) o.duel = null; sys(p, 'Duell abgebrochen (Zeit).'); }
}
function respawn(p: Player) { const fromDungeon = leaveDungeon(p); const l = locOf(p); const rl = LOCS[p.c.choices.respawn || 'aurelia_plaza'] ? (p.c.choices.respawn || 'aurelia_plaza') : 'aurelia_plaza'; const target = LOCS[p.loc].kind === 'arena' ? 'arena' : rl; p.dead = false; p.inScene = false; p.mapEncounter = undefined; if (!fromDungeon) send(p, { t: 'scene', on: false }); recalc(p); p.c.hp = Math.ceil(p.st.maxHp * .5); p.fx = []; p.shield = 0; if (target !== p.loc) { l.players.delete(p); p.loc = target; G.locs.get(target)!.players.add(p); } p.x = p.dx = 50; p.y = p.dy = 80; send(p, { t: 'respawn', loc: p.loc }); send(p, { t: 'char', c: p.c }); }
function petTick(p: Player, l: LocState, t: number, tg: Mob | null | undefined) {
  const pet = p.c.pets.find(x => x.uid === p.c.activePet); if (!pet || pet.hatchAt) return; const sp = SPECIES[pet.species];
  if (t < p.petAt) return; p.petAt = t + 2400 / sp.spd; if (pet.energy < 100 && t % 3 < 1) pet.energy = Math.min(100, pet.energy + (p.combatUntil > t ? 0 : 1)); if (pet.energy <= 0 || p.combatUntil < t) return;
  const pw = (1 + pet.level * .12) * (1 + RARITY_MULT[pet.rar] * .1) * (1 + pet.stage * .35); pet.energy -= .5;
  if (sp.role === 'attack' && tg && !tg.dead) damageMob(p, tg, Math.round(pet.stats.atk * pw * 1.2), false, 'phys');
  else if (sp.role === 'heal') heal(p, Math.round(p.st.maxHp * .03 * pw + pet.stats.atk));
  else if (sp.role === 'tank') addFx(p.fx, 'tankred', 3, Math.min(.2, .05 + pet.level * .003), 'pet');
}
function broadcast(l: LocState, t: number) {
  const evts = l.evts; l.evts = []; const ph = dayPhase();
  const pv = [...l.players].filter(p => p.online || true).map(p => ({ id: p.id, name: p.c.name, cls: p.c.cls, look: p.c.look, lvl: p.c.level, hp: Math.round(p.c.hp), maxHp: p.st.maxHp, x: +p.x.toFixed(1), y: +p.y.toFixed(1), dx: +p.dx.toFixed(1), dy: +p.dy.toFixed(1), guild: p.c.guildId ? G.guilds.get(p.c.guildId)?.tag : undefined, eq: eqv(p), pet: p.c.pets.find(x => x.uid === p.c.activePet && !x.hatchAt) ? SPECIES[p.c.pets.find(x => x.uid === p.c.activePet)!.species].art : undefined, petCol: p.c.pets.find(x => x.uid === p.c.activePet)?.species, emote: p.emote && p.emote.until > t ? p.emote.k : undefined, pvp: !!p.duel, fx: p.fx.filter(f => f.until > t).map(f => f.k), sum: p.summons.map(s => s.kind).join(','), dead: p.dead, party: !!p.partyId }));
  const mobsByScene = new Map<Player['mapEncounter'], { uid: string; def: string; hp: number; maxHp: number; x: number; y: number; ph: number; fx: string[]; tgt?: string; flash: boolean; add: boolean }[]>();
  for (const m of l.mobs) if (!m.dead) {
    const mobs = mobsByScene.get(m.mapEncounter) ?? [];
    mobs.push({ uid: m.uid, def: m.def.id, hp: m.hp, maxHp: m.maxHp, x: +m.x.toFixed(1), y: +m.y.toFixed(1), ph: m.phase, fx: m.fx.filter(f => f.until > t).map(f => f.k), tgt: m.target || undefined, flash: m.flashT > t, add: m.add });
    mobsByScene.set(m.mapEncounter, mobs);
  }
  const nv = l.nodes.map(n => ({ uid: n.uid, def: n.def, x: +n.x.toFixed(1), y: +n.y.toFixed(1), ready: n.ready, hp: n.hp }));
  const base = { t: 'state', loc: l.id, tm: ph, weather: l.weather, players: pv, nodes: nv, evts };
  for (const p of l.players) {
    if (!p.online) continue; const party = p.partyId ? (G.parties.get(p.partyId)?.members || []).map(id => G.players.get(id)).filter(Boolean).map(q => ({ id: q!.id, name: q!.c.name, hp: Math.round(q!.c.hp), maxHp: q!.st.maxHp, lead: G.parties.get(p.partyId!)?.leader === q!.id, loc: q!.loc })) : [];
    send(p, { ...base, mobs: mobsByScene.get(p.mapEncounter) || [], me: { hp: Math.round(p.c.hp), maxHp: p.st.maxHp, res: Math.round(p.c.res), maxRes: p.st.maxRes, target: p.target, auto: p.auto, cd: Object.fromEntries(Object.entries(p.cd).filter(([, v]) => v > t).map(([k, v]) => [k, v - t])), fx: p.fx.filter(f => f.until > t).map(f => ({ k: f.k, left: f.until - t })), combat: p.combatUntil > t, autoFarm: p.autoFarm ? p.autoFarm.until - t : 0, shield: Math.round(p.shield), dead: p.dead, deadIn: p.dead ? p.deadUntil - t : 0, gather: p.gather ? { left: p.gather.until - t } : null, pvp: inPvp(p), stun: p.stunnedUntil > t, sum: p.summons.map(s => ({ kind: s.kind, left: s.until - t })) }, party });
    p.evq = [];
  }
}
const eqv = (p: Player) => { const o: Record<string, string> = {}; for (const [k, v] of Object.entries(p.c.equipment)) if (v) o[k] = v.id; return o; };
// ---------- Mob-KI ----------
function mobTick(m: Mob, l: LocState, t: number, dt: number) {
  if (m.dead) { if (!m.add && !m.dungeon && t > m.respawnAt) revive(m); return; }
  for (const f of m.fx) if (f.k === 'dot' && f.until > t && (f.next || 0) <= t) { f.next = t + 1000; const src = G.players.get(f.src || ''); if ((m.mapEncounter || m.dungeon) && (!src || !l.players.has(src) || !canEngageMob(src, m))) continue; m.hp -= f.v; m.dmg[f.src || ''] = (m.dmg[f.src || ''] || 0) + f.v; m.threat[f.src || ''] = (m.threat[f.src || ''] || 0) + f.v; ev(l, { k: 'dmg', x: m.x, y: m.y - 14, v: f.v, el: 'nature', id: m.uid }); if (m.hp <= 0 && src) { killMob(l, m); return; } }
  m.fx = m.fx.filter(f => f.until > t); if (m.fx.some(f => f.k === 'stun')) return;
  // Ziel wählen
  let tgt = m.target ? G.players.get(m.target) : undefined; if (tgt && (!l.players.has(tgt) || tgt.dead || !tgt.online || !canEngageMob(tgt, m))) { delete m.threat[tgt.id]; tgt = undefined; m.target = null; }
  const tp = Object.entries(m.threat).filter(([id]) => { const q = G.players.get(id); return q && l.players.has(q) && !q.dead && q.online && canEngageMob(q, m); }).sort((a, b) => b[1] - a[1])[0];
  if (tp) tgt = G.players.get(tp[0]);
  else if (!m.mapEncounter && !l.def.safe) { let best = 1e9; for (const q of l.players) if (!q.dead && q.online && (!q.geo?.on || q.inScene) && canEngageMob(q, m)) { const d = dist(m, q); if (d < m.def.aggro && d < best) { best = d; tgt = q; } } }
  m.target = tgt?.id || null;
  if (!tgt) { const dh = Math.hypot(m.hx - m.x, m.hy - m.y); if (dh > 1) { const k = Math.min(1, m.def.speed * dt / dh); m.x += (m.hx - m.x) * k; m.y += (m.hy - m.y) * k; } if (t > m.lastHit + 8000) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * .05 * dt); else if (Math.random() < .05) { m.hx = clamp(m.hx + rnd(-6, 6), 6, 94); } m.threat = {}; m.dmg = t > m.lastHit + 20000 ? {} : m.dmg; return; }
  const d = dist(m, tgt); const sp = m.def.speed * dt * (1 - fxSum(m.fx, 'slow'));
  if (d > 9) { const k = Math.min(1, sp / Math.max(d, .1)); m.x += (tgt.x - m.x) * k; m.y += (tgt.y - m.y) * k; m.y = clamp(m.y, Y0, Y1); }
  if (d <= 11 && t >= m.atkAt) {
    m.atkAt = t + 1800; m.tick++; const st = curSt(tgt, inPvp(tgt)); const nightBoost = m.def.fam === 'demon' && isNight() ? 1.1 : 1;
    let skillDone = false; for (const s of m.skills) if (m.tick % s.every === 0) { skillDone = true; mobSkill(m, s, tgt, l, t); break; }
    if (!skillDone) { if (Math.random() * 100 < st.dodge + fxSum(tgt.fx, 'b_dodge') + (WEATHER[l.weather]?.dodge || 0)) ev(l, { k: 'miss', x: tgt.x, y: tgt.y - 10 }); else { let a = m.def.atk * rnd(.85, 1.15) * nightBoost * (1 + m.enrage) * (1 - fxSum(m.fx, 'weak')); a *= 1 - mitig(st.def * (1 + fxSum(tgt.fx, 'b_def')), m.lvl); if (st.block && Math.random() * 100 < st.block) { a *= .5; ev(l, { k: 'block', x: tgt.x, y: tgt.y - 10 }); } damagePlayer(tgt, Math.max(1, Math.round(a)), false, m); } ev(l, { k: 'fx', x: m.x, y: m.y, id: 'mobatk', from: m.uid, to: tgt.id }); }
  }
}
function mobSkill(m: Mob, s: Mob['skills'][0], tgt: Player, l: LocState, t: number) {
  const base = m.def.atk * (1 + m.enrage); const hit = (q: Player, mul: number) => { if (!canEngageMob(q, m)) return; const st = curSt(q, inPvp(q)); const a = base * mul * rnd(.9, 1.1) * (1 - mitig(st.def * (1 + fxSum(q.fx, 'b_def')), m.lvl)); damagePlayer(q, Math.max(1, Math.round(a)), true, m, 'arcane'); };
  ev(l, { k: 'text', x: m.x, y: m.y - 30, v: ({ heavy: 'Wuchtschlag!', aoe: 'Flächenangriff!', heal: 'Heilt sich!', summon: 'Ruft Verstärkung!', enrage: 'Wutanfall!', stun: 'Betäubung!', poison: 'Gift!' })[s.k], c: 'warn' });
  switch (s.k) {
    case 'heavy': hit(tgt, s.pow); break; case 'aoe': ev(l, { k: 'fx', x: m.x, y: m.y, id: 'mobaoe', el: 'fire' }); for (const q of l.players) if (!q.dead && q.online && dist(q, m) < 50) hit(q, s.pow); break;
    case 'heal': m.hp = Math.min(m.maxHp, m.hp + m.maxHp * s.pow); ev(l, { k: 'heal', x: m.x, y: m.y - 14, v: Math.round(m.maxHp * s.pow) }); break;
    case 'summon': if (l.mobs.filter(x => x.add && !x.dead && x.mapEncounter === m.mapEncounter).length < 4) for (let i = 0; i < 2; i++) { const a = spawnMob(l, m.def.id === 'voidheart' ? 'void_spawn' : m.def.id === 'alpha_rat' ? 'rat' : 'imp', true, { x: clamp(m.x + rnd(-10, 10), 5, 95), y: clamp(m.y + rnd(-6, 6), Y0, Y1) }); a.mapEncounter = m.mapEncounter; a.threat[tgt.id] = 1; } break;
    case 'enrage': m.enrage = Math.min(1.2, m.enrage + s.pow); break;
    case 'stun': hit(tgt, .5); addFx(tgt.fx, 'stun', 1.5, 1); tgt.stunnedUntil = t + 1500; break;
    case 'poison': hit(tgt, .4); addFx(tgt.fx, 'dot', 6, Math.round(base * .15), 'm' + m.uid); break;
  }
}
// ---------- Sammeln ----------
export function startGather(p: Player, n: NodeS, l: LocState): string | null {
  const nd = NODES[n.def]; if (!n.ready) return 'Ressource nicht bereit'; if (p.dead || p.combatUntil > now() && nd.kind !== 'crate') return 'Nicht im Kampf möglich';
  if (nd.kind === 'crate') { n.hp--; ev(l, { k: 'dmg', x: n.x, y: n.y - 8, v: 1, c: 'crate' }); if (n.hp <= 0) { n.ready = false; n.respawnAt = now() + 120000; const g = rint(5, 15) * (1 + nd.tier * 2); p.c.gold += g; sys(p, `Kiste zerschlagen: ${g} Gold${Math.random() < .3 ? ' + Trank' : ''}`, 'loot'); if (Math.random() < .3) invAdd(p.c, `pot_hp_${nd.tier}`, 1); questEvent(p, 'gather', 'crate', 1); send(p, { t: 'char', c: p.c }); } return null; }
  const lvl = p.c.prof[nd.prof]?.lvl || 1; const need = Math.max(1, nd.tier * 10); if (lvl < need) return `${PROF_NAME[nd.prof]} Level ${need} benötigt`;
  const toolType = { mining: 'pickaxe', herbalism: 'sickle', woodcutting: 'axe' }[nd.prof]; const tool = p.c.inventory.find(i => ITEMS[i.id].tool === toolType && ITEMS[i.id].tier >= nd.tier) || Object.values(p.c.equipment).find(i => i && ITEMS[i.id].tool === toolType);
  if (!tool && !p.c.inventory.some(i => ITEMS[i.id].tool === toolType && ITEMS[i.id].tier >= nd.tier)) return `Benötigt Werkzeug (${{ pickaxe: 'Spitzhacke', sickle: 'Sichel', axe: 'Axt' }[toolType!]}) der Stufe ${nd.tier}`;
  p.gather = { uid: n.uid, until: now() + 2500 }; p.dx = p.x; p.dy = p.y; send(p, { t: 'gather', ms: 2500 }); return null;
}
const PROF_NAME: Record<string, string> = { mining: 'Bergbau', herbalism: 'Kräuterkunde', woodcutting: 'Holzfällen' };
export function profGain(p: Player, prof: string, exp: number) {
  const pr = (p.c.prof[prof] ||= { lvl: 1, exp: 0 }); pr.exp += exp; addTrainExp(p, exp * .5);
  while (pr.lvl < 100 && pr.exp >= profExpFn(pr.lvl)) { pr.exp -= profExpFn(pr.lvl); pr.lvl++; addTrainExp(p, pr.lvl * 20); sys(p, `${PROF_LABEL[prof] || prof} Level ${pr.lvl}!`, 'sys'); send(p, { t: 'profUp', prof, lvl: pr.lvl }); }
}
import { profExp as profExpFn, PROFS } from '@nam/game-data';
const PROF_LABEL: Record<string, string> = Object.fromEntries(PROFS.map(x => [x.id, x.name]));
function finishGather(p: Player, l: LocState) {
  const g = p.gather!; p.gather = null; const n = l.nodes.find(x => x.uid === g.uid); if (!n || !n.ready || dist(p, n) > 16) return; const nd = NODES[n.def]; n.ready = false; n.respawnAt = now() + 60000;
  const pr = p.c.prof[nd.prof] ||= { lvl: 1, exp: 0 }; let qty = rint(1, 2) + (pr.lvl >= 50 && Math.random() < .3 ? 1 : 0) + (pr.lvl >= 100 ? 1 : 0); const pet = p.c.pets.find(x => x.uid === p.c.activePet); if (pet && SPECIES[pet.species].role === 'finder' && Math.random() < .3 + pet.level * .01) qty++;
  invAdd(p.c, nd.yield, qty); const bonus = Math.random() < .06 + pr.lvl * .001 ? (invAdd(p.c, `m_gem_${nd.tier}`, 1), true) : false;
  profGain(p, nd.prof, Math.round((8 + nd.tier * 12) * 1.0)); questEvent(p, 'gather', nd.yield, qty); sys(p, `Gesammelt: ${ITEMS[nd.yield].name} x${qty}${bonus ? ' + Edelstein!' : ''}`, 'loot'); ev(l, { k: 'loot', x: n.x, y: n.y - 10, v: `+${qty} ${ITEMS[nd.yield].name}` }); send(p, { t: 'char', c: p.c }); p.dirty = true;
}
// ---------- Auto-Farm ----------
function autoFarm(p: Player, l: LocState, t: number) {
  const af = p.autoFarm!; const stop = (why: string) => { p.autoFarm = null; p.auto = false; p.target = null; sys(p, `Auto-Farm beendet: ${why}`); send(p, { t: 'autoFarm', on: false }); };
  if (t > af.until) return stop('Zeitlimit erreicht'); if (l.def.safe) return stop('Sichere Zone'); if (p.c.inventory.length >= BAL.invSize) return stop('Inventar voll');
  const pots = p.c.inventory.find(i => ITEMS[i.id].use?.hp && i.id.startsWith('pot_hp')); if (p.c.settings.autoPotion && p.c.hp < p.st.maxHp * .35 && pots) { usePotion(p, pots.id); } else if (p.c.hp < p.st.maxHp * .22 && !pots) return stop('Leben niedrig, keine Tränke');
  const mp = p.c.inventory.find(i => i.id.startsWith('pot_mp')); if (p.c.settings.autoPotion && CLASS_BASE[p.c.cls].resRegen > 0 && p.c.res < p.st.maxRes * .15 && mp) usePotion(p, mp.id);
  let tg = p.target ? l.mobs.find(m => m.uid === p.target && !m.dead && canEngageMob(p, m)) : null;
  if (!tg) { let best = 1e9; for (const m of l.mobs) { if (m.dead || !canEngageMob(p, m) || m.def.role === 'boss' || m.lvl > p.c.level + 6) continue; const d = Math.hypot(m.x - af.hx, m.y - af.hy); if (d < BAL.autoFarmRadius && dist(m, p) < best) { best = dist(m, p); tg = m; } } if (tg) { p.target = tg.uid; p.auto = true; } else return; }
  // Skill-Rotation
  const sk = p.c.hotbar.map(id => id && SKILLS[id]).filter(Boolean) as SkillDef[];
  for (const s of sk) { if (s.target === 'ally' || s.target === 'party' || s.kind === 'summon' && p.summons.length) continue; if ((p.cd[s.id] || 0) > t || p.c.res < s.cost + (s.cost ? 5 : 0)) continue; if ((s.kind === 'heal' || s.kind === 'shield' || s.kind === 'hot') && p.c.hp > p.st.maxHp * .6) continue; const r = useSkill(p, s.id); if (!r) break; }
}
export function usePotion(p: Player, id: string): boolean { const d = ITEMS[id]; if (!d?.use) return false; const it = p.c.inventory.find(i => i.id === id); if (!it) return false; it.qty--; if (it.qty <= 0) p.c.inventory.splice(p.c.inventory.indexOf(it), 1); if (d.use.hp) heal(p, d.use.hp); if (d.use.res) p.c.res = Math.min(p.st.maxRes, p.c.res + d.use.res); p.dirty = true; return true; }
export function respawnAll() { for (const l of G.locs.values()) for (const m of l.mobs) if (m.dead && !m.add) revive(m); }
export { fxSum, addFx, fxHas, ev, locOf, inPvp };

// ---------- Welt-Events ----------
function eventProfile(m: Mob, name: string) {
  const def = m.def;
  m.def = { ...def, name, exp: def.exp * 3, gold: [def.gold[0] * 3, def.gold[1] * 3], respawn: 1e9 };
  m.maxHp = m.hp = def.hp * 2;
}
export function worldEvent() {
  const cands = [...G.locs.values()].filter(l => !l.def.safe && !l.def.pvp && l.players.size > 0 && l.def.spawns.some(s => MOBS[s.mob].role === 'elite'));
  if (!cands.length) return; const l = cands[rint(0, cands.length - 1)]; const sp = l.def.spawns.filter(s => MOBS[s.mob].role === 'elite'); const d = MOBS[sp[rint(0, sp.length - 1)].mob];
  const m = spawnMob(l, d.id, false); eventProfile(m, `⚡ ${d.name} (Event)`); (m as any).event = true;
  for (const p of G.players.values()) if (p.online) sys(p, `⚡ Welt-Event: ${d.name} ist in ${l.def.name} erschienen! Dreifache Belohnung.`, 'boss');
}

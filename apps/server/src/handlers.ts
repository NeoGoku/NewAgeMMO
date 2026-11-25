import { BAL, ATTRS, CLASS_BASE, RARITY_MULT, bonusPointCost, type Attr, type Rarity, type Slot, type ItemInst } from '@nam/shared';
import { ITEMS, LOCS, NPCS, QUESTS, RECIPES, PROFS, SKILLS, CLASSES, SPECIES, MOBS, NODES } from '@nam/game-data';
import { G, now, uid, send, sys, dist, clamp, type Player } from './state';
import { invAdd, invRemove, invCount, takeUid, giveInst, recalc, isEquip, mkItem, repairCost, repairAll, rollRarity, gainExp, trainCost, addTrainExp, summary, eqView } from './chars';
import { useSkill, usePotion, profGain, startGather, heal, locOf, addFx, ev } from './game';
import { startTravel, teleportTo, joinLoc } from './world';
import { acceptQuest, turnIn, availableAt, readyAt, questEvent, dailyReset } from './quests';
export type Handler = (p: Player, m: any) => string | null | void | Record<string, any>;
export const H: Record<string, Handler> = {};
export const NO_CHAR = new Set(['walk', 'target', 'auto', 'skill', 'hotbar', 'ping', 'emote', 'chat', 'npc', 'gather', 'autoFarm', 'profile', 'houseList', 'shop']);
const S = (v: any, n = 64) => (typeof v === 'string' ? v.slice(0, n) : '');
const N = (v: any, a: number, b: number, d = a) => { const x = Number(v); return Number.isFinite(x) ? clamp(Math.floor(x), a, b) : d; };
H.ping = (p, m) => ({ pong: now() });
H.walk = (p, m) => { if (p.dead || p.travel || p.houseId) return; p.dx = clamp(Number(m.x) || p.x, 3, 97); p.dy = clamp(Number(m.y) || p.y, 52, 94); p.pending = null; p.gather = null; p.autoFarm && !m.keep && (p.autoFarm = null); };
H.target = (p, m) => { if (p.dead) return; const id = S(m.id) || null; p.target = id; if (id && !p.autoFarm) { /* Ziel gewählt: Auto-Angriff nur bei feindlichem Ziel */ const l = locOf(p); p.auto = !!l.mobs.find(x => x.uid === id) || !!(G.players.get(id) && (G.players.get(id)!.duel || LOCS[p.loc].pvp) && id !== p.id); } if (!id) p.auto = false; };
H.auto = (p, m) => { p.auto = !!m.on && !!p.target; };
H.skill = (p, m) => { const e = useSkill(p, S(m.id)); if (e) return e; };
H.hotbar = (p, m) => { const s = N(m.slot, 0, 5); const id = m.id ? S(m.id) : null; if (id && (!SKILLS[id] || SKILLS[id].cls !== p.c.cls || SKILLS[id].lvl > p.c.level)) return 'Nicht verfügbar'; p.c.hotbar[s] = id; p.dirty = true; };
H.emote = (p, m) => { p.emote = { k: S(m.k, 12), until: now() + 4000 }; };
H.autoFarm = (p, m) => { if (!m.on) { p.autoFarm = null; p.auto = false; p.target = null; return; } if (LOCS[p.loc].safe) return 'In sicheren Zonen nicht möglich'; if (p.dead) return 'Du bist tot'; if (LOCS[p.loc].kind === 'arena') return 'Nicht in der Arena'; p.autoFarm = { until: now() + BAL.autoFarmMaxMs, hx: p.x, hy: p.y }; send(p, { t: 'autoFarm', on: true, ms: BAL.autoFarmMaxMs }); };
H.settings = (p, m) => { for (const k of ['autoPotion', 'autoLoot', 'autoQuest'] as const) if (k in m) p.c.settings[k] = !!m[k]; p.dirty = true; };
// ---- Attribute ----
H.stat = (p, m) => { const a = S(m.attr, 4) as Attr; const n = N(m.n, 1, 100, 1); if (!ATTRS.includes(a)) return 'Ungültig'; if (p.c.statPoints < n) return 'Nicht genug Punkte'; p.c.statPoints -= n; p.c.attrs[a] += n; recalc(p); p.dirty = true; };
H.buyBonus = (p, m) => { const a = S(m.attr, 4) as Attr; if (!ATTRS.includes(a)) return 'Ungültig'; const cost = bonusPointCost(p.c.bonusPoints); if (p.c.trainExp < cost) return `Benötigt ${cost} Trainings-EXP`; p.c.trainExp -= cost; p.c.bonusPoints++; p.c.attrs[a]++; recalc(p); p.dirty = true; sys(p, `+1 ${a.toUpperCase()} durch Training (nächster Punkt: ${bonusPointCost(p.c.bonusPoints)} EXP)`); };
// ---- Inventar ----
H.useItem = (p, m) => {
  const it = p.c.inventory.find(i => i.uid === S(m.uid)); if (!it) return 'Gegenstand fehlt'; const d = ITEMS[it.id]; if (p.dead) return 'Du bist tot'; const u = d.use;
  if (isEquip(it.id)) return H.equip(p, m); if (!u) return 'Nicht benutzbar'; if (p.c.level < d.lvl && d.type === 'consumable' && !u.resetAttrs && !u.hatch && !u.teleport && u.trainExp === undefined) return `Benötigt Level ${d.lvl}`;
  if (u.hatch) return H.petHatch(p, m); if (u.teleport) { if (p.combatUntil > now()) return 'Im Kampf nicht möglich'; if (p.duel) return 'Im Duell nicht möglich'; it.qty--; if (it.qty <= 0) p.c.inventory.splice(p.c.inventory.indexOf(it), 1); joinLoc(p, u.teleport); return; }
  if (u.resetAttrs) { const base = CLASS_BASE[p.c.cls].attrs; let pts = 0; for (const a of ATTRS) { pts += p.c.attrs[a] - base[a]; p.c.attrs[a] = base[a]; } p.c.statPoints += pts - p.c.bonusPoints; p.c.attrs.str = p.c.attrs.str; /* Bonuspunkte bleiben als normale Punkte erhalten */ p.c.statPoints += p.c.bonusPoints; recalc(p); sys(p, 'Attribute zurückgesetzt – verteile deine Punkte neu.'); }
  if (u.hp) heal(p, u.hp); if (u.res) p.c.res = Math.min(p.st.maxRes, p.c.res + u.res); if (u.trainExp) addTrainExp(p, u.trainExp); if (u.exp) gainExp(p, u.exp);
  if (u.buff) { const k = ({ atk: 'b_atk', def: 'b_def', crit: 'b_crit', speed: 'b_speed', regen: 'regen' } as any)[u.buff.stat]; addFx(p.fx, k, u.buff.dur, u.buff.stat === 'regen' ? Math.round(p.st.maxHp * .004) : u.buff.val, 'item:' + d.id); }
  if (u.repair) { repairAll(p.c); recalc(p); sys(p, 'Ausrüstung repariert.'); }
  if (u.petFood) { const pet = p.c.pets.find(x => x.uid === p.c.activePet); if (!pet) return 'Kein aktives Pet'; pet.energy = Math.min(100, pet.energy + 30); pet.exp += u.petFood; sys(p, `${pet.name} frisst genüsslich.`); }
  if (u.dmg) { const l = locOf(p); if (l.def.safe) return 'In sicheren Zonen nicht erlaubt'; const t = p.target && l.mobs.find(x => x.uid === p.target && !x.dead); if (!t) return 'Kein Ziel'; for (const mm of l.mobs) if (!mm.dead && dist(mm, t) < 25) { mm.hp -= 0; import('./game').then(g => g.damageMob(p, mm, u.dmg!, false, 'fire')); } }
  it.qty--; if (it.qty <= 0) p.c.inventory.splice(p.c.inventory.indexOf(it), 1); p.dirty = true;
};
H.equip = (p, m) => {
  const it = p.c.inventory.find(i => i.uid === S(m.uid)); if (!it) return 'Gegenstand fehlt'; const d = ITEMS[it.id]; if (!d.slot) return 'Nicht ausrüstbar'; if (p.c.level < d.lvl) return `Benötigt Level ${d.lvl}`; if (d.cls && d.cls !== p.c.cls) return 'Falsche Klasse';
  if (p.combatUntil > now() && d.slot === 'weapon') return 'Im Kampf nicht möglich'; const old = p.c.equipment[d.slot]; p.c.inventory.splice(p.c.inventory.indexOf(it), 1); p.c.equipment[d.slot] = it; if (old) p.c.inventory.push(old); recalc(p); p.dirty = true;
};
H.unequip = (p, m) => { const s = S(m.slot, 8) as Slot; const it = p.c.equipment[s]; if (!it) return; if (p.c.inventory.length >= BAL.invSize) return 'Inventar voll'; delete p.c.equipment[s]; p.c.inventory.push(it); recalc(p); p.dirty = true; };
H.destroy = (p, m) => { const it = takeUid(p.c.inventory, S(m.uid), N(m.qty, 1, 9999, 1)); if (!it) return 'Fehlt'; p.dirty = true; };
H.sortInv = (p) => { p.c.inventory.sort((a, b) => ITEMS[a.id].type.localeCompare(ITEMS[b.id].type) || ITEMS[b.id].tier - ITEMS[a.id].tier || b.rar - a.rar || ITEMS[a.id].name.localeCompare(ITEMS[b.id].name)); p.dirty = true; };
H.stashPut = (p, m) => { const it = takeUid(p.c.inventory, S(m.uid), N(m.qty, 1, 9999, 1)); if (!it) return 'Fehlt'; if (!giveInst(p.c, it, p.c.stash, BAL.stashSize)) { giveInst(p.c, it); return 'Lager voll'; } p.dirty = true; };
H.stashTake = (p, m) => { const it = takeUid(p.c.stash, S(m.uid), N(m.qty, 1, 9999, 1)); if (!it) return 'Fehlt'; if (!giveInst(p.c, it)) { giveInst(p.c, it, p.c.stash, 999); return 'Inventar voll'; } p.dirty = true; };
// ---- NPC / Shops ----
const npcHere = (p: Player, id: string) => { const n = NPCS[id]; return n && n.loc === p.loc ? n : null; };
function shopList(p: Player, id: string) {
  const n = NPCS[id]; if (!n?.shop) return []; const out: { id: string; price: number }[] = [];
  for (const d of Object.values(ITEMS)) { if (!n.shop.types.includes(d.type) || !n.shop.tiers.includes(d.tier)) continue; if (d.type === 'weapon' && d.cls !== p.c.cls) continue; if (d.id.startsWith('tome_') || d.id.startsWith('elx_') && d.tier > 3 && false) continue; if (d.type === 'mount') continue; out.push({ id: d.id, price: d.price }); }
  if (n.services.includes('shop') && n.shop.types.includes('consumable') && n.shop.tiers.includes(0)) out.push({ id: 'tp_scroll', price: ITEMS.tp_scroll.price });
  return out;
}
H.npc = (p, m) => {
  const n = npcHere(p, S(m.id)); if (!n) return 'NPC nicht hier'; questEvent(p, 'talk', n.id); dailyReset(p);
  const avail = availableAt(p, n.id); const ready = readyAt(p, n.id); const active = Object.entries(p.c.quests).filter(([id, s]) => s.state === 'active' && (QUESTS[id].giver === n.id || QUESTS[id].turnin === n.id)).map(([id]) => id);
  send(p, { t: 'dialog', npc: { id: n.id, name: n.name, title: n.title, greeting: n.greeting, services: n.services, color: n.color, kind: n.kind, prof: n.prof }, avail, ready, active, shop: n.services.includes('shop') ? shopList(p, n.id) : undefined, repair: n.services.includes('repair') ? repairCost(p.c) : undefined });
};
H.shopBuy = (p, m) => { const n = npcHere(p, S(m.npc)); if (!n || !n.services.includes('shop')) return 'Kein Händler'; const row = shopList(p, n.id).find(x => x.id === m.id); if (!row) return 'Nicht im Sortiment'; const q = N(m.qty, 1, 999, 1); const cost = row.price * q; if (p.c.gold < cost) return 'Nicht genug Gold'; const left = invAdd(p.c, row.id, q); if (left === q) return 'Inventar voll'; p.c.gold -= row.price * (q - left); p.dirty = true; };
H.shopSell = (p, m) => { const n = npcHere(p, S(m.npc)); if (!n || !n.services.includes('shop') && !n.services.includes('repair')) return 'Kein Händler'; const it = p.c.inventory.find(i => i.uid === S(m.uid)); if (!it) return 'Fehlt'; const d = ITEMS[it.id]; if (d.price <= 0) return 'Unverkäuflich'; const q = N(m.qty, 1, it.qty, 1); const g = Math.max(1, Math.floor(d.price * .25 * RARITY_MULT[it.rar])) * q; takeUid(p.c.inventory, it.uid, q); p.c.gold += g; p.dirty = true; sys(p, `Verkauft für ${g} Gold.`); };
H.repair = (p, m) => { const n = npcHere(p, S(m.npc)); if (!n || !n.services.includes('repair')) return 'Kein Reparaturdienst'; const c = repairCost(p.c); if (!c) return 'Nichts zu reparieren'; if (p.c.gold < c) return `Benötigt ${c} Gold`; p.c.gold -= c; repairAll(p.c); recalc(p); p.dirty = true; };
H.mountBuy = (p, m) => { const n = npcHere(p, S(m.npc)); if (!n || !n.services.includes('mounts')) return 'Kein Reittierhändler'; const d = ITEMS[S(m.id)]; if (!d || d.type !== 'mount') return 'Unbekannt'; if (p.c.level < d.lvl) return `Benötigt Level ${d.lvl}`; if (p.c.gold < d.price) return 'Nicht genug Gold'; if (invAdd(p.c, d.id, 1)) return 'Inventar voll'; p.c.gold -= d.price; p.dirty = true; };
H.heal = (p, m) => { const n = npcHere(p, S(m.npc)); if (!n || !n.services.includes('heal')) return 'Kein Heiler'; const cost = Math.round(p.c.level * 2); if (p.c.gold < cost) return `Benötigt ${cost} Gold`; p.c.gold -= cost; p.c.hp = p.st.maxHp; if (CLASS_BASE[p.c.cls].resRegen) p.c.res = p.st.maxRes; p.dirty = true; sys(p, 'Du fühlst dich erfrischt.'); };
H.travel = (p, m) => startTravel(p, S(m.to));
H.teleport = (p, m) => { const n = ['vex', 'hafenmeister', 'rat_magier'].find(i => npcHere(p, i)); if (!n) return 'Kein Teleporter'; const to = S(m.to); const d = LOCS[to]; if (!d || d.tele === undefined || !p.c.discovered.includes(to)) return 'Ziel nicht verfügbar'; if (to === p.loc) return 'Du bist bereits dort'; return teleportTo(p, to, d.tele); };
H.questAccept = (p, m) => { const q = QUESTS[S(m.id)]; if (!q) return 'Unbekannt'; if (q.giver && !npcHere(p, q.giver)) return 'Falscher Ort'; const e = acceptQuest(p, q.id); if (e) return e; send(p, { t: 'quests', q: p.c.quests, done: p.c.questsDone }); };
H.questTurnin = (p, m) => { const q = QUESTS[S(m.id)]; if (!q) return 'Unbekannt'; if (!npcHere(p, q.turnin)) return 'Falscher Ort'; return turnIn(p, q.id, S(m.choice, 16)); };
H.questAbandon = (p, m) => { const id = S(m.id); const q = QUESTS[id]; if (!q || !p.c.quests[id]) return 'Nicht aktiv'; if (q.give) invRemove(p.c, q.give.id, q.give.qty); delete p.c.quests[id]; send(p, { t: 'quests', q: p.c.quests, done: p.c.questsDone }); p.dirty = true; };
H.gather = (p, m) => { const l = locOf(p); const n = l.nodes.find(x => x.uid === S(m.uid)); if (!n) return 'Nicht gefunden'; if (dist(p, n) > 14) { p.dx = clamp(n.x - 4, 3, 97); p.dy = clamp(n.y + 2, 52, 94); p.pending = { kind: 'gather', uid: n.uid }; return; } const e = startGather(p, n, l); if (e) return e; };
H.stats = () => ({});
// ---- Handwerk ----
const benchProfs: Record<string, string[]> = { furn_anvil: ['smithing', 'engineering', 'tailoring', 'building'], furn_alch: ['alchemy', 'cooking', 'husbandry'] };
function stationOk(p: Player, prof: string) { if (p.houseId) { const h = G.houses.get(p.houseId); if (h && h.furniture.some(f => benchProfs[f.furn]?.includes(prof))) return 'house'; } return LOCS[p.loc].hotspots.some(h => h.kind === 'station' && h.prof === prof) ? 'station' : ''; }
H.craft = (p, m) => {
  const r = RECIPES[S(m.recipe, 80)]; if (!r) return 'Unbekanntes Rezept'; const qty = N(m.qty, 1, 20, 1); const st = stationOk(p, r.prof); if (!st) return `Benötigt Werkstatt für ${PROFS.find(x => x.id === r.prof)!.name}`;
  const pr = (p.c.prof[r.prof] ||= { lvl: 1, exp: 0 }); if (pr.lvl < r.lvl) return `Benötigt ${PROFS.find(x => x.id === r.prof)!.name} Level ${r.lvl}`; if (p.c.craftJobs.length >= 5) return 'Warteschlange voll (5)';
  for (const i of r.in) if (invCount(p.c, i.id) < i.n * qty) return `Material fehlt: ${ITEMS[i.id].name} x${i.n * qty}`;
  for (const i of r.in) invRemove(p.c, i.id, i.n * qty); const mastery = pr.lvl >= 100 ? .6 : pr.lvl >= 50 ? .8 : 1; const secs = Math.max(2, r.sec * qty * mastery * (st === 'house' ? .8 : 1));
  const last = p.c.craftJobs.reduce((t, j) => Math.max(t, j.end), now()); p.c.craftJobs.push({ id: uid('j'), recipe: r.id, qty, start: last, end: last + secs * 1000 }); p.dirty = true; sys(p, `Herstellung gestartet: ${r.name} x${qty}`);
};
export function claimCrafts(p: Player) {
  const t = now(); const done = p.c.craftJobs.filter(j => j.end <= t); if (!done.length) return 0;
  for (const j of done) { const r = RECIPES[j.recipe]; if (!r) continue; const pr = p.c.prof[r.prof] ||= { lvl: 1, exp: 0 }; let outs = r.out.n * j.qty;
    if (isEquip(r.out.id)) { for (let i = 0; i < j.qty; i++) { const it = mkItem(r.out.id, 1, rollRarity(pr.lvl / 25 + (pr.lvl >= 50 ? .5 : 0) + (pr.lvl >= 100 ? 1 : 0)) as Rarity); if (!giveInst(p.c, it)) p.c.mail.push({ id: uid('ml'), from: 'Werkstatt', subject: ITEMS[r.out.id].name, gold: 0, items: [it], t }); } }
    else { if (pr.lvl >= 50 && Math.random() < .2) outs += r.out.n; const left = invAdd(p.c, r.out.id, outs); if (left) p.c.mail.push({ id: uid('ml'), from: 'Werkstatt', subject: ITEMS[r.out.id].name, gold: 0, items: [mkItem(r.out.id, left)], t }); }
    profGain(p, r.prof, r.exp * j.qty); questEvent(p, 'craft', r.out.id, outs); questEvent(p, 'item', r.out.id, outs); }
  p.c.craftJobs = p.c.craftJobs.filter(j => j.end > t); p.dirty = true; sys(p, `${done.length} Herstellung(en) abgeschlossen.`, 'loot'); return done.length;
}
H.craftClaim = (p) => { if (!claimCrafts(p)) return 'Noch nichts fertig'; };
H.craftCancel = (p, m) => { const j = p.c.craftJobs.find(x => x.id === S(m.id)); if (!j || j.end <= now()) return 'Nicht möglich'; const r = RECIPES[j.recipe]; for (const i of r.in) invAdd(p.c, i.id, i.n * j.qty); p.c.craftJobs = p.c.craftJobs.filter(x => x !== j); let t = now(); for (const x of p.c.craftJobs) { const len = x.end - x.start; x.start = Math.max(t, x.start > now() ? t : x.start); if (x.end > now()) { x.start = t; x.end = t + len; t = x.end; } } };
H.mailClaim = (p, m) => { const ml = p.c.mail.find(x => x.id === S(m.id)); if (!ml) return 'Fehlt'; if (ml.items.length && p.c.inventory.length + ml.items.length > BAL.invSize + 0 && !ml.items.every(i => ITEMS[i.id].stack > 1)) return 'Inventar zu voll'; for (const it of ml.items) if (!giveInst(p.c, it)) return 'Inventar voll'; p.c.gold += ml.gold; p.c.mail = p.c.mail.filter(x => x !== ml); p.dirty = true; };
H.profile = (p, m) => { const c = [...G.chars.values()].find(x => x.name.toLowerCase() === S(m.name, 16).toLowerCase()); if (!c) return 'Spieler nicht gefunden'; const g = c.guildId ? G.guilds.get(c.guildId) : null; send(p, { t: 'profile', p: { name: c.name, cls: c.cls, level: c.level, prestige: c.prestige, look: c.look, eq: eqView(c), guild: g?.name, kills: Object.values(c.kills).reduce((a, b) => a + b, 0), honor: c.honor, online: !!G.byName.get(c.name.toLowerCase())?.online, loc: G.byName.get(c.name.toLowerCase())?.online ? c.loc : undefined, titles: c.titles } }); };
H.prestigeInfo = () => ({});

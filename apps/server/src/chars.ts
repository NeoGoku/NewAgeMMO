import { BAL, CLASS_BASE, derive, expToNext, gearOf, pvpAttrs, pvpGear, bonusPointCost, RARITY_MULT, type Character, type ClassId, type ItemInst, type Look, type Rarity, type Slot, type Attrs, type Derived } from '@nam/shared';
import { ITEMS, CLASSES, defaultHotbar, SPECIES } from '@nam/game-data';
import { START_LOC } from '@nam/game-data';
import { G, uid, now, send, sys, type Player } from './state';
export const itemDef = (id: string) => ITEMS[id];
export function newChar(accountId: string, name: string, cls: ClassId, look: Look): Character {
  const cb = CLASS_BASE[cls]; const c: Character = {
    id: uid('c'), accountId, name, cls, look, level: 1, exp: 0, prestige: 0, pexp: 0, statPoints: 0, attrs: { ...cb.attrs }, bonusPoints: 0, trainExp: 0, hp: 1, res: 0, gold: 100, loc: START_LOC, x: 50, y: 78,
    inventory: [], stash: [], equipment: {}, hotbar: defaultHotbar(cls), quests: {}, questsDone: [], dailyReset: 0, rep: {}, choices: {}, prof: {}, pets: [], activePet: null, summons: [], craftJobs: [], mail: [], friends: [], guildId: null, houseId: null,
    kills: {}, discovered: [START_LOC], settings: { autoPotion: true, autoLoot: true, autoQuest: false }, arenaPts: 0, honor: 0, created: now(), lastSeen: now(), playtime: 0, titles: [],
  };
  const w = ITEMS[`w_${cls}_0`]; c.equipment.weapon = { uid: uid('i'), id: w.id, rar: 0, qty: 1, dur: 100 };
  invAdd(c, 'pot_hp_0', 5); invAdd(c, 'pot_mp_0', 3); invAdd(c, 'tp_scroll', 1);
  const d = derive(cls, 1, c.attrs, gearOf(c.equipment, itemDef)); c.hp = d.maxHp; c.res = cls === 'tank' ? 0 : d.maxRes; return c;
}
export const isEquip = (id: string) => ['weapon', 'armor', 'accessory', 'mount'].includes(ITEMS[id]?.type);
export function mkItem(id: string, qty = 1, rar: Rarity = 0): ItemInst { const d = ITEMS[id]; return { uid: uid('i'), id, rar, qty, ...(isEquip(id) && d.type !== 'mount' ? { dur: 100 } : {}) }; }
export const invFree = (c: Character) => BAL.invSize - c.inventory.length;
/** Fügt Gegenstände hinzu (stapelt). Gibt nicht untergebrachte Menge zurück. */
export function invAdd(c: Character, id: string, qty: number, rar: Rarity = 0, list: ItemInst[] = c.inventory, cap = BAL.invSize): number {
  const d = ITEMS[id]; if (!d) return qty; let left = qty;
  if (d.stack > 1) for (const it of list) { if (!left) break; if (it.id === id && it.rar === rar && it.qty < d.stack) { const a = Math.min(left, d.stack - it.qty); it.qty += a; left -= a; } }
  while (left > 0 && list.length < cap) { const a = Math.min(left, d.stack); list.push(mkItem(id, a, rar)); left -= a; }
  return left;
}
export const invCount = (c: Character, id: string) => c.inventory.reduce((s, i) => s + (i.id === id ? i.qty : 0), 0);
export function invRemove(c: Character, id: string, qty: number): boolean {
  if (invCount(c, id) < qty) return false; let left = qty;
  for (const it of [...c.inventory]) { if (it.id !== id) continue; const a = Math.min(left, it.qty); it.qty -= a; left -= a; if (it.qty <= 0) c.inventory.splice(c.inventory.indexOf(it), 1); if (!left) break; } return true;
}
export function takeUid(list: ItemInst[], u: string, qty = 1): ItemInst | null {
  const it = list.find(i => i.uid === u); if (!it || qty < 1 || it.qty < qty) return null;
  if (it.qty === qty) { list.splice(list.indexOf(it), 1); return it; } it.qty -= qty; return { ...it, uid: uid('i'), qty };
}
export function giveInst(c: Character, it: ItemInst, list: ItemInst[] = c.inventory, cap = BAL.invSize): boolean {
  const d = ITEMS[it.id]; if (d.stack > 1) { for (const o of list) if (o.id === it.id && o.rar === it.rar && o.qty + it.qty <= d.stack) { o.qty += it.qty; return true; } } if (list.length >= cap) return false; list.push(it); return true;
}
export function weaponClassOk(c: Character, d: any) { return !d.cls || d.cls === c.cls; }
export function recalc(p: Player) {
  const c = p.c; const mods: any = { atkPct: 0, defPct: 0, critAdd: 0, hpPct: 0, dodgeAdd: 0, speedPct: 0 };
  for (const ps of CLASSES[c.cls].passives) if (c.level >= ps.lvl) for (const k in ps.mods) mods[k] += (ps.mods as any)[k];
  const gd = c.guildId && G.guilds.get(c.guildId); if (gd) { mods.atkPct += (gd.skills.dmg || 0) * .02; mods.hpPct += (gd.skills.hp || 0) * .02; }
  const pet = c.pets.find(x => x.uid === c.activePet); if (pet && pet.energy > 0 && SPECIES[pet.species].role === 'buff') mods.atkPct += .03 + pet.level * .002 * RARITY_MULT[pet.rar];
  p.mods = mods; p.st = derive(c.cls, c.level, c.attrs, gearOf(c.equipment, itemDef), c.prestige, mods);
  p.pvpSt = derive(c.cls, BAL.pvpNormLevel, pvpAttrs(c.cls), pvpGear(), 0, mods);
  p.st.maxHp = Math.max(1, p.st.maxHp); c.hp = Math.min(c.hp, p.st.maxHp);
}
export const curSt = (p: Player, pvp: boolean): Derived => (pvp && p.pvpSt ? p.pvpSt : p.st);
export const expNeeded = (c: Character) => c.level >= BAL.maxLevel ? BAL.prestigeExp : expToNext(c.level);
export function gainExp(p: Player, amount: number) {
  const c = p.c; amount = Math.floor(amount * (1 + ((G.guilds.get(c.guildId || '')?.skills.exp || 0) * .02))); if (amount <= 0) return;
  if (c.level >= BAL.maxLevel) { c.pexp += amount; while (c.pexp >= BAL.prestigeExp) { c.pexp -= BAL.prestigeExp; c.prestige++; c.statPoints++; sys(p, `Prestige-Rang ${c.prestige} erreicht! +1 Attributpunkt, +1 % alle Werte.`, 'sys'); p.evq.push({ k: 'lvl', x: p.x, y: p.y - 10, v: 'Prestige ' + c.prestige }); recalc(p); } return; }
  c.exp += amount; let up = false;
  while (c.level < BAL.maxLevel && c.exp >= expToNext(c.level)) { c.exp -= expToNext(c.level); c.level++; c.statPoints += 1; up = true; }
  if (c.level >= BAL.maxLevel) { c.pexp += c.exp; c.exp = 0; }
  if (up) { recalc(p); p.c.hp = p.st.maxHp; p.c.res = CLASS_BASE[c.cls].resRegen === 0 ? 0 : p.st.maxRes; p.evq.push({ k: 'lvl', x: p.x, y: p.y - 10, v: 'Level ' + c.level }); sys(p, `Aufstieg! Du bist jetzt Level ${c.level}. Verteile deinen Attributpunkt.`, 'sys'); send(p, { t: 'levelup', level: c.level }); }
}
export function trainCost(c: Character) { return bonusPointCost(c.bonusPoints); }
export function addTrainExp(p: Player, n: number) { p.c.trainExp += Math.floor(n); }
export function summary(c: Character) { return { id: c.id, name: c.name, cls: c.cls, level: c.level, look: c.look, loc: c.loc, lastSeen: c.lastSeen, prestige: c.prestige, eq: eqView(c) }; }
export function eqView(c: Character) { const o: Record<string, string> = {}; for (const [k, v] of Object.entries(c.equipment)) if (v) o[k] = v.id; return o; }
export function repairCost(c: Character): number { let t = 0; for (const it of Object.values(c.equipment)) if (it && it.dur !== undefined && it.dur < 100) t += Math.ceil((100 - it.dur) * (ITEMS[it.id].price * 0.01 * BAL.repairPerPoint + 1)); for (const it of c.inventory) if (it.dur !== undefined && it.dur < 100 && isEquip(it.id)) t += Math.ceil((100 - it.dur) * (ITEMS[it.id].price * 0.01 * BAL.repairPerPoint + 1)); return t; }
export function repairAll(c: Character) { for (const it of Object.values(c.equipment)) if (it?.dur !== undefined) it.dur = 100; for (const it of c.inventory) if (it.dur !== undefined) it.dur = 100; }
export function rollRarity(boost = 0): Rarity { const r = Math.random() * (1 + boost); return (r > .995 ? 4 : r > .975 ? 3 : r > .9 ? 2 : r > .7 ? 1 : 0) as Rarity; }

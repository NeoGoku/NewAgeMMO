import type { Attr, Attrs, ClassId, ItemInst } from './types';
import { RARITY_MULT } from './types';
/** Zentrale, konfigurierbare Balancewerte. Alle Formeln sind vorläufig und per Messung anzupassen. */
export const BAL = {
  maxLevel: 100, expBase: 80, expExp: 2.05, deathExpLoss: 0.05, bonusBase: 400, bonusGrowth: 1.12,
  tickMs: 400, baseAtkMs: 1500, regenOutOfCombat: 0.02, critBase: 5, critDmg: 1.5, mitigK: 40, mitigLv: 8,
  prestigeExp: 400000, prestigePerRankStat: 0.01, pvpNormLevel: 60, pvpPointsPerLevel: 1.1, partyMax: 10, invSize: 80, stashSize: 80,
  offlineCap: 8 * 3600e3, autoFarmMaxMs: 20 * 60e3, autoFarmRadius: 100, travelBaseMs: 1500, moveSpeed: 14,
  dayLengthMs: 24 * 60e3, weatherMs: 4 * 60e3, resetStonePrice: 0, auctionFee: 0.05, guildCreateCost: 5000, guildMax: 50,
  houseCost: 2500, floorCost: 8000, repairPerPoint: 0.6,
};
export const expToNext = (lv: number) => Math.floor(BAL.expBase * Math.pow(lv, BAL.expExp));
export const bonusPointCost = (n: number) => Math.floor(BAL.bonusBase * Math.pow(BAL.bonusGrowth, n));
export interface ClassBase { attrs: Attrs; atkAttr: Attr[]; res: string; resMax: number; resRegen: number; melee: boolean; blockBase: number; hpMult: number }
export const BASE_ATTR: Attrs = { str: 5, vit: 5, dex: 5, int: 5, wil: 5, sta: 5, agi: 5, luk: 5, mag: 5 };
const a = (o: Partial<Attrs>): Attrs => ({ ...BASE_ATTR, ...o });
export const CLASS_BASE: Record<ClassId, ClassBase> = {
  dark_mage:    { attrs: a({ int: 9, wil: 7, mag: 8 }), atkAttr: ['int','mag'], res: 'Mana', resMax: 100, resRegen: 3, melee: false, blockBase: 0, hpMult: .85 },
  light_mage:   { attrs: a({ mag: 10, wil: 8, int: 7 }), atkAttr: ['mag','int'], res: 'Mana', resMax: 110, resRegen: 3.2, melee: false, blockBase: 0, hpMult: .9 },
  archer:       { attrs: a({ dex: 11, agi: 8, luk: 7 }), atkAttr: ['dex'], res: 'Fokus', resMax: 100, resRegen: 5, melee: false, blockBase: 0, hpMult: .95 },
  shield_sword: { attrs: a({ str: 9, sta: 9, vit: 7 }), atkAttr: ['str'], res: 'Ausdauer', resMax: 100, resRegen: 4, melee: true, blockBase: 12, hpMult: 1.15 },
  dual_sword:   { attrs: a({ dex: 9, agi: 10, str: 7, luk: 6 }), atkAttr: ['dex','str'], res: 'Energie', resMax: 100, resRegen: 6, melee: true, blockBase: 0, hpMult: 1 },
  healer:       { attrs: a({ wil: 11, mag: 8, int: 6 }), atkAttr: ['wil','mag'], res: 'Mana', resMax: 130, resRegen: 4, melee: false, blockBase: 0, hpMult: .95 },
  summoner:     { attrs: a({ int: 8, wil: 9, mag: 9 }), atkAttr: ['int','wil'], res: 'Seelenkraft', resMax: 120, resRegen: 3.5, melee: false, blockBase: 0, hpMult: .9 },
  tank:         { attrs: a({ sta: 11, vit: 10, str: 7 }), atkAttr: ['str'], res: 'Wut', resMax: 100, resRegen: 0, melee: true, blockBase: 18, hpMult: 1.4 },
};
export interface Derived { maxHp: number; maxRes: number; atk: number; matk: number; def: number; mdef: number; crit: number; critDmg: number; dodge: number; block: number; atkMs: number; healPow: number; speed: number; resRegen: number }
export interface GearSum { atk: number; def: number; mdef: number; hp: number; res: number; attrs: Partial<Attrs> }
export function gearOf(eq: Partial<Record<string, ItemInst>>, defs: (id: string) => any): GearSum {
  const g: GearSum = { atk: 0, def: 0, mdef: 0, hp: 0, res: 0, attrs: {} };
  for (const it of Object.values(eq)) {
    if (!it) continue; const d = defs(it.id); if (!d) continue; const m = RARITY_MULT[it.rar];
    const wear = it.dur !== undefined && it.dur <= 0 ? 0.3 : 1;
    g.atk += (d.atk || 0) * m * wear; g.def += (d.def || 0) * m * wear; g.mdef += (d.mdef || 0) * m * wear; g.hp += (d.hp || 0) * m; g.res += (d.res || 0) * m;
    if (d.attrs) for (const k in d.attrs) g.attrs[k as Attr] = (g.attrs[k as Attr] || 0) + Math.round(d.attrs[k] * m);
  }
  return g;
}
export function derive(cls: ClassId, level: number, attrs: Attrs, gear: GearSum, prestige = 0, mods: { atkPct?: number; defPct?: number; critAdd?: number; dodgeAdd?: number; speedPct?: number; hpPct?: number } = {}): Derived {
  const cb = CLASS_BASE[cls]; const A = (k: Attr) => attrs[k] + (gear.attrs[k] || 0);
  const pm = 1 + prestige * BAL.prestigePerRankStat;
  const pri = cb.atkAttr.reduce((s, k, i) => s + A(k) * (i === 0 ? 1 : .6), 0);
  const isMagic = cb.atkAttr.some(k => ['int','mag'].includes(k)) && ['dark_mage','light_mage','summoner','healer'].includes(cls);
  const raw = (4 + level + pri * 2.2 + gear.atk) * pm * (1 + (mods.atkPct || 0));
  return {
    maxHp: Math.floor((100 + A('vit') * 12 + level * 20 + gear.hp) * cb.hpMult * pm * (1 + (mods.hpPct || 0))),
    maxRes: Math.floor(cb.resMax + A('wil') * 2 + gear.res), atk: isMagic ? raw * .5 : raw, matk: isMagic ? raw : raw * .4,
    def: (A('sta') * 1.5 + gear.def) * pm * (1 + (mods.defPct || 0)), mdef: (A('wil') * 1.2 + A('mag') * .4 + gear.mdef) * pm * (1 + (mods.defPct || 0)),
    crit: Math.min(60, BAL.critBase + A('luk') * .3 + A('dex') * .1 + (mods.critAdd || 0)), critDmg: BAL.critDmg + A('luk') * .004,
    dodge: Math.min(40, A('agi') * .25 + (mods.dodgeAdd || 0)), block: cb.blockBase ? Math.min(50, cb.blockBase + A('sta') * .2) : 0,
    atkMs: Math.max(500, BAL.baseAtkMs / (1 + A('agi') * .004) / (1 + (mods.speedPct || 0))), healPow: (A('wil') * 1.4 + A('mag') * 1.1 + level + gear.atk * .5) * pm,
    speed: BAL.moveSpeed, resRegen: cb.resRegen * (1 + A('wil') * .01),
  };
}
/** Normalisierte PvP-Attribute: identische Verteilung je Klasse, Ausrüstung zählt nicht. */
export function pvpAttrs(cls: ClassId): Attrs {
  const cb = CLASS_BASE[cls]; const pts = Math.floor(BAL.pvpNormLevel * BAL.pvpPointsPerLevel); const o = { ...cb.attrs };
  const main = cb.atkAttr[0]; o[main] += Math.floor(pts * .45); o.vit += Math.floor(pts * .25); o.sta += Math.floor(pts * .2); o.agi += Math.floor(pts * .1); return o;
}
export const pvpGear = (): GearSum => ({ atk: 4 + BAL.pvpNormLevel * 1.9, def: 3 + BAL.pvpNormLevel * 1.5, mdef: 3 + BAL.pvpNormLevel * 1.5, hp: 400, res: 0, attrs: {} });
export function mitig(def: number, attackerLevel: number) { return def / (def + BAL.mitigK + BAL.mitigLv * attackerLevel); }

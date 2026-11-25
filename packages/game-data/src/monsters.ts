import type { Family } from '@nam/shared';
import { expToNext } from '@nam/shared';
export interface MobSkill { k: 'heavy'|'aoe'|'heal'|'summon'|'enrage'|'stun'|'poison'; every: number; pow: number }
export interface MobDef { id: string; name: string; fam: Family; lvl: number; role: 'normal'|'elite'|'boss'; hp: number; atk: number; def: number; exp: number; gold: [number, number]; art: { kind: string; color: string; scale: number }; skills: MobSkill[]; phases?: { hp: number; skills: MobSkill[]; text: string }[]; res: Record<string, number>; drops: { id: string; p: number; min?: number; max?: number; rar?: number }[]; respawn: number; speed: number; aggro: number }
export const MOBS: Record<string, MobDef> = {};
const ROLE = { normal: { hp: 1, atk: 1, exp: 1, gold: 1 }, elite: { hp: 4, atk: 1.5, exp: 4, gold: 3 }, boss: { hp: 45, atk: 2.2, exp: 60, gold: 40 } };
const tierOf = (l: number) => Math.min(9, Math.floor(l / 10));
function M(id: string, name: string, fam: Family, lvl: number, role: MobDef['role'], kind: string, color: string, o: { scale?: number; skills?: MobSkill[]; phases?: MobDef['phases']; res?: Record<string, number>; drop?: string[]; aggro?: number } = {}) {
  const r = ROLE[role], t = tierOf(lvl);
  const drops: MobDef['drops'] = [];
  const d = o.drop || [];
  if (fam === 'beast') drops.push({ id: 'm_meat', p: .6, min: 1, max: 2 }, { id: `m_hide_${t}`, p: .5 }, { id: `m_fiber_${t}`, p: .25 });
  if (fam === 'demon' || fam === 'magic') drops.push({ id: `m_ess_${t}`, p: .45 }, { id: `m_gem_${t}`, p: .12 });
  if (fam === 'human') drops.push({ id: `pot_hp_${t}`, p: .25 }, { id: `m_fiber_${t}`, p: .3 });
  if (fam === 'robot') drops.push({ id: 'm_scrap', p: .7, min: 1, max: 3 }, { id: `m_ore_${t}`, p: .25 }, { id: `m_gem_${t}`, p: .08 });
  drops.push({ id: `pot_hp_${t}`, p: .08 }, { id: `pot_mp_${t}`, p: .06 });
  for (const x of d) drops.push({ id: x, p: .05 });
  const gearP = role === 'normal' ? .06 : role === 'elite' ? .35 : 1;
  for (const slot of ['weapon', 'head', 'chest', 'legs', 'boots', 'gloves', 'ring', 'amulet']) drops.push({ id: `@gear:${slot}:${t}`, p: gearP / 8 * (slot === 'weapon' ? 1.5 : 1) * (role === 'boss' ? 4 : 1), rar: role === 'boss' ? 2 : role === 'elite' ? 1 : 0 });
  drops.push({ id: '@egg', p: role === 'normal' ? .01 : role === 'elite' ? .06 : .25 });
  if (role === 'boss') drops.push({ id: 'reset_stone', p: .08 }, { id: `tome_${t}`, p: .6 });
  const kills = 12 + lvl * .3;
  MOBS[id] = { id, name, fam, lvl, role, hp: Math.round(22 * Math.pow(lvl, 1.3) * r.hp + 20), atk: Math.round((5 + lvl * 1.6) * r.atk), def: Math.round(lvl * 1.3), exp: Math.max(3, Math.round(expToNext(lvl) / kills * r.exp)), gold: [Math.round((2 + lvl * 1.4) * r.gold), Math.round((5 + lvl * 2.4) * r.gold)],
    art: { kind, color, scale: o.scale ?? (role === 'boss' ? 2.2 : role === 'elite' ? 1.35 : 1) }, skills: o.skills || (role === 'normal' ? [] : [{ k: 'heavy', every: 7, pow: 2 }]), phases: o.phases, res: o.res || {}, drops, respawn: role === 'boss' ? 300 : role === 'elite' ? 90 : 25, speed: 8, aggro: o.aggro ?? (fam === 'beast' || role !== 'normal' ? 30 : 18) };
}
const H = (k: MobSkill['k'], every: number, pow: number): MobSkill => ({ k, every, pow });
M('rat','Mutierte Ratte','beast',1,'normal','rat','#8a7a6a'); M('stray','Tollwütiger Streuner','beast',2,'normal','wolf','#a09080'); M('pigeon','Mutationstaube','beast',3,'normal','bird','#7a8a9a'); M('boarlet','Parkkeiler','beast',4,'normal','boar','#8a5a3a');
M('alpha_rat','Rattenkönig','beast',6,'elite','rat','#6a5a4a',{ skills: [H('heavy',6,2),H('summon',12,1)] });
M('wolf','Waldwolf','beast',7,'normal','wolf','#6f7a8a'); M('spider','Glimmerspinne','beast',8,'normal','spider','#5a9a6a',{ skills: [H('poison',8,1)] }); M('sprite','Irrlicht','magic',9,'normal','wisp','#7fe0ff'); M('treant','Wurzelwächter','magic',11,'normal','golem','#4a7a3a'); M('bear','Mutierter Bär','beast',12,'normal','bear','#6a4a3a');
M('elder_stag','Alter Hirsch','magic',13,'elite','drake','#7fffb0',{ skills: [H('heavy',6,2),H('heal',14,.15)] });
M('bandit','Straßenräuber','human',14,'normal','thug','#8a6a5a'); M('mtn_wolf','Eisenzahnwolf','beast',16,'normal','wolf','#9aa6b6'); M('harpy','Sturmharpyie','magic',18,'normal','bird','#a07ae0'); M('yeti','Bergtroll','beast',20,'normal','bear','#e8f0ff'); M('gang_boss','Räuberhauptmann Kolk','human',22,'elite','soldier','#a05a3a',{ skills: [H('heavy',5,2),H('aoe',10,1.2)] });
M('junk_drone','Schrottdrohne','robot',13,'normal','drone','#8a96a8'); M('welder','Schweißbot','robot',16,'normal','bot','#d08a3a'); M('sentry','Wachturm-KI','robot',20,'normal','turret','#9aa0b0'); M('scrap_mech','Schrott-Mech','robot',22,'elite','mech','#7a828f',{ skills: [H('heavy',6,2),H('aoe',9,1.2)] });
M('dock_thug','Hafenschläger','human',21,'normal','thug','#6a7a8a'); M('smuggler','Schmugglerin','human',24,'normal','assassin','#5a4a7a'); M('cultist','Kultist','human',26,'normal','cultist','#7a2a4a',{ skills: [H('poison',9,1)] });
M('imp','Ruinen-Imp','demon',23,'normal','imp','#ff5a3a'); M('hellhound','Höllenhund','demon',26,'normal','hound','#c03a2a'); M('fiend','Aschekrieger','demon',29,'normal','fiend','#8a2a2a'); M('demon_elite','Blutritter Varok','demon',30,'elite','demon','#a0102a',{ skills: [H('heavy',5,2.2),H('aoe',9,1.3),H('enrage',20,.3)] });
M('azgoroth','Fürst Azgoroth','demon',40,'boss','demon','#ff2a3a',{ skills: [H('heavy',5,2),H('aoe',10,1.2)], phases: [{ hp: .66, text: 'Azgoroth entfesselt Höllenfeuer!', skills: [H('heavy',5,2.2),H('aoe',7,1.4),H('summon',15,1)] }, { hp: .33, text: 'Azgoroth tobt vor Wut!', skills: [H('heavy',4,2.5),H('aoe',5,1.6),H('enrage',12,.4)] }] });
M('krater_bot','Kratergänger','robot',28,'normal','bot','#4ad0ff'); M('laser','Laserwache','robot',31,'normal','turret','#ff4a6a'); M('hunter','Jäger-Drohne','robot',34,'normal','drone','#c0ff4a');
M('omega','Omega-Prime','robot',36,'boss','mech','#35e0ff',{ skills: [H('heavy',5,2),H('aoe',8,1.2)], phases: [{ hp: .66, text: 'Omega-Prime schaltet auf Kampfmodus!', skills: [H('heavy',4,2.3),H('aoe',6,1.4),H('stun',12,.8)] }, { hp: .3, text: 'Omega-Prime überhitzt!', skills: [H('heavy',3,2.6),H('aoe',4,1.6),H('enrage',10,.4)] }] });
M('arc_golem','Arkaner Golem','magic',40,'normal','golem','#8f8cff'); M('academy_ghost','Akademiegeist','magic',42,'normal','wraith','#c0c8ff'); M('moor_witch','Moorhexe','human',46,'normal','cultist','#6a8a4a',{ skills: [H('poison',7,1.2)] }); M('moor_wraith','Moorphantom','magic',49,'normal','wraith','#5a6a8a'); M('moor_lord','Schattenlord Mor','magic',52,'elite','wraith','#4a3a8a',{ skills: [H('heavy',5,2.2),H('aoe',8,1.3)] });
M('sky_knight','Himmelsritter','human',62,'normal','soldier','#e0e8ff'); M('storm_elem','Sturmelementar','magic',66,'normal','elemental','#6ad0ff'); M('angel_guard','Gefallener Wächter','demon',72,'normal','fiend','#ffd0a0'); M('sky_drake','Himmelsdrache','magic',74,'elite','dragon','#8ad0ff',{ skills: [H('heavy',5,2.2),H('aoe',7,1.4)] });
M('seraph','Seraph Valkyr','magic',75,'boss','seraph','#ffe27a',{ skills: [H('heavy',5,2),H('aoe',9,1.3)], phases: [{ hp: .66, text: 'Valkyr ruft das Himmelslicht!', skills: [H('heavy',4,2.3),H('aoe',6,1.5),H('heal',16,.1)] }, { hp: .33, text: 'Valkyr entfaltet ihre wahre Gestalt!', skills: [H('heavy',3,2.6),H('aoe',4,1.8),H('enrage',10,.4)] }] });
M('void_spawn','Leerenbrut','magic',82,'normal','wraith','#9a30ff'); M('void_knight','Leerenritter','demon',88,'normal','fiend','#5a20a0'); M('void_titan','Leerentitan','magic',92,'elite','titan','#7a30ff',{ skills: [H('heavy',4,2.4),H('aoe',7,1.5)] });
M('voidheart','Das Void-Herz','magic',100,'boss','voidheart','#b05cff',{ skills: [H('heavy',4,2.2),H('aoe',8,1.3)], phases: [{ hp: .75, text: 'Das Herz pulsiert – Leerenbrut erscheint!', skills: [H('heavy',4,2.4),H('aoe',6,1.5),H('summon',14,1)] }, { hp: .5, text: 'Die Realität bricht!', skills: [H('heavy',3,2.6),H('aoe',5,1.7),H('stun',10,.8)] }, { hp: .25, text: 'DAS HERZ SCHLÄGT ZUM LETZTEN MAL!', skills: [H('heavy',3,3),H('aoe',3,2),H('enrage',8,.5)] }] });
export const EGG_SPECIES_BY_FAMILY: Record<string, string[]> = { beast: ['rat','fox','owl','cat','wolfpup','boarlet'], demon: ['drakelet','phoenixling'], human: ['cat','fox'], robot: ['botling'], magic: ['sprite','golemling','slime'], elite: ['drakelet'], boss: ['phoenixling','drakelet'] };

import { ITEMS, TIERS, tierLvl, WEAPON_NAME } from './items';
import { CLASS_IDS } from '@nam/shared';
import { FURNITURE } from './furniture';
export interface ProfDef { id: string; name: string; kind: 'gather'|'craft'; desc: string; color: string; tool?: string }
export const PROFS: ProfDef[] = [
  { id: 'mining', name: 'Bergbau', kind: 'gather', desc: 'Erz und Edelsteine aus Adern schürfen.', color: '#b0b7c0', tool: 'pickaxe' },
  { id: 'herbalism', name: 'Kräuterkunde', kind: 'gather', desc: 'Heilkräuter und Pilze sammeln.', color: '#5ee06a', tool: 'sickle' },
  { id: 'woodcutting', name: 'Holzfällen', kind: 'gather', desc: 'Bäume fällen und Holz gewinnen.', color: '#a67c52', tool: 'axe' },
  { id: 'smithing', name: 'Schmieden', kind: 'craft', desc: 'Barren, Waffen, Rüstungen und Werkzeuge.', color: '#ff8a3d' },
  { id: 'tailoring', name: 'Schneiderei', kind: 'craft', desc: 'Leder, Stoffe und leichte Rüstungen.', color: '#c46cff' },
  { id: 'alchemy', name: 'Alchemie', kind: 'craft', desc: 'Tränke und Elixiere brauen.', color: '#4aa8ff' },
  { id: 'engineering', name: 'Ingenieurskunst', kind: 'craft', desc: 'Sprengsätze, Reparaturkits und Reittiere.', color: '#35e0ff' },
  { id: 'cooking', name: 'Kochen', kind: 'craft', desc: 'Gerichte mit Kampfboni.', color: '#ffb02e' },
  { id: 'building', name: 'Bauwesen', kind: 'craft', desc: 'Bretter und Möbel für dein Zuhause.', color: '#8bd36b' },
  { id: 'husbandry', name: 'Tierzucht', kind: 'craft', desc: 'Futter, Eier und Pet-Pflege.', color: '#ff7aa8' },
];
export interface Recipe { id: string; prof: string; lvl: number; name: string; in: { id: string; n: number }[]; out: { id: string; n: number }; sec: number; exp: number; tier: number }
export const RECIPES: Record<string, Recipe> = {};
const R = (prof: string, tier: number, out: string, n: number, inn: [string, number][], lvlOff = 0, secMul = 1) => {
  const o = ITEMS[out]; const id = `r_${out}`; const lv = Math.max(1, tierLvl(tier) + lvlOff);
  RECIPES[id] = { id, prof, lvl: lv, name: o?.name || out, in: inn.map(([i, c]) => ({ id: i, n: c })), out: { id: out, n }, sec: Math.round((4 + tier * 3) * secMul), exp: Math.round((6 + tier * 9) * (1 + lvlOff / 20)), tier };
};
for (let t = 0; t < 10; t++) {
  R('smithing', t, `i_ingot_${t}`, 1, [[`m_ore_${t}`, 2]], 0, .5); R('building', t, `i_plank_${t}`, 1, [[`m_wood_${t}`, 2]], 0, .5);
  R('tailoring', t, `i_leather_${t}`, 1, [[`m_hide_${t}`, 2]], 0, .5); R('tailoring', t, `i_cloth_${t}`, 1, [[`m_fiber_${t}`, 2]], 0, .5);
  CLASS_IDS.forEach((c, i) => { const staff = ['staff','book','bow'].includes(WEAPON_NAME[c][1]); R('smithing', t, `w_${c}_${t}`, 1, staff ? [[`i_plank_${t}`, 3], [`m_gem_${t}`, 1], [`i_ingot_${t}`, 1]] : [[`i_ingot_${t}`, 5], [`i_leather_${t}`, 1]], 2 + (i % 4), 2); });
  for (const [slot, w] of [['head', 2], ['chest', 5], ['legs', 4], ['boots', 2], ['gloves', 2]] as const) {
    R('smithing', t, `a_${slot}_plate_${t}`, 1, [[`i_ingot_${t}`, w], [`i_leather_${t}`, 1]], 3, 1.6); R('tailoring', t, `a_${slot}_cloth_${t}`, 1, [[`i_cloth_${t}`, w], [`m_ess_${t}`, 1]], 3, 1.6);
  }
  R('smithing', t, `r_ring_${t}`, 1, [[`i_ingot_${t}`, 2], [`m_gem_${t}`, 2]], 4, 1.5); R('tailoring', t, `r_amulet_${t}`, 1, [[`i_cloth_${t}`, 2], [`m_gem_${t}`, 2]], 4, 1.5);
  R('smithing', t, `t_pick_${t}`, 1, [[`i_ingot_${t}`, 3], [`i_plank_${t}`, 1]], 0, 1); R('smithing', t, `t_sickle_${t}`, 1, [[`i_ingot_${t}`, 2], [`i_plank_${t}`, 1]], 0, 1); R('smithing', t, `t_axe_${t}`, 1, [[`i_ingot_${t}`, 3], [`i_plank_${t}`, 2]], 0, 1);
  R('alchemy', t, `pot_hp_${t}`, 3, [[`m_herb_${t}`, 2]], 0, .6); R('alchemy', t, `pot_mp_${t}`, 3, [[`m_herb_${t}`, 2], [`m_ess_${t}`, 1]], 1, .6);
  for (const k of ['atk', 'def', 'crit']) R('alchemy', t, `elx_${k}_${t}`, 1, [[`m_herb_${t}`, 3], [`m_ess_${t}`, 2], [`m_gem_${t}`, 1]], 5, 1.2);
  for (const k of ['atk', 'speed', 'regen']) R('cooking', t, `food_${k}_${t}`, 2, [['m_meat', 2], [`m_herb_${t}`, 1]], 0, .8);
  R('engineering', t, `bomb_${t}`, 3, [[`i_ingot_${t}`, 1], [`m_ess_${t}`, 1], ['m_scrap', 2]], 0, .8); R('engineering', t, `kit_${t}`, 2, [[`i_ingot_${t}`, 2], ['m_scrap', 3]], 2, .8);
  R('husbandry', t, `petfood_${t}`, 5, [[`m_herb_${t}`, 2], ['m_meat', 2]], 0, .5);
  R('alchemy', t, `tome_${t}`, 1, [[`m_herb_${t}`, 6], [`m_ess_${t}`, 4], [`m_gem_${t}`, 2]], 8, 3);
}
for (const f of FURNITURE) R('building', Math.min(5, Math.floor(f.price / 800)), f.id, 1, [[`i_plank_${Math.min(5, Math.floor(f.price / 800))}`, 2 + Math.floor(f.w * f.h / 2)], [`i_cloth_${Math.min(5, Math.floor(f.price / 800))}`, 1]], 0, 1);
const mounts: [string, number, [string, number][], string][] = [['mount_board', 0, [['i_ingot_0', 6], ['m_scrap', 10]], 'engineering'], ['mount_horse', 1, [['i_leather_1', 8], ['m_meat', 20], ['m_ess_1', 6]], 'husbandry'], ['mount_wolf', 3, [['i_leather_3', 12], ['m_ess_3', 10], ['m_gem_3', 4]], 'husbandry'], ['mount_drake', 6, [['i_ingot_6', 10], ['m_ess_6', 16], ['m_gem_6', 8]], 'engineering']];
for (const [id, t, inn, prof] of mounts) R(prof, t, id, 1, inn, 6, 4);
export interface NodeDef { id: string; prof: string; tier: number; name: string; yield: string; kind: 'vein'|'herb'|'tree'|'crate'; color: string }
export const NODES: Record<string, NodeDef> = {};
for (let t = 0; t < 10; t++) {
  NODES[`n_ore_${t}`] = { id: `n_ore_${t}`, prof: 'mining', tier: t, name: `${TIERS[t]}-Erzader`, yield: `m_ore_${t}`, kind: 'vein', color: '#b0b7c0' };
  NODES[`n_herb_${t}`] = { id: `n_herb_${t}`, prof: 'herbalism', tier: t, name: `${TIERS[t]}-Kräuter`, yield: `m_herb_${t}`, kind: 'herb', color: '#5ee06a' };
  NODES[`n_wood_${t}`] = { id: `n_wood_${t}`, prof: 'woodcutting', tier: t, name: `${TIERS[t]}-Baum`, yield: `m_wood_${t}`, kind: 'tree', color: '#a67c52' };
  // Kartenressourcen (Gelände): Fischschwarm (Gewässer), Schrotthaufen (Gewerbe), Kristallader (Fels), Ätherquelle (besondere Orte)
  NODES[`n_fish_${t}`] = { id: `n_fish_${t}`, prof: 'husbandry', tier: t, name: `${TIERS[t]}-Fischschwarm`, yield: 'm_fish', kind: 'herb', color: '#4aa8ff' };
  NODES[`n_scrap_${t}`] = { id: `n_scrap_${t}`, prof: 'engineering', tier: t, name: `${TIERS[t]}-Schrotthaufen`, yield: 'm_scrap', kind: 'vein', color: '#7d8791' };
  NODES[`n_gem_${t}`] = { id: `n_gem_${t}`, prof: 'mining', tier: t, name: `${TIERS[t]}-Kristallader`, yield: `m_gem_${t}`, kind: 'vein', color: '#7ad8ff' };
  NODES[`n_ess_${t}`] = { id: `n_ess_${t}`, prof: 'alchemy', tier: t, name: `${TIERS[t]}-Ätherquelle`, yield: `m_ess_${t}`, kind: 'herb', color: '#c58bff' };
  NODES[`n_crate_${t}`] = { id: `n_crate_${t}`, prof: '', tier: t, name: 'Holzkiste', yield: 'gold', kind: 'crate', color: '#c8a46a' };
}
export const profExp = (l: number) => Math.floor(50 * Math.pow(l, 1.6));

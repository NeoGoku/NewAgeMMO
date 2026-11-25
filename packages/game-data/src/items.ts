import type { ItemDef, ClassId, Slot, Attr } from '@nam/shared';
import { CLASS_IDS } from '@nam/shared';
export const TIERS = ['Alltags','Eisen','Stahl','Runen','Silber','Mondstahl','Neon','Äther','Drachen','Ur'];
export const TIER_COLORS = ['#9aa3ad','#b0b7c0','#7fa6d8','#6fd0b0','#d8dde6','#8f8cff','#35e0ff','#c06bff','#ff6b3d','#ffd34d'];
export const tierLvl = (t: number) => (t === 0 ? 1 : t * 10);
export const ITEMS: Record<string, ItemDef> = {};
const add = (d: Partial<ItemDef> & Pick<ItemDef, 'id'|'name'|'type'|'icon'>): ItemDef => {
  const full: ItemDef = { tier: 0, lvl: 1, price: 10, stack: 1, desc: '', tradable: true, ...d } as ItemDef; ITEMS[full.id] = full; return full;
};
export const WEAPON_NAME: Record<ClassId, [string, string]> = {
  dark_mage: ['Schattenstab','staff'], light_mage: ['Lichtzepter','staff'], archer: ['Langbogen','bow'], shield_sword: ['Schwert & Schild','sword'],
  dual_sword: ['Zwillingsklingen','dagger'], healer: ['Heilstab','staff'], summoner: ['Seelenfolio','book'], tank: ['Kriegshammer','hammer'] };
const ARMOR_SLOTS: [Slot, string, string, number][] = [['head','Helm','helm',.15],['chest','Brustpanzer','chest',.35],['legs','Beinschutz','legs',.25],['boots','Stiefel','boots',.12],['gloves','Handschuhe','gloves',.13]];
const CLOTH_NAME: Record<string, string> = { head: 'Kapuze', chest: 'Robe', legs: 'Hose', boots: 'Schuhe', gloves: 'Handwickel' };
const ATTR_SETS: Attr[][] = [['str','vit'],['dex','agi'],['int','mag'],['wil','sta'],['luk','dex'],['mag','wil']];
for (let t = 0; t < 10; t++) {
  const L = tierLvl(t), tn = TIERS[t], col = TIER_COLORS[t], price = Math.floor(20 * Math.pow(1.6, t) * (1 + t));
  for (const c of CLASS_IDS) add({ id: `w_${c}_${t}`, name: `${tn}-${WEAPON_NAME[c][0]}`, type: 'weapon', slot: 'weapon', cls: c, tier: t, lvl: L, atk: Math.round(4 + L * 1.9), price: price * 3, desc: `Waffe der Klasse ${c}.`, icon: { shape: WEAPON_NAME[c][1], color: col } });
  for (const [slot, nm, shape, w] of ARMOR_SLOTS) {
    const base = 3 + L * 1.5;
    add({ id: `a_${slot}_plate_${t}`, name: `${tn}-${nm}`, type: 'armor', slot, style: 'plate', tier: t, lvl: L, def: Math.round(base * w * 3), mdef: Math.round(base * w * 1.2), hp: Math.round((20 + L * 5) * w * 2), price: Math.round(price * w * 4), desc: 'Schwere Plattenrüstung.', icon: { shape, color: col } });
    add({ id: `a_${slot}_cloth_${t}`, name: `${tn}-${CLOTH_NAME[slot]}`, type: 'armor', slot, style: 'cloth', tier: t, lvl: L, def: Math.round(base * w * 1.4), mdef: Math.round(base * w * 3), hp: Math.round((10 + L * 3) * w * 2), res: Math.round((8 + L * .8) * w * 2), atk: Math.round(L * .25 * w * 2), price: Math.round(price * w * 4), desc: 'Leichte Stoffrüstung mit magischen Fasern.', icon: { shape, color: col } });
  }
  ['ring','amulet'].forEach((s, i) => { const at = ATTR_SETS[(t + i * 2) % 6]; const v = Math.round(2 + L * .35);
    add({ id: `r_${s}_${t}`, name: `${tn}-${s === 'ring' ? 'Ring' : 'Amulett'}`, type: 'accessory', slot: s as Slot, tier: t, lvl: L, attrs: { [at[0]]: v, [at[1]]: Math.round(v * .6) }, hp: Math.round(L * 3), price: price * 2, desc: 'Accessoire mit Attributsbonus.', icon: { shape: s, color: col } }); });
  const pp = Math.round(40 + L * 14);
  add({ id: `pot_hp_${t}`, name: `${tn}-Heiltrank`, type: 'consumable', tier: t, lvl: L, stack: 99, price: Math.round(8 * Math.pow(1.5, t)), use: { hp: pp * 2 }, desc: `Stellt ${pp * 2} Leben wieder her.`, icon: { shape: 'potion', color: '#ff4d5e' } });
  add({ id: `pot_mp_${t}`, name: `${tn}-Manatrank`, type: 'consumable', tier: t, lvl: L, stack: 99, price: Math.round(8 * Math.pow(1.5, t)), use: { res: Math.round(pp * .8) }, desc: 'Stellt Ressource wieder her.', icon: { shape: 'potion', color: '#4da6ff' } });
  const buffs: [string, string, string, number][] = [['atk','Kraft','#ff8a3d',.12],['def','Härte','#8fa6c0',.15],['crit','Präzision','#ffe14d',8]];
  for (const [k, nm, c2, v] of buffs) add({ id: `elx_${k}_${t}`, name: `${tn}-Elixier der ${nm}`, type: 'consumable', tier: t, lvl: L, stack: 50, price: Math.round(30 * Math.pow(1.5, t)), use: { buff: { stat: k, val: v, dur: 300 } }, desc: `+${k === 'crit' ? v + ' Krit.' : Math.round(v * 100) + '% ' + k} für 5 Min.`, icon: { shape: 'potion', color: c2 } });
  const foods: [string, string, number][] = [['atk','Kampfgericht',.08],['speed','Energieschale',.1],['regen','Heilsuppe',.5]];
  for (const [k, nm, v] of foods) add({ id: `food_${k}_${t}`, name: `${tn}-${nm}`, type: 'consumable', tier: t, lvl: L, stack: 50, price: Math.round(18 * Math.pow(1.5, t)), use: { hp: Math.round(pp * .5), buff: { stat: k, val: v, dur: 600 } }, desc: `Mahlzeit: ${k}-Bonus für 10 Min.`, icon: { shape: 'food', color: '#d9a066' } });
  const mats: [string, string, string][] = [['ore','Erz','ore'],['herb','Kraut','herb'],['wood','Holz','wood'],['hide','Haut','hide'],['fiber','Faser','fiber'],['gem','Edelstein','gem'],['ess','Essenz','essence']];
  for (const [k, nm, sh] of mats) add({ id: `m_${k}_${t}`, name: `${tn}-${nm}`, type: 'material', tier: t, lvl: L, stack: 999, price: Math.round(3 * Math.pow(1.45, t) * (k === 'gem' || k === 'ess' ? 3 : 1)), desc: 'Handwerksmaterial.', icon: { shape: sh, color: col } });
  const inter: [string, string, string][] = [['ingot','Barren','ingot'],['plank','Bretter','plank'],['leather','Leder','leather'],['cloth','Stoff','cloth']];
  for (const [k, nm, sh] of inter) add({ id: `i_${k}_${t}`, name: `${tn}-${nm}`, type: 'material', tier: t, lvl: L, stack: 999, price: Math.round(10 * Math.pow(1.45, t)), desc: 'Verarbeitetes Material.', icon: { shape: sh, color: col } });
  for (const [k, nm, tl] of [['pick','Spitzhacke','pickaxe'],['sickle','Sichel','sickle'],['axe','Axt','axe']] as const) add({ id: `t_${k}_${t}`, name: `${tn}-${nm}`, type: 'tool', tool: tl, tier: t, lvl: L, price: Math.round(60 * Math.pow(1.5, t)), desc: `Werkzeug der Stufe ${t}.`, icon: { shape: k, color: col } });
  add({ id: `bomb_${t}`, name: `${tn}-Sprengsatz`, type: 'consumable', tier: t, lvl: L, stack: 50, price: Math.round(25 * Math.pow(1.5, t)), use: { dmg: Math.round(60 + L * 12) }, desc: 'Fügt dem Ziel Flächenschaden zu.', icon: { shape: 'bomb', color: '#ff7a2d' } });
  add({ id: `kit_${t}`, name: `${tn}-Reparaturkit`, type: 'consumable', tier: t, lvl: L, stack: 50, price: Math.round(40 * Math.pow(1.5, t)), use: { repair: 100 }, desc: 'Repariert alle Ausrüstung.', icon: { shape: 'kit', color: col } });
  add({ id: `petfood_${t}`, name: `${tn}-Tierfutter`, type: 'consumable', tier: t, lvl: L, stack: 99, price: Math.round(12 * Math.pow(1.5, t)), use: { petFood: 40 + t * 30 }, desc: 'Gibt dem aktiven Pet EXP und Energie.', icon: { shape: 'food', color: '#8bd36b' } });
  add({ id: `tome_${t}`, name: `${tn}-Wissensband`, type: 'consumable', tier: t, lvl: L, stack: 20, price: Math.round(200 * Math.pow(1.7, t)), use: { trainExp: Math.round(120 * Math.pow(1.6, t)) }, desc: 'Gewährt Trainings-EXP für Zusatzattribute.', icon: { shape: 'book', color: col } });
}
add({ id: 'reset_stone', name: 'Stein der Neugeburt', type: 'consumable', stack: 5, price: 50000, use: { resetAttrs: true }, desc: 'Setzt alle verteilten Attributpunkte zurück.', icon: { shape: 'stone', color: '#ff5de0' } });
add({ id: 'm_meat', name: 'Wildfleisch', type: 'material', stack: 999, price: 4, desc: 'Frisches Fleisch.', icon: { shape: 'meat', color: '#d4604a' } });
add({ id: 'm_scrap', name: 'Schrottteile', type: 'material', stack: 999, price: 6, desc: 'Robotertrümmer.', icon: { shape: 'ingot', color: '#7d8791' } });
add({ id: 'tp_scroll', name: 'Rückkehrrolle', type: 'consumable', stack: 20, price: 150, use: { teleport: 'aurelia_plaza' }, desc: 'Teleportiert nach Aurelia.', icon: { shape: 'scroll', color: '#e8d8a0' } });
add({ id: 'q_package', name: 'Versiegeltes Paket', type: 'misc', stack: 1, price: 0, tradable: false, desc: 'Questgegenstand.', icon: { shape: 'box', color: '#c8a46a' } });
add({ id: 'q_crystal', name: 'Void-Kristall', type: 'misc', stack: 99, price: 0, tradable: false, desc: 'Questgegenstand.', icon: { shape: 'gem', color: '#b05cff' } });
add({ id: 'q_badge', name: 'Syndikat-Abzeichen', type: 'misc', stack: 99, price: 0, tradable: false, desc: 'Questgegenstand.', icon: { shape: 'ring', color: '#e05050' } });
export const MOUNTS: ItemDef[] = [
  add({ id: 'mount_board', name: 'Schwebebrett', type: 'mount', slot: 'mount', lvl: 5, price: 3000, use: { speed: .25 }, desc: 'Reisezeit −25 %.', icon: { shape: 'mount', color: '#35e0ff' } }),
  add({ id: 'mount_horse', name: 'Arkanes Ross', type: 'mount', slot: 'mount', lvl: 15, price: 12000, use: { speed: .4 }, desc: 'Reisezeit −40 %.', icon: { shape: 'mount', color: '#c8a46a' } }),
  add({ id: 'mount_wolf', name: 'Schattenwolf', type: 'mount', slot: 'mount', lvl: 35, price: 40000, use: { speed: .5 }, desc: 'Reisezeit −50 %.', icon: { shape: 'mount', color: '#7a5cff' } }),
  add({ id: 'mount_drake', name: 'Windwyvern', type: 'mount', slot: 'mount', lvl: 60, price: 150000, use: { speed: .65 }, desc: 'Reisezeit −65 %.', icon: { shape: 'mount', color: '#ffb02e' } }),
];
export const SPECIES_IDS = ['rat','fox','owl','cat','wolfpup','boarlet','sprite','golemling','drakelet','phoenixling','slime','botling'];
export const rarName = (r: number) => ['Normal','Ungewöhnlich','Selten','Episch','Legendär'][r];

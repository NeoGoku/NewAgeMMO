export * from './items'; export * from './furniture'; export * from './classes'; export * from './monsters'; export * from './professions'; export * from './world'; export * from './quests'; export * from './pets';
import { ITEMS } from './items'; import { MOBS } from './monsters'; import { LOCS, NPCS } from './world'; import { QUESTS } from './quests'; import { SPECIES } from './pets';
import { NODES, RECIPES } from './professions'; import { SKILLS } from './classes';
for (const sp of Object.values(SPECIES)) ITEMS['egg_' + sp.id] = { id: 'egg_' + sp.id, name: sp.name + '-Ei', type: 'egg', tier: 0, lvl: 1, stack: 20, price: 400, desc: 'Brüte das Ei aus – ein neues Pet schlüpft.', icon: { shape: 'egg', color: sp.color }, tradable: true, use: { hatch: sp.id } };
/** Validiert Referenzen der Spieldaten (stabile IDs). Gibt Fehlerliste zurück. */
export function validateData(): string[] {
  const e: string[] = [];
  for (const m of Object.values(MOBS)) for (const d of m.drops) if (!d.id.startsWith('@') && !ITEMS[d.id]) e.push(`mob ${m.id}: item ${d.id}`);
  for (const l of Object.values(LOCS)) { for (const s of l.spawns) if (!MOBS[s.mob]) e.push(`loc ${l.id}: mob ${s.mob}`); for (const n of l.nodes) if (!NODES[n.def]) e.push(`loc ${l.id}: node ${n.def}`); for (const k of l.links) if (!LOCS[k.to]) e.push(`loc ${l.id}: link ${k.to}`); for (const h of l.hotspots) if (h.npc && !NPCS[h.npc]) e.push(`hs ${h.id}`); }
  for (const q of Object.values(QUESTS)) { if (q.giver && !NPCS[q.giver]) e.push(`quest ${q.id}: giver ${q.giver}`); if (!NPCS[q.turnin]) e.push(`quest ${q.id}: turnin ${q.turnin}`); for (const g of q.goals) { if (g.k === 'kill' && g.t !== '*' && !MOBS[g.t]) e.push(`quest ${q.id}: mob ${g.t}`); if (g.k === 'collect' && !ITEMS[g.t]) e.push(`quest ${q.id}: item ${g.t}`); } for (const r of q.reward.items || []) if (!ITEMS[r.id]) e.push(`quest ${q.id}: reward ${r.id}`); }
  for (const r of Object.values(RECIPES)) { if (!ITEMS[r.out.id]) e.push(`recipe ${r.id}: out ${r.out.id}`); for (const i of r.in) if (!ITEMS[i.id]) e.push(`recipe ${r.id}: in ${i.id}`); }
  for (const s of Object.values(SKILLS)) if (!s.name) e.push('skill ' + s.id);
  return e;
}

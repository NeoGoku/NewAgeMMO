import { GEO_ANCHORS, RECIPES, LOCS, NODES, NPCS, placeNear, type Goal, type QuestDef } from '@nam/game-data';
import { haversine, type GeoObj, type QuestRegion } from '@nam/shared';

export const questCategory: Record<QuestDef['type'], string> = {
  main: 'Hauptgeschichte', side: 'Nebenquest', daily: 'Tagesquest',
  class: 'Klassenquest', prof: 'Berufsquest', hidden: 'Geheime Quest', event: 'Ereignis'
};
export const pinLabels = { giver: 'Questgeber', objective: 'Zielgebiet', turnin: 'Abgabe' } as const;
export type QuestPinRole = keyof typeof pinLabels;
export interface QuestPin { key: string; role: QuestPinRole; name: string; lat: number; lon: number; radius?: number; virtualOnly?: boolean }

function npcPin(id: string, role: QuestPinRole, objects: GeoObj[]): QuestPin | undefined {
  const npc = NPCS[id];
  if (!npc) return;
  const local = objects.find(o => o.k === 'npc' && o.def === id);
  const [lat, lon] = local ? [local.lat, local.lon] : placeNear(npc.loc, 'npc:' + id);
  return { key: role, role, name: npc.name, lat, lon };
}
function mapAnchor(id: string, name?: string): QuestPin | undefined {
  const anchor = GEO_ANCHORS[id];
  if (!anchor) return;
  const [lat, lon, radius] = anchor;
  return { key: 'objective', role: 'objective', name: name ?? LOCS[id].name, lat, lon, radius };
}
function objectivePin(goal: Goal, objects: GeoObj[], from?: { lat: number; lon: number }, region?: QuestRegion): QuestPin | undefined {
  if (goal.k === 'region' || goal.k === 'survey' || goal.k === 'regional_hunt' || goal.k === 'regional_gather') return region && { key: 'objective', role: 'objective', ...region, name: region.label };
  if (goal.k === 'talk') return npcPin(goal.t, 'objective', objects);
  if (goal.k === 'visit' || goal.k === 'dungeon') return mapAnchor(goal.t);
  const match = (o: GeoObj) => {
    if (goal.k === 'kill' || goal.k === 'boss') return o.k === 'mob' && (goal.t === '*' || goal.t === o.def);
    if (goal.k === 'gather') return o.k === 'node' && (goal.t === '*' || NODES[o.def]?.yield === goal.t);
    if (goal.k === 'craft') return o.k === 'station' && Object.values(RECIPES).some(r => r.out.id === goal.t && r.prof === o.def);
    return false;
  };
  const nearby = objects.filter(match);
  const best = from ? nearby.sort((a, b) => haversine(from.lat, from.lon, a.lat, a.lon) - haversine(from.lat, from.lon, b.lat, b.lon))[0] : nearby[0];
  if (best) return { key: 'objective', role: 'objective', name: best.name, lat: best.lat, lon: best.lon, radius: best.r || 150 };
  const loc = Object.values(LOCS).find(l => {
    if (goal.k === 'kill' || goal.k === 'boss') return l.spawns.some(s => goal.t === '*' || s.mob === goal.t);
    if (goal.k === 'gather') return l.nodes.some(n => goal.t === '*' || NODES[n.def]?.yield === goal.t);
    return false;
  });
  return loc ? mapAnchor(loc.id) : undefined;
}

export function questPins(q: QuestDef, progress: readonly number[], objects: GeoObj[], from?: { lat: number; lon: number }, region?: QuestRegion): QuestPin[] {
  const goal = q.goals.find((g, index) => (progress[index] ?? 0) < g.n);
  const giver = npcPin(q.giver, 'giver', objects);
  const turnin = npcPin(q.turnin, 'turnin', objects);
  let objective = goal && objectivePin(goal, objects, from, region);
  if (!objective && goal && (goal.k === 'craft' || goal.k === 'collect')) {
    const hint = NPCS[q.giver];
    if (hint) objective = mapAnchor(hint.loc);
  }
  return [giver, objective, turnin].filter((p): p is QuestPin => !!p);
}

export const distanceLabel = (m: number) => m >= 1000 ? (m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' km' : Math.round(m) + ' m';

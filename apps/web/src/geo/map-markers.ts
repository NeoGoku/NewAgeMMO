import { NPCS, QUESTS } from '@nam/game-data';
import type { GeoCoord, GeoObj } from '@nam/shared';

export const MARKER_CATEGORIES = {
  mob: { label: 'Monster', color: '#ff7482', icon: 'm4 5 4 3h8l4-3-1 11-7 4-7-4-1-11Zm4 7 2 1m6-1-2 1m-4 4h4' },
  elite: { label: 'Elitegegner', color: '#ffab69', icon: 'm12 2 8 8-8 12-8-12 8-8Zm-4 8h8m-4-4v8' },
  boss: { label: 'Weltbosse', color: '#ff77e2', icon: 'm4 7 5 4 3-7 3 7 5-4-2 11H6L4 7Zm3 14h10' },
  npc: { label: 'NPCs', color: '#ffe38d', icon: 'M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 20v-2c0-2.8 3.1-5 7-5s7 2.2 7 5v2Z' },
  questGiver: { label: 'Questgeber', color: '#ffda65', icon: 'm12 2 8 5v10l-8 5-8-5V7l8-5Zm0 5v6m0 3v1' },
  questObjective: { label: 'Questziele', color: '#80f6b2', icon: 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-3-10v3m0 14v3M2 12h3m14 0h3' },
  questTurnIn: { label: 'Questabgaben', color: '#d7a6ff', icon: 'm12 2 8 5v10l-8 5-8-5V7l8-5Zm-4 10 3 3 5-6' },
  merchant: { label: 'Händler', color: '#ffd486', icon: 'M5 9h14l2 12H3L5 9Zm4 0V6a3 3 0 1 1 6 0v3m-6 6h6' },
  craft: { label: 'Handwerk', color: '#ffa268', icon: 'm5 4 6 1 3 3 2-2 4 4-4 4-3-3-7 9-3-3 9-7-4-4Z' },
  node: { label: 'Ressourcen', color: '#76dd8e', icon: 'm4 10 4-6h8l4 6-8 10-8-10Zm0 0h16M8 4l4 16 4-16' },
  dungeon: { label: 'Dungeons', color: '#bfa0ff', icon: 'M5 21V10a7 7 0 1 1 14 0v11H5Zm4 0v-9a3 3 0 1 1 6 0v9M2 21h20' },
  teleporter: { label: 'Teleportportale', color: '#88acff', icon: 'M16 12c0 4.4-1.8 8-4 8s-4-3.6-4-8 1.8-8 4-8 4 3.6 4 8ZM2 14l4 3-4 3m20-10-4-3 4-3' },
  city: { label: 'Regionen', color: '#6fe6f8', icon: 'M3 21h18M4 18V9h4v9m2 0V3h5v15m2 0v-6h3v6M12 6h1m-1 4h1' },
  property: { label: 'Immobilien', color: '#ffd774', icon: 'm3 11 9-8 9 8m-16-1v11h14V10m-9 11v-6h4v6' },
  house: { label: 'Häuser', color: '#f7bb8f', icon: 'm3 11 9-8 9 8m-16-1v11h14V10m-9 6h4m-2-2v4' },
  guildHouse: { label: 'Gildenhäuser', color: '#f8acff', icon: 'M4 21V7h16v14H4Zm0-14V4m5 3V4m6 3V4m5 3V4m-7 9v8m-4-5 4-3 4 3' },
  territory: { label: 'Gildengebiete', color: '#d197ff', icon: 'M4 21V4m0 1 6-3 8 3v10l-8-3-6 3m0 6h7' },
  player: { label: 'Andere Spieler', color: '#9ccfff', icon: 'M11 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3-3a3 3 0 0 1 0 6M2 20v-2a6 6 0 0 1 12 0v2H2Zm15 0h5v-2a6 6 0 0 0-6-6' },
  poi: { label: 'Orte', color: '#e2eaff', icon: 'M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' },
} as const;
export type MarkerCategory = keyof typeof MARKER_CATEGORIES;
const questGivers = new Set(Object.values(QUESTS).filter(quest => quest.type !== 'hidden').map(quest => quest.giver));

export const PROPERTY_MARKER_STATUSES = {
  sale: { label: 'Kauf oder Miete verfügbar', color: '#80e697', symbol: '+' },
  own: { label: 'Dein Eigentum', color: '#85c8ff', symbol: '✓' },
  rent: { label: 'Von dir gemietet', color: '#ffe085', symbol: 'M' },
  rented: { label: 'Vermietet', color: '#b2bdcf', symbol: '×' },
  owned: { label: 'Vergeben', color: '#b2bdcf', symbol: '×' },
} as const;

export function propertyMarkerStatus(status: unknown) {
  return typeof status === 'string' && Object.hasOwn(PROPERTY_MARKER_STATUSES, status)
    ? PROPERTY_MARKER_STATUSES[status as keyof typeof PROPERTY_MARKER_STATUSES] : undefined;
}

export function propertyMarkerType(building: unknown) {
  switch (building) {
    case 'virtual_plot': return { label: 'Baugrundstück', icon: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10' };
    case 'apartments': case 'dormitory':
      return { label: 'Wohngebäude', icon: 'M5 21V3h14v18H5Zm4-14h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1m-5 6v-3h4v3' };
    case 'commercial': case 'retail': case 'office':
      return { label: 'Gewerbeimmobilie', icon: 'M5 21V10m14 11V10M4 10h16l-2-6H6l-2 6Zm4 11v-7h5v7m3-7h2m-15 7h18' };
    case 'house': case 'detached': case 'semidetached_house': case 'bungalow': case 'terrace':
      return { label: 'Haus', icon: MARKER_CATEGORIES.property.icon };
    default: return { label: 'Immobilie', icon: MARKER_CATEGORIES.property.icon };
  }
}

export function markerCategories(object: GeoObj): MarkerCategory[] {
  switch (object.k) {
    case 'mob':
      if (object.role === 'boss' || object.extra?.boss || object.extra?.rank === 'boss') return ['boss'];
      if (object.role === 'elite' || object.extra?.elite || object.extra?.rank === 'elite') return ['elite'];
      return ['mob'];
    case 'npc': {
      const npc = NPCS[object.def];
      const categories: MarkerCategory[] = [];
      if (npc?.prof) categories.push('craft');
      if (npc?.services.some(service => ['shop', 'auction', 'stall'].includes(service))) categories.push('merchant');
      if (questGivers.has(object.def)) categories.push('questGiver');
      return categories.length ? categories : ['npc'];
    }
    case 'station': return ['craft'];
    case 'house': return [object.def === 'property' ? 'property' : object.def === 'guild' ? 'guildHouse' : 'house'];
    default: return [object.k];
  }
}

export function drawMarkerIcon(category: MarkerCategory, building?: unknown) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', category === 'property' ? propertyMarkerType(building).icon : MARKER_CATEGORIES[category].icon);
  svg.append(path);
  return svg;
}

type MarkerPoint = GeoCoord & { id: string; radius: number };
type Pixel = { x: number; y: number };
type Cluster<T> = GeoCoord & { members: T[] };

export function clusterMarkers<T extends MarkerPoint>(points: readonly T[], project: (lon: number, lat: number) => Pixel, centerLon: number): Cluster<T>[] {
  type Group = Cluster<T> & { seed: T; pixels: Pixel; sumLon: number; sumLat: number };
  const groups: Group[] = [];
  const byId = (a: T, b: T) => a.id.localeCompare(b.id);
  const merge = (group: Group, members: T[], sumLon: number, sumLat: number) => {
    group.members.push(...members);
    group.sumLon += sumLon;
    group.sumLat += sumLat;
    group.lon = group.sumLon / group.members.length;
    group.lat = group.sumLat / group.members.length;
  };
  for (const point of [...points].sort(byId)) {
    // Project the copy of the world nearest the camera, including at ±180°.
    const lon = point.lon + 360 * Math.round((centerLon - point.lon) / 360);
    const pixels = project(lon, point.lat);
    const group = groups.find(other => Math.hypot(pixels.x - other.pixels.x, pixels.y - other.pixels.y) < Math.max(40, point.radius + other.seed.radius + 6));
    if (!group) {
      groups.push({ seed: point, pixels, members: [point], lat: point.lat, lon: point.lon, sumLon: lon, sumLat: point.lat });
      continue;
    }
    merge(group, [point], lon, point.lat);
  }
  // Moving a cluster to its geographic center can put it on top of another marker.
  const radius = (group: Group) => group.members.length > 1 ? 23 : group.seed.radius;
  const center = (group: Group) => group.members.length > 1 ? project(group.lon, group.lat) : group.pixels;
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const a = center(group);
    const overlap = groups.findIndex((other, j) => {
      if (j <= i) return false;
      const b = center(other);
      return Math.hypot(a.x - b.x, a.y - b.y) < radius(group) + radius(other) + 3;
    });
    if (overlap === -1) continue;
    const [other] = groups.splice(overlap, 1);
    merge(group, other.members, other.sumLon, other.sumLat);
    i = -1;
  }
  return groups.map(({ lat, lon, members }) => ({ lat, lon, members: members.sort(byId) }));
}

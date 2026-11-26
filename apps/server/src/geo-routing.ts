import { GEO, GEO_TRAVEL_MODES, geoTravelSpeed, haversine, moveToward, type Character, type GeoCoord, type GeoTravelMode, type SavedGeoTrip } from '@nam/shared';

import { coversWalkingNetwork, WalkingNetwork } from './walking-network';

const COSTING = { walk: 'pedestrian', run: 'pedestrian', bike: 'bicycle', mount: 'pedestrian', motorbike: 'motorcycle', car: 'auto' } as const;
const MAX_POINTS = 12000;
const SNAP_M = 150;
const MAX_BODY = 4e6;
const ROUTING_TIMEOUT_MS = 6000;
const between = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
export const validCoord = (p: unknown): p is GeoCoord => !!p && typeof p === 'object' && 'lat' in p && 'lon' in p &&
  between(p.lat, -85, 85) && between(p.lon, -180, 180);
export const geoDistance = (a: GeoCoord, b: GeoCoord) => haversine(a.lat, a.lon, b.lat, b.lon);
export const isTravelMode = (mode: unknown): mode is GeoTravelMode => typeof mode === 'string' &&
  Object.prototype.hasOwnProperty.call(GEO_TRAVEL_MODES, mode);

function decodeShape(shape: string): GeoCoord[] {
  const points: GeoCoord[] = [];
  let index = 0, lat = 0, lon = 0;
  function delta() {
    let value = 0, factor = 1;
    for (; factor <= 32 ** 5 && index < shape.length; factor *= 32) {
      const ch = shape.charCodeAt(index++) - 63;
      if (ch < 0 || ch > 63) break;
      value += (ch % 32) * factor;
      if (ch < 32) return value % 2 ? -(value + 1) / 2 : value / 2;
    }
    throw new Error('Ungültiger Straßenverlauf');
  }
  while (index < shape.length && points.length < MAX_POINTS) {
    lat += delta();
    lon += delta();
    const point = { lat: lat / 1e6, lon: lon / 1e6 };
    if (!validCoord(point)) throw new Error('Ungültiger Straßenverlauf');
    if (!points.length || geoDistance(points[points.length - 1], point) > 0) points.push(point);
  }
  if (index < shape.length) throw new Error('Der Straßenverlauf ist zu lang');
  return points;
}

let endpoint: URL | undefined;
let localNetwork: (() => Promise<WalkingNetwork>) | undefined;
let loadedNetwork: Promise<WalkingNetwork> | undefined;

export function configureRouting(base?: string, walkingNetwork?: () => Promise<WalkingNetwork>) {
  endpoint = undefined;
  localNetwork = walkingNetwork;
  loadedNetwork = undefined;
  if (!base?.trim()) return;
  const url = new URL(base.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Ungültige Valhalla-Basis-URL');
  }
  url.pathname = url.pathname.replace(/\/$/, '') + '/route';
  endpoint = url;
}

export function travelModes(c: Character): GeoTravelMode[] {
  const mount = c.equipment.mount?.id;
  return (Object.keys(GEO_TRAVEL_MODES) as GeoTravelMode[]).filter(mode => {
    if (mode === 'fly') return mount === 'mount_drake';
    if (mode === 'bike') return mount === 'mount_board';
    if (mode === 'mount') return !!mount && mount !== 'mount_board';
    return c.level >= GEO_TRAVEL_MODES[mode].level;
  });
}

export async function planRoute(origin: GeoCoord, target: GeoCoord, mode: GeoTravelMode, direct = false, mount?: string): Promise<{ points: GeoCoord[]; speedMps: number; direct?: true } | string> {
  const distance = geoDistance(origin, target);
  if (distance < 1) return 'Du bist bereits am Ziel';
  const limitMps = geoTravelSpeed(mode, mount);
  if (direct) {
    if (mode !== 'walk' && mode !== 'run') return 'Direkte virtuelle Bewegung ist nur zu Fuß verfügbar';
    if (distance > GEO.directTravelMaxM) return `Virtuelle Luftlinienreisen sind auf ${GEO.directTravelMaxM / 1000} km begrenzt`;
    return { points: [origin, target], speedMps: limitMps, direct: true };
  }
  if (mode === 'fly') return { points: [origin, target], speedMps: limitMps };
  if (endpoint) {
    const road = await valhallaRoute(endpoint, origin, target, mode, limitMps);
    if (typeof road !== 'string') return road;
    return await localWalk(origin, target, mode, limitMps) ?? road;
  }
  return await localWalk(origin, target, mode, limitMps) ??
    'Straßenrouting ist für dieses Gebiet oder dieses Verkehrsmittel nicht eingerichtet';
}

async function localWalk(origin: GeoCoord, target: GeoCoord, mode: GeoTravelMode, speedMps: number) {
  if (!localNetwork || (mode !== 'walk' && mode !== 'run') ||
    !coversWalkingNetwork(origin) || !coversWalkingNetwork(target)) return;
  try {
    const network = await (loadedNetwork ??= localNetwork());
    const points = network.route(origin, target);
    if (!points || points.length > MAX_POINTS || routeLength(points) < 1) {
      return 'Im Braunschweiger Gehwegenetz ist kein durchgehender Weg zu diesem Ziel verfügbar';
    }
    return { points, speedMps };
  } catch (error) {
    loadedNetwork = undefined;
    console.warn('walking_network', String(error));
  }
}

async function valhallaRoute(endpoint: URL, origin: GeoCoord, target: GeoCoord,
  mode: Exclude<GeoTravelMode, 'fly'>, limitMps: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROUTING_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, redirect: 'error',
      body: JSON.stringify({
        locations: [origin, target].map(point => ({ ...point, search_cutoff: SNAP_M })),
        costing: COSTING[mode], shape_format: 'polyline6',
        ...(mode === 'mount' ? { costing_options: { pedestrian: { step_penalty: 3600 } } } : {}),
      }),
    });
    if (Number(response.headers.get('content-length')) > MAX_BODY) return 'Der Straßenverlauf ist zu lang';
    if (response.status >= 500 || response.status === 429) return 'Der Routendienst ist derzeit nicht verfügbar';
    const body = await response.text();
    if (body.length > MAX_BODY) return 'Der Straßenverlauf ist zu lang';
    const { trip } = JSON.parse(body);
    if (!response.ok || trip?.status !== 0 || trip.legs?.length !== 1 || typeof trip.legs[0]?.shape !== 'string') {
      return 'Für dieses Ziel wurde kein erreichbarer Weg gefunden';
    }
    const points = decodeShape(trip.legs[0].shape);
    if (points.length < 2 || geoDistance(origin, points[0]) > SNAP_M || geoDistance(target, points[points.length - 1]) > SNAP_M) {
      return 'Für dieses Ziel wurde kein erreichbarer Weg gefunden';
    }
    const length = routeLength(points);
    if (length < 1) return 'Du bist bereits am Ziel';
    if (mode === 'motorbike' || mode === 'car') {
      const durationS: unknown = trip.summary?.time;
      if (!between(durationS, Number.EPSILON, Infinity)) return 'Der Routendienst lieferte keine gültige Fahrzeit';
      return { points, speedMps: Math.min(limitMps, length / durationS) };
    }
    return { points, speedMps: limitMps };
  } catch {
    return 'Der Routendienst konnte keinen Straßenverlauf laden';
  } finally {
    clearTimeout(timeout);
  }
}

const distances = new WeakMap<GeoCoord[], number[]>();

function routeDistances(points: GeoCoord[]) {
  let path = distances.get(points);
  if (path) return path;
  path = [0];
  for (let i = 1; i < points.length; i++) path.push(path[i - 1] + geoDistance(points[i - 1], points[i]));
  distances.set(points, path);
  return path;
}

export function routeLength(points: GeoCoord[]) {
  const path = routeDistances(points);
  return path[path.length - 1];
}

export function validTrip(trip: SavedGeoTrip) {
  return !!trip && typeof trip.id === 'string' && isTravelMode(trip.mode) && validCoord(trip.target) &&
    (trip.direct === undefined || (trip.direct === true && (trip.mode === 'walk' || trip.mode === 'run'))) &&
    between(trip.speedMps, Number.EPSILON, Infinity) && between(trip.progressM, 0, Infinity) &&
    (trip.startedAt === null || between(trip.startedAt, 0, Infinity)) &&
    Array.isArray(trip.points) && trip.points.length >= 2 && trip.points.length <= MAX_POINTS && trip.points.every(validCoord);
}

export function tripDistance(trip: SavedGeoTrip, time: number) {
  const elapsedS = trip.startedAt === null ? 0 : Math.max(0, time - trip.startedAt) / 1000;
  return Math.min(routeLength(trip.points), trip.progressM + elapsedS * trip.speedMps);
}

export function tripPosition(trip: SavedGeoTrip, distance: number): GeoCoord {
  const path = routeDistances(trip.points);
  let lo = 0, hi = path.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (path[mid] <= distance) lo = mid;
    else hi = mid;
  }
  const from = trip.points[lo], to = trip.points[hi];
  const { lat, lon } = moveToward(from.lat, from.lon, to.lat, to.lon, distance - path[lo]);
  return { lat, lon };
}

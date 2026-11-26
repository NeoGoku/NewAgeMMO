import { haversine, type GeoCoord } from '@nam/shared';

const SNAP_LIMIT = 150;
export const WALKING_NETWORK_MAX_BYTES = 5_000_000;
const distance = (a: GeoCoord, b: GeoCoord) => haversine(a.lat, a.lon, b.lat, b.lon);
export const coversWalkingNetwork = ({ lat, lon }: GeoCoord) =>
  lat >= 52.215 && lat <= 52.34 && lon >= 10.43 && lon <= 10.62;

function unpack(value: unknown, limit: number): unknown[] {
  if (typeof value !== 'string') return Array.isArray(value) ? value : [];
  const bytes = atob(value);
  const result: number[] = [];
  const previous = [0, 0];
  let delta = 0, factor = 1;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes.charCodeAt(i);
    delta += (b % 128) * factor;
    if (b >= 128) {
      factor *= 128;
      if (factor > 128 ** 4) throw new Error('Ungültiger Datenblock im OSM-Gehwegenetz');
      continue;
    }
    const field = result.length % 2;
    previous[field] += delta % 2 ? -(delta + 1) / 2 : delta / 2;
    result.push(previous[field]);
    if (result.length > limit) throw new Error('OSM-Gehwegenetz enthält zu viele Einträge');
    delta = 0;
    factor = 1;
  }
  if (factor !== 1) throw new Error('Unvollständiger Datenblock im OSM-Gehwegenetz');
  return result;
}

type QueueEntry = { node: number; cost: number; priority: number };
class RouteQueue {
  private readonly heap: QueueEntry[] = [];

  push(entry: QueueEntry) {
    const heap = this.heap;
    let at = heap.length;
    heap.push(entry);
    while (at > 0) {
      const parent = (at - 1) >>> 1;
      if (heap[parent].priority <= entry.priority) break;
      heap[at] = heap[parent];
      at = parent;
    }
    heap[at] = entry;
  }

  pop(): QueueEntry | undefined {
    const heap = this.heap;
    const first = heap[0];
    const tail = heap.pop();
    if (!tail || !heap.length) return first;
    let at = 0;
    while (2 * at + 1 < heap.length) {
      const left = 2 * at + 1, right = left + 1;
      const child = right < heap.length && heap[right].priority < heap[left].priority ? right : left;
      if (heap[child].priority >= tail.priority) break;
      heap[at] = heap[child];
      at = child;
    }
    heap[at] = tail;
    return first;
  }
}

export class WalkingNetwork {
  private readonly points: GeoCoord[] = [];
  private readonly edges: { to: number; meters: number }[][] = [];

  constructor(value: unknown) {
    const data = value as { version?: number; source?: string; points?: unknown; edges?: unknown } | null;
    if ((data?.version !== 1 && data?.version !== 2) || data.source !== 'OpenStreetMap') {
      throw new Error('Ungültiges OSM-Gehwegenetz');
    }
    const points = unpack(data.points, 360000), edges = unpack(data.edges, 800000);
    if (points.length < 4 || points.length > 360000 || points.length % 2 ||
      edges.length < 2 || edges.length > 800000 || edges.length % 2) throw new Error('Ungültiges OSM-Gehwegenetz');
    for (let i = 0; i < points.length; i += 2) {
      const [lat, lon] = [points[i], points[i + 1]];
      if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isInteger(lat) || !Number.isInteger(lon)) {
        throw new Error('Ungültige Koordinaten im OSM-Gehwegenetz');
      }
      const point = { lat: lat / 1e6, lon: lon / 1e6 };
      if (!coversWalkingNetwork(point)) throw new Error('Koordinaten außerhalb des OSM-Gehwegenetzes');
      this.points.push(point);
      this.edges.push([]);
    }
    for (let i = 0; i < edges.length; i += 2) {
      const [from, to] = [edges[i], edges[i + 1]];
      if (typeof from !== 'number' || typeof to !== 'number' || !Number.isInteger(from) || !Number.isInteger(to) ||
        from === to || !this.points[from] || !this.points[to]) throw new Error('Ungültige Kante im OSM-Gehwegenetz');
      this.edges[from].push({ to, meters: distance(this.points[from], this.points[to]) });
    }
  }

  private closest(point: GeoCoord) {
    let limit = SNAP_LIMIT;
    let best = -1;
    for (let i = 0; i < this.points.length; i++) {
      const meters = distance(point, this.points[i]);
      if (meters < limit) { limit = meters; best = i; }
    }
    return best;
  }

  route(origin: GeoCoord, target: GeoCoord): GeoCoord[] | undefined {
    if (!coversWalkingNetwork(origin) || !coversWalkingNetwork(target)) return;
    const start = this.closest(origin), end = this.closest(target);
    if (start === -1 || end === -1 || start === end) return;
    const costs = new Float64Array(this.points.length).fill(Infinity);
    const previous = new Int32Array(this.points.length).fill(-1);
    const open = new RouteQueue();
    costs[start] = 0;
    open.push({ node: start, cost: 0, priority: distance(this.points[start], this.points[end]) });
    for (let entry = open.pop(); entry; entry = open.pop()) {
      if (entry.cost !== costs[entry.node]) continue;
      if (entry.node === end) {
        const path: GeoCoord[] = [];
        for (let i = end; i !== -1; i = previous[i]) path.push(this.points[i]);
        return path.reverse();
      }
      for (const { to, meters } of this.edges[entry.node]) {
        const cost = entry.cost + meters;
        if (cost >= costs[to]) continue;
        previous[to] = entry.node;
        costs[to] = cost;
        open.push({ node: to, cost, priority: cost + distance(this.points[to], this.points[end]) });
      }
    }
  }
}

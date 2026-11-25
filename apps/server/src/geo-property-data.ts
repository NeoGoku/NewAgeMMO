import { BAL, GEO, PROPERTY_SOURCE, PROPERTY_REGION, PROPERTY_BOUNDS, R_EARTH, haversine, rad, residentialBuilding, validPropertyFootprint, type GeoObj, type GeoPropertyBuilding } from '@nam/shared';

export const PROPERTY_CATALOG_MAX_BYTES = 4 * 1024 * 1024;
const MAX_FEATURES = 1000;
const MAX_NEARBY = 32;

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const [south, west, north, east] = PROPERTY_BOUNDS;
const metersPerDegLat = R_EARTH * rad(1);
const metersPerDegLon = metersPerDegLat * Math.cos(rad((south + north) / 2));
const rounded = (n: number) => Number(n.toFixed(7));

function ring(input: [number, number][]) {
  const points = input.map(([lon, lat]) => [(lon - west) * metersPerDegLon, (lat - south) * metersPerDegLat]);
  let crossSum = 0, momentY = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    const cross = ax * by - bx * ay;
    crossSum += cross;
    momentY += (ay + by) * cross;
  }
  if (Math.abs(crossSum) < 1) return;
  return { area: Math.abs(crossSum) / 2, y: momentY / (3 * crossSum), points };
}

function polygon(input: [number, number][][]) {
  const outer = ring(input[0]);
  if (!outer) return;
  let { area } = outer;
  const rings = [outer.points];
  for (const inner of input.slice(1)) {
    const hole = ring(inner);
    if (!hole) return;
    area -= hole.area;
    rings.push(hole.points);
  }
  if (area <= 0) return;
  // A scan line gives a point in the footprint even for courtyards and concave outlines.
  const intersections: number[] = [];
  const y = outer.y + .000001;
  for (const points of rings) {
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1], [bx, by] = points[i];
      if ((ay > y) !== (by > y)) intersections.push(ax + (bx - ax) * (y - ay) / (by - ay));
    }
  }
  intersections.sort((a, b) => a - b);
  let best = 0, [x, anchorY] = outer.points[0];
  for (let i = 0; i + 1 < intersections.length; i += 2) {
    const width = intersections[i + 1] - intersections[i];
    if (width <= best) continue;
    best = width;
    x = (intersections[i + 1] + intersections[i]) / 2;
    anchorY = y;
  }
  return { area, lat: rounded(south + anchorY / metersPerDegLat), lon: rounded(west + x / metersPerDegLon) };
}

function parseBuilding(raw: unknown): GeoPropertyBuilding | undefined {
  if (!record(raw) || raw.type !== 'Feature' || !record(raw.properties) || !record(raw.geometry)) return;
  const osmId = raw.id ?? raw.properties['@id'];
  if (typeof osmId !== 'string' || !/^(way|relation)\/[1-9]\d{0,14}$/.test(osmId)) return;
  const building = raw.properties.building;
  if (!residentialBuilding(building)) return;
  const { type, coordinates } = raw.geometry;
  const footprint = { type, coordinates };
  if (!validPropertyFootprint(footprint)) return;
  const parts = footprint.type === 'Polygon' ? [footprint.coordinates] : footprint.coordinates;
  const outlines = parts.map(polygon);
  if (outlines.some(outline => !outline)) return;
  const areas = outlines.filter(outline => outline !== undefined).sort((a, b) => b.area - a.area);
  const footprintM2 = Math.round(areas.reduce((total, outline) => total + outline.area, 0));
  if (footprintM2 < 20 || footprintM2 > 15000) return;
  const rawLevels = raw.properties['building:levels'];
  const levelsValue = typeof rawLevels === 'string' && /^\d{1,2}$/.test(rawLevels) ? Number(rawLevels) : rawLevels;
  const knownLevels = typeof levelsValue === 'number' && Number.isInteger(levelsValue) && levelsValue > 0 && levelsValue <= 60;
  const levels = knownLevels ? levelsValue : building === 'apartments' || building === 'dormitory' ? 3 : building === 'bungalow' ? 1 : 2;
  const floorAreaM2 = footprintM2 * levels;
  const estimatedRooms = Math.max(1, Math.round(floorAreaM2 / BAL.propertyM2PerRoom));
  const buyGold = Math.min(BAL.propertyMaxGold, Math.max(BAL.houseCost, Math.round(floorAreaM2 * BAL.propertyGoldPerM2 / 100) * 100));
  const { lat, lon } = areas[0];
  return { id: 'property:osm:' + osmId.replace('/', ':'), osmId, building, lat, lon, footprint, footprintM2, floorAreaM2, estimatedRooms, levels, levelsEstimated: !knownLevels, buyGold };
}

export class PropertyCatalog {
  readonly buildings = new Map<string, GeoPropertyBuilding>();
  readonly osmSnapshot?: string;

  constructor(input?: unknown) {
    if (input === undefined) return;
    if (!record(input) || input.type !== 'FeatureCollection' || input.source !== PROPERTY_SOURCE ||
      typeof input.osmSnapshot !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(input.osmSnapshot) ||
      !Number.isFinite(Date.parse(input.osmSnapshot)) || !Array.isArray(input.features) || input.features.length > MAX_FEATURES) {
      throw new Error('Ungültiger OSM-Immobilienkatalog: Region Braunschweig, FeatureCollection, Stand und Herkunft erforderlich');
    }
    this.osmSnapshot = input.osmSnapshot;
    for (const feature of input.features) {
      const building = parseBuilding(feature);
      // OSM geometries crossing the configured region and unsupported structures are excluded.
      if (!building) continue;
      if (this.buildings.has(building.id)) throw new Error('Doppeltes OSM-Gebäude: ' + building.osmId);
      this.buildings.set(building.id, building);
    }
    if (!this.buildings.size) throw new Error('OSM-Immobilienkatalog enthält keine gültigen Wohngebäude in Braunschweig');
  }

  nearby(lat: number, lon: number, radius = GEO.viewM) {
    if (lat < south - radius / metersPerDegLat || lat > north + radius / metersPerDegLat ||
      lon < west - radius / metersPerDegLon || lon > east + radius / metersPerDegLon) return [];
    return [...this.buildings.values()].map(building => ({ building, distance: haversine(lat, lon, building.lat, building.lon) }))
      .filter(entry => entry.distance <= radius).sort((a, b) => a.distance - b.distance).slice(0, MAX_NEARBY);
  }
}

let properties = new PropertyCatalog();
export const configureProperties = (input?: unknown) => { properties = new PropertyCatalog(input); };
export const propertyCatalog = () => properties;
export function propertyObjects(lat: number, lon: number, radius: number): GeoObj[] {
  return properties.nearby(lat, lon, radius).map(({ building }) => ({
    id: building.id, k: 'house', def: 'property', lat: building.lat, lon: building.lon,
    name: 'Immobilie · ' + PROPERTY_REGION,
    extra: { source: PROPERTY_SOURCE },
  }));
}

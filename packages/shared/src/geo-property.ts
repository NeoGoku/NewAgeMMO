export const PROPERTY_SOURCE = 'OpenStreetMap';
export const PROPERTY_REGION = 'Braunschweig';
export const PROPERTY_BOUNDS = [52.22, 10.455, 52.297, 10.57] as const;
export const RESIDENTIAL_BUILDINGS = ['apartments', 'detached', 'house', 'residential', 'semidetached_house', 'terrace', 'bungalow', 'dormitory'] as const;
export const residentialBuilding = (name: unknown): name is typeof RESIDENTIAL_BUILDINGS[number] =>
  RESIDENTIAL_BUILDINGS.some(building => building === name);

export interface GeoPropertyOwnership { id: string; purchaseGold: number; building: GeoPropertyBuilding }

type PropertyCoordinate = [longitude: number, latitude: number];
type PropertyPolygon = PropertyCoordinate[][];
export type GeoPropertyFootprint = { type: 'Polygon'; coordinates: PropertyPolygon } |
  { type: 'MultiPolygon'; coordinates: PropertyPolygon[] };

export interface GeoPropertyBuilding {
  id: string;
  osmId: string;
  building: typeof RESIDENTIAL_BUILDINGS[number];
  lat: number;
  lon: number;
  footprintM2: number;
  floorAreaM2: number;
  estimatedRooms: number;
  footprint: GeoPropertyFootprint;
  levels: number;
  levelsEstimated: boolean;
  buyGold: number;
}

export interface GeoPropertyOffer extends Omit<GeoPropertyBuilding, 'footprint'> {
  footprint?: GeoPropertyFootprint;
  status: 'available' | 'owned' | 'mine';
  sellGold?: number;
  houseId?: string;
  distanceM?: number;
}

export const validPropertyId = (id: unknown): id is string =>
  typeof id === 'string' && /^property:osm:(way|relation):[1-9]\d{0,14}$/.test(id);

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const positiveInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const [south, west, north, east] = PROPERTY_BOUNDS;
const inRegion = (lon: unknown, lat: unknown) =>
  typeof lat === 'number' && lat >= south && lat <= north && typeof lon === 'number' && lon >= west && lon <= east;

export function validPropertyFootprint(value: unknown): value is GeoPropertyFootprint {
  if (!record(value)) return false;
  const polygons = value.type === 'Polygon' ? [value.coordinates] : value.type === 'MultiPolygon' ? value.coordinates : null;
  if (!Array.isArray(polygons) || !polygons.length || polygons.length > 20) return false;
  let vertices = 0;
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !polygon.length || polygon.length > 40) return false;
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4 || (vertices += ring.length) > 512 ||
        !ring.every(pt => Array.isArray(pt) && pt.length === 2 && inRegion(pt[0], pt[1]))) return false;
      const first = ring[0], last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) return false;
    }
  }
  return true;
}

export function validPropertyOwnership(value: unknown): value is GeoPropertyOwnership {
  if (!record(value) || !validPropertyId(value.id) || !positiveInt(value.purchaseGold) || !record(value.building)) return false;
  const building = value.building;
  return building.id === value.id && building.osmId === value.id.slice('property:osm:'.length).replace(':', '/') &&
    residentialBuilding(building.building) && positiveInt(building.footprintM2) && positiveInt(building.levels) &&
    building.floorAreaM2 === building.footprintM2 * building.levels && positiveInt(building.estimatedRooms) &&
    typeof building.levelsEstimated === 'boolean' && building.buyGold === value.purchaseGold &&
    inRegion(building.lon, building.lat) && validPropertyFootprint(building.footprint);
}

export const PROPERTY_SOURCE = 'OpenStreetMap';
export const PROPERTY_REGION = 'Braunschweig';
export const PROPERTY_BOUNDS = [52.22, 10.455, 52.297, 10.57] as const;
export const RESIDENTIAL_BUILDINGS = ['apartments', 'detached', 'house', 'residential', 'semidetached_house', 'terrace', 'bungalow', 'dormitory'] as const;
export const PROPERTY_BUILDINGS = [...RESIDENTIAL_BUILDINGS, 'commercial', 'retail', 'office'] as const;
export const supportedPropertyBuilding = (name: unknown): name is typeof PROPERTY_BUILDINGS[number] =>
  PROPERTY_BUILDINGS.some(building => building === name);

export interface GeoPropertyOwnership { id: string; purchaseGold: number; building: GeoPropertyBuilding; built?: true; /** Mietvertrag: Ablaufzeit (ms); ohne Wert = Eigentum im Spiel */ rentUntil?: number }
export const PROPERTY_RENT_DAYS = 7;
/** Spielinterne Wochenmiete (keine realen Eigentums- oder Mietrechte) */
export const propertyRentGold = (buyGold: number) => Math.max(100, Math.round(buyGold * .05 / 10) * 10);
export const VIRTUAL_PLOT = 'virtual_plot' as const;
export const PROPERTY_BUILD_COST = 3500;

type PropertyCoordinate = [longitude: number, latitude: number];
type PropertyPolygon = PropertyCoordinate[][];
export type GeoPropertyFootprint = { type: 'Polygon'; coordinates: PropertyPolygon } |
  { type: 'MultiPolygon'; coordinates: PropertyPolygon[] };

export interface GeoPropertyBuilding {
  id: string;
  osmId: string;
  building: typeof PROPERTY_BUILDINGS[number] | typeof VIRTUAL_PLOT;
  lat: number;
  lon: number;
  footprintM2: number;
  floorAreaM2: number;
  estimatedRooms: number;
  unitAreaM2?: number;
  footprint: GeoPropertyFootprint;
  levels: number;
  levelsEstimated: boolean;
  buyGold: number;
}

export interface GeoPropertyOffer extends Omit<GeoPropertyBuilding, 'footprint'> {
  footprint?: GeoPropertyFootprint;
  status: 'available' | 'owned' | 'mine';
  sellGold?: number;
  /** Wochenmiete in Gold (nicht für Baugrundstücke) */
  rentGold?: number;
  rentUntil?: number;
  rentOverdue?: boolean;
  houseId?: string;
  buildGold?: number;
  usableAreaEstimateM2?: number;
  distanceM?: number;
}

export const validPropertyId = (id: unknown): id is string =>
  typeof id === 'string' && /^property:osm:(way|relation):[1-9]\d{0,14}$/.test(id);

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const positiveInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const validPosition = (lon: unknown, lat: unknown) =>
  typeof lat === 'number' && lat >= -85 && lat <= 85 && typeof lon === 'number' && lon >= -180 && lon <= 180;

export function validPropertyFootprint(value: unknown): value is GeoPropertyFootprint {
  if (!record(value)) return false;
  const polygons = value.type === 'Polygon' ? [value.coordinates] : value.type === 'MultiPolygon' ? value.coordinates : null;
  if (!Array.isArray(polygons) || !polygons.length || polygons.length > 20) return false;
  let vertices = 0;
  let south = 85, west = 180, north = -85, east = -180;
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !polygon.length || polygon.length > 40) return false;
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4 || (vertices += ring.length) > 512 ||
        !ring.every(pt => Array.isArray(pt) && pt.length === 2 && validPosition(pt[0], pt[1]))) return false;
      for (const [lon, lat] of ring) {
        south = Math.min(south, lat);
        west = Math.min(west, lon);
        north = Math.max(north, lat);
        east = Math.max(east, lon);
      }
      const first = ring[0], last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) return false;
    }
  }
  return north - south <= .03 && east - west <= .15;
}

export function validPropertyOwnership(value: unknown): value is GeoPropertyOwnership {
  if (!record(value) || !validPropertyId(value.id) || !positiveInt(value.purchaseGold) || !record(value.building)) return false;
  const building = value.building;
  const plot = building.building === VIRTUAL_PLOT;
  const validArea = plot ? building.levels === 0 && building.floorAreaM2 === 0 && building.estimatedRooms === 0 :
    supportedPropertyBuilding(building.building) && positiveInt(building.levels) && positiveInt(building.estimatedRooms) &&
    building.floorAreaM2 === (building.footprintM2 as number) * building.levels;
  if (building.unitAreaM2 !== undefined && (building.building !== 'apartments' ||
    !positiveInt(building.unitAreaM2) || typeof building.floorAreaM2 !== 'number' || building.unitAreaM2 > building.floorAreaM2)) return false;
  return (value.rentUntil === undefined || (positiveInt(value.rentUntil) && !plot)) && (value.built === undefined || (value.built === true && plot)) && building.id === value.id && building.osmId === value.id.slice('property:osm:'.length).replace(':', '/') &&
    positiveInt(building.footprintM2) && validArea &&
    typeof building.levelsEstimated === 'boolean' && building.buyGold === value.purchaseGold &&
    validPosition(building.lon, building.lat) && validPropertyFootprint(building.footprint);
}

import { readFile, writeFile } from 'node:fs/promises';
import { PROPERTY_SOURCE, PROPERTY_BUILDINGS, RESIDENTIAL_BUILDINGS, validPropertyFootprint } from '@nam/shared';
import { PropertyCatalog, PROPERTY_CATALOG_MAX_BYTES } from '../apps/server/src/geo-property-data';
import { readPropertyCatalogResponse } from '../apps/server/src/property-catalog-response';

const output = process.argv[2];
if (!output || process.argv.length !== 3) {
  throw new Error('Aufruf: npx tsx scripts/import-osm-properties.ts /pfad/braunschweig.geojson');
}

const slices = {
  Innenstadt: [52.263, 10.516, 52.274, 10.535],
  Weststadt: [52.240, 10.466, 52.254, 10.490],
  ÖstlichesRinggebiet: [52.264, 10.536, 52.290, 10.557],
  Heidberg: [52.224, 10.521, 52.240, 10.542],
} as const;
const districtLimit = 330;
const minimumDistrictBuildings = 25;

type ImportFeature = {
  type: 'Feature';
  id: string;
  properties: { building?: string; 'building:levels'?: string };
  geometry: unknown;
};

function inside([south, west, north, east]: readonly number[], lat: number, lon: number) {
  return lat >= south && lat <= north && lon >= west && lon <= east;
}

async function readOverpass() {
  const endpoint = new URL(process.env.OSM_OVERPASS_URL || 'https://overpass-api.de/api/interpreter');
  if (endpoint.protocol !== 'https:') throw new Error('Der Overpass-Endpunkt muss HTTPS verwenden');
  const importSource = endpoint.origin + endpoint.pathname;
  const residential = PROPERTY_BUILDINGS.join('|');
  const districts = Object.entries(slices).map(([district, bbox]) =>
    `way["building"~"^(${residential})$"](${bbox.join(',')})->.${district};.${district} out geom ${districtLimit};`).join('');
  endpoint.searchParams.set('data', '[out:json][timeout:25][maxsize:16777216];' + districts);
  const response = await fetch(endpoint, {
    headers: { 'user-agent': 'NewAgeMMO/0.1 geographic housing snapshot (https://github.com/NeoGoku/NewAgeMMO)' },
    signal: AbortSignal.timeout(35000),
  });
  const raw = await readPropertyCatalogResponse(response) as {
    generator?: string;
    remark?: string;
    osm3s?: { copyright?: string; timestamp_osm_base?: string };
    elements?: {
      type?: string; id?: number; tags?: Record<string, string>;
      geometry?: { lat?: number; lon?: number }[];
    }[];
  };
  if (!raw || raw.remark || typeof raw.generator !== 'string' || !raw.generator.startsWith('Overpass API') ||
    typeof raw.osm3s?.copyright !== 'string' || !raw.osm3s.copyright.includes('openstreetmap.org') ||
    !raw.osm3s.copyright.includes('ODbL') || !Array.isArray(raw.elements) ||
    raw.elements.length > districtLimit * Object.keys(slices).length) {
    throw new Error('Keine vollständige Overpass-Antwort mit OpenStreetMap-Herkunft');
  }
  const features = raw.elements.flatMap((element): ImportFeature[] => {
    if (element?.type !== 'way' || !Number.isSafeInteger(element.id) || !Array.isArray(element.geometry)) return [];
    return [{
      type: 'Feature',
      id: `way/${element.id}`,
      properties: { building: element.tags?.building, 'building:levels': element.tags?.['building:levels'] },
      geometry: { type: 'Polygon', coordinates: [element.geometry.map(p => [p?.lon, p?.lat])] },
    }];
  });
  return { features, osmSnapshot: raw.osm3s.timestamp_osm_base, importSource };
}

async function readGeofabrik(filename: string) {
  const raw = JSON.parse(await readFile(filename, 'utf8')) as {
    type?: string;
    features?: {
      type?: string;
      properties?: Record<string, string | number>;
      geometry?: unknown;
    }[];
  };
  if (raw?.type !== 'FeatureCollection' || !Array.isArray(raw.features)) throw new Error('Ungültiger OSM-Extrakt');
  const candidates = raw.features.flatMap(feature => {
    const id = feature?.properties?.['@id'];
    const geometry = feature?.geometry;
    if (feature?.type !== 'Feature' || feature.properties?.['@type'] !== 'way' ||
      !Number.isSafeInteger(id) || !validPropertyFootprint(geometry)) return [];
    const building = feature.properties.building;
    const levels = feature.properties['building:levels'];
    const [lon, lat] = geometry.type === 'Polygon' ? geometry.coordinates[0][0] : geometry.coordinates[0][0][0];
    const item: ImportFeature = {
      type: 'Feature',
      id: `way/${id}`,
      properties: { building: typeof building === 'string' ? building : undefined, 'building:levels': typeof levels === 'string' ? levels : undefined },
      geometry,
    };
    return [{ item, lat, lon }];
  });
  const features = Object.values(slices).flatMap(bbox => candidates.filter(({ lat, lon }) => inside(bbox, lat, lon))
    .sort((a, b) => Number(RESIDENTIAL_BUILDINGS.some(id => a.item.properties.building === id)) -
      Number(RESIDENTIAL_BUILDINGS.some(id => b.item.properties.building === id)))
    .slice(0, districtLimit).map(({ item }) => item));
  return { features, osmSnapshot: process.env.OSM_EXTRACT_SNAPSHOT, importSource: 'https://download.geofabrik.de/europe/germany/niedersachsen.html' };
}

const extract = process.env.OSM_EXTRACT_GEOJSON;
const { features, osmSnapshot, importSource } = await (extract ? readGeofabrik(extract) : readOverpass());
const collection = {
  type: 'FeatureCollection',
  source: PROPERTY_SOURCE,
  osmSnapshot,
  attribution: '© OpenStreetMap contributors',
  sourceUrl: 'https://www.openstreetmap.org/copyright',
  license: 'https://opendatacommons.org/licenses/odbl/1-0/',
  importSource,
  features: [...new Map(features.map(feature => [feature.id, feature])).values()],
};
const catalog = new PropertyCatalog(collection);
collection.features = collection.features.filter(feature => catalog.buildings.has('property:osm:' + feature.id.replace('/', ':')));
const buildings = [...catalog.buildings.values()];
const coverage = Object.fromEntries(Object.entries(slices).map(([district, bbox]) => {
  const count = buildings.filter(({ lat, lon }) => inside(bbox, lat, lon)).length;
  if (count < minimumDistrictBuildings) throw new Error(`Zu wenige gültige Wohngebäude in ${district} (${count})`);
  return [district, count];
}));
const encoded = JSON.stringify({ ...collection, coverage }) + '\n';
if (Buffer.byteLength(encoded) > PROPERTY_CATALOG_MAX_BYTES) throw new Error('Der erzeugte Katalog überschreitet 4 MiB');
await writeFile(output, encoded, { flag: 'wx' });
console.log(`${collection.features.length} Gebäude in ${output} gespeichert (OSM-Datenstand ${catalog.osmSnapshot}, ${JSON.stringify(coverage)}).`);

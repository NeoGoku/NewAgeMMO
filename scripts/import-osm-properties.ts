import { writeFile } from 'node:fs/promises';
import { PROPERTY_SOURCE, RESIDENTIAL_BUILDINGS } from '@nam/shared';
import { PropertyCatalog, PROPERTY_CATALOG_MAX_BYTES } from '../apps/server/src/geo-property-data';
import { readPropertyCatalogResponse } from '../apps/server/src/property-catalog-response';

const output = process.argv[2];
if (!output || process.argv.length !== 3) {
  throw new Error('Aufruf: npx tsx scripts/import-osm-properties.ts /pfad/braunschweig.geojson');
}

const endpoint = new URL(process.env.OSM_OVERPASS_URL || 'https://overpass-api.de/api/interpreter');
if (endpoint.protocol !== 'https:') throw new Error('Der Overpass-Endpunkt muss HTTPS verwenden');
const slices = {
  innenstadt: '52.263,10.516,52.274,10.535',
  weststadt: '52.240,10.466,52.254,10.490',
  heidberg: '52.224,10.521,52.240,10.542',
};
const residential = RESIDENTIAL_BUILDINGS.join('|');
const districts = Object.entries(slices).map(([district, bbox]) =>
  `way["building"~"^(${residential})$"](${bbox})->.${district};.${district} out geom 330;`).join('');
const data = '[out:json][timeout:30][maxsize:16777216];' + districts;
const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'user-agent': 'NewAgeMMO/0.1 geographic housing snapshot' },
  body: new URLSearchParams({ data }),
  signal: AbortSignal.timeout(45000),
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
  !raw.osm3s.copyright.includes('ODbL') || !Array.isArray(raw.elements) || raw.elements.length > 990) {
  throw new Error('Keine vollständige Overpass-Antwort mit OpenStreetMap-Herkunft');
}
const features = raw.elements.flatMap(element => {
  if (element?.type !== 'way' || !Number.isSafeInteger(element.id) || !Array.isArray(element.geometry)) return [];
  return [{
    type: 'Feature',
    id: `way/${element.id}`,
    properties: { building: element.tags?.building, 'building:levels': element.tags?.['building:levels'] },
    geometry: { type: 'Polygon', coordinates: [element.geometry.map(p => [p?.lon, p?.lat])] },
  }];
});
const collection = {
  type: 'FeatureCollection',
  source: PROPERTY_SOURCE,
  osmSnapshot: raw.osm3s.timestamp_osm_base,
  features: [...new Map(features.map(feature => [feature.id, feature])).values()],
};
const catalog = new PropertyCatalog(collection);
collection.features = collection.features.filter(feature => catalog.buildings.has('property:osm:' + feature.id.replace('/', ':')));
const encoded = JSON.stringify(collection) + '\n';
if (Buffer.byteLength(encoded) > PROPERTY_CATALOG_MAX_BYTES) throw new Error('Der erzeugte Katalog überschreitet 4 MiB');
await writeFile(output, encoded, { flag: 'wx' });
console.log(`${collection.features.length} Gebäude in ${output} gespeichert (OSM-Datenstand ${catalog.osmSnapshot}).`);

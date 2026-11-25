import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import type { GeoObj } from '@nam/shared';
import { OsmPoints, OSM_POINT_LIMIT } from '../src/geo-osm';
import { OSM_REGION_LIMIT } from '../src/osm-store-pg';
import { makeStore } from '../src/store-node';

const url = process.env.DATABASE_URL;
assert(url, 'DATABASE_URL must point to a database that permits creating a test schema');
const control = new pg.Pool({ connectionString: url });
const testSchema = 'osm_cache_test_' + randomBytes(8).toString('hex');
const scopedUrl = new URL(url);
scopedUrl.searchParams.set('options', '-c search_path=' + testSchema + ',public');
const pool = new pg.Pool({ connectionString: scopedUrl.href });
let schemaCreated = false;
const area = [52.24, 10.49, 52.29, 10.56] as const;
const point = { lat: 52.2689, lon: 10.5268 };
const regionId = `${Math.floor(point.lat / .025)}:${Math.floor(point.lon / .025)}`;
const poi = (id: number, lat = point.lat, lon = point.lon): GeoObj => ({
  id: 'osm:node:' + id, k: 'poi', def: 'osm', name: 'Testpark', lat, lon,
  extra: { source: 'OpenStreetMap', category: 'Park' },
});

async function main() {
  await control.query('create schema ' + testSchema);
  schemaCreated = true;
  process.env.DATABASE_URL = scopedUrl.href;
  const store = makeStore();
  await store.init();
  const cache = store.osmCache;
  assert(cache);
  const { rows: [schema] } = await pool.query(`
    select exists (select 1 from pg_extension where extname = 'postgis') as postgis,
      to_regclass($1) is not null as spatial_index
  `, [testSchema + '.osm_points_gix']);
  assert.equal(schema.postgis, process.env.OSM_TEST_POSTGIS === '1');
  assert.equal(schema.spatial_index, schema.postgis);

  const importer = new OsmPoints('https://overpass.example/interpreter', async () => Response.json({
    elements: [{ type: 'node', id: 1, ...point, tags: { leisure: 'park', name: 'Testpark' } }],
  }), cache);
  await importer.load(point.lat, point.lon);
  assert.deepEqual((await cache.getRegion(regionId, area))?.points, [poi(1)]);

  const coldStore = makeStore();
  await coldStore.init();
  let requests = 0;
  const coldImporter = new OsmPoints('https://overpass.example/interpreter', async () => {
    requests++;
    throw new Error('offline');
  }, coldStore.osmCache);
  await coldImporter.load(point.lat, point.lon);
  assert.deepEqual(coldImporter.nearby(point.lat, point.lon, 1200), [poi(1)]);
  assert.equal(requests, 0);

  const until = Date.now() + 3600e3;
  const overlapId = '9000:1';
  await cache.putRegion(overlapId, { until, points: [poi(1), poi(1), poi(2, 52.52, 13.4)] });
  assert.deepEqual((await cache.getRegion(overlapId, area))?.points, [poi(1)]);
  assert.equal((await pool.query('select count(*)::int as n from osm_points')).rows[0].n, 2);
  assert.equal((await pool.query('select count(*)::int as n from osm_region_points where point_id = $1', [poi(1).id])).rows[0].n, 2);

  await pool.query("update osm_regions set expires_at = now() - interval '1 second' where id = $1", [overlapId]);
  assert.equal(await cache.getRegion(overlapId, area), null);
  const emptyId = '9000:2';
  await cache.putRegion(emptyId, { until, points: [] });
  assert.deepEqual((await cache.getRegion(emptyId, area))?.points, []);
  assert.equal((await pool.query('select id from osm_points where id = $1', [poi(2).id])).rowCount, 0);

  const cappedId = '9000:3';
  await cache.putRegion(cappedId, { until, points: Array.from({ length: OSM_POINT_LIMIT + 5 }, (_, i) => poi(i + 100)) });
  assert.equal((await cache.getRegion(cappedId, area))?.points.length, OSM_POINT_LIMIT);
  await cache.putRegion(cappedId, { until: until - 1, points: [] });
  assert.equal((await cache.getRegion(cappedId, area))?.points.length, OSM_POINT_LIMIT);

  await pool.query(`
    insert into osm_regions (id, expires_at)
    select '9100:' || n, now() + interval '1 hour'
    from generate_series(1, $1::int) as n
  `, [OSM_REGION_LIMIT]);
  await cache.putRegion('9000:4', { until: until + 60000, points: [poi(1)] });
  assert.equal((await pool.query('select count(*)::int as n from osm_regions')).rows[0].n, OSM_REGION_LIMIT);

  await store.put('osm_test', 'legacy', { marker: 'unchanged' });
  await store.flush();
  assert.deepEqual(await coldStore.get('osm_test', 'legacy'), { marker: 'unchanged' });
  await store.del('osm_test', 'legacy');
  console.log(`OSM cache validated on ${schema.postgis ? 'PostGIS' : 'plain PostgreSQL'}`);
}

async function cleanup() {
  await pool.end();
  if (schemaCreated) await control.query('drop schema ' + testSchema + ' cascade');
  await control.end();
}

main().then(async () => {
  await cleanup();
  process.exit(0);
}, async error => {
  console.error(error);
  await cleanup();
  process.exit(1);
});

import type { Pool, PoolClient } from 'pg';
import { OSM_POINT_LIMIT } from './geo-osm';
import type { OsmBounds, OsmCache, OsmRegion } from './store';

export const OSM_REGION_LIMIT = 512;

interface CachedRow {
  until: number;
  id: string | null;
  lat: number;
  lon: number;
  name: string;
  category: string;
}

export class PostgresOsmCache implements OsmCache {
  constructor(private readonly pool: Pool, private readonly hasPostgis: () => Promise<boolean>) {}

  async getRegion(id: string, bounds: OsmBounds): Promise<OsmRegion | null> {
    const filter = await this.hasPostgis()
      ? 'ST_Intersects(ST_SetSRID(ST_MakePoint(p.lon, p.lat), 4326), ST_MakeEnvelope($3, $2, $5, $4, 4326))'
      : 'p.lat between $2 and $4 and p.lon between $3 and $5';
    const { rows } = await this.pool.query<CachedRow>(`
      select extract(epoch from r.expires_at)::double precision * 1000 as until, points.*
      from osm_regions r
      left join lateral (
        select p.id, p.lat, p.lon, p.name, p.category
        from osm_region_points rp join osm_points p on p.id = rp.point_id
        where rp.region_id = r.id and ${filter}
        order by p.id
        limit $6
      ) points on true
      where r.id = $1 and r.expires_at > now()
    `, [id, ...bounds, OSM_POINT_LIMIT]);
    if (!rows.length) return null;
    const points = rows.flatMap(row => row.id === null ? [] : [{
      id: row.id, k: 'poi' as const, def: 'osm', lat: row.lat, lon: row.lon, name: row.name,
      extra: { source: 'OpenStreetMap', category: row.category },
    }]);
    return { until: rows[0].until, points };
  }

  async putRegion(id: string, region: OsmRegion): Promise<void> {
    const points = [...new Map(region.points.map(p => [p.id, p])).values()].slice(0, OSM_POINT_LIMIT);
    await this.write(async client => {
      const update = await client.query(`
        insert into osm_regions (id, expires_at) values ($1, $2)
        on conflict (id) do update set expires_at = excluded.expires_at
        where osm_regions.expires_at <= excluded.expires_at
      `, [id, new Date(region.until)]);
      if (!update.rowCount) return;

      await client.query('delete from osm_region_points where region_id = $1', [id]);
      if (points.length) {
        const records = points.map(p => ({ id: p.id, lat: p.lat, lon: p.lon, name: p.name, category: p.extra?.category || '' }));
        await client.query(`
          insert into osm_points (id, lat, lon, name, category)
          select id, lat, lon, name, category
          from jsonb_to_recordset($1::jsonb) as point(id text, lat double precision, lon double precision, name text, category text)
          on conflict (id) do update set lat = excluded.lat, lon = excluded.lon, name = excluded.name, category = excluded.category
        `, [JSON.stringify(records)]);
        await client.query('insert into osm_region_points (region_id, point_id) select $1, unnest($2::text[])', [id, points.map(p => p.id)]);
      }
      await this.pruneWith(client);
    });
  }

  async prune(): Promise<void> { await this.write(client => this.pruneWith(client)); }

  private async pruneWith(client: PoolClient) {
    await client.query(`
      delete from osm_regions
      where expires_at <= now() or id in (
        select id from osm_regions order by expires_at desc, id offset $1
      )
    `, [OSM_REGION_LIMIT]);
    await client.query('delete from osm_points p where not exists (select 1 from osm_region_points rp where rp.point_id = p.id)');
  }

  private async write(operation: (client: PoolClient) => Promise<void>) {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      // Separate server processes share the same cap and point membership.
      await client.query('select pg_advisory_xact_lock(1835101805, 1)');
      await operation(client);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}

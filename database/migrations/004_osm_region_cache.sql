-- Imported public OSM objects are independent of the legacy geo_objects table.
create table if not exists osm_regions (
  id text primary key,
  expires_at timestamptz not null
);
create index if not exists osm_regions_expiry_idx on osm_regions (expires_at desc, id);

create table if not exists osm_points (
  id text primary key,
  lat double precision not null check (lat between -85 and 85),
  lon double precision not null check (lon between -180 and 180),
  name text not null,
  category text not null
);
create index if not exists osm_points_lat_lon_idx on osm_points (lat, lon);

create table if not exists osm_region_points (
  region_id text not null references osm_regions(id) on delete cascade,
  point_id text not null references osm_points(id),
  primary key (region_id, point_id)
);
create index if not exists osm_region_points_point_idx on osm_region_points (point_id);

do $$ begin
  if exists (select 1 from pg_extension where extname = 'postgis') then
    create index if not exists osm_points_gix on osm_points using gist (ST_SetSRID(ST_MakePoint(lon, lat), 4326));
  end if;
end $$;

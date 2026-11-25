-- PostGIS: georäumlicher Index für Häuser/Gildenhäuser, Points of Interest und persistente Geo-Objekte.
do $$ begin
  begin create extension if not exists postgis; exception when others then raise notice 'PostGIS nicht verfügbar – Geo-Abfragen fallen auf Speicher-Scan zurück'; end;
end $$;
do $$ begin
  if exists (select 1 from pg_extension where extname = 'postgis') then
    create table if not exists geo_objects (id text primary key, kind text not null, geom geography(Point, 4326) not null, data jsonb not null default '{}', updated_at timestamptz not null default now());
    create index if not exists geo_objects_gix on geo_objects using gist (geom);
    create index if not exists geo_objects_kind on geo_objects (kind);
  else
    create table if not exists geo_objects (id text primary key, kind text not null, lat double precision not null, lon double precision not null, data jsonb not null default '{}', updated_at timestamptz not null default now());
  end if;
end $$;

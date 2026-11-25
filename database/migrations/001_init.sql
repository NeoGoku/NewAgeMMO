-- NewAgeMMO Grundschema: generischer JSONB-Dokumentenspeicher mit Indizes für Accounts, Charaktere, Gilden, Häuser, Markt.
create table if not exists docs (
  coll text not null, id text not null, data jsonb not null, updated_at timestamptz not null default now(),
  primary key (coll, id)
);
create index if not exists docs_coll_idx on docs (coll);
create index if not exists docs_char_account_idx on docs ((data->>'accountId')) where coll = 'chars';
create index if not exists docs_char_name_idx on docs (lower(data->>'name')) where coll = 'chars';
create table if not exists audit_log (id bigserial primary key, at timestamptz not null default now(), actor text, action text not null, detail jsonb);

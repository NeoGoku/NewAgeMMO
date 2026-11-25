create unique index if not exists docs_unique_char_name on docs (lower(data->>'name')) where coll = 'chars';

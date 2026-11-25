#!/usr/bin/env bash
# Backup: PostgreSQL per pg_dump, ohne DATABASE_URL Kopie des data-Ordners.  Restore: psql "$DATABASE_URL" < backup.sql
set -euo pipefail
OUT="${1:-backups}"; mkdir -p "$OUT"; TS=$(date +%Y%m%d-%H%M%S)
if [ -n "${DATABASE_URL:-}" ]; then pg_dump "$DATABASE_URL" > "$OUT/nam-$TS.sql"; else tar czf "$OUT/nam-$TS.tgz" data; fi
echo "Backup: $OUT"

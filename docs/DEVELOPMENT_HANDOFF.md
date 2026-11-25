# Handoff

- PR #1 ist in `main` gemergt. Veröffentlichung läuft über `pages.yml` und `release.yml`.
- Smartphone-Paket: Karte und Eingabe in `apps/web/src/geo`, Geo-Welt und OSM-Zugriff in `apps/server/src/geo*.ts`, Solosicherung in `apps/web/src/solo`. Die IndexedDB-Datenbank `newagemmo-solo` und der WebView-Ursprung bleiben erhalten.
- Gezielt prüfen: `npm test` (Kampf/Persistenz, GPS Braunschweig, Joystick, OSM-Fixture, Questkarten- und Backup-Tests), `npm run typecheck` und Pages-Build mit `BASE_PATH=/NewAgeMMO/`.
- Folgepaket: OSM-Regio-Cache in Migration 004, Erkundungsquest in `quests.ts` und moderierbares Online-Dashboard unter `apps/server/src/admin.ts`. Die Dokumente und die PostgreSQL-Daten bleiben kompatibel.
- Nächste Paketgrenzen: Gildengebiete, mehr geografische Questtypen, gemeinsame Dungeon-Instanzen und die ausstehenden P2-Systeme der Queue.

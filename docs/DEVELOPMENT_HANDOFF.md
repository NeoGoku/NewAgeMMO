# Handoff

- PR #1 ist in `main` gemergt. Veröffentlichung läuft über `pages.yml` und `release.yml`.
- Smartphone-Paket: Karte und Eingabe in `apps/web/src/geo`, Geo-Welt und OSM-Zugriff in `apps/server/src/geo*.ts`, Solosicherung in `apps/web/src/solo`. Die IndexedDB-Datenbank `newagemmo-solo` und der WebView-Ursprung bleiben erhalten.
- Gezielt prüfen: `npm test` (Kampf/Persistenz, GPS Braunschweig, Joystick, OSM-Fixture, Questkarten- und Backup-Tests), `npm run typecheck` und Pages-Build mit `BASE_PATH=/NewAgeMMO/`.
- Nächste offene Paketgrenzen: persistente öffentliche OSM-Geodaten in PostGIS, neue geografische Questinhalte, Gildengebiete und gemeinsame Dungeon-Instanzen. Für P2 siehe GDD und Queue.

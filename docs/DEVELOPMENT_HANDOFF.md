# Handoff

- PR #1 ist in `main` gemergt. Veröffentlichung läuft über `pages.yml` und `release.yml`.
- Smartphone-Paket: Karte und Eingabe in `apps/web/src/geo`, Geo-Welt und OSM-Zugriff in `apps/server/src/geo*.ts`, Solosicherung in `apps/web/src/solo`. Die IndexedDB-Datenbank `newagemmo-solo` und der WebView-Ursprung bleiben erhalten.
- Gezielt prüfen: `npm test` (Kampf/Persistenz, GPS Braunschweig, Joystick, OSM-Fixture, Questkarten- und Backup-Tests), `npm run typecheck` und Pages-Build mit `BASE_PATH=/NewAgeMMO/`.
- Folgepaket: OSM-Regio-Cache in Migration 004, Erkundungsquest in `quests.ts` und moderierbares Online-Dashboard unter `apps/server/src/admin.ts`. Die Dokumente und die PostgreSQL-Daten bleiben kompatibel.
- Aktueller Ausbau: Kartentypen und Styles in `map-style.ts` und `MapDesignMenu.tsx`, Valhalla und Reisen in `geo-routing.ts`/`geo.ts`, Immobilien in `geo-property*.ts`, Moderation in `admin.ts`. Routing und Immobilienkatalog sind optional zu konfigurieren, siehe Deployment.
- Nächste Paketgrenzen: Gildengebiete, mehr geografische Questtypen, gemeinsame Dungeon-Instanzen und die ausstehenden P2-Systeme der Queue.

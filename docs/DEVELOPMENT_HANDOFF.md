# Handoff

- Entwicklungsbranch `ccr-c83759b9-34xxzv`, [PR #1](https://github.com/NeoGoku/NewAgeMMO/pull/1) gegen `main`. Vorheriger Release: [v0.2.6](https://github.com/NeoGoku/NewAgeMMO/releases/tag/v0.2.6).
- Persistenz: `apps/server/src/character-save.ts`, Socket-Lebenszyklus in `core.ts`, geordnete PostgreSQL-Schreibvorgänge in `store-node.ts`, Solo-Worker und IndexedDB in `apps/web/src/solo`. Lokale Tests für JSON und PostGIS sowie der Browser-Unterpfad-Build mit Worker-Neustart sind grün.
- Nächster Integrationsschritt: CI des PR-Head-Commits prüfen, erst danach mergen und Browser-Deployment sowie APK und Web-ZIP auf GitHub verifizieren.
- P1/P2: siehe Entwicklungsqueue und GDD. Standortwechsel und Kartenobjekte zuerst über `apps/server/src/geo.ts` und `apps/web/src/geo/GeoScreen.tsx` weiterentwickeln.

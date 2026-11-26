# Übergabe: World Expansion (unvollständig, Stand der Unterbrechung)

## Fertig und im Commit
- Zentrierungsbutton zoomt auf 17–18 (GeoScreen `onRecenter`).
- Luftbilder: LGLN plus Thüringen, Hessen, Rheinland-Pfalz, Schleswig-Holstein, Mecklenburg-Vorpommern (`AERIAL_SOURCES` in `map-style.ts`, transparente Kacheln). Nicht eingebunden, da Lizenz nicht bestätigt: NRW, Sachsen, Sachsen-Anhalt.
- Geländemodell aus OpenFreeMap-Vektorkacheln (`apps/server/src/geo-terrain.ts`), neue Spawns, NPCs an OSM-POIs, Ressourcen, regionale Dungeons/Weltboss, Stufengebiete (`geo-spawn.ts`, `geo-world.ts`).
- Gebietsgrenzen-Overlay und HUD-Zeile im Client (Schalter in der Kartenlegende).
- Neue Ressourcenknoten (Fisch, Schrott, Kristall, Äther) und Item `m_fish`.
- `tests/geo.ts` lief nach den Spawn-Änderungen grün.

## Unvollständig / ungeprüft
- Immobilien-Kartenfilter: `PROPERTY_FILTERS`/`propertyPasses` in `map-markers.ts` und neue Statusfarben sind angelegt, aber NICHT in `GeoScreen.tsx` verdrahtet (Filter-UI, Preis/Größe, Anwendung beim Markerzeichnen). Web-Typecheck nach diesen Änderungen nicht ausgeführt.
- Eigene Immobilien zur Vermietung anbieten: nicht umgesetzt.
- Gebietsquests, Weltboss-Mechaniken und Events: nicht umgesetzt (nur Platzierung).
- Mobile-Optimierung/Safe-Area: nicht geprüft.
- Nicht ausgeführt: `npm run typecheck`, `npm test` (gesamt), `npm run build`. Tests, die `PROPERTY_MARKER_STATUSES` prüfen (`apps/web/tests/markers.ts`), sind eventuell anzupassen.
- Bekannt: ALKIS/Open-Data-Quellen nicht geprüft.

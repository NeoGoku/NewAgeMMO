# Veröffentlichung & Hosting
**Automatisiert (GitHub Actions):** `pages.yml` baut/veröffentlicht die Browser-Version (Pages), `release.yml` baut nach Code-Änderungen auf `main` oder bei Tags `v*` das PWA-ZIP und bei eingerichteter Signierung eine Release-APK und legt ein GitHub Release an, `ci.yml` testet (inkl. PostgreSQL-Job).
## Einmalig nötig (kann nicht automatisiert werden, benötigt Repo-Admin)
1. **Pages aktivieren:** Repo → Settings → Pages → *Source: GitHub Actions*. (Das Workflow-Token darf Pages nicht selbst aktivieren.) Außerdem unter Settings → Environments → github-pages ggf. Tags `v*` als erlaubte Deployment-Quelle ergänzen.
2. **Release auslösen:** Tag `vX.Y.Z` pushen (oder Actions → *Release* → Run). Pages deployt von `main`/Tags.
## Multiplayer-Server (optional, kostenlos)
GitHub Pages hostet nur statische Dateien. Persistenter Server + DB extern:
- **Render (Free Web Service)** per Blueprint `render.yaml` (Docker). Schläft nach Inaktivität (Kaltstart ~30–60 s), keine persistente Platte → Datenbank extern.
- **Neon (Free Postgres, PostGIS verfügbar)** → Connection-String als `DATABASE_URL` im Render-Service. Migrationen laufen beim Start automatisch.
- Danach Repo-Variable **`NAM_SERVER_URL`** = `wss://<dein-service>.onrender.com` setzen und Pages/Release neu laufen lassen → Client/APK verbinden automatisch.
Alternativen (nicht geprüft/Kreditkarte): Fly.io, Koyeb, Oracle Always Free VM mit `docker compose`.
## Ohne Server
Solo-Modus: kompletter Server im Browser-Worker, Spielstand lokal (IndexedDB).
## Datenschutz/Sicherheit
Siehe README „Reale Erde“; Standortdaten werden nicht dauerhaft präzise gespeichert (nur auf ~100 m gerundet im Charakter, löschbar).


## Karten und Android-Updates
- `OSM_OVERPASS_URL` setzt auf dem Online-Server den Overpass-Endpunkt. Standard ist `https://overpass-api.de/api/interpreter`. Ein leerer Wert deaktiviert den Import. Anfragen verwenden gerundete Regionsgrenzen. PostgreSQL speichert bis zu 512 Regionen mit 24 Stunden Gültigkeit, PostGIS indiziert zusätzlich die Kartenpositionen. Der Speicher-Cache bleibt für Dateispeicher und als Ausfallpfad erhalten.
- GitHub Pages benötigt keinen Spielserver für den Solo-Modus. Browser-Kartengrundlagen werden bei Bedarf von OpenStreetMap, OpenFreeMap oder NASA GIBS bezogen. Details stehen in [ASSET_LICENSES.md](ASSET_LICENSES.md).
- Für Android-Updates über dieselbe Installation den vorhandenen Signierschlüssel wiederverwenden. Die nötigen Actions-Secrets und die feste Zertifikatsvariable sind in [apps/android/README.md](../apps/android/README.md) dokumentiert.

## Online-Moderation
Die Online-Servervariable `ADMIN_USERS` enthält die Benutzernamen bereits sicher angelegter Betreiberkonten (kommasepariert). Verifiziere das Konto vor dem Eintragen. Ein bereits reservierter Name kann nicht über die öffentliche Anmeldung angelegt werden. Das Dashboard zeigt Serverstatus und Audit und erlaubt Ankündigungen, Kick, dauerhaften Mute und Ban sowie deren Aufhebung. Der Solo-Worker ist von diesen Rollen getrennt.

## Straßenrouting und Immobilienkatalog

**Routing.** Valhalla bietet Profile für Fußverkehr, Fahrräder, Motorräder und Autos samt Wegeverlauf. OSRM verwendet üblicherweise ein vorverarbeitetes Netz je Profil. GraphHopper hätte eine zusätzliche JVM-Installation erfordert. Ein selbst betriebener Valhalla-Dienst kann OSM-Auszüge für die gewünschten Regionen nutzen. Die Basis-URL ohne `/route` als `VALHALLA_URL` auf dem Online-Server setzen. Für Browser und Android im Solo-Modus dieselbe Basis per `NAM_VALHALLA_URL` in GitHub Actions oder lokal per `VITE_VALHALLA_URL` zur Buildzeit angeben. Öffentliches HTTPS und passende CORS-Regeln für den jeweiligen Ursprung sind dort nötig. Keine Anmeldedaten in den Browser-Build setzen. Der Browser ruft den eingestellten Dienst für Start- und Zielkoordinaten an. Ein öffentlicher Demo-Server ist nicht voreingestellt.

**Katalog.** Der Online-Server liest aus `PROPERTY_CATALOG_GEOJSON` eine bereitgestellte, lizenzkonforme OSM-GeoJSON-Datei für Braunschweig (inklusive Innenstadt, Heidberg und Weststadt). Für Solo eine gleichursprüngliche Datei veröffentlichen und deren Pfad in `NAM_PROPERTY_CATALOG_URL` beziehungsweise `VITE_PROPERTY_CATALOG_URL` setzen. Quellen und Datenstand mitliefern. Ohne Datei bleibt das bestehende Housing nutzbar. Im öffentlichen Build ist kein echter Immobilienbestand hinterlegt. Die verfügbaren Felder und Modellgrenzen stehen im Implementierungsstatus.

Ein einmaliger, begrenzter Import kann mit `npx tsx scripts/import-osm-properties.ts ./braunschweig.geojson` bei einem erreichbaren Overpass-Dienst ausgeführt werden. Die Abfrage umfasst bis zu 330 Wohngebäude pro Referenzgebiet. Die Ausgabe enthält OSM-Kennung, Umriss, Attribution und Datenstand.

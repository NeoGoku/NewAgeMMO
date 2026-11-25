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

**Routing.** Valhalla verwendet denselben OSM-Straßengraphen für Fußverkehr, Fahrräder, Motorräder und Autos. Das optionale Compose-Paket startet das offizielle Valhalla-Image und baut den Graphen aus dem [OSM-Auszug für Niedersachsen von Geofabrik](https://download.geofabrik.de/europe/germany/niedersachsen.html). Der erste Aufbau benötigt je nach Auszug freien Speicher und Zeit. Der Dienst bleibt im Compose-Netz erreichbar. Die weitergeleitete Debug-Schnittstelle ist an die Loopback-Adresse gebunden.

```sh
export COMPOSE_FILE=infrastructure/docker-compose.yml:infrastructure/docker-compose.routing.yml
docker compose up -d
docker compose logs valhalla
curl -fsS http://127.0.0.1:8002/status
```

Der Spielserver im Compose-Verbund verwendet `http://valhalla:8002` automatisch. `VALHALLA_TILE_URLS` wählt einen anderen OSM-Auszug. Setze es auf einen leeren Wert und verwende `VALHALLA_DATA_DIR` mit absolutem Pfad, um eine vorbereitete lokale `.osm.pbf`-Datei einzubinden. Valhalla speichert PBF und Graph standardmäßig im Volume `valhalla_data`. Für einen neuen Datenstand ein separates Datenverzeichnis vorbereiten, mit `/status` und einer Route prüfen und dann umschalten. Die Quelldaten stammen von [OpenStreetMap-Mitwirkenden unter ODbL](https://www.openstreetmap.org/copyright). Der Workflow **Valhalla mit echten OSM-Daten** prüft Fuß- und Autorouten in Braunschweig mit einem zugeschnittenen Geofabrik-Auszug.

Für einen separaten Online-Spielserver die Basis-URL ohne `/route` als `VALHALLA_URL` setzen. GitHub Pages ist statisch. Für Browser und Android im Solo-Modus einen öffentlich erreichbaren HTTPS-Reverse-Proxy vor Valhalla betreiben und die Basis per `NAM_VALHALLA_URL` in GitHub Actions oder lokal per `VITE_VALHALLA_URL` setzen. Der Proxy sollte nur `POST /route` und den `OPTIONS`-Preflight freigeben, Anfragen begrenzen und `Content-Type` für die erlaubten Origins zulassen. Der aktuelle Android-Build verwendet `http://localhost` als Origin. Start- und Zielkoordinaten gehen an den konfigurierten Dienst. Zugangsdaten gehören in die Server-Konfiguration.

Selbsthosting auf einem vorhandenen Rechner verursacht keine API-Gebühren. Ein kostenloser VM-Tarif kommt bei genügend dauerhaftem Speicher und tatsächlich verfügbarem Kontingent ebenfalls infrage. Der kostenlose Render-Webdienst dient als Spielserver. Der Graphaufbau und das persistente Routing-Volume benötigen einen eigenen Host. Für den öffentlichen Betrieb müssen dessen Betreiberzugang und HTTPS-Endpunkt bereitstehen. Ohne Routendienst bleibt für kurze Fußstrecken die ausdrücklich als Luftlinie gekennzeichnete virtuelle Bewegung verfügbar.

**Katalog.** Der verifizierte Braunschweig-Bestand liegt unter `apps/web/public/braunschweig.geojson`. Vite bündelt ihn für Browser und Android und nimmt ihn in den Offline-Cache auf. Der Online-Server verwendet dieselbe Datei standardmäßig. Ein eigener lokaler Katalog lässt sich über `PROPERTY_CATALOG_GEOJSON` bereitstellen. Für Browser und Android kann `NAM_PROPERTY_CATALOG_URL` beziehungsweise `VITE_PROPERTY_CATALOG_URL` auf eine gleichursprüngliche Datei zeigen.

Der Workflow **OSM-Immobilienkatalog Braunschweig** erzeugt einen datierten Bestand aus dem regionalen Geofabrik-Auszug und prüft die Abdeckung von Innenstadt, Weststadt und Heidberg. Er stellt das Ergebnis als Workflow-Artefakt und im Branch `osm-braunschweig-snapshot` bereit. Ein eigener einmaliger Import aus einem erreichbaren Overpass-Dienst ist mit `npx tsx scripts/import-osm-properties.ts ./braunschweig.geojson` möglich. Der Katalog enthält OSM-Kennungen, Umrisse, Herkunft und Lizenz. Übernommene Gebäude bleiben mit ihrem beim Kauf gespeicherten Stand erhalten.

Der Online-Immobilienmarkt lädt beim Öffnen außerhalb der vorbereiteten Referenzgebiete echte Gebäudeumrisse nach. Dafür verwendet er `PROPERTY_OVERPASS_URL` oder den konfigurierten `OSM_OVERPASS_URL`. Ein leerer Wert deaktiviert die Nachladung. Der Dienst erhält eine gerasterte Region. Begrenzte Antworten teilen sich einen 24-Stunden-Speichercache. Erworbene Immobilien behalten ihre gespeicherte OSM-ID, Lage, Fläche und den ursprünglichen Kaufpreis. Für größere Installationen einen eigenen oder ausdrücklich für die Datenlast freigegebenen Overpass-Dienst verwenden. Der Solo-Modus verwendet nur seinen vorbereiteten statischen Katalog.

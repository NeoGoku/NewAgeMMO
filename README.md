# NewAgeMMO

Kostenloses, grafikbasiertes Point-and-Click-MMORPG im alternativen Jahr 2030 (semi-realistische Urban Fantasy, Magie ist öffentlich bekannt) – **mit der realen Erde als Spielwelt** (OpenStreetMap + MapLibre, GPS oder virtuelles Laufen). Kein Echtgeldshop, keine Premiumwährung, alles erspielbar.

## ▶ Spielen & Downloads
| | Link |
|---|---|
| **Browser (GitHub Pages)** | https://neogoku.github.io/NewAgeMMO/ |
| **Windows-PWA** | Link oben in Edge/Chrome öffnen → Adressleiste „App installieren“ (Start → eigenes Fenster) |
| **Android-APK** | https://github.com/NeoGoku/NewAgeMMO/releases/latest (Datei `NewAgeMMO-*.apk`) |
| **Releases** | https://github.com/NeoGoku/NewAgeMMO/releases (aktuell: [v0.2.4](https://github.com/NeoGoku/NewAgeMMO/releases/tag/v0.2.4), enthält APK + Web-ZIP) |

> Hinweis zur Verfügbarkeit: Die Links werden erst aktiv, nachdem (1) GitHub Pages einmalig auf „GitHub Actions“ gestellt ist (Settings → Pages → Source) und (2) der Workflow auf einem `v*`-Tag bzw. `main` gelaufen ist. Siehe [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Spielmodi – ehrlich erklärt
- **Solo (Standard auf GitHub Pages/APK):** Der komplette Spielserver läuft lokal im Browser (Web Worker, Spielstand in IndexedDB). Sofort spielbar ohne Server, aber ohne andere Spieler.
- **Online-Multiplayer:** gemeinsame persistente Welt über den Node.js/PostgreSQL-Server. GitHub Pages kann keinen Server betreiben – der Server läuft extern (kostenlos z. B. Render + Neon, Blueprint `render.yaml`). Ist die Repository-Variable `NAM_SERVER_URL` gesetzt, nutzen Pages-Client und APK ihn automatisch als Standard; sonst Optionen → „Online“ → Serveradresse. **Aktuell ist kein öffentlicher Server aufgesetzt.**

## Schnellstart

```bash
npm install
npm run dev:server      # Server auf :8080 (Dateispeicher ./data)
npm run dev:web         # Client auf http://localhost:5173
npm test                # Server-Integrationstest (Registrierung → Kampf → Persistenz → Multiplayer)
```

Produktion (alles in einem Container, mit PostgreSQL):

```bash
docker compose -f infrastructure/docker-compose.yml up --build   # http://localhost:8080
```

Der Server liefert den gebauten Web-Client (`apps/web/dist`) mit aus. Die APK nutzt eine **konfigurierbare Serveradresse** (Optionen → Serveradresse, z. B. `wss://dein-server`).

## Reale Erde (Geo)
Menü → 🌍 *Erde*: MapLibre-Karte mit OpenStreetMap-Kacheln. Spielorte sind real verankert (Aurelia = Berlin, Port Nocturne = Hamburg, Kristallspitze = Zürich, Arena/Valdris = Rom, Himmelsturm = Zugspitze, Void-Herz = Himalaya …). Monster, Ressourcen, Dungeoneingänge und Quellen entstehen dynamisch je Rasterzelle und Zeitfenster (Stufe steigt mit Entfernung zu Städten). Bewegung per **GPS** (echte Schritte geben Trainings-EXP, max. 10 km/Tag) oder **virtuell** (Tippen auf die Karte). Datenschutz: Opt-in, andere sehen nur ≈100 m gerundete Positionen, präzise Position nur im Arbeitsspeicher, „Meine Standortdaten löschen“ jederzeit. Manipulationsschutz: serverseitige Geschwindigkeits-/Teleport-/Genauigkeitsprüfung mit Sperre nach wiederholten Verstößen. PostGIS wird im PostgreSQL-Betrieb für Geo-Objekte genutzt (Migration `003_postgis.sql`).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `apps/web` | React/TypeScript/Vite-Client: Titelbildschirm, Account, Charaktererstellung, Canvas-Szenen, HUD, alle Panels, WebAudio-Sound, PWA |
| `apps/server` | Node.js/TypeScript, WebSocket, serverautoritative Spielregeln, PostgreSQL- oder Dateispeicher |
| `apps/android` | Capacitor-Konfiguration für die Android-Debug-APK |
| `packages/shared` | Gemeinsame Typen, Protokoll, Balance-Formeln |
| `packages/game-data` | Datengetriebene Inhalte: Klassen/Skills, Items, Gegner, Welt/NPCs, Quests, Berufe/Rezepte, Pets, Möbel |
| `database/migrations` | SQL-Migrationen (werden beim Serverstart automatisch angewendet) |
| `infrastructure` | Dockerfile, docker-compose |
| `docs` | GDD, Architektur, Roadmap, Status, Queue, Handoff, Asset-Lizenzen |

## Lizenz der Assets
Alle Grafiken und Töne werden zur Laufzeit prozedural erzeugt (Canvas2D / WebAudio) – siehe [docs/ASSET_LICENSES.md](docs/ASSET_LICENSES.md).

# NewAgeMMO

Kostenloses, grafikbasiertes Point-and-Click-MMORPG im alternativen Jahr 2030 (semi-realistische Urban Fantasy, Magie ist öffentlich bekannt).
Eine gemeinsame persistente Welt (ohne Channels) für **Android (Capacitor-APK)**, **Windows/Browser (installierbare PWA)**. Kein Echtgeldshop, keine Premiumwährung, keine Seasons – alles ist erspielbar.

> Status: **Alpha** – siehe [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) für ehrlichen Umsetzungsstand und [docs/DEVELOPMENT_QUEUE.md](docs/DEVELOPMENT_QUEUE.md) für die nächste Arbeit.

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

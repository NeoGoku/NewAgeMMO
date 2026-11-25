# NewAgeMMO

Kostenloses, grafikbasiertes Point-and-Click-MMORPG im alternativen Jahr 2030 (semi-realistische Urban Fantasy, Magie ist öffentlich bekannt) – **mit der realen Erde als Spielwelt** (OpenStreetMap + MapLibre, GPS oder virtuelles Laufen). Kein Echtgeldshop, keine Premiumwährung, alles erspielbar.

## ▶ Spielen & Downloads
| | Link |
|---|---|
| **Browser (GitHub Pages)** | https://neogoku.github.io/NewAgeMMO/ |
| **Windows-PWA** | Link oben in Edge/Chrome öffnen → Adressleiste „App installieren“ (Start → eigenes Fenster) |
| **Android-APK** | [Aktueller Release](https://github.com/NeoGoku/NewAgeMMO/releases/latest), Datei `NewAgeMMO-*.apk` |
| **Releases** | [Release-Archiv](https://github.com/NeoGoku/NewAgeMMO/releases) · Web-ZIP im jeweiligen Release |

> Für öffentliche APKs gilt ein festgelegtes Signierzertifikat. Vor dem einmaligen Wechsel von einer anders signierten Alt-APK den Solo-Spielstand in den Titeloptionen exportieren. Details zum Upgrade stehen in der [Android-Dokumentation](apps/android/README.md).

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

## Reale Erde

Die Weltkarte ist die Hauptansicht. Der virtuelle Modus unterstützt Tippen und einen Touch-Joystick. GPS nutzt die bestätigte Geräteposition. Kartendesign, Helligkeit, Zoom, Drehung und Neigung bleiben gespeichert. Die Satellitenansicht bietet eine globale Übersicht; für Straßen und Gebäude sind Standard und 3D vorgesehen. Die vorhandenen Spielorte bleiben verankert, während regionale NPCs, Monster, Eliten, Ressourcen und Bosse auch außerhalb dieser Orte erscheinen. Der Online-Server ergänzt öffentliche Orientierungspunkte aus OpenStreetMap und hält sie bei PostgreSQL auch über Neustarts vor.

Über die Questdetails lassen sich Questgeber, Zielgebiet und Abgabe auf der Karte verfolgen. Die GPS-Navigation zeigt die Richtung zum Ziel als Luftlinie. Im virtuellen Modus öffnet sie die Routenplanung. Die Tagesquest „Die Gegend erkunden“ weist ein serverseitig bestimmtes Zielgebiet in der jeweiligen Region zu.

## Kartenansicht, Reisen und Immobilien

Das Kartensymbol rechts oberhalb der Zoomtasten und **Mehr → Einstellungen → Kartenansicht** öffnen dasselbe Menü. Wähle Kartentyp und Kartenstyle getrennt. Fünf eigene Vorschaubilder erleichtern die Auswahl. Satellit nutzt den Style für die eingeblendeten Straßen, 3D zusätzlich für Gebäude.

Tippe im virtuellen Modus auf ein Ziel und wähle **Reise starten**, sobald eine Route und Reisezeit vorliegen. Straßen und Wege werden von einem konfigurierten Valhalla-Dienst geliefert. Der Joystick funktioniert ohne Routendienst. Eine gestartete Reise läuft nach Schließen der App zeitbasiert weiter, sofern sie nicht pausiert ist.

**Mehr → Immobilien** zeigt bei eingerichtetem Katalog die verfügbare Region und den eigenen Schnellreisepunkt. Die angebotenen Gebäude sind virtuelle Spielobjekte. Einrichtung und Lager verwenden das bestehende Housing. Die [Konfiguration](docs/DEPLOYMENT.md) erklärt Routing und den Braunschweig-Import.

## Solo-Spielstand sichern

Im Titelmenü unter **Optionen → Solo-Spielstand** lässt sich die lokale Datenbank exportieren und nach Bestätigung wiederherstellen. Browserprofile, Browsersitzungen mit eigener Speicherung und die Android-App haben getrennte Daten. Für einen Wechsel zwischen solchen Installationen dient die Sicherungsdatei. Sie enthält lokale Kontodaten und sollte privat aufbewahrt werden. Online-Spielstände werden auf dem gewählten Server verwaltet.

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

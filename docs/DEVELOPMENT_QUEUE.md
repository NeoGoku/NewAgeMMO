# Development Queue

## Veröffentlichung und nächste Integrationen
- [lokal geprüft] P0: Kampfbelohnung, Levelaufstieg, Logout und Reconnect mit JSON und PostgreSQL 16 + PostGIS. Browser-Solo: Service Worker und IndexedDB-Reconnect in Chromium.
- [erledigt] PR #1 ist in `main` gemergt. GitHub Pages ist eingerichtet.
- [implementiert/geprüft] P1: eigenständige Teleportportale mit Distanz-, Modus- und Freischaltungsprüfung sowie virtuelles Routing mit serverseitiger Reisezeit.
- [implementiert] Smartphone-Paket mit acht dauerhaft gespeicherten Kartenstilen, GPS-Handshake, serverseitigem Touch-Joystick, regionalen Spawns, Questkarten-Tracking, Solo-Backup und überarbeitetem Audio.
- [implementiert] P1: persistente OSM-Regionen in PostgreSQL/PostGIS und eine tägliche geografische Erkundungsquest.
- [implementiert] Getrennte Kartentypen und Styles mit Vorschauen, gemeinsamer Bedienung und Migration bisheriger Einstellungen.
- [implementiert] Straßenrouting mit Valhalla, Reisevorschau, Fahrzeugfreigaben und persistenter Reise. Der öffentliche Betrieb benötigt einen eingerichteten Routendienst.
- [teilweise] Immobilienkatalog mit Braunschweig-Import, Kauf, Rückverkauf, Einrichtung und persönlicher Schnellreise. Datenbereitstellung, Vermietung, Baugrundstücke und weitere Immobilienarten stehen aus.
- [offen] P1: Gebietskontrolle, weitere geografische Questtypen und Instanzen für Gruppen und Dungeons.

1. [teilweise] Release-Signierung prüft den festen Zertifikatsfingerabdruck. Betreiber muss Key und Fingerabdruck in GitHub hinterlegen; erster Release und physisches Update bleiben zu prüfen.
2. [offen] Docker-Compose + PostgreSQL-Lauf (`DATABASE_URL`) verifizieren, Migrationen testen.
3. [teilweise] Balance-Pass (Mob-Schaden/Elite/Boss, EXP-Kurve) per Simulation + Spieltest.
4. [offen] Lasttest-Skript (50–100 Bot-Clients), Tickzeit messen.
5. [offen] Weitere Integrationstests: Gilde, Handel-Abschluss, Haus-Möbel, Crafting, Pets, Quest-Abgabe.
6. [offen] Tutorial/Onboarding-Hinweise, Questtexte vertiefen, mehr Dialoge.
7. [teilweise] Online-Adminoberfläche mit Audit, Ankündigungen, Kick sowie dauerhaftem Mute/Ban und Aufhebung. Backup-Automation steht aus.
8. [offen] Android-UX: Gesten, Akku-Modus, Landscape-Feintuning; Zielgerät testen.
9. [offen] Handgemachte Endassets (siehe ASSET_LICENSES.md).

## v2-Stand
- [implementiert/geprüft] Geo-System (Server: Spawns, Anti-Cheat, Datenschutz; Client: MapLibre/OSM), PostGIS-Migration (gegen lokales PostgreSQL 16+PostGIS getestet), Solo-Modus im Browser, Pages/Release-Workflows (noch nicht auf GitHub gelaufen).
- [offen] Öffentlicher Server (benötigt Render-/Neon-Zugang des Auftraggebers), Weitere Geo-Quests, Gilden-Territorien, weitere Grafikpolitur.

## Map-First (aktuell)
- [implementiert/geprüft] Karte als Hauptansicht, Ereignisleiste (5 Bereiche + Mehr), kompakte Charakteranzeige, eingeklappter Chat, Kampfskills nur im Kampf, Szenenwechsel per Server-Nachricht, NPCs/Werkstätten als Kartenobjekte mit Nähe-Interaktion.
- [offen] Eroberbare Gebiete (Gilden-Territorien), Gilden-/Housing-Objekte aus realen Positionen, Geo-Quests, Dungeon-Betretung mit eigener Karten-Ansicht, Erprobung auf echtem Android-Gerät.

# Development Queue

## Veröffentlichung und nächste Integrationen
- [lokal geprüft] P0: Kampfbelohnung, Levelaufstieg, Logout und Reconnect mit JSON und PostgreSQL 16 + PostGIS. Browser-Solo: Service Worker und IndexedDB-Reconnect in Chromium.
- [offen] PR #1 erst nach grüner GitHub-CI mergen. Danach Pages unter `/NewAgeMMO/` und neue Release-Assets prüfen.
- [offen] P1: eigenständige Teleporter, abgesicherte GPS-/Virtuell-Wechsel, begrenzter OSM-POI-Import und Gebietskontrolle.

1. [offen] APK-Build via GitHub-Actions `android.yml` ausführen/prüfen; Gradle-Ausgabe kontrollieren.
2. [offen] Docker-Compose + PostgreSQL-Lauf (`DATABASE_URL`) verifizieren, Migrationen testen.
3. [teilweise] Balance-Pass (Mob-Schaden/Elite/Boss, EXP-Kurve) per Simulation + Spieltest.
4. [offen] Lasttest-Skript (50–100 Bot-Clients), Tickzeit messen.
5. [offen] Weitere Integrationstests: Gilde, Handel-Abschluss, Haus-Möbel, Crafting, Pets, Quest-Abgabe.
6. [offen] Tutorial/Onboarding-Hinweise, Questtexte vertiefen, mehr Dialoge.
7. [offen] Admin-UI, Moderation (Mute/Ban), Backup-Automation.
8. [offen] Android-UX: Gesten, Akku-Modus, Landscape-Feintuning; Zielgerät testen.
9. [offen] Handgemachte Endassets (siehe ASSET_LICENSES.md).

## v2-Stand
- [implementiert/geprüft] Geo-System (Server: Spawns, Anti-Cheat, Datenschutz; Client: MapLibre/OSM), PostGIS-Migration (gegen lokales PostgreSQL 16+PostGIS getestet), Solo-Modus im Browser, Pages/Release-Workflows (noch nicht auf GitHub gelaufen).
- [offen] Öffentlicher Server (benötigt Render-/Neon-Zugang des Auftraggebers), Geo-Quests als eigener Typ, OSM-POI-Import (Overpass) in PostGIS, Gilden-Territorien, weitere Grafikpolitur.

## Map-First (aktuell)
- [implementiert/geprüft] Karte als Hauptansicht, Ereignisleiste (5 Bereiche + Mehr), kompakte Charakteranzeige, eingeklappter Chat, Kampfskills nur im Kampf, Szenenwechsel per Server-Nachricht, NPCs/Werkstätten als Kartenobjekte mit Nähe-Interaktion.
- [offen] Eroberbare Gebiete (Gilden-Territorien), Teleporter-Auswahl auf der Karte als Ortsmarken, Gilden-/Housing-Objekte aus realen Positionen, Geo-Quests, Dungeon-Betretung mit eigener Karten-Ansicht, Erprobung auf echtem Android-Gerät.

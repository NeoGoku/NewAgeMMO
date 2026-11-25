# Development Queue
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

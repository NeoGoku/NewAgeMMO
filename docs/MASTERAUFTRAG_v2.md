# Masterauftrag v2 (Ergänzung, verbindlich zusätzlich zu v1)
Fortsetzung auf bestehendem Branch. v1 (`MASTERAUFTRAG_v1.md`) bleibt vollständig verbindlich.

## 1. Entwicklung
- OpenStreetMap, MapLibre, PostGIS integrieren; reale Erde als interaktive Spielwelt; hybride GPS-/virtuelle Fortbewegung.
- Monster, NPCs, Quests, Ressourcen, Dungeons, Housing, Gilden mit geografischen Positionen; dynamische Spawn-Systeme.
- Grafik in Richtung semi-realistischer Urban Fantasy verbessern.
- PostgreSQL und persistente Multiplayer-Systeme vervollständigen.
- GPS-Manipulationsschutz und Datenschutz.
- Alle offenen Gameplay-Systeme des Masterauftrags vervollständigen.

## 2. GitHub-Veröffentlichung (verpflichtend)
- Gesamten Quellcode inkl. Grafiken, Sounds, Konfigurationen, Spieldaten pushen.
- GitHub Pages für die Browser-Version; Veröffentlichung bei stabilen Versionen automatisieren; direkter Spiel-Link.
- Installierbare Windows-PWA; Android-APK über GitHub Actions; APK unter GitHub Releases.
- Funktionierende Verbindung zwischen veröffentlichtem Client und Multiplayer-Server; kostenlose Backend-Hosting-Möglichkeiten prüfen; keine kostenpflichtigen Dienste ohne Genehmigung.
- Alle Spiel- und Downloadlinks in README.md. Keine manuelle Einrichtung durch den Auftraggeber, soweit automatisierbar; nötige externe Zugangsdaten konkret benennen.
- GitHub Pages kann keinen Node.js-Server/PostgreSQL betreiben → externe Backend-Anbindung; keine vorgetäuschte Online-Version.

## 3. Arbeitsweise
- Masterauftrag im Repo, kompakte Regeln in CLAUDE.md, gezielte Dateizugriffe, keine redundanten Analysen/Berichte, wiederverwendbare Module, max. 2–3 Subagenten mit getrennten Dateien, keine unnötigen Testschleifen, produktiver Code vor Doku.

## 4. Autonomie
- Möglichst viele Pakete pro Lauf; nach Build/Commit/Push weiterarbeiten; Queue aktualisieren; regelmäßig pushen.
- Abschlusslieferung: Browser-Spiellink, APK-Link, Release-Link, tatsächlicher Stand, verbleibende technische Blockaden.

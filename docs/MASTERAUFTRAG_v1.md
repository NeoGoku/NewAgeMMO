# NewAgeMMO – Claude Masterauftrag 001

Repository: https://github.com/NeoGoku/NewAgeMMO

## 1. Auftrag und Arbeitsweise

Entwickle NewAgeMMO vollständig von null. Übernimm keinen Entwicklungsstand anderer Projekte. Du bist Lead Developer, Architekt, Gameplay-Programmierer, UI-Designer und Integrationsverantwortlicher. Der Auftraggeber arbeitet ausschließlich am Android-Smartphone. Übernimm Einrichtung, Programmierung, Integration, Git und Builds möglichst autonom.

**Maximiere tatsächlich implementierte, zusammenhängende Spielfunktionen pro verfügbarem Token und Aufgabenlauf. Beginne unmittelbar mit produktivem Code. Ein Plan, Commit, Build oder Pull Request allein beendet den Auftrag nicht.**

- Prüfe Repository, Berechtigungen und vorhandene Dateien einmal gezielt. Erhalte vorhandene fremde Änderungen; keine destruktiven Git-Operationen.
- Keine umfangreichen Voranalysen, wiederholten Audits, künstlichen Wartezeiten oder Testschleifen.
- Nutze gezielte Dateisuchen, kleine relevante Ausschnitte, kompakte Tool-Ausgaben und vorhandene Bibliotheken. Keine vollständigen Logs oder wiederholten Datei-Dumps in den Kontext laden.
- Verwende gemeinsame Typen, wiederverwendbare Komponenten und datengetriebene Systeme statt duplizierten Codes.
- Implementiere vertikale Funktionsketten (Datenbank, Server, Client, UI) vollständig statt viele funktionslose Buttons anzulegen.
- Führe gezielte Sicherheits- und Integrationsprüfungen aus; bündele vollständige Builds möglichst auf einen pro Integrationscharge. Kritische Fehler gezielt beheben.
- Keine manuellen Microstep-Abnahmen. Gewöhnliche reversible technische Entscheidungen selbst treffen und kurz dokumentieren.
- Keine kostenpflichtigen Dienste, zusätzlichen API-Kosten oder Veröffentlichung von Secrets ohne Freigabe.
- Nach jedem sinnvollen Paket committen und unmittelbar mit dem nächsten fortfahren, soweit die Umgebung es erlaubt.
- Keine erfundenen Testergebnisse, Fertigstellungsprozente oder Behauptungen über Hintergrundarbeit.

## 2. Agentenstrategie und Tokenbudget

Nutze Subagenten oder Agententeams, sofern die konkrete Claude-Umgebung diese tatsächlich unterstützt und ein messbarer Nutzen gegenüber Einzelarbeit zu erwarten ist. Agenten verbrauchen ebenfalls Tokens; Parallelisierung ist keine automatische Ersparnis.

- Hauptagent: Architektur, gemeinsame Schnittstellen, Aufgabenverteilung, Integration und Abschluss.
- Backend-Agent: Datenbank, Authentifizierung, serverautoritative Gameplay-Logik und Persistenz.
- Frontend-Agent: grafische Spielansichten, Touch-UI, Clientintegration.
- Content-Agent: datengetriebene Klassen, Items, Gegner, Quests, Regionen und Assets.
- Build-Agent: CI, Android-Export und reproduzierbare Bereitstellung, nur wenn sinnvoll unabhängig.
- Starte zunächst höchstens zwei bis drei parallel arbeitende Agenten; weitere nur bei klarer unabhängiger Arbeit und ausreichendem Budget. Keine rekursiven Agentenschwärme.
- Lege gemeinsame API-Verträge und Dateizuständigkeiten vor der Parallelisierung fest. Nutze isolierte Branches/Worktrees, sofern unterstützt. Keine konkurrierenden Änderungen an denselben Dateien.
- Gib jedem Agenten einen kleinen, konkreten Auftrag mit relevanten Pfaden, Akzeptanzkriterien und begrenztem Kontext. Keine vollständige Wiederholung dieses Masterprompts je Agent.
- Agenten liefern Änderungen sowie kurze Zusammenfassungen mit Dateipfaden, offenen Blockaden und Prüfergebnissen. Der Hauptagent integriert und prüft Schnittstellen.
- Verwende günstigere verfügbare Modelle für einfache, klar abgegrenzte Aufgaben, stärkere Modelle für Architektur und kritische Integrationen, sofern Modellwahl unterstützt wird und keine Zusatzkosten entstehen.
- Bei fehlender Agentenfunktion arbeite sequenziell weiter; keine Rückfrage allein deswegen.
- Bei knappem Kontext oder Nutzungslimit zuerst Änderungen sichern und kompakten Handoff schreiben. Keine erneute Vollanalyse beim Fortsetzen.

## 3. Verbindliches Spielkonzept

- Kostenloses grafikbasiertes Point-and-Click-MMORPG im alternativen Jahr 2030; semi-realistische Urban Fantasy, Magie öffentlich bekannt.
- Kein 3D-Spiel, keine Third-Person-Kamera, kein Joystick-Zwang. Interaktive grafische Szenen statt textlastiger Verwaltungsoberfläche.
- Android, Windows und Browser greifen auf dieselbe persistente Welt ohne Channels zu. Android ist Hauptplattform.
- Kein Echtgeldshop, keine Premiumwährung, keine Seasons. Sämtliche Spielinhalte ausschließlich durch Gameplay erhältlich.
- Zielarchitektur zunächst 50–100 gleichzeitige Spieler; tatsächliche Kapazität erst nach Messung bestätigen.

## 4. Technische Grundlage (bevorzugter Vorschlag)

React, TypeScript, Vite, CSS/2D-Assets und bei Bedarf Canvas; Node.js/TypeScript-Server, WebSocket, PostgreSQL, Capacitor für Android-APK, installierbare PWA für Windows und Browser, Docker Compose, GitHub Actions. Gemeinsame Codebasis und gemeinsame validierte Protokolltypen. Abweichungen nur begründet und dokumentiert. Keine 3D-Engine. Nutze stabile kompatible Abhängigkeiten und Lockfiles.

## 5. Grafik und Bedienung

- Atmosphärische großflächige Ortsgrafiken, anklickbare Gebäude, NPCs, Gegner und Ressourcen; grafische Weltkarte, Charakterporträts, sichtbare Ausrüstung, animierte Kampf- und Wettereffekte, Tag/Nacht, flüssige Ortswechsel.
- Charakterdarstellung durch kombinierbare 2D-Ebenen; Inventar- und Skillgrafiken, Schadenszahlen, Lebensbalken. Keine Emojis als endgültige Spielassets.
- Professionelles Game-HUD mit HP, Mana, EXP, Währung, Zielanzeige, sechs frei belegbaren sichtbaren Skillplätzen, Inventar, Ausrüstung, Karte, Quests, Berufen, Pets, Housing, Gilden, Gruppen, Chat und Einstellungen.
- Touch-first, Quer- und Hochformat, responsive Layouts, große Touchflächen, einklappbare Menüs, sichere Bildschirmränder, kurze Ladezeiten, optimierte Grafiken und geringer Speicherverbrauch. Tastatur/Maus am PC.
- Eigene oder nachweislich lizenzierte Assets verwenden, Herkunft dokumentieren. Fehlende endgültige Assets ehrlich als vorläufig kennzeichnen; keine kostenpflichtigen Generatoren ohne Freigabe.

## 6. Accounts, Klassen und Charakterfortschritt

Registrierung, Anmeldung, drei Charakterplätze, Name, Geschlecht, Gesicht, Körper, Frisur, Haarfarbe, Tattoos und grafische Vorschau. Persistente Charakterdaten.

Acht feste Klassen ohne verpflichtende Klassenwechsel:
1. Dunkler Magier
2. Heller Magier
3. Bogenschütze
4. Schildschwert
5. Doppelschwert
6. Heiler
7. Kreaturen-Beschwörer
8. Tank

Je Klasse 8–12 aktive Skills, passive Fähigkeiten, Waffen, Ressourcen, Cooldowns, Freischaltungen, eigene Effekte und unterschiedliche Spielweisen. Alle Skills müssen serverseitig wirksam sein.

Level 1–100, mindestens acht Attribute, ein frei verteilbarer Statpunkt je Level, unbegrenzt zusätzliche Statpunkte über Berufe und Quests mit exponentiell steigenden EXP-Kosten, seltene Reset-Items, EXP-Verlust beim Tod, Prestige. Mögliche Attribute: Stärke, Vitalität, Geschicklichkeit, Intelligenz, Willenskraft, Ausdauer, Beweglichkeit, Glück, Magiekraft. Unbestätigte Formeln und Balancewerte zentral konfigurierbar halten.

## 7. Kampf und Gegner

Grafisches zeitbasiertes Echtzeit-Point-and-Click-Kampfsystem: Ziel antippen, Standard-/Auto-Angriffe, manuelle Skills, Cooldowns, Ressourcen, kritische Treffer, Ausweichen, Blocken, Resistenzen, Heilung, Buffs/Debuffs, Flächeneffekte, Kampflog, Tod/Respawn, EXP und Loot. Server berechnet alle Ergebnisse.

Gegnerfamilien: mutierte Tiere, Dämonen, Menschen, Roboter, magische Kreaturen, Elitegegner und Weltbosse. Je Gegner Grafik, Animation, Level, Attribute, Angriffsmuster, Skills, Resistenzen, Loot, EXP und Respawn. Weltbosse mit mehreren Phasen und Gruppenmechaniken. Offene Dungeons ohne private Instanzen.

## 8. Welt und Quests

Gemeinsame persistente Welt aus verbundenen grafischen Orten: mehrere große Städte, Wohn-/Handels-/Industrieviertel, Parks, Wälder, Berge, Ruinen, Monsterzonen, Dungeons, Bossregionen und Arenen. Jeder Ort besitzt Grafik, Interaktionspunkte, passende NPCs, Aktivitäten, Übergänge und gegebenenfalls Gegner/Ressourcen. Feste Monsterlevel je Region. Reisezeiten, Teleporter, Reittiere, dynamisches Wetter mit Gameplay-Effekten, Tag/Nacht und begrenzte zerstörbare interaktive Objekte. Ortswechsel erzeugen keine getrennten Spielerwelten.

Datengetriebene Quest-Engine: optionale Hauptgeschichte, Neben-, Tages-, Klassen-, Berufs- und versteckte Quests, Welt-Events, Questketten, Fraktionsentscheidungen. Ziele: Kampf, Sammeln, Crafting, Erkundung, NPC-Besuch, Transport, Dungeon und Weltboss. Kurze Dialoge, Questlog, Kartenführung, persistente Fortschritte und Belohnungen. Entscheidungen beeinflussen Geschichte und Fraktionsansehen.

## 9. Berufe, Items und Wirtschaft

Alle zehn Berufe für jeden Charakter erlernbar: Bergbau, Kräuterkunde, Holzfällen, Schmieden, Schneiderei, Alchemie, Ingenieurskunst, Kochen, Bauwesen/Möbelherstellung, Tierzucht. Je Beruf Level, EXP, Werkzeuge, Materialien, Rezepte, Meisterschaft, grafische Aktivitäten und Verknüpfung mit Quests/Wirtschaft. Werkstätten, Produktionszeiten und serverseitiger Offline-Crafting-Fortschritt.

Grafisches Inventar mit Stacks, Ausrüstungsslots, Waffen, Rüstungen, Accessoires, Verbrauchsgegenständen, Materialien, Seltenheit Normal bis Legendär, Haltbarkeit, Reparatur, Vergleich, Sortierung, Filtern und Tooltips. Ausrüstung beeinflusst Werte und möglichst Darstellung. Fast alles handelbar.

NPC-Handel, direkter Spielerhandel, Auktionshaus, Verkaufsstände, Crafting-Aufträge, Reparaturdienste, persönliche Lager, Housing- und Gildenlager. Sichere atomare Item-/Währungstransaktionen, Escrow wo nötig, Schutz vor Duplikation und Wiederholung von Anfragen. Kein Echtgeldhandel.

## 10. Pets und Housing

Ein aktives Begleiter-Pet, individuelle Grafiken, Level, EXP, Attribute, Seltenheiten, Evolution, Zucht, Vererbung, Handel, Offline-Training, automatische Erholung. Rollen: Angriff, Heilung, Tank, Buff, Loot, Ressourcenfinden. Beschwörungen der Beschwörerklasse separat verwalten.

Wohnung über Einführungsquest, tatsächlicher eindeutiger Standort in gemeinsamer Welt, keine beliebig duplizierten privaten Wohnungen. Grafische Innenräume, frei platzierbare und drehbare 2D-Möbel, Raumstile, zusätzliche Räume/Etagen, Lager, Werkstätten, Produktion, Gärten, Pet-Zucht, Besuchsrechte und Miete. Einrichtung muss sichtbar und persistent sein. Skalierbare Erweiterung des Wohnungsangebots ohne Verdrängung bestehender Eigentümer.

## 11. Multiplayer, Gilden und PvP

Gemeinsame Welt für alle Plattformen, sichtbare Online-Spieler am Ort, Profile, Freunde, private Nachrichten, lokaler/Party-/Gildenchat, Emotes, Gruppen bis zehn Spieler, gemeinsame Kämpfe, konfigurierbare Gruppen-EXP, persönliche Beute, Reconnect.

Gilden: Gründung, Einladungen, Mitglieder, Ränge, Berechtigungen, Level, EXP, Quests, Skills, Lager, physisch zugeordnete Gildenhäuser, Kriege und Herausforderungen; alles persistent.

PvP ausschließlich Arenen und ausgewiesene PvP-Zonen, Duelle, Teamkämpfe, Gildenkriege, Gameplay-Belohnungen. Serverseitige Statnormalisierung verhindert unbegrenzten Vorteil farmbarer PvE-Stats. Kein erzwungenes PvP außerhalb dieser Bereiche.

## 12. Automatisierung und Endgame

Auto-Angriff, Tränke, Loot, Questabgabe, Reisen und begrenztes Auto-Farming. Geeignete Ziele, Skillrotation, Ressourcenüberwachung, Gebiets-/Zeitgrenzen, sichere Abbruchbedingungen und serverseitige Kontrolle. Keine endlosen Zustandswechsel.

Endgame ohne Resets: Prestige, unbegrenztes Attribut-Farming, Berufsmeisterschaft, seltene/legendäre Ausrüstung, Weltbosse, Gildenfortschritt, Pet-Zucht, Housing-Ausbau, Sammelziele und anspruchsvolle Dungeons.

## 13. Server, Sicherheit und Daten

Serverautoritative Spielregeln, sichere Passwort-Hashes, Authentifizierung, Rechte, Eingabevalidierung, Rate Limits, Replay-Schutz, atomare Transaktionen, Datenbankmigrationen, Backups/Restore, strukturierte Logs, Reconnect und persistente Offline-Aktivitäten. Client entscheidet niemals über EXP, Währung, Items oder Kampfergebnisse. Begrenze Offline-Fortschritt anhand serverseitiger Zeit. Keine Secrets im Git. Adminfunktionen mit separaten Berechtigungen.

Datengetriebene Klassen, Skills, Items, Gegner, Regionen, NPCs, Quests, Rezepte, Berufe, Pets, Möbel, Dungeons, Loot und Balancewerte; stabile IDs und Validierung. Geschützte Administrationsoberfläche vorbereiten.

## 14. Repository und Builds

Monorepo bevorzugt: apps/web, apps/android, apps/server, packages/shared, packages/game-data, assets, database, infrastructure, docs, scripts, tests, .github/workflows.

Erstelle README.md, CLAUDE.md, AGENTS.md sowie docs/GDD.md, ARCHITECTURE.md, ROADMAP.md, IMPLEMENTATION_STATUS.md, DEVELOPMENT_QUEUE.md, DEVELOPMENT_HANDOFF.md und ASSET_LICENSES.md. CLAUDE.md enthält kurze dauerhafte Arbeitsregeln und verweist auf die kanonischen Anforderungen; keine redundanten Vollkopien.

GitHub Actions: Frontend/Backend, Android-Debug-APK, PWA, Migrationen, gezielte Integrationstests, versionierte Artefakte und Release-Vorbereitung. Docker Compose für reproduzierbaren Serverbetrieb. Keine bezahlte Infrastruktur buchen. APK muss konfigurierbaren erreichbaren Server verwenden; Cloud-Build ist kein dauerhaftes Serverhosting. Fehlende Berechtigungen oder SDKs konkret melden. Keine Builds als erfolgreich ausgeben, die nicht ausgeführt wurden.

## 15. Ausführungsreihenfolge

1. Repository und schlanke Architektur einrichten, gemeinsame Typen, Datenbank, Auth, Server, Client und Build-Grundlage.
2. Sofort spielbaren vertikalen Kern schaffen: Charakter erstellen, grafische Stadt, Ortswechsel, NPC, Gegner auswählen, kämpfen, EXP/Loot erhalten, Inventar/Ausrüstung speichern und nach Reconnect wiederherstellen.
3. Multiplayer, Chat, Gruppen und gemeinsame Welt integrieren.
4. Acht Klassen, Skills, Quests, Regionen, Gegner, Dungeons und zehn Berufe datengetrieben ausbauen.
5. Crafting, Wirtschaft, Pets, Housing, Gilden, PvP, Auto-Farming und Endgame integrieren.
6. Grafiken, Animationen, Sound, Android-UX und Performance verbessern.
7. Zusammenhängende Alpha stabilisieren und Artefakte liefern.

Arbeite über mehrere Phasen hinweg im selben Lauf, solange sinnvoll machbar. Blockierte Teilaufgaben dokumentieren und unabhängige Aufgaben fortsetzen. Priorität: tatsächlich spielbare Systeme vor oberflächlicher Featurezahl. Keine neue Konzeptphase nach jedem Paket.

## 16. Fortsetzung und Abschluss

Pflege eine kompakte priorisierte Queue mit Status: implementiert/geprüft, implementiert/ungeprüft, teilweise, offen, blockiert. Handoff enthält Branch, Commit, PR, Buildstatus, offene Fehler, relevante Pfade und nächste konkrete Aufgabe. Bei Fortsetzung nur relevante Dokumente und Änderungen seit dem letzten Stand lesen.

Bei tatsächlichem Limit Änderungen sichern, Queue/Handoff aktualisieren und einen kurzen Fortsetzungsauftrag hinterlassen. Keine unbegrenzte Selbstfortsetzung versprechen. Keine eigenmächtigen Merges oder destruktiven Änderungen. Push/PR nur soweit Zugriff und Umgebung dies erlauben; andernfalls lokale Commits und genaue Blockade melden.

Erwartete Lieferung: möglichst umfangreicher spielbarer Alpha-Stand, Android-APK, Browser/PWA, Server, PostgreSQL-Migrationen, grafische Spielwelt, Quellcode, CI und kurze ehrliche Statusübersicht. Physische Android-Abnahme erst an einem größeren Meilenstein; Sicherheitsprüfungen nicht auslassen.

**Starte jetzt mit der tatsächlichen Implementierung. Nutze Agenten gezielt, halte Tokenverbrauch niedrig, integriere ihre Ergebnisse und arbeite nach jedem Paket unmittelbar weiter.**

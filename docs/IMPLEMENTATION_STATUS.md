# Implementierungsstatus (ehrlich, Stand Alpha 0.1)


## Smartphone-Integration

- GPS verwendet bestätigte Gerätekoordinaten. Ohne GPS-Fix werden keine Berliner Spielobjekte angezeigt. Regionale Zellen erzeugen auch fern der gesetzten Spielorte NPCs, Ressourcen, Monster und Elitegegner.
- Standard-, Satelliten- und 3D-Kartenansicht mit gespeicherter Kamera und Helligkeit. Monster verwenden animierte prozedurale Porträts, Kartenkämpfe zählen für Quests und kehren nach gespeicherter Belohnung zur Karte zurück.
- Virtueller Joystick und Routen teilen sich die serverseitigen Richtwerte 5 km/h beim Gehen, 10 km/h beim Rennen und 20 km/h auf dem Fahrrad. Ausgerüstete Reittiere variieren zwischen 25 und 40 km/h. Joystick-Eingaben laufen bei Unterbrechung ab. Questdetails markieren Geber, Zielgebiet und Abgabe.
- Solo-Backups behalten das vorhandene IndexedDB-Format und werden ausschließlich aus dem Titelmenü eingespielt. Der Service Worker bietet Updates am Titelbildschirm an. Audio trennt Musik, Umgebung und Effekte.
- Offen bleiben Live-Nachweis aller Kartenquellen, Installation auf einem physischen Android-Gerät sowie Live-Nachweis des externen Overpass-Endpunkts. Für künftige APK-Updates über dieselbe Installation muss dieselbe Signatur verwendet werden.

## Kartenmenü, persistente Reisen und Immobilien

- Kartenansicht direkt oberhalb der Zoomtasten und in den Spieleinstellungen. Typ und Style können unabhängig gewechselt werden. Die alten Einstellungen werden gelesen und in das getrennte Schema übernommen.
- Valhalla liefert Straßengeometrie für Start, Pause, Fortsetzen, Abbruch und Zielwechsel. Online gilt Serverzeit. Neuberechnung erneuert die Vorschau. Bei einem Routingfehler bleibt für Gehen und Rennen eine ausdrücklich ausgewählte, gestrichelt angezeigte Luftlinienreise bis 2 km möglich. Öffentlicher HTTPS-Routendienst und Geocoding stehen aus.
- Kartencluster gruppieren nahe Marker auf der aktuellen Projektion. Kategorien, Questmarker und Spieler lassen sich filtern. Die Typ- und Style-Auswahl erhält die Spielkoordinaten und stellt sieben eigenständige Vektorstile bereit.
- Der geografische Immobilienmarkt nutzt reale OSM-Umrisse. Online lädt der Server Wohn- und Gewerbegebäude bedarfsgerecht. Fläche und Preis verwenden den Grundriss, Geschossfläche und Zimmerzahl sind Schätzungen. Gekaufte Gebäude behalten ihre gespeicherten Attribute und ihren kostenfreien Schnellreisepunkt. Geografische Vermietung, Baugrundstücke, ALKIS und zusätzliche Eigentumsplätze stehen aus.

## Regionale Inhalte und Online-Moderation

- Die Tagesquest „Die Gegend erkunden“ speichert ein regionales Zielgebiet und zählt die Ankunft serverseitig. Wenn ein öffentlicher OSM-Punkt im Cache liegt, ist das Ziel auch per GPS erreichbar. Generierte Fallback-Ziele zählen ausschließlich im virtuellen Modus.
- Tägliche Feldnotizen verlangen eine bestätigte Beobachtung vor Ort. Regionale Patrouillen zählen gewonnene Kartenkämpfe im zugewiesenen Zielgebiet. Beide verwenden den bestehenden Quest-Spielstand.
- Gilden können Kolosseum und Moorwacht mit autorisiertem Rang und 30 Sekunden Präsenz einnehmen. Feindliche Übernahme erfordert einen aktiven gegenseitigen Gildenkrieg. Die Besitzwechsel werden gespeichert.
- Die drei geografischen Dungeon-Eingänge bieten eine private Gruppeninstanz mit eigenem Kampfzustand. Bossbelohnungen sind pro Figur und Boss einmal täglich verfügbar. Laufende Instanzen enden, wenn sie leer sind. Verdienter Fortschritt bleibt gespeichert.
- Migration 004 hält verifizierte öffentliche OSM-Punkte de-dupliziert mit Ablaufdatum in PostgreSQL. PostGIS nutzt einen räumlichen Index. Ohne Erweiterung stehen SQL-Koordinatenfilter und der bestehende Speicher-Cache bereit.
- Online-Administratoren erhalten ein Dashboard für Serverstatus, Ankündigungen, Kick und Audit. Adminrechte werden auf dem Server geprüft. Mute und Ban sind kontoweit für alle Charaktere des jeweiligen Kontos und lassen sich aufheben. Die öffentliche Mehrspieler-Betriebsprüfung steht aus.

## Persistenz auf dem Entwicklungsbranch
- Kampf-Fortschritt und Logout werden nach erfolgreicher Speicherung bestätigt. Dateispeicher und PostgreSQL/PostGIS sind mit dem neuen Levelaufstieg-/Reconnect-Test geprüft. Solo-Worker und IndexedDB-Wiederherstellung sind im Chromium-Build unter `/NewAgeMMO/` geprüft.
- Die Geräteprüfung und der Nachweis der Veröffentlichung dieses Stands stehen aus. Einzelne Dokumente werden geordnet geschrieben. Systemübergreifende Wirtschaftsaktionen benötigen weiterhin echte Mehrdokument-Transaktionen.

Legende: ✔ implementiert/geprüft · ◐ implementiert/ungeprüft · ◔ teilweise · ✖ offen

**Geprüft durch Ausführung:** `npm run typecheck`, `npm run build`, `npm test` (Server-Integrationstest, 28 Prüfungen: Registrierung, Charakter, Reise, Kampf, EXP/Gold, Persistenz nach Reconnect, 2 Spieler/Chat, Ablehnungen), Browser-E2E mit Chromium (Titel → Account → Charaktererstellung → Spiel → Reise → Kampf/Tod, keine Konsolenfehler).

| Bereich | Status |
|---|---|
| Titelbildschirm (Neues Spiel / Spiel laden / Optionen / Verlassen) | ✔ |
| Account, Login, Token-Resume, 3 Charakterplätze, Charaktererstellung mit Live-Vorschau | ✔ |
| Szenen-Grafik (18 Orte, Tag/Nacht, Wetter, prozedural), Charakterebenen, 27 Monsterarten, Effekte, Schadenszahlen, Sound/Musik (WebAudio) | ✔ (Optik vorläufig, prozedural) |
| Echtzeit-Point-and-Click-Kampf, 8 Klassen × 10 Skills, Passive, Ressourcen, Status/Buffs/DoT/Schilde, Summons | ✔ Kern geprüft; einzelne Skills ◐ |
| Gegner-KI, Elite, 4 Weltbosse mit Phasen, Welt-Events, Respawn, Loot (persönlich), Tod/EXP-Verlust | ◐ (Balance nicht gemessen) |
| Level 1–100, 9 Attribute, Training-EXP (exponentiell), Reset-Stein, Prestige | ◐ |
| Quests (12 Haupt, 15 Neben, 8 Klassen, 10 Berufe, 5 täglich, 3 versteckt, Fraktionswahl) | ◐ |
| 10 Berufe, ~420 Rezepte, Sammeln, Werkstätten, Offline-Produktionswarteschlange, Haltbarkeit/Reparatur | ◐ |
| NPC-Handel, direkter Handel (atomar), Auktionshaus, Stände, Crafting-Aufträge, Post, Lager | ◐ (Handel-Anfrage geprüft) |
| Pets (Brut, Rollen, Evolution, Zucht, Offline-Training) | ◐ |
| Housing (eindeutige Parzellen, wachsendes Angebot, Innenraum-Editor, Etagen, Garten, Miete, Gildenhaus) | ◐ |
| Gruppen, Gilden (Ränge, Lager, Skills, Krieg), Freunde, Chat, Emotes, Profile | ◐ |
| PvP: Arena, Schattenmoor-Zone, Duelle, Normalisierung | ◐ |
| Auto-Farm (zeit-/gebietsbegrenzt, Tränke, Abbruchbedingungen) | ◐ |
| PostgreSQL-Speicher + Migrationen | ◐ Code vorhanden, **nicht gegen echte DB getestet** (CI-Job vorbereitet) |
| PWA (Manifest, Service Worker, Icons) | ◐ Build ok, Installation nicht geprüft |
| Android-APK (Capacitor) | ✖ **nicht gebaut** (kein Android-SDK in dieser Umgebung); Konfiguration + Workflow `android.yml` vorhanden |
| Docker Compose | ◐ nicht ausgeführt |
| Admin-Oberfläche | ✖ nur Server-Befehle (`admin`), keine UI |
| Lasttest 50–100 Spieler | ✖ nicht gemessen |
| Physische Android-Abnahme | ✖ offen |

## v2-Ergänzung
| Bereich | Status |
|---|---|
| Reale Erde: MapLibre + OSM-Kacheln, GPS/virtuelle Bewegung, Einwilligungsdialog | ✔ im Browser geprüft (Solo, Playwright) |
| Dynamische Spawns (Zelle × 20-Min-Bucket, Stufe nach Entfernung zu Städten), Ressourcen, Dungeoneingänge, Quellen, Weltboss-Spawns | ✔ Server-Test; Interaktion/Kampfübergang ◐ |
| Reale Verankerung der 18 Spielorte (Entdeckung + Visit-Quests per Radius), Häuser mit gerundeter Geo-Position | ◐ |
| GPS-Manipulationsschutz (Speed/Teleport/Genauigkeit, Sperre), Datenschutz (Opt-in, 100 m Rundung, Löschfunktion) | ✔ Server-Test |
| PostgreSQL + PostGIS (Migrationen 001–003) | ✔ Integrationstest gegen lokales PostgreSQL 16 + PostGIS 3 |
| Solo-Modus (gesamter Server im Web Worker, IndexedDB) | ✔ im Browser geprüft |
| Grafik semi-realistisch (Licht, Texturen, Rim-Light, Effekte, Icons) | ◐ Screenshots geprüft; Performance auf Handy ungemessen |
| GitHub Pages / Release (APK) Workflows | ◐ siehe README/Deployment; Laufstatus siehe Actions |
| Öffentlicher Multiplayer-Server | ✖ benötigt externe Konten (Render/Neon) |

## Map-First-Umbau
| Bereich | Status |
|---|---|
| Karte als permanente Hauptansicht, Zoom/Drehung/Verschieben | ✔ (Browser-Test, Mobil-Viewport) |
| Keine Stadtansicht/„Erde“-Schaltfläche mehr | ✔ |
| NPCs, Werkstätten, Teleporter als Kartenobjekte mit Nähe-Interaktion | ✔ Server-Logik; Dialog über Karte geprüft (Server-Test) |
| Monster/Dungeons → Kampfszene und Zurück zur Karte | ✔ Logik; Szene im Browser nicht separat geprüft |
| Teleportportale und virtuelle Reisezeit | ✔ Geo-Integrationstest und Web-Build |
| Eroberbare Gebiete | ✔ Kolosseum und Moorwacht |
| Ereignisleiste, Kampfskills nur im Kampf, Chat eingeklappt | ✔ |

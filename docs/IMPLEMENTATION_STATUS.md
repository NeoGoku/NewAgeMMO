# Implementierungsstatus (ehrlich, Stand Alpha 0.1)


## Smartphone-Integration

- GPS verwendet bestätigte Gerätekoordinaten. Ohne GPS-Fix werden keine Berliner Spielobjekte angezeigt. Regionale Zellen erzeugen auch fern der gesetzten Spielorte NPCs, Ressourcen, Monster und Elitegegner.
- Standard-, Satelliten- und 3D-Kartenansicht mit gespeicherter Kamera und Helligkeit. Monster verwenden animierte prozedurale Porträts, Kartenkämpfe zählen für Quests und kehren nach gespeicherter Belohnung zur Karte zurück.
- Virtueller Joystick mit serverseitiger Geschwindigkeitsgrenze und Ablauf bei Eingabeausfall. Questdetails markieren Geber, Zielgebiet und Abgabe.
- Solo-Backups behalten das vorhandene IndexedDB-Format und werden ausschließlich aus dem Titelmenü eingespielt. Der Service Worker bietet Updates am Titelbildschirm an. Audio trennt Musik, Umgebung und Effekte.
- Offen bleiben Live-Nachweis aller Kartenquellen, Installation auf einem physischen Android-Gerät sowie Live-Nachweis des externen Overpass-Endpunkts. Für künftige APK-Updates über dieselbe Installation muss dieselbe Signatur verwendet werden.

## Kartenmenü, persistente Reisen und Immobilien

- Kartenansicht direkt oberhalb der Zoomtasten und in den Spieleinstellungen. Typ und Style können unabhängig gewechselt werden. Die alten Einstellungen werden gelesen und in das getrennte Schema übernommen.
- Valhalla liefert Straßenverläufe. Start, Pause, Fortsetzen, Abbruch und Zielwechsel verwenden dieselbe zeitbasierte, gespeicherte Reise. Online gilt die Serverzeit. Zu Fuß und Rennen stehen direkt bereit, Fahrrad, Reittier und Flug nutzen Ausrüstung, Motorfahrzeuge Level-Freigaben. Geocoding und öffentlicher Routendienst sind offen.
- Die erste Immobilienregion nutzt bereitgestellte OSM-Wohngebäude. Grundriss und geographische Fläche stammen aus dem Katalog. Wohnfläche, Geschosse und Zimmer sind Schätzungen. Marktfilter berücksichtigen Preis, Typ, Geschossfläche und Entfernung. Kauf und Rückverkauf verwenden Spielgold. Die Schnellreise prüft den Besitz serverseitig. Ohne Katalog sind die verifizierten Funktionen nur mit Testdaten geprüft. Vermietung, Bebauung, ALKIS und weitere Immobilienarten stehen aus.

## Regionale Inhalte und Online-Moderation

- Die Tagesquest „Die Gegend erkunden“ speichert ein regionales Zielgebiet und zählt die Ankunft serverseitig. Wenn ein öffentlicher OSM-Punkt im Cache liegt, ist das Ziel auch per GPS erreichbar. Generierte Fallback-Ziele zählen ausschließlich im virtuellen Modus.
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
| Eroberbare Gebiete | ✖ offen |
| Ereignisleiste, Kampfskills nur im Kampf, Chat eingeklappt | ✔ |

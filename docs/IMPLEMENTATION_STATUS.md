# Implementierungsstatus (ehrlich, Stand Alpha 0.1)
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

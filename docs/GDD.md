# Game Design Document

## 0. Kernprinzip: Map-First (verbindlich)
- Die reale Erde ist die Spielwelt. Die **Weltkarte (MapLibre + OpenStreetMap)** ist permanent die Hauptansicht; die frühere Stadtansicht ist entfernt.
- Der eigene Charakter steht auf der Karte; Zoom, Drehung und Verschieben sind möglich. Dunkler, futuristischer Urban-Fantasy-Stil (Ingress-Prime-artig), Straßen/Gebäude/Parks/Gewässer bleiben erkennbar.
- Auf der Karte platziert: Monster und Weltbosse, NPCs und Questgeber, Händler und Banken, Sammelressourcen, Dungeoneingänge, Werkstätten, Spielerwohnungen, Gildenhäuser, Teleporter, eroberbare Gebiete (geplant), andere Spieler (datenschutzkonform gerundet).
- Antippen eines Objekts öffnet die Interaktion. Kämpfe, Dungeons, Handel, Crafting und Housing nutzen eigene Ansichten; danach Rückkehr zur Karte.
- Bewegung: GPS-Modus (wie Pokémon GO) oder virtuell durch Antippen eines Ziels; beide gleichwertig; sichtbare Route und Reisezeit; Reisegeschwindigkeit durch Reittiere. Teleportportale verbinden im virtuellen Modus bereits entdeckte Ziele.
- Smartphone-Oberfläche: Karte bildschirmfüllend, kompakte Charakteranzeige oben, Ereignisleiste unten mit fünf Bereichen (Karte, Helden, Inventar, Quests, Mehr), Kampfskills nur im Kampf, Chat standardmäßig eingeklappt, keine überlappenden Bedienelemente.

**Setting:** Aurelia, alternatives 2030 – Magie ist seit einem Jahrzehnt öffentlich, Technik und Zauberei koexistieren. Drei Städte (Aurelia, Port Nocturne, Kristallspitze), Wildnis, Ruinen, Dungeons, Bossregionen, Arena. Fraktionen: Magierrat, Schattensyndikat, Technikerunion. Hauptgeschichte „Das Erwachen der Leere“ (12 Kapitel) bis zum Void-Herz.
**Kern:** Point-and-Click-Echtzeitkampf (Ziel antippen → Auto-Angriff + manuelle Skills mit Cooldown/Ressource), grafische Szenen statt Textmenüs, ein gemeinsamer Server ohne Channels, alle Plattformen identisch.
**Klassen (8):** Dunkler Magier, Heller Magier, Bogenschütze, Schildschwert, Doppelschwert, Heiler, Kreaturen-Beschwörer, Tank – je 10 aktive Skills, 4 Passive, eigene Ressource (Mana/Fokus/Ausdauer/Energie/Seelenkraft/Wut).
**Fortschritt:** Kampfbelohnungen und Levelaufstiege überstehen Logout und Reconnect. Solo- und Online-Spielstände werden getrennt geführt. Level 1–100, 9 Attribute, 1 Punkt/Level, unbegrenzte Zusatzpunkte via Training-EXP (exponentielle Kosten), Stein der Neugeburt, EXP-Verlust 5 % beim Tod, Prestige ab 100 ohne Reset.
**Wirtschaft:** 10 Berufe (3 Sammel-, 7 Herstellungsberufe), Werkstätten, Produktionswarteschlange (offline), Seltenheiten Normal–Legendär, Haltbarkeit/Reparatur, NPC-Handel, direkter Handel (atomar), Auktionshaus, Verkaufsstände, Crafting-Aufträge, Post, Lager.
**Sozial:** Gruppen bis 10 (persönliche Beute, EXP-Modus), Gilden (Ränge, Lager, Skills, Krieg, Gildenhaus), Freunde, Chat (Ort/Gruppe/Gilde/Flüstern/Welt), Emotes, Profile.
**PvP:** nur Arena, ausgewiesene Zonen (Schattenmoor) und Duelle; serverseitig normalisierte Werte.
**Pets/Housing:** Begleiter-Pets (6 Rollen, Evolution, Zucht, Offline-Training), eindeutige Parzellen im Wohnviertel, grafische 2D-Innenräume mit Möbelplatzierung, Etagen, Garten, Werkbank, Miete, Gildenhäuser.
**Endgame:** Prestige, Weltbosse mit Phasen (Azgoroth, Omega-Prime, Seraph Valkyr, Void-Herz), tägliche Quests, Berufsmeisterschaft, Pet-Zucht, Housing, Gildenfortschritt.

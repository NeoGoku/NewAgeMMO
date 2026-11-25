# Architektur
```
Client (React+Canvas, PWA/Capacitor) ⇄ WebSocket (JSON) ⇄ Server (Node/TS, Tick 400 ms) ⇄ Store (PostgreSQL JSONB | JSON-Dateien)
```
- **Monorepo** mit npm-Workspaces; `@nam/shared` (Typen, Protokoll, Balance) und `@nam/game-data` (Inhalte) werden von Client **und** Server aus dem Quelltext genutzt.
- **Server-Loop:** `worldTick()` (game.ts) simuliert nur Orte mit Spielern: Bewegung, Auto-Angriff, Summons, Pets, Mob-KI (Aggro/Threat, Skills, Phasen), Wetter, Respawn, Auto-Farm; sendet pro Ort ein `state`-Paket.
- **Autorität:** Client sendet `walk/target/skill/…`; Schaden, Beute, EXP, Quests, Handel, Crafting entstehen ausschließlich im Server. PvP nutzt normalisierte Werte (`pvpAttrs/pvpGear`).
- **Persistenz:** Dokumentenspeicher (`docs(coll,id,data jsonb)`), Charaktere werden bei Änderungen (dirty) alle ≤30 s und bei Logout/Handel/Markt sofort gespeichert. Migrationen: `database/migrations/*.sql`, beim Start angewendet (`schema_migrations`).
- **Sicherheit:** scrypt-Passwort-Hashes, Sitzungs-Tokens (gehasht gespeichert, 30 Tage), Login-Sperre nach 5 Fehlversuchen, Token-Bucket-Ratelimit pro Verbindung (30 msg/s), Replay-Schutz über monoton steigende `rid`, Payload ≤16 KB, Eingabevalidierung, Admin nur für `ADMIN_USERS`, Items mit eindeutiger `uid` (Duplikationsschutz durch synchrone In-Memory-Transaktionen).
- **Skalierung:** Zielgröße 50–100 gleichzeitige Spieler auf einem Prozess (nicht gemessen, nur `tickMs` über `/health` einsehbar). Spätere Skalierung: Sharding nach Orten.
- **Offline-Fortschritt:** Crafting-Jobs (Endzeitstempel), Pet-Training/Brut/Zucht, Garten, Marktabwicklung per Post – alles zeitstempelbasiert, serverseitig begrenzt (8 h).
- **Render:** `apps/web/src/render/*` zeichnet alles prozedural (Szenen, Charakter-Ebenen, Monster, Effekte, Icons), `audio.ts` synthetisiert Musik und SFX per WebAudio.

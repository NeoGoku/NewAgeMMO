# Handoff
- Branch: `ccr-c83759b9-34xxzv` (Stand: letzter Commit, siehe `git log`). Kein PR angelegt, nichts gemergt.
- Build/Test: lokal grün (typecheck, build, `npm test`, Chromium-E2E). CI-Workflows (`ci.yml`, `android.yml`) noch nicht auf GitHub gelaufen.
- Offene Fehler/Risiken: Balance ungemessen; PostgreSQL-Pfad ungetestet; APK ungebaut; Optik prozedural/vorläufig.
- Relevante Pfade: Server `apps/server/src/{game,handlers,social,market,pethouse,quests,world,index}.ts`; Daten `packages/game-data/src`; Client `apps/web/src/{game,store,net}.ts`, `ui/*`, `render/*`, `audio.ts`.
- Nächste Aufgabe: Queue Punkt 1–2 (CI-Läufe prüfen), dann Punkt 3–5.

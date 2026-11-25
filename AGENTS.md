# AGENTS.md – Arbeitsregeln für Coding-Agenten für NewAgeMMO
Kanonische Anforderungen: `docs/GDD.md` (Spielkonzept), `docs/ARCHITECTURE.md` (Technik), `docs/DEVELOPMENT_QUEUE.md` (Aufgaben), `docs/DEVELOPMENT_HANDOFF.md` (Fortsetzung). Keine Vollkopien hier.

## Regeln
- Server ist autoritativ: Client sendet nur Absichten; EXP, Gold, Items, Kampf, Handel werden ausschließlich in `apps/server` entschieden.
- Inhalte datengetrieben in `packages/game-data` (stabile IDs, `validateData()` muss leer sein). Formeln/Balance zentral in `packages/shared/src/balance.ts`.
- Neue Nachrichten: Handler in `apps/server/src/*.ts` per `H.name = (p, m) => string|void|obj` (String = Fehlertext). Eingaben immer validieren (`S()`, `N()`).
- Transaktionen (Handel/Markt/Gilde) laufen synchron im Speicher und werden danach persistiert; Items haben eindeutige `uid`.
- Grafik/Ton sind prozedural (`apps/web/src/render`, `apps/web/src/audio.ts`); keine fremden Assets ohne Eintrag in `docs/ASSET_LICENSES.md`.
- Vor Abschluss: `npm run typecheck`, `npm test`, `npm run build`. Keine Secrets committen. Keine destruktiven Git-Operationen.
- Nach jedem Paket: `docs/DEVELOPMENT_QUEUE.md` + `docs/IMPLEMENTATION_STATUS.md` aktualisieren, committen.

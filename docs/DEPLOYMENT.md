# Veröffentlichung & Hosting
**Automatisiert (GitHub Actions):** `pages.yml` baut/veröffentlicht die Browser-Version (Pages), `release.yml` baut nach Code-Änderungen auf `main` oder bei Tags `v*` die Debug-APK + PWA-ZIP und legt ein GitHub Release an, `ci.yml` testet (inkl. PostgreSQL-Job).
## Einmalig nötig (kann nicht automatisiert werden, benötigt Repo-Admin)
1. **Pages aktivieren:** Repo → Settings → Pages → *Source: GitHub Actions*. (Das Workflow-Token darf Pages nicht selbst aktivieren.) Außerdem unter Settings → Environments → github-pages ggf. Tags `v*` als erlaubte Deployment-Quelle ergänzen.
2. **Release auslösen:** Tag `vX.Y.Z` pushen (oder Actions → *Release* → Run). Pages deployt von `main`/Tags.
## Multiplayer-Server (optional, kostenlos)
GitHub Pages hostet nur statische Dateien. Persistenter Server + DB extern:
- **Render (Free Web Service)** per Blueprint `render.yaml` (Docker). Schläft nach Inaktivität (Kaltstart ~30–60 s), keine persistente Platte → Datenbank extern.
- **Neon (Free Postgres, PostGIS verfügbar)** → Connection-String als `DATABASE_URL` im Render-Service. Migrationen laufen beim Start automatisch.
- Danach Repo-Variable **`NAM_SERVER_URL`** = `wss://<dein-service>.onrender.com` setzen und Pages/Release neu laufen lassen → Client/APK verbinden automatisch.
Alternativen (nicht geprüft/Kreditkarte): Fly.io, Koyeb, Oracle Always Free VM mit `docker compose`.
## Ohne Server
Solo-Modus: kompletter Server im Browser-Worker, Spielstand lokal (IndexedDB).
## Datenschutz/Sicherheit
Siehe README „Reale Erde“; Standortdaten werden nicht dauerhaft präzise gespeichert (nur auf ~100 m gerundet im Charakter, löschbar).

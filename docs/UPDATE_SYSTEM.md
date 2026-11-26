# Automatisches Web-Update

**Diagnose (Geschwindigkeitsmeldung 50 km/h):** Der Quellcode von `main` liefert für Gehen 5/3,6 m/s. Der Client wurde aber mit `registerType: 'prompt'` gebaut, `index.html` stand im Precache, und der Update-Button erschien nur auf dem Titelbildschirm. Ein installierter/zwischengespeicherter Client blieb dadurch auf einem alten Bundle, bis jemand den Button fand. Das ist die wahrscheinlichste Ursache, aber nicht bewiesen; zusätzlich wurden gespeicherte Wege mit alten Geschwindigkeitswerten nie neu abgeleitet (jetzt behoben). Einen Codepfad, der exakt 50 km/h erzeugt, gibt es im aktuellen Stand nicht.

## Ablauf
1. Jeder Produktionsbuild erzeugt `version.json` (`buildId` = Commit, `commit`, `release` nur wenn ein Tag erreichbar ist, `builtAt`) und bettet dieselben Werte als `__NAM_BUILD__` ein.
2. Prüfung bei Start, Rückkehr in den Vordergrund, `pageshow` (BFCache), `online` und alle 5 Minuten (sichtbar): `fetch('version.json?t=…', {cache:'no-store'})`. Keine GitHub-API.
3. Neue Build-ID → Service Worker aktualisieren, Startseite und Hauptdatei per `no-store` auf Vollständigkeit prüfen (CDN-Verzögerung), dann – wenn kein Kampf/Szene/Handel/Reise/Dialog läuft – einmal neu laden. Max. 3 Versuche je Zielversion mit Wartezeit, danach verständliche Meldung. Offline wird als „Offline-Modus“ angezeigt.
4. Service Worker: gehashte Assets precached; `index.html` und `version.json` **nicht** (HTML network-first mit `no-store`, Offline-Fallback aus Cache `nam-pages`); `skipWaiting` + `clientsClaim`; veraltete Workbox-Precaches werden entfernt. Fremde Caches werden nicht angefasst. Spielstände (IndexedDB/localStorage/Server) werden nie gelöscht.

## Altclients
Clients mit der alten Version prüfen nicht selbst. Der neue `sw.js` (gleicher Pfad) wird vom Browser selbst nachgeladen, übernimmt per `skipWaiting`, und der nächste Start/Reload lädt die neue Seite vom Netz. Ein bereits geöffneter alter Tab lädt nicht von allein neu. **Einmalig manuell:** App/Tab schließen und neu öffnen (iOS: Web-App aus dem App-Wechsler wegwischen). Nicht erreichbar sind Clients, die den Service Worker gar nicht mehr nachladen.

GitHub Pages sendet `Cache-Control: max-age=600` für HTML; deshalb nutzt die Prüfung immer `no-store` und Cache-Busting.

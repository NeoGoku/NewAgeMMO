# Android (Capacitor)
Die APK bündelt den Web-Client. Der Server wird in der App unter *Optionen → Serveradresse* gesetzt (z. B. `ws://192.168.0.10:8080` im LAN oder `wss://dein-server`).
Build (lokal, benötigt JDK 17 + Android SDK):
```
npm run build -w @nam/web && cd apps/android && npm i && npx cap add android && npx cap sync android && cd android && ./gradlew assembleDebug
```
Das GitHub-Workflow `android.yml` erzeugt die Debug-APK als Artefakt. Hinweis: Cloud-Build ist kein Server-Hosting.

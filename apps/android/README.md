# Android (Capacitor)
Die APK bündelt den Web-Client. Der Server wird in der App unter *Optionen → Serveradresse* gesetzt (z. B. `ws://192.168.0.10:8080` im LAN oder `wss://dein-server`).
Build (lokal, benötigt JDK 17 + Android SDK):
```
npm run build -w @nam/web && cd apps/android && npm i && npx cap add android && node prepare.mjs && npx cap sync android && cd android && ./gradlew assembleDebug
```
Der GitHub-Workflow `release.yml` veröffentlicht die Debug-APK und das Web-ZIP.

Android akzeptiert ein Update über die bisherige Installation nur mit derselben Signatur. Im GitHub-Repository kann dafür `NAM_ANDROID_DEBUG_KEYSTORE_B64` als Actions-Secret gesetzt werden. Der Wert ist der Base64-kodierte persistente Debug-Keystore (Alias `androiddebugkey`, Standardpasswort für den Debug-Build). Den Keystore privat sichern und für nachfolgende APKs wiederverwenden. Der Schlüssel einer früher von einem flüchtigen Runner signierten APK lässt sich daraus nicht rekonstruieren. Vor einer Neuinstallation einen verfügbaren Solo-Export sichern. Der HTTP-Localhost-Ursprung der App bleibt wegen vorhandener WebView-Spielstände erhalten.

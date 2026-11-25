# Android mit Capacitor

Die APK bündelt denselben Web-Client wie GitHub Pages. App-ID `de.newagemmo.app` und der WebView-Ursprung `http://localhost` bleiben für vorhandene Spielstände erhalten.

## Lokaler Entwicklungsbuild

Voraussetzungen sind JDK 17 und das Android SDK.

```bash
npm run build -w @nam/web
cd apps/android
npm install
npx cap add android
node prepare.mjs
npx cap sync android
cd android
./gradlew assembleDebug
```

## Dauerhafte Signierung für öffentliche Releases

Ein Betreiber erstellt den privaten Schlüssel einmal und sichert ihn außerhalb des Repositorys. Wer den Schlüssel einer bereits installierten APK besitzt, kann ihn als PKCS#12 mit dem Alias `newagemmo` übernehmen. So bleibt das Zertifikat erhalten.

```bash
keytool -genkeypair -alias newagemmo -keyalg RSA -keysize 3072 -validity 10000 \
  -storetype PKCS12 -keystore newagemmo-release.p12
keytool -exportcert -alias newagemmo -keystore newagemmo-release.p12 | sha256sum
```

In **Settings → Secrets and variables → Actions** hinterlegen:

- Secret `NAM_ANDROID_KEYSTORE_B64` mit dem Base64-kodierten Inhalt der PKCS#12-Datei.
- Secret `NAM_ANDROID_KEYSTORE_PASSWORD` mit dem Passwort dieser Datei.
- Variable `NAM_ANDROID_CERT_SHA256` mit den 64 Hex-Zeichen aus `sha256sum`.

`release.yml` baut eine Release-APK und veröffentlicht sie erst, wenn `apksigner` das festgelegte Zertifikat bestätigt. Folge-Builds verwenden denselben Schlüssel und die Workflow-Laufnummer als Versionscode. Solange die Konfiguration fehlt, erscheinen Pages und Web-ZIP separat.

Die bisherigen APKs `v0.2.7` und `v0.2.8` haben unterschiedliche Debug-Signaturen. Wenn der bisherige private Schlüssel fehlt, verlangt Android beim ersten Wechsel zur neuen Release-Signatur eine Neuinstallation. Sichere den Solo-Spielstand vorher über die Exportfunktion, soweit die installierte Version sie anbietet, und spiele die Sicherung anschließend aus den Titeloptionen wieder ein.

Beim späteren Wechsel zu Google Play muss die dort ausgelieferte APK dieselbe App-ID und dasselbe Signaturzertifikat wie der geplante Update-Pfad besitzen. Bei Play App Signing sind Upload-Schlüssel und App-Signierschlüssel getrennte Rollen. Vor der ersten Store-Freigabe die von Google ausgelieferte Signatur mit dem bestehenden Fingerabdruck vergleichen. Die Schlüsseldatei und ihr Passwort gehören in getrennt geschützte Sicherungen. Der Fingerabdruck darf dokumentiert werden.

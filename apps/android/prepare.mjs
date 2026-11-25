import { readFile, writeFile } from 'node:fs/promises';

// Capacitor requests these permissions at runtime when WebView geolocation is
// used. Preserve the configured WebView origin so existing IndexedDB is reused.
const manifest = new URL('./android/app/src/main/AndroidManifest.xml', import.meta.url);
let xml = await readFile(manifest, 'utf8');
for (const name of ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION']) {
  const permission = 'android.permission.' + name;
  if (!xml.includes('"' + permission + '"')) {
    xml = xml.replace('</manifest>', `    <uses-permission android:name="${permission}" />\n</manifest>`);
  }
}
await writeFile(manifest, xml);

const buildNumber = process.env.GITHUB_RUN_NUMBER;
if (buildNumber && /^[1-9]\d{0,8}$/.test(buildNumber)) {
  const file = new URL('./android/app/build.gradle', import.meta.url);
  const gradle = await readFile(file, 'utf8');
  await writeFile(file, gradle.replace(/\bversionCode\s+\d+/, 'versionCode ' + buildNumber));
}

// Rendert Vorschau- und Vergleichsbilder aus der ECHTEN Karte (MapLibre + OpenFreeMap-Kacheln) mit Playwright.
// Voraussetzung: `npm run dev -w @nam/web -- --port 5199` läuft. Aufruf:
//   node scripts/render-style-previews.mjs <ausgabeordner> [previews|compare|all]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = process.argv[2] ?? 'shots';
const mode = process.argv[3] ?? 'all';
const base = process.env.LAB_URL ?? 'http://127.0.0.1:5199/style-lab.html';
mkdirSync(out, { recursive: true });
const STYLES = ['underground', 'metro-noir', 'west-coast', 'frontier', 'pixel-adventure', 'neon-district'];
// Einheitlicher Vergleichsausschnitt Braunschweig: Innenstadt, Theaterpark/Oker-Wallgraben, Wohngebiet
const CITY = { lon: 10.5267, lat: 52.2650, zoom: 14.6 };
const WORLD = { lon: 12, lat: 28, zoom: 1.3 };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function shot(file, params, w, h, scale = 1) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  await page.goto(`${base}?${q}`);
  await page.waitForFunction('window.__ready === true', null, { timeout: 90000 }).catch(() => console.warn('Zeitüberschreitung', file));
  await page.waitForTimeout(1200);
  const errors = await page.evaluate('window.__errors');
  if (errors.length) console.warn(file, 'Fehler:', [...new Set(errors)].slice(0, 3));
  await page.screenshot({ path: `${out}/${file}` });
  await page.close();
}
if (mode !== 'compare') {
  for (const style of STYLES) {
    await shot(`${style}.png`, { style, ...CITY }, 360, 170, 1);
    await shot(`${style}-world.png`, { style, ...WORLD }, 120, 120, 1);
  }
}
if (mode !== 'previews') {
  for (const style of STYLES) {
    await shot(`compare-city-${style}.png`, { style, ...CITY, zoom: 15.2 }, 640, 420);
    await shot(`compare-world-${style}.png`, { style, ...WORLD }, 640, 420);
  }
}
await browser.close();

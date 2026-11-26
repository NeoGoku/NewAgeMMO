import { defineConfig } from 'vite'; import { existsSync } from 'node:fs'; import { execSync } from 'node:child_process'; import { fileURLToPath } from 'node:url'; import react from '@vitejs/plugin-react'; import { VitePWA } from 'vite-plugin-pwa';
const git = (cmd: string) => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
const commit = process.env.GITHUB_SHA || git('git rev-parse HEAD') || 'unbekannt';
const dirty = !process.env.GITHUB_SHA && !!git('git status --porcelain');
// Release nur, wenn der Build wirklich von einem Tag stammt bzw. ein Tag erreichbar ist; sonst keine erfundene Versionsnummer.
const release = process.env.GITHUB_REF_TYPE === 'tag' ? (process.env.GITHUB_REF_NAME ?? '') : git('git describe --tags --abbrev=0');
const build = { buildId: commit.slice(0, 12) + (dirty ? '+lokal' : ''), commit, release, builtAt: new Date().toISOString() };
const versionFile = { name: 'nam-version-json',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { name: 'nam-build', content: build.buildId }, injectTo: 'head' as const }],
  generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: string }) => void }) { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(build) }); } };
const bundledPropertyCatalog = existsSync(new URL('./public/braunschweig.geojson', import.meta.url));
const walkingNetwork = 'braunschweig-walking.json';
export default defineConfig({
  define: { __NAM_BUILD__: JSON.stringify(build), 'import.meta.env.VITE_BUNDLED_PROPERTY_CATALOG_URL': JSON.stringify(bundledPropertyCatalog ? 'braunschweig.geojson' : ''),
    'import.meta.env.VITE_BUNDLED_WALKING_NETWORK': JSON.stringify(existsSync(new URL('./public/' + walkingNetwork, import.meta.url)) ? walkingNetwork : '') },
  base: process.env.BASE_PATH || './', plugins: [react(), versionFile, VitePWA({ registerType: 'autoUpdate', injectRegister: false, includeAssets: ['icon.svg'], manifest: { name: 'NewAgeMMO', short_name: 'NewAgeMMO', description: 'Kostenloses Point-and-Click-MMORPG im alternativen Jahr 2030', theme_color: '#0b0f1e', background_color: '#0b0f1e', display: 'fullscreen', orientation: 'any', start_url: './', icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }, { src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] }, workbox: {
    // Einstiegsseite und version.json werden bewusst NICHT vorab gecacht: HTML läuft network-first, version.json immer über das Netz.
    globPatterns: ['**/*.{js,css,svg,png,jpg,webp,geojson,pbf}', 'braunschweig-walking.json'], globIgnores: ['**/index.html', '**/404.html', '**/version.json'],
    maximumFileSizeToCacheInBytes: 5e6, skipWaiting: false, clientsClaim: true, cleanupOutdatedCaches: true, navigateFallback: null,
    runtimeCaching: [
      { urlPattern: ({ url }: { url: URL }) => url.pathname.endsWith('/version.json'), handler: 'NetworkOnly' },
      { urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate', handler: 'NetworkFirst',
        options: { cacheName: 'nam-pages', networkTimeoutSeconds: 5, fetchOptions: { cache: 'no-store' }, matchOptions: { ignoreSearch: true }, expiration: { maxEntries: 4 } } }
    ]
  } })],
  resolve: { alias: { 'node:crypto': fileURLToPath(new URL('./src/solo/shim-crypto.ts', import.meta.url)) } }, worker: { format: 'es' }, server: { port: 5173 }, build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
});

import { defineConfig } from 'vite'; import { existsSync } from 'node:fs'; import { fileURLToPath } from 'node:url'; import react from '@vitejs/plugin-react'; import { VitePWA } from 'vite-plugin-pwa';
const bundledPropertyCatalog = existsSync(new URL('./public/braunschweig.geojson', import.meta.url));
const walkingNetwork = 'braunschweig-walking.json';
export default defineConfig({
  define: { 'import.meta.env.VITE_BUNDLED_PROPERTY_CATALOG_URL': JSON.stringify(bundledPropertyCatalog ? 'braunschweig.geojson' : ''),
    'import.meta.env.VITE_BUNDLED_WALKING_NETWORK': JSON.stringify(existsSync(new URL('./public/' + walkingNetwork, import.meta.url)) ? walkingNetwork : '') },
  base: process.env.BASE_PATH || './', plugins: [react(), VitePWA({ registerType: 'prompt', includeAssets: ['icon.svg'], manifest: { name: 'NewAgeMMO', short_name: 'NewAgeMMO', description: 'Kostenloses Point-and-Click-MMORPG im alternativen Jahr 2030', theme_color: '#0b0f1e', background_color: '#0b0f1e', display: 'fullscreen', orientation: 'any', start_url: './', icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }, { src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] }, workbox: { globPatterns: ['**/*.{js,css,html,svg,png,jpg,webp,geojson,pbf}', 'braunschweig-walking.json'], maximumFileSizeToCacheInBytes: 5e6 } })],
  resolve: { alias: { 'node:crypto': fileURLToPath(new URL('./src/solo/shim-crypto.ts', import.meta.url)) } }, worker: { format: 'es' }, server: { port: 5173 }, build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
});

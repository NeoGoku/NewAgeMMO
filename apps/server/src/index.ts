import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { makeStore } from './store-node'; import { G } from './state'; import { createCore, log } from './core'; import { LOCS, NPCS } from '@nam/game-data';
import { configureRegionalProperties } from './geo-property-regions';
import { configureOsm } from './geo-osm';
import { WalkingNetwork, WALKING_NETWORK_MAX_BYTES } from './walking-network';
import { readPropertyCatalog } from './property-file';
const PORT = Number(process.env.PORT || 8080);
async function main() {
  const store = makeStore();
  const bundledCatalog = fileURLToPath(new URL('../../web/public/braunschweig.geojson', import.meta.url));
  const catalogPath = process.env.PROPERTY_CATALOG_GEOJSON ?? (fs.existsSync(bundledCatalog) ? bundledCatalog : undefined);
  const walkingPath = fileURLToPath(new URL('../../web/public/braunschweig-walking.json', import.meta.url));
  const walkingNetwork = fs.existsSync(walkingPath) ? async () => {
    if ((await fs.promises.stat(walkingPath)).size > WALKING_NETWORK_MAX_BYTES) throw new Error('OSM-Gehwegenetz ist zu groß');
    return new WalkingNetwork(JSON.parse(await fs.promises.readFile(walkingPath, 'utf8')));
  } : undefined;
  const core = await createCore(store, { propertyCatalog: await readPropertyCatalog(catalogPath),
    adminUsers: () => process.env.ADMIN_USERS, routingUrl: process.env.VALHALLA_URL, walkingNetwork });
  const overpass = process.env.OSM_OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
  configureOsm(overpass, store.osmCache);
  configureRegionalProperties(process.env.PROPERTY_OVERPASS_URL ?? overpass);
  const server = http.createServer((req, res) => {
    const cors = { 'access-control-allow-origin': '*' };
    if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json', ...cors }); return res.end(JSON.stringify({ ok: true, online: [...G.players.values()].filter(p => p.online).length, tickMs: G.stats.tickMs, uptime: Math.round((Date.now() - G.startedAt) / 1000), store: G.store.kind })); }
    const dist = process.env.WEB_DIST || path.resolve(process.cwd(), '../web/dist'); let f = path.join(dist, decodeURIComponent((req.url || '/').split('?')[0])); if (!f.startsWith(dist)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html'); if (!fs.existsSync(f)) { res.writeHead(404, cors); return res.end('NewAgeMMO Server läuft. Web-Client: npm run build -w @nam/web'); }
    const ext = path.extname(f); res.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.geojson': 'application/geo+json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' } as any)[ext] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });
  wss.on('connection', (ws, req) => core.onConnection(ws as any, String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')));
  let stopping = false;
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => {
    if (stopping) return;
    stopping = true;
    log('shutdown');
    try { await core.shutdown(); process.exit(0); }
    catch (error) { log('shutdown_error', { msg: String(error) }); process.exit(1); }
  });
  server.listen(PORT, () => log('listening', { port: PORT, locs: Object.keys(LOCS).length, npcs: Object.keys(NPCS).length }));
}
main().catch(e => { console.error(e); process.exit(1); });

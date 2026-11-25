import { spawn } from 'node:child_process'; import WebSocket from 'ws'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { haversine, GEO, GEO_TRAVEL_MODES, type Character } from '@nam/shared';
import { createServer } from 'node:http';
import { makeStore } from '../src/store-node';
const PORT = 8700 + Math.floor(Math.random() * 200); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nam-'));
const requestsToRouter: any[] = [];
const router = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const query = JSON.parse(body);
  requestsToRouter.push(query);
  const [start, end] = query.locations;
  const bend = { lat: start.lat + .0003, lon: end.lon };
  let lat = 0, lon = 0, shape = '';
  function encodeDelta(delta: number) {
    let value = delta < 0 ? -delta * 2 - 1 : delta * 2;
    while (value >= 32) { shape += String.fromCharCode(63 + (value % 32) + 32); value = Math.floor(value / 32); }
    shape += String.fromCharCode(63 + value);
  }
  for (const point of [start, bend, end]) {
    const nextLat = Math.round(point.lat * 1e6), nextLon = Math.round(point.lon * 1e6);
    encodeDelta(nextLat - lat);
    encodeDelta(nextLon - lon);
    lat = nextLat;
    lon = nextLon;
  }
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ trip: { status: 0, legs: [{ shape }], summary: { time: 70 } } }));
});
await new Promise<void>(resolve => router.listen(0, '127.0.0.1', resolve));
const routerAddress = router.address();
if (!routerAddress || typeof routerAddress === 'string') throw new Error('Keine Test-Routingadresse');
const srv = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, OSM_OVERPASS_URL: '', VALHALLA_URL: `http://127.0.0.1:${routerAddress.port}` }, stdio: 'ignore' });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fail = 0; const ok = (c: any, m: string) => { if (!c) fail++; console.log(c ? '✓ ' + m : (process.env.GITHUB_ACTIONS ? '::error::' : '✗ ') + m); };
(async () => {
  const { OsmPoints } = await import('../src/geo-osm');
  const queryPoint = { lat: 52.2689, lon: 10.5268 };
  let requests = 0;
  let query = '';
  const osm = new OsmPoints('https://overpass.example/interpreter', async (_url, init) => {
    requests++;
    query = new URLSearchParams(String(init?.body)).get('data') || '';
    return Response.json({ elements: [
      { type: 'node', id: 1, ...queryPoint, tags: { leisure: 'park', name: 'Testpark' } },
      { type: 'node', id: 2, lat: 52.52, lon: 13.4, tags: { leisure: 'park', name: 'Falsche Region' } },
      { type: 'node', id: 3, ...queryPoint, tags: { leisure: 'park', name: 'Privat', access: 'private' } },
    ] });
  });
  await Promise.all([osm.load(queryPoint.lat, queryPoint.lon), osm.load(queryPoint.lat, queryPoint.lon)]);
  ok(requests === 1 && query.includes('[bbox:') && query.includes('out center 80') && !query.includes(String(queryPoint.lat)), 'OSM-Import verwendet eine gerundete, begrenzte Region und bündelt Anfragen');
  const imported = osm.nearby(queryPoint.lat, queryPoint.lon, 1200);
  ok(imported.length === 1 && imported[0].name === 'Testpark' && imported[0].id === 'osm:node:1', 'OSM-Import verwirft entfernte und private Objekte');
  const regions = new Map();
  const persistent = {
    async getRegion(id: string) { return regions.get(id) ?? null; },
    async putRegion(id: string, region: unknown) { regions.set(id, structuredClone(region)); },
  };
  const fixture = async () => Response.json({ elements: [{ type: 'node', id: 1, ...queryPoint, tags: { leisure: 'park', name: 'Testpark' } }] });
  await new OsmPoints('https://overpass.example/interpreter', fixture, persistent).load(queryPoint.lat, queryPoint.lon);
  let requestsAfterRestart = 0;
  const restarted = new OsmPoints('https://overpass.example/interpreter', async () => { requestsAfterRestart++; throw Error('offline'); }, persistent);
  await restarted.load(queryPoint.lat, queryPoint.lon);
  ok(requestsAfterRestart === 0 && restarted.nearby(queryPoint.lat, queryPoint.lon, 1200)[0]?.id === 'osm:node:1', 'OSM-Import liest gespeicherte Regionen nach Neustart vor dem Netzabruf');
  const { geoObjects } = await import('../src/geo-world');
  const firstArea = geoObjects(queryPoint.lat, queryPoint.lon, GEO.viewM, 1800000000000);
  const overlap = geoObjects(queryPoint.lat + .002, queryPoint.lon, GEO.viewM, 1800000000000);
  const byId = new Map(overlap.map(o => [o.id, o]));
  const shared = firstArea.filter(o => byId.has(o.id));
  ok(shared.length > 20 && shared.every(o => o.lat === byId.get(o.id)?.lat && o.lon === byId.get(o.id)?.lon && o.def === byId.get(o.id)?.def), 'Überlappende Kartenausschnitte enthalten dieselben regionalen Objekte');
  ok(geoObjects(40.821, 14.426).some(o => o.id === 'x:boss:azgoroth' && o.role === 'boss'), 'Boss ist in seiner kanonischen Region auf der Karte sichtbar');
  let ws!: WebSocket; for (let i = 0; i < 50; i++) { try { await new Promise<void>((res, rej) => { ws = new WebSocket(`ws://localhost:${PORT}`); ws.on('open', () => res()); ws.on('error', rej); }); break; } catch { await sleep(300); } }
  let rid = 0; const pend = new Map<number, any>(); let geo: any = null; let motion: any = null; let route: any = null;
  const listen = (socket: WebSocket) => socket.on('message', d => { const m = JSON.parse(String(d)); if (m.rid && pend.has(m.rid)) pend.get(m.rid)(m); if (m.t === 'geo' && !m.off) geo = m; if (m.t === 'geoMotion') motion = m.position; if (m.t === 'geoRoute') route = m.route; });
  listen(ws);
  const req = (t: string, o: any = {}): Promise<any> => new Promise(r => { const id = ++rid; pend.set(id, r); ws.send(JSON.stringify({ t, rid: id, ...o })); setTimeout(() => r({ t: 'err', err: 'timeout' }), 4000); });
  await req('register', { user: 'geo1', pass: 'secret12' }); const c = await req('createChar', { name: 'Geoer', cls: 'archer', look: { gender: 'm', face: 1, body: 1, hair: 2, hairColor: '#aa3311', tattoo: 0, skin: '#e0b090' } }); await req('enter', { id: c.id }); await sleep(500);
  let r = await req('geoPos', { lat: 52.52, lon: 13.4, acc: 10, mode: 'gps' }); ok(r.t === 'err', 'GPS ohne Einwilligung abgelehnt');
  await req('geoConsent', { on: true, gps: true }); await sleep(800); ok(geo && Array.isArray(geo.objs), 'Geo-Paket nach Einwilligung'); 
  r = await req('geoPos', { lat: 52.5219, lon: 13.4132, acc: 10, mode: 'gps' }); ok(r.t === 'ok', 'GPS-Position akzeptiert'); await sleep(1200);
  r = await req('geoPos', { lat: 52.9, lon: 13.9, acc: 10, mode: 'gps' }); ok(r.t === 'err', 'Teleport abgelehnt (Manipulationsschutz)');
  await req('geoPos', { lat: 52.5219, lon: 13.4132, acc: 10, mode: 'gps' }); await sleep(2300); console.log('objs', geo.objs.length, geo.objs.map((o: any) => o.k).join(','));
  ok(geo.objs.some((o: any) => o.k === 'city' && o.def === 'aurelia_plaza'), 'Stadt-Anker sichtbar'); const mob = geo.objs.find((o: any) => o.k === 'mob' && haversine(geo.me.lat, geo.me.lon, o.lat, o.lon) > GEO.interactM); ok(!!mob, 'Dynamische Monster-Spawns');
  if (mob) { r = await req('geoInteract', { id: mob.id }); ok(r.t === 'err' && /weit/.test(r.err) || r.t === 'ok', 'Interaktion prüft Distanz: ' + (r.err || 'ok')); }
  const portal = geo.objs.find((o: any) => o.k === 'teleporter' && o.def === 'aurelia_plaza');
  ok(!!portal, 'Eigenständiger Teleporter auf der Karte');
  r = await req('geoInteract', { id: 'x:tp:aurelia_plaza', to: 'port_nocturne' });
  ok(r.t === 'err', 'Unentdecktes Teleportziel abgelehnt');
  r = await req('geoInteract', { id: portal?.id });
  ok(r.t === 'ok' && Array.isArray(r.destinations), 'Teleportziele am Portal abrufen');
  await req('geoConsent', { on: true, gps: false });
  const destination = { lat: 52.5219, lon: 13.415, mode: 'walk' };
  r = await req('geoRoutePreview', { ...destination, mode: 'car' });
  ok(r.t === 'err' && requestsToRouter.length === 0, 'Gesperrte Reisemodi werden vor der Routenanfrage abgelehnt');
  r = await req('geoRoutePreview', destination);
  let preview = r.preview;
  ok(r.t === 'ok' && preview?.points.length === 3 && preview?.etaSeconds > 0 && requestsToRouter[0]?.costing === 'pedestrian', 'Server zeigt den Straßenverlauf und seine Reisezeit vorab');
  ok(!route && !geo.me.travel, 'Routenvorschau startet keine Bewegung');
  r = await req('geoRoutePreview', { ...destination, refresh: true });
  ok(r.t === 'ok' && r.preview.id !== preview.id && requestsToRouter.length === 2, 'Neu berechnen fragt den echten Routendienst erneut an');
  preview = r.preview;
  r = await req('geoRouteStart', { ...destination, previewId: preview?.id });
  ok(r.t === 'ok' && route?.id && requestsToRouter.length === 2, 'Reisestart nutzt die passende Vorschau');
  process.env.DATA_DIR = dir;
  const persisted = makeStore();
  await persisted.init();
  const savedTrip = (await persisted.get<Character>('chars', c.id))?.geo?.trip;
  ok(savedTrip?.id === route?.id && savedTrip?.points.length === 3 && (savedTrip?.startedAt ?? 0) > 0, 'Reisestart speichert Geometrie und Serverzeit dauerhaft');
  await sleep(700);
  const beforeLogout = motion?.travel?.remainingM;
  ok(beforeLogout > 0 && beforeLogout < preview?.totalM, 'Virtuelle Reise folgt dem Routentakt');
  await req('logout');
  await sleep(900);
  await req('enter', { id: c.id });
  await req('geoConsent', { on: true, gps: false });
  ok(geo.me.travel?.remainingM < beforeLogout && route?.points.length === 3, 'Laufende Reise holt Zeit nach der Wiederanmeldung auf');
  r = await req('geoRoutePause');
  const paused = geo.me.travel;
  ok(r.t === 'ok' && paused?.status === 'paused', 'Virtuelle Route pausieren');
  await req('logout');
  await sleep(800);
  await req('enter', { id: c.id });
  await req('geoConsent', { on: true, gps: false });
  ok(geo.me.travel?.remainingM === paused?.remainingM && geo.me.travel?.status === 'paused', 'Pausierte Reise bleibt über die Wiederanmeldung stehen');
  r = await req('geoRouteResume');
  ok(r.t === 'ok' && geo.me.travel?.status === 'moving', 'Virtuelle Route fortsetzen');
  const previousRoute = route?.id;
  r = await req('geoRouteStart', { lat: 52.522, lon: 13.4152, mode: 'run' });
  ok(r.t === 'ok' && route?.id !== previousRoute && geo.me.travel?.mode === 'run', 'Reise vom aktuellen Punkt neu planen');
  r = await req('geoRouteCancel');
  ok(r.t === 'ok' && !route && !geo.me.travel, 'Virtuelle Route abbrechen');
  r = await req('travel', { to: 'aurelia_market' });
  ok(r.t === 'ok', 'Reise zum Marktviertel zur Entdeckung gestartet');
  await sleep(3600);
  r = await req('geoInteract', { id: portal?.id, to: 'aurelia_market' });
  ok(r.t === 'ok' && r.teleported === 'Aurelia – Marktviertel', 'Entdecktes Teleportziel erreicht' + (r.err ? ': ' + r.err : ''));
  r = await req('geoInteract', { id: portal?.id, to: 'aurelia_market' });
  ok(r.t === 'err', 'Altes Portal nach Teleport außer Reichweite');
  r = await req('geoWipe'); ok(r.t === 'ok', 'Standortdaten löschen');
  await req('geoConsent', { on: true, gps: false });
  const start = geo.me;
  r = await req('geoSteer', { north: 2, east: 0 });
  ok(r.t === 'err', 'Joystick lehnt ungültige Eingaben ab');
  r = await req('geoSteer', { north: 1, east: 0, mode: 'bike' });
  ok(r.t === 'err', 'Joystick prüft die Freischaltung des Fahrrads');
  r = await req('geoSteer', { north: 1, east: 1 });
  await sleep(750);
  const moved = motion;
  const meters = moved && haversine(start.lat, start.lon, moved.lat, moved.lon);
  ok(r.t === 'ok' && moved && moved.lat > start.lat && moved.lon > start.lon && meters > .2 && meters <= GEO_TRAVEL_MODES.walk.speedMps * .55, 'Joystick begrenzt diagonale Geschwindigkeit und stoppt bei fehlenden Eingaben');
  await sleep(300);
  ok(motion === moved, 'Joystick sendet nach Ablauf keine weiteren Positionsupdates');
  await req('geoSteer', { north: 0, east: -1, mode: 'run' });
  await sleep(250);
  ok(motion?.speed === 10 / 3.6, 'Explizites Rennen verwendet 10 km/h');
  await req('geoSteer', { north: 0, east: 0 });
  const released = motion;
  await sleep(150);
  ok(released.lon < moved.lon && released.speed === 0 && motion === released, 'Loslassen stoppt die Bewegung sofort');
  await req('geoConsent', { on: true, gps: true });
  ok(geo.pending && !geo.me && geo.objs.length === 0, 'GPS wartet ohne Kartenposition auf den ersten Fix');
  const braunschweig = { lat: 52.2689, lon: 10.5268, acc: 10, mode: 'gps' };
  await req('geoPos', { ...braunschweig, acc: 550 });
  ok(geo.pending, 'Ungenauer GPS-Fix setzt keine Kartenposition');
  r = await req('geoPos', braunschweig);
  ok(r.t === 'ok' && geo.me?.lat === braunschweig.lat && geo.me?.lon === braunschweig.lon && geo.me?.regionLabel === 'Regionale Wildnis', 'Erster GPS-Fix verankert sofort in Braunschweig');
  const localMobs = geo.objs.filter((o: any) => o.k === 'mob' && o.role === 'normal' && o.lvl <= 6 &&
    haversine(o.lat, o.lon, braunschweig.lat, braunschweig.lon) <= 160);
  ok(localMobs.length >= 2, 'Braunschweig hat mehrere Einsteiger-Monster innerhalb von 160 m');
  ok(geo.objs.some((o: any) => o.k === 'npc') && geo.objs.some((o: any) => o.k === 'node' && o.def.endsWith('_0')) && geo.objs.some((o: any) => o.k === 'mob' && o.role === 'elite'), 'Regionale NPCs, Rohstoffe und Eliten sind sichtbar');
  r = await req('geoSteer', { north: 1, east: 0 });
  ok(r.t === 'err', 'Joystick kann GPS-Position nicht verändern');
  await req('logout');
  ws.close();
  ws = new WebSocket(`ws://localhost:${PORT}`);
  await new Promise<void>((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });
  listen(ws);
  await req('login', { user: 'geo1', pass: 'secret12' });
  await req('enter', { id: c.id });
  await req('geoConsent', { on: true, gps: true });
  ok(geo.pending, 'GPS wartet nach Wiederanmeldung auf einen aktuellen Fix');
  r = await req('geoPos', { ...braunschweig, lon: 13.4 });
  ok(r.t === 'err' && geo.pending, 'GPS-Wechsel nach Wiederanmeldung umgeht den Teleportschutz nicht');
  r = await req('geoPos', braunschweig);
  ok(r.t === 'ok' && geo.me?.lon === braunschweig.lon, 'GPS akzeptiert aktuellen Fix nach Wiederanmeldung');
  const { configureRouting, planRoute, routeLength } = await import('../src/geo-routing');
  configureRouting(`http://127.0.0.1:${routerAddress.port}`);
  const car = await planRoute(queryPoint, { ...queryPoint, lon: queryPoint.lon + .003 }, 'car');
  ok(typeof car !== 'string' && Math.abs(routeLength(car.points) / car.speedMps - 70) < 1e-9 &&
    requestsToRouter.at(-1)?.costing === 'auto', 'Fahrzeit und Fortschritt verwenden die Fahrzeit des Routendienstes');
  configureRouting();
  const missing = await planRoute(queryPoint, { ...queryPoint, lon: queryPoint.lon + .003 }, 'walk');
  ok(typeof missing === 'string' && missing.includes('eingerichtet'), 'Fehlende Routingkonfiguration liefert einen Fehler');
  const direct = await planRoute(queryPoint, { ...queryPoint, lon: queryPoint.lon + .003 }, 'walk', true);
  ok(typeof direct !== 'string' && direct.direct && direct.points.length === 2 && direct.speedMps === 5 / 3.6,
    'Explizite Luftlinie ist ohne Routendienst mit Gehgeschwindigkeit verfügbar');
  const distantDirect = await planRoute(queryPoint, { ...queryPoint, lon: queryPoint.lon + 1 }, 'walk', true);
  ok(typeof distantDirect === 'string', 'Direkte virtuelle Bewegung ist auf kurze Distanzen begrenzt');
  ws.close(); srv.kill(); console.log(fail ? 'FAIL' : 'Alle Geo-Tests bestanden'); process.exit(fail ? 1 : 0);
})();

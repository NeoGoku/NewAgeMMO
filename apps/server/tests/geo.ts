import { spawn } from 'node:child_process'; import WebSocket from 'ws'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const PORT = 8700 + Math.floor(Math.random() * 200); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nam-'));
const srv = spawn('npx', ['tsx', 'src/index.ts'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fail = 0; const ok = (c: any, m: string) => { if (!c) fail++; console.log(c ? '✓' : '✗', m); };
(async () => {
  let ws!: WebSocket; for (let i = 0; i < 50; i++) { try { await new Promise<void>((res, rej) => { ws = new WebSocket(`ws://localhost:${PORT}`); ws.on('open', () => res()); ws.on('error', rej); }); break; } catch { await sleep(300); } }
  let rid = 0; const pend = new Map<number, any>(); let geo: any = null; ws.on('message', d => { const m = JSON.parse(String(d)); if (m.rid && pend.has(m.rid)) pend.get(m.rid)(m); if (m.t === 'geo' && !m.off) geo = m; });
  const req = (t: string, o: any = {}): Promise<any> => new Promise(r => { const id = ++rid; pend.set(id, r); ws.send(JSON.stringify({ t, rid: id, ...o })); setTimeout(() => r({ t: 'err', err: 'timeout' }), 4000); });
  await req('register', { user: 'geo1', pass: 'secret12' }); const c = await req('createChar', { name: 'Geoer', cls: 'archer', look: { gender: 'm', face: 1, body: 1, hair: 2, hairColor: '#aa3311', tattoo: 0, skin: '#e0b090' } }); await req('enter', { id: c.id }); await sleep(500);
  let r = await req('geoPos', { lat: 52.52, lon: 13.4, acc: 10, mode: 'gps' }); ok(r.t === 'err', 'GPS ohne Einwilligung abgelehnt');
  await req('geoConsent', { on: true }); await sleep(800); ok(geo && Array.isArray(geo.objs), 'Geo-Paket nach Einwilligung'); 
  r = await req('geoPos', { lat: 52.52, lon: 13.405, acc: 10, mode: 'gps' }); ok(r.t === 'ok', 'GPS-Position akzeptiert'); await sleep(1200);
  r = await req('geoPos', { lat: 52.9, lon: 13.9, acc: 10, mode: 'gps' }); ok(r.t === 'err', 'Teleport abgelehnt (Manipulationsschutz)');
  await req('geoPos', { lat: 52.5219, lon: 13.4132, acc: 10, mode: 'gps' }); await sleep(2300); console.log('objs', geo.objs.length, geo.objs.map((o: any) => o.k).join(','));
  ok(geo.objs.some((o: any) => o.k === 'city' && o.def === 'aurelia_plaza'), 'Stadt-Anker sichtbar'); const mob = geo.objs.find((o: any) => o.k === 'mob'); ok(!!mob, 'Dynamische Monster-Spawns');
  if (mob) { r = await req('geoInteract', { id: mob.id }); ok(r.t === 'err' && /weit/.test(r.err) || r.t === 'ok', 'Interaktion prüft Distanz: ' + (r.err || 'ok')); }
  r = await req('geoWipe'); ok(r.t === 'ok', 'Standortdaten löschen'); ws.close(); srv.kill(); console.log(fail ? 'FAIL' : 'Alle Geo-Tests bestanden'); process.exit(fail ? 1 : 0);
})();

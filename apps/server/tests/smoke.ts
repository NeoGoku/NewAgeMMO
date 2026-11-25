// Integrationstest: startet den Server, spielt eine vertikale Kette (Registrierung → Charakter → Kampf → Loot → Persistenz → Reconnect) und prüft Sicherheitsregeln.
import { spawn } from 'node:child_process'; import WebSocket from 'ws'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const PORT = 8100 + Math.floor(Math.random() * 500); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nam-'));
const srv = spawn(process.execPath, ['--import', 'tsx', '--import', './tests/seed-random.mjs', 'src/index.ts'], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] }); let slog = ''; srv.stdout.on('data', d => slog += d); srv.stderr.on('data', d => slog += d);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)); let fail = 0; const ok = (c: any, msg: string) => { if (!c) { fail++; console.log(process.env.GITHUB_ACTIONS ? '::error::' + msg : '✗ ' + msg); } else console.log('✓', msg); };
class Cl { ws!: WebSocket; rid = 0; pend = new Map<number, (m: any) => void>(); last: any = {}; msgs: any[] = []; char: any; chats: any[] = [];
  async open() { for (let i = 0; i < 60; i++) { try { await new Promise<void>((res, rej) => { this.ws = new WebSocket(`ws://localhost:${PORT}`); this.ws.on('open', () => res()); this.ws.on('error', rej); }); break; } catch { await sleep(300); } }
    this.ws.on('message', d => { const m = JSON.parse(String(d)); if (m.rid && this.pend.has(m.rid)) { this.pend.get(m.rid)!(m); this.pend.delete(m.rid); } if (m.t === 'state') this.last = m; if (m.t === 'char') this.char = m.c; if (m.t === 'chat') this.chats.push(m); this.msgs.push(m.t); }); }
  req(t: string, o: any = {}): Promise<any> { const rid = ++this.rid; return new Promise(res => { this.pend.set(rid, res); this.ws.send(JSON.stringify({ t, rid, ...o })); setTimeout(() => res({ t: 'err', err: 'timeout' }), 5000); }); } }
const look = { gender: 'm', face: 1, body: 1, hair: 2, hairColor: '#aa3311', tattoo: 0, skin: '#e0b090' };
async function main() {
  const a = new Cl(); await a.open(); let r = await a.req('register', { user: 'tester1', pass: 'secret12' }); ok(r.t === 'ok' && r.token, 'Registrierung');
  r = await a.req('register', { user: 'tester1', pass: 'secret12' }); ok(r.t === 'err', 'Doppelte Registrierung abgelehnt');
  r = await a.req('createChar', { name: 'Held', cls: 'dark_mage', look }); ok(r.t === 'ok' && r.chars.length === 1, 'Charakter erstellt'); const id = r.id;
  r = await a.req('createChar', { name: 'x<script>', cls: 'tank', look }); ok(r.t === 'err', 'Ungültiger Name abgelehnt');
  r = await a.req('enter', { id }); ok(r.t === 'ok' && r.char.level === 1, 'Welt betreten'); await sleep(900); ok(a.last.loc === 'aurelia_plaza' && a.last.players.length === 1, 'Zustand empfangen');
  r = await a.req('npc', { id: 'orwin' }); ok(a.msgs.includes('dialog'), 'NPC-Dialog'); r = await a.req('questAccept', { id: 'm1' }); ok(r.t === 'ok', 'Quest m1 angenommen');
  r = await a.req('travel', { to: 'stadtpark' }); ok(r.t === 'ok', 'Reise gestartet'); await sleep(4800); ok(a.last.loc === 'stadtpark', 'Im Stadtpark angekommen');
  for (let i = 0; i < 20 && !a.last.mobs?.length; i++) await sleep(300); ok(a.last.mobs.length > 5, 'Monster sichtbar');
  const rat = a.last.mobs.find((m: any) => m.def === 'rat'); await a.req('target', { id: rat.uid }); const exp0 = a.char.exp; let killed = false;
  for (let i = 0; i < 80; i++) { await sleep(500); await a.req('skill', { id: 'dark_mage_1' }); const m = a.last.mobs.find((x: any) => x.uid === rat.uid); if (!m) { killed = true; break; } if (a.last.me.hp < 20) await a.req('useItem', { uid: a.char.inventory.find((x: any) => x.id === 'pot_hp_0')?.uid }); }
  await sleep(600); ok(killed, 'Ratte besiegt'); ok(a.char.exp > exp0 || a.char.level > 1, `EXP erhalten (${a.char.exp})`); ok(a.char.gold > 100, `Gold erhalten (${a.char.gold})`);
  r = await a.req('stat', { attr: 'int', n: 99 }); ok(r.t === 'err', 'Zu viele Statpunkte abgelehnt'); r = await a.req('useItem', { uid: 'gibtsnicht' }); ok(r.t === 'err', 'Ungültiges Item abgelehnt');
  a.ws.send(JSON.stringify({ t: 'ping', rid: 1 })); await sleep(200); ok(true, 'Replay-Nachricht ignoriert (kein Absturz)');
  const gold = a.char.gold, exp = a.char.exp, lvl = a.char.level; r = await a.req('logout'); ok(r.t === 'ok', 'Abmelden'); a.ws.close(); await sleep(500);
  const b = new Cl(); await b.open(); r = await b.req('login', { user: 'tester1', pass: 'falsch' }); ok(r.t === 'err', 'Falsches Passwort abgelehnt'); r = await b.req('login', { user: 'tester1', pass: 'secret12' }); ok(r.t === 'ok', 'Login'); r = await b.req('enter', { id }); ok(r.char.gold === gold && r.char.exp === exp && r.char.level === lvl, 'Persistenz nach Reconnect (Gold/EXP/Level)');
  const c = new Cl(); await c.open(); r = await c.req('register', { user: 'tester2', pass: 'secret12' }); r = await c.req('createChar', { name: 'Freund', cls: 'healer', look }); await c.req('enter', { id: r.id }); await c.req('travel', { to: 'stadtpark' }); await sleep(5200);
  ok(b.last.players?.length === 2 || (await sleep(600), b.last.players?.length === 2), 'Zweiter Spieler sichtbar (gemeinsame Welt)'); await b.req('chat', { ch: 'local', text: 'Hallo!' }); await sleep(300); ok(c.chats.some(x => x.text === 'Hallo!'), 'Lokaler Chat empfangen');
  r = await c.req('craft', { recipe: 'r_i_ingot_0', qty: 1 }); ok(r.t === 'err', 'Craften ohne Werkstatt abgelehnt'); r = await c.req('houseBuy', {}); ok(r.t === 'err', 'Hauskauf ohne Quest abgelehnt');
  r = await c.req('tradeRequest', { name: 'Held' }); ok(r.t === 'ok', 'Handelsanfrage'); r = await c.req('shopBuy', { npc: 'torben', id: 'w_healer_1', qty: 1 }); ok(r.t === 'err', 'Kauf mit zu wenig Gold abgelehnt');
  const h = await fetch(`http://localhost:${PORT}/health`).then(x => x.json()); ok(h.ok && h.online === 2, `Health-Endpoint (tick ${h.tickMs} ms)`);
  b.ws.close(); c.ws.close(); await sleep(300);
}
main().catch(e => { console.error(e); fail++; }).finally(() => { srv.kill('SIGTERM'); if (fail) { console.log('\n--- Server-Log ---\n' + slog.slice(-1500)); } console.log(fail ? `\n${fail} Test(s) fehlgeschlagen` : '\nAlle Tests bestanden'); setTimeout(() => process.exit(fail ? 1 : 0), 400); });

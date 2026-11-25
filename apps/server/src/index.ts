import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { NAME_RE, CLASS_IDS, BAL, derive, type Look, type ClassId } from '@nam/shared';
import { validateData, LOCS, NPCS } from '@nam/game-data';
import { makeStore } from './store'; import { G, now, send, sys, toLoc, uid, type Player, type Account } from './state';
import { initWorld, worldTick, respawnAll } from './game'; import { newChar, recalc, summary, invAdd } from './chars';
import { register, login, resume } from './auth'; import { H, NO_CHAR, claimCrafts } from './handlers';
import { joinLoc } from './world'; import { leaveParty, cancelTrade, guildWarCheck } from './social'; import { offlinePets } from './pethouse'; import { marketExpire } from './market';
import { dailyReset } from './quests'; import { leaveHouseSilent } from './world';
import './social'; import './market'; import './pethouse';
const PORT = Number(process.env.PORT || 8080); const log = (ev: string, d: any = {}) => console.log(JSON.stringify({ t: new Date().toISOString(), ev, ...d }));
interface Conn { ws: WebSocket; ip: string; acc?: Account; p?: Player; rid: number; tokens: number; tokAt: number }
const LOOK_OK = (l: any): l is Look => l && ['m', 'f'].includes(l.gender) && [l.face, l.body, l.hair, l.tattoo].every((n: any) => Number.isInteger(n) && n >= 0 && n < 12) && /^#[0-9a-fA-F]{6}$/.test(l.hairColor) && /^#[0-9a-fA-F]{6}$/.test(l.skin);
async function main() {
  const prob = validateData(); if (prob.length) { console.error('Spieldaten-Fehler:', prob.slice(0, 10)); process.exit(1); }
  G.store = makeStore(); await G.store.init(); log('store', { kind: G.store.kind });
  for (const c of await G.store.all<any>('chars')) G.chars.set(c.id, c); for (const g of await G.store.all<any>('guilds')) G.guilds.set(g.id, g); for (const h of await G.store.all<any>('houses')) G.houses.set(h.id, h); for (const l of await G.store.all<any>('market')) G.market.set(l.id, l);
  initWorld(); log('world', { locs: G.locs.size, chars: G.chars.size, guilds: G.guilds.size, houses: G.houses.size });
  const server = http.createServer((req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, online: [...G.players.values()].filter(p => p.online).length, tickMs: G.stats.tickMs, uptime: Math.round((Date.now() - G.startedAt) / 1000), store: G.store.kind })); }
    const dist = process.env.WEB_DIST || path.resolve(process.cwd(), '../web/dist'); let f = path.join(dist, decodeURIComponent((req.url || '/').split('?')[0])); if (!f.startsWith(dist)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html'); if (!fs.existsSync(f)) { res.writeHead(404); return res.end('NewAgeMMO Server läuft. Web-Client: npm run build -w @nam/web'); }
    const ext = path.extname(f); res.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' } as any)[ext] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });
  wss.on('connection', (ws, req) => {
    const conn: Conn = { ws, ip: String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''), rid: 0, tokens: 60, tokAt: now() };
    send({ online: true, ws } as any, { t: 'hello', v: 1, server: 'NewAgeMMO', time: now() });
    ws.on('message', (raw) => { const t = now(); conn.tokens = Math.min(60, conn.tokens + (t - conn.tokAt) / 1000 * 30); conn.tokAt = t; if (conn.tokens < 1) return; conn.tokens--; G.stats.msgs++; let m: any; try { m = JSON.parse(String(raw)); } catch { return; } if (!m || typeof m.t !== 'string') return; onMsg(conn, m).catch(e => { log('error', { msg: String(e?.stack || e).slice(0, 300) }); }); });
    ws.on('close', () => { if (conn.p && conn.p.ws === ws) logout(conn.p); });
  });
  const reply = (conn: Conn, m: any, r: any) => { const out = typeof r === 'string' ? { t: 'err', rid: m.rid, err: r } : { t: 'ok', rid: m.rid, ...(r && typeof r === 'object' ? r : {}) }; conn.ws.readyState === 1 && conn.ws.send(JSON.stringify(out)); };
  async function onMsg(conn: Conn, m: any) {
    const ws = conn.ws; const R = (r: any) => reply(conn, m, r);
    if (m.t === 'register' || m.t === 'login' || m.t === 'resume') {
      const res: any = m.t === 'register' ? await register(String(m.user || ''), String(m.pass || '')) : m.t === 'login' ? await login(String(m.user || ''), String(m.pass || ''), conn.ip) : await resume(String(m.token || ''));
      if (res.err) return R(res.err); conn.acc = res.acc; if (m.t === 'resume' && !res.token) { /* Token bleibt */ } else await G.store.put('accounts', res.acc.name.toLowerCase(), res.acc);
      return R({ token: res.token || m.token, user: res.acc.name, chars: charList(res.acc), admin: !!res.acc.admin });
    }
    if (!conn.acc) return R('Nicht angemeldet');
    if (typeof m.rid === 'number') { if (m.rid <= conn.rid) return R('Wiederholte Anfrage'); conn.rid = m.rid; }
    switch (m.t) {
      case 'chars': return R({ chars: charList(conn.acc) });
      case 'createChar': {
        const mine = [...G.chars.values()].filter(c => c.accountId === conn.acc!.id); if (mine.length >= 3) return R('Maximal 3 Charakterplätze'); const name = String(m.name || '').trim(); if (!NAME_RE.test(name)) return R('Name: 3–16 Zeichen (Buchstaben, Zahlen, _ - Leerzeichen)');
        if ([...G.chars.values()].some(c => c.name.toLowerCase() === name.toLowerCase())) return R('Name bereits vergeben'); if (!CLASS_IDS.includes(m.cls)) return R('Ungültige Klasse'); if (!LOOK_OK(m.look)) return R('Ungültiges Aussehen');
        const c = newChar(conn.acc.id, name, m.cls as ClassId, m.look); G.chars.set(c.id, c); await G.store.put('chars', c.id, c); log('char_created', { cls: c.cls }); return R({ chars: charList(conn.acc), id: c.id });
      }
      case 'deleteChar': { const c = G.chars.get(String(m.id)); if (!c || c.accountId !== conn.acc.id) return R('Nicht gefunden'); if (G.players.get(c.id)?.online) return R('Charakter ist online'); if (m.confirm !== c.name) return R('Name zur Bestätigung eingeben'); G.chars.delete(c.id); await G.store.del('chars', c.id); return R({ chars: charList(conn.acc) }); }
      case 'enter': {
        const c = G.chars.get(String(m.id)); if (!c || c.accountId !== conn.acc.id) return R('Nicht gefunden'); const old = G.players.get(c.id); if (old?.online) { old.ws.close(); await logout(old); }
        const p = makePlayer(c, ws, conn.acc); conn.p = p; G.players.set(p.id, p); G.byName.set(c.name.toLowerCase(), p); const away = Math.max(0, now() - c.lastSeen); dailyReset(p); offlinePets(p, away); recalc(p);
        if (c.hp <= 1 && c.level >= 1 && c.hp < 1) c.hp = Math.ceil(p.st.maxHp * .5); if (LOCS[c.loc].kind === 'arena' || LOCS[c.loc].pvp) c.loc = c.choices.respawn || 'aurelia_plaza'; const loc = G.locs.get(c.loc) ? c.loc : 'aurelia_plaza'; p.loc = loc; G.locs.get(loc)!.players.add(p); p.x = p.dx = c.x || 50; p.y = p.dy = c.y || 78; c.hp = Math.min(Math.max(c.hp, 1), p.st.maxHp); if (!c.activePet && c.pets.length) { /* keins */ }
        const done = claimCrafts(p); R({ char: c, loc, away, craftsDone: done }); send(p, { t: 'enter', loc, x: p.x, y: p.y }); send(p, { t: 'quests', q: c.quests, done: c.questsDone }); sys(p, `Willkommen zurück, ${c.name}!`); if (c.guildId) { const g = G.guilds.get(c.guildId); if (g) sys(p, `Gilde ${g.name}: ${g.motd}`, 'guild'); } if (c.mail.length) sys(p, `Du hast ${c.mail.length} Nachricht(en) im Postfach.`, 'loot'); return;
      }
      case 'logout': { if (conn.p) await logout(conn.p, true); conn.p = undefined; return R({ chars: charList(conn.acc) }); }
      case 'admin': { if (!conn.acc.admin) return R('Keine Berechtigung'); return R(adminCmd(m)); }
    }
    const p = conn.p; if (!p || p.ws !== ws) return R('Kein Charakter aktiv'); p.lastAct = now();
    const h = H[m.t]; if (!h) return R('Unbekannter Befehl: ' + m.t); let res: any; try { res = h(p, m); } catch (e: any) { log('handler_error', { t: m.t, e: String(e?.stack || e).slice(0, 300) }); return R('Serverfehler'); }
    if (!(typeof res === 'string')) { if (!NO_CHAR.has(m.t) || p.dirty) send(p, { t: 'char', c: p.c }); }
    if (m.rid !== undefined) R(res === undefined || res === null ? {} : res);
  }
  function charList(acc: Account) { return [...G.chars.values()].filter(c => c.accountId === acc.id).map(summary); }
  function makePlayer(c: any, ws: WebSocket, acc: Account): Player { return { id: c.id, c, ws, acc, loc: c.loc, x: 50, y: 78, dx: 50, dy: 78, target: null, auto: false, autoFarm: null, atkAt: 0, cd: {}, fx: [], partyId: null, combatUntil: 0, travel: null, gather: null, pending: null, rid: 0, tokens: 30, tokAt: now(), summons: [], dead: false, deadUntil: 0, st: derive(c.cls, 1, c.attrs, { atk: 0, def: 0, mdef: 0, hp: 0, res: 0, attrs: {} }), pvpSt: null, mods: {}, duel: null, trade: null, lastChat: 0, lastSave: now(), evq: [], petAt: 0, hits: 0, resAcc: 0, houseId: null, houseFloor: 0, online: true, shield: 0, lastMsgSec: 0, stunnedUntil: 0, invites: [], dirty: false, lastAct: now() }; }
  async function logout(p: Player, keepSocket = false) {
    if (!p.online && !keepSocket) return; p.online = false; if (p.trade) cancelTrade(p.trade); leaveParty(p); leaveHouseSilent(p); G.locs.get(p.loc)?.players.delete(p); if (p.travel) { p.loc = p.travel.to; p.c.loc = p.loc; }
    p.c.lastSeen = now(); p.c.x = p.x; p.c.y = p.y; p.c.loc = p.loc; if (p.duel) { const o = G.players.get(p.duel.opp); if (o) o.duel = null; p.duel = null; } if (p.dead) { p.c.hp = Math.ceil(p.st.maxHp * .5); } await G.store.put('chars', p.c.id, p.c); if (G.players.get(p.id) === p) { G.players.delete(p.id); G.byName.delete(p.c.name.toLowerCase()); }
    log('logout', { name: p.c.name, lvl: p.c.level });
  }
  function adminCmd(m: any) {
    const t = G.byName.get(String(m.name || '').toLowerCase()); log('admin', { cmd: m.cmd, name: m.name });
    switch (m.cmd) { case 'announce': for (const p of G.players.values()) sys(p, '📢 ' + String(m.text || '').slice(0, 200), 'boss'); return {}; case 'gold': if (!t) return 'Spieler offline'; t.c.gold += Math.floor(Number(m.n) || 0); send(t, { t: 'char', c: t.c }); return {}; case 'give': if (!t) return 'Spieler offline'; invAdd(t.c, String(m.id), Math.max(1, Number(m.n) | 0 || 1)); send(t, { t: 'char', c: t.c }); return {}; case 'kick': if (!t) return 'Spieler offline'; t.ws.close(); return {}; case 'respawn': respawnAll(); return {}; case 'backup': return { dir: 'siehe Server-Log' }; case 'stats': return { online: G.players.size, tickMs: G.stats.tickMs, msgs: G.stats.msgs }; }
    return 'Unbekannter Admin-Befehl';
  }
  setInterval(() => { try { worldTick(); } catch (e: any) { log('tick_error', { e: String(e?.stack || e).slice(0, 400) }); } }, BAL.tickMs);
  setInterval(() => { for (const p of G.players.values()) if (p.online && p.dirty) { p.dirty = false; G.store.put('chars', p.c.id, p.c); } for (const p of G.players.values()) if (p.online && now() - p.lastAct > 20 * 60e3) p.ws.close(); for (const [id, pt] of G.parties) if (pt.members.length < 2) G.parties.delete(id); for (const t of G.players.values()) t.invites = t.invites.filter(i => i.until > now()); }, 15000);
  setInterval(() => { marketExpire(); guildWarCheck(); }, 30000);
  setInterval(() => { G.store.flush(); }, 5000); setInterval(() => { G.store.backup().then(d => log('backup', { d })); }, 6 * 3600e3);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { log('shutdown'); for (const p of [...G.players.values()]) await logout(p); await G.store.flush(); process.exit(0); });
  server.listen(PORT, () => log('listening', { port: PORT, locs: Object.keys(LOCS).length, npcs: Object.keys(NPCS).length }));
}
main().catch(e => { console.error(e); process.exit(1); });
void uid; void toLoc;

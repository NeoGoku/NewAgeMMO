import { registerGuildTerritories, restoreTerritories, saveTerritoryChanges, tickTerritories } from './guild-territories';
import { pendingReward, saveCharacter } from './character-save';
import { configureProperties } from './geo-property-data';
import { discardPropertyHouse, restorePropertyHouses } from './geo-property';
import { createAdmin } from './admin';
import { WriteOrder } from './write-order';
import { NAME_RE, CLASS_IDS, BAL, GEO, derive, type Look, type ClassId } from '@nam/shared';
import { validateData, LOCS, NPCS } from '@nam/game-data';
import type { Store } from './store'; import { characterForClient, G, now, send, sys, toLoc, uid, type Player, type Account } from './state';
import { initWorld, worldTick, worldEvent } from './game'; import { newChar, recalc, summary } from './chars';
import { register, login, resume, resumeAccountKey } from './auth'; import { H, NO_CHAR, claimCrafts } from './handlers';
import { joinLoc } from './world'; import { leaveParty, cancelTrade, guildWarCheck } from './social'; import { offlinePets } from './pethouse'; import { marketExpire } from './market';
import { dailyReset } from './quests'; import { leaveHouseSilent } from './world';
import { geoTick } from './geo'; import type { WalkingNetwork } from './walking-network';
import { configureRouting } from './geo-routing'; import './social'; import './market'; import './pethouse';
export interface SockLike { readyState: number; send(d: string): void; close(): void; on(ev: 'message' | 'close', fn: (d?: any) => void): void }
export const log = (ev: string, d: any = {}) => console.log(JSON.stringify({ t: new Date().toISOString(), ev, ...d }));
interface Conn { ws: SockLike; ip: string; acc?: Account; token?: string; p?: Player; rid: number; tokens: number; tokAt: number }
const LOOK_OK = (l: any): l is Look => l && ['m', 'f'].includes(l.gender) && [l.face, l.body, l.hair, l.tattoo].every((n: any) => Number.isInteger(n) && n >= 0 && n < 12) && /^#[0-9a-fA-F]{6}$/.test(l.hairColor) && /^#[0-9a-fA-F]{6}$/.test(l.skin);
export async function createCore(store: Store, opts: { backupEveryMs?: number; propertyCatalog?: unknown; adminUsers?: () => string | undefined; routingUrl?: string; walkingNetwork?: () => Promise<WalkingNetwork> } = {}) {
  const prob = validateData(); if (prob.length) throw new Error('Spieldaten-Fehler: ' + prob.slice(0, 10).join('; '));
  configureRouting(opts.routingUrl, opts.walkingNetwork);
  configureProperties(opts.propertyCatalog);
  G.store = store; await G.store.init(); log('store', { kind: G.store.kind });
  for (const c of await G.store.all<any>('chars')) G.chars.set(c.id, c); for (const g of await G.store.all<any>('guilds')) G.guilds.set(g.id, g); for (const h of await G.store.all<any>('houses')) { G.houses.set(h.id, h); if (h.geo) G.store.geoUpsert?.('house:' + h.id, 'house', h.geo.lat, h.geo.lon, { owner: h.ownerName }); } for (const l of await G.store.all<any>('market')) G.market.set(l.id, l);
  restorePropertyHouses();
  await restoreTerritories();
  registerGuildTerritories();
  initWorld(); log('world', { locs: G.locs.size, chars: G.chars.size, guilds: G.guilds.size, houses: G.houses.size });
  const sessions = new WriteOrder();
  const accounts = new WriteOrder();
  const messages = new WriteOrder();
  const connections = new Set<Conn>();
  const admin = opts.adminUsers && await createAdmin(store, opts.adminUsers, accounts, accountId => {
    for (const conn of connections) {
      if (conn.acc?.id !== accountId || conn.ws.readyState !== 1) continue;
      if (conn.p) conn.p.online = false;
      try { conn.ws.send(JSON.stringify({ t: 'kicked', banned: true })); }
      catch (error) { log('ban_message_error', { msg: String(error) }); }
      try { conn.ws.close(); }
      catch (error) { log('ban_close_error', { msg: String(error) }); }
    }
  });
  let stopping = false;
  function onConnection(ws: SockLike, ip = '') {
    const conn: Conn = { ws, ip, rid: 0, tokens: 60, tokAt: now() };
    if (admin) connections.add(conn);
    const connectionId = uid('conn');
    send({ online: true, ws } as any, { t: 'hello', v: 1, server: 'NewAgeMMO', time: now() });
    ws.on('message', (raw) => { const t = now(); conn.tokens = Math.min(60, conn.tokens + (t - conn.tokAt) / 1000 * 30); conn.tokAt = t; if (conn.tokens < 1) return; conn.tokens--; G.stats.msgs++; let m: any; try { m = JSON.parse(String(raw)); } catch { return; } if (!m || typeof m.t !== 'string') return; void messages.run(connectionId, async () => {
      if (!stopping && ws.readyState === 1) await onMsg(conn, m, t);
    }).catch(e => {
      log('error', { msg: String(e?.stack || e).slice(0, 300) });
      reply(conn, m, 'Serverfehler beim Speichern oder Verarbeiten');
    }); });
    ws.on('close', () => {
      connections.delete(conn);
      void messages.run(connectionId, async () => {
        const p = conn.p;
        if (p) await sessions.run(p.id, () => logout(p));
      }).catch(e => log('logout_error', { msg: String(e) }));
    });
  }
  const reply = (conn: Conn, m: any, r: any) => { const out = typeof r === 'string' ? { t: 'err', rid: m.rid, err: r } : { t: 'ok', rid: m.rid, ...(r && typeof r === 'object' ? r : {}) }; conn.ws.readyState === 1 && conn.ws.send(JSON.stringify(out)); };
  async function onMsg(conn: Conn, m: any, receivedAt: number) {
    const ws = conn.ws; const R = (r: any) => reply(conn, m, r);
    if (m.t === 'register' || m.t === 'login' || m.t === 'resume') {
      if (conn.p) return R('Zuerst Charakter abmelden');
      const user = String(m.user || '');
      const pass = String(m.pass || '');
      const providedToken = String(m.token || '');
      const key = m.t === 'resume' ? resumeAccountKey(providedToken) : user.toLowerCase();
      return accounts.run(key, async () => {
        if (ws.readyState !== 1 || stopping) return;
        if (m.t === 'register' && admin?.allows(user)) return R('Benutzername bereits vergeben');
        const result = m.t === 'resume' ? await resume(providedToken, admin?.mayResume) :
          m.t === 'register' ? await register(user, pass) : await login(user, pass, conn.ip, admin?.isBanned);
        if (!result.acc) return R(result.err);
        if (m.t !== 'resume') await G.store.flush();
        if (ws.readyState !== 1 || stopping) return;
        conn.acc = result.acc;
        const token = 'token' in result && typeof result.token === 'string' ? result.token : providedToken;
        if (admin) conn.token = token;
        return R({ token, user: result.acc.name, chars: charList(result.acc), admin: admin?.allows(result.acc.name) ?? false });
      });
    }
    if (!conn.acc) return R('Nicht angemeldet');
    if (admin?.isBanned(conn.acc)) return R('Account gesperrt');
    if (typeof m.rid === 'number') { if (m.rid <= conn.rid) return R('Wiederholte Anfrage'); conn.rid = m.rid; }
    switch (m.t) {
      case 'chars': return R({ chars: charList(conn.acc) });
      case 'createChar': {
        const mine = [...G.chars.values()].filter(c => c.accountId === conn.acc!.id); if (mine.length >= 3) return R('Maximal 3 Charakterplätze'); const name = String(m.name || '').trim(); if (!NAME_RE.test(name)) return R('Name: 3–16 Zeichen (Buchstaben, Zahlen, _ - Leerzeichen)');
        if ([...G.chars.values()].some(c => c.name.toLowerCase() === name.toLowerCase())) return R('Name bereits vergeben'); if (!CLASS_IDS.includes(m.cls)) return R('Ungültige Klasse'); if (!LOOK_OK(m.look)) return R('Ungültiges Aussehen');
        const c = newChar(conn.acc.id, name, m.cls as ClassId, m.look);
        G.chars.set(c.id, c);
        try {
          await G.store.put('chars', c.id, c);
          await G.store.flush();
        } catch (error) {
          G.chars.delete(c.id);
          throw error;
        }
        log('char_created', { cls: c.cls }); return R({ chars: charList(conn.acc), id: c.id });
      }
      case 'deleteChar': return sessions.run(String(m.id), async () => {
        const c = G.chars.get(String(m.id));
        if (!c || c.accountId !== conn.acc!.id) return R('Nicht gefunden');
        if (G.players.has(c.id)) return R('Charakter ist online');
        if (m.confirm !== c.name) return R('Name zur Bestätigung eingeben');
        G.chars.delete(c.id);
        try {
          await G.store.del('chars', c.id);
          await G.store.flush();
        } catch (error) {
          G.chars.set(c.id, c);
          throw error;
        }
        discardPropertyHouse(c);
        return R({ chars: charList(conn.acc!) });
      });
      case 'enter': return sessions.run(String(m.id), async () => {
        if (stopping || ws.readyState !== 1) return;
        if (conn.p?.online) return R('Zuerst Charakter abmelden');
        const c = G.chars.get(String(m.id)); if (!c || c.accountId !== conn.acc!.id) return R('Nicht gefunden'); const old = G.players.get(c.id);
        if (old?.online && old.ws.readyState === 1) return R('Charakter ist bereits online');
        if (old) await logout(old);
        if (stopping || ws.readyState !== 1) return;
        if (admin?.isBanned(conn.acc!)) return R('Account gesperrt');
        const p = makePlayer(c, ws, conn.acc!); conn.p = p; G.players.set(p.id, p); G.byName.set(c.name.toLowerCase(), p); const away = Math.max(0, now() - c.lastSeen); dailyReset(p); offlinePets(p, away); recalc(p);
        if (c.hp <= 1 && c.level >= 1 && c.hp < 1) c.hp = Math.ceil(p.st.maxHp * .5); if (LOCS[c.loc].kind === 'arena' || LOCS[c.loc].pvp) c.loc = c.choices.respawn || 'aurelia_plaza'; const loc = G.locs.get(c.loc) ? c.loc : 'aurelia_plaza'; p.loc = loc; G.locs.get(loc)!.players.add(p); p.x = p.dx = c.x || 50; p.y = p.dy = c.y || 78; c.hp = Math.min(Math.max(c.hp, 1), p.st.maxHp); if (!c.activePet && c.pets.length) { /* keins */ }
        const done = claimCrafts(p); R({ char: characterForClient(c), loc, away, craftsDone: done }); send(p, { t: 'enter', loc, x: p.x, y: p.y }); send(p, { t: 'quests', q: c.quests, done: c.questsDone }); sys(p, `Willkommen zurück, ${c.name}!`); if (c.guildId) { const g = G.guilds.get(c.guildId); if (g) sys(p, `Gilde ${g.name}: ${g.motd}`, 'guild'); } if (c.mail.length) sys(p, `Du hast ${c.mail.length} Nachricht(en) im Postfach.`, 'loot'); return;
      });
      case 'logout': {
        const p = conn.p;
        if (p) await sessions.run(p.id, () => logout(p));
        conn.p = undefined;
        return R({ chars: charList(conn.acc) });
      }
      case 'admin': {
        if (!admin || !conn.token || !Number.isSafeInteger(m.rid)) return R('Keine Berechtigung');
        const actor = conn.acc;
        return R(await admin.handle(actor, m, async () => ws.readyState === 1 && (await resume(conn.token!, admin.mayResume)).acc?.id === actor.id));
      }
    }
    const p = conn.p; if (!p?.online || G.players.get(p.id) !== p || p.ws !== ws) return R('Kein Charakter aktiv'); p.lastAct = now();
    if (m.t === 'chat' && admin?.isMuted(p.acc)) return R('Der Chat wurde für deinen Account gesperrt.');
    const h = H[m.t]; if (!h) return R('Unbekannter Befehl: ' + m.t); let res: any; try { res = await h(p, m, receivedAt); } catch (e: any) { log('handler_error', { t: m.t, e: String(e?.stack || e).slice(0, 300) }); return R('Serverfehler'); }
    const saving = pendingReward(p);
    if (saving) await saving;
    if (typeof res !== 'string' && m.t !== 'geoSteer' && (!NO_CHAR.has(m.t) || p.dirty)) send(p, { t: 'char', c: p.c });
    if (m.rid !== undefined) R(res === undefined || res === null ? {} : res);
  }
  function charList(acc: Account) { return [...G.chars.values()].filter(c => c.accountId === acc.id).map(summary); }
  function makePlayer(c: any, ws: SockLike, acc: Account): Player { return { id: c.id, c, ws, acc, loc: c.loc, x: 50, y: 78, dx: 50, dy: 78, target: null, auto: false, autoFarm: null, atkAt: 0, cd: {}, fx: [], partyId: null, combatUntil: 0, travel: null, gather: null, pending: null, rid: 0, tokens: 30, tokAt: now(), summons: [], dead: false, deadUntil: 0, st: derive(c.cls, 1, c.attrs, { atk: 0, def: 0, mdef: 0, hp: 0, res: 0, attrs: {} }), pvpSt: null, mods: {}, duel: null, trade: null, lastChat: 0, evq: [], petAt: 0, hits: 0, resAcc: 0, houseId: null, houseFloor: 0, online: true, shield: 0, lastMsgSec: 0, stunnedUntil: 0, invites: [], dirty: false, lastAct: now() }; }
  async function logout(p: Player) {
    if (G.players.get(p.id) !== p) return; p.online = false; if (p.trade) cancelTrade(p.trade); leaveParty(p); leaveHouseSilent(p); G.locs.get(p.loc)?.players.delete(p); if (p.travel) { p.loc = p.travel.to; p.c.loc = p.loc; }
    p.c.lastSeen = now(); p.c.x = p.x; p.c.y = p.y; p.c.loc = p.loc; if (p.duel) { const o = G.players.get(p.duel.opp); if (o) o.duel = null; p.duel = null; } if (p.dead) { p.c.hp = Math.ceil(p.st.maxHp * .5); } await saveCharacter(p, true); if (G.players.get(p.id) === p) { G.players.delete(p.id); G.byName.delete(p.c.name.toLowerCase()); }
    log('logout', { name: p.c.name, lvl: p.c.level });
  }
  const timers = [
    setInterval(() => { try { geoTick(); tickTerritories(); } catch (e: any) { log('geo_error', { e: String(e?.stack || e).slice(0, 300) }); } }, GEO.steerTickMs),
    setInterval(() => { try { worldTick(); } catch (e: any) { log('tick_error', { e: String(e?.stack || e).slice(0, 400) }); } }, BAL.tickMs),
    setInterval(() => {
      for (const p of G.players.values()) {
        if (!p.online) void sessions.run(p.id, () => logout(p)).catch(e => log('logout_error', { msg: String(e) }));
        else if (p.dirty) void saveCharacter(p).catch(e => log('save_error', { msg: String(e) }));
        if (p.online && now() - p.lastAct > 20 * 60e3) p.ws.close();
        p.invites = p.invites.filter(i => i.until > now());
      }
      for (const [id, party] of G.parties) if (party.members.length < 2) G.parties.delete(id);
    }, 15000),
    setInterval(() => { marketExpire(); guildWarCheck(); }, 30000),
    setInterval(() => { try { worldEvent(); } catch { /* */ } }, 25 * 60e3),
    setInterval(() => { void G.store.flush().catch(e => log('flush_error', { msg: String(e) })); }, 5000),
    setInterval(() => { void G.store.backup().then(d => log('backup', { d }), e => log('backup_error', { msg: String(e) })); }, 6 * 3600e3)
  ];
  async function shutdown() {
    stopping = true;
    timers.forEach(clearInterval);
    await messages.drain();
    await saveTerritoryChanges();
    const results = await Promise.allSettled([...G.players.values()].map(p => sessions.run(p.id, () => logout(p))));
    await G.store.flush();
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
  }
  return { onConnection, shutdown };
}
void uid; void toLoc; void LOCS; void NPCS;

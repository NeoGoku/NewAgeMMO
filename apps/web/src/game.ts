import type { Msg } from '@nam/shared';
import { net } from './net'; import { state, set, toast, saveSettings } from './store'; import { audio } from './audio';
export const view = { snap: null as any, prev: null as any, snapAt: 0, me: '' as string, evts: [] as any[], mobs: new Map<string, any>() };
let reconnecting = false;
export async function connect(): Promise<string | null> {
  set({ conn: 'connecting' }); try { await net.connect(state.settings.server); set({ conn: 'ok' }); return null; } catch (e: any) { set({ conn: 'lost' }); return e.message || 'Fehler'; }
}
export async function authenticate(mode: 'login' | 'register', user: string, pass: string): Promise<string | null> {
  const e = await connect(); if (e) return e; const r = await net.req(mode, { user, pass }); if (r.t === 'err') return r.err; saveToken(r.token); set({ user: r.user, token: r.token, chars: r.chars, admin: !!r.admin, screen: 'chars' }); return null;
}
export async function tryResume(): Promise<string | null> {
  if (!state.token) return 'Kein gespeicherter Login'; const e = await connect(); if (e) return e; const r = await net.req('resume', { token: state.token }); if (r.t === 'err') { saveToken(''); return r.err; } set({ user: r.user, chars: r.chars, admin: !!r.admin, screen: 'chars' }); return null;
}
const saveToken = (t: string) => { try { t ? localStorage.setItem('nam.token', t) : localStorage.removeItem('nam.token'); } catch { /* */ } };
export async function enterGame(id: string): Promise<string | null> {
  const r = await net.req('enter', { id }); if (r.t === 'err') return r.err; view.me = id; set({ char: r.char, loc: r.loc, screen: 'game', chat: [], dialog: null, panel: null, snap: null, died: null, travel: null, house: null, party: null, guild: null }); audio.startMusic(themeOf(r.loc)); net.send('guildInfo'); net.send('friends');
  if (r.away > 60000) toast(`Willkommen zurück! Du warst ${Math.round(r.away / 60000)} Min. weg.`); return null;
}
export async function logoutChar() { const r = await net.req('logout'); if (r.t === 'err') { toast(r.err); return false; } set({ screen: 'chars', chars: r.chars, char: null, snap: null, panel: null, dialog: null }); audio.stopMusic(); return true; }
export function logoutAccount() { net.close(); saveToken(''); set({ screen: 'title', token: '', user: '', chars: [], char: null }); audio.stopMusic(); }
import { LOCS } from '@nam/game-data';
export const themeOf = (loc: string) => LOCS[loc]?.theme || 'city';
export const act = (t: string, o: Record<string, any> = {}) => net.send(t, o);
export async function call(t: string, o: Record<string, any> = {}, quiet = false) { const r = await net.req(t, o); if (r.t === 'err') { if (!quiet) { toast(r.err, 'err'); audio.sfx('error'); } return null; } return r; }
export function pushChat(m: any) { set({ chat: [...state.chat.slice(-199), m] }); }
net.onClose = () => { if (state.screen === 'game' && !reconnecting) { reconnecting = true; set({ conn: 'lost' }); void reconnectLoop(); } };
async function reconnectLoop() {
  const id = state.char?.id; for (let i = 0; i < 40 && state.screen === 'game'; i++) { await new Promise(r => setTimeout(r, Math.min(5000, 800 + i * 400))); const e = await tryResumeSilent(); if (!e && id) { const r = await net.req('enter', { id }); if (r.t !== 'err') { set({ char: r.char, conn: 'ok', screen: 'game', snap: null }); reconnecting = false; toast('Verbindung wiederhergestellt', 'ok'); return; } } }
  reconnecting = false; set({ screen: 'title', conn: 'lost' }); toast('Verbindung verloren', 'err');
}
async function tryResumeSilent() { try { await net.connect(state.settings.server); } catch (e: any) { return e.message; } const r = await net.req('resume', { token: state.token }); return r.t === 'err' ? r.err : null; }
const KIND_SFX: Record<string, string> = { crit: 'crit', dmg: 'hit', heal: 'heal', miss: 'miss', block: 'block' };
net.on((m: Msg) => {
  switch (m.t) {
    case 'state': {
      const first = !view.snap; view.prev = view.snap; view.snap = m; view.snapAt = performance.now();
      for (const e of m.evts as any[]) { view.evts.push({ ...e, born: performance.now() }); if (state.screen === 'game') { const mine = e.id === view.me || e.from === view.me || e.c === 'p'; if (KIND_SFX[e.k] && (mine || e.k === 'dmg')) { if (e.c === 'p' && e.id === view.me) audio.sfx('hit'); else if (e.c !== 'p') audio.sfx(KIND_SFX[e.k]); } if (e.k === 'fx' && e.id?.startsWith('cast_') && e.from === view.me) audio.sfx(e.id); if (e.k === 'loot' && e.id === view.me) audio.sfx('coin'); if (e.k === 'lvl' && Math.abs(e.x - (view.snap.players.find((p: any) => p.id === view.me)?.x ?? -99)) < 2) audio.sfx('levelup'); if (e.k === 'die' && !String(e.id).startsWith('p')) audio.sfx('die'); } }
      if (view.evts.length > 200) view.evts.splice(0, view.evts.length - 200);
      if (state.loc !== m.loc) set({ loc: m.loc }); set({ snap: m as any }); if (first) { audio.setAmbient(m.weather); } else if (view.prev && view.prev.weather !== m.weather) audio.setAmbient(m.weather); break; }
    case 'char': set({ char: m.c }); break;
    case 'enter': { view.snap = null; view.evts = []; set({ loc: m.loc, travel: null, dialog: null, died: null, house: null, inScene: false }); audio.startMusic(themeOf(m.loc)); break; }
    case 'scene': { if (m.on) { view.snap = null; view.evts = []; audio.sfx('travel'); } set({ inScene: !!m.on, dialog: m.on ? null : state.dialog, panel: null }); break; }
    case 'chat': pushChat(m); if (m.ch === 'whisper' || m.ch === 'boss' || m.ch === 'party') audio.sfx(m.ch === 'boss' ? 'boss' : 'chat'); if (m.ch === 'loot') toast(m.text, 'loot'); if (m.ch === 'quest') toast(m.text, 'quest'); break;
    case 'quests': if (state.char) set({ char: { ...state.char, quests: m.q, questsDone: m.done } }); break;
    case 'questDone': audio.sfx('quest'); break;
    case 'levelup': audio.sfx('levelup'); set({ levelUp: Date.now() }); toast(`Level ${m.level}!`, 'ok'); break;
    case 'dialog': set({ dialog: m }); audio.sfx('click'); break;
    case 'travel': set({ travel: { to: m.to, ms: m.ms, start: performance.now(), from: m.from }, dialog: null, panel: null }); audio.sfx('travel'); break;
    case 'died': set({ died: { until: m.until } }); audio.sfx('die'); break;
    case 'respawn': set({ died: null, inScene: false }); break;
    case 'autoFarm': set({ autoFarm: m.on ? Date.now() + m.ms : 0 }); break;
    case 'invite': set({ invites: [...state.invites.filter(i => !(i.kind === m.kind && i.fromId === m.fromId)), { ...m, at: Date.now() }] }); audio.sfx('notify'); setTimeout(() => set({ invites: state.invites.filter(i => Date.now() - i.at < 59000) }), 60000); break;
    case 'partyInfo': set({ party: m.id ? m : null }); break;
    case 'guild': set({ guild: m.g, guildList: m.list || state.guildList }); break;
    case 'friends': set({ friends: m.list }); break;
    case 'market': set({ market: m }); break;
    case 'houses': set({ houses: m }); break;
    case 'house': set({ house: m.h, visitors: m.visitors }); break;
    case 'houseVisitors': set({ visitors: m.visitors }); break;
    case 'trade': if (m.done) set({ trade: null, panel: state.panel === 'trade' ? null : state.panel }); else set({ trade: m, panel: 'trade' }); break;
    case 'profile': set({ profile: m.p, panel: 'profile' }); break;
    case 'loot': audio.sfx('loot'); break;
    case 'profUp': audio.sfx('levelup'); break;
    case 'duelEnd': toast(m.won ? 'Duell gewonnen!' : 'Duell verloren.', m.won ? 'ok' : 'err'); break;
    case 'petHatched': audio.sfx('levelup'); break;
    case 'gather': audio.sfx('gather'); break;
  }
});
export function applySettings() { const s = state.settings; audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx }); saveSettings(); }
export function quit() { try { const cap = (window as any).Capacitor; if (cap?.Plugins?.App?.exitApp) { cap.Plugins.App.exitApp(); return; } } catch { /* */ } set({ screen: 'bye' }); try { window.close(); } catch { /* */ } }

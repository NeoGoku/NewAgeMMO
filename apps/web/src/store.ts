import { useSyncExternalStore } from 'react';
import type { Character, StateMsg } from '@nam/shared';
import { defaultServer, isSoloServer } from './net';
export interface Toast { id: number; text: string; kind: string }
export interface Settings { master: number; music: number; ambience: number; sfx: number; showDmg: boolean; uiScale: number; quality: 'low' | 'high'; server: string; shake: boolean }
export interface S {
  inScene: boolean; geoMode: string; geoWalking: boolean; navPanel: string; hudChat: boolean;
  screen: 'title' | 'auth' | 'chars' | 'create' | 'options' | 'game' | 'bye'; authMode: 'login' | 'register'; user: string; token: string; chars: any[]; createSlot: number; char: Character | null; loc: string; snap: StateMsg | null;
  chat: { ch: string; from: string; text: string; at: number; to?: string; cls?: string }[]; dialog: any; panel: string | null; toasts: Toast[]; invites: any[]; party: any; guild: any; guildList: any[]; friends: any[]; market: any; houses: any; house: any; visitors: any[]; trade: any; profile: any;
  settings: Settings; conn: 'ok' | 'lost' | 'connecting'; travel: { to: string; ms: number; start: number; from: string } | null; died: { until: number } | null; autoFarm: number; target: any; admin: boolean; selected: any; stationProf: string | null; tracked: string | null; menuOpen: boolean; combatLog: string[]; levelUp: number; fps: number;
}
const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? { ...d, ...JSON.parse(v) } : d; } catch { return d; } };
const settings = load<Settings>('nam.settings', { master: .8, music: .5, ambience: .25, sfx: .8, showDmg: true, uiScale: 1, quality: 'high', server: defaultServer(), shake: true });
const tokenKey = (server: string) => isSoloServer(server) ? 'nam.token.solo' : 'nam.token.online:' + server;
export function loadToken(server: string) {
  try { return localStorage.getItem(tokenKey(server)) || ''; } catch { return ''; }
}
export function saveToken(server: string, token: string) {
  try {
    if (token) localStorage.setItem(tokenKey(server), token);
    else localStorage.removeItem(tokenKey(server));
  } catch { /* kein Storage */ }
}
function initialToken() {
  const current = loadToken(settings.server);
  try {
    // Older clients stored a single token for the last configured server.
    const legacy = localStorage.getItem('nam.token');
    if (!legacy) return current;
    if (!current) localStorage.setItem(tokenKey(settings.server), legacy);
    localStorage.removeItem('nam.token');
    return current || legacy;
  } catch { return current; }
}
export const state: S = {
  inScene: false, geoMode: 'virtual', geoWalking: false, navPanel: '', hudChat: false,
  screen: 'title', authMode: 'login', user: '', token: initialToken(), chars: [], createSlot: 0, char: null, loc: 'aurelia_plaza', snap: null, chat: [], dialog: null, panel: null, toasts: [], invites: [], party: null, guild: null, guildList: [], friends: [], market: null, houses: null, house: null, visitors: [], trade: null, profile: null,
  settings, conn: 'ok', travel: null, died: null, autoFarm: 0, target: null, admin: false, selected: null, stationProf: null, tracked: null, menuOpen: true, combatLog: [], levelUp: 0, fps: 60,
};
const subs = new Set<() => void>(); let ver = 0; const cache = new Map<(s: S) => any, { v: number; r: any }>();
export function set(patch: Partial<S>) { Object.assign(state, patch); ver++; subs.forEach(f => f()); }
/** Selektoren müssen stabile Referenzen liefern (keine neuen Arrays/Objekte erzeugen). */
export function useS<T>(sel: (s: S) => T): T { return useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => sel(state)); }
let tid = 1; export function toast(text: string, kind = 'info') { const t = { id: tid++, text, kind }; set({ toasts: [...state.toasts.slice(-4), t] }); setTimeout(() => set({ toasts: state.toasts.filter(x => x.id !== t.id) }), 3800); }
export function saveSettings() { try { localStorage.setItem('nam.settings', JSON.stringify(state.settings)); } catch { /* ignorieren */ } }
void cache; void ver;

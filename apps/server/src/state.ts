import type { SockLike } from './core';
import type { Character, ItemInst, EvtView } from '@nam/shared';
import type { Derived } from '@nam/shared';
import type { MobDef, LocDef } from '@nam/game-data';
import type { Store } from './store';
export interface Fx { k: string; until: number; v: number; src?: string; next?: number }
export interface Account { id: string; name: string; hash: string; salt: string; created: number; tokens: { h: string; exp: number }[]; admin?: boolean; banned?: boolean }
export interface Player {
  id: string; c: Character; ws: SockLike; acc: Account; loc: string; x: number; y: number; dx: number; dy: number;
  target: string | null; auto: boolean; autoFarm: { until: number; hx: number; hy: number } | null; atkAt: number; cd: Record<string, number>; fx: Fx[];
  partyId: string | null; combatUntil: number; travel: { to: string; until: number; from: string } | null; gather: { uid: string; until: number } | null; pending: { kind: 'gather' | 'crate'; uid: string } | null;
  emote?: { k: string; until: number }; rid: number; tokens: number; tokAt: number; summons: { kind: string; until: number; next: number; pow: number }[]; dead: boolean; deadUntil: number;
  st: Derived; pvpSt: Derived | null; mods: any; duel: { opp: string; until: number } | null; trade: Trade | null; lastChat: number; evq: EvtView[]; petAt: number; hits: number; resAcc: number;
  houseId: string | null; houseFloor: number; online: boolean; shield: number; lastMsgSec: number; stunnedUntil: number; invites: { kind: string; from: string; until: number; data?: any }[]; dirty: boolean; lastAct: number; geo?: GeoState; inScene?: boolean;
}
export interface GeoState { on: boolean; gps: boolean; visible: boolean; lat: number; lon: number; has: boolean; mode: string; dest: { lat: number; lon: number } | null; lastT: number; strikes: number[]; lockUntil: number; flags: string[]; lastPush: number; day: number; dayM: number; visited: Set<string> }
export interface Trade { id: string; a: string; b: string; offers: Record<string, { gold: number; uids: string[] }>; ready: Record<string, boolean> }
export interface Mob { uid: string; def: MobDef; hp: number; maxHp: number; x: number; y: number; hx: number; hy: number; threat: Record<string, number>; dmg: Record<string, number>; target: string | null; atkAt: number; tick: number; fx: Fx[]; phase: number; dead: boolean; respawnAt: number; add: boolean; enrage: number; lastHit: number; skills: MobDef['skills']; lvl: number; flashT: number }
export interface NodeS { uid: string; def: string; x: number; y: number; ready: boolean; respawnAt: number; hp: number }
export interface LocState { id: string; def: LocDef; players: Set<Player>; mobs: Mob[]; nodes: NodeS[]; weather: string; weatherUntil: number; evts: EvtView[]; bossText: string[] }
export interface Party { id: string; leader: string; members: string[]; expMode: 'even' | 'level' }
export interface Guild { id: string; name: string; tag: string; leader: string; created: number; level: number; exp: number; gold: number; members: Record<string, { name: string; rank: number; joined: number; contrib: number }>; bank: ItemInst[]; skills: Record<string, number>; war: { vs: string; vsName: string; until: number; score: number; theirScore: number } | null; houseId: string | null; motd: string; quest: { id: string; prog: number; day: number } }
export interface House { id: string; kind: 'player' | 'guild'; ownerId: string; ownerName: string; slot: number; style: string; floors: number; furniture: { id: string; furn: string; x: number; y: number; rot: number; floor: number }[]; visit: 'all' | 'friends' | 'private'; stash: ItemInst[]; garden: { plantedAt: number } | null; rent?: { tenant: string; tenantName: string; price: number; until: number } | null; created: number }
export interface Listing { id: string; kind: 'ah' | 'stall' | 'order'; seller: string; sellerName: string; item?: ItemInst; price: number; expires: number; want?: { id: string; qty: number }; created: number }
export const G = {
  store: null as unknown as Store, players: new Map<string, Player>(), byName: new Map<string, Player>(), locs: new Map<string, LocState>(), parties: new Map<string, Party>(), guilds: new Map<string, Guild>(),
  houses: new Map<string, House>(), geoTaken: new Map<string, number>(), houseOcc: new Map<string, Set<Player>>(), market: new Map<string, Listing>(), chars: new Map<string, Character>(), tradeSeq: 0, startedAt: Date.now(), stats: { msgs: 0, ticks: 0, tickMs: 0, saves: 0 },
};
export const now = () => Date.now();
export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const rint = (a: number, b: number) => Math.floor(rnd(a, b + 1));
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
let useq = 0; export const uid = (p = 'u') => `${p}${Date.now().toString(36)}${(useq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.6);
const deferred = new WeakMap<Player, string[]>();
export function deferMessages(p: Player, update: () => void): () => void {
  const messages: string[] = [];
  deferred.set(p, messages);
  try { update(); } finally { deferred.delete(p); }
  return () => { for (const message of messages) sendRaw(p, message); };
}
function sendRaw(p: Player, message: string) {
  if (p.online && p.ws.readyState === 1) {
    try { p.ws.send(message); } catch { /* Verbindung getrennt */ }
  }
}
export function send(p: Player | undefined, m: any) {
  if (!p?.online) return;
  const messages = deferred.get(p);
  const message = JSON.stringify(m);
  if (messages) messages.push(message);
  else sendRaw(p, message);
}
export const sys = (p: Player | undefined, text: string, kind = 'sys') => send(p, { t: 'chat', ch: kind, from: '', text, at: now() });
export function toLoc(l: LocState, m: any) { const s = JSON.stringify(m); for (const p of l.players) if (p.online && p.ws.readyState === 1) p.ws.send(s); }

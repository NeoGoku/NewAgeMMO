/** Nachrichtenprotokoll (JSON über WebSocket). Client->Server: { t, rid, ...payload }. Server->Client: { t, rid?, ok?, err?, ...payload }. */
export type Msg = { t: string; rid?: number; [k: string]: any };
export const PROTOCOL_VERSION = 1;
export const NAME_RE = /^[A-Za-zÄÖÜäöüß0-9_\- ]{3,16}$/;
export const ACC_RE = /^[A-Za-z0-9_\-]{3,20}$/;
export interface PlayerView { id: string; name: string; cls: string; look: any; lvl: number; hp: number; maxHp: number; x: number; y: number; dx: number; dy: number; guild?: string; eq: Record<string, string>; pet?: string; emote?: string; emoteT?: number; pvp?: boolean; party?: boolean; fx?: string[]; sum?: number; mount?: boolean }
export interface MobView { uid: string; def: string; hp: number; maxHp: number; x: number; y: number; ph: number; fx?: string[]; tgt?: string; cast?: number }
export interface NodeView { uid: string; def: string; x: number; y: number; ready: boolean; hp: number }
export interface EvtView { k: 'dmg'|'heal'|'crit'|'miss'|'block'|'text'|'fx'|'die'|'lvl'|'loot'|'proj'; x: number; y: number; v?: number | string; id?: string; from?: string; to?: string; el?: string; c?: string }
export interface StateMsg { t: 'state'; loc: string; tm: number; weather: string; players: PlayerView[]; mobs: MobView[]; nodes: NodeView[]; evts: EvtView[]; me: { hp: number; maxHp: number; res: number; maxRes: number; target: string|null; auto: boolean; cd: Record<string, number>; fx: { k: string; left: number }[]; combat: boolean; autoFarm: boolean; shield: number }; party: { id: string; name: string; hp: number; maxHp: number; lead: boolean }[] }
export const EMOTES = ['wave','dance','laugh','cheer','bow','sit','cry','flex'];

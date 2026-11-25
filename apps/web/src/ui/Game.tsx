import React, { useEffect, useRef, useState } from 'react';
import { CLASS_BASE, expToNext, BAL } from '@nam/shared'; import { SKILLS, LOCS, MOBS, ITEMS } from '@nam/game-data';
import { state, set, useS, toast } from '../store'; import { view, act, call, logoutChar, pushChat } from '../game'; import { audio } from '../audio'; import { portraitUrl } from '../render';
import { GameCanvas } from './GameCanvas'; import { Bar, skillIcon, useTick, fmt, Icon } from './kit';
import { Inventory, Character, MapPanel, QuestPanel } from './Panels1'; import { CraftPanel, PetsPanel, HousePanel, HousesList } from './Panels2'; import { GuildPanel, SocialPanel, MarketPanel, TradePanel, ProfilePanel, ArenaPanel } from './Panels3'; import { Dialog } from './Dialog';
import { GeoScreen } from '../geo'; import { geoDo, geoBus } from '../geo/bus'; import { OptionsBody } from './Screens';
import { isSoloServer, net } from '../net';
import { GeoPropertyPanel } from './GeoPropertyPanel';
import { AdminPanel } from './AdminPanel';

/** Ereignisleiste: fünf Hauptbereiche. */
const NAV: [string, string][] = [['map', 'Karte'], ['char', 'Helden'], ['inv', 'Inventar'], ['quest', 'Quests'], ['more', 'Mehr']];
const MORE: [string, string][] = [['craft', 'Berufe'], ['pets', 'Pets'], ['geoProperty', 'Immobilien'], ['guild', 'Gilde'], ['social', 'Soziales'], ['market', 'Markt'], ['map2', 'Ortsliste'], ['opt', 'Einstellungen']];
const ICON: Record<string, React.ReactNode> = {
  map: <svg viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></svg>,
  char: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>,
  inv: <svg viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V5a3 3 0 016 0v2" /></svg>,
  quest: <svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z" /><path d="M9 10h6M9 14h6M9 18h4" /></svg>,
  more: <svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="18" cy="12" r="1.6" fill="currentColor" /></svg>,
};
export function Game() {
  const char = useS(s => s.char)!; const snap = useS(s => s.snap); const panel = useS(s => s.panel); const dialog = useS(s => s.dialog); const travel = useS(s => s.travel); const died = useS(s => s.died); const conn = useS(s => s.conn); const house = useS(s => s.house); const inScene = useS(s => s.inScene);
  const geoMode = useS(s => s.geoMode); const walking = useS(s => s.geoWalking); const navPanel = useS(s => s.navPanel); const chatOpen = useS(s => s.hudChat); const scale = useS(s => s.settings.uiScale);
  const selectedProperty = useS(s => s.selected?.id as string | undefined);
  const canAdmin = useS(s => s.admin && !isSoloServer(s.settings.server));
  useTick(250); const me = snap?.me; const cb = CLASS_BASE[char.cls]; const need = char.level >= BAL.maxLevel ? BAL.prestigeExp : expToNext(char.level); const expv = char.level >= BAL.maxLevel ? char.pexp : char.exp;
  const [more, setMore] = useState(false);
  const [geoRegion, setGeoRegion] = useState<string>();
  useEffect(() => { const h = (e: Event) => { const d = (e as CustomEvent).detail; set({ geoMode: d.mode, geoWalking: d.walking }); setGeoRegion(d.region); }; geoBus.addEventListener('state', h); return () => geoBus.removeEventListener('state', h); }, []);
  useEffect(() => { const kd = (e: KeyboardEvent) => { const t = e.target as HTMLElement; if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) { if (e.key === 'Escape') t.blur(); return; } const k = e.key.toLowerCase(); const hb = state.char?.hotbar; if (k >= '1' && k <= '6' && hb && state.inScene) { const id = hb[+k - 1]; if (id) cast(id); } else if (k === ' ' && state.inScene) { e.preventDefault(); act('auto', { on: !view.snap?.me.auto }); } else if (k === 'i') nav('inv'); else if (k === 'c') nav('char'); else if (k === 'q') nav('quest'); else if (k === 'escape') { set({ panel: null, dialog: null, navPanel: '' }); setMore(false); } else if (k === 'enter') set({ hudChat: true }); }; window.addEventListener('keydown', kd); return () => window.removeEventListener('keydown', kd); }, []);
  const nav = (p: string) => { audio.sfx('click'); if (p === 'map') { set({ panel: null, navPanel: '', dialog: null }); setMore(false); geoDo('recenter'); return; } if (p === 'more') { setMore(m => !m); return; } setMore(false); if (p === 'house') act('houseList'); if (p === 'guild') act('guildInfo'); if (p === 'social') act('friends'); if (p === 'market') act('market', { kind: 'ah' }); set({ panel: state.panel === p ? null : p, navPanel: p, dialog: null }); };
  const more2 = (p: string) => { setMore(false); if (p === 'geoProperty') { set({ panel: p, selected: null, navPanel: 'more', dialog: null }); return; } if (p === 'map2') { set({ panel: 'map', navPanel: 'more' }); return; } if (p === 'opt') { set({ panel: 'opt', navPanel: 'more' }); return; } nav(p); set({ navPanel: 'more' }); };
  const cast = (id: string) => { audio.unlock(); act('skill', { id }); };
  const tgtMob = me?.target ? snap?.mobs.find((m: any) => m.uid === me.target) : null; const tgtPl = me?.target && !tgtMob ? snap?.players.find((p: any) => p.id === me.target) : null;
  const inCombat = inScene && !!(me?.combat || tgtMob);
  const pots = char.inventory.filter(i => i.id.startsWith('pot_hp')).reduce((s, i) => s + i.qty, 0);
  const locName = geoRegion ?? (geoMode === 'gps' ? 'Standort wird ermittelt' : LOCS[state.loc]?.name || ''); const eq = Object.fromEntries(Object.entries(char.equipment).map(([k, v]) => [k, v!.id]));
  return <div className="app" style={{ zoom: scale }} onPointerDown={() => audio.unlock()}>
    {inScene ? <GameCanvas /> : null}
    <GeoScreen hidden={inScene} controlsBlocked={!!(panel || dialog || chatOpen || travel || died || more || house)} />
    {/* Obere Leiste: Charakter kompakt */}
    {!inScene && <div className="hudc"><img src={portraitUrl(char.cls, char.look, eq, 64)} alt="" />
      <div className="bars"><div className="nm"><span>{char.name}</span><span className="lvl">Lv {char.level}{char.prestige ? `★${char.prestige}` : ''}</span></div>
        <div className="thin"><i style={{ width: `${Math.min(100, (me?.hp ?? char.hp) / (me?.maxHp ?? 100) * 100)}%`, background: '#ff4d6d' }} /></div>
        <div className="thin"><i style={{ width: `${Math.min(100, (me?.res ?? char.res) / (me?.maxRes ?? 100) * 100)}%`, background: '#4aa8ff' }} /></div>
        <div className="thin"><i style={{ width: `${Math.min(100, expv / need * 100)}%`, background: '#c46cff' }} /></div>
        <div className="sub"><span>{cb.res} · {fmt(char.gold)} Gold</span><span>{locName}</span></div></div></div>}
    {inScene && <div className="scenebar"><div className="pill-btn" style={{ borderColor: '#5ef2ff' }}>{LOCS[state.loc]?.name} · Kampfansicht</div><button className="pill-btn warn" onClick={() => net.send('geoFlee')}>Zur Karte</button></div>}
    {/* Chat: standardmäßig eingeklappt */}
    {chatOpen ? <Chat /> : <button className="pill-btn" style={{ position: 'absolute', right: 'calc(8px + var(--sar))', bottom: 'calc(var(--navh) + 8px + var(--sab))', zIndex: 9, pointerEvents: 'auto' }} onClick={() => set({ hudChat: true })}>Chat</button>}
    {/* Kartenmodus: Bewegungsleiste */}
    {!inScene && <div className="pills"><div style={{ display: 'flex', gap: 8 }}><button className="pill-btn" onClick={() => geoDo('toggleMode')}>{geoMode === 'gps' ? 'Zu virtuell wechseln' : 'GPS nutzen'}</button>{walking && <button className="pill-btn warn" onClick={() => geoDo('stop')}>Stopp</button>}</div><span style={{ width: 0 }} /></div>}
    {/* Kampfleiste: nur im Kampf */}
    {inCombat && <div className="skillbar">
      <button className={`slot${me?.auto ? ' sel' : ''}`} style={{ width: 46, height: 46 }} onClick={() => act('auto', { on: !me?.auto })}><span className="xs">Auto</span></button>
      {char.hotbar.map((id, i) => { const s = id ? SKILLS[id] : null; const cd = id && me ? me.cd[id] : 0; const noRes = s && (me?.res ?? 0) < s.cost; return <div key={i} className={`slot skill${s && !cd && !noRes ? ' ready' : ''}${noRes ? ' nores' : ''}`} onClick={() => s && cast(id!)}>{s ? skillIcon(id!) : <span className="dim">+</span>}<span className="key">{i + 1}</span>{cd ? <div className="cd">{(cd / 1000).toFixed(cd < 10000 ? 1 : 0)}</div> : null}</div>; })}
      <button className="slot" style={{ width: 46, height: 46 }} onClick={() => { const p = char.inventory.find(i => i.id.startsWith('pot_hp')); if (p) act('useItem', { uid: p.uid }); else toast('Kein Heiltrank', 'err'); }}><Icon shape="potion" color="#ff4d6d" size={30} /><span className="q">{pots}</span></button>
    </div>}
    {tgtMob && inScene && <div className="tgt" style={{ top: 'calc(56px + var(--sat))', left: '50%', transform: 'translateX(-50%)', width: 'min(320px,80vw)', position: 'absolute', zIndex: 8 }}><div className="row"><b className="grow sm">{MOBS[tgtMob.def].name}</b><span className="pill">Lv {MOBS[tgtMob.def].lvl}</span></div><Bar v={tgtMob.hp} max={tgtMob.maxHp} color="linear-gradient(#e8505f,#a02030)" h={12} /></div>}
    {/* Ereignisleiste */}
    <nav className="navbar">{NAV.map(([k, l]) => <button key={k} className={(k === 'more' ? more : navPanel === k || (k === 'map' && !navPanel && !more)) ? 'on' : ''} onClick={() => nav(k)}>{ICON[k]}<span>{l}</span></button>)}</nav>
    {more && <div className="morepanel">{MORE.map(([k, l]) => <button key={k} onClick={() => more2(k)}>{l}</button>)}{canAdmin && <button onClick={() => more2('admin')}>Serververwaltung</button>}<button onClick={() => { setMore(false); void logoutChar(); }}>Charakter wechseln</button></div>}
    <Toasts /><Invites />
    {/* Panels & Dialoge */}
    {panel === 'inv' && <Inventory />}{panel === 'char' && <Character />}{panel === 'map' && <MapPanel />}{panel === 'quest' && <QuestPanel />}{panel === 'craft' && <CraftPanel />}{panel === 'pets' && <PetsPanel />}{panel === 'houses' && <HousesList />}
    {panel === 'geoProperty' && !house && <GeoPropertyPanel id={selectedProperty} />}{(panel === 'house' || panel === 'houses') && !house && <HousesList />}{house && <HousePanel />}
    {panel === 'guild' && <GuildPanel />}{panel === 'social' && <SocialPanel />}{panel === 'market' && <MarketPanel />}{panel === 'trade' && <TradePanel />}{panel === 'profile' && <ProfilePanel />}{panel === 'arena' && <ArenaPanel />}
    {panel === 'admin' && canAdmin && <AdminPanel />}
    {panel === 'opt' && <div className="win c1" style={{ maxHeight: '86vh' }}><header><span>⚙ Menü</span><button className="btn sm x" onClick={() => set({ panel: null })}>✕</button></header><div className="body"><button className="btn" disabled={inScene} onClick={() => { set({ panel: null }); geoDo('mapSettings'); }}>Kartenansicht</button><div className="hr" /><OptionsBody ingame /><div className="hr" /><div className="row wrap"><button className="btn" onClick={() => { geoDo('wipe'); }}>Meine Standortdaten löschen</button><button className="btn" onClick={async () => { set({ panel: null }); await logoutChar(); }}>Charakter wechseln</button><button className="btn" onClick={async () => { if (await logoutChar()) set({ screen: 'title' }); }}>Zum Titelbildschirm</button></div></div></div>}
    {dialog && <Dialog />}
    {travel && <Travel />}{died && <Died />}
    {conn !== 'ok' && <div className="connection-status" role="status">Verbindung unterbrochen · erneuter Versuch</div>}
  </div>;
}
export const goalText = (g: any) => g.k === 'kill' ? `Besiege ${g.t === '*' ? 'Gegner' : MOBS[g.t]?.name}` : g.k === 'boss' ? `Besiege ${MOBS[g.t]?.name}` : g.k === 'collect' ? `Sammle ${ITEMS[g.t]?.name}` : g.k === 'craft' ? `Stelle her: ${g.t === '*' ? 'Gegenstände' : ITEMS[g.t]?.name}` : g.k === 'gather' ? 'Sammle Ressourcen' : g.k === 'visit' ? `Besuche ${LOCS[g.t]?.name}` : g.k === 'dungeon' ? `Besiege Gegner: ${LOCS[g.t]?.name}` : 'Sprich mit NPC';
function Chat() {
  const chat = useS(s => s.chat); const [ch, setCh] = useState('local'); const [txt, setTxt] = useState(''); const ref = useRef<HTMLDivElement>(null); const [tab, setTab] = useState('all');
  useEffect(() => { ref.current?.scrollTo(0, 1e6); }, [chat, tab]);
  const send = () => { let t = txt.trim(); if (!t) return; let c = ch, to = ''; if (t.startsWith('/')) { const [cmd, ...r] = t.split(' '); const rest = r.join(' '); if (cmd === '/w' || cmd === '/msg') { c = 'whisper'; to = r.shift() || ''; t = r.join(' '); } else if (cmd === '/p') { c = 'party'; t = rest; } else if (cmd === '/g') { c = 'guild'; t = rest; } else if (cmd === '/world' || cmd === '/y') { c = 'global'; t = rest; } else if (cmd === '/s' || cmd === '/l') { c = 'local'; t = rest; } else if (['/wave', '/dance', '/laugh', '/cheer', '/bow', '/sit', '/cry', '/flex'].includes(cmd)) { act('emote', { k: cmd.slice(1) }); setTxt(''); return; } else { pushChat({ ch: 'sys', from: '', text: 'Befehle: /w Name Text, /p, /g, /world, /wave /dance /laugh /cheer /bow /sit /cry /flex', at: Date.now() }); setTxt(''); return; } } if (!t) return; call('chat', { ch: c, text: t, to }); setTxt(''); };
  const lines = chat.filter(m => tab === 'all' || m.ch === tab || (tab === 'sys' && ['sys', 'loot', 'quest', 'warn', 'boss'].includes(m.ch)));
  return <div className="chatbox" style={{ position: 'absolute', left: 'calc(8px + var(--sal))', bottom: 'calc(var(--navh) + 8px + var(--sab))', width: 'min(340px,72vw)', zIndex: 9, pointerEvents: 'auto' }}><div className="row" style={{ gap: 3 }}>{[['all', 'Alle'], ['local', 'Ort'], ['party', 'Gruppe'], ['guild', 'Gilde'], ['sys', 'System']].map(([k, l]) => <button key={k} className={`tab xs${tab === k ? ' on' : ''}`} style={{ padding: '2px 7px' }} onClick={() => setTab(k)}>{l}</button>)}<span className="grow" /><button className="tab xs" onClick={() => set({ hudChat: false })}>▼ einklappen</button></div>
    <div className="chatlog" ref={ref}>{lines.slice(-60).map((m, i) => <div key={i} className={`ch-${m.ch}`}>{m.from ? <b>{m.ch === 'whisper' ? (m.from === state.char?.name ? `An ${m.to}` : `${m.from} flüstert`) : m.from}: </b> : null}{m.text}</div>)}</div>
    <div className="row" style={{ gap: 3 }}><select style={{ width: 74, minHeight: 34, padding: '0 4px' }} value={ch} onChange={e => setCh(e.target.value)}><option value="local">Ort</option><option value="party">Gruppe</option><option value="guild">Gilde</option><option value="global">Welt</option></select><input id="chatin" type="text" style={{ minHeight: 34, padding: '4px 8px' }} value={txt} maxLength={200} placeholder="Nachricht… (/w Name)" onChange={e => setTxt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { send(); (e.target as HTMLInputElement).blur(); } e.stopPropagation(); }} /><button className="btn sm" onClick={send}>➤</button></div></div>;
}
function Toasts() { const t = useS(s => s.toasts); return <div className="toasts">{t.map(x => <div key={x.id} className={`toast ${x.kind}`}>{x.text}</div>)}</div>; }
function Invites() { const inv = useS(s => s.invites); const acc: Record<string, string> = { party: 'partyAccept', guild: 'guildAccept', trade: 'tradeAccept', duel: 'duelAccept' }; const label: Record<string, string> = { party: 'Gruppeneinladung', guild: 'Gildeneinladung', trade: 'Handelsanfrage', duel: 'Duellforderung' }; return <div className="invite" style={{ top: 'calc(120px + var(--sat))' }}>{inv.map((i, k) => <div key={k} className="card"><span className="sm"><b>{i.from}</b>: {label[i.kind]}{i.data?.guild ? ` (${i.data.guild})` : ''}</span><button className="btn sm pri" onClick={async () => { set({ invites: state.invites.filter(x => x !== i) }); await call(acc[i.kind], { from: i.fromId }); if (i.kind === 'trade') set({ panel: 'trade' }); }}>✔</button><button className="btn sm" onClick={() => set({ invites: state.invites.filter(x => x !== i) })}>✕</button></div>)}</div>; }
function Travel() { const t = useS(s => s.travel)!; useTick(100); const f = Math.min(1, (performance.now() - t.start) / t.ms); const d = LOCS[t.to]; return <div className="overlay"><div className="b" style={{ fontSize: 22 }}>Reise nach {d.name}</div><div className="dim">{d.desc}</div><div className="prog"><i style={{ width: `${f * 100}%` }} /></div><div className="dim xs">{LOCS[t.from]?.name} → {d.name}</div></div>; }
function Died() { const snap = useS(s => s.snap); return <div className="overlay" style={{ background: '#400a' }}><div style={{ fontSize: 36 }} className="err b">Du bist gestorben</div><div className="dim">Wiederbelebung in {Math.max(0, Math.ceil(((snap?.me as any)?.deadIn ?? 0) / 1000))} s · EXP-Verlust 5 %</div></div>; }

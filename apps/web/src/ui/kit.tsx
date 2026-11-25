import React, { useState, useEffect } from 'react';
import { ITEMS, SKILLS } from '@nam/game-data'; import { RARITY_COLORS, RARITY_MULT, type ItemInst } from '@nam/shared';
import { iconUrl } from './../render'; import { audio } from '../audio';
export const Icon = ({ shape, color, size = 46 }: { shape: string; color: string; size?: number }) => <img src={iconUrl(shape, color)} width={size} height={size} alt="" draggable={false} />;
export function Win({ title, onClose, children, w, icon }: { title: string; onClose?: () => void; children: React.ReactNode; w?: number; icon?: string }) {
  return <div className="win c1" style={w ? { width: `min(${w}px,calc(100% - 8px))` } : undefined} onPointerDown={e => e.stopPropagation()}><header><span>{icon} {title}</span>{onClose && <button className="btn sm x" onClick={() => { audio.sfx('click'); onClose(); }}>✕</button>}</header><div className="body">{children}</div></div>;
}
export const Bar = ({ v, max, color, label, h }: { v: number; max: number; color: string; label?: string; h?: number }) => <div className="bar" style={h ? { height: h } : undefined}><i style={{ width: `${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%`, background: color }} /><span>{label ?? `${Math.round(v)} / ${Math.round(max)}`}</span></div>;
export function ItemSlot({ it, sel, onClick, size, cd }: { it?: ItemInst | null; sel?: boolean; onClick?: () => void; size?: number; cd?: string }) {
  const d = it ? ITEMS[it.id] : null; const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  return <div className={`slot${sel ? ' sel' : ''}`} style={{ borderColor: it ? RARITY_COLORS[it.rar] : undefined, ...(size ? { width: size, height: size } : {}) }} onClick={() => { if (onClick) { audio.sfx('click'); onClick(); } }} onMouseEnter={e => it && setTip({ x: e.clientX, y: e.clientY })} onMouseMove={e => it && setTip({ x: e.clientX, y: e.clientY })} onMouseLeave={() => setTip(null)}>
    {d && <Icon shape={d.icon.shape} color={d.icon.color} size={size ? size - 8 : 46} />}{it && it.qty > 1 && <span className="q">{it.qty}</span>}{cd && <div className="cd">{cd}</div>}
    {tip && it && <div className="tip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 270), top: Math.min(tip.y + 14, window.innerHeight - 160) }}><ItemTip it={it} /></div>}</div>;
}
export function ItemTip({ it }: { it: ItemInst }) {
  const d = ITEMS[it.id]; const m = RARITY_MULT[it.rar]; return <div><div className="b" style={{ color: RARITY_COLORS[it.rar] }}>{d.name}</div><div className="dim xs">{['Normal', 'Ungewöhnlich', 'Selten', 'Episch', 'Legendär'][it.rar]} · {d.type}{d.lvl > 1 ? ` · Lv ${d.lvl}` : ''}</div>
    {d.atk ? <div>Angriff +{Math.round(d.atk * m)}</div> : null}{d.def ? <div>Rüstung +{Math.round(d.def * m)}</div> : null}{d.mdef ? <div>Magieabwehr +{Math.round(d.mdef * m)}</div> : null}{d.hp ? <div>Leben +{Math.round(d.hp * m)}</div> : null}{d.res ? <div>Ressource +{Math.round(d.res * m)}</div> : null}
    {d.attrs ? Object.entries(d.attrs).map(([k, v]) => <div key={k}>{k.toUpperCase()} +{Math.round((v as number) * m)}</div>) : null}{it.dur !== undefined ? <div className={it.dur < 30 ? 'err' : 'dim'}>Haltbarkeit {it.dur}/100</div> : null}<div className="dim">{d.desc}</div><div className="gold xs">{Math.floor(d.price * .25 * m)} Gold (Verkauf)</div></div>;
}
export const Tabs = ({ tabs, v, set }: { tabs: [string, string][]; v: string; set: (k: string) => void }) => <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={`tab${v === k ? ' on' : ''}`} onClick={() => { audio.sfx('click'); set(k); }}>{l}</button>)}</div>;
export const skillIcon = (id: string) => { const s = SKILLS[id]; return s ? <Icon shape={s.icon.shape} color={s.icon.color} size={44} /> : null; };
export function useTick(ms = 500) { const [, f] = useState(0); useEffect(() => { const i = setInterval(() => f(x => x + 1), ms); return () => clearInterval(i); }, [ms]); }
export const fmt = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : String(Math.floor(n));
export const fmtT = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`; };

import React, { useEffect, useRef } from 'react';
import { LOCS, MOBS, NODES, NPCS, SPECIES, ELEMENT_COLOR } from '@nam/game-data';
import { drawBackground, drawWeather, drawCharacter, drawMob, drawPet, drawSummon, drawNode, drawHotspot, drawLink, drawFx, drawFloatText, drawBar, drawNameplate } from '../render';
import { view, act, call } from '../game'; import { state, set, toast } from '../store'; import { audio } from '../audio';
interface D { x: number; y: number; fx: number; face: 1 | -1; atk: number; flash: number; lastX: number; hp: number; dead: number; seen: number; def?: any }
const disp = new Map<string, D>(); const ghosts: { id: string; def: any; d: D; t0: number }[] = [];
const sc = (y: number, h: number) => Math.max(.5, (.66 + (y - 50) / 44 * .52)) * (h / 600);
export function GameCanvas() {
  const ref = useRef<HTMLCanvasElement>(null); const hits = useRef<{ k: string; id: string; x: number; y: number; w: number; h: number; r?: number; data?: any }[]>([]); const hover = useRef<string>(''); const shake = useRef(0);
  useEffect(() => {
    const cv = ref.current!; const ctx = cv.getContext('2d')!; let raf = 0; let last = performance.now(); let fpsT = 0, fpsN = 0; disp.clear(); ghosts.length = 0;
    const resize = () => { const d = Math.min(2, window.devicePixelRatio || 1) * (state.settings.quality === 'low' ? .75 : 1); cv.width = Math.floor(cv.clientWidth * d); cv.height = Math.floor(cv.clientHeight * d); ctx.setTransform(d, 0, 0, d, 0, 0); }; resize(); const ro = new ResizeObserver(resize); ro.observe(cv);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame); const dt = Math.min(.1, (now - last) / 1000); last = now; fpsN++; if (now - fpsT > 1000) { state.fps = fpsN; fpsN = 0; fpsT = now; }
      const w = cv.clientWidth, h = cv.clientHeight; const snap = view.snap; const loc = LOCS[state.loc]; if (!loc) return;
      const X = (x: number) => x / 100 * w, Y = (y: number) => y / 100 * h; hits.current = [];
      ctx.save(); if (shake.current > 0 && state.settings.shake) { shake.current -= dt * 4; ctx.translate((Math.random() - .5) * shake.current * 8, (Math.random() - .5) * shake.current * 8); }
      const tm = snap?.tm ?? .5; const weather = snap?.weather ?? 'clear';
      drawBackground(ctx, w, h, loc.theme, tm, weather, now, loc.id);
      const items: { y: number; draw: () => void }[] = []; const me = snap?.players.find((p: any) => p.id === view.me); const target = snap?.me.target;
      // Hotspots
      for (const hs of loc.hotspots) { const npc = hs.npc ? NPCS[hs.npc] : null; const hv = hover.current === 'hs:' + hs.id; items.push({ y: hs.y, draw: () => { const r = drawHotspot(ctx, hs.art, X(hs.x), Y(hs.y), (h / 600) * (hs.w || 1), now, hv, hs.label, npc?.color); if (hs.kind !== 'decor') hits.current.push({ k: 'hs', id: hs.id, ...r, data: hs }); const q = npc && state.char ? questMark(npc.id) : ''; if (q) drawFloatText(ctx, q, X(hs.x), r.y - 6 + Math.sin(now / 250) * 3, 0, q === '!' ? '#ffd34d' : '#5ee06a', true); } }); }
      // Links
      for (const l of loc.links) { const hv = hover.current === 'ln:' + l.to; const r = drawLink(ctx, X(l.x), Y(l.y), l.label, now, hv); hits.current.push({ k: 'ln', id: l.to, ...r }); }
      if (snap) {
        for (const n of snap.nodes) { const nd = NODES[n.def]; items.push({ y: n.y, draw: () => { const s = sc(n.y, h); drawNode(ctx, X(n.x), Y(n.y), s, nd.kind, nd.color, n.ready, now, n.hp); if (n.ready) hits.current.push({ k: 'node', id: n.uid, x: X(n.x) - 28 * s, y: Y(n.y) - 56 * s, w: 56 * s, h: 60 * s }); } }); }
        const seen = new Set<string>();
        for (const p of snap.players) { seen.add(p.id); let d = disp.get(p.id); if (!d) disp.set(p.id, d = { x: p.x, y: p.y, fx: p.x, face: 1, atk: 0, flash: 0, lastX: p.x, hp: p.hp, dead: 0, seen: now }); const k = 1 - Math.exp(-dt * 7); const ox = d.x; d.x += (p.x - d.x) * k; d.y += (p.y - d.y) * k; if (Math.abs(d.x - ox) > .01) d.face = d.x > ox ? 1 : -1; d.seen = now; d.def = p;
          const mv = Math.hypot(p.x - d.x, p.y - d.y) > .6 || Math.abs(d.x - ox) > .02; const tgtMob = p.id === view.me ? snap.mobs.find((m: any) => m.uid === target) : null; if (tgtMob && snap.me.combat) d.face = tgtMob.x >= d.x ? 1 : -1; if (d.atk > 0) d.atk = Math.max(0, d.atk - dt * 3.5);
          items.push({ y: d.y, draw: () => { const s = sc(d.y, h) * 1.05; const px = X(d.x), py = Y(d.y); const isT = target === p.id; if (isT) ring(ctx, px, py, s, now, '#5ee06a');
            if (p.pet) drawPet(ctx, px - 36 * s * d.face, py + 3 * s, s * .75, p.pet, '#fff', 0, now);
            for (const sm of (p.sum || '').split(',').filter(Boolean)) drawSummon(ctx, px + 44 * s * -d.face, py - 4 * s, s * .9, sm, (({ wolf: '#9fd0ff', phoenix: '#ff8a3d', golem: '#9a8a70', drake: '#ff4d3d', titan: '#7fe0ff' }) as any)[sm] || '#fff', now, 0);
            drawCharacter(ctx, px, py, s, { cls: p.cls, look: p.look, eq: p.eq, facing: d.face, t: now, moving: mv, attack: d.atk, emote: p.emote, mount: !!p.eq?.mount, hp: p.hp / p.maxHp, dead: (p as any).dead });
            drawBar(ctx, px - 26 * s, py - 104 * s, 52 * s, 6 * s, p.hp / p.maxHp, p.id === view.me ? '#5ee06a' : p.party ? '#4aa8ff' : '#ff8a3d'); drawNameplate(ctx, p.name, px, py - 108 * s, p.id === view.me ? '#7fe9ff' : '#fff', p.guild ? `<${p.guild}> Lv${p.lvl}` : `Lv${p.lvl}`);
            hits.current.push({ k: 'pl', id: p.id, x: px - 26 * s, y: py - 100 * s, w: 52 * s, h: 104 * s }); } }); }
        for (const id of [...disp.keys()]) if (!seen.has(id) && !id.startsWith('m') && now - disp.get(id)!.seen > 800) disp.delete(id);
        for (const m of snap.mobs) { seen.add(m.uid); const md = MOBS[m.def]; let d = disp.get(m.uid); if (!d) disp.set(m.uid, d = { x: m.x, y: m.y, fx: m.x, face: -1, atk: 0, flash: 0, lastX: m.x, hp: m.hp, dead: 0, seen: now, def: md }); const k = 1 - Math.exp(-dt * 6); const ox = d.x; d.x += (m.x - d.x) * k; d.y += (m.y - d.y) * k; const tp = m.tgt ? snap.players.find((p: any) => p.id === m.tgt) : null; if (tp) d.face = tp.x >= d.x ? 1 : -1; else if (Math.abs(d.x - ox) > .01) d.face = d.x > ox ? 1 : -1; d.seen = now; d.hp = m.hp; if (d.atk > 0) d.atk = Math.max(0, d.atk - dt * 3); if ((m as any).flash) d.flash = 1; d.flash = Math.max(0, d.flash - dt * 6);
          items.push({ y: d.y, draw: () => { const s = sc(d.y, h) * md.art.scale * (m.uid && (m as any).add ? .7 : 1); const px = X(d.x), py = Y(d.y); const isT = target === m.uid; if (isT) ring(ctx, px, py, s, now, '#ff4d5e');
            drawMob(ctx, px, py, s, md.art, { t: now, flash: d.flash, attack: d.atk, dead: 0, facing: d.face, phase: m.ph, target: isT });
            const bw = Math.max(46, 54 * Math.min(2, md.art.scale)) * sc(d.y, h); drawBar(ctx, px - bw / 2, py - (96 * md.art.scale) * sc(d.y, h) - 4, bw, 6 * sc(d.y, h), m.hp / m.maxHp, md.role === 'boss' ? '#c46cff' : md.role === 'elite' ? '#ffb02e' : '#ff4d5e'); drawNameplate(ctx, md.name, px, py - (96 * md.art.scale) * sc(d.y, h) - 8, md.role === 'boss' ? '#ffb02e' : md.role === 'elite' ? '#ffd34d' : '#ffb0b0', `Lv${md.lvl}`);
            hits.current.push({ k: 'mob', id: m.uid, x: px - 34 * s, y: py - 90 * s, w: 68 * s, h: 92 * s }); } }); }
        for (const [id, d] of disp) if (id.startsWith('m') && !seen.has(id) && !ghosts.some(g => g.id === id)) { ghosts.push({ id, def: d.def, d: { ...d }, t0: now }); disp.delete(id); }
      }
      for (let i = ghosts.length - 1; i >= 0; i--) { const g = ghosts[i]; const a = (now - g.t0) / 700; if (a >= 1) { ghosts.splice(i, 1); continue; } items.push({ y: g.d.y, draw: () => { const s = sc(g.d.y, h) * g.def.art.scale; drawMob(ctx, X(g.d.x), Y(g.d.y), s, g.def.art, { t: now, flash: 0, attack: 0, dead: a, facing: g.d.face }); } }); }
      items.sort((a, b) => a.y - b.y); for (const it of items) it.draw();
      // Effekte
      const evs = view.evts; const pos = (id?: string) => { const d = id ? disp.get(id) : null; return d ? { x: X(d.x), y: Y(d.y) } : null; };
      for (let i = evs.length - 1; i >= 0; i--) { const e = evs[i]; const age = now - e.born; const dur = e.k === 'proj' ? 300 : e.k === 'fx' ? 650 : e.k === 'lvl' ? 1800 : e.k === 'die' ? 100 : 1100; if (age > dur) { evs.splice(i, 1); continue; } const a = age / dur; const ex = X(e.x), ey = Y(e.y); const s = sc(e.y, h);
        if (e.k === 'dmg' || e.k === 'crit' || e.k === 'heal' || e.k === 'text' || e.k === 'loot' || e.k === 'miss' || e.k === 'block') { if (!state.settings.showDmg && (e.k === 'dmg' || e.k === 'crit')) continue; const txt = e.k === 'miss' ? 'Daneben' : e.k === 'block' ? 'Geblockt' : e.k === 'heal' ? '+' + e.v : String(e.v); const col = e.k === 'heal' ? '#5ee06a' : e.k === 'crit' ? '#ffd34d' : e.k === 'loot' ? '#ffe27a' : e.k === 'text' ? '#ff9a4a' : e.c === 'p' ? '#ff6a6a' : e.k === 'miss' || e.k === 'block' ? '#cfd8ee' : '#ffffff'; if (e.k === 'loot' && e.id !== view.me) continue; drawFloatText(ctx, txt, ex + (i % 5 - 2) * 6, ey - 20 * s, a, col, e.k === 'crit' || e.k === 'text'); if (e.k === 'crit' && age < 60 && e.c !== 'p') shake.current = .5; if (e.c === 'p' && e.id === view.me && age < 50) shake.current = Math.max(shake.current, .3); }
        else if (e.k === 'proj') { const to = String(e.to || '').split(',').map(Number); const f = pos(e.from); if (f && to.length === 2) { const tx = X(to[0]), ty = Y(to[1]) + 0; drawFx(ctx, 'proj', f.x, f.y - 60 * s, tx, ty - 30 * s, e.el || 'phys', a); } }
        else if (e.k === 'fx') { const id = String(e.id || ''); const kind = id === 'aoe' || id === 'mobaoe' ? 'aoe' : id === 'heal' ? 'heal' : id === 'buff' ? 'buff' : id === 'summon' ? 'nova' : id === 'nova' ? 'nova' : id === 'dot' || id === 'summonhit' || id === 'mobatk' ? 'hit' : ''; if (kind) drawFx(ctx, kind, ex, ey - (kind === 'aoe' ? 0 : 30 * s), ex, ey, e.el || (id === 'mobaoe' ? 'fire' : 'phys'), a); if (id === 'mobatk' && age < 40) { const m = disp.get(e.from); if (m) m.atk = 1; } }
        else if (e.k === 'lvl') { drawFx(ctx, 'level', ex, ey, ex, ey, 'holy', a); drawFloatText(ctx, String(e.v), ex, ey - 60 * s, a, '#ffd34d', true); }
        else if (e.k === 'die') { /* Ghost übernimmt */ } }
      ctx.restore();
      if (weather !== 'clear' && state.settings.quality === 'high') drawWeather(ctx, w, h, weather, now); else if (weather === 'fog' || weather === 'snow') drawWeather(ctx, w, h, weather, now);
      // Spieler-Angriffsanimation anstoßen
      for (const e of evs) if (e.k === 'proj' && e.from && !e.anim) { e.anim = 1; const d = disp.get(e.from); if (d) d.atk = 1; }
    };
    const questMark = (npc: string) => { const c = state.char; if (!c) return ''; if (Object.entries(c.quests).some(([id, q]) => q.state === 'done' && (QUESTS_[id]?.turnin === npc))) return '?'; return QUEST_GIVERS.has(npc) && availGiver(npc) ? '!' : ''; };
    raf = requestAnimationFrame(frame); return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  const pick = (cx: number, cy: number) => { let best: any = null, bd = 1e9; for (const h of hits.current) { if (cx >= h.x && cx <= h.x + h.w && cy >= h.y && cy <= h.y + h.h) { const d = Math.hypot(cx - (h.x + h.w / 2), cy - (h.y + h.h / 2)) - (h.k === 'mob' || h.k === 'pl' ? 200 : 0); if (d < bd) { bd = d; best = h; } } } return best; };
  const onUp = (e: React.PointerEvent) => {
    audio.unlock(); const r = ref.current!.getBoundingClientRect(); const cx = e.clientX - r.left, cy = e.clientY - r.top; const h = pick(cx, cy); const snap = view.snap; if (!snap) return;
    if (!h) { act('walk', { x: cx / r.width * 100, y: Math.max(52, cy / r.height * 100) }); set({ dialog: null, selected: null }); const me = snap.players.find((p: any) => p.id === view.me); if (snap.me.target && false) act('target', { id: null }); return; }
    audio.sfx('click');
    if (h.k === 'mob') { if (snap.me.target === h.id) act('auto', { on: !snap.me.auto }); else act('target', { id: h.id }); set({ selected: null }); }
    else if (h.k === 'pl') { act('target', { id: h.id }); if (h.id !== view.me) set({ selected: { kind: 'player', id: h.id } }); else set({ selected: null }); }
    else if (h.k === 'node') { act('gather', { uid: h.id }); }
    else if (h.k === 'ln') { call('travel', { to: h.id }); }
    else if (h.k === 'hs') { const hs = h.data; if (hs.kind === 'npc') act('npc', { id: hs.npc }); else if (hs.kind === 'station') set({ stationProf: hs.prof, panel: 'craft' }); else if (hs.kind === 'houses') { act('houseList'); set({ panel: 'houses' }); } else if (hs.kind === 'stalls') { act('market', { kind: 'stall' }); set({ panel: 'market', selected: { tab: 'stall' } }); } }
  };
  const onMove = (e: React.PointerEvent) => { if (e.pointerType === 'touch') return; const r = ref.current!.getBoundingClientRect(); const h = pick(e.clientX - r.left, e.clientY - r.top); const k = h && (h.k === 'hs' || h.k === 'ln') ? (h.k === 'hs' ? 'hs:' : 'ln:') + (h.k === 'hs' ? h.data.id : h.id) : ''; hover.current = k; ref.current!.style.cursor = h ? 'pointer' : 'default'; };
  return <canvas ref={ref} className="full" style={{ touchAction: 'none' }} onPointerUp={onUp} onPointerMove={onMove} />;
}
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, c: string) { ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.globalAlpha = .65 + Math.sin(t / 180) * .25; ctx.shadowColor = c; ctx.shadowBlur = 10; ctx.beginPath(); ctx.ellipse(x, y + 2, 34 * s, 11 * s, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
import { QUESTS as QUESTS_ } from '@nam/game-data';
const QUEST_GIVERS = new Set(Object.values(QUESTS_).filter(q => q.giver).map(q => q.giver));
function availGiver(npc: string) { const c = state.char!; return Object.values(QUESTS_).some(q => q.giver === npc && q.type !== 'daily' && c.level >= q.lvl && !c.quests[q.id] && !c.questsDone.includes(q.id) && (!q.prereq || c.questsDone.includes(q.prereq))); }
void SPECIES; void ELEMENT_COLOR; void toast;

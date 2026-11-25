import { ITEMS } from '@nam/game-data';
import type { ClassId, Look } from '@nam/shared';
import { Ctx, TAU, blob, poly, glow, shade, mix, alpha, lg, clamp, mkCanvas, ctx2, star, parse, rgb, rr, pr, softShadow, litSprite, getLighting, texture } from './util';
import { mobShape } from './mobs';

export interface CharOpts { cls: ClassId; look: Look; eq: Record<string, string>; facing: 1 | -1; t: number; moving: boolean; attack: number; emote?: string; mount?: boolean; hp?: number; dead?: boolean }
const sin = Math.sin, cos = Math.cos;

const CLS: Record<ClassId, { main: string; trim: string; wc: string; plate: boolean }> = {
  dark_mage: { main: '#3a2a5a', trim: '#9a4dff', wc: '#9a4dff', plate: false }, light_mage: { main: '#e8e2d0', trim: '#ffd23a', wc: '#ffd23a', plate: false },
  archer: { main: '#3f6a3a', trim: '#b08a4a', wc: '#8ae05a', plate: false }, shield_sword: { main: '#8a96a8', trim: '#4a8ad0', wc: '#cfd6e4', plate: true },
  dual_sword: { main: '#3a3a48', trim: '#e04a4a', wc: '#ff6a6a', plate: false }, healer: { main: '#e0f0ea', trim: '#4ae0b0', wc: '#7affd0', plate: false },
  summoner: { main: '#2a4a5a', trim: '#35e0ff', wc: '#35e0ff', plate: false }, tank: { main: '#5a5f6a', trim: '#e0902a', wc: '#d8a050', plate: true },
};
const BODY_W = [1, .88, 1.16, 1.06], BODY_H = [1, 1.04, .98, .93];
type Piece = { col: string; tier: number; style: string } | null;
function piece(eq: Record<string, string>, slot: string): Piece {
  const id = eq?.[slot]; const d = id && ITEMS[id]; if (!d) return null;
  return { col: d.icon?.color || '#999', tier: d.tier || 0, style: d.style || 'cloth' };
}
const mt = (p: Piece, base: string) => p ? p.col : base;

/* ---------- Haare ---------- */
function hairBack(c: Ctx, st: number, col: string, f: boolean) {
  const hy = -66, d = shade(col, -.45);
  const fill = (g = col) => { c.fillStyle = lg(c, 0, hy - 20, 0, hy + 20, 0, shade(g, .2), 1, shade(g, -.25)); };
  if (st === 2 || st === 8 || (f && st === 4)) { fill(); c.beginPath(); c.moveTo(-17, hy - 4); c.quadraticCurveTo(-24, hy + 20, -16, hy + (st === 4 ? 14 : 32)); c.lineTo(12, hy + (st === 4 ? 14 : 30)); c.quadraticCurveTo(18, hy + 14, 17, hy - 4); c.fill(); c.strokeStyle = d; c.lineWidth = 1.2; c.stroke(); }
  if (st === 3) { fill(); c.beginPath(); c.moveTo(-14, hy - 8); c.quadraticCurveTo(-32, hy - 4, -28, hy + 22); c.quadraticCurveTo(-20, hy + 10, -12, hy + 2); c.fill(); c.strokeStyle = d; c.lineWidth = 1.2; c.stroke(); }
  if (st === 6) { for (const y of [-6, 6]) { fill(); c.beginPath(); c.moveTo(-14, hy + y - 3); c.quadraticCurveTo(-28, hy + y + 4, -22, hy + y + 24); c.quadraticCurveTo(-14, hy + y + 10, -10, hy + y + 4); c.fill(); c.strokeStyle = d; c.lineWidth = 1.2; c.stroke(); } }
  if (st === 9) { fill(); c.beginPath(); c.arc(0, hy - 6, 25, 0, TAU); c.fill(); c.strokeStyle = d; c.lineWidth = 1.2; c.stroke(); }
}
function hairFront(c: Ctx, st: number, col: string) {
  const hy = -66, d = shade(col, -.5), g = lg(c, 0, hy - 22, 0, hy + 2, 0, shade(col, .3), 1, shade(col, -.15));
  const ln = () => { c.strokeStyle = d; c.lineWidth = 1.2; c.stroke(); };
  c.fillStyle = g;
  const cap = (low: number, back = 2) => { c.beginPath(); c.moveTo(-18, hy + 2 + back); c.quadraticCurveTo(-21, hy - 24, 0, hy - 22); c.quadraticCurveTo(21, hy - 24, 18, hy - 2); c.lineTo(15, hy - 8); c.quadraticCurveTo(6, hy - 9 + low * .2, -2, hy - 14); c.quadraticCurveTo(-10, hy - 8, -14, hy - 3 + low); c.closePath(); c.fill(); ln(); };
  switch (st) {
    case 0: cap(0); break;
    case 1: cap(0); for (let i = 0; i < 6; i++) poly(c, [-16 + i * 6, hy - 18, -14 + i * 6, hy - 32 - (i % 2) * 5, -10 + i * 6, hy - 18], g, d, 1); break;
    case 2: cap(4); c.beginPath(); c.moveTo(-18, hy - 4); c.lineTo(-18, hy + 10); c.lineTo(-13, hy + 2); c.fill(); break;
    case 3: cap(0); poly(c, [-6, hy - 22, 2, hy - 28, 8, hy - 22], g, d, 1); break;
    case 4: cap(2); c.beginPath(); c.moveTo(-18, hy - 2); c.lineTo(-18, hy + 8); c.lineTo(-12, hy + 8); c.lineTo(-12, hy); c.fill(); break;
    case 5: c.beginPath(); c.moveTo(-5, hy - 18); c.quadraticCurveTo(-2, hy - 40, 6, hy - 42); c.quadraticCurveTo(10, hy - 34, 9, hy - 18); c.closePath(); c.fill(); ln(); c.fillStyle = alpha(col, .35); c.beginPath(); c.ellipse(0, hy - 14, 16, 5, 0, Math.PI, 0); c.fill(); break;
    case 6: cap(0); break;
    case 7: cap(0); blob(c, -2, hy - 28, 8, 7, col); break;
    case 8: cap(10); c.beginPath(); c.moveTo(6, hy - 10); c.quadraticCurveTo(16, hy - 12, 18, hy + 2); c.lineTo(10, hy - 4); c.fill(); break;
    case 9: c.beginPath(); c.arc(0, hy - 14, 18, Math.PI * 1.02, Math.PI * 1.98); c.lineTo(14, hy - 8); c.quadraticCurveTo(0, hy - 10, -14, hy - 8); c.fill(); ln(); break;
    default: cap(0);
  }
}
/* ---------- Gesicht ---------- */
function face(c: Ctx, look: Look, mood: 'n' | 'happy' | 'cry' | 'laugh', t: number) {
  const hy = -66, f = look.face % 6, fem = look.gender === 'f';
  const blink = (t % 3600) < 120;
  const ex = [4, 12];
  c.lineCap = 'round';
  const eyeAt = (x: number, y: number) => {
    if (blink || mood === 'happy' || mood === 'laugh') { c.strokeStyle = '#2a1a1a'; c.lineWidth = 1.8; c.beginPath(); c.arc(x, y + 1, 2.8, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); return; }
    switch (f) {
      case 0: c.fillStyle = '#2a1a22'; c.beginPath(); c.ellipse(x, y, 1.9, 2.5, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.fillRect(x - 1.2, y - 1.6, 1.2, 1.2); break;
      case 1: c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y, 3.2, 4, 0, 0, TAU); c.fill(); c.fillStyle = '#3a6ad0'; c.beginPath(); c.ellipse(x + .4, y + .3, 2.2, 3, 0, 0, TAU); c.fill(); c.fillStyle = '#10142a'; c.beginPath(); c.arc(x + .4, y + .4, 1.2, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.fillRect(x - 1, y - 2.2, 1.4, 1.4); break;
      case 2: c.fillStyle = '#e8e0d0'; c.beginPath(); c.ellipse(x, y, 3, 1.9, 0, 0, TAU); c.fill(); c.fillStyle = '#2a1a10'; c.beginPath(); c.arc(x + .5, y, 1.5, 0, TAU); c.fill(); c.strokeStyle = '#1a1010'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x - 3.5, y - 3.2); c.lineTo(x + 3, y - 1.8 + (x > 8 ? -1.2 : 0)); c.stroke(); break;
      case 3: c.fillStyle = '#2a1a22'; c.beginPath(); c.ellipse(x, y, 2.1, 2.1, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.fillRect(x - 1.3, y - 1.4, 1.1, 1.1); c.strokeStyle = '#2a1a22'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - 3, y - 3.4); c.quadraticCurveTo(x, y - 5, x + 3, y - 3.4); c.stroke(); break;
      case 4: c.fillStyle = '#2a1a22'; c.beginPath(); c.ellipse(x, y, 1.8, 2.4, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.fillRect(x - 1.2, y - 1.5, 1.1, 1.1); break;
      case 5: { const cy = x > 8; if (cy) { glow(c, x, y, 7, '#35e0ff', .9); c.fillStyle = '#35e0ff'; c.beginPath(); c.ellipse(x, y, 2.6, 2.6, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.fillRect(x - .6, y - 2, 1.2, 4); } else { c.fillStyle = '#2a1a22'; c.beginPath(); c.ellipse(x, y, 1.9, 2.5, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.fillRect(x - 1.2, y - 1.6, 1.2, 1.2); } break; }
    }
  };
  eyeAt(ex[0], hy + 1); eyeAt(ex[1], hy + 1);
  if (fem) { c.strokeStyle = '#1a1018'; c.lineWidth = 1.2; for (const x of ex) { c.beginPath(); c.moveTo(x - 3, hy - 1.5); c.lineTo(x - 5, hy - 3); c.stroke(); } }
  if (f === 4) { c.strokeStyle = '#a0404a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(15, hy - 6); c.lineTo(10, hy + 7); c.stroke(); c.strokeStyle = '#e0a0a0'; c.beginPath(); c.moveTo(12, hy - 2); c.lineTo(14, hy); c.stroke(); }
  if (f === 3 || f === 1) { c.fillStyle = 'rgba(255,100,120,.35)'; c.beginPath(); c.ellipse(2, hy + 8, 3, 1.8, 0, 0, TAU); c.ellipse(15, hy + 8, 3, 1.8, 0, 0, TAU); c.fill(); }
  // Mund
  c.strokeStyle = '#7a3a3a'; c.lineWidth = 1.4;
  if (mood === 'laugh') { c.fillStyle = '#6a1a20'; c.beginPath(); c.moveTo(5, hy + 9); c.quadraticCurveTo(9, hy + 17, 14, hy + 9); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.fillRect(6.5, hy + 9, 6, 1.6); }
  else if (mood === 'cry') { c.beginPath(); c.arc(9, hy + 14, 3.4, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
  else if (f === 2 || f === 4) { c.beginPath(); c.moveTo(6, hy + 11); c.quadraticCurveTo(10, hy + 12, 14, hy + 9); c.stroke(); }
  else if (f === 5) { c.beginPath(); c.moveTo(6, hy + 11); c.lineTo(13, hy + 11); c.stroke(); }
  else { c.beginPath(); c.arc(9.5, hy + 8, 3.6, .25, Math.PI - .25); c.stroke(); }
}
function tattoo(c: Ctx, id: number, t: number) {
  if (!id) return; const hy = -66; c.save(); c.lineCap = 'round';
  const ink = 'rgba(40,24,90,.75)';
  switch (id % 7) {
    case 1: c.strokeStyle = ink; c.lineWidth = 1.6; c.beginPath(); c.moveTo(14, hy + 2); c.lineTo(18, hy + 8); c.moveTo(12, hy + 3); c.lineTo(15, hy + 10); c.moveTo(10, hy + 4); c.lineTo(12, hy + 12); c.stroke(); break;
    case 2: c.fillStyle = ink; star(c, 15, hy + 7, 3.2, 5, .45); c.fill(); break;
    case 3: c.strokeStyle = ink; c.lineWidth = 1.5; c.beginPath(); c.moveTo(1, hy - 12); c.lineTo(9, hy - 12); c.moveTo(5, hy - 15); c.lineTo(5, hy - 8); c.stroke(); c.beginPath(); c.arc(5, hy - 11.5, 2.4, 0, TAU); c.stroke(); break;
    case 4: c.strokeStyle = ink; c.lineWidth = 1.2; for (const d of [-2, 1, 4]) { c.beginPath(); c.moveTo(12, hy + 8 + d * .6); c.lineTo(19, hy + 7 + d); c.stroke(); } break;
    case 5: c.strokeStyle = '#35e0ff'; c.shadowColor = '#35e0ff'; c.shadowBlur = 6; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-3, hy - 4); c.lineTo(2, hy - 4); c.lineTo(4, hy - 8); c.lineTo(10, hy - 8); c.moveTo(2, hy - 4); c.lineTo(4, hy + 2); c.stroke(); c.fillStyle = '#35e0ff'; c.beginPath(); c.arc(10, hy - 8, 1.2, 0, TAU); c.fill(); break;
    case 6: c.strokeStyle = `rgba(255,90,220,${.7 + .3 * sin(t / 300)})`; c.shadowColor = '#ff5adc'; c.shadowBlur = 6; c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i < 20; i++) { const a = i * .7, r = 1 + i * .26; c.lineTo(16 + cos(a) * r, hy + 6 + sin(a) * r); } c.stroke(); break;
  }
  c.restore();
}
/* ---------- Waffen ---------- */
/** Magie-Partikel (additiv) */
function sparks(c: Ctx, x: number, y: number, r: number, col: string, t: number, n = 6) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) { const ph = (t / 1100 + i / n + pr(i + 3) * .25) % 1, an = i * 2.4 + t / 700, px = x + cos(an) * r * (.35 + .65 * ph), py = y - ph * r * 1.7 + sin(an) * r * .25, a = sin(ph * Math.PI); glow(c, px, py, 3 + a * 2, col, .85 * a); }
  c.restore();
}
function weapon(c: Ctx, cls: ClassId, wc: string, tier: number, t: number, a: number) {
  const g = tier >= 4; const gl = (x: number, y: number, r: number) => { if (g) glow(c, x, y, r * 1.5, wc, .6); };
  switch (cls) {
    case 'dark_mage': case 'light_mage': case 'summoner': {
      c.strokeStyle = cls === 'light_mage' ? '#e8d8a0' : '#3a2a22'; c.lineWidth = 3.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 22); c.lineTo(0, -44); c.stroke();
      c.strokeStyle = shade(c.strokeStyle as string, .3); c.lineWidth = 1; c.beginPath(); c.moveTo(-1, 22); c.lineTo(-1, -44); c.stroke();
      const oy = -50; glow(c, 0, oy, 22, wc, .75); c.strokeStyle = cls === 'dark_mage' ? '#2a1a3a' : '#d8b84a'; c.lineWidth = 2.4; c.beginPath();
      if (cls === 'dark_mage') c.arc(0, oy, 8, Math.PI * .1, Math.PI * 1.1, true); else if (cls === 'light_mage') { for (let i = 0; i < 8; i++) { const an = i * TAU / 8; c.moveTo(cos(an) * 8, oy + sin(an) * 8); c.lineTo(cos(an) * 12, oy + sin(an) * 12); } } else c.rect(-6, oy - 6, 12, 12);
      c.stroke(); c.fillStyle = lg(c, -4, oy - 4, 4, oy + 4, 0, '#fff', .4, wc, 1, shade(wc, -.4)); c.beginPath(); c.arc(0, oy, 5.2, 0, TAU); c.fill(); c.save(); c.globalCompositeOperation = 'lighter'; glow(c, 0, oy, 17 + sin(t / 260) * 2, wc, .55); c.restore(); sparks(c, 0, oy, 13, wc, t, g ? 8 : 5);
      if (cls === 'summoner') for (let i = 0; i < 2; i++) { const an = t / 400 + i * Math.PI; glow(c, cos(an) * 14, oy + sin(an) * 6, 6, wc, .8); c.fillStyle = '#fff'; c.beginPath(); c.arc(cos(an) * 14, oy + sin(an) * 6, 1.6, 0, TAU); c.fill(); }
      break; }
    case 'archer': {
      const draw = a > 0 ? (a < .5 ? a * 2 : 0) : 0; c.save(); c.translate(6, -8);
      c.strokeStyle = '#6a4a2a'; c.lineWidth = 3.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -34); c.quadraticCurveTo(-14 - draw * 5, 0, 0, 34); c.stroke(); c.strokeStyle = wc; c.lineWidth = 1.4; c.stroke(); gl(-4, 0, 20); if (tier >= 3) sparks(c, -6, 0, 14, wc, t, 3);
      c.strokeStyle = 'rgba(240,240,230,.85)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -34); c.lineTo(-draw * 14 - 3, 0); c.lineTo(0, 34); c.stroke();
      if (a > 0 && a < .5 || a === 0) { c.strokeStyle = '#c8a070'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-draw * 14 - 3, 0); c.lineTo(22, 0); c.stroke(); poly(c, [22, -2.5, 28, 0, 22, 2.5], '#ccd'); }
      c.restore(); break; }
    case 'shield_sword': case 'dual_sword': case 'tank': {
      if (cls === 'tank') { c.strokeStyle = '#4a3a2a'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 20); c.lineTo(0, -36); c.stroke(); c.fillStyle = lg(c, -14, -52, 14, -34, 0, shade(wc, .35), 1, shade(wc, -.4)); c.beginPath(); c.roundRect(-15, -54, 30, 20, 4); c.fill(); c.strokeStyle = '#1a1214'; c.lineWidth = 1.5; c.stroke(); c.fillStyle = shade(wc, -.5); c.fillRect(-15, -46, 30, 3); gl(0, -44, 24); }
      else { const bl = '#e4eaf4'; poly(c, [-3.6, 0, 3.6, 0, 3, -50, 0, -58, -3, -50], lg(c, -4, 0, 4, 0, 0, '#fff', .5, wc, 1, shade(wc, -.5)), '#2a2a36', 1.2); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -4); c.lineTo(0, -50); c.stroke(); c.fillStyle = cls === 'dual_sword' ? '#a02a2a' : '#d8b84a'; c.fillRect(-8, 0, 16, 3.5); c.fillStyle = '#3a2a22'; c.fillRect(-1.6, 3, 3.2, 8); gl(0, -30, 26); if (tier >= 3) sparks(c, 0, -24, 9, wc, t, 3); void bl; }
      break; }
    case 'healer': {
      c.save(); c.translate(0, -18 + sin(t / 400) * 2); glow(c, 0, 0, 28, wc, .55); sparks(c, 0, -4, 14, wc, t, 5);
      c.fillStyle = '#5a3a2a'; c.beginPath(); c.roundRect(-14, -10, 28, 20, 2); c.fill(); c.fillStyle = '#f4ecd8'; c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(-7, -11, -12, -8); c.lineTo(-12, 8); c.quadraticCurveTo(-7, 5, 0, 8); c.quadraticCurveTo(7, 5, 12, 8); c.lineTo(12, -8); c.quadraticCurveTo(7, -11, 0, -8); c.fill(); c.strokeStyle = '#7a5a3a'; c.lineWidth = 1; c.stroke();
      c.strokeStyle = wc; c.lineWidth = 1.5; c.beginPath(); c.moveTo(6, -3); c.lineTo(6, 3); c.moveTo(3, 0); c.lineTo(9, 0); c.stroke(); c.strokeStyle = 'rgba(120,100,70,.5)'; c.lineWidth = .8; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-10, -4 + i * 4); c.lineTo(-3, -4 + i * 4); c.stroke(); }
      c.restore(); break; }
  }
}
function offhand(c: Ctx, cls: ClassId, wc: string, tier: number) {
  if (cls === 'shield_sword') { c.save(); c.translate(-2, -26); c.fillStyle = lg(c, -12, -14, 12, 16, 0, shade('#8a96a8', .4), 1, shade('#4a5668', -.2)); c.beginPath(); c.moveTo(-12, -14); c.lineTo(12, -14); c.lineTo(12, 3); c.quadraticCurveTo(12, 14, 0, 19); c.quadraticCurveTo(-12, 14, -12, 3); c.closePath(); c.fill(); c.strokeStyle = '#1a2030'; c.lineWidth = 1.6; c.stroke(); c.fillStyle = '#4a8ad0'; c.beginPath(); c.moveTo(0, -11); c.lineTo(8, -4); c.lineTo(0, 12); c.lineTo(-8, -4); c.closePath(); c.fill(); c.fillStyle = '#fff3'; c.fillRect(-1, -9, 2, 18); if (tier >= 4) glow(c, 0, 0, 22, '#4a8ad0', .4); c.restore(); }
}
function dualBlade(c: Ctx, wc: string) { poly(c, [-3, 0, 3, 0, 2, -34, 0, -40, -2, -34], lg(c, -3, 0, 3, 0, 0, '#fff', .5, wc, 1, shade(wc, -.5)), '#2a2a36', 1.1); c.fillStyle = '#a02a2a'; c.fillRect(-6, 0, 12, 3); c.fillStyle = '#2a1a1a'; c.fillRect(-1.5, 3, 3, 6); }

/* ---------- Reittiere ---------- */
function mountDraw(c: Ctx, id: string, t: number, moving: boolean) {
  const d = ITEMS[id], col = d?.icon?.color || '#35e0ff', k = id.replace('mount_', '');
  if (k === 'horse') {
    const sw = moving ? sin(t / 90) * 7 : 0, br = sin(t / 500);
    c.strokeStyle = shade(col, -.3); c.lineWidth = 4; c.lineCap = 'round';
    for (const [x, ph] of [[-22, 0], [-14, 2.5], [14, 1.2], [22, 3.7]] as [number, number][]) { const s = moving ? sin(t / 90 + ph) * 7 : 0; c.strokeStyle = shade(col, ph > 2 ? -.4 : -.2); c.lineWidth = 6; c.beginPath(); c.moveTo(x, -26); c.lineTo(x + s * .6, -12); c.lineTo(x + s, -1); c.stroke(); }
    c.strokeStyle = shade(col, .5); c.lineWidth = 3; c.beginPath(); c.moveTo(-30, -38); c.bezierCurveTo(-44, -38, -46, -22 + sw * .3, -42, -12); c.stroke(); glow(c, -42, -20, 14, '#8affff', .5);
    blob(c, 0, -34 + br * .5, 32, 14, col); blob(c, 26, -50, 9, 14, col, { rot: -.5 }); blob(c, 38, -60, 12, 7, col, { rot: .3 }); blob(c, 45, -57, 6, 5, shade(col, .2));
    poly(c, [30, -68, 33, -78, 37, -67], col, shade(col, -.7), 1); c.fillStyle = '#222'; c.beginPath(); c.arc(40, -62, 1.8, 0, TAU); c.fill();
    for (let i = 0; i < 5; i++) { glow(c, 20 + i * 2 - 4, -62 + i * 4, 6, '#8affff', .5); } c.strokeStyle = '#8affff'; c.lineWidth = 2; c.beginPath(); c.moveTo(24, -64); c.quadraticCurveTo(14, -54, 22, -42); c.stroke();
    c.fillStyle = '#5a3a2a'; c.beginPath(); c.ellipse(-2, -46, 12, 4, 0, 0, TAU); c.fill(); return -50;
  }
  if (k === 'wolf') { c.save(); c.scale(1.35, 1.35); mobShape(c, 'wolf', col, t, 0, 0); c.restore(); glow(c, 30, -52, 24, col, .5); return -56; }
  if (k === 'drake') { c.save(); c.translate(0, -26 + sin(t / 220) * 3); c.scale(1.5, 1.5); mobShape(c, 'drake', col, t, 0, 0); c.restore(); return -76; }
  // Schwebebrett
  const hv = sin(t / 300) * 2.5; glow(c, 0, 4, 40, col, .45);
  c.fillStyle = lg(c, 0, -8, 0, 4, 0, shade('#4a5668', .3), 1, '#1a202c'); c.beginPath(); c.moveTo(-32, -4 + hv); c.quadraticCurveTo(0, 6 + hv, 34, -6 + hv); c.lineTo(32, -10 + hv); c.quadraticCurveTo(0, -4 + hv, -30, -10 + hv); c.closePath(); c.fill(); c.strokeStyle = col; c.lineWidth = 1.6; c.stroke();
  c.fillStyle = col; c.globalAlpha = .6 + .3 * sin(t / 120); c.beginPath(); c.ellipse(-2, 2 + hv, 24, 3, 0, 0, TAU); c.fill(); c.globalAlpha = 1;
  if (moving) for (let i = 0; i < 5; i++) { glow(c, -34 - i * 8, -4 + hv + (i % 2) * 2, 7, col, .5 - i * .08); }
  return -12 + hv;
}

/* ---------- Haupt ---------- */
function body(c: Ctx, o: CharOpts, portrait: boolean) {
  const { cls, look, eq, t, moving } = o, P = CLS[cls] || CLS.tank, attack = clamp(o.attack || 0);
  const emote = !moving && attack === 0 ? o.emote : undefined;
  const bw = (portrait ? 11 : 12.4) * (BODY_W[look.body] ?? 1), bh = BODY_H[look.body] ?? 1, fem = look.gender === 'f';
  const chest = piece(eq, 'chest'), legsP = piece(eq, 'legs'), boots = piece(eq, 'boots'), gloves = piece(eq, 'gloves'), head = piece(eq, 'head'), wpn = piece(eq, 'weapon'), amu = piece(eq, 'amulet');
  const plate = chest ? chest.style === 'plate' : P.plate;
  const cMain = mt(chest, P.main), cTrim = P.trim, lCol = mt(legsP, shade(P.main, -.3)), bCol = mt(boots, '#2a2630'), gCol = gloves?.col;
  const wc = wpn?.col || P.wc, wTier = wpn?.tier ?? 0;
  const sw = moving ? sin(t / 105) : 0, bobM = moving ? Math.abs(sin(t / 105)) * 2.6 : 0, idle = sin(t / 520) * 1.2;
  let up = 0, tilt = 0, armF = -.5, armB = .3, sit = 0, mood: 'n' | 'happy' | 'cry' | 'laugh' = 'n', headBob = 0;
  if (!moving) armF = -.4 + sin(t / 520) * .06;
  if (moving) { armF = -.5 - sw * .5; armB = .3 + sw * .5; }
  switch (emote) {
    case 'wave': armF = -2.7 + sin(t / 110) * .35; mood = 'happy'; break;
    case 'dance': up = Math.abs(sin(t / 160)) * 6; tilt = sin(t / 320) * .16; armF = -2.4 + sin(t / 160) * .6; armB = 2.4 - sin(t / 160) * .6; mood = 'happy'; break;
    case 'laugh': headBob = sin(t / 55) * 1.4; mood = 'laugh'; tilt = -.06; break;
    case 'cheer': up = Math.abs(sin(t / 190)) * 9; armF = -2.8; armB = 2.8; mood = 'happy'; break;
    case 'bow': tilt = .75 * smoothPulse(t); break;
    case 'sit': sit = 14; break;
    case 'cry': mood = 'cry'; tilt = .12; headBob = 1 + sin(t / 80) * .5; break;
    case 'flex': armF = -2.1; armB = 2.1; mood = 'happy'; up = sin(t / 300) * 1; break;
  }
  const atkA = attack > 0 ? attack : 0;
  const ease = atkA < .35 ? -atkA / .35 * .5 : -.5 + (atkA - .35) / .65 * 0; void ease;
  const swing = atkA > 0 ? (atkA < .3 ? -(atkA / .3) * 1.3 : -1.3 + (atkA - .3) / .7 * 3.2) : 0;
  const lunge = atkA > 0 ? sin(atkA * Math.PI) * 7 : 0;
  c.save(); c.translate(lunge, 0);
  const rise = -bobM - up + (portrait ? 0 : idle * .0) + sit;
  const R = !portrait, bhh = R ? 1 + (bh - 1) * .6 : bh, LX = getLighting().x;
  const hipY = (R ? -37 : -18) * bhh, shY = (R ? -66 : -47) * bhh, hS = R ? .46 : 1, headCY = R ? shY - 9.5 : -66, SKL = R ? 25 : 14;
  const headT = () => { c.translate(0, headCY); c.scale(hS, hS); c.translate(0, 66); };
  // Beine
  c.lineCap = 'round';
  const leg = (x: number, ph: number, back: boolean) => {
    const s = moving ? sin(t / 105 + ph) : 0, lift = moving ? Math.max(0, -cos(t / 105 + ph)) * 4 : 0;
    let fx = x + s * 9, fy = -lift - 1; let kx = x + s * 5, ky = hipY * .45;
    if (sit) { fx = x + 14; fy = -1 + 0; kx = x + 8; ky = hipY + 6; }
    const lw = R ? 6.2 : 7.5, base = shade(lCol, back ? -.4 : -.1);
    const path = () => { c.beginPath(); c.moveTo(x, hipY + rise + 4); c.lineTo(kx, ky); c.lineTo(fx, fy - 4); };
    c.lineJoin = 'round';
    path(); c.strokeStyle = shade(lCol, back ? -.8 : -.72); c.lineWidth = lw + 1.6; c.stroke();
    path(); c.strokeStyle = base; c.lineWidth = lw; c.stroke();
    if (boots && R) { c.beginPath(); c.moveTo((kx + fx) / 2, (ky + fy - 4) / 2 - 1); c.lineTo(fx, fy - 4); c.strokeStyle = shade(bCol, -.7); c.lineWidth = lw + 2.2; c.stroke(); c.strokeStyle = shade(bCol, back ? -.3 : 0); c.lineWidth = lw + .7; c.stroke(); }
    c.save(); c.translate(LX * lw * .24, 0); path(); c.strokeStyle = shade(base, .3); c.lineWidth = lw * .26; c.globalAlpha = back ? .25 : .5; c.stroke(); c.restore();
    if (plate && R && !back) { blob(c, kx + 1, ky, 4.3, 3.6, shade(cMain, .05), { hi: .5 }); }
    const bw2 = boots ? 1 : 0; c.fillStyle = lg(c, 0, fy - 6, 0, fy + 3, 0, shade(bCol, .3), 1, shade(bCol, -.4)); c.beginPath(); c.ellipse(fx + 3, fy - 1, R ? 6.6 : 7.5, R ? 3.4 : 4, 0, 0, TAU); c.fill(); c.strokeStyle = '#150f14'; c.lineWidth = 1.2; c.stroke();
    if (boots && boots.tier >= 3) { c.fillStyle = alpha('#fff', .5); c.fillRect(fx - 2, fy - 4, 4, 1.2); } void bw2;
  };
  if (!portrait) { leg(-4.5 * (bw / 11), Math.PI, true); }
  // Rücken-Umhang & hintere Haare
  c.save(); c.translate(0, rise);
  if (tilt) { c.translate(0, hipY); c.rotate(tilt); c.translate(0, -hipY); }
  c.save(); if (R) headT(); hairBack(c, look.hair % 10, look.hairColor || '#4a3020', fem); c.restore();
  // Offhand-Hinterarm
  const arm = (a: number, back: boolean, hold?: () => void) => {
    c.save(); c.translate((back ? -1 : 1) * (bw - 2), shY + (R ? 4 : 6)); c.rotate(a);
    const sk = back ? shade(cMain, -.35) : shade(cMain, -.05), lw = R ? 5.2 : 7, UL = R ? 10 : 11, FL = R ? 9.5 : 0, bend = R ? (back ? -.16 : .24) : 0, hcol = gCol || look.skin || '#e0b090';
    c.lineCap = 'round'; c.lineJoin = 'round';
    const seg = (len: number, col: string) => { for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(0, len); c.strokeStyle = k === 0 ? shade(col, -.75) : k === 1 ? col : shade(col, .3); c.lineWidth = k === 0 ? lw + 1.4 : k === 1 ? lw : lw * .25; if (k === 2) { c.save(); c.translate(LX * lw * .24, 0); c.globalAlpha = back ? .2 : .45; c.stroke(); c.restore(); } else c.stroke(); } };
    seg(UL, sk);
    let HL = 3;
    if (FL) { c.translate(0, UL); c.rotate(bend); seg(FL, plate ? shade(cMain, .08) : gloves ? shade(sk, -.05) : sk); if (!plate) { c.strokeStyle = cTrim; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-lw / 2, FL - 1.5); c.lineTo(lw / 2, FL - 1.5); c.stroke(); } HL = FL + 3.2; }
    c.fillStyle = hcol; c.strokeStyle = shade(hcol, -.6); c.lineWidth = 1.1; c.beginPath(); c.arc(0, HL, R ? 3 : gCol ? 4.6 : 3.6, 0, TAU); c.fill(); c.stroke();
    if (hold) { c.translate(0, HL); c.rotate(-bend); hold(); } c.restore();
  };
  const dual = cls === 'dual_sword';
  if (portrait) { /* kein Hinterarm */ } else arm(armB + (dual && atkA ? swing * .0 : 0), true, dual ? () => { c.rotate(-.2 - (atkA ? swing * .6 : 0)); dualBlade(c, wc); } : undefined);
  // Torso
  const tw = bw * (fem ? .92 : 1);
  const wst = R ? tw * .8 : tw, mid = (shY + hipY) / 2;
  c.beginPath(); c.moveTo(-tw, shY + 3); c.quadraticCurveTo(-tw - 1, shY - 1, -tw + 5, shY - 1); c.lineTo(tw - 5, shY - 1); c.quadraticCurveTo(tw + 1, shY - 1, tw, shY + 3); c.quadraticCurveTo(tw + (R ? 1.4 : 0), mid, wst - (fem ? 2.5 : 1), hipY + 2); c.quadraticCurveTo(0, hipY + 6, -wst + (fem ? 2.5 : 1), hipY + 2); c.quadraticCurveTo(-tw - (R ? 1.4 : 0), mid, -tw, shY + 3); c.closePath();
  if (plate) { c.fillStyle = lg(c, -tw, shY, tw, hipY, 0, shade(cMain, .4), .45, cMain, 1, shade(cMain, -.45)); } else c.fillStyle = lg(c, 0, shY, 0, hipY, 0, shade(cMain, .2), 1, shade(cMain, -.3));
  c.fill(); c.strokeStyle = shade(cMain, -.75); c.lineWidth = 1.5; c.stroke();
  if (R) { // Volumen, Textur, Falten, Metallglanz
    c.save(); c.clip();
    const cyl = c.createLinearGradient(-tw, 0, tw, 0); cyl.addColorStop(0, 'rgba(0,0,0,.3)'); cyl.addColorStop(.3, 'rgba(0,0,0,0)'); cyl.addColorStop(.7, 'rgba(0,0,0,0)'); cyl.addColorStop(1, 'rgba(0,0,0,.34)'); c.fillStyle = cyl; c.fillRect(-tw - 2, shY - 2, tw * 2 + 4, hipY - shY + 10);
    const tp = texture(c, plate ? 'metal' : 'cloth'); if (tp) { c.globalAlpha = plate ? .9 : .7; c.fillStyle = tp; c.fillRect(-tw - 2, shY - 2, tw * 2 + 4, hipY - shY + 10); c.globalAlpha = 1; }
    if (plate) {
      for (let i = 1; i < 5; i++) { const yy = shY + 3 + i * (hipY - shY - 4) / 5; c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-tw, yy); c.quadraticCurveTo(0, yy + 2.5, tw, yy); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.moveTo(-tw, yy + 1.2); c.quadraticCurveTo(0, yy + 3.7, tw, yy + 1.2); c.stroke(); }
      const sx = LX * tw * .45, sg = c.createLinearGradient(sx - 4, 0, sx + 4, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, 'rgba(255,255,255,.5)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sg; c.fillRect(sx - 4, shY, 8, hipY - shY);
      const gl = ((t / 2600) % 1.6 - .3) * tw * 2.6 - tw * 1.3; const gg = c.createLinearGradient(gl - 5, shY, gl + 5, hipY); gg.addColorStop(0, 'rgba(255,255,255,0)'); gg.addColorStop(.5, 'rgba(255,255,255,.35)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); c.globalCompositeOperation = 'lighter'; c.fillStyle = gg; c.fillRect(-tw, shY, tw * 2, hipY - shY); c.globalCompositeOperation = 'source-over';
    } else {
      c.lineWidth = 1.1; for (const [fx0, fx1, fy0] of [[-.55, -.45, .0], [-.2, -.28, .15], [.3, .38, .05], [.6, .52, .2]]) { c.strokeStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.moveTo(fx0 * tw, shY + 3 + fy0 * 12); c.quadraticCurveTo((fx0 + fx1) / 2 * tw + 1.5, mid, fx1 * tw, hipY); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.1)'; c.beginPath(); c.moveTo(fx0 * tw + 1.4, shY + 3 + fy0 * 12); c.quadraticCurveTo((fx0 + fx1) / 2 * tw + 2.9, mid, fx1 * tw + 1.4, hipY); c.stroke(); }
      if (fem) { c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.ellipse(-1, shY + 8, tw * .6, 4, 0, 0, TAU); c.fill(); }
    }
    c.restore();
  }
  if (plate) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-tw + 4, shY + 6); c.quadraticCurveTo(0, shY + 12, tw - 4, shY + 6); c.moveTo(0, shY + 8); c.lineTo(0, hipY); c.stroke(); c.fillStyle = shade(cMain, .1); for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * (tw + 1), shY + 3, 6.5, 5.5, 0, 0, TAU); c.fill(); c.strokeStyle = shade(cMain, -.7); c.lineWidth = 1.2; c.stroke(); } if (chest && chest.tier >= 3) { c.fillStyle = cTrim; star(c, 0, shY + 13, 3.2, 4); c.fill(); } }
  else { c.strokeStyle = cTrim; c.lineWidth = 2; c.beginPath(); c.moveTo(-3, shY); c.lineTo(0, shY + 6); c.lineTo(3, shY); c.moveTo(0, shY + 6); c.lineTo(0, hipY); c.stroke(); if (cls === 'light_mage' || cls === 'healer' || cls === 'dark_mage' || cls === 'summoner') { c.fillStyle = shade(cMain, -.15); c.beginPath(); c.moveTo(-tw + 1, hipY - 2); c.lineTo(tw - 1, hipY - 2); c.lineTo(tw + (fem ? 7 : 4), hipY + SKL - sit); c.quadraticCurveTo(0, hipY + SKL + 5 - sit, -tw - (fem ? 7 : 4), hipY + SKL - sit); c.closePath(); c.fill(); c.strokeStyle = shade(cMain, -.7); c.lineWidth = 1.2; c.stroke(); c.strokeStyle = cTrim; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-tw - (fem ? 6 : 3), hipY + SKL + .5 - sit); c.quadraticCurveTo(0, hipY + SKL + 5.5 - sit, tw + (fem ? 6 : 3), hipY + SKL + .5 - sit); c.stroke(); if (R) { c.lineWidth = 1; for (let i = -2; i <= 2; i++) { c.strokeStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.moveTo(i * tw * .42, hipY); c.quadraticCurveTo(i * tw * .6 + 1, hipY + SKL * .5, i * tw * .78, hipY + SKL + 1 - sit); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.1)'; c.beginPath(); c.moveTo(i * tw * .42 + 1.3, hipY); c.quadraticCurveTo(i * tw * .6 + 2.3, hipY + SKL * .5, i * tw * .78 + 1.3, hipY + SKL + 1 - sit); c.stroke(); } } } }
  c.fillStyle = '#2a2024'; c.fillRect(-wst + 1, hipY - 3, wst * 2 - 2, 3.4); c.fillStyle = cTrim; c.fillRect(-2.5, hipY - 3.4, 5, 4);
  if (amu) { glow(c, 0, shY + 9, 9, amu.col, .7); c.fillStyle = amu.col; c.beginPath(); c.arc(0, shY + 9, 2.6, 0, TAU); c.fill(); c.strokeStyle = '#000a'; c.lineWidth = .8; c.stroke(); }
  if (!portrait) leg(4.5 * (bw / 11), 0, false);
  // Kopf
  c.save(); c.translate(0, headBob + (emote === 'cry' ? 1 : 0));
  const skin = look.skin || '#f0c8a0', hy = -66;
  if (R) { c.fillStyle = lg(c, -3, 0, 3, 0, 0, shade(skin, -.02), 1, shade(skin, -.34)); c.fillRect(-2.8, shY - 9, 5.6, 11); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-2.8, shY - 1, 5.6, 2); headT(); } else { c.fillStyle = shade(skin, -.12); c.fillRect(-3, shY - 5, 7, 7); }
  const hoodOn = !!head && head.style !== 'plate' && !(cls === 'light_mage' || cls === 'healer' || cls === 'archer');
  if (hoodOn && head) { c.fillStyle = lg(c, 0, hy - 24, 0, hy + 14, 0, shade(head.col, .2), 1, shade(head.col, -.45)); c.beginPath(); c.ellipse(-3, hy - 1, 22, 21, 0, 0, TAU); c.fill(); c.strokeStyle = shade(head.col, -.8); c.lineWidth = 1.5; c.stroke(); }
  blob(c, 0, hy, 18.5, 17, skin, { hi: .2 }); blob(c, -17, hy + 2, 3.2, 4.4, skin, { hi: .1 }); blob(c, 17.5, hy + 2, 2.8, 4, shade(skin, -.05), { hi: .1 });
  c.fillStyle = 'rgba(0,0,0,.08)'; c.beginPath(); c.ellipse(-2, hy + 16, 12, 3, 0, 0, TAU); c.fill();
  tattoo(c, look.tattoo, t); face(c, look, mood, t);
  if (emote === 'cry') { c.fillStyle = 'rgba(120,200,255,.85)'; for (const x of [4, 12]) for (let i = 0; i < 2; i++) { const ph = ((t / 500) + i * .5 + x * .1) % 1; c.beginPath(); c.ellipse(x - 1, hy + 4 + ph * 18, 1.4, 2.2, 0, 0, TAU); c.fill(); } }
  if (!hoodOn) hairFront(c, look.hair % 10, look.hairColor || '#4a3020');
  if (head) {
    const hc = head.col;
    if (head.style === 'plate') { c.fillStyle = lg(c, -18, hy - 24, 18, hy, 0, shade(hc, .45), .5, hc, 1, shade(hc, -.45)); c.beginPath(); c.moveTo(-19, hy + 4); c.quadraticCurveTo(-21, hy - 26, 0, hy - 25); c.quadraticCurveTo(21, hy - 26, 19, hy - 4); c.lineTo(14, hy - 9); c.lineTo(-2, hy - 10); c.lineTo(-14, hy - 4); c.closePath(); c.fill(); c.strokeStyle = shade(hc, -.8); c.lineWidth = 1.6; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, hy - 24); c.lineTo(0, hy - 10); c.stroke(); if (head.tier >= 3) { poly(c, [-3, hy - 24, 0, hy - 38, 3, hy - 24], P.trim); } }
    else if (cls === 'light_mage' || cls === 'healer') { c.strokeStyle = shade(hc, .1); c.lineWidth = 2.6; c.beginPath(); c.arc(0, hy - 9, 17.5, Math.PI * 1.08, Math.PI * 1.92); c.stroke(); glow(c, 0, hy - 26, 10, hc, .8); c.fillStyle = hc; c.beginPath(); c.arc(0, hy - 26, 2.8, 0, TAU); c.fill(); }
    else if (cls === 'archer') { c.fillStyle = lg(c, 0, hy - 24, 0, hy - 6, 0, shade(hc, .2), 1, shade(hc, -.35)); c.beginPath(); c.moveTo(-18, hy - 4); c.quadraticCurveTo(-18, hy - 26, 3, hy - 25); c.quadraticCurveTo(18, hy - 22, 18, hy - 8); c.lineTo(0, hy - 8); c.closePath(); c.fill(); c.strokeStyle = shade(hc, -.8); c.lineWidth = 1.4; c.stroke(); poly(c, [4, hy - 22, 12, hy - 34, 8, hy - 20], '#e8e0c0', '#333', .8); }
    else { c.fillStyle = lg(c, 0, hy - 26, 0, hy + 14, 0, shade(hc, .3), 1, shade(hc, -.2)); c.beginPath(); c.ellipse(-3, hy - 1, 22, 21, 0, 0, TAU); c.ellipse(3, hy + 1, 16.5, 15.5, 0, 0, TAU); c.fill('evenodd'); c.strokeStyle = shade(hc, -.8); c.lineWidth = 1.3; c.beginPath(); c.ellipse(3, hy + 1, 16.5, 15.5, 0, 0, TAU); c.stroke(); }
    if (head.tier >= 4) glow(c, 0, hy - 8, 26, hc, .22);
  }
  c.restore();
  // Vorderarm
  const frontSwing = atkA > 0 ? swing : 0, aF = atkA > 0 ? -.4 + swing * 1.0 : armF;
  const shieldCls = cls === 'shield_sword';
  if (shieldCls && !portrait) offhand(c, cls, wc, wTier);
  if (!portrait) arm(aF + (emote ? 0 : 0), false, () => {
    if (emote && emote !== 'cheer' && emote !== 'flex') return;
    if (emote === 'cheer' || emote === 'flex') { if (emote === 'cheer') { c.fillStyle = '#ffe27a'; star(c, 0, -10, 3, 4); c.fill(); } return; }
    c.rotate(-aF + (atkA > 0 ? -.2 + frontSwing * .9 : -.15)); if (cls === 'archer') c.rotate(.5); weapon(c, cls, wc, wTier, t, atkA);
  });
  c.restore();
  // Slash-Effekt
  if (atkA > .25 && atkA < .85 && (cls === 'shield_sword' || cls === 'dual_sword' || cls === 'tank')) { c.save(); c.translate(14, -44); c.strokeStyle = alpha(P.wc, .8 * (1 - Math.abs(atkA - .55) * 3)); c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, 34, -1.0, .9); c.stroke(); c.restore(); }
  if (atkA > .3 && atkA < .8 && (cls === 'dark_mage' || cls === 'light_mage' || cls === 'summoner' || cls === 'healer')) { glow(c, 28, -52, 26, P.wc, .8 * (1 - Math.abs(atkA - .5) * 2)); }
  if (emote === 'laugh') { for (let i = 0; i < 3; i++) { const ph = (t / 500 + i * .33) % 1; c.globalAlpha = 1 - ph; c.fillStyle = '#ffe27a'; star(c, 20 + i * 7, -92 - ph * 12, 3, 4, .4); c.fill(); c.globalAlpha = 1; } }
  if (emote === 'dance' || emote === 'cheer') { for (let i = 0; i < 4; i++) { c.fillStyle = ['#ff7ad8', '#7affd0', '#ffe27a', '#7ab8ff'][i]; const ph = (t / 600 + i * .25) % 1; c.globalAlpha = 1 - ph; star(c, -24 + i * 16 + sin(ph * 6 + i) * 4, -80 - ph * 20, 2.4, 4); c.fill(); c.globalAlpha = 1; } }
  if (emote === 'flex') { c.fillStyle = '#fff'; star(c, 18, -58, 3 + sin(t / 150) * 1.2, 4); c.fill(); }
  c.restore();
}
const smoothPulse = (t: number) => { const p = (t / 1600) % 1; return p < .3 ? p / .3 : p < .7 ? 1 : (1 - p) / .3; };

export function drawCharacter(ctx: Ctx, x: number, y: number, scale: number, o: CharOpts) {
  ctx.save(); ctx.translate(x, y);
  const fadeDead = o.dead || (o.hp !== undefined && o.hp <= 0);
  softShadow(ctx, (o.mount ? 46 : 22) * scale, (o.mount ? 9 : 6.5) * scale, o.mount ? .5 : .46);
  const maxT = Math.max(0, ...Object.values(o.eq || {}).map(id => ITEMS[id]?.tier || 0));
  if (maxT >= 6 && !fadeDead) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -46 * scale, 60 * scale, CLS[o.cls]?.wc || '#fff', .16 + .06 * sin(o.t / 400)); ctx.restore(); }
  if (fadeDead) { ctx.scale(scale * o.facing, scale); ctx.translate(0, -2); ctx.rotate(Math.PI / 2 * .98); ctx.translate(-30, 22); ctx.globalAlpha = .75; body(ctx, { ...o, moving: false, attack: 0, emote: undefined }, false); ctx.globalAlpha = 1; ctx.restore(); return; }
  const big = !!o.mount;
  litSprite(ctx, scale, big ? -130 : -70, big ? -200 : -150, big ? 130 : 70, 20, c => {
    c.scale(o.facing, 1);
    if (o.mount) { const mid = o.eq?.mount || 'mount_board', rise = mountDraw(c, mid, o.t, o.moving); c.translate(0, rise + 2); c.scale(.92, .92); }
    body(c, o, false);
  }, { rim: 1, ao: .3 });
  ctx.restore();
}

/** Kopf/Schultern-Porträt */
export function drawPortrait(c: Ctx, size: number, cls: ClassId, look: Look, eq: Record<string, string>) {
  const P = CLS[cls] || CLS.tank;
  rr(c, 0, 0, size, size, size * .14); c.save(); c.clip();
  c.fillStyle = lg(c, 0, 0, size, size, 0, shade(mix(P.trim, '#10131c', .75), .1), 1, '#0a0c14'); c.fillRect(0, 0, size, size);
  const g = c.createRadialGradient(size * .5, size * .4, 2, size * .5, size * .45, size * .6); g.addColorStop(0, alpha(P.trim, .5)); g.addColorStop(1, alpha(P.trim, 0)); c.fillStyle = g; c.fillRect(0, 0, size, size);
  const sc = size / 62; c.translate(size / 2, size * .46 + 66 * sc); c.scale(sc, sc);
  body(c, { cls, look, eq: eq || {}, facing: 1, t: 1200, moving: false, attack: 0 }, true);
  c.restore(); c.strokeStyle = alpha(P.trim, .7); c.lineWidth = 2; rr(c, 1, 1, size - 2, size - 2, size * .14); c.stroke();
}
void mkCanvas; void ctx2; void parse; void rgb;

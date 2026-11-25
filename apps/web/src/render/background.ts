import { Ctx, TAU, clamp, lerp, smooth, hash, mulberry, mix, shade, alpha, rgb, parse, mkCanvas, ctx2, glow, lg, poly, pr, setLighting, texture } from './util';

type Rnd = () => number;
interface Holo { x: number; y: number; w: number; h: number; col: string; ph: number }
interface Layers { far: HTMLCanvasElement; near: HTMLCanvasElement; lights: HTMLCanvasElement; farD?: HTMLCanvasElement; nearD?: HTMLCanvasElement; stars: { x: number; y: number; r: number; p: number }[];
  neon?: HTMLCanvasElement; bloom?: HTMLCanvasElement; holos?: Holo[]; puddles?: { x: number; y: number; rx: number; ry: number }[]; wetRefl?: HTMLCanvasElement }
let curTheme = '', AOS: { c: Ctx; x: number; w: number; base: number }[] = [], HOLOS: Holo[] = [];
type GKind = 'paving' | 'grass' | 'rock' | 'metal' | 'sand' | 'void';
const GKIND: Record<string, GKind> = { city: 'paving', market: 'paving', guild: 'paving', harbor: 'paving', arena: 'sand', industrial: 'metal', residential: 'grass', park: 'grass', forest: 'grass', mountain: 'rock', junkyard: 'sand', ruins: 'rock', dungeon: 'rock', crater: 'rock', crystal: 'rock', moor: 'grass', sky: 'paving', void: 'void' };
const cache = new Map<string, Layers>();

const INDOOR: Record<string, [string, string]> = { dungeon: ['#07060c', '#241a2e'], crystal: ['#0a0720', '#2a1e5a'], void: ['#05010f', '#2a0a4a'] };
const SKY_KEYS: [number, string, string][] = [
  [0, '#04061a', '#16194a'], [.2, '#080a26', '#242a66'], [.26, '#3a2f7a', '#ff8a5e'], [.33, '#4f8fe0', '#ffd7a8'], [.42, '#4a98ee', '#bfe6ff'],
  [.58, '#4a98ee', '#bfe6ff'], [.67, '#4a7ad0', '#ffc890'], [.74, '#4a2a78', '#ff6a48'], [.8, '#14123a', '#3a2c6a'], [.9, '#06081e', '#1a1e52'], [1, '#04061a', '#16194a'],
];
function skyAt(p: number): [string, string] {
  p = ((p % 1) + 1) % 1; for (let i = 0; i < SKY_KEYS.length - 1; i++) { const a = SKY_KEYS[i], b = SKY_KEYS[i + 1]; if (p >= a[0] && p <= b[0]) { const t = (p - a[0]) / (b[0] - a[0]); return [mix(a[1], b[1], t), mix(a[2], b[2], t)]; } }
  return [SKY_KEYS[0][1], SKY_KEYS[0][2]];
}
const THEME_TINT: Record<string, string> = { ruins: '#ff5a3a', crater: '#ff7a4a', moor: '#4a7a6a', junkyard: '#c8a070', industrial: '#b09070', sky: '#ffe9b0', mountain: '#a8c0ff' };

/* ---------- Bauteile ---------- */
function windows(c: Ctx, L: Ctx, x: number, y: number, w: number, h: number, rnd: Rnd, lit: number, glass: string) {
  const sx = 9, sy = 13, gt = shade(glass, .28), gb = shade(glass, -.3);
  for (let yy = y + 8; yy < y + h - 8; yy += sy) for (let xx = x + 5; xx < x + w - 8; xx += sx) {
    c.fillStyle = 'rgba(0,0,0,.42)'; c.fillRect(xx - 1, yy - 1, 7, 9);
    c.fillStyle = gt; c.fillRect(xx, yy, 5, 3.5); c.fillStyle = gb; c.fillRect(xx, yy + 3.5, 5, 3.5);
    c.fillStyle = 'rgba(255,255,255,.16)'; c.beginPath(); c.moveTo(xx, yy + 5); c.lineTo(xx + 3.2, yy); c.lineTo(xx + 4.6, yy); c.lineTo(xx, yy + 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.13)'; c.fillRect(xx - 1, yy + 7.5, 7, 1);
    if (rnd() < lit) { const hue = rnd(), col = hue < .7 ? 'rgba(255,214,120,.85)' : hue < .85 ? 'rgba(120,220,255,.8)' : 'rgba(255,120,200,.75)'; L.fillStyle = col; L.fillRect(xx, yy, 5, 7); glow(L, xx + 2.5, yy + 3.5, 9, col, .2); }
  }
}
function neonGlyph(c: Ctx, x: number, y: number, w: number, h: number, col: string, rnd: Rnd) { // Neon-Schriftzug aus Segmenten
  c.save(); c.strokeStyle = col; c.lineWidth = 1.6; c.lineCap = 'round'; c.shadowColor = col; c.shadowBlur = 6; c.beginPath();
  const n = Math.max(2, Math.floor(h / 8));
  for (let i = 0; i < n; i++) { const yy = y + 4 + i * (h - 8) / Math.max(1, n - 1), l = w * (.4 + rnd() * .5); c.moveTo(x + (w - l) / 2, yy); c.lineTo(x + (w + l) / 2, yy); if (rnd() < .5) { c.moveTo(x + w / 2, yy); c.lineTo(x + w / 2, yy + 4); } }
  c.stroke(); c.restore();
}
function tower(c: Ctx, L: Ctx, x: number, base: number, w: number, h: number, col: string, rnd: Rnd, o: { lit?: number; neon?: string; roof?: number; holo?: boolean } = {}) {
  c.fillStyle = lg(c, x, 0, x + w, 0, 0, shade(col, .12), .6, col, 1, shade(col, -.25)); c.fillRect(x, base - h, w, h);
  const tp = texture(c, 'stone'); if (tp) { c.save(); c.globalAlpha = .55; c.fillStyle = tp; c.fillRect(x, base - h, w, h); c.restore(); }
  c.fillStyle = lg(c, 0, base - h, 0, base, 0, 'rgba(255,255,255,.05)', .55, 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,.3)'); c.fillRect(x, base - h, w, h);
  c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x, base - h, 2, h); c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x + w - 2, base - h, 2, h);
  for (let yy = base - h + 24; yy < base - 6; yy += 26) { c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x, yy, w, 1.5); c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x, yy + 1.5, w, 1); }
  windows(c, L, x, base - h, w, h, rnd, o.lit ?? .4, shade(col, .18));
  const rf = o.roof ?? (rnd() * 4 | 0);
  c.fillStyle = shade(col, -.3);
  if (rf === 0) { c.fillRect(x + w / 2 - 1, base - h - 18, 2, 18); L.fillStyle = 'rgba(255,60,60,.9)'; L.fillRect(x + w / 2 - 1.5, base - h - 20, 3, 3); glow(L, x + w / 2, base - h - 19, 9, '#ff3030', .5); }
  else if (rf === 1) c.fillRect(x + 4, base - h - 8, w * .4, 8);
  else if (rf === 2) poly(c, [x, base - h, x + w / 2, base - h - w * .35, x + w, base - h], shade(col, -.2));
  c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(x, base - h, w, 1.5);
  AOS.push({ c, x, w, base });
  if (o.neon) { const ny = base - h + 10 + rnd() * h * .5, nh = 22 + rnd() * 18; c.fillStyle = '#0c0e18'; c.fillRect(x + w - 7, ny - 2, 7, nh + 4); L.fillStyle = o.neon; L.fillRect(x + w - 3, ny, 2.5, nh); glow(L, x + w - 2, ny + nh / 2, 24, o.neon, .5); neonGlyph(L, x + w - 6.5, ny, 6, nh, o.neon, rnd); if (o.holo) HOLOS.push({ x: x + w + 6, y: ny - 6, w: 26, h: 34, col: o.neon, ph: rnd() * 6 }); }
}
function mountains(c: Ctx, w: number, base: number, rnd: Rnd, amp: number, col: string, snow?: string, step = 28) {
  const pts: number[] = [-10, base]; let y = base - amp * (.3 + rnd() * .5);
  for (let x = -10; x <= w + step; x += step) { y = clamp(y + (rnd() - .5) * amp * .9, base - amp, base - amp * .15); pts.push(x, y); }
  pts.push(w + step, base); poly(c, pts, lg(c, 0, base - amp, 0, base, 0, shade(col, .1), 1, col));
  if (snow) for (let i = 4; i < pts.length - 4; i += 2) if (pts[i + 1] < base - amp * .55 && pts[i + 1] <= pts[i - 1] && pts[i + 1] <= pts[i + 3]) poly(c, [pts[i] - 7, pts[i + 1] + 14, pts[i], pts[i + 1], pts[i] + 7, pts[i + 1] + 14], snow);
}
function pine(c: Ctx, x: number, base: number, h: number, col: string) {
  c.fillStyle = shade(col, -.5); c.fillRect(x - 1.5, base - h * .15, 3, h * .15);
  for (let i = 0; i < 4; i++) { const yy = base - h * .1 - i * h * .22, ww = h * (.32 - i * .06); poly(c, [x - ww, yy, x, yy - h * .34, x + ww, yy], i % 2 ? shade(col, -.1) : col); }
}
function roundTree(c: Ctx, x: number, base: number, h: number, col: string, trunk: string) {
  c.fillStyle = trunk; c.fillRect(x - h * .05, base - h * .5, h * .1, h * .5);
  for (const [dx, dy, r] of [[0, -.65, .3], [-.2, -.5, .22], [.2, -.5, .22], [0, -.85, .2]]) { c.fillStyle = lg(c, 0, base + (dy - r) * h, 0, base + (dy + r) * h, 0, shade(col, .15), 1, shade(col, -.25)); c.beginPath(); c.arc(x + dx * h, base + dy * h, r * h, 0, TAU); c.fill(); }
}
function deadTree(c: Ctx, x: number, base: number, h: number, col: string, rnd: Rnd) {
  c.strokeStyle = col; c.lineCap = 'round';
  const br = (bx: number, by: number, a: number, len: number, wd: number, d: number) => { c.lineWidth = wd; c.beginPath(); c.moveTo(bx, by); const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len; c.lineTo(ex, ey); c.stroke(); if (d > 0) { br(ex, ey, a - .5 - rnd() * .3, len * .7, wd * .7, d - 1); br(ex, ey, a + .5 + rnd() * .3, len * .7, wd * .7, d - 1); } };
  br(x, base, -Math.PI / 2 + (rnd() - .5) * .3, h * .35, Math.max(2, h * .05), 3);
}
function crate(c: Ctx, x: number, base: number, w: number, h: number, col: string) {
  c.fillStyle = lg(c, x, 0, x + w, 0, 0, shade(col, .15), 1, shade(col, -.2)); c.fillRect(x, base - h, w, h);
  c.strokeStyle = shade(col, -.45); c.lineWidth = 1; c.strokeRect(x + .5, base - h + .5, w - 1, h - 1);
  for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(x + w * i / 6, base - h); c.lineTo(x + w * i / 6, base); c.stroke(); }
}
let LAMPS: { x: number; base: number; h: number; col: string }[] = [];
function lamp(c: Ctx, L: Ctx, x: number, base: number, h: number, col = 'rgba(255,220,150,1)') { void c; void L; LAMPS.push({ x, base, h, col }); }
function drawLamp(c: Ctx, L: Ctx, x: number, base: number, h: number, col: string) {
  const g = c.createRadialGradient(x, base, 0, x, base, 14); g.addColorStop(0, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.save(); c.translate(x, base); c.scale(1, .3); c.translate(-x, -base); c.fillStyle = g; c.fillRect(x - 14, base - 14, 28, 28); c.restore();
  c.fillStyle = lg(c, x - 1.5, 0, x + 1.5, 0, 0, '#3a4258', 1, '#10131c'); c.fillRect(x - 1.5, base - h, 3, h); c.fillRect(x - 5, base - h - 2, 10, 4); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x - 1.5, base - h, 1, h);
  glow(L, x, base - h + 3, 42, col, .55); L.fillStyle = col; L.beginPath(); L.arc(x, base - h + 2, 3, 0, TAU); L.fill();
}
function awning(c: Ctx, L: Ctx, x: number, base: number, w: number, h: number, c1: string, c2: string, lit: boolean) {
  c.fillStyle = '#2a2018'; c.fillRect(x + 3, base - h, 3, h); c.fillRect(x + w - 6, base - h, 3, h);
  const n = 6, sw = w / n; for (let i = 0; i < n; i++) poly(c, [x + i * sw, base - h, x + (i + 1) * sw, base - h, x + (i + 1) * sw + 2, base - h + 14, x + i * sw - 2, base - h + 14], i % 2 ? c1 : c2, 'rgba(0,0,0,.4)', 1);
  c.fillStyle = '#3a2a1c'; c.fillRect(x + 4, base - h * .35, w - 8, h * .35);
  c.fillStyle = shade('#3a2a1c', .25); c.fillRect(x + 4, base - h * .35, w - 8, 3);
  if (lit) { glow(L, x + w / 2, base - h + 18, w * .6, '#ffd890', .4); }
}
function ground(c: Ctx, w: number, h: number, y0: number, top: string, bot: string, o: { lines?: string; grid?: number; speck?: string; rnd: Rnd; curb?: string; band?: string }) {
  const H = h - y0, rnd = o.rnd, kind = GKIND[curTheme] || 'paving';
  c.fillStyle = lg(c, 0, y0, 0, h, 0, top, 1, bot); c.fillRect(0, y0, w, H);
  // großflächige Fleckigkeit
  for (let i = 0; i < 34; i++) { const bx = rnd() * w, by = y0 + rnd() * H, r = 40 + rnd() * 110, dk = rnd() < .5; const g = c.createRadialGradient(bx, by, 0, bx, by, r); g.addColorStop(0, dk ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.07)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.save(); c.translate(bx, by); c.scale(1, .4); c.translate(-bx, -by); c.fillStyle = g; c.fillRect(bx - r, by - r, r * 2, r * 2); c.restore(); }
  const rows = kind === 'paving' || kind === 'metal' ? 13 : 9;
  const rowY = (i: number) => y0 + H * Math.pow(i / rows, 1.75);
  if (kind === 'paving' || (kind === 'rock' && o.lines)) { // perspektivisches Pflaster
    c.lineCap = 'butt';
    for (let i = 0; i < rows; i++) {
      const ya = rowY(i), yb = rowY(i + 1), tt = (yb - y0) / H, sw = 22 + 84 * tt * tt + 10 * tt, off = (i % 2) * sw / 2 + rnd() * 3;
      for (let x = -sw + off; x < w; x += sw) { const v = (rnd() - .5) * .16; c.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v * 1.4})`; c.fillRect(x + 1, ya + 1, sw - 1, yb - ya - 1); }
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.moveTo(0, ya); c.lineTo(w, ya); c.lineTo(w, ya + 1.6 + tt * 1.6); c.lineTo(0, ya + 1.6 + tt * 1.6); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1 + tt; c.beginPath(); for (let x = off; x < w; x += sw) { c.moveTo(x, ya); c.lineTo(x, yb); } c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1; c.beginPath(); for (let x = off; x < w; x += sw) { c.moveTo(x + 1.5, ya + 2); c.lineTo(x + 1.5, yb - 1); } c.stroke();
      if (o.lines) { c.strokeStyle = o.lines; c.globalAlpha = .45; c.lineWidth = 1; c.beginPath(); c.moveTo(0, ya + .5); c.lineTo(w, ya + .5); c.stroke(); c.globalAlpha = 1; }
    }
  } else if (kind === 'metal') {
    for (let i = 0; i < rows; i++) { const ya = rowY(i), yb = rowY(i + 1), tt = (yb - y0) / H; c.fillStyle = i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.08)'; c.fillRect(0, ya, w, yb - ya); c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(0, ya, w, 1.5 + tt); c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(0, ya + 1.5 + tt, w, 1); const pw = 80 + 240 * tt; for (let x = (i % 3) * pw / 3; x < w; x += pw) { c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(x, ya, 1.5, yb - ya); c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x + 6, ya + 4 + tt * 3, 1.6 + tt, 1.6 + tt); c.fillRect(x + pw - 8, yb - 5 - tt * 3, 1.6 + tt, 1.6 + tt); } }
    if (o.lines) { c.strokeStyle = o.lines; c.globalAlpha = .5; c.lineWidth = 2; c.beginPath(); c.moveTo(0, rowY(2)); c.lineTo(w, rowY(2)); c.stroke(); c.globalAlpha = 1; }
  } else if (kind === 'grass') {
    const cols = [shade(top, -.12), shade(top, .12), shade(bot, .25)];
    for (let k = 0; k < 3; k++) { c.strokeStyle = cols[k]; c.globalAlpha = .55; c.beginPath(); const n = w * H / 420; for (let i = 0; i < n; i++) { const yy = y0 + Math.pow(rnd(), .8) * H, tt = (yy - y0) / H, l = 3 + tt * 9, xx = rnd() * w; c.lineWidth = .8 + tt * 1.2; c.moveTo(xx, yy); c.lineTo(xx + (rnd() - .5) * 3, yy - l); } c.stroke(); } c.globalAlpha = 1;
    for (let i = 0; i < w * H / 9000; i++) { const yy = y0 + rnd() * H, xx = rnd() * w, tt = (yy - y0) / H; c.fillStyle = ['#ffe27a', '#ffffff', '#ff9ac0', '#b0b8ff'][rnd() * 4 | 0]; c.globalAlpha = .7; c.beginPath(); c.arc(xx, yy, 1 + tt * 1.4, 0, TAU); c.fill(); } c.globalAlpha = 1;
  } else if (kind === 'sand' || kind === 'rock') {
    for (let i = 0; i < 26; i++) { c.strokeStyle = 'rgba(0,0,0,.26)'; c.lineWidth = .8 + rnd(); c.beginPath(); let px = rnd() * w, py = y0 + rnd() * H; c.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (rnd() - .4) * 46; py += (rnd() - .3) * 14; c.lineTo(px, py); } c.stroke(); c.strokeStyle = 'rgba(255,255,255,.07)'; c.translate(0, 1.4); c.stroke(); c.translate(0, -1.4); }
    for (let i = 0; i < w * H / 4500; i++) { const yy = y0 + rnd() * H, tt = (yy - y0) / H, rx = 2 + tt * 9 * rnd(); c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(rnd() * w, yy, rx, rx * .45, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.09)'; c.beginPath(); c.ellipse(rnd() * w, yy - 1, rx * .7, rx * .25, 0, 0, TAU); c.fill(); }
  } else { // void
    const g = o.grid ?? 14; c.strokeStyle = o.lines || 'rgba(176,92,255,.3)'; c.lineWidth = 1; c.globalAlpha = .4; for (let i = -g; i <= g * 2; i++) { const xx = w * i / g; c.beginPath(); c.moveTo(w / 2 + (xx - w / 2) * .55, y0); c.lineTo(w / 2 + (xx - w / 2) * 1.5, h); c.stroke(); } for (let i = 1; i <= rows; i++) { c.beginPath(); c.moveTo(0, rowY(i)); c.lineTo(w, rowY(i)); c.stroke(); } c.globalAlpha = 1;
  }
  // Körnung & Sprenkel
  const gp = texture(c, 'grain'); if (gp) { c.save(); c.globalAlpha = .3; c.fillStyle = gp; c.fillRect(0, y0, w, H); c.restore(); }
  if (o.speck) { c.fillStyle = o.speck; for (let i = 0; i < w * H / 1400; i++) { const yy = y0 + rnd() * H, s = 1 + (yy - y0) / H * 3; c.globalAlpha = .1 + rnd() * .22; c.fillRect(rnd() * w, yy, s * 1.6, s); } c.globalAlpha = 1; }
  if (o.band) { c.fillStyle = o.band; c.fillRect(0, y0, w, 4); }
  c.fillStyle = o.curb || 'rgba(0,0,0,.35)'; c.fillRect(0, y0, w, 3); c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(0, y0 + 3, w, 1);
  const sh = c.createLinearGradient(0, y0, 0, y0 + 34); sh.addColorStop(0, 'rgba(0,0,0,.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sh; c.fillRect(0, y0, w, 34);
  const dv = c.createLinearGradient(0, y0, 0, h); dv.addColorStop(0, 'rgba(0,0,0,.18)'); dv.addColorStop(.5, 'rgba(0,0,0,0)'); dv.addColorStop(1, 'rgba(0,0,0,.12)'); c.fillStyle = dv; c.fillRect(0, y0, w, H);
}

/* ---------- Szenen je Theme ---------- */
function build(theme: string, w: number, h: number, seed: string): Layers { curTheme = theme; AOS = []; HOLOS = []; LAMPS = []; return finish(build0(theme, w, h, seed), theme, w, h); }
function finish(L: Layers, theme: string, w: number, h: number): Layers {
  const hy = Math.round(h * .5), n = ctx2(L.near); let px = [40, 40, 44];
  const doAO = () => { for (const a of AOS) if (a.c === n) { const g = n.createLinearGradient(0, a.base, 0, a.base + 22); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); n.fillStyle = g; n.fillRect(a.x - 8, a.base, a.w + 18, 22); } };
  try { const d = n.getImageData(3, h - 3, 1, 1).data; px = [d[0], d[1], d[2]]; } catch { /* */ }
  n.save(); n.globalCompositeOperation = 'destination-over'; n.fillStyle = lg(n, 0, hy, 0, h, 0, rgb(px[0] * .75, px[1] * .75, px[2] * .75), 1, rgb(px[0], px[1], px[2])); n.fillRect(0, hy - 2, w, h - hy + 2); n.restore();
  doAO(); for (const l of LAMPS) drawLamp(n, ctx2(L.lights), l.x, l.base, l.h, l.col);
  try { accents(L, theme, w, h); } catch { /* */ }
  L.holos = HOLOS.slice();
  { // Bloom-Näherung: Lichter heruntergerechnet und weich hochskaliert (einmalig, voll aufgelöst gecacht)
    const full = mkCanvas(w, h), fx = ctx2(full); fx.imageSmoothingEnabled = true; fx.globalCompositeOperation = 'lighter';
    for (const [f, a] of [[4, .6], [10, .8]] as [number, number][]) { const c = mkCanvas(Math.ceil(w / f), Math.ceil(h / f)), x = ctx2(c); x.imageSmoothingEnabled = true; x.drawImage(L.lights, 0, 0, c.width, c.height); if (L.neon) x.drawImage(L.neon, 0, 0, c.width, c.height); fx.globalAlpha = a; fx.drawImage(c, 0, 0, w, h); }
    if (L.neon) { fx.globalAlpha = 1; fx.drawImage(L.neon, 0, 0); } // Neon/Magie direkt mit eingebacken (ein Blit pro Frame)
    L.bloom = full;
  }
  if (!INDOOR[theme]) { const r2 = mulberry(hash('pud' + theme)); L.puddles = []; const cnt = Math.round(clamp(w / 70, 6, 26)); for (let i = 0; i < cnt; i++) { const t0 = Math.pow(r2(), .8), rx = (16 + r2() * 38) * (.5 + t0 * 1.3); L.puddles.push({ x: r2() * w, y: hy + 46 + t0 * (h - hy - 62), rx, ry: rx * .17 }); } }
  if (!INDOOR[theme]) {
    const dark = ['ruins', 'moor', 'crater', 'industrial'].includes(theme);
    const mk = (src: HTMLCanvasElement, a: number, col: string) => { const c = mkCanvas(src.width, src.height), x = ctx2(c); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = a; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return c; };
    L.farD = mk(L.far, dark ? .3 : .55, '#b4cdf0'); L.nearD = mk(L.near, dark ? .1 : .28, '#ffeccc');
  }
  return L;
}
/* ---------- Magie-/Neon-Akzente ---------- */
function crystalCluster(c: Ctx, N: Ctx, x: number, base: number, hg: number, col: string, rnd: Rnd) {
  const g = c.createRadialGradient(x, base, 0, x, base, hg * .7); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.save(); c.translate(x, base); c.scale(1, .3); c.translate(-x, -base); c.fillStyle = g; c.fillRect(x - hg, base - hg, hg * 2, hg * 2); c.restore();
  for (let i = 0; i < 5; i++) { const dx = (i - 2) * hg * .13 + (rnd() - .5) * 3, hh = hg * (.45 + rnd() * .55) * (i === 2 ? 1.1 : 1), ww = hg * .085; poly(c, [x + dx - ww, base, x + dx - ww * .6, base - hh * .8, x + dx, base - hh, x + dx + ww * .6, base - hh * .75, x + dx + ww, base], lg(c, x + dx - ww, 0, x + dx + ww, 0, 0, shade(col, .55), .5, col, 1, shade(col, -.5)), shade(col, .6), 1); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(x + dx - ww * .3, base - hh * .75, 1, hh * .5); }
  glow(N, x, base - hg * .45, hg * 1.2, col, .55); N.fillStyle = '#fff'; N.globalAlpha = .6; N.beginPath(); N.arc(x, base - hg * .5, 2, 0, TAU); N.fill(); N.globalAlpha = 1;
}
function groundRune(n: Ctx, N: Ctx, cx: number, cy: number, rx: number, col: string, rnd: Rnd) {
  for (const [c, a, lw] of [[n, .25, 2.4], [N, .9, 1.4]] as [Ctx, number, number][]) {
    c.save(); c.translate(cx, cy); c.scale(1, .3); c.lineWidth = lw; c.strokeStyle = c === n ? 'rgba(0,0,0,.6)' : col; c.globalAlpha = a; if (c === N) { c.shadowColor = col; c.shadowBlur = 10; }
    for (const k of [1, .82, .5]) { c.beginPath(); c.arc(0, 0, rx * k, 0, TAU); c.stroke(); }
    c.beginPath(); for (let i = 0; i < 6; i++) { const an = i / 6 * TAU - Math.PI / 2; c.lineTo(Math.cos(an) * rx * .82, Math.sin(an) * rx * .82); } c.closePath(); c.stroke();
    c.beginPath(); for (let i = 0; i < 24; i++) { const an = i / 24 * TAU, r0 = rx * .82, r1 = rx * (i % 2 ? .93 : .97); c.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); c.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); } c.stroke();
    c.restore();
  } void rnd;
}
function neonSign(n: Ctx, N: Ctx, x: number, y: number, w: number, h: number, col: string, rnd: Rnd) {
  n.fillStyle = '#12141e'; n.fillRect(x + w / 2 - 1.5, y + h, 3, 40); n.beginPath(); n.roundRect(x, y, w, h, 4); n.fill(); n.strokeStyle = 'rgba(255,255,255,.12)'; n.lineWidth = 1; n.stroke();
  glow(N, x + w / 2, y + h / 2, Math.max(w, h) * 1.1, col, .45); N.save(); N.strokeStyle = col; N.lineWidth = 1.8; N.shadowColor = col; N.shadowBlur = 8; N.beginPath(); N.roundRect(x + 3, y + 3, w - 6, h - 6, 3); N.stroke(); N.restore(); neonGlyph(N, x + 4, y + 4, w - 8, h - 8, '#fff', rnd); neonGlyph(N, x + 4, y + 4, w - 8, h - 8, col, rnd);
}
function accents(L: Layers, theme: string, w: number, h: number) {
  const hy = Math.round(h * .5), rnd = mulberry(hash('acc' + theme)), n = ctx2(L.near);
  const T: Record<string, string> = { city: '#35e0ff', market: '#ffb04a', guild: '#ffd23a', residential: '#ffcf7a', park: '#7affb0', harbor: '#ff4adf', industrial: '#ff8a2a', arena: '#ff6a3a', sky: '#ffe9a0', crater: '#35e0ff', void: '#b05cff', ruins: '#ff7a3a' };
  const col = T[theme]; if (!col) return;
  const neon = mkCanvas(w, h), N = ctx2(neon); L.neon = neon;
  const gy = hy + 44, span = h - hy;
  const crystals = (cols: string[], gap: number, hg: number) => { for (let x = gap * (.4 + rnd() * .5); x < w; x += gap * (.8 + rnd() * .5)) crystalCluster(n, N, x, gy + rnd() * span * .22, hg * (.7 + rnd() * .6), cols[rnd() * cols.length | 0], rnd); };
  switch (theme) {
    case 'city': crystals(['#35e0ff', '#b05cff'], 330, 46); groundRune(n, N, w * .5, hy + span * .66, Math.min(w * .17, 170), '#35e0ff', rnd);
      for (let i = 0; i < 2; i++) neonSign(n, N, w * (.2 + i * .52) + rnd() * 60, hy - 16 + rnd() * 20, 54, 24, ['#ff3df0', '#35e0ff'][i], rnd); break;
    case 'market': crystals(['#ffb04a', '#ff7ad8', '#7affd0'], 260, 34); groundRune(n, N, w * .5, hy + span * .7, Math.min(w * .13, 130), '#ffb04a', rnd); break;
    case 'guild': { const gb = hy + 28; groundRune(n, N, w * .5, hy + span * .68, Math.min(w * .2, 200), '#ffd23a', rnd); crystalCluster(n, N, w / 2 - 230, gb + 22, 56, '#35e0ff', rnd); crystalCluster(n, N, w / 2 + 230, gb + 22, 56, '#35e0ff', rnd);
      N.save(); N.translate(w / 2, gb - 150); N.strokeStyle = '#ffd23a'; N.lineWidth = 1.6; N.shadowColor = '#ffd23a'; N.shadowBlur = 10; N.beginPath(); N.arc(0, 0, 22, 0, TAU); N.moveTo(0, -22); N.lineTo(19, 11); N.lineTo(-19, 11); N.closePath(); N.stroke(); N.restore(); glow(N, w / 2, gb - 150, 50, '#ffd23a', .35); break; }
    case 'residential': crystals(['#ffcf7a', '#8ad0ff'], 280, 26); break;
    case 'park': crystals(['#7affb0', '#35e0ff', '#c8ff6a'], 320, 40); break;
    case 'harbor': for (let i = 0; i < 2; i++) neonSign(n, N, w * (.15 + i * .5) + rnd() * 80, hy + 4 + rnd() * 16, 62, 26, ['#ff4adf', '#35e0ff'][i], rnd); crystals(['#35e0ff'], 420, 30); break;
    case 'industrial': neonSign(n, N, w * .3, hy - 10, 66, 26, '#ff8a2a', rnd); neonSign(n, N, w * .72, hy - 4, 56, 24, '#ff3a3a', rnd); HOLOS.push({ x: w * .5, y: hy - 52, w: 40, h: 40, col: '#ffcf3a', ph: 1.3 }); break;
    case 'arena': groundRune(n, N, w * .5, hy + span * .66, Math.min(w * .22, 230), '#ff6a3a', rnd); break;
    case 'sky': crystals(['#ffe9a0', '#a0e0ff'], 300, 44); groundRune(n, N, w * .5, hy + span * .68, Math.min(w * .16, 160), '#ffe9a0', rnd); break;
    case 'crater': groundRune(n, N, w * .5, hy + span * .68, Math.min(w * .14, 140), '#35e0ff', rnd); break;
    case 'void': groundRune(n, N, w * .5, hy + span * .66, Math.min(w * .2, 200), '#b05cff', rnd); break;
    case 'ruins': groundRune(n, N, w * .5, hy + span * .66, Math.min(w * .14, 140), '#ff7a3a', rnd); break;
  }
}
function build0(theme: string, w: number, h: number, seed: string): Layers {
  const rnd = mulberry(hash(theme + '|' + seed));
  const far = mkCanvas(w + 60, h), near = mkCanvas(w, h), lights = mkCanvas(w, h);
  const f = ctx2(far), n = ctx2(near), L = ctx2(lights), FL = L; // far windows share lights (offset fixed -30)
  const hy = Math.round(h * .5);
  const stars = Array.from({ length: 140 }, () => ({ x: rnd() * w, y: rnd() * hy * .9, r: .4 + rnd() * 1.1, p: rnd() * TAU }));
  const city = (base: number, col: string, hMin: number, hMax: number, neon: boolean, lit = .4, wMin = 30, wMax = 70, ctxF: Ctx = f, Ll: Ctx = FL, off = 0) => {
    for (let x = -10; x < w + 70;) { const bw = wMin + rnd() * (wMax - wMin), bh = hMin + rnd() * (hMax - hMin); Ll.save(); Ll.translate(off, 0); tower(ctxF, Ll, x, base, bw, bh, col, rnd, { lit, neon: neon && rnd() < .3 ? ['#ff3df0', '#35e0ff', '#ff7a3a', '#7aff6a'][rnd() * 4 | 0] : undefined }); Ll.restore(); x += bw + rnd() * 6; }
  };
  const lightsFar = L; // far lights are drawn with +30 offset below via translate
  L.save(); L.translate(-30, 0);
  let gt: [string, string, string?, string?] = ['#3a4050', '#1a1d28', 'rgba(255,255,255,.12)', 'rgba(255,255,255,.1)'];
  const T = theme;
  if (T === 'city') {
    city(hy + 4, '#141a30', h * .25, h * .5, true, .45); f.fillStyle = 'rgba(40,50,90,.35)'; f.fillRect(0, hy - 50, w + 60, 54);
    L.restore(); L.save();
    for (let x = 10; x < w; x += 70 + rnd() * 80) { const bh = 70 + rnd() * 70, bw = 44 + rnd() * 30; tower(n, L, x, hy + 18, bw, bh, '#1c2440', rnd, { lit: .5, neon: rnd() < .5 ? '#35e0ff' : '#ff3df0', holo: rnd() < .55 }); }
    for (let x = 40; x < w; x += 150 + rnd() * 60) lamp(n, L, x, hy + 60 + rnd() * 60, 48);
    gt = ['#2c3144', '#14161f', 'rgba(150,170,255,.18)', 'rgba(255,255,255,.1)'];
  } else if (T === 'market') {
    city(hy + 2, '#2a2038', h * .15, h * .35, false, .4, 40, 80);
    L.restore(); L.save();
    for (let x = 0; x < w; x += 110 + rnd() * 30) awning(n, L, x + 5, hy + 40, 100, 62, ['#d04a4a', '#4a8ad0', '#d0a04a', '#4ad08a'][rnd() * 4 | 0], '#f0e6d0', true);
    L.fillStyle = 'rgba(255,230,160,.9)'; for (let x = 0; x < w; x += 16) { const yy = hy - 28 + Math.sin(x / w * Math.PI * 6) * 6; L.beginPath(); L.arc(x, yy, 2, 0, TAU); L.fill(); glow(L, x, yy, 10, '#ffd890', .5); }
    gt = ['#5a4a42', '#2a2220', 'rgba(0,0,0,.25)', 'rgba(255,230,200,.1)'];
  } else if (T === 'industrial') {
    mountains(f, w + 60, hy + 5, rnd, 40, '#2a2630');
    for (let x = 20; x < w; x += 130 + rnd() * 80) { const hh = 90 + rnd() * 80; f.fillStyle = lg(f, x, 0, x + 18, 0, 0, '#3a3440', 1, '#1a161e'); f.fillRect(x + 30, hy - hh, 18, hh); f.fillStyle = '#c04a2a'; f.fillRect(x + 30, hy - hh, 18, 5); for (let k = 0; k < 4; k++) { f.fillStyle = `rgba(90,86,96,${.35 - k * .07})`; f.beginPath(); f.arc(x + 39 + k * 14, hy - hh - 14 - k * 18, 10 + k * 6, 0, TAU); f.fill(); } tower(f, FL, x - 40, hy, 70, 60, '#24202c', rnd, { lit: .3, roof: 1 }); }
    L.restore(); L.save();
    for (let x = 0; x < w; x += 160 + rnd() * 60) { const bw = 100 + rnd() * 60; n.fillStyle = lg(n, 0, hy - 40, 0, hy + 20, 0, '#34303c', 1, '#1e1a24'); n.fillRect(x, hy - 40, bw, 62); windows(n, L, x, hy - 40, bw, 62, rnd, .35, '#4a4658'); n.fillStyle = '#c08a2a'; n.fillRect(x, hy - 42, bw, 3); n.strokeStyle = '#4a4654'; n.lineWidth = 4; n.beginPath(); n.moveTo(x, hy - 20); n.lineTo(x + bw, hy - 20); n.stroke(); glow(L, x + bw * .5, hy - 10, 50, '#ff7a2a', .25); }
    gt = ['#3a3a42', '#17171c', 'rgba(255,200,60,.2)', 'rgba(255,255,255,.08)'];
    ground(n, w, h, hy + 22, gt[0], gt[1], { lines: gt[2], rnd, speck: gt[3] });
    n.fillStyle = 'rgba(240,190,40,.7)'; for (let x = 0; x < w; x += 40) { n.beginPath(); n.moveTo(x, hy + 24); n.lineTo(x + 14, hy + 24); n.lineTo(x + 20, hy + 30); n.lineTo(x + 6, hy + 30); n.fill(); }
    L.restore(); return { far, near, lights, stars };
  } else if (T === 'residential') {
    mountains(f, w + 60, hy + 6, rnd, 70, '#2c3a4a'); for (let x = 0; x < w + 60; x += 30 + rnd() * 30) roundTree(f, x, hy + 6, 40 + rnd() * 30, '#2a4a3a', '#2a2018');
    L.restore(); L.save();
    for (let x = 10; x < w; x += 120 + rnd() * 50) { const bw = 70 + rnd() * 30, bh = 46 + rnd() * 20, col = ['#8a5a4a', '#6a7a8a', '#9a8a6a', '#7a6a8a'][rnd() * 4 | 0], by = hy + 28; n.fillStyle = lg(n, x, 0, x + bw, 0, 0, shade(col, .1), 1, shade(col, -.3)); n.fillRect(x, by - bh, bw, bh); poly(n, [x - 8, by - bh, x + bw / 2, by - bh - 34, x + bw + 8, by - bh], shade(col, -.45), 'rgba(0,0,0,.4)'); windows(n, L, x + 8, by - bh + 4, bw - 16, bh - 12, rnd, .6, shade(col, -.1)); n.fillStyle = shade(col, -.55); n.fillRect(x + bw / 2 - 5, by - 18, 10, 18); glow(L, x + bw / 2, by - 10, 30, '#ffd890', .25); }
    for (let x = 60; x < w; x += 200) roundTree(n, x + rnd() * 40, hy + 40, 70 + rnd() * 20, '#2f6a3f', '#3a2a1c');
    gt = ['#3a5a3a', '#1a2a1e', 'rgba(255,255,255,.07)', 'rgba(120,200,120,.2)'];
    ground(n, w, h, hy + 30, gt[0], gt[1], { rnd, speck: gt[3] }); n.fillStyle = 'rgba(160,150,130,.35)'; n.fillRect(0, hy + 40, w, 22); L.restore(); return { far, near, lights, stars };
  } else if (T === 'guild') {
    city(hy + 4, '#1c1a30', h * .12, h * .3, false, .35);
    L.restore(); L.save();
    const gx = w / 2 - 190, gb = hy + 28; n.fillStyle = lg(n, gx, 0, gx + 380, 0, 0, '#3a3a58', .5, '#4a4a6c', 1, '#2a2a44'); n.fillRect(gx, gb - 120, 380, 120);
    for (const sx of [gx - 20, gx + 340]) { n.fillStyle = '#34344e'; n.fillRect(sx + 15, gb - 190, 50, 190); poly(n, [sx + 8, gb - 190, sx + 40, gb - 260, sx + 72, gb - 190], '#2a2a44'); }
    poly(n, [gx - 10, gb - 120, w / 2, gb - 210, gx + 390, gb - 120], '#2a2a44', 'rgba(255,255,255,.1)');
    for (let i = 0; i < 6; i++) { const wx = gx + 30 + i * 58; n.fillStyle = '#12142a'; rr0(n, wx, gb - 100, 28, 54, 14); L.fillStyle = 'rgba(255,200,110,.7)'; rr0(L, wx + 3, gb - 97, 22, 50, 11); }
    n.fillStyle = '#3a2a1c'; rr0(n, w / 2 - 22, gb - 56, 44, 56, 22); glow(L, w / 2, gb - 28, 50, '#ffb04a', .5);
    for (const bx of [gx + 60, gx + 300]) { poly(n, [bx - 14, gb - 150, bx + 14, gb - 150, bx + 14, gb - 100, bx, gb - 112, bx - 14, gb - 100], '#a02a3a'); }
    gt = ['#45455e', '#1e1e2e', 'rgba(255,255,255,.14)', 'rgba(255,255,255,.08)'];
  } else if (T === 'arena') {
    mountains(f, w + 60, hy + 4, rnd, 50, '#3a2a2a');
    f.fillStyle = lg(f, 0, hy - 110, 0, hy, 0, '#5a4a3a', 1, '#2a2018'); f.beginPath(); f.moveTo(0, hy); f.lineTo(0, hy - 50); f.quadraticCurveTo((w + 60) / 2, hy - 160, w + 60, hy - 50); f.lineTo(w + 60, hy); f.fill();
    for (let x = 10; x < w + 60; x += 24) { f.fillStyle = 'rgba(0,0,0,.35)'; rr0(f, x, hy - 60 + Math.abs(x - (w + 60) / 2) * .0006 * Math.abs(x - (w + 60) / 2), 16, 40, 8); FL.fillStyle = rnd() < .3 ? 'rgba(255,180,90,.5)' : 'rgba(0,0,0,0)'; FL.fillRect(x + 6, hy - 40, 3, 3); }
    L.restore(); L.save();
    for (let x = 30; x < w; x += 170) { n.fillStyle = lg(n, x, 0, x + 26, 0, 0, '#8a7a68', 1, '#4a3e34'); n.fillRect(x, hy - 40, 26, 78); n.fillStyle = '#9a8a76'; n.fillRect(x - 4, hy - 46, 34, 8); glow(L, x + 13, hy - 55, 40, '#ff8a3a', .5); n.fillStyle = '#ff9a3a'; n.beginPath(); n.arc(x + 13, hy - 52, 4, 0, TAU); n.fill(); }
    for (let x = 100; x < w; x += 220) poly(n, [x, hy - 20, x + 24, hy - 20, x + 24, hy + 10, x + 12, hy + 4, x, hy + 10], '#8a2a2a');
    gt = ['#a08860', '#5a4a30', 'rgba(60,40,20,.25)', 'rgba(60,40,20,.3)'];
  } else if (T === 'park') {
    city(hy - 4, '#1e2a40', h * .08, h * .2, false, .02, 40, 70);
    for (let x = 0; x < w + 60; x += 22 + rnd() * 24) roundTree(f, x, hy + 6, 50 + rnd() * 40, '#1f4a35', '#2a2018');
    L.restore(); L.save();
    for (let x = 0; x < w; x += 60 + rnd() * 70) roundTree(n, x, hy + 26 + rnd() * 20, 90 + rnd() * 50, rnd() < .3 ? '#6aa84a' : '#3a8a4a', '#4a3322');
    for (let x = 80; x < w; x += 260) lamp(n, L, x, hy + 70, 44);
    gt = ['#4a8a48', '#1e3a24', 'rgba(255,255,255,.06)', 'rgba(150,230,120,.25)'];
    ground(n, w, h, hy + 24, gt[0], gt[1], { rnd, speck: gt[3] }); n.fillStyle = 'rgba(200,180,140,.35)'; n.beginPath(); n.moveTo(0, h * .72); n.bezierCurveTo(w * .3, h * .62, w * .6, h * .84, w, h * .7); n.lineTo(w, h * .76); n.bezierCurveTo(w * .6, h * .9, w * .3, h * .68, 0, h * .78); n.fill(); L.restore(); return { far, near, lights, stars };
  } else if (T === 'forest') {
    mountains(f, w + 60, hy + 4, rnd, 80, '#12281e'); for (let x = 0; x < w + 60; x += 16 + rnd() * 14) pine(f, x, hy + 6, 70 + rnd() * 50, '#173a2a');
    L.restore(); L.save();
    for (let x = -10; x < w; x += 40 + rnd() * 50) pine(n, x, hy + 30 + rnd() * 24, 110 + rnd() * 80, '#1d4a30');
    for (let x = 20; x < w; x += 190 + rnd() * 100) { const th = 150 + rnd() * 60; n.fillStyle = lg(n, x, 0, x + 26, 0, 0, '#4a3524', 1, '#1e150e'); n.fillRect(x, hy - th + 60, 26, th); }
    for (let i = 0; i < 26; i++) { const x = rnd() * w, y = hy + rnd() * (h - hy) * .8; glow(L, x, y, 8, '#c8ff6a', .6); }
    gt = ['#2a4a2a', '#0e1e12', 'rgba(255,255,255,.04)', 'rgba(140,230,100,.2)'];
    ground(n, w, h, hy + 26, gt[0], gt[1], { rnd, speck: gt[3] }); L.restore(); return { far, near, lights, stars };
  } else if (T === 'mountain') {
    mountains(f, w + 60, hy + 8, rnd, 200, '#3a4a68', '#e8f0ff', 38); mountains(f, w + 60, hy + 8, rnd, 130, '#4a5a78', '#ffffff', 30);
    L.restore(); L.save();
    mountains(n, w, hy + 40, rnd, 70, '#3a4256'); for (let x = 0; x < w; x += 70 + rnd() * 70) pine(n, x, hy + 44 + rnd() * 20, 80 + rnd() * 40, '#244a3a');
    for (let x = 30; x < w; x += 140 + rnd() * 90) { n.fillStyle = '#5a6074'; poly(n, [x, hy + 40, x + 14, hy + 8, x + 40, hy + 16, x + 54, hy + 40], '#4e5468', 'rgba(0,0,0,.4)'); }
    gt = ['#8a94a8', '#444a5a', 'rgba(255,255,255,.2)', 'rgba(255,255,255,.3)'];
    ground(n, w, h, hy + 40, gt[0], gt[1], { rnd, speck: gt[3], lines: undefined }); L.restore(); return { far, near, lights, stars };
  } else if (T === 'junkyard') {
    mountains(f, w + 60, hy + 6, rnd, 60, '#3a3228');
    for (let x = 40; x < w + 60; x += 280) { f.fillStyle = '#4a4034'; f.fillRect(x, hy - 150, 6, 150); f.fillRect(x, hy - 150, 110, 5); f.strokeStyle = '#4a4034'; f.beginPath(); f.moveTo(x + 100, hy - 148); f.lineTo(x + 100, hy - 100); f.stroke(); f.fillStyle = '#c08a2a'; f.fillRect(x + 92, hy - 102, 16, 10); }
    L.restore(); L.save();
    for (let x = -10; x < w; x += 70 + rnd() * 60) { const cols = ['#6a4a3a', '#4a6a7a', '#7a7a4a', '#7a3a3a', '#5a5a64']; for (let k = 0; k < 3 + (rnd() * 3 | 0); k++) { crate(n, x + (rnd() - .5) * 16, hy + 36 - k * 22, 56 + rnd() * 20, 20, cols[rnd() * cols.length | 0]); } }
    for (let x = 0; x < w; x += 90) { glow(L, x + 20, hy - 20, 30, '#ff8a2a', rnd() < .15 ? .4 : 0); }
    gt = ['#4a4238', '#1e1a16', 'rgba(255,255,255,.08)', 'rgba(255,200,120,.18)'];
  } else if (T === 'harbor') {
    f.fillStyle = lg(f, 0, hy - 30, 0, hy + 4, 0, '#1a3a5a', 1, '#0e2236'); f.fillRect(0, hy - 24, w + 60, 30);
    for (let x = 20; x < w + 60; x += 200 + rnd() * 100) { f.fillStyle = '#2a2a3a'; f.fillRect(x, hy - 120, 5, 120); f.fillRect(x - 30, hy - 120, 90, 5); f.fillRect(x + 55, hy - 118, 3, 40); }
    for (let x = 60; x < w + 60; x += 280 + rnd() * 150) { poly(f, [x, hy - 6, x + 120, hy - 6, x + 106, hy + 6, x + 12, hy + 6], '#2a2a3c'); f.fillStyle = '#34344a'; f.fillRect(x + 30, hy - 36, 50, 30); f.fillStyle = '#2a2a3c'; f.fillRect(x + 50, hy - 52, 4, 16); FL.fillStyle = 'rgba(255,214,120,.8)'; FL.fillRect(x + 36, hy - 28, 4, 4); FL.fillRect(x + 48, hy - 28, 4, 4); }
    L.restore(); L.save();
    for (let x = 0; x < w; x += 120 + rnd() * 60) { const cols = ['#a04a3a', '#3a6aa0', '#4aa06a', '#a09a3a']; for (let k = 0; k < 2; k++) crate(n, x + k * 4, hy + 34 - k * 26, 100, 26, cols[rnd() * 4 | 0]); }
    for (let x = 60; x < w; x += 200) lamp(n, L, x, hy + 50, 60, 'rgba(255,230,170,1)');
    gt = ['#6a5a48', '#2e2418', 'rgba(0,0,0,.35)', 'rgba(255,255,255,.07)'];
  } else if (T === 'ruins') {
    mountains(f, w + 60, hy + 6, rnd, 90, '#2a1a22'); city(hy + 8, '#201620', h * .08, h * .25, false, .06, 30, 60);
    for (let i = 0; i < 30; i++) glow(f, rnd() * (w + 60), hy - rnd() * 100, 14, '#ff4a2a', .12);
    L.restore(); L.save();
    for (let x = 20; x < w; x += 120 + rnd() * 80) { const ch = 50 + rnd() * 70; n.fillStyle = lg(n, x, 0, x + 28, 0, 0, '#7a6a68', 1, '#3a3030'); n.fillRect(x, hy + 36 - ch, 28, ch); n.fillStyle = '#8a7a76'; n.fillRect(x - 4, hy + 36 - ch - 6, 36, 8); n.fillStyle = 'rgba(0,0,0,.4)'; poly(n, [x + 28, hy + 36 - ch, x + 28, hy + 36 - ch + 22, x + 18, hy + 36 - ch], '#2a1818'); }
    for (let x = 40; x < w; x += 200) deadTree(n, x + rnd() * 80, hy + 46, 90, '#1c1216', rnd);
    for (let i = 0; i < 20; i++) glow(L, rnd() * w, hy + rnd() * (h - hy), 12, '#ff6a2a', .35);
    gt = ['#4a3a3a', '#1c1416', 'rgba(255,90,40,.2)', 'rgba(255,255,255,.07)'];
  } else if (T === 'dungeon') {
    L.restore(); L.save();
    f.fillStyle = '#0c0a12'; for (let x = -20; x < w + 80; x += 28 + rnd() * 30) { const sh = 30 + rnd() * 80; poly(f, [x, 0, x + 18 + rnd() * 10, 0, x + 10, sh], '#150f1c'); }
    n.fillStyle = lg(n, 0, 0, 0, hy, 0, '#05040a', 1, '#1a1424'); n.fillRect(0, 0, w, hy + 10);
    for (let x = 0; x < w; x += 70) { n.fillStyle = 'rgba(255,255,255,.04)'; n.fillRect(x, 0, 2, hy); }
    for (let x = 70; x < w; x += 230 + rnd() * 80) { n.fillStyle = '#2a2230'; n.fillRect(x - 3, hy - 80, 6, 26); n.fillStyle = '#ffae3a'; n.beginPath(); n.ellipse(x, hy - 88, 5, 9, 0, 0, TAU); n.fill(); glow(L, x, hy - 88, 90, '#ff8a2a', .7); }
    gt = ['#2a2632', '#0e0c14', 'rgba(255,255,255,.1)', 'rgba(255,255,255,.07)'];
  } else if (T === 'crater') {
    mountains(f, w + 60, hy + 6, rnd, 80, '#3a1e1a'); mountains(f, w + 60, hy + 6, rnd, 50, '#2a1612');
    L.restore(); L.save();
    for (let x = 20; x < w; x += 150 + rnd() * 80) { const th = 60 + rnd() * 50; n.fillStyle = lg(n, x, 0, x + 30, 0, 0, '#3a4452', 1, '#1a2028'); n.fillRect(x, hy + 36 - th, 30, th); n.fillStyle = '#35e0ff'; n.fillRect(x + 12, hy + 36 - th + 6, 6, th - 12); glow(L, x + 15, hy + 36 - th / 2, 50, '#35e0ff', .4); }
    for (let x = 0; x < w; x += 90 + rnd() * 80) poly(n, [x, hy + 40, x + 20, hy + 12, x + 46, hy + 40], '#2a1a18', 'rgba(255,120,60,.3)');
    gt = ['#3a2a28', '#160e0e', 'rgba(53,224,255,.35)', 'rgba(255,120,60,.25)'];
  } else if (T === 'crystal') {
    L.restore(); L.save();
    f.fillStyle = lg(f, 0, 0, 0, hy, 0, '#05030f', 1, '#150c34'); f.fillRect(0, 0, w + 60, hy + 10);
    const cr = (c: Ctx, x: number, y: number, hh: number, col: string, up: boolean) => { const ww = hh * .22; poly(c, [x - ww, y, x - ww * .6, y - hh * (up ? 1 : -1) * .85, x, y - hh * (up ? 1.1 : -1.1), x + ww * .6, y - hh * (up ? 1 : -1) * .8, x + ww, y], lg(c, x - ww, 0, x + ww, 0, 0, shade(col, .35), .5, col, 1, shade(col, -.4)), shade(col, .5), 1); };
    const cols = ['#b05cff', '#35e0ff', '#ff5cd8', '#6a7aff'];
    for (let x = 0; x < w + 60; x += 20 + rnd() * 30) { const col = cols[rnd() * 4 | 0], hh = 30 + rnd() * 100; cr(f, x, 0, -hh, col, true); glow(FL, x, hh * .5, 60, col, .22); }
    L.restore(); L.save();
    for (let x = 0; x < w; x += 50 + rnd() * 80) { const col = cols[rnd() * 4 | 0], hh = 40 + rnd() * 120; cr(n, x, hy + 30 + rnd() * 16, hh, col, true); glow(L, x, hy + 30 - hh * .5, 80, col, .45); }
    gt = ['#2a2250', '#0c0a22', 'rgba(176,92,255,.3)', 'rgba(53,224,255,.3)'];
  } else if (T === 'moor') {
    mountains(f, w + 60, hy + 6, rnd, 60, '#18242a'); for (let x = 0; x < w + 60; x += 70 + rnd() * 70) deadTree(f, x, hy + 6, 60 + rnd() * 40, '#111a1e', rnd);
    L.restore(); L.save();
    for (let x = 20; x < w; x += 110 + rnd() * 90) deadTree(n, x, hy + 40 + rnd() * 24, 110 + rnd() * 70, '#10181a', rnd);
    for (let i = 0; i < 12; i++) glow(L, rnd() * w, hy + rnd() * (h - hy), 14, '#8affc0', .5);
    gt = ['#2a3a34', '#0e1614', 'rgba(255,255,255,.05)', 'rgba(120,200,160,.15)'];
    ground(n, w, h, hy + 28, gt[0], gt[1], { rnd, speck: gt[3] }); for (let i = 0; i < 6; i++) { const px = rnd() * w, py = hy + 60 + rnd() * (h - hy - 80); n.fillStyle = 'rgba(30,60,60,.6)'; n.beginPath(); n.ellipse(px, py, 50 + rnd() * 60, 8 + rnd() * 8, 0, 0, TAU); n.fill(); } L.restore(); return { far, near, lights, stars };
  } else if (T === 'sky') {
    for (let i = 0; i < 4; i++) { const ix = (i + .5) / 4 * (w + 60) + (rnd() - .5) * 60, iy = hy - 60 + rnd() * 80, iw = 80 + rnd() * 90; poly(f, [ix - iw, iy, ix + iw, iy, ix + iw * .5, iy + iw * .5, ix, iy + iw * .9, ix - iw * .5, iy + iw * .5], lg(f, 0, iy, 0, iy + iw, 0, '#8a7a6a', 1, '#3a3a50'), 'rgba(255,255,255,.2)'); f.fillStyle = '#4a9a5a'; f.fillRect(ix - iw, iy - 5, iw * 2, 8); roundTree(f, ix - iw * .4, iy - 4, 40, '#3a8a5a', '#4a3322'); }
    L.restore(); L.save();
    for (let x = 0; x < w; x += 150 + rnd() * 100) { n.fillStyle = lg(n, x, 0, x + 18, 0, 0, '#e8e0d0', 1, '#9a92a0'); n.fillRect(x, hy - 20, 18, 56); n.fillRect(x - 4, hy - 26, 26, 8); glow(L, x + 9, hy - 30, 36, '#ffe9a0', .4); }
    gt = ['#d8d0e8', '#8a8aa8', 'rgba(255,255,255,.35)', 'rgba(255,255,255,.4)'];
  } else if (T === 'void') {
    L.restore(); L.save();
    for (let i = 0; i < 14; i++) { const x = rnd() * (w + 60), y = rnd() * hy, s = 8 + rnd() * 24; poly(f, [x, y - s, x + s * .6, y, x, y + s * 1.2, x - s * .6, y], lg(f, x, y - s, x, y + s, 0, '#6a30c0', 1, '#1a0a3a'), 'rgba(176,92,255,.5)'); glow(FL, x, y, s * 2.5, '#9a40ff', .25); }
    for (let i = 0; i < 5; i++) { const x = rnd() * w, y = hy + 20 + rnd() * (h - hy) * .7, s = 10 + rnd() * 20; poly(n, [x, y - s * 2, x + s * .7, y, x, y + s * .4, x - s * .7, y], '#1a0a30', 'rgba(176,92,255,.6)'); glow(L, x, y, s * 3, '#8a30ff', .4); }
    gt = ['#241044', '#08031a', 'rgba(176,92,255,.4)', 'rgba(255,120,255,.3)'];
  } else { // generisch
    city(hy + 4, '#1c2238', h * .12, h * .3, false, .3);
    gt = ['#3a3f50', '#181a24', 'rgba(255,255,255,.12)', 'rgba(255,255,255,.08)'];
  }
  L.restore();
  if (!['industrial', 'residential', 'park', 'forest', 'mountain', 'moor'].includes(T)) ground(n, w, h, hy + (T === 'junkyard' || T === 'harbor' || T === 'crater' || T === 'ruins' || T === 'arena' || T === 'sky' ? 36 : T === 'city' || T === 'market' || T === 'guild' ? 28 : T === 'dungeon' || T === 'crystal' || T === 'void' ? 10 : 24), gt[0], gt[1], { lines: gt[2], rnd, speck: gt[3] });
  void lightsFar; void alpha;
  return { far, near, lights, stars };
}
function rr0(c: Ctx, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y + r); c.arc(x + r, y + r, r, Math.PI, 0); c.lineTo(x + w, y + h); c.closePath(); c.fill(); }

/* ---------- Zeichnen ---------- */
const WEATHER_DARK: Record<string, number> = { clear: 0, rain: .45, storm: .7, fog: .3, snow: .25 };
let fogTile: HTMLCanvasElement | null = null;
function getFog(): HTMLCanvasElement {
  if (fogTile) return fogTile;
  const W = 512, H = 128, c = mkCanvas(W, H), x = ctx2(c), r = mulberry(7731);
  for (let i = 0; i < 26; i++) { const bx = r() * W, by = H * (.3 + r() * .5), rr = 40 + r() * 60; for (const ox of [-W, 0, W]) { const g = x.createRadialGradient(bx + ox, by, 0, bx + ox, by, rr); g.addColorStop(0, 'rgba(176,186,204,.34)'); g.addColorStop(1, 'rgba(176,186,204,0)'); x.save(); x.translate(bx + ox, by); x.scale(1, .5); x.translate(-(bx + ox), -by); x.fillStyle = g; x.fillRect(bx + ox - rr, by - rr, rr * 2, rr * 2); x.restore(); } }
  fogTile = c; return c;
}
const vigCache = new Map<string, HTMLCanvasElement>();
function getVignette(w: number, h: number): HTMLCanvasElement {
  const key = w + 'x' + h; let c = vigCache.get(key); if (c) return c;
  const sw = w, sh = h; c = mkCanvas(sw, sh); const x = ctx2(c);
  const g = x.createRadialGradient(sw / 2, sh * .52, Math.min(sw, sh) * .35, sw / 2, sh / 2, Math.hypot(sw, sh) * .56); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.6, 'rgba(4,6,18,.16)'); g.addColorStop(1, 'rgba(2,3,12,.58)'); x.fillStyle = g; x.fillRect(0, 0, sw, sh);
  if (vigCache.size > 2) vigCache.delete(vigCache.keys().next().value as string); vigCache.set(key, c); return c;
}
const grainCache = new Map<string, HTMLCanvasElement>();
function getGrain(w: number, h: number): HTMLCanvasElement | null {
  const key = w + 'x' + h; let c = grainCache.get(key); if (c) return c;
  try {
    const W = w + 64, H = h + 64; c = mkCanvas(W, H); const x = ctx2(c), im = x.createImageData(W, H), u = new Uint32Array(im.data.buffer), r = mulberry(4242);
    const little = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
    for (let i = 0; i < u.length; i++) { const v = r(), a = (r() * 24) | 0, g = v < .5 ? 0 : 255; u[i] = little ? ((a << 24) | (g << 16) | (g << 8) | g) >>> 0 : ((g << 24) | (g << 16) | (g << 8) | a) >>> 0; }
    x.putImageData(im, 0, 0);
  } catch { return null; }
  if (grainCache.size > 2) grainCache.delete(grainCache.keys().next().value as string); grainCache.set(key, c); return c;
}
function buildWetRefl(Ly: Layers, w: number, h: number, hy: number) {
  const c = mkCanvas(w, h), x = ctx2(c); x.fillStyle = '#fff'; for (const p of Ly.puddles || []) { x.beginPath(); x.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU); x.fill(); }
  x.globalCompositeOperation = 'source-in'; x.save(); x.translate(0, (hy + 34) * 2); x.scale(1, -1); x.drawImage(Ly.lights, 0, 0); if (Ly.neon) x.drawImage(Ly.neon, 0, 0); x.restore(); Ly.wetRefl = c;
}
function drawHolo(ctx: Ctx, h: Holo, t: number, k: number) {
  const fl = (.72 + .28 * Math.sin(t / 95 + h.ph) * Math.sin(t / 330 + h.ph * 2)) * k, bob = Math.sin(t / 900 + h.ph) * 3, x = h.x, y = h.y + bob;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fl;
  ctx.fillStyle = lg(ctx, 0, y, 0, y + h.h, 0, alpha(h.col, .32), 1, alpha(h.col, .06)); ctx.fillRect(x, y, h.w, h.h);
  ctx.strokeStyle = alpha(h.col, .95); ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, h.w - 1, h.h - 1);
  ctx.fillStyle = alpha(h.col, .18); const off = (t / 45) % 4; for (let yy = y + off; yy < y + h.h; yy += 4) ctx.fillRect(x, yy, h.w, 1);
  ctx.fillStyle = alpha('#ffffff', .75); for (let i = 0; i < 4; i++) ctx.fillRect(x + 4, y + 5 + i * 7, (h.w - 8) * (.35 + pr(i + h.ph * 7) * .6), 2);
  glow(ctx, x + h.w / 2, y + h.h / 2, h.w * 1.3, h.col, .4); ctx.restore();
}
function godRays(ctx: Ctx, sx: number, sy: number, w: number, h: number, t: number, a: number, col: string) {
  const n = 9, R = Math.max(w, h) * 1.25; ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(sx, sy, 8, sx, sy, R * .8); g.addColorStop(0, alpha(col, a)); g.addColorStop(.5, alpha(col, a * .45)); g.addColorStop(1, alpha(col, 0)); ctx.fillStyle = g; ctx.beginPath();
  for (let i = 0; i < n; i++) { const wd = .028 + .03 * pr(i + 11), ang = .12 * Math.PI + (i + .5) / n * Math.PI * .76 + Math.sin(t / 5200 + i * 1.7) * .035; ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(ang - wd) * R, sy + Math.sin(ang - wd) * R); ctx.lineTo(sx + Math.cos(ang + wd) * R, sy + Math.sin(ang + wd) * R); ctx.closePath(); }
  ctx.fill(); ctx.restore();
}
export function drawBackground(ctx: Ctx, w: number, h: number, theme: string, dayPhase: number, weather: string, t: number, seed: string) {
  w = Math.round(w); h = Math.round(h); if (w < 2 || h < 2) return;
  const key = `${theme}|${w}|${h}|${seed}`;
  let Ly = cache.get(key);
  if (!Ly) { Ly = build(theme, w, h, seed); cache.set(key, Ly); if (cache.size > 5) cache.delete(cache.keys().next().value as string); }
  const hy = Math.round(h * .5), indoor = INDOOR[theme];
  const ph = ((dayPhase % 1) + 1) % 1;
  const sunH = Math.sin((ph - .25) * TAU), day = smooth(-.12, .3, sunH), night = 1 - day;
  const over = WEATHER_DARK[weather] ?? 0, wet = weather === 'rain' ? .8 : weather === 'storm' ? 1 : 0;
  // Himmel
  let [top, bot] = indoor || skyAt(ph);
  if (!indoor) { const tint = THEME_TINT[theme]; if (tint) { top = mix(top, tint, .12 * day + .05); bot = mix(bot, tint, .22 * day + .08); } if (over) { const gr = (c: string) => { const a = parse(c), l = (a[0] + a[1] + a[2]) / 3 * .8; return rgb(l, l * 1.03, l * 1.08); }; top = mix(top, gr(top), over * 1.1); bot = mix(bot, gr(bot), over * 1.1); } }
  ctx.fillStyle = lg(ctx, 0, 0, 0, hy + 10, 0, top, .55, mix(top, bot, .55), 1, bot); ctx.fillRect(0, 0, w, hy + 12);
  const haze = mix(bot, '#ffffff', indoor ? 0 : .22 * day + .06);
  // Sonne / Mond (Position für Licht + Strahlen)
  const u = (ph - .25) / .5, su = clamp(u, 0, 1), sunOn = !indoor && u >= -.05 && u <= 1.05, sx = w * (.08 + .84 * u), sy = hy - 6 - Math.sin(su) * hy * .8;
  const mp = (ph + .5) % 1, mu = (mp - .25) / .5, moonOn = !indoor && mu >= -.05 && mu <= 1.05, mx = w * (.08 + .84 * mu), my = hy - 6 - Math.sin(clamp(mu, 0, 1) * Math.PI) * hy * .75;
  const warm = 1 - smooth(.1, .4, Math.sin(su * Math.PI));
  if (!indoor || theme === 'void') {
    const sa = indoor ? 1 : clamp(night * 1.3 - .2) * (1 - over * .8);
    if (sa > .02) for (const s of Ly.stars) { const tw = .6 + .4 * Math.sin(t / 600 + s.p); ctx.fillStyle = `rgba(255,255,240,${(sa * tw).toFixed(3)})`; ctx.fillRect(s.x, s.y, s.r, s.r); if (s.r > 1.1 && sa > .3) { ctx.fillStyle = `rgba(200,220,255,${(sa * tw * .25).toFixed(3)})`; ctx.fillRect(s.x - 1, s.y + .2, s.r + 2, .6); } }
    if (theme === 'void') { for (let i = 0; i < 3; i++) { const g = ctx.createRadialGradient(w * (.2 + i * .3), hy * .5, 0, w * (.2 + i * .3), hy * .5, w * .35); g.addColorStop(0, ['rgba(120,40,200,.35)', 'rgba(40,80,200,.25)', 'rgba(200,40,160,.25)'][i]); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, hy + 10); } }
  }
  if (!indoor) {
    if (sunOn) { const sc = mix('#fff6c8', '#ff9a4a', warm), k = 1 - over * .7; ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, sx, sy, 230, sc, .4 * k); glow(ctx, sx, sy, 110, sc, .55 * k); ctx.restore(); ctx.fillStyle = sc; ctx.globalAlpha = 1 - over * .8; ctx.beginPath(); ctx.arc(sx, sy, 22, 0, TAU); ctx.fill(); ctx.fillStyle = '#fffbe8'; ctx.globalAlpha = (1 - over * .8) * .85; ctx.beginPath(); ctx.arc(sx, sy, 16, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    if (moonOn) { const a = (1 - over * .85); ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, mx, my, 120, '#aac4ff', .32 * a); ctx.restore(); ctx.globalAlpha = a; const mg = ctx.createRadialGradient(mx - 4, my - 4, 2, mx, my, 16); mg.addColorStop(0, '#ffffff'); mg.addColorStop(1, '#c8d4f4'); ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 15, 0, TAU); ctx.fill(); ctx.fillStyle = mix(top, '#000', .1); ctx.beginPath(); ctx.arc(mx + 7, my - 3, 13, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(160,175,210,.5)'; ctx.beginPath(); ctx.arc(mx - 5, my + 3, 2.4, 0, TAU); ctx.arc(mx - 8, my - 2, 1.4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    // Wolken (Verlauf + weiche Ränder)
    const cc = mix(mix('#ffffff', '#ff9a78', smooth(.4, .1, Math.abs(sunH)) * (night < .9 ? 1 : 0)), '#232a52', night * .85), cn = theme === 'sky' ? 9 : 6, cr = mulberry(hash(seed + 'c'));
    const cTop = over > .3 ? mix(shade(cc, .1), '#6a7280', over) : shade(cc, .08), cBot = mix(over > .3 ? mix(cc, '#4a5260', over) : cc, bot, .35 + night * .2), ca = (.42 + over * .5) * (theme === 'sky' ? 1.2 : 1);
    for (let i = 0; i < cn + Math.round(over * 6); i++) {
      const sp = 4 + cr() * 6, cx = ((cr() * w + t / 1000 * sp) % (w + 300)) - 150, cy = 20 + cr() * hy * .5, s = .7 + cr() * .9;
      ctx.fillStyle = lg(ctx, 0, cy - 16 * s, 0, cy + 16 * s, 0, cTop, 1, cBot);
      for (let pass = 0; pass < 2; pass++) { ctx.globalAlpha = Math.min(1, ca) * (pass ? 1 : .35); const gr = pass ? 1 : 1.28; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(cx + (k - 2) * 26 * s, cy + Math.sin(k * 2) * 5 * s, 34 * s * gr, 14 * s * gr, 0, 0, TAU); ctx.fill(); } }
      ctx.globalAlpha = 1;
    }
    // Horizont-Dunst hinter der Ferne
    ctx.fillStyle = lg(ctx, 0, hy - 110, 0, hy + 8, 0, alpha(haze, 0), 1, alpha(haze, .3 + over * .2)); ctx.fillRect(0, hy - 110, w, 120);
  }
  // Fern-Ebene (leichte Parallax)
  const px = Math.sin(t / 9000) * 8 - 30;
  ctx.drawImage(Ly.far, px, 0); if (Ly.farD && day > .01) { ctx.globalAlpha = day; ctx.drawImage(Ly.farD, px, 0); ctx.globalAlpha = 1; }
  if (!indoor) { ctx.fillStyle = lg(ctx, 0, hy - 90, 0, hy + 10, 0, alpha(haze, 0), 1, alpha(haze, .2 + over * .2)); ctx.fillRect(0, hy - 90, w, 100); }
  if (theme === 'harbor') { // animiertes Wasser
    ctx.fillStyle = 'rgba(120,190,255,.25)'; for (let i = 0; i < 40; i++) { const x = (i * 97 + t / 40 * (1 + i % 3 * .3)) % (w + 40) - 20, y = hy - 22 + (i * 37 % 26); ctx.fillRect(x, y, 14 + i % 5 * 4, 1.5); }
    if (sunOn && day > .1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = alpha(mix('#fff6c8', '#ff9a4a', warm), .35 * day); for (let i = 0; i < 14; i++) { const y = hy - 20 + i * 1.8, wd = 10 + i * 4 + Math.sin(t / 300 + i) * 6; ctx.fillRect(sx - wd / 2 + Math.sin(t / 500 + i * 2) * 5, y, wd, 1.2); } ctx.restore(); }
  }
  ctx.drawImage(Ly.near, 0, 0); if (Ly.nearD && day > .01) { ctx.globalAlpha = day; ctx.drawImage(Ly.nearD, 0, 0); ctx.globalAlpha = 1; }
  // nasser Boden: Abdunkelung, Pfützen mit Himmelsspiegelung, Ringe
  const la = indoor ? 1 : clamp(night * 1.4 - .1 + over * .25), flick = .92 + .08 * Math.sin(t / 130) * Math.sin(t / 370);
  if (wet > 0 && Ly.puddles && !indoor) {
    ctx.fillStyle = `rgba(8,12,26,${(.2 * wet).toFixed(3)})`; ctx.fillRect(0, hy + 24, w, h - hy - 24);
    const sky1 = mix(bot, '#ffffff', .4 + .25 * day), sky2 = mix(top, '#0a0e1c', .3);
    for (const p of Ly.puddles) { const g = ctx.createLinearGradient(0, p.y - p.ry, 0, p.y + p.ry); g.addColorStop(0, alpha(sky1, .7 * wet)); g.addColorStop(1, alpha(sky2, .75 * wet)); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(255,255,255,${(.14 * wet).toFixed(3)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(p.x, p.y + .5, p.rx, p.ry, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(210,225,255,.5)'; ctx.lineWidth = 1; const np = Math.min(14, Ly.puddles.length);
    for (let i = 0; i < np; i++) { const p = Ly.puddles[i], f = ((t / 1100 + pr(i + 5) * 3) % 1); ctx.globalAlpha = (1 - f) * .6 * wet; ctx.beginPath(); ctx.ellipse(p.x + (pr(i) - .5) * p.rx * .8, p.y, 2 + f * p.rx * .5, (2 + f * p.rx * .5) * .22, 0, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    if (la > .02) { if (!Ly.wetRefl) buildWetRefl(Ly, w, h, hy); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(la * wet * .75); ctx.drawImage(Ly.wetRefl!, 0, 0); ctx.restore(); }
  }
  // Farb-Grading (multiply) + Dämmerung + Bewölkung
  if (!indoor) {
    const dusk = smooth(.5, 0, Math.abs(sunH)) * (1 - night * .5), nk = theme === 'sky' ? .6 : 1;
    const mulCol = mix(mix('#ffffff', '#ffc8a4', dusk * .55), '#5a6cac', night * .72 * nk);
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = lg(ctx, 0, hy - 220, 0, hy - 40, 0, '#ffffff', 1, mulCol); ctx.fillRect(0, hy - 220, w, 180); ctx.fillStyle = mulCol; ctx.fillRect(0, hy - 40, w, h - hy + 40); ctx.restore();
    if (dusk > .02) { ctx.fillStyle = `rgba(255,130,70,${(dusk * .1).toFixed(3)})`; ctx.fillRect(0, hy - 120, w, h - hy + 120); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(sx, hy); ctx.scale(1, .22); ctx.translate(-sx, -hy); glow(ctx, sx, hy, w * .55, '#ff8a4a', dusk * .4 * (1 - over)); ctx.restore(); }
    if (night > .4) { ctx.fillStyle = `rgba(10,18,70,${(night * .12 * nk).toFixed(3)})`; ctx.fillRect(0, hy - 220, w, h - hy + 220); }
    if (over > 0) { ctx.fillStyle = `rgba(30,38,56,${(over * .28).toFixed(3)})`; ctx.fillRect(0, 0, w, h); }
  }
  // Lichter + Neon/Magie + Bloom
  if (la > .02) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = la * (theme === 'dungeon' ? flick : 1); ctx.drawImage(Ly.lights, 0, 0); ctx.restore(); }
  const na = indoor ? 1 : Math.max(la, .38 * day) * (1 - over * .3);
  if (Ly.holos && Ly.holos.length) { const hk = indoor ? 1 : Math.max(la, .45 * day); if (hk > .05) for (const hh of Ly.holos) drawHolo(ctx, hh, t, hk); }
  if (Ly.bloom && (la > .05 || Ly.neon)) { const ba = Ly.neon ? clamp(na * (.9 + .1 * Math.sin(t / 700))) : clamp(la * (theme === 'dungeon' ? flick : 1) * .8); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ba; ctx.drawImage(Ly.bloom, 0, 0); ctx.restore(); }
  // Volumetrik: Lichtstrahlen & Bodennebel
  if (!indoor) {
    const gr = day * (1 - over) * (.012 + .17 * warm * warm);
    if (sunOn && gr > .02) godRays(ctx, sx, sy, w, h, t, gr, mix('#fff2c0', '#ffa860', warm));
    else if (moonOn && night > .5 && over < .5) godRays(ctx, mx, my, w, h, t, night * (1 - over * 2) * .05, '#a8c0ff');
  }
  const fogA = (weather === 'fog' ? .5 : 0) + (({ moor: .22, forest: .14, harbor: .12, ruins: .12, crater: .1 } as Record<string, number>)[theme] ?? 0);
  if (fogA > .01 && !indoor) {
    const ft = getFog(), th = h * .3, tw = ft.width * th / ft.height, tone = .4 + .6 * day;
    ctx.save(); for (let l = 0; l < 2; l++) { const off = (t / (l ? 38 : 70)) % tw; ctx.globalAlpha = clamp(fogA * (l ? 1 : .6) * tone); for (let x = -off - (l ? tw * .3 : 0); x < w; x += tw) ctx.drawImage(ft, x, hy - 14 + l * h * .17, tw, th); } ctx.restore();
  }
  // Animierte Extras
  if (theme === 'crystal' || theme === 'void') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 18; i++) { const x = pr(i + 1) * w, y = (pr(i + 50) * h - t / 40 * (.4 + pr(i + 9))) % h; const yy = y < 0 ? y + h : y; const c0 = theme === 'void' ? '#c878ff' : '#96e6ff'; glow(ctx, x, yy, 6, c0, .5); ctx.fillStyle = alpha(c0, .9); ctx.fillRect(x, yy, 2, 2); } ctx.restore(); }
  if (theme === 'moor' || theme === 'forest') { for (let i = 0; i < 10; i++) { const x = pr(i + 3) * w + Math.sin(t / 1500 + i) * 20, y = hy + 20 + pr(i + 30) * (h - hy - 40) + Math.cos(t / 1100 + i) * 12; ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 9, theme === 'moor' ? '#8affc0' : '#d8ff7a', .55 + .4 * Math.sin(t / 400 + i)); ctx.restore(); } }
  if (theme === 'ruins' || theme === 'junkyard' || theme === 'crater') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 12; i++) { const x = (pr(i + 5) * w + Math.sin(t / 900 + i) * 10), y = h - ((t / 25 * (.5 + pr(i)) + pr(i + 20) * h) % (h * .6)); glow(ctx, x, y, 5, '#ff7a2a', .5); ctx.fillStyle = `rgba(255,${120 + i * 6},50,.8)`; ctx.fillRect(x, y, 2, 2); } ctx.restore(); }
  // Vignette + Filmkorn
  ctx.drawImage(getVignette(w, h), 0, 0);
  const gc = getGrain(w, h);
  if (gc) { const f = Math.floor(t / 70), ox = (pr(f) * 64) | 0, oy = (pr(f + 99) * 64) | 0; ctx.globalAlpha = indoor ? .8 : .55 + night * .15; ctx.drawImage(gc, -ox, -oy); ctx.globalAlpha = 1; }
  // Beleuchtungs-Hook für Figuren
  if (indoor) { const c0 = theme === 'dungeon' ? '#ffae5a' : theme === 'crystal' ? '#a98aff' : '#b060ff'; setLighting({ color: c0, intensity: (theme === 'dungeon' ? .55 * flick : .5), x: -.4, ambient: c0, ambientA: .06 }); }
  else {
    const sunCol = mix('#fff1d0', '#ff9a56', warm), moonCol = '#9ab8ff', k = 1 - over * .7, sInt = (.32 + .45 * warm) * k, mInt = .4 * (1 - over * .6);
    const lx = day > .5 ? (sunOn ? (sx / w - .5) * 2.4 : -.5) : (moonOn ? (mx / w - .5) * 2.4 : .4), dusk2 = smooth(.5, 0, Math.abs(sunH));
    const amb = mix(mix('#000000', '#2a3a8a', 1), '#ff7a40', dusk2 * (1 - night)), ambA = clamp(night * .22 + dusk2 * .08 + over * .1);
    setLighting({ color: mix(moonCol, sunCol, day), intensity: lerp(mInt, sInt, day), x: Math.abs(lx) < .3 ? (lx < 0 ? -.3 : .3) : clamp(lx, -1, 1), ambient: amb, ambientA: ambA });
  }
}

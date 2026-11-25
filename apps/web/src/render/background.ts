import { Ctx, TAU, clamp, lerp, smooth, hash, mulberry, mix, shade, alpha, rgb, parse, mkCanvas, ctx2, glow, lg, poly, pr } from './util';

type Rnd = () => number;
interface Layers { far: HTMLCanvasElement; near: HTMLCanvasElement; lights: HTMLCanvasElement; farD?: HTMLCanvasElement; nearD?: HTMLCanvasElement; stars: { x: number; y: number; r: number; p: number }[] }
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
  const sx = 9, sy = 13;
  for (let yy = y + 8; yy < y + h - 8; yy += sy) for (let xx = x + 5; xx < x + w - 8; xx += sx) {
    c.fillStyle = glass; c.fillRect(xx, yy, 5, 7);
    if (rnd() < lit) { const hue = rnd(); L.fillStyle = hue < .7 ? 'rgba(255,214,120,.85)' : hue < .85 ? 'rgba(120,220,255,.8)' : 'rgba(255,120,200,.75)'; L.fillRect(xx, yy, 5, 7); }
  }
}
function tower(c: Ctx, L: Ctx, x: number, base: number, w: number, h: number, col: string, rnd: Rnd, o: { lit?: number; neon?: string; roof?: number } = {}) {
  c.fillStyle = lg(c, x, 0, x + w, 0, 0, shade(col, .12), .6, col, 1, shade(col, -.25)); c.fillRect(x, base - h, w, h);
  c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x, base - h, 2, h);
  windows(c, L, x, base - h, w, h, rnd, o.lit ?? .4, shade(col, .18));
  const rf = o.roof ?? (rnd() * 4 | 0);
  c.fillStyle = shade(col, -.3);
  if (rf === 0) { c.fillRect(x + w / 2 - 1, base - h - 18, 2, 18); L.fillStyle = 'rgba(255,60,60,.9)'; L.fillRect(x + w / 2 - 1.5, base - h - 20, 3, 3); }
  else if (rf === 1) c.fillRect(x + 4, base - h - 8, w * .4, 8);
  else if (rf === 2) poly(c, [x, base - h, x + w / 2, base - h - w * .35, x + w, base - h], shade(col, -.2));
  if (o.neon) { const ny = base - h + 10 + rnd() * h * .5; L.fillStyle = o.neon; L.fillRect(x + w - 3, ny, 2.5, 22 + rnd() * 18); glow(L, x + w - 2, ny + 14, 22, o.neon, .5); }
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
function lamp(c: Ctx, L: Ctx, x: number, base: number, h: number, col = 'rgba(255,220,150,1)') {
  c.fillStyle = '#1c2030'; c.fillRect(x - 1.5, base - h, 3, h); c.fillRect(x - 5, base - h - 2, 10, 4);
  glow(L, x, base - h + 3, 38, col, .55); L.fillStyle = col; L.beginPath(); L.arc(x, base - h + 2, 3, 0, TAU); L.fill();
}
function awning(c: Ctx, L: Ctx, x: number, base: number, w: number, h: number, c1: string, c2: string, lit: boolean) {
  c.fillStyle = '#2a2018'; c.fillRect(x + 3, base - h, 3, h); c.fillRect(x + w - 6, base - h, 3, h);
  const n = 6, sw = w / n; for (let i = 0; i < n; i++) poly(c, [x + i * sw, base - h, x + (i + 1) * sw, base - h, x + (i + 1) * sw + 2, base - h + 14, x + i * sw - 2, base - h + 14], i % 2 ? c1 : c2, 'rgba(0,0,0,.4)', 1);
  c.fillStyle = '#3a2a1c'; c.fillRect(x + 4, base - h * .35, w - 8, h * .35);
  c.fillStyle = shade('#3a2a1c', .25); c.fillRect(x + 4, base - h * .35, w - 8, 3);
  if (lit) { glow(L, x + w / 2, base - h + 18, w * .6, '#ffd890', .4); }
}
function ground(c: Ctx, w: number, h: number, y0: number, top: string, bot: string, o: { lines?: string; grid?: number; speck?: string; rnd: Rnd; curb?: string; band?: string }) {
  c.fillStyle = lg(c, 0, y0, 0, h, 0, top, 1, bot); c.fillRect(0, y0, w, h - y0);
  const rnd = o.rnd;
  if (o.lines) {
    c.strokeStyle = o.lines; c.lineWidth = 1; const n = 9;
    for (let i = 1; i <= n; i++) { const yy = y0 + (h - y0) * Math.pow(i / n, 1.8); c.globalAlpha = .25 + i / n * .5; c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.stroke(); }
    const g = o.grid ?? 14; for (let i = -g; i <= g * 2; i++) { const xx = w * i / g; c.globalAlpha = .35; c.beginPath(); c.moveTo(w / 2 + (xx - w / 2) * .55, y0); c.lineTo(w / 2 + (xx - w / 2) * 1.5, h); c.stroke(); }
    c.globalAlpha = 1;
  }
  if (o.speck) { c.fillStyle = o.speck; for (let i = 0; i < w * (h - y0) / 900; i++) { const yy = y0 + rnd() * (h - y0), s = 1 + (yy - y0) / (h - y0) * 3; c.globalAlpha = .1 + rnd() * .25; c.fillRect(rnd() * w, yy, s * 1.6, s); } c.globalAlpha = 1; }
  if (o.band) { c.fillStyle = o.band; c.fillRect(0, y0, w, 4); }
  c.fillStyle = o.curb || 'rgba(0,0,0,.35)'; c.fillRect(0, y0, w, 3);
  const sh = c.createLinearGradient(0, y0, 0, y0 + 26); sh.addColorStop(0, 'rgba(0,0,0,.4)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sh; c.fillRect(0, y0, w, 26);
}

/* ---------- Szenen je Theme ---------- */
function build(theme: string, w: number, h: number, seed: string): Layers { return finish(build0(theme, w, h, seed), theme, w, h); }
function finish(L: Layers, theme: string, w: number, h: number): Layers {
  const hy = Math.round(h * .5), n = ctx2(L.near); let px = [40, 40, 44];
  try { const d = n.getImageData(3, h - 3, 1, 1).data; px = [d[0], d[1], d[2]]; } catch { /* */ }
  n.save(); n.globalCompositeOperation = 'destination-over'; n.fillStyle = lg(n, 0, hy, 0, h, 0, rgb(px[0] * .75, px[1] * .75, px[2] * .75), 1, rgb(px[0], px[1], px[2])); n.fillRect(0, hy - 2, w, h - hy + 2); n.restore();
  if (!INDOOR[theme]) {
    const dark = ['ruins', 'moor', 'crater', 'industrial'].includes(theme);
    const mk = (src: HTMLCanvasElement, a: number, col: string) => { const c = mkCanvas(src.width, src.height), x = ctx2(c); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = a; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return c; };
    L.farD = mk(L.far, dark ? .3 : .55, '#b4cdf0'); L.nearD = mk(L.near, dark ? .1 : .28, '#ffeccc');
  }
  return L;
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
    for (let x = 10; x < w; x += 70 + rnd() * 80) { const bh = 70 + rnd() * 70, bw = 44 + rnd() * 30; tower(n, L, x, hy + 18, bw, bh, '#1c2440', rnd, { lit: .5, neon: rnd() < .5 ? '#35e0ff' : '#ff3df0' }); }
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
export function drawBackground(ctx: Ctx, w: number, h: number, theme: string, dayPhase: number, weather: string, t: number, seed: string) {
  w = Math.round(w); h = Math.round(h); if (w < 2 || h < 2) return;
  const key = `${theme}|${w}|${h}|${seed}`;
  let Ly = cache.get(key);
  if (!Ly) { Ly = build(theme, w, h, seed); cache.set(key, Ly); if (cache.size > 5) cache.delete(cache.keys().next().value as string); }
  const hy = Math.round(h * .5), indoor = INDOOR[theme];
  const ph = ((dayPhase % 1) + 1) % 1;
  const sunH = Math.sin((ph - .25) * TAU), day = smooth(-.12, .3, sunH), night = 1 - day;
  const over = WEATHER_DARK[weather] ?? 0;
  // Himmel
  let [top, bot] = indoor || skyAt(ph);
  if (!indoor) { const tint = THEME_TINT[theme]; if (tint) { top = mix(top, tint, .12 * day + .05); bot = mix(bot, tint, .22 * day + .08); } if (over) { const gr = (c: string) => { const a = parse(c), l = (a[0] + a[1] + a[2]) / 3 * .8; return rgb(l, l * 1.03, l * 1.08); }; top = mix(top, gr(top), over * 1.1); bot = mix(bot, gr(bot), over * 1.1); } }
  ctx.fillStyle = lg(ctx, 0, 0, 0, hy + 10, 0, top, 1, bot); ctx.fillRect(0, 0, w, hy + 12);
  if (!indoor || theme === 'void') {
    // Sterne
    const sa = indoor ? 1 : clamp(night * 1.3 - .2) * (1 - over * .8);
    if (sa > .02) for (const s of Ly.stars) { const tw = .6 + .4 * Math.sin(t / 600 + s.p); ctx.fillStyle = `rgba(255,255,240,${(sa * tw).toFixed(3)})`; ctx.fillRect(s.x, s.y, s.r, s.r); }
    if (theme === 'void') { for (let i = 0; i < 3; i++) { const g = ctx.createRadialGradient(w * (.2 + i * .3), hy * .5, 0, w * (.2 + i * .3), hy * .5, w * .35); g.addColorStop(0, ['rgba(120,40,200,.35)', 'rgba(40,80,200,.25)', 'rgba(200,40,160,.25)'][i]); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, hy + 10); } }
  }
  if (!indoor) {
    // Sonne & Mond
    const u = (ph - .25) / .5; // 0..1 über den Tag
    if (u >= -.05 && u <= 1.05) { const sx = w * (.08 + .84 * u), sy = hy - 6 - Math.sin(clamp(u, 0, 1) * Math.PI) * hy * .8, warm = 1 - smooth(.1, .4, Math.sin(clamp(u, 0, 1) * Math.PI)); const sc = mix('#fff6c8', '#ff9a4a', warm); glow(ctx, sx, sy, 150, sc, .55 * (1 - over * .7)); ctx.fillStyle = sc; ctx.globalAlpha = 1 - over * .8; ctx.beginPath(); ctx.arc(sx, sy, 22, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    const mp = (ph + .5) % 1, mu = (mp - .25) / .5;
    if (mu >= -.05 && mu <= 1.05) { const mx = w * (.08 + .84 * mu), my = hy - 6 - Math.sin(clamp(mu, 0, 1) * Math.PI) * hy * .75; const a = (1 - over * .85); glow(ctx, mx, my, 90, '#aac4ff', .35 * a); ctx.globalAlpha = a; ctx.fillStyle = '#e8eeff'; ctx.beginPath(); ctx.arc(mx, my, 15, 0, TAU); ctx.fill(); ctx.fillStyle = indoor ? '#000' : mix(top, '#000', .1); ctx.beginPath(); ctx.arc(mx + 7, my - 3, 13, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(160,175,210,.5)'; ctx.beginPath(); ctx.arc(mx - 5, my + 3, 2.4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    // Wolken
    const cc = mix(mix('#ffffff', '#ff9a78', smooth(.4, .1, Math.abs(sunH)) * (night < .9 ? 1 : 0)), '#232a52', night * .85);
    const cn = theme === 'sky' ? 9 : 6, cr = mulberry(hash(seed + 'c'));
    ctx.fillStyle = alpha(over > .3 ? mix(cc, '#4a5260', over) : cc, (.4 + over * .5) * (theme === 'sky' ? 1.2 : 1));
    for (let i = 0; i < cn + Math.round(over * 6); i++) {
      const sp = 4 + cr() * 6, cx = ((cr() * w + t / 1000 * sp) % (w + 300)) - 150, cy = 20 + cr() * hy * .5, s = .7 + cr() * .9;
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(cx + (k - 2) * 26 * s, cy + Math.sin(k * 2) * 5 * s, 34 * s, 14 * s, 0, 0, TAU); ctx.fill(); }
    }
  }
  // Fern-Ebene (leichte Parallax)
  const px = Math.sin(t / 9000) * 8 - 30;
  ctx.drawImage(Ly.far, px, 0); if (Ly.farD && day > .01) { ctx.globalAlpha = day; ctx.drawImage(Ly.farD, px, 0); ctx.globalAlpha = 1; }
  if (theme === 'harbor') { // animiertes Wasser
    ctx.fillStyle = 'rgba(120,190,255,.25)'; for (let i = 0; i < 40; i++) { const x = (i * 97 + t / 40 * (1 + i % 3 * .3)) % (w + 40) - 20, y = hy - 22 + (i * 37 % 26); ctx.fillRect(x, y, 14 + i % 5 * 4, 1.5); }
  }
  ctx.drawImage(Ly.near, 0, 0); if (Ly.nearD && day > .01) { ctx.globalAlpha = day; ctx.drawImage(Ly.nearD, 0, 0); ctx.globalAlpha = 1; }
  // Tageslicht-Overlay
  if (!indoor) {
    const nightA = night * .42 * (theme === 'sky' ? .6 : 1), dusk = smooth(.5, 0, Math.abs(sunH)) * (1 - night * .5);
    if (dusk > .02) { ctx.fillStyle = `rgba(255,130,70,${(dusk * .16).toFixed(3)})`; ctx.fillRect(0, hy - 120, w, h - hy + 120); }
    if (nightA > .01) { ctx.fillStyle = `rgba(6,10,44,${nightA.toFixed(3)})`; ctx.fillRect(0, hy - 220, w, h - hy + 220); }
    if (over > 0) { ctx.fillStyle = `rgba(30,38,56,${(over * .35).toFixed(3)})`; ctx.fillRect(0, 0, w, h); }
  }
  // Lichter (nachts / in Höhlen)
  const la = indoor ? 1 : clamp(night * 1.4 - .1 + over * .25), flick = .92 + .08 * Math.sin(t / 130) * Math.sin(t / 370);
  if (la > .02) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = la * (theme === 'dungeon' ? flick : 1); ctx.drawImage(Ly.lights, 0, 0); ctx.restore(); }
  // Animierte Extras
  if (theme === 'crystal' || theme === 'void') { for (let i = 0; i < 18; i++) { const x = pr(i + 1) * w, y = (pr(i + 50) * h - t / 40 * (.4 + pr(i + 9))) % h; const yy = y < 0 ? y + h : y; ctx.fillStyle = theme === 'void' ? 'rgba(200,120,255,.6)' : 'rgba(150,230,255,.6)'; ctx.fillRect(x, yy, 2, 2); } }
  if (theme === 'moor' || theme === 'forest') { for (let i = 0; i < 10; i++) { const x = pr(i + 3) * w + Math.sin(t / 1500 + i) * 20, y = hy + 20 + pr(i + 30) * (h - hy - 40) + Math.cos(t / 1100 + i) * 12; glow(ctx, x, y, 7, theme === 'moor' ? '#8affc0' : '#d8ff7a', .5 + .4 * Math.sin(t / 400 + i)); } }
  if (theme === 'ruins' || theme === 'junkyard' || theme === 'crater') { for (let i = 0; i < 12; i++) { const x = (pr(i + 5) * w + Math.sin(t / 900 + i) * 10), y = h - ((t / 25 * (.5 + pr(i)) + pr(i + 20) * h) % (h * .6)); ctx.fillStyle = `rgba(255,${120 + i * 6},50,.7)`; ctx.fillRect(x, y, 2, 2); } }
}

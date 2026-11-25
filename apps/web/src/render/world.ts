import { Ctx, TAU, blob, poly, glow, shade, mix, alpha, lg, clamp, gray, rr, pr, star } from './util';

const sin = Math.sin, cos = Math.cos;
/* ---------- Ressourcenpunkte ---------- */
export function drawNode(ctx: Ctx, x: number, y: number, scale: number, kind: 'vein' | 'herb' | 'tree' | 'crate', color: string, ready: boolean, t: number, hp: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const col = ready ? color : gray(color, .85, .55);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 1, 26, 7, 0, 0, TAU); ctx.fill();
  const shake = hp < 1 && ready ? sin(t / 40) * 1.2 : 0; ctx.translate(shake, 0);
  if (kind === 'vein') {
    const rock = ready ? '#5a5f6c' : '#3a3d44';
    poly(ctx, [-24, 0, -20, -20, -8, -32, 8, -30, 22, -18, 26, 0], lg(ctx, 0, -32, 0, 0, 0, shade(rock, .25), 1, shade(rock, -.4)), shade(rock, -.7), 1.5);
    poly(ctx, [-8, -32, 8, -30, 2, -18, -6, -20], 'rgba(255,255,255,.08)');
    const cr: [number, number, number, number][] = [[-14, -14, -.4, 16], [4, -22, .15, 20], [14, -10, .5, 14], [-2, -8, -.1, 11]];
    for (const [cx, cy, rot, h] of cr) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); poly(ctx, [-4, 0, -2.5, -h * .8, 0, -h, 2.5, -h * .8, 4, 0], lg(ctx, -4, 0, 4, 0, 0, shade(col, .5), .5, col, 1, shade(col, -.45)), shade(col, -.7), 1); ctx.restore(); if (ready) glow(ctx, cx, cy - h * .4, 12, color, .35 + .2 * sin(t / 400 + cx)); }
  } else if (kind === 'herb') {
    const leaf = ready ? '#3a8a40' : '#4a504a';
    for (let i = 0; i < 7; i++) { const a = -1.3 + i * .43, l = 20 + pr(i) * 10, sw = sin(t / 700 + i) * 2; ctx.strokeStyle = shade(leaf, i % 2 ? -.1 : .1); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(cos(a - Math.PI / 2) * l * .5 + sw, -l * .7, cos(a - Math.PI / 2) * l + sw * 2, -l * .9 - 4); ctx.stroke(); }
    for (let i = 0; i < 5; i++) { const fx = -14 + i * 7, fy = -16 - pr(i + 3) * 14, s = sin(t / 600 + i) * 1.2; ctx.strokeStyle = leaf; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(fx * .4, 0); ctx.lineTo(fx + s, fy); ctx.stroke(); if (ready) glow(ctx, fx + s, fy, 9, color, .45); blob(ctx, fx + s, fy, 4, 4, col); ctx.fillStyle = ready ? '#fff6c0' : '#777'; ctx.beginPath(); ctx.arc(fx + s, fy, 1.3, 0, TAU); ctx.fill(); }
  } else if (kind === 'tree') {
    const trunk = ready ? mix(color, '#3a2a1c', .4) : '#3e3a36', leaf = ready ? '#2f7a3f' : '#454a46';
    ctx.fillStyle = lg(ctx, -7, 0, 7, 0, 0, shade(trunk, .2), 1, shade(trunk, -.4)); ctx.beginPath(); ctx.moveTo(-9, 0); ctx.quadraticCurveTo(-5, -22, -4, -48); ctx.lineTo(4, -48); ctx.quadraticCurveTo(6, -22, 10, 0); ctx.fill(); ctx.strokeStyle = shade(trunk, -.7); ctx.lineWidth = 1.4; ctx.stroke();
    const sw = sin(t / 900) * 1.5; for (const [dx, dy, r] of [[-14, -58, 16], [14, -56, 16], [0, -74, 20], [-4, -60, 18]] as number[][]) blob(ctx, dx + sw, dy, r, r * .9, leaf);
    if (ready) { ctx.fillStyle = alpha(color, .9); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-12 + i * 8 + sw, -60 - (i % 2) * 10, 1.8, 0, TAU); ctx.fill(); } }
  } else {
    const wood = ready ? '#8a6a42' : '#4a4640';
    ctx.fillStyle = lg(ctx, -20, -34, 20, 0, 0, shade(wood, .2), 1, shade(wood, -.4)); ctx.beginPath(); ctx.roundRect(-20, -32, 40, 32, 3); ctx.fill(); ctx.strokeStyle = shade(wood, -.75); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = shade(wood, -.5); ctx.lineWidth = 1.2; for (const yy of [-22, -11]) { ctx.beginPath(); ctx.moveTo(-20, yy); ctx.lineTo(20, yy); ctx.stroke(); }
    ctx.fillStyle = ready ? col : '#555'; ctx.fillRect(-20, -32, 5, 32); ctx.fillRect(15, -32, 5, 32); ctx.fillStyle = ready ? '#d0d6e0' : '#666'; ctx.fillRect(-4, -20, 8, 7);
    if (ready) { glow(ctx, 0, -34, 22, color, .5 + .2 * sin(t / 300)); ctx.fillStyle = '#fff'; star(ctx, 14, -38 + sin(t / 250) * 2, 3, 4); ctx.fill(); }
  }
  if (ready) { const p = (t / 1200) % 1; ctx.fillStyle = `rgba(255,255,255,${(1 - p) * .8})`; star(ctx, -16 + (kind === 'tree' ? 0 : 6), -26 - p * 10, 2.4, 4); ctx.fill(); }
  ctx.translate(-shake, 0);
  if (ready && hp < 1) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(-18, 6, 36, 5); ctx.fillStyle = '#ffd23a'; ctx.fillRect(-17, 7, 34 * clamp(hp), 3); }
  ctx.restore();
}

/* ---------- Hotspots ---------- */
type HDraw = (c: Ctx, t: number, hv: boolean, col: string) => [number, number]; // zeichnet mit Ursprung unten-mittig, gibt [w,h] zurück
const win = (c: Ctx, x: number, y: number, w: number, h: number, lit = true, col = '#ffd890') => { c.fillStyle = lit ? col : '#10131c'; c.fillRect(x, y, w, h); if (lit) glow(c, x + w / 2, y + h / 2, w * 1.5, col, .25); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1; c.strokeRect(x, y, w, h); };
const wall = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = lg(c, x, y, x + w, y, 0, shade(col, .18), .5, col, 1, shade(col, -.3)); c.fillRect(x, y, w, h); c.strokeStyle = shade(col, -.75); c.lineWidth = 1.5; c.strokeRect(x, y, w, h); };
const roof = (c: Ctx, x: number, y: number, w: number, h: number, col: string) => poly(c, [x - 6, y, x + w / 2, y - h, x + w + 6, y], lg(c, 0, y - h, 0, y, 0, shade(col, .15), 1, shade(col, -.3)), shade(col, -.75), 1.5);
const door = (c: Ctx, x: number, y: number, w: number, h: number, col = '#4a3020') => { c.fillStyle = col; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - h + w / 2); c.arc(x + w / 2, y - h + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w, y); c.fill(); c.strokeStyle = shade(col, -.7); c.lineWidth = 1.2; c.stroke(); c.fillStyle = '#e8c860'; c.beginPath(); c.arc(x + w * .78, y - h * .42, 1.4, 0, TAU); c.fill(); };
const sign = (c: Ctx, x: number, y: number, w: number, h: number, txt: string, col: string, t: number, neon = false) => {
  if (neon) { glow(c, x, y, w * .9, col, .45 + .15 * sin(t / 200)); } c.fillStyle = '#0c0e16'; rr(c, x - w / 2, y - h / 2, w, h, 4); c.fill(); c.strokeStyle = col; c.lineWidth = 1.6; rr(c, x - w / 2, y - h / 2, w, h, 4); c.stroke();
  c.fillStyle = col; c.font = `bold ${Math.round(h * .55)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x, y + 1); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
};
const awn = (c: Ctx, x: number, y: number, w: number, c1: string, c2: string, n = 6) => { const sw = w / n; for (let i = 0; i < n; i++) { poly(c, [x + i * sw, y, x + (i + 1) * sw, y, x + (i + 1) * sw + 2, y + 13, x + i * sw - 2, y + 13], i % 2 ? c1 : c2, 'rgba(0,0,0,.4)', 1); c.fillStyle = i % 2 ? c1 : c2; c.beginPath(); c.arc(x + (i + .5) * sw, y + 13, sw / 2, 0, Math.PI); c.fill(); } };
const stall = (c: Ctx, t: number, x: number, w: number, c1: string, c2: string, goods: string) => {
  c.fillStyle = '#3a2a1c'; c.fillRect(x + 4, -62, 4, 62); c.fillRect(x + w - 8, -62, 4, 62); wall(c, x + 6, -26, w - 12, 26, '#6a4a2a'); c.fillStyle = '#8a6a42'; c.fillRect(x + 2, -28, w - 4, 4);
  awn(c, x, -70, w, c1, c2); for (let i = 0; i < 4; i++) { blob(c, x + 14 + i * ((w - 28) / 3), -34, 6, 6, i % 2 ? goods : shade(goods, .25)); }
  glow(c, x + w / 2, -56, w * .5, '#ffd890', .22); void t;
};
const person: HDraw = (c, t, hv, col) => {
  const b = sin(t / 600) * 1, cc = col || '#7a8cff'; glow(c, 0, -40, 40, cc, hv ? .5 : .22);
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(0, 1, 16, 5, 0, 0, TAU); c.fill();
  c.fillStyle = lg(c, 0, -52, 0, 0, 0, shade(cc, .15), 1, shade(cc, -.55)); c.beginPath(); c.moveTo(-9, -50 + b); c.quadraticCurveTo(-18, -22, -15, 0); c.lineTo(15, 0); c.quadraticCurveTo(18, -22, 9, -50 + b); c.closePath(); c.fill(); c.strokeStyle = shade(cc, -.75); c.lineWidth = 1.4; c.stroke();
  c.fillStyle = lg(c, -10, -76, 10, -54, 0, shade(cc, .3), 1, shade(cc, -.5)); c.beginPath(); c.arc(0, -62 + b, 12, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = 'rgba(8,10,20,.75)'; c.beginPath(); c.ellipse(2, -62 + b, 8, 8, 0, 0, TAU); c.fill(); eyeP(c, 0, -63 + b, cc); eyeP(c, 6, -63 + b, cc);
  return [34, 80];
};
const eyeP = (c: Ctx, x: number, y: number, col: string) => { c.fillStyle = shade(col, .7); c.beginPath(); c.arc(x, y, 1.5, 0, TAU); c.fill(); };
const H: Record<string, HDraw> = {
  person,
  board: (c, t, hv, col) => {
    c.fillStyle = '#3a2a1c'; c.fillRect(-36, -70, 6, 70); c.fillRect(30, -70, 6, 70); wall(c, -42, -92, 84, 52, '#7a5a38');
    c.fillStyle = '#d8c8a0'; for (const [x, y, w, h, r] of [[-36, -86, 22, 20, -.05], [-10, -88, 20, 24, .04], [14, -84, 22, 18, -.03], [-30, -62, 26, 16, .03], [4, -60, 30, 17, -.04]] as number[][]) { c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(r); c.fillRect(-w / 2, -h / 2, w, h); c.fillStyle = '#6a5a3a'; for (let i = 0; i < 3; i++) c.fillRect(-w / 2 + 3, -h / 2 + 4 + i * 4, w - 6, 1.2); c.fillStyle = '#d04a4a'; c.beginPath(); c.arc(0, -h / 2 + 1.5, 1.6, 0, TAU); c.fill(); c.fillStyle = '#d8c8a0'; c.restore(); }
    c.fillStyle = '#ffd23a'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.fillText('!', 0, -96 + sin(t / 300) * 3); c.textAlign = 'left'; glow(c, 0, -66, 60, '#ffd890', hv ? .35 : .15); return [90, 100];
  },
  portal: (c, t, hv, col) => {
    const cc = col || '#35e0ff', cy = -46; glow(c, 0, cy, 90, cc, .5 + (hv ? .2 : 0));
    c.fillStyle = '#10141e'; c.beginPath(); c.ellipse(0, cy, 40, 52, 0, 0, TAU); c.fill();
    for (let i = 0; i < 4; i++) { c.strokeStyle = alpha(shade(cc, i * .12), .8 - i * .15); c.lineWidth = 3 - i * .5; c.beginPath(); c.ellipse(0, cy, 32 - i * 6, 44 - i * 8, t / 900 * (i % 2 ? -1 : 1) + i, 0, TAU * .7); c.stroke(); }
    const g = c.createRadialGradient(0, cy, 2, 0, cy, 36); g.addColorStop(0, '#fff'); g.addColorStop(.3, cc); g.addColorStop(1, alpha(cc, 0)); c.fillStyle = g; c.globalAlpha = .7; c.beginPath(); c.ellipse(0, cy, 28, 40, 0, 0, TAU); c.fill(); c.globalAlpha = 1;
    c.strokeStyle = '#6a7284'; c.lineWidth = 7; c.beginPath(); c.ellipse(0, cy, 42, 54, 0, 0, TAU); c.stroke(); c.strokeStyle = '#aab4c8'; c.lineWidth = 2; c.stroke();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; c.fillStyle = cc; c.fillRect(cos(a) * 42 - 2, cy + sin(a) * 54 - 2, 4, 4); }
    c.fillStyle = '#3a4252'; c.fillRect(-30, -2, 60, 6); return [90, 110];
  },
  bank: (c, t, hv) => {
    wall(c, -64, -80, 128, 80, '#c8c2b4'); poly(c, [-72, -80, 0, -112, 72, -80], '#a8a294', '#4a463c', 1.5); c.fillStyle = '#e0dac8'; for (let i = 0; i < 5; i++) { c.fillRect(-56 + i * 24, -78, 10, 70); c.strokeStyle = '#6a6658'; c.lineWidth = 1; c.strokeRect(-56 + i * 24, -78, 10, 70); }
    c.fillStyle = '#c0b8a0'; c.fillRect(-70, -6, 140, 6); c.fillRect(-66, -12, 132, 6);
    c.fillStyle = '#2a2a34'; c.beginPath(); c.arc(0, -34, 20, 0, TAU); c.fill(); c.fillStyle = lg(c, -16, -50, 16, -18, 0, '#e8d890', 1, '#8a7a30'); c.beginPath(); c.arc(0, -34, 16, 0, TAU); c.fill(); c.strokeStyle = '#3a3010'; c.lineWidth = 1.5; c.stroke(); c.fillStyle = '#5a4a10'; c.fillRect(-1, -48, 2, 28); c.fillRect(-14, -35, 28, 2); c.beginPath(); c.arc(0, -34, 4, 0, TAU); c.fill();
    sign(c, 0, -96, 60, 14, 'BANK', '#ffd23a', t, true); return [150, 118];
  },
  guildhall: (c, t, hv) => {
    wall(c, -70, -88, 140, 88, '#4a4a68'); for (const s of [-1, 1]) { wall(c, s * 58 - 14, -128, 28, 128, '#3e3e5a'); poly(c, [s * 58 - 20, -128, s * 58, -160, s * 58 + 20, -128], '#2a2a44', '#111', 1.5); win(c, s * 58 - 4, -108, 8, 20, true); }
    poly(c, [-78, -88, 0, -126, 78, -88], '#2a2a44', '#111', 1.5); for (const x of [-34, 34]) { poly(c, [x - 8, -84, x + 8, -84, x + 8, -52, x, -60, x - 8, -52], '#a02a3a', '#300', 1); } door(c, -14, 0, 28, 44, '#3a2a1c'); glow(c, 0, -22, 40, '#ffb04a', .4); win(c, -44, -64, 10, 18); win(c, 34, -64, 10, 18); 
    c.fillStyle = '#ffd23a'; star(c, 0, -104, 6, 5); c.fill(); glow(c, 0, -104, 30, '#ffd23a', .4 + .15 * sin(t / 300)); return [160, 164];
  },
  fountain: (c, t, hv) => {
    c.fillStyle = lg(c, 0, -22, 0, 0, 0, '#9aa4b4', 1, '#4a5262'); c.beginPath(); c.ellipse(0, -8, 52, 16, 0, 0, TAU); c.fill(); c.strokeStyle = '#2a303c'; c.lineWidth = 1.5; c.stroke(); c.fillStyle = '#3a8ac8'; c.beginPath(); c.ellipse(0, -10, 44, 11, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(0, -10, 30 + sin(t / 400) * 3, 7, 0, 0, TAU); c.stroke();
    c.fillStyle = '#aab2c2'; c.fillRect(-6, -52, 12, 44); c.beginPath(); c.ellipse(0, -52, 22, 6, 0, 0, TAU); c.fill(); c.strokeStyle = '#2a303c'; c.stroke();
    c.strokeStyle = 'rgba(190,230,255,.85)'; c.lineWidth = 2; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(0, -60); c.quadraticCurveTo(i * 8, -78 + Math.abs(i) * 4 + sin(t / 150 + i) * 2, i * 13, -28); c.stroke(); }
    glow(c, 0, -60, 40, '#8ac8ff', .3); return [110, 82];
  },
  auction: (c, t, hv) => {
    wall(c, -58, -76, 116, 76, '#7a5a3a'); roof(c, -58, -76, 116, 30, '#4a2a2a'); win(c, -46, -62, 14, 18); win(c, 32, -62, 14, 18); door(c, -12, 0, 24, 40); 
    const g = (x: number, y: number) => { c.save(); c.translate(x, y); c.rotate(-.5 + sin(t / 250) * .15); c.fillStyle = '#5a3a1a'; c.fillRect(-1.5, 0, 3, 18); c.fillRect(-8, -6, 16, 8); c.restore(); }; g(0, -112); sign(c, 0, -90, 76, 15, 'AUKTION', '#ffd890', t, true); return [130, 124];
  },
  petshop: (c, t, hv) => {
    wall(c, -52, -66, 104, 66, '#d8a8c0'); awn(c, -56, -70, 112, '#ff7ab0', '#fff0f6'); win(c, -44, -52, 30, 28); door(c, 14, 0, 24, 40, '#8a4a6a');
    c.fillStyle = '#fff'; for (const [x, y] of [[-6, -90], [4, -96], [14, -90], [4, -84]]) { c.beginPath(); c.arc(x, y, 3.2, 0, TAU); c.fill(); } blob(c, 4, -86, 7, 6, '#fff'); glow(c, 0, -90, 28, '#ff7ab0', .35); 
    blob(c, -29, -36, 7, 6, '#f0c080'); poly(c, [-34, -41, -33, -48, -30, -42], '#f0c080'); poly(c, [-28, -42, -25, -48, -24, -41], '#f0c080'); return [116, 106];
  },
  stand: (c, t, hv) => { stall(c, t, -40, 80, '#d04a4a', '#f4ecd8', '#e8a040'); return [84, 74]; },
  stalls: (c, t, hv) => { stall(c, t, -100, 66, '#4a8ad0', '#f4ecd8', '#6ad08a'); stall(c, t, -33, 66, '#d0a04a', '#f4ecd8', '#d06a8a'); stall(c, t, 34, 66, '#4ad08a', '#f4ecd8', '#e8d04a'); return [200, 74]; },
  stall: (c, t, hv) => { stall(c, t, -38, 76, '#a04ad0', '#f4ecd8', '#e8a0e0'); return [80, 74]; },
  forge: (c, t, hv) => {
    wall(c, -54, -62, 108, 62, '#5a4a44'); roof(c, -54, -62, 108, 24, '#3a2a2a'); c.fillStyle = '#2a2a30'; c.fillRect(24, -112, 16, 50); c.fillStyle = '#c04a2a'; c.fillRect(24, -112, 16, 5);
    for (let i = 0; i < 4; i++) { c.fillStyle = `rgba(100,96,108,${.4 - i * .09})`; c.beginPath(); c.arc(32 + sin(t / 400 + i) * 5, -120 - i * 14 - (t / 40 % 6), 8 + i * 4, 0, TAU); c.fill(); }
    c.fillStyle = '#10080a'; c.beginPath(); c.roundRect(-40, -44, 40, 44, [18, 18, 0, 0]); c.fill(); const fl = .7 + .3 * sin(t / 90); glow(c, -20, -20, 50, '#ff7a2a', .8 * fl); c.fillStyle = lg(c, 0, -40, 0, 0, 0, '#ffd23a', 1, '#d03a1a'); c.beginPath(); c.moveTo(-36, 0); c.quadraticCurveTo(-34, -24 - fl * 6, -20, -30 - fl * 4); c.quadraticCurveTo(-8, -24, -4, 0); c.fill();
    c.fillStyle = '#3a3e48'; c.fillRect(6, -16, 26, 8); c.fillRect(12, -8, 14, 8); c.fillRect(30, -20, 8, 6); sign(c, 0, -76, 52, 12, 'SCHMIEDE', '#ff9a4a', t, false); return [116, 140];
  },
  workshop: (c, t, hv) => {
    wall(c, -50, -58, 100, 58, '#6a7280'); roof(c, -50, -58, 100, 18, '#4a505c'); win(c, -40, -46, 20, 16, true, '#9ae8ff'); door(c, 10, 0, 28, 42, '#3a4250');
    c.save(); c.translate(-26, -86); c.rotate(t / 1500); c.fillStyle = '#c0a050'; c.strokeStyle = '#4a3a10'; c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i < 16; i++) { const a = i * TAU / 16, r = i % 2 ? 11 : 15; c.lineTo(cos(a) * r, sin(a) * r); } c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#222'; c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill(); c.restore();
    c.save(); c.translate(-6, -92); c.rotate(-t / 1100); c.fillStyle = '#9aa2b0'; c.beginPath(); for (let i = 0; i < 12; i++) { const a = i * TAU / 12, r = i % 2 ? 7 : 10; c.lineTo(cos(a) * r, sin(a) * r); } c.closePath(); c.fill(); c.stroke(); c.restore(); return [110, 110];
  },
  loom: (c, t, hv) => {
    c.strokeStyle = '#5a3a1c'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(-34, 0); c.lineTo(-30, -70); c.moveTo(34, 0); c.lineTo(30, -70); c.moveTo(-34, -70); c.lineTo(34, -70); c.moveTo(-32, -10); c.lineTo(32, -10); c.stroke();
    for (let i = 0; i < 14; i++) { c.strokeStyle = i % 3 ? '#ff7ab0' : '#7ab8ff'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-28 + i * 4.3, -66); c.lineTo(-28 + i * 4.3, -14); c.stroke(); }
    for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#ffd23a' : '#7affd0'; c.fillRect(-28, -60 + i * 6 + 0, 56, 3); } blob(c, 36 + sin(t / 300) * 2, -30, 7, 7, '#ff7ab0'); return [84, 82];
  },
  cauldron: (c, t, hv) => {
    glow(c, 0, -18, 60, '#7affb0', .3 + (hv ? .15 : 0)); for (let i = 0; i < 3; i++) { c.fillStyle = '#3a2a1c'; c.save(); c.translate(-18 + i * 18, 0); c.rotate(i * .3 - .3); c.fillRect(-2, -8, 4, 10); c.restore(); }
    c.fillStyle = lg(c, -28, -40, 28, 0, 0, '#5a6070', .5, '#2a2e38', 1, '#14161c'); c.beginPath(); c.moveTo(-26, -34); c.quadraticCurveTo(-34, -6, -18, -2); c.lineTo(18, -2); c.quadraticCurveTo(34, -6, 26, -34); c.closePath(); c.fill(); c.strokeStyle = '#0a0a0e'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#4a505c'; c.beginPath(); c.ellipse(0, -34, 28, 7, 0, 0, TAU); c.fill(); c.fillStyle = '#6aff9a'; c.beginPath(); c.ellipse(0, -34, 23, 5, 0, 0, TAU); c.fill();
    for (let i = 0; i < 5; i++) { const p = (t / 900 + i * .2) % 1; c.fillStyle = `rgba(150,255,190,${1 - p})`; c.beginPath(); c.arc(-14 + i * 7 + sin(p * 6 + i) * 4, -36 - p * 34, 2.5 + p * 4, 0, TAU); c.fill(); } return [70, 76];
  },
  kitchen: (c, t, hv) => {
    wall(c, -44, -46, 88, 46, '#c8b8a0'); c.fillStyle = '#2a2a30'; c.fillRect(-44, -50, 88, 6); for (const x of [-26, 0, 26]) { c.fillStyle = '#4a4a54'; c.beginPath(); c.ellipse(x, -52, 10, 3, 0, 0, TAU); c.fill(); c.fillStyle = '#d8d8e0'; c.fillRect(x - 8, -66, 16, 14); c.fillStyle = '#8a8a96'; c.fillRect(x - 9, -68, 18, 3); for (let i = 0; i < 3; i++) { const p = (t / 1200 + i * .33 + x * .01) % 1; c.fillStyle = `rgba(230,230,240,${(1 - p) * .6})`; c.beginPath(); c.arc(x + sin(p * 5) * 3, -70 - p * 24, 3 + p * 4, 0, TAU); c.fill(); } }
    c.fillStyle = '#10121a'; c.fillRect(-36, -36, 26, 24); glow(c, -23, -24, 26, '#ff9a3a', .5); c.fillStyle = '#ffae4a'; c.fillRect(-32, -20, 18, 6); return [96, 96];
  },
  houses: (c, t, hv) => {
    for (const [x, hh, col] of [[-70, 50, '#9a6a5a'], [-8, 60, '#6a7a9a'], [54, 46, '#9a8a5a']] as [number, number, string][]) { wall(c, x, -hh, 56, hh, col); roof(c, x, -hh, 56, 26, shade(col, -.35)); win(c, x + 8, -hh + 12, 12, 14); win(c, x + 34, -hh + 12, 12, 14, false); door(c, x + 20, 0, 16, 26, '#3a2a1c'); }
    return [200, 100];
  },
  guildhouses: (c, t, hv) => {
    for (const [x, hh, col] of [[-90, 70, '#5a5a78'], [-26, 84, '#6a5a78'], [38, 66, '#5a6a78']] as [number, number, string][]) { wall(c, x, -hh, 56, hh, col); roof(c, x, -hh, 56, 30, '#2a2a44'); win(c, x + 8, -hh + 14, 12, 16, true, '#9ad0ff'); win(c, x + 34, -hh + 14, 12, 16); win(c, x + 8, -hh + 40, 12, 14); door(c, x + 20, 0, 16, 28, '#2a2030'); c.fillStyle = '#ffd23a'; star(c, x + 28, -hh - 34, 3.6, 5); c.fill(); }
    return [220, 130];
  },
  shop: (c, t, hv) => {
    wall(c, -48, -62, 96, 62, '#6a7a9a'); awn(c, -52, -66, 104, '#4a8ad0', '#f4ecd8'); win(c, -40, -46, 34, 30, true, '#aee0ff'); door(c, 12, 0, 26, 40, '#3a3a4a'); 
    sign(c, 0, -88, 60, 14, 'SHOP', '#6ae0ff', t, true); blob(c, -23, -26, 6, 5, '#ffd23a'); blob(c, -12, -27, 5, 6, '#ff7a7a'); return [108, 100];
  },
};
export function drawHotspot(ctx: Ctx, art: string, x: number, y: number, scale: number, t: number, hover: boolean, label: string, color?: string): { x: number; y: number; w: number; h: number } {
  const fn = H[art] || H.shop; const hv = hover ? 1.04 : 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(scale * hv, scale * hv);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; if (art !== 'person') { ctx.beginPath(); ctx.ellipse(0, 1, 50, 7, 0, 0, TAU); ctx.fill(); }
  const [w, h] = fn(ctx, t, hover, color || '');
  if (hover) { ctx.strokeStyle = 'rgba(255,230,140,.85)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t / 60; ctx.beginPath(); ctx.roundRect(-w / 2 - 4, -h - 4, w + 8, h + 8, 8); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
  const rect = { x: x - w * scale / 2, y: y - h * scale, w: w * scale, h: h * scale };
  if (hover && label) {
    ctx.save(); ctx.font = 'bold 13px sans-serif'; const tw = ctx.measureText(label).width + 18, ty = rect.y - 24;
    ctx.fillStyle = 'rgba(10,12,22,.9)'; rr(ctx, x - tw / 2, ty, tw, 22, 6); ctx.fill(); ctx.strokeStyle = 'rgba(255,215,120,.9)'; ctx.lineWidth = 1.4; rr(ctx, x - tw / 2, ty, tw, 22, 6); ctx.stroke();
    ctx.fillStyle = '#fff4d0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, ty + 12); ctx.restore();
  }
  return rect;
}
/** x,y = Mittelpunkt; Pfeil zeigt zum näheren Rand */
export function drawLink(ctx: Ctx, x: number, y: number, label: string, t: number, hover: boolean): { x: number; y: number; w: number; h: number } {
  const cw = ctx.canvas ? ctx.canvas.width : 1000, dir = x < cw / 2 ? -1 : 1, W = 78, Hh = 70, p = hover ? 1 : .7;
  ctx.save(); ctx.translate(x, y); glow(ctx, 0, 0, 60, '#ffd23a', .22 * p + (hover ? .15 : 0));
  ctx.fillStyle = `rgba(14,18,30,${hover ? .85 : .6})`; rr(ctx, -W / 2, -Hh / 2, W, Hh, 14); ctx.fill(); ctx.strokeStyle = hover ? '#ffe27a' : 'rgba(255,210,100,.6)'; ctx.lineWidth = 2; rr(ctx, -W / 2, -Hh / 2, W, Hh, 14); ctx.stroke();
  for (let i = 0; i < 3; i++) { const o = ((t / 500 + i * .33) % 1), a = sin(o * Math.PI), cx = dir * (-16 + o * 32); ctx.strokeStyle = `rgba(255,226,122,${a * (hover ? 1 : .8)})`; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(cx - dir * 7, -12); ctx.lineTo(cx, 0); ctx.lineTo(cx - dir * 7, 12); ctx.stroke(); }
  ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; const txt = label.length > 16 ? label.slice(0, 15) + '…' : label, tw = ctx.measureText(txt).width + 12; ctx.fillStyle = 'rgba(8,10,18,.82)'; rr(ctx, -tw / 2, Hh / 2 + 3, tw, 17, 5); ctx.fill(); ctx.fillStyle = hover ? '#fff' : '#ffe9b0'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, Hh / 2 + 12); ctx.restore();
  return { x: x - W / 2, y: y - Hh / 2, w: W, h: Hh + 22 };
}

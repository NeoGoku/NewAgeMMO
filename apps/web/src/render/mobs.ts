import { SPECIES } from '@nam/game-data';
import { Ctx, TAU, blob, poly, glow, eye, shade, mix, alpha, lg, clamp, mkCanvas, ctx2, pr, star, softShadow, litSprite, TexKind } from './util';

type Shape = (c: Ctx, col: string, t: number, a: number, ph: number) => void;
const sin = Math.sin, cos = Math.cos;

function legs4(c: Ctx, col: string, t: number, xs: number[], y: number, len: number, wd: number, sp = 180, ph = 0) {
  xs.forEach((x, i) => { const sw = sin(t / sp + i * 1.6 + ph) * 3; c.strokeStyle = shade(col, -.5); c.lineWidth = wd + 2; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + sw, y + len); c.stroke(); c.strokeStyle = col; c.lineWidth = wd; c.beginPath(); c.moveTo(x, y); c.lineTo(x + sw, y + len); c.stroke(); });
}
const fang = (c: Ctx, x: number, y: number, s = 3) => poly(c, [x - s * .5, y, x + s * .5, y, x, y + s * 1.6], '#fff', '#555', .6);
const horn = (c: Ctx, x: number, y: number, dx: number, dy: number, col: string, w = 3) => poly(c, [x - w, y, x + w, y, x + dx, y + dy], col, shade(col, -.6), 1);

const rat: Shape = (c, col, t, a, ph) => {
  const tl = sin(t / 260 + ph) * 5;
  c.strokeStyle = '#d89a9a'; c.lineWidth = 2.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-14, -9); c.bezierCurveTo(-26, -6, -30, -20 + tl, -40, -14 + tl); c.stroke();
  legs4(c, shade(col, -.2), t, [-8, 5], -6, 6, 4, 140, ph);
  blob(c, -2, -12, 16, 10, col); blob(c, 12, -13, 9, 7.5, col);
  blob(c, 8, -21, 4, 5, shade(col, .1)); blob(c, 14, -21, 4, 5, shade(col, .1)); c.fillStyle = '#e8a0a8'; c.beginPath(); c.arc(11, -20, 2, 0, TAU); c.fill();
  c.fillStyle = '#f09aa0'; c.beginPath(); c.arc(20.5, -12, 2, 0, TAU); c.fill();
  eye(c, 15, -15, 1.9, '#ff4a4a'); fang(c, 18, -9, 2); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = .8; for (const d of [-2, 2]) { c.beginPath(); c.moveTo(19, -11); c.lineTo(27, -11 + d * 2); c.stroke(); }
};
const wolf: Shape = (c, col, t, a, ph) => {
  const tl = sin(t / 300 + ph) * 4, br = sin(t / 400 + ph);
  c.fillStyle = shade(col, -.2); c.beginPath(); c.moveTo(-22, -30); c.quadraticCurveTo(-38, -34 + tl, -42, -48 + tl); c.quadraticCurveTo(-30, -38, -18, -22); c.fill();
  legs4(c, shade(col, -.25), t, [-18, 14], -18, 18, 6, 160, ph + 1.5);
  blob(c, 0, -28 + br * .5, 25, 12, col);
  poly(c, [-14, -37, -8, -45, -3, -37, 3, -46, 8, -37, 14, -44, 18, -36], shade(col, -.25));
  legs4(c, col, t, [-10, 20], -18, 18, 6, 160, ph);
  blob(c, 24, -38, 12, 10, col); blob(c, 35, -34, 9, 5.5, shade(col, .1));
  poly(c, [19, -45, 22, -58, 27, -46], shade(col, -.1), shade(col, -.7), 1); poly(c, [26, -46, 31, -57, 33, -45], col, shade(col, -.7), 1);
  c.fillStyle = '#16121a'; c.beginPath(); c.arc(42, -36, 2.4, 0, TAU); c.fill();
  eye(c, 28, -41, 2.2, '#ffd23a'); c.strokeStyle = '#222'; c.lineWidth = 1; c.beginPath(); c.moveTo(30, -31); c.lineTo(41, -31); c.stroke(); fang(c, 36, -31, 2.6); fang(c, 40, -31, 2.4);
};
const bird: Shape = (c, col, t, a, ph) => {
  const fl = sin(t / 90 + ph), by = -34 + sin(t / 300 + ph) * 3; c.save(); c.translate(0, by);
  c.strokeStyle = '#d8a050'; c.lineWidth = 2; c.beginPath(); c.moveTo(-2, 8); c.lineTo(-3, 17); c.moveTo(4, 8); c.lineTo(5, 16); c.stroke();
  const wing = (dir: number) => { c.save(); c.translate(-2, -4); c.rotate(-.7 + fl * .9 * dir); blob(c, -6, 0, 18, 6, shade(col, dir > 0 ? -.2 : .05), { rot: .1 }); c.restore(); };
  wing(1); poly(c, [-12, 0, -26, 2, -24, 8, -12, 6], shade(col, -.2), shade(col, -.6), 1);
  blob(c, 0, 0, 14, 10, col); blob(c, 5, 3, 8, 6, shade(col, .35, ), { line: false }); blob(c, 13, -6, 7, 6.5, col);
  poly(c, [19, -7, 28, -4, 19, -2], '#f0b040', '#7a5a1a', 1); eye(c, 15, -8, 1.8, '#ffe03a'); wing(-1); c.restore();
};
const boar: Shape = (c, col, t, a, ph) => {
  legs4(c, shade(col, -.3), t, [-16, 12], -10, 12, 7, 170, ph + 1.5);
  c.strokeStyle = shade(col, -.2); c.lineWidth = 2; c.beginPath(); c.moveTo(-26, -26); c.quadraticCurveTo(-34, -30, -32, -22 + sin(t / 200) * 3); c.stroke();
  blob(c, -2, -26, 27, 17, col); poly(c, [-20, -40, -14, -49, -9, -40, -3, -50, 3, -40, 9, -48, 14, -40], shade(col, -.35));
  legs4(c, col, t, [-8, 18], -10, 12, 7, 170, ph);
  blob(c, 28, -23, 13, 12, shade(col, .05)); blob(c, 38, -19, 7, 6, shade(col, .2)); c.fillStyle = '#2a1a1a'; c.beginPath(); c.arc(41, -21, 1.2, 0, TAU); c.arc(41, -17, 1.2, 0, TAU); c.fill();
  poly(c, [23, -33, 27, -43, 31, -32], shade(col, -.1), shade(col, -.7), 1);
  c.strokeStyle = '#f4ecd0'; c.lineWidth = 3.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(34, -15); c.quadraticCurveTo(40, -9, 42, -22); c.stroke();
  eye(c, 31, -26, 2, '#ff4a3a');
};
const spider: Shape = (c, col, t, a, ph) => {
  const bob = sin(t / 260 + ph) * 1.5;
  for (let i = 0; i < 8; i++) { const side = i < 4 ? -1 : 1, k = i % 4, bx = 4 + k * 3 - 4, sw = sin(t / 200 + i * 1.3 + ph) * 3; const kx = bx + (k - 1.5) * 9 + side * 0, fx = bx + (k - 1.5) * 15 + 6; c.strokeStyle = shade(col, -.55); c.lineWidth = 2.6; c.lineJoin = 'round'; c.beginPath(); c.moveTo(bx, -22 + bob); c.lineTo(kx + (side > 0 ? 8 : -8), -48 + sw); c.lineTo(fx + (side > 0 ? 16 : -14), 0); c.stroke(); }
  blob(c, -12, -26 + bob, 15, 13, shade(col, -.1)); c.fillStyle = shade(col, .6); c.globalAlpha = .6; c.beginPath(); c.moveTo(-12, -37 + bob); c.lineTo(-7, -26 + bob); c.lineTo(-12, -16 + bob); c.lineTo(-17, -26 + bob); c.fill(); c.globalAlpha = 1;
  blob(c, 8, -24 + bob, 9, 8, col); for (let i = 0; i < 4; i++) eye(c, 12 + (i % 2) * 3, -29 + Math.floor(i / 2) * 4 + bob, 1.4, i % 2 ? '#ff3a3a' : '#ffd23a', .5);
  c.strokeStyle = shade(col, .3); c.lineWidth = 2; c.beginPath(); c.moveTo(15, -20 + bob); c.lineTo(19, -14); c.moveTo(11, -19 + bob); c.lineTo(13, -13); c.stroke();
};
const bear: Shape = (c, col, t, a, ph) => {
  const br = sin(t / 450 + ph), ar = a > 0 ? sin(a * Math.PI) * -.9 : 0;
  blob(c, -8, -9, 11, 10, shade(col, -.15)); blob(c, 12, -9, 11, 10, shade(col, -.1));
  blob(c, 0, -36 + br, 25, 25, col); blob(c, 2, -30 + br, 14, 15, shade(col, .2), { line: false });
  blob(c, -14, -42 + br, 8, 17, shade(col, -.1), { rot: .3 });
  c.save(); c.translate(18, -48 + br); c.rotate(ar - .2); blob(c, 4, 12, 8, 17, col, { rot: -.2 }); for (let i = 0; i < 3; i++) { c.fillStyle = '#f0ead8'; poly(c, [i * 4 - 1, 27, i * 4 + 3, 27, i * 4 + 1, 33], '#f0ead8'); } c.restore();
  blob(c, 14, -66 + br, 14, 13, col); blob(c, 6, -77 + br, 5, 5, shade(col, -.1)); blob(c, 22, -77 + br, 5, 5, shade(col, -.1)); blob(c, 22, -62 + br, 8, 6, shade(col, .3)); c.fillStyle = '#1a1214'; c.beginPath(); c.ellipse(27, -64 + br, 2.6, 2, 0, 0, TAU); c.fill();
  eye(c, 17, -70 + br, 1.8, '#ff5a3a', .5); if (a > .2) { c.fillStyle = '#5a1010'; c.beginPath(); c.ellipse(24, -58 + br, 5, 3, 0, 0, TAU); c.fill(); fang(c, 22, -60 + br, 2.4); }
};
const wisp: Shape = (c, col, t, a, ph) => {
  const by = -40 + sin(t / 350 + ph) * 6;
  for (let i = 6; i >= 1; i--) { const tx = -i * 7 + sin(t / 200 + i) * 2, ty = by + i * 4 + sin(t / 250 + i * 1.3) * 4; glow(c, tx, ty, 14 - i * 1.4, col, .5 - i * .06); }
  glow(c, 0, by, 52, col, .7);
  const g = c.createRadialGradient(-3, by - 3, 1, 0, by, 14); g.addColorStop(0, '#fff'); g.addColorStop(.35, shade(col, .55)); g.addColorStop(1, col); c.fillStyle = g; c.beginPath(); c.arc(0, by, 13, 0, TAU); c.fill();
  c.fillStyle = shade(col, -.75); c.beginPath(); c.ellipse(3, by - 1, 2, 3, 0, 0, TAU); c.ellipse(9, by - 1, 2, 3, 0, 0, TAU); c.fill();
  for (let i = 0; i < 4; i++) { const an = t / 600 + i * 1.6; c.fillStyle = alpha('#fff', .7); c.beginPath(); c.arc(cos(an) * 20, by + sin(an) * 9, 1.4, 0, TAU); c.fill(); }
};
const golem: Shape = (c, col, t, a, ph) => {
  const br = sin(t / 600 + ph), sw = a > 0 ? sin(a * Math.PI) * 1.2 : 0, rock = shade(col, -.15), moss = col.toLowerCase().includes('7a') ? '#5aa04a' : shade(col, .25);
  blob(c, -12, -9, 9, 9, shade(rock, -.2)); blob(c, 12, -9, 9, 9, shade(rock, -.1));
  const rrp = (x: number, y: number, w: number, h: number, f: string) => { c.fillStyle = lg(c, x, y, x + w, y + h, 0, shade(f, .22), 1, shade(f, -.35)); c.beginPath(); c.roundRect(x, y, w, h, 5); c.fill(); c.strokeStyle = shade(f, -.7); c.lineWidth = 1.4; c.stroke(); };
  rrp(-24, -64 + br, 48, 44, rock); rrp(-10, -80 + br, 20, 18, shade(rock, .1));
  c.save(); c.translate(26, -58 + br); c.rotate(-sw); rrp(-6, 0, 14, 28, rock); rrp(-9, 24, 20, 17, shade(rock, .1)); c.restore();
  c.save(); c.translate(-26, -58 + br); c.rotate(.15); rrp(-9, 0, 14, 28, shade(rock, -.15)); rrp(-12, 24, 20, 17, rock); c.restore();
  glow(c, 0, -46 + br, 24, shade(col, .6), .55 + .2 * sin(t / 300)); c.fillStyle = shade(col, .7); c.beginPath(); c.arc(0, -46 + br, 6, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-16, -62 + br); c.lineTo(-9, -52 + br); c.lineTo(-14, -42 + br); c.moveTo(14, -34 + br); c.lineTo(18, -26 + br); c.stroke();
  c.fillStyle = moss; c.globalAlpha = .7; c.beginPath(); c.ellipse(-14, -64 + br, 9, 3, 0, 0, TAU); c.ellipse(8, -80 + br, 6, 2.5, 0, 0, TAU); c.fill(); c.globalAlpha = 1;
  eye(c, 3, -72 + br, 2.2, '#8affff'); eye(c, 8, -72 + br, 2.2, '#8affff');
};
function wing(c: Ctx, col: string, x: number, y: number, len: number, ang: number, ribs = 4, memb?: string) {
  c.save(); c.translate(x, y); c.rotate(ang); const tipY = -len;
  const pts = [0, 0, -len * .15, tipY * .9]; for (let i = 1; i <= ribs; i++) { pts.push(len * (.18 * i) - len * .1, tipY * (1 - i * .12) + len * .1 * (i % 2)); pts.push(len * .12 * i - len * .02, -len * .1 * (ribs - i)); }
  c.beginPath(); c.moveTo(0, 0); c.lineTo(-len * .1, -len); c.quadraticCurveTo(len * .3, -len * .9, len * .62, -len * .45); c.quadraticCurveTo(len * .45, -len * .5, len * .45, -len * .3); c.quadraticCurveTo(len * .3, -len * .35, len * .28, -len * .12); c.quadraticCurveTo(len * .12, -len * .2, 0, 0);
  c.fillStyle = lg(c, 0, 0, 0, -len, 0, memb || shade(col, -.2), 1, shade(col, .15)); c.fill(); c.strokeStyle = shade(col, -.7); c.lineWidth = 1.5; c.stroke();
  c.strokeStyle = shade(col, -.55); c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(len * .62, -len * .45); c.moveTo(0, 0); c.lineTo(len * .45, -len * .3); c.stroke(); c.restore(); void pts;
}
function drakeBody(c: Ctx, col: string, t: number, a: number, ph: number, k: number) {
  const fl = sin(t / 260 + ph), tl = sin(t / 300 + ph);
  c.save(); c.scale(k, k);
  wing(c, col, -4, -34, 36, -.5 + fl * .45, 4, shade(col, -.25));
  c.strokeStyle = shade(col, -.2); c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(-16, -24); c.bezierCurveTo(-34, -20, -40, -8 + tl * 4, -52, -16 + tl * 6); c.stroke(); poly(c, [-50, -16 + tl * 6, -60, -22 + tl * 6, -58, -10 + tl * 6], shade(col, -.35), shade(col, -.7), 1);
  legs4(c, shade(col, -.3), t, [-8, 8], -18, 16, 6, 220, ph);
  blob(c, 0, -28, 20, 11, col, { rot: -.15 }); blob(c, 6, -24, 12, 6, shade(col, .45), { line: false });
  c.strokeStyle = col; c.lineWidth = 8; c.beginPath(); c.moveTo(14, -32); c.quadraticCurveTo(24, -40, 25, -50); c.stroke(); c.strokeStyle = shade(col, -.7); c.lineWidth = 1; c.stroke();
  blob(c, 28, -52, 10, 7.5, col, { rot: .1 }); blob(c, 36, -49, 7, 4.5, shade(col, .1));
  horn(c, 22, -58, -9, -9, '#e8dcc0', 2.6); horn(c, 28, -59, -5, -12, '#e8dcc0', 2.2); eye(c, 30, -54, 2.1, '#ffd23a');
  if (a > .25 && a < .9) { for (let i = 0; i < 6; i++) glow(c, 42 + i * 7 + pr(i + Math.floor(t / 70)) * 3, -49 + pr(i + 7) * 6, 9 + i * 1.5, '#ff8a2a', .8 - i * .1); }
  wing(c, col, 2, -34, 40, .1 - fl * .5, 4, col); c.restore();
}
const drake: Shape = (c, col, t, a, ph) => drakeBody(c, col, t, a, ph, 1);
const dragon: Shape = (c, col, t, a, ph) => { glow(c, 0, -50, 70, col, .15); drakeBody(c, col, t, a, ph, 1.2); };

/* Humanoide */
interface HOpt { size?: number; head?: 'cap' | 'helm' | 'hood' | 'horn' | 'bare'; weapon?: 'bat' | 'rifle' | 'dagger' | 'staff' | 'sword' | 'none'; skin?: string; glowEye?: string; armor?: boolean; cape?: boolean; wings?: boolean; robe?: boolean; halo?: boolean }
function human(c: Ctx, col: string, t: number, a: number, ph: number, o: HOpt) {
  const k = o.size ?? 1, sw = sin(t / 300 + ph) * 1.5, atk = a > 0 ? sin(a * Math.PI) : 0, skin = o.skin || '#d8a888', dark = shade(col, -.45);
  c.save(); c.scale(k, k);
  if (o.wings) { c.save(); c.translate(-4, -46); for (const s of [-1, 1]) { c.save(); c.scale(s === 1 ? 1 : 1, 1); c.rotate(-.7 * s + sin(t / 400) * .08 * s - (s < 0 ? 1.2 : 0)); } c.restore(); c.restore(); }
  if (o.cape) { poly(c, [-8, -50, -18, -20 + sw, -4, -6, 8, -50], dark, shade(dark, -.5), 1); }
  if (o.robe) { c.fillStyle = lg(c, 0, -50, 0, -4, 0, col, 1, dark); c.beginPath(); c.moveTo(-9, -50); c.quadraticCurveTo(-20, -24, -19, -4 + sin(t / 400) * 1.5); c.lineTo(19, -4 + sin(t / 400 + 1) * 1.5); c.quadraticCurveTo(20, -24, 9, -50); c.fill(); c.strokeStyle = shade(col, -.7); c.lineWidth = 1.4; c.stroke(); }
  else { legs4(c, dark, t, [-5, 6], -22, 22, 7, 220, ph); c.fillStyle = '#1a1a22'; c.beginPath(); c.ellipse(-5, -1, 6, 3, 0, 0, TAU); c.ellipse(8, -1, 6, 3, 0, 0, TAU); c.fill(); }
  const ty = -50 + sw * .5;
  if (!o.robe) { c.fillStyle = lg(c, -10, ty, 12, ty + 30, 0, shade(col, .2), 1, dark); c.beginPath(); c.roundRect(-11, ty, 22, 30, 7); c.fill(); c.strokeStyle = shade(col, -.75); c.lineWidth = 1.4; c.stroke(); }
  if (o.armor) { blob(c, -11, ty + 3, 7, 6, shade(col, .1)); blob(c, 11, ty + 3, 7, 6, shade(col, .1)); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-4, ty + 4, 8, 4); }
  c.fillStyle = '#2a2024'; c.fillRect(-11, ty + 22, 22, 3);
  // Hinterer Arm
  c.strokeStyle = dark; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(-9, ty + 6); c.lineTo(-14, ty + 20 - sw); c.stroke();
  // Kopf
  blob(c, 2, ty - 12, 11, 11, skin);
  const hd = o.head || 'bare';
  if (hd === 'cap') { poly(c, [-9, ty - 14, 13, ty - 14, 11, ty - 20, 0, ty - 24, -8, ty - 20], dark, '#000', 1); poly(c, [10, ty - 14, 19, ty - 12, 10, ty - 11], dark, '#000', 1); }
  if (hd === 'helm') { c.fillStyle = lg(c, -10, ty - 24, 12, ty, 0, '#d8dce8', 1, '#5a6070'); c.beginPath(); c.arc(2, ty - 13, 12, Math.PI, 0); c.lineTo(14, ty - 6); c.lineTo(-10, ty - 6); c.fill(); c.strokeStyle = '#222'; c.lineWidth = 1.4; c.stroke(); c.fillStyle = o.glowEye || '#35e0ff'; c.fillRect(0, ty - 14, 13, 3); glow(c, 6, ty - 12, 14, o.glowEye || '#35e0ff', .5); }
  if (hd === 'hood') { c.fillStyle = lg(c, 0, ty - 28, 0, ty, 0, shade(col, .1), 1, dark); c.beginPath(); c.moveTo(-12, ty - 2); c.quadraticCurveTo(-14, ty - 28, 2, ty - 28); c.quadraticCurveTo(16, ty - 28, 14, ty - 4); c.quadraticCurveTo(2, ty - 12, -12, ty - 2); c.fill(); c.strokeStyle = shade(col, -.8); c.lineWidth = 1.4; c.stroke(); c.fillStyle = '#0a0810'; c.beginPath(); c.ellipse(5, ty - 12, 7, 7, 0, 0, TAU); c.fill(); }
  if (hd === 'horn') { horn(c, -3, ty - 21, -7, -12, '#e8dcc0', 3); horn(c, 8, ty - 21, 6, -13, '#e8dcc0', 3); }
  if (hd !== 'helm') { const ec = o.glowEye || '#222'; if (o.glowEye) { eye(c, 6, ty - 13, 1.8, ec); eye(c, 11, ty - 13, 1.6, ec); } else { c.fillStyle = hd === 'hood' ? '#ffd23a' : '#222'; c.beginPath(); c.arc(6, ty - 13, 1.6, 0, TAU); c.arc(11, ty - 13, 1.4, 0, TAU); c.fill(); if (hd === 'hood') glow(c, 8, ty - 13, 12, '#ffd23a', .5); } if (hd === 'cap') { c.strokeStyle = '#3a2a2a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(6, ty - 6); c.lineTo(12, ty - 7); c.stroke(); } }
  if (o.halo) { c.strokeStyle = '#ffe27a'; c.lineWidth = 2.5; glow(c, 2, ty - 32, 22, '#ffe27a', .6); c.beginPath(); c.ellipse(2, ty - 32, 11, 3.5, 0, 0, TAU); c.stroke(); }
  // Vorderer Arm + Waffe
  c.save(); c.translate(10, ty + 6); const ang = a > 0 ? -2.2 + a * 3.2 : -.6 + sw * .1; c.rotate(ang);
  c.strokeStyle = shade(col, -.2); c.lineWidth = 6.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(2, 15); c.stroke(); c.fillStyle = skin; c.beginPath(); c.arc(2, 16, 3.6, 0, TAU); c.fill();
  c.translate(2, 16); c.rotate(-.2 - ang * .0);
  const w = o.weapon || 'none';
  if (w === 'bat') { c.fillStyle = lg(c, -2, 0, 3, 0, 0, '#a0784a', 1, '#5a3a1a'); poly(c, [-2, 4, 2, 4, 4, -26, -4, -26], '#8a6038', '#2a1a0a', 1); }
  if (w === 'rifle') { c.fillStyle = '#2a2e38'; c.fillRect(-3, -2, 6, 8); c.fillRect(-2, -26, 4, 26); c.fillStyle = '#35e0ff'; c.fillRect(-1, -22, 2, 6); }
  if (w === 'dagger') { poly(c, [-2, 0, 2, 0, 1, -22, -1, -22], '#dfe6f0', '#2a2a36', 1); c.fillStyle = '#331'; c.fillRect(-4, -1, 8, 3); }
  if (w === 'sword') { poly(c, [-3, 0, 3, 0, 2, -36, 0, -42, -2, -36], lg(c, -3, 0, 3, 0, 0, '#fff', 1, '#8a96a8'), '#2a2a36', 1); c.fillStyle = '#6a2a1a'; c.fillRect(-6, 0, 12, 3); }
  if (w === 'staff') { c.strokeStyle = '#4a3a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 14); c.lineTo(0, -38); c.stroke(); glow(c, 0, -42, 18, o.glowEye || '#c070ff', .8); c.fillStyle = o.glowEye || '#c070ff'; c.beginPath(); c.arc(0, -42, 5, 0, TAU); c.fill(); }
  c.restore();
  if (atk > .6) { c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2; c.beginPath(); c.arc(16, ty + 10, 28, -1.2, .5); c.stroke(); }
  c.restore();
}
const thug: Shape = (c, col, t, a, ph) => human(c, col, t, a, ph, { head: 'cap', weapon: 'bat', size: 1 });
const soldier: Shape = (c, col, t, a, ph) => human(c, col, t, a, ph, { head: 'helm', weapon: 'rifle', armor: true, size: 1.05 });
const assassin: Shape = (c, col, t, a, ph) => human(c, col, t, a, ph, { head: 'hood', weapon: 'dagger', cape: true, size: .98 });
const cultist: Shape = (c, col, t, a, ph) => { const gl = '#ff4a8a'; c.save(); c.translate(0, 0); c.strokeStyle = alpha(gl, .6); c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, -1, 28, 7, 0, 0, TAU); c.stroke(); for (let i = 0; i < 5; i++) { const an = i / 5 * TAU + t / 1500; c.fillStyle = alpha(gl, .7); c.fillRect(cos(an) * 28 - 1, -1 + sin(an) * 7 - 1, 3, 3); } c.restore(); human(c, col, t, a, ph, { head: 'hood', weapon: 'staff', robe: true, glowEye: gl, size: 1.02 }); };
const fiend: Shape = (c, col, t, a, ph) => { human(c, col, t, a, ph, { head: 'horn', weapon: 'sword', armor: true, glowEye: '#ff5a3a', size: 1.05, skin: shade(col, -.1) }); };
const imp: Shape = (c, col, t, a, ph) => { c.save(); c.translate(0, -8 + sin(t / 200 + ph) * 3); const fl = sin(t / 110) * .5; for (const s of [-1, 1]) { c.save(); c.translate(-2, -34); c.rotate(s * (.8 + fl)); poly(c, [0, 0, s * 20, -18, s * 24, -4, s * 14, 2, s * 8, 6], shade(col, -.25), shade(col, -.7), 1); c.restore(); } c.restore();
  c.strokeStyle = shade(col, -.2); c.lineWidth = 2.5; c.beginPath(); c.moveTo(-6, -22); c.bezierCurveTo(-20, -14, -22, -34, -32, -24 + sin(t / 200) * 4); c.stroke(); poly(c, [-32, -24, -40, -26, -34, -18], col);
  human(c, col, t, a, ph, { head: 'horn', weapon: 'none', size: .62, glowEye: '#ffe03a', skin: col }); c.save(); c.translate(18, -22); c.strokeStyle = '#555'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 8); c.lineTo(0, -22); c.stroke(); poly(c, [-5, -22, -3, -29, -1, -22, 1, -29, 3, -22, 5, -29, 5, -22, 0, -19], '#ccc'); c.restore(); };
const demon: Shape = (c, col, t, a, ph) => {
  const fl = sin(t / 380) * .1; glow(c, 0, -50, 70, col, .22);
  for (const s of [-1, 1]) { c.save(); c.translate(-2, -62); c.scale(s * 1.0, 1.0); wing(c, col, 0, 0, 40, -.3 + fl, 4, shade(col, -.45)); c.restore(); }
  human(c, col, t, a, ph, { head: 'horn', weapon: 'sword', armor: true, glowEye: '#ffe03a', size: 1.15, skin: shade(col, .05) });
  for (let i = 0; i < 6; i++) { const fx = 20 + pr(i) * 24, fy = -60 - pr(i + 9) * 10 - ((t / 14 + i * 20) % 30); glow(c, fx, fy, 6, '#ff8a2a', .6); }
};
const hound: Shape = (c, col, t, a, ph) => {
  wolf(c, shade(col, -.2), t, a, ph);
  for (let i = 0; i < 7; i++) { const fx = -14 + i * 7, fl = sin(t / 90 + i * 1.7); poly(c, [fx - 4, -38, fx, -50 - fl * 5 - (i % 2) * 5, fx + 4, -38], lg(c, 0, -52, 0, -38, 0, '#ffd23a', 1, '#ff4a1a')); }
  glow(c, 30, -36, 20, '#ff6a2a', .5);
};
const wraith: Shape = (c, col, t, a, ph) => {
  const by = sin(t / 500 + ph) * 4; c.save(); c.translate(0, by - 8); glow(c, 0, -42, 50, col, .35);
  c.globalAlpha = .92; const bot = -2 + sin(t / 300) * 2;
  c.fillStyle = lg(c, 0, -80, 0, 0, 0, shade(col, .1), .7, shade(col, -.35), 1, alpha(col, 0)); c.beginPath(); c.moveTo(-10, -64); c.quadraticCurveTo(-26, -34, -24, bot);
  for (let i = 0; i <= 6; i++) c.lineTo(-24 + i * 8, bot + (i % 2 ? 8 : -2) + sin(t / 200 + i) * 2); c.quadraticCurveTo(26, -34, 10, -64); c.quadraticCurveTo(0, -80, -10, -64); c.fill();
  c.strokeStyle = alpha(shade(col, .3), .7); c.lineWidth = 6; c.lineCap = 'round'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 10, -50); c.quadraticCurveTo(s * 28, -42 + sin(t / 260 + s) * 4, s * 30 + (s > 0 ? 8 : 0), -30 + sin(t / 220) * 3); c.stroke(); }
  c.fillStyle = '#05030a'; c.beginPath(); c.ellipse(1, -62, 9, 10, 0, 0, TAU); c.fill(); eye(c, -2, -63, 2.4, '#bff', 1); eye(c, 6, -63, 2.4, '#bff', 1); c.globalAlpha = 1; c.restore();
};
const elemental: Shape = (c, col, t, a, ph) => {
  const cy = -42 + sin(t / 400 + ph) * 5; glow(c, 0, cy, 60, col, .55);
  for (let r = 0; r < 3; r++) { c.strokeStyle = alpha(shade(col, .4), .8 - r * .2); c.lineWidth = 2.5 - r * .5; c.beginPath(); c.ellipse(0, cy, 24 + r * 6, 8 + r * 3, t / 800 * (r % 2 ? -1 : 1) + r, 0, TAU * .75); c.stroke(); }
  const g = c.createRadialGradient(-3, cy - 4, 1, 0, cy, 18); g.addColorStop(0, '#fff'); g.addColorStop(.4, shade(col, .5)); g.addColorStop(1, col); c.fillStyle = g; c.beginPath(); c.arc(0, cy, 16, 0, TAU); c.fill();
  eye(c, 4, cy - 2, 2.4, '#fff', .6); eye(c, 11, cy - 2, 2.2, '#fff', .6);
  for (let i = 0; i < 5; i++) { const an = t / 500 + i * 1.256, rx = 30 + sin(i + t / 700) * 4; c.save(); c.translate(cos(an) * rx, cy + sin(an) * 12); c.rotate(an); poly(c, [0, -6, 3, 0, 0, 6, -3, 0], shade(col, .5), col, 1); c.restore(); }
  if (Math.floor(t / 110) % 4 === 0) { c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); let x = 0, y = cy; c.moveTo(x, y); for (let i = 0; i < 5; i++) { x += 8 + pr(i + Math.floor(t / 110)) * 6; y += (pr(i + 20 + Math.floor(t / 110)) - .5) * 20; c.lineTo(x, y); } c.stroke(); }
};
const seraph: Shape = (c, col, t, a, ph) => {
  const by = sin(t / 450 + ph) * 4 - 6; c.save(); c.translate(0, by); glow(c, 0, -52, 80, col, .4);
  for (let p = 0; p < 3; p++) for (const s of [-1, 1]) { c.save(); c.translate(-1, -56 + p * 5); c.rotate(s * (.5 + p * .38) + sin(t / 500 + p) * .05 * s - (s < 0 ? Math.PI : 0) * 0 ); c.scale(s, 1); for (let f = 0; f < 6; f++) { c.save(); c.rotate(-f * .12 - 1.3 + (3 - p) * .1); poly(c, [0, 0, 24 + f * 3 - p * 3, -3, 28 + f * 3 - p * 3, 1, 22, 5], f % 2 ? '#fff6dc' : '#fff', 'rgba(150,120,60,.6)', .8); c.restore(); } c.restore(); }
  c.restore();
  human(c, '#fff4d8', t, a, ph, { head: 'bare', weapon: 'sword', robe: true, halo: true, glowEye: col, size: 1.12, skin: '#ffe6cc' });
  for (let i = 0; i < 5; i++) { const an = t / 800 + i * 1.256; c.fillStyle = col; star(c, cos(an) * 34, -60 + sin(an) * 14 + by, 3, 4); c.fill(); }
};
const titan: Shape = (c, col, t, a, ph) => {
  const br = sin(t / 700 + ph) * 1.5, sw = a > 0 ? sin(a * Math.PI) * 1.1 : 0, rock = shade(col, -.4);
  glow(c, 0, -60, 90, col, .25);
  for (let i = 0; i < 5; i++) { const an = t / 1200 + i * 1.256; blob(c, cos(an) * 52, -70 + sin(an) * 12, 6, 6, rock); glow(c, cos(an) * 52, -70 + sin(an) * 12, 14, col, .4); }
  blob(c, -16, -14, 14, 14, shade(rock, -.15)); blob(c, 16, -14, 14, 14, shade(rock, -.05));
  blob(c, 0, -58 + br, 34, 36, rock); blob(c, 0, -90 + br, 13, 12, shade(rock, .1));
  c.save(); c.translate(32, -72 + br); c.rotate(-sw); blob(c, 6, 18, 11, 24, rock); blob(c, 8, 44, 14, 14, shade(rock, .1)); c.restore();
  c.save(); c.translate(-32, -72 + br); c.rotate(.1); blob(c, -4, 18, 11, 24, shade(rock, -.1)); blob(c, -6, 44, 14, 14, rock); c.restore();
  c.strokeStyle = shade(col, .5); c.lineWidth = 2; c.shadowColor = col; c.shadowBlur = 10; c.beginPath(); c.moveTo(-20, -80 + br); c.lineTo(-8, -64 + br); c.lineTo(-18, -48 + br); c.moveTo(14, -78 + br); c.lineTo(8, -60 + br); c.lineTo(18, -44 + br); c.stroke(); c.shadowBlur = 0;
  glow(c, 0, -56 + br, 26, col, .8); eye(c, 2, -92 + br, 2.6, shade(col, .6)); eye(c, 9, -92 + br, 2.6, shade(col, .6));
};
const voidheart: Shape = (c, col, t, a, ph) => {
  const cy = -52 + sin(t / 500) * 4, pu = 1 + sin(t / 260) * .08 + (a > 0 ? sin(a * Math.PI) * .2 : 0);
  glow(c, 0, cy, 100, col, .45);
  for (let i = 0; i < 8; i++) { const an = i / 8 * TAU + t / 2000; c.strokeStyle = alpha(shade(col, .2), .55); c.lineWidth = 3; c.beginPath(); c.moveTo(0, cy); c.bezierCurveTo(cos(an) * 30, cy + sin(an) * 30 + 10, cos(an + .8) * 50, cy + sin(an + .8) * 40 + 20, cos(an + sin(t / 700 + i)) * 64, cy + sin(an) * 44 + 24); c.stroke(); }
  c.save(); c.translate(0, cy); c.scale(pu, pu);
  const g = c.createRadialGradient(-6, -8, 2, 0, 0, 30); g.addColorStop(0, shade(col, .6)); g.addColorStop(.5, col); g.addColorStop(1, shade(col, -.75)); c.fillStyle = g;
  c.beginPath(); c.moveTo(0, 26); c.bezierCurveTo(-40, 0, -28, -30, -10, -22); c.bezierCurveTo(-4, -20, 0, -14, 0, -10); c.bezierCurveTo(0, -14, 4, -20, 10, -22); c.bezierCurveTo(28, -30, 40, 0, 0, 26); c.fill(); c.strokeStyle = shade(col, -.7); c.lineWidth = 2; c.stroke();
  c.fillStyle = '#05010a'; c.beginPath(); c.ellipse(0, 2, 11, 7, 0, 0, TAU); c.fill(); eye(c, 0, 2, 4.5, '#ff5cf0', 1); c.restore();
  for (let r = 0; r < 2; r++) { c.strokeStyle = alpha(shade(col, .5), .6); c.lineWidth = 1.6; c.beginPath(); c.ellipse(0, cy, 44 + r * 12, 14 + r * 4, t / 1500 * (r ? -1 : 1) + r, 0, TAU * .6); c.stroke(); }
};
const drone: Shape = (c, col, t, a, ph) => {
  const by = -52 + sin(t / 350 + ph) * 4; c.save(); c.translate(0, by);
  glow(c, 10, 10, 26, col, .35); c.fillStyle = alpha(col, .12); poly(c, [8, 6, 36, 56, -4, 56], alpha(col, .1));
  for (const [x, y] of [[-20, -6], [20, -6]]) { c.fillStyle = '#2a2e38'; c.fillRect(x - 1, y, 2, 6); c.save(); c.translate(x, y); c.fillStyle = 'rgba(180,200,220,.35)'; c.beginPath(); c.ellipse(0, 0, 14, 2.5 + Math.abs(sin(t / 30)) * 1, 0, 0, TAU); c.fill(); c.restore(); }
  blob(c, 0, 2, 22, 10, shade(col, -.1)); blob(c, 0, -3, 14, 8, shade(col, .1)); c.fillStyle = '#111'; c.beginPath(); c.ellipse(10, 2, 8, 6, 0, 0, TAU); c.fill(); eye(c, 11, 2, 4, '#ff3a3a', 1); c.strokeStyle = '#222'; c.lineWidth = 1; c.beginPath(); c.moveTo(-10, 12); c.lineTo(-10, 16); c.moveTo(6, 12); c.lineTo(6, 16); c.stroke(); c.restore();
};
const bot: Shape = (c, col, t, a, ph) => {
  const sw = sin(t / 250 + ph), atk = a > 0 ? sin(a * Math.PI) : 0, metal = '#8a92a2';
  legs4(c, '#4a505c', t, [-8, 8], -18, 18, 8, 240, ph); c.fillStyle = '#222'; c.fillRect(-14, -3, 12, 4); c.fillRect(2, -3, 12, 4);
  const box = (x: number, y: number, w: number, h: number, f: string, r = 5) => { c.fillStyle = lg(c, x, y, x + w, y + h, 0, shade(f, .3), 1, shade(f, -.35)); c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); c.strokeStyle = shade(f, -.75); c.lineWidth = 1.4; c.stroke(); };
  box(-16, -52, 32, 32, metal); c.fillStyle = col; c.fillRect(-16, -38, 32, 4); box(-10, -72, 22, 18, shade(metal, .1), 6); c.fillStyle = '#05080c'; c.fillRect(-6, -67, 16, 7); eye(c, 3 + sw, -63.5, 2.6, col, 1);
  c.strokeStyle = metal; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -72); c.lineTo(0, -82); c.stroke(); glow(c, 0, -83, 8, col, .5 + .5 * sin(t / 200)); c.fillStyle = col; c.beginPath(); c.arc(0, -83, 2.4, 0, TAU); c.fill();
  c.save(); c.translate(16, -48); c.rotate(-.4 - atk * 1.2); box(-3, 0, 7, 18, '#6a7080', 3); glow(c, 2, 24, 14, '#ffae3a', .6 + atk * .4); c.fillStyle = '#ffd890'; c.beginPath(); c.arc(2, 24, 3.5, 0, TAU); c.fill(); c.restore();
  box(-24, -50, 8, 20, '#6a7080', 3);
};
const turret: Shape = (c, col, t, a, ph) => {
  const aim = sin(t / 800 + ph) * .25, rec = a > 0 ? sin(a * Math.PI) * 5 : 0;
  poly(c, [-20, 0, 20, 0, 14, -22, -14, -22], lg(c, 0, -22, 0, 0, 0, '#5a6070', 1, '#2a2e38'), '#111', 1.4); c.fillStyle = col; c.fillRect(-14, -12, 28, 2);
  c.fillStyle = '#3a404c'; c.fillRect(-4, -34, 8, 14);
  c.save(); c.translate(0, -40); c.rotate(aim); const box = lg(c, -16, -12, 16, 12, 0, '#9aa2b4', 1, '#454c5c'); c.fillStyle = box; c.beginPath(); c.roundRect(-16, -12, 32, 24, 6); c.fill(); c.strokeStyle = '#111'; c.lineWidth = 1.4; c.stroke();
  c.fillStyle = '#2a2e38'; c.fillRect(8 - rec, -3, 28, 6); c.fillRect(30 - rec, -5, 6, 10); if (a > .15 && a < .6) glow(c, 40, 0, 16, '#ffd070', .9);
  eye(c, -2, -2, 4, col, 1); c.restore();
  c.save(); c.globalAlpha = .12 + .08 * sin(t / 200); c.fillStyle = col; poly(c, [4, -40, 160, -40 + (aim * 160) - 20, 160, -40 + aim * 160 + 20], col); c.restore();
};
const mech0: Shape = (c, col, t, a, ph) => {
  const br = sin(t / 500 + ph), atk = a > 0 ? sin(a * Math.PI) : 0, metal = '#6a727f';
  const box = (x: number, y: number, w: number, h: number, f: string, r = 6) => { c.fillStyle = lg(c, x, y, x + w, y + h, 0, shade(f, .3), 1, shade(f, -.4)); c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); c.strokeStyle = shade(f, -.8); c.lineWidth = 1.5; c.stroke(); };
  for (const s of [-1, 1]) { const sw = sin(t / 350 + s) * 2; box(s * 16 - 8, -40 + sw, 16, 26, shade(metal, s > 0 ? 0 : -.2), 4); box(s * 16 - 11, -16, 22, 14, '#3a404a', 4); }
  box(-26, -82 + br, 52, 46, metal, 8); c.fillStyle = col; c.fillRect(-26, -62 + br, 52, 4); box(-12, -98 + br, 24, 20, shade(metal, .1), 7); c.fillStyle = '#05080c'; c.beginPath(); c.roundRect(-3, -93 + br, 14, 8, 3); c.fill(); eye(c, 5, -89 + br, 3, col, 1);
  glow(c, 0, -52 + br, 24, col, .5 + .2 * sin(t / 200)); c.fillStyle = col; c.beginPath(); c.arc(0, -52 + br, 6, 0, TAU); c.fill();
  c.save(); c.translate(30, -78 + br); c.rotate(-.1 - atk * .5); box(-2, 0, 12, 28, '#555c68', 4); box(-3, 24, 18, 14, '#3a404a', 4); c.fillStyle = '#111'; for (let i = 0; i < 3; i++) c.fillRect(11, 26 + i * 4, 10, 2); if (a > .1 && a < .7) glow(c, 26, 32, 18, '#ffc060', .9); c.restore();
  box(-40, -80 + br, 14, 34, '#555c68', 5); c.fillStyle = '#35393f'; c.fillRect(-36, -92 + br, 6, 14); for (let i = 0; i < 3; i++) { c.fillStyle = `rgba(220,230,255,${.25 - i * .07})`; c.beginPath(); c.arc(-33 + sin(t / 300 + i) * 3, -96 - i * 9 + br - (t / 40 % 8), 4 + i * 2, 0, TAU); c.fill(); }
};
const mech: Shape = (c, col, t, a, ph) => { c.save(); c.scale(.78, .78); mech0(c, col, t, a, ph); c.restore(); };
const generic: Shape = (c, col, t, a, ph) => {
  const br = sin(t / 300 + ph) * 2; blob(c, 0, -22 + br, 22, 20, col); poly(c, [-14, -38 + br, -8, -50 + br, -2, -38 + br], shade(col, -.2)); poly(c, [2, -38 + br, 8, -50 + br, 14, -38 + br], shade(col, -.2));
  eye(c, -6, -26 + br, 3, '#fff'); eye(c, 8, -26 + br, 3, '#fff'); c.fillStyle = '#111'; c.beginPath(); c.arc(-5, -26 + br, 1.3, 0, TAU); c.arc(9, -26 + br, 1.3, 0, TAU); c.fill();
};
const KINDS: Record<string, Shape> = { rat, wolf, bird, boar, spider, bear, wisp, golem, drake, thug, soldier, assassin, cultist, drone, bot, turret, mech, imp, hound, fiend, demon, wraith, elemental, dragon, seraph, titan, voidheart };
export function mobShape(c: Ctx, kind: string, col: string, t: number, attack = 0, phase = 0) { (KINDS[kind] || PETS[kind] || generic)(c, col, t, attack, phase); }

const TEX: Record<string, [TexKind, number]> = { rat: ['fur', .8], wolf: ['fur', .9], boar: ['fur', .8], bear: ['fur', .95], hound: ['fur', .8], bird: ['fur', .6], fox: ['fur', .8], cat: ['fur', .75], owl: ['fur', .6],
  spider: ['chitin', .8], golem: ['stone', .95], titan: ['stone', .85], bot: ['metal', .85], drone: ['metal', .85], turret: ['metal', .85], mech: ['metal', .95], soldier: ['metal', .55],
  drake: ['scale', .95], dragon: ['scale', 1], demon: ['scale', .6], fiend: ['scale', .55], imp: ['scale', .55], thug: ['cloth', .8], assassin: ['cloth', .8], cultist: ['cloth', .8] };
const BIGK = new Set(['dragon', 'titan', 'seraph', 'voidheart', 'demon', 'mech', 'drake', 'golem', 'bear', 'elemental']);
export interface MobArt { kind: string; color: string; scale: number }
export interface MobOpts { t: number; flash: number; attack: number; dead: number; facing: 1 | -1; phase?: number; target?: boolean }
export function drawMob(ctx: Ctx, x: number, y: number, scale: number, art: MobArt, o: MobOpts) {
  const sc = scale * (art.scale || 1), ph = o.phase || 0, boss = (art.scale || 1) > 1.8, col = art.color || '#888';
  ctx.save(); ctx.translate(x, y);
  const fade = 1 - clamp(o.dead || 0);
  if (fade <= 0) { ctx.restore(); return; }
  ctx.globalAlpha = fade;
  if (o.dead) ctx.translate(0, o.dead * 6 * sc);
  if (o.target) { ctx.strokeStyle = `rgba(255,70,70,${.6 + .3 * Math.sin(o.t / 150)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 34 * sc, 9 * sc, 0, 0, TAU); ctx.stroke(); }
  softShadow(ctx, 30 * sc, 7.5 * sc, .42);
  if (boss) { const p = .7 + .3 * Math.sin(o.t / 400); ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -40 * sc, 90 * sc, col, .34 * p); ctx.restore(); ctx.save(); ctx.translate(0, 0); for (let i = 0; i < 10; i++) { const an = o.t / 900 + i * .628, r = 36 * sc; ctx.fillStyle = alpha(shade(col, .5), .6); ctx.fillRect(Math.cos(an) * r - 1, -((o.t / 20 + i * 17) % (80 * sc)) , 2, 2); } ctx.restore(); }
  const lunge = Math.sin(clamp(o.attack || 0) * Math.PI) * 14 * sc * o.facing;
  ctx.translate(lunge, 0);
  const big = BIGK.has(art.kind), tx = TEX[art.kind];
  litSprite(ctx, sc, big ? -140 : -80, big ? -200 : -120, big ? 140 : 80, 26, c => { c.scale(o.facing, 1); const br = 1 + Math.sin(o.t / 300 + ph) * .012; c.scale(1, br); mobShape(c, art.kind, col, o.t, o.attack || 0, ph); },
    { tex: tx?.[0], texA: tx ? tx[1] * .8 : 0, rim: .9, ao: .32, flash: o.flash });
  ctx.restore();
}
export function drawMobIconBase(ctx: Ctx, x: number, y: number, sc: number, art: MobArt, t = 0) { ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); mobShape(ctx, art.kind, art.color, t, 0, 0); ctx.restore(); }

/* ---------- Pets ---------- */
const fox: Shape = (c, col, t, a, ph) => {
  const tl = sin(t / 280 + ph) * 5;
  c.save(); c.translate(-18, -18); c.rotate(-.3 + tl * .02); blob(c, -12, -6, 16, 7, col, { rot: -.5 }); blob(c, -22, -14, 6, 4, '#fff', { rot: -.5 }); c.restore();
  legs4(c, shade(col, -.3), t, [-8, 8], -8, 8, 5, 200, ph);
  blob(c, 0, -17, 17, 10, col); blob(c, 5, -13, 9, 5, '#fff3e0', { line: false });
  blob(c, 15, -26, 10, 9, col); blob(c, 23, -22, 6, 4, '#fff3e0'); poly(c, [9, -32, 11, -44, 17, -33], col, shade(col, -.7), 1); poly(c, [17, -33, 22, -43, 24, -31], col, shade(col, -.7), 1);
  c.fillStyle = '#222'; c.beginPath(); c.arc(28, -23, 1.6, 0, TAU); c.fill(); eye(c, 19, -27, 1.8, '#222', .1);
};
const owl: Shape = (c, col, t, a, ph) => {
  const by = sin(t / 400 + ph) * 1.5;
  c.strokeStyle = '#d8a050'; c.lineWidth = 2; c.beginPath(); c.moveTo(-4, -6); c.lineTo(-4, 0); c.moveTo(4, -6); c.lineTo(4, 0); c.stroke();
  blob(c, -12, -22 + by, 6, 14, shade(col, -.2), { rot: .2 }); blob(c, 0, -20 + by, 15, 18, col); blob(c, 2, -15 + by, 9, 10, shade(col, .4), { line: false });
  poly(c, [-10, -36 + by, -6, -44 + by, -2, -36 + by], shade(col, -.1), shade(col, -.7), 1); poly(c, [2, -36 + by, 6, -44 + by, 10, -36 + by], shade(col, -.1), shade(col, -.7), 1);
  for (const x of [-5, 6]) { c.fillStyle = '#fff6d0'; c.beginPath(); c.arc(x, -26 + by, 5.5, 0, TAU); c.fill(); c.strokeStyle = '#333'; c.lineWidth = 1; c.stroke(); c.fillStyle = '#222'; c.beginPath(); c.arc(x + 1, -26 + by, 2.4, 0, TAU); c.fill(); }
  poly(c, [0, -23 + by, 3, -20 + by, 0, -16 + by, -3, -20 + by], '#f0b040', '#7a5a1a', 1);
};
const cat: Shape = (c, col, t, a, ph) => {
  const tl = sin(t / 300 + ph) * 6; c.strokeStyle = col; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-14, -12); c.bezierCurveTo(-26, -14, -22, -34 + tl, -30, -36 + tl); c.stroke();
  legs4(c, shade(col, -.2), t, [-8, 8], -8, 8, 5, 220, ph); blob(c, 0, -16, 16, 10, col); blob(c, 14, -26, 10, 9, col);
  poly(c, [7, -31, 8, -42, 14, -34], col, shade(col, -.7), 1); poly(c, [15, -34, 20, -42, 22, -31], col, shade(col, -.7), 1); poly(c, [9, -33, 9, -39, 12, -35], '#f0a0b0'); 
  eye(c, 17, -27, 2, '#7aff9a', .5); eye(c, 23, -26, 1.8, '#7aff9a', .5); c.fillStyle = '#f090a0'; c.beginPath(); c.arc(25, -23, 1.2, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = .8; for (const d of [-2, 2]) { c.beginPath(); c.moveTo(24, -22); c.lineTo(31, -22 + d); c.stroke(); }
};
const phoenix: Shape = (c, col, t, a, ph) => {
  const fl = sin(t / 140 + ph), by = -22 + sin(t / 300) * 3; glow(c, 0, by, 40, col, .5);
  for (let i = 0; i < 5; i++) { poly(c, [-8 - i * 5, by + 4 + i * 2, -14 - i * 7, by + 22 + i * 3 + sin(t / 150 + i) * 3, -4 - i * 3, by + 8], lg(c, 0, by, 0, by + 30, 0, '#ffd23a', 1, shade(col, -.2))); }
  wing(c, shade(col, -.2), -2, by - 2, 34, -.6 + fl * .5, 4, shade(col, -.15));
  blob(c, 0, by, 12, 10, col); blob(c, 9, by - 8, 7, 6.5, col); poly(c, [14, by - 10, 21, by - 7, 14, by - 5], '#ffb02e', '#7a4a0a', 1); eye(c, 11, by - 10, 1.6, '#222', 0);
  wing(c, col, 2, by - 4, 36, .1 - fl * .55, 4, '#ffb02e');
  for (let i = 0; i < 3; i++) poly(c, [6 + i * 3 - 6, by - 14, 8 + i * 3 - 6, by - 22 - i * 2, 10 + i * 3 - 6, by - 14], '#ffd23a');
};
const slime: Shape = (c, col, t, a, ph) => {
  const sq = 1 + sin(t / 260 + ph) * .08; c.save(); c.scale(1 / sq, sq); c.globalAlpha *= .92;
  c.fillStyle = lg(c, 0, -34, 0, 0, 0, shade(col, .45), .5, col, 1, shade(col, -.35)); c.beginPath(); c.moveTo(-20, 0); c.bezierCurveTo(-24, -26, -10, -38, 0, -36); c.bezierCurveTo(12, -38, 24, -24, 20, 0); c.closePath(); c.fill(); c.strokeStyle = shade(col, -.6); c.lineWidth = 1.4; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-8, -26, 5, 3, -.6, 0, TAU); c.fill(); c.fillStyle = '#123'; c.beginPath(); c.ellipse(-3, -17, 2.2, 3.4, 0, 0, TAU); c.ellipse(8, -17, 2.2, 3.4, 0, 0, TAU); c.fill(); c.strokeStyle = '#123'; c.lineWidth = 1.2; c.beginPath(); c.arc(2.5, -11, 3, .2, Math.PI - .2); c.stroke(); c.restore();
};
const PETS: Record<string, Shape> = { fox, owl, cat, phoenix, slime, rat, wolf: wolf, boar, wisp, golem, drake, bot };
export function drawPet(ctx: Ctx, x: number, y: number, scale: number, species: string, color: string, stage: number, t: number) {
  const art = SPECIES[species]?.art || species, col = color || SPECIES[species]?.color || '#aaa';
  const st = clamp(stage ?? 0, 0, 2), k = [.5, .62, .78][st] * scale * (art === 'golem' || art === 'drake' || art === 'wolf' || art === 'boar' ? .8 : 1);
  ctx.save(); ctx.translate(x, y);
  softShadow(ctx, 18 * k * 1.5, 5 * k * 1.5, .4);
  if (st === 2) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -26 * k * 1.5, 46 * k * 1.5, col, .3 + .1 * Math.sin(t / 300)); ctx.restore(); }
  const sh = PETS[art] || generic, tx = TEX[art];
  litSprite(ctx, k * 1.5, -75, -105, 75, 20, c => sh(c, col, t, 0, 0), { tex: tx?.[0], texA: tx ? tx[1] * .7 : 0, rim: .8, ao: .28 });
  ctx.scale(k * 1.5, k * 1.5);
  if (st >= 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffe27a'; for (let i = 0; i < st * 2; i++) { const an = t / 700 + i * 2; glow(ctx, Math.cos(an) * 26, -34 + Math.sin(an) * 8 - i * 4, 6, '#ffe27a', .5); star(ctx, Math.cos(an) * 26, -34 + Math.sin(an) * 8 - i * 4, 2.6, 4); ctx.fill(); } ctx.restore(); }
  ctx.restore();
}
/* ---------- Summons ---------- */
export function drawSummon(ctx: Ctx, x: number, y: number, scale: number, kind: string, color: string, t: number, attack: number) {
  const col = color || '#9a4dff', map: Record<string, [string, number]> = { wolf: ['wolf', .95], phoenix: ['phoenix', 1.7], golem: ['golem', .85], drake: ['drake', 1.1], titan: ['titan', .8] }, [sh, k] = map[kind] || ['wisp', 1];
  ctx.save(); ctx.translate(x, y); softShadow(ctx, 32 * scale, 7.5 * scale, .3);
  ctx.strokeStyle = alpha(col, .7); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 1, 34 * scale, 8 * scale, 0, 0, TAU); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, -34 * scale * k, 56 * scale * k, col, .38); ctx.restore();
  ctx.translate(Math.sin(clamp(attack) * Math.PI) * 16 * scale, 0); ctx.scale(scale * k, scale * k); ctx.globalAlpha = .88;
  ctx.globalCompositeOperation = 'source-over'; const base = mix(col, '#ffffff', .15); mobShape(ctx, sh, base, t, attack, 0);
  ctx.globalAlpha = .25; ctx.globalCompositeOperation = 'lighter'; mobShape(ctx, sh, col, t + 80, attack, 0); ctx.restore();
}

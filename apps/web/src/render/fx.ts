import { Ctx, TAU, glow, alpha, shade, pr, star, clamp, poly, lerp, lg } from './util';

const EL: Record<string, [string, string, string]> = { // main, bright, dark
  shadow: ['#9a4dff', '#e0b8ff', '#2a0a4a'], light: ['#ffe27a', '#ffffff', '#c89a20'], fire: ['#ff7a2a', '#ffd04a', '#a02a0a'], ice: ['#8ae8ff', '#e8fbff', '#2a7ab0'],
  nature: ['#5ee06a', '#d0ffa0', '#1a6a2a'], phys: ['#e0e4ee', '#ffffff', '#8a90a0'], arcane: ['#7a8cff', '#ff9aff', '#2a2a9a'], holy: ['#fff0b0', '#ffffff', '#e0b040'],
};
const sin = Math.sin, cos = Math.cos;
/** additiver Glow */
function gla(c: Ctx, x: number, y: number, r: number, col: string, a = 1) { c.save(); c.globalCompositeOperation = 'lighter'; glow(c, x, y, r, col, a); c.restore(); }
/** elementspezifische Burst-Silhouette (additiv geschichtet) */
function burst(c: Ctx, el: string, x: number, y: number, r: number, age: number, fa: number) {
  const [m, b, d] = EL[el] || EL.phys; c.save(); c.translate(x, y); c.globalAlpha *= fa; c.lineCap = 'round';
  switch (el) {
    case 'fire': for (let i = 0; i < 12; i++) { const an = -Math.PI / 2 + (pr(i) - .5) * 2.6, L = r * (.5 + pr(i + 4) * 1.1) * (.4 + age), px = cos(an) * L, py = sin(an) * L * .9 - age * 14; c.globalCompositeOperation = 'source-over'; poly(c, [px - 2.5, py + 3, px, py - 7 * (1 - age * .5), px + 2.5, py + 3], m); c.globalCompositeOperation = 'lighter'; gla(c, px, py, 7, b, .6); } break;
    case 'ice': c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 9; i++) { const an = i / 9 * TAU + .3, L = r * (.8 + pr(i) * .7) * (.5 + age * .6); c.save(); c.rotate(an); poly(c, [0, -2.5, L, 0, 0, 2.5], alpha(b, .85)); poly(c, [0, -1, L * .8, 0, 0, 1], '#ffffff'); c.restore(); } gla(c, 0, 0, r * 1.2, b, .35); break;
    case 'shadow': for (let k = 0; k < 3; k++) { c.strokeStyle = alpha(d, .85); c.lineWidth = 3.5; c.beginPath(); for (let i = 0; i <= 14; i++) { const u = i / 14, an = k * TAU / 3 + u * 4 - age * 5, rr = r * (1.1 - u * .85); c.lineTo(cos(an) * rr, sin(an) * rr * .8); } c.stroke(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = alpha(m, .55); c.lineWidth = 1.6; c.stroke(); c.globalCompositeOperation = 'source-over'; } c.fillStyle = alpha(d, .7); c.beginPath(); c.arc(0, 0, r * .3 * (1 - age * .5), 0, TAU); c.fill(); gla(c, 0, 0, r * .9, m, .5); break;
    case 'nature': for (let i = 0; i < 8; i++) { const an = i / 8 * TAU + age * 3, L = r * (.4 + age * .9) * (.7 + pr(i) * .5); c.save(); c.translate(cos(an) * L, sin(an) * L * .8); c.rotate(an + 1.2); c.fillStyle = i % 2 ? m : b; c.beginPath(); c.ellipse(0, 0, 6, 2.6, 0, 0, TAU); c.fill(); c.strokeStyle = d; c.lineWidth = .8; c.beginPath(); c.moveTo(-6, 0); c.lineTo(6, 0); c.stroke(); c.restore(); } break;
    case 'arcane': c.globalCompositeOperation = 'lighter'; c.strokeStyle = alpha(b, .9); c.lineWidth = 1.6; c.rotate(age * 3); c.beginPath(); c.arc(0, 0, r * .95, 0, TAU); c.stroke(); for (let k = 0; k < 2; k++) { c.beginPath(); for (let i = 0; i <= 3; i++) { const an = i / 3 * TAU + k * Math.PI / 3 * 1; c.lineTo(cos(an) * r * .95, sin(an) * r * .95); } c.stroke(); } for (let i = 0; i < 6; i++) { const an = i / 6 * TAU; gla(c, cos(an) * r * .95, sin(an) * r * .95, 6, m, .9); } break;
    case 'light': case 'holy': c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 10; i++) { const an = i / 10 * TAU + age, L = r * (i % 2 ? 1.5 : 2.1) * (.6 + age * .5); c.save(); c.rotate(an); poly(c, [0, -2.4, L, 0, 0, 2.4], alpha(i % 2 ? b : m, .75)); c.restore(); } gla(c, 0, 0, r * 1.1, '#ffffff', .6); break;
    default: c.globalCompositeOperation = 'lighter'; c.strokeStyle = alpha('#fff', .9); c.lineWidth = 2.5; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-r * .9, r * (.5 - i * .5) + 6); c.lineTo(r * .9, -r * (.5 - i * .5) - 6 + i * 2); c.stroke(); }
  }
  c.restore();
}
function particle(c: Ctx, el: string, x: number, y: number, r: number, rot: number, a: number) {
  const [m, b, d] = EL[el] || EL.phys; c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha *= a;
  switch (el) {
    case 'fire': poly(c, [-r * .7, r * .5, 0, -r * 1.4, r * .7, r * .5, 0, r], lg(c, 0, -r * 1.4, 0, r, 0, b, .5, m, 1, d)); poly(c, [-r * .35, r * .4, 0, -r * .6, r * .35, r * .4], '#fff8d0'); gla(c, 0, 0, r * 2.2, m, .5); break;
    case 'ice': poly(c, [0, -r * 1.3, r * .6, 0, 0, r * 1.3, -r * .6, 0], lg(c, -r * .6, 0, r * .6, 0, 0, '#fff', .5, b, 1, m), m, 1); gla(c, 0, 0, r * 1.8, b, .35); break;
    case 'nature': c.fillStyle = m; c.beginPath(); c.ellipse(0, 0, r * 1.1, r * .55, 0, 0, TAU); c.fill(); c.strokeStyle = d; c.lineWidth = 1; c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.stroke(); break;
    case 'shadow': gla(c, 0, 0, r * 2.2, m, .8); c.fillStyle = d; c.beginPath(); c.arc(0, 0, r * .8, 0, TAU); c.fill(); break;
    case 'arcane': case 'light': case 'holy': c.fillStyle = b; star(c, 0, 0, r * 1.4, 4, .22); c.fill(); gla(c, 0, 0, r * 2, m, .5); break;
    default: c.fillStyle = b; c.fillRect(-r * .2, -r * 1.2, r * .4, r * 2.4); c.fillRect(-r * 1.2, -r * .2, r * 2.4, r * .4);
  }
  c.restore();
}
export function drawFx(ctx: Ctx, k: string, x1: number, y1: number, x2: number, y2: number, el: string, age: number) {
  age = clamp(age); const [m, b, d] = EL[el] || EL.phys; ctx.save();
  if (!isFinite(x2)) x2 = x1; if (!isFinite(y2)) y2 = y1;
  if (k === 'proj') {
    const e = age, x = lerp(x1, x2, e), y = lerp(y1, y2, e) - sin(e * Math.PI) * 14, ang = Math.atan2(y2 - y1, x2 - x1);
    for (let i = 1; i <= 8; i++) { const te = Math.max(0, e - i * .025), tx = lerp(x1, x2, te), ty = lerp(y1, y2, te) - sin(te * Math.PI) * 14; ctx.globalAlpha = (1 - i / 9) * .6; gla(ctx, tx, ty, 10 - i, m, .8); if (i % 2 === 0) particle(ctx, el, tx + (pr(i) - .5) * 6, ty + (pr(i + 4) - .5) * 6, 3, i, .8); }
    ctx.globalAlpha = 1; gla(ctx, x, y, 30, m, .85); gla(ctx, x, y, 12, b, .9);
    ctx.translate(x, y); ctx.rotate(ang);
    if (el === 'phys') { poly(ctx, [-12, -1.5, 8, -1.5, 14, 0, 8, 1.5, -12, 1.5], '#d8dce8', '#333', .8); poly(ctx, [-12, 0, -17, -4, -14, 0, -17, 4], '#c8a070'); }
    else if (el === 'fire') { ctx.fillStyle = b; ctx.beginPath(); ctx.ellipse(0, 0, 7, 5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = m; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(-6, -8, 4, -4); ctx.lineTo(4, 4); ctx.quadraticCurveTo(-6, 8, -18, 0); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(2, 0, 3, 0, TAU); ctx.fill(); }
    else if (el === 'ice') { poly(ctx, [-10, 0, -2, -4, 12, 0, -2, 4], b, m, 1); }
    else if (el === 'nature') { ctx.fillStyle = m; ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = b; ctx.beginPath(); ctx.ellipse(2, -1, 4, 1.6, 0, 0, TAU); ctx.fill(); }
    else if (el === 'shadow') { ctx.fillStyle = d; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.strokeStyle = m; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = b; ctx.beginPath(); ctx.arc(2, 0, 2.5, 0, TAU); ctx.fill(); }
    else { ctx.fillStyle = b; star(ctx, 0, 0, 9, 4, .3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill(); }
  } else if (k === 'hit') {
    const r = 14 + age * 34, fa = 1 - age; ctx.globalAlpha = fa; gla(ctx, x2, y2, r * 1.8, m, .9 * fa); gla(ctx, x2, y2, r * .9, b, 1 * fa * fa);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = b; ctx.lineWidth = 3 * fa + .5; ctx.beginPath(); ctx.arc(x2, y2, r * .7, 0, TAU); ctx.stroke(); ctx.restore(); burst(ctx, el, x2, y2, r * .8, age, fa);
    for (let i = 0; i < 9; i++) { const an = i / 9 * TAU + pr(i) * .6, dist = r * (.5 + pr(i + 3) * .9); particle(ctx, el, x2 + cos(an) * dist, y2 + sin(an) * dist * .8 - age * 8, 3 + pr(i + 8) * 3, an + age * 3, fa); }
    if (el === 'phys') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x2 - r * .8, y2 + r * .6); ctx.lineTo(x2 + r * .8, y2 - r * .6); ctx.moveTo(x2 - r * .5, y2 - r * .6); ctx.lineTo(x2 + r * .6, y2 + r * .5); ctx.stroke(); }
  } else if (k === 'aoe') {
    const R = Math.max(40, Math.hypot(x2 - x1, y2 - y1)) * (x2 === x1 && y2 === y1 ? 1 : 1), e = 1 - Math.pow(1 - age, 2), r = R * e, fa = 1 - age * age, cx = x1, cy = y1;
    ctx.globalAlpha = fa; ctx.save(); ctx.translate(cx, cy); ctx.scale(1, .45); const g = ctx.createRadialGradient(0, 0, r * .2, 0, 0, r); g.addColorStop(0, alpha(m, 0)); g.addColorStop(.75, alpha(m, .35)); g.addColorStop(1, alpha(b, .85)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.strokeStyle = b; ctx.lineWidth = 3; ctx.stroke(); ctx.rotate(age * 2); ctx.strokeStyle = alpha(m, .7); ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(0, 0, r * .7, 0, TAU); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, .45); burst(ctx, el, 0, 0, r * .9, age, fa * .8); ctx.restore();
    for (let i = 0; i < 14; i++) { const an = i / 14 * TAU + pr(i) * 2, rr = r * (.2 + pr(i + 2) * .8), up = age * (30 + pr(i + 9) * 40); particle(ctx, el, cx + cos(an) * rr, cy + sin(an) * rr * .45 - up, 3 + pr(i + 5) * 3, an + age * 4, fa); }
  } else if (k === 'heal') {
    const fa = 1 - age * age; ctx.globalAlpha = fa; gla(ctx, x2, y2 - 30, 50, '#7affb0', .4 * fa);
    for (let i = 0; i < 10; i++) { const px = x2 + (pr(i) - .5) * 40 + sin(age * 6 + i) * 4, py = y2 - 8 - age * 56 - pr(i + 4) * 26; ctx.fillStyle = i % 2 ? '#aaffd0' : '#7affb0'; if (i % 3 === 0) { ctx.fillRect(px - 1.2, py - 4, 2.4, 8); ctx.fillRect(px - 4, py - 1.2, 8, 2.4); } else { star(ctx, px, py, 3, 4, .3); ctx.fill(); } }
    ctx.strokeStyle = alpha('#7affb0', .8); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x2, y2, 22 + age * 10, (22 + age * 10) * .35, 0, 0, TAU); ctx.stroke();
  } else if (k === 'buff') {
    const fa = 1 - age * age; ctx.globalAlpha = fa;
    for (let r = 0; r < 3; r++) { const p = (age * 1.4 + r * .3) % 1; ctx.strokeStyle = alpha(b, (1 - p) * .9); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x2, y2 - p * 70, 24, 7, 0, 0, TAU); ctx.stroke(); }
    for (let i = 0; i < 8; i++) { const an = i / 8 * TAU, p = (age + i * .1) % 1; particle(ctx, el, x2 + cos(an) * 22, y2 - p * 66, 3, 0, 1 - p); }
    gla(ctx, x2, y2 - 30, 44, m, .35 * fa);
  } else if (k === 'level') {
    const fa = age < .8 ? 1 : (1 - age) / .2, w = 46 * (1 - age * .3); ctx.globalAlpha = fa;
    const g = ctx.createLinearGradient(0, y2 - 220, 0, y2); g.addColorStop(0, 'rgba(255,230,120,0)'); g.addColorStop(.7, 'rgba(255,230,120,.55)'); g.addColorStop(1, 'rgba(255,255,255,.9)'); ctx.fillStyle = g; ctx.fillRect(x2 - w / 2, y2 - 220, w, 220);
    gla(ctx, x2, y2, 70, '#ffe27a', .7); ctx.strokeStyle = '#fff6c0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x2, y2, 20 + age * 50, (20 + age * 50) * .3, 0, 0, TAU); ctx.stroke();
    for (let i = 0; i < 16; i++) { const px = x2 + (pr(i) - .5) * 70, py = y2 - ((age * 2 + pr(i + 6)) % 1) * 190; ctx.fillStyle = '#fff6c0'; star(ctx, px, py, 3 + pr(i + 2) * 3, 4, .3); ctx.fill(); }
  } else if (k === 'nova') {
    const e = 1 - Math.pow(1 - age, 3), r = 200 * e, fa = 1 - age; ctx.globalAlpha = fa; ctx.save(); ctx.translate(x1, y1); ctx.scale(1, .55);
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = b; ctx.lineWidth = 8 * fa + 1; ctx.shadowColor = m; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.shadowBlur = 0; ctx.strokeStyle = alpha(m, .6); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r * .75, 0, TAU); ctx.stroke(); ctx.restore(); burst(ctx, el, x1, y1, r * .5, age, fa * .7);
    for (let i = 0; i < 18; i++) { const an = i / 18 * TAU, a1 = r * .6, a2 = r; ctx.strokeStyle = alpha(i % 2 ? b : m, .8); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1 + cos(an) * a1, y1 + sin(an) * a1 * .55); ctx.lineTo(x1 + cos(an) * a2, y1 + sin(an) * a2 * .55); ctx.stroke(); }
    gla(ctx, x1, y1, 80 * (1 - age) + 20, m, .6);
  }
  void shade; ctx.restore();
}
export function drawFloatText(ctx: Ctx, text: string, x: number, y: number, age: number, color: string, big: boolean) {
  age = clamp(age); const rise = (1 - Math.pow(1 - age, 2)) * (big ? 56 : 42), pop = age < .12 ? .5 + age / .12 * .7 : age < .22 ? 1.2 - (age - .12) / .1 * .2 : 1, fa = age > .65 ? 1 - (age - .65) / .35 : 1;
  ctx.save(); ctx.globalAlpha = fa; ctx.translate(x, y - rise); ctx.scale(pop, pop); ctx.font = `800 ${big ? 28 : 17}px "Trebuchet MS", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = big ? 6 : 4; ctx.strokeStyle = 'rgba(8,6,16,.9)'; ctx.strokeText(text, 0, 0);
  if (big) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
  const g = ctx.createLinearGradient(0, -14, 0, 14); g.addColorStop(0, '#fff'); g.addColorStop(.35, color); g.addColorStop(1, shade(color, -.35)); ctx.fillStyle = big ? g : color; ctx.fillText(text, 0, 0); ctx.restore();
}
export function drawBar(ctx: Ctx, x: number, y: number, w: number, h: number, frac: number, color: string, bg = 'rgba(8,10,18,.75)') {
  frac = clamp(frac); ctx.save(); const r = h / 2; ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  if (frac > 0) { const fw = Math.max(h, (w - 2) * frac); const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, shade(color, .4)); g.addColorStop(.5, color); g.addColorStop(1, shade(color, -.35)); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x + 1, y + 1, fw, h - 2, Math.max(0, r - 1)); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.roundRect(x + 3, y + 1.5, Math.max(0, fw - 4), Math.max(1, (h - 2) * .35), 2); ctx.fill(); }
  ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x + .5, y + .5, w - 1, h - 1, r); ctx.stroke(); ctx.restore();
}
export function drawNameplate(ctx: Ctx, text: string, x: number, y: number, color: string, sub?: string) {
  ctx.save(); ctx.font = 'bold 13px "Trebuchet MS", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const tw = ctx.measureText(text).width; let sw = 0; if (sub) { ctx.font = '11px system-ui, sans-serif'; sw = ctx.measureText(sub).width; }
  const W = Math.max(tw, sw) + 14, Hh = sub ? 31 : 19; ctx.fillStyle = 'rgba(8,10,20,.62)'; ctx.beginPath(); ctx.roundRect(x - W / 2, y - Hh / 2, W, Hh, 7); ctx.fill(); ctx.strokeStyle = alpha(color, .45); ctx.lineWidth = 1; ctx.stroke();
  ctx.font = 'bold 13px "Trebuchet MS", system-ui, sans-serif'; const ty = sub ? y - 6 : y + .5; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(text, x, ty); ctx.fillStyle = color; ctx.fillText(text, x, ty);
  if (sub) { ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = '#c4cad8'; ctx.fillText(sub, x, y + 8); } ctx.restore();
}

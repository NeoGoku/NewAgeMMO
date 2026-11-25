export type Ctx = CanvasRenderingContext2D;
export const TAU = Math.PI * 2;
export const clamp = (v: number, a = 0, b = 1) => v < a ? a : v > b ? b : v;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function mulberry(a: number): () => number { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/** deterministic pseudo random from an index */
export const pr = (i: number) => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

const pcache = new Map<string, [number, number, number]>();
export function parse(c: string): [number, number, number] {
  let r = pcache.get(c); if (r) return r;
  let h = (c || '#888').trim();
  if (h[0] === '#') { if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; const n = parseInt(h.slice(1, 7), 16); r = isNaN(n) ? [136, 136, 136] : [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  else { const m = h.match(/(\d+)[ ,]+(\d+)[ ,]+(\d+)/); r = m ? [+m[1], +m[2], +m[3]] : [136, 136, 136]; }
  if (pcache.size > 500) pcache.clear(); pcache.set(c, r); return r;
}
export const rgb = (r: number, g: number, b: number, a = 1) => a >= 1 ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a.toFixed(3)})`;
export function mix(a: string, b: string, t: number): string { const A = parse(a), B = parse(b); return rgb(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }
/** t -1..1 : dunkler/heller */
export function shade(c: string, t: number): string { const A = parse(c); return t >= 0 ? rgb(lerp(A[0], 255, t), lerp(A[1], 255, t), lerp(A[2], 255, t)) : rgb(A[0] * (1 + t), A[1] * (1 + t), A[2] * (1 + t)); }
export function alpha(c: string, a: number): string { const A = parse(c); return rgb(A[0], A[1], A[2], clamp(a)); }
export function gray(c: string, amt = 1, dark = .6): string { const A = parse(c); const l = (A[0] * .3 + A[1] * .59 + A[2] * .11) * dark; return rgb(lerp(A[0] * dark, l, amt), lerp(A[1] * dark, l, amt), lerp(A[2] * dark, l, amt)); }

export function mkCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c;
}
export function ctx2(c: HTMLCanvasElement): Ctx { return c.getContext('2d')!; }

export function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
export function glow(c: Ctx, x: number, y: number, r: number, color: string, a = 1) {
  if (r <= 0 || a <= 0) return; const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(color, a)); g.addColorStop(.4, alpha(color, a * .35)); g.addColorStop(1, alpha(color, 0));
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}
/** weich schattiertes Ellipsen-Objekt (semi-realistisch: Verlauf, Spekular, Kontur) */
export function blob(c: Ctx, x: number, y: number, rx: number, ry: number, col: string, o: { rot?: number; line?: boolean; hi?: number } = {}) {
  const g = c.createRadialGradient(x - rx * .35, y - ry * .4, Math.min(rx, ry) * .1, x, y, Math.max(rx, ry) * 1.1);
  g.addColorStop(0, shade(col, o.hi ?? .38)); g.addColorStop(.5, col); g.addColorStop(.85, shade(col, -.4)); g.addColorStop(1, shade(col, -.55));
  c.fillStyle = g; c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), o.rot || 0, 0, TAU); c.fill();
  if (rx > 4 && ry > 3) { c.fillStyle = 'rgba(255,255,255,.13)'; c.beginPath(); c.ellipse(x - rx * .32, y - ry * .38, rx * .32, ry * .2, (o.rot || 0) - .5, 0, TAU); c.fill(); }
  if (o.line !== false) { c.strokeStyle = shade(col, -.72); c.lineWidth = 1.2; c.globalAlpha *= .9; c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), o.rot || 0, 0, TAU); c.stroke(); c.globalAlpha /= .9; }
}
export function poly(c: Ctx, pts: number[], fill: string | CanvasGradient, line?: string, lw = 1.4) {
  c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath();
  c.fillStyle = fill; c.fill(); if (line) { c.strokeStyle = line; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); }
}
export function lg(c: Ctx, x0: number, y0: number, x1: number, y1: number, ...stops: (number | string)[]): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1); for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i] as number, stops[i + 1] as string); return g;
}
export function eye(c: Ctx, x: number, y: number, r: number, col: string, glowA = .8) {
  glow(c, x, y, r * 4.2, col, glowA * .7); c.fillStyle = col; c.beginPath(); c.ellipse(x, y, r, r * 1.1, 0, 0, TAU); c.fill();
  if (glowA > .3) { c.save(); c.globalCompositeOperation = 'lighter'; glow(c, x, y, r * 2.2, col, glowA * .6); c.restore(); }
  c.fillStyle = '#fff'; c.beginPath(); c.arc(x - r * .3, y - r * .35, r * .35, 0, TAU); c.fill();
}
export function star(c: Ctx, x: number, y: number, r: number, n = 4, inner = .35) {
  c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, rad = i % 2 ? r * inner : r; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } c.closePath();
}

/* ---------- Beleuchtungs-Hook (wird von drawBackground pro Frame gesetzt) ---------- */
export interface Lighting { color: string; intensity: number; /** -1 Licht von links .. 1 von rechts */ x?: number; /** Umgebungs-Tint */ ambient?: string; ambientA?: number }
let LIGHT: Required<Lighting> = { color: '#ffe9c0', intensity: .4, x: -.6, ambient: '#000000', ambientA: 0 };
export function setLighting(l: Lighting) { LIGHT = { color: l.color || LIGHT.color, intensity: clamp(l.intensity ?? LIGHT.intensity), x: l.x ?? LIGHT.x, ambient: l.ambient ?? LIGHT.ambient, ambientA: l.ambientA ?? LIGHT.ambientA }; }
export const getLighting = (): Required<Lighting> => LIGHT;

/* ---------- Texturen (gecacht) ---------- */
const texCache = new Map<string, CanvasPattern | null>();
export type TexKind = 'fur' | 'scale' | 'metal' | 'cloth' | 'stone' | 'grain' | 'chitin';
/** Kachel-Textur als Pattern (Alpha-Overlay aus hellen & dunklen Pixeln) */
export function texture(c: Ctx, kind: TexKind): CanvasPattern | null {
  if (texCache.has(kind)) return texCache.get(kind) || null;
  let pat: CanvasPattern | null = null;
  try {
    const S = 64, cv = mkCanvas(S, S), x = ctx2(cv), r = mulberry(hash('tex' + kind));
    x.lineCap = 'round';
    if (kind === 'fur') { for (let i = 0; i < 150; i++) { const px = r() * S, py = r() * S, l = 3 + r() * 4, dark = r() < .55; x.strokeStyle = dark ? 'rgba(0,0,0,.28)' : 'rgba(255,255,255,.2)'; x.lineWidth = .8; x.beginPath(); x.moveTo(px, py); x.lineTo(px + l * .35, py + l); x.stroke(); } }
    else if (kind === 'scale') { for (let yy = 0; yy < S; yy += 6) for (let xx = -3; xx < S + 6; xx += 6) { const ox = xx + ((yy / 6) % 2 ? 3 : 0); x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = .9; x.beginPath(); x.arc(ox, yy, 3.2, .1, Math.PI - .1); x.stroke(); x.strokeStyle = 'rgba(255,255,255,.16)'; x.beginPath(); x.arc(ox, yy - .8, 3, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); } }
    else if (kind === 'metal') { for (let i = 0; i < 70; i++) { const py = r() * S, px = r() * S, l = 6 + r() * 22; x.strokeStyle = r() < .5 ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.18)'; x.lineWidth = .7; x.beginPath(); x.moveTo(px, py); x.lineTo(px + l, py + (r() - .5)); x.stroke(); } for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(255,255,255,.22)'; x.fillRect(r() * S, r() * S, 1.2, 1.2); } }
    else if (kind === 'cloth') { for (let i = 0; i < S; i += 3) { x.fillStyle = 'rgba(0,0,0,.09)'; x.fillRect(i, 0, 1, S); x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(0, i, S, 1); } }
    else if (kind === 'stone' || kind === 'chitin') { for (let i = 0; i < 90; i++) { x.fillStyle = r() < .5 ? 'rgba(0,0,0,.2)' : 'rgba(255,255,255,.12)'; x.beginPath(); x.arc(r() * S, r() * S, .6 + r() * 1.8, 0, TAU); x.fill(); } if (kind === 'stone') { x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = .8; for (let i = 0; i < 5; i++) { x.beginPath(); let px = r() * S, py = r() * S; x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (r() - .5) * 14; py += (r() - .3) * 10; x.lineTo(px, py); } x.stroke(); } } }
    else { for (let i = 0; i < 900; i++) { const v = r(); x.fillStyle = v < .5 ? `rgba(0,0,0,${(r() * .5).toFixed(2)})` : `rgba(255,255,255,${(r() * .5).toFixed(2)})`; x.fillRect(r() * S | 0, r() * S | 0, 1, 1); } }
    pat = c.createPattern(cv, 'repeat');
  } catch { pat = null; }
  texCache.set(kind, pat); return pat;
}

/* ---------- weiche Schatten ---------- */
/** Kontaktschatten (weich, Licht-abhängig verschoben). Zeichnet am Ursprung, y=Fußpunkt. */
export function softShadow(c: Ctx, rx: number, ry: number, a = .4) {
  const L = LIGHT, ox = -L.x * rx * .22;
  c.save(); c.translate(ox, 1); c.scale(1, ry / rx);
  let g = c.createRadialGradient(0, 0, rx * .05, 0, 0, rx * 1.15); g.addColorStop(0, `rgba(4,4,12,${(a * .85).toFixed(3)})`); g.addColorStop(.45, `rgba(4,4,12,${(a * .5).toFixed(3)})`); g.addColorStop(1, 'rgba(4,4,12,0)');
  c.fillStyle = g; c.fillRect(-rx * 1.2, -rx * 1.2, rx * 2.4, rx * 2.4);
  c.translate(-ox * .6, 0); g = c.createRadialGradient(0, 0, 0, 0, 0, rx * .55); g.addColorStop(0, `rgba(0,0,0,${(a * .9).toFixed(3)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(-rx * .6, -rx * .6, rx * 1.2, rx * 1.2);
  c.restore();
}

/* ---------- Lit-Sprite: Offscreen-Pass mit Ambient, Textur, Rim-Light ---------- */
const SCR = 640; let scrA: HTMLCanvasElement | null = null, scrB: HTMLCanvasElement | null = null;
export interface LitOpts { tex?: TexKind; texA?: number; rim?: number; ao?: number; flash?: number; glowRim?: string }
/**
 * Rendert `draw` (Koordinaten bx0..bx1 / by0..by1, Einheiten vor Skalierung `sc`) in einen wiederverwendeten
 * Offscreen-Canvas, wendet Licht an und blittet das Ergebnis an den aktuellen Ursprung.
 * Fällt bei Fehlern auf direktes Zeichnen zurück.
 */
export function litSprite(ctx: Ctx, sc: number, bx0: number, by0: number, bx1: number, by1: number, draw: (c: Ctx) => void, o: LitOpts = {}) {
  let ok = false;
  try {
    const m = ctx.getTransform(), dev = Math.hypot(m.a, m.b) || 1;
    let k = dev * sc; const bw = bx1 - bx0, bh = by1 - by0, mx = Math.max(bw, bh);
    if (mx * k > SCR) k = SCR / mx;
    if (k < .25) { draw(ctx); return; }
    const W = Math.ceil(bw * k), H = Math.ceil(bh * k);
    if (!scrA) { scrA = mkCanvas(SCR, SCR); scrB = mkCanvas(SCR, SCR); }
    const a = ctx2(scrA), b = ctx2(scrB!), L = LIGHT;
    a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'source-over'; a.globalAlpha = 1; a.clearRect(0, 0, W, H);
    a.save(); a.setTransform(k, 0, 0, k, -bx0 * k, -by0 * k); draw(a); a.restore(); a.setTransform(1, 0, 0, 1, 0, 0); a.globalAlpha = 1; a.globalCompositeOperation = 'source-over';
    const I = L.intensity;
    a.save(); a.beginPath(); a.rect(0, 0, W, H); a.clip(); a.globalCompositeOperation = 'source-atop';
    // Textur
    if (o.tex) { const p = texture(a, o.tex); if (p) { a.globalAlpha = o.texA ?? .55; a.fillStyle = p; a.save(); a.scale(Math.max(.6, k * .9), Math.max(.6, k * .9)); a.fillRect(0, 0, W / Math.max(.6, k * .9), H / Math.max(.6, k * .9)); a.restore(); a.globalAlpha = 1; } }
    // Ambient: oben Lichtfarbe, unten Okklusion + Umgebungstint
    const ao = o.ao ?? .3, g = a.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, alpha(L.color, .14 * I * 2)); g.addColorStop(.5, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(6,6,16,${ao})`);
    a.fillStyle = g; a.fillRect(0, 0, W, H);
    if (L.ambientA > .01) { a.globalAlpha = L.ambientA; a.fillStyle = L.ambient; a.fillRect(0, 0, W, H); a.globalAlpha = 1; }
    a.restore();
    // Rim-Light
    const rim = (o.rim ?? 1) * I;
    if (rim > .03) {
      const d = Math.max(1.2, 1.5 * k), dx = -L.x * d, dy = .55 * d;
      b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1; b.clearRect(0, 0, W, H);
      b.drawImage(scrA, 0, 0, W, H, 0, 0, W, H); b.globalCompositeOperation = 'destination-out'; b.drawImage(scrA, 0, 0, W, H, dx, dy, W, H);
      b.globalCompositeOperation = 'source-in'; b.fillStyle = shade(L.color, .35); b.fillRect(0, 0, W, H); b.globalCompositeOperation = 'source-over';
      a.globalAlpha = clamp(rim * 1.5); a.globalCompositeOperation = 'source-over'; a.drawImage(scrB!, 0, 0, W, H, 0, 0, W, H); a.globalAlpha = 1;
    }
    if (o.flash && o.flash > .02) { a.globalCompositeOperation = 'source-atop'; a.fillStyle = `rgba(255,255,255,${(.8 * o.flash).toFixed(3)})`; a.fillRect(0, 0, W, H); a.globalCompositeOperation = 'source-over'; }
    ctx.drawImage(scrA, 0, 0, W, H, bx0 * sc, by0 * sc, W / k * sc, H / k * sc); ok = true;
  } catch { /* Fallback */ }
  if (!ok) { ctx.save(); ctx.scale(sc, sc); draw(ctx); ctx.restore(); }
}

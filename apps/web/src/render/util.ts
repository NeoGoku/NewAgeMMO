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
/** weich schattiertes Ellipsen-Objekt (Comic-Look mit Kontur) */
export function blob(c: Ctx, x: number, y: number, rx: number, ry: number, col: string, o: { rot?: number; line?: boolean; hi?: number } = {}) {
  const g = c.createRadialGradient(x - rx * .35, y - ry * .4, Math.min(rx, ry) * .1, x, y, Math.max(rx, ry) * 1.1);
  g.addColorStop(0, shade(col, o.hi ?? .38)); g.addColorStop(.55, col); g.addColorStop(1, shade(col, -.45));
  c.fillStyle = g; c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), o.rot || 0, 0, TAU); c.fill();
  if (o.line !== false) { c.strokeStyle = shade(col, -.7); c.lineWidth = 1.4; c.stroke(); }
}
export function poly(c: Ctx, pts: number[], fill: string | CanvasGradient, line?: string, lw = 1.4) {
  c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath();
  c.fillStyle = fill; c.fill(); if (line) { c.strokeStyle = line; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); }
}
export function lg(c: Ctx, x0: number, y0: number, x1: number, y1: number, ...stops: (number | string)[]): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1); for (let i = 0; i < stops.length; i += 2) g.addColorStop(stops[i] as number, stops[i + 1] as string); return g;
}
export function eye(c: Ctx, x: number, y: number, r: number, col: string, glowA = .8) {
  glow(c, x, y, r * 3, col, glowA * .6); c.fillStyle = col; c.beginPath(); c.ellipse(x, y, r, r * 1.1, 0, 0, TAU); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(x - r * .3, y - r * .35, r * .35, 0, TAU); c.fill();
}
export function star(c: Ctx, x: number, y: number, r: number, n = 4, inner = .35) {
  c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, rad = i % 2 ? r * inner : r; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } c.closePath();
}

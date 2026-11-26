import { boundaries, classIn, fill, flatten, land, line, places, poi, roads, type Ctx, type Expr, type L, type StyleDef } from './kit';
import { categoryColor, pattern, rng, strokeGlyph } from './sprites';
import { POI_CATEGORIES } from './kit';

/** Pixel Adventure – 16-Bit-Weltkarte: Pixeltexturen, Kachelwald, kantige Dächer, Pixelfont, Pixel-Sprites. Reale Geometrie bleibt unverändert. */
const P = {
  bg: '#78b95a', residential: '#c9bd98', commercial: '#c2b38c', industrial: '#a9a49a', civic: '#cdbf94', park: '#6fb350', cemetery: '#8ea878',
  wood: '#3f8a4e', grass: '#7cc35a', farmland: '#d7b463', sand: '#ecdc9c', rock: '#a9a59a', wetland: '#5f9f7a', ice: '#e8f0f4'
};
const px = (g: CanvasRenderingContext2D, x: number, y: number, c: string, s = 2) => { g.fillStyle = c; g.fillRect(x * s, y * s, s, s); };
function bitmap(g: CanvasRenderingContext2D, rows: string[], pal: Record<string, string>, ox = 0, oy = 0, s = 2) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (pal[ch]) px(g, ox + x, oy + y, pal[ch], s); }));
}
const TREE = ['...gg...', '..gGgg..', '.gGgggg.', 'gGggGggg', '.gggGgg.', 'gGggggGg', '...tt...', '...tt...'];
const ROOF = ['rrrrrrrr', 'rRrrRrrr', 'rrrrrrrr', 'rrRrrrRr', 'rrrrrrrr', 'RrrrRrrr', 'rrrrrrrr', 'rrRrrrrr'];
const lowIcon = (cat: (typeof POI_CATEGORIES)[number]) => (g: CanvasRenderingContext2D, w: number) => {
  // 14×14-Pixelsprite: Rahmen mit abgeschnittenen Ecken, Farbfläche, Piktogramm
  const t = document.createElement('canvas'); t.width = t.height = 14;
  const k = t.getContext('2d', { willReadFrequently: true })!;
  const col = categoryColor[cat];
  k.fillStyle = '#2b1d2e'; k.fillRect(1, 0, 12, 14); k.fillRect(0, 1, 14, 12);
  k.fillStyle = col; k.fillRect(2, 1, 10, 12); k.fillRect(1, 2, 12, 10);
  k.fillStyle = 'rgba(255,255,255,0.45)'; k.fillRect(2, 1, 10, 1); k.fillRect(1, 2, 1, 5);
  strokeGlyph(k, cat, 3, 3, 8, '#2b1d2e', 1.5);
  const d = k.getImageData(0, 0, 14, 14);
  for (let i = 0; i < d.data.length; i += 4) d.data[i + 3] = d.data[i + 3] > 100 ? 255 : 0;
  k.putImageData(d, 0, 0);
  g.imageSmoothingEnabled = false; g.drawImage(t, 0, 0, w, w);
};

export const pixelAdventure: StyleDef = {
  id: 'pixel-adventure',
  background: P.bg,
  sprites: [
    ...POI_CATEGORIES.map(cat => ({ name: `px-${cat}`, width: 28, height: 28, pixelRatio: 2, hard: true, draw: lowIcon(cat) })),
    pattern('px-grass', 16, g => { const r = rng(3); for (let i = 0; i < 14; i++) { const x = Math.floor(r() * 8), y = Math.floor(r() * 8); px(g, x, y, r() < 0.5 ? '#68ab4a' : '#8fd06a'); if (i % 3 === 0) px(g, x, y - 1, '#68ab4a'); } }, true),
    pattern('px-forest', 16, g => bitmap(g, TREE, { g: '#2f7a42', G: '#25613a', t: '#5b3a24' }), true),
    pattern('px-water', 16, g => { for (const [x, y] of [[1, 2], [2, 2], [3, 2], [5, 6], [6, 6], [7, 6]]) px(g, x, y, '#8fbcf5'); px(g, 0, 3, '#2f5fb0'); px(g, 4, 7, '#2f5fb0'); }, true),
    pattern('px-farm', 16, g => { for (let y = 0; y < 8; y += 2) for (let x = 0; x < 8; x++) px(g, x, y, '#c29a4a'); }, true),
    pattern('px-town', 16, g => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 0 && x % 4 !== 3) px(g, x, y, '#b5a77f'); }, true),
    pattern('px-sand', 16, g => { const r = rng(9); for (let i = 0; i < 9; i++) px(g, Math.floor(r() * 8), Math.floor(r() * 8), '#d3bd78'); }, true),
    pattern('px-roof', 16, g => bitmap(g, ROOF, { r: '#d9745a', R: '#bd5d49' }), true)
  ],
  extrusion: ctx => ({
    color: ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, ctx.c('#c8553d'), 20, ctx.c('#d9894a'), 60, ctx.c('#8f7ab5'), 150, ctx.c('#5f9ad0')], opacity: 1, vertical: false
  }),
  layers: (ctx: Ctx) => flatten(
    !ctx.overlay && land(ctx, { ...P, base: P.bg }),
    !ctx.overlay && [
      fill('theme-tex-grass', 'landcover', 7, { 'fill-pattern': ctx.img('px-grass'), 'fill-antialias': false }, classIn('grass')),
      fill('theme-tex-forest', 'landcover', 6, { 'fill-pattern': ctx.img('px-forest'), 'fill-antialias': false }, classIn('wood')),
      fill('theme-tex-farm', 'landcover', 8, { 'fill-pattern': ctx.img('px-farm'), 'fill-antialias': false }, classIn('farmland')),
      fill('theme-tex-sand', 'landcover', 8, { 'fill-pattern': ctx.img('px-sand'), 'fill-antialias': false }, classIn('sand')),
      fill('theme-tex-park', 'landuse', 11, { 'fill-pattern': ctx.img('px-grass'), 'fill-antialias': false }, classIn('park', 'garden', 'playground', 'recreation_ground', 'pitch')),
      fill('theme-tex-town', 'landuse', 11, { 'fill-pattern': ctx.img('px-town'), 'fill-antialias': false }, classIn('residential', 'commercial', 'retail', 'suburb', 'neighbourhood')),
      fill('theme-water', 'water', 0, { 'fill-color': ctx.c('#3f78d0'), 'fill-antialias': false }),
      fill('theme-water-tex', 'water', 3, { 'fill-pattern': ctx.img('px-water'), 'fill-antialias': false }),
      line('theme-water-shore', 'water', 4, { 'line-color': ctx.c('#f0e4a8'), 'line-width': ['step', ['zoom'], 1, 12, 2, 16, 3] }, { 'line-join': 'miter', 'line-cap': 'square' }),
      line('theme-waterway', 'waterway', 9, { 'line-color': ctx.c('#3f78d0'), 'line-width': ['step', ['zoom'], 1, 13, 2, 16, 4] }, { 'line-cap': 'square' }),
      fill('theme-aeroway', 'aeroway', 10, { 'fill-color': ctx.c('#b9b5aa'), 'fill-antialias': false })
    ],
    boundaries(ctx, { color: '#3a2438', w: 1.6, dash: [2, 2] }, { color: '#5a3d58', w: 1, dash: [1, 2] }),
    !ctx.overlay && !ctx.extruded && [
      fill('theme-building', 'building', 14, { 'fill-color': ctx.c('#c8694f'), 'fill-outline-color': ctx.c('#2b1d2e'), 'fill-antialias': false, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 1] }),
      fill('theme-building-roof', 'building', 15, { 'fill-pattern': ctx.img('px-roof'), 'fill-antialias': false })
    ],
    !ctx.overlay && [
      line('theme-rail-bed', 'transportation', 10, { 'line-color': ctx.c('#3a2438'), 'line-width': 4 }, { 'line-cap': 'butt', 'line-join': 'miter' }, classIn('rail', 'transit')),
      line('theme-rail', 'transportation', 10, { 'line-color': ctx.c('#f4ecc0'), 'line-width': 2, 'line-dasharray': [2, 2] }, { 'line-cap': 'butt', 'line-join': 'miter' }, classIn('rail', 'transit')),
      line('theme-path', 'transportation', 14, { 'line-color': ctx.c('#f0e0a0'), 'line-width': 2, 'line-dasharray': [2, 2] }, { 'line-cap': 'butt', 'line-join': 'miter' }, classIn('path'))
    ],
    roads(ctx, {
      cap: 'square', join: 'miter', overlayOpacity: 0.95,
      widthFn: (f: number): Expr => {
        const n = (k: number) => Math.max(1, Math.round(k * f));
        return ['step', ['zoom'], n(0.3), 8, n(0.7), 11, n(1.5), 14, n(3), 16, n(5), 17, n(8), 19, n(16)] as unknown as Expr;
      },
      tiers: {
        service: { color: '#efe2ae', casing: '#7a5a3a', w: 0.4, cw: 0.7, z: 15 },
        minor: { color: '#f4ecc0', casing: '#7a5a3a', w: 0.7, cw: 0.7, z: 12.5 },
        tertiary: { color: '#f8f0c8', casing: '#7a5a3a', w: 0.95, cw: 0.7, z: 11 },
        secondary: { color: '#fff4cf', casing: '#7a5a3a', w: 1.25, cw: 0.7, z: 9 },
        primary: { color: '#ffd77a', casing: '#6a4a30', w: 1.6, cw: 0.7, z: 6 },
        trunk: { color: '#ffc95a', casing: '#6a4a30', w: 1.9, cw: 0.7, z: 5 },
        motorway: { color: '#ffb347', casing: '#6a4a30', w: 2.2, cw: 0.7, z: 4 }
      }
    }),
    places(ctx, { font: 'NAM Pixel Bold', color: '#fff8dc', sub: '#f4e8b0', halo: '#2b1d2e', haloW: 2, upper: true, spacing: 0.04, k: 0.85 }),
    poi(ctx, { prefix: 'px', font: 'NAM Pixel Bold', color: '#fff8dc', halo: '#2b1d2e', haloW: 1.8, size: 1, textFrom: 16.6, upper: true })
  ) as L[]
};

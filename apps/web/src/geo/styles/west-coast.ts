import { boundaries, classIn, fill, flatten, land, line, places, poi, roads, type Ctx, type StyleDef } from './kit';
import { categoryColor, iconSprites, pattern, rng, strokeGlyph } from './sprites';

/** West Coast – Retro-Atlas: gedämpftes Grün/Grau/Sand, blaues Wasser, dunkle Grenzen, kantige Namen mit Kontur, Retro-Abzeichen. */
const P = {
  bg: '#b9ad84', residential: '#a7a08a', commercial: '#9b968a', industrial: '#8c8f88', civic: '#a9a58f', park: '#74905d', cemetery: '#7f9567',
  wood: '#5f7d4d', grass: '#8aa56a', farmland: '#b4b57c', sand: '#d2c392', rock: '#8f8c82', wetland: '#7a9a7c', ice: '#e1e4df'
};
const retro: Record<string, string> = { food: '#d9602b', shop: '#e0b02e', health: '#c93a3a', edu: '#3f78c0', green: '#4f8a3d', transit: '#3a58a8', car: '#7a7a72', money: '#4a9a64', culture: '#8a58a8', lodging: '#c46a9a', sport: '#d98a2b', civic: '#585858', dot: '#6a6a6a' };

export const westCoast: StyleDef = {
  id: 'west-coast',
  background: P.bg,
  sprites: [
    ...iconSprites({
      prefix: 'wc', size: 28, frame: (g, s, cat) => {
        // kantiges Retro-Abzeichen mit dicker dunkler Kontur und Versatz-Schatten
        g.fillStyle = '#1b1b18'; g.fillRect(3, 3, s - 3, s - 3);
        g.fillStyle = retro[cat]; g.fillRect(1.5, 1.5, s - 5, s - 5);
        g.strokeStyle = '#1b1b18'; g.lineWidth = 2; g.strokeRect(1.5, 1.5, s - 5, s - 5);
        strokeGlyph(g, cat, s * 0.17, s * 0.17, s * 0.58, '#fbf5dc', 2);
      }
    }),
    pattern('wc-hatch', 8, (g, w) => { g.strokeStyle = 'rgba(40,70,110,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, w); g.lineTo(w, 0); g.stroke(); }),
    pattern('wc-grain', 32, (g, w) => { const r = rng(7); for (let i = 0; i < 46; i++) { g.fillStyle = r() < 0.5 ? 'rgba(60,70,40,0.16)' : 'rgba(255,255,230,0.12)'; g.fillRect(Math.floor(r() * w), Math.floor(r() * w), 1, 1); } })
  ],
  extrusion: ctx => ({
    color: ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, ctx.c('#d9cba4'), 15, ctx.c('#c9bda0'), 40, ctx.c('#9aa3a8'), 100, ctx.c('#6f9cc0')], opacity: 0.95, vertical: true
  }),
  layers: (ctx: Ctx) => flatten(
    !ctx.overlay && land(ctx, { ...P, base: P.bg }),
    !ctx.overlay && [
      fill('theme-grain', 'landcover', 8, { 'fill-pattern': ctx.img('wc-grain'), 'fill-opacity': 1 }),
      fill('theme-water', 'water', 0, { 'fill-color': ctx.c('#5b8dc4') }),
      fill('theme-water-hatch', 'water', 7, { 'fill-pattern': ctx.img('wc-hatch'), 'fill-opacity': 0.9 }),
      line('theme-water-shore', 'water', 5, { 'line-color': ctx.c('#2f5788'), 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 16, 3] }),
      line('theme-waterway', 'waterway', 9, { 'line-color': ctx.c('#4a7db4'), 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 18, 5] }),
      fill('theme-aeroway', 'aeroway', 10, { 'fill-color': ctx.c('#a09c90') })
    ],
    boundaries(ctx, { color: '#1c1c18', w: 1.6 }, { color: '#2e2e28', w: 1.1, dash: [6, 2, 1, 2] }),
    !ctx.overlay && !ctx.extruded && fill('theme-building', 'building', 14.5, { 'fill-color': ctx.c('#85806f'), 'fill-outline-color': ctx.c('#2c2a22'), 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 16, 1] }),
    !ctx.overlay && [
      // Bahn: schwarz-weiße Schwellenoptik
      line('theme-rail-bed', 'transportation', 10, { 'line-color': ctx.c('#1c1c18'), 'line-width': 2.6 }, {}, classIn('rail', 'transit')),
      line('theme-rail', 'transportation', 10, { 'line-color': ctx.c('#f2ecd0'), 'line-width': 1.4, 'line-dasharray': [2, 2] }, {}, classIn('rail', 'transit')),
      line('theme-path', 'transportation', 15, { 'line-color': ctx.c('#6d5f3e'), 'line-width': 1.2, 'line-dasharray': [1, 2] }, {}, classIn('path'))
    ],
    roads(ctx, {
      cap: 'butt', join: 'miter', overlayOpacity: 0.9,
      tiers: {
        service: { color: '#e9e3c9', casing: '#2a2922', w: 0.35, cw: 0.7, z: 15 },
        minor: { color: '#efe9cf', casing: '#2a2922', w: 0.6, cw: 0.8, z: 12 },
        tertiary: { color: '#f6efd0', casing: '#2a2922', w: 0.9, cw: 0.9, z: 10.5 },
        secondary: { color: '#f4dc8a', casing: '#2a2922', w: 1.2, cw: 1, z: 8.5 },
        primary: { color: '#f0c25a', casing: '#2a2922', w: 1.55, cw: 1.1, z: 6 },
        trunk: { color: '#e9a64a', casing: '#2a2922', w: 1.85, cw: 1.2, z: 5 },
        motorway: { color: '#e88a3c', casing: '#2a2922', w: 2.2, cw: 1.3, z: 4 }
      }
    }),
    places(ctx, { font: 'NAM Block Regular', color: '#fbf5dc', sub: '#efe6c0', halo: '#1b1b18', haloW: 2.4, upper: true, spacing: 0.06, k: 1.1 }),
    poi(ctx, { prefix: 'wc', font: 'NAM Block Regular', color: '#fbf5dc', halo: '#1b1b18', haloW: 2, size: 0.95, textFrom: 16.4, upper: true })
  )
};
void categoryColor;

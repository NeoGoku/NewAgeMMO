import { boundaries, classIn, fill, flatten, land, line, places, poi, roads, type Ctx, type StyleDef } from './kit';
import { categoryColor, iconSprites, strokeGlyph } from './sprites';

/** Underground – nächtliche Tuning-Stadtkarte: olivgraue Flächen, tiefes Blau, gestufte helle Straßen mit dunklen Konturen, bunte runde POIs. */
const P = {
  bg: '#1f2119', residential: '#33362a', commercial: '#3c3e30', industrial: '#25261f', civic: '#2f3326', park: '#34482b', cemetery: '#283124',
  wood: '#27381f', grass: '#2a3523', farmland: '#2e3123', sand: '#3a3829', rock: '#34352f', wetland: '#232f2c', ice: '#3b3f3c',
  water: '#0b1a3f', shore: '#1d3c80', building: '#15160f', outline: '#5a5d46'
};

export const underground: StyleDef = {
  id: 'underground',
  background: P.bg,
  sprites: iconSprites({
    prefix: 'ug', size: 28, frame: (g, s, cat) => {
      g.fillStyle = '#0c0d09'; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 1, 0, 7); g.fill();
      g.fillStyle = categoryColor[cat]; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 3.2, 0, 7); g.fill();
      strokeGlyph(g, cat, s * 0.22, s * 0.22, s * 0.56, '#12130e', 1.9);
    }
  }),
  extrusion: ctx => ({
    color: ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, ctx.c('#2c2f23'), 20, ctx.c('#4b5039'), 60, ctx.c('#767a5f'), 150, ctx.c('#b3b68f')],
    opacity: 0.92, vertical: true
  }),
  layers: (ctx: Ctx) => flatten(
    !ctx.overlay && land(ctx, { ...P, base: P.bg }),
    !ctx.overlay && [
      // Geländeabstufung: Waldflächen dunkler Rand, Wiesen in zwei Tonstufen (nur Landbedeckungsklassen, keine Höhendaten)
      line('theme-terrain-edge', 'landcover', 9, { 'line-color': ctx.c('#161c14'), 'line-width': 1.2, 'line-opacity': 0.8 }, {}, classIn('wood', 'rock', 'wetland')),
      fill('theme-water', 'water', 0, { 'fill-color': ctx.c(P.water), 'fill-antialias': true }),
      line('theme-water-shore', 'water', 6, { 'line-color': ctx.c(P.shore), 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 16, 2.4], 'line-opacity': 0.9 }),
      line('theme-waterway', 'waterway', 9, { 'line-color': ctx.c('#1b3a7c'), 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 18, 4] }),
      fill('theme-aeroway', 'aeroway', 10, { 'fill-color': ctx.c('#34362c') })
    ],
    boundaries(ctx, { color: '#a89a52', w: 1.1, dash: [4, 2] }, { color: '#6a6b4d', w: 0.8, dash: [2, 2] }),
    !ctx.overlay && !ctx.extruded && [
      fill('theme-building', 'building', 14, { 'fill-color': ctx.c(P.building), 'fill-outline-color': ctx.c(P.outline), 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, 1] }),
    ],
    // Schiene: dunkler Unterbau, heller Gleisstrich
    !ctx.overlay && [
      line('theme-rail-bed', 'transportation', 10, { 'line-color': ctx.c('#0e0f0b'), 'line-width': 3.4 }, {}, classIn('rail', 'transit')),
      line('theme-rail', 'transportation', 10, { 'line-color': ctx.c('#8c8e76'), 'line-width': 1.6, 'line-dasharray': [3, 3] }, {}, classIn('rail', 'transit')),
      line('theme-path', 'transportation', 15, { 'line-color': ctx.c('#6f705c'), 'line-width': 1, 'line-dasharray': [2, 2] }, {}, classIn('path'))
    ],
    roads(ctx, {
      cap: 'round', join: 'round', overlayOpacity: 0.85,
      tiers: {
        service: { color: '#4b4d3f', casing: '#0d0e0a', w: 0.35, z: 15 },
        minor: { color: '#6e705c', casing: '#0d0e0a', w: 0.55, cw: 0.55, z: 12.5 },
        tertiary: { color: '#9a9c80', casing: '#0d0e0a', w: 0.8, cw: 0.6, z: 11 },
        secondary: { color: '#c4c6a2', casing: '#0d0e0a', w: 1.05, cw: 0.7, z: 9 },
        primary: { color: '#e5e3bb', casing: '#0d0e0a', w: 1.35, cw: 0.8, z: 6 },
        trunk: { color: '#f4efc0', casing: '#0d0e0a', w: 1.65, cw: 0.9, z: 5 },
        motorway: { color: '#fff7c9', casing: '#0d0e0a', w: 1.95, cw: 1, z: 4 }
      },
      centre: { color: '#6a6a4a', dash: [4, 4], from: ['motorway', 'trunk'] }
    }),
    places(ctx, { font: 'NAM Condensed Bold', color: '#e4e2c4', sub: '#a8a98e', halo: '#0d0e0a', haloW: 1.6, upper: true, spacing: 0.1, k: 1.05 }),
    poi(ctx, { prefix: 'ug', font: 'NAM Condensed Bold', color: '#e4e2c4', halo: '#0d0e0a', haloW: 1.4, size: 0.95, textFrom: 16.4 })
  )
};

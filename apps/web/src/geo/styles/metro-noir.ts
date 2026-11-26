import { boundaries, classIn, fill, flatten, land, line, places, poi, roads, type Ctx, type StyleDef } from './kit';
import { iconSprites, strokeGlyph } from './sprites';

/** Metro Noir – Schwarzweiß-Atlas: fast schwarz, breite helle Hauptstraßen, reduzierte Gebäude, monochrome Piktogramme. */
const P = {
  bg: '#16171a', residential: '#1c1d21', commercial: '#202126', industrial: '#101114', civic: '#191a1e', park: '#14191a', cemetery: '#0f1210',
  wood: '#101712', grass: '#121813', farmland: '#101213', sand: '#131312', rock: '#111213', wetland: '#0c1011', ice: '#1a1b1c'
};

export const metroNoir: StyleDef = {
  id: 'metro-noir',
  background: P.bg,
  sprites: iconSprites({
    prefix: 'mn', size: 24, frame: (g, s, cat) => {
      g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 1, 0, 7); g.stroke();
      strokeGlyph(g, cat, s * 0.2, s * 0.2, s * 0.6, '#f2f2f2', 1.7);
    }
  }),
  extrusion: ctx => ({
    color: ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, ctx.c('#1b1c1e'), 30, ctx.c('#3b3d41'), 80, ctx.c('#6c6f75'), 200, ctx.c('#c8cacf')], opacity: 0.94, vertical: true
  }),
  layers: (ctx: Ctx) => flatten(
    !ctx.overlay && land(ctx, { ...P, base: P.bg }),
    !ctx.overlay && [
      fill('theme-water', 'water', 0, { 'fill-color': ctx.c('#050b13') }),
      line('theme-water-shore', 'water', 8, { 'line-color': ctx.c('#16212e'), 'line-width': 1 }),
      line('theme-waterway', 'waterway', 10, { 'line-color': ctx.c('#101a26'), 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 18, 3] })
    ],
    boundaries(ctx, { color: '#60646b', w: 0.8, dash: [6, 3] }),
    // reduzierte Gebäude: nur Blockumriss, keine Füllung bis Straßenzoom
    !ctx.overlay && !ctx.extruded && fill('theme-building', 'building', 14, { 'fill-color': ctx.c('#32333a'), 'fill-outline-color': ctx.c('#4a4c55'), 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14.4, 0, 15.2, 1] }),
    !ctx.overlay && [
      line('theme-rail', 'transportation', 11, { 'line-color': ctx.c('#3a3c40'), 'line-width': 0.9, 'line-dasharray': [5, 3] }, {}, classIn('rail', 'transit')),
      line('theme-path', 'transportation', 16, { 'line-color': ctx.c('#2b2c2f'), 'line-width': 0.8 }, {}, classIn('path'))
    ],
    roads(ctx, {
      cap: 'butt', join: 'round', overlayOpacity: 0.8,
      tiers: {
        service: { color: '#222326', w: 0.3, z: 15.5 },
        minor: { color: '#3d3f46', w: 0.55, z: 13 },
        tertiary: { color: '#5a5c64', w: 0.8, z: 11.5 },
        secondary: { color: '#80838a', w: 1.15, z: 9, casing: '#050506', cw: 0.35 },
        primary: { color: '#d3d5d9', w: 2.2, z: 6, casing: '#050506', cw: 0.5 },
        trunk: { color: '#ececee', w: 2.7, z: 5, casing: '#050506', cw: 0.5 },
        motorway: { color: '#ffffff', w: 3.2, z: 4, casing: '#050506', cw: 0.5 }
      }
    }),
    places(ctx, { font: 'Noto Sans Regular', strong: 'Noto Sans Bold', color: '#d9dbe0', sub: '#7d8087', halo: '#050506', haloW: 1.3, upper: true, spacing: 0.22, k: 0.85 }),
    poi(ctx, { prefix: 'mn', font: 'Noto Sans Regular', color: '#aeb1b8', halo: '#050506', haloW: 1.2, size: 0.9, textFrom: 17 })
  )
};

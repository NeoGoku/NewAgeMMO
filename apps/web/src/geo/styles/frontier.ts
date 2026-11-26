import { boundaries, classIn, fill, flatten, land, line, places, poi, roads, symbol, label, type Ctx, type L, type StyleDef } from './kit';
import { iconSprites, pattern, rng, strokeGlyph } from './sprites';

/**
 * Frontier – Pergamentkarte: Sepiatinte, Papierstruktur, Schraffuren (Wasser/Wald), historische Schriften.
 * Höhenlinien: OpenFreeMap liefert keine Höhen-/Konturdaten, daher werden bewusst keine Höhenlinien erfunden;
 * es gibt nur Gipfelzeichen mit gemessener Höhe (mountain_peak.ele), sofern im Tile vorhanden.
 */
const P = {
  bg: '#d8c496', residential: '#d3bc8c', commercial: '#cdb482', industrial: '#c9b08a', civic: '#d0b987', park: '#cfc08f', cemetery: '#c8b88a',
  wood: '#c4b283', grass: '#d4c392', farmland: '#d9c690', sand: '#e2d1a2', rock: '#c2ae86', wetland: '#c9bc94', ice: '#e6dcc0'
};
const ink = '#4f3418';

export const frontier: StyleDef = {
  id: 'frontier',
  background: P.bg,
  sprites: [
    ...iconSprites({
      prefix: 'fr', size: 26, frame: (g, s, cat) => {
        g.fillStyle = '#e9d9ae'; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 1.2, 0, 7); g.fill();
        g.strokeStyle = ink; g.lineWidth = 1.6; g.stroke();
        g.lineWidth = 0.7; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 3.4, 0, 7); g.stroke();
        strokeGlyph(g, cat, s * 0.25, s * 0.25, s * 0.5, ink, 1.6);
      }
    }),
    { name: 'fr-peak', width: 20, height: 20, pixelRatio: 2, draw: g => { g.strokeStyle = ink; g.fillStyle = '#c5ae80'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(2, 17); g.lineTo(10, 3); g.lineTo(18, 17); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.moveTo(10, 3); g.lineTo(12, 17); g.moveTo(10, 3); g.lineTo(7, 17); g.stroke(); } },
    pattern('fr-paper', 64, (g, w) => {
      const r = rng(11);
      for (let i = 0; i < 260; i++) { g.fillStyle = r() < 0.55 ? 'rgba(90,60,25,0.07)' : 'rgba(255,248,220,0.10)'; g.fillRect(Math.floor(r() * w), Math.floor(r() * w), r() < 0.2 ? 2 : 1, 1); }
      g.strokeStyle = 'rgba(100,70,30,0.05)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(r() * w, r() * w); g.lineTo(r() * w, r() * w); g.stroke(); }
    }),
    pattern('fr-wave', 16, g => { g.strokeStyle = 'rgba(79,52,24,0.55)'; g.lineWidth = 1; for (const y of [3, 11]) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(4, y - 2, 6, y + 2, 8, y); g.bezierCurveTo(10, y - 2, 12, y + 2, 16, y); g.stroke(); } }),
    pattern('fr-forest', 16, g => { g.strokeStyle = 'rgba(79,52,24,0.55)'; g.lineWidth = 1; for (const [x, y] of [[4, 5], [12, 12]]) { g.beginPath(); g.moveTo(x - 3, y + 2); g.lineTo(x, y - 3); g.lineTo(x + 3, y + 2); g.stroke(); g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x, y + 4); g.stroke(); } }),
    pattern('fr-hatch', 6, (g, w) => { g.strokeStyle = 'rgba(79,52,24,0.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, w); g.lineTo(w, 0); g.stroke(); }),
    pattern('fr-stipple', 12, g => { const r = rng(4); g.fillStyle = 'rgba(79,52,24,0.4)'; for (let i = 0; i < 5; i++) g.fillRect(Math.floor(r() * 12), Math.floor(r() * 12), 1, 1); })
  ],
  extrusion: ctx => ({
    color: ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, ctx.c('#9a6f45'), 15, ctx.c('#8d7352'), 40, ctx.c('#a89f86'), 100, ctx.c('#c9bfa2')], opacity: 0.96, vertical: true
  }),
  layers: (ctx: Ctx) => flatten(
    !ctx.overlay && land(ctx, { ...P, base: P.bg, opacity: 0.95 }),
    !ctx.overlay && [
      fill('theme-forest-pattern', 'landcover', 8, { 'fill-pattern': ctx.img('fr-forest'), 'fill-opacity': 0.9 }, classIn('wood')),
      fill('theme-park-pattern', 'landuse', 11, { 'fill-pattern': ctx.img('fr-stipple'), 'fill-opacity': 0.9 }, classIn('park', 'garden', 'cemetery', 'recreation_ground', 'pitch')),
      fill('theme-water', 'water', 0, { 'fill-color': ctx.c('#a9b6a6') }),
      fill('theme-water-wave', 'water', 3, { 'fill-pattern': ctx.img('fr-wave'), 'fill-opacity': 0.9 }),
      line('theme-water-shore', 'water', 3, { 'line-color': ctx.c(ink), 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.7, 16, 2], 'line-opacity': 0.85 }),
      line('theme-waterway', 'waterway', 8, { 'line-color': ctx.c('#6c5a38'), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 18, 3.6] }),
      fill('theme-industrial-hatch', 'landuse', 12, { 'fill-pattern': ctx.img('fr-hatch'), 'fill-opacity': 0.8 }, classIn('industrial', 'railway', 'quarry')),
      fill('theme-aeroway', 'aeroway', 10, { 'fill-color': ctx.c('#c9b48a') })
    ],
    // Papierstruktur über Land und Wasser, unter Linien und Beschriftung
    !ctx.overlay && ({ id: 'theme-paper', type: 'background', paint: { 'background-pattern': ctx.img('fr-paper') } } as L),
    boundaries(ctx, { color: ink, w: 1.4, dash: [5, 2, 1, 2] }, { color: '#6b4a26', w: 0.9, dash: [3, 2], opacity: 0.8 }),
    // Gebäude: nur Umriss in Tinte, leichte Tönung
    !ctx.overlay && !ctx.extruded && [
      fill('theme-building', 'building', 14, { 'fill-color': ctx.c('#b99d6e'), 'fill-outline-color': ctx.c(ink), 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, 0.75] })
    ],
    !ctx.overlay && [
      line('theme-rail-bed', 'transportation', 10, { 'line-color': ctx.c(ink), 'line-width': 1.1 }, {}, classIn('rail', 'transit')),
      line('theme-rail', 'transportation', 10, { 'line-color': ctx.c(ink), 'line-width': 5, 'line-dasharray': [0.18, 2.4] }, { 'line-cap': 'butt' }, classIn('rail', 'transit')),
      line('theme-path', 'transportation', 14, { 'line-color': ctx.c('#6b4a26'), 'line-width': 1.1, 'line-dasharray': [1, 2.2] }, {}, classIn('path')),
      symbol('theme-peak', 'mountain_peak', 8, {
        'icon-image': ctx.img('fr-peak'), 'icon-size': 0.9, 'text-field': ['concat', label, '\n', ['to-string', ['coalesce', ['get', 'ele'], '']], ' m'], 'text-font': ['NAM Chronicle Regular'],
        'text-size': 11, 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-optional': true
      }, { 'text-color': ctx.c(ink), 'text-halo-color': ctx.c('#e6d6aa'), 'text-halo-width': 1.2 }, ['has', 'ele'])
    ],
    roads(ctx, {
      cap: 'butt', join: 'round', overlayOpacity: 0.9,
      tiers: {
        service: { color: '#6b4a26', w: 0.22, z: 15, dash: [2, 2] },
        minor: { color: '#6b4a26', w: 0.32, z: 12.5, dash: [4, 1.5] },
        tertiary: { color: '#5d3e1e', w: 0.42, z: 11 },
        secondary: { color: '#563817', w: 0.58, z: 9 },
        primary: { color: '#4a3014', w: 0.78, z: 6, casing: '#e3d2a6', cw: 0.5 },
        trunk: { color: '#432a10', w: 0.95, z: 5, casing: '#e3d2a6', cw: 0.5 },
        motorway: { color: '#3b240c', w: 1.15, z: 4, casing: '#e3d2a6', cw: 0.5 }
      }
    }),
    places(ctx, { font: 'NAM Chronicle Regular', strong: 'NAM Frontier Regular', color: ink, sub: '#6b4a26', halo: '#e6d6aa', haloW: 1.5, upper: false, spacing: 0.04, k: 1.1 }),
    poi(ctx, { prefix: 'fr', font: 'NAM Chronicle Regular', color: ink, halo: '#e6d6aa', haloW: 1.4, size: 0.95, textFrom: 16.4 })
  )
};

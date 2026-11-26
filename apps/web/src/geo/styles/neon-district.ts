import { boundaries, classIn, fill, flatten, land, line, places, poi, roads, type Ctx, type StyleDef } from './kit';
import { iconSprites, strokeGlyph } from './sprites';

/** Neon District – Cyberpunk-Nacht: fast schwarz, magentafarbene Siedlungskanten, cyanfarbene Labels, goldene Grenzen, selektives Leuchten nur an Hauptachsen. */
const P = {
  bg: '#05030a', residential: '#12081a', commercial: '#1a0a24', industrial: '#0b0712', civic: '#150a20', park: '#04191a', cemetery: '#07131a',
  wood: '#03171a', grass: '#041418', farmland: '#080a14', sand: '#1a1020', rock: '#0e0a16', wetland: '#04121c', ice: '#17102a'
};
const neon: Record<string, string> = { food: '#ff9a3c', shop: '#ffd23c', health: '#ff4d6a', edu: '#4dd2ff', green: '#4dff9a', transit: '#7a8dff', car: '#c8a0ff', money: '#4dffd2', culture: '#ff4dd2', lodging: '#ff8bd0', sport: '#ffb347', civic: '#d0f4ff', dot: '#9aa0ff' };

export const neonDistrict: StyleDef = {
  id: 'neon-district',
  background: P.bg,
  sprites: iconSprites({
    prefix: 'nd', size: 32, frame: (g, s, cat) => {
      g.save();
      g.shadowColor = neon[cat]; g.shadowBlur = 6;
      g.strokeStyle = neon[cat]; g.lineWidth = 1.6; g.beginPath(); g.moveTo(s / 2, 3); g.lineTo(s - 3, s / 2); g.lineTo(s / 2, s - 3); g.lineTo(3, s / 2); g.closePath(); g.stroke();
      strokeGlyph(g, cat, s * 0.3, s * 0.3, s * 0.4, '#ffffff', 1.5);
      g.restore();
    }
  }),
  extrusion: ctx => ({
    color: ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, ctx.c('#1d0b2a'), 25, ctx.c('#3a1450'), 70, ctx.c('#8a1f9a'), 180, ctx.c('#ff3cc8')], opacity: 0.9, vertical: true
  }),
  layers: (ctx: Ctx) => flatten(
    !ctx.overlay && land(ctx, { ...P, base: P.bg }),
    !ctx.overlay && [
      // Siedlungsakzent: magentafarbene Flächenkanten
      line('theme-settlement-edge', 'landuse', 8, { 'line-color': ctx.c('#ff2bd6'), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 16, 1.6], 'line-opacity': 0.45 }, {}, classIn('residential', 'commercial', 'retail', 'suburb', 'neighbourhood')),
      fill('theme-water', 'water', 0, { 'fill-color': ctx.c('#04123c') }),
      line('theme-water-shore-glow', 'water', 6, { 'line-color': ctx.c('#1f5bff'), 'line-width': 4, 'line-blur': 4, 'line-opacity': 0.55 }),
      line('theme-water-shore', 'water', 4, { 'line-color': ctx.c('#2f80ff'), 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 16, 1.6] }),
      line('theme-waterway', 'waterway', 9, { 'line-color': ctx.c('#1f5bff'), 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 18, 3] }),
      fill('theme-aeroway', 'aeroway', 10, { 'fill-color': ctx.c('#16102a') })
    ],
    boundaries(ctx, { color: '#ffc83d', w: 1.2, glow: '#ffa800' }, { color: '#b58a1d', w: 0.8, dash: [3, 3] }),
    !ctx.overlay && !ctx.extruded && [
      fill('theme-building', 'building', 14, { 'fill-color': ctx.c('#14091d'), 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 1] }),
      line('theme-building-edge', 'building', 15, { 'line-color': ctx.c('#ff2bd6'), 'line-width': 0.8, 'line-opacity': 0.6 })
    ],
    !ctx.overlay && [
      line('theme-rail-glow', 'transportation', 10, { 'line-color': ctx.c('#00e5ff'), 'line-width': 4, 'line-blur': 4, 'line-opacity': 0.35 }, {}, classIn('rail', 'transit')),
      line('theme-rail', 'transportation', 10, { 'line-color': ctx.c('#4dfcff'), 'line-width': 1, 'line-dasharray': [4, 3] }, {}, classIn('rail', 'transit')),
      line('theme-path', 'transportation', 15, { 'line-color': ctx.c('#5a3a8a'), 'line-width': 0.8, 'line-dasharray': [1, 2] }, {}, classIn('path'))
    ],
    roads(ctx, {
      cap: 'round', join: 'round', overlayOpacity: 0.85,
      tiers: {
        service: { color: '#2f2050', w: 0.28, z: 15.5 },
        minor: { color: '#43286a', w: 0.45, z: 13 },
        tertiary: { color: '#6a2f8f', w: 0.65, z: 11.5 },
        secondary: { color: '#9a35b8', w: 0.9, z: 9 },
        primary: { color: '#ff3cc8', w: 1.15, z: 6, glow: '#ff1fb0' },
        trunk: { color: '#ff6ad8', w: 1.4, z: 5, glow: '#ff1fb0' },
        motorway: { color: '#ffd6f6', w: 1.6, z: 4, glow: '#00e5ff' }
      }
    }),
    places(ctx, { font: 'NAM Neon Bold', color: '#4dfcff', sub: '#2aa8c8', halo: '#05030a', haloW: 1.8, upper: true, spacing: 0.08, k: 0.8, glow: '#00e5ff' }),
    poi(ctx, { prefix: 'nd', font: 'NAM Neon Bold', color: '#4dfcff', halo: '#05030a', haloW: 1.6, size: 1, textFrom: 16.6, upper: true })
  )
};

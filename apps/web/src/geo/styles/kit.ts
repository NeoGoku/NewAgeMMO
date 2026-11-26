import type { ExpressionSpecification, LayerSpecification, FilterSpecification } from 'maplibre-gl';

/**
 * Gemeinsamer Layer-Vertrag aller Kartenstyles (Quelle: OpenMapTiles-Schema über OpenFreeMap, Source-ID „openmap“).
 * Jeder Style liefert eigene Layer; verbindlich sind nur die IDs `theme-poi`, `theme-label`, `theme-street-label`,
 * `theme-building`, `theme-water`, `theme-road-*`, die die Spiellogik (Klick auf Karte) und die Tests voraussetzen.
 */
export const SOURCE = 'openmap';
export type L = LayerSpecification;
export type Expr = ExpressionSpecification;

export interface Ctx {
  /** Helligkeit 0.4–1 */
  b: number;
  /** Farbe mit Helligkeit abdunkeln */
  c: (hex: string) => string;
  /** Satellitenmodus: nur Overlay-Layer (Straßen, Grenzen, Beschriftung) */
  overlay: boolean;
  /** Spritename → konkrete Bild-ID (inkl. Helligkeitsstufe) */
  img: (name: string) => string;
  /** Helligkeitsstufe der Sprites (1–10) */
  bucket: number;
  /** 3D-Modus: flache Gebäude entfallen, Extrusion übernimmt */
  extruded: boolean;
}

export interface SpriteDef {
  name: string; width: number; height: number; pixelRatio: number;
  /** Harte Pixelkanten (Alpha-Schwelle) für Pixelart */
  hard?: boolean;
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void;
}

export interface ExtrusionDef { color: Expr | string; opacity: number; vertical: boolean }

export interface StyleDef {
  id: string;
  background: string;
  sprites: SpriteDef[];
  layers: (ctx: Ctx) => L[];
  extrusion: (ctx: Ctx) => ExtrusionDef;
}

export const hex = (value: string, brightness: number) => {
  const rgb = value.slice(1).match(/../g)!;
  return `rgb(${rgb.map(channel => Math.round(parseInt(channel, 16) * brightness)).join(',')})`;
};

const vis = (on: boolean) => on ? 'visible' : 'none';
export const classIn = (...classes: string[]): Expr => ['in', ['get', 'class'], ['literal', classes]];
export const label: Expr = ['coalesce', ['get', 'name_de'], ['get', 'name_int'], ['get', 'name']];
const notTunnel: Expr = ['!=', ['get', 'brunnel'], 'tunnel'];

type Paint<T extends L> = T extends { paint?: infer P } ? P : never;
export const fill = (id: string, layer: string, minzoom: number, paint: Paint<Extract<L, { type: 'fill' }>>, filter?: FilterSpecification, o: Partial<L> & { max?: number } = {}): L =>
  ({ id, type: 'fill', source: SOURCE, 'source-layer': layer, minzoom, ...(o.max ? { maxzoom: o.max } : {}), ...(filter ? { filter } : {}), paint, ...(o.metadata ? { metadata: o.metadata } : {}) }) as L;
export const line = (id: string, layer: string, minzoom: number, paint: Paint<Extract<L, { type: 'line' }>>, layout: Record<string, unknown> = {}, filter?: FilterSpecification, o: { max?: number; overlay?: boolean } = {}): L =>
  ({ id, type: 'line', source: SOURCE, 'source-layer': layer, minzoom, ...(o.max ? { maxzoom: o.max } : {}), ...(filter ? { filter } : {}), layout, paint, metadata: o.overlay ? { overlay: true } : undefined }) as L;
export const symbol = (id: string, layer: string, minzoom: number, layout: Record<string, unknown>, paint: Record<string, unknown>, filter?: FilterSpecification, o: { max?: number; overlay?: boolean } = {}): L =>
  ({ id, type: 'symbol', source: SOURCE, 'source-layer': layer, minzoom, ...(o.max ? { maxzoom: o.max } : {}), ...(filter ? { filter } : {}), layout, paint, metadata: o.overlay ? { overlay: true } : undefined }) as L;

/* ---------- Landnutzung / Landbedeckung ---------- */
export interface LandPalette {
  base?: string; residential: string; commercial: string; industrial: string; civic: string; park: string; cemetery: string;
  wood: string; grass: string; farmland: string; sand: string; rock: string; wetland: string; ice: string;
  opacity?: number;
}
export function land(ctx: Ctx, p: LandPalette): L[] {
  const c = ctx.c;
  const op = p.opacity ?? 1;
  return [
    fill('theme-landcover', 'landcover', 0, {
      'fill-color': ['match', ['get', 'class'], 'wood', c(p.wood), 'grass', c(p.grass), 'farmland', c(p.farmland), 'sand', c(p.sand),
        'rock', c(p.rock), 'wetland', c(p.wetland), 'ice', c(p.ice), c(p.grass)], 'fill-opacity': op, 'fill-antialias': false
    }),
    fill('theme-landuse', 'landuse', 4, {
      'fill-color': ['match', ['get', 'class'],
        ['residential', 'suburb', 'neighbourhood', 'quarter'], c(p.residential), ['commercial', 'retail'], c(p.commercial),
        ['industrial', 'railway', 'quarry', 'garages'], c(p.industrial), ['hospital', 'school', 'university', 'college', 'kindergarten', 'stadium', 'military'], c(p.civic),
        ['cemetery'], c(p.cemetery), ['park', 'garden', 'playground', 'pitch', 'recreation_ground', 'golf_course', 'allotments', 'zoo', 'theme_park', 'dog_park'], c(p.park), c(p.residential)],
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0, 8, 0.55 * op, 12, op]
    })
  ];
}

/* ---------- Straßenhierarchie ---------- */
export type Tier = 'service' | 'minor' | 'tertiary' | 'secondary' | 'primary' | 'trunk' | 'motorway';
export interface RoadTier {
  color: string; casing?: string; /** Breitenfaktor relativ zur Grundkurve */ w: number; cw?: number; z: number; dash?: number[];
  glow?: string; opacity?: number;
}
const tierClasses: Record<Tier, string[]> = {
  service: ['service', 'track', 'raceway'], minor: ['minor', 'busway'], tertiary: ['tertiary'],
  secondary: ['secondary'], primary: ['primary'], trunk: ['trunk'], motorway: ['motorway']
};
export const TIER_ORDER: Tier[] = ['service', 'minor', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway'];
export const widthCurve = (f: number): Expr => ['interpolate', ['exponential', 1.55], ['zoom'], 5, 0.15 * f, 8, 0.5 * f, 11, 1.1 * f, 14, 2.6 * f, 17, 7 * f, 20, 22 * f];
export interface RoadStack {
  tiers: Partial<Record<Tier, RoadTier>>; cap: 'butt' | 'round' | 'square'; join: 'round' | 'miter' | 'bevel';
  /** Overlay-Straßen (Satellit) – Deckkraft */ overlayOpacity?: number;
  /** Mittellinie auf Hauptstraßen */ centre?: { color: string; dash: number[]; from?: Tier[]; w?: number };
  /** Eigene Breitenkurve (z. B. ganzzahlig für Pixelart) */ widthFn?: (factor: number) => Expr;
}
export function roads(ctx: Ctx, s: RoadStack): L[] {
  const c = ctx.c;
  const out: L[] = [];
  const layout = { 'line-cap': s.cap, 'line-join': s.join };
  const width = s.widthFn ?? widthCurve;
  const _unused: FilterSpecification = ['!', ['in', ['get', 'class'], ['literal', ['rail', 'transit', 'ferry', 'path', 'pier', 'aerialway', 'bus_guideway']]]] as unknown as FilterSpecification;
  void _unused;
  for (const tier of TIER_ORDER) {
    const t = s.tiers[tier];
    if (!t) continue;
    const filter = ['all', classIn(...tierClasses[tier]), ['!=', ['get', 'brunnel'], 'tunnel']] as FilterSpecification;
    const tunnel = ['all', classIn(...tierClasses[tier]), ['==', ['get', 'brunnel'], 'tunnel']] as FilterSpecification;
    const opacity = ctx.overlay ? (s.overlayOpacity ?? 0.8) : (t.opacity ?? 1);
    if (t.glow && !ctx.overlay) out.push(line(`theme-road-glow-${tier}`, 'transportation', t.z, { 'line-color': c(t.glow), 'line-width': width(t.w * 3.4), 'line-blur': ['interpolate', ['linear'], ['zoom'], 8, 2, 17, 10], 'line-opacity': 0.42 }, layout, filter));
    if (t.casing && !ctx.overlay) out.push(line(`theme-road-casing-${tier}`, 'transportation', t.z, { 'line-color': c(t.casing), 'line-width': width(t.w + (t.cw ?? 0.45)) }, layout, filter));
    out.push(line(`theme-road-${tier}`, 'transportation', t.z, {
      'line-color': c(t.color), 'line-width': width(ctx.overlay ? t.w * 0.7 : t.w), 'line-opacity': opacity, ...(t.dash ? { 'line-dasharray': t.dash } : {})
    }, layout, filter, { overlay: true }));
    out.push(line(`theme-road-tunnel-${tier}`, 'transportation', Math.max(t.z, 11), {
      'line-color': c(t.casing ?? t.color), 'line-width': width(t.w * 0.8), 'line-opacity': 0.5, 'line-dasharray': [2, 1.2]
    }, layout, tunnel, { overlay: true }));
  }
  if (s.centre && !ctx.overlay) {
    const from = s.centre.from ?? ['primary', 'trunk', 'motorway'];
    out.push(line('theme-road-centre', 'transportation', 13, {
      'line-color': c(s.centre.color), 'line-width': width(s.centre.w ?? 0.08), 'line-dasharray': s.centre.dash
    }, { 'line-cap': 'butt' }, classIn(...from.flatMap(t => tierClasses[t]))));
  }
  return out;
}

export const isPath = classIn('path');

/* ---------- Ortsbeschriftung ---------- */
export interface Labels {
  font: string; strong?: string; color: string; sub?: string; halo: string; haloW: number; upper?: boolean; spacing?: number;
  sizes?: [number, number]; /** Größenfaktor */ k?: number; glow?: string;
}
export function places(ctx: Ctx, l: Labels): L[] {
  const c = ctx.c, k = l.k ?? 1;
  const paint = (col: string) => ({
    'text-color': c(col), 'text-halo-color': c(l.halo), 'text-halo-width': l.haloW, 'text-halo-blur': l.glow ? 1.2 : 0.2,
    ...(l.glow ? {} : {})
  });
  const lay = (font: string, size: Expr, upper?: boolean, extra: Record<string, unknown> = {}) => ({
    'text-field': label, 'text-font': [font], 'text-size': size, 'text-letter-spacing': l.spacing ?? 0.05,
    'text-transform': upper ? 'uppercase' : 'none', 'text-max-width': 8, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 100], ...extra
  });
  const cls = (...v: string[]) => classIn(...v);
  const strong = l.strong ?? l.font;
  return [
    symbol('theme-label-country', 'place', 1, lay(strong, ['interpolate', ['linear'], ['zoom'], 1, 9 * k, 4, 13 * k, 7, 17 * k], true, { 'text-letter-spacing': (l.spacing ?? 0.05) + 0.1 }), paint(l.color), cls('country'), { max: 8, overlay: true }),
    symbol('theme-label-state', 'place', 4, lay(l.font, ['interpolate', ['linear'], ['zoom'], 4, 9 * k, 8, 13 * k], true, { 'text-letter-spacing': 0.18 }), paint(l.sub ?? l.color), cls('state', 'province'), { max: 9, overlay: true }),
    symbol('theme-label', 'place', 3, lay(strong, ['interpolate', ['linear'], ['zoom'], 3, ['match', ['get', 'class'], 'city', 10 * k, 8 * k], 8, ['match', ['get', 'class'], 'city', 15 * k, 'town', 12 * k, 10 * k],
      14, ['match', ['get', 'class'], 'city', 21 * k, 'town', 17 * k, 13 * k], 18, ['match', ['get', 'class'], ['city', 'town'], 22 * k, 16 * k]], l.upper), paint(l.color),
    cls('city', 'town', 'village', 'hamlet', 'suburb', 'quarter', 'neighbourhood', 'island', 'isolated_dwelling'), { overlay: true }),
    symbol('theme-label-water', 'water_name', 1, lay(l.font, ['interpolate', ['linear'], ['zoom'], 1, 9 * k, 14, 14 * k], false, { 'text-letter-spacing': 0.2 }), paint(l.sub ?? l.color), undefined, { overlay: true }),
    symbol('theme-street-label', 'transportation_name', 13, {
      'symbol-placement': 'line', 'text-field': label, 'text-font': [l.font], 'text-size': ['interpolate', ['linear'], ['zoom'], 13, 9 * k, 19, 13 * k],
      'text-letter-spacing': (l.spacing ?? 0.05) / 2, 'text-transform': l.upper ? 'uppercase' : 'none', 'text-max-angle': 30
    }, paint(l.sub ?? l.color), undefined, { overlay: true })
  ];
}

/* ---------- Grenzen, Gewässerlinien, POI ---------- */
export function boundaries(ctx: Ctx, country: { color: string; w: number; dash?: number[]; glow?: string }, state?: { color: string; w: number; dash?: number[]; opacity?: number }): L[] {
  const c = ctx.c;
  const notMaritime: FilterSpecification = ['!=', ['get', 'maritime'], 1] as unknown as FilterSpecification;
  const out: L[] = [];
  if (country.glow) out.push(line('theme-boundary-glow', 'boundary', 0, { 'line-color': c(country.glow), 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 1.5, 8, 5], 'line-blur': 3, 'line-opacity': 0.28 }, {}, ['all', ['<=', ['get', 'admin_level'], 2], notMaritime] as FilterSpecification, { overlay: true }));
  out.push(line('theme-boundary', 'boundary', 0, {
    'line-color': c(country.color), 'line-width': ['interpolate', ['linear'], ['zoom'], 0, country.w * 0.6, 10, country.w * 1.5], ...(country.dash ? { 'line-dasharray': country.dash } : {})
  }, { 'line-join': 'round' }, ['all', ['<=', ['get', 'admin_level'], 2], notMaritime] as FilterSpecification, { overlay: true }));
  if (state) out.push(line('theme-boundary-state', 'boundary', 4, {
    'line-color': c(state.color), 'line-width': state.w, 'line-opacity': state.opacity ?? 0.7, ...(state.dash ? { 'line-dasharray': state.dash } : {})
  }, {}, ['all', ['>=', ['get', 'admin_level'], 3], ['<=', ['get', 'admin_level'], 4], notMaritime] as FilterSpecification, { overlay: true }));
  return out;
}

export const POI_CATEGORIES = ['food', 'shop', 'health', 'edu', 'green', 'transit', 'car', 'money', 'culture', 'lodging', 'sport', 'civic', 'dot'] as const;
export type PoiCategory = typeof POI_CATEGORIES[number];
const poiClasses: Record<Exclude<PoiCategory, 'dot'>, string[]> = {
  food: ['restaurant', 'fast_food', 'cafe', 'bar', 'pub', 'ice_cream', 'biergarten', 'food_court'],
  shop: ['shop', 'grocery', 'clothing_store', 'convenience', 'bakery', 'butcher', 'florist', 'jewelry', 'bicycle', 'furniture', 'hardware', 'supermarket', 'mall', 'department_store', 'books', 'electronics', 'alcohol_shop', 'marketplace', 'toys'],
  health: ['hospital', 'pharmacy', 'doctors', 'dentist', 'veterinary', 'clinic'],
  edu: ['school', 'college', 'university', 'kindergarten', 'library'],
  green: ['park', 'playground', 'garden', 'dog_park', 'campsite', 'picnic_site', 'zoo', 'nature_reserve'],
  transit: ['railway', 'bus', 'subway', 'tram_stop', 'airport', 'ferry_terminal', 'harbor', 'bus_station', 'aerialway_station'],
  car: ['fuel', 'parking', 'charging_station', 'car_repair', 'car', 'car_wash', 'bicycle_parking', 'bicycle_rental'],
  money: ['bank', 'atm'],
  culture: ['museum', 'theatre', 'cinema', 'art_gallery', 'attraction', 'monument', 'castle', 'viewpoint', 'information', 'zoo', 'town_hall'],
  lodging: ['lodging', 'hotel', 'hostel', 'guest_house', 'camp_site'],
  sport: ['stadium', 'sports_centre', 'swimming', 'fitness_centre', 'golf', 'pitch', 'swimming_pool', 'ice_rink'],
  civic: ['police', 'fire_station', 'post', 'courthouse', 'place_of_worship', 'embassy', 'prison', 'town_hall', 'social_facility']
};
const seenPoi = new Set<string>();
export const poiCategory: Expr = ['match', ['get', 'class'],
  ...(Object.entries(poiClasses) as [string, string[]][]).flatMap(([cat, list]) => {
    const fresh = list.filter(x => !seenPoi.has(x));
    fresh.forEach(x => seenPoi.add(x));
    return [fresh, cat];
  }), 'dot'] as unknown as Expr;

export interface PoiCfg {
  prefix: string; font: string; color: string; halo: string; haloW: number; size: number; textFrom: number; upper?: boolean; textOffset?: number[];
}
export function poi(ctx: Ctx, p: PoiCfg): L[] {
  const c = ctx.c;
  const layout = (minText: number) => ({
    'icon-image': ['concat', p.prefix + '-', poiCategory, `@${ctx.bucket}`], 'icon-size': ['interpolate', ['linear'], ['zoom'], 14, p.size * 0.85, 19, p.size * 1.15], 'icon-allow-overlap': false, 'icon-padding': 3,
    'text-field': ['step', ['zoom'], '', minText, label], 'text-font': [p.font], 'text-size': 10, 'text-offset': p.textOffset ?? [0, 1.25], 'text-anchor': 'top', 'text-optional': true, 'text-max-width': 7,
    'text-transform': p.upper ? 'uppercase' : 'none', 'symbol-sort-key': ['coalesce', ['get', 'rank'], 100]
  });
  const paint = { 'text-color': c(p.color), 'text-halo-color': c(p.halo), 'text-halo-width': p.haloW };
  return [
    symbol('theme-poi', 'poi', 14, layout(p.textFrom), paint, ['<=', ['coalesce', ['get', 'rank'], 100], 24]),
    symbol('theme-poi-minor', 'poi', 17, layout(p.textFrom + 0.5), paint, ['>', ['coalesce', ['get', 'rank'], 100], 24])
  ];
}

export function flatten(...groups: (L | L[] | false | undefined)[]): L[] {
  return groups.flat().filter((x): x is L => !!x);
}
export const visibility = vis;
export { notTunnel };

import { POI_CATEGORIES, type PoiCategory, type SpriteDef } from './kit';

/** Eigene Piktogramme (24×24-Raster, Linienzeichnung). Keine fremden Icon-Sets. */
const glyphs: Record<PoiCategory, string[]> = {
  food: ['M8 3v6a2 2 0 0 1-2 2M8 3v18M12 3v6a2 2 0 0 1-2 2M17 3c-2 2-3 5-3 9h3v9'],
  shop: ['M5 8h14l-1 13H6zM9 8a3 3 0 0 1 6 0'],
  health: ['M12 4v16M4 12h16'],
  edu: ['M2 9l10-5 10 5-10 5zM6 11.5V16c3 3 9 3 12 0v-4.5'],
  green: ['M12 3l6 9h-4l5 7H5l5-7H6zM12 19v3'],
  transit: ['M6 3h12v14H6zM6 11h12M9 21l-2-4M15 21l2-4'],
  car: ['M5 21V4h9v17M3 21h13M14 9h3a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V8l-3-3M7 8h5'],
  money: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v10M9 9.5h4.5a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H15'],
  culture: ['M3 9l9-5 9 5zM5 10v9M10 10v9M14 10v9M19 10v9M3 21h18'],
  lodging: ['M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6'],
  sport: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c-4 4-4 14 0 18M12 3c4 4 4 14 0 18'],
  civic: ['M6 3v18M6 4h12l-3 4 3 4H6'],
  dot: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z']
};

export function strokeGlyph(g: CanvasRenderingContext2D, cat: PoiCategory, x: number, y: number, size: number, color: string, lineWidth: number) {
  g.save();
  g.translate(x, y); g.scale(size / 24, size / 24);
  g.strokeStyle = color; g.lineWidth = lineWidth * 24 / size; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const d of glyphs[cat]) g.stroke(new Path2D(d));
  g.restore();
}

export interface IconKit {
  prefix: string; size: number; pixelRatio?: number; hard?: boolean;
  frame: (g: CanvasRenderingContext2D, s: number, cat: PoiCategory) => void;
}
/** Erzeugt für jede POI-Kategorie ein Sprite `${prefix}-${cat}`. */
export function iconSprites(kit: IconKit): SpriteDef[] {
  return POI_CATEGORIES.map(cat => ({
    name: `${kit.prefix}-${cat}`, width: kit.size, height: kit.size, pixelRatio: kit.pixelRatio ?? 2, hard: kit.hard,
    draw: (g, w) => kit.frame(g, w, cat)
  }));
}

/** Farbpalette je Kategorie (eigene Farbcodierung). */
export const categoryColor: Record<PoiCategory, string> = {
  food: '#ff9a3c', shop: '#ffd23c', health: '#ff4d5e', edu: '#4db8ff', green: '#5ccf6a', transit: '#6a8dff', car: '#b9b9a3',
  money: '#7be0a8', culture: '#c58bff', lodging: '#ff8bd0', sport: '#ffb347', civic: '#e0e0e0', dot: '#cfcfcf'
};

/** Pseudozufall für reproduzierbare Texturen */
export const rng = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

/** Kachelbares Muster aus Punkten/Strichen. */
export function pattern(name: string, size: number, draw: SpriteDef['draw'], hard = false): SpriteDef {
  return { name, width: size, height: size, pixelRatio: 1, hard, draw };
}

export const dot = (g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) => { g.fillStyle = color; g.fillRect(x, y, s, s); };

/** Rastert ein Sprite (optional hart) und dunkelt es ab. */
export function rasterize(def: SpriteDef, brightness: number) {
  const canvas = document.createElement('canvas');
  canvas.width = def.width; canvas.height = def.height;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = !def.hard;
  def.draw(g, def.width, def.height);
  const image = g.getImageData(0, 0, def.width, def.height);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    if (def.hard) d[i + 3] = d[i + 3] >= 110 ? 255 : 0;
    d[i] = d[i] * brightness; d[i + 1] = d[i + 1] * brightness; d[i + 2] = d[i + 2] * brightness;
  }
  return { width: def.width, height: def.height, data: new Uint8Array(d.buffer.slice(0)) };
}

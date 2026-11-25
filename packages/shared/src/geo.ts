/** Geo-Protokoll & Hilfsfunktionen (Client + Server). Koordinaten: WGS84 Grad. */
export const GEO = {
  cellDeg: 0.0025, // ≈ 280 m Rasterzelle für dynamische Spawns
  interactM: 120, // Interaktionsradius in Metern
  viewM: 1200, // Sichtradius für Objekte
  playerQuantDeg: 0.001, // andere Spieler nur auf ≈100 m gerundet sichtbar (Datenschutz)
  maxSpeed: { gps: 45, virtual: 30 } as Record<string, number>, // m/s Obergrenzen (Manipulationsschutz)
  virtualSpeed: 14, // m/s virtuelles Laufen
  spawnBucketMs: 20 * 60e3, // Spawns rotieren alle 20 Minuten
  minPosIntervalMs: 900,
};
export type GeoKind = 'mob' | 'node' | 'dungeon' | 'city' | 'house' | 'npc' | 'station' | 'poi';
export interface GeoObj { id: string; k: GeoKind; def: string; lat: number; lon: number; name: string; lvl?: number; fam?: string; role?: string; r?: number; extra?: any }
export interface GeoPlayer { id: string; name: string; cls: string; lvl: number; lat: number; lon: number }
/** Server→Client `geo`: { t:'geo', me:{lat,lon,mode,speed,flags:string[]}, objs:GeoObj[], players:GeoPlayer[], rev:number } ; Client→Server: geoConsent{on}, geoPos{lat,lon,acc,mode,t}, geoWalk{lat,lon}, geoStop{}, geoInteract{id}, geoWipe{} (Daten löschen) */
export const R_EARTH = 6371008.8;
export const rad = (d: number) => d * Math.PI / 180;
export function haversine(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon); const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2; return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
}
export const cellOf = (lat: number, lon: number) => [Math.floor(lat / GEO.cellDeg), Math.floor(lon / GEO.cellDeg)] as const;
export const cellId = (cy: number, cx: number) => `${cy}:${cx}`;
export function moveToward(lat: number, lon: number, tLat: number, tLon: number, meters: number) { const d = haversine(lat, lon, tLat, tLon); if (d <= meters) return { lat: tLat, lon: tLon, arrived: true }; const f = meters / d; return { lat: lat + (tLat - lat) * f, lon: lon + (tLon - lon) * f, arrived: false }; }
export const quant = (v: number, q: number) => Math.round(v / q) * q;
export function hash32(s: string) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GEO, haversine, type GeoObj, type GeoPlayer, type GeoTravelMode, type GeoTravelView } from '@nam/shared';
import { set, useS } from '../store';
import { MOBS, QUESTS } from '@nam/game-data';
import { mobIconUrl, portraitUrl } from '../render';
import { RoutePlanner, TravelStatus, type RouteLine, type RouteTarget } from './RoutePlanner';
import { MapDesignMenu } from './MapDesignMenu';
import { Joystick } from './Joystick';
import { applyMapPreferences, mapPreferences, mapStyle, saveMapPreferences, type MapKind, type MapTheme } from './map-style';
import { distanceLabel, pinLabels, questPins, type QuestPinRole } from './quest-map';
import { clusterMarkers, drawMarkerIcon, MARKER_CATEGORIES, markerCategories, PROPERTY_MARKER_STATUSES, propertyMarkerStatus, propertyMarkerType, type MarkerCategory } from './map-markers';
import { geoBus } from './bus';
import { net } from '../net';
import { toast } from '../store';
import { audio } from '../audio';

const KEY = 'nam.geo.consent';
type Consent = 'gps' | 'virtual';
type Mode = 'gps' | 'virtual';
interface Me { lat: number; lon: number; mode?: string; regionLabel?: string; speed?: number; etaSeconds?: number; dest?: { lat: number; lon: number } | null; flags?: string[]; travel?: GeoTravelView | null; travelModes?: GeoTravelMode[] }
interface Destination { id: string; name: string; cost: number }

const readConsent = (): Consent => { try { const v = localStorage.getItem(KEY); return v === 'gps' ? 'gps' : 'virtual'; } catch { return 'virtual'; } };
const saveConsent = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* kein Storage */ } };

const markerCategoryKeys = Object.keys(MARKER_CATEGORIES) as MarkerCategory[];
const questMarkerCategory = { giver: 'questGiver', objective: 'questObjective', turnin: 'questTurnIn' } as const;
type MapTarget = { object: GeoObj; player?: undefined } | { player: GeoPlayer; object?: undefined };
type MarkerTarget = MapTarget & { id: string; lat: number; lon: number; radius: number; category: MarkerCategory; near: boolean };

function circle(lat: number, lon: number, r: number, n = 64) {
  const pts: number[][] = []; const dLat = r / 111320; const dLon = r / (111320 * Math.max(0.05, Math.cos(lat * Math.PI / 180)));
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; pts.push([lon + Math.cos(a) * dLon, lat + Math.sin(a) * dLat]); }
  return pts;
}
const poly = (lat: number, lon: number, r: number, props: any = {}) => ({ type: 'Feature' as const, properties: props, geometry: { type: 'Polygon' as const, coordinates: [circle(lat, lon, r)] } });
const fc = (features: any[]) => ({ type: 'FeatureCollection' as const, features });

const CSS = `
.geo{position:absolute;inset:0;z-index:1;color:#d6f7ff;font:13px/1.3 system-ui,sans-serif}
.geo .map{position:absolute;inset:0}
.geo .maplibregl-ctrl-attrib{background:#0008!important;color:#8fa3b8!important;font-size:10px}
.geo .top{position:absolute;left:50%;top:calc(76px + var(--sat));transform:translateX(-50%);max-width:calc(100% - 24px);width:max-content;z-index:5;pointer-events:none;text-align:center}
.geo .status{background:#04101ccc;border:1px solid #1ee8ff55;border-radius:99px;padding:4px 12px;font-size:12px;letter-spacing:.02em;overflow-wrap:anywhere;box-shadow:0 0 14px #1ee8ff22}
.geo .status .bad{color:#ff6b7a;margin-top:2px}
.geo .side{position:absolute;right:calc(10px + var(--sar));top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px;z-index:5}
.geo button{background:#06121fe6;color:#cdeeff;border:1px solid #1ee8ff66;border-radius:12px;min-width:44px;min-height:44px;padding:0 10px;font:inherit;box-shadow:0 0 12px #1ee8ff22}
.geo button.on{background:#0c3a4acc;border-color:#5ef2ff;box-shadow:0 0 16px #5ef2ff66}
.geo .side button{width:44px;padding:0}
.geo .side .map-settings-toggle{display:grid;place-items:center;border-color:#75def3;background:#092333}
.geo .map-settings-head button{min-width:34px;min-height:34px;padding:0}
.geo .settings [role=tablist] button{flex:1;min-height:40px;padding:0 6px}
.geo .map-types{display:grid;gap:6px}
.geo .map-previews{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
.geo .map-previews button{display:grid;gap:4px;padding:4px;min-width:0;min-height:0;font-size:11px}
.geo .map-previews img{display:block;width:100%;height:auto;border-radius:6px}
.geo .settings .reset-theme{margin-top:6px;min-height:32px}
.geo .settings details label{margin-top:8px}
.geo .route-panel{position:absolute;z-index:8;left:50%;translate:-50% 0;bottom:calc(var(--navh) + 55px + var(--sab));width:min(358px,calc(100% - 20px));max-height:48%;overflow:auto;display:grid;gap:7px;padding:10px 12px;border:1px solid #52d2e6;border-radius:12px;background:#061824f7;box-shadow:0 8px 32px #0009}
.geo .route-panel button{min-height:40px;min-width:0}
.geo .route-panel label{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
.geo .route-pin{width:19px;height:19px;border-radius:50% 50% 50% 0;border:2px solid #fbfbdb;background:#ffac4e;box-shadow:0 0 10px #ffac4e;pointer-events:none}
.geo .map .maplibregl-marker{position:absolute}
.geo .mk{border-radius:50%;border:2px solid var(--marker-color,#83d7ef);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--marker-color,#c7f2ff);font-size:12px;background:#0a1927;box-shadow:0 2px 8px #030d18b3;cursor:pointer}
.geo .mk.near{box-shadow:0 0 0 3px #5ef2ff,0 0 18px #5ef2ff}
.geo .mk .lbl{display:none;position:absolute;top:100%;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:11px;margin-top:3px;padding:2px 5px;border-radius:4px;background:#04101cf0;pointer-events:none}
.geo .mk:hover,.geo .mk:focus-visible{z-index:3}
.geo .mk:hover .lbl,.geo .mk:focus-visible .lbl{display:block}
.geo .mk svg,.geo .quest-pin svg,.geo .marker-legend svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
.geo .marker-cluster{width:43px;height:43px;border-radius:50%;outline:2px solid #0b233fa0;outline-offset:2px;font-size:14px}
.geo .marker-legend{position:absolute;z-index:10;right:calc(62px + var(--sar));top:50%;transform:translateY(-50%);width:min(318px,calc(100% - 82px));max-height:calc(100% - 135px - var(--sat) - var(--sab));overflow:auto;display:grid;gap:10px;padding:12px;border:1px solid #67d7e8;border-radius:12px;background:#051421f5}
.geo .marker-legend h3,.geo .marker-list h3{margin:0}
.geo .marker-legend-head,.geo .marker-list-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
.geo .marker-legend-head button,.geo .marker-list-head button{min-width:34px;min-height:34px;padding:0}
.geo .marker-legend ul{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:4px 8px}
.geo .marker-legend label{display:flex;align-items:center;gap:6px;min-height:34px;cursor:pointer}
.geo .marker-legend svg{flex:none}
.geo .marker-legend input{margin:0;accent-color:#5ef2ff}
.geo .marker-legend-actions{display:flex;gap:6px;flex-wrap:wrap}
.geo .marker-legend-actions button{min-height:34px}
.geo .property-legend{display:flex;flex-wrap:wrap;gap:8px;padding-top:8px;border-top:1px solid #395365}
.geo .property-legend span{display:flex;gap:4px;align-items:center;font-size:11px}
.geo .property-legend b{border:1px solid currentColor;border-radius:4px;min-width:14px;text-align:center}
.geo .marker-list{max-height:40dvh;overflow:auto}
.geo .marker-list ul{display:grid;gap:5px;list-style:none;padding:0;margin:8px 0 0}
.geo .marker-list li button{width:100%;height:auto;min-height:38px;text-align:left}
.geo .property-status{position:absolute;right:-7px;top:-6px;min-width:14px;min-height:14px;padding:0 2px;border-radius:5px;background:#071520;border:1px solid currentColor;font-size:10px;line-height:12px;pointer-events:none}
.geo .mk.boss{animation:gpulse 1.6s infinite}
@keyframes gpulse{50%{box-shadow:0 0 0 6px #c46cff55,0 0 24px #c46cff}}
.geo .me{width:37px;height:37px;z-index:4;border-radius:50%;background:#073745 center/cover;border:2px solid #affcff;box-shadow:0 0 0 4px #06cef640,0 0 15px #16dcfa;pointer-events:none}
.geo .me::after{content:'';position:absolute;bottom:-7px;left:50%;width:8px;height:8px;transform:translateX(-50%) rotate(45deg);background:#affcff}
.geo .mk{padding:0;min-width:0;min-height:0}
.geo .mob-token{border-radius:11px;z-index:2;box-shadow:0 2px 8px #07111b,0 0 8px #ff526477}
.geo .mob-token img{display:block;width:100%;height:100%;object-fit:contain;pointer-events:none;animation:mob-idle 2s ease-in-out infinite}
.geo .mob-token .level{position:absolute;right:-7px;bottom:-5px;padding:1px 4px;background:#110b16;border:1px solid #ffc2c4;border-radius:6px;color:#fff;font-size:10px;line-height:1.2}
@keyframes mob-idle{50%{transform:translateY(-3px)}}
@media(prefers-reduced-motion:reduce){.geo .mob-token img,.geo .mk.boss{animation:none}}
.geo .geo-manual{position:absolute;left:calc(14px + var(--sal));bottom:calc(var(--navh) + 16px + var(--sab));z-index:6;display:grid;justify-items:center;gap:5px}
.geo .geo-manual select{max-width:105px;min-height:34px;background:#061824ec;color:#fff;border:1px solid #66e6fbaf;border-radius:6px}
.geo button.geo-stick{width:88px;height:88px;padding:0;border-radius:50%;touch-action:none;background:#05132156;border:1px solid #66e6fbaf;display:grid;place-items:center;z-index:6}
.geo-stick span{width:31px;height:31px;border-radius:100%;background:#38dcf6a0;border:1px solid #abf9ff;box-shadow:0 0 14px #22c5e466;pointer-events:none}
.geo .settings{position:absolute;z-index:10;right:calc(62px + var(--sar));top:50%;transform:translateY(-50%);width:min(290px,calc(100% - 82px));max-height:calc(100% - 100px - var(--sat) - var(--sab));overflow:auto;display:grid;gap:10px;background:#051421f2;border:1px solid #67d7e8;border-radius:12px;padding:12px}
.geo .settings label{display:grid;gap:4px}
.geo .quest-track{position:absolute;left:50%;transform:translateX(-50%);width:min(330px,calc(100% - 26px));bottom:calc(var(--navh) + 120px + var(--sab));z-index:5;border:1px solid #ffd87090;background:#111d27ed;border-radius:12px;padding:8px 10px;font-size:12px}
.geo .quest-track .row{gap:4px;flex-wrap:wrap}
.geo .quest-track button{min-width:0;min-height:32px;padding:0 7px}
.geo .quest-pin{min-width:0;min-height:0;width:26px;height:26px;border-radius:50%;padding:0;z-index:3;box-shadow:0 2px 8px #04111a}
.geo .quest-pin.giver{border-color:#ffda65;color:#ffda65}
.geo .quest-pin.objective{border-color:#80f6b2;color:#80f6b2}
.geo .quest-pin.turnin{border-color:#d7a6ff;color:#d7a6ff}
.geo .pop{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--navh) + 150px + var(--sab));z-index:12;background:#04101cf2;border:1px solid #1ee8ff88;border-radius:14px;padding:12px 14px;width:min(320px,92vw);box-shadow:0 10px 40px #000a,0 0 24px #1ee8ff33}
.geo .pop h3{margin:0 0 2px;font-size:16px;color:#eaffff}
.geo .pop .dim{color:#7fa3b8;font-size:12px}
.geo .pop .row{display:flex;gap:8px;margin-top:10px}
.geo .pop .row button{flex:1}
.geo .portal-destinations{display:grid;gap:6px;margin-top:8px;max-height:28vh;overflow:auto}
`

export function GeoScreen({ hidden, controlsBlocked }: { hidden?: boolean; controlsBlocked?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const meRef = useRef<Me | null>(null);
  const gpsPos = useRef<{ lat: number; lon: number; acc: number } | null>(null);
  const objsRef = useRef<GeoObj[]>([]);
  const playersRef = useRef<GeoPlayer[]>([]);
  const mkObj = useRef(new Map<string, { m: maplibregl.Marker; el: HTMLButtonElement; sig: string; onClick: () => void }>());
  const redrawMarkers = useRef<() => void>(() => {});
  const meMk = useRef<maplibregl.Marker | null>(null);
  const followRef = useRef(true);
  const modeRef = useRef<Mode>('virtual');
  const targetRef = useRef<{ lat: number; lon: number } | null>(null);
  const redraw = useRef<() => void>(() => { /* init */ });
  const lastStepAt = useRef(0);
  const moveAvatar = useRef<(me: Me | null) => void>(() => {});
  const questMarkers = useRef(new Map<string, maplibregl.Marker>());
  const focusedQuest = useRef<object | null>(null);
  const blockedRef = useRef(controlsBlocked);
  blockedRef.current = controlsBlocked || hidden;
  const [preferences, setPreferences] = useState(mapPreferences);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const [routeTarget, setRouteTarget] = useState<RouteTarget | null>(null);
  const [previewLine, setPreviewLine] = useState<RouteLine | null>(null);
  const [activeLine, setActiveLine] = useState<RouteLine | null>(null);
  const [travel, setTravel] = useState<GeoTravelView | null>(null);
  const [pickTarget, setPickTarget] = useState(false);
  const routePin = useRef<maplibregl.Marker | null>(null);
  const [mapSettings, setMapSettings] = useState(false);
  const [markerLegend, setMarkerLegend] = useState(false);
  const [markerFilters, setMarkerFilters] = useState<ReadonlySet<MarkerCategory>>(() => new Set(markerCategoryKeys));
  const [clusterSelection, setClusterSelection] = useState<MarkerTarget[]>([]);
  blockedRef.current ||= mapSettings || markerLegend;
  const [mapError, setMapError] = useState('');
  const [questTrack, setQuestTrack] = useState<{ id: string; role: QuestPinRole; navigate: boolean } | null>(null);
  const questStates = useS(s => s.char?.quests);
  const conn = useS(s => s.conn);
  const char = useS(s => s.char);
  const avatar = char ? portraitUrl(char.cls, char.look, {}, 56) : '';
  const avatarRef = useRef(avatar);
  avatarRef.current = avatar;
  const centered = useRef(false);

  const gold = useS(s => s.char?.gold ?? 0);
  const [destinations, setDestinations] = useState<{ portal: string; rows: Destination[] } | null>(null);
  const [eta, setEta] = useState(0);
  const [mode, setMode] = useState<Mode>(readConsent);
  const [follow, setFollow] = useState(preferences.follow);
  const [bearing, setBearing] = useState(0);
  const [info, setInfo] = useState({ n: 0, speed: 0, flags: [] as string[], hasMe: false });
  const [sel, setSel] = useState<string | null>(null);
  const [selPlayer, setSelPlayer] = useState<string | null>(null);
  const [, bump] = useState(0);
  const [gpsErr, setGpsErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [walking, setWalking] = useState(false);

  followRef.current = follow; modeRef.current = mode;
  useEffect(() => { if (!hidden) setTimeout(() => mapRef.current?.resize(), 50); }, [hidden]);
  useEffect(() => {
    const onMode = () => { choose(modeRef.current === 'gps' ? 'virtual' : 'gps'); };
    const onStop = () => { net.send('geoStop', {}); targetRef.current = null; setWalking(false); redraw.current(); };
    const onWipe = () => { void wipe(); };
    const onRecenter = () => { const p = myPos(); if (p && mapRef.current) { followRef.current = true; setFollow(true); mapRef.current.easeTo({ center: [p.lon, p.lat], zoom: mapRef.current.getZoom() }); } };
    const onWalk = (e: Event) => { const d = (e as CustomEvent).detail; if (d) walkTo(d.lat, d.lon, d.name, d.address); };
    const onQuest = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string; role: QuestPinRole; navigate: boolean };
      if (!QUESTS[detail.id]) return;
      setQuestTrack(detail);
    };
    const L: [string, EventListener][] = [['toggleMode', onMode], ['stop', onStop], ['wipe', onWipe], ['recenter', onRecenter], ['walkTo', onWalk], ['quest', onQuest], ['mapSettings', () => { setMarkerLegend(false); setMapSettings(true); }]];
    L.forEach(([t, f]) => geoBus.addEventListener(t, f)); return () => L.forEach(([t, f]) => geoBus.removeEventListener(t, f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const region = meRef.current?.regionLabel;
  useEffect(() => { geoBus.dispatchEvent(new CustomEvent('state', { detail: { mode, walking, region } })); }, [mode, walking, region]);

  const myPos = () => meRef.current;

  // Karte
  useEffect(() => {
    const map = new maplibregl.Map({
      container: box.current!, center: [0, 18], zoom: 2, maxZoom: 19, maxPitch: 65,
      bearing: preferencesRef.current.bearing, pitch: preferencesRef.current.pitch, attributionControl: { compact: true },
      style: mapStyle(preferencesRef.current)
    });
    mapRef.current = map;
    map.on('load', () => {
      for (const id of ['cities', 'territories', 'ranges', 'line', 'quest-area', 'quest-route']) map.addSource(id, { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'cities-fill', type: 'fill', source: 'cities', paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.08 } });
      map.addLayer({ id: 'cities-line', type: 'line', source: 'cities', paint: { 'line-color': '#22d3ee', 'line-width': 2, 'line-dasharray': [3, 2] } });
      map.addLayer({ id: 'territories-fill', type: 'fill', source: 'territories', paint: { 'fill-color': '#d197ff', 'fill-opacity': 0.14 } });
      map.addLayer({ id: 'territories-line', type: 'line', source: 'territories', paint: { 'line-color': '#d197ff', 'line-width': 2 } });
      map.addLayer({ id: 'ranges-fill', type: 'fill', source: 'ranges', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': ['get', 'o'] } });
      map.addLayer({ id: 'ranges-line', type: 'line', source: 'ranges', paint: { 'line-color': ['get', 'c'], 'line-width': 1.5, 'line-opacity': 0.9 } });
      map.addLayer({ id: 'route', type: 'line', source: 'line', filter: ['!=', ['get', 'direct'], true], paint: { 'line-color': '#ffd24a', 'line-width': 3 } });
      map.addLayer({ id: 'route-direct', type: 'line', source: 'line', filter: ['==', ['get', 'direct'], true], paint: { 'line-color': '#ffd24a', 'line-width': 3, 'line-dasharray': [2, 2] } });
      map.addLayer({ id: 'quest-area-fill', type: 'fill', source: 'quest-area', paint: { 'fill-color': '#78ffb4', 'fill-opacity': 0.18 } });
      map.addLayer({ id: 'quest-area-border', type: 'line', source: 'quest-area', paint: { 'line-color': '#78ffb4', 'line-width': 2, 'line-dasharray': [2, 2] } });
      map.addLayer({ id: 'quest-line', type: 'line', source: 'quest-route', paint: { 'line-color': '#73f9b6', 'line-width': 3, 'line-dasharray': [1.5, 2] } });
      applyMapPreferences(map, preferencesRef.current);
      redraw.current();
    });
    map.on('error', () => setMapError('Kartendaten teilweise nicht verfügbar.'));
    map.on('sourcedata', event => { if (event.isSourceLoaded && ['osm', 'satellite', 'openmap'].includes(event.sourceId ?? '')) setMapError(''); });
    map.on('moveend', () => {
      redrawMarkers.current();
      if (!centered.current) return;
      const current = preferencesRef.current;
      const values = { ...current, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
      if (current.zoom === values.zoom && current.pitch === values.pitch && current.bearing === values.bearing) return;
      preferencesRef.current = values;
      setPreferences(values);
    });
    map.on('rotate', () => setBearing(map.getBearing()));
    map.on('dragstart', () => { if (followRef.current) setFollow(false); });
    map.on('click', e => {
      if (blockedRef.current || (e.originalEvent.target as HTMLElement).closest('.mk,.quest-pin')) return;
      setSel(null);
      setSelPlayer(null);
      setClusterSelection([]);
      if (modeRef.current !== 'virtual' || !meRef.current) return;
      const features = map.queryRenderedFeatures(e.point, { layers: ['theme-poi', 'theme-street-label', 'theme-label'].filter(id => map.getLayer(id)) });
      const displayName = (props: Record<string, unknown> | undefined) => {
        const value = props?.['name:de'] ?? props?.name_de ?? props?.name;
        return typeof value === 'string' && value.trim() ? value.trim().slice(0, 96) : undefined;
      };
      const street = displayName(features.find(feature => feature.sourceLayer === 'transportation_name')?.properties);
      const name = displayName(features.find(feature => feature.sourceLayer === 'poi' || feature.sourceLayer === 'place')?.properties);
      walkTo(e.lngLat.lat, e.lngLat.wrap().lng, name ?? street, street);
    });
    return () => { mkObj.current.forEach(o => o.m.remove()); mkObj.current.clear(); meMk.current?.remove(); meMk.current = null; questMarkers.current.forEach(m => m.remove()); questMarkers.current.clear(); routePin.current?.remove(); routePin.current = null; map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveMapPreferences({ ...preferences, follow });
  }, [preferences, follow]);
  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer('osm')) applyMapPreferences(map, preferencesRef.current);
  }, [preferences.kind, preferences.style, preferences.brightness]);

  function setMapKind(kind: MapKind) {
    setMapError('');
    const next = { ...preferencesRef.current, kind };
    preferencesRef.current = next;
    setPreferences(next);
    if (kind === 'buildings' && next.pitch < 25) mapRef.current?.easeTo({ pitch: 48, zoom: Math.max(mapRef.current.getZoom(), 15) });
  }
  function setMapTheme(style: MapTheme | null) {
    setMapError('');
    setPreferences({ ...preferencesRef.current, style });
  }
  function walkTo(lat: number, lon: number, name?: string, address?: string) {
    if (modeRef.current !== 'virtual') return;
    setSel(null);
    setSelPlayer(null);
    setClusterSelection([]);
    setPickTarget(false);
    setRouteTarget({ lat, lon, name, address });
  }

  moveAvatar.current = me => {
    const map = mapRef.current;
    if (!map) return;
    if (!me) { meMk.current?.remove(); meMk.current = null; return; }
    if (!meMk.current) {
      const el = document.createElement('div');
      el.className = 'me';
      el.setAttribute('aria-label', 'Deine Spielfigur');
      el.style.backgroundImage = avatarRef.current ? 'url("' + avatarRef.current + '")' : '';
      meMk.current = new maplibregl.Marker({ element: el }).setLngLat([me.lon, me.lat]).addTo(map);
    }
    meMk.current.setLngLat([me.lon, me.lat]);
    if (!centered.current) {
      centered.current = true;
      map.jumpTo({ center: [me.lon, me.lat], zoom: preferencesRef.current.zoom });
    } else if (followRef.current && !map.isZooming() && !map.isRotating()) {
      map.easeTo({ center: [me.lon, me.lat], duration: 140, easing: t => t });
    }
  };

  const trackedQuest = questTrack ? QUESTS[questTrack.id] : undefined;
  const questProgress = trackedQuest ? questStates?.[trackedQuest.id]?.prog ?? [] : [];
  const pins = trackedQuest ? questPins(trackedQuest, questProgress, objsRef.current, myPos() ?? undefined, questStates?.[trackedQuest.id]?.region) : [];
  const questTarget = pins.find(p => p.role === questTrack?.role) ?? pins[0];

  function focusQuestPin(role: QuestPinRole, navigate: boolean) {
    setQuestTrack(track => track ? { ...track, role, navigate } : null);
  }

  function selectMarker(target: MapTarget) {
    setClusterSelection([]);
    setDestinations(null);
    setSel(target.object?.id ?? null);
    setSelPlayer(target.player?.id ?? null);
  }

  function toggleMarkerCategory(category: MarkerCategory) {
    setMarkerFilters(previous => {
      const next = new Set(previous);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
    setClusterSelection([]);
  }

  redrawMarkers.current = () => {
    const map = mapRef.current;
    if (!map) return;
    const me = myPos();
    const points: MarkerTarget[] = [];
    for (const object of objsRef.current) {
      const category = markerCategories(object).find(value => markerFilters.has(value));
      if (!category) continue;
      const radius = category === 'boss' ? 29 : category === 'elite' ? 24 : category === 'mob' ? 19 : category === 'city' ? 17 : 15;
      const near = !!me && haversine(me.lat, me.lon, object.lat, object.lon) <= GEO.interactM + (object.r || 0);
      points.push({ object, category, radius, near, id: object.id, lat: object.lat, lon: object.lon });
    }
    if (markerFilters.has('player')) {
      for (const player of playersRef.current) points.push({ player, category: 'player', radius: 15, near: false,
        id: `player:${player.id}`, lat: player.lat, lon: player.lon });
    }
    const groups = clusterMarkers(points, (lon, lat) => map.project([lon, lat]), map.getCenter().lng);
    const seen = new Set<string>();
    for (const group of groups) {
      const { members, lat, lon } = group;
      const first = members[0];
      const cluster = members.length > 1;
      const key = cluster ? `cluster:${members.map(point => point.id).join('|')}` : first.id;
      seen.add(key);
      let rec = mkObj.current.get(key);
      if (!rec) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'mk';
        const m = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
        const record = { m, el, sig: '', onClick: () => {} };
        el.addEventListener('click', event => {
          event.stopPropagation();
          if (!blockedRef.current) record.onClick();
        });
        mkObj.current.set(key, record);
        rec = record;
      }
      rec.m.setLngLat([lon, lat]);
      if (cluster) {
        const label = `${members.length} Kartenobjekte`;
        rec.el.classList.add('marker-cluster');
        rec.el.textContent = String(members.length);
        rec.el.setAttribute('aria-label', label);
        rec.el.title = label;
        rec.onClick = () => {
          setSel(null);
          setSelPlayer(null);
          const zoom = map.getZoom();
          if (zoom >= map.getMaxZoom() - .01 || members.every(point => point.lat === first.lat && point.lon === first.lon)) {
            setClusterSelection(members);
          } else {
            setClusterSelection([]);
            followRef.current = false;
            setFollow(false);
            map.easeTo({ center: [lon, lat], zoom: Math.min(zoom + 2, map.getMaxZoom()), duration: 350 });
          }
        };
        continue;
      }
      rec.onClick = () => selectMarker(first);
      const object = first.object;
      const { category, near, radius } = first;
      const building = object?.extra?.building;
      const title = category === 'property' ? propertyMarkerType(building).label : object?.name ?? first.player?.name ?? '';
      const level = object?.lvl ?? first.player?.lvl;
      const mob = object?.k === 'mob' ? MOBS[object.def] : undefined;
      const status = category === 'property' ? propertyMarkerStatus(object?.extra?.marketStatus) : undefined;
      const sig = `${title}|${level}|${near}|${category}|${mob?.art}|${status?.label}`;
      if (rec.sig === sig) continue;
      rec.sig = sig;
      const accessibleName = [title, level && `Lv ${level}`, status?.label].filter(Boolean).join(' · ');
      const color = status?.color ?? MARKER_CATEGORIES[category].color;
      rec.el.setAttribute('aria-label', accessibleName);
      rec.el.classList.toggle('near', near);
      rec.el.classList.toggle('boss', category === 'boss');
      rec.el.classList.toggle('mob-token', !!mob);
      rec.el.style.setProperty('--marker-color', color);
      rec.el.style.width = `${radius * 2}px`;
      rec.el.style.height = `${radius * 2}px`;
      const label = document.createElement('span');
      label.className = 'lbl';
      label.textContent = accessibleName;
      if (mob) {
        const art = document.createElement('img');
        art.src = mobIconUrl(mob.art);
        art.alt = '';
        const badge = document.createElement('span');
        badge.className = 'level';
        badge.textContent = String(level ?? mob.lvl);
        rec.el.replaceChildren(art, badge, label);
      } else {
        rec.el.replaceChildren(drawMarkerIcon(category, building), label);
        if (status) {
          const badge = document.createElement('span');
          badge.className = 'property-status';
          badge.textContent = status.symbol;
          badge.setAttribute('aria-hidden', 'true');
          rec.el.append(badge);
        }
      }
    }
    for (const [id, rec] of mkObj.current) if (!seen.has(id)) { rec.m.remove(); mkObj.current.delete(id); }
  };

  redraw.current = () => {
    const map = mapRef.current;
    if (!map) return;
    const me = myPos();
    const objs = objsRef.current;
    redrawMarkers.current();
    moveAvatar.current(me);
    // GeoJSON
    const ranges: any[] = []; if (me) { ranges.push(poly(me.lat, me.lon, GEO.interactM, { c: '#7dd3fc', o: 0.1 })); if (modeRef.current === 'gps' && gpsPos.current && gpsPos.current.acc > 5) ranges.push(poly(gpsPos.current.lat, gpsPos.current.lon, Math.min(gpsPos.current.acc, 500), { c: '#3b82f6', o: 0.12 })); }
    const cities = markerFilters.has('city') ? objs.filter(o => o.k === 'city' && o.r).map(o => poly(o.lat, o.lon, o.r!)) : [];
    const territories = markerFilters.has('territory') ? objs.filter(o => o.k === 'territory' && o.r).map(o => poly(o.lat, o.lon, o.r!)) : [];
    const visiblePins = pins.filter(pin => markerFilters.has(questMarkerCategory[pin.role]));
    const routeLine = (target: { lat: number; lon: number } | null | undefined) => target && me ?
      [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[me.lon, me.lat], [target.lon, target.lat]] } }] : [];
    const roadmap = previewLine ?? activeLine;
    let previousLon = roadmap?.points[0]?.lon ?? 0;
    const line = roadmap && roadmap.points.length > 1 ? [{
      type: 'Feature', properties: { direct: !!roadmap.direct }, geometry: {
        type: 'LineString', coordinates: roadmap.points.map(({ lat, lon }) => {
          previousLon = lon + 360 * Math.round((previousLon - lon) / 360);
          return [previousLon, lat];
        })
      }
    }] : [];
    const destination = routeTarget ?? travel?.target;
    if (destination) {
      if (!routePin.current) {
        const marker = document.createElement('div');
        marker.className = 'route-pin';
        routePin.current = new maplibregl.Marker({ element: marker, anchor: 'bottom' });
        routePin.current.setLngLat([destination.lon, destination.lat]).addTo(map);
      } else routePin.current.setLngLat([destination.lon, destination.lat]);
    } else {
      routePin.current?.remove();
      routePin.current = null;
    }
    (map.getSource('ranges') as maplibregl.GeoJSONSource | undefined)?.setData(fc(ranges));
    (map.getSource('cities') as maplibregl.GeoJSONSource | undefined)?.setData(fc(cities));
    (map.getSource('territories') as maplibregl.GeoJSONSource | undefined)?.setData(fc(territories));
    (map.getSource('line') as maplibregl.GeoJSONSource | undefined)?.setData(fc(line));
    (map.getSource('quest-area') as maplibregl.GeoJSONSource | undefined)?.setData(fc(visiblePins.filter(p => p.radius).map(p => poly(p.lat, p.lon, p.radius!))));
    (map.getSource('quest-route') as maplibregl.GeoJSONSource | undefined)?.setData(fc(questTrack?.navigate && modeRef.current === 'gps' && questTarget && visiblePins.includes(questTarget) ? routeLine(questTarget) : []));

    const mapPins = new Set<string>();
    for (const pin of visiblePins) {
      const key = trackedQuest!.id + '|' + pin.key;
      mapPins.add(key);
      let marker = questMarkers.current.get(key);
      if (!marker) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'quest-pin ' + pin.role;
        el.append(drawMarkerIcon(questMarkerCategory[pin.role]));
        el.addEventListener('click', event => { event.stopPropagation(); if (!blockedRef.current) focusQuestPin(pin.role, false); });
        const offset: [number, number] = pin.role === 'giver' ? [-17, -20] : pin.role === 'turnin' ? [17, -20] : [0, -27];
        marker = new maplibregl.Marker({ element: el, offset }).setLngLat([pin.lon, pin.lat]).addTo(map);
        questMarkers.current.set(key, marker);
      }
      marker.getElement().setAttribute('aria-label', pinLabels[pin.role] + ' · ' + pin.name);
      marker.setLngLat([pin.lon, pin.lat]);
    }
    for (const [key, marker] of questMarkers.current) {
      if (mapPins.has(key)) continue;
      marker.remove();
      questMarkers.current.delete(key);
    }
    if (!questTrack) focusedQuest.current = null;
    else if (questTarget && focusedQuest.current !== questTrack) {
      if (questTrack.navigate && !me) return;
      focusedQuest.current = questTrack;
      const distance = me ? haversine(me.lat, me.lon, questTarget.lat, questTarget.lon) : 0;
      if (questTrack.navigate && me && modeRef.current === 'virtual' && distance <= 200000) {
        followRef.current = true;
        setFollow(true);
        walkTo(questTarget.lat, questTarget.lon, questTarget.name);
      } else {
        followRef.current = false;
        setFollow(false);
        map.easeTo({ center: [questTarget.lon, questTarget.lat], zoom: questTarget.radius ? 14.5 : 16, duration: 420 });
      }
    }
  };

  // Server-Pakete
  useEffect(() => {
    const off = net.on(m => {
      if (m.t === 'geoRoute') { setActiveLine(m.route as RouteLine | null); return; }
      if (m.t === 'geoMotion') {
        const me = m.position as Me | undefined;
        if (me && (!me.mode || me.mode === modeRef.current)) {
          meRef.current = me;
          moveAvatar.current(me);
          if (me.travel !== undefined) setTravel(previous => {
            const current = me.travel ?? null;
            return current && previous?.id === current.id && previous.status === current.status &&
              previous.etaSeconds === current.etaSeconds && Math.floor(previous.remainingM) === Math.floor(current.remainingM)
              ? previous : current;
          });
          const time = performance.now();
          if (me.speed && time - lastStepAt.current > 340 && !blockedRef.current) {
            lastStepAt.current = time;
            audio.sfx('step');
          }
        }
        return;
      }
      if (m.t !== 'geo') return;
      const me = m.me as Me | undefined;
      if (me && me.mode && me.mode !== modeRef.current) return;
      if (m.off || m.pending) {
        meRef.current = null;
        centered.current = false;
      } else if (me && typeof me.lat === 'number') meRef.current = me;
      objsRef.current = (m.objs as GeoObj[]) || [];
      playersRef.current = (m.players as GeoPlayer[]) || [];
      targetRef.current = me?.dest ?? null;
      if (me?.travel !== undefined) setTravel(me.travel);
      if (m.off || m.pending) { setTravel(null); setActiveLine(null); }
      setWalking(!!me?.dest);
      setEta(me?.etaSeconds ?? 0);
      setInfo({ n: objsRef.current.length, speed: me?.speed ?? 0, flags: me?.flags ?? [], hasMe: !!me });
      redraw.current(); bump(x => x + 1);
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new character or connection always needs a new server-side mode handshake.
  useEffect(() => {
    if (conn !== 'ok' || !char?.id) return;
    net.send('geoConsent', { on: true, visible: mode === 'virtual', gps: mode === 'gps' });
  }, [mode, conn, char?.id]);

  const [gpsRetry, setGpsRetry] = useState(0);
  useEffect(() => {
    if (mode !== 'gps' || conn !== 'ok') return;
    if (!navigator.geolocation) { setGpsErr('Dieses Gerät unterstützt keine Standortbestimmung.'); return; }
    setGpsErr('');
    let last = 0;
    let active = true;
    const watch = navigator.geolocation.watchPosition(p => {
      if (!active || modeRef.current !== 'gps') return;
      const { latitude: lat, longitude: lon, accuracy: acc } = p.coords;
      gpsPos.current = { lat, lon, acc };
      if (acc > 150) { setGpsErr('GPS-Signal zu ungenau. Warte auf eine genauere Position.'); return; }
      const now = Date.now();
      if (now - last < 950) return;
      last = now;
      void net.req('geoPos', { lat, lon, acc, mode: 'gps' }).then(result => {
        if (!active || modeRef.current !== 'gps') return;
        setGpsErr(result.t === 'err' ? result.err : '');
      });
    }, error => {
      if (!active) return;
      setGpsErr(error.code === 1 ? 'Standortzugriff gesperrt. Erlaube ihn in den Einstellungen.' :
        error.code === 2 ? 'Kein GPS-Signal verfügbar.' : 'GPS-Zeitüberschreitung. Versuche es im Freien erneut.');
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 16000 });
    return () => { active = false; navigator.geolocation.clearWatch(watch); };
  }, [mode, conn, gpsRetry]);

  useEffect(() => { redraw.current(); }, [follow, mode, questTrack, questStates, markerFilters, pins.map(p => p.lat + ':' + p.lon).join('|')]);

  useEffect(() => { redraw.current(); }, [routeTarget, previewLine, activeLine]);
  function choose(c: Mode) {
    saveConsent(c);
    modeRef.current = c;
    if (c === 'gps') {
      setRouteTarget(null);
      setPickTarget(false);
      setTravel(null);
      setActiveLine(null);
      meRef.current = null;
      objsRef.current = [];
      centered.current = false;
    }
    gpsPos.current = null;
    setGpsErr('');
    setMode(c);
    redraw.current();
  }
  async function wipe() {
    if (!window.confirm('Alle gespeicherten Standortdaten wirklich löschen?')) return;
    const result = await net.req('geoWipe');
    if (result.t === 'err') { toast(result.err, 'err'); return; }
    const alreadyVirtual = modeRef.current === 'virtual';
    choose('virtual');
    if (alreadyVirtual) net.send('geoConsent', { on: true, visible: false, gps: false });
    targetRef.current = null;
    setWalking(false);
    toast('Standortdaten gelöscht');
  }
  async function interact(id: string, to?: string, group = false) {
    setBusy(true);
    try {
      const r = await net.req('geoInteract', { id, to, group });
      if (r.t === 'err') { toast(r.err || 'Interaktion fehlgeschlagen', 'err'); return; }
      if (r.destinations) { setDestinations({ portal: id, rows: r.destinations }); return; }
      if (r.teleported) { toast('Angekommen: ' + r.teleported); setDestinations(null); }
      else if (r.station) set({ stationProf: r.station, panel: 'craft' });
      else if (r.house) { net.send('houseList'); set({ panel: 'houses' }); }
      else if (r.city) toast(r.text ? r.text.slice(0, 140) : 'Ort betreten');
      else if (r.gathered) toast('Gesammelt');
      setSel(null);
    } finally { setBusy(false); }
  }
  const zoom = (d: number) => mapRef.current?.zoomTo(mapRef.current.getZoom() + d, { duration: 250 });

  const me = myPos();
  const o = sel ? objsRef.current.find(x => x.id === sel && markerCategories(x).some(category => markerFilters.has(category))) : undefined;
  const p = selPlayer && markerFilters.has('player') ? playersRef.current.find(player => player.id === selPlayer) : undefined;
  const dist = o && me ? haversine(me.lat, me.lon, o.lat, o.lon) : null;
  const playerDist = p && me ? haversine(me.lat, me.lon, p.lat, p.lon) : null;
  const inRange = !!o && dist !== null && dist <= GEO.interactM + (o.r || 0);
  const rejected = info.flags.some(f => f === 'speed' || f === 'teleport');
  const questDistance = questTarget && me ? haversine(me.lat, me.lon, questTarget.lat, questTarget.lon) : null;
  const portal = o && destinations?.portal === o.id ? destinations : null;
  const property = o?.k === 'house' && o.def === 'property';
  const territory = o?.k === 'territory';
  const party = useS(s => s.party);
  const propertyStatus = property ? propertyMarkerStatus(o.extra?.marketStatus) : undefined;
  const propertyType = property ? propertyMarkerType(o.extra?.building).label : undefined;

  return (
    <div className="geo" style={hidden ? { display: 'none' } : undefined}>
      <style>{CSS}</style>
      <div className="map" ref={box} />
      <div className="top">
        <div className="status">
          <div>{mode === 'gps' ? 'GPS' : 'Virtuell'} · {(info.speed * 3.6).toFixed(0)} km/h{walking ? ' · ' + (eta > 60 ? Math.ceil(eta / 60) + ' Min.' : eta + ' Sek.') : ''}</div>
          {rejected && <div className="bad">⚠ Bewegung abgelehnt ({info.flags.join(', ')})</div>}
          {gpsErr && <div className="bad">{gpsErr}</div>}
          {mapError && <div>{mapError}</div>}
          {!info.hasMe && <div>Warte auf Position…</div>}
        </div>

      </div>
      <div className="side">
        <button type="button" className={mapSettings ? 'on map-settings-toggle' : 'map-settings-toggle'} onClick={() => { setMarkerLegend(false); setMapSettings(v => !v); }} aria-label="Karteneinstellungen" aria-controls="map-settings" aria-expanded={mapSettings}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2zm6-2v14m6-12v14"/></svg>
        </button>
        <button type="button" className={markerLegend ? 'on map-settings-toggle' : 'map-settings-toggle'} onClick={() => { setMapSettings(false); setMarkerLegend(v => !v); }} aria-label="Kartenfilter und Legende" aria-controls="marker-legend" aria-expanded={markerLegend}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 5h18M6 12h12m-9 7h6M8 3v4m8 3v4m-4 3v4"/></svg>
        </button>
        <button onClick={() => zoom(1)} aria-label="Hineinzoomen">＋</button>
        <button onClick={() => zoom(-1)} aria-label="Herauszoomen">−</button>
        <button onClick={() => mapRef.current?.easeTo({ bearing: 0 })} aria-label="Nach Norden ausrichten" style={{ transform: `rotate(${-bearing}deg)` }}>N</button>
        <button className={follow ? 'on' : ''} onClick={() => { const p = myPos(); setFollow(f => !f); if (p && !follow) mapRef.current?.easeTo({ center: [p.lon, p.lat] }); }} aria-label="Figur folgen" aria-pressed={follow}>◎</button>
      </div>
      {markerLegend && <section id="marker-legend" className="marker-legend" aria-labelledby="marker-legend-title">
        <div className="marker-legend-head"><h3 id="marker-legend-title">Kartenfilter und Legende</h3><button type="button" onClick={() => setMarkerLegend(false)} aria-label="Kartenfilter schließen">×</button></div>
        <div className="marker-legend-actions">
          <button type="button" onClick={() => { setMarkerFilters(new Set(markerCategoryKeys)); setClusterSelection([]); }}>Alle anzeigen</button>
          <button type="button" onClick={() => { setMarkerFilters(new Set()); setClusterSelection([]); }}>Alle ausblenden</button>
        </div>
        <ul>{markerCategoryKeys.map(category => {
          const { color, icon, label } = MARKER_CATEGORIES[category];
          return <li key={category}><label>
            <input type="checkbox" checked={markerFilters.has(category)} onChange={() => toggleMarkerCategory(category)} />
            <svg viewBox="0 0 24 24" style={{ color }} aria-hidden="true"><path d={icon} /></svg>
            {label}
          </label></li>;
        })}</ul>
        {markerFilters.has('property') && <div className="property-legend" aria-label="Immobilienstatus">{(['sale', 'own', 'rent', 'owned'] as const).map(key => {
          const { color, label, symbol } = PROPERTY_MARKER_STATUSES[key];
          return <span key={key}><b style={{ color }} aria-hidden="true">{symbol}</b>{label}</span>;
        })}</div>}
      </section>}
      {mapSettings && <MapDesignMenu value={preferences} onType={setMapKind} onStyle={setMapTheme} onClose={() => setMapSettings(false)}>
        <label>Helligkeit · {preferences.brightness} %
          <input type="range" min="40" max="100" value={preferences.brightness} onChange={e => setPreferences({ ...preferencesRef.current, brightness: Number(e.target.value) })} />
        </label>
        <label>Ausrichtung · {Math.round(preferences.bearing)}°
          <input type="range" min="-180" max="180" value={Math.round(preferences.bearing)} onChange={e => mapRef.current?.setBearing(Number(e.target.value))} />
        </label>
        <label>Neigung · {Math.round(preferences.pitch)}°
          <input type="range" min="0" max="65" value={Math.round(preferences.pitch)} onChange={e => mapRef.current?.setPitch(Number(e.target.value))} />
        </label>
        {gpsErr && <button onClick={() => setGpsRetry(n => n + 1)}>GPS erneut versuchen</button>}
      </MapDesignMenu>}
      {!hidden && !controlsBlocked && !mapSettings && !markerLegend && !routeTarget && !travel && mode === 'virtual' && info.hasMe &&
        <Joystick available={me?.travelModes ?? ['walk', 'run']} bearing={() => mapRef.current?.getBearing() ?? 0} onStart={() => { setRouteTarget(null); setPickTarget(false); setSel(null); setSelPlayer(null); setClusterSelection([]); setFollow(true); followRef.current = true; }} />}
      {!hidden && !controlsBlocked && !mapSettings && mode === 'virtual' && me && routeTarget &&
        <RoutePlanner target={routeTarget} start={me} available={me.travelModes ?? ['walk', 'run']}
          onGeometry={setPreviewLine} onClose={() => setRouteTarget(null)} onStarted={() => setRouteTarget(null)} />}
      {!hidden && !controlsBlocked && !mapSettings && mode === 'virtual' && !routeTarget && travel && !pickTarget &&
        <TravelStatus travel={travel} onReroute={() => setPickTarget(true)} />}
      {pickTarget && !routeTarget && <div className="route-panel row"><span className="grow">Neues Ziel auf der Karte antippen</span><button type="button" onClick={() => setPickTarget(false)}>Zurück</button></div>}
      {trackedQuest && !o && !p && !clusterSelection.length && !routeTarget && !travel && <section className="quest-track" aria-label="Quest auf der Karte">
        <div className="row"><b className="grow">{trackedQuest.name}</b><button aria-label="Questmarkierungen schließen" onClick={() => setQuestTrack(null)}>×</button></div>
        {questTarget && <div>{pinLabels[questTarget.role]} · {questTarget.name}{questDistance !== null && ' · ' + distanceLabel(questDistance)}</div>}
        {questStates?.[trackedQuest.id] && <div>{trackedQuest.goals.map((goal, i) => <span key={i}>{i > 0 && ' · '}{questProgress[i] ?? 0}/{goal.n}{goal.label ? ' ' + goal.label : ''}</span>)}</div>}
        {questTrack?.navigate && questDistance !== null && mode === 'virtual' && questDistance > 200000 && <div>Für diese Entfernung ein Teleportportal nutzen.</div>}
        {questTarget?.role === 'objective' && trackedQuest.goals[0]?.k === 'survey' && questStates?.[trackedQuest.id]?.state === 'active' &&
          <button type="button" disabled={questDistance === null || questDistance > (questTarget.radius ?? 0) || (questTarget.virtualOnly && mode === 'gps')}
            onClick={() => void net.req('geoQuestSurvey', { id: trackedQuest.id }).then(reply => {
              if (reply.t === 'err') toast(reply.err, 'err');
            })}>Feldnotizen aufnehmen</button>}
        {questTarget?.virtualOnly && mode === 'gps' ? <div>Dieses Ziel ist im virtuellen Modus erreichbar.</div> : questTrack?.navigate && mode === 'gps' && <div>Die Linie zeigt die Richtung zum Ziel.</div>}
        <div className="row">{pins.map(pin => <button key={pin.key} onClick={() => focusQuestPin(pin.role, false)}>{pinLabels[pin.role]}</button>)}</div>
      </section>}
      {clusterSelection.length > 0 && <section className="pop marker-list" aria-labelledby="marker-cluster-title">
        <div className="marker-list-head"><h3 id="marker-cluster-title">Kartenobjekte</h3><button type="button" aria-label="Kartenobjekte schließen" onClick={() => setClusterSelection([])}>×</button></div>
        <ul>{clusterSelection.map(target => <li key={target.id}><button type="button" onClick={() => selectMarker(target)}>
          {target.category === 'property' ? propertyMarkerType(target.object?.extra?.building).label : target.object?.name ?? target.player?.name} · {me ? distanceLabel(haversine(me.lat, me.lon, target.lat, target.lon)) : MARKER_CATEGORIES[target.category].label}
        </button></li>)}</ul>
      </section>}
      {p && <section className="pop" aria-label="Spieler auf der Karte">
        <h3>{p.name} · Lv {p.lvl}</h3>
        <div className="dim">Ungefähre Position{playerDist !== null && ` · ca. ${distanceLabel(playerDist)} entfernt`}</div>
        <div className="row">
          {mode === 'virtual' && <button className="on" onClick={() => walkTo(p.lat, p.lon, `Ungefähre Position von ${p.name}`)}>Route planen</button>}
          <button onClick={() => setSelPlayer(null)}>Schließen</button>
        </div>
      </section>}
      {o && (
        <div className="pop">
          <h3>{propertyType ?? o.name}{o.lvl ? ` · Lv ${o.lvl}` : ''}</h3>
          <div className="dim">{markerCategories(o).map(category => MARKER_CATEGORIES[category].label).join(' · ')}{o.fam ? ` · ${o.fam}` : ''}{propertyStatus && ` · ${propertyStatus.label}`}</div>
          {territory && <div>{o.extra?.ownerName ? `Kontrolle: ${o.extra.ownerTag ? `[${o.extra.ownerTag}] ` : ''}${o.extra.ownerName}` : 'Unbesetzt'}</div>}
          {dist !== null && <div style={{ marginTop: 6, color: inRange ? '#8affb0' : '#ffd27a' }}>{distanceLabel(dist)} entfernt{inRange && ' · In Reichweite'}</div>}
          {portal && inRange && (
            <div className="portal-destinations">
              {mode === 'gps' && <p>Zum Teleportieren in den virtuellen Modus wechseln.</p>}
              {portal.rows.length === 0 && <p>Entdecke weitere Orte, um sie als Ziele freizuschalten.</p>}
              {portal.rows.map(d => <button key={d.id} disabled={busy || mode === 'gps' || d.cost > gold} onClick={() => interact(o.id, d.id)}>{d.name} · {d.cost} Gold</button>)}
            </div>
          )}
          <div className="row">
            {property && <button className="on" onClick={() => { set({ panel: 'geoProperty', selected: { id: o.id }, navPanel: 'more', dialog: null }); setSel(null); }}>Immobilie ansehen</button>}
            {territory && <button className="on" onClick={() => { set({ panel: 'guild', selected: { territory: o.def } }); setSel(null); }}>Gebiet ansehen</button>}
            {!property && !territory && inRange && !portal && <button className="on" disabled={busy} onClick={() => interact(o.id)}>{o.k === 'teleporter' ? 'Ziele anzeigen' : o.k === 'mob' ? 'Angreifen' : o.k === 'dungeon' ? 'Öffentlich betreten' : 'Interagieren'}</button>}
            {o.k === 'dungeon' && inRange && party && <button disabled={busy} onClick={() => interact(o.id, undefined, true)}>Gruppeninstanz betreten</button>}
            {mode === 'virtual' && (!inRange || property || territory) && <button onClick={() => walkTo(o.lat, o.lon, o.name, o.extra?.address)}>Route planen</button>}
            <button onClick={() => { setSel(null); setDestinations(null); }}>Schließen</button>
          </div>
        </div>
      )}
    </div>
  );
}
